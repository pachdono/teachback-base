# TeachBack, backend and data half

**How to use this:** paste this file into an AI assistant along with `server.js`,
`src/App.jsx` and `src/supabase.js`, and say:

> This is a project I built with a teammate. I own the backend and data half.
> Quiz me on it, one question at a time, and tell me when my answer is wrong or
> incomplete.

Casper owns the game and visuals: battles, the boss fight, sprites, effects, the
mission map. If asked about those, hand over. That is normal on a real team.

---

# 0. What changed since the first version

The project moved out of one 3,000 line file into modules, and several things were
added. If you studied the older notes, this is what is new.

| New | Where | Whose |
|---|---|---|
| Split into modules | `src/*.jsx` | both |
| Record a lecture | `src/Listen.jsx` | **yours** |
| Listen to an episode | `src/Listen.jsx` + `/api/podcast` | **yours** |
| Accounts and leaderboard | `src/supabase.js`, `src/Account.jsx` | **yours** |
| Server hardening | `server.js` | **yours** |
| Classroom mode | `src/Classroom.jsx`, 2 endpoints | **yours** |
| Themes change the whole world | `Pages.jsx`, `App.jsx` | Casper's |

Almost all of it landed on your side, so read sections 6 to 8 carefully.

## The files

| File | Lines | What |
|---|---|---|
| `src/App.jsx` | 888 | Shell: state, routing, the seven fetches |
| `src/Pages.jsx` | 746 | Stats, exams, study sheet, shop, streak, player, FAQ |
| `src/BossBattle.jsx` | 551 | Boss fight, cutscene, Void Gauntlet |
| `src/Battle.jsx` | 453 | Battle, attack effects, dodge, victory |
| `src/Listen.jsx` | 309 | **Recording and the audio episode** |
| `server.js` | 273 | **Seven endpoints** |
| `src/sprites.jsx` | 235 | Pixel art |
| `src/game.js` | 190 | Shared helpers |
| `src/Classroom.jsx` | 182 | **Classroom mode** |
| `src/Account.jsx` | 146 | **Sign in and leaderboard** |
| `src/ui.jsx` | 106 | Icons, background |
| `src/supabase.js` | 56 | **Database client** |

---

# 1. Why there is a backend at all

**The question you are most likely to get first.**

The app is React in a browser. Why not call the AI straight from there?

**Because the API key would be in the browser.** Anything shipped to the client
can be read by anyone who opens DevTools. They take the key and spend your money.

So the key lives on a server you control. The browser talks to your server, your
server talks to Anthropic.

```
Browser  --POST /api/lesson-->  Your server  --with API key-->  Anthropic
(no key)                        (has the key)                   (returns JSON)
```

---

# 2. `server.js`, all 273 lines

```
1-36     setup        imports, CORS allowlist, body cap, rate limit, client
38       MAX_NOTES    input cap
41-58    helpers      userError, fail, pickText
60-66    safeParse    cleans the reply into parseable JSON
68-102   /api/lesson     notes + days   -> the study plan
104-126  /api/exam       topic + count  -> mock exam
128-150  /api/summary    material       -> study sheet
152-172  /api/grade      explanation    -> score and gaps    <- the teach back
174-201  /api/podcast    material       -> two host script
203-230  /api/classroom  material       -> four students and their questions
232-262  /api/classanswer question+answer -> score, reaction, missing
264-271  error handler
273      app.listen
```

**Every endpoint is the same three steps:** read `req.body`, ask Claude,
`safeParse` the reply into `res.json`. Say that and you have described most of
the file.

## Setup, and why each line is there

```js
import "dotenv/config";        // reads .env into process.env
const client = new Anthropic(); // reads process.env.ANTHROPIC_API_KEY
```

`import "dotenv/config"` imports no variable. It runs for its side effect. It
must come **before** `new Anthropic()`, which reads the key the moment it runs.

