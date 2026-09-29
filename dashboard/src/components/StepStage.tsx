import { useEffect, useRef } from "react";
import { GESTS } from "./simGestures";
import type { Gest, Hazard, Pt } from "./simGestures";
import { sx } from "../lib/i18n";
import { Stage3D } from "./Stage3D";
import type { ProgState } from "./Stage3D";

interface Eng {
  p: number;
  done: boolean;
  doneT: number;
  fired: boolean;
  down: boolean;
  px: number;
  py: number;
  grab: boolean;
  lastAng: number | null;
  accAng: number;
  accT: number;
  seq: number;
  flashT: number;
  lastX: number | null;
  cross: number;
}

function fresh(): Eng {
  return {
    p: 0, done: false, doneT: 0, fired: false,
    down: false, px: -1, py: -1,
    grab: false, lastAng: null, accAng: 0,
    accT: 0, seq: 0, flashT: -9,
    lastX: null, cross: 0,
  };
}

function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function lerpP(a: Pt, b: Pt, k: number): Pt {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}
function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function stepEngine(e: Eng, g: Gest, dt: number, t: number) {
  if (e.done) return;
  const ptr = { x: e.px, y: e.py };
  switch (g.kind) {
    case "drag": {
      const tol = g.tol ?? 0.08;
      const M = Math.max(dist(g.from, g.to), 0.001);
      if (e.grab && e.down) {
        const d = dist(ptr, g.to);
        e.p = Math.max(e.p, clamp01(1 - d / M));
        if (d < tol) {
          e.p = 1;
          e.done = true;
          e.doneT = t;
        }
      }
      break;
    }
    case "hold": {
      if (e.down && dist(ptr, g.at) < (g.r ?? 0.14)) {
        e.accT += dt;
        e.p = clamp01(e.accT / g.secs);
        if (e.p >= 1) {
          e.done = true;
          e.doneT = t;
        }
      } else {
        e.accT = 0;
        e.p = 0;
      }
      break;
    }
    case "rotate": {
      if (e.down) {
        const ang = Math.atan2(ptr.y - g.at.y, ptr.x - g.at.x);
        if (e.lastAng != null) {
          let d = ang - e.lastAng;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          e.accAng += Math.abs(d);
        }
        e.lastAng = ang;
        e.p = clamp01(e.accAng / g.total);
        if (e.p >= 1) {
          e.done = true;
          e.doneT = t;
        }
      }
      break;
    }
    case "sweep": {
      if (e.down) {
        if (e.lastX != null && (e.lastX < g.center.x) !== (ptr.x < g.center.x)) {
          e.cross += 1;
        }
        e.lastX = ptr.x;
        e.p = clamp01(e.cross / g.need);
        if (e.p >= 1) {
          e.done = true;
          e.doneT = t;
        }
      }
      break;
    }
    case "tap":
    case "tapSeq":
      break;
  }
}

