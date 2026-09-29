// Offline-first voice assistant: uses the device's built-in speech synthesis
// (no network needed when a local voice is installed).
//
// Santali fix: no OS ships an Ol Chiki voice, and handing Ol Chiki script to a
// Hindi/English voice produces garbage or silence. So Santali text is
// transliterated to Devanagari first (olchikiToDevanagari) and spoken with a
// Hindi voice — phonetically close enough for workers to follow.
const KEY = "suraksha_voice";

export function voiceEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setVoice(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable */
  }
}

function synth(): SpeechSynthesis | null {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      return window.speechSynthesis;
    }
  } catch {
    /* no speech */
  }
  return null;
}

let primed = false;
function primeVoices() {
  if (primed) return;
  primed = true;
  const s = synth();
  if (!s) return;
  try {
    s.getVoices();
    s.onvoiceschanged = () => {
      try {
        s.getVoices();
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* ignore */
  }
}

// One locked voice per language group, chosen once and reused forever —
// this is what stops the male/female switching between steps.
const voiceCache: Record<string, SpeechSynthesisVoice | null | undefined> = {};

function resolveVoice(lang: string): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  let vs: SpeechSynthesisVoice[] = [];
  try {
    vs = s.getVoices();
  } catch {
    return null;
  }
  if (vs.length === 0) return null;
  const want = lang === "hi" || lang === "sat" ? "hi" : "en";
  const lower = vs.map((v) => ({ v, l: (v.lang || "").toLowerCase() }));
  return (
    lower.find((x) => x.l.startsWith(want + "-in"))?.v ??
    lower.find((x) => x.l.startsWith(want))?.v ??
    lower.find((x) => x.l.startsWith("en"))?.v ??
    vs[0] ??
    null
  );
}

function getVoice(lang: string): SpeechSynthesisVoice | null {
  const group = lang === "hi" || lang === "sat" ? "hi" : "en";
  if (!(group in voiceCache) || voiceCache[group] == null) {
    const v = resolveVoice(lang);
    if (v) voiceCache[group] = v; // stick with the first real pick forever
  }
  return voiceCache[group] ?? null;
}

function langCode(lang: string): string {
  if (lang === "hi" || lang === "sat") return "hi-IN";
  return "en-IN";
}

export function speak(text: string, lang: string) {
  const s = synth();
  if (!s || !voiceEnabled()) return;
  primeVoices();
  const say = lang === "sat" ? olchikiToDevanagari(text) : text;
  const attempt = () => {
    try {
      s.cancel();
      if (s.paused) {
        try {
          s.resume();
        } catch {
          /* ignore */
        }
      }
      const u = new SpeechSynthesisUtterance(say);
      const v = getVoice(lang);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else {
        u.lang = langCode(lang);
      }
      u.rate = 0.95;
      u.pitch = 1;
      s.speak(u);
    } catch {
      /* speech unavailable */
    }
  };
  // wait briefly for the voice list so even the first utterance uses the
  // locked voice instead of a random default
  let ready = false;
  try {
    ready = s.getVoices().length > 0;
  } catch {
    ready = true;
  }
  if (ready || typeof window === "undefined") {
    attempt();
    return;
  }
  let waited = 0;
  const timer = window.setInterval(() => {
    waited += 100;
    let n = 0;
    try {
      n = s.getVoices().length;
    } catch {
      /* ignore */
    }
    if (n > 0 || waited >= 1200) {
      window.clearInterval(timer);
      attempt();
    }
  }, 100);
}

export function stopVoice() {
  try {
    synth()?.cancel();
  } catch {
    /* speech unavailable */
  }
}

export function praise(lang: string): string {
  if (lang === "hi" || lang === "sat") return "शाबाश! आगे बढ़ें।";
  return "Well done! Moving on.";
}

// ---------- Ol Chiki (U+1C50–U+1C7F) → Devanagari, for TTS ----------
// Keyed by codepoint number so source text can never be mangled in transit.
const OLC_DIGIT_0 = 0x1c50;
const OLC_INDEP: Record<number, string> = {
  0x1c5a: "ओ",
  0x1c5f: "अ",
  0x1c64: "इ",
  0x1c69: "उ",
  0x1c6e: "ए",
};
const OLC_MATRA: Record<number, string> = {
  0x1c5a: "ो",
  0x1c5f: "ा",
  0x1c64: "ि",
  0x1c69: "ु",
  0x1c6e: "े",
};
const OLC_CONS: Record<number, string> = {
  0x1c5b: "त",
  0x1c5c: "ग",
  0x1c5d: "ङ",
  0x1c5e: "ल",
  0x1c60: "क",
  0x1c61: "ज",
  0x1c62: "म",
  0x1c63: "व",
  0x1c67: "न",
  0x1c68: "र",
  0x1c6a: "च",
  0x1c6b: "द",
  0x1c6c: "ण",
  0x1c6d: "य",
  0x1c6f: "प",
  0x1c70: "ड",
  0x1c71: "न",
  0x1c72: "ड़",
  0x1c74: "ट",
  0x1c75: "ब",
  0x1c76: "व",
  0x1c65: "स",
  0x1c66: "ह",
};
const OLC_ASP: Record<string, string> = {
  क: "ख",
  ग: "घ",
  च: "छ",
  ज: "झ",
  ट: "ठ",
  ड: "ढ",
  त: "थ",
  द: "ध",
  प: "फ",
  ब: "भ",
};
const OLC_AA = 0x1c79; // ạ-length mark (ᱟᱹ → आ/ा)
const OLC_ASP_MARK = 0x1c77; // aspiration mark (ᱠᱷ → ख)
const OLC_NASALS = new Set([0x1c78, 0x1c7a]); // ᱸ/ᱺ → ं
const OLC_SEP = 0x1c7c; // word-internal separator → drop
const OLC_CHECKED = 0x1c7d; // checked consonant → halant
const OLC_A = 0x1c5f;
// consonants after which a bare C forms a conjunct (r/y/w glides)
const OLC_GLIDES = new Set([0x1c68, 0x1c6d, 0x1c63, 0x1c76]);
const OLC_FLUSH_PUNCT = new Set([".", ",", ";", ":", "!", "?", "।", "—", "-", "–", "(", ")", "\"", "'"]);

function isDigit(cp: number) {
  return cp >= 0x1c50 && cp <= 0x1c59;
}
function isVowelLetter(cp: number) {
  return cp in OLC_INDEP;
}
function isCons(cp: number) {
  return cp in OLC_CONS;
}

export function olchikiToDevanagari(input: string): string {
  // transliterate per whitespace-delimited token so word-final inherent
  // vowels are stripped correctly (ᱟᱢ → अम्, not अम).
  return input
    .split(/(\s+)/g)
    .map((tok) => (/^\s+$/.test(tok) ? tok : transToken(tok)))
    .join("");
}

function transToken(tok: string): string {
  const cps = Array.from(tok);
  const at = (k: number): number => (k < cps.length ? cps[k].codePointAt(0) ?? -1 : -1);
  let out = "";
  let bare: string | null = null; // last emitted bare consonant (inherent अ pending)
  const flush = () => {
    if (bare != null) {
      out += "्";
      bare = null;
    }
  };
  let i = 0;
  while (i < cps.length) {
    const c = at(i);
    if (isDigit(c)) {
      flush();
      out += String.fromCharCode(0x0966 + (c - OLC_DIGIT_0));
      i++;
      continue;
    }
    if (isVowelLetter(c)) {
      let j = i + 1;
      let longA = false;
      if (c === OLC_A && at(j) === OLC_AA) {
        longA = true;
        j++;
      }
      if (bare != null) {
        out += c === OLC_A ? "ा" : OLC_MATRA[c];
        bare = null;
      } else {
        out += c === OLC_A && longA ? "आ" : OLC_INDEP[c];
      }
      while (OLC_NASALS.has(at(j))) {
        out += "ं";
        j++;
      }
      i = j;
      continue;
    }
    if (isCons(c)) {
      flush(); // a previous bare C gets its halant (conjunct or cluster)
      let base = OLC_CONS[c];
      let j = i + 1;
      if (at(j) === OLC_ASP_MARK) {
        base = OLC_ASP[base] ?? base + "ह";
        j++;
      }
      const v = at(j);
      if (OLC_GLIDES.has(v)) {
        out += base + "्"; // conjunct with r/y/w glide (ᱴᱨ → ट्र)
        i = j;
        continue;
      }
      out += base;
      bare = base;
      i = j;
      continue;
    }
    if (c === OLC_CHECKED) {
      out += "्";
      bare = null;
      i++;
      continue;
    }
    if (c === OLC_SEP || c === OLC_AA) {
      i++; // drop separator / stray length mark (bare state kept for ᱼᱟ fusion)
      continue;
    }
    if (OLC_NASALS.has(c)) {
      out += "ं";
      bare = null;
      i++;
      continue;
    }
    if (OLC_FLUSH_PUNCT.has(cps[i])) {
      flush();
      out += cps[i];
      i++;
      continue;
    }
    out += cps[i]; // emoji, latin, devanagari… pass through
    bare = null;
    i++;
  }
  flush(); // strip word-final inherent vowel
  return out;
}
