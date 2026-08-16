import { useState } from "react";
import { isRightAnswer, answerText } from "./game";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Top-level app. Holds the campaign and routes between the four screens:
 * the map, a quiz, the Revenge Round, and the boss.
 */
export default function App() {
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState(3);
  const [plan, setPlan] = useState(null);
  const [view, setView] = useState("home"); // home | map | quiz | revenge | boss
  const [section, setSection] = useState(null);
  const [done, setDone] = useState([]); // ids of completed sections
  const [missed, setMissed] = useState([]); // wrong answers -> the Revenge Round
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, days }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.days) throw new Error("Unexpected response from server");
      setPlan(data);
      setDone([]);
      setMissed([]);
      setView("map");
    } catch (err) {
      setError("Couldn't build the quiz: " + err.message);
    }
    setLoading(false);
  }

  // The weakness-tracking loop, in two functions: a wrong answer goes into
  // `missed`, and getting it right in the Revenge Round takes it back out.
  // Everything we want to build on top of this (a recurring enemy that grows
  // stronger the longer you avoid it) reads from this one array.
  function recordMiss(q) {
    setMissed((m) => (m.some((x) => x.question === q.question) ? m : [...m, q]));
  }

  function clearMiss(q) {
    setMissed((m) => m.filter((x) => x.question !== q.question));
  }

  function openSection(id, sec) {
    setSection({ id, ...sec });
    setView("quiz");
  }

  if (!plan) {
    return (
      <div className="wrap">
        <header>
          <h1>TeachBack</h1>
          <p className="sub">
            Paste your notes. An AI turns them into a study campaign — and the
            final boss is beaten by teaching it back.
          </p>
        </header>
        <div className="card">
          <textarea
            rows={8}
            placeholder="Paste your study notes here…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="row">
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>1 week</option>
            </select>
            <button className="btn" disabled={loading || !notes.trim()} onClick={generate}>
              {loading ? "Building your campaign…" : "Build my campaign"}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  if (view === "quiz" || view === "revenge") {
    const isRevenge = view === "revenge";
    return (
      <Quiz
        title={isRevenge ? "Revenge Round" : section.title}
        questions={isRevenge ? missed : section.questions}
        revenge={isRevenge}
        onMiss={recordMiss}
        onCleared={clearMiss}
        onFinish={() => {
          if (!isRevenge && !done.includes(section.id)) setDone([...done, section.id]);
          setView("map");
        }}
      />
    );
  }

  if (view === "boss") {
    return <BossFight plan={plan} onBack={() => setView("map")} />;
  }

  return (
    <MissionMap
      plan={plan}
      done={done}
      missed={missed}
      onOpen={openSection}
      onRevenge={() => setView("revenge")}
      onBoss={() => setView("boss")}
      onReset={() => { setPlan(null); setView("home"); }}
    />
  );
}

/* ---------- the campaign map ---------- */
function MissionMap({ plan, done, missed, onOpen, onRevenge, onBoss, onReset }) {
  return (
    <div className="wrap">
      <header className="head-row">
        <div>
          <h1>{plan.title || "Your campaign"}</h1>
          <p className="sub">Work through each topic, then face the boss.</p>
        </div>
        <button className="btn ghost" onClick={onReset}>New notes</button>
      </header>

      {plan.days.map((d, di) => (
        <div key={di} className="day">
          <h2 className="day-title">Day {d.day} — {d.title}</h2>
          {d.sections.map((s, si) => {
            const id = `${di}-${si}`;
            return (
              <button key={si} className="node" onClick={() => onOpen(id, s)}>
                <span className="node-name">
                  {done.includes(id) ? "✓ " : ""}{s.title}
                </span>
                <span className="node-meta">{s.questions.length} questions</span>
              </button>
            );
          })}
        </div>
      ))}

      {/* Revenge Round — rough prototype */}
      <div className="card feature">
        <div className="feature-head">
          <h2>Revenge Round</h2>
          <span className="wip">prototype</span>
        </div>
        <p className="sub">
          Every question you get wrong is collected here so you can hunt it down again.
          {missed.length > 0
            ? ` You currently have ${missed.length} unfinished question${missed.length === 1 ? "" : "s"}.`
            : " Get something wrong and it will show up here."}
        </p>
        <button className="btn" disabled={missed.length === 0} onClick={onRevenge}>
          {missed.length === 0 ? "Nothing to revenge yet" : `Fight ${missed.length} missed question${missed.length === 1 ? "" : "s"}`}
        </button>
        <p className="note">Planned: a recurring enemy that grows stronger the more you avoid it.</p>
      </div>

      {/* Final boss — rough prototype */}
      <div className="card feature">
        <div className="feature-head">
          <h2>Final Boss — Teach It Back</h2>
          <span className="wip">prototype</span>
        </div>
        <p className="sub">
          The real test: explain everything in your own words and an AI grades how
          well you actually understand it.
        </p>
        <button className="btn" onClick={onBoss}>Face the boss</button>
        <p className="note">Planned: a real boss battle where your explanation score powers your attacks.</p>
      </div>
    </div>
  );
}

/**
 * One question at a time, used for both a normal topic and the Revenge Round.
 * `revenge` only changes the labelling and tells it to clear a question from
 * the missed pool when the student finally gets it right.
 */
function Quiz({ title, questions, revenge, onMiss, onCleared, onFinish }) {
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [wasRight, setWasRight] = useState(false);

  const q = questions[i];
  if (!q) {
    return (
      <div className="wrap">
        <div className="card center">
          <h1>{right} / {questions.length}</h1>
          <p className="sub">
            {revenge ? "Revenge round complete." : "Topic complete."}
          </p>
          <button className="btn" onClick={onFinish}>Back to campaign</button>
        </div>
      </div>
    );
  }

  function reveal(ok, idx = null) {
    if (revealed) return;
    setChosen(idx);
    setWasRight(ok);
    setRevealed(true);
    if (ok) {
      setRight((r) => r + 1);
      if (revenge) onCleared(q);
    } else {
      onMiss(q);
    }
  }

  function next() {
    setI(i + 1);
    setChosen(null);
    setTyped("");
    setRevealed(false);
    setWasRight(false);
  }

  return (
    <div className="wrap">
      <header>
        <h1>{title}</h1>
        <p className="sub">
          {revenge ? "Questions you got wrong" : "Topic"} · {i + 1} of {questions.length}
        </p>
      </header>
      <div className="card">
        <p className="q">{q.question}</p>

        {q.type === "multiple_choice" ? (
          <div className="opts">
            {q.options.map((opt, k) => (
              <button
                key={k}
                className={
                  "opt" +
                  (revealed && k === q.answer ? " right" : "") +
                  (revealed && k === chosen && k !== q.answer ? " wrong" : "")
                }
                disabled={revealed}
                onClick={() => reveal(k === q.answer, k)}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div className="row">
            <input
              value={typed}
              placeholder="Type your answer…"
              disabled={revealed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && typed.trim() && !revealed) reveal(isRightAnswer(q, typed));
              }}
            />
            <button className="btn" disabled={revealed || !typed.trim()} onClick={() => reveal(isRightAnswer(q, typed))}>
              Check
            </button>
          </div>
        )}

        {revealed && (
          <div className="feedback">
            <p className={wasRight ? "good" : "bad"}>
              {wasRight ? "Correct!" : `Answer: ${answerText(q)}`}
            </p>
            {q.explanation && <p className="explain">{q.explanation}</p>}
            <button className="btn" onClick={next}>
              {i + 1 >= questions.length ? "Finish" : "Next"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The final boss: the student writes an explanation of everything and the AI
 * grades it. This is the part that checks understanding rather than recognition
 * — you can't pass by guessing between four options.
 */
function BossFight({ plan, onBack }) {
  const topics = plan.days.flatMap((d) => d.sections.map((s) => s.title)).join(", ");
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function grade() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topics, explanation: text }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError("Couldn't grade that: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div className="wrap">
      <header>
        <h1>Final Boss</h1>
        <p className="sub">Teach the whole topic back in your own words.</p>
      </header>
      <div className="card">
        {!result ? (
          <>
            <textarea
              rows={7}
              placeholder="Explain everything you learned, as if teaching a friend…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <div className="row">
              <button className="btn ghost" onClick={onBack}>Back</button>
              <button className="btn" disabled={loading || text.trim().length < 30} onClick={grade}>
                {loading ? "The boss is judging…" : "Submit explanation"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="score">{result.score}/100</p>
            {result.correct?.length > 0 && (
              <>
                <h3 className="good">What you nailed</h3>
                <ul>{result.correct.map((c, k) => <li key={k}>{c}</li>)}</ul>
              </>
            )}
            {result.missed?.length > 0 && (
              <>
                <h3 className="bad">What you missed</h3>
                <ul>{result.missed.map((m, k) => <li key={k}>{m}</li>)}</ul>
              </>
            )}
            {result.followUp && <p className="sub" style={{ marginTop: 14 }}><b>Follow-up:</b> {result.followUp}</p>}
            <div className="row">
              <button className="btn" onClick={onBack}>Back to campaign</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
