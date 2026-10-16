/**
 * Roadster to Mars: a parody of the October 2026 Roadster unveil as a crash game. The car drives up
 * the inverted ramp while the round starts, leaves the lip on cold gas, flips once it is clear, and
 * climbs the altitude ladder with the multiplier: the Semi, the FAA, the Kármán line, the ISS, the
 * Moon, Starman, Mars at 100×, then the outer planets. A confirmed cash-out deploys a parachute
 * labelled REFUNDABLE while a remote-operated ghost flies on; the crash is a rapid unscheduled
 * disassembly seeded from the crash point, and an instant crash is a launch scrubbed for weather.
 * Everything follows the displayed multiplier and the round clock; nothing here reads, predicts or
 * changes the committed outcome. Credits have no monetary value. Parody; not affiliated with anyone.
 */
import { pageAudio } from './audio';
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { AX, AY, BASE_Y, CAR_X, type Debris, H, INK, NOZZLES, type Puff, TAU, TRIMS, type Trim, W, drawCameos, drawCar, drawChute, drawEarth, drawGround, drawParticles, drawSky, emitJets, mono, puff, screenX, screenY, shred, stepParticles, worldY } from './roadster';

/** The shared shell fills this view every frame. Multipliers are in hundredths. */
export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}
export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  dispose?(): void;
}

