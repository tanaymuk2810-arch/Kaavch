import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useSandbox,
  registerWorker,
  setLanguage,
  loginWorker,
  logout,
  findByPhone,
  listWorkers,
} from "../../lib/workerStore";
import { MODULES, moduleMeta } from "../../lib/content";
import { sx } from "../../lib/i18n";
import Logo from "../../components/Logo";
import LangSwitch from "../../components/LangSwitch";

export default function TrainHome() {
  const sandbox = useSandbox();
  const w = sandbox.worker;
  if (!w) return <Auth />;
  return <Dashboard workerName={w.name} language={w.language} />;
}

function Auth() {
  const [tab, setTab] = useState<"login" | "register">(
    listWorkers().length > 0 ? "login" : "register",
  );
  const [lang, setLang] = useState("hi");
  return (
    <div className="max-w-md mx-auto space-y-4">
      <img src="/img/hero.svg" alt="Kaavach — worker app" className="w-full rounded-xl shadow-sm" />
      <div className="flex items-center gap-2">
        <div className="grid grid-cols-2 gap-1 bg-slate-200/70 rounded-xl p-1 flex-1">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
                tab === t ? "bg-white shadow text-brand-900" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "login" ? sx("login", lang) : sx("register", lang)}
            </button>
          ))}
        </div>
        <LangSwitch value={lang} onChange={setLang} />
      </div>
      {tab === "login" ? <Login lang={lang} /> : <Register lang={lang} setLang={setLang} goLogin={() => setTab("login")} />}
    </div>
  );
}

