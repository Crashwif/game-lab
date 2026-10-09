
import { solveLimb, walkingFoot } from './kinematics';
import { CHAT, LEDGES, type Line } from './lines';
import { clamp, mix, mulberry32, noise, type Spring, settleSpring, smoothstep, spring, stepSpring } from './motion';
import type { Beam, Drop } from './roof';
export const INK = '#202432';
export const SKIN = '#f1c9a5';
export const SKIN_PINK = '#f2a0a0';
export const SKIN_RED = '#e25555';
export const SKIN_PURPLE = '#8d4ab0';

export const BAND_GREEN = '#14532d';
export const BLUE_HAIR = '#4db8f0';
export const BLUE_STREAK = '#8fe0ff';
export const HEADBAND = BAND_GREEN;

export const RAINBOW = ['#e0452f', '#f09a37', '#f2d43c', '#3fae5a', '#3f7fd4', '#7a4fd4'] as const;

export const OLIVE = '#141414';
export const HOODIE = '#17171c';
export const CROC = '#9be35a';
const VEST = '#23252c';
const GLOVE = '#3a3d45';
const RED = '#ff4d6d';const TAU = Math.PI * 2;
export const LEAD_REST = { x: 400, feetY: 436, height: 185 } as const;
export const HEAVY_REST = { x: 522, feetY: 426, height: 215 } as const;
export const SUSPECT_REST = { x: 600, feetY: 432, height: 180 } as const;
export const CAP = { x: 722, feetY: 362 } as const;
export const RADIO = { dx: -17, y: 330 } as const;
export const heavyXFor = (rung: number): number => (rung >= 10 ? 610 : rung >= 7 ? 560 : HEAVY_REST.x);
export const leadXFor = (rung: number): number => (rung >= 10 ? 480 : LEAD_REST.x);
export type Joint = { x: number; y: number };
export interface Skeleton { pelvis: Joint; chest: Joint; neck: Joint; head: Joint; shoulders: [Joint, Joint]; elbows: [Joint, Joint]; hands: [Joint, Joint]; hips: [Joint, Joint]; knees: [Joint, Joint]; feet: [Joint, Joint] }
export interface Pose { pelvisY: number; pelvisX: number; spine: number; chest: number; head: number; hands: [Joint, Joint]; world: [boolean, boolean]; feet: [Joint, Joint]; open: [number, number]; stance: number; knee?: Joint }
export interface Build { height: number; shoulder: number; neck: number; headR: number; limb: number; upper: number; lower: number; thigh: number; shin: number; torso: number; hip: number }
export const BUILDS: Record<'lead' | 'heavy' | 'suspect', Build> = {
  lead: { height: 185, shoulder: 40, neck: 10, headR: 24, limb: 15, upper: 36, lower: 32, thigh: 42, shin: 40, torso: 52, hip: 18 },
  heavy: { height: 215, shoulder: 58, neck: 14, headR: 22, limb: 20, upper: 44, lower: 40, thigh: 48, shin: 46, torso: 66, hip: 24 },
  suspect: { height: 180, shoulder: 32, neck: 9, headR: 23, limb: 12, upper: 34, lower: 32, thigh: 42, shin: 40, torso: 50, hip: 14 },
};
export type FlashlightMode = 'off' | 'hip' | 'face' | 'side' | 'dropped' | 'down';
export type ClipboardMode = 'hand' | 'gravel' | 'over' | 'gone';
export type Grip = 'folded' | 'gum' | 'knuckles' | 'fists' | 'gloves' | 'roll' | 'step' | 'shoulder' | 'threat' | 'hood' | 'both' | 'coil';
export const GRIP_BY_RUNG: Grip[] = ['folded', 'gum', 'gum', 'knuckles', 'fists', 'gloves', 'roll', 'step', 'shoulder', 'threat', 'hood', 'both', 'coil'];
export type Stance = 'stand' | 'elbows' | 'held' | 'foot' | 'sit' | 'cap' | 'heels';
export const STANCE_BY_RUNG: Stance[] = ['stand', 'stand', 'stand', 'stand', 'stand', 'stand', 'stand', 'elbows', 'held', 'foot', 'sit', 'cap', 'heels'];
export type Gesture = 'none' | 'guns';
export interface Militia {
  kind: 'lead' | 'heavy';
  x: number;
  feetY: number;
  walk: Spring;
    heat: Spring;
  kick: Spring;
    jab: Spring;
  gasp: Spring;
  notYet: Spring;
  hitch: Spring;
  grip: Grip;
  gripFrom: Grip;
  blendT: number;
    clipT: number;
  gripBeat: number;
  gloves: number;
  gloveT: number;
  gum: 'in' | 'popped' | 'flicked';
  gumT: number;
  crackClock: number;
  crackT: number;
  clipboard: ClipboardMode;
    strokes: number;
  pen: 'hand' | 'ear';
  flashlight: FlashlightMode;
  sweatClock: number;
  steamClock: number;
  shoutT: number;
  actClock: number;
  coin: 'none' | 'diving' | 'caught' | 'looking' | 'pocketed';
  coinT: number;
    lean: number;
  grab: number;
  shrug: number;
  seated: number;
    face: number;
  open: [number, number];
  sk: Skeleton;
  seed: number;
}
export interface Suspect {
  mode: 'roof' | 'escape' | 'gone' | 'thrown';
  x: number;
  feetY: number;
    ledge: Spring;
  xs: Spring;
    confidence: Spring;
  stance: Stance;
  stanceFrom: Stance;
  blendT: number;
    shrug: number;
  shrugAmp: number;
    aside: Spring;
  asideClock: number;
  holdOn: Spring;
  talk: number;
  gesture: Gesture;
  gestureT: number;
  phone: 'pocket' | 'hand' | 'live' | 'down' | 'loose';
  chat: string[];
  chatClock: number;
  chatCount: number;
  viewers: number;
  shades: 'up' | 'down' | 'laser' | 'flown';
  hood: boolean;
  crocs: [boolean, boolean];
  glance: number;
  bounce: number;
  run: number;
  squash: Spring;
    lift: number;
  escapeT: number;
  face: number;
  open: [number, number];
  sk: Skeleton;
  seed: number;
}
export interface ThrowTimes { grab: number; load: number; hitstop: number; gasp: number; release: number; follow: number; apex: number; fall: number; cut: number; insert: number; back: number }

export function throwTimes(instant: boolean): ThrowTimes {
  const h = instant ? 0.18 : 0.35;
  return { grab: 0, load: instant ? 0.12 : 0.25, hitstop: h, gasp: h + 0.1, release: h + 0.15, follow: h + 0.18, apex: h + 0.43, fall: h + 0.58, cut: h + 2.18, insert: h + 2.25, back: h + 2.85 };
}
export interface Thrown {
  seed: number;
  instant: boolean;
  times: ThrowTimes;
    x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  drift: number;
  flail: number;
  phase: 'grab' | 'load' | 'heave' | 'arc' | 'fall' | 'gone';
    release: { phone: number; croc: number };
  relic: 0 | 1;
  gone: { phone: boolean; shades: boolean; croc0: boolean; croc1: boolean };
    hx: number;
  gx: number;
  fromY: number;
  head: Joint;
}
export interface CrewEvents {
  click: boolean;
  flashlight: boolean;
  tick: boolean;
  write: boolean;
  knuckles: boolean;
  gumPop: boolean;
  gumFlick: boolean;
  snicker: boolean;
  gasp: boolean;
  steam: 'first' | 'puff' | null;
    stomp: number;
  camera: boolean;
  phoneOut: boolean;
  chat: boolean;
  zap: boolean;
  load: boolean;
  hitstop: boolean;
  release: boolean;
  apex: boolean;
  coins: boolean;
  hop: boolean;
  hoodUp: boolean;
  gone: boolean;
    drops: Drop[];
  pickup: boolean;
  heave: boolean;
  shrug: boolean;
}
export interface Crew {
  lead: Militia;
  heavy: Militia;
  suspect: Suspect;
  thrown: Thrown | null;
    rung: number;
  harmless: boolean;
  events: CrewEvents;
}
const noEvents = (): CrewEvents => ({ click: false, flashlight: false, tick: false, write: false, knuckles: false, gumPop: false, gumFlick: false, snicker: false, gasp: false, steam: null, stomp: 0, camera: false, phoneOut: false, chat: false, zap: false, load: false, hitstop: false, release: false, apex: false, coins: false, hop: false, hoodUp: false, gone: false, drops: [], pickup: false, heave: false, shrug: false });
const J = (x: number, y: number): Joint => ({ x, y });
const blankSkeleton = (x: number, y: number): Skeleton => ({ pelvis: J(x, y - 80), chest: J(x, y - 130), neck: J(x, y - 140), head: J(x, y - 160), shoulders: [J(x, y - 130), J(x, y - 130)], elbows: [J(x, y - 100), J(x, y - 100)], hands: [J(x, y - 70), J(x, y - 70)], hips: [J(x, y - 80), J(x, y - 80)], knees: [J(x, y - 40), J(x, y - 40)], feet: [J(x, y), J(x, y)] });
function militia(kind: 'lead' | 'heavy'): Militia {
  const rest = kind === 'lead' ? LEAD_REST : HEAVY_REST;
  return { kind, x: rest.x, feetY: rest.feetY, walk: spring(rest.x), heat: spring(0), kick: spring(0), jab: spring(0), gasp: spring(0), notYet: spring(0), hitch: spring(0), grip: 'folded', gripFrom: 'folded', blendT: 1, clipT: 9, gripBeat: 0, gloves: 0, gloveT: 9, gum: 'in', gumT: 9, crackClock: 0, crackT: 9, clipboard: kind === 'lead' ? 'hand' : 'gone', strokes: 0, pen: 'hand', flashlight: 'off', sweatClock: 0, steamClock: 0, shoutT: 0, actClock: 0, coin: 'none', coinT: 0, lean: 0, grab: 0, shrug: 0, seated: 0, face: -0.7, open: [0.5, 0.5], sk: blankSkeleton(rest.x, rest.feetY), seed: kind === 'lead' ? 3 : 17 };
}
function suspect(): Suspect {
  return { mode: 'roof', x: SUSPECT_REST.x, feetY: SUSPECT_REST.feetY, ledge: spring(4), xs: spring(SUSPECT_REST.x), confidence: spring(0), stance: 'stand', stanceFrom: 'stand', blendT: 1, shrug: 0, shrugAmp: 0.25, aside: spring(0), asideClock: 0, holdOn: spring(0), talk: 0, gesture: 'none', gestureT: 0, phone: 'pocket', chat: [], chatClock: 0, chatCount: 0, viewers: 0, shades: 'up', hood: false, crocs: [true, true], glance: 0, bounce: 0, run: 0, squash: spring(0), lift: 0, escapeT: -1, face: -0.7, open: [0.5, 0.5], sk: blankSkeleton(SUSPECT_REST.x, SUSPECT_REST.feetY), seed: 29 };
}
export const createCrew = (): Crew => ({ lead: militia('lead'), heavy: militia('heavy'), suspect: suspect(), thrown: null, rung: -1, harmless: false, events: noEvents() });

