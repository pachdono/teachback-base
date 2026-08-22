import express from "express";
import cors from "cors";
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const app = express();

// Only our own front end may call this. Without it, anyone who finds the URL
// can spend our Anthropic credits.
const ALLOWED = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    // no Origin header means curl or a health check, not a browser
    if (!origin) return cb(null, true);
    // any localhost port during development - vite picks whatever is free
    if (/^https?:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
    if (ALLOWED.includes(origin)) return cb(null, true);
    cb(new Error("blocked"));
  },
}));

// Notes can be long, but not unlimited.
app.use(express.json({ limit: "1mb" }));

// Simple per-IP limit: generation is slow and costs money.
const hits = new Map();
app.use("/api", (req, res, next) => {
  const now = Date.now();
  const rec = hits.get(req.ip);
  if (!rec || now > rec.reset) { hits.set(req.ip, { n: 1, reset: now + 60000 }); return next(); }
  if (rec.n >= 20) return res.status(429).json({ error: "Too many requests. Wait a minute." });
  rec.n++;
  next();
});

const client = new Anthropic();

// A pasted PDF is easily this long. Roughly 15k tokens, which the model
// handles fine and keeps one mission cheap.
const MAX_NOTES = 60000;

// Errors we wrote are safe to show. Anything else stays in the log.
function userError(message) {
  const e = new Error(message);
  e.show = true;
  return e;
}

function fail(res, err) {
  console.error(err);
  res.status(500).json({ error: err.show ? err.message : "Something went wrong. Please try again." });
}

// The first block is only text when the model is not thinking, so find it by type.
function pickText(msg) {
  if (msg.stop_reason === "max_tokens") throw userError("The answer was cut off. Try shorter notes or fewer days.");
  const block = msg.content.find((b) => b.type === "text");
  if (!block) throw new Error("no text block in response");
  return block.text;
}

function safeParse(text) {
  let t = text.replace(/```json|```/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in AI response");
  return JSON.parse(t.slice(start, end + 1));
}

app.post("/api/lesson", async (req, res) => {
  try {
    const { notes, days } = req.body;
    const material = String(notes || "").slice(0, MAX_NOTES);
    if (!material.trim()) throw userError("No notes provided.");
    // scale structure to the plan length: a 1-day sprint = fewer paths but denser
    // questions; longer plans = more paths (sections) spread across the days.
    const perDay = days === 1 ? 2 : 3;
    const totalSections = Math.min(days * perDay, 16);
    const qPer = days === 1 ? "7-9" : "4-6";
    const msg = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 30000,
      system: "You create structured study plans. Respond ONLY with valid, complete JSON. No markdown fences, no trailing commas.",
      messages: [{
        role: "user",
        content: `Create a study plan spread over ${days} day(s) from this material.
Use ${totalSections} sections in total, distributed across the ${days} day(s) (roughly ${perDay} per day).
Each section has ${qPer} questions. Keep every question under 20 words.
Question types: "multiple_choice" (4 options, "answer" = correct index) or "fill_blank" ("answer" = the word/phrase).
For "fill_blank", also include "accept": an array of 0-3 alternative correct answers (different spellings, numeric vs word form, common synonyms).
Every question MUST include an "explanation" (1-2 sentences) that says WHY the answer is correct. For math, calculations, or any step-based problem, show the method/working used to reach the answer, not just the final result. Use "\\n" between steps when it helps readability.
Every question MUST also include a "hint", a short nudge (under 15 words) that points toward the method WITHOUT revealing the answer.
Also include a short top-level "title" (under 6 words) naming the overall subject.
Keep all text concise. Return JSON exactly like:
{"title":"...","days":[{"day":1,"title":"...","sections":[{"title":"...","questions":[{"type":"multiple_choice","question":"...","options":["a","b","c","d"],"answer":0,"explanation":"...","hint":"..."},{"type":"fill_blank","question":"...","answer":"...","explanation":"...","hint":"..."}]}]}]}

Material: ${material}`
      }]
    }).finalMessage();
    res.json(safeParse(pickText(msg)));
  } catch (err) {
    fail(res, err);
  }
});

app.post("/api/exam", async (req, res) => {
  try {
    const { topic, count } = req.body;
    const n = Math.min(Math.max(parseInt(count) || 10, 5), 25);
    const msg = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 24000,
      system: "You create mock exams. Respond ONLY with valid, complete JSON. No markdown fences, no trailing commas.",
      messages: [{
        role: "user",
        content: `Create a mock exam with exactly ${n} questions on this topic: ${topic}
Mix "multiple_choice" (4 options, "answer" = correct index) and "fill_blank" ("answer" = the word/phrase). For "fill_blank", also include "accept": an array of 0-3 alternative correct answers (different spellings, numeric vs word form, common synonyms). Cover the topic broadly with difficulty increasing from easy to hard. Keep each question under 25 words.
Every question MUST include an "explanation" (1-2 sentences) that shows the method/working used to reach the answer, not just the final result.
Also include a short "title" (under 6 words) for the exam.
Return JSON exactly like:
{"title":"...","questions":[{"type":"multiple_choice","question":"...","options":["a","b","c","d"],"answer":0,"explanation":"..."},{"type":"fill_blank","question":"...","answer":"...","explanation":"..."}]}`
      }]
    }).finalMessage();
    res.json(safeParse(pickText(msg)));
  } catch (err) {
    fail(res, err);
  }
});

