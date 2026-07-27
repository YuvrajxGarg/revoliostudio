/**
 * Home dashboard greeting — one random, time-of-day-appropriate line shown
 * per page load, in the same spirit as `randomTip` in tips.ts. `{name}` is
 * substituted with the user's first name, or dropped (and surrounding
 * punctuation cleaned up) when we don't have one.
 */
const MORNING: string[] = [
  "Good morning, {name} — let's make something great.",
  "Rise and render, {name}.",
  "Morning, {name}. Coffee's optional, generating isn't.",
  "Good morning, {name} — what are we creating today?",
  "Morning, {name} — first render of the day is always the best one.",
];

const AFTERNOON: string[] = [
  "Good afternoon, {name} — let's keep the momentum going.",
  "Afternoon, {name}. Time to make something cool.",
  "Good afternoon, {name} — your next masterpiece is one prompt away.",
  "Hey {name}, the afternoon slump is no match for a good generation.",
  "Good afternoon, {name} — let's ship something today.",
];

const EVENING: string[] = [
  "Good evening, {name} — let's wind down with something creative.",
  "Evening, {name}. One more generation before you call it a day?",
  "Good evening, {name} — golden hour for golden renders.",
  "Evening, {name} — what should we make tonight?",
];

const LATE_NIGHT: string[] = [
  "Working late, {name}? Respect the hustle.",
  "Burning the midnight oil, {name}?",
  "Still up, {name}? Let's make it count.",
  "Night owl mode, {name} — let's create something while it's quiet.",
];

function fill(template: string, firstName: string): string {
  if (firstName) return template.replace("{name}", firstName);
  // Drop the ", {name}" clause entirely rather than leaving a stray comma
  // or "Hey ,".
  return template.replace(/,?\s*\{name\}/, "");
}

/** Picks one greeting line at random, appropriate for the given hour (0-23). */
export function pickGreeting(hour: number, firstName: string): string {
  const pool = hour < 5 ? LATE_NIGHT : hour < 12 ? MORNING : hour < 17 ? AFTERNOON : EVENING;
  const template = pool[Math.floor(Math.random() * pool.length)];
  return fill(template, firstName);
}
