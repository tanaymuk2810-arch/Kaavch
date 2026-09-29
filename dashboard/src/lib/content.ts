// TS types mirroring the Android content model (module/ModulePack.kt and
// assessment/AssessmentModels.kt). JSONs are copied verbatim from the app.
export interface L10n {
  en: string;
  hi: string;
  sat: string;
}

export type StepType = "STATIC" | "AR";

export interface ArTask {
  taskId: string;
  instruction: L10n;
  correctAsset: string;
  distractors: string[];
  scale?: number;
}

export interface StaticBlock {
  title: L10n;
  body: L10n;
}

export interface ContentStep {
  id: string;
  type: StepType;
  audio?: { en?: string; hi?: string; sat?: string };
  task?: ArTask;
  static?: StaticBlock;
}

export interface ModulePack {
  moduleId: string;
  title: L10n;
  subtitle: L10n;
  version: number;
  passMark: number;
  steps: ContentStep[];
}

export type QuestionType =
  | "MC"
  | "TRUE_FALSE"
  | "SEQ"
  | "MATCH"
  | "AR_EVIDENCE";

export interface Option {
  id: string;
  label: L10n;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: L10n;
  points: number;
  options: Option[];
  answer: number; // correct MC index
  answerBool: boolean; // correct TRUE_FALSE
  sequence: string[]; // correct SEQ order
  pairs: Record<string, string>; // MATCH correct mapping
  arTaskId?: string | null;
}

export interface AssessmentConfig {
  moduleId: string;
  version: number;
  passMark: number;
  questions: Question[];
}

const LANG = ["en", "hi", "sat"] as const;
export type Lang = (typeof LANG)[number] | string;

export function tr(s: L10n, lang: string): string {
  return s[lang as keyof L10n] ?? s.en;
}

export const MODULES = [
  { id: "fire_explosion", titleKey: "module_fire_title", domain: "FIRE", passMark: 80 },
  { id: "gas_confined", titleKey: "module_gas_title", domain: "GAS", passMark: 80 },
  { id: "machinery", titleKey: "module_machinery_title", domain: "MACHINERY", passMark: 80 },
  { id: "ppe", titleKey: "module_ppe_title", domain: "PPE", passMark: 80 },
  { id: "emergency", titleKey: "module_emergency_title", domain: "EMERGENCY", passMark: 80 },
] as const;

export async function loadPack(moduleId: string): Promise<ModulePack | null> {
  try {
    const r = await fetch(`/modules/${moduleId}.json`);
    return (await r.json()) as ModulePack;
  } catch {
    return null;
  }
}

export async function loadAssessment(
  moduleId: string,
): Promise<AssessmentConfig | null> {
  try {
    const r = await fetch(`/modules/${moduleId}_assessment.json`);
    return (await r.json()) as AssessmentConfig;
  } catch {
    return null;
  }
}

export function objectLabel(asset: string, lang: string): string {
  if (asset.includes("extinguisher")) {
    return lang === "hi" ? "आग बुझाने का यंत्र" : lang === "sat" ? "ᱥᱮᱸᱜᱮᱞ ᱜᱚᱡ ᱢᱮᱥᱤᱱ" : "Fire extinguisher";
  }
  if (asset.includes("gas_cylinder")) {
    return lang === "hi" ? "गैस सिलेंडर" : lang === "sat" ? "ᱜᱮᱥ ᱥᱤᱞᱤᱱᱰᱟᱨ" : "Gas cylinder";
  }
  if (asset.includes("safety_sign") || asset.includes("sign")) {
    return lang === "hi" ? "निकास चिह्न" : lang === "sat" ? "ᱫᱟᱹᱲ ᱪᱤᱱᱦᱟᱹ" : "Exit sign";
  }
  if (asset.includes("helmet")) {
    return lang === "hi" ? "सुरक्षा हेलमेट" : lang === "sat" ? "ᱥᱩᱨᱚᱠᱷᱟ ᱦᱮᱞᱢᱮᱴ" : "Safety helmet";
  }
  if (asset.includes("guard")) {
    return lang === "hi" ? "मशीन गार्ड" : lang === "sat" ? "ᱢᱮᱥᱤᱱ ᱜᱟᱨᱰ" : "Machinery guard";
  }
  if (asset.includes("firstaid")) {
    return lang === "hi" ? "प्राथमिक चिकित्सा किट" : lang === "sat" ? "ᱯᱟᱹᱦᱤᱞ ᱩᱯᱪᱟᱹᱨ ᱠᱤᱴ" : "First-aid kit";
  }
  return substringAfterLast(asset, "/");
}

export function substringAfterLast(s: string, sep: string): string {
  return s.slice(s.lastIndexOf(sep) + 1);
}

export const MODULE_META: Record<string, { title: L10n; img: string; accent: string }> = {
  fire_explosion: {
    title: { en: "Fire & Explosion", hi: "आग और विस्फोट", sat: "ᱥᱮᱸᱜᱮᱞ ᱟᱨ ᱵᱤᱥᱯᱷᱚᱴ" },
    img: "/img/modules/fire.svg",
    accent: "#E2571B",
  },
  gas_confined: {
    title: { en: "Gas & Confined Space", hi: "गैस और बंद जगह", sat: "ᱜᱮᱥ ᱟᱨ ᱮᱥᱮᱫ ᱴᱷᱟᱶ" },
    img: "/img/modules/gas.svg",
    accent: "#38BDF8",
  },
  machinery: {
    title: { en: "Machinery Safety", hi: "मशीन सुरक्षा", sat: "ᱢᱮᱥᱤᱱ ᱥᱩᱨᱚᱠᱷᱟ" },
    img: "/img/modules/machinery.svg",
    accent: "#94A3B8",
  },
  ppe: {
    title: { en: "PPE · Helmet", hi: "पीपीई · हेलमेट", sat: "ᱥᱩᱨᱚᱠᱷᱟ ᱦᱮᱞᱢᱮᱴ" },
    img: "/img/modules/ppe.svg",
    accent: "#F7C55C",
  },
  emergency: {
    title: { en: "Emergency · First Aid", hi: "आपातकाल · प्राथमिक उपचार", sat: "ᱟᱯᱟᱛ · ᱯᱟᱹᱦᱤᱞ ᱩᱯᱪᱟᱹᱨ" },
    img: "/img/modules/emergency.svg",
    accent: "#EF4444",
  },
};

export function moduleMeta(id: string, lang = "en"): { title: string; img: string; accent: string } {
  const m = MODULE_META[id] ?? {
    title: { en: id, hi: id, sat: id },
    img: "/img/modules/fire.svg",
    accent: "#0F6B3A",
  };
  return { title: tr(m.title, lang), img: m.img, accent: m.accent };
}