function Login({ lang }: { lang: string }) {
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const saved = listWorkers();

  function doLogin(id: string) {
    if (loginWorker(id)) nav("/train");
    else setErr(sx("errNotFoundShort", lang));
  }

  function submit() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setErr(sx("errPhone", lang));
      return;
    }
    const w = findByPhone(digits);
    if (!w) {
      setErr(sx("errNotFound", lang));
      return;
    }
    doLogin(w.id);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Logo className="w-11 h-11 shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-brand-900">{sx("appName", lang)}</h1>
          <p className="text-xs font-semibold text-hazard-600 uppercase tracking-wide">
            {sx("workerLogin", lang)}
          </p>
        </div>
      </div>
      <p className="text-sm text-slate-600">{sx("loginNote", lang)}</p>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <Field label={sx("mobile", lang)}>
          <input
            className={inputCls}
            value={phone}
            inputMode="numeric"
            maxLength={10}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder={sx("phPhoneLogin", lang)}
          />
        </Field>
        {err && <p className="text-alert text-sm font-medium">{err}</p>}
        <button onClick={submit} className="w-full bg-hazard-500 text-white rounded-lg py-3 font-semibold hover:bg-hazard-600 btn-push">
          {sx("loginContinue", lang)}
        </button>
      </div>

      {saved.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {sx("savedWorkers", lang)}
          </p>
          {saved.map((w) => (
            <button
              key={w.id}
              onClick={() => doLogin(w.id)}
              className="w-full flex items-center gap-3 border border-slate-200 rounded-lg px-4 py-3 text-left hover:border-brand hover:bg-brand-light transition-colors"
            >
              <span className="w-9 h-9 shrink-0 rounded-full bg-brand text-white font-bold grid place-items-center">
                {w.name.trim().charAt(0).toUpperCase()}
              </span>
              <span>
                <span className="block font-semibold text-slate-800">{w.name}</span>
                <span className="block text-xs text-slate-500">
                  {w.phone} · {w.siteName}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand-light focus:outline-none";

function Register({ lang, setLang, goLogin }: { lang: string; setLang: (l: string) => void; goLogin: () => void }) {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [site, setSite] = useState("");
  const [district, setDistrict] = useState("");
  const [err, setErr] = useState("");
  const [dup, setDup] = useState(false);

  function submit() {
    if (!name.trim() || phone.trim().replace(/\D/g, "").length < 10 || !site.trim()) {
      setErr(sx("errFields", lang));
      return;
    }
    if (findByPhone(phone.trim())) {
      setErr(sx("dupReg", lang));
      setDup(true);
      return;
    }
    registerWorker({
      name: name.trim(),
      phone: phone.trim(),
      siteName: site.trim(),
      district: district.trim() || "Dhanbad",
      language: lang,
    });
    nav("/train");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Logo className="w-11 h-11 shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-brand-900">{sx("appName", lang)}</h1>
          <p className="text-xs font-semibold text-hazard-600 uppercase tracking-wide">
            {sx("workerReg", lang)}
          </p>
        </div>
      </div>
      <p className="text-sm text-slate-600">{sx("regNote", lang)}</p>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <Field label={sx("fullName", lang)}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={sx("phName", lang)} />
        </Field>
        <Field label={sx("mobile", lang)}>
          <input
            className={inputCls}
            value={phone}
            inputMode="numeric"
            maxLength={10}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder={sx("phPhone", lang)}
          />
        </Field>
        <Field label={sx("site", lang)}>
          <input className={inputCls} value={site} onChange={(e) => setSite(e.target.value)} placeholder={sx("phSite", lang)} />
        </Field>
        <Field label={sx("district", lang)}>
          <input className={inputCls} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={sx("phDistrict", lang)} />
        </Field>
        <Field label={sx("lang", lang)}>
          <LangSwitch value={lang} onChange={setLang} />
        </Field>

        {err && <p className="text-alert text-sm font-medium">{err}</p>}
        {dup && (
          <button onClick={goLogin} className="w-full border border-brand text-brand rounded-lg py-2.5 text-sm font-semibold hover:bg-brand-light">
            {sx("goLogin", lang)}
          </button>
        )}
        <button onClick={submit} className="w-full bg-hazard-500 text-white rounded-lg py-3 font-semibold hover:bg-hazard-600 btn-push">
          {sx("registerStart", lang)}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700 block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Dashboard({ workerName, language }: { workerName: string; language: string }) {
  const sandbox = useSandbox();
  const nav = useNavigate();
  const passed = MODULES.filter((m) => sandbox.progress[m.id]?.state === 2).length;
  const certCount = sandbox.certificates.length;
  const best = Math.max(0, ...MODULES.map((m) => sandbox.progress[m.id]?.bestScore ?? 0));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Logo className="w-9 h-9 shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-brand-900">{sx("trainingTitle", language)}</h1>
            <p className="text-sm text-slate-500">
              {sx("welcome", language)}, <b>{workerName}</b>. {sx("completeBelow", language)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LangSwitch value={language} onChange={(l) => setLanguage(l)} />
          <button
            onClick={() => {
              logout();
              nav("/train");
            }}
            className="border border-slate-400 bg-white text-slate-700 rounded-full px-3 py-1.5 text-xs font-semibold hover:border-brand hover:text-brand-900"
            title={sx("switchTitle", language)}
          >
            {sx("switchWorker", language)}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3 text-white shadow-sm lift glow-hover" style={{ background: "linear-gradient(135deg,#0B2545,#1B4965)" }}>
          <div className="text-xl font-extrabold">{passed}/{MODULES.length}</div>
          <div className="text-[11px] text-white/80">{sx("statPassed", language)}</div>
        </div>
        <div className="rounded-xl p-3 text-white shadow-sm lift glow-hover" style={{ background: "linear-gradient(135deg,#7F4F38,#C97B5A)" }}>
          <div className="text-xl font-extrabold">{certCount}</div>
          <div className="text-[11px] text-white/85">{sx("statCerts", language)}</div>
        </div>
        <div className="rounded-xl p-3 text-white shadow-sm lift glow-hover" style={{ background: "linear-gradient(135deg,#2D3436,#5a6367)" }}>
          <div className="text-xl font-extrabold">{best}%</div>
          <div className="text-[11px] text-white/80">{sx("statBest", language)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) => {
          const progress = sandbox.progress[m.id];
          const meta = moduleMeta(m.id, language);
          const done = progress?.state === 2;
          const stateText =
            progress?.state === 2
              ? sx("passed", language)
              : progress?.state === 3
                ? sx("failed", language)
                : progress?.state === 1
                  ? sx("active", language)
                  : sx("fresh", language);
          return (
<a
              key={m.id}
              href={`/train/module/${m.id}`}
              className="group bg-white rounded-xl overflow-hidden border border-slate-200 lift glow-hover aspect-square flex flex-col"
              style={{ borderTop: `4px solid ${meta.accent}` }}
            >
              <div className="flex-1 min-h-0 bg-[#0B1520] overflow-hidden">
                <img src={meta.img} alt={meta.title} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110" />
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{meta.title}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {progress?.bestScore != null && progress.bestScore > 0
                      ? `${sx("best", language)} ${progress.bestScore}% · `
                      : ""}
                    {sandbox.certificates.filter((c) => c.moduleId === m.id).length} {sx("certs", language)}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap transition-transform duration-300 group-hover:scale-110 ${
                    done ? "bg-success-light text-success-dark" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {stateText}
                </span>
              </div>
            </a>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">{sx("passNote", language)}</p>
    </div>
  );
}
