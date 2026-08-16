# TeachBack

Paste your notes, get a study campaign, and beat a final boss by explaining the
topic in your own words.

## Why we made it

You can read your notes for three hours and still not find out what you actually
misunderstood until the test. By then it's too late. We wanted something that
tells you earlier, and that isn't boring enough to quit after two days.

## What it does now

- Paste any notes and an AI splits them into topics spread over a few days
- Quiz questions (multiple choice and fill in the blank) that show you the
  reasoning when you get one wrong
- Anything you miss gets saved into a **Revenge Round** so you can go back and
  beat it
- A **final boss** where you type out an explanation of the whole topic. An AI
  scores it out of 100 and tells you which bits you left out

## Where it's at

The campaign generator and the quizzes are solid. The Revenge Round and the boss
both work end to end, but they're plain screens right now — they prove the idea
without being fun yet. Those two are the parts that make TeachBack different from
a flashcard app, so they're what we're building out next.

## What's next

- Revenge Round becomes an actual enemy that gets harder the longer you avoid it
- The boss becomes a real fight where your explanation score decides how hard you hit
- XP and streaks so there's a reason to come back
- Accounts, so progress saves, and a leaderboard to compete with classmates

## Running it

1. `npm install`
2. Copy `.env.example` to `.env` and put your `ANTHROPIC_API_KEY` in it
3. `npm run server` — backend on port 3001
4. `npm run dev` — frontend on port 5174

## How it's built

React + Vite on the front, Express on the back. The API key lives on the server,
never in the browser. All the questions and the grading come from the Anthropic API.

Built by pachdono and Casper for HackHarvard Hangzhou 2026.
