import { portrait } from './portrait';
/**
 * Composes King of the Hill from the room state: the altitude sky, the
 * bonding-curve hill, the coin, the ape, the Lambo that collects him on an
 * accepted exit, the community that keeps pushing after he leaves, then the
 * HUD. All motion is stepped here with the real frame time, and nothing
 * drawn here changes the committed outcome.
 */
import { type AirdropState, createAirdrop, drawAirdrop, resetAirdrop, sendPlane, stepAirdrop } from './airdrop';
import { type ApeAnchor, type ApeState, DODGE_S, SQUASH_S, apeGap, apeHead, boardApe, brace, createApe, dodgeApe, drawApe, exitApe, flattenApe, frameApe, resetApe, stepApe } from './ape';
import { pageAudio } from './audio';
import { type CoinDrive, type CoinState, coinPose, crashCoin, createCoin, drawCoin, settleCoin, stepCoin } from './coin';
import { type DevState, cloudAt, createDev, drawDev, feintDev, pullLever, resetDev, settleDev, stepDev } from './dev';
import { type Camera, type Point, drawHill, drawSky, heightAt, slopeAngle, toScreen } from './hill';
import { clamp, mix, noise, settleSpring, spring, stepSpring } from './motion';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a crash missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const W = 960;
const INK = '#1c1f26';
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The multiplier readout's right edge, and the width past which it is squeezed rather than run into the caption. */
const READOUT_X = 930;
const READOUT_MAX = 300;
/** The centre line of the caption and the secured badge. */
const CAPTION_X = 430;
/** World px up the hill per doubling of the multiplier. */
const PX_PER_DOUBLING = 620;
const TICKER = '$CRASH';
/** The flash over each holder who bails, by how many have bailed this round. */
const JEET_LINES = ['JEETED', 'PAPER HANDS', 'SEE YA NERD', 'SOLD FOR A SANDWICH', 'NGMI'];
/** The multipliers a milestone stinger plays at (the caption ladder); the airdrop plane comes from the second on. */
const RUNGS = [1.3, 1.6, 2.5, 4, 6, 12, 25];
const PLANE_FROM = 2;
/**
 * The crash's choreography: the dev grabs the lever and yanks it over, the coin lets go as it goes over (the fuse,
 * at most FUSE_S) and rolls back; when it first touches the ape the picture holds for a hit-stop with a punch-in,
 * and the squash into the pancake runs slow before time catches up.
 */
const FUSE_S = 0.4;
const FREEZE_S = 0.15;
const PUNCH_HOLD_S = 0.3;
const PUNCH_ZOOM = 0.1;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;
/** Past this, a crash that has not reached the ape yet lands anyway, so the payoff reads inside the crash hold. */
const LAND_BY_S = 1.5;
/** The multipliers the dev feints for the lever at; from 51 s on he does it every 12 s, between the overtime captions. */
const FEINTS = [1.8, 2.8, 4.5, 8, 15];
/** How far behind its stop the Lambo starts when he cashes out, so it pulls up within about a second. */
const LAMBO_LEAD = 380;
/** How far downhill of the coin the community starts its run in when he cashes out: just out of the picture. */
const CREW_RUN = 420;
const CONFETTI = ['#ff4d6d', '#7cf67c', '#8fd3ff', '#ffe27a', '#c084fc'];
/** rekt: the player rode it down; called: the player cashed out first; rugged: a spectator watched anon ride it down. */
type Outcome = 'rekt' | 'called' | 'rugged';
type Secured = { x100: number; payout: number | null };
type LamboMode = 'none' | 'arriving' | 'waiting' | 'leaving';
interface Confetti { x: number; y: number; vx: number; vy: number; angle: number; spin: number; colour: string; age: number; life: number }

