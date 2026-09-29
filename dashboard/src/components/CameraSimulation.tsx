import { useEffect, useRef, useState } from "react";
import { tr } from "../lib/content";
import type { L10n } from "../lib/content";
import { StepStage } from "./StepStage";
import { speak, stopVoice, voiceEnabled, setVoice, praise } from "../lib/voice";
import { sx, fmt } from "../lib/i18n";
import { setLanguage } from "../lib/workerStore";
import LangSwitch from "./LangSwitch";

type Pt = { x: number; y: number }; // normalized 0..1
type Zone = { x: number; y: number; w: number; h: number };
type Phase = "intro" | "explain" | "done";

interface SimDef {
  hazard: "fire" | "gas" | "gear" | "sparks" | "pulse";
  intro: L10n;
  steps: L10n[];
  act: L10n;
  ok: L10n;
  zone: Zone;
  video?: string;
  stepVideos?: { src: string; from: number; to: number }[];
}

const SIMS: Record<string, SimDef> = {
  fire_explosion: {
    hazard: "fire",
    stepVideos: [
      { src: "/videos/fire_simulation.mp4", from: 0, to: 2.5 },
      { src: "/videos/fire_simulation.mp4", from: 2.5, to: 5 },
      { src: "/videos/fire_simulation.mp4", from: 5, to: 7.5 },
      { src: "/videos/fire_simulation.mp4", from: 7.5, to: 10 },
    ],
    intro: {
      en: "A fire has started near the work area. Watch how the flames grow, then follow the steps and extinguish it.",
      hi: "कार्य क्षेत्र के पास आग लग गई है। लौ कैसे बढ़ती है देखें, फिर चरणों का पालन कर आग बुझाएँ।",
      sat: "ᱠᱟᱹᱢᱤ ᱴᱷᱟᱶ ᱥᱩᱨ ᱨᱮ ᱥᱮᱸᱜᱮᱞ ᱦᱩᱭ ᱟᱠᱟᱱᱟ. ᱞᱟᱦᱟᱸ ᱥᱮᱸᱜᱮᱞ ᱪᱮᱞᱮᱠᱟ ᱯᱟᱥᱱᱟᱣᱚᱜ ᱧᱮᱞ ᱢᱮ, ᱤᱱᱟᱹ ᱫᱷᱟᱯ ᱠᱚ ᱯᱟᱸᱡᱟᱭ ᱠᱟᱛᱮᱜ ᱥᱮᱸᱜᱮᱞ ᱜᱚᱡ ᱢᱮ.",
    },
    steps: [
      {
        en: "Pull the pin to unlock the extinguisher.",
        hi: "पिन खींचकर यंत्र को अनलॉक करें।",
        sat: "ᱯᱤᱱ ᱛᱟᱱᱟᱢ ᱠᱟᱛᱮᱜ ᱥᱮᱸᱜᱮᱞ ᱜᱚᱡ ᱢᱮᱥᱤᱱ ᱡᱷᱤᱡ ᱢᱮ.",
      },
      {
        en: "Aim the nozzle at the BASE of the fire — not the flames.",
        hi: "नोज़ल आग के आधार पर लक्ष्य करें, लौ पर नहीं।",
        sat: "ᱱᱚᱡᱚᱞ ᱥᱮᱸᱜᱮᱞ ᱨᱮᱱᱟᱜ ᱵᱩᱴᱟᱹ ᱥᱮᱫ ᱫᱚᱦᱚ ᱢᱮ, ᱞᱟᱦᱟᱸ ᱫᱚ ᱵᱟᱝ.",
      },
      {
        en: "Squeeze the handle and sweep side to side.",
        hi: "हैंडल दबाएँ और बाएँ-दाएँ घुमाएँ।",
        sat: "ᱦᱮᱱᱰᱮᱞ ᱫᱟᱵᱟᱣ ᱠᱟᱛᱮᱜ ᱱᱚᱸᱰᱮᱼᱦᱚᱸᱰᱮ ᱟᱹᱜᱩᱭ ᱢᱮ.",
      },
      {
        en: "Keep an escape route behind you while you work.",
        hi: "काम करते समय पीछे निकास मार्ग रखें।",
        sat: "ᱠᱟᱹᱢᱤ ᱚᱠᱛᱮ ᱛᱟᱭᱚᱢ ᱥᱮᱫ ᱫᱟᱹᱲ ᱦᱚᱨᱟ ᱫᱚᱦᱚ ᱢᱮ.",
      },
    ],
    act: {
      en: "Press and hold ON the fire base to spray and extinguish it.",
      hi: "आग के आधार पर दबाकर रखें — छिड़क कर बुझाएँ।",
      sat: "ᱥᱮᱸᱜᱮᱞ ᱵᱩᱴᱟᱹ ᱨᱮ ᱛᱮᱵᱮ ᱠᱟᱛᱮᱜ ᱫᱚᱦᱚ ᱢᱮ — ᱨᱩᱣᱟᱹᱲ ᱠᱟᱛᱮᱜ ᱜᱚᱡ ᱢᱮ.",
    },
    ok: {
      en: "Fire extinguished. PASS completed.",
      hi: "आग बुझ गई। पास पूरा।",
      sat: "ᱥᱮᱸᱜᱮᱞ ᱜᱚᱡ ᱮᱱᱟ. PASS ᱯᱩᱨᱟᱹᱣ ᱮᱱᱟ.",
    },
    zone: { x: 0.5, y: 0.66, w: 0.3, h: 0.36 },
  },
  gas_confined: {
    hazard: "gas",
    stepVideos: [
      { src: "/videos/gas_simulation.mp4", from: 0, to: 2.5 },
      { src: "/videos/gas_simulation.mp4", from: 2.5, to: 5 },
      { src: "/videos/gas_simulation.mp4", from: 5, to: 7.5 },
      { src: "/videos/gas_simulation.mp4", from: 7.5, to: 10 },
    ],
    intro: {
      en: "A cylinder is leaking in a confined space. Watch the gas spread, then act to stop the leak.",
      hi: "सीमित जगह में सिलेंडर से गैस रिस रही है। देखें फिर रिसाव रोकें।",
      sat: "ᱮᱥᱮᱫ ᱴᱷᱟᱶ ᱨᱮ ᱥᱤᱞᱤᱱᱰᱟᱨ ᱠᱷᱚᱱ ᱜᱮᱥ ᱡᱷᱚᱨᱚᱜ ᱠᱟᱱᱟ. ᱜᱮᱥ ᱪᱮᱞᱮᱠᱟ ᱯᱟᱥᱱᱟᱣᱚᱜ ᱧᱮᱞ ᱢᱮ, ᱤᱱᱟᱹ ᱫᱷᱟᱯ ᱠᱚ ᱯᱟᱸᱡᱟᱭ ᱠᱟᱛᱮᱜ ᱡᱷᱚᱨᱚᱜ ᱵᱚᱸᱫᱚ ᱢᱮ.",
    },
    steps: [
      {
        en: "Do NOT switch any light or call — explosion risk.",
        hi: "लाइट न चलाएँ, फोन न करें — विस्फोट का खतरा।",
        sat: "ᱵᱟᱹᱛᱤ ᱟᱞᱚᱢ ᱡᱷᱤᱡ, ᱯᱷᱚᱱ ᱦᱚᱸ ᱟᱞᱚᱢ ᱵᱮᱣᱦᱟᱨ — ᱵᱤᱥᱯᱷᱚᱴ ᱨᱮᱱᱟᱜ ᱵᱷᱚᱭ.",
      },
      {
        en: "Close the valve to stop the leak.",
        hi: "वाल्व बंद कर रिसाव रोकें।",
        sat: "ᱡᱷᱚᱨᱚᱜ ᱵᱚᱸᱫᱚ ᱞᱟᱹᱜᱤᱫ ᱵᱷᱟᱞᱵᱷ ᱵᱚᱸᱫᱚ ᱢᱮ.",
      },
      {
        en: "Open doors and windows to ventilate.",
        hi: "दरवाज़े और खिड़कियाँ खोलकर हवा दें।",
        sat: "ᱫᱩᱣᱟᱹᱨ ᱟᱨ ᱡᱷᱚᱨᱠᱟ ᱡᱷᱤᱡ ᱠᱟᱛᱮᱜ ᱦᱚᱭ ᱚᱫᱚᱜ ᱢᱮ.",
      },
      {
        en: "Move to fresh air and report immediately.",
        hi: "ताज़ी हवा में जाएँ और तुरंत रिपोर्ट करें।",
        sat: "ᱱᱟᱶᱟ ᱦᱚᱭ ᱥᱮᱫ ᱪᱟᱞᱟᱜ ᱢᱮ ᱟᱨ ᱩᱱᱤ ᱚᱠᱛᱮ ᱠᱷᱚᱵᱚᱨ ᱮᱢ ᱢᱮ.",
      },
    ],
    act: {
      en: "Press and hold on the valve to close it tight.",
      hi: "वाल्व पर दबाकर रखें — कसकर बंद करें।",
      sat: "ᱵᱷᱟᱞᱵᱷ ᱨᱮ ᱛᱮᱵᱮ ᱠᱟᱛᱮᱜ ᱫᱚᱦᱚ ᱢᱮ — ᱯᱩᱨᱟᱹ ᱵᱚᱸᱫᱚ ᱢᱮ.",
    },
    ok: {
      en: "Leak stopped. Gas no longer spreading.",
      hi: "रिसाव रुक गया। गैस नहीं फैल रही।",
      sat: "ᱡᱷᱚᱨᱚᱜ ᱵᱚᱸᱫᱚ ᱮᱱᱟ. ᱜᱮᱥ ᱵᱟᱝ ᱯᱟᱥᱱᱟᱣᱚᱜ.",
    },
    zone: { x: 0.5, y: 0.58, w: 0.24, h: 0.26 },
  },
  machinery: {
    hazard: "gear",
    stepVideos: [
      { src: "/videos/gear_simulation.mp4", from: 0, to: 2.5 },
      { src: "/videos/gear_simulation.mp4", from: 2.5, to: 5 },
      { src: "/videos/gear_simulation.mp4", from: 5, to: 7.5 },
      { src: "/videos/gear_simulation.mp4", from: 7.5, to: 10 },
    ],
    intro: {
      en: "A machine is running with a dangerous exposed part. Watch the moving part, then fit the safety guard.",
      hi: "मशीन खतरनाक खुले हिस्से के साथ चल रही है। देखें फिर गार्ड लगाएँ।",
      sat: "ᱢᱮᱥᱤᱱ ᱵᱷᱟᱹᱜᱤ ᱵᱟᱝ ᱮᱥᱮᱫ ᱦᱟᱹᱴᱤᱝ ᱥᱟᱶᱛᱮ ᱪᱟᱹᱞᱩᱜ ᱠᱟᱱᱟ. ᱜᱷᱩᱨᱟᱹᱣ ᱦᱟᱹᱴᱤᱝ ᱧᱮᱞ ᱢᱮ, ᱤᱱᱟᱹ ᱜᱟᱨᱰ ᱫᱚᱦᱚ ᱢᱮ.",
    },
    steps: [
      {
        en: "Never reach into moving parts.",
        hi: "घूमते हिस्सों में हाथ न डालें।",
        sat: "ᱜᱷᱩᱨᱟᱹᱣ ᱦᱟᱹᱴᱤᱝ ᱨᱮ ᱛᱤ ᱟᱞᱚᱢ ᱢᱮ.",
      },
      {
        en: "Switch off and lock out the machine.",
        hi: "मशीन बंद कर लॉक करें।",
        sat: "ᱢᱮᱥᱤᱱ ᱵᱚᱸᱫᱚ ᱠᱟᱛᱮᱜ ᱛᱟᱞᱟ ᱢᱟᱨᱟᱣ ᱢᱮ.",
      },
      {
        en: "Fit the guard firmly over the exposed part.",
        hi: "गार्ड खुले हिस्से पर मज़बूती से लगाएँ।",
        sat: "ᱮᱥᱮᱫ ᱦᱟᱹᱴᱤᱝ ᱪᱮᱛᱟᱱ ᱨᱮ ᱜᱟᱨᱰ ᱫᱟᱲᱮ ᱛᱮ ᱫᱚᱦᱚ ᱢᱮ.",
      },
      {
        en: "Test it once safely before restarting.",
        hi: "दोबारा चालू करने से पहले सुरक्षित जाँचें।",
        sat: "ᱟᱨᱦᱚᱸ ᱮᱦᱚᱵ ᱞᱟᱦᱟᱸ ᱨᱮ ᱥᱟᱹᱦᱤᱡ ᱛᱮ ᱵᱤᱰᱟᱹᱣ ᱢᱮ.",
      },
    ],
    act: {
      en: "Press and hold on the exposed part to slide the guard into place.",
      hi: "खुले हिस्से पर दबाएँ — गार्ड सरका कर लगाएँ।",
      sat: "ᱮᱥᱮᱫ ᱦᱟᱹᱴᱤᱝ ᱨᱮ ᱛᱮᱵᱮ ᱠᱟᱛᱮᱜ ᱫᱚᱦᱚ ᱢᱮ — ᱜᱟᱨᱰ ᱟᱹᱜᱩᱭ ᱠᱟᱛᱮᱜ ᱫᱚᱦᱚ ᱢᱮ.",
    },
    ok: {
      en: "Guard fitted. The machine is safe to test.",
      hi: "गार्ड लग गया। मशीन सुरक्षित है।",
      sat: "ᱜᱟᱨᱰ ᱫᱚᱦᱚ ᱮᱱᱟ. ᱢᱮᱥᱤᱱ ᱵᱤᱰᱟᱹᱣ ᱞᱟᱹᱜᱤᱫ ᱥᱟᱹᱦᱤᱡᱟ.",
    },
    zone: { x: 0.5, y: 0.58, w: 0.3, h: 0.3 },
  },
  ppe: {
    hazard: "sparks",
    stepVideos: [
      { src: "/videos/ppe_simulation.mp4", from: 0, to: 3.3 },
      { src: "/videos/ppe_simulation.mp4", from: 3.3, to: 6.6 },
      { src: "/videos/ppe_simulation.mp4", from: 6.6, to: 10 },
    ],
    intro: {
      en: "Sparks and debris are flying in a work zone. Watch, then put on the helmet to protect your head.",
      hi: "कार्य क्षेत्र में चिंगारियाँ उड़ रही हैं। देखें फिर हेलमेट पहनें।",
      sat: "ᱠᱟᱹᱢᱤ ᱴᱷᱟᱶ ᱨᱮ ᱥᱤᱨᱡᱚᱱ ᱟᱨ ᱨᱟᱹᱯᱩᱫ ᱡᱤᱱᱤᱥ ᱟᱹᱜᱩᱭ ᱟᱠᱟᱱᱟ. ᱧᱮᱞ ᱢᱮ, ᱤᱱᱟᱹ ᱵᱚᱦᱚᱜ ᱨᱩᱠᱷᱟᱹᱭᱟᱹ ᱞᱟᱹᱜᱤᱫ ᱦᱮᱞᱢᱮᱴ ᱦᱚᱨᱚᱜ ᱢᱮ.",
    },
    steps: [
      {
        en: "Sparks and falling objects can hurt your head.",
        hi: "चिंगारी और गिरती चीज़ें सिर पर चोट पहुँचा सकती हैं।",
        sat: "ᱥᱤᱨᱡᱚᱱ ᱟᱨ ᱧᱩᱨᱩᱜ ᱡᱤᱱᱤᱥ ᱵᱚᱦᱚᱜ ᱨᱮ ᱦᱟᱹᱥᱩ ᱫᱟᱲᱮᱭᱟᱜᱼᱟ.",
      },
      {
        en: "Wear the helmet so it covers your head fully.",
        hi: "हेलमेट इस तरह पहनें जैसे पूरा सिर ढँके।",
        sat: "ᱦᱮᱞᱢᱮᱴ ᱚᱱᱠᱟ ᱦᱚᱨᱚᱜ ᱢᱮ ᱡᱮᱢᱚᱱ ᱯᱩᱨᱟᱹ ᱵᱚᱦᱚᱜ ᱮᱥᱮᱫᱟ.",
      },
      {
        en: "Keep the chin strap tight while working.",
        hi: "काम करते समय पट्टा कस रखें।",
        sat: "ᱠᱟᱹᱢᱤ ᱚᱠᱛᱮ ᱯᱟᱴᱟ ᱴᱟᱭᱤᱴ ᱫᱚᱦᱚ ᱢᱮ.",
      },
    ],
    act: {
      en: "Press and hold to lower the helmet onto the head.",
      hi: "दबाकर हेलमेट सिर पर उतारें।",
      sat: "ᱛᱮᱵᱮ ᱠᱟᱛᱮᱜ ᱫᱚᱦᱚ ᱢᱮ, ᱦᱮᱞᱢᱮᱴ ᱵᱚᱦᱚᱜ ᱨᱮ ᱟᱹᱜᱩᱭ ᱢᱮ.",
    },
    ok: {
      en: "Helmet on. Head protected.",
      hi: "हेलमेट पहन लिया। सिर सुरक्षित।",
      sat: "ᱦᱮᱞᱢᱮᱴ ᱦᱚᱨᱚᱜ ᱮᱱᱟ. ᱵᱚᱦᱚᱜ ᱨᱩᱠᱷᱟᱹᱭᱟᱹᱜ ᱮᱱᱟ.",
    },
    zone: { x: 0.5, y: 0.55, w: 0.34, h: 0.4 },
  },
  emergency: {
    hazard: "pulse",
    stepVideos: [
      { src: "/videos/emergency_simulation.mp4", from: 0, to: 3.3 },
      { src: "/videos/emergency_simulation.mp4", from: 3.3, to: 6.6 },
      { src: "/videos/emergency_simulation.mp4", from: 6.6, to: 10 },
    ],
    intro: {
      en: "Someone needs help. Watch how to respond calmly, then start the first-aid steps.",
      hi: "किसी को मदद चाहिए। शांत रहने का तरीका देखें, फिर प्राथमिक उपचार शुरू करें।",
      sat: "ᱢᱤᱫ ᱦᱚᱲ ᱜᱚᱲᱚ ᱠᱷᱚᱡᱚᱜ ᱠᱟᱱᱟᱭ. ᱪᱮᱞᱮᱠᱟ ᱨᱟᱦᱟ ᱛᱮ ᱛᱮᱞᱟ ᱮᱢᱟᱭ ᱧᱮᱞ ᱢᱮ, ᱤᱱᱟᱹ ᱯᱟᱹᱦᱤᱞ ᱩᱯᱪᱟᱹᱨ ᱫᱷᱟᱯ ᱠᱚ ᱮᱦᱚᱵ ᱢᱮ.",
    },
    steps: [
      {
        en: "Check the scene is safe before approaching.",
        hi: "पास जाने से पहले जगह सुरक्षित देखें।",
        sat: "ᱥᱩᱨ ᱥᱮᱱ ᱞᱟᱦᱟᱸ ᱨᱮ ᱴᱷᱟᱶ ᱵᱷᱟᱹᱜᱤ ᱢᱮᱱᱟᱜᱼᱟ ᱧᱮᱞ ᱢᱮ.",
      },
      {
        en: "Call for help and bring the first-aid kit.",
        hi: "मदद बुलाएँ और प्राथमिक चिकित्सा किट लाएँ।",
        sat: "ᱜᱚᱲᱚ ᱦᱚᱦᱚ ᱢᱮ ᱟᱨ ᱯᱟᱹᱦᱤᱞ ᱩᱯᱪᱟᱹᱨ ᱠᱤᱴ ᱟᱹᱜᱩᱭ ᱢᱮ.",
      },
      {
        en: "Stay calm, give first aid, and comfort the person.",
        hi: "शांत रहें, उपचार दें और ढाढ़स बँधाएँ।",
        sat: "ᱨᱟᱦᱟ ᱛᱮ ᱛᱟᱦᱮᱸ ᱢᱮ, ᱩᱯᱪᱟᱹᱨ ᱮᱢ ᱢᱮ ᱟᱨ ᱩᱱᱤ ᱢᱚᱱ ᱫᱟᱲᱮ ᱮᱢᱟᱭ ᱢᱮ.",
      },
    ],
    act: {
      en: "Press and hold to start the first-aid response.",
      hi: "प्राथमिक उपचार शुरू करने के लिए दबाएँ।",
      sat: "ᱯᱟᱹᱦᱤᱞ ᱩᱯᱪᱟᱹᱨ ᱮᱦᱚᱵ ᱞᱟᱹᱜᱤᱫ ᱛᱮᱵᱮ ᱠᱟᱛᱮᱜ ᱫᱚᱦᱚ ᱢᱮ.",
    },
    ok: {
      en: "First aid started correctly.",
      hi: "प्राथमिक उपचार सही शुरू हुआ।",
      sat: "ᱯᱟᱹᱦᱤᱞ ᱩᱯᱪᱟᱹᱨ ᱴᱷᱤᱠ ᱛᱮ ᱮᱦᱚᱵ ᱮᱱᱟ.",
    },
    zone: { x: 0.5, y: 0.56, w: 0.32, h: 0.34 },
  },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  size: number;
  hue: string;
}