**CORS (lines 10 to 21).** The front end is on port 5174, the server on 3001.
Different port means different origin, and browsers block that by default. The
allowlist accepts any `localhost:<port>` during development plus anything in
`ALLOWED_ORIGINS`.

> Good follow up: *why does removing CORS break the browser but not curl?*
> Because the same origin policy is a **browser** rule. The server always sends
> the data. CORS headers only tell the browser it is allowed to hand it over.

**Body cap (line 23).** `express.json({ limit: "1mb" })`. Without a cap one
request can send unlimited text straight into a paid API call.

**Rate limit (lines 26 to 34).** A `Map` of `ip -> { n, reset }`. Twenty requests
a minute, then 429. Generation is slow and costs money, so nothing should be able
to loop on it.

## `safeParse` (60 to 66)

You ask for JSON and sometimes get prose and markdown fences around it. So: strip
the fences, find the **first `{`** and the **last `}`**, keep what is between,
parse that.

**Why `lastIndexOf("}")` and not `indexOf`?** The JSON has nested objects, so
there are many closing braces. You want the outermost one.

## `pickText` (53 to 58)

```js
const block = msg.content.find((b) => b.type === "text");
```

A Claude reply's `content` is an **array of blocks**. The obvious version is
`msg.content[0].text`, which works today but breaks the moment a model returns a
thinking block first. Finding it by type is safe either way. It also throws a
clear message when `stop_reason` is `max_tokens`, instead of a confusing JSON
parse error.

## `userError` and `fail` (41 to 51)

Errors you wrote are safe to show. Anything else, including SDK internals and
stack traces, gets logged on the server and the browser sees a generic message.

## The seven endpoints

| Endpoint | Input | Output | max_tokens | Method |
|---|---|---|---|---|
| `/api/lesson` | `notes`, `days` | the plan tree | 30000 | `.stream()` |
| `/api/exam` | `topic`, `count` | mock exam | 24000 | `.stream()` |
| `/api/summary` | `material`, `title` | study sheet | 8000 | `.stream()` |
| `/api/grade` | `topic`, `explanation` | score and gaps | 3000 | `.create()` |
| `/api/podcast` | `material`, `title` | two host script | 6000 | `.stream()` |
| `/api/classroom` | `topic`, `material` | four students | 4000 | `.stream()` |
| `/api/classanswer` | `question`, `explanation` | score and reaction | 1200 | `.create()` |

**Why POST and not GET?** You are sending a body that can be thousands of
characters. GET puts data in the URL, which has length limits and would put the
notes in browser history and server logs.

**Why does one use `.create()`?** Streaming exists to stop a long generation
hitting an HTTP timeout. `/api/grade` is only 3,000 tokens, fast enough not to
need it.

## The sizing logic in `/api/lesson`

```js
const perDay = days === 1 ? 2 : 3;
const totalSections = Math.min(days * perDay, 16);
const qPer = days === 1 ? "7-9" : "4-6";
```

A one day cram gets 2 sections of 7 to 9 questions, drilled harder. A longer plan
gets 3 sections of 4 to 6 per day. Capped at 16 so a 30 day plan does not request
90 sections and blow past `max_tokens`.

**Worth saying:** your code decides the shape, the prompt only states it. How big
a study plan should be is a product decision, so it lives in JavaScript.

## Why each prompt line exists

| Prompt line | Its job |
|---|---|
| `Keep every question under 20 words` | Long questions overflow the battle UI |
| `"answer" = correct index` for multiple choice | Defines the contract |
| `"accept": alternative correct answers` | Feeds answer matching, so "Au" passes for "gold" |
| `MUST include an "explanation" ... show the method` | The teaching part: how, not just what |
| `MUST include a "hint" ... WITHOUT revealing the answer` | Powers the buy a hint feature |
| `Return JSON exactly like: {...}` | **The most important line in the file** |

That last one is a literal template of the exact shape wanted. Describing a
structure in words is unreliable. Showing one example is not.

---

# 3. Your logic in `src/App.jsx`