/* ---------- The ladder: multiplier, altitude and the joke at each rung ---------- */
interface Rung { m: number; alt: number; name: string; caption: string }
const LADDER: Rung[] = [
  { m: 1, alt: 0, name: 'ON THE RAMP · McGREGOR, TEXAS', caption: 'SUCCESS IS NOT GUARANTEED' },
  { m: 1.1, alt: 2, name: 'OVER THE MODEL 3', caption: 'CLEARED THE MODEL 3. IT WAS A LEASE.' },
  { m: 1.25, alt: 3, name: 'OVER THE CYBERTRUCK', caption: 'CLEARED THE CYBERTRUCK. A PANEL FELL OFF. UNRELATED.' },
  { m: 1.4, alt: 4.5, name: 'OVER THE SEMI', caption: 'CLEARED THE SEMI. ALSO IN PRODUCTION. ALSO SINCE 2017.' },
  { m: 1.6, alt: 8, name: 'KICKFLIP ALTITUDE', caption: 'KICKFLIP. SOMEWHERE, TONY HAWK CLOSES THE APP.' },
  { m: 2, alt: 20, name: 'OVER THE BOND LOTUS', caption: 'CLEARED THE BOND LOTUS. ELON OWNS IT. OF COURSE HE DOES.' },
  { m: 2.5, alt: 150, name: 'SNAKE RIVER CANYON', caption: 'SNAKE RIVER CANYON CLEARED. THE GHOST OF EVEL KNIEVEL NODS ONCE.' },
  { m: 3.5, alt: 1524, name: '5,000 FT · TOP OF THE FAA TFR', caption: 'LEFT THE FAA RESTRICTION. LISTED PURPOSE: "HAZARDS".' },
  { m: 5, alt: 12000, name: 'CRUISING ALTITUDE', caption: 'A 737 FILES A COMPLAINT.' },
  { m: 7, alt: 39000, name: 'STRATOSPHERE', caption: 'STRATOSPHERE. FELIX BAUMGARTNER TEXTS "NICE".' },
  { m: 10, alt: 100000, name: 'KÁRMÁN LINE · TECHNICALLY SPACE', caption: 'TECHNICALLY SPACE. TECHNICALLY A CAR. THE 600 LITRES ARE GONE.' },
  { m: 15, alt: 408000, name: 'ISS FLYBY', caption: 'ISS FLYBY. THE ASTRONAUTS HAVE REQUESTED THAT YOU STOP.' },
  { m: 25, alt: 35786000, name: 'GEOSTATIONARY · STARLINK LANE', caption: 'STARLINK IS IN THE WAY. STARLINK IS ALWAYS IN THE WAY.' },
  { m: 50, alt: 384400000, name: 'THE MOON', caption: 'THE MOON. PROMISED FOR 2024. DELIVERED AT 50×.' },
  { m: 75, alt: 5e9, name: "STARMAN'S NEIGHBOURHOOD", caption: 'STARMAN WAVES. HE ALSO HAS NOT RECEIVED HIS CAR.' },
  { m: 100, alt: 2.25e11, name: 'MARS', caption: 'MARS. POPULATION: ONE CAR. THE SEAT IS EMPTY.' },
  { m: 200, alt: 4e11, name: 'ASTEROID BELT', caption: 'THE MINOR PLANET CENTER LISTS YOU AS AN ASTEROID, THEN DELETES YOU.' },
  { m: 500, alt: 7.78e11, name: 'JUPITER', caption: 'JUPITER. WHY.' },
  { m: 1000, alt: 1.43e12, name: 'SATURN', caption: 'SATURN. AIR RAN OUT 41 MINUTES AGO. THE HYPE IS SELF-SUSTAINING.' },
  { m: 3000, alt: 2.9e12, name: 'URANUS', caption: 'URANUS. THE JOKES WRITE THEMSELVES. WE WILL NOT.' },
  { m: 10000, alt: 4.5e12, name: 'NEPTUNE', caption: 'NEPTUNE. NO REFUND DESK HERE EITHER.' },
  { m: 30000, alt: 5.9e12, name: 'PLUTO', caption: 'PLUTO. STILL A PLANET, PER ELON.' },
  { m: 100000, alt: 2.4e13, name: 'VOYAGER 1', caption: 'VOYAGER 1: "YOU ARE NOT SUPPOSED TO BE HERE."' },
];
const OVERTIME = ['STILL CLIMBING. NOBODY SAID STOP.', 'THE SEAT IS STILL EMPTY.', 'PRODUCTION: 2028, ACTUALLY', 'RANGE WAS 620 MILES. MILES GOT SHORTER.', 'THE LAW DID NOT ANTICIPATE THIS', 'FLYING CARS ARE REAL', 'DEEP SPACE. NO FAA. NO ROADS. NO CAR, SOON.'];
const CRASH_REASONS = [
  'COPV DID A COPV THING. "EVERY USABLE VOID" WAS, IN FAIRNESS, FILLED.',
  'AIR RAN OUT. 27 KG PER SECOND IS A LOT OF AIR.',
  'THRUSTER 7 WAS INSTALLED FACING INWARD. THRUSTER 7 IS NOW THE MAIN CHARACTER.',
  'PRODUCTION DELAYED TO NEXT YEAR. THE CAR HEARD AND GAVE UP.',
  'FAA SAID NO. FROM THE GROUND. LOUDLY.',
  'THE YOKE WAS NEVER CONNECTED TO ANYTHING.',
  'MARQUES POSTED "THIS IS A PRANK, RIGHT?" AND THE CAR TOOK IT PERSONALLY.',
  'UNDERBODY FANS ENGAGED AT ALTITUDE. THEY PULLED 2 G TOWARD NOTHING.',
  'THE WARRANTY VOIDED ITSELF OUT OF SELF-RESPECT.',
  'FELL WITH STYLE. MOSTLY FELL.',
  'A STARLINK SATELLITE HAD THE RIGHT OF WAY.',
  'SAFETY WAS NOT THE MAIN GOAL. THE MAIN GOAL WAS ACHIEVED.',
];
const LAND_LINES = ['WELL, IT WORKED.', 'FLYING CARS ARE REAL. LANDING CARS ARE A 2029 FEATURE.', 'NOT AI OR SI. YOU SAW IT WITH YOUR OWN EYES.', 'BETTER THAN ANY BOND CAR. THE BOND CAR IS PARKED RIGHT THERE.', 'LANDED WITH STYLE. LEGALLY, A DEMONSTRATION.'];
const SCRUB_LINES = ['SEVERE WEATHER IN McGREGOR. DEPOSIT RETAINED, IN SPIRIT.', 'MOVED FROM APRIL 1 TO OCTOBER 1 TO OCTOBER 15 TO NEVER.', 'LIGHTNING WITHIN TEN MILES. HYPE WITHIN ZERO MILES.'];
const REGRET: [number, string][] = [[20, 'IT WENT TO MARS WITHOUT YOU. THE SEAT WAS EMPTY EITHER WAY.'], [5, 'COPE: SAFETY WAS NOT THE MAIN GOAL ANYWAY.'], [2, 'COULD HAVE GONE FURTHER. CHOSE THE PARKING LOT. RESPECT.'], [1.15, 'LEFT A LITTLE ON THE TABLE. THE TABLE IS ON FIRE NOW.'], [1, 'PERFECT TIMING. SUSPICIOUS, HONESTLY.']];
/** The parody hype ticker: real lines from the event and the obvious next sentence. Never real posts. */
const HYPE = {
  launch: ['Success is not guaranteed.', 'Most exciting demo ever, whether it works or not.', 'I asked myself if I was crazy. Then I stopped asking.', 'Go for launch. Crowd at 300 yards. Ears at risk.', 'I always laughed at flying cars. Now I am making one. Both can be true.'],
  flight: ['This will actually be able to fly very briefly.', 'If safety is your top priority, do not buy the Roadster.', 'We aspire not to kill anyone. Aspiration is a strong word.', 'Range is 300+ miles. It was 620. Miles got shorter.', 'The merger with SpaceX would make this easier to explain.', 'Snake River Canyon next. Evel used steam. Steam was the mistake.', 'Yoke is steer-by-wire. The wire is optional.', 'Thrusters produce 4 to 5 times the tire force. Tires have filed a grievance.', 'It may not move the needle massively from a revenue standpoint.', 'The best of the last of the human-driven cars. There is no human in it.', '$5,000 today, $45,000 within ten days, or it is gone.', 'Every usable void is a pressure vessel. Including the glovebox.', 'Not AI or SI. You saw it with your own eyes.', 'Production in 2028, actually.'],
  land: ['Well, it worked.', 'Told you.', 'Flying cars are real.', 'That is what "air ready" means.'],
  rud: ['Well.', 'Success was, as noted, not guaranteed.', 'That is a 2029 feature.', 'Data was gathered. The data is on fire.', 'This is why the seat is empty.'],
  scrub: ['Weather. Deposit remains with us.', 'October 15, actually.', 'Deniability acquired.'],
  mars: ['Mars by 2028, actually. Colony by 2030, actually. Roadster delivery after that.', 'First car on Mars. Second car when the Semi gets there.'],
};
/** The lobby: fellow reservation holders with their own landing targets, seeded per round. */
const DEGENS: { name: string; style: 'refund' | 'early' | 'mid' | 'high' | 'whale' | 'never' | 'random' }[] = [
  { name: 'Sam A. · waiting since 2018', style: 'refund' }, { name: 'Fred L. · 2 referral cars, 0 cars', style: 'early' },
  { name: 'Marques B. · "a prank, right?"', style: 'random' }, { name: 'Lars M. · 600 litres guy', style: 'mid' },
  { name: 'Founders Series #0001', style: 'whale' }, { name: 'Ghost of Evel Knievel', style: 'high' },
  { name: 'Starman · 2018-017A', style: 'never' }, { name: 'dogwifcopv', style: 'random' },
];
interface Degen { name: string; style: string; target: number; stake: number }
function lobbyFor(random: () => number): Degen[] {
  return DEGENS.map((d) => {
    const u = random() || 1e-9;
    let target: number;
    switch (d.style) {
      case 'refund': target = 1.01 + random() * 0.15; break;
      case 'early': target = 1.05 + random() * 0.4; break;
      case 'mid': target = 1.5 + random() * 1.5; break;
      case 'high': target = 3 - Math.log(u) * 4; break;
      case 'whale': target = 1.2 - Math.log(u) * 1.5; break;
      case 'never': target = Infinity; break;
      default: target = 1.05 - Math.log(u) * 1.3;
    }
    const stake = d.style === 'whale' ? 250000 : d.style === 'refund' ? 50000 : [500, 1000, 2500, 5000, 10000][Math.floor(random() * 5)];
    return { name: d.name, style: d.style, target: Math.floor(target * 100) / 100, stake };
  });
}

