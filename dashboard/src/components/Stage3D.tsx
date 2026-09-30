import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { GESTS } from "./simGestures";
import type { Gest, Hazard, Pt } from "./simGestures";

export interface ProgState {
  p: number;
  done: boolean;
  seq: number;
  drag: Pt | null;
  grabbed: boolean;
}

interface Setup {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

type Updater = (t: number, dt: number, s: ProgState) => void;

// ---------- small utils ----------
function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function easeOutBack(k: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}
const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
function toWorld(camera: THREE.PerspectiveCamera, nx: number, ny: number, z: number, target = new THREE.Vector3()) {
  _ndc.set(nx * 2 - 1, -(ny * 2 - 1));
  _ray.setFromCamera(_ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z);
  const hit = _ray.ray.intersectPlane(plane, target);
  if (!hit) target.set(0, 1, z);
  return target;
}
function gnd(v: THREE.Vector3, minY: number) {
  v.y = Math.max(v.y, minY);
  return v;
}

function std(
  color: number,
  o: { rough?: number; metal?: number; emissive?: number; ei?: number; transparent?: boolean; opacity?: number } = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.55,
    metalness: o.metal ?? 0.08,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.ei ?? 1,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
  });
}
function box(w: number, h: number, d: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}
function cyl(rt: number, rb: number, h: number, mat: THREE.Material, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true;
  return m;
}
function sph(r: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat);
  m.castShadow = true;
  return m;
}
const _UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
function setLink(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  _dir.subVectors(b, a);
  const len = Math.max(_dir.length(), 0.0001);
  m.position.copy(a).addScaledVector(_dir, 0.5);
  m.scale.set(1, len, 1);
  m.quaternion.setFromUnitVectors(_UP, _dir.normalize());
}
function linkMesh(r: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat);
  m.castShadow = true;
  return m;
}

