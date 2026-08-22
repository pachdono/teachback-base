# Accounts and leaderboard with Supabase

The code is already written. Nothing works until you add two values, and until
then the app behaves exactly as before: saves to this browser, no account menu,
no leaderboard. That is on purpose, so a wrong key cannot break a demo.

## 1. Make the project

1. Go to supabase.com, sign in, New project.
2. Pick any name and a database password. Save that password somewhere.
3. Wait for it to finish setting up, about two minutes.

## 2. Make the tables

Left sidebar, SQL Editor, New query. Paste all of this and hit Run.

```sql
-- One row per player. The save is the same object the app already keeps
-- in localStorage, stored as JSON.
create table saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Only what the leaderboard needs to draw, nothing private.
create table scores (
  user_id uuid primary key references auth.users on delete cascade,
  name text,
  xp integer not null default 0,
  updated_at timestamptz default now()
);

-- Row level security. Without this, anyone with the public key could read
-- every row in the table.
alter table saves enable row level security;
alter table scores enable row level security;

-- You can only touch your own save.
create policy "own save" on saves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Everyone can read the leaderboard, but you can only write your own row.
create policy "read scores" on scores for select using (true);
create policy "write own score" on scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**The policies are the part that matters.** The key in the frontend is public by
design. What stops someone reading other people's saves is the database refusing
the query, not the app being careful.

## 3. Turn it on

Settings, API. Copy the Project URL and the `anon` `public` key into `.env`:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Restart `npm run dev`. Vite only reads env vars at startup, so this will not
work until you restart.

A "Sign in" entry now appears in the menu.

## 4. Email confirmation

By default Supabase emails a confirmation link before a new account can sign in.
For a demo that is friction you do not want. Authentication, Providers, Email,
and turn off "Confirm email". Accounts then work straight away.

## How it behaves

- **Signed out:** exactly as before, saved to this browser.
- **Signing in:** the app compares the cloud save with the local one and keeps
  whichever has more XP. So playing signed out first does not lose progress, and
  neither does playing on another machine.
- **While playing:** the save is written to the cloud four seconds after you stop
  changing things, not on every click. A run of quick wins is one write.
- **If Supabase is down:** every cloud call is wrapped so it fails quietly. The
  local save still happens and the game keeps working.

## What to say if asked

> Progress is stored per user in Postgres, with row level security so the
> database itself refuses to return another player's row. The app keeps working
> signed out because localStorage is still the primary store and the cloud is a
> sync layer on top.

## The honest gap

If the same account plays on two devices at once, the last one to write wins and
the other one's progress is lost. Proper merging needs per-field timestamps and
was not worth building for this. Comparing XP on sign in covers the normal case,
which is playing in one place at a time.
