# TeachBack

Paste your notes. An AI turns them into a study game. To finish it you have to
teach the topic back in your own words.

Built for HackHarvard Hangzhou 2026, Education track (Iteration).
Team: Dono and Casper.

## Why

You can read your notes for three hours and still not find out what you
misunderstood until the test. By then it is too late.

The tools we used did not fix that. Quizlet checks whether you recognise an
answer. Anki is good at recall but you write every card yourself. Neither tells
you whether you could actually explain the topic, which is what exams test.

So the last level is not another quiz. You explain the topic, and an AI marks how
well you taught it.

## What it does

| Feature | What it does |
|---|---|
| Mission builder | Paste notes, upload a PDF, or record a lecture. An AI splits it into topics across the days you pick. |
| Battles | Multiple choice and fill in the blank as an HP fight. The questions left are the monster's health. |
| Revenge Round | Questions you keep missing come back as a ninja. Miss five in a mission and he blocks your path. |
| Final boss | Explain the whole topic. Your score becomes your damage, so teaching it well makes you stronger. |
| Classroom | Four AI students ask their own questions. You explain until each one understands. |
| Listen | Any topic becomes a two host audio episode, read aloud in a voice you pick. |
| Progress | XP, armour, streaks, daily quests, a shop, and five themes that repaint the whole game. |
| Accounts | Sign in and your progress follows you to any device. There is a global leaderboard. |

## Running it

You need Node 18 or newer and an Anthropic API key.

```bash
npm install
cp .env.example .env     # then fill in ANTHROPIC_API_KEY
```

```bash
npm run dev              # front end
```

```bash
npm run server           # back end, in a second terminal
```

Both have to be running. The front end takes port 5173 or the next free one, the
server takes 3001.

Accounts are optional. Leave the Supabase keys blank and the app saves to your
browser instead. See `SUPABASE.md` to turn them on.

## How it is built

React and Vite on the front, Express on the back, Claude for generating and
marking, Supabase for accounts.

The server exists for one reason. The API key cannot go in browser code, because
anyone can read it there. So the browser talks to our server, and our server
talks to Claude.

| File | What |
|---|---|
| `server.js` | Seven endpoints, one per kind of AI request |
| `src/App.jsx` | Screens, routing, and the fetches |
| `src/Battle.jsx` | The battle system |
| `src/BossBattle.jsx` | The boss fight and its dodge game |
| `src/Classroom.jsx` | Classroom mode |
| `src/Listen.jsx` | Lecture recording and the audio episode |
| `src/Pages.jsx` | Stats, exams, study sheet, shop, streak, player |
| `src/sprites.jsx` | Every character, stored as a grid of letters |
| `src/game.js` | Shared helpers, answer checking, sound |

There are no image files for the characters. Each sprite is rows of text plus a
colour key, drawn as one SVG rect per pixel. There are no sound files either.
Every effect is generated in the browser with oscillators.

## Deploying

`vercel.json` sends `/api/*` to the Express app, so the site and the API deploy
together. Set `ANTHROPIC_API_KEY` in the host's environment variables, plus the
two Supabase keys if you want accounts. Do not set `VITE_API_URL`, and you do
not need `ALLOWED_ORIGINS` either. The site and the API end up on one domain,
and a page is always allowed to call its own API.
