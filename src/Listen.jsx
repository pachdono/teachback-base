import { useState, useEffect, useRef } from "react";
import { API } from "./config";

// Two browser features do all the work here, so there is no extra API cost:
// SpeechRecognition turns a lecture into text, speechSynthesis reads a script
// back out loud. Both are built into Chrome and Edge.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canRecord = !!Recognition;
export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

// ---- Recording a lecture -------------------------------------------------

export function LectureRecorder({ onText }) {
  const [live, setLive] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const finalRef = useRef("");

  function start() {
    if (!Recognition) return;
    setError("");
    finalRef.current = "";
    setHeard("");

    const rec = new Recognition();
    rec.continuous = true;      // keep going through pauses
    rec.interimResults = true;  // show words before the sentence is finished
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += chunk + " ";
        else interim += chunk;
      }
      setHeard(finalRef.current + interim);
    };

    // Chrome stops listening on its own after a silence, so restart while recording.
    rec.onend = () => { if (recRef.current) rec.start(); };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setError("Microphone access was refused.");
      else if (e.error !== "no-speech") setError("Recording stopped: " + e.error);
    };

    recRef.current = rec;
    rec.start();
    setLive(true);
  }

  function stop() {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) { rec.onend = null; rec.stop(); }
    setLive(false);
    const text = finalRef.current.trim();
    if (text) onText(text);
  }

  useEffect(() => () => { if (recRef.current) { recRef.current.onend = null; recRef.current.stop(); } }, []);

  if (!canRecord)
    return <p className="sub" style={{ margin: 0 }}>Live transcription needs Chrome or Edge.</p>;

  return (
    <div>
      <div className="row" style={{ marginTop: 0 }}>
        {live ? (
          <button type="button" className="btn gold" onClick={stop}>Stop and use this</button>
        ) : (
          <button type="button" className="btn" onClick={start}>Record a lecture</button>
        )}
        {live && <span className="rec-dot" aria-hidden="true" />}
        {live && <span className="sub">Listening…</span>}
      </div>
      {heard && <p className="rec-heard">{heard}</p>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

// ---- Listening to an episode --------------------------------------------

export function Podcast({ mission, onBack }) {
  const [script, setScript] = useState(mission.podcast || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState([]);
  const [hostVoice, setHostVoice] = useState("");
  const [guestVoice, setGuestVoice] = useState("");
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(-1);
  const stopped = useRef(false);

  useEffect(() => {
    if (!canSpeak) return;
    const load = () => {
      const all = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      setVoices(all);
      if (all.length && !hostVoice) {
        setHostVoice(all[0].name);
        setGuestVoice((all[1] || all[0]).name);
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; window.speechSynthesis.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function build() {
    setLoading(true);
    setError("");
    try {
      const material = mission.notes || JSON.stringify(mission.exam ? mission.questions : mission.plan);
      const res = await fetch(`${API}/api/podcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material, title: mission.title }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.lines?.length) throw new Error("The episode came back empty.");
      setScript(data);
    } catch (err) {
      setError("Couldn't build the episode: " + err.message);
    }
    setLoading(false);
  }

  function speakFrom(i) {
    if (!script || i >= script.lines.length) { setPlaying(false); setAt(-1); return; }
    const line = script.lines[i];
    const u = new SpeechSynthesisUtterance(line.text);
    const wanted = line.speaker === "guest" ? guestVoice : hostVoice;
    const voice = voices.find((v) => v.name === wanted);
    if (voice) u.voice = voice;
    u.rate = 1;
    u.onend = () => { if (!stopped.current) speakFrom(i + 1); };
    setAt(i);
    window.speechSynthesis.speak(u);
  }

  function play() {
    if (!script) return;
    stopped.current = false;
    setPlaying(true);
    window.speechSynthesis.cancel();
    speakFrom(0);
  }

  function stop() {
    stopped.current = true;
    window.speechSynthesis.cancel();
    setPlaying(false);
    setAt(-1);
  }

  useEffect(() => () => { stopped.current = true; window.speechSynthesis.cancel(); }, []);

  return (
    <>
      <div className="row" style={{ marginTop: 0, marginBottom: 14 }}>
        <button className="btn ghost" onClick={() => { stop(); onBack(); }}>Back to home</button>
      </div>

      <div className="hero-card">
        <h1>{script?.title || mission.title}</h1>
        <p className="sub">A short episode about this material, read out loud. Useful when you can't look at a screen.</p>

        {!canSpeak && <div className="error">This browser can't read text aloud. Try Chrome or Edge.</div>}

        {!script && (
          <button className="btn gold" disabled={loading} onClick={build}>
            {loading ? "Writing the episode…" : "Create episode"}
          </button>
        )}

        {error && <div className="error">{error}</div>}

        {script && canSpeak && (
          <>
            <div className="voice-row">
              <label>
                <span className="sub">Host voice</span>
                <select value={hostVoice} onChange={(e) => setHostVoice(e.target.value)}>
                  {voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </label>
              <label>
                <span className="sub">Guest voice</span>
                <select value={guestVoice} onChange={(e) => setGuestVoice(e.target.value)}>
                  {voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </label>
            </div>

            <div className="row">
              {playing
                ? <button className="btn" onClick={stop}>Stop</button>
                : <button className="btn gold" onClick={play}>Play episode</button>}
            </div>

            <div className="script">
              {script.lines.map((l, i) => (
                <p key={i} className={`script-line ${l.speaker} ${i === at ? "now" : ""}`}>
                  <span className="who">{l.speaker === "guest" ? "Student" : "Teacher"}</span>
                  {l.text}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