let _glowTex: THREE.CanvasTexture | null = null;
function glowTex() {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  if (x) {
    const g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  }
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}
function glowSprite(color: number, scale: number, opacity = 0.8) {
  const m = new THREE.SpriteMaterial({
    map: glowTex(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.set(scale, scale, 1);
  return s;
}
function textSprite(text: string, color: string, scale: number) {
  const c = document.createElement("canvas");
  const font = "900 84px Inter, sans-serif";
  let w = 256;
  const probe = c.getContext("2d");
  if (probe) {
    probe.font = font;
    w = Math.max(64, Math.ceil(probe.measureText(text).width) + 56);
  }
  c.width = w;
  c.height = 128;
  const x = c.getContext("2d");
  if (x) {
    x.font = font;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = color;
    x.fillText(text, w / 2, 66);
  }
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m);
  const hWorld = scale / 2;
  s.scale.set(hWorld * (w / 128), hWorld, 1);
  return s;
}

// ---------- particle pool ----------
class Pool {
  pts: THREE.Points;
  pos: Float32Array;
  col: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  max: Float32Array;
  base: Float32Array;
  n = 0;
  cap: number;
  grav: number;
  dragF: number;
  debt = 0;
  mat: THREE.PointsMaterial;
  geo = new THREE.BufferGeometry();

  constructor(scene: THREE.Scene, cap: number, size: number, additive: boolean, opacity = 0.95) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap).fill(1);
    this.base = new Float32Array(cap * 3);
    this.grav = 0;
    this.dragF = 0;
    for (let i = 0; i < cap; i++) this.pos[i * 3 + 1] = -999;
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(this.geo, this.mat);
    this.pts.frustumCulled = false;
    scene.add(this.pts);
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number, g: number, b: number) {
    const i = this.n < this.cap ? this.n++ : (Math.random() * this.cap) | 0;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = 0;
    this.max[i] = life;
    this.base[i * 3] = r;
    this.base[i * 3 + 1] = g;
    this.base[i * 3 + 2] = b;
  }
  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] >= this.max[i]) continue;
      this.life[i] += dt;
      const k = Math.min(this.life[i] / this.max[i], 1);
      if (k >= 1) {
        this.pos[i * 3 + 1] = -999;
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
        continue;
      }
      this.vel[i * 3 + 1] += this.grav * dt;
      const dr = 1 - this.dragF * dt;
      this.vel[i * 3] *= dr;
      this.vel[i * 3 + 1] *= dr;
      this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = 1 - k;
      this.col[i * 3] = this.base[i * 3] * f;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * f;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * f;
    }
    (this.geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ---------- model factories ----------
function makeRunner(vest = 0xf59e0b) {
  const g = new THREE.Group();
  const skin = std(0xf2c89b, { rough: 0.7 });
  const legM = std(0x1f2937, { rough: 0.8 });
  const l1 = cyl(0.09, 0.09, 0.34, legM);
  l1.position.set(-0.11, 0.17, 0);
  const l2 = l1.clone();
  l2.position.x = 0.11;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 6, 14), std(vest, { rough: 0.6 }));
  body.position.y = 0.68;
  body.castShadow = true;
  const stripe = box(0.3, 0.07, 0.02, std(0xf8fafc, { emissive: 0xffffff, ei: 0.25 }));
  stripe.position.set(0, 0.72, 0.21);
  const head = sph(0.19, skin);
  head.position.y = 1.28;
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 10, 0, Math.PI * 2, 0, 1.35), std(0xf8fafc, { rough: 0.4 }));
  hat.position.y = 1.32;
  hat.castShadow = true;
  g.add(l1, l2, body, stripe, head, hat);
  return g;
}
function makeHead(r = 0.34) {
  const g = new THREE.Group();
  const head = sph(r, std(0xf2c89b, { rough: 0.65 }));
  const neck = cyl(r * 0.4, r * 0.45, r * 0.5, std(0xe8b88a, { rough: 0.7 }));
  neck.position.y = -r * 1.1;
  g.add(head, neck);
  return g;
}
function makeHelmet(r: number) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 26, 14, 0, Math.PI * 2, 0, 1.85), std(0xf7c55c, { rough: 0.35 }));
  dome.castShadow = true;
  const brim = cyl(r * 1.28, r * 1.32, r * 0.14, std(0x0f6b3a, { rough: 0.5 }));
  brim.position.y = -r * 0.08;
  const ridge = box(r * 0.22, r * 0.3, r * 1.7, std(0xf7c55c, { rough: 0.35 }));
  ridge.position.y = r * 0.72;
  g.add(dome, brim, ridge);
  return g;
}
function makeGear(r: number, color = 0x64748b) {
  const g = new THREE.Group();
  const mat = std(color, { rough: 0.45, metal: 0.55 });
  for (let i = 0; i < 10; i++) {
    const tooth = box(r * 0.22, r * 0.34, r * 0.5, mat);
    const a = (i / 10) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, 0);
    tooth.rotation.z = a;
    g.add(tooth);
  }
  const rim = cyl(r * 0.98, r * 0.98, r * 0.5, mat, 36);
  rim.rotation.x = Math.PI / 2;
  const hub = cyl(r * 0.4, r * 0.4, r * 0.62, std(0x1e293b, { rough: 0.5, metal: 0.4 }), 24);
  hub.rotation.x = Math.PI / 2;
  const cap = cyl(r * 0.24, r * 0.24, r * 0.66, std(0xf7c55c, { rough: 0.4, metal: 0.3 }), 20);
  cap.rotation.x = Math.PI / 2;
  g.add(rim, hub, cap);
  return g;
}
function makeExtinguisher() {
  const g = new THREE.Group();
  const red = std(0xc62828, { rough: 0.35, metal: 0.25 });
  const body = cyl(0.3, 0.3, 1.15, red, 28);
  body.position.y = 0.575;
  const collar = cyl(0.12, 0.12, 0.14, std(0x475569, { metal: 0.6, rough: 0.35 }), 16);
  collar.position.y = 1.2;
  const h1 = box(0.3, 0.05, 0.08, std(0x334155, { metal: 0.5, rough: 0.4 }));
  h1.position.set(-0.1, 1.32, 0);
  h1.rotation.z = 0.25;
  const h2 = h1.clone();
  h2.position.x = 0.1;
  h2.rotation.z = -0.25;
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0.1, 1.26, 0.05),
    new THREE.Vector3(0.62, 1.2, 0.1),
    new THREE.Vector3(0.66, 0.72, 0.1),
  );
  const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.035, 10), std(0x1f2937, { rough: 0.7 }));
  hose.castShadow = true;
  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 16), std(0xd97706, { rough: 0.4, metal: 0.4 }));
  nozzle.position.set(0.66, 0.6, 0.1);
  nozzle.rotation.x = Math.PI;
  nozzle.castShadow = true;
  const label = box(0.3, 0.42, 0.02, std(0xf5f5f4, { rough: 0.6 }));
  label.position.set(0, 0.62, 0.295);
  const stripe = box(0.3, 0.1, 0.022, std(0xc62828, { rough: 0.6 }));
  stripe.position.set(0, 0.72, 0.295);
  g.add(body, collar, h1, h2, hose, nozzle, label, stripe);
  return g;
}
function makePin() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 10, 24), std(0xf7c55c, { metal: 0.7, rough: 0.3 }));
  const pin = cyl(0.018, 0.018, 0.18, std(0xb45309, { metal: 0.6, rough: 0.35 }), 10);
  pin.rotation.z = Math.PI / 2;
  pin.position.x = -0.14;
  g.add(ring, pin);
  return g;
}
function makeValveAssembly() {
  const g = new THREE.Group();
  const green = std(0x0f6b3a, { rough: 0.4, metal: 0.3 });
  const body = cyl(0.42, 0.42, 1.7, green, 28);
  body.position.y = 0.85;
  const band = cyl(0.43, 0.43, 0.2, std(0xf7c55c, { rough: 0.5 }), 28);
  band.position.y = 1.1;
  const stem = cyl(0.07, 0.07, 0.22, std(0x94a3b8, { metal: 0.7, rough: 0.3 }), 12);
  stem.position.y = 1.8;
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 12, 28), std(0xf7c55c, { metal: 0.55, rough: 0.35 }));
  rim.castShadow = true;
  wheel.add(rim);
  for (let i = 0; i < 3; i++) {
    const sp = cyl(0.03, 0.03, 0.42, std(0xb45309, { metal: 0.5, rough: 0.4 }), 8);
    sp.rotation.z = (i / 3) * Math.PI;
    wheel.add(sp);
  }
  const hub = sph(0.06, std(0x475569, { metal: 0.6, rough: 0.35 }));
  wheel.add(hub);
  wheel.position.y = 1.95;
  g.add(body, band, stem, wheel);
  return { group: g, wheel };
}
function makeHeart() {
  const g = new THREE.Group();
  const m = std(0xdc2626, { rough: 0.35 });
  const l = sph(0.26, m);
  l.position.set(-0.14, 0.1, 0);
  const r = sph(0.26, m);
  r.position.set(0.14, 0.1, 0);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 20), m);
  tip.position.y = -0.2;
  tip.rotation.x = Math.PI;
  tip.castShadow = true;
  g.add(l, r, tip);
  return g;
}

