// On-device (localStorage) worker database — mirrors the Android Room tables:
// workers, module_progress, training_attempts, ar_events, certificates.
// Exporting from here produces the same JSON shape as ExportManager.kt.
import { useSyncExternalStore } from "react";
import type { AssessmentConfig, Question } from "./content";
import { generateCertificate, type WebCertificate } from "./chain";
import { setDataset, clearDataset } from "./store";
import type { LegacyCert } from "./verify";

export interface WebWorker {
  id: string;
  name: string;
  phone: string;
  siteName: string;
  district: string;
  role: string;
  language: string;
  createdAt: number;
  isActive: boolean;
}

export interface WebAttempt {
  id: string;
  workerId: string;
  moduleId: string;
  score: number;
  passed: boolean;
  startedAt: number;
  finishedAt: number;
  answersJson: string;
}

export interface ModuleProgress {
  state: 0 | 1 | 2 | 3; // NOT_STARTED | IN_PROGRESS | PASSED | FAILED
  bestScore: number;
  attempts: number;
  lastActivityAt: number;
}

interface ProfileData {
  attempts: WebAttempt[];
  certificates: WebCertificate[];
  progress: Record<string, ModuleProgress>;
  arEvidence: Record<string, boolean>; // `${moduleId}:${taskId}` -> done correctly
}

interface SandboxState extends ProfileData {
  workers: WebWorker[]; // every worker registered on this device
  currentId: string | null; // logged-in worker
  worker: WebWorker | null; // mirror of the logged-in worker (compat)
  profiles: Record<string, ProfileData>; // per-worker saved progress
}

const KEY = "suraksha_sandbox_v1";

function emptyState(): SandboxState {
  return {
    workers: [],
    currentId: null,
    worker: null,
    profiles: {},
    attempts: [],
    certificates: [],
    progress: {},
    arEvidence: {},
  };
}

function blankProfile(): ProfileData {
  return { attempts: [], certificates: [], progress: {}, arEvidence: {} };
}

let state: SandboxState = load();
const listeners = new Set<() => void>();

function load(): SandboxState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const s = JSON.parse(raw) as Partial<SandboxState>;
    if (!s.workers) {
      // migrate the old single-worker shape
      const w = (s as { worker?: WebWorker | null }).worker ?? null;
      return {
        ...emptyState(),
        ...(w ? { workers: [w], currentId: w.id, worker: w } : {}),
        attempts: s.attempts ?? [],
        certificates: s.certificates ?? [],
        progress: s.progress ?? {},
        arEvidence: s.arEvidence ?? {},
      };
    }
    return { ...emptyState(), ...s };
  } catch {
    return emptyState();
  }
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((f) => f());
  // keep the admin panel live on every change (register, login, attempts…)
  try {
    if (state.worker) syncDashboard();
    else clearDataset();
  } catch {
    /* admin sync must never break the worker app */
  }
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSandbox(): SandboxState {
  return state;
}

export function useSandbox(): SandboxState {
  return useSyncExternalStore(subscribe, getSandbox);
}

export function clearSandbox() {
  state = emptyState();
  persist();
}

export function registerWorker(w: Omit<WebWorker, "id" | "createdAt" | "isActive" | "role">) {
  const worker: WebWorker = {
    ...w,
    id: crypto.randomUUID(),
    role: "worker",
    createdAt: Date.now(),
    isActive: true,
  };
  state = { ...state, workers: [...state.workers, worker] };
  activate(worker.id);
}

// --- Login / multi-worker support (all on-device, offline) ---
function snapshot() {
  if (!state.currentId) return;
  state.profiles[state.currentId] = {
    attempts: state.attempts,
    certificates: state.certificates,
    progress: state.progress,
    arEvidence: state.arEvidence,
  };
}

function activate(id: string | null) {
  snapshot();
  const w = id ? state.workers.find((x) => x.id === id) ?? null : null;
  const p = (id && state.profiles[id]) || blankProfile();
  state = {
    ...state,
    currentId: w ? w.id : null,
    worker: w,
    attempts: p.attempts,
    certificates: p.certificates,
    progress: p.progress,
    arEvidence: p.arEvidence,
  };
  persist();
}

export function listWorkers(): WebWorker[] {
  return state.workers;
}

export function findByPhone(phone: string): WebWorker | undefined {
  const digits = phone.replace(/\D/g, "");
  return state.workers.find((w) => w.phone.replace(/\D/g, "") === digits);
}

export function loginWorker(id: string): boolean {
  const w = state.workers.find((x) => x.id === id);
  if (!w) return false;
  activate(w.id);
  return true;
}

export function logout() {
  activate(null);
}

export function setLanguage(lang: string) {
  if (state.worker) {
    state = { ...state, worker: { ...state.worker, language: lang } };
    persist();
  }
}

export function markStarted(moduleId: string) {
  const prev = state.progress[moduleId];
  state = {
    ...state,
    progress: {
      ...state.progress,
      [moduleId]: {
        state: prev && prev.state === 2 ? 2 : 1,
        bestScore: prev?.bestScore ?? 0,
        attempts: prev?.attempts ?? 0,
        lastActivityAt: Date.now(),
      },
    },
  };
  persist();
}

