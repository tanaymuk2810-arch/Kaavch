import { useDataset } from "../lib/store";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csv(header: string[], rows: (string | number | boolean)[][]): string {
  const esc = (x: string | number | boolean) => `"${String(x).replaceAll('"', '""')}"`;
  return [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export default function Reports() {
  const data = useDataset();

  function exportWorkers() {
    download(
      "kaavach-workers.csv",
      csv(
        ["name", "phone", "site", "district", "role", "created_at"],
        data.workers.map((w) => [w.name, w.phone, w.siteName, w.district, w.role, new Date(w.createdAt).toISOString()]),
      ),
    );
  }

  function exportAttempts() {
    download(
      "kaavach-attempts.csv",
      csv(
        ["workerId", "moduleId", "score", "passed", "finished_at"],
        data.attempts.map((a) => [a.workerId, a.moduleId, a.score, a.passed, new Date(a.finishedAt).toISOString()]),
      ),
    );
  }

  function exportCerts() {
    download(
      "kaavach-certificates.csv",
      csv(
        ["certNo", "workerId", "moduleId", "score", "issued_at", "site", "chainHash"],
        data.certificates.map((c) => [c.certNo, c.workerId, c.moduleId, c.score, new Date(c.issuedAt).toISOString(), c.siteName, c.chainHash]),
      ),
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports & export</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <button
          onClick={exportWorkers}
          className="bg-white border border-slate-200 rounded-xl p-6 text-left shadow-sm hover:border-brand"
        >
          <div className="font-semibold">Workers CSV</div>
          <div className="text-sm text-slate-500">{data.workers.length} rows</div>
        </button>
        <button
          onClick={exportAttempts}
          className="bg-white border border-slate-200 rounded-xl p-6 text-left shadow-sm hover:border-brand"
        >
          <div className="font-semibold">Attempts CSV</div>
          <div className="text-sm text-slate-500">{data.attempts.length} rows</div>
        </button>
        <button
          onClick={exportCerts}
          className="bg-white border border-slate-200 rounded-xl p-6 text-left shadow-sm hover:border-brand"
        >
          <div className="font-semibold">Certificates CSV</div>
          <div className="text-sm text-slate-500">{data.certificates.length} rows</div>
        </button>
      </div>
      <p className="text-xs text-slate-400">
        CSV exports open in Excel/LibreOffice and suit most DGMS-reporting
        workflows. All processing happens locally in your browser.
      </p>
    </div>
  );
}