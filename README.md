# TeachBack

Paste your notes and an AI turns them into a study campaign — then the real test
is teaching it back in your own words.

## The idea

Studying is passive. You re-read notes for hours, it feels productive, and you
don't find out what you actually missed until the exam. TeachBack makes studying
active: your own material becomes a campaign of quizzes, the questions you get
wrong come back to hunt you, and the final boss is beaten by *explaining* the
topic — the Feynman technique, graded by AI.

## Core functions (current state)

| Feature | Status |
|---|---|
| **Notes → campaign** — AI builds a multi-day plan of topics and questions from anything you paste | working |
| **Quizzes with explanations** — multiple choice and fill-in, with the reasoning shown when you're wrong | working |
| **Revenge Round** — every missed question is collected so you can hunt it down again | prototype |
| **Final Boss: Teach It Back** — explain the whole topic in your own words; the AI scores you and names what you missed | prototype |

The Revenge Round and the Final Boss are the ideas that make TeachBack different,
and both are currently rough — they work end to end, but they're plain screens.
Turning them into the real experience is the next phase.

## What's next

- **Revenge Round** → a recurring enemy that grows stronger the longer you avoid it
- **Final Boss** → a real battle where your teach-back score powers your attacks
- Progression: XP, streaks, and unlockables to keep students coming back
- Accounts and a shared leaderboard

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env` and set your `ANTHROPIC_API_KEY`
3. Start the backend: `npm run server` (port 3001)
4. Start the frontend: `npm run dev` (port 5174)

## Stack

React + Vite on the front, Express on the back. The API key stays server-side —
the browser never sees it. All questions and grading come from the Anthropic API.

---

Built by pachdono & Casper — HackHarvard Hangzhou 2026.
