/**
 * The race. Three hundred million swimmers on the headline counter, about two
 * hundred and forty drawn: a crowd that thins in jeet waves as the multiplier
 * passes each milestone, four snipers who sprint off at the launch and dump by
 * 1.4×, a few chads who keep pace until you pass them, a sperm whale that
 * crosses in front of the egg at 3.3× and every doubling after, a side-on
 * silhouette against the moon, and the SEC, white blood
 * cells that drift off the walls and swallow stragglers. Positions are along
 * the path relative to the pack's anchor (your place in the race) and across
 * the bore as a fraction of its radius, so a swell in the tunnel carries them.
 */
import { CROWD_FACES, FACE } from './atlas';
import { putInstance } from './gl';
import { type Vec3, basisFrom, cross, length, lerp3, madd, normalize, rotateAbout, sub } from './math3d';
import { gust, mix, mulberry32, smoothstep } from './motion';
import { frameAt, tunnelRadius } from './path';
import type { Renderer } from './render';

const CROWD = 224;
const SNIPERS = 4;
const CHADS = 7;
/** The multipliers at which a wave of jeets turns back. */
export const WAVES = [1.2, 1.5, 2, 2.6, 3.4, 4.6, 6.9, 10, 15, 25, 50];
export const HEADLINE = 300_000_000;

type State = 'swim' | 'turn' | 'back' | 'eaten' | 'gone';
type Kind = 'crowd' | 'sniper' | 'chad';

interface Swimmer {
  kind: Kind;
  rel: number;
  rel0: number;
  drift: number;
  rho: number;
  theta: number;
  pushX: number;
  pushY: number;
  phase: number;
  freq: number;
  size: number;
  face: number;
  quit: number;
  state: State;
  turn: number;
  eaten: number;
  /** Where an eaten swimmer is pulled: along the path and across the bore, in units. */
  grab: [number, number, number];
  label: number;
  seed: number;
}

interface Mote {
  s: number;
  rho: number;
  theta: number;
  size: number;
  hue: number;
  /** Where it floats and which way the path runs there: cached, since they change only when it wraps round. */
  p: Vec3;
  tangent: Vec3;
  colour: [number, number, number, number];
}

/** A caption pinned to a point in the world; `far` ones stay readable at any distance. */
export interface Label { text: string; at: Vec3; colour: string; size: number; far?: boolean }

export interface Pack {
  anchor: number;
  speed: number;
  time: number;
  raceTime: number;
  swimmers: Swimmer[];
  whale: { active: boolean; age: number; rel: number; x: number; y: number; phase: number; jaw: number; next: number };
  blobs: { s: number; theta: number; rho: number; size: number; victim: boolean; spawn: number }[];
  nextBlob: number;
  motes: Mote[];
  you: { mode: 'race' | 'bank' | 'banked'; rel: number; x: number; y: number; phase: number; bank: number; from: [number, number, number]; forward: Vec3 | null };
  /** The sperm bank's mouth on the wall, `rel` ahead of the anchor so it stays in frame while it takes you. */
  portal: { active: boolean; rel: number; theta: number; age: number };
  events: string[];
  snipersDumped: boolean;
  wave: number;
  pileRel: number | null;
  labels: Label[];
}

export function createPack(): Pack {
  const pack: Pack = {
    anchor: 0, speed: 0, time: 0, raceTime: 0, swimmers: [],
    whale: { active: false, age: 0, rel: 0, x: 0, y: 0, phase: 0, jaw: 0, next: 3.3 },
    blobs: [], nextBlob: 0, motes: [],
    you: { mode: 'race', rel: 0, x: 0, y: -0.7, phase: 0, bank: 0, from: [0, 0, 0], forward: null },
    portal: { active: false, rel: 9, theta: 0.7, age: 0 },
    events: [], snipersDumped: false, wave: 0, pileRel: null, labels: [],
  };
  resetPack(pack);
  return pack;
}

