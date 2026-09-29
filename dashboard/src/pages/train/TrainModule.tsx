import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { loadPack, tr, objectLabel, substringAfterLast, moduleMeta } from "../../lib/content";
import type { ModulePack } from "../../lib/content";
import { useSandbox, markStarted, markArEvidence, setLanguage } from "../../lib/workerStore";
import { sx, fmt } from "../../lib/i18n";
import Logo from "../../components/Logo";
import LangSwitch from "../../components/LangSwitch";
import CameraSimulation from "../../components/CameraSimulation";
import Info3D from "../../components/Info3D";
import type { Hazard } from "../../components/simGestures";

// 3D infographic (simulation scene, auto-played) shown beside each lesson.
const INFO_MAP: Record<string, [Hazard, number]> = {
  fire_intro: ["fire", 1],
  theory_pass: ["fire", 0],
  theory_evac: ["fire", 3],
  fire_summary: ["fire", 2],
  gas_intro: ["gas", 1],
  theory_buddy: ["gas", 3],
  theory_ppe_gas: ["gas", 2],
  gas_summary: ["gas", 0],
  mach_intro: ["gear", 0],
  theory_loto: ["gear", 1],
  mach_summary: ["gear", 2],
  ppe_intro: ["sparks", 0],
  ppe_wear: ["sparks", 1],
  ppe_summary: ["sparks", 2],
  firstaid_intro: ["pulse", 1],
  firstaid_steps: ["pulse", 2],
  emergency_summary: ["pulse", 0],
};

