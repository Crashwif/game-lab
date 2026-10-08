/** Presentation follows the room clock and multiplier. An audit never predicts or selects a crash. */
export const clamp = (n: number, a = 0, b = 1): number => Math.max(a, Math.min(b, n));
export const mix = (a: number, b: number, n: number): number => a + (b - a) * n;
export const ease = (n: number): number => { const t = clamp(n); return t * t * (3 - 2 * t); };

// Most rounds end before 3× (about 14 s), so the authored acts arrive every five to eight seconds.
export const CHECKS = [
  { at: 0, title: 'PROOF OF FLESH', demand: 'Blink like you mean it.', note: 'FACE FOUND. SHAME DETECTED.', stamp: 'EXIT LIQUIDITY', department: 'BIOMETRICS', line: 'A small price for generational wealth.' },
  { at: 6, title: 'DENTAL DUE DILIGENCE', demand: 'Smile for the shareholders.', note: '32 TEETH. ZERO EXIT STRATEGY.', stamp: 'NGMI', department: 'DENTAL RECORDS', line: 'Your enamel is now a real-world asset.' },
  { at: 11, title: 'CHARACTER WITNESS', demand: 'Your dog has some concerns.', note: 'GOOD BOY. BAD TESTIMONY.', stamp: 'SYBIL?', department: 'CANINE AFFAIRS', line: 'He says you call every top a dip.' },
  { at: 16, title: 'GENERATIONAL BAGGAGE', demand: 'Your ancestors have been notified.', note: 'THE BLOODLINE IS COOKED.', stamp: 'ANCESTRY', department: 'FAMILY LIABILITIES', line: 'Even your great-grandfather was exit liquidity.' },
  { at: 21, title: 'CAPTCHA BALLET', demand: 'Dance if you are financially sentient.', note: 'HUMAN? DEBATABLE.', stamp: 'HUMAN', department: 'HUMILIATION', line: 'The robots are enjoying this one.' },
  { at: 27, title: 'DEEP THOUGHT SCAN', demand: 'Searching for an original thought.', note: 'NO THOUGHTS. 47 OPEN TABS.', stamp: 'COGNITION', department: 'CEREBRAL ASSETS', line: 'We found a seed phrase and three rocket emojis.' },
  { at: 34, title: 'SOUL APPRAISAL', demand: 'Your conviction has a resale value.', note: 'SOUL FOUND. LIGHTLY USED.', stamp: 'SOUL', department: 'METAPHYSICAL DESK', line: 'You clicked agree before you were born.' },
  { at: 42, title: 'FINAL FINAL CHECK', demand: 'Just one more final final final check.', note: 'MANUAL REVIEW BY ANOTHER BOT.', stamp: 'FINAL?', department: 'INFINITE REVIEW', line: 'You are very important to our data buyers.' },
] as const;

/** Recurring audits begin after the final authored act and last twelve seconds each. */
export const AUDITS_AT = 50;
const AUDIT = 12;
const REAUDITS = [
  { stage: 2, title: 'DOG APPEAL HEARING', demand: 'The witness would like a lawyer.', note: 'HE HAS RETAINED A BEAGLE.', line: 'Your dog has a better risk profile.' },
  { stage: 4, title: 'ADVANCED CAPTCHA', demand: 'Express regret using only your knees.', note: 'MORE FEELING. LESS DIGNITY.', line: 'A robot could never be this embarrassing.' },
  { stage: 5, title: 'BRAIN REINDEXING', demand: 'Still looking for the fundamentals.', note: 'THE FUNDAMENTALS ARE VIBES.', line: 'Please leave your remaining thought on the belt.' },
  { stage: 6, title: 'SOUL REFINANCING', demand: 'The terms have acquired more terms.', note: 'CONSENT HAS BEEN ASSUMED.', line: 'The small print has developed a small print.' },
  { stage: 3, title: 'ANCESTRAL APPEAL', demand: 'Your ancestors have appealed.', note: 'THEY REQUESTED A DIFFERENT DESCENDANT.', line: 'Generational wealth remains generationally pending.' },
  { stage: 7, title: 'FINALITY REASSESSMENT', demand: 'The final check requires verification.', note: 'FINAL FINAL FINAL FINAL.', line: 'Your patience is being monetized.' },
] as const;

export interface Direction {
  seconds: number;
  stage: number;
  level: number;
  serial: number;
  age: number;
  cycle: number;
  action: number;
  /** Audio tension with a slow breath; 1×–3× sweeps about 0.12–0.65. */
  tension: number;
  /** The same curve without the breath, for expressions and props that must only escalate. */
  dread: number;
  /** A slower log driver that keeps 10×–10,000× rounds changing. */
  long: number;
  x100: number;
  title: string;
  demand: string;
  note: string;
  stamp: string;
  department: string;
  line: string;
}

/**
 * Eight distinct acts, then an unbounded sequence of twelve-second audit appointments.
 * Tension follows the supplied multiplier; without one, it assumes the room's 10× per 30 s curve.
 */
