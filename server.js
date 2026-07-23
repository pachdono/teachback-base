import express from "express";
import cors from "cors";
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic();

function parseJson(text) {
  const t = text.replace(/```json|```/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in AI response");
  return JSON.parse(t.slice(start, end + 1));
}

// Notes -> a study quiz spread over N days
app.post("/api/lesson", async (req, res) => {
  try {
    const { notes, days } = req.body;
    const msg = await client.messages
      .stream({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system: "You create study quizzes. Respond ONLY with valid JSON. No markdown fences.",
        messages: [
          {
            role: "user",
            content: `Turn this material into a quiz spread over ${days} day(s).
Use sections of 4-5 questions each. Question types: "multiple_choice" (4 options, "answer" = correct index) or "fill_blank" ("answer" = the word/phrase). Add a short "explanation" to every question. Include a top-level "title".
Return JSON exactly like:
{"title":"...","days":[{"day":1,"title":"...","sections":[{"title":"...","questions":[{"type":"multiple_choice","question":"...","options":["a","b","c","d"],"answer":0,"explanation":"..."}]}]}]}

Material: ${notes}`,
          },
        ],
      })
      .finalMessage();
    res.json(parseJson(msg.content[0].text));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// The student's explanation -> a grade
app.post("/api/grade", async (req, res) => {
  try {
    const { topic, explanation } = req.body;
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: "You grade student explanations. Respond ONLY with valid JSON.",
      messages: [
        {
          role: "user",
          content: `Topic: ${topic}
Student's explanation: ${explanation}
Grade fairly. Return JSON exactly like:
{"score":85,"correct":["..."],"missed":["..."],"followUp":"..."}`,
        },
      ],
    });
    res.json(parseJson(msg.content[0].text));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