export function resetCrew(c: Crew): void {
  c.lead = militia('lead');
  c.heavy = militia('heavy');
  c.suspect = suspect();
  c.thrown = null;
  c.rung = -1;
  c.harmless = false;
  c.events = noEvents();
}
export interface CrewDrive {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  running: boolean;
  multiplier: number;
  rung: number;
  tension: number;
  time: number;
  reduced: boolean;
    wind: number;
  said: Line[];
  talking: { suspect: boolean; lead: boolean; heavy: boolean };
  escaped: boolean;
  escapeT: number;
  crashT: number;
  aftermathT: number;
  harmlessT: number;
    overtime: number;
    actStage: number;
}
function setGrip(m: Militia, grip: Grip): void {
  if (m.grip === grip) return;
  m.gripFrom = m.grip;
  m.grip = grip;
  m.blendT = m.gripBeat = m.clipT = 0;
}
function setStance(s: Suspect, stance: Stance): void {
  if (s.stance === stance) return;
  s.stanceFrom = s.stance;
  s.stance = stance;
  s.blendT = 0;
}
function applyRung(c: Crew, rung: number, fire: boolean): void {
  const ev = c.events;
  const { lead, heavy, suspect: s } = c;
  for (let r = c.rung + 1; r <= rung; r += 1) {
    if (r === 1) {
      heavy.gum = 'popped';
      heavy.gumT = fire ? 0 : 9;
      lead.strokes = Math.max(lead.strokes, 1);
      if (fire) ev.gumPop = ev.tick = true;
    }
    if (r === 2) {
      s.phone = 'hand';
      if (fire) ev.phoneOut = ev.tick = true;
    }
    if (r === 3 && fire) {
      ev.knuckles = true;
      heavy.crackT = 0;
    }
    if (r === 4) {
      heavy.gum = 'flicked';
      s.shades = 'down';
      if (fire) {
        ev.gumFlick = ev.gasp = true;
        lead.gasp.v = 6;
        ev.drops.push({ kind: 'gum', x: heavy.x - 20, y: heavy.feetY - 170, vx: -420, vy: -40, spin: 8, mode: 'stick' });
      }
    }
    if (r === 5) {
      heavy.gloveT = fire ? 0 : 9;
      heavy.gloves = fire ? 0 : 2;
      lead.flashlight = 'face';
      lead.strokes = Math.max(lead.strokes, 2);
      if (fire) ev.tick = true;
    }
    if (r === 6) {
      lead.strokes = 3;
      if (fire) ev.tick = ev.snicker = ev.camera = true;
    }
    if (r === 7) {
      lead.clipboard = 'gravel';
      lead.pen = 'ear';
      if (fire) {
        ev.stomp = Math.max(ev.stomp, 0.6);
        ev.drops.push({ kind: 'clipboard', x: lead.x + 20, y: lead.feetY - 110, vx: 160, vy: -60, spin: 6, mode: 'skid' });
      }
    }
    if (r === 8) s.phone = 'live';
    if (r === 10) {
      s.phone = 'down';
      if (fire) ev.stomp = Math.max(ev.stomp, 0.5);
    }
    if (r === 12) {
      s.shades = 'laser';
      if (fire) ev.zap = true;
    }
  }
  c.rung = Math.max(c.rung, rung);
  setGrip(heavy, GRIP_BY_RUNG[clamp(rung, 0, 12)]!);
  setStance(s, STANCE_BY_RUNG[clamp(rung, 0, 12)]!);
}

export function stepCrew(c: Crew, drive: CrewDrive, dt: number): void {
  c.events = noEvents();
  const ev = c.events;
  const { lead, heavy, suspect: s } = c;
  const onRoof = s.mode === 'roof' && !c.thrown;
  const live = drive.running && !drive.escaped && onRoof;
  for (const line of drive.said) {
    if (line.who === 'suspect') {
      lead.heat.v += 0.5;
      lead.kick.v += 60;
      heavy.kick.v += 30;
      heavy.hitch.v += 40;
      if (drive.rung >= 1 && onRoof) {
        s.shrug = 0.001;
        s.shrugAmp = 0.25 + 0.75 * clamp(s.confidence.x, 0, 1);
      }
      if (line.tag === 'chat') s.asideClock = 1.6;
      if (line.tag === 'phone') s.holdOn.v = 8;
      if (line.tag === 'glance') s.glance = 0.4;
      if (drive.rung >= 3 && live) lead.jab.v = drive.overtime >= 0 ? 6 : 9;
      if (live && s.chatCount % 3 === 2) {
        s.gesture = 'guns';
        s.gestureT = 0;
      }
    } else if (line.who === 'lead' || line.who === 'heavy') {
      s.confidence.v -= 0.25;
      if (line.tag === 'notyet') lead.notYet.v = 10;
      if (line.tag === 'caps') lead.shoutT = 1.2;
      if (line.who === 'lead' && line.text.startsWith('you, across')) lead.face = 0.2;
    }
  }
  if (live && drive.rung > c.rung) applyRung(c, drive.rung, true);
  if (drive.phase === 'running' && lead.flashlight === 'off') {
    lead.flashlight = 'hip';
    ev.flashlight = ev.click = true;
  }
  const held = c.thrown !== null || drive.phase === 'crashed';
  stepSpring(lead.heat, held ? lead.heat.x : drive.running ? (drive.escaped ? drive.tension * 0.3 : drive.tension) : 0, 3, 0.85, dt);
  stepSpring(heavy.heat, lead.heat.x, 10, 1, dt);
  for (const m of [lead, heavy]) {
    stepSpring(m.kick, 0, 16, 0.4, dt);
    stepSpring(m.jab, 0, 10, 0.7, dt);
    stepSpring(m.gasp, 0, 5, 0.6, dt);
    stepSpring(m.notYet, 0, 7, 0.6, dt);
    stepSpring(m.hitch, 0, 9, 0.5, dt);
    m.blendT = Math.min(1, m.blendT + dt / 0.4);
    stepSpring(m.walk, m.kind === 'lead' ? leadXFor(drive.rung) : heavyXFor(drive.rung), 6, 0.9, dt);
    if (onRoof && drive.running) m.x = m.walk.x;
    m.actClock = drive.actStage === 6 && m.kind === 'lead' ? m.actClock + dt : 0;
    m.seated = clamp(m.seated + (m.kind === 'lead' && drive.actStage === 5 ? dt : -dt) / 0.5, 0, 1);
    m.coinT += dt;
    m.clipT = Math.min(99, m.clipT + dt);
    m.shoutT = Math.max(0, m.shoutT - dt);
  }
  const heat = clamp(lead.heat.x, 0, 1);
  if (heat > 0.8 && live) {
    const was = lead.steamClock;
    lead.steamClock += dt;
    if (was === 0) ev.steam = 'first';
    else if (Math.floor(lead.steamClock / 2) > Math.floor(was / 2)) ev.steam = 'puff';
  } else lead.steamClock = 0;
  lead.sweatClock = heat > 0.7 ? (lead.sweatClock + dt) % 4 : 0;
  heavy.gumT += dt;
  heavy.gloveT += dt;
  if (heavy.gloveT < 2) heavy.gloves = heavy.gloveT >= 1.4 ? 2 : heavy.gloveT >= 0.7 ? 1 : 0;
  heavy.crackT += dt;
  heavy.crackClock += dt;
  if (heavy.crackClock >= mix(9, 5, heat) && !c.thrown && !c.harmless && heavy.coin === 'none' && drive.rung < 8) {
    heavy.crackClock = heavy.crackT = 0;
    if (drive.running) ev.knuckles = true;
  }
  if (heavy.grip === 'shoulder' || heavy.grip === 'threat') heavy.gripBeat = Math.min(0.45, heavy.gripBeat + dt);
  stepSpring(s.confidence, drive.running && onRoof ? drive.tension : 0, 2.5, 0.8, dt);
  if (onRoof) {
    stepSpring(s.ledge, LEDGES[clamp(drive.rung, 0, 12)]!, 4, 0.9, dt);
    const onCap = s.stance === 'sit' || s.stance === 'cap' || s.stance === 'heels';
    stepSpring(s.xs, onCap ? CAP.x : 600 + 20 * (4 - clamp(s.ledge.x, 0.6, 4)), 4, 0.9, dt);
    s.x = s.xs.x;
    s.feetY = s.stance === 'cap' || s.stance === 'heels' ? CAP.feetY : SUSPECT_REST.feetY;
  }
  s.blendT = Math.min(1, s.blendT + dt / 0.4);
  if (s.shrug > 0) s.shrug = s.shrug + dt / 1.25 >= 1 ? 0 : s.shrug + dt / 1.25;
  s.asideClock = Math.max(0, s.asideClock - dt);
  stepSpring(s.aside, s.asideClock > 0 ? 1 : 0, 12, 0.8, dt);
  stepSpring(s.holdOn, 0, 6, 0.7, dt);
  s.glance = Math.max(0, s.glance - dt);
  s.talk += clamp((drive.talking.suspect ? 1 : 0) - s.talk, -dt * 3, dt * 8);
  s.bounce += dt * 1.6 * TAU;
  stepSpring(s.squash, 0, 14, 0.5, dt);
  s.gestureT += dt;
  if (s.phone === 'live' || s.phone === 'down') {
    s.viewers = Math.round((12400 * drive.multiplier) / 8);
    s.chatClock += dt;
    if (s.chatClock > mix(1.2, 0.5, drive.tension)) {
      s.chatClock = 0;
      s.chat.push(s.phone === 'down' && s.chatCount % 9 === 4 ? 'pov' : CHAT[s.chatCount % CHAT.length]!);
      while (s.chat.length > 6) s.chat.shift();
      s.chatCount += 1;
      ev.chat = true;
    }
  }
  s.escapeT = drive.escapeT;
  if (drive.escapeT >= 0 && !c.thrown) {
    const t = drive.escapeT;
    if (s.mode === 'roof') {
      s.mode = 'escape';
      ev.coins = true;
      setGrip(heavy, 'fists');
      setStance(s, 'stand');
    }
    if (t >= 0.15 && lead.flashlight !== 'dropped') {
      lead.flashlight = 'dropped';
      lead.coin = heavy.coin = 'diving';
      lead.coinT = heavy.coinT = 0;
      ev.drops.push({ kind: 'flashlight', x: lead.x + 60, y: lead.feetY - 120, vx: -40, vy: 40, spin: 4, mode: 'skid' });
    }
    if (t >= 0.25 && s.mode === 'escape') {
      if (s.run === 0) {
        ev.hop = true;
        ev.stomp = Math.max(ev.stomp, 0.4);
        s.squash.v = 6;
        s.feetY = SUSPECT_REST.feetY;
      }
      s.run += 640 * dt;
      s.x = Math.max(60, s.xs.x - s.run);
    }
    if (t >= 0.5 && !s.hood) s.hood = ev.hoodUp = true;
    if (t >= 0.6 && lead.coin === 'diving') lead.coin = 'caught';
    if (t >= 1.45 && s.mode === 'escape') {
      s.mode = 'gone';
      ev.gone = true;
    }
    if (t >= 2.2 && lead.coin === 'caught') lead.coin = 'looking';
    if (t >= 3.5 && lead.coin === 'looking') {
      lead.coin = 'pocketed';
      if (lead.clipboard === 'gravel') { lead.clipboard = 'hand'; ev.pickup = true; }
    }
    if (t >= 3.6 && heavy.coin !== 'pocketed') {
      heavy.coin = 'pocketed';
      heavy.coinT = 0;
      setGrip(heavy, 'folded');
    }
  }
  if (drive.harmlessT >= 0 && c.harmless) {
    const t = drive.harmlessT;
    if (t >= 0.3 && lead.clipboard !== 'over' && lead.clipboard !== 'gone') {
      lead.clipboard = 'gone';
      heavy.clipboard = 'hand';
      setGrip(heavy, 'fists');
      ev.pickup = true;
    }
    if (t >= 1.1 && heavy.clipboard === 'hand') {
      heavy.clipboard = 'gone';
      ev.heave = true;
      ev.drops.push({ kind: 'clipboard', x: heavy.x + 60, y: heavy.feetY - 180, vx: 260, vy: -220, spin: 7, mode: 'over' });
    }
    if (t >= 2.4 && heavy.shrug === 0) {
      heavy.shrug = 0.001;
      ev.shrug = true;
    }
    if (heavy.shrug > 0) heavy.shrug = Math.min(1, heavy.shrug + dt / 1.25);
  }
  if (c.thrown && drive.crashT >= 0) stepThrown(c, drive, dt);
  if (c.thrown && drive.aftermathT >= 4.2 && lead.clipboard === 'gravel') {
    lead.clipboard = 'hand';
    lead.strokes = 4;
    ev.pickup = ev.click = ev.write = true;
  }
  s.lift = heavy.grip === 'coil' ? -(4 + 3 * Math.sin((drive.time * TAU) / 7) + 2 * clamp(heavy.hitch.x, 0, 1)) * clamp(heavy.blendT, 0, 1) : 0;
  solveSuspect(c, drive);
  solveMilitia(heavy, c, drive);
  solveMilitia(lead, c, drive);
}
function stepThrown(c: Crew, drive: CrewDrive, dt: number): void {
  const th = c.thrown!;
  const ev = c.events;
  const t = drive.crashT;
  const T = th.times;
  const s = c.suspect;
  const was = th.phase;
  th.phase = t < T.load ? 'grab' : t < T.hitstop ? 'load' : t < T.release ? 'heave' : t < T.apex ? 'arc' : t < T.cut ? 'fall' : 'gone';
  if (was !== th.phase) {
    if (was === 'grab') ev.load = true;
    if (th.phase === 'heave') ev.hitstop = true;
    if (th.phase === 'arc') ev.release = true;
    if (th.phase === 'fall') ev.apex = true;
  }
  if (t >= 0.05 && t - dt < 0.05) ev.stomp = Math.max(ev.stomp, 0.7);
  if (t >= T.gasp && t - dt < T.gasp && dt > 0) {
    ev.gasp = true;
    c.lead.gasp.v = 6;
  }
  if (th.phase === 'grab' || th.phase === 'load') {
    const u = clamp(t / T.hitstop, 0, 1);
    th.x = mix(th.gx, th.hx + 40, u);
    th.y = mix(th.fromY - 88, 340, u);
    th.rot = -0.5 * smoothstep(T.load, T.hitstop, t);
    th.vx = th.vy = 0;
  } else if (th.phase === 'heave') {
    const u = clamp((t - T.hitstop) / (T.release - T.hitstop), 0, 1);
    th.x = mix(th.hx + 40, th.hx + 170, u);
    th.y = mix(340, 250, u);
    th.rot = mix(-0.5, 1.2, u);
    th.vx = 150;
    th.vy = -260;
    if (u > 0.5 && !th.gone.shades) {
      th.gone.shades = true;
      s.shades = 'flown';
      ev.drops.push({ kind: 'shades', x: th.x, y: th.y - 60, vx: 240, vy: -200, spin: 9, mode: 'fall' });
    }
    if (u > 0.6 && !th.gone.croc0) {
      th.gone.croc0 = true;
      s.crocs[th.relic === 0 ? 1 : 0] = false;
      ev.drops.push({ kind: 'croc', x: th.x, y: th.y + 60, vx: 120, vy: -120, spin: 6, mode: 'fall', drag: 0.3 });
    }
    if (u > 0.9 && !th.gone.croc1) {
      th.gone.croc1 = true;
      s.crocs = [false, false];
    }
  } else if (th.phase === 'arc') {
    const u = clamp((t - T.release) / (T.apex - T.release), 0, 1);
    th.x = mix(th.hx + 170, 815, u);
    th.y = mix(250, 180, Math.sin((u * Math.PI) / 2));
    th.vx = 150 * (1 - u) + th.drift * u;
    th.vy = -260 * (1 - u);
    th.rot += th.spin * dt;
  } else if (th.phase === 'fall') {
    th.vy += 1600 * clamp((t - T.apex) / 0.25, 0, 1) * dt;
    th.vx = th.drift;
    th.x += th.vx * dt;
    th.y += th.vy * dt;
    th.rot += th.spin * dt;
    th.flail += dt;
    const fr = t - T.fall;
    if (fr >= th.release.phone && !th.gone.phone) {
      th.gone.phone = true;
      s.phone = 'loose';
      ev.drops.push({ kind: 'phone', x: th.x + 20, y: th.y, vx: 60, vy: th.vy * 0.6, spin: 7, mode: 'fall', lit: true });
    }
  }
  const after = drive.aftermathT;
  c.heavy.grab = clamp((t - T.follow) / 0.25, 0, 1);
  c.lead.grab = after >= 4.2 ? 1 - clamp((after - 4.2) / 0.6, 0, 1) : clamp((t - T.follow - 0.05) / 0.2, 0, 1);
  const lean = clamp((t - T.back) / 0.3, 0, 1);
  c.heavy.lean = after >= 5.5 ? lean * mix(1, 0.35, clamp((after - 5.5) / 0.4, 0, 1)) : lean;
  c.lead.lean = after >= 4.2 ? lean * (1 - clamp((after - 4.2) / 0.6, 0, 1)) : lean;
  if (t >= T.back) c.lead.flashlight = 'down';
}

