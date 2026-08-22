import { useState, useEffect, useRef } from "react";
import { API } from "./config";

// The browser does the work here. SpeechRecognition turns a lecture into
// text and speechSynthesis reads a script back out loud.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canRecord = !!Recognition;
export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

// Recording a lecture

export function LectureRecorder({ onText }) {
  const [live, setLive] = useState(false);
  const [heard, setHeard] = useState("");
  const [review, setReview] = useState(null); // { url, text } once you stop
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  async function start() {
    if (!Recognition) return;
    setError("");
    setReview(null);
    finalRef.current = "";
    interimRef.current = "";
    setHeard("");

    // Record the audio as well as the words, so you can play it back and check.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.start();
      mediaRef.current = mr;
    } catch {
      setError("Microphone access was refused, so there is nothing to record.");
      return;
    }

    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += chunk + " ";
        else interim += chunk;
      }
      // Keep the unfinished words too. Stopping mid sentence used to lose them.
      interimRef.current = interim;
      setHeard(finalRef.current + interim);
    };

    rec.onend = () => { if (recRef.current) rec.start(); };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setError("Microphone access was refused.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError("Recording stopped: " + e.error);
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

    const mr = mediaRef.current;
    mediaRef.current = null;
    const text = (finalRef.current + interimRef.current).trim();

    if (mr && mr.state !== "inactive") {
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setReview({ url: URL.createObjectURL(blob), text });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mr.stop();
    } else {
      setReview({ url: null, text });
    }
  }

  function keep() {
    if (review?.text.trim()) onText(review.text.trim());
    if (review?.url) URL.revokeObjectURL(review.url);
    setReview(null);
    setHeard("");
  }

  function discard() {
    if (review?.url) URL.revokeObjectURL(review.url);
    setReview(null);
    setHeard("");
  }

  useEffect(() => () => {
    if (recRef.current) { recRef.current.onend = null; recRef.current.stop(); }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  if (!canRecord) return <span className="file-note">Recording needs Chrome or Edge.</span>;

  if (review) {
    return (
      <div className="rec-review">
        <p className="file-note">Check it before adding. You can fix any wrong words.</p>
        {review.url && <audio className="rec-audio" src={review.url} controls />}
        <textarea
          className="rec-edit"
          value={review.text}
          onChange={(e) => setReview({ ...review, text: e.target.value })}
          aria-label="What was recorded"
        />
        <div className="row" style={{ marginTop: 0 }}>
          <button type="button" className="btn sm" onClick={keep} disabled={!review.text.trim()}>
            Add to notes
          </button>
          <button type="button" className="btn ghost sm" onClick={discard}>Discard</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {live ? (
        <button type="button" className="btn sm rec-btn live" onClick={stop}>
          <span className="rec-glyph stop" aria-hidden="true">&#9632;</span>
          Stop recording
        </button>
      ) : (
        <button type="button" className="btn sm rec-btn" onClick={start}>
          <span className="rec-glyph" aria-hidden="true">&#9679;</span>
          Record a lecture
        </button>
      )}
      {live && <span className="file-note rec-status">Listening</span>}
      {live && heard && <p className="rec-heard">{heard}</p>}
      {error && <div className="error">{error}</div>}
    </>
  );
}

// Listening to an episode

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
    if (!script || i >= script.lines.length) { setPlaying(false); return; }
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

  // Starting point for the play button. Stopping keeps it, so you resume
  // where you left off instead of going back to the beginning.
  function playFrom(i) {
    if (!script) return;
    stopped.current = false;
    setPlaying(true);
    window.speechSynthesis.cancel();
    speakFrom(i);
  }

  function stop() {
    stopped.current = true;
    window.speechSynthesis.cancel();
    setPlaying(false);
  }

  useEffect(() => () => { stopped.current = true; window.speechSynthesis.cancel(); }, []);

  return (
    <>
      <div className="row" style={{ marginTop: 0, marginBottom: 14 }}>
        <button className="btn ghost" onClick={() => { stop(); onBack(); }}>Back to home</button>
      </div>

      <div className="hero-card">
        <h1>{script?.title || mission.title}</h1>
        <p className="sub">This material as a short talk you can listen to instead of reading.</p>

        {!canSpeak && <div className="error">This browser can't read text aloud. Try Chrome or Edge.</div>}

        {!script && (
          <button className="btn gold" disabled={loading} onClick={build}>
            {loading ? "Writing the episode" : "Create episode"}
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
              {playing ? (
                <button className="btn" onClick={stop}>
                  <span className="rec-glyph stop" aria-hidden="true">&#9632;</span>
                  Pause
                </button>
              ) : (
                <button className="btn gold" onClick={() => playFrom(at < 0 ? 0 : at)}>
                  <span className="rec-glyph play" aria-hidden="true">&#9654;</span>
                  {at > 0 ? "Resume" : "Play episode"}
                </button>
              )}
              <span className="file-note">Tap any line to start from there.</span>
            </div>

            <div className="script">
              {script.lines.map((l, i) => (
                <button
                  type="button"
                  key={i}
                  className={`script-line ${l.speaker} ${i === at ? "now" : ""}`}
                  onClick={() => playFrom(i)}
                >
                  <span className="who">{l.speaker === "guest" ? "Student" : "Teacher"}</span>
                  {l.text}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
