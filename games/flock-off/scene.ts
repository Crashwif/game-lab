/**
 * Flock Off: a man in all black rides a BMX through Flockville on the shared, committed round, shooting
 * the Flock cameras as they pass. The game rides the bike; the player aims the gun (or leaves it to the
 * aimbot's free trial). A confirmed cash-out is a Kia that pulls alongside for a body-double swap; the
 * backend's crash is the moment the police get him. Aiming, hits, reads and streaks are presentation
 * only: they never touch the multiplier, a bet or a payout.
 */
import { pageAudio } from './audio';
import { createInput } from './input';
import { clamp, mix, settleSpring, spring, stepSpring } from './motion';
import { createPortrait } from './portrait';
import { pageSound } from './sound';
import { GROUND, HOP_HEIGHT, MAG, RIDER_X, SEG, camScreen, createWorld, driveAt, hopAt, lotFor, stepWorld, targetAt, type CityEvent, type Trigger, type World } from './city';
import { C, blend, drawCam, drawHole, drawLot, drawReticle, drawRoad, drawSky, drawSkyline, drawTracer, outlined, roundRect, text } from './art';
import { INK, createRider, drawCrank, drawFrame, drawRider, drawShadow, drawWheels, recoilRider, riderPose, settleRider, stepRider, type Frame, type RiderRig } from './rider';
import {
  BUST_SECONDS, FREEZE_S, SLOW_RATE, SLOW_S, bustClock, bustFor, coast, createPursuit, drawBust, drawGetaway, drawPursuitBack, drawPursuitFront,
  heatLabel, leadGap, resetPursuit, settlePursuit, stepPursuit, type Bust, type Pursuit,
} from './cops';
import { BUSTED, CAUSE_LINE, REGRET, charges, feedPost, hitToast, lineAt, lineIndex, missToast, readToast, streakLabel } from './script';

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

/** The previous ride's bust may finish while the next round is already taking bets. */
const ENDING_MS = BUST_SECONDS * 1000;
const RUNGS = [1.5, 2, 3, 5, 10, 25, 100, 1000];
/** The bust's sounds by crash time: the hit, the groan, the sirens pulling up, the pile, the mugshot flash. */
const BUST_CUES: readonly (readonly [number, 'thud' | 'gasp' | 'siren' | 'stomp' | 'camera' | 'notify', number])[] = [
  [0.02, 'thud', 0.9], [0.5, 'gasp', 0.5], [1.3, 'siren', 0.35], [2.3, 'stomp', 0.6], [2.7, 'camera', 0.7], [3.3, 'notify', 0.4],
];
const formatX = (x100: number): string => `${(x100 / 100).toFixed(2)}×`;
const ease = (n: number): number => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const credits = (n: number): string => `${n.toLocaleString('en-US')} ${n === 1 ? 'CREDIT' : 'CREDITS'}`;

interface Bank { deflocked: number }
// A scene the shell recreates after a short hidden-tab gap gets its ride back.
let live: { world: World; elapsed: number; wall: number; bank: Bank | null } | null = null;
// Taking the gun is the player's choice for the page, so a replaced scene keeps it.
let manual = false;
const replayMode = (): boolean => typeof document !== 'undefined' && document.documentElement.dataset.mode === 'replay';
/** One local draw per ride lays out a fresh city; the recorded round always rides the same one. */
const newSeed = (): number => (replayMode() ? 0x5a5a5a : Math.floor(Math.random() * 0x7fffffff));

interface Tracer { from: { x: number; y: number }; to: { x: number; y: number }; at: number }
interface Floater { text: string; x: number; y: number; at: number; color: string }