const PARTICLES: Particle[] = [];
let lastT = 0;

function inZone(p: Pt, z: Zone): boolean {
  return Math.abs(p.x - z.x) <= z.w / 2 && Math.abs(p.y - z.y) <= z.h / 2;
}

function drawFire(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, fuel: number, p: Pt | null, aiming: boolean, z: Zone) {
  const cx = z.x * W, cy = z.y * H, rw = (z.w / 2) * W, rh = (z.h / 2) * H;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const br = Math.max(rw, rh) * 1.9;
  const flicker = 0.7 + 0.3 * Math.sin(t * 9) * Math.sin(t * 3.1);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, br);
  g.addColorStop(0, `rgba(247,197,92,${0.4 * fuel * flicker})`);
  g.addColorStop(0.5, `rgba(226,87,27,${0.22 * fuel * flicker})`);
  g.addColorStop(1, "rgba(226,87,27,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const dt = Math.min((t - lastT) * 1000, 50) / 1000 || 0.016;
  lastT = t;
  const emit = fuel > 0.03 ? Math.round(6 * fuel) : 0;
  for (let i = 0; i < emit; i++) {
    PARTICLES.push({
      x: cx + (Math.random() - 0.5) * rw * 0.9,
      y: cy + rh * (0.4 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * W * 0.06,
      vy: -(H * 0.16) * (0.7 + Math.random() * 0.7),
      born: t,
      life: 0.45 + Math.random() * 0.35,
      size: (0.006 + Math.random() * 0.008) * Math.max(W, H),
      hue: Math.random() < 0.7 ? "247,197,92" : "226,87,27",
    });
  }
  let n = 0;
  for (const q of PARTICLES) {
    const age = t - q.born;
    if (age > q.life) continue;
    PARTICLES[n++] = q;
    const k = age / q.life;
    q.x += q.vx * dt;
    q.y += q.vy * dt + (k * k) * H * 0.02 * dt;
    ctx.fillStyle = `rgba(${q.hue},${(1 - k) * 0.95})`;
    ctx.beginPath();
    ctx.arc(q.x, q.y, q.size * (1 - k * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  PARTICLES.length = n;

  if (aiming && p && inZone(p, z)) {
    const px = p.x * W, py = p.y * H;
    const jet = ctx.createLinearGradient(px, py, cx, cy);
    jet.addColorStop(0, "rgba(255,255,255,0.85)");
    jet.addColorStop(1, "rgba(133,203,255,0.35)");
    ctx.strokeStyle = jet;
    ctx.lineWidth = Math.max(W, H) * 0.012;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(cx + (Math.random() - 0.5) * rw, cy + (Math.random() - 0.5) * rh);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGas(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, fuel: number, p: Pt | null, aiming: boolean, z: Zone) {
  const cx = z.x * W, cy = z.y * H, rw = (z.w / 2) * W, rh = (z.h / 2) * H;
  ctx.save();
  // cylinder body
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.roundRect(cx - rw * 0.32, cy - rh * 0.55, rw * 0.64, rh * 1.1, rw * 0.18);
  ctx.fill();
  ctx.fillStyle = "#0F6B3A";
  ctx.fillRect(cx - rw * 0.14, cy - rh * 0.75, rw * 0.28, rh * 0.28);
  ctx.fillStyle = "#D97706";
  ctx.fillRect(cx - rw * 0.03, cy - rh * 0.9, rw * 0.06, rh * 0.2);
  ctx.strokeStyle = "#FBBF24";
  ctx.lineWidth = Math.max(W, H) * 0.006;
  ctx.beginPath();
  ctx.arc(cx, cy - rh * 0.86, rw * 0.09, -Math.PI / 2, -Math.PI / 2 + (1 - fuel) * Math.PI * 2);
  ctx.stroke();

  ctx.globalCompositeOperation = "lighter";
  const dt = Math.min((t - lastT) * 1000, 50) / 1000 || 0.016;
  lastT = t;
  if (fuel > 0.03) {
    if (Math.random() < 0.8 * fuel) {
      PARTICLES.push({
        x: cx + (Math.random() - 0.5) * rw * 0.4,
        y: cy - rh * 0.9,
        vx: (Math.random() - 0.5) * W * 0.04,
        vy: -(H * 0.05) * (0.5 + Math.random()),
        born: t,
        life: 1.4 + Math.random(),
        size: (0.02 + Math.random() * 0.03) * Math.max(W, H),
        hue: "148,163,184",
      });
    }
  }
  let n = 0;
  for (const q of PARTICLES) {
    const age = t - q.born;
    if (age > q.life) continue;
    PARTICLES[n++] = q;
    const k = age / q.life;
    q.x += (q.vx + Math.sin(t * 2 + q.born) * W * 0.02) * dt;
    q.y += q.vy * dt;
    ctx.fillStyle = `rgba(${q.hue},${0.22 * (1 - k) * fuel})`;
    ctx.beginPath();
    ctx.arc(q.x, q.y, q.size * (1 + k * 2.4), 0, Math.PI * 2);
    ctx.fill();
  }
  PARTICLES.length = n;
  ctx.restore();
  if (aiming && p && inZone(p, z)) {
    ctx.save();
    ctx.strokeStyle = "rgba(129,199,246,0.7)";
    ctx.lineWidth = Math.max(W, H) * 0.012;
    ctx.lineCap = "round";
    const px = p.x * W, py = p.y * H;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(cx, cy - rh * 0.86);
    ctx.stroke();
    ctx.restore();
  }
}

function drawGear(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, fuel: number, _p: Pt | null, _aiming: boolean, z: Zone) {
  const cx = z.x * W, cy = z.y * H, r0 = (z.w / 4) * W, r1 = r0 * 1.35;
  ctx.save();
  ctx.translate(cx, cy);
  if (fuel > 0.02) ctx.rotate(t * 1.6);
  ctx.fillStyle = "#475569";
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.rect(Math.cos(a) * r0 - r0 * 0.18, Math.sin(a) * r0 - r0 * 0.18, r0 * 0.36, r0 * 0.36);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.arc(0, 0, r0 * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#D97706";
  ctx.font = `700 ${r0 * 0.55}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", 0, 0);
  ctx.restore();

  if (fuel < 0.99) {
    const slide = 1 - fuel;
    ctx.save();
    ctx.fillStyle = `rgba(226,232,240,${0.9})`;
    ctx.strokeStyle = "#0F6B3A";
    ctx.lineWidth = Math.max(W, H) * 0.004;
    ctx.beginPath();
    ctx.roundRect(cx - r1 - r0 * 0.6, cy - r1 - r0 * 0.6, (r1 * 2 + r0 * 1.2) * Math.min(1.5, 2 * slide), r1 * 2 + r0 * 1.2, r0 * 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawSparks(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, fuel: number, _p: Pt | null, _aiming: boolean, z: Zone) {
  const cx = z.x * W, cy = z.y * H, rw = z.w * W;
  ctx.save();
  const dt = Math.min((t - lastT) * 1000, 50) / 1000 || 0.016;
  lastT = t;
  const headR = rw * 0.1;
  if (Math.random() < 0.35 * fuel) {
    PARTICLES.push({
      x: cx + (Math.random() - 0.5) * rw * 0.7,
      y: cy + headR + Math.random() * H * 0.05,
      vx: (Math.random() - 0.5) * W * 0.08,
      vy: -(H * 0.1) * (0.6 + Math.random()),
      born: t,
      life: 0.9 + Math.random() * 0.5,
      size: (0.004 + Math.random() * 0.004) * Math.max(W, H),
      hue: "255,214,100",
    });
  }
  let n = 0;
  for (const q of PARTICLES) {
    const age = t - q.born;
    if (age > q.life) continue;
    PARTICLES[n++] = q;
    const k = age / q.life;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    ctx.fillStyle = `rgba(${q.hue},${(1 - k) * 0.95})`;
    ctx.beginPath();
    ctx.arc(q.x, q.y, q.size * (1 - k * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  PARTICLES.length = n;
  // head + helmet
  ctx.fillStyle = "#fcd34d";
  ctx.beginPath();
  ctx.arc(cx, cy + headR * 0.2, headR * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0F6B3A";
  ctx.beginPath();
  ctx.arc(cx, cy + headR * 0.2, headR * 1.05, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (fuel < 0.99) {
    const lvl = 1 - fuel;
    ctx.save();
    ctx.globalAlpha = lvl;
    ctx.fillStyle = "#D97706";
    ctx.beginPath();
    ctx.arc(cx, cy + headR * 0.2, headR * (1.05 - 0.35 * (1 - lvl)), Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#D97706";
    ctx.lineWidth = Math.max(W, H) * 0.004;
    ctx.beginPath();
    ctx.moveTo(cx - headR, cy + headR * 0.2);
    ctx.lineTo(cx + headR, cy + headR * 0.2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPulse(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, fuel: number, _p: Pt | null, _aiming: boolean, z: Zone) {
  const cx = z.x * W, cy = z.y * H, rw = z.w * W;
  ctx.save();
  const R = rw * 0.16;
  const beat = fuel > 0.02 ? 1 + 0.06 * Math.sin(t * 6) : 1;
  ctx.fillStyle = `rgba(248,113,113,${0.25 * beat})`;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.4 * beat, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = Math.max(W, H) * 0.006;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  // ECG trace
  ctx.strokeStyle = "rgba(239,68,68,0.9)";
  ctx.lineWidth = Math.max(W, H) * 0.004;
  ctx.beginPath();
  const w2 = rw * 0.5, h2 = R * 1.6;
  ctx.moveTo(cx - w2, cy);
  ctx.lineTo(cx - w2 * 0.4, cy);
  ctx.lineTo(cx - w2 * 0.25, cy - h2 * 0.45);
  ctx.lineTo(cx - w2 * 0.08, cy);
  ctx.lineTo(cx + w2 * 0.05, cy + h2 * 0.8);
  ctx.lineTo(cx + w2 * 0.2, cy - h2 * 0.9);
  ctx.lineTo(cx + w2 * 0.35, cy);
  ctx.lineTo(cx + w2, cy);
  ctx.stroke();
  ctx.restore();
  if (fuel < 0.99) {
    ctx.save();
    ctx.globalAlpha = 1 - fuel;
    ctx.fillStyle = "#16a34a";
    ctx.font = `700 ${Math.max(W, H) * 0.024}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("✓ responding", cx, cy - R * 2.2);
    ctx.restore();
  }
}

const DRAW: Record<SimDef["hazard"], typeof drawFire> = {
  fire: drawFire,
  gas: drawGas,
  gear: drawGear,
  sparks: drawSparks,
  pulse: drawPulse,
};

// (2D step scenes retired — Stage3D renders every step in three.js.)

// Plays one time-section of a video file (no cutting needed — the range is
// enforced in code so it loops exactly from `from` to `to` seconds).
function StepVideo({ src, from, to }: { src: string; from: number; to: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const jump = () => {
      try {
        if (v.currentTime < from || v.currentTime >= to) v.currentTime = from;
      } catch {
        /* metadata not ready yet */
      }
      void v.play().catch(() => undefined);
    };
    jump();
    v.addEventListener("loadedmetadata", jump);
    v.addEventListener("timeupdate", jump);
    return () => {
      v.removeEventListener("loadedmetadata", jump);
      v.removeEventListener("timeupdate", jump);
    };
  }, [src, from, to]);
  return (
    <video
      ref={ref}
      src={`${src}#t=${from},${to}`}
      className="w-full max-h-52 rounded-lg bg-black aspect-video object-contain"
      controls
      autoPlay
      muted
      loop
      playsInline
    />
  );
}

export default function CameraSimulation({
  moduleId,
  title,
  lang,
  onComplete,
  onClose,
}: {
  moduleId: string;
  title: string;
  lang: string;
  onComplete: () => void;
  onClose?: () => void;
}) {
  const def = SIMS[moduleId] ?? SIMS.fire_explosion;
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fuelRef = useRef(1);
  const rafRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(0);
  const [noCam, setNoCam] = useState(false);
  const [doneSteps, setDoneSteps] = useState<boolean[]>(() => def.steps.map(() => false));
  const doneCount = doneSteps.filter(Boolean).length;
  const allDone = doneCount >= def.steps.length;
  const [voiceOn, setVoiceOn] = useState(voiceEnabled());
  const advanceTimer = useRef(0);

  function goStep(n: number) {
    stopVoice();
    window.clearTimeout(advanceTimer.current);
    setStep(n);
  }

  function goNext() {
    const n = def.steps.length;
    for (let k = 1; k <= n; k++) {
      const i = (step + k) % n;
      if (!doneSteps[i]) {
        goStep(i);
        return;
      }
    }
    goStep((step + 1) % n);
  }

  function finishSim() {
    stopVoice();
    window.clearTimeout(advanceTimer.current);
    setPhase("done");
    if (voiceEnabled()) speak(tr(def.ok, lang), lang);
  }

  function handleStepDone() {
    const next = doneSteps.map((d, i) => (i === step ? true : d));
    setDoneSteps(next);
    try {
      navigator.vibrate?.(40);
    } catch {
      /* haptics unavailable */
    }
    if (voiceEnabled()) speak(praise(lang), lang);
    if (next.every(Boolean)) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => {
        if (stageRef.current) finishSim();
      }, 1200);
    }
  }

  function toggleVoice() {
    const v = !voiceOn;
    setVoice(v);
    setVoiceOn(v);
    if (!v) stopVoice();
    else speak(tr(def.steps[step] ?? def.intro, lang), lang);
  }

  useEffect(() => {
    if (phase === "explain" && voiceOn) speak(tr(def.steps[step], lang), lang);
  }, [phase, step, voiceOn, def, lang]);

  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  useEffect(() => {
    const stage = stageRef.current, video = videoRef.current;
    if (!stage || !video) return;
    let stream: MediaStream | null = null;
    const c = canvasRef.current;
    const resize = () => {
      if (!c || !stage) return;
      c.width = stage.clientWidth;
      c.height = stage.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } } })
      .then((s) => {
        stream = s;
        video.srcObject = s;
        void video.play().catch(() => undefined);
      })
      .catch(() => setNoCam(true));

    const loop = (tms: number) => {
      const t = tms / 1000;
      const ctx = c?.getContext("2d");
      if (ctx && c) {
        ctx.clearRect(0, 0, c.width, c.height);
        DRAW[def.hazard](ctx, c.width, c.height, t, fuelRef.current, null, false, def.zone);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [def.hazard]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" role="dialog" aria-label="Camera simulation">
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/80 text-white backdrop-blur">
        <div className="text-left">
          <div className="text-xs font-semibold text-hazard-300 uppercase tracking-wide">
            {phase === "done" ? sx("taskDone", lang) : sx("liveSim", lang)}
          </div>
          <div className="text-sm">{title}</div>
        </div>
        <div className="flex items-center gap-2">
          <LangSwitch dark value={lang} onChange={(l) => setLanguage(l)} />
          <button
            onClick={toggleVoice}
            className={`w-8 h-8 rounded-full border text-sm ${
              voiceOn ? "border-hazard-400 bg-hazard-400/20" : "border-white/30 hover:bg-white/10"
            }`}
            aria-label="Voice assistant on/off"
            title="Voice assistant"
          >
            {voiceOn ? "🔊" : "🔇"}
          </button>
          <button
            onClick={() => {
              stopVoice();
              (onClose ?? onComplete)();
            }}
            className="w-8 h-8 rounded-full border border-white/30 hover:bg-white/10 text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative flex-1 overflow-hidden select-none"
      >
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />
        {noCam && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900" />
        )}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {phase === "intro" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 p-6">
            <div className="anim-sim-pop max-w-md w-full bg-white/95 rounded-2xl p-6 text-center space-y-3">
              <div className="text-4xl anim-glow inline-flex rounded-2xl bg-brand-50 px-4 py-2">
                {def.hazard === "fire" ? "🔥" : def.hazard === "gas" ? "💨" : def.hazard === "gear" ? "⚙️" : def.hazard === "sparks" ? "⛑️" : "🚑"}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{tr(def.intro, lang)}</p>
              <p className="text-xs text-slate-500">
                {noCam ? sx("noCam", lang) : sx("camHint", lang)}
              </p>
              <button
                onClick={() => setPhase("explain")}
                className="w-full bg-hazard-500 text-white rounded-lg py-3 font-semibold hover:bg-hazard-600 btn-push"
              >
                {sx("startSimBtn", lang)}
              </button>
            </div>
          </div>
        )}

        {phase === "explain" && (
          <div className="absolute inset-0 bg-black/55 flex flex-col">
            <div className="flex-1 flex items-start justify-center p-4 overflow-y-auto">
              <div className="w-full max-w-lg">
                <div className="flex items-center justify-between mb-3 text-white/80 text-xs font-semibold">
                  <span>{sx("seeMethod", lang)}</span>
                  <span>
                    {fmt("stepOfN", lang, { i: step + 1, n: def.steps.length })}
                  </span>
                </div>
                <div className="h-1.5 bg-white/15 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-hazard-400 rounded-full transition-all duration-300"
                    style={{ width: `${((step + 1) / def.steps.length) * 100}%` }}
                  />
                </div>
                <p className="text-center text-[11px] font-semibold text-white/80 mb-4">
                  {fmt("stepsProgress", lang, { d: doneCount, t: def.steps.length })}
                </p>
                <div key={step} className="anim-sim-up bg-white/95 rounded-2xl p-4 shadow-xl">
                  {def.stepVideos?.[step] && (
                    <div className="mb-3">
                      <StepVideo
                        src={def.stepVideos[step].src}
                        from={def.stepVideos[step].from}
                        to={def.stepVideos[step].to}
                      />
                    </div>
                  )}
                  <StepStage
                    key={step}
                    hazard={def.hazard}
                    index={step}
                    lang={lang}
                    onDone={handleStepDone}
                  />
                  <div className="flex items-start gap-3 mt-3 px-1">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-brand text-white font-bold grid place-items-center">
                      {step + 1}
                    </span>
                    <p className="text-base font-medium text-slate-800 leading-relaxed pt-0.5">
                      {tr(def.steps[step], lang)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 bg-gradient-to-t from-black/85 via-black/50 to-transparent">
              <div className="w-full max-w-lg mx-auto flex items-center gap-3">
                <button
                  onClick={() => goStep((step - 1 + def.steps.length) % def.steps.length)}
                  className="w-11 h-11 shrink-0 rounded-full border border-white/40 text-white text-lg hover:bg-white/10 transition-opacity"
                  aria-label="Previous step"
                >
                  ←
                </button>
                <p className="flex-1 text-xs text-white/75 text-center leading-snug">
                  {allDone
                    ? sx("allDoneFin", lang)
                    : doneSteps[step]
                      ? `${fmt("stepOfN", lang, { i: step + 1, n: def.steps.length })} ✓`
                      : `${sx("doingStep", lang)} ${step + 1}`}
                </p>
                {allDone ? (
                  <button
                    onClick={finishSim}
                    className="anim-shine relative shrink-0 rounded-full px-5 sm:px-7 py-3 font-bold text-sm transition-all bg-hazard-500 text-white hover:bg-hazard-600 active:scale-95 anim-glow"
                  >
                    {sx("finish", lang)}
                  </button>
                ) : (
                  <button
                    onClick={goNext}
                    className="anim-shine relative shrink-0 rounded-full px-7 py-3 font-bold text-sm transition-all bg-hazard-500 text-white hover:bg-hazard-600 btn-push"
                  >
                    {sx("next", lang)}
                    <span className="anim-bob inline-block"> →</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-6">
            <div className="anim-sim-pop max-w-sm w-full bg-white/95 rounded-2xl p-6 text-center space-y-3">
              <div className="text-5xl">✅</div>
              <div className="text-lg font-bold text-brand-900">{tr(def.ok, lang)}</div>
              <p className="text-sm text-slate-600">{sx("evSaved", lang)}</p>
              <button
                onClick={() => {
                  stopVoice();
                  onComplete();
                }}
                className="w-full bg-hazard-500 text-white rounded-lg py-3 font-semibold hover:bg-hazard-600 btn-push"
              >
                {sx("continue", lang)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}