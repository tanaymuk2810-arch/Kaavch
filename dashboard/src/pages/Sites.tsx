import { useDataset } from "../lib/store";

export default function Sites() {
  const data = useDataset();
  const siteMap: Record<string, { district: string; workers: number }> = {};
  data.workers.forEach((w) => {
    const e = (siteMap[w.siteName] ??= { district: w.district, workers: 0 });
    e.workers++;
  });
  const domains: Record<string, number> = {};
  data.attempts.forEach((a) => {
    domains[a.moduleId] = (domains[a.moduleId] ?? 0) + 1;
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Sites & Modules</h1>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <h2 className="font-semibold mb-3">Sites ({Object.keys(siteMap).length})</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Site</th>
              <th>District</th>
              <th>Workers</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(siteMap).map(([site, s]) => (
              <tr key={site} className="border-b border-slate-100">
                <td className="py-2 font-medium">{site}</td>
                <td>{s.district}</td>
                <td>{s.workers}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {Object.keys(siteMap).length === 0 && (
          <div className="text-slate-400 py-6 text-center">
            No workers in the imported export.
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <h2 className="font-semibold mb-3">Module activity (by attempts)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Module</th>
              <th>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(domains).map(([m, n]) => (
              <tr key={m} className="border-b border-slate-100">
                <td className="py-2 font-mono">{m}</td>
                <td>{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}