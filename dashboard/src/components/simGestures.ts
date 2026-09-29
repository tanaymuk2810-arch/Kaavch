// Worker gestures for the simulation steps, in the same order as SIMS[module].steps.
// The 2D ghost guides (StepStage) AND the 3D object anchors (Stage3D) both read
// from here, so guides and models always line up.
export interface Pt {
  x: number;
  y: number;
}

export type Gest =
  | { kind: "drag"; from: Pt; to: Pt; tol?: number }
  | { kind: "tap"; at: Pt; r?: number }
  | { kind: "tapSeq"; at: Pt[]; r?: number }
  | { kind: "hold"; at: Pt; secs: number; r?: number }
  | { kind: "rotate"; at: Pt; total: number; r?: number }
  | { kind: "sweep"; center: Pt; need: number };

export type Hazard = "fire" | "gas" | "gear" | "sparks" | "pulse";

export const GESTS: Record<Hazard, Gest[]> = {
  fire: [
    { kind: "drag", from: { x: 0.5, y: 0.16 }, to: { x: 0.6, y: 0.28 }, tol: 0.09 },
    { kind: "drag", from: { x: 0.66, y: 0.5 }, to: { x: 0.32, y: 0.6 } },
    { kind: "sweep", center: { x: 0.5, y: 0.52 }, need: 4 },
    { kind: "drag", from: { x: 0.74, y: 0.62 }, to: { x: 0.3, y: 0.62 } },
  ],
  gas: [
    { kind: "tapSeq", at: [{ x: 0.28, y: 0.55 }, { x: 0.68, y: 0.55 }], r: 0.12 },
    { kind: "rotate", at: { x: 0.5, y: 0.28 }, total: Math.PI * 1.5, r: 0.2 },
    { kind: "drag", from: { x: 0.4, y: 0.5 }, to: { x: 0.62, y: 0.5 } },
    { kind: "drag", from: { x: 0.2, y: 0.66 }, to: { x: 0.72, y: 0.5 } },
  ],
  gear: [
    { kind: "drag", from: { x: 0.74, y: 0.55 }, to: { x: 0.88, y: 0.22 } },
    { kind: "hold", at: { x: 0.62, y: 0.58 }, secs: 1.2, r: 0.14 },
    { kind: "drag", from: { x: 0.66, y: 0.62 }, to: { x: 0.34, y: 0.62 } },
    { kind: "hold", at: { x: 0.72, y: 0.7 }, secs: 1.2, r: 0.14 },
  ],
  sparks: [
    { kind: "drag", from: { x: 0.5, y: 0.62 }, to: { x: 0.8, y: 0.62 } },
    { kind: "drag", from: { x: 0.5, y: 0.28 }, to: { x: 0.5, y: 0.62 } },
    { kind: "drag", from: { x: 0.5, y: 0.7 }, to: { x: 0.5, y: 0.9 } },
  ],
  pulse: [
    { kind: "hold", at: { x: 0.45, y: 0.52 }, secs: 1.5, r: 0.16 },
    { kind: "tapSeq", at: [{ x: 0.28, y: 0.5 }, { x: 0.62, y: 0.66 }], r: 0.12 },
    { kind: "hold", at: { x: 0.36, y: 0.58 }, secs: 1.5, r: 0.16 },
  ],
};