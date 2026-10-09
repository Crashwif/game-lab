/** Rug Piste: original downhill arcade presentation of the shared, committed crash round. */
import { liftPose } from './lift-rig';
import { pageAudio } from './audio';
import { createInput, type Commands } from './input';
import { addPrints, clamp, createWorld, driveAt, stepWorld, LANE, type World } from './course';
import { drawSkier, drawYeti, drawYetiHands, drawYetiTeeth, drawTree, drawCoin, drawRock, drawRug, drawRamp, drawSign, drawLift, drawPrint, liftSway } from './art';
import { yetiPose, impactAge, ENDING_SECONDS, YETI_SCALE, HOLE_BELOW_SKIER, MOUTH_TOP, MOUTH_BOTTOM } from './yeti-rig';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number; elapsed: number; crashAge: number;
  stake: number | null; cashoutX100: number | null; payout: number | null;
}
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void; dispose(): void }
interface Field { x: number; y: number; w: number; h: number }
const C = { ink: '#282348', purple: '#6451be', lime: '#cefa65', snow: '#fafbf5', shade: '#e2e4f0', grey: '#d9d9e1', muted: '#77758b', pink: '#ec759d' };
const formatX = (n: number) => `${(n / 100).toFixed(2)}×`;
const ease = (n: number) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
interface Bag { coins: number; style: number }
// A shell replacement after a short hidden-tab gap can recover local arcade progress, a banked bag and the round's slope seed.
let live: { world: World; elapsed: number; wall: number; bank: Bag | null } | null = null;
// Manual steering is the player's choice for the page, so a replaced scene keeps it.
let manual = false;
/** One local draw per round lays out a fresh slope; it never reads the backend or the outcome. */
const newSeed = () => Math.floor(Math.random() * 0x7fffffff);

/** Multiplier beats: a sign, yeti tracks or a tremor every 2-3 s through 1×-3×. Keyed to the multiplier, never the crash. */
interface Beat { x: number; news: readonly [string, string]; sign?: readonly [string, string]; warn?: boolean; prints?: boolean; tremor?: boolean; patrol?: string }
const BEATS: Beat[] = [
  { x: 1, news: ['DEV SOLD THE CHALET.', 'SAYS HE IS STILL IN.'] },
  { x: 1.12, sign: ['UNAUDITED', 'TERRAIN'], news: ['GROOMED BY KOLS.', 'AUDITED BY NOBODY.'] },
  { x: 1.3, sign: ['SLIPPAGE', 'AHEAD'], news: ['BUY THE DIP?', 'THIS IS A MOUNTAIN.'] },
  { x: 1.5, prints: true, patrol: 'PATROL: FRESH TRACKS. SIZE 47.', news: ['BIG PRINTS ON THE', 'BLACK RUN. JUST FUD.'] },
  { x: 1.75, sign: ['BLACK DIAMOND', 'HANDS ONLY'], news: ['DIAMOND HANDS.', 'QUESTIONABLE KNEES.'] },
  { x: 2, sign: ['YETI SIGHTING:', 'PROBABLY NOTHING'], warn: true, patrol: 'PATROL: YETI SIGHTED. PROBABLY NOTHING.', news: ['YETI SIGHTING.', 'PROBABLY NOTHING.'] },
  { x: 2.4, prints: true, patrol: 'MORE TRACKS. CLOSER. COPE.', news: ['TRACKS GO UNDER', 'THE SNOW. BULLISH?'] },
  { x: 3, tremor: true, patrol: 'TREMOR. PROBABLY WHALES.', news: ['TREMOR REPORTED.', 'PROBABLY WHALES.'] },
  { x: 4, sign: ['POINT OF NO', 'RUG-TURN'], news: ['AUDIT: TRUST ME BRO.', 'YETI: TRUST ME, BRO.'] },
  { x: 5, prints: true, tremor: true, patrol: 'DEV WALLET: STIRRING.', news: ['DEV WALLET MOVED.', 'TOTALLY NORMAL.'] },
  { x: 7, sign: ['AVALANCHE RISK:', 'WHALE'], warn: true, news: ['WEN LAMBO?', 'BEST WE CAN DO: SKIS.'] },
  { x: 10, tremor: true, patrol: '10×. THIN AIR, THICK BAGS.', news: ['NEW ATH. OXYGEN', 'NOW OPTIONAL.'] },
];
// Past 10× a slower log clock adds a beat every 1.6×, so long rounds keep changing instead of freezing.
const LATE: Beat[] = [
  { x: 0, sign: ['NO GROOMING', 'ABOVE 10×'], news: ['LIFT STILL RUNNING.', 'JUST SAYING.'] },
  { x: 0, prints: true, tremor: true, patrol: 'TRACKS EVERYWHERE. FEW UNDERSTAND.', news: ['PATROL STOPPED', 'COUNTING PRINTS.'] },
  { x: 0, sign: ['THIN AIR', 'THICK BAGS'], warn: true, news: ['GM FROM THE', 'DEATH ZONE.'] },
  { x: 0, tremor: true, patrol: 'BIGGER TREMOR. BIGGER WHALES.', news: ['WAGMI, SAYS MAN', 'ON A MOUNTAIN.'] },
];
const beatAt = (n: number) => n < BEATS.length ? BEATS[n] : LATE[(n - BEATS.length) % LATE.length];
function beatIndex(x: number): number {
  let n = 0;
  while (n + 1 < BEATS.length && x >= BEATS[n + 1].x) n++;
  return x >= 16 ? n + Math.floor(Math.log(x / 10) / Math.log(1.6)) : n;
}
/** After a cash-out: how far the still-in degen has run past the player's exit, always respecting the exit. */
const REGRET: readonly [number, string][] = [
  [5, 'UNREALIZED IS A FEELING. BANKED IS A FACT.'], [3, '3× REGRET. 0× YETI RISK.'], [2, "HE 2×'D YOU. THE YETI IS DOING MATHS."],
  [1.5, '+50% WITHOUT YOU. BANKED BEATS MAYBE.'], [1.15, 'PINK GUY IS STILL IN. YOU ARE STILL SAFE.'], [0, 'TOOK PROFITS. RESPECT THE JEET.'],
];
const FLAGS = ['NFA', 'DYOR', 'FEW UNDERSTAND', 'WAGMI', 'NGMI'];

