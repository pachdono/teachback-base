import { useState, useEffect } from "react";
import { API } from "./config";
import { Icon, SpaceDecor } from "./ui";
import { PixelSprite } from "./sprites";
import { sfx, setMasterVolume, loadSave, SAVE, localDate, shuffle, shuffleOptions, QUEST_GOAL, QUEST_XP } from "./game";
import Battle from "./Battle";
import BossBattle, { CutScene } from "./BossBattle";
import Classroom from "./Classroom";
import { LectureRecorder, Podcast } from "./Listen";
import { readFile, isReadable, useFileDrop, FileList, MAX_CHARS, ACCEPT } from "./Upload";
import { AccountPage } from "./Account";
import { supabase, cloudOn, loadSave as cloudLoad, pushSave, pushScore } from "./supabase";
import { THEMES, PERKS, RANKS, FAQS, Flashcards, Matching, StatsPage, StudySheet, ExamRun, StreakPage, Faq, ShopPage, PlayerPage } from "./Pages";

// Date.now() alone collides if two missions are made in the same millisecond.
function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const PLANETS = ["🪐", "🌕", "🌍", "☄️", "🌑", "🌟"];

export default function App() {
  const [page, setPage] = useState("home");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState([]); // attached documents, kept out of the box
  const [days, setDays] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [xp, setXp] = useState(SAVE.xp ?? 0);
  const [battle, setBattle] = useState(null); // {dayIdx, secIdx, mode} | {boss:true} | {revenge:true, mode:"quiz"}
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState(() => SAVE.stats || {}); // {question: {right, wrong, section, q}}
  const [missions, setMissions] = useState(() => SAVE.missions || []);
  const [activeId, setActiveId] = useState(() => SAVE.activeId ?? null);
  const [examTopic, setExamTopic] = useState("");
  const [examCount, setExamCount] = useState(10);
  const [examLoading, setExamLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetId, setSheetId] = useState(null);
  const [castId, setCastId] = useState(null);
  const [user, setUser] = useState(null);
  const [synced, setSynced] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [slow, setSlow] = useState(false); // server cold-start hint
  const [examTimer, setExamTimer] = useState(0);
  const [quest, setQuest] = useState(() => {
    const t = localDate(0);
    return SAVE.quest && SAVE.quest.date === t ? SAVE.quest : { date: t, wins: 0, claimed: false };
  });

  const activeMission = missions.find((m) => m.id === activeId) || null;
  const plan = activeMission && !activeMission.exam ? activeMission.plan : null;
  const doneSections = activeMission?.doneSections ?? [];
  const sheetMission = missions.find((m) => m.id === sheetId) || null;
  const castMission = missions.find((m) => m.id === castId) || null;

  function go(p) {
    setPage(p);
    setBattle(null);
    setSheetId(null);
    setCastId(null);
    setMenuOpen(false);
  }

  async function openSheet(m) {
    if (m.summary) { setSheetId(m.id); return; }
    setSheetLoading(true);
    setError("");
    try {
      const material = m.notes || JSON.stringify(m.exam ? m.questions : m.plan);
      const res = await fetch(`${API}/api/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material, title: m.title }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.sections) throw new Error("Unexpected response. Restart the server.");
      setMissions((ms) => ms.map((x) => (x.id === m.id ? { ...x, summary: data } : x)));
      setSheetId(m.id);
    } catch (err) {
      setError("Couldn't build the study sheet: " + err.message);
    }
    setSheetLoading(false);
  }

  // group by mission/exam title (the generated path) so subjects never mix
  const revengeByTopic = {};
  Object.values(stats).forEach((v) => {
    if (v.q && v.wrong > 0 && v.wrong >= v.right) {
      const key = v.topic || v.section || "Mixed";
      (revengeByTopic[key] = revengeByTopic[key] || []).push(v);
    }
  });
  const revengeTopics = Object.entries(revengeByTopic)
    .map(([name, list]) => ({ name, count: list.length }))
    .sort((a, b) => b.count - a.count);

  function topicQuestions(topic) {
    return (revengeByTopic[topic] || [])
      .sort((a, b) => (b.wrong - b.right) - (a.wrong - a.right))
      .slice(0, 12)
      .map((v) => v.q);
  }

  // ninja ambush: 5 misses in a mission and he blocks your path
  const missCount = activeMission?.missCount || 0;
  const ambushReady = !!activeMission && !activeMission.exam && missCount >= 5;

  function bumpMiss() {
    setMissions((ms) => ms.map((m) => (m.id === activeId ? { ...m, missCount: (m.missCount || 0) + 1 } : m)));
  }

  function clearAmbush() {
    setMissions((ms) => ms.map((m) => (m.id === activeId ? { ...m, missCount: 0 } : m)));
  }

  function ambushQuestions() {
    const t = activeMission?.title;
    const missed = Object.values(stats)
      .filter((v) => v.q && v.wrong > 0 && (v.topic || v.section) === t)
      .sort((a, b) => (b.wrong - b.right) - (a.wrong - a.right))
      .map((v) => v.q);
    return missed.length >= 2 ? missed.slice(0, 10) : shuffle(allQuestions).slice(0, 6);
  }

  function startStoryBattle(di, si) {
    if (ambushReady) {
      sfx("lose");
      setBattle({ revenge: true, mode: "quiz", ambush: true, topic: activeMission.title });
      return;
    }
    setBattle({ dayIdx: di, secIdx: si, mode: null });
  }

  function startBoss() {
    if (ambushReady) {
      sfx("lose");
      setBattle({ revenge: true, mode: "quiz", ambush: true, topic: activeMission.title });
      return;
    }
    setBattle({ boss: true });
  }

  function bumpQuest() {
    setQuest((qs) => {
      const t = localDate(0);
      const base = qs.date === t ? qs : { date: t, wins: 0, claimed: false };
      return { ...base, wins: base.wins + 1 };
    });
  }

  function claimQuest() {
    if (quest.date !== localDate(0) || quest.wins < QUEST_GOAL || quest.claimed) return;
    sfx("win");
    setQuest({ ...quest, claimed: true });
    setXp((x) => x + QUEST_XP);
  }
  const [profile, setProfile] = useState(() => {
    const p = {
      name: "Space Cadet", character: "spaceboy", theme: "nebula", owned: ["nebula"], volume: 0.7,
      ...(SAVE.profile || {}),
    };
    if (p.volume == null) p.volume = p.muted ? 0 : 0.7; // migrate old mute flag
    return p;
  });

  useEffect(() => { setMasterVolume(profile.volume ?? 0.7); }, [profile.volume]);

  // Who is signed in. Runs once, then on every sign in or sign out.
  useEffect(() => {
    if (!cloudOn) return;
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setSynced(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // On sign in, take whichever save has more XP. The local one may be ahead if
  // you played signed out, the cloud one may be ahead if you played elsewhere.
  useEffect(() => {
    if (!cloudOn || !user || synced) return;
    let cancelled = false;
    cloudLoad(user.id)
      .then((remote) => {
        if (cancelled || !remote) { setSynced(true); return; }
        if ((remote.xp ?? 0) > xp) {
          setXp(remote.xp ?? 0);
          if (remote.profile) setProfile(remote.profile);
          if (remote.streak) setStreak(remote.streak);
          if (remote.missions) setMissions(remote.missions);
          if (remote.stats) setStats(remote.stats);
          if (remote.quest) setQuest(remote.quest);
          if (remote.activeId !== undefined) setActiveId(remote.activeId);
        }
        setSynced(true);
      })
      .catch(() => setSynced(true));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, synced]);

  const [streak, setStreak] = useState(() => SAVE.streak || { count: 0, last: null });

  const [saveWarning, setSaveWarning] = useState("");

  // Browsers give us about 5MB and each mission stores its notes, so this can fail.
  useEffect(() => {
    try {
      localStorage.setItem("tb-save", JSON.stringify({ xp, profile, streak, missions, activeId, stats, quest }));
      setSaveWarning("");
    } catch {
      setSaveWarning("Storage is full, so progress can't be saved. Delete an old mission to make room.");
    }
  }, [xp, profile, streak, missions, activeId, stats, quest]);

  // Send the save up, but wait for a pause first so a fast run of wins is one write.
  useEffect(() => {
    if (!cloudOn || !user || !synced) return;
    const t = setTimeout(() => {
      const save = { xp, profile, streak, missions, activeId, stats, quest };
      pushSave(user.id, save).catch(() => {});
      pushScore(user.id, profile.name, xp).catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, [xp, profile, streak, missions, activeId, stats, quest, user, synced]);

  useEffect(() => {
    const t = THEMES.find((x) => x.id === profile.theme) || THEMES[0];
    const s = document.documentElement.style;
    s.setProperty("--purple", t.c1);
    s.setProperty("--purple2", t.c2);
    // the world behind everything, not just the accent colour
    if (t.bg1) s.setProperty("--bg", t.bg1);
    if (t.bg2) s.setProperty("--bg-lift", t.bg2);
    if (t.star) s.setProperty("--star", t.star);
  }, [profile.theme]);

  // pointer-tracking 3D tilt on cards
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;
    const sel = ".node-card, .mode-btn, .about-card, .shop-card, .boss-card, .record-tile, .char-card, .foot-card";
    let el = null;
    const move = (e) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg) translateY(-3px)`;
    };
    const over = (e) => {
      const t = e.target.closest?.(sel);
      if (t !== el) {
        if (el) el.style.transform = "";
        el = t;
      }
    };
    const out = (e) => {
      if (el && !el.contains(e.relatedTarget)) {
        el.style.transform = "";
        el = null;
      }
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", out);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", out);
    };
  }, []);

  function recordStat(section, q, ok, topic) {
    setStats((s) => {
      const cur = s[q.question] || { right: 0, wrong: 0, section, topic, q };
      return { ...s, [q.question]: { ...cur, q, section, topic: topic || cur.topic || section, right: cur.right + (ok ? 1 : 0), wrong: cur.wrong + (ok ? 0 : 1) } };
    });
  }

  const progressMsg = slow
    ? "Waking the ship's engines. The first launch of the day can take a minute."
    : progress < 30 ? "Scanning your notes" :
      progress < 60 ? "Forging enemies" :
      progress < 90 ? "Charting your mission" :
      "Almost there";

  // Attaching a file does not touch the notes box. A PDF can be twenty thousand
  // words and burying the Launch button under all of it defeats the point of
  // uploading in the first place. Each file reads on its own, so a slow one
  // never holds up the rest.
  function addFiles(list) {
    const good = list.filter(isReadable);
    if (good.length < list.length) setError("Only .txt, .md and .pdf files can be read.");
    else if (good.length) setError("");

    for (const file of good) {
      // Dropping the same file twice would send its text twice.
      if (files.some((f) => f.name === file.name)) continue;
      const id = newId();
      setFiles((fs) => [...fs, { id, name: file.name, status: "reading", text: "", note: "" }]);
      readFile(file)
        .then((text) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, status: "ready", text } : f))))
        .catch((err) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, status: "error", note: err.message } : f))));
    }
  }

  function removeFile(id) {
    setFiles((fs) => fs.filter((f) => f.id !== id));
  }

  const [dragging, dropProps] = useFileDrop(addFiles);

  // Dropping a file anywhere else makes the browser open it and throw away
  // everything you had typed, so we swallow those drops.
  useEffect(() => {
    const stop = (e) => e.preventDefault();
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);

  // What actually gets sent: the box first, then each file under its own name
  // so the AI can tell one document from another.
  const ready = files.filter((f) => f.status === "ready");
  const allNotes = [notes.trim(), ...ready.map((f) => `[${f.name}]\n${f.text}`)].filter(Boolean).join("\n\n");
  const readingFiles = files.some((f) => f.status === "reading");

  async function buildPlan() {
    setLoading(true);
    setError("");
    setProgress(5);
    setSlow(false);
    const slowT = setTimeout(() => setSlow(true), 8000);
    const timer = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.random() * 7 : p));
    }, 500);
    try {
      const res = await fetch(`${API}/api/lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: allNotes, days }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.days) throw new Error("Unexpected response. Restart the server.");
      setProgress(100);
      const mission = {
        id: newId(),
        title: data.title || data.days[0]?.title || "Mission",
        createdAt: Date.now(),
        plan: data,
        doneSections: [],
        notes: allNotes.slice(0, MAX_CHARS),
      };
      setMissions((ms) => [mission, ...ms]);
      setTimeout(() => setActiveId(mission.id), 350);
      setNotes("");
      setFiles([]);
    } catch (err) {
      setError("Couldn't build your quest: " + err.message);
    }
    clearTimeout(slowT);
    setSlow(false);
    clearInterval(timer);
    setLoading(false);
  }

  async function buildExam() {
    setExamLoading(true);
    setError("");
    setSlow(false);
    const slowT = setTimeout(() => setSlow(true), 8000);
    try {
      const res = await fetch(`${API}/api/exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: examTopic, count: examCount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.questions?.length) throw new Error("Unexpected response. Restart the server.");
      const mission = {
        id: newId(),
        exam: true,
        title: data.title || examTopic,
        createdAt: Date.now(),
        questions: data.questions,
        timer: examTimer,
        lastScore: null,
      };
      setMissions((ms) => [mission, ...ms]);
      setActiveId(mission.id);
      setExamTopic("");
    } catch (err) {
      setError("Couldn't build your exam: " + err.message);
    }
    clearTimeout(slowT);
    setSlow(false);
    setExamLoading(false);
  }

  function deleteMission(id) {
    if (!window.confirm("Delete this mission? Your XP and stats are kept.")) return;
    setMissions((ms) => ms.filter((m) => m.id !== id));
    if (activeId === id) setActiveId(null);
  }

  const allTopics = plan
    ? plan.days.flatMap((d) => d.sections.map((s) => s.title)).join(", ")
    : "";
  const allQuestions = plan
    ? plan.days.flatMap((d) => d.sections.flatMap((s) => s.questions))
    : [];

  const section = battle && !battle.boss && !battle.revenge
    ? plan?.days?.[battle.dayIdx]?.sections?.[battle.secIdx] ?? null
    : battle?.revenge
      ? {
          title: battle.ambush ? "Ninja Ambush!" : `Revenge: ${battle.topic}`,
          questions: battle.ambush ? ambushQuestions() : topicQuestions(battle.topic),
        }
      : null;

  function finishSection(reward) {
    const id = `${battle.dayIdx}-${battle.secIdx}`;
    setMissions((ms) => ms.map((m) =>
      m.id === activeId && !m.doneSections.includes(id)
        ? { ...m, doneSections: [...m.doneSections, id] }
        : m
    ));
    setXp((x) => x + reward);
    bumpQuest();
    setBattle(null);
  }

  return (
    <div className="layout">
      <SpaceDecor />
      <header className="topbar">
        <button className="menu-fab" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          <Icon name="menu" size={20} />
          {streak.last !== localDate(0) && !menuOpen && <span className="nav-dot fab-dot" aria-hidden="true" />}
        </button>
        <div className="side-logo"><span className="logo-mark"><Icon name="rocket" size={18} /></span><span className="wordmark">Teach<span>Back</span></span></div>
        <div className="side-xp tnum" aria-label={`${xp} experience points`}>{xp} XP</div>
        <div className="vol-ctl">
          <button
            className="menu-fab"
            aria-label={profile.volume > 0 ? "Mute sounds" : "Unmute sounds"}
            aria-pressed={profile.volume === 0}
            onClick={() => setProfile({ ...profile, volume: profile.volume > 0 ? 0 : 0.7 })}
          >
            <Icon name={profile.volume > 0 ? "volume" : "volumeX"} size={18} />
          </button>
          <input
            type="range"
            className="vol-slider"
            min="0"
            max="100"
            value={Math.round((profile.volume ?? 0.7) * 100)}
            aria-label="Volume"
            onChange={(e) => setProfile({ ...profile, volume: Number(e.target.value) / 100 })}
          />
        </div>
      </header>

      {saveWarning && <div className="error" role="status">{saveWarning}</div>}

      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="drawer-head">
          <div className="side-logo"><span className="logo-mark"><Icon name="rocket" size={20} /></span><span className="wordmark">Teach<span>Back</span></span></div>
          <button className="menu-fab" aria-label="Close menu" onClick={() => setMenuOpen(false)}><Icon name="x" size={18} /></button>
        </div>
        <button className={`nav-btn ${page === "home" ? "active" : ""}`} onClick={() => go("home")}>
          <Icon name="home" /> Home
        </button>
        <button className={`nav-btn ${page === "streak" ? "active" : ""}`} onClick={() => go("streak")}>
          <Icon name="flame" /> Streak
          {streak.last !== localDate(0) && <span className="nav-dot" aria-hidden="true" />}
        </button>
        <button className={`nav-btn ${page === "stats" ? "active" : ""}`} onClick={() => go("stats")}>
          <Icon name="stats" /> Stats
        </button>
        <button className={`nav-btn ${page === "shop" ? "active" : ""}`} onClick={() => go("shop")}>
          <Icon name="shop" /> Shop
        </button>
        <button className={`nav-btn ${page === "player" ? "active" : ""}`} onClick={() => go("player")}>
          <Icon name="player" /> Player
        </button>
        {cloudOn && (
          <button className={`nav-btn ${page === "account" ? "active" : ""}`} onClick={() => go("account")}>
            <Icon name="about" /> {user ? "Account" : "Sign in"}
          </button>
        )}
        <div className="side-xp tnum" aria-label={`${xp} experience points`}>{xp} XP</div>
      </aside>

      <main className="main">
        {page === "account" && <AccountPage user={user} onBack={() => go("home")} />}

        {page === "about" && (
          <>
            <div className="row" style={{ marginTop: 0, marginBottom: 14 }}>
              <button className="btn ghost" onClick={() => go("home")}>← Back to home</button>
            </div>
            <div className="hero-card">
              <h1>About TeachBack</h1>
              <p className="sub">
                TeachBack was created by Dono and Casper, two students at
                HackHarvard Hangzhou 2026. We noticed a problem every student
                faces: hours of studying with no way to know if you actually
                understand. So we turned studying into a space adventure, and
                made the final exam a boss you can only beat by teaching.
              </p>
            </div>
            <div className="about-grid">
              <div className="about-card">
                <Icon name="file" size={22} />
                <h3>Paste anything</h3>
                <p>Notes, textbook pages, vocab lists. Our AI turns them into a mission across days.</p>
              </div>
              <div className="about-card">
                <Icon name="rocket" size={22} />
                <h3>Battle to learn</h3>
                <p>Quiz battles, speed rounds, flashcards, and matching. Right answers deal damage!</p>
              </div>
              <div className="about-card">
                <Icon name="stats" size={22} />
                <h3>Know your weak spots</h3>
                <p>We track every answer and show exactly which words you keep missing.</p>
              </div>
              <div className="about-card">
                <Icon name="flame" size={22} />
                <h3>The final boss</h3>
                <p>Explain everything in your own words. An AI grades you. The Feynman technique, as a game.</p>
              </div>
            </div>
            <div className="hero-card" style={{ marginTop: 16 }}>
              <h2>FAQ</h2>
              <Faq />
            </div>
          </>
        )}

        {page === "stats" && !battle && (
          <StatsPage
            stats={stats}
            topics={revengeTopics}
            onRevenge={(topic) => { setPage("home"); setBattle({ revenge: true, mode: "quiz", topic }); }}
          />
        )}

        {page === "streak" && <StreakPage streak={streak} setStreak={setStreak} setXp={setXp} quest={quest} onQuestClaim={claimQuest} />}


        {page === "shop" && <ShopPage xp={xp} setXp={setXp} profile={profile} setProfile={setProfile} />}

        {page === "player" && <PlayerPage xp={xp} profile={profile} setProfile={setProfile} stats={stats} doneSections={doneSections} />}

        {page === "home" && !activeMission && !battle && !castMission && (
          <>
            <div className={`hero-card dropcard ${dragging ? "over" : ""}`} {...dropProps}>
              <h1>Your notes. Your mission.</h1>
              <p className="sub">
                Paste your study material, or drop a file straight onto this card.
                Long documents stay out of the box, so a whole textbook is one drag.
              </p>
              <textarea
                rows={8}
                aria-label="Study notes"
                placeholder="Paste your study notes here, or drop a file anywhere on this card"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="row">
                <label className="upload-label">Add a file
                  <input
                    type="file"
                    accept={ACCEPT}
                    multiple
                    onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }}
                    hidden
                  />
                </label>
                <span className="file-note">or drag one in. .txt, .md, .pdf</span>
                <LectureRecorder onText={(t) => setNotes((n) => (n ? n + "\n" + t : t))} />
              </div>

              <FileList files={files} onRemove={removeFile} />

              {allNotes.length > MAX_CHARS && (
                <p className="file-note" style={{ display: "block", marginTop: 10 }}>
                  That is {allNotes.length.toLocaleString()} characters. The first{" "}
                  {MAX_CHARS.toLocaleString()} will be used, which is plenty for a mission.
                </p>
              )}

              {dragging && <div className="dropveil">Drop it here</div>}

              <div className="row">
                <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  <option value={1}>1 day sprint</option>
                  <option value={3}>3 days</option>
                  <option value={7}>1 week</option>
                  <option value={14}>2 weeks</option>
                </select>
                <button className="btn" onClick={buildPlan} disabled={loading || readingFiles || !allNotes.trim()}>
                  {loading ? "Building your mission" : readingFiles ? "Reading your file" : "Launch mission"}
                </button>
              </div>
              {loading && (
                <div className="progress-wrap">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="progress-msg">{progressMsg}</div>
                </div>
              )}
              {error && <div className="error">{error}</div>}
            </div>

            <div className="hero-card" style={{ marginTop: 16 }}>
              <h2>Instant mock exam</h2>
              <p className="sub" style={{ marginBottom: 10 }}>
                No notes needed. Name any topic and get a full practice exam with explanations.
              </p>
              <input
                type="text"
                aria-label="Exam topic"
                placeholder="e.g. SSAT math, long division and remainders"
                value={examTopic}
                onChange={(e) => setExamTopic(e.target.value)}
              />
              <div className="row">
                <select value={examCount} onChange={(e) => setExamCount(Number(e.target.value))} aria-label="Number of questions">
                  <option value={10}>10 questions</option>
                  <option value={15}>15 questions</option>
                  <option value={20}>20 questions</option>
                </select>
                <select value={examTimer} onChange={(e) => setExamTimer(Number(e.target.value))} aria-label="Timer per question">
                  <option value={0}>No timer</option>
                  <option value={30}>30s per question</option>
                  <option value={60}>60s per question</option>
                </select>
                <button className="btn" onClick={buildExam} disabled={examLoading || loading || !examTopic.trim()}>
                  {examLoading ? "Writing your exam" : "Create exam"}
                </button>
              </div>
              {examLoading && slow && (
                <div className="progress-msg" style={{ marginTop: 12 }}>Waking the ship's engines. The first launch of the day can take a minute.
                </div>
              )}
            </div>

            {missions.length > 0 && (
              <div className="hero-card" style={{ marginTop: 16 }}>
                <h2>Mission library</h2>
                <div className="lib-list">
                  {missions.map((m) => {
                    const totalSecs = m.exam ? 0 : m.plan.days.reduce((n, d) => n + d.sections.length, 0);
                    return (
                      <div className="lib-row" key={m.id}>
                        <div className="lib-icon"><Icon name={m.exam ? "file" : "rocket"} size={20} /></div>
                        <div className="lib-main">
                          <h3>{m.title}</h3>
                          <div className="meta tnum">
                            {m.exam
                              ? `Mock exam · ${m.questions.length} questions${m.lastScore != null ? ` · best ${m.lastScore}%` : ""}`
                              : `${m.plan.days.length} day${m.plan.days.length === 1 ? "" : "s"} · ${m.doneSections.length}/${totalSecs} battles won`}
                          </div>
                        </div>
                        <button className="btn sm" onClick={() => setActiveId(m.id)}>{m.exam ? "Take exam" : "Resume"}</button>
                        <button className="btn sm ghost" aria-label={`Delete ${m.title}`} onClick={() => deleteMission(m.id)}>✕</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="foot-grid">
              <button type="button" className="foot-card" style={{ "--char-tint": "#a78bfa" }} onClick={() => go("about")}>
                <span className="icon-svg"><Icon name="about" size={30} /></span>
                <h3>About us</h3>
                <p>Meet the crew, how TeachBack works, and the FAQ.</p>
              </button>
            </div>
          </>
        )}

        {page === "home" && activeMission?.exam && !battle && !castMission && (
          <ExamRun
            key={activeMission.id}
            mission={activeMission}
            onStat={(q, ok) => recordStat(activeMission.title, q, ok, activeMission.title)}
            onFinish={(pct, xpGain) => {
              setXp((x) => x + xpGain);
              bumpQuest();
              setMissions((ms) => ms.map((m) =>
                m.id === activeMission.id
                  ? { ...m, lastScore: m.lastScore == null ? pct : Math.max(m.lastScore, pct) }
                  : m
              ));
              setActiveId(null);
            }}
            onExit={() => setActiveId(null)}
          />
        )}

        {page === "home" && castMission && !battle && (
          <Podcast mission={castMission} onBack={() => setCastId(null)} />
        )}

        {page === "home" && sheetMission && !battle && (
          <StudySheet mission={sheetMission} onBack={() => setSheetId(null)} />
        )}

        {page === "home" && plan && !battle && !sheetMission && !castMission && (
          <>
            <div className="hero-card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h2>{activeMission.title}</h2>
              <div className="row" style={{ margin: 0 }}>
                <button className="btn ghost" onClick={() => openSheet(activeMission)} disabled={sheetLoading}>
                  {sheetLoading ? "Summarizing" : "Study sheet"}
                </button>
                <button className="btn ghost" onClick={() => setCastId(activeMission.id)}>Listen</button>
                <button className="btn ghost" onClick={() => setActiveId(null)}>Library</button>
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            {missCount >= 3 && !ambushReady && (
              <div className="ninja-warn">The Ninja is watching {5 - missCount} more {5 - missCount === 1 ? "miss" : "misses"} and he strikes!
              </div>
            )}
            {ambushReady && (
              <div className="ninja-warn hot">The Ninja blocks your path. Your next battle is an AMBUSH! Defeat him to reach the boss.
              </div>
            )}
            {plan.days.map((d, di) => (
              <div key={di}>
                <div className="day-label">DAY {d.day} · {d.title}</div>
                {d.sections.map((s, si) => {
                  const id = `${di}-${si}`;
                  const done = doneSections.includes(id);
                  const planet = PLANETS[(di * 2 + si) % PLANETS.length];
                  return (
                    <div className="node" key={si}>
                      <button type="button" className={`node-card ${done ? "done" : ""}`} onClick={() => startStoryBattle(di, si)}>
                        <div className="planet" aria-hidden="true">{done ? "✓" : planet}</div>
                        <div>
                          <h3>{s.title}</h3>
                          <div className="meta">{s.questions.length} enemies · tap to battle</div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="boss-row">
              <button type="button" className="boss-card" onClick={startBoss}>
                <div className="boss-card-pixel"><PixelSprite id="voidlord" size={78} /></div>
                <h3>FINAL BOSS</h3>
                <p>Teach it back in your own words. The AI grades you.</p>
              </button>
              {activeMission?.bossBeaten && (
                <button type="button" className="boss-card class-card" onClick={() => setBattle({ classroom: true })}>
                  <div className="boss-card-pixel class-card-kids">
                    <PixelSprite id="bob" size={44} />
                    <PixelSprite id="max" size={44} />
                    <PixelSprite id="einstein" size={44} />
                  </div>
                  <h3>YOUR CLASSROOM</h3>
                  <p>Four students, four questions. Explain until they get it.</p>
                </button>
              )}
            </div>
          </>
        )}

        {battle?.classroom && (
          <Classroom
            mission={activeMission}
            character={profile.character}
            onStat={recordStat}
            onDone={(xp) => { setXp((x) => x + xp); bumpQuest(); setBattle(null); }}
            onExit={() => setBattle(null)}
          />
        )}

        {battle && !battle.boss && !battle.classroom && !battle.mode && (
          <div className="hero-card">
            <h1>{section.title}</h1>
            <p className="sub">Choose how you want to train:</p>
            <div className="mode-grid">
              <button className="mode-btn" onClick={() => setBattle({ ...battle, mode: "quiz" })}>
                                <h3>Quiz Battle</h3>
                <p>Classic fight. 3 hearts.</p>
              </button>
              <button className="mode-btn" onClick={() => setBattle({ ...battle, mode: "speed" })}>
                                <h3>Speed Round</h3>
                <p>{profile.owned.includes("warp") ? "20" : "15"} seconds per question!</p>
              </button>
              <button className="mode-btn" onClick={() => setBattle({ ...battle, mode: "cards" })}>
                
                <h3>Flashcards</h3>
                <p>Flip, learn, repeat.</p>
              </button>
              <button className="mode-btn" onClick={() => setBattle({ ...battle, mode: "match" })}>
                                <h3>Matching</h3>
                <p>Pair questions and answers.</p>
              </button>
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setBattle(null)}>Back to map</button>
            </div>
          </div>
        )}

        {battle?.revenge && !battle.cut && (
          <CutScene
            name={battle.ambush ? "Ninja Ambush!" : "The Red-Eye Ninja"}
            subtitle={battle.ambush ? "He collects every dropped question" : "Keeper of your missed questions"}
            accent="#ff2e3f"
            sprite={<PixelSprite id="ninja" size={120} />}
            lines={battle.ambush ? [
              "Five questions dropped I felt every one.",
              "You will not face the Void Lord unworthy.",
              "Prove yourself here, or fall.",
            ] : [
              "You dropped these questions, scholar",
              "I sharpened every one into a blade.",
              "Take them back, if you can.",
            ]}
            onDone={() => setBattle((b) => ({ ...b, cut: true }))}
          />
        )}

        {battle && !battle.boss && !battle.classroom && (battle.mode === "quiz" || battle.mode === "speed") && (!battle.revenge || battle.cut) && (
          <Battle
            key={battle.revenge ? "revenge" : battle.mode + battle.dayIdx + "-" + battle.secIdx}
            section={section}
            speed={battle.mode === "speed"}
            revenge={!!battle.revenge}
            reward={battle.revenge ? 25 : battle.mode === "speed" ? 20 : 15}
            extraHeart={profile.owned.includes("heart")}
            armour={profile.armour ?? 0}
            warp={profile.owned.includes("warp")}
            character={profile.character}
            xp={xp}
            onHint={() => setXp((x) => x - 5)}
            onStat={(q, ok) => {
              if (battle.revenge) {
                recordStat(stats[q.question]?.section || "Revenge Round", q, ok, stats[q.question]?.topic || activeMission?.title);
              } else {
                recordStat(section.title, q, ok, activeMission?.title);
                if (!ok) bumpMiss();
              }
            }}
            onWin={() => {
              if (battle.revenge) {
                setXp((x) => x + 25);
                bumpQuest();
                if (battle.ambush) clearAmbush();
                setBattle(null);
              } else {
                finishSection(battle.mode === "speed" ? 20 : 15);
              }
            }}
            onExit={() => setBattle(null)}
          />
        )}

        {battle && !battle.boss && !battle.classroom && battle.mode === "cards" && (
          <Flashcards
            section={section}
            onStat={(q, ok) => recordStat(section.title, q, ok, activeMission?.title)}
            onDone={() => { setXp((x) => x + 10); setBattle(null); }}
            onExit={() => setBattle(null)}
          />
        )}

        {battle && !battle.boss && !battle.classroom && battle.mode === "match" && (
          <Matching
            section={section}
            onStat={(q, ok) => recordStat(section.title, q, ok, activeMission?.title)}
            onDone={() => { setXp((x) => x + 10); setBattle(null); }}
            onExit={() => setBattle(null)}
          />
        )}

        {battle && battle.boss && (
          <BossBattle
            topics={allTopics}
            character={profile.character}
            questions={allQuestions}
            onStat={(q, ok) => recordStat("Boss brawl", q, ok, activeMission?.title)}
            onDone={(xpGain, reviewQs, wonBrawl) => {
              setXp((x) => x + xpGain);
              if (wonBrawl) {
                bumpQuest();
                setMissions((ms) => ms.map((m) => (m.id === activeId ? { ...m, bossBeaten: true } : m)));
              }
              reviewQs.forEach((rq) => recordStat("Boss review", rq, false, activeMission?.title));
              setBattle(null);
            }}
            onExit={() => setBattle(null)}
          />
        )}
      </main>
    </div>
  );
}
