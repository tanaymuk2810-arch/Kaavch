import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { useSandbox, issueCertificate, exportJson, syncDashboard, setLanguage } from "../../lib/workerStore";
import type { WebCertificate } from "../../lib/chain";
import { verifyCertLocal } from "../../lib/verify";
import type { VerifyResult } from "../../lib/verify";
import { sx } from "../../lib/i18n";
import { moduleMeta } from "../../lib/content";
import LangSwitch from "../../components/LangSwitch";

export default function TrainCert() {
  const { id = "", score = "80" } = useParams();
  const sandbox = useSandbox();
  const w = sandbox.worker;

  const [cert, setCert] = useState<WebCertificate | null>(null);
  const [qr, setQr] = useState<string>("");
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  function startIssue() {
    if (!w) return;
    started.current = true;
    setErr(null);
    void issueCertificate(id, Number(score))
      .then(setCert)
      .catch((e) => {
        started.current = false;
        setErr(e instanceof Error ? e.message : "Could not issue the certificate.");
      });
  }

  useEffect(() => {
    if (started.current || !w) return;
    startIssue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, score, w]);

  useEffect(() => {
    if (!cert) return;
    void QRCode.toDataURL(cert.qrText, { width: 260, margin: 1 })
      .then(setQr)
      .catch(() => setErr("Could not draw the QR code, but the certificate below is valid."));
  }, [cert]);

  if (!w) return <Centered>{sx("needRegister", "en")} <Link to="/train" className="text-brand">{sx("go", "en")}</Link></Centered>;
  if (err && !cert) {
    return (
      <Centered>
        <p className="text-alert font-medium mb-4">{err}</p>
        <button onClick={startIssue} className="bg-hazard-500 text-white rounded-lg px-6 py-3 font-semibold hover:bg-hazard-600 btn-push">
          Try again →
        </button>
      </Centered>
    );
  }
  if (!cert) return <Centered>{sx("issuing", w.language)}</Centered>;

  const lang = w.language;

  async function verifyNow() {
    if (!cert) return;
    const certs = sandbox.certificates.map((c) => ({
      id: c.id, certNo: c.certNo, workerId: c.workerId, moduleId: c.moduleId,
      score: c.score, issuedAt: c.issuedAt, siteName: c.siteName,
      prevHash: c.prevHash, chainHash: c.chainHash, revoked: c.revoked,
    }));
    setVerify(await verifyCertLocal(cert.qrText, certs));
  }

  function download() {
    syncDashboard();
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kaavach_export_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyQr() {
    if (!cert) return;
    try {
      await navigator.clipboard.writeText(cert.qrText);
    } catch {
      // clipboard API unavailable (permissions / non-secure context) — fallback
      const ta = document.createElement("textarea");
      ta.value = cert.qrText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        setErr("Copy failed — long-press the QR text manually.");
        return;
      } finally {
        ta.remove();
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 text-center">
      <div className="flex justify-end">
        <LangSwitch value={lang} onChange={(l) => setLanguage(l)} />
      </div>
      <h1 className="text-2xl font-bold">{sx("certTitle", lang)}</h1>
      <div className="mx-auto h-1 w-24 rounded-full" style={{ background: "linear-gradient(90deg,#D9A566,#C97B5A,#0B2545)" }} />
      <p className="text-sm text-slate-500">
        {sx("certLead", lang)}
      </p>

      <div className="rounded-2xl p-[3px] shadow-sm" style={{ background: "linear-gradient(135deg,#D9A566,#C97B5A 45%,#0B2545)" }}>
      <div className="bg-white rounded-2xl p-6 space-y-4">
        {err && (
          <div className="rounded-lg p-3 text-sm bg-alert-light text-alert-dark text-left">{err}</div>
        )}
        <div className="text-left text-sm space-y-1">
          <Row k={sx("certNo", lang)} v={cert.certNo} mono />
          <Row k={sx("issuedTo", lang)} v={w.name} />
          <Row k={sx("module", lang)} v={moduleMeta(cert.moduleId, lang).title} />
          <Row k={sx("score", lang)} v={`${cert.score}%`} />
          <Row k={sx("issuedOn", lang)} v={new Date(cert.issuedAt).toLocaleString()} />
          <Row k={sx("siteName", lang)} v={cert.siteName} />
        </div>

        {qr ? (
          <div className="flex justify-center">
            <img src={qr} alt="certificate QR" className="w-60 h-60" />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">{sx("loading", lang)}</p>
            <details>
              <summary className="text-xs text-brand cursor-pointer">Show QR text instead</summary>
              <pre className="mt-2 text-[10px] font-mono text-left break-all whitespace-pre-wrap bg-slate-50 rounded p-2 select-all">
                {cert.qrText}
              </pre>
            </details>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => void copyQr()}
            className="border rounded-lg px-4 py-2 text-sm"
          >
            {copied ? "Copied ✓" : sx("copyQr", lang)}
          </button>
          <button onClick={verifyNow} className="bg-hazard-500 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-hazard-600 btn-push">
            {sx("verifyNow", lang)}
          </button>
          <button onClick={download} className="bg-brand-dark text-white rounded-lg px-4 py-2 text-sm font-semibold">
            {sx("exportJson", lang)}
          </button>
        </div>
      </div>
      </div>

      {verify && (
        <div className={`rounded-lg p-4 text-sm ${verify.valid ? "bg-success-light text-success-dark" : "bg-alert-light text-alert-dark"}`}>
          <b>{verify.valid ? sx("valid", lang) : sx("invalid", lang)}</b>
          {verify.revoked && <span className="font-bold"> · {sx("revoked", lang)}</span>}
        </div>
      )}

      <div className="flex gap-3 justify-center text-sm">
        <Link to="/train" className="text-brand hover:underline">{sx("backModules", lang)}</Link>
        <Link to="/certificates" className="text-brand hover:underline">{sx("openVerify", lang)}</Link>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-1">
      <span className="text-slate-500">{k}</span>
      <span className={mono ? "font-mono text-xs self-center" : ""}>{v}</span>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="max-w-xl mx-auto text-center text-slate-600 py-24">{children}</div>;
}