function text(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, size = 14, color = C.ink, align: CanvasTextAlign = 'left', max = 1000) {
  ctx.fillStyle = color; ctx.font = `bold ${size}px "Courier New", monospace`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(line, x, y, max);
}
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = C.grey) {
  ctx.fillStyle = C.ink; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(x + 3, y + 3, w - 6, 2); ctx.fillRect(x + 3, y + 3, 2, h - 6);
  ctx.fillStyle = '#aaa8bd'; ctx.fillRect(x + w - 5, y + 5, 2, h - 8); ctx.fillRect(x + 5, y + h - 5, w - 8, 2);
}
function tag(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, color: string) {
  ctx.font = 'bold 11px "Courier New", monospace';
  const w = ctx.measureText(line).width + 10;
  ctx.fillStyle = C.ink; ctx.fillRect(Math.round(x - w / 2), Math.round(y - 8), Math.round(w), 16);
  text(ctx, line, x, y, 11, color, 'center');
}

export function createScene(): Scene {
  // Phones have no Space bar: there the frame names the Cash out button instead.
  const touchOnly = typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
  const audio = pageAudio({ style: 'chiptune', bpm: 132, crash: 'boom', music: 0.35, tempoRise: 0.12 });
  const canvas = document.querySelector('canvas')!;
  let field: Field = { x: 14, y: 78, w: 682, h: 410 };
  let width = 960;
  const input = createInput(canvas, clientX => {
    const box = canvas.getBoundingClientRect();
    return clamp(((clientX - box.left) / Math.max(1, box.width) * width - field.x) / field.w, 0.055, 0.945);
  });
  let world = createWorld(0, newSeed());
  let previous: SceneView['phase'] | null = null;
  let last = 0;
  let lastElapsed = 0;
  let secured: number | null = null;
  let escapeAt = 0;
  let escapeX = 0.5;
  let escapePose = { jump: 0, lean: 0, stumble: 0, stride: 0 };
  let bank: Bag = { coins: 0, style: 0 };
  let toast = '';
  let toastUntil = 0;
  let ariaAt = -1;
  let crashAngle = 0;
  let crashLean = 0;
  let crashFrom = 0;
  let crashSpeed = 0;
  let fadeAt = -1e9;
  let beat = 0;
  let patrol = '';
  let patrolAt = -1e9;
  // Tremors, the heartbeat and the gate rock run on integrated phases, never on sin(clock * rate).
  let tremorAt = -1e9;
  let tremorAmp = 0;
  let rumble = 0;
  let pulse = 0;
  let rock = 0;
  let ending: { view: SceneView; startedAt: number } | null = null;

  function draw(ctx: CanvasRenderingContext2D, incoming: SceneView, now: number) {
    // A live host may reopen betting after two seconds. Finish this presentation during betting,
    // while the untouched shell already offers the next round's controls. Never delay a running round.
    if (incoming.phase === 'crashed') ending = { view: { ...incoming }, startedAt: now - incoming.crashAge };
    else if (incoming.phase === 'running' || document.documentElement.dataset.mode === 'replay') ending = null;
    const previousEnding = incoming.phase !== 'crashed' && ending !== null && now - ending.startedAt < ENDING_SECONDS * 1000;
    const view = previousEnding && ending ? { ...ending.view, crashAge: Math.max(0, now - ending.startedAt) } : incoming;
    if (!previousEnding && incoming.phase !== 'crashed') ending = null;
    const first = previous === null;
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const staked = view.stake !== null;
    const reset = view.phase === 'betting' && previous !== 'betting' || running && (previous === 'crashed' || view.elapsed < lastElapsed - 200);
    let dt = last ? clamp((now - last) / 1000, 0, 0.1) : 0;
    const frameDt = dt;
    last = now;
    const mult = Math.max(1, view.currentX100 / 100);
    // 0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×, 0.9 at 10×: the 1×-3× window carries the escalation.
    const tension = 1 - 1 / mult;
    const drive = driveAt(view.currentX100, view.elapsed);
    const rect = canvas.getBoundingClientRect();
    const portrait = rect.width / Math.max(1, rect.height) < 1;
    width = portrait ? 600 : 960;
    const height = portrait ? 750 : 540;
    field = portrait ? { x: 12, y: 190, w: 576, h: 516 } : { x: 14, y: 78, w: 682, h: 410 };
    const scale = field.w / 640;
    const skierFrac = portrait ? 0.38 : 0.39;
    const skierY = field.y + field.h * skierFrac;
    // Beat props are planted just below the visible slope, so they scroll in rather than pop.
    const ahead = (field.h * (1 - skierFrac) + 75) / scale;
    if (reset) {
      world = createWorld(0, newSeed()); secured = null; escapeAt = 0; toast = ''; live = null;
      beat = 0; patrol = ''; tremorAt = -1e9; rumble = pulse = rock = 0;
      if (!first) fadeAt = now;
    }
    let resumed: Bag | null = null;
    if (first && (running || crashed)) {
      // The same round: its clock and the wall clock moved on together since the handoff. Another round lays a new slope.
      const same = live !== null && view.elapsed >= live.elapsed && Math.abs(view.elapsed + (crashed ? view.crashAge : 0) - live.elapsed - (Date.now() - live.wall)) < 4000;
      if (same && live) resumed = live.bank;
      if (same && running && live) world = live.world;
      else world = createWorld(view.elapsed, same && live ? live.world.seed : newSeed(), drive);
      // A late arrival joins at the current beat without replaying old stingers.
      beat = beatIndex(mult);
    }
    const command = input.take(world.x);
    manual ||= command.touched;
    command.touched = manual;
    // Only the host-confirmed cashout changes the ending. An input never sets secured.
    if (view.cashoutX100 !== null && secured === null) {
      secured = view.cashoutX100;
      escapeAt = first || crashed ? now - 2200 : now;
      if (!first && running) audio.cashout();
      // After a handoff the bank carries over, and a resumed run already belongs to the still-in degen.
      if (resumed) bank = resumed;
      else {
        escapeX = world.x;
        escapePose = { jump: world.jump, lean: world.lean, stumble: world.stumble, stride: world.distance / 28 };
        bank = { coins: world.coins, style: world.style };
        // A still-in degen takes over the run two lanes away; the slope keeps scrolling under him.
        world.x = clamp(escapeX + (escapeX < 0.5 ? 2 : -2) * LANE, 0.14, 0.86);
        world.lean = world.jump = world.jumpLeft = world.stumble = 0;
      }
    }
    if (crashed && previous !== 'crashed') {
      crashAngle = Math.sin(world.time * 40) * world.stumble * 0.12;
      crashLean = world.lean;
      crashFrom = world.distance; crashSpeed = world.speed;
      audio.crash('boom', first || view.crashAge > 1500);
    }
    audio.update(view.phase, tension);
    if (!running && !crashed) {
      // Ready stance: the skier rocks on their edges at the gate, and the first carve continues from this lean.
      rock += frameDt * 3.2;
      world.lean = Math.sin(rock) * 0.2;
    }
    // Crash time after the hit-stop.
    const age = crashed ? (impactAge(view.crashAge / 1000)) : 0;
    // The still-in degen skis in from behind once the chair has collected the player.
    const since = (now - escapeAt) / 1000;
    // A crash hurries a late arrival into place before the yeti reaches for him.
    const runnerLift = secured !== null ? (1 - Math.max(ease((since - 0.5) / 1), crashed ? ease(age / 0.4) : 0)) * (skierY - field.y + 90) : 0;
    if (running) {
      const npc = secured !== null;
      // He collects, bonks and lays tracks where he is drawn, not at the camera line.
      world.behind = runnerLift / scale;
      const steer: Commands = npc ? { steer: 0, target: null, jump: false, touched: false } : command;
      // Substeps keep contacts consistent at low frame rates; hidden gaps never fast-forward collisions.
      while (dt > 0.000001) {
        const step = Math.min(dt, 1 / 60);
        for (const event of stepWorld(world, step, steer, drive)) {
          if (npc) continue;
          if (event === 'coin') audio.fx('coin', 0.28);
          if (event === 'bonk') { audio.fx('thud', 0.55); toast = world.spilled ? `PAPER KNEES!  SPILLED ${world.spilled} $SLOPE` : 'PAPER KNEES!  -25 STYLE'; toastUntil = now + 1200; }
          if (event === 'jump') audio.fx('whoosh', 0.3);
          if (event === 'ramp') { audio.fx('ding', 0.45); toast = 'SEND IT!  +50 STYLE'; toastUntil = now + 1100; }
        }
        steer.jump = false;
        dt -= step;
      }
      const index = beatIndex(mult);
      if (index > beat) {
        beat = index;
        const b = beatAt(index);
        if (b.sign) world.objects.push({ id: -index, kind: 'sign', x: index % 2 ? 0.1 : 0.9, z: world.distance + ahead, used: true, label: b.sign, warn: b.warn });
        if (b.prints) addPrints(world, world.distance + ahead, index);
        if (b.tremor) { tremorAt = world.time; tremorAmp = 3 + 2 * drive.deep; }
        if (b.patrol) { patrol = b.patrol; patrolAt = now; }
        if (!npc) audio.fx(b.tremor || b.prints ? 'stomp' : 'click', b.tremor ? 0.6 : 0.3);
      }
      if (mult >= 3) {
        // After the 3× tremor, smaller rumbles return sooner the longer the round runs: fake-outs, not forecasts.
        rumble += frameDt / mix(7, 2.5, drive.deep);
        if (rumble >= 1) { rumble -= 1; tremorAt = world.time; tremorAmp = 1.5 + 1.5 * drive.deep; if (!npc) audio.fx('creak', 0.2); }
      }
      if (!npc && !first) {
        // A heartbeat that quickens with the multiplier, only while the player's bag is still on the slope.
        pulse += frameDt / mix(1.4, 0.35, tension);
        if (pulse >= 1) { pulse %= 1; audio.fx('heartbeat', 0.12 + 0.28 * tension); }
      }
      live = { world, elapsed: view.elapsed, wall: Date.now(), bank: secured === null ? null : bank };
    }
    // At the crash the run brakes as v·e^(-8t) after the hit-stop; the hole stays put in the snow.
    const slid = crashSpeed / 8 * (1 - Math.exp(-8 * age));
    if (crashed) world.distance = crashFrom + slid;
    const slideLeft = crashSpeed / 8 - slid;
    previous = view.phase; lastElapsed = view.elapsed;
    const skierX = field.x + world.x * field.w;
    const visualTime = now;
    const runnerY = skierY - runnerLift;
    const hit = crashed ? view.crashAge / 1000 : 9;
    const punch = 0.1 * ease(hit / 0.04) * (1 - ease((hit - 0.3) / 0.35));
    const quakeAge = world.time - tremorAt;
    const quake = running ? tremorAmp * Math.max(0, 1 - quakeAge / 0.9) ** 2 : 0;
    const shake = (hit < 1 ? 4 * Math.exp(-6 * hit) : 0) + quake;
    const cashKey = running && staked && secured === null && !previousEnding;
    const eaten = crashed && secured === null && age >= 4.42;

    ctx.save();
    ctx.scale(960 / width, 540 / height);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = C.grey; ctx.fillRect(0, 0, width, height);
    panel(ctx, 2, 2, width - 4, height - 4);
    ctx.fillStyle = C.ink; ctx.fillRect(7, 7, width - 14, 29);
    ctx.fillStyle = C.lime; ctx.fillRect(15, 14, 14, 14);
    text(ctx, 'RUG PISTE', 39, 22, 18, '#fff');
    text(ctx, portrait ? 'v1.0' : 'DEGEN ALPINE CLUB / EST. 1991', width - 84, 22, 11, '#c9c1e9', 'right');
    panel(ctx, width - 65, 11, 24, 21); text(ctx, '−', width - 53, 21, 18, C.ink, 'center');
    panel(ctx, width - 37, 11, 24, 21); text(ctx, '×', width - 25, 22, 18, C.ink, 'center');
    text(ctx, 'BLACK DIAMOND', 17, 55, portrait ? 16 : 13);
    if (cashKey && portrait) {
      panel(ctx, 152, 43, 236, 25, C.lime);
      text(ctx, touchOnly ? 'TAP CASH OUT = LIFT' : 'SPACE = CASH OUT', 270, 56, 15, C.ink, 'center');
    } else text(ctx, '// BAGHOLDER BASIN', portrait ? 158 : 169, 55, portrait ? 14 : 12, C.muted);
    text(ctx, manual ? 'MANUAL' : 'DEMO', width - 20, 55, portrait ? 14 : 12, C.purple, 'right');
    ctx.fillStyle = '#aaa8bd'; ctx.fillRect(10, 69, width - 20, 2);

    // Snowfield: world-space marks scroll uphill while the skier carves downhill.
    ctx.save();
    ctx.beginPath(); ctx.rect(field.x, field.y, field.w, field.h); ctx.clip();
    ctx.fillStyle = C.snow; ctx.fillRect(field.x, field.y, field.w, field.h);
    ctx.save();
    // The impact punch-in and tremors move the slope, never the HUD.
    ctx.translate(skierX + shake * Math.sin(world.time * 71 + hit * 90), skierY + shake * 0.6 * Math.cos(world.time * 57 + hit * 73));
    ctx.scale(1 + punch, 1 + punch);
    ctx.translate(-skierX, -skierY);
    ctx.strokeStyle = C.shade; ctx.lineWidth = 1;
    const scroll = world.distance * scale;
    for (let row = -1; row < Math.ceil(field.h / 52) + 1; row++) {
      const y = field.y + row * 52 - scroll % 52;
      for (let col = 0; col < 12; col++) {
        const x = field.x + col * 67 + (row % 2) * 23;
        ctx.fillStyle = (row + col) % 3 ? '#e9eaf1' : '#d9dce9';
        ctx.fillRect(x, y, 3, 2); ctx.fillRect(x + 14, y + 27, 8, 1);
      }
    }
    // Alternating resort rope posts and powder banks delineate the playable slope; every other post flies slope wisdom.
    for (const edge of [0, 1]) {
      const x = field.x + edge * field.w;
      ctx.fillStyle = '#ececf4'; ctx.fillRect(x - (edge ? 17 : 0), field.y, 17, field.h);
      for (let n = -1; n < Math.ceil(field.h / 92) + 1; n++) {
        const y = field.y + n * 92 - scroll % 92;
        const post = Math.floor(scroll / 92) + n + edge * 3;
        ctx.fillStyle = C.purple; ctx.fillRect(x + (edge ? -9 : 6), y, 3, 22);
        if (post % 2) { ctx.fillStyle = C.pink; ctx.fillRect(x + (edge ? -16 : 9), y, 10, 7); continue; }
        const label = FLAGS[(post >> 1) % FLAGS.length];
        ctx.font = 'bold 8px "Courier New", monospace';
        const w = Math.ceil(ctx.measureText(label).width) + 8;
        const left = edge ? x - 9 - w : x + 9;
        ctx.fillStyle = C.ink; ctx.fillRect(left, y, w, 11);
        ctx.fillStyle = C.pink; ctx.fillRect(left + 1, y + 1, w - 2, 9);
        text(ctx, label, left + w / 2, y + 6, 8, C.ink, 'center');
      }
    }
    if (world.distance < 260) {
      const sy = skierY - 100 - world.distance * scale;
      ctx.fillStyle = '#dcebc5'; ctx.fillRect(field.x + 32, sy - 8, field.w - 64, 2);
      text(ctx, '↓  APES ONLY. NO REFUNDS.  ↓', field.x + field.w / 2, sy - 26, portrait ? 14 : 16, C.purple, 'center');
    }
    for (const print of world.prints) {
      const y = skierY + (print.z - world.distance) * scale;
      if (y < field.y - 30 || y > field.y + field.h + 30) continue;
      ctx.save(); ctx.translate(field.x + print.x * field.w, y); ctx.scale(scale, scale);
      drawPrint(ctx, 0, 0, print.dir);
      ctx.restore();
    }
    for (const trail of world.trails) {
      const y = skierY + (trail.z - world.distance) * scale;
      const x = field.x + trail.x * field.w;
      ctx.fillStyle = '#d5d8e8';
      ctx.save(); ctx.translate(x, y); ctx.rotate(trail.lean * .14);
      for (const offset of [-7, 7]) ctx.fillRect(offset * scale, -3, 2 * scale, 8 * scale);
      ctx.restore();
    }
    // Depth sorting makes trees pass naturally in front of the skier.
    const objects = world.objects.filter(o => (o.kind !== 'coin' || !o.used) && Math.abs(o.z - world.distance) < 650)
      .map(o => ({ object: o, y: skierY + (o.z - world.distance) * scale }));
    let skierDrawn = false;
    const drawRunner = () => {
      if (crashed) return;
      ctx.save(); ctx.translate(skierX, runnerY); ctx.scale(scale, scale);
      drawSkier(ctx, 0, 0, { lean: world.lean, jump: world.jump * 46, time: world.time * 1000, stride: world.distance / 28, stumble: world.stumble, degen: secured !== null });
      ctx.restore();
      if (secured !== null) tag(ctx, 'STILL IN', skierX, runnerY - (84 + world.jump * 46) * scale, C.pink);
    };
    for (const entry of objects.sort((a, b) => a.y - b.y)) {
      if (!skierDrawn && entry.y > runnerY) { drawRunner(); skierDrawn = true; }
      if (entry.y < field.y - 90 || entry.y > field.y + field.h + 95) continue;
      const o = entry.object;
      ctx.save(); ctx.translate(field.x + o.x * field.w, entry.y); ctx.scale(scale, scale);
      if (o.kind === 'tree') {
        drawTree(ctx, 0, 0, o.id % 3);
        if (quake > 0) {
          // Snow shaken loose from the branches.
          const fall = clamp(quakeAge / 0.9, 0, 1);
          ctx.globalAlpha = 1 - fall; ctx.fillStyle = '#ffffff';
          for (const side of [-1, 1]) ctx.fillRect(side * 10 - 2, -50 + side * 6 + fall * fall * 44, 5, 4);
        }
      }
      if (o.kind === 'coin') drawCoin(ctx, 0, -10, visualTime + o.id * 200);
      if (o.kind === 'rock') drawRock(ctx, 0, 0);
      if (o.kind === 'rug') drawRug(ctx, 0, 0);
      if (o.kind === 'ramp') drawRamp(ctx, 0, 0);
      if (o.kind === 'sign') drawSign(ctx, 0, 0, o.label?.[0] ?? '', o.label?.[1] ?? '', o.warn);
      ctx.restore();
    }
    if (!skierDrawn) drawRunner();
    // Paper knees: a quarter of the bag arcs out of the backpack and is left behind on the slope.
    for (const spill of world.spills) {
      const arc = Math.max(0, 240 * spill.age - 480 * spill.age * spill.age);
      ctx.save(); ctx.translate(field.x + (spill.x + spill.vx * spill.age) * field.w, skierY + ((spill.z - world.distance) - 40 - arc) * scale);
      ctx.scale(scale * 0.8, scale * 0.8); ctx.globalAlpha = 1 - ease((spill.age - 0.45) / 0.25);
      drawCoin(ctx, 0, 0, spill.age * 3000);
      ctx.restore();
    }
    if (world.stumble > 0 && running && secured === null) text(ctx, 'REKT!', skierX, skierY - 80 * scale, 15, C.purple, 'center');
    if (secured !== null) {
      const boarding = liftPose(since, escapePose);
      // The chair drifts away from the side the still-in degen skis in on, so the two start apart.
      const liftX = field.x + (escapeX + (escapeX < 0.5 ? -0.12 : 0.12) * boarding.depart) * field.w;
      const liftY = skierY + boarding.chairY * scale;
      ctx.save(); ctx.translate(liftX, skierY); ctx.scale(scale, scale);
      drawLift(ctx, boarding.chairX, boarding.chairY, visualTime, escapeX > 0.6 ? -1 : 1);
      // Seated, the jeet sways with the chair, the poles carry on from the run's phase and the skis dangle a beat behind.
      drawSkier(ctx, liftSway(visualTime) * boarding.seated, boarding.skierY, { lean: boarding.lean, jump: 0, time: world.time * 1000, stride: escapePose.stride + (since * 5.5),
        stumble: boarding.stumble, seated: boarding.seated, dangle: 0.16 * Math.sin(visualTime / 440 - 1.1), shadow: false });
      ctx.restore();
      text(ctx, 'BAGS SECURED', liftX, liftY + 28 * scale, 13, C.purple, 'center');
    }
    let captionReady = false;
    if (crashed) {
      const yetiX = clamp(skierX, field.x + 66 * scale, field.x + field.w - 66 * scale);
      const holeY = skierY + (HOLE_BELOW_SKIER + slideLeft) * scale;
      const pose = yetiPose(age, { skierOffsetX: (skierX - yetiX) / scale, jumpHeight: world.jump * 46, angle: crashAngle, lead: slideLeft + runnerLift / scale });
      const reach = ease((age - 0.4) / 0.7);
      captionReady = pose.captionReady;
      // The hole is created only after the authoritative phase changes to crashed.
      ctx.save(); ctx.translate(yetiX, holeY); ctx.scale(scale * YETI_SCALE, scale * YETI_SCALE);
      const face = { mouth: pose.mouth, chew: pose.chew, time: view.crashAge };
      const heldSkier = () => {
        if (!pose.skier.visible) return;
        ctx.save();
        if (pose.skier.clipMouth) {
          // The skier stays full size: the mouth and lower jaw occlude each part as it is eaten.
          ctx.beginPath();
          ctx.rect(-500, -600, 1000, 600 + MOUTH_TOP);
          ctx.rect(-24, MOUTH_TOP, 48, MOUTH_BOTTOM - MOUTH_TOP);
          ctx.clip();
        }
        ctx.translate(pose.skier.torso.x, pose.skier.torso.y);
        ctx.rotate(pose.skier.angle);
        ctx.scale(pose.skier.scale * pose.skier.width, pose.skier.scale);
        // The carve straightens out as the hands arrive, so the crash frame matches the last running frame.
        drawSkier(ctx, 0, 30, { lean: crashLean * (1 - reach), jump: 0, time: 0, stride: world.distance / 28, stumble: world.stumble * (1 - reach), shadow: false, degen: secured !== null });
        ctx.restore();
      };
      // Back-facing grab: the skier is behind the torso. The turn brings them around in front.
      if (pose.skier.behind) heldSkier();
      drawYeti(ctx, 0, 0, { rise: pose.rise, ...face, arms: pose.arms, turn: pose.turn, turnDirection: pose.turnDirection });
      if (!pose.skier.behind) heldSkier();
      // Foreground teeth and wrapping fingers keep the grip and the bite visible.
      if (pose.turn === 1 && (pose.skier.clipMouth || !pose.skier.visible)) drawYetiTeeth(ctx, 0, 0, face);
      drawYetiHands(ctx, 0, 0, pose.arms);
      if (age < 0.8) {
        for (let i = 0; i < 10; i++) {
          const dx = (i - 4.5) * 19 * age;
          const dy = -Math.sin(Math.PI * age / 0.8) * (35 + i % 3 * 13);
          ctx.fillStyle = i % 2 ? '#ffffff' : '#c5c0dc';
          ctx.fillRect(dx - 3, dy - 3, 6, 5);
        }
      }
      ctx.restore();
      // Hockey stop: the skis throw a fan of snow as the run brakes into the yeti's arms.
      const spray = clamp(age / 0.45, 0, 1);
      if (crashSpeed > 40 && spray < 1 && world.jump < 0.3) {
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = i % 2 ? '#ffffff' : '#c5c0dc';
          ctx.fillRect(skierX + (i - 4) * (5 + 26 * spray) * scale - 3, runnerY + (4 + 10 * spray - 24 * Math.sin(Math.PI * spray) * (0.6 + i % 3 * 0.2)) * scale, 6, 5);
        }
      }
    }
    ctx.restore();

    // Long rounds keep changing: snow starts falling past 3× and the light fades into night skiing past 10×.
    const dusk = clamp((Math.log10(mult) - 1) / 2, 0, 1);
    if (dusk > 0) { ctx.fillStyle = `rgba(70, 52, 150, ${0.18 * dusk})`; ctx.fillRect(field.x, field.y, field.w, field.h); }
    const flakes = Math.round(70 * clamp((Math.log10(mult) - 0.5) / 2.5, 0, 1));
    // The run's clock stops at the crash, so the snow keeps falling on crash time (held through the hit-stop).
    const snowTime = world.time + age;
    for (let i = 0; i < flakes; i++) {
      const fx = field.x + (((i * 0.618034 % 1) * field.w + Math.sin(snowTime * 0.9 + i) * 12) % field.w + field.w) % field.w;
      const fy = field.y + ((((i * 0.7548777 % 1) * field.h - scroll * 1.3 - snowTime * 25) % field.h) + field.h) % field.h;
      ctx.fillStyle = '#b9b4d0'; ctx.fillRect(fx + 1, fy + 1, 3, 3);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(fx, fy, 3, 3);
    }
    // A fresh slope fades up from white instead of cutting from the yeti.
    if (now - fadeAt < 350) {
      ctx.globalAlpha = 1 - ease((now - fadeAt) / 350);
      ctx.fillStyle = C.snow; ctx.fillRect(field.x, field.y, field.w, field.h);
      ctx.globalAlpha = 1;
    }
    if (!running && !crashed) {
      drawSign(ctx, field.x + field.w - 92, field.y + field.h - 50, 'WEN SNOW');
      panel(ctx, field.x + 36, field.y + field.h - 91, field.w - 72, 62, '#f1f3e7');
      const open = view.phase === 'betting' ? staked ? 'BAG LOADED. GATE OPENS SOON.' : 'GM. THE SLOPE IS OPEN.' : 'NEXT RUN LOADING...';
      text(ctx, open, field.x + field.w / 2, field.y + field.h - 68, portrait ? 19 : 20, C.ink, 'center', field.w - 100);
      text(ctx, 'CARVE • COLLECT • CASH OUT', field.x + field.w / 2, field.y + field.h - 46, 13, C.purple, 'center');
    }
    const patrolAge = (now - patrolAt) / 1000;
    // Patrol notes sit out the lift's arrival, which has its own speech bubble up there, then fade back in.
    const patrolShow = secured === null ? 1 : ease((since - 2.4) / 0.15);
    if (running && patrol && patrolAge < 2.6 && patrolShow > 0) {
      ctx.globalAlpha = patrolShow * ease(patrolAge / 0.15) * (1 - ease((patrolAge - 2.2) / 0.4));
      panel(ctx, field.x + 40, field.y + 10, field.w - 80, 30, C.ink);
      text(ctx, patrol, field.x + field.w / 2, field.y + 26, portrait ? 13 : 14, C.lime, 'center', field.w - 100);
      ctx.globalAlpha = 1;
    }
    if (crashed && previousEnding && incoming.phase === 'betting') {
      // The old ending finishes, but the frame says plainly that the next round is already open.
      panel(ctx, field.x + 30, field.y + 8, field.w - 60, 30, C.lime);
      text(ctx, 'NEXT RUN OPEN • BETTING NOW', field.x + field.w / 2, field.y + 24, 14, C.ink, 'center', field.w - 80);
    } else if (crashed && view.crashAge >= 180) {
      // The payoff reads straight after the hit-stop; the feeding and the final caption are the encore.
      const drop = (1 - ease((view.crashAge - 180) / 160)) * 60;
      const rugged = view.currentX100 <= 100 ? 'RUGGED AT THE GATE.' : `RUGGED AT ${formatX(view.currentX100)}.`;
      panel(ctx, field.x + 30, field.y + 8 - drop, field.w - 60, 50, C.pink);
      text(ctx, 'DEV WALLET: AWAKE', field.x + field.w / 2, field.y + 25 - drop, portrait ? 18 : 20, C.ink, 'center');
      text(ctx, secured !== null ? `YOU JEETED AT ${formatX(secured)}. DODGED.` : staked ? `${rugged} THE YETI SEES YOUR BAG.` : `${rugged} YOU WERE WATCHING.`,
        field.x + field.w / 2, field.y + 45 - drop, portrait ? 11 : 12, C.ink, 'center', field.w - 80);
    }
    if (crashed) {
      if (captionReady) {
        const label = secured !== null ? 'DODGED. THE YETI ATE THE PINK GUY.' : !staked ? "YOU WERE JUST WATCHING. THE YETI WASN'T."
          : world.coins ? `UNREALIZED: ${world.coins} $SLOPE → YETI` : 'BURP. DIAMOND HANDS, PAPER SKIS.';
        const bw = Math.min(field.w - 40, 470);
        panel(ctx, field.x + (field.w - bw) / 2, field.y + field.h - 91, bw, 67, secured === null ? '#eee5f6' : '#e7f3d5');
        text(ctx, secured === null ? 'GOBBLED AT ' + formatX(view.currentX100) : 'CASHED OUT AT ' + formatX(secured), field.x + field.w / 2, field.y + field.h - 66, portrait ? 23 : 25, C.ink, 'center');
        text(ctx, label, field.x + field.w / 2, field.y + field.h - 42, portrait ? 11 : 12, C.purple, 'center', bw - 20);
      }
    } else if (secured !== null && running) {
      // The regret ladder: the run goes on without you, and the frame keeps backing your exit.
      const ratio = view.currentX100 / secured;
      panel(ctx, field.x + 42, field.y + field.h - 62, field.w - 84, 46, C.lime);
      text(ctx, `BANKED ${formatX(secured)}  •  PINK GUY ${formatX(view.currentX100)}`, field.x + field.w / 2, field.y + field.h - 46, portrait ? 13 : 14, C.ink, 'center', field.w - 100);
      text(ctx, REGRET.find(([at]) => ratio >= at)![1], field.x + field.w / 2, field.y + field.h - 28, 12, C.purple, 'center', field.w - 100);
    } else if (toast && now < toastUntil) {
      panel(ctx, field.x + 42, field.y + field.h - 48, field.w - 84, 31, C.lime);
      text(ctx, toast, field.x + field.w / 2, field.y + field.h - 32, 14, C.ink, 'center');
    }
    ctx.restore();
    ctx.strokeStyle = '#9391ac'; ctx.lineWidth = 2; ctx.strokeRect(field.x, field.y, field.w, field.h);

    const status = previousEnding ? `PREVIOUS RUN • ${incoming.phase === 'betting' ? 'NEXT ROUND OPEN' : 'FINISHING'}` : secured !== null ? 'LIFT EXIT CONFIRMED' : crashed ? 'YETI HAS ENTERED CHAT' : running ? 'FULL SEND, FREN.' : 'WELCOME TO THE TRENCHES';
    // The lift banks the arcade bag; the yeti eats an unbanked one.
    const bagCoins = secured !== null ? bank.coins : eaten ? 0 : world.coins;
    const bagStyle = secured !== null ? bank.style : world.style;
    if (portrait) {
      panel(ctx, 12, 78, 280, 101, C.ink);
      text(ctx, previousEnding ? 'PREVIOUS ROUND' : crashed ? 'ROUND CRASHED' : 'ROUND MULTIPLIER', 28, 96, 15, '#c2b9e3');
      text(ctx, formatX(view.currentX100), 28, 136, 44, crashed ? C.pink : C.lime, 'left', 246);
      panel(ctx, 302, 78, 286, 101, '#ececf3');
      text(ctx, secured !== null ? 'BANKED' : eaten ? 'EATEN' : '$SLOPE', 318, 96, 16, C.purple); text(ctx, `${bagCoins}`, 568, 97, 24, C.ink, 'right');
      text(ctx, 'STYLE', 318, 123, 16, C.purple); text(ctx, String(bagStyle).padStart(5, '0'), 568, 123, 23, C.ink, 'right');
      text(ctx, 'ARCADE POINTS ONLY', 318, 149, 12, C.muted);
      text(ctx, 'SKIING NEVER MOVES THE RUG', 318, 165, 12, C.muted);
    } else {
      const x = 710, w = 236;
      panel(ctx, x, 78, w, 112, C.ink);
      text(ctx, previousEnding ? 'PREVIOUS ROUND' : crashed ? 'ROUND CRASHED' : 'ROUND MULTIPLIER', x + 14, 100, 12, '#c2b9e3');
      text(ctx, formatX(view.currentX100), x + 14, 143, 49, crashed ? C.pink : C.lime, 'left', w - 28);
      const note = secured !== null ? `EXIT ${formatX(secured)} CONFIRMED` : crashed ? staked ? 'ROUND ENDED. NGMI.' : 'ROUND ENDED. YOU WATCHED.'
        : running ? staked ? 'CASH OUT BEFORE THE CHOMP' : 'SPECTATING • NO BAG IN' : staked ? 'BAG LOADED • GATE SOON' : 'APE IN TO RIDE THE RUN';
      text(ctx, note, x + 14, 177, 10, '#ded7ed');
      panel(ctx, x, 201, w, 115, '#ececf3');
      text(ctx, secured !== null ? 'BANKED • WORTH NOTHING' : eaten ? 'COIN BAG • EATEN BY YETI' : 'COIN BAG', x + 14, 219, 11, C.purple);
      text(ctx, String(bagCoins).padStart(2, '0'), x + 14, 248, 31); text(ctx, '$SLOPE', x + w - 15, 250, 15, C.purple, 'right');
      ctx.fillStyle = '#c9c7d8'; ctx.fillRect(x + 14, 271, w - 28, 1);
      text(ctx, 'STYLE', x + 14, 292, 12, C.purple); text(ctx, String(bagStyle).padStart(5, '0'), x + w - 15, 292, 23, C.ink, 'right');
      panel(ctx, x, 327, w, 87, '#e6e8d9');
      text(ctx, 'SLOPE BULLETIN', x + 14, 345, 11, C.purple);
      const lines = beatAt(beat).news;
      text(ctx, lines[0], x + 14, 372, 12, C.ink, 'left', w - 28); text(ctx, lines[1], x + 14, 392, 12, C.ink, 'left', w - 28);
      if (cashKey) {
        panel(ctx, x, 421, w, 30, C.lime);
        text(ctx, touchOnly ? 'TAP CASH OUT = SKI LIFT' : 'SPACE = CASH OUT', x + w / 2, 437, touchOnly ? 13 : 16, C.ink, 'center');
      } else text(ctx, manual ? 'YOU ARE AT THE WHEEL.' : 'DEMO • STEER TO TAKE OVER', x + w / 2, 436, 11, C.purple, 'center');
      text(ctx, '← → CARVE   ↑ JUMP', x + w / 2, 462, 13, C.ink, 'center');
      text(ctx, 'COINS = ARCADE POINTS ONLY', x + w / 2, 480, 10, C.muted, 'center');
      text(ctx, 'SKIING NEVER MOVES THE RUG', x + w / 2, 494, 10, C.muted, 'center');
    }
    const footerY = height - 28;
    panel(ctx, 12, footerY, width - 24, 21, '#e4e3eb');
    ctx.fillStyle = crashed ? C.pink : C.purple; ctx.fillRect(19, footerY + 7, 7, 7);
    text(ctx, status, 34, footerY + 11, portrait ? 14 : 12);
    text(ctx, `${Math.floor(world.distance / 10)}m  ↓`, width - 24, footerY + 11, 12, C.purple, 'right');
    ctx.restore();
    if (Math.floor(now / 1000) !== ariaAt) {
      ariaAt = Math.floor(now / 1000);
      canvas.setAttribute('aria-label', `Rug Piste. ${previousEnding ? 'Previous round ending; current round is ' + incoming.phase + '.' : view.phase} ${formatX(view.currentX100)}. ${bagCoins} arcade coins, ${bagStyle} style points. ${manual ? 'Manual steering.' : 'Demo skiing; use arrow keys or drag to steer.'}${secured !== null ? ` Cashout confirmed at ${formatX(secured)}.` : ''}`);
    }
  }
  return { draw, dispose: () => input.dispose() };
}