// ---------- scene builders ----------
interface B {
  (st: Setup, g: Gest): Updater;
}

function baseFire(st: Setup, scale = 1) {
  const { scene } = st;
  const flames = new Pool(scene, 220, 0.24, true, 0.95);
  flames.grav = 2.2;
  flames.dragF = 0.6;
  const embers = new Pool(scene, 60, 0.09, true, 0.9);
  embers.grav = 1.2;
  const smoke = new Pool(scene, 60, 0.6, false, 0.28);
  smoke.grav = 0.8;
  const glow = glowSprite(0xe2571b, 3.4 * scale, 0.55);
  glow.position.y = 0.5;
  scene.add(glow);
  const logM = std(0x3f2a1a, { rough: 0.9 });
  const l1 = cyl(0.09, 0.09, 1.1, logM, 10);
  l1.rotation.z = Math.PI / 2.4;
  l1.position.y = 0.12;
  const l2 = l1.clone();
  l2.rotation.z = -Math.PI / 2.4;
  scene.add(l1, l2);
  return { flames, embers, smoke, glow, origin: new THREE.Vector3() };
}
function burn(f: ReturnType<typeof baseFire>, o: THREE.Vector3, intensity: number, dt: number, t: number) {
  const rate = 90 * intensity;
  f.flames.debt += rate * dt;
  while (f.flames.debt >= 1) {
    f.flames.debt -= 1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.42;
    const warm = Math.random();
    f.flames.spawn(
      o.x + Math.cos(a) * r, o.y + Math.random() * 0.15, o.z + Math.sin(a) * r * 0.6,
      (Math.random() - 0.5) * 0.5, 1.1 + Math.random() * 1.3, (Math.random() - 0.5) * 0.5,
      0.45 + Math.random() * 0.4,
      1, 0.55 + warm * 0.35, 0.15 + warm * 0.25,
    );
  }
  if (Math.random() < intensity * 0.5) {
    f.embers.spawn(o.x + (Math.random() - 0.5) * 0.5, o.y + 0.3, o.z, (Math.random() - 0.5) * 0.8, 1.6 + Math.random(), (Math.random() - 0.5) * 0.8, 1 + Math.random() * 0.8, 1, 0.6, 0.15);
  }
  if (Math.random() < intensity * 0.35) {
    f.smoke.spawn(o.x + (Math.random() - 0.5) * 0.4, o.y + 1.1, o.z - 0.1, (Math.random() - 0.5) * 0.3, 0.7, 0, 1.6 + Math.random(), 0.45, 0.45, 0.48);
  }
  const flick = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7);
  (f.glow.material as THREE.SpriteMaterial).opacity = 0.55 * intensity * flick;
  const s = (0.8 + 0.5 * intensity) * flick;
  f.glow.scale.set(3.4 * s, 3.4 * s, 1);
  f.flames.update(dt);
  f.embers.update(dt);
  f.smoke.update(dt);
}

