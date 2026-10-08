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
  reduced: boolean;
}

/** Each encounter has a readable approach, contact and recovery; none predicts a round ending. */
export function routineAt(seconds: number, reduced: boolean): Routine {
  const index = Math.floor(Math.max(0, seconds) / BEAT_SECONDS);
  const age = Math.max(0, seconds) % BEAT_SECONDS;
  const kind = index % 6;
  const windup = pulse(age, 1.48, CONTACT + 0.15);
  const impact = age < CONTACT ? 0 : Math.exp(-(age - CONTACT) * 8);
  const recovery = ease((age - CONTACT) / 1.25);
  const propX = reduced ? 744 : age < CONTACT ? mix(1180, 532, ease(age / CONTACT)) : 532 - (age - CONTACT) * 245;
  const hop = kind === 5 ? pulse(age, 1.94, 3.68) : kind === 1 ? pulse(age, 2.33, 3.18) * 0.4 : 0;
  const duck = kind === 2 ? pulse(age, 1.75, 3.62) : 0;
  return { index, kind, lap: Math.floor(index / 6), age, windup, impact, recovery, propX, hop, duck };
}

export function runningPose(seconds: number, reduced: boolean, routine = routineAt(seconds, reduced)): BullPose {
  const cycle = seconds * 2.1 + 0.1 * Math.sin(seconds * 0.7);
  const gallop = Math.cos(cycle * TAU);
  const baseX = 324 + (reduced ? 0 : Math.sin(seconds * 0.77) * 14 + routine.windup * 21);
  const b: BullPose = {
    x: baseX, y: floorAt(baseX), scale: 1.24,
    body: reduced ? routine.duck * 12 : -6 - 11 * Math.max(0, Math.sin(cycle * TAU)) + routine.windup * 9 + routine.duck * 13,
    pitch: reduced ? -0.025 : -0.05 + gallop * 0.06 + routine.duck * 0.11 - routine.hop * 0.15,
    head: reduced ? (routine.age < CONTACT ? 0.14 : -0.14) : -0.07 + Math.sin(cycle * TAU - 0.85) * 0.16 + routine.windup * 0.35 - routine.impact * 0.5,
    stride: reduced ? 0.19 : cycle, time: reduced ? 0 : seconds,
    effort: 0.55 + routine.windup * 0.45, gait: routine.hop > 0.16 ? 'air' : 'run',
    face: routine.windup > 0.3 || routine.duck > 0.2 ? 'charge' : 'smug',
    snort: reduced ? 0 : pulse(routine.age, 1.43, 2.26), rear: 0, tuck: routine.hop, reduced,
  };
  if (!reduced) b.y -= routine.hop * 70;
  return b;
}

export function idlePose(seconds: number, reduced: boolean): BullPose {
  const age = seconds % 7.2;
  const rear = pulse(age, 1.3, 3.55);
  const stomp = age >= 3.55 ? Math.exp(-(age - 3.55) * 8) : 0;
  return {
    x: 331 + (reduced ? 0 : Math.sin(seconds * 1.6) * 17), y: floorAt(331), scale: 1.24,
    body: reduced ? 0 : -5 + Math.sin(seconds * 4.8) * 5 - rear * 13 + stomp * 12,
    pitch: reduced ? 0 : -rear * 0.21 + Math.sin(seconds * 2.4) * 0.045,
    head: reduced ? (age < 3.55 ? -0.13 : 0.14) : -0.12 - rear * 0.34 + Math.sin(seconds * 3.8) * 0.24,
    stride: reduced ? 0 : seconds * 0.92, time: reduced ? 0 : seconds,
    effort: 0.5, gait: 'idle', face: rear > 0.5 ? 'charge' : 'smug',
    snort: reduced ? 0 : pulse(age, 0.55, 1.25) + pulse(age, 4.1, 4.8), rear: reduced ? 0 : rear, tuck: 0, reduced,
  };
}

/** A planted foot travels back through stance, then returns through a raised arc. */
export function hoofAt(pose: BullPose, hipX: number, offset: number): { x: number; y: number } {
  const p = frac(pose.stride + offset);
  if (pose.gait === 'air') return { x: hipX + (hipX > 0 ? -17 : -31), y: -43 - pose.tuck * 15 };
  if (pose.gait === 'sit') return { x: hipX + (hipX > 0 ? 25 : -17), y: -18 };
  if (pose.gait === 'idle') {
    const fore = hipX > 0;
    const scuff = fore ? Math.sin(pose.time * 5) * 15 * (1 - pose.rear) : 0;
    return { x: hipX + scuff + pose.rear * (fore ? -32 : -5), y: -pose.rear * (fore ? 63 : 0) - (fore ? Math.max(0, Math.sin(pose.time * 5)) * 9 : 0) };
  }
  const stance = 0.57;
  const x = p < stance ? 37 - p / stance * 74 : -37 + ease((p - stance) / (1 - stance)) * 74;
  const lift = p < stance ? 0 : Math.sin((p - stance) / (1 - stance) * Math.PI) * 45;
  return { x: hipX + x, y: -lift - (hipX + x) * 0.047 };
}

export function impactAge(r: Routine): number { return clamp(r.age - CONTACT, 0, 10); }