export function markArEvidence(moduleId: string, taskId: string, correct: boolean) {
  if (!correct) return;
  state = {
    ...state,
    arEvidence: { ...state.arEvidence, [`${moduleId}:${taskId}`]: true },
  };
  persist();
}

export function arDone(moduleId: string, taskId: string): boolean {
  return state.arEvidence[`${moduleId}:${taskId}`] === true;
}

// --- Assessment scoring (mirrors AssessmentEngine.kt exactly) ---
export interface AssessmentResult {
  moduleId: string;
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  finishedAt: number;
}

export interface Answer {
  questionId: string;
  choice?: number;
  boolValue?: boolean;
  sequence?: string[];
  mapping?: Record<string, string>;
}

export function evaluate(
  config: AssessmentConfig,
  answers: Answer[],
  moduleId: string,
): AssessmentResult {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  let earned = 0;
  let total = 0;
  let correctCount = 0;
  for (const q of config.questions as Question[]) {
    total += q.points;
    let correct = false;
    const a = byId.get(q.id);
    switch (q.type) {
      case "MC":
        correct = a != null && (a.choice ?? -1) === q.answer;
        break;
      case "TRUE_FALSE":
        correct = a != null && (a.boolValue ?? false) === q.answerBool;
        break;
      case "SEQ":
        correct =
          a != null &&
          q.sequence.length > 0 &&
          JSON.stringify(a.sequence ?? []) === JSON.stringify(q.sequence);
        break;
      case "MATCH":
        correct =
          a != null &&
          Object.entries(q.pairs).every(([k, v]) => a.mapping?.[k] === v);
        break;
      case "AR_EVIDENCE":
        correct = q.arTaskId != null && arDone(moduleId, q.arTaskId);
        break;
    }
    if (correct) {
      earned += q.points;
      correctCount++;
    }
  }
  const score = total === 0 ? 0 : Math.floor((earned * 100) / total);
  return {
    moduleId,
    score,
    passed: score >= config.passMark,
    correctCount,
    totalQuestions: config.questions.length,
    finishedAt: Date.now(),
  };
}

export function recordAttempt(workerId: string, config: AssessmentConfig, answers: Answer[]): AssessmentResult {
  const result = evaluate(config, answers, config.moduleId);
  const attempt: WebAttempt = {
    id: crypto.randomUUID(),
    workerId,
    moduleId: config.moduleId,
    score: result.score,
    passed: result.passed,
    startedAt: result.finishedAt - 60_000,
    finishedAt: result.finishedAt,
    answersJson: JSON.stringify(answers),
  };
  const prev = state.progress[config.moduleId];
  state = {
    ...state,
    attempts: [...state.attempts, attempt],
    progress: {
      ...state.progress,
      [config.moduleId]: {
        state: result.passed ? 2 : 3,
        bestScore: Math.max(prev?.bestScore ?? 0, result.score),
        attempts: (prev?.attempts ?? 0) + 1,
        lastActivityAt: result.finishedAt,
      },
    },
  };
  persist();
  return result;
}

// Chain-aware certificate issuance with 5-minute dedupe (mirrors SessionRepository).
export async function issueCertificate(moduleId: string, score: number): Promise<WebCertificate> {
  const w = state.worker;
  if (!w) throw new Error("No worker");
  const recent = [...state.certificates]
    .reverse()
    .find((c) => c.workerId === w.id && c.moduleId === moduleId && c.score === score);
  if (recent && Date.now() - recent.issuedAt < 5 * 60 * 1000) return recent;

  const last = state.certificates[state.certificates.length - 1];
  const cert = await generateCertificate(
    w.id,
    moduleId,
    score,
    w.siteName,
    last?.chainHash ?? undefined,
  );
  state = { ...state, certificates: [...state.certificates, cert] };
  persist();
  syncDashboard();
  return cert;
}

// Push the sandbox into the admin dashboard store (the "device export" flow).
export function syncDashboard() {
  if (!state.worker) return;
  setDataset({
    source: "suraksha-trainer/web-sandbox",
    exportedAt: Date.now(),
    workers: [
      {
        id: state.worker.id,
        name: state.worker.name,
        phone: state.worker.phone,
        siteName: state.worker.siteName,
        district: state.worker.district,
        role: state.worker.role,
        createdAt: state.worker.createdAt,
      },
    ],
    attempts: state.attempts,
    certificates: state.certificates as unknown as LegacyCert[],
  });
}

export function exportJson(): string {
  return JSON.stringify(
    {
      exportedAt: Date.now(),
      source: "suraksha-trainer/web-sandbox",
      workers: state.worker
        ? [
            {
              id: state.worker.id,
              name: state.worker.name,
              phone: state.worker.phone,
              siteName: state.worker.siteName,
              district: state.worker.district,
              role: state.worker.role,
              createdAt: state.worker.createdAt,
            },
          ]
        : [],
      attempts: state.attempts,
      certificates: state.certificates.map((c) => ({
        id: c.id,
        certNo: c.certNo,
        workerId: c.workerId,
        moduleId: c.moduleId,
        score: c.score,
        issuedAt: c.issuedAt,
        siteName: c.siteName,
        prevHash: c.prevHash,
        chainHash: c.chainHash,
        revoked: c.revoked,
        qrText: c.qrText,
      })),
    },
    null,
    2,
  );
}