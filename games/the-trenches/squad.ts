/**
 * The trench and the squad: frog soldiers in helmets with a marching rig
 * whose cadence follows the multiplier, the sergeant with his field phone,
 * the whistle and the vault over the top, your frog's dive back into the
 * trench, and the KIA state after the nuke. Every frog is drawn by one
 * path per mode, so a dive or a fling leaves from exactly where it stood
 * and lands exactly on its resting pose. Nothing here changes the outcome.
 */
import { endurance } from './endurance';
import { INK, RIDGE_Y, TRENCH_Y, W, mudRate, ridgeY } from './field';
import { type Spring, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export const YOURS = 2;
/** The paper-hands frog: the one who raises the white flag. */
export const FLAG_FROG = 3;
const COUNT = 5;
/** What the sergeant shouts at the white flag, in turn. */
const GLARES = ['OI. FLAG DOWN.', 'NO PAPER HANDS HERE', 'BACK IN LINE, PRIVATE'];
/** The orders down the field phone, escalating with the multiplier: below 1.6×, 3×, 8×, then above. */
const ORDERS = [
  ['GM SOLDIERS', 'BUY THE DIP', 'WAGMI', 'HOLD THE LINE'],
  ['DEV IS BASED', 'LP IS LOCKED (TRUST)', 'REINFORCEMENTS SOON', 'ITS JUST A DIP'],
  ['NO RETREAT, NO SELLING', 'HEALTHY PULLBACK', 'THE CABAL IS WITH US', 'FUNDS ARE SAFU'],
  ['COMMAND SAYS HOLD', 'DEV WALLET MOVING. PROBABLY NOTHING', 'WHO SAID SELL', 'COMMAND IS ON A YACHT'],
];
const TRENCH_FLOOR = TRENCH_Y + 78;
/** Where a frog stands in the trench, where the march starts behind the sandbags, and how near the ridge it ends. */
const STAND_Y = TRENCH_FLOOR + 8;
const FIELD_Y = TRENCH_Y - 6;
const FAR_Y = RIDGE_Y + 8;
/** The whistle, then each frog vaults the parapet in turn from the sergeant's end. */
const VAULT_AT = 0.2;
const VAULT_GAP = 0.12;
const VAULT_S = 0.5;
const DIVE_S = 0.75;
const FLUNG_S = 1.05;
/** Mud lines of ground covered per stride cycle: the march and the scrolling field share it. */
const STRIDE = 0.85;
/** The body's centre above the feet, in rig units: flights follow it and turn about it. */
const CENTRE = 45;
const SKIN = '#5cab4a';
const HELMET = '#5e6b3a';

export type FrogMode = 'trench' | 'vaulting' | 'marching' | 'diving' | 'safe' | 'flat' | 'flung' | 'dead';

export interface Frog {
  mode: FrogMode;
  x: number;
  seed: number;
  /** Stride cycles walked: it advances with the ground covered, never with the clock. */
  phase: number;
  /** 0 standing to 1 at full march pace, ramped in after the landing. */
  pace: number;
  /** The idle weight shift, an integrated phase. */
  sway: number;
  /** Progress through the vault over the parapet (below 0 still crouched in the trench). */
  vault: number;
  squash: Spring;
  /** Seconds into a dive, a fling or a flattening; it keeps counting once your frog is safe. */
  diveAge: number;
  /** Where and how the frog was drawn when it set off: a dive or a fling leaves from exactly this pose. */
  diveFrom: Place & Pose;
  /** The flight's arc height, and whether it set off from the field side of the sandbags. */
  arc: number;
  behind: boolean;
  clang: Spring;
}

/** What happened this step, for the scene's sound: each is true for one frame. */
export interface SquadEvents { whistle: boolean; step: boolean; land: boolean; phone: boolean; clang: boolean; glare: boolean; flip: boolean }
interface Fleck { x: number; y: number; vx: number; vy: number; age: number; cash: boolean }

export interface Squad {
  act: number; effort: number;
  time: number;
  /** The tension last stepped, so a dive or a fling captured between frames leaves from where the frog was drawn. */
  tension: number;
  frogs: Frog[];
  /** The squad's pace across the field, 0 to 1, ramped in and out: the ground scrolls with it. */
  over: Spring;
  /** How far the field has scrolled toward the trench, in mud-line spacings, and how far up it the squad has
   * climbed on screen (the scroll leaves that part out). */
  scroll: number;
  climb: number;
  whistle: Spring;
  whistled: boolean;
  /** The field phone: the ring, the next call (round seconds), the calls so far, and the order on the line (its tier and its line in it). */
  ring: Spring;
  ringAge: number;
  callAt: number;
  calls: number;
  tier: number;
  order: number;
  bubble: string;
  bubbleAge: number;
  /** What the sergeant shouts after your frog when you cash out. */
  shout: string;
  shoutAge: number;
  dead: boolean;
  deadAge: number;
  /** The nuke landed before anyone left the trench. */
  early: boolean;
  /** Seconds since this round's squad mustered: they climb into the trench. */
  muster: number;
  /** The white flag on the paper-hands frog: how far up it is, how long the sergeant's glare keeps it down, and the glares. */
  flag: Spring;
  flagDown: number;
  glareNext: number;
  glareAge: number;
  glares: number;
  /** The DAYS SINCE LAST RUG sign: the count, and the card's flip to zero. */
  days: number;
  flip: Spring;
  /** The sergeant's weight shift (quicker with the tension) and the thump of his fall. */
  sargeSway: number;
  sarge: Spring;
  /** Mud and cash thrown up when your frog lands back in the trench. */
  flecks: Fleck[];
  stepNext: number;
  events: SquadEvents;
}

function makeFrog(i: number): Frog {
  return { mode: 'trench', x: 210 + i * 130, seed: i * 7.3 + 1, phase: i * 1.3, pace: 0, sway: i * 2.1, vault: -9, squash: spring(0), diveAge: 0, diveFrom: { x: 0, y: 0, scale: 1, stride: 0, squash: 0, expression: 'grit' }, arc: 0, behind: true, clang: spring(0) };
}

export function createSquad(): Squad {
  return {
    act: 0, effort: 0, time: 0, tension: 0, frogs: Array.from({ length: COUNT }, (_, i) => makeFrog(i)), over: spring(0), scroll: 0, climb: 0, whistle: spring(0), whistled: false,
    ring: spring(0), ringAge: 9, callAt: 0, calls: 0, tier: -1, order: 0, bubble: '', bubbleAge: 9, shout: '', shoutAge: 9, dead: false, deadAge: 0, early: false, muster: 0,
    flag: spring(0), flagDown: 0, glareNext: 0, glareAge: 9, glares: 0, days: 1, flip: spring(0), sargeSway: 0, sarge: spring(0), flecks: [], stepNext: 0,
    events: { whistle: false, step: false, land: false, phone: false, clang: false, glare: false, flip: false },
  };
}

export function resetSquad(s: Squad): void {
  s.frogs = Array.from({ length: COUNT }, (_, i) => makeFrog(i));
  settleSpring(s.over, 0);
  settleSpring(s.whistle, 0);
  s.whistled = false;
  settleSpring(s.ring, 0);
  s.ringAge = 9;
  s.callAt = 0;
  s.calls = 0;
  s.tier = -1;
  s.bubble = '';
  s.bubbleAge = 9;
  s.shoutAge = 9;
  s.dead = false;
  s.deadAge = 0;
  s.early = false;
  s.muster = 0;
  settleSpring(s.flag, 0);
  s.flagDown = 0;
  s.glareNext = 0;
  s.glareAge = 9;
  s.glares = 0;
  s.days = 1;
  settleSpring(s.flip, 0);
  settleSpring(s.sarge, 0);
  s.flecks = [];
}

/** How far up the white flag is at this tension: it starts creeping up at 1.22× and is fully up by 2×. */
const flagFor = (tension: number): number => smoothstep(0.18, 0.5, tension);
const vaultAt = (i: number): number => VAULT_AT + (COUNT - 1 - i) * VAULT_GAP;
/** The act's brace, added to the marching squash. */
const actSquash = (s: Squad): number => (s.act === 3 ? 0.9 : s.act === 4 ? 0.4 : 0) * s.effort;
/** The crouch before the vault, then the stretch of the take-off: continuous through the jump. */
const vaultSquash = (u: number): number => 0.8 * smoothstep(-0.3, -0.05, u) * (1 - smoothstep(-0.05, 0.12, u)) - 0.6 * Math.sin(Math.PI * clamp(u * 2, 0, 1));
/** The mud at a marching frog's feet: the act-2 mud, or more of it as the tension climbs. */
const marchMud = (s: Squad, tension: number): number => s.act === 2 ? Math.max(tension, s.effort) : tension * 0.65;
/** The stride through the vault: the planted stance in the trench blends into the nearest cycle of the frog's own
 * march phase, so the legs never spin through whole strides in the air. */
const vaultStride = (f: Frog): number => mix(0.05, f.phase - Math.round(f.phase - 0.05), smoothstep(0, 0.6, f.vault));

/** Joins a round already running at `seconds`: the frogs are where the whistle would have put them by now, and the flag is where the tension holds it. */
export function settleSquad(s: Squad, tension = 0, seconds = 0): void {
  s.whistled = seconds > 0;
  s.tension = tension;
  s.muster = 9;
  s.callAt = seconds + 1;
  s.glareNext = seconds + 1;
  settleSpring(s.flag, flagFor(tension));
  s.frogs.forEach((f, i) => {
    f.vault = (seconds - vaultAt(i)) / VAULT_S;
    if (f.vault >= 1) { f.mode = 'marching'; f.pace = 1; } else if (f.vault >= 0) f.mode = 'vaulting';
  });
  settleSpring(s.over, s.frogs.some((f) => f.mode === 'marching') ? 1 : 0);
}

type Place = { x: number; y: number; scale: number };

/** Where a marching frog stands at `progress` (1 − 1/x): up the field toward the ridge, smaller with distance, closing in on the centre, and never past the ridge line. */
export function marchPosition(f: Frog, progress: number, tension = 0): Place {
  const p = clamp(progress, 0, 1);
  const x = W / 2 + (f.x - W / 2) * mix(1, 0.62, p) + Math.sin(f.seed * 3 + p * 6) * 22 * p;
  return { x, y: Math.max(mix(FIELD_Y, FAR_Y, p), ridgeY(x, tension, 0) + 12), scale: mix(1, 0.55, p) };
}

/** The vault: a hop arc from the trench floor over the sandbags onto the frog's march spot. */
function vaultPlace(f: Frog, progress: number, tension: number): Place {
  const u = clamp(f.vault, 0, 1);
  const k = smoothstep(0, 1, u);
  const to = marchPosition(f, progress, tension);
  return { x: mix(f.x, to.x, k), y: mix(STAND_Y, to.y, k) - 80 * Math.sin(Math.PI * u), scale: mix(1, to.scale, k) };
}

/** The dive back: a crouch, then a ballistic arc (the feet) over the sandbags onto the trench floor, leaning into it. */
function divePlace(f: Frog): Place & { u: number; apex: number; lean: number } {
  const u = clamp((f.diveAge - 0.1) / (DIVE_S - 0.1), 0, 1);
  const from = f.diveFrom;
  const apex = 0.5 - (STAND_Y - from.y) / (8 * f.arc);
  return { x: mix(from.x, f.x, u), y: mix(from.y, STAND_Y, u) - 4 * f.arc * u * (1 - u), scale: mix(from.scale, 1, u), u, apex, lean: -1.1 * Math.sin(Math.PI * u) };
}

/** The rig's anchor (between the feet) that puts its body centre at `c` once turned by `spin` and laid down by `fall`. */
function anchor(c: { x: number; y: number }, scale: number, spin: number, fall: number): { x: number; y: number } {
  const a = -10 * fall;
  const b = 20 * fall - CENTRE;
  const cos = Math.cos(spin);
  const sin = Math.sin(spin);
  return { x: c.x - scale * (a * cos - b * sin), y: c.y - scale * (a * sin + b * cos) };
}

/** Where a KIA frog lies: on the trench floor in front of where it stood. */
const restOf = (f: Frog): Place => ({ x: f.x - 30, y: TRENCH_FLOOR - 8, scale: 0.9 });

/** A frog flung by the blast: its centre flies a ballistic arc back over the sandbags while it tumbles, and lands on exactly the lying pose. */
function flight(f: Frog): Place & { u: number; apex: number; spin: number; fall: number } {
  const u = clamp(f.diveAge / FLUNG_S, 0, 1);
  const from = f.diveFrom;
  const rest = restOf(f);
  const c0 = { x: from.x, y: from.y - CENTRE * from.scale };
  const c1 = { x: rest.x + 25 * rest.scale, y: rest.y - 10 * rest.scale };
  const turn = (Math.round(f.seed) % 3) - 1;
  const spin = (Math.PI / 2 + turn * Math.PI * 2) * u;
  const fall = smoothstep(0.45, 1, u);
  const scale = mix(from.scale, rest.scale, u);
  const at = anchor({ x: mix(c0.x, c1.x, u), y: mix(c0.y, c1.y, u) - 4 * f.arc * u * (1 - u) }, scale, spin, fall);
  return { ...at, scale, u, apex: 0.5 - (c1.y - c0.y) / (8 * f.arc), spin, fall };
}

/** Whether a frog is on the field side of the sandbags. A frog crossing them switches sides at the top of its arc, clear of the lip. */
function onField(f: Frog): boolean {
  if (f.mode === 'marching') return true;
  if (f.mode === 'vaulting') return f.vault >= 0.5;
  if (f.mode === 'diving') { const d = divePlace(f); return f.behind && d.u < d.apex; }
  if (f.mode === 'flung') { const k = flight(f); return f.behind && k.u < k.apex; }
  return false;
}

/** Where and how a frog waiting in the trench, vaulting or marching is drawn. The vault ends on the march's pose
 * (its mud, an unslid foot, no weight shift), and a dive or a fling sets off from exactly this pose. */
function stance(s: Squad, f: Frog, progress: number, tension: number): Place & Pose {
  const i = s.frogs.indexOf(f);
  const phone = i !== YOURS;
  if (f.mode === 'marching') {
    const at = marchPosition(f, progress, s.tension);
    // A planted foot slides back as far as the ground under it scrolls during the stance, as the pace comes in.
    const reach = 0.3 * STRIDE * mudRate(at.y) / at.scale * f.pace;
    return { ...at, stride: f.phase, squash: f.squash.x + actSquash(s), expression: tension > 0.62 ? 'shock' : tension > 0.25 ? 'grit' : 'hype', helmetLift: smoothstep(0.55, 0.75, tension) * Math.max(0, Math.sin(s.time * 12 + f.seed)) * 0.4, reach, mud: marchMud(s, tension), phone, time: s.time };
  }
  // Waiting: a weight shift over planted feet (the new squad climbs in at the muster), then the crouch and the vault.
  const u = f.vault;
  const air = Math.sin(Math.PI * clamp(u, 0, 1));
  const at = f.mode === 'vaulting' ? vaultPlace(f, progress, s.tension) : { x: f.x, y: STAND_Y + 60 * (1 - smoothstep(0, 0.4, s.muster - i * 0.07)), scale: 1 };
  return { ...at, stride: f.mode === 'vaulting' ? vaultStride(f) : 0.05, squash: f.squash.x + vaultSquash(u), expression: f.mode === 'vaulting' ? 'hype' : 'grit', lean: Math.sin(f.sway) * 1.8 * (1 - smoothstep(-0.3, 0, u)), tuck: air, flail: 0.8 * air, mud: mix(0.5, marchMud(s, tension), smoothstep(0, 1, u)) * (1 - air), phone, time: s.time };
}

/** Captures where and how a frog is drawn now, so its dive or fling leaves from exactly there. */
function launch(s: Squad, f: Frog, progress: number, mode: 'diving' | 'flung'): void {
  f.behind = f.mode === 'marching' || f.vault >= 0.5;
  f.diveFrom = stance(s, f, progress, s.tension);
  f.diveAge = 0;
  f.arc = mode === 'diving' ? 90 : 115 + 30 * noise(f.seed);
  f.mode = mode;
}

/** Your frog dives back into the trench with the bag. `quiet` puts it straight back, for a cash-out the scene did not see happen. */
export function diveBack(s: Squad, progress: number, quiet = false): void {
  const f = s.frogs[YOURS]!;
  if (f.mode !== 'marching' && f.mode !== 'trench' && f.mode !== 'vaulting') return;
  if (quiet || f.mode === 'trench') {
    // A frog that never left the trench has nowhere to dive from: it just grabs the bag, with a hop if seen.
    f.mode = 'safe';
    f.diveAge = 9;
    if (quiet) return;
    f.squash.v += 8;
  } else launch(s, f, progress, 'diving');
  s.shout = 'JEET! ...NICE EXIT THO';
  s.shoutAge = 0;
}

/** The nuke landed. `quiet` skips the effects for a crash that already happened. Frogs on the field are flung back into the trench; frogs still in it are flattened where they stand. */
export function killSquad(s: Squad, quiet: boolean, progress = 0): void {
  if (s.dead) return;
  s.dead = true;
  s.deadAge = quiet ? 10 : 0;
  s.early = s.frogs.every((f) => f.mode === 'trench' || f.mode === 'safe');
  s.bubble = 'DEV SOLD';
  s.bubbleAge = 0;
  settleSpring(s.ring, 1);
  s.flagDown = 0;
  if (quiet) { settleSpring(s.flip, 1); settleSpring(s.flag, 0); }
  for (const f of s.frogs) {
    if (f.mode === 'diving') { if (quiet) f.mode = 'safe'; continue; }
    if (f.mode === 'trench') {
      f.mode = 'flat';
      f.diveAge = quiet ? 9 : 0;
      if (quiet) settleSpring(f.squash, 1);
      continue;
    }
    if (f.mode !== 'marching' && f.mode !== 'vaulting') continue;
    if (quiet) { f.mode = 'dead'; settleSpring(f.squash, 0); } else launch(s, f, progress, 'flung');
  }
}

export interface SquadDrive { seconds?: number; running: boolean; tension: number; multiplier: number; progress: number; }

export function stepSquad(s: Squad, drive: SquadDrive, dt: number): void {
  const e = s.events;
  e.whistle = e.step = e.land = e.phone = e.clang = e.glare = e.flip = false;
  const seconds = drive.seconds ?? 0;
  s.time += dt;
  s.muster += dt;
  s.tension = drive.tension;
  s.bubbleAge += dt;
  s.shoutAge += dt;
  s.ringAge += dt;
  const wasDead = s.deadAge;
  if (s.dead) s.deadAge += dt;
  // The sign counts the days (a day a metre, near enough) and flips to zero half a second after the nuke.
  if (!s.dead) s.days = 1 + Math.floor((drive.multiplier - 1) * 8);
  if (s.dead && wasDead <= 0.5 && s.deadAge > 0.5) e.flip = true;
  stepSpring(s.flip, s.dead && s.deadAge > 0.5 ? 1 : 0, 10, 0.4, dt);
  // The sergeant topples 0.6 s after the nuke and thumps down 0.45 s later.
  if (s.dead && wasDead < 1.05 && s.deadAge >= 1.05) s.sarge.v += 9;
  stepSpring(s.sarge, 0, 16, 0.3, dt);
  s.sargeSway += dt * (1.3 + 1.8 * drive.tension);
  // The whistle blows on the first running frame and is held for a second.
  if (drive.running && !s.whistled) { s.whistled = true; e.whistle = true; }
  stepSpring(s.whistle, drive.running && seconds < 1 ? 1 : 0, 10, 0.5, dt);
  const act = endurance(seconds);
  s.act = act.act; s.effort = drive.running ? act.effort : 0;
  // The mud slows the march a little; nothing here lowers the tension.
  const cadence = marchCadence(drive.tension) * (1 - (act.act === 2 ? 0.25 : 0) * s.effort);
  stepSpring(s.over, drive.running && s.frogs.some((f) => f.mode === 'marching') ? 1 : 0, 12, 1, dt);

  // The field scrolls by the ground the squad walks less what it visibly climbs up the field, so a planted foot keeps
  // pace with the mud under it. It never runs backward.
  const climb = (mudRate(FIELD_Y) - mudRate(mix(FIELD_Y, FAR_Y, clamp(drive.progress, 0, 1)))) / 1.8;
  s.scroll += Math.max(0, dt * s.over.x * cadence * STRIDE - Math.max(0, climb - s.climb));
  s.climb = climb;
  const ease = 1 - Math.exp(-10 * dt);
  s.frogs.forEach((f, i) => {
    f.sway += dt * (1.4 + 0.5 * noise(f.seed));
    // Over the top: each frog crouches, vaults the parapet and lands on the field in turn.
    if (drive.running && (f.mode === 'trench' || f.mode === 'vaulting')) {
      const was = f.vault;
      f.vault = (seconds - vaultAt(i)) / VAULT_S;
      if (f.mode === 'trench' && f.vault >= 0) f.mode = 'vaulting';
      if (f.mode === 'vaulting' && f.vault >= 1) {
        f.mode = 'marching';
        // A landing seen happen thumps the mud; one skipped by a late join just marches.
        if (was > 0) { f.squash.v += 9; e.land = true; } else f.pace = 1;
      }
    }
    if (f.mode === 'marching') {
      f.pace += ((drive.running ? 1 : 0) - f.pace) * ease;
      const before = Math.floor(f.phase * 2);
      f.phase += dt * cadence * f.pace;
      // Each foot's plant, twice a stride, squashes the body; your frog's plants carry the sound.
      if (Math.floor(f.phase * 2) !== before) {
        f.squash.v += 3 + 5 * drive.tension;
        if (i === YOURS && s.time > s.stepNext) { s.stepNext = s.time + 0.2; e.step = true; }
      }
    }
    const flat = f.mode === 'flat';
    stepSpring(f.squash, flat ? 1 : 0, flat ? 22 : 18, flat ? 0.4 : 0.35, dt);
    stepSpring(f.clang, 0, 14, 0.25, dt);
    if (flat || f.mode === 'safe') f.diveAge += dt;
    if (f.mode === 'diving') {
      f.diveAge += dt;
      if (f.diveAge >= DIVE_S) {
        f.mode = 'safe';
        f.squash.v += 8;
        f.clang.v += 14;
        e.clang = true;
        // Mud and a little cash fly up from the landing (capped).
        if (s.flecks.length < 40) {
          for (let k = 0; k < 26; k += 1) {
            const a = -Math.PI / 2 + (noise(k * 1.7 + 0.3) - 0.5) * 1.6;
            const v = 90 + noise(k * 2.9 + 0.7) * 170;
            s.flecks.push({ x: f.x + (noise(k * 0.9) - 0.5) * 30, y: TRENCH_FLOOR + 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, cash: k % 3 === 0 });
          }
        }
      }
    }
    if (f.mode === 'flung') {
      f.diveAge += dt;
      if (f.diveAge >= FLUNG_S) { f.mode = 'dead'; f.squash.v += 7; }
    }
  });
  if (!s.dead) {
    // The field phone rings from 1.2×, more often as the tension climbs; the sergeant answers half a second later
    // with the next order of the multiplier's tier when it rang, each tier opening on its first line. Past 3× it
    // keeps ringing between calls.
    if (drive.running && drive.multiplier >= 1.2 && seconds >= s.callAt) {
      const tier = drive.multiplier < 1.6 ? 0 : drive.multiplier < 3 ? 1 : drive.multiplier < 8 ? 2 : 3;
      s.order = tier === s.tier ? s.order + 1 : 0;
      s.tier = tier;
      s.calls += 1;
      s.callAt = seconds + 3.4 - 1.5 * drive.tension + noise(s.calls * 1.3) * 1.1;
      s.ringAge = 0;
      e.phone = true;
    }
    if (drive.running && s.ringAge >= 0.55 && s.ringAge - dt < 0.55) {
      const tier = ORDERS[s.tier]!;
      s.bubble = tier[s.order % tier.length]!;
      s.bubbleAge = 0;
    }
    const ringing = drive.running && (s.ringAge < 0.55 || (drive.tension > 0.67 && Math.floor(s.time * 1.5) % 4 !== 3));
    stepSpring(s.ring, ringing ? 1 : 0, 30, 0.2, dt);
  }
  // The white flag: the paper-hands frog raises it with the tension, and every few seconds once it is readable,
  // the sergeant's glare snaps it back down, after which it creeps up again.
  const flagFrog = s.frogs[FLAG_FROG]!;
  const wanted = drive.running && !s.dead && flagFrog.mode === 'marching' ? flagFor(drive.tension) : 0;
  s.flagDown = Math.max(0, s.flagDown - dt);
  s.glareAge += dt;
  if (wanted > 0 && s.flag.x > 0.6 && s.flagDown <= 0 && seconds > s.glareNext) {
    s.flagDown = 1.4;
    s.glareAge = 0;
    s.glares += 1;
    s.glareNext = seconds + 3 + noise(s.glares * 2.1) * 2.5;
    e.glare = true;
  }
  const down = s.flagDown > 0;
  stepSpring(s.flag, down ? 0 : wanted, down ? 14 : 2.2, down ? 0.5 : 0.7, dt);
  for (const k of s.flecks) { k.age += dt; k.vy += 520 * dt; k.x += k.vx * dt; k.y += k.vy * dt; }
  s.flecks = s.flecks.filter((k) => k.age < 1.1 && k.y < TRENCH_FLOOR + 60);
}

function sandbag(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = '#a89468'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, 18, 8); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.3)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 8, y + 9); ctx.lineTo(x + w - 8, y + 9); ctx.stroke();
}

