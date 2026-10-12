/**
 * Gays of Hormuz: the SS Sashay, a pride cruise ship, runs the Strait of Hormuz on the shared, committed
 * round. The player steers between mines, missiles, drones and speedboats (or leaves the first mate at the
 * helm); a confirmed cash-out is a Pride Air airlift off the foredeck; the backend's crash sinks the ship.
 * Steering, hits and rescues are presentation only: they never touch the multiplier, a bet or a payout.
 */
import { pageAudio } from './audio';
import { createInput } from './input';
import { mulberry32, settleSpring, spring, stepSpring } from './motion';
import { BEAM, DEPTH_MAX, DEPTH_MIN, DRONE_SHOW, RADIUS, boatX, clamp, createWorld, depthScale, driveAt, stepWorld, strikeProgress, type Hazard, type Helm, type StraitEvent, type World } from './strait';
import {
  C, COAST_PARALLAX, PRIDE, drawBoat, drawCoast, drawDisco, drawDrone, drawFloatie, drawForeground, drawHeli, drawIslands, drawMine,
  drawMissile, drawMountains, drawPerson, drawReticle, drawRipples, drawSea, drawSky, drawTankers, outlined, rainbowText, roundRect, scaleAt,
  screenX, sparkle, text, waterY, type Layout,
} from './art';
import { DANCE_SPOTS, LIFEBOATS, SINK_SECONDS, YOU_SPOT, applyFrame, drawShip, drawWake, sinkPose, toScreen, type ShipFrame } from './ship';
import { BOARDING, CAUSES, CAUSE_LINE, REGRET, SINKING, blockToast, closeToast, hitToast, lineAt, lineIndex, openWater, rescueToast, type Cause } from './script';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** 150 means 1.50×; the crash point once crashed. */
  currentX100: number;
  /** ms since the round started running; held at the crash time. */
  elapsed: number;
  /** ms since the crash. */
  crashAge: number;
  stake: number | null;
  /** Non-null only after the backend confirms this player's cash-out. */
  cashoutX100: number | null;
  payout: number | null;
}
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void; dispose(): void }

const LANDSCAPE: Layout = { width: 960, height: 540, horizon: 196, farY: 300, nearY: 462, shipX: 300, zoom: 1, portrait: false };
const PORTRAIT: Layout = { width: 540, height: 800, horizon: 300, farY: 410, nearY: 668, shipX: 150, zoom: 0.66, portrait: true };
/** The previous voyage's ending may finish while the next round is already taking bets. */
const ENDING_MS = SINK_SECONDS * 1000;
/** The hit-stop and slow motion at the crash: a freeze you can feel, then the first blast at a third speed. */
const FREEZE_S = 0.14;
const SLOW_S = 0.45;
const SLOW_RATE = 0.35;
const RUNGS = [1.5, 2, 3, 5, 10, 25, 100, 1000];
/** The ending's sounds by crash time: the screams are cheers, the lifeboats splash, she glugs under and the disco ball pops up. */
const SINK_CUES: readonly (readonly [number, 'cheer' | 'splash' | 'glug' | 'bubble' | 'ding', number])[] = [
  [0.9, 'cheer', 0.3], [1.15, 'splash', 0.4], [1.65, 'splash', 0.35], [2.9, 'glug', 0.5], [3.6, 'bubble', 0.45], [3.95, 'ding', 0.5],
];
const formatX = (x100: number): string => `${(x100 / 100).toFixed(2)}×`;
const ease = (n: number): number => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const credits = (n: number): string => `${n.toLocaleString('en-US')} ${n === 1 ? 'CREDIT' : 'CREDITS'}`;

/** How far she coasts after the crash, px along the strait, at crash time t. */
const coast = (speed: number, t: number): number => (speed / 2) * (1 - Math.exp(-2 * t));

/** Crash time after the hit-stop and the slow motion, so every ending pose is a pure function of crash age. */
export function sinkClock(age: number): number {
  if (age < FREEZE_S) return 0;
  if (age < FREEZE_S + SLOW_S) return (age - FREEZE_S) * SLOW_RATE;
  return SLOW_S * SLOW_RATE + (age - FREEZE_S - SLOW_S);
}

interface Bank { guests: number }
// A scene the shell recreates after a short hidden-tab gap gets its voyage back.
let live: { world: World; elapsed: number; wall: number; bank: Bank | null } | null = null;
// Taking the helm is the player's choice for the page, so a replaced scene keeps it.
let manual = false;
const replayMode = (): boolean => typeof document !== 'undefined' && document.documentElement.dataset.mode === 'replay';
/** One local draw per voyage lays out a fresh strait; the recorded round always sails the same one. */
const newSeed = (): number => (replayMode() ? 0x5a5a5a : Math.floor(Math.random() * 0x7fffffff));

/** A blast, a splash or a sparkle, drawn from its age alone. `ship` blasts ride the hull; the rest stay on the water. */
interface Blast { kind: 'fire' | 'splash' | 'glitter' | 'column'; ship: boolean; x: number; d: number; h: number; at: number; size: number; seed: number }
/** A line of text that rises off something and fades. */
interface Floater { text: string; x: number; d: number; at: number; color: string }

/** The ending, decided once from the crash point: what hits her, where, and who leaps for which floatie. */
interface Wreck {
  cause: Cause;
  impact: number;
  depth: number;
  distance: number;
  speed: number;
  crowd: number;
  you: boolean;
  jumpers: { spot: number; at: number; dx: number; dd: number; variant: number }[];
  drops: number[];
  seed: number;
}

function wreckFor(x100: number, world: World, crowd: number, you: boolean): Wreck {
  const rand = mulberry32(x100 * 7919 + 17);
  const cause = CAUSES[Math.floor(rand() * CAUSES.length)]!;
  // Mines and rams strike forward and take her bow first; missiles and drones can land aft and take the stern.
  const impact = cause === 'mine' || cause === 'boat' ? 40 + rand() * 90 : (rand() - 0.4) * 230;
  const jumpers = Array.from({ length: crowd }, (_, i) => ({
    spot: crowd - 1 - i, at: 0.55 + i * 0.3 + rand() * 0.15, dx: (rand() - 0.5) * 120,
    dd: (rand() < 0.75 ? 1 : -1) * (0.12 + rand() * 0.22), variant: rand(),
  }));
  const first = Math.floor(rand() * 3);
  return { cause, impact, depth: world.depth, distance: world.distance, speed: world.speed, crowd, you, jumpers, drops: [first, first + 3], seed: Math.floor(rand() * 1e9) };
}