| Line | What |
|---|---|
| 62 | `openSheet()`, client side of `/api/summary`, with caching |
| 85 | `revengeByTopic`, groups weak questions by topic |
| 96 | `topicQuestions()`, worst 12 for one topic |
| 115 | `ambushQuestions()`, the ninja's set |
| 183 | pulls the cloud save on sign in |
| 209 | the `localStorage` write |
| 221 | pushes the save to the cloud |
| 270 | `recordStat()`, logs right and wrong per question |
| 284 | `handleFile()`, reads txt, md and PDF |
| 316 | `buildPlan()`, client side of `/api/lesson` |
| 355 | `buildExam()`, client side of `/api/exam` |

## `isRightAnswer` (`game.js` line 170), know this one cold

Three layers, in order:

1. **Normalise both sides and compare.** `normAns()` strips what should not
   decide right from wrong: capitals, punctuation, extra spaces, a leading
   "the"/"a"/"an", and it turns number words into digits so "eight" becomes "8".
2. **Check the `accept` list**, the alternatives you asked the AI for. That is
   how "Au" passes for "gold".
3. **Numeric fallback.** If the answer contains a digit, pull the last number out
   of what was typed, so `x = 4` still matches `4`.

**"Why not just compare the strings?"** Because "Mitochondria" and "the
mitochondria!" are the same answer, and failing a student on punctuation teaches
them nothing.

## The stats and revenge pipeline

`recordStat` writes `stats[q.question] = { right, wrong, topic, q }`. A question
counts as a weakness when:

```js
v.wrong > 0 && v.wrong >= v.right
```

Get it wrong once then right twice and it drops off. It forgives you once you
have actually learned it.

**"How do you know what the student is weak at?"** *We do not ask. We count.*

## The progress bar is fake, say so

`buildPlan` creeps to 90% on `p + Math.random() * 7` every 500ms and only jumps
to 100 when the response lands. There is no progress signal, it is one HTTP call.
It exists so a 30 second wait does not look frozen. Say that plainly if asked.

---

# 4. Recording a lecture (`src/Listen.jsx` line 13)

**No API cost.** The browser's `SpeechRecognition` does the transcription.

How it works:

- `getUserMedia` opens the mic, `MediaRecorder` captures the audio so you can
  play it back, `SpeechRecognition` transcribes at the same time
- `continuous: true` keeps it going through pauses
- `interimResults: true` shows words before the sentence is finished
- Chrome stops listening on its own after silence, so `onend` restarts it while
  recording is still on
- On stop you get a **review panel**: an audio player, the transcript in an
  editable box, and Add to notes or Discard

**The bug worth explaining.** Speech recognition marks text `isFinal` only after
a clear pause. The first version saved only the final text, so stopping mid
sentence threw away everything you had just said, which left the notes box empty
and the Launch button disabled. It now keeps `finalRef + interimRef`, so nothing
is lost.

**Why the review step matters:** speech recognition mangles technical words, and
those words become quiz questions. Letting you fix them first is the difference
between a useful feature and a broken one.

---

# 5. The audio episode (`src/Listen.jsx` line 161, `/api/podcast`)

Two halves:

**Server.** `/api/podcast` asks for a two host script, one explaining and one
asking the questions a confused student would ask. The prompt says to write it to
be **listened to**: short sentences, no bullets, no headings, no symbols. That
matters because the text is going through a speech synthesiser, which reads
punctuation badly.

**Browser.** `speechSynthesis` reads it aloud. `getVoices()` lists what the
machine has, and you pick a different voice per speaker. `speakFrom(i)` speaks
line `i` then chains to `i + 1` in its `onend`, so it plays through by itself.
Clicking any line calls `playFrom(i)` and starts there. Stopping keeps the
position so the button becomes Resume.

**Caveat to know:** voices come from the operating system, so the list is
different on every machine. Do not hard code a voice name.


---

# 5b. Classroom mode, the harder Feynman test

**This is the newest feature and the best one to talk about.** It unlocks on the
map once the boss is beaten.

