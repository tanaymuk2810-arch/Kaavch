import { useEffect, useRef } from "react";
import { Stage3D } from "./Stage3D";
import type { ProgState } from "./Stage3D";
import type { Hazard } from "./simGestures";

// Auto-playing 3D infographic: reuses the interactive simulation scenes with a
// looping progress driver — no gestures, just a living diorama beside text.
export default function Info3D({
  hazard,
  index,
  className = "",
}: {
  hazard: Hazard;
  index: number;
  className?: string;
}) {
  const prog = useRef<ProgState>({ p: 0, done: false, seq: 0, drag: null, grabbed: false });

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      const p = 0.5 - 0.5 * Math.cos(t * 0.85);
      prog.current = { p, done: p > 0.985, seq: 0, drag: null, grabbed: false };
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`relative w-full min-h-[13rem] rounded-xl overflow-hidden border border-white/10 ${className}`}
      style={{
        background: "radial-gradient(120% 130% at 50% 0%, #123324 0%, #0B1520 62%, #060D08 100%)",
      }}
    >
      <div className="absolute top-2 left-2 z-10 text-[10px] font-bold tracking-widest text-amber-300/90 bg-black/40 rounded-full px-2.5 py-0.5">
        3D
      </div>
      <Stage3D hazard={hazard} index={index} prog={prog} />
    </div>
  );
}