export function createScene(): Scene {
  // Phones have no Space bar: there the frame names the Cash out button instead.
  const touchOnly = typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
  const audio = pageAudio({ style: 'eurodance', bpm: 124, crash: 'boom', music: 0.45, tempoRise: 0.16 });
  const canvas = document.querySelector('canvas')!;
  let layout: Layout = LANDSCAPE;
  const input = createInput(canvas, clientY => {
    const box = canvas.getBoundingClientRect();
    const y = ((clientY - box.top) / Math.max(1, box.height)) * layout.height;
    // The ship follows the finger: the hull's middle, not its waterline, goes under the pointer.
    return clamp((y + 46 * layout.zoom - layout.farY) / (layout.nearY - layout.farY), DEPTH_MIN, DEPTH_MAX);
  });
  let world = createWorld(0, newSeed());
  let previous: SceneView['phase'] | null = null;
  let last = 0;
  let lastElapsed = 0;
  let clock = 0;
  let beat = 0;
  let secured: number | null = null;
  let escapeAt = 0;
  let bank: Bank = { guests: 0 };
  let wreck: Wreck | null = null;
  let line = 0;
  let lineAtMs = -1e9;
  let rung = 0;
  let pulse = 0;
  let toast = '';
  let toastUntil = 0;
  let toastColor: string = C.pink;
  let shake = 0;
  let fadeAt = -1e9;
  let ariaAt = -1;
  let blasts: Blast[] = [];
  let floaters: Floater[] = [];
  let ending: { view: SceneView; startedAt: number } | null = null;
  /** The sinking's sound cues, fired as crash time crosses them while the ending is seen live. */
  let sinkHeard = 0;
  let sinkLive = false;
  const jolt = spring(0);
  const duck = spring(0);
  let duckUntil = 0;

  const say = (message: string, now: number, color: string = C.pink, ms = 1500) => { toast = message; toastUntil = now + ms; toastColor = color; };
  const blast = (b: Omit<Blast, 'at' | 'seed'>) => {
    blasts.push({ ...b, at: clock, seed: Math.floor(clock * 1000) + blasts.length * 7919 });
    if (blasts.length > 24) blasts = blasts.slice(-24);
  };

  function handle(e: StraitEvent, now: number, npc: boolean): void {
    const gain = npc ? 0.5 : 1;
    switch (e.type) {
      case 'launch': audio.fx('whoosh', 0.22 * gain); break;
      case 'arrive': audio.fx(e.kind === 'drone' ? 'buzz' : 'engine', 0.3 * gain); break;
      case 'warn': audio.fx('beep', 0.32 * gain); break;
      case 'hit': {
        const kind = e.kind ?? 'mine';
        blast({ kind: kind === 'mine' ? 'column' : 'fire', ship: true, x: (e.local ?? 0) / depthScale(world.depth), d: world.depth, h: kind === 'drone' ? 84 : kind === 'missile' ? 66 : kind === 'boat' ? 22 : 8, size: 1 });
        audio.fx('boom', 0.75 * gain);
        if (kind === 'mine') audio.fx('splash', 0.5 * gain);
        if (!npc) say(hitToast(kind, e.id, e.lost ?? 0), now, C.red, 1800);
        shake = Math.max(shake, 1);
        jolt.v += (e.local ?? 0) >= 0 ? 1.4 : -1.4;
        duckUntil = clock + 0.9;
        break;
      }
      case 'block':
        blast({ kind: 'glitter', ship: true, x: (e.local ?? 0) / depthScale(world.depth), d: world.depth, h: 60, size: 1.2 });
        audio.fx('zap', 0.5 * gain);
        if (!npc) say(blockToast(e.id), now, C.cyan);
        break;
      case 'miss':
        blast({ kind: 'splash', ship: false, x: e.x, d: e.d, h: 0, size: 1 });
        audio.fx('splash', 0.35 * gain);
        break;
      case 'close':
        if (!npc) say(closeToast(e.id), now, C.lime, 1100);
        audio.fx('whoosh', 0.3 * gain);
        break;
      case 'rescue':
        floaters.push({ text: rescueToast(e.count ?? 1), x: e.x, d: e.d, at: clock, color: C.gold });
        audio.fx('coin', 0.45 * gain);
        if ((e.count ?? 1) > 1) audio.fx('cheer', 0.3 * gain);
        break;
      case 'disco':
        floaters.push({ text: 'DISCO SHIELD!', x: e.x, d: e.d, at: clock, color: C.cyan });
        audio.fx('ding', 0.6 * gain);
        if (!npc) say('DISCO SHIELD ON · HAZARDS BOUNCE OFF', now, C.cyan);
        break;
    }
    if (floaters.length > 10) floaters = floaters.slice(-10);
  }

  function draw(ctx: CanvasRenderingContext2D, incoming: SceneView, now: number): void {
    // A live host may reopen betting before the ship is under: finish the ending while the shell already offers
    // the next round's controls, and say so. Never delay a running round.
    if (incoming.phase === 'crashed') ending = { view: { ...incoming }, startedAt: now - incoming.crashAge };
    else if (incoming.phase === 'running' || replayMode()) ending = null;
    const previousEnding = incoming.phase !== 'crashed' && ending !== null && now - ending.startedAt < ENDING_MS;
    const view = previousEnding && ending ? { ...ending.view, crashAge: Math.max(0, now - ending.startedAt) } : incoming;
    if (!previousEnding && incoming.phase !== 'crashed') ending = null;
    const first = previous === null;
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const idle = !running && !crashed;
    const staked = view.stake !== null;
    const reset = (idle && previous !== null && previous !== 'betting' && previous !== 'waiting') || (running && (previous === 'crashed' || view.elapsed < lastElapsed - 200));
    const real = last ? clamp((now - last) / 1000, 0, 0.1) : 0;
    last = now;
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const t = crashed ? sinkClock(age) : 0;
    // The scene's own clock warps with the crash: it stands still through the hit-stop and crawls through the slow motion.
    const warp = crashed ? (age < FREEZE_S ? 0 : age < FREEZE_S + SLOW_S ? SLOW_RATE : 1) : 1;
    clock += real * warp;
    const mult = Math.max(1, view.currentX100 / 100);
    // 0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×: the window where most rounds live and die carries the escalation.
    const tension = 1 - 1 / mult;
    const drive = driveAt(view.currentX100, view.elapsed);
    const box = canvas.getBoundingClientRect();
    layout = box.width > 0 && box.height > box.width * 1.02 ? PORTRAIT : LANDSCAPE;
    const L = layout;
    const W = L.width;
    const H = L.height;

    if (reset || (first && idle)) {
      world = createWorld(0, newSeed());
      secured = null; escapeAt = 0; wreck = null; live = null; line = 0; lineAtMs = -1e9; rung = 0; pulse = 0;
      toast = ''; blasts = []; floaters = []; shake = 0;
      settleSpring(jolt, 0); settleSpring(duck, 0);
      if (!first) fadeAt = now;
    }
    let resumed: Bank | null = null;
    if (first && (running || crashed)) {
      // The same round, handed over after a short gap: its clock and the wall clock moved on together.
      const same = live !== null && view.elapsed >= live.elapsed && Math.abs(view.elapsed + (crashed ? view.crashAge : 0) - live.elapsed - (Date.now() - live.wall)) < 4000;
      if (same && live) resumed = live.bank;
      if (same && running && live) world = live.world;
      else world = createWorld(view.elapsed, same && live ? live.world.seed : newSeed(), drive);
      // A late arrival joins at the current announcement without replaying old cues.
      line = lineIndex(mult);
      rung = RUNGS.filter(r => mult >= r).length;
    }
    const command = input.take(world.depth);
    manual ||= command.touched;
    // Only the host-confirmed cash-out airlifts the player. A button press alone never does.
    if (view.cashoutX100 !== null && secured === null) {
      secured = view.cashoutX100;
      escapeAt = first || crashed ? now - 4000 : now;
      bank = resumed ?? { guests: world.guests };
      if (!first && running) {
        audio.cashout();
        audio.fx('engine', 0.35);
        say('PRIDE AIR INBOUND · HOLD ON TO YOUR WIG', now, C.lime, 2200);
      }
    }
    const crowdNow = Math.min(DANCE_SPOTS.length, 4 + world.guests);
    if (crashed && previous !== 'crashed') {
      const late = first || view.crashAge > 1500;
      audio.crash('boom', late);
      wreck = wreckFor(view.currentX100, world, crowdNow, staked && secured === null);
      if (!late) shake = 1.6;
      sinkLive = !late;
      sinkHeard = sinkClock(view.crashAge / 1000);
    }
    audio.update(view.phase, tension);

    if (running) {
      const npc = secured !== null;
      // After the airlift the first mate takes the helm back; the voyage carries on without you.
      const helm: Helm = npc ? { steer: 0, target: null, manual: false } : { steer: command.steer, target: command.target, manual };
      // Substeps keep contacts consistent at low frame rates; a hidden gap never fast-forwards collisions.
      let left = real;
      while (left > 1e-6) {
        const step = Math.min(left, 1 / 60);
        for (const e of stepWorld(world, step, helm, drive)) if (!first) handle(e, now, npc);
        left -= step;
      }
      const index = lineIndex(mult);
      if (index > line) { line = index; lineAtMs = now; if (!first) audio.fx('notify', 0.18); }
      const passed = RUNGS.filter(r => mult >= r).length;
      if (passed > rung) { rung = passed; if (!first) audio.milestone(passed); }
      if (staked && !npc && !first) {
        // A heartbeat under the music that quickens with the multiplier while your bet is still aboard.
        pulse += real / mix(1.4, 0.38, tension);
        if (pulse >= 1) { pulse %= 1; audio.fx('heartbeat', 0.1 + 0.25 * tension); }
      }
      live = { world, elapsed: view.elapsed, wall: Date.now(), bank: secured === null ? null : bank };
    }
    if (crashed && wreck) world.distance = wreck.distance + coast(wreck.speed, t);
    if (crashed && sinkLive) {
      for (const [at, cue, strength] of SINK_CUES) if (sinkHeard < at && t >= at) audio.fx(cue, strength);
      sinkHeard = t;
    }
    previous = view.phase;
    lastElapsed = view.elapsed;
    beat += real * warp * (running ? 2 + 0.5 * tension : crashed ? 1 : 1.7);
    stepSpring(jolt, 0, 9, 0.32, real * warp);
    stepSpring(duck, clock < duckUntil ? 1 : 0, 12, 0.6, real * warp);
    shake *= Math.exp(-5 * real);
    blasts = blasts.filter(b => clock - b.at < 3.2);
    floaters = floaters.filter(f => clock - f.at < 1.4);

    // ---- The picture -----------------------------------------------------------------------------------------
    const dusk = clamp(Math.log10(mult) / 1.3, 0, 1);
    const night = clamp((dusk - 0.5) / 0.4, 0, 1);
    const distance = world.distance;
    // The camera follows the ship; through the ending it eases over so the wreck sits mid-picture.
    const pan = crashed && wreck ? ease((t - 0.4) / 2.6) * (W * 0.5 - L.shipX) * 0.75 : 0;
    const camera = distance - pan / L.zoom;
    const scroll = camera * L.zoom;
    const hit = crashed ? view.crashAge / 1000 : 9;
    const punch = 0.08 * ease(hit / 0.05) * (1 - ease((hit - 0.35) / 0.5));
    const quake = shake * 5;
    const depth = wreck && crashed ? wreck.depth : world.depth;
    const s = scaleAt(L, depth);
    const bob = Math.sin(clock * 1.4) * 1.5 + Math.sin(clock * 0.63 + 1) * 1;
    const pose = crashed && wreck ? sinkPose(t, wreck.impact) : null;
    const frame: ShipFrame = {
      x: L.shipX + pan, y: waterY(L, depth) + bob * s, scale: s,
      angle: pose ? pose.angle : Math.sin(clock * 1.1) * 0.008 + jolt.x * 0.03,
      pivot: pose ? pose.pivot : 0, drop: pose ? pose.drop : 0,
    };
    const flood = pose ? pose.flood : 0;

    ctx.save();
    ctx.scale(960 / W, 540 / H);
    ctx.save();
    // Hits and the crash shake the world and punch in on the ship; the HUD stays put.
    const cx = frame.x;
    const cy = waterY(L, depth) - 40 * s;
    ctx.translate(cx + quake * Math.sin(clock * 71 + hit * 90), cy + quake * 0.6 * Math.cos(clock * 57 + hit * 73));
    ctx.scale(1 + punch, 1 + punch);
    ctx.translate(-cx, -cy);
    drawSky(ctx, L, dusk, clock, scroll);
    drawMountains(ctx, L, dusk, scroll);
    // Missile batteries on the coast flash as they fire.
    const launches: { x: number; age: number }[] = [];
    for (const h of world.hazards) {
      if (h.kind !== 'missile' || h.state !== 'live') continue;
      const since = distance - (h.contact - h.lead);
      if (since >= 0 && since < 500) launches.push({ x: launchX(L, h, camera), age: since / Math.max(60, world.speed) });
    }
    drawCoast(ctx, L, dusk, scroll, launches);
    drawSea(ctx, L, dusk, camera, clock);
    drawIslands(ctx, L, dusk, scroll);
    drawTankers(ctx, L, dusk, scroll, clock);
    // The start line: a buoy that says what everyone is thinking.
    const signX = screenX(L, 470, camera);
    if (signX > -200 && signX < W + 200) drawStartSign(ctx, L, signX, clock);

    // Decals on the water: where missiles will land, the drones' shadows.
    for (const h of world.hazards) {
      if (h.state !== 'live' || (crashed && t > 0.3)) continue;
      const u = strikeProgress(h, distance);
      if ((h.kind === 'missile' && u > 0.15) || (h.kind === 'drone' && u > DRONE_SHOW)) {
        const x = screenX(L, h.x, camera);
        if (x < -40 || x > W + 40) continue;
        const danger = Math.abs(h.d - world.depth) < BEAM + RADIUS[h.kind];
        ctx.save();
        ctx.translate(x, waterY(L, h.d));
        if (h.kind === 'missile') drawReticle(ctx, 24 * scaleAt(L, h.d), clamp(u, 0, 1), danger, clock);
        else {
          ctx.fillStyle = 'rgba(10, 20, 40, 0.3)';
          ctx.beginPath();
          ctx.ellipse(0, 0, 18 * scaleAt(L, h.d), 4 * scaleAt(L, h.d), 0, 0, Math.PI * 2);
          ctx.fill();
          if (danger) drawReticle(ctx, 18 * scaleAt(L, h.d), clamp(u, 0, 1), true, clock);
        }
        ctx.restore();
      }
    }

    // Everything floating, depth-sorted around the ship.
    const floating: { d: number; paint: () => void }[] = [];
    for (const h of world.hazards) {
      if (h.kind === 'mine' && (h.state === 'live' || h.state === 'miss')) {
        const x = screenX(L, h.x, camera);
        if (x > -40 && x < W + 40) floating.push({ d: h.d, paint: () => paintAt(ctx, L, x, h.d, () => drawMine(ctx, clock, h.variant, dusk), true, h.variant, clock) });
      }
      if (h.kind === 'boat') {
        const wrecked = h.state === 'hit' || h.state === 'blocked';
        if (wrecked && h.age > 3.2) continue;
        const bx = wrecked ? h.x - h.age * 25 : boatX(h, distance);
        const x = screenX(L, bx, camera);
        if (x > -90 && x < W + 60) floating.push({ d: h.d, paint: () => paintAt(ctx, L, x, h.d, () => drawBoat(ctx, clock, h.variant, 1, wrecked ? ease(h.age / 2.6) : 0), false, h.variant, clock) });
      }
    }
    for (const p of world.pickups) {
      if (p.taken && p.age > 0.6) continue;
      const x = screenX(L, p.x, camera);
      if (x < -40 || x > W + 40) continue;
      floating.push({
        d: p.d, paint: () => {
          const sc = scaleAt(L, p.d);
          const hop = p.taken ? ease(p.age / 0.6) : 0;
          ctx.save();
          ctx.translate(x - hop * 40 * sc, waterY(L, p.d) - hop * 60 * sc - Math.sin(Math.PI * hop) * 30 * sc);
          ctx.scale(sc * (1 - 0.4 * hop), sc * (1 - 0.4 * hop));
          ctx.globalAlpha = 1 - hop;
          if (!p.taken) drawRipples(ctx, clock, p.variant, 14);
          if (p.kind === 'disco') {
            ctx.translate(0, -9 + Math.sin(clock * 2 + p.variant * 9) * 1.5);
            drawDisco(ctx, 9, clock, 1);
          } else drawFloatie(ctx, p.variant, clock, p.count);
          ctx.restore();
        },
      });
    }
    for (const o of world.overboard) {
      const x = screenX(L, o.x - o.age * 6, camera);
      if (x < -40 || x > W + 40) continue;
      floating.push({ d: o.d, paint: () => {
        const sc = scaleAt(L, o.d);
        ctx.save();
        // They splash down, then bob, waving at the ship.
        const fall = 1 - ease(o.age / 0.5);
        ctx.translate(x, waterY(L, o.d) - fall * 40 * sc);
        ctx.scale(sc, sc);
        if (o.age > 0.5) drawRipples(ctx, clock, o.variant, 12, 0.25);
        drawFloatie(ctx, o.variant, clock, 1);
        ctx.restore();
      } });
    }
    if (crashed && wreck) addWreckage(floating, ctx, L, wreck, frame, t, distance, camera, clock);
    floating.sort((a, b) => a.d - b.d);
    let shipDrawn = false;
    const paintShip = () => {
      shipDrawn = true;
      const youAboard = staked && (secured === null ? !(crashed && wreck && t > (wreck.jumpers.length ? wreck.jumpers[wreck.jumpers.length - 1]!.at + 0.3 : 1.5)) : (now - escapeAt) / 1000 < 1.7);
      const jumped = wreck && crashed ? wreck.jumpers.filter(j => t >= j.at).length : 0;
      const look = {
        clock, beat, speed: crashed ? 0 : clamp(world.speed / 320, 0, 1), crowd: crashed && wreck ? wreck.crowd - jumped : crowdNow,
        duck: duck.x, you: youAboard, night, flood, shield: crashed ? 0 : clamp(world.shield / 0.5, 0, 1), scars: world.scars,
      };
      const wy = waterY(L, depth);
      ctx.save();
      ctx.translate(frame.x, wy);
      ctx.scale(s, s);
      drawWake(ctx, crashed ? 0 : clamp(world.speed / 320, 0, 1), clock, 260);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(-50, -50, W + 100, wy + 50 + 1.5 * s);
      ctx.clip();
      applyFrame(ctx, frame);
      drawShip(ctx, look);
      ctx.restore();
      if (pose) {
        // What is under the surface shows through the water, fainter the deeper it goes.
        ctx.save();
        ctx.beginPath();
        ctx.rect(-50, wy + 1.5 * s, W + 100, H);
        ctx.clip();
        ctx.globalAlpha = 0.22 * (1 - ease((t - 3.4) / 1.6));
        applyFrame(ctx, frame);
        drawShip(ctx, { ...look, night: 0, shield: 0 });
        ctx.restore();
        // Foam where she meets the water, dying away as she goes under.
        const foam = clamp(1 - (t - 3.6) / 1.6, 0, 1) * clamp(t / 0.4, 0, 1);
        if (foam > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * foam})`;
          for (let k = 0; k < 9; k++) {
            const u = (k / 8 - 0.5) * 300 * s * (1 - clamp((t - 1.5) / 4, 0, 0.7));
            ctx.beginPath();
            ctx.ellipse(frame.x + frame.pivot * s + u, wy + Math.sin(clock * 6 + k) * 1.5, (10 + 6 * Math.sin(k * 3.1 + clock * 4)) * s, 3 * s, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // Blasts that ride the hull.
      for (const b of blasts) if (b.ship) paintBlast(ctx, L, b, clock, camera, frame);
    };
    for (const item of floating) {
      if (!shipDrawn && item.d > depth) paintShip();
      item.paint();
    }
    if (!shipDrawn) paintShip();
    for (const b of blasts) if (!b.ship) paintBlast(ctx, L, b, clock, camera, frame);

    // Airborne: missiles on their arcs from the coast, drones coming in low.
    for (const h of world.hazards) {
      if (h.state !== 'live' || (crashed && t > 0.3)) continue;
      const u = strikeProgress(h, distance);
      if (h.kind === 'missile' && u > 0 && u < 1) paintMissile(ctx, L, h, u, camera, clock);
      if (h.kind === 'drone' && u > DRONE_SHOW && u < 1) paintDrone(ctx, L, h, u, camera, clock);
    }
    // Arrivals from off the bow get a chevron at the edge of the picture.
    if (running) {
      for (const h of world.hazards) {
        if (h.state !== 'live') continue;
        const x = h.kind === 'boat' ? screenX(L, boatX(h, distance), camera) : h.kind === 'drone' ? screenX(L, h.x + (1 - strikeProgress(h, distance)) * 620, camera) : -1;
        if (x < W + 8 || x > W + 420) continue;
        const y = h.kind === 'boat' ? waterY(L, h.d) - 8 : waterY(L, h.d) - (40 + 160 * (1 - strikeProgress(h, distance)) ** 0.8) * scaleAt(L, h.d);
        paintChevron(ctx, W - 14, clamp(y, L.horizon - 60, H - 30), clock, Math.abs(h.d - world.depth) < BEAM + RADIUS[h.kind]);
      }
    }
    if (crashed && wreck) paintKillingBlow(ctx, L, wreck, frame, t, clock);

    // Rescue tallies and shield notices float up off the water.
    for (const f of floaters) {
      const a = clock - f.at;
      const x = screenX(L, f.x, camera);
      ctx.globalAlpha = 1 - ease((a - 0.9) / 0.5);
      outlined(ctx, f.text, clamp(x, 70, W - 70), waterY(L, f.d) - 40 * scaleAt(L, f.d) - a * 40, L.portrait ? 15 : 14, f.color, 220);
      ctx.globalAlpha = 1;
    }
    // The YOU tag over the player's figure while their bet is aboard.
    if (staked && secured === null && !crashed && !previousEnding) {
      const p = toScreen(frame, YOU_SPOT[0], YOU_SPOT[1] - 22);
      paintTag(ctx, 'YOU', p.x, p.y, C.pink);
    }
    // The Pride Air airlift: in, winch, up and away to a safe hover.
    if (secured !== null) paintAirlift(ctx, L, frame, (now - escapeAt) / 1000, clock, crashed);
    drawForeground(ctx, L, dusk, camera, clock);
    ctx.restore();

    // A fresh voyage fades up from the night instead of cutting from the wreck.
    if (now - fadeAt < 450) {
      ctx.globalAlpha = 1 - ease((now - fadeAt) / 450);
      ctx.fillStyle = C.ink;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // ---- The HUD -------------------------------------------------------------------------------------------------
    paintHud(ctx, L, {
      view, incoming, mult, previousEnding, secured, staked, bank, world, manual, touchOnly, crashed, running, now, line, lineAtMs, toast, toastUntil, toastColor, wreck, t,
    });
    ctx.restore();

    if (Math.floor(now / 1000) !== ariaAt) {
      ariaAt = Math.floor(now / 1000);
      const state = previousEnding ? `Previous voyage ending; the next round is ${incoming.phase}.` : crashed ? `Sunk at ${formatX(view.currentX100)}.` : running ? `Sailing at ${formatX(view.currentX100)}.` : 'Boarding for the next sailing.';
      canvas.setAttribute('aria-label', `Gays of Hormuz. ${state} ${world.guests} guests rescued, ${world.dodged} hazards dodged. ${manual ? 'You have the helm.' : 'The first mate has the helm; press Up or Down, or drag, to take it.'}${secured !== null ? ` Airlifted at ${formatX(secured)}.` : ''}`);
    }
  }

  return { draw, dispose: () => input.dispose() };
}

// ---- Painters ------------------------------------------------------------------------------------------------

/** Where a missile left the coast, on screen: a battery that scrolls with the shore. */
function launchX(L: Layout, h: Hazard, camera: number): number {
  return L.width * (0.8 + 0.17 * h.variant) - (camera - (h.contact - h.lead)) * L.zoom * COAST_PARALLAX;
}

/** Draws a floating thing at its depth, clipped at the waterline with its underwater part showing faintly. */
function paintAt(ctx: CanvasRenderingContext2D, L: Layout, x: number, d: number, paint: () => void, ripples: boolean, variant: number, clock: number): void {
  const y = waterY(L, d);
  const sc = scaleAt(L, d);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  if (ripples) drawRipples(ctx, clock, variant, 18);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-80, -80, 160, 81);
  ctx.clip();
  paint();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-80, 1, 160, 40);
  ctx.clip();
  ctx.globalAlpha = 0.25;
  paint();
  ctx.restore();
  ctx.restore();
}

function paintMissile(ctx: CanvasRenderingContext2D, L: Layout, h: Hazard, u: number, camera: number, clock: number): void {
  // Up off the rail above the battery, then over and down onto the reticle.
  const p0 = { x: launchX(L, h, camera), y: L.horizon - 6 };
  const p2 = { x: screenX(L, h.x, camera), y: waterY(L, h.d) };
  const p1 = { x: p0.x - 40, y: (L.portrait ? L.horizon - 270 : -50) - 30 * h.variant };
  const at = (v: number) => ({ x: (1 - v) * (1 - v) * p0.x + 2 * v * (1 - v) * p1.x + v * v * p2.x, y: (1 - v) * (1 - v) * p0.y + 2 * v * (1 - v) * p1.y + v * v * p2.y });
  // The smoke trail behind it.
  for (let k = 12; k >= 1; k--) {
    const v = u - k * 0.022;
    if (v < 0) continue;
    const p = at(v);
    ctx.globalAlpha = 0.4 * (1 - k / 13);
    ctx.fillStyle = '#e9e6ef';
    ctx.beginPath();
    ctx.arc(p.x, p.y, (2 + k * 0.7) * L.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const p = at(u);
  const dx = 2 * (1 - u) * (p1.x - p0.x) + 2 * u * (p2.x - p1.x);
  const dy = 2 * (1 - u) * (p1.y - p0.y) + 2 * u * (p2.y - p1.y);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.scale(0.9 * L.zoom + 0.2, 0.9 * L.zoom + 0.2);
  drawMissile(ctx, clock);
  ctx.restore();
}

function paintDrone(ctx: CanvasRenderingContext2D, L: Layout, h: Hazard, u: number, camera: number, clock: number): void {
  const sc = scaleAt(L, h.d);
  const x = screenX(L, h.x + (1 - u) * 620, camera);
  const sea = waterY(L, h.d);
  const y = sea - (40 + 160 * (1 - u) ** 0.8) * sc;
  // A dashed drop line to its shadow, so its lane reads at a glance.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 6 * sc);
  ctx.lineTo(x, sea);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(10, 20, 40, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x, sea, 16 * sc, 3.5 * sc, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.25 * (1 - (1 - u) ** 0.5) - 0.05);
  ctx.scale(sc * 1.45, sc * 1.45);
  drawDrone(ctx, clock, h.variant);
  ctx.restore();
}

function paintChevron(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number, danger: boolean): void {
  const pulse = 0.6 + 0.4 * Math.sin(clock * 10);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = danger ? C.red : C.amber;
  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.lineTo(x - 4, y - 9);
  ctx.lineTo(x - 4, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function paintTag(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, color: string): void {
  ctx.font = '900 11px system-ui, sans-serif';
  const w = ctx.measureText(label).width + 12;
  ctx.fillStyle = color;
  roundRect(ctx, x - w / 2, y - 9, w, 16, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 7); ctx.lineTo(x + 4, y + 7); ctx.lineTo(x, y + 11);
  ctx.fill();
  text(ctx, label, x, y - 1, 11, C.ink, 'center', undefined, 900);
}

function drawStartSign(ctx: CanvasRenderingContext2D, L: Layout, x: number, clock: number): void {
  const y = waterY(L, -0.2);
  const sc = scaleAt(L, -0.2) * 1.1;
  ctx.save();
  ctx.translate(x, y + Math.sin(clock * 1.6) * 1.5);
  ctx.scale(sc, sc);
  ctx.fillStyle = '#e3374b';
  ctx.fillRect(-3, -40, 6, 40);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-3, -26, 6, 8);
  ctx.fillStyle = C.ink;
  roundRect(ctx, -98, -92, 196, 54, 6);
  ctx.fill();
  for (let k = 0; k < 6; k++) { ctx.fillStyle = PRIDE[k]!; ctx.fillRect(-94 + k * 31.3, -46, 31.3, 4); }
  text(ctx, 'STRAIT OF HORMUZ', 0, -76, 17, '#ffffff', 'center', 186, 900);
  text(ctx, "(WE'LL BE THE JUDGE OF THAT)", 0, -57, 10.5, C.gold, 'center', 186, 800);
  ctx.restore();
}

/** Blasts, splashes and sparkles as pure functions of age, seeded so a frame always draws the same pieces. */
function paintBlast(ctx: CanvasRenderingContext2D, L: Layout, b: Blast, clock: number, camera: number, frame: ShipFrame): void {
  const age = clock - b.at;
  if (age < 0) return;
  const sc = (b.ship ? frame.scale : scaleAt(L, b.d)) * b.size;
  const origin = b.ship ? toScreen(frame, b.x, -b.h) : { x: screenX(L, b.x, camera), y: waterY(L, b.d) - b.h * sc };
  const rand = mulberry32(b.seed);
  const { x, y } = origin;
  if (b.kind === 'splash' || b.kind === 'column') {
    const tall = b.kind === 'column' ? 120 : 60;
    const rise = Math.sin(Math.PI * clamp(age / (b.kind === 'column' ? 1.1 : 0.8), 0, 1));
    ctx.fillStyle = 'rgba(240, 250, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(x - 10 * sc, y + 2);
    ctx.quadraticCurveTo(x - 6 * sc, y - tall * rise * sc * 0.7, x, y - tall * rise * sc);
    ctx.quadraticCurveTo(x + 6 * sc, y - tall * rise * sc * 0.7, x + 10 * sc, y + 2);
    ctx.fill();
    for (let k = 0; k < 12; k++) {
      const vx = (rand() - 0.5) * 140;
      const vy = 120 + rand() * 160;
      const h = vy * age - 300 * age * age;
      if (h < -4) continue;
      ctx.fillStyle = 'rgba(235, 248, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(x + vx * age * sc, y - h * sc, (1.5 + rand() * 2) * sc, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${clamp(1 - age / 1.4, 0, 1) * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y + 1, (12 + 70 * age) * sc, (3 + 18 * age) * sc, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (b.kind === 'fire' || b.kind === 'column') {
    // Smoke first, behind the fireball.
    for (let k = 0; k < 6; k++) {
      const a = age - 0.08 - k * 0.07;
      if (a < 0 || a > 2.6) continue;
      ctx.globalAlpha = (1 - a / 2.6) * 0.55;
      ctx.fillStyle = '#4a4458';
      ctx.beginPath();
      ctx.arc(x + (k - 2.5) * 7 * sc - a * 16 * sc, y - a * 34 * sc - k * 3 * sc, (6 + a * 16) * sc, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const fire = clamp(1 - age / 0.7, 0, 1);
    if (fire > 0) {
      const r = (10 + 30 * ease(age / 0.22)) * sc;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255, 255, 230, ${fire})`);
      g.addColorStop(0.35, `rgba(255, 210, 80, ${fire})`);
      g.addColorStop(0.7, `rgba(255, 110, 40, ${0.85 * fire})`);
      g.addColorStop(1, 'rgba(200, 40, 40, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let k = 0; k < 8; k++) {
      const vx = (rand() - 0.5) * 220;
      const vy = 90 + rand() * 200;
      if (age > 1.3) continue;
      const h = vy * age - 380 * age * age;
      ctx.fillStyle = k % 3 === 0 ? PRIDE[k % 6]! : '#2b2430';
      ctx.save();
      ctx.translate(x + vx * age * sc, y - h * sc);
      ctx.rotate(age * (8 + k));
      ctx.fillRect(-2 * sc, -1.2 * sc, 4 * sc, 2.4 * sc);
      ctx.restore();
    }
  }
  if (b.kind === 'glitter' || b.kind === 'fire') {
    // Even the shrapnel is fabulous: glitter flutters down.
    const n = b.kind === 'glitter' ? 18 : 8;
    for (let k = 0; k < n; k++) {
      const vx = (rand() - 0.5) * 160;
      const vy = 60 + rand() * 120;
      const a = age;
      if (a > 2.2) continue;
      const h = vy * a - 70 * a * a;
      ctx.globalAlpha = clamp(1 - a / 2.2, 0, 1);
      sparkle(ctx, x + vx * a * sc + Math.sin(a * 6 + k) * 4 * sc, y - h * sc, (2 + rand() * 2.5) * sc, PRIDE[k % 6]!);
    }
    ctx.globalAlpha = 1;
  }
}

