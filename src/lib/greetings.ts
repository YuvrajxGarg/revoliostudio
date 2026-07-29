/**
 * Home dashboard greeting — one random, time-of-day-appropriate line shown
 * per page load, in the same spirit as `randomTip` in tips.ts. `{name}` is
 * substituted with the user's first name, or dropped (and surrounding
 * punctuation cleaned up) when we don't have one.
 *
 * Voice rules, learned the hard way: no em dashes, and no two lines sharing
 * a sentence shape. The previous pool was ten variations of
 * "Good <time>, {name} — <exhortation>." which is exactly what generated
 * copy reads like. Assume the reader is an editor with a deadline and a
 * client, not someone who needs to be told that creating is fun. Dry beats
 * enthusiastic; specific beats motivational. Avoid "prompt", "generate",
 * "masterpiece" and "AI" — the greeting should sound like the tool, not
 * like the marketing for the tool.
 */
const MORNING: string[] = [
  "Morning, {name}. The good light doesn't last.",
  "You're up, {name}. The render queue isn't.",
  "Morning, {name}. Fresh eyes, cheap revisions.",
  "Coffee first, {name}. We'll be here.",
  "Morning, {name}. Nothing's been ruined yet.",
];

const AFTERNOON: string[] = [
  "Afternoon, {name}. Still fixable.",
  "Afternoon, {name}. The good idea usually shows up around now.",
  "Back at it, {name}.",
  "Afternoon, {name}. Nobody nails it on the first pass.",
  "Afternoon, {name}. Version three is normally the one.",
];

const EVENING: string[] = [
  "Evening, {name}. Golden hour, if you're outside.",
  "Evening, {name}. One more version, then dinner.",
  "Evening, {name}. The client can wait until tomorrow.",
  "Evening, {name}. Quietest hours are the productive ones.",
  "Evening, {name}. Save before you close anything.",
];

const LATE_NIGHT: string[] = [
  "Still here, {name}? So are we.",
  "Late shift, {name}. Don't trust your color judgment past 2am.",
  "It's late, {name}. Whatever you're fixing will still be broken tomorrow.",
  "Nobody makes good decisions at this hour, {name}. Make something anyway.",
];

function fill(template: string, firstName: string): string {
  if (firstName) return template.replace("{name}", firstName);
  // Drop the ", {name}" clause entirely rather than leaving a stray comma
  // or "Hey ,". A line written as "{name}, ..." would still leave a leading
  // comma behind, so tidy the head of the string and close up any double
  // space the removal opened.
  return template
    .replace(/,?\s*\{name\}/, "")
    .replace(/^[,\s]+/, "")
    .replace(/\s{2,}/g, " ");
}

/** Picks one greeting line at random, appropriate for the given hour (0-23). */
export function pickGreeting(hour: number, firstName: string): string {
  const pool = hour < 5 ? LATE_NIGHT : hour < 12 ? MORNING : hour < 17 ? AFTERNOON : EVENING;
  const template = pool[Math.floor(Math.random() * pool.length)];
  return fill(template, firstName);
}
