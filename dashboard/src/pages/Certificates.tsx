import { useState } from "react";
import { verifyCertLocal, type VerifyResult, type LegacyCert } from "../lib/verify";
import { useDataset } from "../lib/store";

function qrOf(c: LegacyCert): string {
  return (c as unknown as { qrText?: string }).qrText ?? "";
}

export default function Certificates() {
  const data = useDataset();
  const [qrText, setQrText] = useState("");
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function doVerify() {
    setBusy(true);
    setVerify(null);
    try {
      setVerify(await verifyCertLocal(qrText, data.certificates));
    } finally {
      setBusy(false);
    }
  }

  async function copyRow(id: string, text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      } finally {
        ta.remove();
      }
    }
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 2000);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Certificates</h1>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <h2 className="font-semibold mb-2">Verify a QR text</h2>
        <p className="text-xs text-slate-500 mb-2">
          The in-app verifier also shows the raw QR. Paste it here to re-check
          hash-chain + ECDSA signature offline.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            rows={3}
            placeholder="Paste full QR text"
            value={qrText}
            onChange={(e) => setQrText(e.target.value)}
            className="flex-1 border border-slate-400 rounded px-3 py-2 font-mono text-xs bg-white text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand-light focus:outline-none"
          />
          <button
            onClick={doVerify}
            disabled={busy || !qrText.trim()}
            className="bg-brand text-white rounded px-4 py-2 self-start disabled:opacity-40"
          >
            Verify
          </button>
        </div>
        {verify && (
          <div
            className={`mt-3 rounded p-3 text-sm ${
              verify.valid ? "bg-success-light text-success-dark" : "bg-alert-light text-alert-dark"
            }`}
          >
            <b>{verify.valid ? "VALID" : "INVALID"} · {verify.reason}</b>
            {verify.certificate && (
              <div className="mt-1 text-xs">
                Cert {verify.certificate.certNo} · module {verify.certificate.moduleId} ·
                score {verify.certificate.score} ·{" "}
                {new Date(verify.certificate.issuedAt).toLocaleString()}
                {verify.revoked && <span className="font-bold"> · REVOKED</span>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 overflow-x-auto">
        <h2 className="font-semibold mb-3">Certificate ledger ({data.certificates.length})</h2>
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Cert no</th>
              <th>Worker</th>
              <th>Module</th>
              <th>Score</th>
              <th>Issued</th>
<th>Site</th>
                <th>Chain hash (short)</th>
                <th>QR</th>
              </tr>
            </thead>
            <tbody>
              {data.certificates.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2 font-mono text-xs">{c.certNo}</td>
                  <td className="font-mono text-xs">{c.workerId.slice(0, 8)}</td>
                  <td>{c.moduleId}</td>
                  <td>{c.score}</td>
                  <td className="text-slate-500">{new Date(c.issuedAt).toLocaleDateString()}</td>
                  <td>{c.siteName}</td>
                  <td className="font-mono text-xs text-slate-500">{c.chainHash.slice(0, 10)}…</td>
                  <td>
                    <button
                      onClick={() => {
                        const t = qrOf(c);
                        if (t) {
                          setQrText(t);
                          void copyRow(c.id, t);
                        }
                      }}
                      disabled={!qrOf(c)}
                      className="text-xs text-brand underline disabled:opacity-30 disabled:no-underline"
                      title="Copy QR text & load into verifier"
                    >
                      {copiedId === c.id ? "Copied ✓" : "Copy QR"}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {data.certificates.length === 0 && (
          <div className="text-slate-400 py-6 text-center">No certificates in this export.</div>
        )}
      </div>
    </div>
  );
}