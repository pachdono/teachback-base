import { useState, useEffect } from "react";
import { supabase, cloudOn, topScores } from "./supabase";

// Sign in and sign up in one form. Only shown when Supabase is configured.
export function AccountPage({ user, onBack }) {
  const [mode, setMode] = useState("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNote("Account made. Check your email if it asks you to confirm, then sign in.");
        setMode("in");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      setPassword("");
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <>
      <div className="row" style={{ marginTop: 0, marginBottom: 14 }}>
        <button className="btn ghost" onClick={onBack}>Back to home</button>
      </div>

      <div className="hero-card">
        <h1>Account</h1>

        {!cloudOn && (
          <p className="sub">
            Accounts are switched off. Progress is saved in this browser only.
          </p>
        )}

        {cloudOn && user && (
          <>
            <p className="sub">Signed in as {user.email}. Your progress follows you to any device.</p>
            <button className="btn ghost" onClick={signOut}>Sign out</button>
          </>
        )}

        {cloudOn && !user && (
          <>
            <p className="sub">
              Sign in to keep your progress across devices. Without an account it stays in this browser.
            </p>

            <form className="auth-form" onSubmit={submit}>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  minLength={6}
                  required
                />
              </label>

              <button className="btn gold auth-go" type="submit" disabled={busy}>
                {busy ? "Working" : mode === "up" ? "Create account" : "Sign in"}
              </button>

              <button
                type="button"
                className="auth-swap"
                onClick={() => { setMode(mode === "up" ? "in" : "up"); setError(""); }}
              >
                {mode === "up" ? "I already have an account" : "New here? Make an account"}
              </button>
            </form>

            {note && <p className="sub">{note}</p>}
            {error && <div className="error">{error}</div>}
          </>
        )}
      </div>

      <Leaderboard />
    </>
  );
}

export function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cloudOn) return;
    topScores(20).then(setRows).catch((e) => setError(e.message));
  }, []);

  if (!cloudOn) return null;

  return (
    <div className="hero-card" style={{ marginTop: 16 }}>
      <h2>Leaderboard</h2>
      {error && <div className="error">{error}</div>}
      {!error && rows.length === 0 && <p className="sub">No scores yet. Win a battle to get on the board.</p>}
      {rows.length > 0 && (
        <ol className="board">
          {rows.map((r, i) => (
            <li key={i} className={`board-row ${i < 3 ? "top" : ""}`}>
              <span className="board-rank tnum">{i + 1}</span>
              <span className="board-name">{r.name || "Anonymous"}</span>
              <span className="board-xp tnum">{r.xp} XP</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
