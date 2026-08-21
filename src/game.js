// Shared helpers for the study campaign.

export function answerText(q) {
  return q.type === "multiple_choice" ? q.options[q.answer] : String(q.answer);
}

export function loadSave() {
  try { return JSON.parse(localStorage.getItem("tb-save")) || {}; } catch { return {}; }
}
export const SAVE = loadSave();

export const QUEST_GOAL = 2;
export const QUEST_XP = 20;

export function localDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let MASTER_VOL = 0.7;
let musicCtx = null;
let musicTimer = null;
let musicGainNode = null;
let musicStep = 0;

export const MUSIC_THEMES = {
  // fast, driving ninja theme
  ninja: {
    bpm: 168,
    type: "square",
    bass: [110, 110, 130.81, 110, 146.83, 110, 130.81, 98],
    lead: [440, 523.25, 587.33, 523.25, 659.25, 587.33, 523.25, 440],
  },
  // slow, ominous mythic-god theme
  boss: {
    bpm: 92,
    type: "sawtooth",
    bass: [55, 55, 65.41, 49],
    lead: [220, 261.63, 311.13, 261.63, 246.94, 220, 196, 220],
  },
};

export function setMasterVolume(v) {
  MASTER_VOL = v;
  if (musicGainNode) musicGainNode.gain.value = 0.11 * v;
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (musicCtx) { try { musicCtx.close(); } catch { /* already closed */ } }
  musicCtx = null;
  musicGainNode = null;
}

export function startMusic(theme, tempo = 1) {
  stopMusic();
  try {
    const t = MUSIC_THEMES[theme];
    if (!t) return;
    musicCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicGainNode = musicCtx.createGain();
    musicGainNode.gain.value = 0.11 * MASTER_VOL;
    musicGainNode.connect(musicCtx.destination);
    const stepMs = 60000 / (t.bpm * tempo) / 2; // 8th notes
    musicStep = 0;
    musicTimer = setInterval(() => {
      if (!musicCtx) return;
      const ctx = musicCtx;
      const now = ctx.currentTime;
      const dur = stepMs / 1000;
      const b = ctx.createOscillator();
      const bg = ctx.createGain();
      b.type = t.type;
      b.frequency.value = t.bass[musicStep % t.bass.length];
      bg.gain.setValueAtTime(0.5, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);
      b.connect(bg); bg.connect(musicGainNode);
      b.start(now); b.stop(now + dur);
      if (musicStep % 2 === 0) {
        const l = ctx.createOscillator();
        const lg = ctx.createGain();
        l.type = "triangle";
        l.frequency.value = t.lead[(musicStep / 2) % t.lead.length];
        lg.gain.setValueAtTime(0.22, now);
        lg.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.7);
        l.connect(lg); lg.connect(musicGainNode);
        l.start(now); l.stop(now + dur * 1.8);
      }
      musicStep++;
    }, stepMs);
  } catch { /* audio unavailable */ }
}

export function sfx(name) {
  if (MASTER_VOL <= 0) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, t, dur, type = "square", vol0 = 0.12) => {
      const vol = vol0 * MASTER_VOL * 1.4;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + dur);
    };
    if (name === "hit") { play(440, 0, 0.09); play(660, 0.09, 0.12); }
    if (name === "hurt") { play(200, 0, 0.18, "sawtooth"); play(140, 0.15, 0.25, "sawtooth"); }
    if (name === "win") { play(523, 0, 0.12); play(659, 0.12, 0.12); play(784, 0.24, 0.12); play(1047, 0.36, 0.3); }
    if (name === "lose") { play(392, 0, 0.2); play(330, 0.2, 0.2); play(262, 0.4, 0.35, "triangle"); }
    if (name === "tick") { play(880, 0, 0.05, "sine", 0.06); }
  } catch {}
}


export const NUM_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

export function normAns(s) {
  let t = String(s).toLowerCase().trim()
    .replace(/-/g, " ")
    .replace(/[.,!?;:'"()[\]]/g, "")
    .replace(/\s+/g, " ");
  t = t.replace(/^(the|a|an) /, "");
  // convert number words: "twenty one" -> 21, "eight" -> 8
  const words = t.split(" ");
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = NUM_WORDS[words[i]];
    const next = NUM_WORDS[words[i + 1]];
    if (w !== undefined && w >= 20 && w % 10 === 0 && next !== undefined && next < 10) {
      out.push(String(w + next));
      i++;
    } else if (w !== undefined) {
      out.push(String(w));
    } else {
      out.push(words[i]);
    }
  }
  return out.join(" ");
}

export function shuffleOptions(q) {
  if (q.type !== "multiple_choice") return q;
  const idx = shuffle(q.options.map((_, i) => i));
  return { ...q, options: idx.map((i) => q.options[i]), answer: idx.indexOf(q.answer) };
}

export function letterHint(ans) {
  const s = String(ans);
  return [...s]
    .map((ch, i) => {
      if (ch === " ") return " ";
      if (/[0-9]/.test(ch)) return "_";
      return i === 0 || i % 3 === 0 ? ch : "_";
    })
    .join(" ");
}

export function isRightAnswer(q, typed) {
  const t = normAns(typed);
  const cands = [q.answer, ...(q.accept || [])].map(normAns);
  if (cands.includes(t)) return true;
  // numeric fallback: "x = 4", "= 4", "the answer is 4" all match "4"
  if (/\d/.test(String(q.answer))) {
    const ansNum = parseFloat(String(q.answer).replace(/[^\d.eE-]/g, ""));
    const nums = t.match(/-?\d+(\.\d+)?/g);
    if (!Number.isNaN(ansNum) && nums && parseFloat(nums[nums.length - 1]) === ansNum) return true;
  }
  return false;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
