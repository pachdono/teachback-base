import { useState } from "react";
import { PixelSprite, CHARACTERS } from "./sprites";
import { sfx, answerText, isRightAnswer, letterHint, shuffle, shuffleOptions, localDate, QUEST_GOAL, QUEST_XP } from "./game";
import { Icon, FlameArt } from "./ui";

const THEMES = [
  { id: "nebula", name: "Nebula", desc: "The classic TeachBack purple.", c1: "#7c5cff", c2: "#a78bfa", cost: 0 },
  { id: "solar", name: "Solar Flare", desc: "Burning orange for bold pilots.", c1: "#f0762e", c2: "#ffb56b", cost: 50 },
  { id: "alien", name: "Alien Bloom", desc: "Toxic green, fresh from the hive.", c1: "#1fa46c", c2: "#3ddc97", cost: 50 },
  { id: "crimson", name: "Red Giant", desc: "A dying star's last light.", c1: "#e5484d", c2: "#ff8f92", cost: 50 },
  { id: "ocean", name: "Deep Ocean", desc: "Cool blue from a water world.", c1: "#0e8fd9", c2: "#7dd3fc", cost: 50 },
];

const PERKS = [
  { id: "heart", name: "Extra Heart", desc: "Start every battle with 4 hearts instead of 3.", icon: "♥", cost: 75 },
  { id: "warp", name: "Time Warp", desc: "Speed rounds give you 20 seconds per question.", icon: "◷", cost: 60 },
];

const RANKS = ["Space Cadet", "Star Pilot", "Nova Knight", "Galaxy Commander", "Cosmic Captain", "Void Admiral", "Interstellar Legend"];

const FAQS = [
  { q: "How does TeachBack build my mission?", a: "An AI reads your notes and splits them into daily sections, each with battle questions generated straight from your material." },
  { q: "What is the final boss?", a: "The Feynman technique in disguise. You explain the whole topic in your own words and the AI grades your explanation out of 100 — teaching something is the ultimate test of understanding it." },
  { q: "How do I earn XP?", a: "Win quiz battles (15 XP), speed rounds (20 XP), flashcard decks and matching games (10 XP each), and boss fights (up to 100 XP). Spend it in the Shop on themes and perks." },
  { q: "What happens when I get a question wrong?", a: "You lose a heart, but you also get the method — a step-by-step explanation of how to reach the answer — and the question comes back until you beat it." },
  { q: "Is my progress saved?", a: "Your XP, name, avatar and shop purchases are saved in your browser. Mission plans are rebuilt fresh from your notes each session." },
  { q: "What files can I upload?", a: ".txt and .md files. For PDFs, copy and paste the text for now." },
];

