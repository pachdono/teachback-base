import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function answerText(q) {
  return q.type === "multiple_choice" ? q.options[q.answer] : String(q.answer);
}

export default function App() {
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState(3);
  const [plan, setPlan] = useState(null);
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
    } catch (err) {
      setError("Couldn't build the quiz: " + err.message);
    }
    setLoading(false);
  }

  if (plan) return <Quiz plan={plan} onReset={() => setPlan(null)} />;

  return (
    <div className="wrap">
      <header>
        <h1>TeachBack</h1>
        <p className="sub">Paste your notes and get an AI-generated study quiz.</p>
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
            {loading ? "Generating…" : "Generate quiz"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

function Quiz({ plan, onReset }) {
  const questions = plan.days.flatMap((d) => d.sections.flatMap((s) => s.questions));
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [wasRight, setWasRight] = useState(false);
  const [done, setDone] = useState(false);

  const q = questions[i];

  function reveal(ok, idx = null) {
    if (revealed) return;
    setChosen(idx);
    setWasRight(ok);
    setRevealed(true);
    if (ok) setRight((r) => r + 1);
  }

  function next() {
    if (i + 1 >= questions.length) {
      setDone(true);
    } else {
      setI(i + 1);
      setChosen(null);
      setTyped("");
      setRevealed(false);
      setWasRight(false);
    }
  }

  if (done) {
    return <TeachBack plan={plan} score={Math.round((right / questions.length) * 100)} onReset={onReset} />;
  }

  return (
    <div className="wrap">
      <header>
        <h1>{plan.title || "Your quiz"}</h1>
        <p className="sub">Question {i + 1} of {questions.length}</p>
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
                if (e.key === "Enter" && typed.trim() && !revealed)
                  reveal(typed.trim().toLowerCase() === String(q.answer).trim().toLowerCase());
              }}
            />
            <button
              className="btn"
              disabled={revealed || !typed.trim()}
              onClick={() => reveal(typed.trim().toLowerCase() === String(q.answer).trim().toLowerCase())}
            >
              Check
            </button>
          </div>
        )}

        {revealed && (
          <div className="feedback">
            <p className={wasRight ? "good" : "bad"}>
              {wasRight ? "Correct!" : `Correct answer: ${answerText(q)}`}
              {q.explanation ? ` — ${q.explanation}` : ""}
            </p>
            <button className="btn" onClick={next}>
              {i + 1 >= questions.length ? "Finish" : "Next question"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TeachBack({ plan, score, onReset }) {
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
        <h1>Teach it back</h1>
        <p className="sub">Quiz score: {score}%. Now the real test — explain it in your own words.</p>
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
              <button className="btn ghost" onClick={onReset}>Start over</button>
              <button className="btn" disabled={loading || text.trim().length < 30} onClick={grade}>
                {loading ? "Grading…" : "Submit explanation"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="score">{result.score}/100</p>
            {result.correct?.length > 0 && (
              <>
                <h3 className="good">What you nailed</h3>
                <ul>{result.correct.map((c, k) => <li key={k}>✓ {c}</li>)}</ul>
              </>
            )}
            {result.missed?.length > 0 && (
              <>
                <h3 className="bad">What you missed</h3>
                <ul>{result.missed.map((m, k) => <li key={k}>✗ {m}</li>)}</ul>
              </>
            )}
            {result.followUp && <p style={{ marginTop: 14 }}><b>Follow-up:</b> {result.followUp}</p>}
            <div className="row">
              <button className="btn" onClick={onReset}>Start over</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
