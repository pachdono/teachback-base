import { createClient } from "@supabase/supabase-js";

// Both of these are safe in frontend code. The anon key only works together
// with the row level security policies set on the table.
// The dashboard shows several URLs. Only the project root works here, so trim
// off a trailing slash or a /rest/v1 path if that is what got pasted in.
const url = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If the keys are missing the app still runs, it just stays offline and saves
// to this browser only. That way a bad key can never take the whole app down.
export const supabase = url && key ? createClient(url, key) : null;
export const cloudOn = !!supabase;

export async function currentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

// One row per player holding the same object we already keep in localStorage.
export async function loadSave(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("saves")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}

export async function pushSave(userId, save) {
  if (!supabase) return;
  const { error } = await supabase
    .from("saves")
    .upsert({ user_id: userId, data: save, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// The leaderboard stores only what it needs to show, not the whole save.
export async function pushScore(userId, name, xp) {
  if (!supabase) return;
  await supabase.from("scores").upsert({ user_id: userId, name, xp, updated_at: new Date().toISOString() });
}

export async function topScores(limit = 20) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("scores")
    .select("name, xp")
    .order("xp", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