export function beginThrow(c: Crew, seed: number, instant: boolean): void {
  if (c.thrown) return;
  const rand = mulberry32(seed);
  const s = c.suspect;
  const fromY = s.stance === 'sit' ? 440 : s.feetY;
  s.mode = 'thrown';
  s.feetY = SUSPECT_REST.feetY;
  const sign = rand() > 0.5 ? 1 : -1;
  c.thrown = { seed, instant, times: throwTimes(instant), x: s.x, y: fromY - 88, vx: 0, vy: 0, rot: 0, spin: sign * (2.5 + rand() * 3), drift: 20 + rand() * 30, flail: rand() * TAU, phase: 'grab', release: { phone: 0.6 + rand() * 0.4, croc: 0.05 }, relic: rand() > 0.5 ? 1 : 0, gone: { phone: false, shades: false, croc0: false, croc1: false }, hx: c.heavy.x, gx: s.sk.pelvis.x, fromY, head: { x: s.x, y: fromY - 158 } };
  c.lead.flashlight = 'side';
  setGrip(c.heavy, 'both');
}

export function escapeCrew(c: Crew, seed: number, quiet: boolean): void {
  const s = c.suspect;
  if (!quiet) {
    s.seed = seed;
    return;
  }
  s.mode = 'gone';
  s.hood = true;
  c.lead.flashlight = 'dropped';
  c.lead.coin = c.heavy.coin = 'pocketed';
  c.heavy.coinT = c.lead.coinT = 9;
  if (c.lead.clipboard === 'gravel') c.lead.clipboard = 'hand';
  setGrip(c.heavy, 'folded');
  c.heavy.blendT = 1;
  settleSpring(c.lead.heat, c.lead.heat.x * 0.3);
  settleSpring(c.heavy.heat, c.lead.heat.x);
}

export function beginHeave(c: Crew): void {
  c.harmless = true;
}
export interface CrewSettle { multiplier: number; rung: number; tension: number; running: boolean; escaped: boolean; overtime: number }

export function settleCrew(c: Crew, settle: CrewSettle): void {
  applyRung(c, settle.rung, false);
  c.events = noEvents();
  const { lead, heavy, suspect: s } = c;
  if (settle.running) lead.flashlight = settle.rung >= 5 ? 'face' : 'hip';
  settleSpring(lead.heat, settle.escaped ? settle.tension * 0.3 : settle.tension);
  settleSpring(heavy.heat, lead.heat.x);
  if (lead.heat.x > 0.8) lead.steamClock = 0.01;
  settleSpring(s.confidence, settle.escaped ? 0 : settle.tension);
  settleSpring(s.ledge, LEDGES[clamp(settle.rung, 0, 12)]!);
  const onCap = s.stance === 'sit' || s.stance === 'cap' || s.stance === 'heels';
  settleSpring(s.xs, onCap ? CAP.x : 600 + 20 * (4 - clamp(s.ledge.x, 0.6, 4)));
  s.x = s.xs.x;
  s.feetY = s.stance === 'cap' || s.stance === 'heels' ? CAP.feetY : SUSPECT_REST.feetY;
  for (const m of [lead, heavy]) {
    settleSpring(m.walk, m.kind === 'lead' ? leadXFor(settle.rung) : heavyXFor(settle.rung));
    m.x = m.walk.x;
    m.blendT = 1;
  }
  heavy.gripBeat = 0.45;
  s.blendT = 1;
  if (settle.escaped) escapeCrew(c, 0, true);
  solveAll(c, settle.tension, settle.escaped);
}

export function settleCrashed(c: Crew, seed: number, harmless: boolean, aftermathT: number): void {
  if (harmless) {
    c.harmless = true;
    c.lead.clipboard = c.heavy.clipboard = 'gone';
    c.heavy.shrug = 1;
    setGrip(c.heavy, 'folded');
    c.heavy.blendT = 1;
    solveAll(c, 0, true);
    return;
  }
  beginThrow(c, seed, false);
  const th = c.thrown!;
  th.phase = 'gone';
  th.x = 900;
  th.y = 4000;
  const straight = aftermathT >= 4.8;
  c.heavy.lean = aftermathT >= 5.9 ? 0.35 : 1;
  c.heavy.grab = 1;
  c.lead.lean = c.lead.grab = straight ? 0 : 1;
  c.lead.flashlight = 'down';
  if (aftermathT >= 4.2) {
    c.lead.clipboard = 'hand';
    c.lead.strokes = 4;
  }
  c.heavy.blendT = 1;
  solveAll(c, 0, false);
}
function solveAll(c: Crew, tension: number, escaped: boolean): void {
  const drive: CrewDrive = { phase: 'running', running: true, multiplier: 1, rung: c.rung, tension, time: 0, reduced: true, wind: 0.2, said: [], talking: { suspect: false, lead: false, heavy: false }, escaped, escapeT: escaped ? 10 : -1, crashT: c.thrown ? 99 : -1, aftermathT: c.thrown ? 99 : -1, harmlessT: c.harmless ? 10 : -1, overtime: -1, actStage: 0 };
  c.suspect.escapeT = drive.escapeT;
  solveSuspect(c, drive);
  solveMilitia(c.heavy, c, drive);
  solveMilitia(c.lead, c, drive);
}
export interface CrewAnchors { suspectHead: Joint | null; suspectMouth: Joint | null; suspectHand: Joint; leadMouth: Joint; heavyMouth: Joint; heavyHead: Joint; leadHand: Joint; radio: Joint }

export function anchors(c: Crew): CrewAnchors {
  const s = c.suspect;
  const th = c.thrown;
  const head = th ? (th.phase !== 'gone' ? th.head : null) : s.mode !== 'gone' ? s.sk.head : null;
  const lh = c.lead.sk.head;
  const hh = c.heavy.sk.head;
  return { suspectHead: head, suspectMouth: head ? { x: head.x - 8, y: head.y + 10 } : null, suspectHand: s.sk.hands[1], leadMouth: { x: lh.x + 10, y: lh.y + 8 }, heavyMouth: { x: hh.x + 10, y: hh.y + 8 }, heavyHead: hh, leadHand: c.lead.sk.hands[1], radio: { x: c.lead.x + RADIO.dx, y: RADIO.y } };
}
const raiseFor = (m: Militia): number => (m.flashlight === 'face' ? 1 : m.flashlight === 'hip' ? smoothstep(0.2, 0.5, clamp(m.heat.x, 0, 1)) : 0);