export function resetPack(pack: Pack): void {
  const random = mulberry32(0x5eed);
  pack.anchor = 0;
  pack.speed = 0;
  pack.raceTime = 0;
  pack.swimmers = [];
  const add = (kind: Kind, rel: number, rho: number, theta: number, quit: number, face: number, drift: number): void => {
    pack.swimmers.push({ kind, rel, rel0: rel, drift, rho, theta, pushX: 0, pushY: 0, phase: random() * 6.28, freq: 0.8 + random() * 0.45, size: 0.9 + random() * 0.25, face, quit, state: 'swim', turn: 0, eaten: 0, grab: [0, 0, 0], label: 0, seed: random() });
  };
  for (let i = 0; i < CROWD; i += 1) {
    const rel = -26 + Math.pow(random(), 0.85) * 72;
    // Heavy-tailed patience, rounded up to the next jeet wave; those ahead of you all quit by 4.6×.
    let quit = Math.max(1.12, Math.pow(1 - random(), -0.95));
    if (rel > 0) quit = Math.min(quit, 4.6);
    quit = WAVES.find((w) => w >= quit) ?? Infinity;
    add('crowd', rel, 0.12 + Math.sqrt(random()) * 0.62, random() * Math.PI * 2, quit, CROWD_FACES[i % CROWD_FACES.length]!, 0.55 + random() * 0.9);
  }
  for (let i = 0; i < SNIPERS; i += 1) add('sniper', 2.5 + i * 1.2, 0.35 + random() * 0.2, i * 1.7 + 0.4, 1.25 + i * 0.05, FACE.smug, 0);
  for (let i = 0; i < CHADS; i += 1) add('chad', -5 + i * 2.6, 0.3 + random() * 0.35, i * 0.9 + 2, Infinity, FACE.chad, 0);
  pack.whale.active = false;
  pack.whale.next = 3.3;
  pack.blobs = [];
  pack.nextBlob = 0;
  pack.motes = [];
  for (let i = 0; i < 240; i += 1) pack.motes.push(createMote(-10 + random() * 200, Math.sqrt(random()) * 0.92, random() * Math.PI * 2, 0.03 + random() * 0.08, random()));
  pack.you = { mode: 'race', rel: 0, x: 0, y: -0.7, phase: 0, bank: 0, from: [0, 0, 0], forward: null };
  pack.portal.active = false;
  pack.events = [];
  pack.snipersDumped = false;
  pack.wave = 0;
  pack.pileRel = null;
}

function createMote(s: number, rho: number, theta: number, size: number, hue: number): Mote {
  const mote: Mote = { s, rho, theta, size, hue, p: [0, 0, 0], tangent: [0, 0, 0], colour: [1, 0.78 + hue * 0.2, 0.84, 0.55] };
  placeMote(mote);
  return mote;
}

/** Works out where a mote floats from its place along the path, once per wrap rather than every frame. */
function placeMote(mote: Mote): void {
  const f = frameAt(mote.s);
  const r = tunnelRadius(mote.s) * mote.rho;
  mote.p = madd(madd(f.point, f.side, r * Math.cos(mote.theta)), f.up, r * Math.sin(mote.theta));
  mote.tangent = f.tangent;
}

const overtake = (m: number): number => 15 * Math.log2(Math.max(1, m));

function crowdTarget(sw: Swimmer, m: number, raceTime: number): number {
  if (sw.kind === 'sniper') return sw.rel0 + 46 * smoothstep(0, 2.6, raceTime);
  if (sw.kind === 'chad') {
    // The endurance swimmers regroup alongside you after the opening race. Keep the chase populated
    // without adding swimmers or making the late-round crowd depend on an ever-growing multiplier.
    const opening = sw.rel0 + 4 * smoothstep(1.5, 3, m) - 18 * smoothstep(3.6, 5.2, m) - overtake(m) * smoothstep(6, 9, m);
    const escort = 4 + sw.rel0 * 0.8 + Math.sin(raceTime * 0.35 + sw.seed * 6.28) * 6;
    return mix(opening, escort, smoothstep(18, 35, raceTime));
  }
  return sw.rel0 - overtake(m) * sw.drift;
}

