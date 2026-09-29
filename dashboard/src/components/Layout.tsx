import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { parseExport, setDataset, useDataset } from "../lib/store";
import Logo from "./Logo";

const links = [
  { to: "/", label: "Overview" },
  { to: "/sites", label: "Sites & Modules" },
  { to: "/workers", label: "Workers" },
  { to: "/certificates", label: "Certificates" },
  { to: "/reports", label: "Reports" },
  { to: "/train", label: "Worker App (demo)" },
];

export default function Layout() {
  const data = useDataset();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const isWorkerApp = loc.pathname.startsWith("/train");
  const hasData = data.workers.length > 0 || data.certificates.length > 0;

  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      setDataset(await parseExport(f));
    } catch {
      window.alert("Could not read that file. Export a kaavach_export_*.json from the app first.");
    }
  }

  return (
    <div className="min-h-screen lg:flex">
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-brand-900 to-brand-950 text-white flex flex-col transform transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-4 py-4 flex items-center gap-2.5 border-b border-white/10">
          <Logo className="w-9 h-9 shrink-0 drop-shadow" />
          <div className="leading-tight">
            <div className="text-base font-bold">Kaavach</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto lg:hidden w-8 h-8 rounded-full hover:bg-white/10 text-lg"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-hazard-500 text-brand-950 font-semibold shadow-lg translate-x-0.5"
                    : "text-white/85 hover:bg-white/10 hover:translate-x-1 hover:text-white"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 text-xs text-white/70 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-hazard-400" />
          Fully offline — no server.
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-2.5 px-4 py-3 text-white shadow-md bg-brand-900">
          <button
            onClick={() => setOpen(true)}
            className="w-9 h-9 grid place-items-center rounded-lg hover:bg-white/10 text-xl"
            aria-label="Open menu"
          >
            ☰
          </button>
          <Logo className="w-7 h-7 shrink-0" />
          <span className="font-bold text-sm">Kaavach</span>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          {!isWorkerApp && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="text-sm font-semibold">
                  {hasData
                    ? "Imported: " + formatDate(data.exportedAt)
                    : "Import the device export to begin"}
                </div>
                <div className="text-xs text-slate-500">
                  On the Android app: Profile → Export site data → copy the JSON file
                  from Downloads. Workers {data.workers.length} · Attempts{" "}
                  {data.attempts.length} · Certificates {data.certificates.length}
                </div>
              </div>
              <input
                type="file"
                accept="application/json"
                onChange={(e) => void onFile(e.target.files?.[0])}
                className="text-sm"
              />
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function formatDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}