const BUILDERS: Record<Hazard, B[]> = {
  fire: [
    // 0 · pull the pin
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "drag" }>;
      const ext = makeExtinguisher();
      const bc = toWorld(camera, 0.5, 0.5, 0);
      ext.position.set(bc.x, 0, 0);
      scene.add(ext);
      const pin = makePin();
      scene.add(pin);
      const check = textSprite("✓", "#16a34a", 0.9);
      check.visible = false;
      scene.add(check);
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      return (t, _dt, s) => {
        toWorld(camera, gg.from.x, gg.from.y, 0.9, a);
        toWorld(camera, gg.to.x, gg.to.y, 0.9, b);
        pin.position.lerpVectors(a, b, s.p);
        pin.rotation.z = -0.4 - s.p * 1.2;
        pin.rotation.y = Math.sin(t * 2) * 0.15;
        check.visible = s.done;
        if (s.done) {
          check.position.copy(b).add(new THREE.Vector3(0, 0.45, 0));
        }
      };
    },
    // 1 · aim at the base
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "drag" }>;
      const f = baseFire(st);
      const base = gnd(toWorld(camera, 0.3, 0.74, 0), 0.02);
      f.origin.copy(base);
      f.glow.position.copy(base).add(new THREE.Vector3(0, 0.5, 0));
      const ext = makeExtinguisher();
      const ex = toWorld(camera, 0.7, 0.5, 0);
      ext.position.set(ex.x, 0, -0.4);
      ext.scale.setScalar(0.9);
      scene.add(ext);
      const pivot = new THREE.Group();
      pivot.position.set(ex.x - 0.1, 1.35, 0.1);
      scene.add(pivot);
      const noz = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 14), std(0xd97706, { rough: 0.4, metal: 0.4 }));
      noz.geometry.rotateX(Math.PI / 2);
      noz.position.z = 0.3;
      noz.castShadow = true;
      pivot.add(noz);
      const sprayMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0, depthWrite: false });
      const spray = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.6, 18, 1, true), sprayMat);
      spray.geometry.rotateX(-Math.PI / 2);
      spray.geometry.translate(0, 0, 0.95);
      pivot.add(spray);
      const foam = new Pool(scene, 120, 0.12, true, 0.9);
      const aimT = new THREE.Vector3();
      const startA = toWorld(camera, gg.from.x, gg.from.y, 0.4);
      const endA = toWorld(camera, gg.to.x, gg.to.y, 0.2);
      return (t, dt, s) => {
        aimT.lerpVectors(startA, endA, s.p);
        if (s.grabbed && s.drag) toWorld(camera, s.drag.x, s.drag.y, 0.2, aimT);
        pivot.lookAt(aimT);
        sprayMat.opacity = 0.12 + s.p * 0.3;
        const d = pivot.position.distanceTo(aimT);
        spray.scale.set(1, 1, Math.max(d / 1.9, 0.4));
        if (s.p > 0.03) {
          foam.debt += 60 * s.p * dt;
          while (foam.debt >= 1) {
            foam.debt -= 1;
            const jx = (Math.random() - 0.5) * 0.2;
            const jy = (Math.random() - 0.5) * 0.2;
            foam.spawn(pivot.position.x, pivot.position.y, pivot.position.z, (aimT.x - pivot.position.x) * 1.6 + jx, (aimT.y - pivot.position.y) * 1.6 + jy, (aimT.z - pivot.position.z) * 1.6, 0.4, 0.75, 0.89, 1);
          }
        }
        foam.update(dt);
        burn(f, base, Math.max(1 - s.p * 1.05, 0), dt, t);
      };
    },
    // 2 · sweep
    (st) => {
      const { scene, camera } = st;
      const f = baseFire(st);
      const base = gnd(toWorld(camera, 0.28, 0.74, 0), 0.02);
      f.origin.copy(base);
      f.glow.position.copy(base).add(new THREE.Vector3(0, 0.5, 0));
      const ext = makeExtinguisher();
      const ex = toWorld(camera, 0.55, 0.5, 0);
      ext.position.set(ex.x, 0, -0.2);
      scene.add(ext);
      const pivot = new THREE.Group();
      pivot.position.set(ex.x, 1.35, 0.2);
      scene.add(pivot);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 10), std(0xd97706, { rough: 0.4, metal: 0.4 }));
      arm.geometry.rotateZ(Math.PI / 2);
      arm.position.x = 0.35;
      arm.castShadow = true;
      pivot.add(arm);
      const sprayMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
      const spray = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 18, 1, true), sprayMat);
      spray.geometry.rotateZ(Math.PI / 2);
      spray.geometry.translate(1.6, 0, 0);
      pivot.add(spray);
      const foam = new Pool(scene, 140, 0.12, true, 0.9);
      const tip = new THREE.Vector3();
      return (t, dt, s) => {
        const sw = Math.sin(t * 2.6) * 0.55 + (s.grabbed && s.drag ? (s.drag.x - 0.5) * 1.2 : 0);
        pivot.rotation.y = sw;
        tip.set(1.9, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), sw).add(pivot.position);
        foam.debt += 70 * dt;
        while (foam.debt >= 1) {
          foam.debt -= 1;
          foam.spawn(tip.x, tip.y + (Math.random() - 0.5) * 0.3, tip.z, (Math.random() - 0.5) * 1.2, -0.4 - Math.random(), (Math.random() - 0.5) * 1.2, 0.45, 0.75, 0.89, 1);
        }
        foam.update(dt);
        burn(f, base, Math.max(1 - s.p * 1.05, 0), dt, t);
      };
    },
    // 2 · escape route
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "drag" }>;
      const f = baseFire(st, 0.8);
      const fb = gnd(toWorld(camera, 0.86, 0.74, 0), 0.02);
      f.origin.copy(fb);
      f.glow.position.copy(fb).add(new THREE.Vector3(0, 0.5, 0));
      const runner = makeRunner();
      runner.rotation.y = -Math.PI / 2;
      scene.add(runner);
      const exit = glowSprite(0x16a34a, 2.2, 0.7);
      const exitP = toWorld(camera, gg.to.x, gg.to.y, -0.5);
      exit.position.set(exitP.x, 1, exitP.z);
      scene.add(exit);
      const sign = textSprite("EXIT", "#16a34a", 1.1);
      sign.position.set(exitP.x, 2.1, exitP.z);
      scene.add(sign);
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      return (t, dt, s) => {
        toWorld(camera, gg.from.x, gg.from.y, 0, a);
        toWorld(camera, gg.to.x, gg.to.y, 0, b);
        a.y = Math.max(a.y, 0);
        b.y = Math.max(b.y, 0);
        runner.position.lerpVectors(a, b, s.p);
        runner.position.y += Math.abs(Math.sin(t * 9)) * 0.07;
        runner.rotation.z = Math.sin(t * 9) * 0.04;
        exit.material.opacity = 0.5 + 0.25 * Math.sin(t * 4);
        burn(f, fb, 1, dt, t);
      };
    },
  ],
  gas: [
    // 0 · no lights / no calls
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "tapSeq" }>;
      const leak = new Pool(scene, 80, 0.5, false, 0.3);
      const a = toWorld(camera, gg.at[0].x, gg.at[0].y, 0);
      const pole = cyl(0.05, 0.07, 1.0, std(0x475569, { metal: 0.5, rough: 0.4 }), 10);
      pole.position.set(a.x, 0.5, a.z);
      scene.add(pole);
      const bulbMat = std(0xf7c55c, { emissive: 0xf7c55c, ei: 2 });
      const bulb = sph(0.24, bulbMat);
      bulb.position.set(a.x, 1.15, a.z);
      scene.add(bulb);
      const b = toWorld(camera, gg.at[1].x, gg.at[1].y, 0);
      const phone = box(0.36, 0.62, 0.07, std(0x111827, { rough: 0.4 }));
      phone.position.set(b.x, 0.75, b.z);
      phone.rotation.y = -0.3;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.5), new THREE.MeshBasicMaterial({ color: 0x7dd3fc }));
      screen.position.set(0, 0, 0.037);
      phone.add(screen);
      scene.add(phone);
      const x1 = textSprite("✕", "#ef4444", 0.8);
      x1.position.set(a.x, 1.7, a.z);
      x1.visible = false;
      const x2 = textSprite("✕", "#ef4444", 0.8);
      x2.position.set(b.x, 1.45, b.z);
      x2.visible = false;
      scene.add(x1, x2);
      const o = toWorld(camera, 0.5, 0.6, -0.6);
      return (t, dt, s) => {
        bulbMat.emissiveIntensity = s.seq >= 1 ? 0.15 : 1.6 + Math.sin(t * 13) * 1.1;
        (screen.material as THREE.MeshBasicMaterial).color.set(s.seq >= 2 ? 0x16a34a : 0x7dd3fc);
        x1.visible = s.seq >= 1;
        x2.visible = s.seq >= 2;
        leak.debt += 14 * dt;
        while (leak.debt >= 1) {
          leak.debt -= 1;
          leak.spawn(o.x + (Math.random() - 0.5) * 1.6, 0.4, o.z, (Math.random() - 0.5) * 0.2, 0.55, 0, 2, 0.72, 0.76, 0.82);
        }
        leak.update(dt);
      };
    },
    // 1 · close the valve
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "rotate" }>;
      const v = makeValveAssembly();
      const c = toWorld(camera, 0.5, 0.62, 0);
      v.group.position.set(c.x, 0, 0);
      scene.add(v.group);
      const leak = new Pool(scene, 120, 0.5, false, 0.32);
      const check = textSprite("✓", "#16a34a", 0.9);
      check.visible = false;
      scene.add(check);
      const wp = new THREE.Vector3();
      return (_t, dt, s) => {
        v.wheel.rotation.z = -s.p * gg.total;
        v.wheel.getWorldPosition(wp);
        leak.debt += 46 * (1 - s.p) * dt;
        while (leak.debt >= 1) {
          leak.debt -= 1;
          leak.spawn(wp.x + (Math.random() - 0.5) * 0.2, wp.y, wp.z, (Math.random() - 0.5) * 0.4, 0.9 + Math.random() * 0.5, -0.2, 1.4 + Math.random(), 0.75, 0.79, 0.84);
        }
        leak.update(dt);
        check.visible = s.done;
        if (s.done) check.position.copy(wp).add(new THREE.Vector3(0, 0.55, 0));
      };
    },
    // 2 · open doors & windows
    (st, g) => {
      const { scene } = st;
      const gg = g as Extract<Gest, { kind: "drag" }>;
      void gg;
      const wallM = std(0x334155, { rough: 0.85 });
      const mk = (w: number, h: number, x: number, y: number) => {
        const m = box(w, h, 0.3, wallM);
        m.position.set(x, y, -1.4);
        m.receiveShadow = true;
        scene.add(m);
      };
      mk(2.6, 3, -2.2, 1.5);
      mk(2.6, 3, 2.2, 1.5);
      mk(2.0, 0.7, 0, 2.65);
      const pivot = new THREE.Group();
      pivot.position.set(-0.9, 0, -1.25);
      const panel = box(1.75, 2.25, 0.12, std(0x94a3b8, { rough: 0.6, metal: 0.2 }));
      panel.position.set(0.875, 1.12, 0);
      const knob = sph(0.06, std(0xf7c55c, { metal: 0.6, rough: 0.3 }));
      knob.position.set(1.5, 1.1, 0.12);
      pivot.add(panel, knob);
      scene.add(pivot);
      const glowP = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.3), new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
      glowP.position.set(0, 1.15, -2.2);
      scene.add(glowP);
      const shafts = new Pool(scene, 40, 0.3, true, 0.35);
      const grip = sph(0.09, std(0xf7c55c, { emissive: 0xf7c55c, ei: 0.8 }));
      scene.add(grip);
      const edge = new THREE.Vector3();
      return (t, dt, s) => {
        pivot.rotation.y = -s.p * 1.85;
        (glowP.material as THREE.MeshBasicMaterial).opacity = 0.15 + s.p * 0.6;
        edge.set(1.75, 1.1, 0.1);
        pivot.localToWorld(edge);
        grip.position.copy(edge);
        grip.visible = !s.done;
        if (s.p > 0.05) {
          shafts.debt += 20 * s.p * dt;
          while (shafts.debt >= 1) {
            shafts.debt -= 1;
            shafts.spawn((Math.random() - 0.5) * 1.4, 0.4, -0.9, (Math.random() - 0.5) * 0.2, 0.5, 0.9, 1.2, 0.6, 0.85, 0.55);
          }
        }
        shafts.update(dt);
        void t;
        void gg;
      };
    },
    // 3 · fresh air
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "drag" }>;
      const runner = makeRunner(0x16a34a);
      runner.rotation.y = Math.PI / 2;
      scene.add(runner);
      const tp = toWorld(camera, gg.to.x, gg.to.y, -0.6);
      const zone = glowSprite(0x16a34a, 3.2, 0.55);
      zone.position.set(tp.x, 0.6, tp.z);
      scene.add(zone);
      const treeM = std(0x0f6b3a, { rough: 0.8 });
      const trunkM = std(0x5b3a1e, { rough: 0.9 });
      for (let i = 0; i < 3; i++) {
        const tx = tp.x - 1.2 + i * 1.2;
        const trunk = cyl(0.08, 0.1, 0.5, trunkM, 8);
        trunk.position.set(tx, 0.25, tp.z - 0.4);
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 10), treeM);
        top.position.set(tx, 1, tp.z - 0.4);
        top.castShadow = true;
        scene.add(trunk, top);
      }
      const label = textSprite("FRESH AIR", "#4ade80", 1.5);
      label.position.set(tp.x, 2.4, tp.z);
      scene.add(label);
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      return (t, dt, s) => {
        toWorld(camera, gg.from.x, gg.from.y, 0, a);
        toWorld(camera, gg.to.x, gg.to.y, 0, b);
        a.y = Math.max(a.y, 0);
        b.y = Math.max(b.y, 0);
        runner.position.lerpVectors(a, b, s.p);
        runner.position.y += Math.abs(Math.sin(t * 9)) * 0.07;
        zone.material.opacity = 0.45 + 0.2 * Math.sin(t * 3);
        void dt;
      };
    },
  ],
  gear: [
    // 0 · never reach in
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "drag" }>;
      const gear = makeGear(0.8);
      const gc = toWorld(camera, 0.42, 0.55, 0);
      gear.position.set(gc.x, 1.0, 0);
      scene.add(gear);
      const warn = glowSprite(0xef4444, 3.4, 0.5);
      warn.position.set(gc.x, 1.0, -0.4);
      scene.add(warn);
      const handM = std(0xf59e0b, { rough: 0.6 });
      const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 6, 12), handM);
      hand.castShadow = true;
      const cuff = cyl(0.18, 0.18, 0.22, std(0x0f6b3a, { rough: 0.6 }), 14);
      cuff.position.y = -0.32;
      hand.add(cuff);
      scene.add(hand);
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      return (t, dt, s) => {
        gear.rotation.z = t * 1.6;
        toWorld(camera, gg.from.x, gg.from.y, 0.9, a);
        toWorld(camera, gg.to.x, gg.to.y, 0.9, b);
        hand.position.lerpVectors(a, b, s.p);
        hand.lookAt(camera.position);
        warn.material.opacity = s.done ? 0 : 0.35 + 0.2 * Math.sin(t * 6);
        void dt;
      };
    },
    // 1 · lockout
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "hold" }>;
      const mc = toWorld(camera, 0.3, 0.55, 0);
      const mach = box(1.7, 1.25, 1.0, std(0x475569, { rough: 0.5, metal: 0.35 }));
      mach.position.set(mc.x, 0.62, -0.3);
      mach.receiveShadow = true;
      scene.add(mach);
      const btnMat = std(0x7f1d1d, { emissive: 0xef4444, ei: 1.4, rough: 0.4 });
      const btn = cyl(0.16, 0.16, 0.08, btnMat, 20);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(mc.x + 0.4, 0.75, 0.22);
      scene.add(btn);
      const lockP = toWorld(camera, gg.at.x, gg.at.y, 0.9);
      const lock = new THREE.Group();
      const lbody = box(0.36, 0.28, 0.14, std(0xd97706, { metal: 0.55, rough: 0.35 }));
      const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.032, 10, 20, Math.PI), std(0xcbd5e1, { metal: 0.8, rough: 0.25 }));
      shackle.position.y = 0.14;
      shackle.castShadow = true;
      lock.add(lbody, shackle);
      lock.position.copy(lockP);
      scene.add(lock);
      const check = textSprite("✓", "#16a34a", 0.8);
      check.visible = false;
      scene.add(check);
      const red = new THREE.Color(0xef4444);
      const grn = new THREE.Color(0x16a34a);
      return (_t, _dt, s) => {
        shackle.rotation.z = (1 - s.p) * 1.1;
        btnMat.emissive.copy(red).lerp(grn, s.p);
        btnMat.color.copy(btnMat.emissive);
        check.visible = s.done;
        if (s.done) check.position.copy(lockP).add(new THREE.Vector3(0.45, 0.3, 0));
      };
    },
    // 2 · fit the guard
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "drag" }>;
      const gear = makeGear(0.75);
      const gc = toWorld(camera, 0.32, 0.55, 0);
      gear.position.set(gc.x, 1.0, -0.2);
      scene.add(gear);
      const guardM = std(0x0f6b3a, { rough: 0.35, transparent: true, opacity: 0.55 });
      const guard = box(1.95, 1.95, 0.16, guardM);
      const frame = box(2.05, 0.1, 0.2, std(0xf7c55c, { rough: 0.4, metal: 0.3 }));
      frame.position.y = 1.02;
      const frame2 = frame.clone();
      frame2.position.y = -1.02;
      const guardG = new THREE.Group();
      guardG.add(guard, frame, frame2);
      scene.add(guardG);
      let ang = 0;
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      return (_t, dt, s) => {
        ang += dt * (1 - s.p) * 1.6;
        gear.rotation.z = ang;
        toWorld(camera, gg.from.x, gg.from.y, 0.55, a);
        toWorld(camera, gg.to.x, gg.to.y, 0.55, b);
        a.y = Math.max(a.y, 1.0);
        b.set(gc.x, 1.0, 0.35);
        guardG.position.lerpVectors(a, b, s.p);
      };
    },
    // 3 · test before restart
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "hold" }>;
      const gear = makeGear(0.8);
      const gc = toWorld(camera, 0.42, 0.55, 0);
      gear.position.set(gc.x, 1.0, 0);
      scene.add(gear);
      const rp = toWorld(camera, gg.at.x, gg.at.y, 0.6);
      const ringM = new THREE.MeshBasicMaterial({ color: 0x16a34a, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 10, 40), ringM);
      ring.position.copy(rp);
      scene.add(ring);
      const check = textSprite("✓", "#16a34a", 1.0);
      check.visible = false;
      check.position.set(rp.x, rp.y + 0.85, rp.z);
      scene.add(check);
      const baseSX = check.scale.x;
      const baseSY = check.scale.y;
      return (t, _dt, s) => {
        gear.rotation.z = t * 0.5;
        ring.rotation.z = -t * 0.8;
        const k = easeOutBack(clamp01(s.p));
        check.visible = s.p > 0.02;
        check.scale.set(baseSX * k, baseSY * k, 1);
      };
    },
  ],
  sparks: [
    // 0 · dodge the sparks
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "drag" }>;
      const head = makeHead(0.34);
      scene.add(head);
      const rain = new Pool(scene, 90, 0.09, true, 0.95);
      rain.grav = -7;
      const sz = toWorld(camera, gg.from.x, gg.from.y, 0);
      const safe = glowSprite(0x16a34a, 2.0, 0.55);
      const sp = toWorld(camera, gg.to.x, gg.to.y, -0.3);
      safe.position.set(sp.x, 1.35, sp.z);
      scene.add(safe);
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      return (t, dt, s) => {
        toWorld(camera, gg.from.x, gg.from.y, 0, a);
        toWorld(camera, gg.to.x, gg.to.y, 0, b);
        a.y = 1.35;
        b.y = 1.35;
        head.position.lerpVectors(a, b, s.p);
        head.rotation.y = Math.sin(t * 1.5) * 0.25;
        rain.debt += 40 * dt;
        while (rain.debt >= 1) {
          rain.debt -= 1;
          rain.spawn(sz.x + (Math.random() - 0.5) * 2.4, 3 + Math.random(), sz.z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, -0.5, 0, 1.1, 1, 0.72, 0.2);
        }
        rain.update(dt);
      };
    },
    // 1 · helmet on
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "drag" }>;
      const hp = toWorld(camera, gg.to.x, gg.to.y, 0);
      const head = makeHead(0.34);
      head.position.set(hp.x, 1.35, hp.z);
      scene.add(head);
      const helmet = makeHelmet(0.42);
      scene.add(helmet);
      const top = new THREE.Vector3(hp.x, hp.y + 1.9, hp.z);
      const rest = new THREE.Vector3(hp.x, 1.35 + 0.3, hp.z);
      const check = textSprite("✓", "#16a34a", 0.9);
      check.visible = false;
      check.position.set(hp.x + 0.85, 1.7, hp.z);
      scene.add(check);
      const q = new THREE.Vector3();
      return (t, _dt, s) => {
        q.lerpVectors(top, rest, s.p);
        if (s.grabbed && s.drag) {
          const w = toWorld(camera, s.drag.x, s.drag.y, 0);
          q.y = Math.max(w.y, rest.y);
          q.x += (w.x - q.x) * 0.4;
        }
        helmet.position.copy(q);
        helmet.rotation.z = Math.sin(t * 1.2) * 0.03 * (1 - s.p);
        helmet.rotation.y = t * 0.15 * (1 - s.p);
        check.visible = s.done;
      };
    },
    // 2 · chin strap
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "drag" }>;
      const hp = toWorld(camera, 0.5, 0.55, 0);
      const head = makeHead(0.33);
      head.position.set(hp.x, 1.32, hp.z);
      scene.add(head);
      const helmet = makeHelmet(0.41);
      helmet.position.set(hp.x, 1.32 + 0.3, hp.z);
      scene.add(helmet);
      const strapM = std(0xb45309, { rough: 0.6 });
      const l1 = linkMesh(0.03, strapM);
      const l2 = linkMesh(0.03, strapM);
      scene.add(l1, l2);
      const clip = sph(0.07, std(0xd97706, { metal: 0.5, rough: 0.35 }));
      scene.add(clip);
      const L = new THREE.Vector3(hp.x - 0.3, 1.25, hp.z + 0.22);
      const R = new THREE.Vector3(hp.x + 0.3, 1.25, hp.z + 0.22);
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      const check = textSprite("✓", "#16a34a", 0.8);
      check.visible = false;
      check.position.set(hp.x + 0.7, 1.0, hp.z);
      scene.add(check);
      return (_t, _dt, s) => {
        toWorld(camera, gg.from.x, gg.from.y, 0.5, a);
        toWorld(camera, gg.to.x, gg.to.y, 0.5, b);
        c.lerpVectors(a, b, s.p);
        c.y = Math.min(c.y, 1.0);
        if (s.grabbed && s.drag) {
          const w = toWorld(camera, s.drag.x, s.drag.y, 0.5);
          c.y = Math.min(Math.max(w.y, 0.75), 1.05);
          c.x += (w.x - c.x) * 0.35;
        }
        clip.position.copy(c);
        setLink(l1, L, c);
        setLink(l2, R, c);
        check.visible = s.done;
      };
    },
  ],
  pulse: [
    // 0 · check the scene
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "hold" }>;
      const bodyM = std(0x3b82f6, { rough: 0.7 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.8, 6, 14), bodyM);
      body.rotation.z = Math.PI / 2;
      body.position.set(-0.6, 0.26, 0);
      body.castShadow = true;
      const head = sph(0.2, std(0xf2c89b, { rough: 0.65 }));
      head.position.set(0.25, 0.22, 0);
      scene.add(body, head);
      const mag = new THREE.Group();
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 12, 28), std(0xf7c55c, { metal: 0.5, rough: 0.35 }));
      lens.castShadow = true;
      const handle = cyl(0.045, 0.045, 0.5, std(0x92400e, { rough: 0.6 }), 10);
      handle.position.set(0.32, -0.32, 0);
      handle.rotation.z = -0.7;
      mag.add(lens, handle);
      scene.add(mag);
      const zp = toWorld(camera, gg.at.x, gg.at.y, 0.6);
      const safe = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.04, 10, 48),
        new THREE.MeshBasicMaterial({ color: 0x16a34a, transparent: true, opacity: 0 }),
      );
      safe.rotation.x = -Math.PI / 2;
      safe.position.set(zp.x, 0.03, -0.2);
      scene.add(safe);
      return (t, _dt, s) => {
        mag.position.set(Math.sin(t * 1.5) * 1.5, 1.25 + Math.sin(t * 2.2) * 0.08, 0.7);
        mag.rotation.y = Math.sin(t * 1.5) * 0.3;
        (safe.material as THREE.MeshBasicMaterial).opacity = s.p * 0.9;
        const sc = 0.6 + s.p * 0.4;
        safe.scale.set(sc, sc, 1);
      };
    },
    // 1 · phone + kit
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "tapSeq" }>;
      const items: THREE.Group[] = [];
      const checks: THREE.Sprite[] = [];
      gg.at.forEach((at, i) => {
        const w = toWorld(camera, at.x, at.y, 0);
        const grp = new THREE.Group();
        if (i === 0) {
          const phone = box(0.4, 0.68, 0.08, std(0x111827, { rough: 0.4 }));
          const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.54), new THREE.MeshBasicMaterial({ color: 0x7dd3fc }));
          screen.position.z = 0.045;
          phone.add(screen);
          grp.add(phone);
        } else {
          const kit = box(0.62, 0.5, 0.4, std(0xf5f5f4, { rough: 0.55 }));
          const c1 = box(0.34, 0.12, 0.42, std(0xc62828, { rough: 0.5 }));
          const c2 = box(0.12, 0.34, 0.42, std(0xc62828, { rough: 0.5 }));
          kit.add(c1, c2);
          const handle = box(0.4, 0.08, 0.08, std(0x0f6b3a, { rough: 0.5 }));
          handle.position.y = 0.3;
          grp.add(kit, handle);
        }
        grp.position.set(w.x, 0.75, w.z);
        grp.rotation.y = i === 0 ? -0.3 : 0.3;
        scene.add(grp);
        items.push(grp);
        const ck = textSprite("✓", "#16a34a", 0.7);
        ck.position.set(w.x, 1.5, w.z);
        ck.visible = false;
        scene.add(ck);
        checks.push(ck);
      });
      return (t, _dt, s) => {
        items.forEach((grp, i) => {
          const tapped = s.seq > i;
          const active = s.seq === i;
          const base = tapped ? 1.12 : 1;
          const sc = base + (active ? 0.05 * Math.sin(t * 6) : 0.02 * Math.sin(t * 3 + i));
          grp.scale.setScalar(Math.max(sc, 0.01));
          grp.rotation.y += (tapped ? 0 : 0.15) * 0.016;
          checks[i].visible = tapped;
        });
      };
    },
    // 2 · stay calm
    (st, g) => {
      const { scene, camera } = st;
      const gg = g as Extract<Gest, { kind: "hold" }>;
      const hp = toWorld(camera, gg.at.x, gg.at.y, 0);
      const heart = makeHeart();
      heart.position.set(hp.x, 1.15, hp.z);
      scene.add(heart);
      const glow = glowSprite(0xef4444, 2.2, 0.3);
      glow.position.copy(heart.position);
      scene.add(glow);
      const respM = std(0x0e7490, { rough: 0.6 });
      const resp = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 6, 14), respM);
      resp.position.set(hp.x + 1.5, 0.72, hp.z - 0.3);
      resp.castShadow = true;
      const rhead = sph(0.19, std(0xf2c89b, { rough: 0.65 }));
      rhead.position.set(hp.x + 1.5, 1.42, hp.z - 0.3);
      scene.add(resp, rhead);
      return (t, _dt, s) => {
        const rate = 7 - s.p * 4.5;
        const beat = Math.max(Math.sin(t * rate), 0);
        const sc = 1 + beat * 0.13;
        heart.scale.set(sc, sc, sc);
        heart.rotation.y = Math.sin(t * 0.8) * 0.2;
        glow.material.opacity = 0.25 + s.p * 0.45 + beat * 0.1;
      };
    },
  ],
};