/**
 * Puts the race where it would be at `m` for a viewer who arrives mid-round, `raceTime` seconds after the
 * launch when that is known. What already happened (the jeet waves, the whale, the SEC's arrival) is not
 * announced again.
 */
export function settlePack(pack: Pack, m: number, raceTime = 10): void {
  pack.raceTime = raceTime;
  pack.speed = 12;
  for (const sw of pack.swimmers) {
    if (m >= sw.quit) { sw.state = 'gone'; continue; }
    sw.rel = crowdTarget(sw, m, pack.raceTime);
  }
  pack.wave = WAVES.filter((w) => w <= m).length;
  // The snipers' dump already happened if any of them is gone: the rest turn back unannounced.
  pack.snipersDumped = pack.swimmers.some((sw) => sw.kind === 'sniper' && sw.state === 'gone');
  while (pack.whale.next <= m) pack.whale.next *= 2;
  // The SEC is already in the tunnel: its cells keep coming, without SEC IS HERE.
  if (m >= 2.4) pack.nextBlob = pack.raceTime;
}

/** On the right-hand wall, a little above your line: clear of the coin card, the badge and the feed. */
const PORTAL_THETA = Math.PI - 0.25;

/** Starts your swimmer's exit to the sperm bank. */
export function bankYou(pack: Pack): void {
  if (pack.you.mode !== 'race') return;
  pack.you.forward = playerPose(pack).forward;
  pack.you.mode = 'bank';
  pack.you.bank = 0;
  pack.you.from = [pack.you.rel, pack.you.x, pack.you.y];
  pack.portal = { active: true, rel: 9, theta: PORTAL_THETA, age: 0 };
}

/** Where the sperm bank's mouth opens on the wall. */
export function portalPoint(pack: Pack): Vec3 {
  const s = pack.anchor + pack.portal.rel;
  const f = frameAt(s);
  const r = tunnelRadius(s) * 0.93;
  return madd(madd(f.point, f.side, r * Math.cos(pack.portal.theta)), f.up, r * Math.sin(pack.portal.theta));
}

/** How far ahead of your place the crash looks for the leaders it puts the wall in front of. */
const WALL_REACH = 16;

/**
 * Freezes the race at the crash: everyone still swimming piles into what is ahead. The wall goes up just past
 * the leaders within WALL_REACH, close enough to read at any multiplier (the crowd is spread far ahead below 4×);
 * a leader already past it stays where it is, stuck in the tip.
 */
export function pilePack(pack: Pack): number {
  let front = pack.you.mode === 'race' ? pack.you.rel : -Infinity;
  for (const sw of pack.swimmers) if (sw.state === 'swim' && sw.rel < WALL_REACH) front = Math.max(front, sw.rel);
  pack.pileRel = (Number.isFinite(front) ? front : 6) + 4.5;
  pack.whale.active = false;
  return pack.pileRel;
}

/** `stall` (0 to 1) holds the flow back for a moment: the dev flinching, a fake-out. */
export interface StepInput { racing: boolean; multiplier: number; tension: number; crashed: boolean; stall?: number }

/** World pose shared by the rendered swimmer and the bank-path steering. */
export function playerPose(pack: Pack): { position: Vec3; forward: Vec3 } {
  const f = frameAt(pack.anchor + pack.you.rel);
  return {
    position: madd(madd(f.point, f.side, pack.you.x), f.up, pack.you.y),
    forward: pack.you.forward ?? rotateAbout(f.tangent, f.up, Math.sin(pack.time * 1.3) * 0.1),
  };
}

/** A jeet's heading through its U-turn, eased so it leaves and enters the turn without a snap. */
const uTurn = (turn: number): number => smoothstep(0, 1, turn) * Math.PI;

/** Where a swimmer comes to rest at the crash: just short of the wall, or where it is if it is already past it. */
const pileStop = (pack: Pack, sw: Swimmer): number => pack.pileRel !== null && sw.rel > pack.pileRel ? sw.rel : (pack.pileRel ?? 0) - 0.4 - sw.seed * 1.6;

