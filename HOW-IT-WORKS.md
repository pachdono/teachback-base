# How the tricky parts actually work

The other two files say what the code does. This one says **how the underlying
technology works**, so when someone asks "but how does that actually happen" you
have a real answer instead of "it uses a library".

Read the sections for your half first, but the whole thing is short.

---

# 1. Reading a PDF (`App.jsx`, `handleFile`)

## What a PDF actually is

A PDF is not a picture of a page. It is a list of drawing instructions, roughly
"put the glyph for 'A' at x=72, y=560 in Helvetica 12pt". The text is genuinely
in there as characters, just scattered across the file with position data
attached, and in no guaranteed reading order.

## What our code does

```js
const pdfjs = await import("pdfjs-dist");
const doc = await pdfjs.getDocument({ data: buf }).promise;
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  text += content.items.map((it) => it.str).join(" ") + "\n";
}
```

Line by line:

1. `file.arrayBuffer()` reads the file into memory as raw bytes.
2. `getDocument` parses those bytes into a document object. **Nothing is
   uploaded.** pdf.js is Mozilla's PDF engine compiled to run in the browser, the
   same one built into Firefox. The file never leaves the machine.
3. `getTextContent()` returns an array of `items`, each one a run of characters
   with its position.
4. `.map(it => it.str).join(" ")` throws the positions away and keeps the text.

## Why the check for empty text exists

```js
if (!text.trim()) throw new Error("no selectable text found, so it may be a scan");
```

**A scanned PDF is a photograph of paper.** There are no glyphs in it, just a
JPEG per page. `getTextContent()` correctly returns nothing, because there is no
text to find. Reading those needs OCR, which is a completely different and much
heavier technology. So we detect it and say so rather than silently adding
nothing.

## The honest weakness

Joining items with a space ignores layout. A two column paper comes out with the
columns interleaved, and tables come out as word soup. Fine for lecture notes,
bad for a scientific paper. **Say that if asked**, it is a much better answer
than pretending it is perfect.

## Why the import is inside the function

```js
const pdfjs = await import("pdfjs-dist");
```

That is a **dynamic import**. The library is about 415KB, larger than the entire
rest of the app. Importing it at the top of the file would make every visitor
download it even if they never touch a PDF. Written this way, the browser only
fetches it the moment someone actually picks a PDF.

---

# 2. Recording a lecture (`Listen.jsx`)

Three separate browser features running at once. Keep them apart in your head.

## Part 1: getting the microphone