export function Stage3D({
  hazard,
  index,
  prog,
}: {
  hazard: Hazard;
  index: number;
  prog: MutableRefObject<ProgState>;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w = mount.clientWidth || 560;
    const h = mount.clientHeight || 224;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const dprCap = w < 768 ? 1.25 : 1.75;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b1520, 10, 20);
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.set(0, 2.5, 6.6);
    camera.lookAt(0, 1.05, 0);

    scene.add(new THREE.HemisphereLight(0xd6eddf, 0x0a1a12, 0.85));
    const key = new THREE.DirectionalLight(0xfff1d6, 1.7);
    key.position.set(4, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xf7c55c, 0.55);
    rim.position.set(-5, 3, -4);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x9fd8b4, 0.3);
    fill.position.set(-2, 2, 6);
    scene.add(fill);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(11, 48), std(0x10231a, { rough: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const ringM = new THREE.MeshBasicMaterial({ color: 0xf7c55c, transparent: true, opacity: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.025, 8, 72), ringM);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    const gest = GESTS[hazard][index];
    const update = BUILDERS[hazard][index]({ scene, camera }, gest);

    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth || 560;
      const nh = mount.clientHeight || 224;
      renderer.setSize(nw, nh, false);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      try {
        update(now / 1000, dt, prog.current);
      } catch {
        /* a frame may fail during teardown */
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mt = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mt)) mt.forEach((x) => x.dispose());
        else if (mt) mt.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [hazard, index, prog]);

  return <div ref={mountRef} className="absolute inset-0" />;
}