/** Presentation follows the room clock. An audit never predicts or selects a crash. */
export const clamp = (n: number, a = 0, b = 1): number => Math.max(a, Math.min(b, n));
export const mix = (a: number, b: number, n: number): number => a + (b - a) * n;
export const ease = (n: number): number => { const t = clamp(n); return t * t * (3 - 2 * t); };

export const CHECKS = [
  { at: 0, title: 'PROOF OF FLESH', demand: 'Blink like you mean it.', note: 'FACE FOUND. SHAME DETECTED.', stamp: 'LIVENESS', department: 'BIOMETRICS', line: 'A small price for generational wealth.' },
  { at: 18, title: 'DENTAL DUE DILIGENCE', demand: 'Smile for the shareholders.', note: '32 TEETH. ZERO EXIT STRATEGY.', stamp: 'DENTAL', department: 'DENTAL RECORDS', line: 'Your enamel is now a real-world asset.' },
  { at: 37, title: 'CHARACTER WITNESS', demand: 'Your dog has some concerns.', note: 'GOOD BOY. BAD TESTIMONY.', stamp: 'WITNESS', department: 'CANINE AFFAIRS', line: 'He says you call every top a dip.' },
  { at: 57, title: 'GENERATIONAL BAGGAGE', demand: 'Your ancestors have been notified.', note: 'THE BLOODLINE IS COOKED.', stamp: 'ANCESTRY', department: 'FAMILY LIABILITIES', line: 'Even your great-grandfather was exit liquidity.' },
  { at: 78, title: 'CAPTCHA BALLET', demand: 'Dance if you are financially sentient.', note: 'HUMAN? DEBATABLE.', stamp: 'HUMAN', department: 'HUMILIATION', line: 'The robots are enjoying this one.' },
  { at: 100, title: 'DEEP THOUGHT SCAN', demand: 'Searching for an original thought.', note: 'NO THOUGHTS. 47 OPEN TABS.', stamp: 'COGNITION', department: 'CEREBRAL ASSETS', line: 'We found a seed phrase and three rocket emojis.' },
  { at: 125, title: 'SOUL APPRAISAL', demand: 'Your conviction has a resale value.', note: 'SOUL FOUND. LIGHTLY USED.', stamp: 'SOUL', department: 'METAPHYSICAL DESK', line: 'You clicked agree before you were born.' },
  { at: 150, title: 'FINAL FINAL CHECK', demand: 'Just one more final final final check.', note: 'MANUAL REVIEW BY ANOTHER BOT.', stamp: 'FINAL?', department: 'INFINITE REVIEW', line: 'You are very important to our data buyers.' },
] as const;

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
  serial: number;
  age: number;
  cycle: number;
  action: number;
  tension: number;
  title: string;
  demand: string;
  note: string;
  stamp: string;
  department: string;
  line: string;
}

/** Eight distinct acts, then an unbounded sequence of eighteen-second audit appointments. */
export function directionAt(elapsedMs: number): Direction {
  const seconds = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs / 1000) : 0;
  let stage = 0;
  for (let i = 1; i < CHECKS.length; i++) if (seconds >= CHECKS[i]!.at) stage = i;
  const audit = seconds >= 174 ? Math.floor((seconds - 174) / 18) : -1;
  const extra = audit >= 0 ? REAUDITS[audit % REAUDITS.length]! : null;
  if (extra) stage = extra.stage;
  const check = CHECKS[stage]!;
  const age = seconds - (audit >= 0 ? 174 + audit * 18 : check.at);
  const cycle = Math.floor(age / 4.8);
  const action = (age % 4.8) / 4.8;
  const envelope = seconds / (seconds + 100);
  const breath = Math.sin(age / 4.8 * Math.PI * 2) * 0.035;
  return { ...check, ...extra, seconds, stage, serial: audit >= 0 ? CHECKS.length + audit : stage,
    age, cycle, action, tension: clamp(0.14 + envelope * 0.82 + breath, 0.1, 0.94) };
}

/** Deliberately bounded visual motions, including when the multiplier exceeds the normal display width. */
export function multiplierLabel(x100: number): string {
  const x = Number.isFinite(x100) ? Math.max(100, x100) / 100 : 1;
  return `${x.toFixed(2)}×`;
}