```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

This triggers the browser's permission prompt. It returns a **MediaStream**, a
live pipe of audio data. It only works on `https` or `localhost`, which is a
browser security rule, so this feature will not work on a plain `http` deployed
site.

## Part 2: saving the audio so you can play it back

```js
const mr = new MediaRecorder(stream);
mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
```

`MediaRecorder` compresses the stream and hands you **chunks** as it goes. We
collect them in an array. When you stop:

```js
const blob = new Blob(chunksRef.current, { type: mr.mimeType });
setReview({ url: URL.createObjectURL(blob), text });
```

`Blob` glues the chunks into one file-like object. `URL.createObjectURL` gives
you a fake URL pointing at that object in memory, which you can hand straight to
`<audio src=...>`. **Nothing is uploaded and nothing is written to disk.** That is
also why we call `URL.revokeObjectURL` afterwards, to let the memory go.

## Part 3: turning speech into text

```js
const rec = new SpeechRecognition();
rec.continuous = true;
rec.interimResults = true;
```

This is the one that surprises people: **the browser does not do the recognition
locally.** Chrome streams the audio to Google's speech servers and streams text
back. That is why it needs an internet connection and why it is Chrome and Edge
only. Safari and Firefox do not implement it.

### Interim versus final, and the bug it caused

The recogniser sends two kinds of result:

- **interim**: its current best guess, which changes as you keep talking
- **final**: locked in, and it only decides this after **a clear pause**

You say "photosynthesis happens in the chloroplast" and it is all interim until
you stop for breath. Then that whole span flips to final.

The first version saved only final text. So if you hit stop while still talking,
or right after finishing, everything you had just said was thrown away, the notes
box stayed empty, and Launch mission stayed disabled. The fix is to keep both:

```js
const text = (finalRef.current + interimRef.current).trim();
```

**This is a genuinely good thing to be asked about**, because the explanation is
a real detail about how streaming recognition works, not a coding trick.

### Why `onend` restarts it

```js
rec.onend = () => { if (recRef.current) rec.start(); };
```

Chrome stops listening on its own after a few seconds of silence. In a lecture
there are pauses. So when it ends by itself we restart it, unless the user
actually pressed stop, which is what `recRef.current` being null signals.

## Why the review step exists

Speech recognition mangles technical vocabulary. "Mitosis" becomes "my toe sis".
Those words become quiz questions, so a wrong transcript poisons the whole
mission. Showing the audio, the text and an edit box before anything is added is
the difference between a useful feature and a broken one.

---

# 3. Sound effects (`game.js`, `sfx`)

**There are no audio files in this project.** Every sound is generated from
scratch, which is why the whole soundtrack adds zero bytes to the download.

## The building block

```js
const o = ctx.createOscillator();   // makes a raw tone
const g = ctx.createGain();         // controls its volume
o.connect(g); g.connect(ctx.destination);   // tone -> volume -> speakers
```

An **oscillator** produces one pure repeating wave. On its own it is a flat
electronic beep that never stops. Two things turn that into a sound effect.

## Choice 1: the waveform

`o.type` changes the shape of the wave, which changes the character:

| Type | Sounds like | Used for |
|---|---|---|
| `square` | hollow, retro, like a Game Boy | `hit`, `win`, `lose` |
| `sawtooth` | harsh, buzzy, aggressive | `hurt` |
| `triangle` | soft, hollow, gentle | the last note of `lose` |
| `sine` | pure, clean, no edge | `tick` |

Same note, different shape, completely different feel. `hurt` is a sawtooth
because sawtooths sound unpleasant, which is the point.

## Choice 2: the envelope

```js
g.gain.setValueAtTime(vol, ctx.currentTime + t);
g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
```

Start at full volume, then fade to almost nothing over `dur` seconds. That fade
is what makes it a **blip** instead of an endless beep. Real percussive sounds
are loud instantly then decay, so copying that shape makes a synthesised tone
sound like a hit rather than a test tone.

The ramp is **exponential**, not linear, because human hearing is logarithmic. A
linear fade sounds like it stops abruptly at the end. Exponential sounds natural.

## Choice 3: the notes

`play(freq, startTime, duration)` lets you schedule several tones in sequence,
which is where the meaning comes from:

```js
hit:  play(440, 0, 0.09); play(660, 0.09, 0.12);
```

440Hz then 660Hz, the second starting exactly when the first ends. **Pitch rises,
so it reads as good.**

```js
hurt: play(200, 0, 0.18, "sawtooth"); play(140, 0.15, 0.25, "sawtooth");
```

200Hz down to 140Hz, harsh waveform, low and slow. **Pitch falls, so it reads as
bad.** Note the second starts at 0.15 while the first runs to 0.18, so they
overlap slightly and smear together rather than sounding like two separate beeps.

```js
win:  523, 659, 784, 1047
```

Those are C, E, G, C. A **major arpeggio**, the most obviously triumphant thing in
western music, and the last note is the octave, which sounds like arriving
somewhere.

```js
lose: 392, 330, 262
```

G, E, C. The same notes descending, and the last one is a soft triangle wave. The
mirror image of winning.

> **The whole design rule in one sentence:** rising pitch means good, falling
> pitch means bad, and the waveform sets how harsh it feels. That is why you can
> tell what happened with your eyes shut.

## Why `new AudioContext()` every time

Creating one per sound is slightly wasteful, but it avoids a class of bug where a
suspended or closed context silently stops all audio. For a handful of short
effects it is not worth optimising, and the whole thing is wrapped in `try {}
catch {}` so a browser that blocks audio never breaks the game.

## The music is the same idea on a timer

```js
const stepMs = 60000 / (t.bpm * tempo) / 2;   // eighth notes
```

60000ms is a minute, divided by beats per minute gives one beat, divided by two
gives an eighth note. A `setInterval` fires every step, reads the next frequency
out of a `bass` array with `musicStep % t.bass.length` so it loops forever, and
plays it with the same oscillator plus envelope pattern. Passing `tempo = 1.3`
multiplies the bpm, which is how the ninja fight speeds up when it enrages.

---

# 4. Reading the episode out loud (`Listen.jsx`, `Podcast`)

```js
const u = new SpeechSynthesisUtterance(line.text);
u.voice = voices.find((v) => v.name === wanted);
window.speechSynthesis.speak(u);
```

**The voices come from the operating system, not from us and not from the
browser.** macOS ships Samantha, Albert and others. Windows ships different ones.
`getVoices()` asks the OS what it has.

That has two consequences worth knowing:

1. **The voice list is different on every machine.** Never hard code a name.
2. `getVoices()` often returns an empty array on first call, because the OS
   loads them asynchronously. That is why there is an `onvoiceschanged` handler
   that fills the list in when they arrive.

## How it plays through by itself

```js
u.onend = () => { if (!stopped.current) speakFrom(i + 1); };
```

Each line, when it finishes, starts the next one. A **chain**, not a loop.
`speechSynthesis` gives no reliable progress events, so this is how you know when
to advance and which line to highlight.

Clicking a line calls `playFrom(i)` and the chain restarts from there. Stopping
keeps `at`, which is why the button can say Resume.

---

# 5. Getting reliable JSON out of an AI (`server.js`)

This is the core trick of the whole project, and it is two halves.

## Half 1: constrain the output

Every prompt ends with a **literal example** of the shape wanted:

```
Return JSON exactly like:
{"title":"...","days":[{"day":1,...}]}
```

Describing a structure in words is unreliable. Showing one example is not. The
system prompt also names the two specific failure modes that break `JSON.parse`:
markdown fences and trailing commas.

## Half 2: assume it will not be perfect anyway

```js
const start = t.indexOf("{");
const end = t.lastIndexOf("}");
JSON.parse(t.slice(start, end + 1));
```

Find the first `{` and the **last** `}` and throw away everything outside. If the
model writes "Sure, here's your plan:" first, that prose is discarded.

`lastIndexOf` matters because the JSON contains nested objects, so there are many
closing braces. `indexOf` would cut after the first nested object and produce
broken JSON.

**Belt and braces:** ask nicely, then clean up anyway.

---

# 6. Why streaming (`server.js`)

```js
await client.messages.stream({...}).finalMessage();
```

Nobody sees streamed text here, so why stream?

**Because of HTTP timeouts.** A 30,000 token plan takes a long time. A plain
request sends nothing until the whole answer is ready, and something in the
middle, the SDK, a proxy, a host, can decide the connection is dead and kill it.

Streaming sends the answer in pieces as it is produced, so data is always
flowing and nothing times out. `.finalMessage()` waits for the last piece and
hands you the complete message, so your code looks the same as the non streaming
version.

`/api/grade` is only 3,000 tokens and returns fast, so it does not need it.

---

# 7. Why a browser blocks your own server (CORS)

Your front end is on port 5174, your server on 3001. **Different port means
different origin**, and browsers refuse to let a page read a response from a
different origin unless that origin says it is allowed.

The important detail: **the server always sends the data.** The browser receives
it and then refuses to hand it to your JavaScript. That is why `curl` works fine
while the page shows a CORS error, and why it is called a browser security
feature rather than a server one.

`cors()` adds the `Access-Control-Allow-Origin` header that grants permission. Our
version allows any `localhost:<port>` during development, because vite picks
whatever port is free, plus anything listed in `ALLOWED_ORIGINS`.

---

# 8. Why the database is safe with a public key (`supabase.js`)

The Supabase key sits in front end code where anyone can read it. That is not a
mistake.

## Row level security

```sql
create policy "own save" on saves
  for all using (auth.uid() = user_id);