const AIR_LITRES = 600;
/** The launch choreography runs on the round clock: drive, ramp, straight up; then it blends into flight. */
const LAUNCH_S = 1.7, BLEND0 = 1.6, BLEND1 = 2.2;
/** One slow flip as a function of the multiplier, so a replay turns at the same moment on any room curve. */
const FLIP_AT = 1.335, FLIP_END = 1.5;
const FREEZE_S = 0.15, SLOW_S = 0.4;
const COLOURS = { text: '#f2f1ec', muted: '#8b96ad', gas: '#bfe8ff', gold: '#f3c969', mars: '#e2552a', green: '#5fd38d' };
const formatX = (x100: number): string => `${(x100 / 100).toFixed(2)}×`;
const grouped = (n: number): string => Math.round(n).toLocaleString('en-US');

function fmtAlt(alt: number): string {
  if (alt < 10) return `${alt.toFixed(1)} M`;
  if (alt < 1000) return `${Math.round(alt)} M`;
  if (alt < 1e4) return `${(alt / 1000).toFixed(1)} KM`;
  if (alt < 1e9) return `${grouped(alt / 1000)} KM`;
  if (alt < 1e10) return `${(alt / 1e9).toFixed(1)} MILLION KM`;
  return `${grouped(alt / 1e9)} MILLION KM`;
}
/** Altitude interpolated in log space between rungs. */
export function altitudeFor(m: number): number {
  if (m <= 1) return 0;
  let i = 0;
  while (i < LADDER.length - 1 && LADDER[i + 1].m <= m) i++;
  const a = LADDER[i], b = LADDER[Math.min(i + 1, LADDER.length - 1)];
  if (a === b) return a.alt * (m / a.m);
  const f = (Math.log(m) - Math.log(a.m)) / (Math.log(b.m) - Math.log(a.m));
  return Math.expm1(mix(Math.log1p(a.alt), Math.log1p(b.alt), f));
}
const rungCount = (m: number): number => LADDER.filter((r) => m >= r.m).length;
/** 0 before the flip, 1 after: eased on the multiplier between FLIP_AT and FLIP_END. */
export function flipTurn(m: number): number {
  const f = clamp(Math.log(m / FLIP_AT) / Math.log(FLIP_END / FLIP_AT), 0, 1);
  return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
}
export interface Pose { x: number; y: number; a: number }
/** The car in world units (y up) from the multiplier and the round clock: the launch, then the climb. */
export function carPose(m: number, elapsedS: number): Pose {
  const u = clamp(elapsedS / LAUNCH_S, 0, 1);
  let launch: Pose;
  if (u < 0.5) launch = { x: mix(60, 330, u / 0.5), y: 0, a: 0 };
  else if (u < 0.85) { const phi = (u - 0.5) / 0.35 * Math.PI / 2; launch = { x: 330 + 110 * Math.sin(phi), y: 110 - 110 * Math.cos(phi), a: -phi }; }
  else launch = { x: CAR_X, y: 110 + 20 * (u - 0.85) / 0.15, a: -Math.PI / 2 };
  const settle = smoothstep(BLEND0, BLEND1 + 0.3, elapsedS);
  const flight: Pose = {
    x: CAR_X + 120 * clamp(Math.log(m) / Math.log(1.6), 0, 1),
    y: worldY(m) + Math.sin(elapsedS * 3.3) * 3,
    a: -Math.PI / 2 + (0.35 + Math.sin(elapsedS * 2.4) * 0.06) * settle - TAU * flipTurn(m),
  };
  const b = smoothstep(BLEND0, BLEND1, elapsedS);
  return { x: mix(launch.x, flight.x, b), y: mix(launch.y, flight.y, b), a: mix(launch.a, flight.a, b) };
}
export const cameraFor = (m: number, elapsedS: number): number => mix(BASE_Y, worldY(m), smoothstep(BLEND0, BLEND1, elapsedS));