function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.13);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["THE SUMMIT MOVED AGAIN", "ANOTHER AIRDROP, SAME HILL", "UPHILL BOTH WAYS", "THE DEV PACKED A LUNCH", "THE MOON HAS ANOTHER HILL", "KEEP THE COIN ROLLING", "ALTITUDE: UNREASONABLE", "SISYPHUS WORKS OVERTIME"];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null, left: boolean): string {
  if (outcome) return outcome === 'rekt' ? 'DEV SOLD ON YOUR HEAD' : outcome === 'called' ? 'GOOD LUCK, COMMUNITY' : 'DEV SOLD ON ANON';
  if (view.phase !== 'running') return 'WEN LAUNCH?';
  if (secured) {
    // The exit, the community takeover, then a short regret ladder while the coin keeps going without him.
    const ratio = view.currentX100 / secured.x100;
    if (!left) return 'JEETED RESPONSIBLY';
    return ratio >= 10 ? 'STILL UP. TOUCH GRASS' : ratio >= 3 ? 'PROFIT IS PROFIT, SER' : ratio >= 1.5 ? 'NO REGRETS (SOME REGRETS)' : "IT'S A CTO NOW";
  }
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  if (multiplier < 1.3) return 'PUSH IT';
  if (multiplier < 1.6) return 'SISYPHUS BUT DEGEN';
  if (multiplier < 2.5) return 'KING OF THE HILL';
  if (multiplier < 4) return 'WEN GRADUATION';
  if (multiplier < 6) return 'GRADUATED';
  if (multiplier < 12) return 'DEV IS WATCHING';
  return "DEV'S FINGER ON SELL";
}

function formatMcap(multiplier: number): string {
  const usd = 5000 * Math.pow(multiplier, 1.9);
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  return `$${(usd / 1e3).toFixed(1)}K`;
}

/** How many feints the dev owes by this point of the round: the FEINTS ladder, then one every 12 s from 51 s. */
const feintsDue = (multiplier: number, elapsed: number): number => FEINTS.filter((m) => multiplier >= m).length + (elapsed >= 51_000 ? Math.floor((elapsed - 51_000) / 12_000) + 1 : 0);