interface Pose {
  stride: number;
  squash: number;
  expression: 'grit' | 'hype' | 'shock' | 'chill' | 'dead';
  shades?: boolean;
  cigar?: boolean;
  bag?: boolean;
  helmetLift?: number;
  /** Turned about the feet, and laid on its side: spin π/2 with fall 1 is the KIA pose. */
  spin?: number;
  fall?: number;
  /** 0 to 1: hands thrown up, legs tucked for a jump, squashed flat. */
  flail?: number;
  tuck?: number;
  flat?: number;
  /** The upper body's weight shift, px, over planted feet. */
  lean?: number;
  /** How far a planted foot slides back with the scrolling ground, px either side of the hip. */
  reach?: number;
  /** 0 dry, 1 stuck: the plant shortens and the knee bends harder. */
  mud?: number;
  phone?: boolean;
  /** 0 to 1: the whistle raised to the mouth. */
  whistle?: number;
  time?: number;
}

type Point = { x: number; y: number };

/** Full stride cycles per second, with at least thirteen frames per cycle at 30 fps. */
export const marchCadence = (tension: number): number => 1.25 + .85 * clamp(tension, 0, 1);
/** Sixty percent of each step is a planted support phase. */
export function marchFoot(stride: number, side: number, mud = 0): Point {
  const u = ((stride + (side > 0 ? 0 : .5)) % 1 + 1) % 1;
  const swing = u < .6 ? 0 : Math.sin((u - .6) / .4 * Math.PI);
  return { x: side * (17 - 4 * mud) + swing * side * 7, y: -swing * (15 - 4 * mud) + mud * 3 };
}

