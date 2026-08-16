# TeachBack

Paste your notes, get a study campaign, and beat a final boss by explaining the
topic in your own words.

**HackHarvard Hangzhou 2026 — Education track (Iteration)**
Team: pachdono and Casper

---

## Background

You can read your notes for three hours and still not find out what you actually
misunderstood until the test. By then it's too late.

The tools we already used didn't fix that. Quizlet checks whether you recognise
an answer. Anki is good at recall, but you have to write every card yourself.
Neither one tells you whether you could actually *explain* the topic, which is
what exams really test.

So we built TeachBack. It takes the notes you already have, turns them into a
study campaign, and ends with a boss you can only beat by teaching the material
back. We made it a game because study apps are easy to quit.

## Features

| Feature | What it does | State |
|---|---|---|
| **Campaign generator** | Paste any notes; an AI splits them into topics spread over the number of days you pick | Working |
| **Quiz engine** | Multiple choice and fill in the blank, with the reasoning shown when you get one wrong | Working |
| **Revenge Round** | Every question you miss is saved into a pool you can go back and beat | Prototype |
| **Final Boss** | Write an explanation of the whole topic; an AI scores it /100 and names what you left out | Prototype |

The Revenge Round and the Final Boss work end to end but are plain screens right
now. They're the two ideas that make TeachBack different from a flashcard app, so
they're what we're building out next.

## Running it

**You need:** [Node.js](https://nodejs.org) 18 or newer, and an
[Anthropic API key](https://console.anthropic.com).

```bash
# 1. install dependencies
npm install

# 2. add your API key
cp .env.example .env        # then edit .env and paste your key

# 3. start the backend (port 3001)
npm run server

# 4. in a second terminal, start the frontend (port 5174)
npm run dev
```

Then open http://localhost:5174. Both have to be running — the frontend calls the
backend, and the backend is what talks to the AI.

To open it on your phone, put your computer's local IP in a `.env.local` file as
`VITE_API_URL=http://YOUR-IP:3001` and visit `http://YOUR-IP:5174` on the same wifi.

## Dependencies

**Frontend:** React 19, Vite 8
**Backend:** Express 5, `@anthropic-ai/sdk`, `cors`, `dotenv`
**Model:** `claude-sonnet-4-6` via the Anthropic API

Everything installs with `npm install`; there's nothing else to set up.

## Project structure

```
├── server.js         Express backend — the only place the API key is used
├── index.html        page shell
├── src/
│   ├── main.jsx      React entry point
│   ├── App.jsx       all UI: campaign map, quiz, revenge round, boss
│   ├── game.js       shared logic (answer checking)
│   └── index.css     all styling
├── .env.example      copy to .env and add your key
└── PRODUCT.md        longer write-up of the concept and progress
```

## How it works

Three parts. The browser never touches the API key.

```
React app  ──fetch──>  Express server  ──>  Anthropic API
(the game)             (holds the key)      (writes + grades)
```

### Key modules

**`server.js` — turning notes into a campaign.**
The interesting part isn't calling the AI, it's *constraining* it. The prompt
tells the model to reply with strict JSON in an exact shape — days, sections,
questions, answers, explanations — and nothing else. That means the response can
be rendered straight into the app as the campaign, with no parsing guesswork.
`parseJson()` strips any stray markdown fences before parsing, because models
sometimes wrap JSON in code blocks.

Two endpoints:
- `POST /api/lesson` — notes in, campaign out
- `POST /api/grade` — a student's explanation in, a score plus the gaps out

**`src/game.js` — forgiving answer checking.**
A student who types `x = 4` when the answer is `4` knows the answer, so marking
that wrong would be punishing formatting instead of understanding.
`isRightAnswer()` normalises both sides (lowercase, strip punctuation and extra
spaces) and, for numeric answers, pulls the number out of whatever the student
wrote. Still rough — number words and synonyms are on the list.

**`src/App.jsx` — the campaign and the loop.**
`App` holds the plan and routes between four views: the campaign map, a quiz, the
Revenge Round, and the boss. The bit worth pointing at is `recordMiss()` — any
question answered wrong is stored in the `missed` array, which is what the Revenge
Round reads from. Getting it right there removes it again. That one array is the
whole weakness-tracking loop, and it's the foundation for the enemy we're building
on top of it.

## What's next

- Revenge Round becomes an actual enemy that gets harder the longer you avoid it
- The boss becomes a real fight where your explanation score decides how hard you hit
- XP and streaks so there's a reason to come back
- Accounts so progress saves, plus a leaderboard to compete with classmates
