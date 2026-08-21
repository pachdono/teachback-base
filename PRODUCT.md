# TeachBack — Product Description

Team: pachdono and Casper. Track: Education (Iteration).

## Core concept

Studying is passive. You re-read your notes, it feels like it's working, and you
don't find out what you actually misunderstood until the exam.

TeachBack takes your own notes and turns them into a study campaign. An AI reads
what you paste and builds topics and questions out of it. Anything you get wrong
gets saved so you can go back and beat it. And the last step isn't another
multiple choice test — you have to write out an explanation of the whole topic,
and an AI grades how well you actually understand it.

That last part is the point. Picking the right option out of four proves you
recognise an answer. Explaining something proves you understand it.

## Functional modules

**Campaign generator.** You paste notes, the AI returns a structured plan of
topics and questions in JSON, and the app renders it as the campaign. None of the
content is written by us — it all comes from the student's own material.

**Quiz engine.** Multiple choice and fill in the blank. Typed answers are matched
loosely, so writing `x = 4` instead of `4` still counts. Getting one wrong shows
you the reasoning, not just the correct option.

**Revenge Round** (prototype). Every question you miss goes into a pool you can
attack again later. Get it right and it comes off the list. It's spaced
repetition, except you can see it.

**Final Boss — Teach It Back** (prototype). You write an explanation of
everything you learned. The AI gives it a score out of 100, lists what you got
right, and names what you left out.

## Development background

We're two students who kept running into the same problem: there's no easy way to
tell the difference between having read something and actually knowing it.

The tools we tried didn't fix it. Quizlet checks whether you recognise an answer.
Anki is good at recall but you have to write every card yourself. Neither one
tells you whether you could explain the topic to someone else, which is the thing
exams actually test.

We also wanted it to not feel like homework, because study apps are easy to quit.
That's why it's built as a game.

## Current progress

The whole loop works: paste notes, get a campaign, do the quizzes, miss questions
and see them collected, then face the boss and get graded on your explanation.
It runs against a live API, with React on the front and Express on the back so
the API key stays off the browser.

What we have is a working skeleton. The generator and the quizzes are in good
shape. The two features that make it different — the Revenge Round and the
teach-back boss — work, but they're plain screens. They prove the idea without
delivering the experience yet.

Next up: turn the Revenge Round into a recurring enemy that gets stronger the
longer you avoid it, turn the boss into a real fight where your teach-back score
powers your attacks, then add XP and streaks, and finally accounts with a shared
leaderboard.