function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + (dx / distance) * along - (dy / distance) * bend, y: root.y + (dy / distance) * along + (dx / distance) * bend };
}

function bone(ctx: CanvasRenderingContext2D, a: Point, b: Point, upper: number, lower: number, side: number, width: number, colour: string): void {
  const joint = bendJoint(a, b, upper, lower, side);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 4;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(joint.x, joint.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(joint.x, joint.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

/** Above this angle (out from the shoulder, y down) an elbow bends up and out; past it, a raised hand's elbow bends down and out. */
const FLIP = -0.35;
const armAngle = (s: Point, h: Point, side: number): number => Math.atan2(h.y - s.y, (h.x - s.x) * side);
/** Turns a hand about its shoulder from one pose toward another, straightening the arm just as it crosses the elbow's
 * flip line, so the elbow changes sides at full reach and never jumps. */
function swingArm(s0: Point, h0: Point, s1: Point, h1: Point, k: number, side: number): [Point, Point] {
  const a0 = armAngle(s0, h0, side);
  const a1 = armAngle(s1, h1, side);
  const a = mix(a0, a1, k);
  const at = (FLIP - a0) / (a1 - a0);
  const w = at > 0 && at < 1 ? Math.sin((Math.PI / 2) * (k < at ? k / at : (1 - k) / (1 - at))) ** 2 : 0;
  const r = mix(mix(Math.hypot(h0.x - s0.x, h0.y - s0.y), Math.hypot(h1.x - s1.x, h1.y - s1.y), k), 26.99, w);
  const s = { x: mix(s0.x, s1.x, k), y: mix(s0.y, s1.y, k) };
  return [s, { x: s.x + side * Math.cos(a) * r, y: s.y + Math.sin(a) * r }];
}

/** The frog rig: two-bone legs and arms, a helmet that lags the step, a body squashed on each plant. */
export function drawFrog(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, pose: Pose): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const flat = pose.flat ?? 0;
  if (flat) ctx.scale(1 + 0.4 * flat, Math.max(0.3, 1 - 0.55 * flat));
  const fall = pose.fall ?? 0;
  if (pose.spin) ctx.rotate(pose.spin);
  if (fall) ctx.translate(-10 * fall, 20 * fall);
  // Keep the planted feet in the ground frame; the torso supplies the weight shift.
  const sq = 1 + 0.18 * pose.squash;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const mud = pose.mud ?? 0;
  const t = pose.time ?? 0;
  const lean = pose.lean ?? 0;
  const tuck = pose.tuck ?? 0;
  // Knees point out. Mud pulls the foot in so the joint folds, a planted foot slides back with the ground, and a plant leaves a puddle.
  for (const side of [-1, 1]) {
    const hip = { x: side * 8 + lean, y: -18 };
    const step = marchFoot(pose.stride, side, mud);
    const u = ((pose.stride + (side > 0 ? 0 : 0.5)) % 1 + 1) % 1;
    const depth = (u < 0.6 ? u / 0.3 - 1 : 1 - (u - 0.6) / 0.2) * (pose.reach ?? 0);
    const foot = { x: mix(step.x, side * 11, tuck), y: mix(step.y + depth, -10, tuck) };
    bone(ctx, hip, foot, 16, 15, foot.y >= hip.y ? -side : side, 6.5, '#4a9440');
    ctx.fillStyle = '#3d7a34'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(foot.x, foot.y + 1, 7, 3.2, side * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!fall && !tuck && mud * 3 - step.y < 2.2 && mud > 0.25) {
      ctx.fillStyle = 'rgba(74, 58, 32, 0.5)';
      ctx.beginPath(); ctx.ellipse(foot.x, 5 + depth, 8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.save();
  ctx.translate(lean, 0);
  // Body: a squat blob in a tunic.
  ctx.save();
  ctx.scale(sq, 1 / sq);
  ctx.fillStyle = '#6f7a45'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -30, 22, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3f4a2a';
  ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(14, -20); ctx.lineTo(10, -8); ctx.lineTo(-10, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Head.
  ctx.fillStyle = SKIN;
  ctx.beginPath(); ctx.ellipse(0, -54, 20, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Eyes on top.
  for (const ex of [-9, 9]) {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex, -66, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (pose.expression === 'dead') { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex - 3, -69); ctx.lineTo(ex + 3, -63); ctx.moveTo(ex + 3, -69); ctx.lineTo(ex - 3, -63); ctx.stroke(); ctx.lineWidth = 3; }
    else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + (pose.expression === 'shock' ? 0 : 2), -65, pose.expression === 'shock' ? 4.5 : 3, 0, Math.PI * 2); ctx.fill(); }
  }
  if (pose.shades) { ctx.fillStyle = INK; ctx.fillRect(-17, -70, 14, 8); ctx.fillRect(3, -70, 14, 8); ctx.fillRect(-3, -68, 6, 2); }
  if (pose.expression === 'grit') { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16, -68); ctx.lineTo(-4, -72); ctx.moveTo(16, -68); ctx.lineTo(4, -72); ctx.stroke(); }
  // Mouth.
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (pose.expression === 'hype' || pose.expression === 'chill') ctx.arc(0, -50, 8, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (pose.expression === 'shock') { ctx.ellipse(0, -48, 4, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#2c1a1a'; ctx.fill(); }
  else if (pose.expression === 'dead') { ctx.moveTo(-8, -46); ctx.quadraticCurveTo(0, -52, 8, -46); }
  else { ctx.moveTo(-9, -46); ctx.lineTo(9, -46); }
  ctx.stroke();
  if (pose.cigar) {
    ctx.fillStyle = '#7a4a2a'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(6, -50, 22, 6, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff7a3a'; ctx.beginPath(); ctx.arc(28, -47, 3, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i += 1) {
      const u = (t * 0.45 + i * 0.33) % 1;
      ctx.globalAlpha = 0.5 * (1 - u);
      ctx.fillStyle = '#e4e4ea';
      ctx.beginPath(); ctx.arc(30 + u * 8, -50 - u * 18, 1.6 + u * 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Helmet lags the squash, so it lifts a beat after the foot lands.
  ctx.save();
  const lag = (pose.helmetLift ?? 0) + pose.squash * 0.55 + Math.sin(pose.stride * Math.PI * 2 - 0.7) * 0.16;
  ctx.translate(Math.sin(pose.stride * Math.PI * 2) * 3 * pose.squash, -lag * 14);
  ctx.fillStyle = HELMET; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -72, 26, 16, 0, Math.PI, Math.PI * 2); ctx.lineTo(30, -72); ctx.lineTo(-30, -72); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7cf67c'; ctx.font = '900 11px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('$', 0, -76);
  ctx.restore();
  ctx.restore();
  // Arms swing opposite the legs, rise for the whistle or a flail, and spread out when the frog lies down. A phone,
  // a whistle or the bag hangs off a hand.
  const flail = pose.flail ?? 0;
  const whistle = pose.whistle ?? 0;
  for (const side of [-1, 1]) {
    const phase = pose.stride * Math.PI * 2 + (side > 0 ? Math.PI : 0);
    const swing = Math.sin(phase) * (7 + 3 * mud);
    const holdBag = pose.bag && side > 0;
    let shoulder = { x: side * 16 * sq, y: -40 / sq };
    let hand = holdBag ? { x: 28, y: -34 + Math.sin(t * 3) * 3 } : { x: side * 30 + swing * 0.45, y: -28 + swing * 0.65 };
    if (side > 0 && whistle > 0) hand = swingArm(shoulder, hand, shoulder, { x: 14, y: -50 }, whistle, side)[1];
    if (flail > 0) hand = swingArm(shoulder, hand, shoulder, { x: side * 22, y: -64 }, flail, side)[1];
    if (fall) [shoulder, hand] = swingArm(shoulder, hand, { x: side * 12, y: -32 }, { x: side * 25, y: -9 }, fall, side);
    bone(ctx, shoulder, hand, 14, 13, armAngle(shoulder, hand, side) > FLIP ? -side : side, 5.5, SKIN);
    ctx.fillStyle = SKIN; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hand.x, hand.y, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (pose.phone && side < 0 && !fall && !flail) {
      ctx.save(); ctx.translate(hand.x, hand.y); ctx.rotate(-0.7);
      ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(-4, -8, 8, 13, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = pose.expression === 'shock' ? '#ff4d6d' : '#7cf67c';
      ctx.fillRect(-2.4, -5, 4.8, 7);
      ctx.restore();
    }
    if (side > 0 && whistle > 0.6) {
      ctx.fillStyle = '#d7d7de'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(hand.x + 7, hand.y, 7, 3.2, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  if (pose.bag) {
    const swing = Math.sin(pose.stride * Math.PI * 2 - 0.5) * 8 + Math.sin(t * 2) * 2;
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(24, -34);
    ctx.quadraticCurveTo(10 + swing, -14, 30 + swing, -6);
    ctx.quadraticCurveTo(50 + swing * 0.45, -6, 40 + swing * 0.2, -34);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c'; ctx.font = '900 12px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', 32 + swing * 0.35, -16);
  }
  ctx.restore();
  ctx.restore();
}

/** The phone's bubble. A long line slides left so the box ends at `right` (clear of the sergeant's face); the tail stays on the phone. */
function bubbleText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alarm: boolean, right: number): void {
  ctx.font = '900 13px Impact, "Arial Black", sans-serif';
  const w = ctx.measureText(text).width + 20;
  const bx = Math.min(x, right - w / 2);
  ctx.fillStyle = alarm ? '#ff4d6d' : '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(bx - w / 2, y - 22, w, 26, 6); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, y + 4); ctx.lineTo(x + 6, y + 4); ctx.lineTo(x + 2, y + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = alarm ? '#ffffff' : INK; ctx.textAlign = 'center';
  ctx.fillText(text, bx, y - 4);
}

/** The YOU marker over your frog, for a player with a stake only. */
function marker(ctx: CanvasRenderingContext2D, x: number, top: number, time: number): void {
  const ty = top - 6 + Math.sin(time * 4) * 3;
  ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x, ty + 10); ctx.lineTo(x - 9, ty - 4); ctx.lineTo(x + 9, ty - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
}

function kia(ctx: CanvasRenderingContext2D, x: number, y = TRENCH_FLOOR + 2): void {
  ctx.fillStyle = '#ff4d6d'; ctx.font = '900 14px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.strokeText('KIA', x, y); ctx.fillText('KIA', x, y);
}

/** Draws one frog in its mode: waiting, vaulting, marching, diving back, safe, flattened, flung or KIA. */
function drawOne(ctx: CanvasRenderingContext2D, s: Squad, f: Frog, progress: number, tension: number, enlisted: boolean): void {
  const i = s.frogs.indexOf(f);
  const yours = i === YOURS;
  const lean = Math.sin(f.sway) * 1.8;
  if (f.mode === 'trench' || f.mode === 'vaulting' || f.mode === 'marching') {
    const at = stance(s, f, progress, tension);
    drawFrog(ctx, at.x, at.y, at.scale, at);
    if (i === FLAG_FROG && f.mode === 'marching' && s.flag.x > 0.03) drawFlag(ctx, at.x - 24 * at.scale, at.y - 30 * at.scale, clamp(s.flag.x, 0, 1.2), s.time);
    if (enlisted && yours) marker(ctx, at.x, at.y - 100 * at.scale, s.time);
  } else if (f.mode === 'diving') {
    const d = divePlace(f);
    const from = f.diveFrom;
    // The launch pose (its mud, a slid foot, the helmet's jitter, a tuck or arms thrown up mid-vault) blends out over the crouch.
    const c = 1 - smoothstep(0, 0.1, f.diveAge);
    const squash = d.u > 0 ? 0.7 * (1 - smoothstep(0, 0.25, d.u)) - 0.4 * Math.sin(Math.PI * Math.min(1, d.u * 2)) : mix(from.squash, 0.7, 1 - c);
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.lean); ctx.translate(-d.x, -d.y);
    drawFrog(ctx, d.x, d.y, d.scale, { stride: mix(from.stride, Math.round(from.stride) + 0.05, smoothstep(0.3, 0.9, d.u)), squash, expression: 'shock', bag: true, helmetLift: 0.6 * Math.sin(Math.PI * d.u) + (from.helmetLift ?? 0) * c, tuck: Math.max(Math.sin(Math.PI * d.u), (from.tuck ?? 0) * c), flail: (from.flail ?? 0) * c, reach: (from.reach ?? 0) * c, mud: mix((from.mud ?? 0) * c, 0.15, smoothstep(0.5, 1, d.u)), time: s.time });
    ctx.restore();
  } else if (f.mode === 'safe') {
    // Back in the trench: the weight shift comes back in after the landing.
    drawFrog(ctx, f.x, STAND_Y, 1, { stride: 0.05, squash: f.squash.x, expression: 'chill', shades: true, cigar: true, bag: true, helmetLift: clamp(f.clang.x, 0, 1.5), lean: lean * smoothstep(DIVE_S, DIVE_S + 0.5, f.diveAge), time: s.time, mud: 0.15 });
    ctx.font = '900 12px Impact, "Arial Black", sans-serif';
    const w = ctx.measureText('SURVIVED THE TRENCHES').width + 16;
    ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(f.x - w / 2, TRENCH_FLOOR + 20, w, 24, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.fillText('SURVIVED THE TRENCHES', f.x, TRENCH_FLOOR + 37);
    if (Math.abs(f.clang.v) > 4) { ctx.fillStyle = '#ffffff'; ctx.font = '900 16px Impact, "Arial Black", sans-serif'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeText('CLANG', f.x + 40, TRENCH_FLOOR - 74); ctx.fillText('CLANG', f.x + 40, TRENCH_FLOOR - 74); }
  } else if (f.mode === 'flat') {
    // Rugged before getting out: squashed flat where it stood, the helmet popping off and back.
    drawFrog(ctx, f.x, STAND_Y, 1, { stride: 0.05, squash: 0, flat: clamp(f.squash.x, 0, 1.3), expression: f.diveAge > 0.08 ? 'dead' : 'shock', helmetLift: 4 * Math.sin(Math.PI * clamp(f.diveAge / 0.6, 0, 1)), lean: lean * clamp(1 - f.squash.x, 0, 1), mud: 0.5, phone: !yours, time: s.time });
    if (yours && enlisted && f.diveAge > 0.25) kia(ctx, f.x, STAND_Y + 20);
  } else if (f.mode === 'flung') {
    const k = flight(f);
    const from = f.diveFrom;
    // The launch pose's mud, slid foot, jitter and tuck blend out as the blast throws the arms up.
    const c = 1 - smoothstep(0, 0.15, k.u);
    drawFrog(ctx, k.x, k.y, k.scale, { stride: mix(from.stride, Math.ceil(from.stride) + 1.5, k.u), squash: mix(from.squash, 0.5 * Math.sin(Math.PI * k.u), smoothstep(0, 0.2, k.u)), expression: k.u > 0.62 ? 'dead' : 'shock', helmetLift: 1.4 * Math.sin(Math.PI * k.u) + (from.helmetLift ?? 0) * c, spin: k.spin, fall: k.fall, flail: mix(from.flail ?? 0, 1, 1 - c), tuck: (from.tuck ?? 0) * c, mud: (from.mud ?? 0) * c, reach: (from.reach ?? 0) * c, time: s.time });
  } else {
    const rest = restOf(f);
    drawFrog(ctx, rest.x, rest.y, rest.scale, { stride: 0.5, squash: f.squash.x, expression: 'dead', spin: Math.PI / 2, fall: 1 });
    if (yours && enlisted) kia(ctx, f.x - 30, TRENCH_FLOOR + 36);
  }
}

/** The squad on the field side of the sandbags, nearest last. `enlisted` (a stake in this round) marks your frog. */
export function drawSquad(ctx: CanvasRenderingContext2D, s: Squad, progress: number, tension: number, enlisted: boolean): void {
  const depth = (f: Frog): number => f.mode === 'marching' ? marchPosition(f, progress, s.tension).y : f.mode === 'vaulting' ? vaultPlace(f, progress, s.tension).y : f.mode === 'diving' ? divePlace(f).y : flight(f).y;
  for (const f of s.frogs.filter(onField).sort((a, b) => depth(a) - depth(b))) drawOne(ctx, s, f, progress, tension, enlisted);
}

/** The white flag, held up from the paper-hands frog's off hand: a pole that rises with `up` and a cloth that flaps. */
function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, up: number, time: number): void {
  const top = y - 14 - 44 * up;
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top); ctx.stroke();
  ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top); ctx.stroke();
  const flap = Math.sin(time * 9) * 3 * up;
  const w = 52 * Math.min(1, up * 1.6);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top); ctx.lineTo(x - w, top + flap); ctx.lineTo(x - w, top + 15 + flap); ctx.lineTo(x, top + 15);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (up > 0.45) {
    ctx.fillStyle = INK; ctx.font = '900 9px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PAPER HANDS', x - w / 2, top + 11 + flap * 0.5, w - 4);
  }
}

/** The DAYS SINCE LAST RUG sign on the trench wall: the count climbs with the round, and the card flips to 0 at the nuke. */
function drawSign(ctx: CanvasRenderingContext2D, s: Squad): void {
  const x = 28;
  const y = 416;
  ctx.fillStyle = '#d9c9a0'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x, y, 112, 30, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.font = '900 8px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('DAYS SINCE', x + 6, y + 13);
  ctx.fillText('LAST RUG', x + 6, y + 24);
  // The counter card turns over on its rail; the spring's overshoot makes it bounce as it lands on 0.
  const flip = clamp(s.flip.x, 0, 1.3);
  const zero = flip >= 0.5;
  ctx.save();
  ctx.translate(x + 90, y + 15);
  ctx.scale(1 + 0.2 * Math.max(0, flip - 1), Math.max(0.08, Math.abs(Math.cos(Math.PI * Math.min(flip, 1)))));
  ctx.fillStyle = zero ? '#ff4d6d' : '#1c1f26';
  ctx.beginPath(); ctx.roundRect(-16, -11, 32, 22, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = zero ? '#ffffff' : '#7cf67c'; ctx.font = '900 15px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  const days = s.days >= 1000 ? `${(s.days / 1000).toFixed(s.days < 10000 ? 1 : 0)}k` : `${s.days}`;
  ctx.fillText(zero ? '0' : days, 0, 5, 27);
  ctx.restore();
}

/** Ration crates on the trench floor, stencilled with what the squad runs on. */
function drawCrates(ctx: CanvasRenderingContext2D): void {
  for (const [cx, label] of [[34, 'HOPIUM'], [86, 'COPIUM']] as const) {
    ctx.fillStyle = '#7a7a4a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(cx, 448, 46, 30, 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(28, 31, 38, 0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx + 4, 452); ctx.lineTo(cx + 42, 474); ctx.moveTo(cx + 42, 452); ctx.lineTo(cx + 4, 474); ctx.stroke();
    ctx.fillStyle = '#e7e7d0'; ctx.font = '900 9px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, cx + 23, 462);
    ctx.font = '700 6px system-ui, sans-serif';
    ctx.fillText('RATION', cx + 23, 471);
  }
}

/** The trench in the foreground: sandbags, the wall, the sign and the crates, the duckboards, the frogs on this side of the sandbags, and the sergeant and his phone. Your frog is tagged KIA only when `enlisted`. */
export function drawTrench(ctx: CanvasRenderingContext2D, s: Squad, tension: number, enlisted: boolean, progress: number): void {
  // Wall and floor.
  ctx.fillStyle = '#4a3b28';
  ctx.fillRect(0, TRENCH_Y, W, 540 - TRENCH_Y);
  ctx.fillStyle = '#3a2d1e';
  ctx.fillRect(0, TRENCH_FLOOR, W, 540 - TRENCH_FLOOR);
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.45)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 34) { ctx.beginPath(); ctx.moveTo(x, TRENCH_FLOOR + 6); ctx.lineTo(x + 20, 540); ctx.stroke(); }
  for (let i = 0; i < 6; i += 1) { ctx.beginPath(); ctx.moveTo(0, TRENCH_Y + 14 + i * 11); ctx.lineTo(W, TRENCH_Y + 12 + i * 11 + Math.sin(i) * 3); ctx.stroke(); }
  // Sandbag lip.
  for (let i = 0; i < 20; i += 1) sandbag(ctx, -10 + i * 50 + (i % 2) * 6, TRENCH_Y - 14 - (i % 2) * 5, 52);
  for (let i = 0; i < 19; i += 1) sandbag(ctx, 15 + i * 50, TRENCH_Y - 4, 52);
  drawSign(ctx, s);
  drawCrates(ctx);
  // Frogs on this side of the sandbags: waiting, safe with the cigar, flattened or KIA, then any in the air.
  const near = s.frogs.filter((f) => !onField(f));
  const airborne = (f: Frog): boolean => f.mode === 'vaulting' || f.mode === 'diving' || f.mode === 'flung';
  for (const f of near) if (!airborne(f)) drawOne(ctx, s, f, progress, tension, enlisted);
  for (const f of near) if (airborne(f)) drawOne(ctx, s, f, progress, tension, enlisted);
  // The sergeant and the field phone on the right. He shifts his weight (faster as it gets hairy), raises the whistle
  // at the start, and after the nuke stands in shock, then topples onto his side.
  const sx = 880;
  const topple = s.dead ? clamp((s.deadAge - 0.6) / 0.45, 0, 1) : 0;
  const tip = topple * topple;
  const at = anchor({ x: mix(sx, sx + 25 * 1.05, tip), y: mix(STAND_Y - CENTRE * 1.05, TRENCH_FLOOR - 14 - 10 * 1.05, tip) }, 1.05, (Math.PI / 2) * tip, tip);
  const calm = s.dead ? 1 - smoothstep(0, 0.3, s.deadAge) : 1;
  drawFrog(ctx, at.x, at.y, 1.05, { stride: 0.05, squash: s.sarge.x, expression: s.dead ? (topple > 0.5 ? 'dead' : 'shock') : tension > 0.55 ? 'shock' : 'grit', cigar: !s.dead, lean: Math.sin(s.sargeSway) * (1.5 + 2 * tension) * calm, spin: (Math.PI / 2) * tip, fall: tip, whistle: clamp(s.whistle.x, 0, 1), time: s.time });
  ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx - 34, TRENCH_FLOOR - 40); ctx.lineTo(sx - 20, TRENCH_FLOOR - 44); ctx.lineTo(sx - 20, TRENCH_FLOOR - 34); ctx.lineTo(sx - 34, TRENCH_FLOOR - 32); ctx.closePath(); ctx.fill(); ctx.stroke();
  const px = 800;
  const shake = clamp(s.ring.x, 0, 1) * Math.sin(s.time * 60) * 3;
  ctx.save(); ctx.translate(px, TRENCH_FLOOR - 12);
  ctx.fillStyle = '#3d4a2a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-28, -22, 56, 34, 4); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(shake, 0); ctx.rotate(shake * 0.05);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-22, -32, 44, 10, 5); ctx.fill();
  ctx.beginPath(); ctx.arc(-18, -28, 7, 0, Math.PI * 2); ctx.arc(18, -28, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(22, -6); ctx.quadraticCurveTo(50, 10, 70, -20); ctx.stroke();
  ctx.fillStyle = '#c9c9d4'; ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('FIELD PHONE', 0, 4);
  ctx.restore();
  if (s.bubbleAge < 2.4 && s.bubble) bubbleText(ctx, s.bubble, px, TRENCH_FLOOR - 58 - (s.bubbleAge < 0.2 ? (0.2 - s.bubbleAge) * 40 : 0), s.dead, sx - 42);
  // What the sergeant shouts after your frog's dive, or his glare at the white flag: a line of sight and the order.
  if (s.shoutAge < 1.8 && !s.dead) {
    bubbleText(ctx, s.shout, sx - 40, TRENCH_FLOOR - 104 - (s.shoutAge < 0.15 ? (0.15 - s.shoutAge) * 40 : 0), false, W - 20);
  } else if (s.glareAge < 0.9 && !s.dead) {
    const target = marchPosition(s.frogs[FLAG_FROG]!, progress, s.tension);
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - s.glareAge / 0.9);
    ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(sx - 12, TRENCH_FLOOR - 62); ctx.lineTo(target.x, target.y - 50 * target.scale); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    bubbleText(ctx, GLARES[(s.glares - 1 + GLARES.length) % GLARES.length]!, sx - 40, TRENCH_FLOOR - 104 - (s.glareAge < 0.15 ? (0.15 - s.glareAge) * 40 : 0), false, W - 20);
  }
  // The mud and cash of your landing.
  for (const k of s.flecks) {
    ctx.fillStyle = k.cash ? '#7cf67c' : '#5a4630';
    ctx.globalAlpha = clamp(1.2 - k.age, 0, 1);
    ctx.beginPath(); ctx.ellipse(k.x, k.y, k.cash ? 3 : 4, k.cash ? 2 : 3, k.age * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The whistle at the start (the cash-out shout takes its place).
  if (s.whistle.x > 0.05 && s.shoutAge >= 1.8 && !s.dead) {
    ctx.save(); ctx.globalAlpha = clamp(s.whistle.x, 0, 1);
    ctx.fillStyle = '#ffffff'; ctx.font = '900 22px Impact, "Arial Black", sans-serif'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.textAlign = 'center';
    const wy = TRENCH_FLOOR - 112 - s.whistle.x * 10;
    ctx.strokeText('PHWEEEET', sx - 50, wy); ctx.fillText('PHWEEEET', sx - 50, wy);
    ctx.restore();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, TRENCH_FLOOR); ctx.lineTo(W, TRENCH_FLOOR); ctx.stroke();
}
