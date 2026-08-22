# TeachBack, game and visuals half

**How to use this:** paste this file into your AI assistant along with
`src/Battle.jsx`, `src/BossBattle.jsx` and `src/sprites.jsx`, and say:

> This is a project I built with a teammate. I own the game and visuals half.
> Quiz me on it, one question at a time, and tell me when my answer is wrong or
> incomplete.

You do **not** own: the server, the AI prompts, answer checking, saving,
accounts, the recorder, the audio episode, or the data screens. Those are Dono's.
If asked, hand over. That is normal on a real team.

---

# 0. What changed since the first version

**Your code did not change. It moved.** It used to all live in one 3,000 line
`App.jsx`. It is now split into files, so the line numbers you may have learned
are different.

| Was | Now |
|---|---|
| `App.jsx` lines 1514 to 1814 | **`src/Battle.jsx`** |
| `App.jsx` lines 2050 to 2416 | **`src/BossBattle.jsx`** |
| `App.jsx` lines 217 to 436 | **`src/sprites.jsx`** |
| `App.jsx` lines 7 to 111 | **`src/ui.jsx`** |

Two other things to know:

- **`ComicArt` is gone.** It was a second art system that only drew character
  avatars, which `PixelSprite` already does. The player and character select
  screens now use `PixelSprite`. If asked what you would cut first, this was it,
  and it is already cut.
- **Dono added** recording, an audio episode, accounts and classroom mode. All
  theirs.
- **Themes now change the whole world**, not just the accent colour. That one is
  yours, see section 8b.

## Your files

| File | Lines | What |
|---|---|---|
| `src/BossBattle.jsx` | 550 | Boss fight, cutscene, Void Gauntlet |
| `src/Battle.jsx` | 453 | Battle, attack effects, dodge, victory |
| `src/sprites.jsx` | 235 | All the pixel art |
| `src/ui.jsx` | 106 | Icons, streak flame, star background |
| plus | | the mission map inside `App.jsx` |

---

# 1. What the project is

Paste your notes, an AI turns them into a multi day mission, each topic is a
battle against a pixel monster where right answers deal damage, and at the end
you face a boss where you explain the whole topic in your own words and the AI
grades that explanation.

**The idea:** you do not really understand something until you can teach it. That
is the Feynman technique. The boss fight is that idea as a game.

---

# 2. The data everything is drawn from

```
plan
 |- days[]            one per day of study
     |- sections[]    one topic = one battle
         |- questions[]
              { type, question, options[], answer, explanation, hint, accept[] }
```

**The detail that trips people up:** `answer` means two different things.

- `multiple_choice` -> `answer` is a **number**, the index into `options[]`
- `fill_blank` -> `answer` is the **text** of the answer

If a multiple choice question ever shows "2" as the correct answer instead of the
option text, that is why.

---

# 3. How screens switch, no router

Two `useState` values in `App()`:

```js
const [page, setPage] = useState("home");   // home | stats | shop | player | streak | about | account
const [battle, setBattle] = useState(null); // null = not fighting
```

`battle` is either null or an object: `{ dayIdx, secIdx, mode }` for a normal
fight, `{ boss: true }`, or `{ revenge: true, topic }`.

The render is a chain of conditions. Whichever is true renders. `go(p)` changes
page and clears `battle` together, so you cannot end up on the stats page with a
fight still open.

**Why no router:** for about eight screens a router library is more setup than it
saves. The tradeoff is no URLs, so you cannot link to a screen or use the back
button.

---

# 4. `PixelSprite` (`sprites.jsx` line 214)

The best thing to be asked about, because the clever part is tiny.

Each sprite is rows of text plus a colour key:

```js
colors: { k: "#241e4d", w: "#f2eeff", ... },
map: ["....kkkk....", "...kwwwwk...", ...]
```

One character is one pixel, `.` is transparent, every other letter looks up a
colour. The renderer:

```jsx
{spr.map.flatMap((row, y) =>
  [...row].map((ch, x) =>
    ch === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={spr.colors[ch]} />
  )
)}
```

Loop rows (`y`), split each into characters (`x`), skip dots, draw a **1 by 1
rect** for everything else. `viewBox="0 0 cols rows"` makes the SVG coordinate
system the pixel grid, and `shapeRendering="crispEdges"` stops the browser
blurring the pixels.

**Why not PNGs:** text grids are editable in code, scale to any size without
blurring, recolour by changing one hex value, and add nothing to the download.
The renderer is about 20 lines. The 198 lines of sprite data are **data**, like a
level file.

---

# 5. `Battle` (`Battle.jsx` line 150)

## The main idea

```js
const [queue, setQueue] = useState(() => questions.map((_, i) => i));
const hp = queue.length;
```

**`queue.length` IS the monster's health.** Same number, not a representation.