/** The killing blow arrives at the crash, over the hit-stop and the slow motion. */
function paintKillingBlow(ctx: CanvasRenderingContext2D, L: Layout, wreck: Wreck, frame: ShipFrame, t: number, clock: number): void {
  const at = toScreen(frame, wreck.impact, wreck.cause === 'drones' ? -84 : wreck.cause === 'missile' ? -62 : -12);
  const strikes = wreck.cause === 'drones' ? [0, 0.12, 0.24] : [0];
  strikes.forEach((delay, k) => {
    const a = t - delay;
    const point = k === 0 ? at : toScreen(frame, wreck.impact + (k === 1 ? -50 : 46), -76);
    if (a < 0) {
      // Still on its way in, from the sky off the bow.
      const u = 1 + a / 0.5;
      if (wreck.cause !== 'drones' || u < 0) return;
      ctx.save();
      ctx.translate(point.x + (1 - u) * 260 * frame.scale, point.y - (1 - u) * 170 * frame.scale);
      ctx.rotate(-0.6);
      ctx.scale(frame.scale, frame.scale);
      drawDrone(ctx, clock, k * 0.3);
      ctx.restore();
      return;
    }
    if (a < 0.02 && wreck.cause === 'missile') {
      ctx.strokeStyle = 'rgba(255, 245, 210, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(point.x + 300 * frame.scale, point.y - 260 * frame.scale);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    // The fireball, the shock ring and a column of sea for a mine.
    const fire = clamp(1 - a / 1.1, 0, 1);
    if (wreck.cause === 'mine') {
      const rise = Math.sin(Math.PI * clamp(a / 1.6, 0, 1));
      ctx.fillStyle = 'rgba(240, 250, 255, 0.9)';
      ctx.beginPath();
      ctx.moveTo(point.x - 34 * frame.scale, point.y + 12 * frame.scale);
      ctx.quadraticCurveTo(point.x - 20 * frame.scale, point.y - 160 * rise * frame.scale, point.x, point.y - 210 * rise * frame.scale);
      ctx.quadraticCurveTo(point.x + 20 * frame.scale, point.y - 160 * rise * frame.scale, point.x + 34 * frame.scale, point.y + 12 * frame.scale);
      ctx.fill();
    }
    if (fire > 0) {
      const r = (16 + 70 * ease(a / 0.3)) * frame.scale;
      const g = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, r);
      g.addColorStop(0, `rgba(255, 255, 235, ${fire})`);
      g.addColorStop(0.3, `rgba(255, 214, 90, ${fire})`);
      g.addColorStop(0.65, `rgba(255, 96, 40, ${0.9 * fire})`);
      g.addColorStop(1, 'rgba(160, 30, 50, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * fire})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, r * 1.6 * ease(a / 0.5), r * 0.5 * ease(a / 0.5), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Smoke climbs off the wound for as long as she floats.
    for (let n = 0; n < 7; n++) {
      const sa = ((clock * 0.5 + n / 7) % 1);
      if (a < 0.3) continue;
      ctx.globalAlpha = (1 - sa) * 0.45 * clamp(1 - (t - 4.2) / 1.2, 0, 1);
      ctx.fillStyle = '#3d3748';
      ctx.beginPath();
      ctx.arc(point.x - sa * 40 * frame.scale, point.y - 20 * frame.scale - sa * 90 * frame.scale, (8 + sa * 22) * frame.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Confetti and glitter: it was that kind of ship.
    const rand = mulberry32(wreck.seed + k * 31);
    for (let n = 0; n < 22; n++) {
      const vx = (rand() - 0.5) * 300;
      const vy = 120 + rand() * 260;
      if (a > 3) break;
      const h = vy * a - 110 * a * a;
      if (h < -60) continue;
      ctx.globalAlpha = clamp(1 - a / 3, 0, 1);
      sparkle(ctx, point.x + vx * a * frame.scale + Math.sin(a * 7 + n) * 5, point.y - h * frame.scale, (2.5 + rand() * 3) * frame.scale, PRIDE[n % 6]!);
    }
    ctx.globalAlpha = 1;
  });
  if (wreck.cause === 'boat' && t < 2.2) {
    // The speedboat that rammed her, wrecked against the near side.
    const p = toScreen(frame, wreck.impact + 30, 0);
    ctx.save();
    ctx.translate(p.x + 20 * frame.scale, p.y + 14 * frame.scale);
    ctx.scale(frame.scale, frame.scale);
    drawBoat(ctx, clock, 0.4, 0, ease(t / 2));
    ctx.restore();
  }
}

/** The leap for the floaties, the lifeboats and, at the last, the disco ball bobbing where she went down. */
function addWreckage(floating: { d: number; paint: () => void }[], ctx: CanvasRenderingContext2D, L: Layout, wreck: Wreck, frame: ShipFrame, t: number, distance: number, camera: number, clock: number): void {
  const base: ShipFrame = { ...frame };
  const poseAt = (at: number): ShipFrame => ({ ...base, ...sinkPose(at, wreck.impact) });
  const hullScale = depthScale(wreck.depth);
  /** Where a point of the hull was along the strait at crash time `at`: she coasts on as she settles. */
  const along = (local: number, at: number): number => wreck.distance + coast(wreck.speed, at) + local * hullScale;
  /** A leap from a deck point at `at` to a spot on the water, then a floatie that drifts and waves. */
  const leap = (from: { x: number; y: number }, landX: number, d: number, at: number, paint: (airborne: boolean) => void, tag?: string) => {
    const u = clamp((t - at) / 0.7, 0, 1);
    floating.push({
      d, paint: () => {
        const sc = scaleAt(L, d);
        const lx = screenX(L, landX + Math.max(0, t - at - 0.7) * 5, camera);
        const ly = waterY(L, d);
        const x = u < 1 ? mix(from.x, lx, u) : lx;
        const y = u < 1 ? mix(from.y, ly, u) - Math.sin(Math.PI * u) * 46 * sc : ly;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(sc, sc);
        if (u < 1) ctx.rotate((u - 0.5) * 1.2);
        paint(u < 1);
        ctx.restore();
        if (tag) paintTag(ctx, tag, x, y - 34 * sc, C.pink);
      },
    });
  };
  wreck.jumpers.forEach((j, i) => {
    if (t < j.at) return;
    const spot = DANCE_SPOTS[j.spot]!;
    const d = clamp(wreck.depth + j.dd, -0.15, 1.15);
    leap(toScreen(poseAt(j.at), spot[0], spot[1]), along(spot[0], j.at) + j.dx + 18, d, j.at, airborne => {
      if (airborne) drawPerson(ctx, { skin: i * 5 + 1, shirt: i * 3 + 2, arms: 1, bob: 0, duck: 0 });
      else { drawRipples(ctx, clock, j.variant, 12, 0.25); drawFloatie(ctx, j.variant, clock, 1); }
    });
  });
  // The player leaps last, onto a flamingo, if their bet went down with her.
  if (wreck.you) {
    const at = (wreck.jumpers.length ? wreck.jumpers[wreck.jumpers.length - 1]!.at : 1.2) + 0.3;
    if (t >= at) {
      leap(toScreen(poseAt(at), YOU_SPOT[0], YOU_SPOT[1]), along(YOU_SPOT[0], at) + 40, clamp(wreck.depth + 0.22, -0.1, 1.15), at, airborne => {
        if (airborne) drawPerson(ctx, { skin: 4, shirt: 6, arms: 1, bob: 0, duck: 0 });
        else drawFloatie(ctx, 0.25, clock, 1);
      }, 'YOU');
    }
  }
  // Two lifeboats drop from their davits and row clear.
  wreck.drops.forEach((k, n) => {
    const at = 1.1 + n * 0.5;
    if (t < at) return;
    const start = toScreen(poseAt(at), LIFEBOATS[k]! + 8, -64);
    const d = clamp(wreck.depth + 0.14 + n * 0.08, -0.1, 1.15);
    const u = clamp((t - at) / 0.55, 0, 1);
    const landX = along(LIFEBOATS[k]! + 8, at);
    floating.push({
      d, paint: () => {
        const sc = scaleAt(L, d);
        const lx = screenX(L, landX + Math.max(0, t - at - 0.55) * 12 * (n ? 1 : -1), camera);
        const ly = waterY(L, d);
        ctx.save();
        ctx.translate(mix(start.x, lx, u), mix(start.y, ly, u * u));
        ctx.scale(sc * 1.4, sc * 1.4);
        ctx.fillStyle = PRIDE[k]!;
        ctx.beginPath();
        ctx.ellipse(0, -2.5, 10, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let p = 0; p < 3; p++) {
          ctx.fillStyle = ['#f1c7a5', '#a86b43', '#d9a27a'][p]!;
          ctx.beginPath();
          ctx.arc(-5 + p * 5, -7 - Math.abs(Math.sin(clock * 4 + p)) * 0.8, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    });
  });
  // Where she went down: bubbles, then the disco ball breaks free and bobs up, still turning.
  const grave = distance + wreck.impact * 0.5 * hullScale;
  if (t > 2.4) {
    floating.push({
      d: wreck.depth - 0.001, paint: () => {
        const x = screenX(L, grave, camera);
        const y = waterY(L, wreck.depth);
        const sc = scaleAt(L, wreck.depth);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 10; k++) {
          const u = (clock * 0.9 + k / 10) % 1;
          ctx.beginPath();
          ctx.arc(x + Math.sin(k * 7.3) * 40 * sc, y - u * 10 * sc, (1.5 + (k % 3)) * sc * (1 - u * 0.5), 0, Math.PI * 2);
          ctx.stroke();
        }
      },
    });
  }
  if (t > 3.7) {
    const rise = ease((t - 3.7) / 0.8);
    const d = clamp(wreck.depth + 0.02, -0.1, 1.1);
    floating.push({
      d, paint: () => {
        const sc = scaleAt(L, d);
        ctx.save();
        ctx.translate(screenX(L, grave, camera), waterY(L, d) + (1 - rise) * 30 * sc);
        ctx.scale(sc, sc);
        drawRipples(ctx, clock, 0.3, 22, 0.4);
        ctx.translate(0, -10 + Math.sin(clock * 1.8) * 2);
        drawDisco(ctx, 13, clock, 1);
        ctx.restore();
      },
    });
  }
}

/** The helicopter's flight: in from the top corner, a hover with the winch, then up to a safe hover off the bow. */
function paintAirlift(ctx: CanvasRenderingContext2D, L: Layout, frame: ShipFrame, since: number, clock: number, crashed: boolean): void {
  const deck = toScreen(frame, YOU_SPOT[0], YOU_SPOT[1]);
  const over = { x: deck.x + 4, y: deck.y - 84 * frame.scale };
  const hold = L.portrait ? { x: 120, y: L.horizon - 70 } : { x: 150, y: 116 };
  const enter = ease(since / 1.1);
  const leave = ease((since - 2.5) / 1.2);
  const from = { x: -90, y: L.portrait ? 150 : 70 };
  const x = mix(mix(from.x, over.x, enter), hold.x, leave);
  const y = mix(mix(from.y, over.y, enter), hold.y, leave) + Math.sin(clock * 2.2) * 2;
  const tilt = since < 1.1 ? 0.18 * (1 - enter) : since > 2.5 && since < 3.7 ? -0.12 * Math.sin(Math.PI * leave) : 0;
  // The winch line and the player going up it.
  const line = ease((since - 1.1) / 0.45) * (1 - ease((since - 2.25) / 0.25));
  const lift = ease((since - 1.65) / 0.6);
  if (line > 0 && since < 2.6) {
    const bottom = mix(deck.y - 12 * frame.scale, y + 18, lift);
    ctx.strokeStyle = '#2a2140';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 18);
    ctx.lineTo(mix(x + 2, deck.x, line * (1 - lift)), mix(y + 18, bottom, line));
    ctx.stroke();
    if (since > 1.65) {
      ctx.save();
      ctx.translate(mix(deck.x, x + 2, lift), bottom + 12 * frame.scale);
      ctx.scale(frame.scale * 1.2, frame.scale * 1.2);
      drawPerson(ctx, { skin: 4, shirt: 6, arms: 1, bob: 0, duck: 0, wave: Math.sin(clock * 10) * 1.5 });
      ctx.restore();
    }
  }
  ctx.save();
  ctx.translate(x, y);
  const big = L.portrait ? 0.95 : 1.15;
  ctx.scale(big, big);
  drawHeli(ctx, clock, tilt);
  ctx.restore();
  if (since > 2.4) paintTag(ctx, crashed ? 'YOU · DRY' : 'YOU · AIRLIFTED', x, y - 26, C.lime);
}

interface HudState {
  view: SceneView; incoming: SceneView; mult: number; previousEnding: boolean; secured: number | null; staked: boolean; bank: Bank;
  world: World; manual: boolean; touchOnly: boolean; crashed: boolean; running: boolean; now: number; line: number; lineAtMs: number;
  toast: string; toastUntil: number; toastColor: string; wreck: Wreck | null; t: number;
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 10, fill: string = C.panel): void {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

/** The strait as a tiny chart: the ship's progress toward open water is 1 − 1/x, so it never quite arrives. */
function paintChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, mult: number, crashed: boolean, clock: number): void {
  panel(ctx, x, y, w, h, 8, 'rgba(10, 42, 68, 0.9)');
  ctx.save();
  roundRect(ctx, x, y, w, h, 8);
  ctx.clip();
  // Iran along the top, the Musandam peninsula hooking up from the bottom.
  ctx.fillStyle = '#c9b48c';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h * 0.28);
  ctx.quadraticCurveTo(x + w * 0.45, y + h * 0.18, x + w * 0.6, y + h * 0.36);
  ctx.quadraticCurveTo(x + w * 0.75, y + h * 0.5, x + w, y + h * 0.32);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b8a07a';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.38, y + h);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.55, x + w * 0.55, y + h * 0.62);
  ctx.quadraticCurveTo(x + w * 0.62, y + h * 0.75, x + w * 0.7, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // The route, and the ship on it.
  const route = (u: number) => ({
    x: x + 8 + u * (w - 16),
    y: y + h * (0.62 - 0.22 * Math.sin(Math.PI * clamp((u - 0.3) / 0.55, 0, 1))),
  });
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k <= 30; k++) { const p = route(k / 30); if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  ctx.stroke();
  ctx.setLineDash([]);
  const p = route(clamp(1 - 1 / mult, 0, 0.995));
  ctx.fillStyle = crashed ? C.red : C.pink;
  ctx.beginPath();
  ctx.arc(p.x, p.y, crashed ? 4 + Math.sin(clock * 8) : 3.5, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'IRAN', x + w * 0.3, y + 7, 8, '#4a3a28', 'center', 60, 900);
  text(ctx, 'OMAN', x + w * 0.54, y + h - 6, 8, '#4a3a28', 'center', 60, 900);
  text(ctx, 'OPEN WATER →', x + w - 4, y + h - 6, 8, '#bfe9ff', 'right', 80, 800);
}

function paintHud(ctx: CanvasRenderingContext2D, L: Layout, hud: HudState): void {
  const { view, mult, crashed, running, secured, staked, now } = hud;
  const W = L.width;
  const H = L.height;
  const portrait = L.portrait;
  const topH = portrait ? 112 : 56;
  const bar = ctx.createLinearGradient(0, 0, 0, topH);
  bar.addColorStop(0, 'rgba(20, 15, 46, 0.92)');
  bar.addColorStop(1, 'rgba(20, 15, 46, 0.78)');
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, W, topH);
  for (let k = 0; k < 6; k++) { ctx.fillStyle = PRIDE[k]!; ctx.fillRect((k * W) / 6, topH, W / 6 + 1, 3); }
  /** The multiplier at the biggest size that fits `max` px. */
  const figureAt = (x: number, y: number, size: number, max: number, color: string) => {
    const label = formatX(view.currentX100);
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    const fit = Math.min(size, size * max / Math.max(1, ctx.measureText(label).width));
    text(ctx, label, x, y, fit, color, 'right', max, 900);
  };
  const status = hud.previousEnding ? 'PREVIOUS VOYAGE' : secured !== null ? (crashed ? 'SUNK · YOU GOT OUT' : 'AIRLIFTED') : crashed ? 'SUNK' : running ? 'SAILING' : 'BOARDING';
  const figure = crashed ? C.red : secured !== null ? C.lime : '#ffffff';
  if (portrait) {
    rainbowText(ctx, 'GAYS OF HORMUZ', 14, 25, 25);
    text(ctx, 'SS SASHAY · OUTBOUND', 16, 50, 11, C.muted, 'left', 250, 800);
    figureAt(W - 14, 27, 34, 200, figure);
    text(ctx, `${status} · ${openWater(mult)}`, W - 14, 53, 11, C.muted, 'right', 250, 800);
    paintChart(ctx, 14, 64, 268, 40, mult, crashed, now / 1000);
    stats(ctx, 294, 66, W - 308, hud);
  } else {
    rainbowText(ctx, 'GAYS OF HORMUZ', 16, 22, 25);
    text(ctx, 'SS SASHAY · OUTBOUND THROUGH THE STRAIT', 18, 44, 10, C.muted, 'left', 290, 800);
    paintChart(ctx, 318, 7, 250, 42, mult, crashed, now / 1000);
    stats(ctx, 582, 10, 150, hud);
    panel(ctx, 744, 6, 206, 44, 10, 'rgba(255, 255, 255, 0.08)');
    figureAt(940, 27, 33, 124, figure);
    text(ctx, status, 754, 20, 9, C.muted, 'left', 62, 900);
    text(ctx, openWater(mult), 754, 36, 9, C.cyan, 'left', 62, 800);
  }
  const cashKey = running && staked && secured === null && !hud.previousEnding;
  if (cashKey) {
    const label = hud.touchOnly ? 'TAP CASH OUT = PRIDE AIR AIRLIFT' : 'SPACE = CASH OUT · PRIDE AIR AIRLIFT';
    const w = portrait ? 330 : 300;
    const x = portrait ? (W - w) / 2 : W - w - 10;
    const y = topH + 10;
    panel(ctx, x, y, w, 24, 12, C.lime);
    text(ctx, label, x + w / 2, y + 12.5, 12, C.ink, 'center', w - 16, 900);
  }

  // A toast for what the strait just did.
  if (hud.toast && now < hud.toastUntil && !crashed && (secured === null || now < hud.toastUntil - 900)) {
    const fade = clamp((hud.toastUntil - now) / 250, 0, 1);
    ctx.globalAlpha = fade;
    ctx.font = '900 15px system-ui, sans-serif';
    const w = Math.min(W - 40, ctx.measureText(hud.toast).width + 34);
    const y = topH + (cashKey ? (portrait ? 54 : 50) : 24);
    panel(ctx, (W - w) / 2, y - 14, w, 28, 14, 'rgba(20, 15, 46, 0.88)');
    text(ctx, hud.toast, W / 2, y, 15, hud.toastColor, 'center', w - 20, 900);
    ctx.globalAlpha = 1;
  }

  // Boarding: the ship waits at the start line for the next sailing.
  if (!running && !crashed) {
    const w = Math.min(W - 20, 560);
    const x = (W - w) / 2;
    const y = portrait ? 150 : 76;
    panel(ctx, x, y, w, 70, 14);
    const head = view.phase === 'betting' ? (staked ? "YOU'RE ON THE GUEST LIST · SAILING SOON" : 'ALL ABOARD THE SS SASHAY') : 'NEXT SAILING BOARDING SHORTLY';
    text(ctx, head, W / 2, y + 22, portrait ? 18 : 20, '#ffffff', 'center', w - 30, 900);
    text(ctx, hud.touchOnly ? 'DRAG OR HOLD PORT / STARBOARD TO STEER · CASH OUT = AIRLIFT' : '↑ ↓ OR DRAG TO STEER · DODGE THE STRAIT · CASH OUT = AIRLIFT', W / 2, y + 48, portrait ? 11 : 12, C.gold, 'center', w - 30, 800);
  }

  // The crash card: what sank her, and where that leaves you.
  if (crashed && hud.wreck) {
    const t = hud.t;
    const show = ease((view.crashAge / 1000 - 0.3) / 0.25);
    if (show > 0) {
      const y = (portrait ? 200 : 118) + (hud.previousEnding && hud.incoming.phase === 'betting' ? 24 : 0);
      const pop = 1 + 0.25 * (1 - ease((view.crashAge / 1000 - 0.3) / 0.35));
      ctx.save();
      ctx.globalAlpha = show;
      ctx.translate(W / 2, y);
      ctx.scale(pop, pop);
      ctx.font = `italic 900 ${portrait ? 46 : 54}px system-ui, sans-serif`;
      const titleW = ctx.measureText('SASHAY AWAY').width;
      rainbowText(ctx, 'SASHAY AWAY', -titleW / 2, 0, portrait ? 46 : 54);
      ctx.restore();
      ctx.globalAlpha = show;
      const w = Math.min(W - 20, 620);
      panel(ctx, (W - w) / 2, y + 32, w, 52, 12);
      text(ctx, `SUNK AT ${formatX(view.currentX100)} · ${CAUSE_LINE[hud.wreck.cause]}`, W / 2, y + 48, portrait ? 13 : 15, '#ffffff', 'center', w - 24, 900);
      const sub = secured !== null ? `YOU WERE AIRLIFTED AT ${formatX(secured)}. DRY AND FABULOUS.`
        : staked ? `YOUR ${credits(view.stake ?? 0)} WENT DOWN WITH THE SHIP.` : 'YOU WATCHED FROM THE DOCK. NO CREDITS GOT WET.';
      text(ctx, sub, W / 2, y + 69, portrait ? 11 : 12, secured !== null ? C.lime : staked ? C.pink : C.muted, 'center', w - 24, 800);
      if (t > 3.6) {
        ctx.globalAlpha = show * ease((t - 3.6) / 0.5);
        text(ctx, 'EVERYONE MADE IT TO A FLOATIE. THE DISCO BALL FLOATS.', W / 2, portrait ? H - 112 : H - 52, portrait ? 12 : 13, C.gold, 'center', W - 40, 900);
      }
      ctx.globalAlpha = 1;
    }
  }
  if (hud.previousEnding && hud.incoming.phase === 'betting') {
    const w = Math.min(W - 40, 420);
    panel(ctx, (W - w) / 2, topH + 8, w, 26, 13, C.lime);
    text(ctx, 'NEXT SAILING BOARDING NOW', W / 2, topH + 21.5, 14, C.ink, 'center', w - 20, 900);
  }

  // After the airlift: the voyage goes on without you, and the frame keeps backing your exit.
  if (secured !== null && running) {
    const ratio = view.currentX100 / secured;
    const w = Math.min(W - 20, 520);
    const y = topH + 10;
    panel(ctx, (W - w) / 2, y, w, 40, 12, 'rgba(20, 15, 46, 0.86)');
    text(ctx, `AIRLIFTED AT ${formatX(secured)} · SS SASHAY NOW AT ${formatX(view.currentX100)}`, W / 2, y + 13, 13, C.lime, 'center', w - 20, 900);
    text(ctx, REGRET.find(([at]) => ratio >= at)![1], W / 2, y + 29, 11, '#ffffff', 'center', w - 20, 800);
  }

  // The public address: the latest announcement at the foot of the picture.
  const announce = crashed && hud.wreck ? SINKING[hud.wreck.cause] : running ? lineAt(hud.line) : BOARDING;
  const capH = portrait ? 58 : 34;
  const capY = H - capH;
  ctx.fillStyle = 'rgba(20, 15, 46, 0.88)';
  ctx.fillRect(0, capY, W, capH);
  const fresh = 1 - ease((now - hud.lineAtMs) / 400);
  if (fresh > 0) { ctx.fillStyle = `rgba(255, 79, 163, ${0.25 * fresh})`; ctx.fillRect(0, capY, W, capH); }
  paintHorn(ctx, 16, capY + (portrait ? 20 : capH / 2));
  const helm = secured !== null ? 'FIRST MATE AT THE HELM' : hud.manual ? 'YOU HAVE THE HELM' : 'FIRST MATE AT THE HELM · STEER TO TAKE OVER';
  if (portrait) {
    text(ctx, `${announce.who}:`, 34, capY + 14, 11, C.pink, 'left', W - 50, 900);
    text(ctx, announce.text, 34, capY + 30, 13, '#ffffff', 'left', W - 46, 700);
    text(ctx, helm, 34, capY + 47, 10, C.cyan, 'left', W - 46, 800);
  } else {
    ctx.font = '900 12px system-ui, sans-serif';
    const who = `${announce.who}:`;
    const ww = ctx.measureText(who).width;
    text(ctx, who, 34, capY + capH / 2, 12, C.pink, 'left', 200, 900);
    text(ctx, announce.text, 40 + Math.min(200, ww), capY + capH / 2, 13, '#ffffff', 'left', 600 - Math.min(200, ww), 700);
    text(ctx, helm, W - 14, capY + capH / 2, 10, C.cyan, 'right', 280, 800);
  }
}

function stats(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hud: HudState): void {
  const { world, secured, bank, staked } = hud;
  const wide = w > 200;
  const rows: [string, string][] = [
    ['GUESTS', String(secured !== null ? bank.guests : world.guests).padStart(2, '0')],
    ['DODGED', String(world.dodged).padStart(2, '0')],
  ];
  const rowY = (i: number) => y + (wide ? 9 + i * 19 : 8 + i * 16);
  rows.forEach(([label, value], i) => {
    text(ctx, label, x, rowY(i), wide ? 11 : 10, C.muted, 'left', 70, 900);
    text(ctx, value, x + (wide ? 96 : 76), rowY(i), wide ? 15 : 13, '#ffffff', 'right', 60, 900);
  });
  const where = staked && secured === null ? 'ABOARD' : secured !== null ? 'SAFE' : 'ON THE DOCK';
  const color = secured !== null ? C.lime : staked ? C.pink : C.muted;
  const col = x + (wide ? 116 : 96);
  text(ctx, where, col, rowY(0), wide ? 11 : 9, color, 'left', wide ? w - 116 : 56, 900);
  text(ctx, hud.manual && secured === null ? 'HELM: YOU' : 'HELM: MATE', col, rowY(1), wide ? 11 : 9, C.cyan, 'left', wide ? w - 116 : 56, 900);
}

function paintHorn(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 3);
  ctx.lineTo(x + 2, y - 7);
  ctx.lineTo(x + 2, y + 7);
  ctx.lineTo(x - 6, y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 9, y - 3, 3, 6);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x + 4, y, 5, -0.7, 0.7);
  ctx.stroke();
}