export default function TrainModule() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const sandbox = useSandbox();
  const w = sandbox.worker;

  const [pack, setPack] = useState<ModulePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sim, setSim] = useState(false);

  useEffect(() => {
    if (!w) return;
    markStarted(id);
    void loadPack(id).then((p) => {
      setPack(p);
      setLoading(false);
    });
  }, [id, w]);

  if (!w) return <NoWorker />;
  if (loading) return <Centered>{sx("loading", "en")}</Centered>;
  if (!pack) return <Centered>{sx("noContent", "en")}</Centered>;

  const lang = w.language;
  const step = pack.steps[idx];
  const isLast = idx === pack.steps.length - 1;
  const meta = moduleMeta(id, lang);

  function arAssetPaths(): string[] {
    const t = step.task;
    if (!t) return [];
    return [t.correctAsset, ...t.distractors];
  }

  function onPick(asset: string) {
    const t = step.task;
    if (!t) return;
    const correct = asset === t.correctAsset;
    markArEvidence(id, t.taskId, correct);
    setFeedback(correct ? sx("pickRight", lang) : sx("pickWrong", lang));
    if (correct) {
      setTimeout(() => finish(), 700);
    }
  }

  function finish() {
    if (isLast) nav(`/train/assess/${id}`);
    else setIdx(idx + 1);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/train" className="text-sm text-brand hover:underline">{sx("allModules", lang)}</Link>
        <span className="text-xs text-slate-500">
          {fmt("stepOfN", lang, { i: idx + 1, n: pack.steps.length })} ·{" "}
          <span className="font-mono">{substringAfterLast(step.id, "_")}</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Logo className="w-8 h-8 shrink-0" />
        <h1 className="text-lg font-bold text-brand-900 flex-1">{meta.title}</h1>
        <LangSwitch value={lang} onChange={(l) => setLanguage(l)} />
      </div>
      <img
        src={meta.img}
        alt={meta.title}
        className="w-full h-36 object-contain rounded-xl bg-[#0B1520]"
        style={{ boxShadow: `0 10px 28px -14px ${meta.accent}` }}
      />
      <Checkpoints n={pack.steps.length} cur={idx} onJump={setIdx} />

      {step.type === "STATIC" && step.static ? (
        <div key={step.id} className="anim-sim-up bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="p-6">
              <h2 className="text-xl font-bold text-brand-900">{tr(step.static.title, lang)}</h2>
              <div className="mt-1 h-1 w-14 rounded-full" style={{ background: meta.accent }} />
              <p className="mt-3 text-slate-700 leading-relaxed">{tr(step.static.body, lang)}</p>
            </div>
            <div className="p-4 md:pl-0 flex">
              {INFO_MAP[step.id] ? (
                <Info3D hazard={INFO_MAP[step.id][0]} index={INFO_MAP[step.id][1]} className="flex-1" />
              ) : (
                <img src={meta.img} alt={meta.title} className="flex-1 object-contain rounded-xl bg-[#0B1520] min-h-[13rem]" />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold">{tr(step.task!.instruction, lang)}</h2>
          {sim && step.task ? (
            <CameraSimulation
              moduleId={id}
              lang={lang}
              title={tr(step.task.instruction, lang)}
              onComplete={() => {
                markArEvidence(id, step.task!.taskId, true);
                finish();
              }}
              onClose={() => setSim(false)}
            />
          ) : (
            <>
              <p className="text-xs text-slate-500 mt-1">{sx("simLead", lang)}</p>
              <button
                onClick={() => setSim(true)}
                className="mt-4 w-full bg-hazard-500 text-white rounded-lg px-5 py-3 font-semibold hover:bg-hazard-600 btn-push anim-glow"
              >
                {sx("startSim", lang)}
              </button>
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  {sx("quickPick", lang)}
                </p>
                <div className="grid gap-2">
                  {arAssetPaths().map((a) => (
                    <button
                      key={a}
                      onClick={() => onPick(a)}
                      className="border rounded-lg px-4 py-3 text-left text-slate-700 hover:bg-brand-light hover:border-brand"
                    >
                      {objectLabel(a, lang)}
                    </button>
                  ))}
                </div>
              </div>
              {feedback && (
                <p className={`mt-3 text-sm font-medium ${feedback.startsWith("✓") ? "text-success" : "text-alert"}`}>
                  {feedback}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex justify-end">
        {step.type === "STATIC" &&
          (isLast ? (
            <button
              onClick={() => nav(`/train/assess/${id}`)}
              className="anim-shine relative bg-hazard-500 text-white rounded-xl px-6 py-3 font-bold hover:bg-hazard-600 btn-push"
            >
              {sx("startAssess", lang)}
              <span className="anim-bob inline-block"> →</span>
            </button>
          ) : (
            <button
              onClick={() => setIdx(idx + 1)}
              className="anim-shine relative bg-hazard-500 text-white rounded-xl px-6 py-3 font-bold hover:bg-hazard-600 btn-push"
            >
              {sx("markNext", lang)}
              <span className="anim-bob inline-block"> →</span>
            </button>
          ))}
      </div>
    </div>
  );
}

function Checkpoints({ n, cur, onJump }: { n: number; cur: number; onJump: (i: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: n }, (_, i) => {
        const done = i < cur;
        const active = i === cur;
        return (
          <div key={i} className="flex-1 flex items-center gap-1.5">
            <button
              onClick={() => onJump(i)}
              title={`Go to step ${i + 1}`}
              className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold shrink-0 transition-all duration-300 cursor-pointer hover:scale-110 ${
                done
                  ? "bg-brand text-white"
                  : active
                    ? "bg-hazard-400 text-white anim-glow"
                    : "bg-white border-2 border-slate-300 text-slate-400 hover:border-brand"
              }`}
            >
              {done ? "✓" : i + 1}
            </button>
            {i < n - 1 && (
              <div className="h-1 flex-1 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-brand rounded-full ${done ? "anim-line" : "scale-x-0"}`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NoWorker() {
  return (
    <Centered>
      <p>{sx("needRegister", "en")}</p>
      <Link to="/train" className="text-brand underline">{sx("goRegister", "en")} →</Link>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-xl mx-auto text-center text-slate-600 py-24">{children}</div>
  );
}
