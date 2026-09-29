import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loadAssessment, tr, objectLabel } from "../../lib/content";
import type { AssessmentConfig, Question } from "../../lib/content";
import { useSandbox, recordAttempt, arDone, setLanguage } from "../../lib/workerStore";
import type { Answer, AssessmentResult } from "../../lib/workerStore";
import { sx, fmt } from "../../lib/i18n";
import LangSwitch from "../../components/LangSwitch";

export default function TrainAssess() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const sandbox = useSandbox();
  const w = sandbox.worker;

  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    if (!w) return;
    void loadAssessment(id).then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, [id, w]);

  if (!w) return <Centered>{sx("needRegister", "en")} <Link to="/train" className="text-brand">{sx("go", "en")}</Link></Centered>;
  if (loading) return <Centered>{sx("loading", "en")}</Centered>;
  if (!config) return <Centered>{sx("notBundled", "en")}</Centered>;

  const lang = w.language;

  if (result) {
    return (
      <div className="max-w-xl mx-auto text-center space-y-4">
        <div className="flex justify-end">
          <LangSwitch value={lang} onChange={(l) => setLanguage(l)} />
        </div>
        <h1 className="text-2xl font-bold">{result.passed ? sx("assessPass", lang) : sx("assessFail", lang)}</h1>
        <p className="text-lg">{fmt("scoreLine", lang, { s: result.score, m: config.passMark })}</p>
        <p className="text-sm text-slate-500">
          {fmt("qCorrectLine", lang, { a: result.correctCount, b: result.totalQuestions })}
        </p>
        {result.passed ? (
          <button
            onClick={() => nav(`/train/cert/${id}/${result.score}`)}
            className="bg-hazard-500 text-white rounded-lg px-6 py-3 font-semibold hover:bg-hazard-600 btn-push"
          >
            {sx("getCert", lang)}
          </button>
        ) : (
          <Link to="/train" className="text-brand underline block">{sx("backRetry", lang)}</Link>
        )}
      </div>
    );
  }

  const questions = config.questions;
  const q = questions[idx];
  const answered = answers[q.id];

  function record(a: Answer) {
    setAnswers((prev) => ({ ...prev, [q.id]: a }));
    if (idx < questions.length - 1) setIdx(idx + 1);
  }

  function submit() {
    if (!w || !config) return;
    const res = recordAttempt(w.id, config, questions.map((qq) => answers[qq.id]).filter((a): a is Answer => Boolean(a)));
    setResult(res);
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="rounded-xl p-4 text-white shadow-sm space-y-3" style={{ background: "linear-gradient(120deg,#0B2545 0%,#1B4965 60%,#7F4F38 135%)" }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Link to={`/train/module/${id}`} className="text-sm text-amber-200 hover:text-white hover:underline">{sx("backModule", lang)}</Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/85">
              {fmt("qOfN", lang, { i: idx + 1, n: questions.length, p: q.points })}
            </span>
            <LangSwitch dark value={lang} onChange={(l) => setLanguage(l)} />
          </div>
        </div>
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold">{tr(q.prompt, lang)}</h2>

        {q.type === "MC" && (
          <div className="mt-4 grid gap-2">
            {q.options.map((opt, i) => (
              <button
                key={opt.id}
                onClick={() => record({ questionId: q.id, choice: i })}
                className={`text-left border rounded-lg px-4 py-3 hover:bg-brand-light ${
                  answered?.choice === i ? "border-brand bg-brand-light" : ""
                }`}
              >
                {tr(opt.label, lang)}
              </button>
            ))}
          </div>
        )}

        {q.type === "TRUE_FALSE" && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => record({ questionId: q.id, boolValue: true })}
              className={`rounded-lg px-4 py-3 border ${answered?.boolValue === true ? "border-brand bg-brand-light" : ""}`}
            >
              {sx("yes", lang)}
            </button>
            <button
              onClick={() => record({ questionId: q.id, boolValue: false })}
              className={`rounded-lg px-4 py-3 border ${answered?.boolValue === false ? "border-brand bg-brand-light" : ""}`}
            >
              {sx("no", lang)}
            </button>
          </div>
        )}

        {q.type === "SEQ" && <SeqView q={q} lang={lang} onDone={(seq) => record({ questionId: q.id, sequence: seq })} />}

        {q.type === "MATCH" && <MatchView q={q} lang={lang} onDone={(mapping) => record({ questionId: q.id, mapping })} />}

        {q.type === "AR_EVIDENCE" &&
          (q.arTaskId && arDone(id, q.arTaskId) ? (
            <div className="mt-4">
              <p className="text-success text-sm font-medium">
                {sx("arDoneMsg", lang)}
              </p>
              <button
                onClick={() => record({ questionId: q.id })}
                className="mt-4 bg-brand text-white rounded-lg px-5 py-2.5 text-sm font-semibold"
              >
                {sx("next", lang)} →
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-alert text-sm font-medium">{sx("arMissing", lang)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {sx("arFirst", lang)}
              </p>
              <Link
                to={`/train/module/${id}`}
                className="inline-block mt-3 text-brand underline text-sm"
              >
                {sx("backTraining", lang)}
              </Link>
            </div>
          ))}
      </div>

      {(idx > 0 || answered) && (
        <div className="flex justify-between">
          {idx > 0 ? (
            <button onClick={() => setIdx(idx - 1)} className="text-sm text-slate-600 border rounded-lg px-4 py-2">
              {sx("previous", lang)}
            </button>
          ) : <span />}
          {idx === questions.length - 1 && (
            <button onClick={submit} className="bg-hazard-500 text-white rounded-lg px-6 py-2 font-semibold hover:bg-hazard-600 btn-push">
              {sx("submitAssess", lang)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SeqView({ q, lang, onDone }: { q: Question; lang: string; onDone: (seq: string[]) => void }) {
  const [seq, setSeq] = useState<string[]>([]);
  const pool = q.options.filter((o) => !seq.includes(o.id));
  return (
    <div className="mt-4">
      <p className="text-xs text-slate-500">{sx("seqHint", lang)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {seq.map((sid) => (
          <span key={sid} className="bg-brand-light text-brand text-sm px-3 py-1 rounded-full">
            {tr(q.options.find((o) => o.id === sid)!.label, lang)}
          </span>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        {pool.map((o) => (
          <button key={o.id} onClick={() => setSeq([...seq, o.id])} className="text-left border rounded-lg px-4 py-3 hover:bg-brand-light">
            {tr(o.label, lang)}
          </button>
        ))}
      </div>
      <button
        onClick={() => seq.length === q.sequence.length && onDone(seq)}
        disabled={seq.length !== q.sequence.length}
        className="mt-4 bg-brand disabled:opacity-40 text-white rounded-lg px-5 py-2.5 text-sm font-semibold"
      >
        {fmt("confirmOrderN", lang, { a: seq.length, b: q.sequence.length })}
      </button>
    </div>
  );
}

function MatchView({ q, lang, onDone }: { q: Question; lang: string; onDone: (m: Record<string, string>) => void }) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const remaining = Object.keys(q.pairs).filter((k) => !mapping[k]).length;
  return (
    <div className="mt-4 space-y-2">
      {Object.keys(q.pairs).map((item) => (
        <div key={item} className="flex items-center gap-2">
          <span className="w-40 text-sm">{objectLabel(item, lang)}</span>
          <select
            value={mapping[item] ?? ""}
            onChange={(e) => setMapping({ ...mapping, [item]: e.target.value })}
            className="flex-1 border rounded px-2 py-2 text-sm"
          >
            <option value="" disabled>{sx("choose", lang)}</option>
            {q.options.map((o) => (
              <option key={o.id} value={o.id}>{tr(o.label, lang)}</option>
            ))}
          </select>
        </div>
      ))}
      <button
        onClick={() => remaining === 0 && onDone(mapping)}
        disabled={remaining !== 0}
        className="mt-3 bg-brand disabled:opacity-40 text-white rounded-lg px-5 py-2.5 text-sm font-semibold"
      >
        {fmt("confirmN", lang, { a: Object.keys(q.pairs).length - remaining, b: Object.keys(q.pairs).length })}
      </button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="max-w-xl mx-auto text-center text-slate-600 py-24">{children}</div>;
}