export function createScene(): Scene {
  // Phones have no Space bar: there the picture names the Cash out button instead.
  const touchOnly = typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
  const audio = pageAudio({ style: 'phonk', bpm: 132, crash: 'siren', music: 0.5, tempoRise: 0.2 });
  const sound = pageSound(audio);
  const { capture, present } = createPortrait('FLOCK OFF', [110, 140, 620, 320], C.lime, 'IN THE KIA', 'NO FACE · NO CASE');
  const canvas = document.querySelector('canvas')!;
  const input = createInput(canvas, (clientX, clientY) => {
    const box = canvas.getBoundingClientRect();
    return { x: ((clientX - box.left) / Math.max(1, box.width)) * 960, y: ((clientY - box.top) / Math.max(1, box.height)) * 540 };
  });
  let world = createWorld(0, newSeed());
  const rig: RiderRig = createRider();
  const pursuit: Pursuit = createPursuit();
  let previous: SceneView['phase'] | null = null;
  let last = 0;
  let lastElapsed = 0;
  let clock = 0;
  let secured: number | null = null;
  let escapeAt = 0;
  let bank: Bank = { deflocked: 0 };
  let bust: Bust | null = null;
  let line = 0;
  let lineAtMs = -1e9;
  let rung = 0;
  let pulse = 0;
  let toast = '';
  let toastUntil = 0;
  let toastColor: string = C.lime;
  let shake = 0;
  let fadeAt = -1e9;
  let ariaAt = -1;
  let tracers: Tracer[] = [];
  let floaters: Floater[] = [];
  let ending: { view: SceneView; startedAt: number } | null = null;
  let bustHeard = 0;
  let bustLive = false;
  let flashAt = -1e9;
  let sirenAt = -1e9;
  let feedAt = 0;
  let feed = 0;
  let misses = 0;
  let muzzle = { x: RIDER_X + 30, y: GROUND - 110 };
  let heat = 'NOBODY YET';
  let heatAt = -1e9;
  const punch = spring(0);

  const say = (message: string, now: number, color: string = C.lime, ms = 1400) => { toast = message; toastUntil = now + ms; toastColor = color; };
  const float = (f: Omit<Floater, 'at'>) => { floaters.push({ ...f, at: clock }); if (floaters.length > 12) floaters = floaters.slice(-12); };

  function handle(e: CityEvent, now: number, npc: boolean): void {
    const gain = npc ? 0.55 : 1;
    switch (e.type) {
      case 'shot':
        tracers.push({ from: { x: e.x, y: e.y }, to: { ...world.aim }, at: clock });
        if (tracers.length > 6) tracers = tracers.slice(-6);
        flashAt = clock;
        recoilRider(rig);
        audio.fx('punch', 0.9 * gain);
        audio.fx('click', 0.5 * gain);
        shake = Math.max(shake, 0.25);
        break;
      case 'hit':
        if (e.killed) {
          float({ text: hitToast(e.kind ?? 'pole', e.id), x: e.x, y: e.y - 20, color: C.lime });
          audio.fx('shatter', 0.6 * gain);
          audio.fx('zap', 0.35 * gain);
          misses = 0;
          if (e.close && !npc) say('LAST SECOND. THE CAMERA SAW NOTHING.', now, C.gold);
          const label = streakLabel(world.streak);
          if (!npc && label && [3, 5, 8, 12].includes(world.streak)) {
            say(`STREAK ${label}`, now, C.pink, 1600);
            if (world.streak >= 5) audio.fx('airhorn', 0.4);
          }
        } else {
          float({ text: 'ONE DOWN', x: e.x, y: e.y - 20, color: C.amber });
          audio.fx('clang', 0.5 * gain);
        }
        break;
      case 'bird':
        float({ text: hitToast('bird', e.id), x: e.x, y: e.y - 20, color: C.amber });
        audio.fx('squeak', 0.5 * gain);
        audio.fx('zap', 0.4 * gain);
        break;
      case 'miss':
        misses++;
        if (!npc && misses % 3 === 0) say(missToast(e.id), now, C.amber, 1100);
        audio.fx('tick', 0.3 * gain);
        break;
      case 'read':
        if (!npc) say(readToast(e.id), now, C.red, 1500);
        float({ text: 'SEEN', x: e.x, y: e.y - 24, color: C.red });
        audio.fx('camera', 0.55 * gain);
        break;
      case 'reload':
        if (!npc) say('RELOADING (TACTICALLY)', now, C.cyan, 800);
        audio.fx('ratchet', 0.5 * gain);
        break;
      case 'empty':
        audio.fx('click', 0.6 * gain);
        break;
    }
  }

  function draw(ctx: CanvasRenderingContext2D, incoming: SceneView, now: number): void {
    // A live host may reopen betting before the cops are done: finish the bust while the shell already offers the
    // next round's controls, and say so. Never delay a running round.
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
    const t = crashed ? bustClock(age) : 0;
    // The scene's own clock warps with the crash: it stands still through the hit-stop and crawls through the slow motion.
    const warp = crashed ? (age < FREEZE_S ? 0 : age < FREEZE_S + SLOW_S ? SLOW_RATE : 1) : 1;
    clock += real * warp;
    const mult = Math.max(1, view.currentX100 / 100);
    // 0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×: the window where most rounds live and die carries the escalation.
    const tension = 1 - 1 / mult;
    const drive = driveAt(view.currentX100, view.elapsed);

    if (reset || (first && idle)) {
      world = createWorld(0, newSeed());
      secured = null; escapeAt = 0; bust = null; live = null; line = 0; lineAtMs = -1e9; rung = 0; pulse = 0;
      toast = ''; tracers = []; floaters = []; shake = 0; misses = 0; feed = 0; feedAt = now; heat = 'NOBODY YET'; heatAt = -1e9;
      resetPursuit(pursuit);
      settleRider(rig, { distance: 0, speed: 0, hop: 0, hopU: 0, aim: null });
      settleSpring(punch, 0);
      sound.cut();
      if (!first) fadeAt = now;
    }
    let resumed: Bank | null = null;
    if (first && (running || crashed)) {
      // The same round, handed over after a short gap: its clock and the wall clock moved on together.
      const same = live !== null && view.elapsed >= live.elapsed && Math.abs(view.elapsed + (crashed ? view.crashAge : 0) - live.elapsed - (Date.now() - live.wall)) < 4000;
      if (same && live) resumed = live.bank;
      if (same && running && live) world = live.world;
      else world = createWorld(view.elapsed, same && live ? live.world.seed : newSeed(), drive);
      // A late arrival joins at the current line, with the pursuit already on the road and no replayed cues.
      line = lineIndex(mult);
      rung = RUNGS.filter(r => mult >= r).length;
      settlePursuit(pursuit, mult, clock);
      heat = heatLabel(pursuit);
      settleRider(rig, { distance: world.distance, speed: world.speed, hop: 0, hopU: 0, aim: world.aim });
      feedAt = now;
    }
    const cmd = input.take();
    manual ||= cmd.touched;
    // Only the host-confirmed cash-out brings the Kia. A button press alone never does.
    if (view.cashoutX100 !== null && secured === null) {
      secured = view.cashoutX100;
      escapeAt = first || crashed ? now - 5000 : now;
      bank = resumed ?? { deflocked: world.deflocked };
      if (!first && running) {
        audio.cashout();
        audio.fx('engine', 0.4);
        say('KIA INBOUND · THE DECOY IS WARMING UP', now, C.lime, 2200);
      }
    }
    const since = secured === null ? 0 : (now - escapeAt) / 1000;
    const npc = secured !== null;
    const swapping = npc && since >= 1.3 && since < 2.3;
    if (crashed && previous !== 'crashed') {
      const late = first || view.crashAge > 1500;
      audio.crash('siren', late);
      bust = bustFor(view.currentX100, world.distance, world.speed, world.deflocked, staked && secured === null, npc, leadGap(tension, world.alert));
      if (!late) { shake = 1.6; punch.v += 1.2; sound.bust(); }
      else sound.cut();
      bustLive = !late;
      bustHeard = bustClock(view.crashAge / 1000);
    }
    audio.update(view.phase, tension);

    if (running) {
      // After the swap the decoy has the aimbot; the ride carries on without you.
      const trigger: Trigger = npc ? { aim: null, move: { x: 0, y: 0 }, fire: 0, reload: false, manual: false } : { aim: cmd.aim, move: cmd.move, fire: cmd.fire, reload: cmd.reload, manual };
      let left = real;
      while (left > 1e-6) {
        const step = Math.min(left, 1 / 60);
        for (const e of stepWorld(world, step, swapping ? { ...trigger, fire: 0 } : trigger, drive, muzzle)) if (!first) handle(e, now, npc);
        left -= step;
      }
      const arrived = stepPursuit(pursuit, mult, clock);
      if (arrived) {
        heat = heatLabel(pursuit);
        heatAt = now;
        if (!first) { audio.fx('siren', 0.4); say(`HEAT UP · ${heat}`, now, C.red, 1600); }
      }
      const index = lineIndex(mult);
      if (index > line) { line = index; lineAtMs = now; if (!first) audio.fx('notify', 0.2); }
      const passed = RUNGS.filter(r => mult >= r).length;
      if (passed > rung) { rung = passed; if (!first) audio.milestone(passed); }
      if (staked && !npc && !first) {
        // A heartbeat under the phonk that quickens with the multiplier while your bet is still on the bike.
        pulse += real / mix(1.4, 0.38, tension);
        if (pulse >= 1) { pulse %= 1; audio.fx('heartbeat', 0.1 + 0.25 * tension); }
      }
      // The sirens, now and then, louder with the heat.
      if (pursuit.since[0]! >= 0 && now - sirenAt > 4200 - 1800 * tension) { sirenAt = now; if (!first) audio.fx('siren', 0.1 + 0.2 * tension); }
      // The Nextdoor feed posts faster as the town loses its mind.
      if (now - feedAt > mix(4200, 2200, tension)) { feedAt = now; feed++; if (!first && feed % 3 === 0) audio.fx('notify', 0.12); }
      live = { world, elapsed: view.elapsed, wall: Date.now(), bank: secured === null ? null : bank };
    }
    if (crashed && bust) world.distance = bust.distance + coast(bust.speed, t);
    if (crashed && bustLive) {
      for (const [at, cue, strength] of BUST_CUES) if (bustHeard < at && t >= at) audio.fx(cue, strength);
      bustHeard = t;
    }
    previous = view.phase;
    lastElapsed = view.elapsed;
    const hop = running && !first ? hopAt(world.distance, world.seed) : { h: 0, u: 0 };
    sound.update(clamp(world.speed / 350, 0, 1), tension, hop.h > 4, running);
    const riderDrive = { distance: world.distance, speed: crashed ? 0 : world.speed, hop: hop.h, hopU: hop.u, aim: swapping || crashed ? null : world.aim };
    if (first) settleRider(rig, riderDrive); else stepRider(rig, riderDrive, real * warp);
    if (rig.events.land && running) { audio.fx('thud', 0.3); shake = Math.max(shake, 0.3); }
    stepSpring(punch, 0, 7, 0.6, real);
    shake *= Math.exp(-6 * real);
    tracers = tracers.filter(s => clock - s.at < 0.12);
    floaters = floaters.filter(f => clock - f.at < 1.3);

    // ---- The picture -----------------------------------------------------------------------------------------
    const dusk = clamp(Math.log10(mult) / 0.8, 0, 1);
    const camera = world.distance - RIDER_X;
    const frame: Frame = { x: RIDER_X, y: GROUND - hop.h, angle: -0.3 * Math.sin(Math.PI * hop.u) * (hop.u < 0.5 ? 1 : 0.4) };
    const pose = riderPose(rig, riderDrive, frame);
    if (pose.muzzle) muzzle = pose.muzzle;
    const quake = shake * 6;
    const punchIn = clamp(punch.x, 0, 1) * 0.07;
    ctx.save();
    ctx.save();
    ctx.translate(RIDER_X + quake * Math.sin(clock * 71 + age * 90), 380 + quake * 0.6 * Math.cos(clock * 57 + age * 73));
    ctx.scale(1 + punchIn, 1 + punchIn);
    ctx.translate(-RIDER_X, -380);
    drawSky(ctx, dusk, clock, camera);
    drawSkyline(ctx, dusk, camera, clock);
    // The lots, the road and the potholes.
    const firstSeg = Math.floor((camera + 360 - 520) / SEG) - 1;
    const potholes: number[] = [];
    for (let s = firstSeg; s <= firstSeg + 5; s++) {
      const lot = lotFor(s, world.seed);
      if (lot.pothole !== null) potholes.push(lot.pothole);
    }
    drawRoad(ctx, dusk, camera, potholes);
    for (let s = firstSeg; s <= firstSeg + 5; s++) {
      const lot = lotFor(s, world.seed);
      const x = lot.x - camera;
      if (x > -SEG - 40 && x < 1000) drawLot(ctx, lot, x, dusk, clock);
    }
    for (const h of world.holes) drawHole(ctx, h.x - camera, h.y, h.age);
    // Cameras on their mounts; birds last so they cross in front.
    const sorted = [...world.cams].sort((a, b) => Number(a.kind === 'bird') - Number(b.kind === 'bird'));
    for (const c of sorted) {
      const p = camScreen(c, world);
      if (p.x < -200 || p.x > 1200) continue;
      drawCam(ctx, c, p, dusk, clock);
    }
    const pursuitLook = { heat: tension, alert: world.alert, dusk, clock, distance: world.distance, riderY: frame.y, crashed };
    if (!crashed) drawPursuitBack(ctx, pursuit, pursuitLook);
    if (crashed && bust) {
      drawBust(ctx, bust, t, { rig, clock, age });
    } else {
      drawShadow(ctx, RIDER_X, GROUND, hop.h, dusk);
      drawWheels(ctx, pose, clamp(world.speed / 350, 0, 1));
      if (!swapping) drawRider(ctx, pose, { blur: 0, flash: clamp(1 - (clock - flashAt) / 0.08, 0, 1), decoy: npc && since >= 2.3, blink: Math.sin(clock * 0.7) > 0.985 ? 1 : 0, tilt: 0 });
      else {
        // Nobody on the bike for a second: the frame rolls on between the two of them.
        const bare = riderPose(rig, { ...riderDrive, aim: null }, frame);
        drawCrank(ctx, bare, false);
        drawFrame(ctx, bare);
        drawCrank(ctx, bare, true);
      }
      for (const s of tracers) drawTracer(ctx, s.from, s.to, clock - s.at);
      if (!crashed) drawPursuitFront(ctx, pursuit, pursuitLook);
      if (npc && running && since < 4) drawGetaway(ctx, since, clock, dusk, { x: pose.hip.x, y: pose.hip.y });
    }
    // Tallies float up off the cameras.
    for (const f of floaters) {
      const a = clock - f.at;
      ctx.globalAlpha = 1 - ease((a - 0.8) / 0.5);
      outlined(ctx, f.text, clamp(f.x, 80, 880), f.y - a * 38, 13, f.color, 260);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // A fresh ride fades up from the dark instead of cutting from the bust.
    if (now - fadeAt < 450) {
      ctx.globalAlpha = 1 - ease((now - fadeAt) / 450);
      ctx.fillStyle = C.ink;
      ctx.fillRect(0, 0, 960, 540);
      ctx.globalAlpha = 1;
    }

    // ---- The reticle and the HUD -------------------------------------------------------------------------------
    if (running && !swapping) {
      const on = targetAt(world, world.aim) !== null;
      const label = npc ? 'DECOY · AIMBOT' : manual ? null : 'AIMBOT (FREE TRIAL)';
      drawReticle(ctx, world.aim.x, world.aim.y, on, clock, label, npc ? C.pink : manual ? C.lime : C.cyan);
      if (!manual && !npc && cmd.pointer) drawReticle(ctx, cmd.pointer.x, cmd.pointer.y, false, clock, touchOnly ? 'TAP TO TAKE THE GUN' : 'CLICK TO TAKE THE GUN', C.white, true);
    }
    capture(ctx);
    paintHud(ctx, {
      view, incoming, mult, tension, previousEnding, secured, staked, bank, world, manual, npc, touchOnly, crashed, running, idle, now, line, lineAtMs,
      toast, toastUntil, toastColor, bust, t, heat, heatAt, feed, feedAt, clock, since, dusk,
    });
    ctx.restore();
    const l = crashed && bust ? BUSTED[bust.cause] : idle ? { who: 'NARRATOR', text: 'A man. A BMX. A deep discomfort with being perceived.' } : lineAt(line);
    const caption = crashed && bust ? CAUSE_LINE[bust.cause] : toast && now < toastUntil ? toast : `${world.deflocked} DEFLOCKED · ${heat}`;
    const detail = crashed && bust && t > 2.6 ? [0, 0, 960, 540] : undefined;
    present(ctx, { phase: view.phase, currentX100: view.currentX100, cashoutX100: secured }, caption, `${l.who} · AMMO ${world.ammo}/${MAG}`, l.text, detail);

    if (Math.floor(now / 1000) !== ariaAt) {
      ariaAt = Math.floor(now / 1000);
      const state = previousEnding ? `Previous ride ending; the next round is ${incoming.phase}.` : crashed ? `Busted at ${formatX(view.currentX100)}.` : running ? `Riding at ${formatX(view.currentX100)}.` : 'Waiting at the kerb for the next round.';
      canvas.setAttribute('aria-label', `Flock Off. ${state} ${world.deflocked} cameras deflocked, ${world.seen} cameras read him, ${world.ammo} of ${MAG} rounds left. ${manual ? 'You have the gun.' : 'The aimbot has the gun; click, tap, or press an arrow key or F to take it.'}${secured !== null ? ` Got away at ${formatX(secured)}.` : ''}`);
    }
  }

  return { draw, dispose: () => { sound.cut(); input.dispose(); } };
}

// ---- The HUD -------------------------------------------------------------------------------------------------------

interface Hud {
  view: SceneView; incoming: SceneView; mult: number; tension: number; previousEnding: boolean; secured: number | null; staked: boolean; bank: Bank; world: World;
  manual: boolean; npc: boolean; touchOnly: boolean; crashed: boolean; running: boolean; idle: boolean; now: number; line: number; lineAtMs: number;
  toast: string; toastUntil: number; toastColor: string; bust: Bust | null; t: number; heat: string; heatAt: number; feed: number; feedAt: number; clock: number; since: number; dusk: number;
}

function band(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.62): void {
  ctx.fillStyle = `rgba(6, 7, 15, ${alpha})`;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
}

function paintHud(ctx: CanvasRenderingContext2D, h: Hud): void {
  const { view, world, now, crashed, running, mult } = h;
  const H = 540;
  // Top left: the tally, the streak and the magazine.
  band(ctx, 12, 12, 232, 72);
  text(ctx, 'DEFLOCKED', 24, 28, 11, C.cyan, 'left', 100, 900);
  text(ctx, String(world.deflocked), 112, 28, 16, C.white, 'left', 60, 900, 'ui-monospace, monospace');
  text(ctx, 'SEEN', 150, 28, 11, C.red, 'left', 50, 900);
  text(ctx, String(world.seen), 192, 28, 16, C.white, 'left', 40, 900, 'ui-monospace, monospace');
  const streak = streakLabel(world.streak);
  text(ctx, streak ?? (world.streak > 0 ? `STREAK ×${world.streak}` : 'NO FACE · NO CASE'), 24, 50, 11, streak ? C.pink : C.gold, 'left', 210, 900);
  // The magazine: pips for rounds, a bar while reloading.
  for (let k = 0; k < MAG; k++) {
    ctx.fillStyle = k < world.ammo ? C.amber : 'rgba(255, 255, 255, 0.15)';
    roundRect(ctx, 24 + k * 14, 64, 9, 14, 2);
    ctx.fill();
  }
  if (world.reloading > 0) {
    ctx.fillStyle = C.cyan;
    ctx.fillRect(140, 69, 90 * (1 - world.reloading / 0.9), 5);
    text(ctx, 'RELOADING', 140, 62, 8, C.cyan, 'left', 90, 900);
  } else text(ctx, world.ammo === 0 ? 'EMPTY · R' : h.touchOnly ? 'TAP TO FIRE' : 'CLICK OR F · R RELOADS', 140, 70, 8, 'rgba(255, 255, 255, 0.6)', 'left', 96, 800);

  // Top centre: the multiplier and the bet.
  const tint = crashed ? C.red : h.secured !== null ? C.lime : C.white;
  const pop = crashed ? 1 + 0.25 * (1 - ease((view.crashAge / 1000 - 0.1) / 0.3)) : 1;
  outlined(ctx, formatX(view.currentX100), 480, 44, 54 * pop, tint, 300, 900);
  let line = '';
  let color: string = C.white;
  if (h.secured !== null) { line = `GOT AWAY AT ${formatX(h.secured)}${view.payout !== null ? ` · ${credits(view.payout)}` : ''}`; color = C.lime; }
  else if (h.staked) { line = crashed ? `YOUR ${credits(view.stake!)} SEIZED AS EVIDENCE` : `${credits(view.stake!)} ON THE BIKE`; color = crashed ? C.red : C.amber; }
  else line = crashed ? 'YOU WATCHED · NO CREDITS LOST (STILL SEEN)' : h.idle ? 'JOIN TO RIDE · NO FACE NO CASE' : 'WATCHING · NO CREDITS ON THE BIKE';
  outlined(ctx, line, 480, 86, 14, color, 500, 900);

  // Top right: the heat.
  band(ctx, 716, 12, 232, 72);
  text(ctx, 'HEAT', 728, 28, 11, C.red, 'left', 60, 900);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundRect(ctx, 770, 22, 166, 12, 6);
  ctx.fill();
  ctx.fillStyle = blend('#b7ff5a', '#ff3b4f', h.tension);
  roundRect(ctx, 770, 22, 166 * clamp(h.tension, 0.03, 1), 12, 6);
  ctx.fill();
  const heatPop = 1 + 0.25 * (1 - ease((now - h.heatAt) / 600));
  text(ctx, h.heat, 728, 52, 12 * heatPop, C.white, 'left', 210, 900);
  text(ctx, h.manual ? 'YOU HAVE THE GUN' : h.npc ? 'THE DECOY HAS THE GUN' : 'AIMBOT · FREE TRIAL', 728, 72, 9, h.manual ? C.lime : C.cyan, 'left', 210, 800);

  // The chyron: who is saying what.
  if (!crashed || (h.bust && h.t < 3.2)) {
    const l = h.idle ? { who: 'NARRATOR', text: 'A man. A BMX. A deep discomfort with being perceived.' } : lineAt(h.line);
    const fresh = 1 - ease((now - h.lineAtMs) / 500);
    ctx.font = '800 13px system-ui, sans-serif';
    const w = Math.min(760, ctx.measureText(l.text).width + 30);
    band(ctx, 480 - w / 2 - 60, 100 - 3 * fresh, w + 120, 26, 0.7);
    text(ctx, `${l.who} ▸`, 480 - w / 2 - 50, 113 - 3 * fresh, 11, C.amber, 'left', 110, 900);
    text(ctx, l.text, 480 + 55, 113 - 3 * fresh, 13, C.white, 'center', w - 10, 800);
  } else if (h.bust) {
    const l = BUSTED[h.bust.cause];
    band(ctx, 120, 100, 720, 26, 0.7);
    text(ctx, `${l.who} ▸`, 130, 113, 11, C.amber, 'left', 150, 900);
    text(ctx, l.text, 535, 113, 13, C.white, 'center', 580, 800);
  }
  // Toasts.
  if (now < h.toastUntil && !crashed) outlined(ctx, h.toast, 480, 152, 20, h.toastColor, 800, 900);

  // After the getaway: the regret ladder that always backs the exit.
  if (h.secured !== null && !crashed && h.since > 3) {
    const ratio = mult / (h.secured / 100);
    const regret = REGRET.find(([at]) => ratio >= at)![1];
    band(ctx, 716, 92, 232, 46, 0.62);
    text(ctx, `YOU · IN THE KIA · GONE AT ${formatX(h.secured)}`, 728, 106, 10, C.lime, 'left', 210, 900);
    text(ctx, regret, 728, 124, 8.5, C.white, 'left', 212, 800);
  }
  // Space (or the button) is the way off the bike while your bet is on it.
  if (h.staked && h.secured === null && running) outlined(ctx, h.touchOnly ? 'TAP CASH OUT TO GET IN THE KIA' : 'SPACE = CASH OUT = THE KIA', RIDER_X + 10, GROUND + 38, 12, C.lime, 400, 900);

  // The Nextdoor feed at the foot of the picture.
  band(ctx, 0, H - 24, 960, 24, 0.72);
  ctx.save();
  ctx.beginPath();
  ctx.rect(96, H - 24, 864, 24);
  ctx.clip();
  const post = feedPost(h.feed);
  const drift = ((now - h.feedAt) / 1000) * 30;
  text(ctx, post, 110 - Math.max(0, drift - 2 * 30) * 0, H - 12, 12, C.white, 'left', 840, 700);
  ctx.restore();
  ctx.fillStyle = C.lime;
  roundRect(ctx, 6, H - 21, 86, 18, 4);
  ctx.fill();
  text(ctx, 'NEXTDOOR', 49, H - 12, 10, C.ink, 'center', 80, 900);

  // The betting-open banner over a bust still finishing.
  if (h.previousEnding) {
    band(ctx, 230, 160, 500, 30, 0.75);
    text(ctx, 'NEXT RIDE · BETTING OPEN · THE BIKE IS FINE, PROBABLY', 480, 175, 13, C.lime, 'center', 480, 900);
  }
  if (crashed && h.bust) paintCards(ctx, h);
}

/** The bust's cards: the cause, the crash-out, how they found him, and the mugshot. */
function paintCards(ctx: CanvasRenderingContext2D, h: Hud): void {
  const { bust, t, view } = h;
  if (!bust) return;
  const cx = t > 2.6 ? mix(480, 390, ease((t - 2.6) / 0.5)) : 480;
  if (t > 0.5) outlined(ctx, CAUSE_LINE[bust.cause], cx, 150, 18, C.red, 640, 900);
  if (t > 0.9) {
    const pop = 1 + 0.3 * (1 - ease((t - 0.9) / 0.25));
    outlined(ctx, `CRASHED OUT AT ${formatX(view.currentX100)}`, cx, 204, 40 * pop, C.white, 640, 900);
    let line: string;
    let color: string = C.white;
    if (h.secured !== null) { line = `THEY GOT THE DECOY. YOU GOT OUT AT ${formatX(h.secured)}${view.payout !== null ? ` WITH ${credits(view.payout)}` : ''}.`; color = C.lime; }
    else if (h.staked) { line = `YOUR ${credits(view.stake!)} ARE EVIDENCE NOW.`; color = C.red; }
    else { line = 'YOU WATCHED. NO CREDITS LOST. (STILL SEEN.)'; color = C.amber; }
    outlined(ctx, line, cx, 244, 15, color, 640, 900);
  }
  if (t > 1.8) outlined(ctx, `HOW THEY FOUND HIM: ${bust.how}`, cx, 276, 14, C.amber, 640, 900);
  if (t > 2.6) {
    // The mugshot polaroid slides up on the right, mask still on.
    const u = ease((t - 2.6) / 0.5);
    const x = 830, y = mix(600, 318, u);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.05);
    ctx.fillStyle = '#f3efe6';
    roundRect(ctx, -92, -112, 184, 224, 4);
    ctx.fill();
    ctx.fillStyle = '#2b2538';
    ctx.fillRect(-80, -100, 160, 110);
    // Height lines and the head in its balaclava.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-80, -92 + k * 18); ctx.lineTo(80, -92 + k * 18); ctx.stroke(); }
    ctx.fillStyle = INK.cloth;
    ctx.beginPath();
    ctx.moveTo(-34, 10); ctx.quadraticCurveTo(-30, -30, 0, -32); ctx.quadraticCurveTo(30, -30, 34, 10);
    ctx.fill();
    ctx.fillStyle = INK.black;
    ctx.beginPath();
    ctx.ellipse(0, -52, 22, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK.rim;
    ctx.stroke();
    ctx.fillStyle = '#2a2a33';
    ctx.beginPath();
    ctx.ellipse(0, -56, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const ex of [-7, 7]) {
      ctx.fillStyle = INK.eye;
      ctx.beginPath();
      ctx.ellipse(ex, -56, 4.5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK.pupil;
      ctx.beginPath();
      ctx.arc(ex + 1, -56, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f3efe6';
    ctx.fillRect(-60, -6, 120, 12);
    text(ctx, 'FLOCKVILLE PD · 0000' + String(Math.floor(view.currentX100)).padStart(4, '0'), 0, 0, 8, '#1a1826', 'center', 116, 900);
    text(ctx, 'SUSPECT DECLINED TO REMOVE MASK', 0, 20, 7.5, '#8a2b2b', 'center', 170, 900);
    text(ctx, 'CHARGES', -80, 36, 8, '#1a1826', 'left', 160, 900);
    charges(bust.deflocked).forEach((c, i) => text(ctx, `· ${c}`, -80, 50 + i * 12, 8, '#2b2538', 'left', 164, 800));
    text(ctx, bust.decoy ? 'NOTE: THIS IS THE DECOY' : 'NO FACE. SOME CASE.', 0, 104, 7.5, '#8a2b2b', 'center', 170, 900);
    ctx.restore();
  }
}