/**
 * Effort fades separately as each swimmer reaches the pile, rather than speeding up at rest. One stuck in the tip
 * past the wall slows with the pack, still wriggling, instead of going limp on the impact frame.
 */
function swimEffort(pack: Pack, rel: number, stop: number): number {
  return pack.pileRel === null || rel > pack.pileRel ? Math.min(1, 0.25 + pack.speed / 25) : smoothstep(0.08, 4, Math.abs(stop - rel));
}

export function stepPack(pack: Pack, input: StepInput, dt: number): void {
  const m = input.multiplier;
  const previousYou = pack.you.mode === 'bank' ? playerPose(pack).position : null;
  pack.time += dt;
  pack.events = [];
  const cruise = input.crashed ? 0 : input.racing ? 10 + 9 * input.tension : 0;
  pack.speed = mix(pack.speed, cruise, 1 - Math.exp(-dt * (input.crashed ? 9 : 2.2)));
  const advance = pack.speed * (1 - (input.stall ?? 0)) * dt;
  pack.anchor += advance;
  if (input.racing) pack.raceTime += dt;

  if (input.racing && pack.wave < WAVES.length && m >= WAVES[pack.wave]!) {
    pack.wave += 1;
    pack.events.push('jeets');
  }

  let labelled = 0;
  for (const sw of pack.swimmers) {
    if (sw.state === 'gone') continue;
    const stop = pileStop(pack, sw);
    sw.phase += dt * (3 + 16 * swimEffort(pack, sw.rel, stop)) * sw.freq;
    sw.label = Math.max(0, sw.label - dt);
    sw.pushX *= Math.exp(-dt * 1.4);
    sw.pushY *= Math.exp(-dt * 1.4);
    if (sw.state === 'eaten') {
      sw.eaten += dt / 0.7;
      sw.rel = mix(sw.rel, sw.grab[0] - pack.anchor, 1 - Math.exp(-dt * 6));
      if (sw.eaten >= 1) sw.state = 'gone';
      continue;
    }
    if (pack.pileRel !== null && (sw.state === 'swim' || sw.state === 'turn')) {
      sw.rel = mix(sw.rel, stop, 1 - Math.exp(-dt * 5));
      sw.rho *= Math.exp(-dt * 0.4);
      continue;
    }
    if (sw.state === 'swim' || sw.state === 'turn') {
      if (sw.state === 'swim' && input.racing && m >= sw.quit) {
        sw.state = 'turn';
        sw.face = FACE.crying;
        if (sw.kind === 'sniper' && !pack.snipersDumped) { pack.snipersDumped = true; pack.events.push('snipers'); }
        if (sw.rel > -4 && sw.rel < 34 && (sw.kind === 'sniper' || labelled < 2)) { sw.label = 1.8; labelled += 1; }
      }
      // A jeet lets go of the crowd's pace through its U-turn while it swims where it faces, so its speed carries
      // from the race into the swim back with no jolt at either end.
      const turning = sw.state === 'turn' ? (sw.turn = Math.min(1, sw.turn + dt / 0.6)) : 0;
      const target = input.racing ? crowdTarget(sw, m, pack.raceTime) : sw.rel0 * 0.55;
      const wobble = Math.sin(pack.time * 0.6 + sw.seed * 20) * 0.8;
      sw.rel = mix(sw.rel, target + wobble, (1 - Math.exp(-dt * (sw.kind === 'sniper' ? 2.4 : 1.1))) * (1 - smoothstep(0, 1, turning)));
      sw.rel -= (pack.speed + 9) * 0.5 * (1 - Math.cos(uTurn(turning))) * dt;
      if (sw.kind === 'sniper' && pack.raceTime < 3 && turning === 0) sw.label = Math.max(sw.label, 0.2);
      if (turning >= 1) sw.state = 'back';
    } else if (sw.state === 'back') {
      sw.rel -= (pack.speed + 9) * dt;
      if (sw.rel < -24) sw.state = 'gone';
    }
  }

  // The sperm whale: a side-on silhouette crossing in front of the egg, chomping.
  const whale = pack.whale;
  if (input.racing && !whale.active && pack.pileRel === null && m >= whale.next) {
    whale.active = true;
    whale.age = 0;
    whale.next *= 2;
    pack.events.push('whale');
  }
  if (whale.active) {
    whale.age += dt;
    whale.phase += dt * 3.4;
    whale.rel = Math.min(eggDistance(m), EGG_FAR) - 15;
    whale.x = -13 + 26 * (whale.age / WHALE_CROSSING);
    whale.y = 0.1 + 0.6 * Math.sin(whale.age * 1.3);
    whale.jaw = 0.18 + 0.2 * Math.max(0, Math.sin(whale.age * 4.2));
    if (whale.age > WHALE_CROSSING) whale.active = false;
  }

  // The SEC: white blood cells come off the walls ahead and swallow the nearest straggler.
  if (input.racing && pack.pileRel === null && m >= 2.4 && pack.raceTime >= pack.nextBlob) {
    if (pack.blobs.length === 0 && pack.nextBlob === 0) pack.events.push('sec');
    const k = pack.blobs.length + Math.floor(pack.raceTime);
    pack.blobs.push({ s: pack.anchor + 72, theta: (k * 2.39996) % (Math.PI * 2), rho: 0.86, size: 1.5, victim: false, spawn: pack.time });
    pack.nextBlob = pack.raceTime + 2.3;
  }
  for (const blob of pack.blobs) {
    const rel = blob.s - pack.anchor;
    blob.rho = mix(blob.rho, 0.5, 1 - Math.exp(-dt * 0.35));
    if (!blob.victim && rel < 32 && rel > 2) {
      const r = tunnelRadius(blob.s);
      const bx = blob.rho * r * Math.cos(blob.theta);
      const by = blob.rho * r * Math.sin(blob.theta);
      let best: Swimmer | null = null;
      let bestD = 5;
      for (const sw of pack.swimmers) {
        if (sw.state !== 'swim' || sw.kind !== 'crowd') continue;
        const d = Math.hypot(sw.rel - rel, sw.rho * r * Math.cos(sw.theta) - bx, sw.rho * r * Math.sin(sw.theta) - by);
        if (d < bestD) { bestD = d; best = sw; }
      }
      if (best) {
        best.state = 'eaten';
        best.eaten = 0;
        best.grab = [blob.s, bx, by];
        blob.victim = true;
        blob.size = 1.75;
      }
    }
  }
  pack.blobs = pack.blobs.filter((b) => b.s - pack.anchor > -16);

  for (const mote of pack.motes) if (mote.s < pack.anchor - 12) { mote.s += 200; placeMote(mote); }

  // The bank's mouth rides along ahead of you, closing in from 9 to 7 while it takes you (in frame, not behind
  // the lens), then lets go and drifts back as it shuts. Once the pack piles up it stays where it is.
  const portal = pack.portal;
  if (portal.active) {
    portal.age += dt;
    if (pack.pileRel !== null) portal.rel -= advance;
    else portal.rel = portal.age < 1.6 ? 9 - 2 * smoothstep(0, 1.6, portal.age) : portal.rel - 0.4 * pack.speed * smoothstep(1.6, 3.4, portal.age) * dt;
    if (portal.age > 3.4) portal.active = false;
  }

  // You: a weave near the middle of the bore, or the swerve into the sperm bank.
  const you = pack.you;
  const effort = you.mode === 'bank' ? 1 : swimEffort(pack, you.rel, (pack.pileRel ?? 0) - 0.6);
  you.phase += dt * (3 + 16 * effort) * (you.mode === 'bank' ? 1.6 : 1);
  if (you.mode === 'race') {
    if (pack.pileRel !== null) you.rel = mix(you.rel, pack.pileRel - 0.6, 1 - Math.exp(-dt * 5));
    else {
      you.x = 0.8 * Math.sin(pack.time * 0.55);
      you.y = -0.75 + 0.35 * Math.sin(pack.time * 0.83);
    }
  } else if (you.mode === 'bank') {
    you.bank += dt;
    const k = smoothstep(0, 1.3, you.bank);
    const r = tunnelRadius(pack.anchor + portal.rel) * 0.9;
    you.rel = mix(you.from[0], portal.rel, k);
    you.x = mix(you.from[1], r * Math.cos(pack.portal.theta), k);
    you.y = mix(you.from[2], r * Math.sin(pack.portal.theta), k);
    if (previousYou && dt > 0) {
      const travel = sub(playerPose(pack).position, previousYou);
      if (length(travel) > 1e-6) you.forward = normalize(lerp3(you.forward!, normalize(travel), 1 - Math.exp(-dt * 18)));
    }
    if (you.bank >= 1.6) { you.mode = 'banked'; pack.events.push('banked'); }
  }
}

