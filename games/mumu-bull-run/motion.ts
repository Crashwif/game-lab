import { clamp, ease, frac, mix, pulse, TAU } from './art';

export const BEAT_SECONDS = 6.8;
export const CONTACT = 2.55;
export const GROUND = 454;
export const floorAt = (x: number): number => GROUND - (x - 330) * 0.047;
export interface Routine {
  index: number;
  kind: number;
  lap: number;
  age: number;
  windup: number;
  impact: number;
  recovery: number;
  propX: number;
  hop: number;
  duck: number;
}
export interface BullPose {
  x: number;
  y: number;
  scale: number;
  body: number;
  pitch: number;
  head: number;
  stride: number;
  time: number;
  effort: number;
  gait: 'run' | 'idle' | 'air' | 'sit';
  face: 'smug' | 'charge' | 'panic' | 'victory' | 'support';
  snort: number;
  rear: number;
  tuck: number;
}

/** Each encounter has a readable approach, contact and recovery; none predicts a round ending. */
export function routineAt(seconds: number): Routine {
  const index = Math.floor(Math.max(0, seconds) / BEAT_SECONDS);
  const age = Math.max(0, seconds) % BEAT_SECONDS;
  const kind = index % 6;
  const windup = pulse(age, 1.48, CONTACT + 0.15);
  const impact = age < CONTACT ? 0 : Math.exp(-(age - CONTACT) * 8);
  const recovery = ease((age - CONTACT) / 1.25);
  const propX = age < CONTACT ? mix(1180, 532, ease(age / CONTACT)) : 532 - (age - CONTACT) * 245;
  const hop = kind === 5 ? pulse(age, 1.94, 3.68) : kind === 1 ? pulse(age, 2.33, 3.18) * 0.4 : 0;
  const duck = kind === 2 ? pulse(age, 1.75, 3.62) : 0;
  return { index, kind, lap: Math.floor(index / 6), age, windup, impact, recovery, propX, hop, duck };
}

/** A transverse gallop: the hind pair drives, the fore pair catches, and one short suspension lifts the body each cycle. */
export const STANCE = 0.42;
export const SUSPEND = 0.88;
const SPAN = 21;
export function runningPose(seconds: number, routine = routineAt(seconds)): BullPose {
  const cycle = seconds * 2.1 + 0.1 * Math.sin(seconds * 0.7);
  const u = frac(cycle);
  // The body is highest in suspension and lowest as the fore hooves take the weight.
  const bound = 0.5 + 0.5 * Math.cos((u - SUSPEND) * TAU);
  const rock = Math.sin(u * TAU);
  const baseX = 324 + (Math.sin(seconds * 0.77) * 14 + routine.windup * 21);
  const b: BullPose = {
    x: baseX, y: floorAt(baseX), scale: 1.24,
    body: -3 - 12 * bound + routine.windup * 9 + routine.duck * 13,
    pitch: -0.03 - rock * 0.075 + routine.duck * 0.11 - routine.hop * 0.15,
    head: -0.07 + rock * 0.05 + Math.sin(cycle * TAU - 1.5) * 0.13 + routine.windup * 0.35 - routine.impact * 0.5,
    stride: cycle, time: seconds,
    effort: 0.55 + routine.windup * 0.45, gait: routine.hop > 0.16 ? 'air' : 'run',
    face: routine.windup > 0.3 || routine.duck > 0.2 ? 'charge' : 'smug',
    snort: pulse(routine.age, 1.43, 2.26), rear: 0, tuck: routine.hop,
  };
  b.y -= routine.hop * 70;
  return b;
}

export function idlePose(seconds: number): BullPose {
  const age = seconds % 7.2;
  const rear = pulse(age, 1.3, 3.55);
  const stomp = age >= 3.55 ? Math.exp(-(age - 3.55) * 8) : 0;
  return {
    x: 331 + (Math.sin(seconds * 1.6) * 17), y: floorAt(331), scale: 1.24,
    body: -5 + Math.sin(seconds * 4.8) * 5 - rear * 13 + stomp * 12,
    pitch: -rear * 0.21 + Math.sin(seconds * 2.4) * 0.045,
    head: -0.12 - rear * 0.34 + Math.sin(seconds * 3.8) * 0.24,
    stride: seconds * 0.92, time: seconds,
    effort: 0.5, gait: 'idle', face: rear > 0.5 ? 'charge' : 'smug',
    snort: pulse(age, 0.55, 1.25) + pulse(age, 4.1, 4.8), rear: rear, tuck: 0,
  };
}

/**
 * Hoof targets in the bull's ground frame, so the solved legs stay planted while the body bounces and pitches.
 * A planted hoof travels back at the track's speed; the returning hoof clears the ground on a cosine arc.
 */
export function hoofAt(pose: BullPose, hipX: number, offset: number): { x: number; y: number } {
  const p = frac(pose.stride + offset);
  const fore = hipX > 0;
  const slope = (x: number): number => -(hipX + x) * 0.047;
  if (pose.gait === 'air') return { x: hipX + (fore ? -14 : -30), y: -42 - pose.tuck * 15 };
  if (pose.gait === 'sit') return { x: hipX + (fore ? 25 : -17), y: -18 };
  if (pose.gait === 'idle') {
    const scuff = fore ? Math.sin(pose.time * 5) * 15 * (1 - pose.rear) : 0;
    const x = scuff + pose.rear * (fore ? -32 : -5);
    return { x: hipX + x, y: slope(x) - pose.rear * (fore ? 63 : 0) - (fore ? Math.max(0, Math.sin(pose.time * 5)) * 9 : 0) };
  }
  if (p < STANCE) {
    const x = SPAN - p / STANCE * 2 * SPAN;
    return { x: hipX + x, y: slope(x) };
  }
  const u = (p - STANCE) / (1 - STANCE);
  const x = -SPAN + (1 - Math.cos(u * Math.PI)) * SPAN;
  const lift = Math.sin(u * Math.PI) * (fore ? 44 : 38) * (0.7 + 0.3 * pose.effort);
  return { x: hipX + x, y: slope(x) - lift };
}

export function impactAge(r: Routine): number { return clamp(r.age - CONTACT, 0, 10); }
