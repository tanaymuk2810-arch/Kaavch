// Tiny global store for the imported offline export. No server, no auth.
import { useSyncExternalStore } from "react";
import type { LegacyCert } from "./verify";

export interface ExportedWorker {
  id: string;
  name: string;
  phone: string;
  siteName: string;
  district: string;
  role: string;
  createdAt: number;
}

export interface ExportedAttempt {
  id: string;
  workerId: string;
  moduleId: string;
  score: number;
  passed: boolean;
  finishedAt: number;
}

export interface Dataset {
  source?: string;
  exportedAt?: number;
  workers: ExportedWorker[];
  attempts: ExportedAttempt[];
  certificates: LegacyCert[];
}

let current: Dataset = empty();
let listeners = new Set<() => void>();

function empty(): Dataset {
  return { workers: [], attempts: [], certificates: [] };
}

function emit() {
  listeners.forEach((f) => f());
}

export function getDataset(): Dataset {
  return current;
}

export function setDataset(d: Dataset) {
  current = d;
  emit();
}

export function clearDataset() {
  current = empty();
  emit();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useDataset(): Dataset {
  return useSyncExternalStore(subscribe, getDataset);
}

// number keys in the device export arrive as numbers already; tolerate strings too
function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

export function parseExport(file: File): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const certificates = (raw.certificates ?? []).map((c: Record<string, unknown>) => ({
          ...c,
          issuedAt: num(c.issuedAt),
          score: num(c.score),
        }));
        const workers = (raw.workers ?? []).map((w: Record<string, unknown>) => ({
          ...w,
          createdAt: num(w.createdAt),
        }));
        const attempts = (raw.attempts ?? []).map((a: Record<string, unknown>) => ({
          ...a,
          score: num(a.score),
          finishedAt: num(a.finishedAt),
        }));
        resolve({ workers, attempts, certificates, exportedAt: num(raw.exportedAt) });
      } catch (e) {
        reject(e as Error);
      }
    };
    reader.readAsText(file);
  });
}