export function directionAt(elapsedMs: number, x100?: number): Direction {
  const seconds = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs / 1000) : 0;
  let stage = 0;
  for (let i = 1; i < CHECKS.length; i++) if (seconds >= CHECKS[i]!.at) stage = i;
  const audit = seconds >= AUDITS_AT ? Math.floor((seconds - AUDITS_AT) / AUDIT) : -1;
  const extra = audit >= 0 ? REAUDITS[audit % REAUDITS.length]! : null;
  if (extra) stage = extra.stage;
  const check = CHECKS[stage]!;
  const age = seconds - (audit >= 0 ? AUDITS_AT + audit * AUDIT : check.at);
  const cycle = Math.floor(age / 4.8);
  const action = (age % 4.8) / 4.8;
  const x = x100 !== undefined && Number.isFinite(x100) ? Math.max(1, x100 / 100) : Math.min(1e12, 10 ** (seconds / 30));
  const dread = .12 + .8 * (1 - 1 / x);
  // The breath follows the round clock, so it never jumps at an appointment boundary.
  const breath = Math.sin(seconds / 4.8 * Math.PI * 2) * 0.035;
  return { ...check, ...extra, seconds, stage, level: audit >= 0 ? 7 : stage, serial: audit >= 0 ? CHECKS.length + audit : stage,
    age, cycle, action, tension: clamp(dread + breath, 0.1, 0.94), dread, long: clamp(Math.log10(x) / 4), x100: x * 100 };
}

/** Clown makeup follows the multiplier: the nose pops at 1.5×, white face at 2.5×, painted mouth at 4×. */
export interface Paint { nose: number; face: number; mouth: number }
export function paintAt(x100: number, reduced = false): Paint {
  const x = Number.isFinite(x100) ? x100 / 100 : 1;
  const u = clamp((x - 1.5) / .07);
  // A short overshoot sells the nose arriving; the face and mouth paint in.
  const nose = u <= 0 ? 0 : reduced ? 1 : 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2;
  return { nose, face: ease((x - 2.5) / .25), mouth: ease((x - 4) / .45) };
}

/** Stages 0–2 each land one label in their first cycle; every stroke of the stamp arm is 15% quicker. */
export const STAMP_AT = .69;
export function stampReach(d: Direction): number {
  if (d.serial > 2 || d.cycle > 0) return 0;
  const lead = .21 * .85 ** d.serial;
  return ease((d.action - STAMP_AT + lead) / lead) * (1 - ease((d.action - .77) / .18));
}
/** Labels stamped so far, and seconds since the newest landed. */
export function stampsAt(d: Direction, reduced = false): { count: number; age: number } {
  if (d.serial > 2) return { count: 3, age: 9 };
  const landed = reduced || d.cycle > 0 || d.action >= STAMP_AT;
  return { count: d.serial + (landed ? 1 : 0), age: landed && !reduced ? d.age - STAMP_AT * 4.8 : 9 };
}

/** Crash beats fit the room's two-second crash hold: impact and hit-stop, packing, then one peanut. */
export const HIT = .16;
export const PEANUT = 1.25;

/** The crate's walls creep up with dread, then keep inching up in very long rounds. */
export function crateWalls(d: Direction): number {
  return 46 * ease((d.dread - .28) / .45) + 34 * d.long;
}

/** Crate twitches are fake-outs on the round clock: a ratchet, a jolt, then nothing happens. */
const JOLTS = [7.6, 12.8, 18.7, 24.4, 31, 38.5, 46];
export function joltAt(seconds: number): { index: number; age: number } {
  let index = -1;
  for (let i = 0; i < JOLTS.length; i++) if (seconds >= JOLTS[i]!) index = i;
  if (seconds >= 55) index = JOLTS.length + Math.floor((seconds - 55) / 9);
  const start = index < JOLTS.length ? JOLTS[index] ?? -9 : 55 + (index - JOLTS.length) * 9;
  return { index, age: seconds - start };
}

/** The allocation display checks eligibility as the multiplier climbs, including one false hope. */
export function allocationAt(x100: number): { text: string; hope: boolean; bad: boolean } {
  const x = x100 / 100;
  if (x < 1.4) return { text: 'PENDING', hope: false, bad: false };
  if (x < 2) return { text: 'CHECKING…', hope: false, bad: false };
  if (x < 2.15) return { text: 'ELIGIBLE!', hope: true, bad: false };
  if (x < 3.2) return { text: 'NOT ELIGIBLE', hope: false, bad: true };
  if (x < 6) return { text: 'APPEAL FILED', hope: false, bad: false };
  return { text: 'SEASON 2', hope: false, bad: false };
}

/** The witness keeps adding to his testimony, and names the sybil as the stamp lands on the badge. */
export function testimony(d: Direction): string {
  return d.age < 1.6 ? 'HE BOUGHT TOP.' : d.age < STAMP_AT * 4.8 ? 'EVERY. TIME.' : 'HE’S A SYBIL.';
}

/** Deliberately bounded visual motions, including when the multiplier exceeds the normal display width. */
export function multiplierLabel(x100: number): string {
  const x = Number.isFinite(x100) ? Math.max(100, x100) / 100 : 1;
  return `${x.toFixed(2)}×`;
}