function emo(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, s: number) {
  ctx.font = `${Math.round(s)}px "Segoe UI Emoji", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ch, x, y);
}

function hint(ctx: CanvasRenderingContext2D, W: number, text: string) {
  ctx.font = `600 ${Math.round(W * 0.024)}px Inter, sans-serif`;
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = "rgba(7,52,30,0.82)";
  ctx.beginPath();
  ctx.roundRect(8, 8, w, 26, 13);
  ctx.fill();
  ctx.fillStyle = "#F7C55C";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 17, 22);
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, g: Gest, e: Eng, t: number, lang: string) {
  const px = (p: Pt) => ({ x: p.x * W, y: p.y * H });
  const U = Math.max(W, H);

  if (g.kind === "drag") {
    const a = px(g.from), b = px(g.to);
    ctx.save();
    ctx.strokeStyle = "rgba(180,83,9,0.55)";
    ctx.lineWidth = Math.max(2, U * 0.006);
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
    const pulse = 1 + 0.12 * Math.sin(t * 5);
    ring(ctx, b.x, b.y, U * 0.035 * pulse, "#B45309", Math.max(2, U * 0.006), 0.9);
    const hp = e.grab && e.down ? { x: e.px * W, y: e.py * H } : (() => { const q = lerpP(g.from, g.to, e.p); return { x: q.x * W, y: q.y * H }; })();
    ring(ctx, hp.x, hp.y, U * 0.03, "#0F6B3A", Math.max(2, U * 0.007));
    ring(ctx, hp.x, hp.y, U * 0.02, "#0F6B3A", Math.max(2, U * 0.007), 0.35 + 0.3 * Math.sin(t * 6));
    emo(ctx, "👆", hp.x, hp.y - U * 0.055, U * 0.055);
    hint(ctx, W, sx("hintDrag", lang));
  } else if (g.kind === "tap") {
    const a = px(g.at);
    const pulse = 1 + 0.18 * Math.sin(t * 5);
    ring(ctx, a.x, a.y, U * 0.045 * pulse, "#B45309", Math.max(2, U * 0.007));
    ring(ctx, a.x, a.y, U * 0.03, "#B45309", Math.max(2, U * 0.006), 0.5);
    emo(ctx, "👆", a.x, a.y - U * 0.075, U * 0.06);
    hint(ctx, W, sx("hintTap", lang));
  } else if (g.kind === "tapSeq") {
    g.at.forEach((at, i) => {
      const a = px(at);
      if (i < e.seq) {
        ring(ctx, a.x, a.y, U * 0.04, "#16a34a", Math.max(2, U * 0.007));
        emo(ctx, "✅", a.x, a.y, U * 0.05);
      } else if (i === e.seq) {
        const pulse = 1 + 0.18 * Math.sin(t * 5);
        ring(ctx, a.x, a.y, U * 0.045 * pulse, "#B45309", Math.max(2, U * 0.007));
        emo(ctx, i === 0 ? "1️⃣" : "2️⃣", a.x, a.y - U * 0.07, U * 0.045);
      } else {
        ring(ctx, a.x, a.y, U * 0.035, "rgba(71,85,105,0.5)", Math.max(2, U * 0.005));
      }
    });
    hint(ctx, W, e.seq === 0 ? sx("hintTap1", lang) : sx("hintTap2", lang));
  } else if (g.kind === "hold") {
    const a = px(g.at);
    const r = (g.r ?? 0.14) * U;
    const pulse = 1 + 0.1 * Math.sin(t * 5);
    ring(ctx, a.x, a.y, r * pulse, "#B45309", Math.max(2, U * 0.006), 0.85);
    ctx.save();
    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = Math.max(3, U * 0.01);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(a.x, a.y, r * 0.72, -Math.PI / 2, -Math.PI / 2 + e.p * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    emo(ctx, "👆", a.x, a.y - r - U * 0.04, U * 0.06);
    hint(ctx, W, e.down ? sx("hintHolding", lang) : sx("hintHold", lang));
  } else if (g.kind === "rotate") {
    const a = px(g.at);
    const r = (g.r ?? 0.2) * U;
    ctx.save();
    ctx.strokeStyle = "rgba(180,83,9,0.6)";
    ctx.lineWidth = Math.max(2, U * 0.006);
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = Math.max(3, U * 0.01);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, -Math.PI / 2, -Math.PI / 2 + e.accAng);
    ctx.stroke();
    const dotA = -Math.PI / 2 + e.accAng;
    ctx.fillStyle = "#0F6B3A";
    ctx.beginPath();
    ctx.arc(a.x + Math.cos(dotA) * r, a.y + Math.sin(dotA) * r, Math.max(3, U * 0.012), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    emo(ctx, "👆", a.x, a.y - r - U * 0.045, U * 0.06);
    hint(ctx, W, sx("hintRotate", lang));
  } else {
    // sweep
    const c = px(g.center);
    ctx.save();
    ctx.strokeStyle = "rgba(180,83,9,0.5)";
    ctx.lineWidth = Math.max(2, U * 0.006);
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(c.x - U * 0.18, c.y);
    ctx.lineTo(c.x + U * 0.18, c.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    const wiggle = Math.sin(t * 2.6) * U * 0.05;
    emo(ctx, "👆", c.x + wiggle, c.y - U * 0.07, U * 0.06);
    for (let i = 0; i < g.need; i++) {
      ctx.save();
      ctx.fillStyle = i < e.cross ? "#16a34a" : "rgba(255,255,255,0.55)";
      ctx.strokeStyle = "rgba(7,52,30,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(W * 0.5 + (i - (g.need - 1) / 2) * U * 0.05, H - 16, U * 0.016, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    hint(ctx, W, sx("hintSweep", lang));
  }

  if (e.done) {
    const age = t - e.doneT;
    const k = Math.min(age / 1.1, 1);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ring(ctx, W / 2, H / 2, U * 0.1 + k * U * 0.35, "#16a34a", Math.max(3, U * 0.012));
    ring(ctx, W / 2, H / 2, U * 0.05 + k * U * 0.25, "#16a34a", Math.max(2, U * 0.008));
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.min(1, age * 4);
    emo(ctx, "✅", W / 2, H / 2, U * 0.14);
    ctx.restore();
  }
}

export function StepStage({
  hazard,
  index,
  lang,
  onDone,
}: {
  hazard: Hazard;
  index: number;
  lang: string;
  onDone: () => void;
}) {
  const gest = GESTS[hazard][index];
  const ref = useRef<HTMLCanvasElement>(null);
  const eng = useRef<Eng>(fresh());
  const prog = useRef<ProgState>({ p: 0, done: false, seq: 0, drag: null, grabbed: false });
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const t = now / 1000;
      const e = eng.current;
      if (!e.done) stepEngine(e, gest, dt, t);
      prog.current = {
        p: e.p,
        done: e.done,
        seq: e.seq,
        drag: e.grab && e.down ? { x: e.px, y: e.py } : null,
        grabbed: e.grab && e.down,
      };
      const ctx = c.getContext("2d");
      if (ctx && c) {
        ctx.clearRect(0, 0, c.width, c.height);
        drawOverlay(ctx, c.width, c.height, gest, e, t, lang);
      }
      if (e.done && !e.fired) {
        e.fired = true;
        onDoneRef.current();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [gest, lang]);

  function pos(ev: React.PointerEvent): Pt {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return { x: -1, y: -1 };
    return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
  }

  return (
    <div className="relative w-full h-48 rounded-xl overflow-hidden border border-white/10 bg-[#0B1520]">
      <Stage3D hazard={hazard} index={index} prog={prog} />
      <canvas
        ref={ref}
        width={560}
        height={192}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: "none" }}
        onPointerDown={(ev) => {
          const p = pos(ev);
          const e = eng.current;
          if (e.done) return;
          e.down = true;
          e.px = p.x;
          e.py = p.y;
          (ev.target as Element).setPointerCapture?.(ev.pointerId);
          if (gest.kind === "drag") {
            const hp = lerpP(gest.from, gest.to, e.p);
            if (dist(p, hp) < 0.16) e.grab = true;
          } else if (gest.kind === "tap") {
            if (dist(p, gest.at) < (gest.r ?? 0.1)) {
              e.p = 1;
              e.done = true;
              e.doneT = performance.now() / 1000;
            }
          } else if (gest.kind === "tapSeq") {
            const cur = gest.at[e.seq];
            if (cur && dist(p, cur) < (gest.r ?? 0.1)) {
              e.seq += 1;
              e.flashT = performance.now() / 1000;
              e.p = e.seq / gest.at.length;
              if (e.seq >= gest.at.length) {
                e.done = true;
                e.doneT = performance.now() / 1000;
              }
            }
          } else if (gest.kind === "rotate") {
            e.lastAng = Math.atan2(p.y - gest.at.y, p.x - gest.at.x);
          } else if (gest.kind === "sweep") {
            e.lastX = p.x;
          }
        }}
        onPointerMove={(ev) => {
          const p = pos(ev);
          const e = eng.current;
          e.px = p.x;
          e.py = p.y;
          if (gest.kind === "drag" && e.down && !e.grab) {
            const hp = lerpP(gest.from, gest.to, e.p);
            if (dist(p, hp) < 0.16) e.grab = true;
          }
          if (gest.kind === "rotate" && e.down) {
            const ang = Math.atan2(p.y - gest.at.y, p.x - gest.at.x);
            if (e.lastAng != null) {
              let d = ang - e.lastAng;
              while (d > Math.PI) d -= Math.PI * 2;
              while (d < -Math.PI) d += Math.PI * 2;
              e.accAng += Math.abs(d);
            }
            e.lastAng = ang;
          }
        }}
        onPointerUp={() => {
          const e = eng.current;
          e.down = false;
          e.grab = false;
          e.lastAng = null;
          e.lastX = null;
        }}
        onPointerCancel={() => {
          const e = eng.current;
          e.down = false;
          e.grab = false;
          e.lastAng = null;
          e.lastX = null;
        }}
      />
    </div>
  );
}