/** A lime Lambo on the slope, drawn in the slope's frame at a world x. */
function drawLambo(ctx: CanvasRenderingContext2D, cam: Camera, x: number, wheelSpin: number, apeInside: boolean): void {
  const p = toScreen(cam, { x, y: heightAt(x) });
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-slopeAngle(x));
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#b6ff3b';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-78, -6); ctx.lineTo(-74, -20); ctx.lineTo(-40, -24); ctx.lineTo(-12, -42); ctx.lineTo(30, -42); ctx.lineTo(58, -24); ctx.lineTo(80, -18); ctx.lineTo(82, -6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#233';
  ctx.beginPath(); ctx.moveTo(-8, -40); ctx.lineTo(28, -40); ctx.lineTo(50, -25); ctx.lineTo(-30, -25); ctx.closePath(); ctx.fill();
  if (apeInside) {
    ctx.fillStyle = '#3b2f2f';
    ctx.beginPath(); ctx.arc(14, -32, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9b99b';
    ctx.beginPath(); ctx.ellipse(16, -30, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#7bd12a';
  ctx.beginPath(); ctx.roundRect(-84, -30, 14, 5, 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-76, -20); ctx.lineTo(-76, -30); ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  ctx.fillRect(74, -16, 8, 5);
  for (const wx of [-46, 46]) {
    ctx.beginPath(); ctx.arc(wx, -2, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1b1f'; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(wx, -2); ctx.rotate(wheelSpin);
    ctx.strokeStyle = '#c9d1d9'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 5; i += 1) { const a = (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
}

/** Where the three community pushers stand behind the coin, `back` px further downhill while they run in. */
const crewAt = (contactX: number, r: number, back: number): number[] => [0, 1, 2].map((i) => contactX - (r + 30 + i * 26) * Math.cos(slopeAngle(contactX)) - back);

/** How far the coin's rim is from the nearest community pusher's body or head: it has reached them at zero or less. */
function crewGap(xs: number[], centre: Point, r: number): number {
  let gap = Infinity;
  for (const x of xs) {
    const a = slopeAngle(x), y = heightAt(x);
    // Their body and head, in the slope frame they are drawn in (along, up); their hands touch the rim already.
    for (const [u, v] of [[3, 18], [7, 32]] as const) gap = Math.min(gap, Math.hypot(centre.x - x - u * Math.cos(a) + v * Math.sin(a), centre.y - y - u * Math.sin(a) - v * Math.cos(a)) - 6);
  }
  return gap - r;
}

/** Tiny community pushers who take over when the ape lets go; their legs cycle with the distance they cover. */
function drawCommunity(ctx: CanvasRenderingContext2D, cam: Camera, xs: number[], stride: number, flattened: boolean): void {
  for (const [i, x] of xs.entries()) {
    const p = toScreen(cam, { x, y: heightAt(x) });
    const phase = stride + i * 1.7;
    const bob = flattened ? 0 : Math.abs(Math.sin(phase)) * 2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-slopeAngle(x));
    if (flattened) { ctx.scale(1.3, 0.2); }
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const side of [0, Math.PI]) { ctx.moveTo(1, -10 - bob); ctx.lineTo(1 + Math.sin(phase + side) * 6, -Math.max(0, Math.cos(phase + side)) * 4); }
    ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(1, -10 - bob); ctx.lineTo(5, -26 - bob); ctx.stroke();
    ctx.strokeStyle = ['#e63946', '#3b82f6', '#7cf67c'][i]!; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(5, -22 - bob); ctx.lineTo(17, -18 - bob); ctx.moveTo(5, -18 - bob); ctx.lineTo(16, -12 - bob); ctx.stroke();
    ctx.beginPath(); ctx.arc(7, -32 - bob, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f3dccb'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}

/** The player's marker over the ape (YOU), or anon's for a spectator. */
function drawTag(ctx: CanvasRenderingContext2D, at: Point, text: string, fill: string, scale: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(scale, scale);
  ctx.font = `900 15px ${MEME_FONT}`;
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(-w / 2, -26, w, 20, 6); ctx.moveTo(-6, -6.5); ctx.lineTo(0, 1); ctx.lineTo(6, -6.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, -15.5);
  ctx.restore();
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'slam' });
  const coin: CoinState = createCoin();
  const ape: ApeState = createApe();
  const dev: DevState = createDev();
  const airdrop: AirdropState = createAirdrop();
  const cam = { x: spring(60), y: spring(heightAt(60) + 70) };
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the pancake, and how long it holds there (real seconds). */
  const punch = spring(0);
  let punchHold = 0;
  /** The dev's cloud, on its way in. */
  const cloud = { x: spring(cloudAt(0, false).x), y: spring(cloudAt(0, false).y) };
  /** The community running in once the ape lets go (0 far downhill .. 1 on the coin), and their stride phase. */
  const crew = spring(0);
  let crewLead: number | null = null;
  let crewStride = 0;
  /** Where the community stood when the dev sold: they hold their ground there until the coin reaches them. */
  let crewHeld: number[] | null = null;
  /** The YOU / ANON tag: its pop when it changes, and where it last hung (it shrinks away there when he dives clear). */
  const tag = spring(1);
  let tagText = '';
  let tagAt: Point | null = null;
  let lambo: { mode: LamboMode; x: number; v: number; wheel: number; loaded: boolean } = { mode: 'none', x: 0, v: 0, wheel: 0, loaded: false };
  let confetti: Confetti[] = [];
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let jeetFlash = 0;
  let communityFlat = false;
  let communityX = 0;
  /** Seconds since the dev went for the lever while the coin still holds; -1 with nothing pending. */
  let fuse = -1;
  let freeze = 0;
  let slow = 0;
  /** The dip to dark that covers the cut from one round's aftermath to the next round's betting. */
  let fade = 0;
  /** A player who cashed out got clear of the crash (the dive, or the hop into the Lambo, finished): DODGED lands. */
  let clear = false;
  /** Sound gates: footsteps, the plane, the Lambo's engine, the heartbeat. */
  let stepClock = 0;
  let wasStepping = false;
  let rung = 0;
  let lamboHeard = false;
  let pulse = 0;
  let feinted = 0;

  /** The Lambo's confetti: forty pieces from where he hops in. */
  function celebrate(at: Point): void {
    confetti = [];
    for (let i = 0; i < 40; i += 1) {
      const n = i * 1.37 + time;
      confetti.push({ x: at.x + (noise(n) - 0.5) * 30, y: at.y + 20, vx: (noise(n + 1) - 0.5) * 300, vy: 160 + noise(n + 2) * 220, angle: noise(n + 3) * 3, spin: (noise(n + 4) - 0.5) * 14, colour: CONFETTI[i % CONFETTI.length]!, age: 0, life: 1.4 + noise(n + 5) * 0.8 });
    }
  }

  /** The coin reaches whoever is still on the hill: the flattening, with its hit-stop, punch-in and thud. */
  function flatten(): void {
    shake = 1;
    {
      freeze = FREEZE_S;
      slow = SLOW_S;
      settleSpring(punch, 0.5);
      punch.v = 12;
      punchHold = FREEZE_S + PUNCH_HOLD_S;
    }
    audio.fx('thud', 1.3);
    audio.fx('punch', 0.9);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number, close = false): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the picture for a few frames, then the pancake runs slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // Tension sweeps 0 → 0.67 across 1×–3×, where most rounds end (0.9 at 10×); the log `growth` keeps driving the
    // long-round picture (distance, coin size, altitude, the moon) so 10×–1000× rounds still change.
    const growth = Math.log2(multiplier);
    const tension = 1 - 1 / multiplier;
    const fear = clamp(1.25 * tension - 0.1, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) audio.cashout();
    }
    // Between rounds the coin waits at the foot of the hill, whatever the last readout was.
    const live = running || crashed ? growth : 0;
    const drive: CoinDrive = { seconds: view.elapsed / 1000, x: 60 + PX_PER_DOUBLING * live, radius: 40 + 50 * (1 - Math.exp(-live / 2)), growth: live, running };
    const ending: Outcome = view.stake === null ? 'rugged' : secured ? 'called' : 'rekt';
    const anchorOf = (pose: ReturnType<typeof coinPose>): ApeAnchor => ({ contactX: pose.contact.x, centre: pose.centre, r: pose.r });

    if (previous === null) {
      // A fresh scene (the page joining, or a round first seen after its betting phase) settles into the round
      // as it stands: an exit already taken has the ape gone and the community pushing, and a crash is its quiet
      // aftermath, with the camera held where the dev sold, as it is after a crash watched live.
      previous = view.phase;
      settleCoin(coin, drive);
      resetApe(ape);
      const pose = coinPose(coin);
      settleSpring(cam.x, pose.contact.x + 40);
      settleSpring(cam.y, pose.contact.y + 70);
      if (secured) {
        ape.mode = 'gone';
        settleSpring(badge, 1);
        settleSpring(crew, 1);
      }
      settleDev(dev, tension, running, crashed);
      settleSpring(cloud.x, cloudAt(tension, running || crashed).x);
      settleSpring(cloud.y, cloudAt(tension, running || crashed).y);
      rung = running ? RUNGS.filter((r) => multiplier >= r).length + Math.floor(Math.max(0, view.elapsed - 45_000) / 12_000) : 0;
      feinted = running ? feintsDue(multiplier, view.elapsed) : 0;
      if (crashed) {
        crashCoin(coin, view.currentX100, true);
        outcome = ending;
        pop.x = 1;
        if (ape.mode === 'gone') {
          communityFlat = true;
          communityX = pose.contact.x;
        } else {
          flattenApe(ape, pose.contact.x - pose.r - 40, true);
        }
        audio.crash('slam', true);
      }
      if (ape.mode === 'push') settleSpring(ape.lean, 0.35 + 0.5 * fear);
    } else if (view.phase !== previous) {
      if (crashed && !coin.crashed && fuse < 0) {
        const quiet = view.crashAge > 1500;
        const pose = coinPose(coin);
        outcome = ending;
        // An exit this scene has not drawn yet has still taken the ape off the hill: hidden through it, he is gone;
        // accepted as the dev sold, he lets go now and dives clear when the coin lets go.
        if (secured && ape.mode === 'push') {
          if (quiet) ape.mode = 'gone';
          else exitApe(ape, anchorOf(pose));
        }
        if (quiet) {
          crashCoin(coin, view.currentX100, true);
          settleDev(dev, tension, false, true);
          if (ape.mode === 'push' || ape.mode === 'brace') {
            flattenApe(ape, pose.contact.x - pose.r - 40, true);
          } else {
            ape.mode = 'gone';
            communityFlat = true;
            communityX = pose.contact.x;
          }
          // A ride already on its way leaves with him in it.
          if (lambo.mode !== 'none') lambo = { ...lambo, mode: 'leaving', loaded: true };
          pop.x = 1;
          audio.crash('slam', true);
        } else {
          // The dev goes for the lever; the coin lets go as he throws it over.
          pullLever(dev);
          fuse = 0;
          audio.crash('slam');
          audio.fx('ratchet', 1.1);
        }
      }
      if (view.phase === 'betting') {
        if (coin.crashed) fade = 1;
        settleCoin(coin, drive);
        resetApe(ape);
        resetDev(dev);
        resetAirdrop(airdrop);
        lambo = { mode: 'none', x: 0, v: 0, wheel: 0, loaded: false };
        confetti = [];
        outcome = null;
        secured = null;
        communityFlat = false;
        settleSpring(crew, 0);
        crewLead = null;
        crewHeld = null;
        fuse = -1;
        freeze = slow = punchHold = 0;
        settleSpring(punch, 0);
        rung = 0;
        feinted = 0;
        clear = false;
        pulse = 0;
        lamboHeard = false;
      }
      previous = view.phase;
    }
    if (fuse >= 0) {
      fuse += real;
      if ((dev.lever.x > 0.6 || fuse > FUSE_S) && !coin.crashed) {
        fuse = -1;
        const pose = coinPose(coin);
        crashCoin(coin, view.currentX100, false);
        if (ape.mode === 'push') {
          brace(ape, anchorOf(pose));
          audio.fx('scream', 0.75);
        } else {
          // He already cashed out: still waiting for his ride, he dives clear (mid-hop, he finishes getting in and the
          // Lambo floors it); either way the community takes the hit.
          if (ape.mode === 'exit') {
            dodgeApe(ape, anchorOf(pose));
            audio.fx('whoosh', 0.9);
          }
          communityX = pose.contact.x;
          crewHeld = crewAt(pose.contact.x, pose.r, (1 - crew.x) * CREW_RUN);
        }
        if (lambo.mode !== 'none' && ape.mode !== 'boarding') lambo.mode = 'leaving';
        shake = Math.max(shake, 0.3);
      }
    }
    audio.update(view.phase, tension);
    if (running) {
      const index = RUNGS.filter((r) => multiplier >= r).length + Math.floor(Math.max(0, view.elapsed - 45_000) / 12_000);
      audio.milestone(index);
      if (index > rung) {
        rung = index;
        if (index >= PLANE_FROM) sendPlane(airdrop, { x: cam.x.x, y: cam.y.x });
      }
      // The dev's feints, keyed to the multiplier and the clock like the captions, never to the outcome.
      const due = feintsDue(multiplier, view.elapsed);
      if (due > feinted) {
        feinted = due;
        feintDev(dev);
      }
    }
    if (secured && running && ape.mode === 'push' && lambo.mode === 'none') {
      // The cash-out: he lets go at once and celebrates where he stands; the Lambo pulls up behind him.
      exitApe(ape, anchorOf(coinPose(coin)));
      lambo = { mode: 'arriving', x: ape.braceX - 80 * Math.cos(slopeAngle(ape.braceX)) - LAMBO_LEAD, v: 420, wheel: 0, loaded: false };
    }

    // Step the coin, the ape and the Lambo choreography.
    stepCoin(coin, drive, dt);
    const pose = coinPose(coin);
    const anchor = anchorOf(pose);
    stepApe(ape, { anchor, walking: running, fear, bump: coin.events.bump }, dt);
    if (ape.mode === 'dodge' && ape.modeAge > DODGE_S) {
      ape.mode = 'gone';
      clear = true;
    }
    // The coin rolling back reaches him: the squash into the pancake; or the community, if he got out (they take the
    // hit only if it actually reaches them).
    if (coin.crashed) {
      // First contact, once his hands are up and the coin is coming back down (not the grip he just let go of).
      if (ape.mode === 'brace' && ((coin.crashSpeed > 0 && ape.modeAge > 0.16 && apeGap(ape, anchor, pose.centre, pose.r) <= 0) || coin.crashAge > LAND_BY_S)) {
        flattenApe(ape, ape.braceX - 8, false);
        flatten();
      } else if ((ape.mode === 'gone' || ape.mode === 'dodge' || ape.mode === 'boarding') && !communityFlat && crewHeld !== null && crewGap(crewHeld, pose.centre, pose.r) <= 0) {
        communityFlat = true;
        flatten();
      }
    }
    // Footsteps: each foot that lands, thumps.
    const stepping = ape.mode === 'push' && ape.gait.feet.some((f) => f.phase < 1);
    stepClock -= dt;
    if (wasStepping && !stepping && running && stepClock <= 0) {
      stepClock = 0.2;
      audio.fx('stomp', 0.35 + 0.45 * fear);
    }
    wasStepping = stepping;
    // His heartbeat, quickening with the tension, while he is still pushing his own bag.
    if (running && !secured && ape.mode === 'push') {
      pulse += dt;
      if (pulse >= mix(1.4, 0.35, tension)) {
        pulse = 0;
        audio.fx('heartbeat', 0.25 + 0.35 * tension);
      }
    } else pulse = 0;
    if (coin.events.bump) audio.fx('thud', 0.6 + 0.3 * tension);
    if (coin.events.jeet) {
      jeetFlash = 1;
      audio.fx('yeet', 0.9);
    }
    jeetFlash = Math.max(0, jeetFlash - dt / 1.2);
    if (coin.events.bump) shake = Math.max(shake, 0.18);
    stepDev(dev, tension, running, dt);
    if (dev.events.notch && running) audio.fx('creak', 0.4 + 0.08 * dev.notches);
    if (dev.events.click && running) audio.fx('ratchet', 0.4);
    stepAirdrop(airdrop, { x: cam.x.x, y: cam.y.x }, pose.contact.x, dt);
    if (airdrop.events.plane) audio.fx('engine', 0.55);
    if (airdrop.events.landed) audio.fx('thud', 0.5);
    if (lambo.mode === 'arriving') {
      if (!lamboHeard) {
        lamboHeard = true;
        audio.fx('engine', 0.9);
      }
      // It eases in to stop right behind him.
      const target = ape.braceX - 80 * Math.cos(slopeAngle(ape.braceX));
      lambo.v = Math.min(420, 40 + 5 * (target - lambo.x));
      lambo.x = Math.min(target, lambo.x + lambo.v * dt);
      lambo.wheel += lambo.v * dt / 14;
      if (lambo.x >= target - 0.5 && ape.mode === 'exit') { lambo.mode = 'waiting'; lambo.v = 0; boardApe(ape, anchor); }
    } else if (lambo.mode === 'waiting') {
      if (ape.mode === 'boarding' && ape.modeAge > 0.55) {
        ape.mode = 'gone';
        clear = coin.crashed;
        lambo.mode = 'leaving';
        lambo.loaded = true;
        celebrate({ x: lambo.x, y: heightAt(lambo.x) });
      }
    } else if (lambo.mode === 'leaving') {
      // It brakes if it was still pulling up, then reverses away (faster with a coin rolling after it).
      lambo.v = Math.max(coin.crashed ? -760 : -420, lambo.v - 1300 * dt);
      lambo.x += lambo.v * dt;
      lambo.wheel += lambo.v * dt / 14;
    }
    for (const c of confetti) {
      c.age += dt;
      c.vy -= 320 * dt;
      c.vx *= Math.exp(-1.3 * dt);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.angle += c.spin * dt;
    }
    confetti = confetti.filter((c) => c.age < c.life);
    // The community runs in from downhill when he lets go; their legs cycle with the ground they cover.
    stepSpring(crew, secured ? 1 : 0, 4.5, 1, dt);
    const crewXs = crewHeld ?? (communityFlat ? crewAt(communityX, pose.r, 0) : crewAt(pose.contact.x, pose.r, (1 - crew.x) * CREW_RUN));
    if (!communityFlat) {
      const lead = crewXs[0]!;
      if (crewLead !== null && dt > 0) {
        const ds = Math.abs(lead - crewLead) / Math.cos(slopeAngle(lead));
        crewStride += ds / (14 + 0.06 * ds / dt) * Math.PI;
      }
      crewLead = lead;
    }

    // Camera keeps the coin in view; after the crash it follows the roll for a moment, then holds.
    const follow = !coin.crashed || coin.crashAge < 0.8;
    if (follow) {
      stepSpring(cam.x, pose.contact.x + 40, 4, 1, dt);
      stepSpring(cam.y, pose.contact.y + (lambo.mode === 'arriving' || lambo.mode === 'waiting' ? 30 : 70), 4, 1, dt);
    }
    let camera: Camera = { x: cam.x.x, y: cam.y.x };
    if (ape.mode === 'push' || ape.mode === 'exit' || ape.mode === 'boarding' || ape.mode === 'brace') {
      camera = frameApe(camera, ape, anchor);
      // Remove lag that would put a contact outside the picture on steep downhill recovery.
      if (camera.x !== cam.x.x) { cam.x.x = camera.x; cam.x.v = 0; }
      if (camera.y !== cam.y.x) { cam.y.x = camera.y; cam.y.v = 0; }
    }
    // The payoff holds off until the coin has actually flattened someone or he is clear of it (or, at the latest,
    // LAND_BY_S in).
    const landed = outcome !== null && ((ape.mode === 'pancake' && ape.modeAge >= SQUASH_S) || communityFlat || clear || coin.crashAge > LAND_BY_S);
    stepSpring(pop, landed ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    punchHold = Math.max(0, punchHold - real);
    stepSpring(punch, punchHold > 0 ? 1 : 0, punchHold > 0 ? 30 : 6, punchHold > 0 ? 0.8 : 1, real);
    fade = Math.max(0, fade - real / 0.4);
    const nextCaption = captionFor(view, multiplier, outcome, secured, ape.mode === 'gone' || ape.mode === 'dodge');
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);
    const nextTag = view.stake === null ? 'ANON' : 'YOU';
    if (nextTag !== tagText) {
      if (tagText) settleSpring(tag, 0.4);
      tagText = nextTag;
    }
    // Whose ape this is: over him (squashed down onto the pancake with him), then on the Lambo's roof.
    const roof = slopeAngle(lambo.x);
    const tagWorld = ape.mode === 'gone' ? (lambo.loaded && lambo.mode !== 'none' ? { x: lambo.x + 14 * Math.cos(roof) - 44 * Math.sin(roof), y: heightAt(lambo.x) + 14 * Math.sin(roof) + 44 * Math.cos(roof) } : null) : ape.mode === 'dodge' ? null : apeHead(ape, anchor);
    if (tagWorld) tagAt = tagWorld;
    stepSpring(tag, tagWorld ? 1 : 0, 14, tagWorld ? 0.45 : 1, real);

    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(time * 140) * 9 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    const crewMid = crewXs[1]!;
    const focus: Point = ape.mode === 'pancake' ? { x: ape.pancakeX, y: heightAt(ape.pancakeX) } : { x: crewMid, y: heightAt(crewMid) };
    if (punch.x > 0.005) {
      // The camera punches in on the pancake, holds, and eases back out.
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      const at = toScreen(camera, focus);
      ctx.translate(at.x, at.y);
      ctx.scale(k, k);
      ctx.translate(-at.x, -at.y);
    }
    drawSky(ctx, camera, time, growth);
    drawAirdrop(ctx, airdrop, camera);
    drawHill(ctx, camera);
    if (lambo.mode !== 'none') drawLambo(ctx, camera, lambo.x, lambo.wheel, lambo.loaded);
    if (secured || communityFlat) drawCommunity(ctx, camera, crewXs, crewStride, communityFlat);
    if (ape.mode !== 'dodge') drawApe(ctx, camera, ape, anchor);
    drawCoin(ctx, camera, coin, TICKER);
    // The dive toward the camera passes in front of the coin.
    if (ape.mode === 'dodge') drawApe(ctx, camera, ape, anchor);
    for (const c of confetti) {
      const p = toScreen(camera, { x: c.x, y: c.y });
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(c.angle);
      ctx.globalAlpha = clamp(1.6 * (1 - c.age / c.life), 0, 1);
      ctx.fillStyle = c.colour;
      ctx.fillRect(-3, -2, 6, 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // The dev's cloud drifts in from the top-left corner: it is in front of everything on the hill, under the HUD.
    const on = running || fuse >= 0 || coin.crashed;
    stepSpring(cloud.x, cloudAt(tension, on).x, 1.6, 0.8, dt);
    stepSpring(cloud.y, cloudAt(tension, on).y, 1.6, 0.8, dt);
    drawDev(ctx, dev, cloud.x.x, cloud.y.x, cloudAt(tension, on).s, tension);
    // YOU over the player's ape, ANON for a spectator.
    if (tagAt && tag.x > 0.02) {
      const p = toScreen(camera, tagAt);
      drawTag(ctx, { x: p.x, y: p.y - 30 + (Math.sin(time * 3) * 2) }, tagText, tagText === 'YOU' ? '#ffe27a' : '#d7dde4', clamp(tag.x, 0, 1.3));
    }
    if (jeetFlash > 0) {
      const p = toScreen(camera, pose.centre);
      ctx.globalAlpha = Math.min(1, jeetFlash * 1.5);
      // Up and to the right of the coin: clear of the dev's cloud on the left.
      memeText(ctx, JEET_LINES[clamp(coin.jeeted - 1, 0, JEET_LINES.length - 1)]!, clamp(p.x + pose.r * 0.6, 200, 760), p.y - pose.r - 34 - (1 - jeetFlash) * 30, 22, '#ffe27a', 'center');
      ctx.globalAlpha = 1;
    }
    if (outcome && pop.x > 0.02) {
      const at: Point = toScreen(camera, focus);
      const word = outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'DODGED' : 'RUGGED';
      // Kept inside the picture with room for the pop's overshoot and the punch-in.
      ctx.font = `900 92px ${MEME_FONT}`;
      const half = ctx.measureText(word).width * 0.66 + 8;
      ctx.save();
      ctx.translate(clamp(at.x, half, W - half), clamp(at.y - 150, 150, 420));
      ctx.rotate(-0.12);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, word, 0, 0, 92, outcome === 'called' ? '#7cf67c' : '#ff4d6d', 'center');
      ctx.restore();
    }
    ctx.restore();

    // HUD in screen space. The readout is measured first so the centred caption stays 24 units clear of it.
    const readout = `${multiplier.toFixed(2)}×`;
    ctx.font = `900 66px ${MEME_FONT}`;
    const readoutWidth = Math.min(READOUT_MAX, ctx.measureText(readout).width);
    if (caption) {
      ctx.save();
      ctx.translate(CAPTION_X, 68);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 46, '#ffffff', 'center', Math.min(560, 2 * (READOUT_X - readoutWidth - 24 - CAPTION_X)) / k);
      ctx.restore();
    }
    if (!close && secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(CAPTION_X, 114 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.03);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    memeText(ctx, readout, READOUT_X, 80, 66, colour, 'right', READOUT_MAX);
    ctx.restore();
    if (!close) memeText(ctx, `MCAP ${formatMcap(multiplier)}`, 26, 514, 26, outcome ? '#ff9db0' : '#e7f4f0', 'left');
    if (fade > 0) {
      ctx.save();
      ctx.globalAlpha = fade * fade * 0.85;
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, W, 540);
      ctx.restore();
    }
  }

  return { draw: portrait(draw, 'KING OF THE HILL', () => ({ x: 105, y: 105, w: 510, h: 390 }), v => captionFor(v, Math.max(1, v.currentX100 / 100), outcome, secured, ape.mode === 'gone' || ape.mode === 'dodge')) };
}