- Right answer -> `qs.slice(1)`, question removed, monster loses HP
- Wrong answer -> `[...qs.slice(1), qs[0]]`, question goes to the **back**, you
  lose a heart and will see it again
- Win when the queue empties, lose when hearts hit zero

**Say this out loud:** the whole educational argument is in one data structure.
You cannot finish a topic by getting things wrong, because a wrong answer
recycles the question. A normal quiz lets you score 60% and move on. This does
not.

## Shuffling once

`useState(() => shuffle(...))` runs the function **once on mount**, not every
render. So the order randomises when the fight starts then stays fixed. Shuffle
during render and the questions reorder on every keystroke.

## Hearts

```js
const maxLives = revenge ? (extraHeart ? 6 : 5) : (extraHeart ? 4 : 3);
```

3 normally, 4 with the Extra Heart perk. Revenge rounds get 5 or 6 because they
are harder.

## Three details people ask about

**The answer lock.** `if (locked && !fromTimer) return;` blocks double answers
during the 700ms hit animation. The `!fromTimer` exception lets a timeout force a
wrong answer even while locked.

**Wrong answers stop.** In a normal battle the code does not advance. You see the
correct answer and the explanation and tap Continue yourself. Deliberate: the
explanation is the teaching moment, so it is not auto skipped.

**Hints cost 5 XP.** The button is disabled below 5 XP. For fill blank it shows
`letterHint`, first letter and every third letter.

---

# 6. `BossBattle` (`BossBattle.jsx` line 182)

One `phase` state drives everything:

```
cutscene -> teach -> armed -> brawl -> end
```

**The teach phase is the point of the app.** You type an explanation, the backend
grades it out of 100, and:

```js
const mult = 1 + (grade?.score || 0) / 100;
```

**Your explanation score is your damage multiplier.** Score 100 and you hit twice
as hard. Say this one in your own words, it is the best thing in the project.

**The brawl.** `BOSS_MAX` is 150, phases change at two thirds and one third.
Charge time drops each phase: `3400 - (bossPhase - 1) * 700`, so 3400ms then
2700ms then 2000ms. Attack pools differ per phase, and `meteor` drops out at
phase 3 while `nova` only appears there, so the last third feels different rather
than just faster.

**Combos.** `comboMult = 1 + Math.min(nc - 1, 3) * 0.25`, so 1, 1.25, 1.5, 1.75.
`Math.min` caps it so it cannot grow forever. Damage is `20 * mult * comboMult`.
A wrong answer resets the combo to 0.

---

# 7. The two dodge games

## `DodgeField` (`Battle.jsx` line 107), the ninja

1D lane. Zones are `{ from, to }` percentages, you move 9 per keypress clamped 5
to 95, and after the timer it checks `zones.some(z => x >= z.from && x <= z.to)`.

Attack type is a coin flip: **shuriken** is 3 randomly placed 18 wide zones,
**shadow** is one wide block from 28 to 72. Scattered but gappy, versus one big
block to get around.

## `VoidGauntlet` (`BossBattle.jsx` line 92), the boss

2D field, and harder to explain, so know it.

`waveCount = phase + 1`, so 2, 3 or 4 waves. You move 9 horizontally and 12
vertically (the field is wider than tall), clamped 4 to 96 and 6 to 94. Each wave
telegraphs then strikes, and being inside any rectangle ends it immediately.

`genVoidZones(phase)` picks a layout at random from a pool that grows with the
phase: columns, rows and quadrants at phase 1, plus **cross** at 2, plus
**pocket** at 3. And:

```js
const gap = 26 - phase * 4;   // safe gap: 22, then 18, then 14
```

**The gap you have to fit through shrinks every phase.** That is the difficulty
curve in one line.

**Be honest if pushed:** those constants were tuned by feel, not derived. And the
zones are the **danger**, not the safe route, which is the natural way to misread
that code.

## Both use a `useRef` as well as state

The timer is created once and captures the position **at that moment**. Reading
`posRef.current` inside the timeout gets the live value instead. State drives
what is drawn, the ref is what the timer checks.

---

# 8. Effects, sound and the map

**`AttackFX`** maps each character to a different effect through `CHAR_ATK`:
blaster, raygun, laser, slash, orb. All the motion is **CSS animation**, not
JavaScript, which is why it costs almost nothing.

**`MonsterAttackFX`** with `MONSTER_MOVE` gives each monster a named move: SLIME
SURGE, EYE LASER, WING SLASH, SPORE BOMB. The monster is picked **once per
battle** in `useState`, so it does not change every render.

**`CutScene`** advances a `step` counter on a timer, 900ms for the first beat,
1300ms per line, then a FIGHT flash. There is a **Skip** button wired straight to
`onDone`, so nobody is ever trapped in it.

**`VictoryFX`** makes 18 confetti pieces, each with a random position, delay,
duration, colour and rotation, generated once in `useState` so they do not
re-randomise mid animation.

