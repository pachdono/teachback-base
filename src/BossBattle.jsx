import { useState, useEffect, useRef } from "react";
import { PixelSprite, CHAR_ATK } from "./sprites";
import { sfx, startMusic, stopMusic, shuffle, shuffleOptions, isRightAnswer, letterHint } from "./game";
import { VictoryFX } from "./Battle";
import { API } from "./config";

const BOSS_ATTACKS = {
  meteor: { id: "meteor", name: "METEOR RAIN" },
  beam: { id: "beam", name: "VOID BEAM" },
  slam: { id: "slam", name: "SHADOW SLAM" },
  nova: { id: "nova", name: "VOID NOVA" },
};
const BOSS_PHASE_POOL = {
  1: ["meteor", "beam"],
  2: ["meteor", "beam", "slam"],
  3: ["beam", "slam", "nova"],
};
const BOSS_MAX = 150;

function CutScene({ name, subtitle, sprite, accent, lines, onDone }) {
  const [step, setStep] = useState(0);
  const total = lines.length + 1; // lines, then FIGHT flash

  useEffect(() => {
    if (step > total) return;
    const t = setTimeout(() => {
      if (step === total) onDone();
      else setStep((s) => s + 1);
    }, step === 0 ? 900 : step === total ? 900 : 1300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="battle cutscene" style={{ "--cut": accent }}>
      <button className="btn ghost sm cut-skip" onClick={onDone}>Skip ▸</button>
      <div className="cut-sprite">{sprite}</div>
      <div className="cut-name">{name}</div>
      <div className="cut-sub">{subtitle}</div>
      <div className="cut-lines">
        {lines.slice(0, step).map((l, i) => (
          <p className="cut-line" key={i}>{l}</p>
        ))}
      </div>
      {step >= total && <div className="fight-flash" aria-hidden="true">FIGHT!</div>}
    </div>
  );
}

function genVoidZones(phase) {
  const gap = 26 - phase * 4; // safe gap shrinks each phase: 22 / 18 / 14
  const band = 32 + phase * 4; // cross band widens each phase
  const rand = (a, b) => a + Math.random() * (b - a);
  let types;
  if (phase >= 3) types = ["columns", "rows", "quadrants", "cross", "pocket"];
  else if (phase === 2) types = ["columns", "rows", "quadrants", "cross"];
  else types = ["columns", "rows", "quadrants"];
  const type = types[Math.floor(Math.random() * types.length)];

  if (type === "columns") {
    const sx = rand(8, 92 - gap);
    return [{ x0: 0, x1: sx, y0: 0, y1: 100 }, { x0: sx + gap, x1: 100, y0: 0, y1: 100 }];
  }
  if (type === "rows") {
    const sy = rand(8, 92 - gap);
    return [{ x0: 0, x1: 100, y0: 0, y1: sy }, { x0: 0, x1: 100, y0: sy + gap, y1: 100 }];
  }
  if (type === "quadrants") {
    const sl = Math.random() < 0.5, st = Math.random() < 0.5;
    return [
      { x0: sl ? 50 : 0, x1: sl ? 100 : 50, y0: 0, y1: 100 },
      { x0: sl ? 0 : 50, x1: sl ? 50 : 100, y0: st ? 50 : 0, y1: st ? 100 : 50 },
    ];
  }
  if (type === "cross") {
    return [
      { x0: 50 - band / 2, x1: 50 + band / 2, y0: 0, y1: 100 },
      { x0: 0, x1: 100, y0: 50 - band / 2, y1: 50 + band / 2 },
    ];
  }
  // pocket: only a small square is safe
  const ps = gap;
  const px = rand(6, 94 - ps), py = rand(8, 92 - ps);
  return [
    { x0: 0, x1: 100, y0: 0, y1: py },
    { x0: 0, x1: 100, y0: py + ps, y1: 100 },
    { x0: 0, x1: px, y0: py, y1: py + ps },
    { x0: px + ps, x1: 100, y0: py, y1: py + ps },
  ];
}

function VoidGauntlet({ phase = 1, character, onResolve }) {
  const waveCount = phase + 1; // 2 / 3 / 4 waves
  const telegraphMs = 860 - phase * 150; // 710 / 560 / 410
  const strikeMs = 240;
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const posRef = useRef({ x: 50, y: 50 });
  const [wave, setWave] = useState(0);
  const [zones, setZones] = useState([]);
  const [striking, setStriking] = useState(false);
  const doneRef = useRef(false);

  const move = (dx, dy) => setPos((p) => {
    const np = { x: Math.max(4, Math.min(96, p.x + dx)), y: Math.max(6, Math.min(94, p.y + dy)) };
    posRef.current = np;
    return np;
  });

  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") { e.preventDefault(); move(-9, 0); }
      else if (k === "arrowright" || k === "d") { e.preventDefault(); move(9, 0); }
      else if (k === "arrowup" || k === "w") { e.preventDefault(); move(0, -12); }
      else if (k === "arrowdown" || k === "s") { e.preventDefault(); move(0, 12); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const timers = [];
    let idx = 0;
    const runWave = () => {
      if (doneRef.current) return;
      idx += 1;
      setWave(idx);
      setStriking(false);
      const z = genVoidZones(phase);
      setZones(z);
      timers.push(setTimeout(() => {
        setStriking(true);
        const p = posRef.current;
        const hit = z.some((r) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1);
        if (hit) {
          doneRef.current = true;
          timers.push(setTimeout(() => onResolve(true), 260));
          return;
        }
        timers.push(setTimeout(() => {
          if (idx >= waveCount) { doneRef.current = true; onResolve(false); }
          else runWave();
        }, strikeMs));
      }, telegraphMs));
    };
    runWave();
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="gauntlet">
      <div className="gauntlet-label">VOID GAUNTLET, reach the dark! <span className="dodge-keys">WASD / arrows</span>
        <span className="wave-dots">{Array.from({ length: waveCount }, (_, i) => (
          <span key={i} className={`wave-dot ${i < wave ? "on" : ""}`} />
        ))}</span>
      </div>
      <div className="gauntlet-arena">
        {zones.map((z, i) => (
          <div
            key={`${wave}-${i}`}
            className={`g-zone ${striking ? "strike" : ""}`}
            style={{ left: `${z.x0}%`, top: `${z.y0}%`, width: `${z.x1 - z.x0}%`, height: `${z.y1 - z.y0}%` }}
          />
        ))}
        <div className="g-player" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
          <PixelSprite id={character} size={26} />
        </div>
      </div>
      <div className="dpad">
        <button type="button" className="btn ghost sm" onClick={() => move(0, -12)} aria-label="Up">▲</button>
        <div>
          <button type="button" className="btn ghost sm" onClick={() => move(-9, 0)} aria-label="Left">◀</button>
          <button type="button" className="btn ghost sm" onClick={() => move(9, 0)} aria-label="Right">▶</button>
        </div>
        <button type="button" className="btn ghost sm" onClick={() => move(0, 12)} aria-label="Down">▼</button>
      </div>
    </div>
  );
}

function BossBattle({ topics, character, questions, onStat, onDone, onExit }) {
  const [phase, setPhase] = useState("cutscene"); // cutscene | teach | armed | brawl | end
  const [explanation, setExplanation] = useState("");
  const [grade, setGrade] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // brawl state
  const [bossHP, setBossHP] = useState(BOSS_MAX);
  const [hearts, setHearts] = useState(5);
  const [mode, setMode] = useState("action"); // action | question | resolve
  const [charge, setCharge] = useState(0);
  const [nextAtk, setNextAtk] = useState(BOSS_ATTACKS.meteor);
  const [shownPhase, setShownPhase] = useState(1);
  const [pool] = useState(() => shuffle((questions || []).map(shuffleOptions)));
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState("");
  const [shotKey, setShotKey] = useState(0);
  const [flinchKey, setFlinchKey] = useState(0);
  const [bossAtk, setBossAtk] = useState(null); // {type, key}, landed attack
  const [dodgedKey, setDodgedKey] = useState(0);
  const [combo, setCombo] = useState(0);
  const [barrage, setBarrage] = useState(null); // {key, hits, combo, dmg}
  const [won, setWon] = useState(false);

  const mult = 1 + (grade?.score || 0) / 100;
  const q = pool.length ? pool[qi % pool.length] : null;
  const bossPhase = bossHP > (BOSS_MAX * 2) / 3 ? 1 : bossHP > BOSS_MAX / 3 ? 2 : 3;

  // phase transitions: banner + roar
  useEffect(() => {
    if (phase === "brawl" && bossPhase > shownPhase) {
      setShownPhase(bossPhase);
      sfx("lose");
    }
  }, [bossPhase, phase, shownPhase]);

  // battle music: mythic boss theme, faster each phase
  useEffect(() => {
    if (phase === "cutscene") { startMusic("boss", 0.85); return stopMusic; }
    if (phase === "brawl") { startMusic("boss", 1 + (bossPhase - 1) * 0.18); return stopMusic; }
    return undefined;
  }, [phase, bossPhase]);

  // pick the next attack from the current phase's pool
  useEffect(() => {
    if (phase !== "brawl" || mode !== "action") return;
    const poolIds = BOSS_PHASE_POOL[bossPhase];
    setNextAtk(BOSS_ATTACKS[poolIds[Math.floor(Math.random() * poolIds.length)]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode]);

  // action loop: boss charges (faster each phase), your ship auto-fires
  useEffect(() => {
    if (phase !== "brawl" || mode !== "action") return;
    const chargeMs = 3400 - (bossPhase - 1) * 700;
    const started = Date.now();
    const iv = setInterval(() => setCharge(Math.min(100, ((Date.now() - started) / chargeMs) * 100)), 100);
    const fire = setInterval(() => {
      setShotKey((k) => k + 1);
      setBossHP((hp) => Math.max(0, hp - 1)); // light suppressing fire; your answers do the real damage
      sfx("tick");
    }, 1100);
    return () => { clearInterval(iv); clearInterval(fire); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode]);

  useEffect(() => {
    if (phase === "brawl" && mode === "action" && charge >= 100) setMode("question");
  }, [charge, phase, mode]);

  useEffect(() => {
    if (phase !== "brawl") return;
    if (bossHP <= 0) { setWon(true); setPhase("end"); sfx("win"); }
    else if (hearts <= 0) { setWon(false); setPhase("end"); sfx("lose"); }
  }, [bossHP, hearts, phase]);

  function beginAction() {
    setCharge(0);
    setPicked(null);
    setTyped("");
    setMode("action");
  }

  function answerQ(ok) {
    if (mode !== "question") return;
    onStat(q, ok);
    setQi((i) => i + 1);
    if (ok) {
      // build a combo, then unleash a barrage with your character's weapon
      const nc = combo + 1;
      const comboMult = 1 + Math.min(nc - 1, 3) * 0.25; // 1 / 1.25 / 1.5 / 1.75
      const dmg = Math.round(20 * mult * comboMult);
      const hits = 2 + Math.min(nc, 3);
      setCombo(nc);
      setMode("resolve");
      sfx("win");
      setBossAtk(null);
      setFlinchKey((k) => k + 1);
      setBossHP((hp) => Math.max(0, hp - dmg));
      setBarrage({ key: Date.now(), hits, combo: nc, dmg });
      setTimeout(beginAction, 1000);
    } else {
      // wrong answer: combo breaks, the Void Gauntlet opens, survive it!
      sfx("hurt");
      setCombo(0);
      setBarrage(null);
      setMode("dodge");
    }
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topics, explanation }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      sfx(data.score >= 70 ? "win" : "hit");
      setGrade(data);
      setPhase("armed");
    } catch (err) {
      setError("The boss resisted: " + err.message);
    }
    setLoading(false);
  }

  if (phase === "cutscene")
    return (
      <CutScene
        name="The Void Lord"
        subtitle="Final boss of this mission"
        accent="#a78bfa"
        sprite={<div className="cut-boss-pixel"><PixelSprite id="voidlord" size={128} /></div>}
        lines={[
          "So you think you've learned something.",
          "Teach me, little scholar. Convince me.",
          "Then survive my lessons.",
        ]}
        onDone={() => setPhase("teach")}
      />
    );

  if (phase === "teach")
    return (
      <div className="battle">
        <div className="arena">
          <div className="fighter">
            <div className="sprite-wrap"><PixelSprite id={character} size={80} /></div>
            <div className="fighter-shadow" />
          </div>
          <div className="vs-badge" aria-hidden="true">VS</div>
          <div className="fighter">
            <div className="boss-pixel-sm"><PixelSprite id="voidlord" size={84} /></div>
            <div className="fighter-shadow" />
            <div className="hearts">FINAL BOSS</div>
          </div>
        </div>
        <div className="question">
          Teach it back, explain everything you've learned in your own words.
          The better you teach, <b>the stronger your weapon charges</b> for the brawl.
        </div>
        <textarea
          rows={8}
          aria-label="Your explanation"
          placeholder="Pretend you're teaching this to a friend who knows nothing about it"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn ghost" onClick={onExit}>Retreat</button>
          <button className="btn" onClick={submit} disabled={loading || explanation.trim().length < 30}>
            {loading ? "The boss is judging you" : "Unleash your explanation"}
          </button>
        </div>
      </div>
    );

  if (phase === "armed")
    return (
      <div className="battle">
        <div className="center-card" style={{ padding: "10px 0 0" }}>
                    <h2 className="tnum">Weapon charged to {Math.round(mult * 100)}%</h2>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            Your explanation scored {grade.score}/100, every correct answer in the brawl hits for {Math.round(20 * mult)} damage.
          </p>
        </div>
        {grade.correct?.length > 0 && (
          <>
            <h3 style={{ marginTop: 14, color: "#30a46c" }}>What you nailed:</h3>
            <ul className="result-list">{grade.correct.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </>
        )}
        {grade.missed?.length > 0 && (
          <>
            <h3 style={{ marginTop: 14, color: "#e5484d" }}>What you missed:</h3>
            <ul className="result-list">{grade.missed.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </>
        )}
        {grade.reviewQuestions?.length > 0 && (
          <div className="explain" style={{ marginTop: 12 }}>
            <div className="explain-title">{grade.reviewQuestions.length} weak {grade.reviewQuestions.length === 1 ? "spot" : "spots"} will join the Revenge Round</div>
          </div>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn gold" onClick={() => { setPhase("brawl"); beginAction(); }}>Enter the brawl</button>
        </div>
      </div>
    );

  if (phase === "end") {
    const xpGain = won ? Math.min(100, 60 + hearts * 8) : 15;
    return (
      <div className={`battle center-card ${won ? "win-screen" : "lose-screen"}`}>
        {won ? (
          <>
            <VictoryFX />
            <div className="win-duo" aria-hidden="true">
              <div className="win-bounce"><PixelSprite id={character} size={72} /></div>
              <div className="enemy-die"><PixelSprite id="voidlord" size={84} /></div>
            </div>
          </>
        ) : (
          <>
            <div className="defeat-vignette" aria-hidden="true" />
            <div className="player-fallen" aria-hidden="true"><PixelSprite id={character} size={72} /></div>
          </>
        )}
        <h2 className={won ? "big-pop" : "defeat-title"}>{won ? "THE VOID LORD FALLS!" : "The Void Lord survives"}</h2>
        <p className="sub" style={{ margin: "8px 0 0" }}>
          {won
            ? `Victory with ${hearts} ${hearts === 1 ? "heart" : "hearts"} to spare. A true scholar-warrior.`
            : "Study your weak spots and return stronger, the Ninja holds your missed questions."}
        </p>
        {grade?.followUp && (
          <div className="explain" style={{ marginTop: 14 }}>
            <div className="explain-title">Follow-up challenge</div>
            <p>{grade.followUp}</p>
          </div>
        )}
        <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
          <button className="btn gold tnum" onClick={() => onDone(xpGain, grade?.reviewQuestions || [], won)}>
            Claim +{xpGain} XP
          </button>
        </div>
      </div>
    );
  }

  // phase === "brawl"
  return (
    <div className={`battle brawl bphase-${bossPhase} ${bossAtk ? "rumble" : ""}`}>
      {shownPhase > 1 && (
        <div key={`pb${shownPhase}`} className="phase-banner" aria-hidden="true">
          {shownPhase === 2 ? "PHASE 2, THE VOID AWAKENS" : "FINAL PHASE, OBLIVION NEARS"}
        </div>
      )}
      {shownPhase > 1 && <div key={`pf${shownPhase}`} className="phase-flash" aria-hidden="true" />}
      {dodgedKey > 0 && <div key={`dg${dodgedKey}`} className="atk-callout dodged">DODGED!</div>}
      <div className="brawl-arena">
        <div className="boss-zone">
          <div key={flinchKey} className="boss-wrap flinch-anim">
            <div className="boss-pixel"><PixelSprite id="voidlord" size={112} /></div>
          </div>
          <div className="boss-hp">
            <div className="boss-hp-fill" style={{ width: `${(bossHP / BOSS_MAX) * 100}%` }} />
          </div>
          <div className="tnum boss-hp-num">{bossHP}/{BOSS_MAX}</div>
          <div className={`charge-row ${charge > 70 ? "hot" : ""}`}>
            {nextAtk.name}
            <div className="charge-track"><div className="charge-fill" style={{ width: `${charge}%` }} /></div>
          </div>
        </div>

        {/* combat FX */}
        {mode === "action" && <div key={shotKey} className="auto-bolt" />}
        {barrage && (
          <div key={barrage.key} className="barrage">
            {Array.from({ length: barrage.hits }).map((_, i) => (
              <span key={i} className={`brawl-bolt ${CHAR_ATK[character] || "blaster"}`} style={{ left: `${40 + (i - barrage.hits / 2) * 6}%`, animationDelay: `${i * 0.08}s` }} />
            ))}
            <div className="brawl-dmg tnum">-{barrage.dmg}</div>
            {barrage.combo > 1 && <div className="brawl-combo">COMBO ×{barrage.combo}!</div>}
          </div>
        )}
        {bossAtk?.type === "meteor" && (
          <div key={`fx${bossAtk.key}`} className="boss-fx">
            <div className="meteor m1" /><div className="meteor m2" /><div className="meteor m3" /><div className="meteor m4" />
          </div>
        )}
        {bossAtk?.type === "beam" && <div key={`fx${bossAtk.key}`} className="boss-fx"><div className="void-beam" /></div>}
        {bossAtk?.type === "slam" && <div key={`fx${bossAtk.key}`} className="boss-fx"><div className="shadow-slam" /></div>}
        {bossAtk?.type === "nova" && <div key={`fx${bossAtk.key}`} className="boss-fx"><div className="void-nova" /></div>}

        <div key={`pz${bossAtk?.key || barrage?.key || 0}`} className={`player-zone ${bossAtk ? "hurt-anim" : barrage && mode === "resolve" ? "shoot-anim" : ""}`}>
          <PixelSprite id={character} size={64} />
          <div className="hearts tnum">{"♥".repeat(Math.max(0, hearts))}{"♡".repeat(Math.max(0, 5 - hearts))}</div>
        </div>
      </div>

      <div className="brawl-q">
        {mode === "action" && (
          <div className="brawl-wait">{nextAtk.name} is charging, answer the next question to counter it!</div>
        )}
        {mode === "dodge" && (
          <VoidGauntlet
            key={`g${qi}`}
            phase={bossPhase}
            character={character}
            onResolve={(hitP) => {
              if (hitP) {
                sfx("hurt");
                setBossAtk({ type: nextAtk.id, key: Date.now() });
                setHearts((h) => h - 1);
              } else {
                sfx("hit");
                setDodgedKey((k) => k + 1);
              }
              setMode("resolve");
              setTimeout(beginAction, 850);
            }}
          />
        )}
        {(mode === "question" || mode === "resolve") && q && (
          <>
            <div className="question" style={{ margin: "8px 0" }}>{q.question}</div>
            {q.type === "multiple_choice" ? (
              <div className="options">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    className={`opt ${mode === "resolve" && picked === i && i !== q.answer ? "wrong" : ""} ${mode === "resolve" && i === q.answer ? "right" : ""}`}
                    onClick={() => { if (mode === "question") { setPicked(i); answerQ(i === q.answer); } }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="row">
                <input
                  type="text"
                  placeholder="Type your answer"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && typed.trim() && mode === "question") answerQ(isRightAnswer(q, typed)); }}
                />
                <button className="btn" disabled={!typed.trim() || mode !== "question"} onClick={() => answerQ(isRightAnswer(q, typed))}>
                  Counter </button>
                <div className="blank-hint">Shape: <span className="tnum">{letterHint(q.answer)}</span></div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn ghost sm" onClick={onExit}>Flee</button>
      </div>
    </div>
  );
}

export default BossBattle;
export { CutScene, VoidGauntlet, genVoidZones };