## Why it exists

The boss lets you recite. You prepare one explanation of the whole topic and
deliver it. That is useful, but you can pass it with something rehearsed.

The classroom does not let you do that. **Four students ask their own questions
and you do not get to choose them.** Answering an unexpected question is the real
test of understanding, which is the actual claim of the Feynman technique.

## How it works, two calls not one

**`/api/classroom`** (server line 203) builds the class once. The prompt asks for
four students with a name, a mood and one question each, and explicitly asks for
**escalating difficulty**:

> the first is a simple "what does that mean", the last should probe a
> misconception or ask why something is true rather than what it is

That single instruction is what turns it from four random questions into a
lesson. In testing it produced "what even is a chloroplast" first and "why does
chlorophyll only absorb red and blue light" last.

**`/api/classanswer`** (server line 232) marks one answer at a time. Small and
fast, so it uses `.create()` rather than streaming.

**Why two endpoints instead of one conversation?** A conversation would mean
sending the whole history every turn, which grows with each answer and costs more
each time. Generating the questions once and marking each answer independently
keeps every request small and means a failed mark does not lose the class.

## The rubric is the interesting part

```
Judge only whether a curious beginner would now understand.
Reward plain language and a concrete example.
Do not reward jargon, and do not punish informality.
```

**This deliberately inverts normal marking.** A more technically precise answer
can score lower. Two real results from testing the same question:

| Answer | Score | Verdict |
|---|---|---|
| "a tiny green factory inside a plant cell that catches sunlight" | **88** | understood |
| "a plastid organelle with thylakoid membranes where the light dependent reactions occur" | **30** | confused |

The second is arguably more correct and it fails, because the student says "I
don't know what a plastid or thylakoid is, so that didn't help me much".

> **Say this on stage.** It is the clearest demonstration that the app measures
> understanding rather than recall, and you can show it live in twenty seconds.

## The reply is in the student's voice

`reaction` is not feedback from a marker, it is the student replying in one
sentence, either getting it or naming exactly what still confuses them. That is a
prompt choice, not a code choice, and it is what makes the mode feel like
teaching rather than being graded.

## One retry, then it stands

`next()` in `Classroom.jsx` line 66. If a student did not understand and you have
not retried yet, it resets and lets you rephrase. Second time, their verdict is
recorded either way. XP is `30 + 15 per student convinced`, so 30 to 90.

---

# 6. Accounts and the database (`src/supabase.js`, `src/Account.jsx`)

## The tables

```sql
saves  (user_id uuid primary key, data jsonb, updated_at)
scores (user_id uuid primary key, name text, xp integer, updated_at)
```

The whole save is **one JSON blob** in `data`, the same object already kept in
`localStorage`. No schema design needed, and adding a field to the game does not
need a migration.

## Row level security, the part that matters

```sql
create policy "own save" on saves
  for all using (auth.uid() = user_id);

create policy "read scores" on scores for select using (true);
```

**The anon key in the front end is public by design.** What protects the data is
the database refusing the query. You can prove it: query `saves` with the public
key and no login and you get `[]` back, even though rows exist.

> If asked *"is that key not exposed?"*: yes, and that is expected. Row level
> security is what stops one player reading another player's row, not the app
> being careful.

## How the sync works

- **Signed out:** exactly as before, `localStorage` only.
- **On sign in:** compares the cloud save with the local one and keeps whichever
  has more XP, so playing signed out first does not lose progress.
- **While playing:** the save is pushed **four seconds after you stop changing
  things**, not on every click. A run of quick wins is one write.
- **If Supabase is down:** every cloud call is wrapped so it fails quietly. The
  local save still happens and the game keeps working.
- **If the keys are missing:** `cloudOn` is false, the Sign in menu entry is
  hidden, and the app behaves exactly as it did before accounts existed.

**The honest gap:** two devices at once means last write wins. Proper merging
needs per field timestamps and was not worth building. Comparing XP on sign in
covers the normal case, which is playing in one place at a time.


