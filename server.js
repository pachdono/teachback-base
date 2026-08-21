import express from "express";
import cors from "cors";
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic();

/**
 * Pull a JSON object out of a model reply.
 * Models sometimes wrap JSON in ```json fences or add a sentence before it,
 * so we strip fences and slice from the first { to the last }.
 */
function parseJson(text) {
  const t = text.replace(/```json|```/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in AI response");
  return JSON.parse(t.slice(start, end + 1));
}

/**
 * Notes -> a study campaign.
 *
 * The whole trick is constraining the model: we pin the response to one exact
 * JSON shape so the app can render it directly as the campaign instead of
 * trying to interpret prose. `days` decides how the material gets split up.
 */
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

/**
 * A student's explanation -> a grade.
 *
 * This is the Feynman-technique check: instead of asking whether they can pick
 * the right option, we ask whether they can teach the topic. The model returns
 * a score plus, more usefully, the specific points they left out.
 */
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
