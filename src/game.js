// Shared helpers for the study campaign.

export function answerText(q) {
  return q.type === "multiple_choice" ? q.options[q.answer] : String(q.answer);
}

// Typed answers shouldn't fail on punctuation or spacing, so compare loosely.
// (Still rough — number words, symbols and synonyms are on the list.)
function normalise(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()]/g, "")
    .replace(/\s+/g, " ");
}

export function isRightAnswer(q, typed) {
  const t = normalise(typed);
  if (t === normalise(q.answer)) return true;

  // allow "x = 4" or "the answer is 4" when the answer is a number
  if (/\d/.test(String(q.answer))) {
    const nums = t.match(/-?\d+(\.\d+)?/g);
    if (nums && nums[nums.length - 1] === normalise(q.answer)) return true;
  }
  return false;
}
