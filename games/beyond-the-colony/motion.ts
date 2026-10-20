export const TAU = Math.PI * 2;
export const clamp = (n: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, n));
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const fract = (n: number): number => n - Math.floor(n);
export const smooth = (n: number): number => { const u = clamp(n); return u * u * (3 - 2 * u); };
export const between = (a: number, b: number, n: number): number => smooth((n - a) / (b - a));
export const windowAt = (n: number, a: number, b: number, edge = 0.3): number => between(a, a + edge, n) * (1 - between(b - edge, b, n));
export const noise = (n: number): number => fract(Math.sin(n * 78.233 + 12.98) * 43171.311);
/** A visible strike overshoots, then rings down without accumulating frame error. */
export const recoil = (age: number, strength = 1): number => age < 0 ? 0 : Math.sin(age * 18) * Math.exp(-age * 4.5) * strength;
export interface Point { x: number; y: number }
/**
 * A two-bone limb solved toward `end`: the reach is clamped inside the bones' range before either
 * segment is placed, and the joint bends toward +x for a downward limb when `pole` is positive.
 */
export function limb(root: Point, end: Point, upper: number, lower: number, pole: number): { joint: Point; end: Point } {
  const dx = end.x - root.x; const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = clamp(distance, Math.abs(upper - lower) + 0.001, upper + lower - 0.001);
  const ux = dx / distance; const uy = dy / distance;
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * pole;
  return { joint: { x: root.x + ux * along + uy * bend, y: root.y + uy * along - ux * bend }, end: { x: root.x + ux * reach, y: root.y + uy * reach } };
}
/** The shortest signed turn between two angles. */
export const turn = (from: number, to: number): number => ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;

export interface Act {
  index: number;
  kind: number;
  tier: number;
  age: number;
  title: string;
  subtitle: string;
  prop: string;
}
const SCRIPT = [
  ['I RESIGN FROM BEING NORMAL.', 'THE COLONY HAS SOME FEEDBACK.', 'RETURN TO WORK'],
  ['THIS MEETING COULD BE A FISH.', 'COMPLIANCE HAS ENTERED THE CHAT.', 'MANDATORY FUN'],
  ['MY BOSS IS A FUCKING SEAL.', 'APPARENTLY I LACK A GROWTH MINDSET.', 'PERFORMANCE REVIEW'],
  ['ENLIGHTENMENT HAS A PAYWALL.', 'OF COURSE IT FUCKING DOES.', 'NIRVANA FREE TRIAL'],
  ['THE ABYSS LEFT ME ON READ.', 'EVEN THE WIND HAS AN OPINION.', 'PLEASE BE NORMAL'],
  ['BECOME UNGOVERNABLE.', 'SMALL BIRD. CATASTROPHIC MAIN CHARACTER ENERGY.', 'OVERMAN LOADING'],
  ['THE SUMMIT HAS AN HR DEPT.', 'PLEASE TAKE A NUMBER FOR EXISTENCE.', 'MEANING: OUT OF OFFICE'],
  ['THE UNIVERSE THREW A FISH.', 'I WILL BE TAKING THAT PERSONALLY.', 'COSMIC FEEDBACK'],
  ['THE COLONY FORMED A COMMITTEE.', 'THEY HAVE VOTED AGAINST MY VIBE.', 'BACK TO THE HUDDLE'],
  ['WELLNESS IS NOW COMPULSORY.', 'THE DRONE SAYS I SEEM DISTANT.', 'SMILE FOR HR'],
  ['THE SEAL GOT PROMOTED.', 'MY EXISTENTIAL CRISIS IS A KPI.', 'YOUR ATTITUDE: 1/10'],
  ['NIRVANA PLUS. SAME VOID.', 'AD-FREE SUFFERING COSTS EXTRA.', 'FREE TRIAL EXPIRED'],
  ['CLIMATE: HOSTILE WORKPLACE.', 'A NICE LITTLE BREEZE FROM HELL.', 'CIRCLE BACK'],
  ['I HAVE OUTGROWN THE ONBOARDING.', 'THE FLIPPERS WERE WITHIN ME ALL ALONG.', 'COSMIC NEPO BABY'],
  ['THE AFTERLIFE WANTS MY CV.', 'DOES CRYING COUNT AS EXPERIENCE?', 'SOUL: NEEDS APPROVAL'],
  ['FISH TWO: PERSONAL ATTACK.', 'THE SEQUEL HAS A BIGGER BUDGET.', 'URGENT FOLLOW-UP'],
  ['THE HERD DISCOVERED LINKEDIN.', 'SIX THINGS MY BREAKDOWN TAUGHT THEM.', 'THOUGHT LEADER'],
  ['I AM BEING PERFORMANCE-MANAGED.', 'BY A FLYING TOASTER WITH AN MBA.', 'WE ARE A FAMILY'],
  ['THE SEAL IS THE BOARD NOW.', 'THE BOARD WOULD LIKE ME TO STOP.', 'SYNERGY OR ELSE'],
  ['GOD HAS A SUBSCRIPTION TIER.', 'CANCEL ANYTIME. EXCEPT NOW.', 'NIRVANA ENTERPRISE'],
  ['I AM THE WEATHER PROBLEM.', 'THE MOUNTAIN HAS FILED A COMPLAINT.', 'FINAL WARNING'],
  ['NIETZSCHE COULD NEVER.', 'BEHOLD THE UNBOTHERED UBERBIRD.', 'MAXIMUM FREE WILL'],
  ['MEANING HAS BEEN OUTSOURCED.', 'YOUR SOUL IS IMPORTANT TO US.', 'PLEASE HOLD FOREVER'],
  ['FISH THREE: THE RECKONING.', 'SOMEHOW, THE SALMON RETURNED.', 'RE: RE: RE: EXISTENCE'],
] as const;
export function actAt(seconds: number): Act {
  const index = Math.floor(Math.max(0, seconds) / 7);
  const script = SCRIPT[index % SCRIPT.length]!;
  return { index, kind: index % 8, tier: Math.floor(index / 8), age: Math.max(0, seconds) % 7, title: script[0], subtitle: script[1], prop: script[2] };
}