app.post("/api/summary", async (req, res) => {
  try {
    const { material, title } = req.body;
    const msg = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: "You create concise study sheets. Respond ONLY with valid, complete JSON. No markdown fences, no trailing commas.",
      messages: [{
        role: "user",
        content: `Create a one-page study sheet summarizing this material${title ? ` (topic: ${title})` : ""}.
Make it genuinely easy to understand: plain language, short bullets, the big picture first.
Return JSON exactly like:
{"title":"...","overview":"2-3 sentence big-picture summary","sections":[{"heading":"...","bullets":["...","..."]}],"keyTerms":[{"term":"...","def":"one-line definition"}],"examTips":["...","..."]}
Use 3-6 sections with 3-5 bullets each, 5-10 key terms, and 3-5 exam tips.

Material: ${String(material).slice(0, 24000)}`
      }]
    }).finalMessage();
    res.json(safeParse(pickText(msg)));
  } catch (err) {
    fail(res, err);
  }
});

app.post("/api/grade", async (req, res) => {
  try {
    const { topic, explanation } = req.body;
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: "You grade student explanations. Respond ONLY with valid JSON.",
      messages: [{
        role: "user",
        content: `Topic: ${topic}
Student's explanation: ${explanation}
Grade strictly but fairly. Also write 0-3 "reviewQuestions" targeting ONLY the missed points: multiple_choice with 4 options, "answer" = correct index, plus "explanation" (why/how) and "hint" (nudge without the answer). Return JSON exactly like:
{"score":85,"correct":["..."],"missed":["..."],"followUp":"...","reviewQuestions":[{"type":"multiple_choice","question":"...","options":["a","b","c","d"],"answer":0,"explanation":"...","hint":"..."}]}`
      }]
    });
    res.json(safeParse(pickText(msg)));
  } catch (err) {
    fail(res, err);
  }
});


app.post("/api/podcast", async (req, res) => {
  try {
    const { material, title } = req.body;
    const text = String(material || "").slice(0, MAX_NOTES);
    if (!text.trim()) throw userError("Nothing to turn into an episode.");
    const msg = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      system: "You write short study podcasts. Respond ONLY with valid JSON. No markdown fences.",
      messages: [{
        role: "user",
        content: `Turn this material into a short spoken study episode${title ? ` about ${title}` : ""}.
Write it to be LISTENED to, not read: short sentences, plain words, no bullet points, no headings, no symbols.
Two hosts talking naturally - one explains, the other asks the questions a confused student would ask.
Cover the main ideas in order, simplest first. Around 500-700 words total.
Return JSON exactly like:
{"title":"...","lines":[{"speaker":"host","text":"..."},{"speaker":"guest","text":"..."}]}

Material: ${text}`
      }]
    }).finalMessage();
    res.json(safeParse(pickText(msg)));
  } catch (err) {
    fail(res, err);
  }
});


// Classroom mode. Two calls: one to make the class, one to mark each answer.
app.post("/api/classroom", async (req, res) => {
  try {
    const { topic, material } = req.body;
    const text = String(material || "").slice(0, MAX_NOTES);
    if (!text.trim() && !topic) throw userError("Nothing to build a class from.");
    const msg = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: "You write questions that real students ask. Respond ONLY with valid JSON. No markdown fences.",
      messages: [{
        role: "user",
        content: `The user is about to teach a class on this material${topic ? ` (topic: ${topic})` : ""}.
Invent 4 students and give each one question they would actually ask.
Make the questions get harder: the first is a simple "what does that mean", the last should probe a
misconception or ask why something is true rather than what it is.
Questions must be answerable from the material. Keep each under 25 words and sound like a real kid talking.
Give each student a first name and a one word mood from: curious, shy, cheeky, sharp.
Return JSON exactly like:
{"students":[{"name":"...","mood":"curious","question":"..."}]}

Material: ${text}`
      }]
    }).finalMessage();
    res.json(safeParse(pickText(msg)));
  } catch (err) {
    fail(res, err);
  }
});

app.post("/api/classanswer", async (req, res) => {
  try {
    const { question, explanation, material } = req.body;
    if (!String(explanation || "").trim()) throw userError("Write an explanation first.");
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: "You are marking whether a student teacher explained something clearly. Respond ONLY with valid JSON.",
      messages: [{
        role: "user",
        content: `A student asked: ${question}
The teacher answered: ${explanation}

Judge only whether a curious beginner would now understand. Reward plain language and a concrete example.
Do not reward jargon, and do not punish informality.
"understood" is true when the answer is correct and clear enough to satisfy the student.
"reaction" is the student replying in one sentence, in their own voice, either getting it or saying
exactly what still confuses them.
"missing" is at most two things the answer left out, empty if none.
Return JSON exactly like:
{"score":80,"understood":true,"reaction":"...","missing":["..."]}

Reference material: ${String(material || "").slice(0, 4000)}`
      }]
    });
    res.json(safeParse(pickText(msg)));
  } catch (err) {
    fail(res, err);
  }
});

// Body-too-large and CORS rejections happen before any route, so they need
// their own handler or the browser gets an HTML page it cannot parse.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Those notes are too long." });
  if (err.message === "blocked") return res.status(403).json({ error: "Request blocked." });
  res.status(500).json({ error: "Something went wrong." });
});

// On Vercel the app is imported and run as a serverless function, so only
// start a real listener when this file is run directly with node.
const PORT = process.env.PORT || 3001;
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

export default app;