**Sound (`game.js` line 96).** There are **no audio files**. Every effect is
generated with Web Audio oscillators: `hit` rises 440 to 660, `hurt` falls 200 to
140 on a sawtooth, `win` is an arpeggio 523, 659, 784, 1047, `lose` descends 392,
330, 262.

> **Good pitch line:** "There are no sound files in the project. Every effect is
> synthesised in the browser, so the whole soundtrack adds zero bytes to the
> download." The design rule is rising equals good, falling equals bad.

**The mission map** (inside `App.jsx`). `PLANETS[(di * 2 + si) % PLANETS.length]`
picks each section's planet. The `* 2` means adjacent sections never share a
planet, and `%` wraps around the six available. Completion comes from
`doneSections`, an array of `"dayIdx-secIdx"` strings.

**The background** (`ui.jsx` line 97) is one div with two layers of stars. Every
star is a CSS `radial-gradient`, a white dot fading to transparent. **Nothing
animates.** There used to be drifting aurora blobs and a flying rocket, removed
for something cleaner and cheaper to render.


## 8b. Themes repaint the whole world

Each theme in `Pages.jsx` carries five colours, not two:

```js
{ id: "solar", name: "Desert Sun", c1: "#f0762e", c2: "#ffb56b",
  bg1: "#1a0d06", bg2: "#3a1a08", star: "#ffd9a8" }
```

`c1` and `c2` are the accents. `bg1` and `bg2` are the deep space behind
everything, and `star` tints the stars.

**How one click repaints everything** (`App.jsx` line 231): a `useEffect` writes
those values into CSS custom properties on the root element.

```js
s.setProperty("--purple", t.c1);
s.setProperty("--bg", t.bg1);
s.setProperty("--star", t.star);
```

Every rule in the stylesheet already says `var(--purple)` or `var(--star)`, so
they all update at once. **No component re-renders and no component knows themes
exist.** That is the whole trick, and it is a good answer if asked how theming
works.

| Theme | The world |
|---|---|
| Nebula | deep violet space, white stars |
| Desert Sun | scorched brown, sand coloured stars |
| Alien Bloom | dark jungle green, pale green stars |
| Red Giant | dark maroon, pink white stars |
| Deep Ocean | deep navy, icy blue stars |

---

# 9. Questions to be ready for

1. How does the app decide which screen to show?
2. How is a pixel sprite drawn?
3. What is the monster's health, really?
4. What happens on a wrong answer, and why was it built that way?
5. Why is the boss fight called teach back?
6. What does `answer` contain? (index for multiple choice, text for fill blank)
7. Why do both dodge games use a `useRef` as well as state?
8. Why does the combo damage use `Math.min`?
9. How do the sound effects work with no audio files?
10. Why is the app split into files now, and what was it before?
11. How does changing a theme repaint the whole app without re-rendering anything?
12. Why did three screens go blank, and why did the build not catch it?

---

# 10. Honest weak points, name these yourself

- **No tests at all.**
- **Barely responsive**, only three media queries in about 1,600 lines of CSS.
- **The `Battle` countdown** calls `answer(false)` from inside a state updater,
  and React runs updaters twice in development, so the sound and the stat can
  fire twice.
- **The Void Gauntlet constants** were tuned by feel.
- **`App.jsx` is still 859 lines**, better than 3,000 but still the biggest file.

**The honest framing:** it was built fast, it works, and we know what we would
fix first. That beats pretending it is production code.


---

# 10b. What broke, and the lesson

Three separate blank screens hit during the build, all the same root cause.

| Error | Screen |
|---|---|
| `ComicArt is not defined` | Player |
| `CutScene is not defined` | Revenge ninja |
| `useEffect is not defined` | Mock exam |

Splitting one big file into modules moved the components but left some of their
**references** behind: a component that was dropped but still called, one that
lives in another file and was never exported, a React hook that was never
imported.

**Every one of them built fine.** `vite build` checks that the code parses and
that imports resolve. A name that does not exist *inside* a component is a
runtime error, so it only appears when that component actually renders.

**How to debug it yourself:** a blank screen is almost always a `ReferenceError`.
Open DevTools, read the first red line, and it names exactly which identifier and
which file.

There are now two scripts that sweep every file, one for components and one for
hooks, and both report clean.

---

# 11. The one paragraph to memorise

**"How does the game work?"**

> Each topic is a list of questions, and the number of questions left is the
> monster's health. Get one right and it is removed, so the monster loses health.
> Get one wrong and it goes to the back of the queue, so you see it again and
> lose a heart. You only finish by getting everything right eventually.

**If it is not yours:** "That is the other half of the project, Dono built that
part."

**If neither of you knows:** "We built this in a hackathon, and that part we got
working without fully understanding it."