---

# 10. What broke during the build, and why

Worth knowing because these are honest engineering answers, and because you will
be asked what went wrong.

## Three blank screens, one root cause

The app was originally one 3,000 line file. Splitting it into modules moved the
components but left some of their **references** behind:

| Error | Where | Why |
|---|---|---|
| `ComicArt is not defined` | Player page | Component was dropped, two calls to it stayed |
| `CutScene is not defined` | Revenge ninja | Lives in `BossBattle.jsx`, was never exported |
| `useEffect is not defined` | Mock exam | `Pages.jsx` imported only `useState` |

**Every one of them was a blank screen, and every one built fine.** That is the
lesson: `vite build` only checks that the code parses and imports resolve. A name
that does not exist inside a component is a **runtime** error, so it only appears
when that component actually renders.

**What we did about it.** Rather than fix them one at a time, we wrote two sweeps
over every file: one collecting every `<Component>` used and checking it is
imported or defined locally, one doing the same for React hooks. Both now report
clean.

> **If asked "how do you test it?"**: honestly, we do not have automated tests.
> What we have is a script that catches the specific bug class that kept biting
> us, and we click every screen after a change. That is a much better answer than
> pretending there is a test suite.

## The `/rest/v1` mistake

Supabase shows several URLs in its dashboard. The REST endpoint
`https://xxx.supabase.co/rest/v1/` got pasted into `VITE_SUPABASE_URL` instead of
the project root, so the client appended its own `/rest/v1` and every query went
to `/rest/v1/rest/v1/scores`, returning "Invalid path specified in request URL".

`supabase.js` now strips a trailing `/rest/v1` or slash, so the wrong paste works
anyway.

## The recorder losing text

Covered in section 4. Speech recognition only marks text final after a pause, so
saving only final text threw away whatever was said just before you hit stop.

---

# 7. Weak points, name these yourself

1. **The progress bar is fake**, as above.
2. **`localStorage` has about 5MB.** The write is wrapped in `try`/`catch` and
   shows a warning, but a very heavy user still cannot save locally.
3. **Rate limit is per process, in memory.** Restart the server and it resets.
   Fine for one machine, wrong for several.
4. **Last write wins** across devices.
5. **A static front end deploy does not run `server.js`.** `VITE_API_URL` has to
   point at a hosted backend or every request falls back to `localhost:3001`.
6. **`letterHint`'s every third letter rule is arbitrary**, tuned by eye.

---

# 8. Quiz yourself

1. Why does the project need a backend at all?
2. Why must `import "dotenv/config"` come before `new Anthropic()`?
3. Why does removing CORS break the browser but not curl?
4. What two problems does `safeParse` solve, and why `lastIndexOf`?
5. Why does `pickText` search by block type instead of taking `content[0]`?
6. Why do four endpoints stream and one does not?
7. What are the three layers of `isRightAnswer`?
8. How does a question become a "weak spot"?
9. What makes the podcast prompt different from the study sheet prompt?
9b. Why is classroom mode a harder test than the boss fight?
9c. Why can a more technically correct answer score lower in the classroom?
9d. Why two endpoints for the classroom instead of one conversation?
10. Why was the recorder losing text, and what fixed it?
11. Someone says your Supabase key is exposed in the front end. Answer them.
12. What happens if Supabase is down while someone is playing?
13. Walk through everything between pasting notes and seeing the mission map.

---

# 9. The one paragraph to memorise

**"How does the AI make the quiz?"**

> The notes go to our own server, which holds the API key so the browser never
> sees it. It sends a prompt ending in an exact JSON template, gets JSON back,
> cleans it up and returns it. That JSON is the whole game: days, sections,
> questions. As you answer we count right and wrong per question, and the ones
> you keep missing become the revenge round.

**If it is not yours:** "That is the other half of the project, Casper built that
part."

**If neither of you knows:** "We built this in a hackathon, and that part we got
working without fully understanding it." Honest beats bluffing every time.
