# TeachBack, product description

Team: Dono and Casper. Track: Education (Iteration).

## The idea

Studying is passive. You re-read your notes, it feels like it is working, and you
do not find out what you misunderstood until the exam.

TeachBack takes your own notes and turns them into a study game. An AI reads what
you paste and builds the topics and questions out of it. Anything you get wrong
comes back until you beat it. The last level is not another multiple choice test.
You write out an explanation of the topic, and an AI marks how well you taught it.

That is the point. Picking the right option out of four proves you recognise an
answer. Explaining something proves you understand it.

## What is in it

**Mission builder.** You paste notes, upload a PDF, or record a lecture and let
the browser transcribe it. The AI returns a structured plan in JSON and the app
renders it as the game. None of the content is written by us. It all comes from
the student's own material.

**Battles.** Multiple choice and fill in the blank, fought as an HP battle
against a pixel monster. The number of questions left is the monster's health, so
you cannot finish a topic by getting things wrong. A wrong answer sends the
question to the back of the queue and shows you the working.

**Revenge Round.** Every answer is counted per question. Anything you have missed
more than you have hit becomes a weak spot, and those come back as a ninja. Miss
five in one mission and he blocks the path to the boss.

**The teach back boss.** You explain the whole topic in your own words. The AI
scores it out of 100, lists what you got right, and names what you left out. That
score becomes your damage multiplier for the fight, so teaching it well makes you
stronger.

**Classroom.** Four AI students each ask their own question about your material,
getting harder as you go. You answer in plain language until each one says they
understand. The marking rewards clear explanation and does not reward jargon, so
a more technical answer can score lower.

**Listen.** Any topic becomes a short two host audio episode, written to be heard
rather than read, and spoken by the browser in a voice you choose.

**Progress and accounts.** XP from every win, four armour tiers, streaks, daily
quests, a shop, and five themes that repaint the whole game. Sign in and your
progress syncs to any device, with a global leaderboard.

## Why we built it

We are two students who kept hitting the same problem. There is no easy way to
tell the difference between having read something and actually knowing it.

The tools we tried did not fix it. Quizlet checks whether you recognise an
answer. Anki is good at recall but you write every card yourself. Neither one
tells you whether you could explain the topic to someone else, which is the thing
exams actually test.

We also wanted it to not feel like homework, because study apps are easy to quit.
That is why it is a game.

## Where it is now

The whole loop works end to end. Paste notes, get a mission, fight through it,
face the ninja for what you keep missing, beat the boss by teaching it, then
teach a classroom of students who ask their own questions.

React on the front, Express on the back so the API key stays off the browser, and
Postgres behind Supabase for accounts with row level security.

Next: a library where students publish the missions they made so others can play
them, teacher dashboards with a class join code, a mobile app, and review
scheduling that tells each student what to go over today.
