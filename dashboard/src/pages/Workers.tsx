import { useDataset } from "../lib/store";

export default function Workers() {
  const data = useDataset();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Workers</h1>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Name</th>
              <th>Phone</th>
              <th>Site</th>
              <th>District</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {data.workers.map((w) => (
              <tr key={w.id} className="border-b border-slate-100">
                <td className="py-2 font-medium">{w.name}</td>
                <td>{w.phone}</td>
                <td>{w.siteName}</td>
                <td>{w.district}</td>
                <td>{w.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.workers.length === 0 && (
          <div className="text-slate-400 py-6 text-center">
            No workers yet. Register on an Android device and export.
          </div>
        )}
      </div>
    </div>
  );
}