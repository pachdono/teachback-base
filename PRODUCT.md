# TeachBack — Product Description

**Team:** pachdono & Casper · **Track:** Education (Iteration)

---

## Core concept

Studying is passive. Students re-read notes for hours, it feels productive, and
they don't discover what they actually misunderstood until the exam — when it's
too late to fix.

TeachBack turns a student's own notes into an active study campaign. Paste any
material and an AI builds a multi-day set of topics and questions from it. Every
question you get wrong is collected and comes back until you beat it. And the
final challenge isn't another multiple-choice test: you have to **explain the
whole topic in your own words**, and an AI grades how well you actually
understand it.

That last part is the heart of the product. Multiple choice proves you can
recognise an answer. Explaining something proves you understand it — the Feynman
technique, turned into the boss fight of a study session.

## Functional modules

**1. Campaign generator**
Notes go in; a structured multi-day plan comes out. The AI is constrained to
return strict JSON — topics, questions, correct answers, explanations — which the
app renders directly as the campaign. Nothing is hand-written; it all comes from
the student's material.

**2. Quiz engine**
Multiple-choice and fill-in-the-blank questions with forgiving answer matching, so
a correct answer typed as `x = 4` instead of `4` still counts. Wrong answers reveal
the reasoning, not just the right option.

**3. Revenge Round** *(prototype)*
Every missed question is collected into a separate pool the student can attack
again. Answering correctly removes it. This is spaced repetition made visible —
your weak spots become a thing you can see and defeat.

**4. Final Boss — Teach It Back** *(prototype)*
The student writes an explanation of everything they've learned. An AI grades it
out of 100, lists what they got right, and names exactly what they left out — the
blind spots they didn't know they had.

## Development background

We're two students who kept hitting the same problem: no way to tell the
difference between *having read something* and *actually knowing it*. Existing
tools didn't solve it. Quizlet tests recognition. Anki tests recall, but you have
to build every card yourself. Neither tells you whether you could explain the
material to someone else.

We wanted a tool that (a) works from the notes you already have, with zero setup,
and (b) makes the final test one you can't fake — because the only way to pass it
is to genuinely understand the topic.

Building it as a game came out of the same frustration: study tools are a chore,
and a chore is a thing you quit.

## Current progress

The full loop works end to end: **paste notes → AI campaign → quizzes with
explanations → Revenge Round → teach-back boss graded by AI.** It runs against a
live API with a React front end and an Express back end that keeps the API key
server-side.

What exists is deliberately a working skeleton. The campaign generator and quiz
engine are solid. The two features that make TeachBack distinctive — the Revenge
Round and the teach-back boss — currently work but are plain screens: they prove
the concept without delivering the experience.

**Next phase:** turn the Revenge Round into a recurring enemy that grows stronger
the longer you avoid it, and turn the boss into a real battle where your
teach-back score powers your attacks. Then progression — XP, streaks,
unlockables — and finally accounts with a shared leaderboard so classmates can
compete.