export function beamFor(c: Crew, time: number): Beam | null {
  const m = c.lead.flashlight;
  if (m === 'off' || m === 'dropped') return null;
  const a = anchors(c);
  const heat = clamp(c.lead.heat.x, 0, 1);
  const jitter = heat > 0.6 ? (noise(Math.floor(time * 30)) - 0.5) * 6 : 0;
  if (m === 'down') return { from: a.leadHand, to: { x: 780, y: 900 }, width: 60, alpha: 0.12 };
  if (m === 'side') return { from: a.leadHand, to: { x: a.leadHand.x + 30, y: 470 }, width: 30, alpha: 0.08 };
  const target = a.suspectHead ?? { x: 700, y: 420 };
  const raise = raiseFor(c.lead);
  return { from: a.leadHand, to: { x: target.x + jitter * raise, y: mix(c.suspect.feetY, target.y, raise) + jitter * raise }, width: 40, alpha: mix(0.08, 0.25, raise * smoothstep(0.2, 0.5, Math.max(heat, raise * 0.5))) };
}
type Torso = Pick<Skeleton, 'pelvis' | 'chest' | 'neck' | 'head' | 'shoulders' | 'hips'>;
function torsoOf(b: Build, x: number, feetY: number, dir: number, p: Pose): Torso {
  const pelvis = J(x + dir * p.pelvisX, feetY - p.pelvisY);
  const chest = J(pelvis.x + dir * Math.sin(p.spine) * b.torso, pelvis.y - Math.cos(p.spine) * b.torso);
  const a2 = p.spine + p.chest;
  const neck = J(chest.x + dir * Math.sin(a2) * b.neck, chest.y - Math.cos(a2) * b.neck);
  const a3 = a2 + p.head;
  const head = J(neck.x + dir * Math.sin(a3) * b.headR, neck.y - Math.cos(a3) * b.headR);
  const px = Math.cos(a2) * b.shoulder * 0.45;
  const py = Math.sin(a2) * b.shoulder * 0.45;
  return { pelvis, chest, neck, head, shoulders: [J(chest.x - dir * px, chest.y - py + 3), J(chest.x + dir * px, chest.y + py + 3)], hips: [J(pelvis.x - dir * b.hip * 0.5, pelvis.y), J(pelvis.x + dir * b.hip * 0.5, pelvis.y)] };
}
const handWorld = (b: Build, x: number, feetY: number, dir: number, p: Pose, i: 0 | 1): Joint => {
  if (p.world[i]) return p.hands[i];
  const sh = torsoOf(b, x, feetY, dir, p).shoulders[i];
  return J(sh.x + dir * p.hands[i].x, sh.y + p.hands[i].y);
};
const mixJ = (a: Joint, c: Joint, t: number): Joint => J(mix(a.x, c.x, t), mix(a.y, c.y, t));
const midJ = (a: Joint, c: Joint): Joint => mixJ(a, c, 0.5);
function mixPose(b: Build, x: number, feetY: number, dir: number, a: Pose, c: Pose, t: number): Pose {
  if (t <= 0) return a;
  if (t >= 1) return c;
  const h = (i: 0 | 1) => mixJ(handWorld(b, x, feetY, dir, a, i), handWorld(b, x, feetY, dir, c, i), t);
  return { pelvisY: mix(a.pelvisY, c.pelvisY, t), pelvisX: mix(a.pelvisX, c.pelvisX, t), spine: mix(a.spine, c.spine, t), chest: mix(a.chest, c.chest, t), head: mix(a.head, c.head, t), hands: [h(0), h(1)], world: [true, true], feet: [mixJ(a.feet[0], c.feet[0], t), mixJ(a.feet[1], c.feet[1], t)], open: [mix(a.open[0], c.open[0], t), mix(a.open[1], c.open[1], t)], stance: mix(a.stance, c.stance, t), knee: t < 0.5 ? a.knee : c.knee };
}
function limb(root: Joint, target: Joint, upper: number, lower: number, d: Joint): { joint: Joint; end: Joint } {
  // The catalog's continuous pole (Know Your Clown's `outward`): the sine of the angle between
  // the limb and the hint, scaled 3, so the bend swings through depth instead of flipping.
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const len = Math.max(0.0001, Math.hypot(dx, dy));
  const pole = clamp(3 * ((dx * d.y - dy * d.x) / len), -1, 1);
  return solveLimb(root, target, upper, lower, pole);
}
function solve(b: Build, x: number, feetY: number, dir: number, p: Pose): Skeleton {
  const t = torsoOf(b, x, feetY, dir, p);
  const kd = p.knee ? J(dir * p.knee.x, p.knee.y) : J(dir, -0.3);
  const arm = (i: 0 | 1) => limb(t.shoulders[i], handWorld(b, x, feetY, dir, p, i), b.upper, b.lower, J(-dir, 0.4));
  const leg = (i: 0 | 1) => limb(t.hips[i], J(x + dir * p.feet[i].x, feetY + p.feet[i].y), b.thigh, b.shin, kd);
  const [a0, a1, l0, l1] = [arm(0), arm(1), leg(0), leg(1)];
  return { ...t, elbows: [a0.joint, a1.joint], hands: [a0.end, a1.end], knees: [l0.joint, l1.joint], feet: [l0.end, l1.end] };
}
const basePose = (b: Build, stance: number): Pose => ({ pelvisY: (b.thigh + b.shin) * 0.92, pelvisX: 0, spine: 0, chest: 0, head: 0, hands: [J(4, b.upper + b.lower - 6), J(4, b.upper + b.lower - 6)], world: [false, false], feet: [J(-stance / 2, 0), J(stance / 2, 0)], open: [0.5, 0.5], stance });
const H = (p: Pose, h0: Joint, h1: Joint, w0 = false, w1 = false, o0 = 0.5, o1 = 0.5): Pose => ({ ...p, hands: [h0, h1], world: [w0, w1], open: [o0, o1] });
function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = ctx.lineCap = 'round';
}
function seg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, outline = 2): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  if (outline > 0) {
    ink(ctx, outline);
    ctx.stroke();
  }
}
const disc = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, outline = 2): void => ell(ctx, x, y, r, r, fill, outline);
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, outline = 2): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  if (outline > 0) {
    ink(ctx, outline);
    ctx.stroke();
  }
}
function poly(ctx: CanvasRenderingContext2D, pts: Joint[], fill: string, outline = 2.5): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  if (outline > 0) {
    ink(ctx, outline);
    ctx.stroke();
  }
}
function strokeLimb(ctx: CanvasRenderingContext2D, a: Joint, b: Joint, c: Joint, width: number, colour: string): void {
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const [w, col] of [[width + 4, INK], [width, colour]] as [number, string][]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }
}
function drawHand(ctx: CanvasRenderingContext2D, h: Joint, r: number, open: number, colour: string, point?: number): void {
  disc(ctx, h.x, h.y, r * (1 + 0.15 * open), colour, 2);
  if (open > 0.6) {
    ink(ctx, 1.5);
    seg(ctx, h.x - r * 0.5, h.y - r * 0.2, h.x + r * 0.5, h.y - r * 0.2);
    seg(ctx, h.x - r * 0.4, h.y + r * 0.3, h.x + r * 0.4, h.y + r * 0.3);
  }
  if (point !== undefined) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = r * 0.8;
    seg(ctx, h.x, h.y, h.x + Math.cos(point) * r * 1.6, h.y + Math.sin(point) * r * 1.6);
  }
}
function drawHeadband(ctx: CanvasRenderingContext2D, r: number, dir: number, wind: number, time: number, seed: number): void {
  const y = -r * 0.45;
  // The unmistakable sign: green field, the
  const bw = r * 2.04;
  const bx = -r * 1.02;
  rr(ctx, bx, y - 5, bw, 10, 2, HEADBAND);
  // One line of white script running the length of the band.
  ctx.strokeStyle = '#f7f4ee';
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const s0 = bx + bw * 0.14;
  const s1 = bx + bw * 0.86;
  const sw = s1 - s0;
  const sq = (u: number): number => {
    // A hand-shaped stroke: rising, a head, a tail back to the line.
    if (u < 0.45) return (u / 0.45) * 2.6;
    if (u < 0.62) return 2.6 - Math.sin(((u - 0.45) / 0.17) * Math.PI) * 3.2;
    return (1 - (u - 0.62) / 0.38) * 2.6;
  };
  ctx.moveTo(s0, y);
  for (let i = 1; i <= 14; i += 1) {
    const u = i / 14;
    ctx.lineTo(s0 + u * sw, y - sq(u));
  }
  ctx.stroke();
  for (const dx of [bw * 0.05, bw * 0.095]) {
    ctx.beginPath();
    ctx.moveTo(bx + dx, y - 3);
    ctx.quadraticCurveTo(bx + dx * 0.5, y + 2, bx + dx * 1.35, y + 2.8);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.93, y - 2.8);
  ctx.quadraticCurveTo(bx + bw * 0.97, y, bx + bw * 0.93, y + 2.8);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(bx + 1, y - 5);
  ctx.lineTo(bx + bw - 1, y - 5);
  ctx.moveTo(bx + 1, y + 5);
  ctx.lineTo(bx + bw - 1, y + 5);
  ctx.stroke();
  const kx = -dir * r * 0.98;
  const amp = 0.2 + 0.8 * wind;
  for (let i = 0; i < 2; i += 1) {
    const a = 0.35 + i * 0.5 + amp * 0.7 * Math.sin(time * 1.7 * TAU + seed + i * 2.1) - amp * 0.4;
    const len = i ? 18 : 24;
    for (const [w, col] of [[7, INK], [4, HEADBAND]] as [number, string][]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(kx, y + 2);
      ctx.quadraticCurveTo(kx - dir * len * 0.5, y + 2 + Math.sin(a - 0.5) * len * 0.5 - amp * 6 * Math.sin(time * 2.9 + i), kx - dir * Math.cos(a) * len, y + 2 + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  disc(ctx, kx, y, 5, HEADBAND);
}
const heatSkin = (heat: number): string => (heat < 0.3 ? SKIN : heat < 0.6 ? SKIN_PINK : heat < 0.85 ? SKIN_RED : SKIN_PURPLE);
function drawClipboard(ctx: CanvasRenderingContext2D, h: Joint, strokes: number, pen: boolean): void {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(-0.3);
  rr(ctx, -15, -30, 30, 44, 1, '#d8ccb0');
  ctx.fillStyle = '#3a3d45';
  ctx.fillRect(-7, -34, 14, 7);
  ctx.fillStyle = INK;
  ctx.font = '700 5px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ALIGNMENT', -12, -22);
  ink(ctx, 1);
  for (let i = 0; i < 5; i += 1) {
    ctx.strokeRect(-11, -16 + i * 6, 4, 4);
    seg(ctx, -5, -14 + i * 6, 10, -14 + i * 6);
  }
  ctx.strokeStyle = '#2a4fd6';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (strokes >= 1) {
    ctx.moveTo(-11, -14);
    ctx.lineTo(-9, -12);
    ctx.lineTo(-7, -17);
  }
  if (strokes >= 2) {
    ctx.moveTo(-11, -10);
    ctx.lineTo(-7, -6);
    ctx.moveTo(-7, -10);
    ctx.lineTo(-11, -6);
  }
  if (strokes >= 3) {
    ctx.moveTo(-13, -17);
    ctx.lineTo(12, 10);
    ctx.moveTo(12, -17);
    ctx.lineTo(-13, 10);
  }
  if (strokes >= 4) {
    ctx.moveTo(-12, 11);
    ctx.quadraticCurveTo(-4, 7, 2, 11);
    ctx.quadraticCurveTo(7, 14, 12, 10);
  }
  ctx.stroke();
  if (pen) {
    ctx.strokeStyle = '#1b2a6b';
    ctx.lineWidth = 2.5;
    seg(ctx, 6, -36, 10, -22);
  }
  ctx.restore();
}
function drawFlashlight(ctx: CanvasRenderingContext2D, h: Joint, angle: number, on: boolean): void {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(angle);
  rr(ctx, -10, -4.5, 26, 9, 3, '#3a3d45');
  rr(ctx, 14, -6, 5, 12, 2, on ? '#fff6d8' : '#6a6d78');
  ctx.restore();
}
function gripPose(m: Militia, grip: Grip, c: Crew, base: Pose): Pose {
  const b = BUILDS.heavy;
  const hw = b.shoulder * 0.45;
  const s = c.suspect.sk;
  const hang = J(6, b.upper + b.lower - 8);
  switch (grip) {
    case 'folded':
    case 'gum':
      return H(base, J(hw * 2 - 4, 28), J(-hw * 2 + 4, 34), false, false, 0, 0);
    case 'knuckles':
      return H(base, J(hw + 10, 40), J(hw - 10, 42), false, false, 0, 1);
    case 'gloves':
      return m.gloveT < 1.4 ? H(base, J(hw + 10, 44), J(hw - 8, 46), false, false, 0.5, 0.5) : H(base, hang, hang, false, false, 0, 0);
    case 'roll':
      return { ...H(base, hang, hang, false, false, 0, 0), head: base.head + (m.clipT < 1.2 ? Math.sin((m.clipT / 1.2) * TAU) * 0.45 : 0) };
    case 'fists':
    case 'step':
      return H({ ...base, stance: base.stance + (grip === 'step' ? 10 : 0) }, hang, hang, false, false, 0, 0);
    case 'shoulder':
    case 'threat':
      return H({ ...base, spine: base.spine + 0.08 }, hang, J(s.shoulders[0].x + 4, s.shoulders[0].y - 6), false, true, 0, 1 - Math.floor(clamp(m.gripBeat, 0, 0.449) / 0.15) / 3);
    case 'hood':
      return H({ ...base, spine: base.spine + 0.2 }, hang, J(s.neck.x + 8, s.neck.y - 2), false, true, 0, 0.2);
    default:
      return H({ ...base, spine: base.spine + (grip === 'coil' ? 0.28 : 0.2), pelvisY: base.pelvisY - (grip === 'coil' ? 8 : 4), pelvisX: 10, stance: base.stance + 16 }, J(s.pelvis.x - 10, s.pelvis.y + 12), J(s.pelvis.x + 8, s.pelvis.y + 6), true, true, 0, 0);
  }
}
function solveMilitia(m: Militia, c: Crew, drive: CrewDrive): void {
  const b = BUILDS[m.kind];
  const heat = clamp(m.heat.x, 0, 1);
  const t = drive.time;
  const hw = b.shoulder * 0.45;
  const lead = m.kind === 'lead';
  const th = c.thrown;
  const { x, feetY } = m;
  const mixP = (a: Pose, cc: Pose, w: number) => mixPose(b, x, feetY, 1, a, cc, w);
  const hang = J(6, b.upper + b.lower - 8);
  let p = basePose(b, lead ? mix(30, 52, heat) : 40 + 10 * heat);
  p.pelvisX = drive.reduced ? 0 : lead ? 3 * Math.sin((t * TAU) / 9) : 4 * Math.sin(t * TAU * 0.2);
  p.spine = (lead ? 0.244 : 0.14) * heat;
  p.chest = 0.02 * Math.sin(t * TAU * 0.25);
  p.head = clamp(m.kick.x, -3, 3) * 0.04 + (lead ? 0 : 0.17 * heat);
  if (lead) {
    const fl = m.flashlight;
    const flHand = fl === 'dropped' ? hang : fl === 'side' ? J(8, 56) : fl === 'down' ? J(hw + 44, 24) : mixJ(J(hw + 6, 46), J(hw + 34, -2), raiseFor(m));
    const board = m.clipboard === 'hand';
    p = H(p, board ? J(hw * 0.7, 26) : hang, flHand, false, false, board ? 0 : 0.5, fl === 'dropped' ? 0.5 : 0);
    const jab = clamp(m.jab.x / 0.3, 0, 1);
    if (jab > 0.01 && !th) {
      const reach = drive.overtime >= 0 ? 30 : drive.rung >= 9 ? 70 : drive.rung >= 7 ? 45 : 20;
      const front = drive.rung < 7;
      const jp: Pose = { ...p, spine: p.spine + 0.18, pelvisX: p.pelvisX + 6, world: [false, false], hands: front ? [p.hands[0], J(hw + 30 + reach, 8)] : [J(hw * 2 + 14 + reach, 4), reach >= 70 ? J(hw + 30, -10) : p.hands[1]], open: front ? [p.open[0], 0.3] : [1, p.open[1]] };
      if (!front && reach >= 70) jp.feet = [J(-p.stance / 2 - 10, -22), p.feet[1]];
      p = mixP(p, jp, jab);
    }
    const palm = clamp(m.notYet.x / 0.5, 0, 1);
    if (palm > 0.01 && !th) p = mixP(p, H(p, J(hw + 26, -6), p.hands[1], false, false, 1, p.open[1]), palm);
    if (drive.rung >= 11 && !th && !drive.escaped && c.suspect.mode === 'roof') {
      const fa = midJ(c.heavy.sk.elbows[0], c.heavy.sk.hands[0]);
      p = { ...H(p, J(fa.x - 6, fa.y - 4), p.hands[1], true, false, 1, p.open[1]), pelvisX: p.pelvisX + 45, spine: p.spine + 0.1, feet: [J(p.feet[0].x + 30, 0), J(p.feet[1].x + 52, 0)] };
    }
    const g = clamp(m.gasp.x / 0.45, 0, 1);
    if (g > 0.01) p = mixP(p, { ...H(p, p.hands[0], J(hw * 0.3, 12), false, false, p.open[0], 1), pelvisX: p.pelvisX - 14, spine: p.spine - 0.22, head: p.head - 0.15 }, g);
    if (m.seated > 0) p = mixP(p, { ...p, pelvisY: 58, pelvisX: 2, spine: 0.08, feet: [J(16, 0), J(34, 0)] }, smoothstep(0, 1, m.seated));
    if (m.coin === 'diving') {
      const u = clamp(m.coinT / 0.6, 0, 1);
      p = mixP(p, { ...H(p, p.hands[0], J(hw + 24, 30 - 70 * (1 - u)), false, false, p.open[0], 1), pelvisY: p.pelvisY - 24 * Math.sin(u * Math.PI), spine: p.spine + 0.3 * u }, smoothstep(0, 0.15, m.coinT));
    } else if (m.coin === 'caught') p = H(p, p.hands[0], J(hw * 0.4, 20), false, false, p.open[0], 0);
    else if (m.coin === 'looking') p = { ...H(p, p.hands[0], J(hw * 0.6, 2), false, false, p.open[0], 1), head: p.head + 0.5 };
    if (th) {
      const hp = c.heavy.sk.pelvis;
      if (m.grab > 0) p = mixP(p, { ...H(p, J(hp.x - 16, hp.y - 8), J(hp.x - 10, hp.y + 2), true, true, 0, 0), pelvisX: p.pelvisX + 100, spine: -0.5, head: 0.2, feet: [J(56, 0), J(110, 0)], stance: 60 }, m.grab);
      if (m.lean > 0) p = mixP(p, { ...p, spine: p.spine + 0.55, head: p.head + 0.5 }, m.lean);
    }
  } else {
    const to = gripPose(m, m.grip, c, p);
    p = m.blendT >= 1 ? to : mixP(gripPose(m, m.gripFrom, c, p), to, smoothstep(0, 1, m.blendT));
    p.chest -= 0.02 * heat + (m.grip === 'both' || m.grip === 'coil' ? 0.12 : 0);
    if (m.crackT < 0.6 && !th) {
      const press = Math.sin((m.crackT / 0.6) * Math.PI);
      p = mixP(p, { ...H(p, J(hw + 8 + press * 4, 38), J(hw - 10, 40), false, false, 0, 1), head: p.head - 0.25 * press }, smoothstep(0, 0.12, m.crackT) * smoothstep(0.6, 0.48, m.crackT));
    }
    if (m.coin === 'diving') {
      const kneel = smoothstep(0, 0.3, m.coinT) * (1 - smoothstep(1.8, 2.2, m.coinT)) * (1 - Math.abs(Math.sin((m.coinT / 1.7) * TAU)) * 0.3);
      p = mixP(p, { ...H(p, J(hw + 20, 96), J(hw + 34, 100), false, false, 1, 1), pelvisY: p.pelvisY * 0.45, spine: 0.9, head: 0.3, feet: [J(-34, 0), J(10, 0)] }, kneel);
    } else if (m.coin === 'pocketed' && m.coinT < 0.6) p = H(p, p.hands[0], J(2, 52), false, false, 0, 0);
    if (c.harmless && m.clipboard === 'hand') {
      const wind = clamp((drive.harmlessT - 0.7) / 0.4, 0, 1);
      p = mixP(H(p, p.hands[0], J(hw + 10, 30), false, false, 0, 0), { ...H(p, p.hands[0], J(-hw - 10, -30), false, false, 0, 0), spine: -0.3 }, wind);
    } else if (c.harmless && drive.harmlessT >= 1.1 && drive.harmlessT < 1.9) {
      const u = clamp((drive.harmlessT - 1.1) / 0.4, 0, 1);
      p = mixP(p, { ...H(p, p.hands[0], J(hw + 60, -40 + 60 * u), false, false, 0, 0), spine: 0.5 * u, pelvisX: 12 * u }, smoothstep(1.9, 1.5, drive.harmlessT));
    }
    if (m.shrug > 0) {
      const a = m.shrug < 0.28 ? m.shrug / 0.28 : m.shrug < 0.68 ? 1 : 1 - (m.shrug - 0.68) / 0.32;
      p = mixP(p, { ...H(p, J(-14, b.upper + 10), J(26, b.upper + 10), false, false, 1, 1), chest: p.chest - 0.05 }, 0.2 * a);
    }
    if (th) {
      const T = th.times;
      const ct = drive.crashT;
      const plant = smoothstep(0.02, 0.08, ct);
      const gp: Pose = { ...H(p, J(th.x - 8, th.y - 54), J(th.x + 8, th.y - 48), true, true, 0, 0), pelvisY: p.pelvisY - 10, pelvisX: 4, stance: 50 + 40 * plant, feet: [J(-40 - 25 * plant, 0), J(30, 0)] };
      p = mixP(p, gp, smoothstep(0, th.instant ? 0.08 : 0.12, ct));
      p = mixP(p, { ...gp, spine: -0.44, pelvisX: -6, head: 0.1 }, smoothstep(T.load, T.hitstop, ct));
      if (ct >= T.hitstop) p = mixP(p, { ...gp, spine: 0.62, chest: -0.3, pelvisX: 24, pelvisY: p.pelvisY + 6, head: -0.2 }, smoothstep(T.hitstop, T.release, ct));
      if (m.grab > 0) {
        const wm = clamp((ct - T.follow) / 0.3, 0, 1) * TAU * 2;
        p = mixP(p, { ...H(p, J(hw - 10 + 36 * Math.cos(wm), -30 + 36 * Math.sin(wm)), J(x + 120, 330), false, true, 1, 1), pelvisX: 44, pelvisY: p.pelvisY - 16, spine: 0.95, head: 0.3, feet: [J(4, 0), J(74, -26)], stance: 100 }, m.grab);
      }
      if (m.lean > 0) p = mixP(p, { ...H(p, J(hw - 6, 70), J(700, 362), false, true, 0.5, 1), pelvisX: 36, spine: 0.85, head: 0.45, feet: [J(-4, 0), J(60, 0)] }, m.lean);
    }
  }
  p.pelvisY = Math.max(20, p.pelvisY);
  m.sk = solve(b, x, feetY, 1, p);
  m.open = p.open;
}

export function drawMilitia(ctx: CanvasRenderingContext2D, m: Militia, c: Crew, time: number, reduced: boolean): void {
  const b = BUILDS[m.kind];
  const sk = m.sk;
  const lead = m.kind === 'lead';
  const heat = clamp(m.heat.x, 0, 1);
  const skin = heatSkin(lead ? heat : heat * 0.5);
  const sleeve = lead ? OLIVE : '#101010';
  const handColour = (i: number) => (m.gloves > (i === 1 ? 0 : 1) ? GLOVE : skin);
  const pointAt = (i: 0 | 1) => Math.atan2(sk.hands[i].y - sk.elbows[i].y, sk.hands[i].x - sk.elbows[i].x);
  const jab = clamp(m.jab.x / 0.3, 0, 1);
  const jabbing = lead && jab > 0.3 && !c.thrown;
  ctx.save();
  if (!reduced) ctx.translate((noise(Math.floor(time * 40) + m.seed) - 0.5) * 4 * heat * heat, 0);
  // The far arm first, darkened, with its hand so both sit behind the legs and the torso.
  strokeLimb(ctx, sk.shoulders[0], sk.elbows[0], sk.hands[0], b.limb, lead ? '#060606' : '#0a0a0a');
  drawHand(ctx, sk.hands[0], b.limb * 0.6, m.open[0], handColour(0), jabbing && c.rung >= 7 ? pointAt(0) : undefined);
  // The far leg a shade darker than the near so the stance reads in depth.
  for (const i of [0, 1] as const) {
    strokeLimb(ctx, sk.hips[i], sk.knees[i], sk.feet[i], b.limb + 2, i ? OLIVE : '#0e130e');
    ell(ctx, sk.feet[i].x + 5, sk.feet[i].y - 3, lead ? 13 : 16, 6, i ? '#2a2a30' : '#20242a');
  }
  const [sh0, sh1] = sk.shoulders;
  const [hp0, hp1] = sk.hips;
  poly(ctx, [J(sh0.x - 6, sh0.y - 6), J(sh1.x + 6, sh1.y - 6), J(hp1.x + 6, hp1.y + 6), J(hp0.x - 6, hp0.y + 6)], OLIVE);
  poly(ctx, [J(sh0.x + 2, sh0.y - 2), J(sh1.x - 2, sh1.y - 2), J(hp1.x + 1, hp1.y), J(hp0.x - 1, hp0.y)], VEST, 2);
  // The chest patch: green, the white script
  {
    const cx = (sh0.x + sh1.x) / 2 + 3;
    const cy = (sh0.y + hp0.y) / 2 - 4;
    const pw = 15;
    const ph = 10;
    ctx.fillStyle = HEADBAND;
    ctx.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
    ctx.fillStyle = '#f7f4ee';
    ctx.fillRect(cx - pw / 2, cy - 1.8, pw, 3.6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - pw * 0.22, cy - 1.2);
    ctx.quadraticCurveTo(cx, cy + 2.6, cx + pw * 0.22, cy - 1.3);
    ctx.stroke();
  }
  ctx.strokeStyle = '#1a1a20';
  ctx.lineWidth = 4;
  seg(ctx, hp0.x - 4, hp0.y + 2, hp1.x + 4, hp1.y + 2);
  if (lead) {
    const rx = m.x + RADIO.dx;
    const ry = RADIO.y + sk.pelvis.y - (m.feetY - basePose(b, 30).pelvisY);
    rr(ctx, rx - 5, ry - 8, 10, 16, 1, '#2d3038', 1.5);
    seg(ctx, rx + 3, ry - 8, rx + 3, ry - 18);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(rx - 3, ry - 6, 2, 2);
  }
  ctx.lineCap = 'butt';
  for (const [w, col] of [[(lead ? 1.1 : 2.1) * b.headR + 4, INK], [(lead ? 1.1 : 2.1) * b.headR, skin]] as [number, string][]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    seg(ctx, sk.chest.x, sk.chest.y + 4, sk.neck.x, sk.neck.y - 4);
  }
  drawMilitiaHead(ctx, m, c, time, reduced, skin);
  strokeLimb(ctx, sh1, sk.elbows[1], sk.hands[1], b.limb, sleeve);
  // The near hand last, over the near arm; held objects (the board, the coin, the torch) with it.
  if (m.clipboard === 'hand') drawClipboard(ctx, lead ? J(sk.hands[0].x + 2, sk.hands[0].y - 4) : sk.hands[1], c.lead.strokes, lead && m.pen === 'hand');
  if (m.coin === 'looking' || (m.coin === 'diving' && m.coinT > 2.2)) disc(ctx, sk.hands[1].x, sk.hands[1].y - 2, 5, '#f2c14e', 1.5);
  drawHand(ctx, sk.hands[1], b.limb * 0.6, m.open[1], handColour(1), jabbing && c.rung < 7 ? pointAt(1) : undefined);
  if (lead && m.flashlight !== 'dropped' && m.coin === 'none') {
    const beam = m.flashlight === 'off' ? null : beamFor(c, time);
    drawFlashlight(ctx, sk.hands[1], beam ? Math.atan2(beam.to.y - beam.from.y, beam.to.x - beam.from.x) : pointAt(1), beam !== null);
  }
  ctx.restore();
}
function drawMilitiaHead(ctx: CanvasRenderingContext2D, m: Militia, c: Crew, time: number, reduced: boolean, skin: string): void {
  const lead = m.kind === 'lead';
  const heat = clamp(m.heat.x, 0, 1);
  const r = BUILDS[m.kind].headR;
  const swell = lead ? 1 + 0.12 * heat : 1;
  const jaw = lead ? 0 : Math.sin(time * 1.1 * TAU) * 1.5;
  const ex = -m.face * 0.6 * r;
  ctx.save();
  ctx.translate(m.sk.head.x, m.sk.head.y);
  ctx.scale(swell, swell);
  if (!lead) rr(ctx, -r * 0.9, -r * 0.1 + jaw, r * 1.8, r * 1.05, 7, skin, 2.5);
  disc(ctx, 0, 0, r, skin, 2.5);
  if (!lead) {
    ctx.fillStyle = skin;
    ctx.fillRect(-r * 0.88, -r * 0.1, r * 1.76, r * 0.6);
  }
  ctx.fillStyle = lead ? '#5a4634' : 'rgba(60,46,36,0.75)';
  ctx.beginPath();
  if (lead) {
    ctx.ellipse(-r * 0.85, -r * 0.25, r * 0.3, r * 0.42, 0, 0, TAU);
    ctx.ellipse(r * 0.95, -r * 0.15, r * 0.14, r * 0.3, 0, 0, TAU);
  } else ctx.arc(0, 0, r * 0.98, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  disc(ctx, -r * 0.95, 0, r * 0.2, skin);
  const drop = lead ? 8 * heat : 2;
  const v = lead ? 0.436 * heat : 0.05;
  ink(ctx, lead ? 5 : 6);
  for (const side of [-1, 1]) seg(ctx, ex + side * r * 0.55, -r * 0.5 - Math.sin(v) * r * 0.4, ex + side * r * 0.12, -r * 0.5 + drop / swell);
  const widen = 1 + (lead ? 0.35 : 0.25) * heat;
  for (const side of [-1, 1]) {
    const cx = ex + side * r * 0.33;
    const cy = -r * 0.18;
    const rx = r * 0.19 * widen * (side < 0 ? 1 - 0.3 * Math.abs(m.face) : 1);
    const ry = r * (lead ? 0.19 : 0.17) * widen;
    ell(ctx, cx, cy, rx, ry, '#ffffff', 1.8);
    if (heat > 0.5) {
      ctx.strokeStyle = `rgba(220,40,40,${smoothstep(0.5, 0.9, heat)})`;
      ctx.lineWidth = 0.8;
      for (const a of [0.5, 2.1, 3.8, 5.2]) seg(ctx, cx + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.9, cx + Math.cos(a) * rx * 0.4, cy + Math.sin(a) * ry * 0.4);
    }
    disc(ctx, cx + rx * 0.3, cy + ry * 0.1, Math.max(1.4, r * 0.09 - heat * 1.2), INK, 0);
    if (!lead) {
      const lid = ry * 2 * (0.55 - 0.5 * heat);
      ctx.fillStyle = skin;
      ctx.fillRect(cx - rx - 1, cy - ry - 1, rx * 2 + 2, Math.max(0, lid + 1));
      ink(ctx, 1.8);
      seg(ctx, cx - rx, cy - ry + lid, cx + rx, cy - ry + lid);
    }
  }
  if (lead) {
    ctx.strokeStyle = '#3b3b45';
    ctx.lineWidth = 2;
    const gy = -r * 0.3 + 5 * heat;
    ctx.beginPath();
    ctx.roundRect(ex - r * 0.6, gy, r * 0.5, r * 0.36, 4);
    ctx.roundRect(ex + r * 0.1, gy, r * 0.5, r * 0.36, 4);
    ctx.moveTo(ex - r * 0.1, gy + r * 0.15);
    ctx.lineTo(ex + r * 0.1, gy + r * 0.15);
    ctx.moveTo(ex - r * 0.6, gy + r * 0.12);
    ctx.lineTo(-r * 0.95, gy + r * 0.2);
    ctx.stroke();
  }
  disc(ctx, ex + r * 0.22, r * 0.12, r * 0.15 * (lead ? 1 + 0.35 * smoothstep(0.6, 0.9, heat) : 1), skin);
  const shout = lead ? clamp(m.shoutT / 0.3, 0, 1) : 0;
  const bubble = !lead && c.heavy.gum === 'popped' && m.gumT < 0.6;
  const my = r * 0.48 + jaw;
  ink(ctx, 2.5);
  if (shout > 0.05 || bubble) {
    ell(ctx, ex, my, r * 0.28, shout > 0.05 ? r * 0.2 * shout : r * 0.08, '#5a1a1a', 2.5);
    if (bubble) disc(ctx, ex, my, 12 * Math.sin((m.gumT / 0.6) * Math.PI), 'rgba(255,150,190,0.8)', 1.5);
  } else {
    const frown = lead ? smoothstep(0.3, 0.55, heat) : 0.3;
    ctx.beginPath();
    ctx.moveTo(ex - r * 0.3, my + frown * 3);
    ctx.quadraticCurveTo(ex, my - frown * 7 + 2, ex + r * 0.3, my + frown * 3);
    ctx.stroke();
    if (lead && heat > 0.5) seg(ctx, ex - r * 0.22, my + 6 * heat, ex + r * 0.22, my + 6 * heat);
  }
  if (lead && heat > 0.55) {
    ctx.strokeStyle = `rgba(122,42,74,${smoothstep(0.55, 0.8, heat) * (0.7 + 0.3 * Math.sin(time * 1.6 * TAU))})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.3);
    ctx.lineTo(-r * 0.45, -r * 0.5);
    ctx.lineTo(-r * 0.55, -r * 0.68);
    ctx.moveTo(-r * 0.45, -r * 0.5);
    ctx.lineTo(-r * 0.3, -r * 0.56);
    ctx.stroke();
  }
  const sweatAt = lead ? (m.sweatClock < 1.2 && heat > 0.7 ? m.sweatClock / 1.2 : -1) : heat >= 0.9 ? 0.4 : -1;
  if (sweatAt >= 0) {
    const sy = -r * 0.35 + sweatAt * r * 0.9;
    ctx.fillStyle = '#8fd3ff';
    ink(ctx, 1);
    ctx.beginPath();
    ctx.moveTo(r * 0.7, sy - 5);
    ctx.quadraticCurveTo(r * 0.7 + 3.5, sy, r * 0.7, sy + 3);
    ctx.quadraticCurveTo(r * 0.7 - 3.5, sy, r * 0.7, sy - 5);
    ctx.fill();
    ctx.stroke();
  }
  if (lead && m.steamClock > 0 && m.steamClock % 2 < 1.2) {
    const age = m.steamClock % 2;
    ctx.fillStyle = `rgba(235,235,245,${(1 - age / 1.2) * 0.7})`;
    for (const side of [-1, 1]) disc(ctx, side * r * 0.9 + side * age * 8, -r * 0.55 - age * 22, 4 + age * 6, ctx.fillStyle, 0);
  }
  if (!(lead && m.actClock > 0 && m.actClock < 3)) drawHeadband(ctx, r, 1, 0.2 + 0.8 * heat, time, m.seed);
  if (lead && m.pen === 'ear') {
    ctx.strokeStyle = '#1b2a6b';
    ctx.lineWidth = 2.5;
    seg(ctx, -r * 0.95, -r * 0.3, -r * 1.05, r * 0.1);
  }
  ctx.restore();
}
function slowNoise(time: number, period: number, seed: number): number {
  const k = Math.floor(time / period);
  const u = time / period - k;
  return mix(noise(k + seed), noise(k + 1 + seed), u * u * (3 - 2 * u)) - 0.5;
}
function solveSuspect(c: Crew, drive: CrewDrive): void {
  const s = c.suspect;
  const b = BUILDS.suspect;
  const dir = -1;
  const hw = b.shoulder * 0.45;
  const t = drive.time;
  const th = c.thrown;
  const conf = clamp(s.confidence.x, 0, 1);
  const hang = J(6, b.upper + b.lower - 8);
  s.face = -0.7;
  if (th && s.mode === 'thrown') {
    const T = th.times;
    const ct = drive.crashT;
    let p: Pose = { ...basePose(b, 18), pelvisY: 0, feet: [J(-6, 72), J(10, 70)] };
    s.face = -1;
    if (th.phase === 'grab' || th.phase === 'load') {
      const load = smoothstep(T.load, T.hitstop, ct);
      p = { ...H(p, J(16, 12), J(8, -24), false, false, 0.8, 0), feet: [J(-6 - 16 * load, 72 + 8 * load), J(10 - 16 * load, 70 + 10 * load)], head: -0.2 * load };
    } else if (th.phase === 'heave') {
      const u = smoothstep(T.hitstop, T.release, ct);
      p = { ...H(p, J(30, -10), J(26, -30), false, false, 1, 1), feet: [J(-26 - 10 * u, 60), J(-14 - 16 * u, 68)], spine: -0.2 * u, head: -0.3 };
    } else {
      const wm = th.rot * 1.5 + th.flail;
      const L = b.upper + b.lower - 6;
      const sc = Math.sin(th.rot * 2 + th.flail) * 28;
      p = { ...H(p, J(Math.cos(wm) * L, Math.sin(wm) * L), J(-Math.cos(wm) * L, -Math.sin(wm) * L), false, false, 1, 1), feet: [J(-8 + sc, 68 - Math.abs(sc) * 0.4), J(8 - sc, 66 - Math.abs(sc) * 0.4)], head: -0.25 };
      s.face = th.phase === 'arc' ? -0.2 : -0.7;
    }
    const local = solve(b, 0, 0, dir, p);
    const cs = Math.cos(th.rot);
    const sn = Math.sin(th.rot);
    const w = (j: Joint): Joint => J(th.x + j.x * cs - j.y * sn, th.y + j.x * sn + j.y * cs);
    const pair = (a: [Joint, Joint]): [Joint, Joint] => [w(a[0]), w(a[1])];
    s.sk = { pelvis: w(local.pelvis), chest: w(local.chest), neck: w(local.neck), head: w(local.head), shoulders: pair(local.shoulders), elbows: pair(local.elbows), hands: pair(local.hands), hips: pair(local.hips), knees: pair(local.knees), feet: pair(local.feet) };
    s.open = p.open;
    th.head = s.sk.head;
    return;
  }
  const { x, feetY } = s;
  const mixP = (a: Pose, cc: Pose, w: number) => mixPose(b, x, feetY, dir, a, cc, w);
  let p = basePose(b, 22);
  p.spine = mix(0.14, -0.1, conf);
  p.chest = mix(0.04, -0.06, conf) + 0.015 * Math.sin(t * TAU * 0.25);
  p.head = mix(0.17, -0.14, conf) + (drive.reduced ? 0 : slowNoise(t, 0.5, 5) * 0.07);
  p.pelvisX = (drive.reduced ? 0 : 5 * Math.sin((t * TAU) / 11)) - 3 * (1 - conf);
  if (conf > 0.25 && !drive.reduced && s.mode === 'roof') p.pelvisY += Math.abs(Math.sin(s.bounce)) * 3 * smoothstep(0.25, 0.4, conf);
  const phoneOut = s.phone === 'hand' || s.phone === 'live' || s.phone === 'down';
  const ph: 0 | 1 = s.phone === 'down' ? 0 : 1;
  const fh: 0 | 1 = ph === 1 ? 0 : 1;
  const hands: [Joint, Joint] = [hang, hang];
  const open: [number, number] = [0.5, 0.5];
  if (!phoneOut && conf < 0.3 && s.mode === 'roof') {
    hands[0] = J(hw * 0.9, 40);
    hands[1] = J(hw * 0.6, 42);
    open[0] = open[1] = 0;
  }
  if (phoneOut) {
    hands[ph] = s.phone === 'hand' ? J(hw + 12, 18) : s.phone === 'live' ? J(hw + 26, -16) : J(-26, 34);
    open[ph] = 0.2;
    if (s.phone === 'hand') p.head += 0.2;
  }
  if (s.gestureT < 1.2 && s.gesture === 'guns' && s.mode === 'roof') {
    const env = smoothstep(0, 0.15, s.gestureT) * smoothstep(1.2, 1.0, s.gestureT);
    hands[fh] = mixJ(hands[fh], J(hw + 22, 4), env);
    open[fh] = mix(open[fh], 1, env);
  }
  p = H(p, hands[0], hands[1], false, false, open[0], open[1]);
  const stancePose = (st: Stance): Pose => {
    switch (st) {
      case 'elbows':
        return { ...H(p, J(702, 354), J(708, 350), true, true, 0.5, 0.5), spine: -0.3, pelvisX: -10, feet: [J(-6, 0), J(-12, -2)] };
      case 'foot':
        return { ...H(p, J(688, 398), J(694, 392), true, true, 1, 1), spine: -0.15, pelvisX: -6, feet: [J(x - 700, -72), J(10, 0)] };
      case 'sit':
        return { ...H(p, J(752, 382), J(706, 358), true, true, 0.2, 1), pelvisY: 80, pelvisX: 0, spine: 0.05, feet: [J(x - 752, -2), J(x - 758, -8)], knee: J(-1, -1) };
      case 'cap':
        return { ...H(p, J(-34, 4), J(36, 2), false, false, 1, 1), spine: -0.12, chest: -0.08, head: -0.16, stance: 24, feet: [J(-12, 0), J(12, 0)] };
      case 'heels': {
        const wob = slowNoise(t, 1.4, s.seed);
        return { ...H(p, J(-30, 8), J(32, 6), false, false, 1, 1), spine: -0.1 + 0.25 * wob, pelvisX: -12 + 6 * wob, head: -0.1 - 0.2 * wob, stance: 14, feet: [J(-16, 0), J(-22, 0)] };
      }
      default:
        return p;
    }
  };
  const to = stancePose(s.stance);
  p = s.blendT >= 1 ? to : mixP(stancePose(s.stanceFrom), to, smoothstep(0, 1, s.blendT));
  if (s.stance === 'sit' && s.phone === 'down') p.head += 0.25;
  if (s.shrug > 0) {
    const u = s.shrug;
    const a = (u < 0.28 ? u / 0.28 : u < 0.68 ? 1 : 1 - (u - 0.68) / 0.32) * s.shrugAmp;
    const full = drive.rung >= 8 ? 1 : 0;
    const sp: Pose = { ...H(p, J(-24, b.upper * 0.4), J(26, b.upper * 0.4), false, false, 1, 1), pelvisY: p.pelvisY - 10 * full - (drive.rung >= 11 ? 6 * Math.sin(u * TAU) : 0), head: p.head - 0.35 * full, chest: p.chest - 0.1 };
    if (phoneOut) sp.hands[ph] = ph ? J(hw + 20, -14) : J(-20, 6);
    p = mixP(p, sp, clamp(a, 0, 1));
  }
  const freeTo = (target: Joint, o: number): Pose => H(p, fh ? p.hands[0] : target, fh ? target : p.hands[1], fh ? p.world[0] : false, fh ? false : p.world[1], fh ? p.open[0] : o, fh ? o : p.open[1]);
  const aside = clamp(s.aside.x, 0, 1);
  if (aside > 0.01) {
    s.face = mix(s.face, 0, aside);
    p = mixP(p, freeTo(J(hw * 0.4, 8), 1), aside);
  }
  if (s.holdOn.x > 0.01) p = mixP(p, { ...freeTo(J(hw + 28, -4), 1), head: p.head + 0.3 }, clamp(s.holdOn.x / 0.38, 0, 1));
  if (s.glance > 0) {
    const gw = smoothstep(0, 0.08, s.glance) * smoothstep(0.4, 0.32, s.glance);
    s.face = mix(s.face, 0.75, gw);
    p.head += 0.4 * gw;
  }
  if (s.lift < 0) {
    p.pelvisY -= s.lift;
    p.feet = [J(p.feet[0].x, p.feet[0].y + s.lift * 0.6), J(p.feet[1].x, p.feet[1].y + s.lift * 0.6)];
  }
  if (s.mode === 'escape') {
    const et = s.escapeT;
    if (et < 0.35) {
      const a = mix(0.3 * Math.PI, -0.9 * Math.PI, smoothstep(0, 0.3, et));
      p = H(p, p.hands[0], J(Math.cos(a) * 60, Math.sin(a) * 60), p.world[0], false, p.open[0], et < 0.2 ? 1 : 0);
    }
    if (s.run > 0) {
      const f0 = walkingFoot(s.run, 80, 0.5, 14);
      const f1 = walkingFoot(s.run, 80, 0, 14);
      p = { ...H(p, J(8, -(b.neck + b.headR * 2 + 4)), J(hw + 24, -30), false, false, 0.6, 0.2), spine: 0.28, head: -0.1, pelvisX: 4, pelvisY: p.pelvisY - Math.max(-f0.y, -f1.y) * 0.3, feet: [J(-f0.x, f0.y), J(-f1.x, f1.y)] };
      if (et > 1.15) s.face = 0.8;
    }
  }
  p.pelvisY = Math.max(20, p.pelvisY);
  s.sk = solve(b, x, feetY, dir, p);
  s.open = p.open;
}
function drawPhone(ctx: CanvasRenderingContext2D, s: Suspect, h: Joint, angle: number, time: number): void {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(angle);
  rr(ctx, -6, -11, 12, 22, 2, '#2a2a30', 1.5);
  ctx.fillStyle = s.phone === 'hand' ? '#0d2a16' : '#101018';
  ctx.fillRect(-4.5, -9, 9, 18);
  ctx.strokeStyle = '#7cf67c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 6; i += 1) ctx.lineTo(-4 + i * 1.4, 6 - i * 1.6 - (i % 2) * 2.2);
  ctx.stroke();
  ctx.restore();
  if (s.phone === 'hand') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    disc(ctx, h.x, h.y - 10, 26, 'rgba(124,246,124,0.14)', 0);
    ctx.restore();
    return;
  }
  const px = h.x + 14;
  const py = h.y - 22;
  ctx.save();
  ctx.font = '800 7px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  rr(ctx, px, py - 5, 26, 10, 3, RED, 0);
  if (Math.floor(time * 2) % 2 === 0) disc(ctx, px + 5, py, 2, '#ffffff', 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('LIVE', px + 9, py + 0.5);
  const v = s.viewers;
  ctx.fillStyle = '#e8ecf7';
  ctx.fillText(`${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`} watching`, px + 29, py + 0.5);
  ctx.font = '600 7px system-ui, sans-serif';
  for (let i = 0; i < s.chat.length; i += 1) {
    ctx.fillStyle = i === s.chat.length - 1 ? '#ffffff' : 'rgba(232,236,247,0.75)';
    ctx.fillText(s.chat[i]!, px + 2, py + 14 + (6 - s.chat.length + i) * 9);
  }
  ctx.restore();
}
function drawSuspectFigure(ctx: CanvasRenderingContext2D, s: Suspect, sk: Skeleton, rot: number, time: number, reduced: boolean, flap: Joint | null, collar: [Joint, Joint] | null): void {
  const b = BUILDS.suspect;
  const r = b.headR;
  const pointAt = (i: 0 | 1) => Math.atan2(sk.hands[i].y - sk.elbows[i].y, sk.hands[i].x - sk.elbows[i].x);
  const ph: 0 | 1 = s.phone === 'down' ? 0 : 1;
  const fh: 0 | 1 = ph === 1 ? 0 : 1;
  const pointing = s.mode === 'roof' && s.gesture === 'guns' && s.gestureT < 1.2;
  // The far arm and its hand first, dimmer, behind the legs and the torso.
  strokeLimb(ctx, sk.shoulders[0], sk.elbows[0], sk.hands[0], b.limb, '#d8d5cd');
  drawHand(ctx, sk.hands[0], b.limb * 0.65, s.open[0] * 0.8, SKIN, pointing && fh === 0 ? pointAt(0) : undefined);
  if (fh === 0 && s.mode === 'roof' && s.aside.x > 0.3) disc(ctx, sk.hands[0].x, sk.hands[0].y, 4, SKIN);
  if (ph === 0 && s.phone !== 'pocket' && s.phone !== 'loose') drawPhone(ctx, s, J(sk.hands[0].x - 2, sk.hands[0].y - 8), s.phone === 'down' ? pointAt(0) + Math.PI / 2 : rot + 0.15, time);
  // The far leg a shade darker than the near so the stance reads in depth.
  for (const i of [0, 1] as const) {
    const f = sk.feet[i];
    const k = sk.knees[i];
    strokeLimb(ctx, sk.hips[i], k, midJ(k, f), b.limb + 6, i ? '#8b7d5a' : '#776b4e');
    strokeLimb(ctx, k, midJ(k, f), f, b.limb - 2, i ? SKIN : '#e3bd9a');
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(Math.atan2(f.y - k.y, f.x - k.x) - Math.PI / 2);
    ell(ctx, 0, -6, 6, 4.5, i ? '#f4f4f0' : '#dedcd2', 1.5);
    if (s.crocs[i]) {
      ell(ctx, -4, -1, 12, 5, i ? CROC : '#7fbd49');
      seg(ctx, 6, -5, 9, -1);
    }
    ctx.restore();
  }
  const sh0 = collar ? collar[0] : sk.shoulders[0];
  const sh1 = collar ? collar[1] : sk.shoulders[1];
  const hem0 = J(sk.hips[0].x + 4, sk.hips[0].y + 14);
  const hem1 = J(sk.hips[1].x - 4, sk.hips[1].y + 14);
  const pts = [J(sh0.x + 7, sh0.y - 6), J(sh1.x - 7, sh1.y - 6), hem1];
  if (flap) pts.push(J(hem1.x + flap.x * 0.6, hem1.y + flap.y * 0.6), J(hem0.x + flap.x, hem0.y + flap.y));
  pts.push(hem0);
  poly(ctx, pts, '#f5f2ee');
  // The rainbow tee: six bands clipped to th
  ctx.save();
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  const top = Math.min(sh0.y, sh1.y) - 8;
  const band = Math.max(hem0.y, hem1.y) + 8 - top;
  RAINBOW.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.min(sh0.x, sh1.x) - 20, top + i * (band / RAINBOW.length), Math.abs(sh1.x - sh0.x) + 40, band / RAINBOW.length + 1);
  });
  ctx.restore();
  ink(ctx, 2.5);
  ctx.stroke();
  const neck = sk.neck;
  ctx.lineCap = 'butt';
  for (const [w, col] of [[r * 0.9 + 4, INK], [r * 0.9, SKIN]] as [number, string][]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    seg(ctx, sk.chest.x, sk.chest.y + 4, neck.x, neck.y - 2);
  }
  drawSuspectHead(ctx, s, sk, rot, time, reduced);
  ctx.strokeStyle = '#f4f4f0';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const sx = neck.x + side * 6 + 2;
    ctx.beginPath();
    ctx.moveTo(sx, neck.y + 6);
    ctx.quadraticCurveTo(sx + side * 3 + 4 * Math.sin(time * 3 + side), neck.y + 22, sx + side * 2 + (flap ? flap.x * 0.5 : 6 * Math.sin(time * 2.3)), neck.y + 34 + (flap ? flap.y * 0.5 : 0));
    ctx.stroke();
  }
  strokeLimb(ctx, sk.shoulders[1], sk.elbows[1], sk.hands[1], b.limb, '#f5f2ee');
  // The near hand last, over the near arm, with its props (the phone, the aside knuckle).
  drawHand(ctx, sk.hands[1], b.limb * 0.65, s.open[1], SKIN, pointing && fh === 1 ? pointAt(1) : undefined);
  if (fh === 1 && s.mode === 'roof' && s.aside.x > 0.3) disc(ctx, sk.hands[1].x, sk.hands[1].y, 4, SKIN);
  if (ph === 1 && s.phone !== 'pocket' && s.phone !== 'loose') drawPhone(ctx, s, J(sk.hands[1].x - 2, sk.hands[1].y - 8), s.phone === 'down' ? pointAt(0) + Math.PI / 2 : rot + 0.15, time);
}
function drawSuspectHead(ctx: CanvasRenderingContext2D, s: Suspect, sk: Skeleton, rot: number, time: number, reduced: boolean): void {
  const r = BUILDS.suspect.headR;
  const conf = clamp(s.confidence.x, 0, 1);
  const face = s.face;
  const ex = face * 0.6 * r;
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(rot);
  disc(ctx, 0, 0, r, SKIN, 2.5);
  disc(ctx, r * 0.95, 0, r * 0.18, SKIN);
  // The side-shave: the blue mass sits behind and on the side of the head, the face side shaved clear.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.03, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = BLUE_HAIR;
  // The back mass: a crescent from the crown, around the back, down to the nape.
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.02, -Math.PI * 0.62, Math.PI * 0.34);
  ctx.arc(0, 0, r * 0.52, Math.PI * 0.34, -Math.PI * 0.62, true);
  ctx.closePath();
  ctx.fill();
  // A small forward sweep at the crown, stopping above the brows, over the shave.
  ctx.beginPath();
  ctx.moveTo(r * 0.55, -r * 0.86);
  ctx.quadraticCurveTo(r * 0.05, -r * 1.0, -r * 0.28, -r * 0.62);
  ctx.quadraticCurveTo(r * 0.12, -r * 0.58, r * 0.42, -r * 0.7);
  ctx.closePath();
  ctx.fill();
  // The streak through the crown and down the back of the mass.
  ctx.strokeStyle = BLUE_STREAK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 0.34, -r * 0.92);
  ctx.quadraticCurveTo(r * 0.82, -r * 0.45, r * 0.86, r * 0.18);
  ctx.stroke();
  ctx.restore();
  const shadesOn = s.shades === 'down' || s.shades === 'laser';
  ink(ctx, 3);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(ex + side * r * 0.5, -r * 0.48);
    ctx.quadraticCurveTo(ex + side * r * 0.3, -r * 0.6, ex + side * r * 0.1, -r * 0.5);
    ctx.stroke();
  }
  if (!shadesOn) {
    for (const side of [-1, 1]) {
      const cx = ex + side * r * 0.3;
      const rx = r * 0.17 * (side > 0 ? 1 - 0.35 * Math.abs(face) : 1);
      ell(ctx, cx, -r * 0.18, rx, r * 0.17, '#ffffff', 1.8);
      disc(ctx, cx - rx * 0.35 * (1 + face), -r * 0.16, r * 0.08, INK, 0);
    }
  }
  if (s.shades !== 'flown') {
    const sy = shadesOn ? -r * 0.18 : -r * 0.72;
    if (s.shades === 'laser') disc(ctx, ex, sy, r * 0.75, `rgba(255,60,80,${0.3 + 0.12 * Math.sin(time * 6)})`, 0);
    for (const side of [-1, 1]) rr(ctx, ex + side * r * 0.3 - r * 0.24, sy - r * 0.14, r * 0.48, r * 0.28, 4, s.shades === 'laser' ? RED : '#15161c');
    seg(ctx, ex - r * 0.06, sy, ex + r * 0.06, sy);
  }
  disc(ctx, ex - r * 0.2, r * 0.1, r * 0.14, SKIN);
  const my = r * 0.46;
  const flap = reduced ? 0 : clamp(s.talk, 0, 1) * Math.abs(Math.sin(time * 8 * TAU));
  if (flap > 0.15) ell(ctx, ex - r * 0.05, my, r * 0.2 + 2, 2 + 4 * flap, '#5a1a1a', 2.5);
  else {
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(ex + r * 0.22, my + 2);
    ctx.quadraticCurveTo(ex - r * 0.05, my + 5, ex - r * 0.34, my - 7 * (0.3 + 0.7 * conf));
    ctx.stroke();
  }
  // The septum ring: a bright horseshoe from
  ctx.save();
  ctx.strokeStyle = '#e8ecf7';
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  const nx = ex + r * 0.02;
  const ny = r * 0.24;
  ctx.beginPath();
  ctx.arc(nx, ny + 1.5, 3.4, Math.PI * 0.06, Math.PI * 0.94);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,236,247,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nx + 3.2, ny + 1.5);
  ctx.quadraticCurveTo(nx + 4.6, ny - 0.8, nx + 3.6, ny - 2.4);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

