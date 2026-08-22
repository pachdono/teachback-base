import { useState } from "react";
import { API } from "./config";
import { PixelSprite } from "./sprites";
import { sfx } from "./game";

// The boss makes you explain the whole topic in one go. This is harder: four
// students ask their own questions and you have to satisfy each one.

const SPRITES = ["bob", "robert", "max", "einstein"];

export default function Classroom({ mission, character, onStat, onDone, onExit }) {
  const [students, setStudents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [at, setAt] = useState(0);
  const [answer, setAnswer] = useState("");
  const [marking, setMarking] = useState(false);
  const [result, setResult] = useState(null);   // reply for the current student
  const [results, setResults] = useState([]);   // one per student, in order
  const [tries, setTries] = useState(0);

  const material = mission.notes || JSON.stringify(mission.exam ? mission.questions : mission.plan);
  const student = students?.[at] ?? null;
  const finished = students && at >= students.length;

  async function begin() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/classroom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: mission.title, material }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.students?.length) throw new Error("The class came back empty.");
      setStudents(data.students);
    } catch (err) {
      setError("Couldn't gather the class: " + err.message);
    }
    setLoading(false);
  }

  async function submit() {
    if (!answer.trim() || marking) return;
    setMarking(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/classanswer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: student.question, explanation: answer, material }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      sfx(data.understood ? "win" : "hurt");
      setResult(data);
    } catch (err) {
      setError("The class got distracted: " + err.message);
    }
    setMarking(false);
  }

  // Move on. One retry per student, then their result stands either way.
  function next() {
    const keep = { ...result, name: student.name };
    if (!result.understood && tries === 0) {
      setTries(1);
      setResult(null);
      setAnswer("");
      return;
    }
    setResults((r) => [...r, keep]);
    setResult(null);
    setAnswer("");
    setTries(0);
    setAt((i) => i + 1);
  }

  if (!students) {
    return (
      <div className="battle center-card">
        <h2>Your turn to teach</h2>
        <p className="sub" style={{ maxWidth: 460, margin: "10px auto 18px" }}>
          Four students will ask about {mission.title}. Answer in your own words, the
          way you would to a friend who has never heard of it. They will tell you
          if it landed.
        </p>
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn gold" disabled={loading} onClick={begin}>
            {loading ? "The class is arriving" : "Start the lesson"}
          </button>
          <button className="btn ghost" onClick={onExit}>Back to map</button>
        </div>
      </div>
    );
  }

  if (finished) {
    const got = results.filter((r) => r.understood).length;
    const avg = Math.round(results.reduce((a, r) => a + (r.score || 0), 0) / results.length);
    const xp = 30 + got * 15;
    return (
      <div className="battle center-card">
        <h2>{got} of {results.length} students got it</h2>
        <p className="sub">Average clarity {avg} out of 100</p>
        <ul className="class-report">
          {results.map((r, i) => (
            <li key={i} className={r.understood ? "ok" : "no"}>
              <span className="who">{r.name}</span>
              <span>{r.reaction}</span>
            </li>
          ))}
        </ul>
        <button className="btn gold" style={{ marginTop: 16 }} onClick={() => onDone(xp)}>
          Claim +{xp} XP
        </button>
      </div>
    );
  }

  return (
    <div className="battle classroom">
      <div className="class-head">
        <span className="class-progress">Student {at + 1} of {students.length}</span>
        <span className="class-dots" aria-hidden="true">
          {students.map((_, i) => (
            <span key={i} className={`class-dot ${i < at ? "done" : ""} ${i === at ? "now" : ""}`} />
          ))}
        </span>
      </div>

      <div className="class-row">
        <div className="class-kid">
          <PixelSprite id={SPRITES[at % SPRITES.length]} size={72} />
          <div className="class-name">{student.name}</div>
          <div className="class-mood">{student.mood}</div>
        </div>
        <div className="class-bubble">
          <p>{student.question}</p>
          {tries > 0 && !result && <p className="class-again">They are still not sure. Try explaining it a different way.</p>}
        </div>
      </div>

      {!result && (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Explain it the way you would to a friend"
            aria-label="Your explanation"
          />
          <div className="row">
            <button className="btn gold" disabled={!answer.trim() || marking} onClick={submit}>
              {marking ? "They are thinking" : "Explain"}
            </button>
            <button className="btn ghost" onClick={onExit}>Leave the class</button>
          </div>
        </>
      )}

      {result && (
        <div className={`class-reply ${result.understood ? "ok" : "no"}`}>
          <div className="class-score tnum">{result.score}/100</div>
          <p className="class-said">{result.reaction}</p>
          {!result.understood && result.missing?.length > 0 && (
            <ul className="class-missing">
              {result.missing.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          )}
          <button className="btn" onClick={next}>
            {!result.understood && tries === 0 ? "Try again" : at + 1 < students.length ? "Next student" : "Finish the lesson"}
          </button>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