```

This is a rule **inside the database**. Every query gets it silently attached, so
`select * from saves` becomes `select * from saves where user_id = <you>`.

`auth.uid()` comes from the signed **JWT** that Supabase issues on login and the
client sends with every request. It is cryptographically signed, so it cannot be
faked by editing JavaScript.

**Prove it:** query `saves` with the public key and no login and you get `[]`,
even though rows exist. The security is not in the app being careful, it is the
database refusing.

## Why the save is one JSON blob

```sql
saves (user_id uuid primary key, data jsonb, ...)
```

Postgres `jsonb` stores a whole JSON document in one column and can still query
inside it. Since the game already keeps its state as one object for
`localStorage`, storing it as one blob means **adding a feature to the game needs
no database migration**. The tradeoff is you cannot easily ask questions like
"who has the most missions" without digging into the JSON.

## Why the write is delayed four seconds

```js
const t = setTimeout(() => { pushSave(...); }, 4000);
return () => clearTimeout(t);
```

That is a **debounce**. Every change resets the timer, so a fast run of wins
becomes one write instead of twenty. The cleanup function cancelling the previous
timer is what makes it work.

---

# 9. How the pixel art is drawn (`sprites.jsx`)

Each sprite is rows of text. One character is one pixel, `.` is transparent, every
other letter looks up a colour. The renderer draws a **1 by 1 SVG rect** per non
dot character.

The trick that makes it simple:

```jsx
<svg viewBox={`0 0 ${cols} ${rows}`}>
```

`viewBox` sets the SVG's internal coordinate system, so a rect at `x=3, y=5` is
at grid position (3,5) **no matter what size the sprite is displayed at**. You
never do scaling maths. Set `width` to 64 or 128 and the browser scales the whole
coordinate system for you.

`shapeRendering="crispEdges"` turns off anti aliasing. Without it the browser
smooths the edges of each tiny rect and the pixel art goes blurry.

---

# 10. How React knows to redraw (all files)

Worth being able to say once, because it underpins everything.

You never tell the screen to update. You change state with a setter like
`setQueue(...)`, React re runs the component function, compares the new output
with the old, and changes only the DOM nodes that actually differ.

Two consequences that show up in this code:

**`useState(() => shuffle(...))` runs once.** Passing a **function** means React
calls it only on the first render. Passing `shuffle(...)` directly would reshuffle
on every single render, so the questions would reorder on every keystroke.

**`useRef` is for values a timer needs to read.** A `setTimeout` created once
captures the values that existed at that moment. When the dodge timer fires it
would see your starting position, not where you moved to. A ref is a box whose
`.current` can be updated and read live, so state drives what is drawn and the
ref is what the timer checks.