function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  ctx.letterSpacing = `${Math.round(size * 0.06)}px`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.1); ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill; ctx.fillText(text, x, y, maxWidth);
  ctx.letterSpacing = '0px';
}

/* ---------- Session state that outlives a scene: the production year, Mars landings, the trim ---------- */
interface Persist { prodYear: number; actuallys: number; mars: number; invited: boolean; trim: Trim }
const SAVE_KEY = 'roadster-to-mars.v1';
const persist: Persist = { prodYear: 2028, actuallys: 1, mars: 0, invited: false, trim: 'performance' };
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const saved = JSON.parse(raw) as Partial<Persist>;
    if (Number.isSafeInteger(saved.prodYear) && saved.prodYear! >= 2028 && saved.prodYear! < 2300) persist.prodYear = saved.prodYear!;
    if (Number.isSafeInteger(saved.actuallys) && saved.actuallys! >= 1 && saved.actuallys! < 300) persist.actuallys = saved.actuallys!;
    if (Number.isSafeInteger(saved.mars) && saved.mars! >= 0) persist.mars = saved.mars!;
    persist.invited = saved.invited === true;
    if (saved.trim === 'thrust' || (saved.trim === 'rocket' && persist.invited)) persist.trim = saved.trim;
  }
} catch { /* a sandboxed frame has no storage; the counters live for the session */ }
function save(): void { try { localStorage.setItem(SAVE_KEY, JSON.stringify(persist)); } catch { /* same */ } }
const mode = (): string => document.documentElement.dataset.mode ?? 'standalone';
const prodLabel = (): string => `${persist.prodYear}, ACTUALLY${persist.actuallys > 1 ? ` ×${persist.actuallys}` : ''}`;
let rounds = 0;

/* ---------- The scene ---------- */
type Outcome = 'rud' | 'landed' | 'scrubbed' | 'watched';
interface Secured { x100: number; payout: number | null }
interface Pod { x: number; y: number; vx: number; vy: number; chute: ReturnType<typeof spring>; age: number; angle: ReturnType<typeof spring> }
const regretFor = (ratio: number): string => (REGRET.find(([at]) => ratio >= at) ?? REGRET[REGRET.length - 1])[1];

