import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDataset } from "../lib/store";

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-bold ${accent ?? "text-slate-900"}`}>{value}</div>
    </div>
  );
}

export default function Overview() {
  const data = useDataset();
  const o = {
    workers: data.workers.length,
    attempts: data.attempts.length,
    passed: data.attempts.filter((a) => a.passed).length,
    certificates: data.certificates.length,
    passRatePct: 0,
  };
  o.passRatePct = o.attempts ? Math.round((o.passed / o.attempts) * 100) : 0;

  if (o.workers === 0 && o.certificates === 0) {
    return (
      <div className="text-slate-500">
        <h1 className="text-2xl font-bold mb-4">Compliance Overview</h1>
        <div className="bg-white rounded-xl p-10 border border-slate-200 text-center">
          No data yet. Use <b>Profile → Export site data</b> in the Android app,
          then import the <code>kaavach_export_*.json</code> file above.
        </div>
      </div>
    );
  }

  const bySite: Record<string, number> = {};
  data.workers.forEach((w) => {
    bySite[w.siteName] = (bySite[w.siteName] ?? 0) + 1;
  });
  const table = Object.entries(bySite).map(([site, count]) => ({ site, count }));
  const recent = [...data.attempts]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Compliance Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Workers" value={o.workers} />
        <StatCard label="Attempts" value={o.attempts} />
        <StatCard label="Pass rate" value={`${o.passRatePct}%`} accent="text-brand" />
        <StatCard label="Certificates" value={o.certificates} accent="text-brand" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <h2 className="font-semibold mb-3">Workers per site</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={table} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="site" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0B2545" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 overflow-x-auto">
          <h2 className="font-semibold mb-3">Recent attempts</h2>
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-1">Module</th>
                <th>Score</th>
                <th>Result</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-2">{a.moduleId}</td>
                  <td>{a.score}</td>
                  <td>
                    <span className={a.passed ? "text-brand" : "text-alert"}>
                      {a.passed ? "PASS" : "FAIL"}
                    </span>
                  </td>
                  <td className="text-slate-500">
                    {new Date(a.finishedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}