function Flashcards({ section, onStat, onDone, onExit }) {
  const [questions] = useState(() => shuffle(section.questions));
  const [queue, setQueue] = useState(() => questions.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const total = questions.length;
  const done = queue.length === 0;
  const q = done ? null : questions[queue[0]];

  if (done)
    return (
      <div className="battle center-card">
                <h2>Deck complete! +10 XP</h2>
        <button className="btn gold" style={{ marginTop: 14 }} onClick={onDone}>Nice!</button>
      </div>
    );

  return (
    <div className="battle center-card">
      <h3 style={{ color: "#a5a0c4" }}>{section.title} · {total - queue.length + 1}/{total}</h3>
      <button type="button" className={`fc ${flipped ? "flipped" : ""}`} onClick={() => setFlipped(!flipped)} aria-label={flipped ? "Show question" : "Show answer"}>
        <div className="fc-inner">
          <div className="fc-face fc-front">{q.question}</div>
          <div className="fc-face fc-back">{answerText(q)}</div>
        </div>
      </button>
      <p style={{ color: "#a5a0c4", fontSize: 13, marginTop: 8 }}>tap the card to flip</p>
      {flipped && q.explanation && (
        <div className="explain" style={{ maxWidth: 420, margin: "12px auto 0" }}>
          <div className="explain-title">Why</div>
          <p>{q.explanation}</p>
        </div>
      )}
      {flipped && (
        <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
          <button className="btn ghost" onClick={() => { sfx("hurt"); onStat(q, false); setQueue((qs) => [...qs.slice(1), qs[0]]); setFlipped(false); }}>Again
          </button>
          <button className="btn gold" onClick={() => { sfx("hit"); onStat(q, true); setQueue((qs) => qs.slice(1)); setFlipped(false); }}>Got it
          </button>
        </div>
      )}
      <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
        <button className="btn ghost" onClick={onExit}>Retreat</button>
      </div>
    </div>
  );
}

function Matching({ section, onStat, onDone, onExit }) {
  const [pairs] = useState(() => shuffle(section.questions).slice(0, 6).map((q, i) => ({ id: i, q: q.question, a: answerText(q), qq: q })));
  const [rightCol] = useState(() => shuffle(pairs));
  const [selected, setSelected] = useState(null);
  const [solved, setSolved] = useState([]);
  const [wrongPair, setWrongPair] = useState(null);
  const done = solved.length === pairs.length;

  function pickRight(pair) {
    if (selected === null || solved.includes(pair.id)) return;
    if (pair.id === selected) {
      sfx("hit");
      onStat(pairs[selected].qq, true);
      setSolved([...solved, pair.id]);
      setSelected(null);
    } else {
      sfx("hurt");
      onStat(pairs[selected].qq, false);
      setWrongPair(pair.id);
      setTimeout(() => setWrongPair(null), 500);
      setSelected(null);
    }
  }

  if (done)
    return (
      <div className="battle center-card">
                <h2>All matched! +10 XP</h2>
        <button className="btn gold" style={{ marginTop: 14 }} onClick={onDone}>Claim it</button>
      </div>
    );

  return (
    <div className="battle">
      <h3 style={{ color: "#a5a0c4" }}>{section.title} · match them up</h3>
      <div className="match-grid">
        <div>
          {pairs.map((p) => (
            <button
              key={p.id}
              className={`match-btn ${selected === p.id ? "selected" : ""} ${solved.includes(p.id) ? "solved" : ""}`}
              disabled={solved.includes(p.id)}
              onClick={() => setSelected(p.id)}
            >
              {p.q}
            </button>
          ))}
        </div>
        <div>
          {rightCol.map((p) => (
            <button
              key={p.id}
              className={`match-btn ${solved.includes(p.id) ? "solved" : ""} ${wrongPair === p.id ? "flashwrong" : ""}`}
              disabled={solved.includes(p.id)}
              onClick={() => pickRight(p)}
            >
              {p.a}
            </button>
          ))}
        </div>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn ghost" onClick={onExit}>Retreat</button>
      </div>
    </div>
  );
}

function StatsPage({ stats, topics, onRevenge }) {
  const entries = Object.entries(stats);
  if (entries.length === 0)
    return (
      <div className="hero-card center-card">
                <h2>No battles yet</h2>
        <p className="sub">Play some lessons and your stats will appear here.</p>
      </div>
    );

  const revengeCard = topics.length > 0 && (
    <div className="hero-card revenge-card" style={{ marginBottom: 16 }}>
      <div className="streak-hero">
        <div className="sprite-wrap"><PixelSprite id="ninja" size={64} /></div>
        <div style={{ flex: 1 }}>
          <h2>Revenge Round</h2>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            The Ninja guards your missed questions, topic by topic. Clear a topic to take it back — +25 XP each. Beware: it enrages halfway.
          </p>
        </div>
      </div>
      <div className="rev-topics">
        {topics.map((t) => (
          <div className="lib-row" key={t.name}>
            <div className="lib-main">
              <h3>{t.name}</h3>
              <div className="meta tnum">{t.count} missed {t.count === 1 ? "question" : "questions"}</div>
            </div>
            <button className="btn sm" disabled={t.count < 2} onClick={() => onRevenge(t.name)}>
              {t.count < 2 ? "Need 2+" : "Fight"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const totalRight = entries.reduce((n, [, v]) => n + v.right, 0);
  const totalWrong = entries.reduce((n, [, v]) => n + v.wrong, 0);
  const acc = Math.round((totalRight / Math.max(totalRight + totalWrong, 1)) * 100);

  const bySection = {};
  for (const [, v] of entries) {
    bySection[v.section] = bySection[v.section] || { right: 0, wrong: 0 };
    bySection[v.section].right += v.right;
    bySection[v.section].wrong += v.wrong;
  }

  const missed = entries
    .filter(([, v]) => v.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 5);

  return (
    <>
      {revengeCard}
      <div className="hero-card" style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <div className="pie" style={{ background: `conic-gradient(var(--green) 0 ${acc}%, var(--red) ${acc}% 100%)` }}>
          <div className="pie-hole">{acc}%</div>
        </div>
        <div>
          <h2>Overall accuracy</h2>
          <p className="sub" style={{ margin: 0 }}>{totalRight} correct · {totalWrong} wrong</p>
        </div>
      </div>

      <div className="hero-card" style={{ marginTop: 16 }}>
        <h2>Wrong answers by topic</h2>
        {Object.entries(bySection).map(([name, v]) => {
          const pct = Math.round((v.wrong / Math.max(v.right + v.wrong, 1)) * 100);
          return (
            <div className="stat-row" key={name}>
              <div className="stat-label">{name}</div>
              <div className="stat-track">
                <div className="stat-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="stat-pct">{pct}%</div>
            </div>
          );
        })}
      </div>

      {missed.length > 0 && (
        <div className="hero-card" style={{ marginTop: 16 }}>
          <h2>Your most missed</h2>
          <ul className="result-list">
            {missed.map(([qText, v]) => {
              const pct = Math.round((v.wrong / (v.right + v.wrong)) * 100);
              return <li key={qText}><b>{pct}% wrong</b> ({v.wrong + v.right} tries) — {qText}</li>;
            })}
          </ul>
        </div>
      )}
    </>
  );
}

function StudySheet({ mission, onBack }) {
  const s = mission.summary;
  return (
    <div className="hero-card sheet">
      <div className="row no-print" style={{ justifyContent: "space-between", marginTop: 0, marginBottom: 14 }}>
        <button className="btn ghost" onClick={onBack}>← Back to mission</button>
        <button className="btn" onClick={() => window.print()}>Download PDF</button>
      </div>
      <h1>{s.title}</h1>
      {s.overview && <p className="sheet-overview">{s.overview}</p>}
      {s.sections?.map((sec, i) => (
        <div key={i} className="sheet-section">
          <h2>{sec.heading}</h2>
          <ul>{sec.bullets?.map((b, j) => <li key={j}>{b}</li>)}</ul>
        </div>
      ))}
      {s.keyTerms?.length > 0 && (
        <div className="sheet-section">
          <h2>Key terms</h2>
          <dl className="terms">
            {s.keyTerms.map((t, i) => (
              <div className="term" key={i}>
                <dt>{t.term}</dt>
                <dd>{t.def}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {s.examTips?.length > 0 && (
        <div className="sheet-section">
          <h2>Exam tips</h2>
          <ul>{s.examTips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function ExamRun({ mission, onStat, onFinish, onExit }) {
  // exam keeps the AI's easy→hard question order, but answer options are shuffled
  const [qs] = useState(() => mission.questions.map(shuffleOptions));
  const T = mission.timer || 0;
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const [missed, setMissed] = useState([]);
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState("");
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(T);
  const finished = i >= qs.length;
  const q = finished ? null : qs[i];

  useEffect(() => {
    if (!T || locked || finished) return;
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
  }, [i, locked, T]);

  function answer(ok, fromTimer = false) {
    if (locked && !fromTimer) return;
    setLocked(true);
    onStat(q, ok);
    if (ok) {
      sfx("hit");
      setRight((r) => r + 1);
    } else {
      sfx("hurt");
      setMissed((ms) => [...ms, q]);
    }
  }

  function next() {
    setI(i + 1);
    setPicked(null);
    setTyped("");
    setLocked(false);
  }

  function retake() {
    setI(0);
    setRight(0);
    setMissed([]);
    setPicked(null);
    setTyped("");
    setLocked(false);
    setTimeLeft(T);
  }

  if (finished) {
    const pct = Math.round((right / qs.length) * 100);
    const xpGain = right * 2;
    return (
      <div className="battle">
        <div className="center-card" style={{ padding: "10px 0 4px" }}>
                    <h2 className="tnum">{pct}% — {right}/{qs.length} correct</h2>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            {pct >= 80 ? "Exam crushed. You're ready." : pct >= 50 ? "Solid — review the misses below and retake it." : "Rough one — study the explanations below, then try again."}
          </p>
        </div>
        {missed.length > 0 && (
          <>
            <h3 style={{ marginTop: 14, color: "#e5484d" }}>Review your misses:</h3>
            <ul className="result-list">
              {missed.map((m, idx) => (
                <li key={idx}><b>{m.question}</b> — {answerText(m)}
                  {m.explanation && <div style={{ color: "#a5a0c4", marginTop: 3 }}>{m.explanation}</div>}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn gold tnum" onClick={() => onFinish(pct, xpGain)}>Claim +{xpGain} XP</button>
          <button className="btn ghost" onClick={retake}>Retake exam</button>
        </div>
      </div>
    );
  }

  return (
    <div className="battle">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ fontSize: 20 }}>{mission.title}</h2>
        <span className="tnum" style={{ color: "#a5a0c4", fontWeight: 700, fontSize: 14 }}>Q {i + 1}/{qs.length}</span>
      </div>
      <div className="progress-track" style={{ marginTop: 10 }}>
        <div className="progress-fill" style={{ width: `${(i / qs.length) * 100}%` }} />
      </div>
      {T > 0 && (
        <div className="timerbar" style={{ marginTop: 10 }}>
          <div className={`timerfill ${timeLeft < 5 ? "danger" : ""}`} style={{ width: `${(timeLeft / T) * 100}%` }} />
        </div>
      )}
      <div className="question">{q.question}</div>

      {q.type === "multiple_choice" ? (
        <div className="options">
          {q.options.map((opt, idx) => (
            <button
              key={idx}
              className={`opt ${locked && picked === idx && idx !== q.answer ? "wrong" : ""} ${locked && idx === q.answer ? "right" : ""}`}
              onClick={() => { if (!locked) { setPicked(idx); answer(idx === q.answer); } }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <div className="row">
          <input
            type="text"
            placeholder="Type your answer…"
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
            Answer
          </button>
          <div className="blank-hint">Shape: <span className="tnum">{letterHint(q.answer)}</span></div>
        </div>
      )}

      {locked && (
        <div className="explain">
          <div className="explain-title">
            <span aria-hidden="true">{missed.includes(q) ? "✕" : "✓"}</span> {missed.includes(q) ? `Correct answer: ${answerText(q)}` : "Correct!"}
          </div>
          {q.explanation && <p>{q.explanation}</p>}
        </div>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn ghost" onClick={onExit}>Exit exam</button>
        {locked && (
          <button className="btn" onClick={next}>{i + 1 === qs.length ? "See results" : "Next →"}</button>
        )}
      </div>
    </div>
  );
}

function StreakPage({ streak, setStreak, setXp, quest, onQuestClaim }) {
  const today = localDate(0);
  const yest = localDate(-1);
  const claimedToday = streak.last === today;
  const alive = claimedToday || streak.last === yest;
  const shown = alive ? streak.count : 0;
  const nextCount = claimedToday ? streak.count : streak.last === yest ? streak.count + 1 : 1;
  const reward = 10 + Math.min(nextCount - 1, 6) * 5;

  function claim() {
    if (claimedToday) return;
    sfx("win");
    setStreak({ count: nextCount, last: today });
    setXp((x) => x + reward);
  }

  const days = [...Array(7)].map((_, i) => {
    const ds = localDate(i - 6);
    const label = new Date(ds + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" });
    const offset = alive ? Math.round((new Date(streak.last) - new Date(ds)) / 86400000) : -1;
    return { ds, label, lit: alive && offset >= 0 && offset < streak.count };
  });

  return (
    <>
      <div className="hero-card">
        <div className="streak-hero">
          <FlameArt lit={shown > 0} />
          <div>
            <div className="streak-num tnum">{shown} day{shown === 1 ? "" : "s"}</div>
            <div className="streak-sub">
              {claimedToday
                ? "Streak secured for today. See you tomorrow, pilot!"
                : shown > 0
                  ? "Claim now to keep the fire burning!"
                  : "Start a streak — learn something every day."}
            </div>
            <div className="row">
              <button className="btn gold tnum" disabled={claimedToday} onClick={claim}>
                {claimedToday ? "Claimed today" : `Claim +${reward} XP`}
              </button>
            </div>
          </div>
        </div>
        <div className="week-strip">
          {days.map((d) => (
            <div key={d.ds} className={`day-dot ${d.lit ? "lit" : ""}`} title={d.ds}>{d.label}</div>
          ))}
        </div>
      </div>

      <div className="hero-card" style={{ marginTop: 16 }}>
        <h2>Daily quest</h2>
        <p className="sub" style={{ marginBottom: 10 }}>
          Win {QUEST_GOAL} battles today — quiz, speed, revenge and exams all count.
        </p>
        <div className="level-row tnum">{Math.min(quest.wins, QUEST_GOAL)}/{QUEST_GOAL} wins</div>
        <div className="level-track">
          <div className="level-fill" style={{ width: `${Math.min((quest.wins / QUEST_GOAL) * 100, 100)}%` }} />
        </div>
        <div className="row">
          <button className="btn gold tnum" disabled={quest.wins < QUEST_GOAL || quest.claimed} onClick={onQuestClaim}>
            {quest.claimed ? "Claimed today" : quest.wins < QUEST_GOAL ? "Win more battles!" : `Claim +${QUEST_XP} XP`}
          </button>
        </div>
      </div>

      <div className="hero-card" style={{ marginTop: 16 }}>
        <h2>Streak rewards</h2>
        <p className="sub" style={{ marginBottom: 0 }}>Daily XP grows with your streak — up to 40 XP a day from day 7.</p>
        <div className="mile-row">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <span key={d} className={`mile tnum ${shown >= d ? "hit" : ""}`}>
              Day {d}{d === 7 ? "+" : ""} · {10 + Math.min(d - 1, 6) * 5} XP
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function Faq() {
  const [open, setOpen] = useState(null);
  return (
    <div className="faq">
      {FAQS.map((f, i) => (
        <div className={`faq-item ${open === i ? "open" : ""}`} key={i}>
          <button type="button" className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            {f.q}
            <Icon name="chevron" size={16} />
          </button>
          <div className="faq-a">
            <div><p>{f.a}</p></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShopPage({ xp, setXp, profile, setProfile }) {
  function buyTheme(t) {
    if (profile.owned.includes(t.id)) {
      setProfile({ ...profile, theme: t.id });
      return;
    }
    if (xp < t.cost) return;
    sfx("win");
    setXp((x) => x - t.cost);
    setProfile({ ...profile, owned: [...profile.owned, t.id], theme: t.id });
  }

  function buyPerk(p) {
    if (profile.owned.includes(p.id) || xp < p.cost) return;
    sfx("win");
    setXp((x) => x - p.cost);
    setProfile({ ...profile, owned: [...profile.owned, p.id] });
  }

  return (
    <>
      <div className="hero-card">
        <div className="shop-head">
          <div>
            <h1>Supply Depot</h1>
            <p className="sub" style={{ margin: 0 }}>Spend your hard-earned XP on themes and battle perks.</p>
          </div>
          <div className="xp-pill tnum">{xp} XP</div>
        </div>
      </div>

      <div className="hero-card" style={{ marginTop: 16 }}>
        <h2>Ship paint — themes</h2>
        <div className="shop-grid">
          {THEMES.map((t) => {
            const owned = profile.owned.includes(t.id);
            const equipped = profile.theme === t.id;
            return (
              <div className={`shop-card ${equipped ? "equipped" : ""}`} key={t.id}>
                <div className="swatch" style={{ background: `linear-gradient(135deg, ${t.c1}, ${t.c2})` }} />
                <h3>{t.name}</h3>
                <p className="desc">{t.desc}</p>
                <div className="shop-row">
                  {equipped ? (
                    <span className="owned-pill">Equipped</span>
                  ) : owned ? (
                    <button className="btn sm ghost" onClick={() => buyTheme(t)}>Equip</button>
                  ) : (
                    <button className="btn sm tnum" disabled={xp < t.cost} onClick={() => buyTheme(t)}>
                      {xp < t.cost ? `Need ${t.cost - xp} more XP` : `Buy · ${t.cost} XP`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hero-card" style={{ marginTop: 16 }}>
        <h2>Battle perks</h2>
        <div className="shop-grid">
          {PERKS.map((p) => {
            const owned = profile.owned.includes(p.id);
            return (
              <div className={`shop-card ${owned ? "equipped" : ""}`} key={p.id}>
                <div className="perk-icon" aria-hidden="true">{p.icon}</div>
                <h3>{p.name}</h3>
                <p className="desc">{p.desc}</p>
                <div className="shop-row">
                  {owned ? (
                    <span className="owned-pill">Owned</span>
                  ) : (
                    <button className="btn sm tnum" disabled={xp < p.cost} onClick={() => buyPerk(p)}>
                      {xp < p.cost ? `Need ${p.cost - xp} more XP` : `Buy · ${p.cost} XP`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function PlayerPage({ xp, profile, setProfile, stats, doneSections }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const entries = Object.entries(stats);
  const totalRight = entries.reduce((n, [, v]) => n + v.right, 0);
  const totalWrong = entries.reduce((n, [, v]) => n + v.wrong, 0);
  const acc = totalRight + totalWrong > 0 ? Math.round((totalRight / (totalRight + totalWrong)) * 100) : null;

  const level = Math.floor(xp / 100) + 1;
  const into = xp % 100;
  const rank = RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 2))];
  const ownedPerks = PERKS.filter((p) => profile.owned.includes(p.id));

  return (
    <>
      <div className="hero-card player-head">
        <div className="avatar-big" aria-hidden="true"><ComicArt id={profile.character} size={76} /></div>
        <div className="player-info">
          <input
            type="text"
            className="name-input"
            aria-label="Player name"
            maxLength={20}
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
          <div><span className="rank-pill">{rank}</span></div>
          <div className="level-row tnum">Level {level} · {into}/100 XP to level {level + 1}</div>
          <div className="level-track"><div className="level-fill" style={{ width: `${into}%` }} /></div>
        </div>
      </div>

      <div className="hero-card" style={{ marginTop: 16 }}>
        <h2>Choose your pilot</h2>
        <p className="sub" style={{ marginBottom: 0 }}>Your pilot fights alongside you in every battle.</p>
        <div className="char-grid">
          {CHARACTERS.map((c) => {
            const selected = profile.character === c.id;
            return (
              <button
                key={c.id}
                type="button"
                className={`char-card ${selected ? "selected" : ""}`}
                style={{ "--char-tint": c.tint }}
                aria-pressed={selected}
                onClick={() => { sfx("hit"); setProfile({ ...profile, character: c.id }); }}
              >
                {selected && <span className="char-badge">PILOT</span>}
                <ComicArt id={c.id} size={92} />
                <span className="char-name">{c.name}</span>
                <span className="char-tag">{c.tag}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hero-card" style={{ marginTop: 16 }}>
        <h2>Mission record</h2>
        <div className="record-grid">
          <div className="record-tile">
            <div className="num">{xp}</div>
            <div className="lbl">Total XP</div>
          </div>
          <div className="record-tile">
            <div className="num">{doneSections.length}</div>
            <div className="lbl">Battles won today</div>
          </div>
          <div className="record-tile">
            <div className="num">{acc === null ? "—" : `${acc}%`}</div>
            <div className="lbl">Accuracy</div>
          </div>
        </div>
      </div>

      {ownedPerks.length > 0 && (
        <div className="hero-card" style={{ marginTop: 16 }}>
          <h2>Equipped perks</h2>
          <div className="shop-grid">
            {ownedPerks.map((p) => (
              <div className="shop-card equipped" key={p.id}>
                <div className="perk-icon" aria-hidden="true">{p.icon}</div>
                <h3>{p.name}</h3>
                <p className="desc">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hero-card" style={{ marginTop: 16 }}>
        <h2>Your data</h2>
        <p className="sub" style={{ marginBottom: 10 }}>
          Everything is saved only in this browser on this device — nothing is uploaded.
          Resetting wipes XP, streak, missions, stats and purchases here.
        </p>
        <button
          className="btn ghost danger"
          onClick={() => {
            if (!confirmReset) { setConfirmReset(true); return; }
            localStorage.removeItem("tb-save");
            window.location.reload();
          }}
          onBlur={() => setConfirmReset(false)}
        >
          {confirmReset ? "Tap again to wipe everything" : "Reset all progress"}
        </button>
      </div>
    </>
  );
}

export { THEMES, PERKS, RANKS, FAQS, Flashcards, Matching, StatsPage, StudySheet, ExamRun, StreakPage, Faq, ShopPage, PlayerPage };