export function createScene(): Scene {
  // clips.json is empty: the shared helper makes all sounds locally, opt-in, and owns its page lifecycle.
  const audio = pageAudio({ style: 'synthwave', crash: 'boom' });
  const pop = spring(0), badge = spring(0), punch = spring(0), captionPop = spring(0), camS = spring(BASE_Y);
  /** Ambient jitter for puffs and dust; the wreckage has its own seeded generator. */
  const random = mulberry32(0x5eed);
  let last: number | null = null;
  let previous: SceneView['phase'] | null = null;
  let time = 0, rung = 0, shake = 0, freeze = 0, slow = 0, wheelRot = 0, lastX = 60, noteAge = 9;
  /** Seconds since the burst; -1 while the car is whole. */
  let fire = -1;
  let burstAt = { x: CAR_X, y: BASE_Y };
  let outcome: Outcome | null = null, reason = '', note = '';
  let secured: Secured | null = null;
  let pod: Pod | null = null;
  let flipped = false, marsNow = false;
  const particles: Puff[] = [], debris: Debris[] = [];
  const trail: { x: number; y: number }[] = [];
  let lobby = lobbyFor(mulberry32(0xd0de));

  // The game's own control: which thrusters the car shows. The room's chain owns the pace.
  const trimButton = document.querySelector<HTMLButtonElement>('#trim');
  const labelTrim = (): void => { if (trimButton) trimButton.textContent = `Trim: ${TRIMS[persist.trim].label}${!persist.invited ? ' · Rocket invite only' : ''}`; };
  const onTrim = (): void => {
    const order: Trim[] = persist.invited ? ['performance', 'thrust', 'rocket'] : ['performance', 'thrust'];
    persist.trim = order[(order.indexOf(persist.trim) + 1) % order.length];
    save(); labelTrim();
    note = TRIMS[persist.trim].note; noteAge = 0;
    audio.fx('click', 0.6);
  };
  trimButton?.addEventListener('click', onTrim);
  labelTrim();

  function burst(view: SceneView, quiet: boolean): void {
    const scrubbed = view.currentX100 <= 100;
    outcome = scrubbed ? 'scrubbed' : view.stake === null ? 'watched' : secured ? 'landed' : 'rud';
    const seed = Math.floor(view.currentX100);
    reason = scrubbed ? SCRUB_LINES[seed % SCRUB_LINES.length] : CRASH_REASONS[seed % CRASH_REASONS.length];
    fire = quiet ? 4 : 0;
    audio.crash(scrubbed ? 'trombone' : 'boom', quiet);
    if (quiet) { pop.x = 1; return; }
    pop.v = 16;
    if (!scrubbed) {
      const p = carPose(view.currentX100 / 100, view.elapsed / 1000);
      burstAt = { x: p.x, y: p.y };
      shred(particles, debris, p.x, p.y, view.currentX100);
      freeze = FREEZE_S; slow = SLOW_S; shake = 1; settleSpring(punch, 1);
    }
    // Every live crash slips production another year. Replays change nothing.
    if (mode() !== 'replay') { persist.prodYear += 1; persist.actuallys += 1; save(); }
  }

  function hypeLine(view: SceneView, m: number, next: number): string {
    const seed = Math.floor(view.currentX100);
    if (view.phase === 'crashed') return outcome === 'scrubbed' ? HYPE.scrub[seed % HYPE.scrub.length] : HYPE.rud[seed % HYPE.rud.length];
    if (view.phase !== 'running') return HYPE.launch[rounds % HYPE.launch.length];
    if (secured) return HYPE.land[Math.floor(secured.x100) % HYPE.land.length];
    if (m >= 100) return HYPE.mars[next % HYPE.mars.length];
    return HYPE.flight[(next * 5 + rounds) % HYPE.flight.length];
  }

  function drawTrail(ctx: CanvasRenderingContext2D, cam: number): void {
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 1; i < trail.length; i++) {
      const k = i / trail.length;
      ctx.strokeStyle = `rgba(233,246,255,${k * 0.35})`; ctx.lineWidth = 1 + k * 5;
      ctx.beginPath(); ctx.moveTo(screenX(trail[i - 1].x), screenY(trail[i - 1].y, cam)); ctx.lineTo(screenX(trail[i].x), screenY(trail[i].y, cam)); ctx.stroke();
    }
    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the burst frame, then plays slow.
    let dt = real;
    if (freeze > 0) { freeze -= real; dt = 0; } else if (slow > 0) { slow -= real; dt = real * 0.3; }
    const running = view.phase === 'running', crashed = view.phase === 'crashed', idle = !running && !crashed;
    const m = Math.max(1, view.currentX100 / 100);
    const elapsedS = view.elapsed / 1000;
    time = running ? elapsedS : time + dt;
    noteAge += real;
    // 0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×: presentation only, never a crash prediction.
    const tension = 1 - 1 / m;
    const fresh = previous === null;
    const next = rungCount(m);
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (!fresh && !crashed) {
        const p = carPose(m, elapsedS);
        pod = { x: p.x, y: p.y, vx: -70, vy: 90, chute: spring(0), age: 0, angle: spring(0) };
        audio.cashout();
      }
    }
    if (fresh) {
      // A first frame mid-round settles into it.
      previous = view.phase; rung = next; flipped = m >= FLIP_END; marsNow = m >= 100;
      settleSpring(badge, secured ? 1 : 0); settleSpring(camS, idle ? BASE_Y : cameraFor(m, elapsedS));
      if (crashed) burst(view, true);
    } else if (view.phase !== previous) {
      if (crashed && fire < 0) burst(view, view.crashAge > 1500);
      if (running && previous === 'betting') { audio.fx('engine', 1); shake = 0.25; }
      if (idle) {
        // A new round: the camera dives back to the pad and the last round's leftovers clear.
        rounds += 1;
        rung = 0; shake = freeze = slow = 0; fire = -1; outcome = null; secured = null; pod = null; flipped = marsNow = false;
        particles.length = 0; debris.length = 0; trail.length = 0;
        lobby = lobbyFor(mulberry32(mode() === 'replay' ? 0xd0de : (0xd0de + rounds * 7919) >>> 0));
        settleSpring(pop, 0); settleSpring(badge, 0); settleSpring(punch, 0);
        wheelRot = 0; lastX = 60;
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    if (running && next > rung) {
      for (let k = rung + 1; k <= next; k += 1) {
        audio.milestone(k);
        const r = LADDER[k - 1];
        if (r.m === 3.5) audio.fx('gasp', 0.5);
        if (r.m === 100) { audio.fx('cheer', 0.8); audio.fx('ding', 0.8); }
      }
      captionPop.v = 10;
      rung = next;
    }
    if (running && !flipped && m >= FLIP_AT) { flipped = true; audio.fx('whoosh', 0.7); }
    if (running && !fresh && mode() !== 'replay') {
      if (m >= 10 && !persist.invited) { persist.invited = true; save(); labelTrim(); note = 'INVITE RECEIVED: ROCKET TRIM UNLOCKED. SEATS ONE. NOT ROAD LEGAL. PERFECT.'; noteAge = 0; audio.fx('buzz', 0.5); }
      // Mars counts for the car you are still in: a flight you landed early, or only watched, went there without you.
      if (m >= 100 && !marsNow) { marsNow = true; if (view.stake !== null && !secured) { persist.mars += 1; persist.prodYear = 2028; persist.actuallys = 1; save(); } }
    }

    const cam = idle ? stepSpring(camS, BASE_Y, 7, 1, dt).x : settleSpring(camS, cameraFor(m, elapsedS)).x;
    const launching = running && elapsedS < LAUNCH_S;
    const onGround = idle || elapsedS < LAUNCH_S * 0.5;
    const p: Pose = idle ? { x: 60, y: Math.sin(time * 2) * 0.6, a: 0 } : carPose(m, elapsedS);
    if (onGround) wheelRot += (p.x - lastX) / 6;
    lastX = p.x;
    if (launching && onGround && dt > 0 && random() < dt * 40) puff(particles, 'dust', p.x - 30 + random() * 10, 2, -60 - random() * 80, 40 + random() * 60, 0.6, 2 + random() * 2);
    const noz = NOZZLES[persist.trim];
    const jets = running && !secured && elapsedS >= LAUNCH_S * 0.85;
    if (jets && dt > 0) {
      if (noz.length) emitJets(particles, p.x, p.y, p.a, noz, Math.floor(dt * 16 * noz.length * (launching ? 1.6 : 1) + random()), random);
      else if (random() < dt * 9) puff(particles, 'hype', p.x + (random() - 0.5) * 40, p.y - 14, (random() - 0.5) * 40, -70 - random() * 70, 0.9, 2);
    }
    if (running && !secured && elapsedS > LAUNCH_S && dt > 0) { trail.push({ x: p.x, y: p.y - 4 }); if (trail.length > 70) trail.shift(); }
    if (pod) {
      // Off the car with a kick, then the chute: drag to a slow descent while the camera keeps climbing.
      const steps = Math.max(1, Math.ceil(dt / 0.008)), h = dt / steps, before = pod.age;
      for (let i = 0; i < steps; i++) {
        pod.age += h; stepSpring(pod.chute, pod.age > 0.55 ? 1 : 0, 10, 0.75, h);
        const open = clamp(pod.chute.x, 0, 1);
        pod.vy += (-420 * (1 - open) + (-55 - pod.vy) * open * 4) * h;
        pod.vx *= Math.exp(-(0.3 + open * 1.2) * h);
        pod.x += pod.vx * h; pod.y += pod.vy * h;
        stepSpring(pod.angle, -pod.vx * 0.0015 * open, 5, 0.55, h);
      }
      if (before <= 0.55 && pod.age > 0.55) audio.fx('pop', 1);
      if (screenY(pod.y, cam) > H + 120) pod = null;
    }
    stepParticles(particles, debris, dt);
    if (fire >= 0) fire += dt;
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, 0, 6, 1, dt);
    stepSpring(captionPop, 0, 12, 0.6, dt);

    ctx.save();
    {
      const rumble = running && !secured ? 0.4 + 2.5 * tension : 0;
      ctx.translate(Math.sin(time * 140) * (9 * shake * shake + rumble), Math.cos(time * 117) * (6 * shake * shake + rumble));
      // The burst punches in through the hit-stop; the flip zooms a touch, on the multiplier.
      const turn = running ? clamp(Math.log(m / FLIP_AT) / Math.log(FLIP_END / FLIP_AT), 0, 1) : 0;
      const zoom = 1 + 0.1 * punch.x + 0.06 * Math.sin(Math.PI * turn);
      ctx.translate(AX, AY); ctx.scale(zoom, zoom); ctx.translate(-AX, -AY);
    }
    drawSky(ctx, m, cam, time);
    drawEarth(ctx, m, time);
    drawCameos(ctx, cam, m, time);
    drawGround(ctx, cam, time, outcome === 'scrubbed');
    drawTrail(ctx, cam);
    drawParticles(ctx, particles, debris, cam, 'back');
    const sx = screenX(p.x), sy = screenY(p.y, cam), flicker = noise(Math.floor(time * 40));
    // Wheels on the pavement until the lip; the offset blends out as the launch becomes the flight.
    const lift = idle ? 14 : 14 * (1 - smoothstep(BLEND0, BLEND1, elapsedS));
    if (idle) drawCar(ctx, sx, sy - lift, 0, 1, { shadow: true, wheelRot, blink: true, flicker, nozzles: noz });
    else if (fire < 0) {
      if (running && m > FLIP_AT && m < FLIP_END) for (const d of [0.8, 0.4]) drawCar(ctx, sx, sy - lift, p.a + d, 0.2, {});
      if (secured && !crashed) { drawCar(ctx, sx, sy, p.a, 0.7, { ghost: true, nozzles: noz, thrust: 0.6, flicker }); mono(ctx, 'REMOTE-OPERATED', sx, sy + 26, 9, 'rgba(242,241,236,.6)', 'center'); }
      else drawCar(ctx, sx, sy - lift, p.a, 1, { shadow: onGround, wheelRot, thrust: jets ? 1 : 0, nozzles: noz, flicker });
    } else if (outcome === 'scrubbed') drawCar(ctx, screenX(CAR_X), screenY(BASE_Y, cam), -Math.PI / 2, 1, { nozzles: noz, blink: true, flicker });
    if (pod) { const px = screenX(pod.x), py = screenY(pod.y, cam); drawChute(ctx, px, py, pod.chute.x); drawCar(ctx, px, py, pod.angle.x, 1, { nozzles: noz }); }
    drawParticles(ctx, particles, debris, cam, 'front');
    if (fire >= 0 && fire < 0.7 && outcome !== 'scrubbed') {
      // The shockwave, then the flash, from the burst clock.
      const k = fire / 0.7;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,230,190,${(1 - k) * 0.8})`; ctx.lineWidth = 14 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(screenX(burstAt.x), screenY(burstAt.y, cam), 20 + k * 520, 0, TAU); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    if (fire >= 0 && fire < 0.3 && outcome !== 'scrubbed') { ctx.fillStyle = `rgba(255,245,230,${(0.3 - fire) * 2.5})`; ctx.fillRect(0, 0, W, H); }

    // The stamps.
    if (running && elapsedS < 0.6) { ctx.globalAlpha = 1 - elapsedS / 0.6; memeText(ctx, 'GO FOR LAUNCH', 480, 150, 36, COLOURS.gas, 'center'); ctx.globalAlpha = 1; }
    const marsA = smoothstep(100, 101, m) * (1 - smoothstep(108, 114, m));
    if (marsA > 0 && !outcome) {
      ctx.globalAlpha = marsA; memeText(ctx, 'MARS', 480, 190, 96, COLOURS.gold, 'center');
      mono(ctx, view.stake !== null && !secured ? 'FIRST CAR ON MARS. FLAG PLANTED. PRODUCTION RESET TO 2028, ACTUALLY.' : 'FIRST CAR ON MARS. IT WENT WITHOUT YOU. THE FLAG IS STILL NICE TO LOOK AT.', 480, 214, 13, COLOURS.text, 'center', 500, 860);
      ctx.globalAlpha = 1;
    }
    if (pop.x > 0.02 && outcome) {
      const s = Math.min(pop.x, 1.25);
      const [word, colour, size] = outcome === 'rud' ? ['RAPID UNSCHEDULED DISASSEMBLY', COLOURS.mars, 54] as const : outcome === 'landed' ? ['WELL, IT WORKED.', COLOURS.green, 64] as const : outcome === 'scrubbed' ? ['LAUNCH SCRUBBED', COLOURS.mars, 64] as const : ['WATCHED IT FALL', COLOURS.muted, 56] as const;
      ctx.fillStyle = 'rgba(10,13,20,.5)'; ctx.fillRect(60, 268, 840, 54);
      ctx.save(); ctx.translate(480, 250); ctx.scale(s, s); memeText(ctx, word, 0, 0, size, colour, 'center', 880); ctx.restore();
      const sub = outcome === 'landed' && secured ? `YOU LANDED AT ${formatX(secured.x100)}${secured.payout !== null ? ` FOR ${grouped(secured.payout)} CREDITS` : ''}. THE FLIGHT CONTINUED TO ${formatX(view.currentX100)}.` : reason;
      mono(ctx, sub, 480, 288, 14, COLOURS.text, 'center', 500, 880);
      const foot = outcome === 'landed' && secured ? regretFor(view.currentX100 / secured.x100) : outcome === 'rud' ? `−${grouped(view.stake ?? 0)} CREDITS · PRODUCTION: ${prodLabel()}` : outcome === 'scrubbed' ? `${view.stake !== null ? `−${grouped(view.stake)} CREDITS · ` : ''}PRODUCTION: ${prodLabel()}` : `NO CREDITS RIDING · PRODUCTION: ${prodLabel()}`;
      mono(ctx, foot, 480, 310, 12, 'rgba(242,241,236,.8)', 'center', 500, 880);
    }

    // The HUD: telemetry top-left, the lobby top-right, the caption and the ticker along the foot.
    ctx.fillStyle = 'rgba(10,13,20,.55)'; ctx.fillRect(16, 16, 250, 120);
    const multColour = outcome === 'rud' || outcome === 'scrubbed' ? COLOURS.mars : secured ? COLOURS.green : m >= 100 ? '#ff9a4d' : m >= 50 ? '#ffd27a' : m >= 10 ? COLOURS.gold : COLOURS.text;
    ctx.save(); ctx.translate(28, 70); const cs = 1 + 0.12 * clamp(captionPop.x, 0, 1); ctx.scale(cs, cs); mono(ctx, formatX(view.currentX100), 0, 0, 52, multColour, 'left', 800, 226); ctx.restore();
    mono(ctx, idle ? LADDER[0].name : `${fmtAlt(altitudeFor(m))} · ${LADDER[Math.max(0, next - 1)].name}`, 28, 94, 11, COLOURS.text, 'left', 500, 230);
    const air = clamp(1 - Math.log(m) / Math.log(10), 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(28, 104, 120, 6); ctx.strokeStyle = '#243149'; ctx.lineWidth = 1; ctx.strokeRect(28.5, 104.5, 120, 6);
    ctx.fillStyle = COLOURS.gas; ctx.fillRect(28, 104, 120 * air, 6);
    mono(ctx, air > 0 ? `${Math.round(air * AIR_LITRES)} L COLD GAS` : 'RUNNING ON HYPE', 156, 110, 9, COLOURS.text, 'left');
    mono(ctx, `PRODUCTION ${prodLabel()} · MARS LANDINGS ${persist.mars}`, 28, 128, 9, COLOURS.muted, 'left', 500, 230);
    ctx.fillStyle = 'rgba(10,13,20,.55)'; ctx.fillRect(690, 16, 254, 150);
    mono(ctx, idle ? 'RESERVATION HOLDERS · SINCE 2017' : 'RESERVATION HOLDERS IN THIS FLIGHT', 700, 32, 9, COLOURS.muted, 'left', 600);
    lobby.forEach((d, i) => {
      const y = 48 + i * 15;
      mono(ctx, d.name, 700, y, 10, 'rgba(242,241,236,.85)', 'left', 500, 150);
      let st = 'waiting', col = COLOURS.muted;
      if (!idle) {
        if (m >= d.target) { st = `landed ${d.target.toFixed(2)}×`; col = COLOURS.green; }
        else if (crashed) { st = d.style === 'never' ? 'still out there' : outcome === 'scrubbed' ? 'scrubbed' : 'RUD'; col = COLOURS.mars; }
        else { st = `${grouped(d.stake)} · in`; col = COLOURS.gas; }
      }
      mono(ctx, st, 934, y, 10, col, 'right');
    });
    if (secured && badge.x > 0.02 && !outcome) {
      ctx.save(); ctx.translate(480, 458); const b = Math.min(badge.x, 1.15); ctx.scale(b, b);
      memeText(ctx, `LANDED ${formatX(secured.x100)}${secured.payout !== null ? ` · +${grouped(secured.payout)} CREDITS` : ''} · REFUNDABLE`, 0, 0, 24, COLOURS.green, 'center', 880); ctx.restore();
    }
    const caption = noteAge < 3 ? note : idle ? (view.phase === 'betting' ? 'GO FOR LAUNCH · WEATHER PERMITTING' : 'WAITING FOR A ROUND · PRODUCTION 2028, ACTUALLY') : next >= LADDER.length ? OVERTIME[Math.floor(elapsedS / 8) % OVERTIME.length] : LADDER[Math.max(0, next - 1)].caption;
    if (idle && noteAge >= 3) memeText(ctx, caption, 480, 236, 26, COLOURS.text, 'center', 900);
    else {
      ctx.fillStyle = 'rgba(10,13,20,.45)'; ctx.fillRect(0, 472, W, 34);
      ctx.save(); ctx.translate(480, 496); const cp = 1 + 0.08 * clamp(captionPop.x, 0, 1); ctx.scale(cp, cp); memeText(ctx, caption, 0, 0, 20, COLOURS.text, 'center', 900); ctx.restore();
    }
    ctx.fillStyle = 'rgba(10,13,20,.8)'; ctx.fillRect(0, 506, W, 34);
    mono(ctx, 'HYPE TICKER · PARODY · NOT REAL POSTS', 16, 527, 9, COLOURS.mars, 'left', 600);
    mono(ctx, `@not_elon  ${hypeLine(view, m, next)}`, 262, 527, 12, COLOURS.text, 'left', 500, 680);
  }

  return { draw, dispose: () => trimButton?.removeEventListener('click', onTrim) };
}
