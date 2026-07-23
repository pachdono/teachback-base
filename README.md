# TeachBack

Paste your notes and an AI turns them into a study quiz — then the real test is
teaching it back in your own words.

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env` and set your `ANTHROPIC_API_KEY`
3. Start the backend: `npm run server` (port 3001)
4. Start the frontend: `npm run dev` (port 5173)

## The idea

Studying is passive — you never know what you missed until the test. TeachBack
makes studying active: your notes become a quiz, and the final check is
explaining the material back (the Feynman technique), graded by AI.

This repo is the working core (notes → quiz → teach-back). The plan from here is
to turn it into a game: battles, a mission map, and a boss you beat by teaching.

Built by Dono & Casper — HackHarvard Hangzhou 2026.
