import { useState, useEffect, useRef } from "react";
import { PixelSprite, MONSTERS, MONSTER_MOVE, CHAR_ATK } from "./sprites";
import { sfx, startMusic, stopMusic, shuffle, shuffleOptions, isRightAnswer, answerText, letterHint } from "./game";

function AttackFX({ kind }) {
  if (kind === "raygun")
    return (
      <>
        <div className="fx-muzzle fx-left cyan" />
        <div className="fx-bubble b1" />
        <div className="fx-bubble b2" />
        <div className="fx-bubble b3" />
        <div className="fx-burst fx-at-enemy cyan" />
      </>
    );
  if (kind === "laser")
    return (
      <>
        <div className="fx-beam beam1" />
        <div className="fx-beam beam2" />
        <div className="fx-burst fx-at-enemy cyan" />
      </>
    );
  if (kind === "slash")
    return (
      <>
        <div className="fx-slash at-enemy" />
        <div className="fx-burst fx-at-enemy orange" />
      </>
    );
  if (kind === "orb")
    return (
      <>
        <div className="fx-muzzle fx-left green" />
        <div className="fx-orb" />
        <div className="fx-burst fx-at-enemy green" />
      </>
    );
  return (
    <>
      <div className="fx-muzzle fx-left" />
      <div className="fx-bolt fx-to-enemy" />
      <div className="fx-burst fx-at-enemy" />
    </>
  );
}

function MonsterAttackFX({ monster }) {
  return (
    <>
      <div className="atk-callout mon">{MONSTER_MOVE[monster] || "ENEMY ATTACK!"}</div>
      {monster === "eyeball" && (
        <>
          <div className="eye-charge" />
          <div className="eye-laser" />
          <div className="fx-burst fx-at-player cyan" />
        </>
      )}
      {monster === "bat" && (
        <>
          <div className="fx-slash at-player bat-slash" />
          <div className="fx-burst fx-at-player" />
        </>
      )}
      {monster === "slime" && (
        <>
          <div className="slime-surge" />
          <div className="fx-burst fx-at-player green" />
        </>
      )}
      {monster === "spore" && (
        <>
          <div className="spore-lob s1" />
          <div className="spore-lob s2" />
          <div className="spore-lob s3" />
          <div className="fx-burst fx-at-player red" />
        </>
      )}
      <div className="fx-dmg fx-at-player red">HIT</div>
    </>
  );
}

function VictoryFX() {
  const [pieces] = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      dur: 1.6 + Math.random(),
      color: ["var(--gold)", "var(--purple2)", "var(--green)", "#ff8fa3", "#4cc9f0"][i % 5],
      rot: Math.round(Math.random() * 720 - 360),
    }))
  );
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, "--rot": `${p.rot}deg` }}
        />
      ))}
    </div>
  );
}

function DodgeField({ zones, duration = 950, character, onResolve }) {
  const [x, setX] = useState(50);
  const xRef = useRef(50);

  const move = (dx) => setX((v) => {
    const nv = Math.max(5, Math.min(95, v + dx));
    xRef.current = nv;
    return nv;
  });

  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") { e.preventDefault(); move(-9); }
      else if (k === "arrowright" || k === "d") { e.preventDefault(); move(9); }
      else if (k === "arrowup" || k === "arrowdown" || k === "w" || k === "s") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      onResolve(zones.some((z) => xRef.current >= z.from && xRef.current <= z.to));
    }, duration);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="dodge-field">
      <div className="dodge-label">INCOMING, MOVE! <span className="dodge-keys">A / D or ← / →</span></div>
      <div className="dodge-lane">
        {zones.map((z, i) => (
          <div key={i} className="dodge-zone" style={{ left: `${z.from}%`, width: `${z.to - z.from}%` }} />
        ))}
        <div className="dodge-player" style={{ left: `${x}%` }}><PixelSprite id={character} size={30} /></div>
      </div>
      <div className="dodge-timer"><div className="dodge-timer-fill" style={{ animationDuration: `${duration}ms` }} /></div>
      <div className="dodge-touch">
        <button type="button" className="btn ghost sm" onClick={() => move(-12)} aria-label="Move left">◀</button>
        <button type="button" className="btn ghost sm" onClick={() => move(12)} aria-label="Move right">▶</button>
      </div>
    </div>
  );
}

