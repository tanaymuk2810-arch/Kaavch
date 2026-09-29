export default function LangSwitch({
  value,
  onChange,
  dark = false,
}: {
  value: string;
  onChange: (lang: string) => void;
  dark?: boolean;
}) {
  const opts = [
    { id: "en", label: "EN" },
    { id: "hi", label: "हिं" },
    { id: "sat", label: "ᱥᱟᱱ" },
  ];
  return (
    <div
      className={`inline-flex rounded-full p-0.5 gap-0.5 ${
        dark ? "bg-white/15" : "bg-slate-200/80"
      }`}
      role="group"
      aria-label="Language / भाषा / ᱯᱟᱹᱨᱥᱤ"
      title="Language / भाषा / ᱯᱟᱹᱨᱥᱤ"
    >
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            value === o.id
              ? "bg-hazard-500 text-white shadow"
              : dark
                ? "text-white/70 hover:text-white"
                : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}