const PEARL = [1, 1, 1, 1];
/** Scratch for a mote's streak; Renderer.sprite copies it straight into the batch. */
const streakVelocity: Vec3 = [0, 0, 0];
/** Seconds the whale takes to cross in front of the egg. */
const WHALE_CROSSING = 6.5;
const WHALE_SCALE = 1.4;
/** Beyond this the egg (and the whale crossing it) is drawn nearer and smaller; see scene.ts. */
export const EGG_FAR = 150;
/** Where a white blood cell's nucleus lobes sit, as fractions of its radius. */
const NUCLEUS: [number, number, number][] = [[0.26, 0.08, 0], [-0.22, -0.06, 0.14], [0.02, 0.26, -0.16]];

/**
 * Fills the instance buffers and sprites for the race and collects the labels the HUD will draw. `hat` scales
 * your beanie: 0 for a spectator, whose swimmer is just another anon.
 */
export function drawPack(pack: Pack, renderer: Renderer, eye: Vec3, hat = 1): { you: Vec3 | null } {
  const swimmers = renderer.meshes.swimmer;
  const labels: Label[] = [];
  let n = 0;
  // Each swimmer drifts round its lane on slow, seeded gusts, so the crowd jostles instead of sitting on rails.
  const t = pack.time * 2.5;
  for (const sw of pack.swimmers) {
    if (sw.state === 'gone' || sw.rel < -14 || sw.rel > 150) continue;
    const s = pack.anchor + sw.rel;
    const f = frameAt(s);
    const r = tunnelRadius(s);
    const rho = sw.rho * (1 + 0.1 * gust(t, sw.seed * 40));
    const theta = sw.theta + 0.18 * gust(t * 0.8, sw.seed * 70 + 3);
    // The U-turn swings out to the side it turns toward and back in, rather than spinning on the spot.
    const way = sw.seed < 0.5 ? 1 : -1;
    const turning = sw.state === 'turn' ? uTurn(sw.turn) : 0;
    let x = rho * r * Math.cos(theta) + sw.pushX + way * 0.6 * Math.sin(turning);
    let y = rho * r * Math.sin(theta) + sw.pushY;
    let shrink = 1;
    if (sw.state === 'eaten') {
      const k = smoothstep(0, 1, sw.eaten);
      x = mix(x, sw.grab[1], k);
      y = mix(y, sw.grab[2], k);
      shrink = 1 - k;
    }
    const lim = r * 0.86;
    const d = Math.hypot(x, y);
    if (d > lim) { x *= lim / d; y *= lim / d; }
    const p = madd(madd(f.point, f.side, x), f.up, y);
    // Nobody swims through the lens.
    if (Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]) < 2.2) continue;
    const heading = sw.state === 'back' ? Math.PI : way * turning;
    const wiggle = Math.sin(pack.time * 1.7 + sw.seed * 40) * 0.12;
    const forward = rotateAbout(f.tangent, f.up, heading + wiggle);
    const [bx, by, bz] = basisFrom(forward, f.up, Math.sin(pack.time + sw.seed * 9) * 0.3);
    const tint = sw.state === 'swim' ? (sw.kind === 'sniper' ? [0.8, 0.9, 1, 1] : sw.kind === 'chad' ? [0.45, 0.85, 1, 1] : PEARL) : [1, 0.62 + 0.38 * (1 - sw.turn), 0.62 + 0.38 * (1 - sw.turn), 1];
    const k = sw.size * shrink * (sw.kind === 'chad' ? 1.12 : 1);
    const amplitude = 0.05 + 0.17 * swimEffort(pack, sw.rel, pileStop(pack, sw));
    putInstance(swimmers, n, p, bx, by, bz, [k, k, k], tint, [sw.phase, amplitude, sw.face, 0]);
    n += 1;
    if (sw.label > 0) labels.push({ text: sw.kind === 'sniper' ? (sw.state === 'swim' ? 'SNIPER' : 'DUMPED') : 'JEET', at: madd(p, f.up, 0.5), colour: sw.kind === 'sniper' ? '#9fd8ff' : '#ff8fa3', size: 15 });
  }

  // You, with the propeller beanie.
  let youAt: Vec3 | null = null;
  let cap = 0;
  const you = pack.you;
  if (you.mode !== 'banked') {
    const s = pack.anchor + you.rel;
    const f = frameAt(s);
    const pose = playerPose(pack);
    const p = pose.position;
    const spin = you.mode === 'bank' ? smoothstep(1.1, 1.6, you.bank) : 0;
    const k = 1.25 * (1 - spin);
    cap = k * Math.min(hat, 1.3);
    if (k > 0.01) {
      const forward = rotateAbout(pose.forward, f.up, spin * 9);
      const [bx, by, bz] = basisFrom(forward, f.up, spin * 6);
      const effort = you.mode === 'bank' ? 1 : swimEffort(pack, you.rel, (pack.pileRel ?? 0) - 0.6);
      putInstance(swimmers, n, p, bx, by, bz, [k, k, k], [1, 0.97, 0.9, 1], [you.phase, 0.04 + 0.12 * effort, hat > 0.5 ? FACE.you : FACE.doge, 0.08]);
      n += 1;
      if (cap > 0.02) {
        const top = madd(p, by, 0.13 * k);
        putInstance(renderer.meshes.beanie, 0, madd(top, bz, 0.02 * k), bx, by, bz, [cap, cap, cap], PEARL, [0, 0, -1, 0.05]);
        const turn = pack.time * (18);
        const px = rotateAbout(bx, by, turn);
        const pz = cross(px, by);
        putInstance(renderer.meshes.propeller, 0, madd(top, by, 0.3 * cap), px, by, pz, [cap, cap, cap], PEARL, [0, 0, -1, 0.1]);
      }
      youAt = madd(p, by, 0.5 * k);
    }
  }
  renderer.drawLit(swimmers, n);
  if (youAt && cap > 0.02) {
    renderer.drawLit(renderer.meshes.beanie, 1);
    renderer.drawLit(renderer.meshes.propeller, 1, 'opaque', 'none');
  }

  // The whale and its hinged jaw, side-on against the egg.
  const whale = pack.whale;
  if (whale.active) {
    const s = pack.anchor + whale.rel;
    const f = frameAt(s);
    const p = madd(madd(f.point, f.side, whale.x), f.up, whale.y);
    const [bx, by, bz] = basisFrom(f.side, f.up, Math.sin(pack.time * 0.8) * 0.08);
    const k = WHALE_SCALE;
    putInstance(renderer.meshes.whale, 0, p, bx, by, bz, [k, k, k], PEARL, [whale.phase, 0.55, -1, 0.04], [4, 1, 0, 0]);
    renderer.drawLit(renderer.meshes.whale, 1);
    const hinge = madd(madd(p, bz, 1.3 * k), by, -1.7 * k);
    const jz = rotateAbout(bz, bx, whale.jaw);
    const jy = rotateAbout(by, bx, whale.jaw);
    putInstance(renderer.meshes.jaw, 0, hinge, bx, jy, jz, [k, k, k], PEARL, [0, 0, -1, 0], [4, 0, 0, 0]);
    renderer.drawLit(renderer.meshes.jaw, 1);
    labels.push({ text: 'SPERM WHALE', at: madd(p, by, 3 * k), colour: '#8fd3ff', size: 22, far: true });
  }

  // The SEC: white blood cells, a lobed purple nucleus inside a translucent membrane.
  const cells: [Vec3, Vec3, Vec3, Vec3, number][] = [];
  for (const blob of pack.blobs) {
    const f = frameAt(blob.s);
    const r = tunnelRadius(blob.s) * blob.rho;
    const p = madd(madd(f.point, f.side, r * Math.cos(blob.theta)), f.up, r * Math.sin(blob.theta));
    // One passing this close would fill the lens.
    if (Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]) < 5) continue;
    cells.push([p, f.side, f.up, f.tangent, blob.size * smoothstep(0, 0.6, pack.time - blob.spawn)]);
    const rel = blob.s - pack.anchor;
    if (rel > 3 && rel < 45 && cells.length <= 2) labels.push({ text: 'SEC', at: madd(p, f.up, blob.size + 0.4), colour: '#e9e4ff', size: 18 });
  }
  const spheres = renderer.meshes.sphere;
  let lobes = 0;
  for (const [p, x, y, z, size] of cells) {
    for (const [ox, oy, oz] of NUCLEUS) {
      putInstance(spheres, lobes, madd(madd(madd(p, x, ox * size), y, oy * size), z, oz * size), x, y, z, [size * 0.34, size * 0.3, size * 0.34], [0.58, 0.27, 0.72, 1], [0, 0, -1, 0.18], [0, 0, 0.05, 0]);
      lobes += 1;
    }
  }
  renderer.drawLit(spheres, lobes);

  let membranes = 0;
  for (const [p, x, y, z, size] of cells) {
    putInstance(spheres, membranes, p, x, y, z, [size, size * 0.92, size], [0.93, 0.9, 1, 0.9], [0, 0, -1, 0.1], [2, 0, 0.16, 0]);
    membranes += 1;
  }
  renderer.drawLit(spheres, membranes, 'alpha', 'back');

  // Drifting motes, stretched into streaks at speed.
  const streak = pack.speed * 0.02;
  for (const mote of pack.motes) {
    const t = mote.tangent;
    streakVelocity[0] = t[0] * streak;
    streakVelocity[1] = t[1] * streak;
    streakVelocity[2] = t[2] * streak;
    renderer.sprite(mote.p, mote.size, mote.colour, 0, streakVelocity);
  }

  // The sperm bank's portal.
  if (pack.portal.active) {
    const f = frameAt(pack.anchor + pack.portal.rel);
    const p = portalPoint(pack);
    const open = smoothstep(0, 0.4, pack.portal.age) * (1 - smoothstep(2.6, 3.4, pack.portal.age));
    renderer.sprite(p, 2.6 * open, [0.45, 0.85, 1, 0.9], 2);
    renderer.sprite(p, 1.7 * open, [0.6, 0.95, 1, 1], 1);
    if (open > 0.2) labels.push({ text: 'SPERM BANK', at: madd(p, f.up, 2), colour: '#8ff0ff', size: 20 });
  }
  renderer.flushSprites('additive');
  pack.labels = labels;
  return { you: youAt };
}

/** Swimmers still in the race on the headline counter. */
export function headline(m: number, crashed: boolean): number {
  if (crashed) return 0;
  return Math.max(1, Math.round(HEADLINE / Math.pow(Math.max(1, m), 2.4)));
}

/** How far ahead of you the egg is: a long way at 1×, just out of reach however high it goes. */
export function eggDistance(m: number): number {
  return 16 + 240 / Math.pow(Math.max(1, m), 1.25);
}