function Battle({ section, speed, revenge, reward = 15, extraHeart, warp, armour = 0, character, xp, onHint, onStat, onWin, onExit }) {
  // snapshot + shuffle at mount: question order and option order are randomized,
  // and the battle stays stable even if the source list changes mid-fight (revenge)
  const [questions] = useState(() => shuffle(section.questions.map(shuffleOptions)));
  const total = questions.length;
  // base hearts, plus one per armour tier, plus the Extra Heart perk
  const base = revenge ? 5 : 3;
  const maxLives = base + armour + (extraHeart ? 1 : 0);
  const [enraged, setEnraged] = useState(false);
  const timed = speed || (revenge && enraged);
  const T = speed ? (warp ? 20 : 15) : 12;
  const [queue, setQueue] = useState(() => questions.map((_, i) => i));
  const [lives, setLives] = useState(maxLives);
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState("");
  const [reveal, setReveal] = useState(false);
  const [hit, setHit] = useState(false);
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(T);
  const [hinted, setHinted] = useState(false);
  const [natk, setNatk] = useState(null); // ninja attack variant during revenge
  const [dodge, setDodge] = useState(null); // active dodge zones
  const [dodged, setDodged] = useState(false); // escaped the last attack
  const [monster] = useState(() => MONSTERS[Math.floor(Math.random() * MONSTERS.length)]);

  const dead = lives <= 0;
  const won = queue.length === 0;
  const q = won ? null : questions[queue[0]];
  const hp = queue.length;

  // ninja enrage: phase 2 once half the questions are cleared
  useEffect(() => {
    if (revenge && !enraged && queue.length > 0 && queue.length <= Math.ceil(total / 2)) {
      setEnraged(true);
      sfx("lose");
    }
  }, [queue.length, revenge, enraged, total]);

  // battle music (ninja theme, faster when enraged)
  useEffect(() => {
    if (!revenge) return;
    startMusic("ninja", enraged ? 1.3 : 1);
    return stopMusic;
  }, [revenge, enraged]);

  useEffect(() => {
    if (!timed || locked || won || dead) return;
    setTimeLeft(T);
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 3.2 && s > 3.1) sfx("tick");
        if (s <= 0.1) { clearInterval(t); answer(false, true); return 0; }
        return s - 0.1;
      });
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, locked, timed]);

  function reset() {
    setHit(false);
    setReveal(false);
    setPicked(null);
    setTyped("");
    setLocked(false);
    setHinted(false);
    setNatk(null);
    setDodge(null);
    setDodged(false);
  }

  function next() {
    setQueue((qs) => [...qs.slice(1), qs[0]]);
    reset();
  }

  function answer(isCorrect, fromTimer = false) {
    if (locked && !fromTimer) return;
    setLocked(true);
    onStat(q, isCorrect);
    if (isCorrect) {
      sfx(queue.length === 1 ? "win" : "hit");
      setHit(true);
      setTimeout(() => { setQueue((qs) => qs.slice(1)); reset(); }, 700);
    } else if (revenge) {
      // ninja attacks are dodgeable: telegraph zones, then resolve
      sfx("hurt");
      const type = Math.random() < 0.5 ? "shuriken" : "shadow";
      setNatk(type);
      const zones = type === "shuriken"
        ? Array.from({ length: 3 }, () => {
            const c = 14 + Math.random() * 72;
            return { from: c - 9, to: c + 9 };
          })
        : [{ from: 28, to: 72 }];
      setDodge(zones);
    } else {
      sfx(lives === 1 ? "lose" : "hurt");
      setReveal(true);
      setLives((l) => l - 1);
      // stay on the question so the learner can read the explanation, then tap Continue
    }
  }

  if (dead)
    return (
      <div className="battle center-card lose-screen">
        <div className="defeat-vignette" aria-hidden="true" />
        <div className="player-fallen" aria-hidden="true"><PixelSprite id={character} size={72} /></div>
        <h2 className="defeat-title">DEFEATED</h2>
        <p style={{ margin: "8px 0 16px" }}>The enemy survives. Redo the lesson to try again.</p>
        {q && q.explanation && (
          <div className="explain">
            <div className="explain-title">The one that beat you, {answerText(q)}</div>
            <p>{q.explanation}</p>
          </div>
        )}
        <button className="btn" style={{ marginTop: 16 }} onClick={onExit}>Back to mission map</button>
      </div>
    );

  if (won)
    return (
      <div className="battle center-card win-screen">
        <VictoryFX />
        <div className="win-duo" aria-hidden="true">
          <div className="win-bounce"><PixelSprite id={character} size={72} /></div>
          {revenge ? (
            <div className="enemy-die"><PixelSprite id="ninja" size={72} /></div>
          ) : (
            <div className="enemy-die"><PixelSprite id={monster} size={72} /></div>
          )}
        </div>
        <h2 className="big-pop">{revenge ? "NINJA VANQUISHED!" : "VICTORY!"} +{reward} XP</h2>
        <button className="btn gold" style={{ marginTop: 14 }} onClick={onWin}>Claim victory</button>
      </div>
    );

  return (
    <div className={`battle ${revenge ? "revenge" : ""} ${enraged ? "phase2" : ""} ${hit || reveal ? "rumble" : ""}`}>
      {revenge && (
        <>
          <div className="alarm alarm-l" aria-hidden="true" />
          <div className="alarm alarm-r" aria-hidden="true" />
        </>
      )}
      {enraged && (
        <>
          <div className="phase-banner" aria-hidden="true">PHASE 2, THE NINJA ENRAGES!</div>
          <div className="phase-flash" aria-hidden="true" />
        </>
      )}
      <div className="arena">
        {hit && (
          <>
            <AttackFX kind={CHAR_ATK[character] || "blaster"} />
            <div className="fx-dmg fx-at-enemy tnum">-20</div>
          </>
        )}
        {reveal && !revenge && <MonsterAttackFX monster={monster} />}
        {reveal && revenge && dodged && (
          <div className="atk-callout dodged">DODGED!</div>
        )}
        {reveal && revenge && !dodged && (
          <>
            <div className="atk-callout">{natk === "shuriken" ? "SHURIKEN BARRAGE!" : "SHADOW STRIKE!"}</div>
            {natk === "shuriken" ? (
              <>
                <div className="fx-shuriken s1" />
                <div className="fx-shuriken s2" />
                <div className="fx-shuriken s3" />
              </>
            ) : (
              <div className="fx-slash at-player" />
            )}
            <div className="fx-burst fx-at-player red" />
            <div className="fx-dmg fx-at-player red">HIT</div>
          </>
        )}
        <div className="fighter">
          <div className={`sprite-wrap ${hit ? "p-attack" : ""} ${reveal && !dodged ? "p-hurt" : ""}`}>
            <PixelSprite id={character} size={80} />
          </div>
          <div className="fighter-shadow" />
          <div className="hearts">{"♥".repeat(lives)}{"♡".repeat(Math.max(0, maxLives - lives))}</div>
        </div>
        <div className="vs-badge" aria-hidden="true">VS</div>
        <div className="fighter">
          <div className={`sprite-wrap ${reveal ? (revenge ? (natk === "shadow" ? "shadow-dash" : "e-lunge") : (monster === "bat" ? "e-lunge" : "")) : ""} ${hit ? "e-flash" : ""}`}>
            {revenge ? (
              <div className={`enemy-sprite ${hit ? "hit" : ""}`}><PixelSprite id="ninja" size={80} /></div>
            ) : (
              <div className={`enemy-sprite ${hit ? "hit" : ""}`}><PixelSprite id={monster} size={80} /></div>
            )}
          </div>
          <div className="fighter-shadow" />
          <div className="hpbar"><div className="hpfill" style={{ width: `${(hp / total) * 100}%` }} /></div>
          <div className="tnum" style={{ fontSize: 13, color: "#a5a0c4", fontWeight: 600 }}>
            {hp * 20}/{total * 20} HP
          </div>
        </div>
      </div>

      {timed && (
        <div className="timerbar">
          <div className={`timerfill ${timeLeft < 5 ? "danger" : ""}`} style={{ width: `${(timeLeft / T) * 100}%` }} />
        </div>
      )}

      {dodge && (
        <DodgeField
          zones={dodge}
          duration={enraged ? 1100 : 1500}
          character={character}
          onResolve={(hitP) => {
            setDodge(null);
            setReveal(true);
            if (hitP) {
              sfx(lives === 1 ? "lose" : "hurt");
              setLives((l) => l - 1);
            } else {
              sfx("hit");
              setDodged(true);
            }
          }}
        />
      )}

      <h3 style={{ fontSize: 15, color: "#a5a0c4" }}>{section.title}</h3>
      <div className="question">{q.question}</div>

      {q.type === "multiple_choice" ? (
        <div className="options">
          {q.options.map((opt, i) => (
            <button
              key={i}
              className={`opt ${picked === i && i !== q.answer ? "wrong" : ""} ${(picked === i && i === q.answer) || (reveal && i === q.answer) ? "right" : ""}`}
              onClick={() => { if (!locked) { setPicked(i); answer(i === q.answer); } }}
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && typed.trim() && !locked)
                answer(isRightAnswer(q, typed));
            }}
          />
          <button
            className="btn"
            disabled={!typed.trim() || locked}
            onClick={() => answer(isRightAnswer(q, typed))}
          >
            Attack </button>
          <div className="blank-hint">Shape: <span className="tnum">{letterHint(q.answer)}</span></div>
        </div>
      )}

      {q.hint && !reveal && !hit && (
        hinted ? (
          <div className="explain">
            <div className="explain-title">Hint</div>
            <p>{q.hint}</p>
          </div>
        ) : (
          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="btn ghost sm tnum"
              disabled={xp < 5 || locked}
              onClick={() => { setHinted(true); onHint(); }}
            >Hint · 5 XP
            </button>
          </div>
        )
      )}
      {hit && <div className="feedback good">Direct hit!</div>}
      {reveal && (
        <>
          <div className="feedback bad">Correct answer: {answerText(q)}, this one will come back!
          </div>
          {q.explanation && (
            <div className="explain">
              <div className="explain-title">How to get there</div>
              <p>{q.explanation}</p>
            </div>
          )}
        </>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn ghost" onClick={onExit}>Retreat</button>
        {reveal && <button className="btn" onClick={next}>Continue →</button>}
      </div>
    </div>
  );
}

export default Battle;
export { VictoryFX, DodgeField, AttackFX, MonsterAttackFX };