export function drawSuspect(ctx: CanvasRenderingContext2D, c: Crew, time: number, reduced: boolean): void {
  const s = c.suspect;
  if (s.mode === 'gone' || s.mode === 'thrown') return;
  const sq = 1 + 0.18 * clamp(s.squash.x, -0.5, 1);
  ctx.save();
  ctx.translate(s.x, s.feetY);
  ctx.scale(1 / sq, sq);
  ctx.translate(-s.x, -s.feetY);
  drawSuspectFigure(ctx, s, s.sk, 0, time, reduced, null, null);
  ctx.restore();
}

export function drawThrown(ctx: CanvasRenderingContext2D, c: Crew, time: number): void {
  const th = c.thrown;
  if (!th || th.phase === 'gone') return;
  const s = c.suspect;
  const held = th.phase === 'grab' || th.phase === 'load' || th.phase === 'heave';
  ctx.save();
  const speed = Math.hypot(th.vx, th.vy);
  const fl = 10 + Math.min(14, speed * 0.01);
  const flap = !held && speed > 1 ? J((-th.vx / speed) * fl, (-th.vy / speed) * fl) : null;
  const hh = c.heavy.sk.hands;
  drawSuspectFigure(ctx, s, s.sk, th.rot, time, false, flap, held ? [J(hh[0].x, hh[0].y + 4), J(hh[1].x, hh[1].y + 4)] : null);
  ctx.restore();
}