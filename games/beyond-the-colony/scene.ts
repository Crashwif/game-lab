import { pageAudio } from './audio';
import { clamp, colony, ellipse, flurries, polygon, refuge, shelf, sky, snowPuff } from './landscape';
import { penguin, type PenguinPose } from './penguin';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}
export interface SceneOptions { reducedMotion?: boolean }
export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const STEP_SECONDS = 3.6;
const STEP_WIDTH = 180;
const STEP_HEIGHT = 55;
const smooth = (v: number): number => { const u = clamp(v); return u * u * (3 - 2 * u); };
const formatX = (x100: number): string => `${(x100 / 100).toFixed(2)}×`;
const CHAPTERS = [
  ['THE FIRST STEP', 'Somewhere beyond the familiar.'],
  ['INTO THE BLUE', 'Small feet. An unreasonable mountain.'],
  ['ABOVE THE COLONY', 'The world grows quiet up here.'],
  ['THE LONG WAY', 'One more ledge. One more little leap.'],
  ['UNDER THE AURORA', 'Even the sky is going somewhere.'],
  ['FURTHER STILL', 'There is always another horizon.'],
  ['THE SILENT RIDGE', 'The mountain has all the time in the world.'],
  ['KEEP WANDERING', 'A little courage travels a long way.'],
] as const;

interface Journey {
  steps: number;
  index: number;
  cameraX: number;
  cameraY: number;
  x: number;
  y: number;
  airborne: boolean;
  stride: number;
}

/** Analytic footsteps give sequential playback and a late entry the same ledge and foot pose. */
function journeyAt(elapsed: number, active: boolean, reduced: boolean): Journey {
  const steps = active ? Math.max(0, elapsed) / 1000 / STEP_SECONDS : 0;
  const index = Math.floor(steps);
  const u = steps - index;
  if (reduced) return { steps, index, cameraX: index * STEP_WIDTH - 60, cameraY: index * STEP_HEIGHT, x: 490, y: 370, airborne: false, stride: 0 };
  const jump = clamp((u - 0.7) / 0.3);
  const worldX = index * STEP_WIDTH - 60 + (u <= 0.7 ? u * 150 : 105 + jump * 75);
  const cameraX = steps * STEP_WIDTH - 60;
  const cameraY = steps * STEP_HEIGHT;
  const worldY = -index * STEP_HEIGHT - jump * STEP_HEIGHT - Math.sin(jump * Math.PI) * 40;
  return {
    steps, index, cameraX, cameraY,
    x: 490 + worldX - cameraX,
    y: 370 + worldY + cameraY,
    airborne: active && u > 0.7,
    stride: active ? elapsed / 1000 * 8 : 0,
  };
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, colour: string, align: CanvasTextAlign = 'left', maxWidth?: number, weight = 500): void {
  ctx.fillStyle = colour; ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(value, x, y, maxWidth);
}

function compass(ctx: CanvasRenderingContext2D): void {
  ctx.save(); ctx.translate(40, 42);
  ctx.strokeStyle = '#96cfc2'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
  polygon(ctx, [[0, -9], [3, 2], [0, 0], [-3, 2]], '#c2e9d6');
  polygon(ctx, [[0, 9], [3, 2], [0, 0], [-3, 2]], '#4a898a');
  ctx.restore();
}

function overlay(ctx: CanvasRenderingContext2D, view: SceneView, steps: number): void {
  const crashed = view.phase === 'crashed';
  const secure = view.cashoutX100 !== null;
  const active = view.phase === 'running' || crashed;
  const chapterIndex = active ? Math.floor(Math.max(0, view.elapsed) / 20000) : 0;
  const chapter = CHAPTERS[chapterIndex % CHAPTERS.length]!;
  const heading = crashed ? 'THE ICE GAVE WAY' : secure ? 'A MOMENT OF WARMTH' : view.phase === 'betting' ? 'THE MOUNTAIN IS CALLING' : view.phase === 'waiting' ? 'EVERY JOURNEY BEGINS HERE' : chapter[0];
  const subtitle = crashed ? secure ? 'Your refuge holds. The journey rests.' : 'A soft landing. Another journey awaits.' : secure ? 'Boots off. Warm cup. Credits secured.' : view.phase === 'betting' ? 'Join the expedition before it sets off.' : view.phase === 'waiting' ? 'The colony rests beneath the southern sky.' : chapter[1];

  const top = ctx.createLinearGradient(0, 0, 0, 164);
  top.addColorStop(0, 'rgba(3,17,29,0.78)'); top.addColorStop(1, 'rgba(3,17,29,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, 960, 164);
  compass(ctx);
  text(ctx, 'BEYOND THE COLONY', 64, 42, 21, '#eff7e9', 'left', 410, 650);
  text(ctx, 'A LITTLE PENGUIN. A VERY BIG WORLD.', 28, 71, 11, '#91b9b8', 'left', 425, 600);
  ctx.strokeStyle = '#50848b'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(29, 87); ctx.lineTo(233, 87); ctx.stroke();
  text(ctx, `FIELD NOTE ${String(chapterIndex + 1).padStart(3, '0')}`, 29, 109, 11, '#a6cbbf', 'left', 360, 600);
  text(ctx, heading, 28, 138, 19, crashed ? '#efc399' : '#daecdc', 'left', 510, 650);

  const value = formatX(view.currentX100);
  const width = 336;
  ctx.font = '500 65px ui-monospace, monospace';
  const size = Math.min(65, 65 * width / Math.max(1, ctx.measureText(value).width));
  text(ctx, crashed ? 'ROUND COMPLETE' : 'ROUND MULTIPLIER', 928, 38, 11, '#a2c8c5', 'right', width, 600);
  ctx.fillStyle = crashed ? '#f1c29e' : '#eaf9dd';
  ctx.textAlign = 'right'; ctx.font = `500 ${size}px ui-monospace, monospace`;
  ctx.fillText(value, 930, 104, width);
  if (secure) {
    text(ctx, `CASHED OUT · ${formatX(view.cashoutX100!)}`, 928, 133, 14, '#bcf4cf', 'right', width, 700);
  } else text(ctx, 'FOLLOW YOUR OWN PATH', 928, 129, 10, '#90b8b6', 'right', width, 500);

  const bottom = ctx.createLinearGradient(0, 441, 0, 540);
  bottom.addColorStop(0, 'rgba(6,26,38,0)'); bottom.addColorStop(0.5, 'rgba(6,26,38,0.85)'); bottom.addColorStop(1, '#061a26');
  ctx.fillStyle = bottom; ctx.fillRect(0, 441, 960, 99);
  text(ctx, subtitle, 28, 493, 21, '#ecf4e5', 'left', 790, 500);
  text(ctx, 'NIETZSCHEAN PENGUIN · COMMUNITY GAME CONCEPT', 28, 521, 10, '#88b1b2', 'left', 660, 600);
  text(ctx, secure ? 'AT THE REFUGE' : crashed ? 'RESTING SAFELY' : active ? `LEDGE ${Math.floor(steps) + 1}` : 'BASE CAMP', 929, 521, 11, secure ? '#c7e9b4' : '#91b7b5', 'right', 240, 600);
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'ambient', crash: 'shatter' });
  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let refugeEntry: { at: number; x: number; y: number } | null = null;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const active = view.phase === 'running' || view.phase === 'crashed';
    const crashed = view.phase === 'crashed';
    const secure = view.cashoutX100 !== null;
    const elapsed = active ? Math.max(0, view.elapsed) : 0;
    const age = Math.max(0, view.crashAge) / 1000;
    const time = reduced ? 0 : elapsed / 1000;
    const tension = clamp(Math.log2(Math.max(100, view.currentX100) / 100) / 12);
    const journey = journeyAt(elapsed, active, reduced);
    audio.update(view.phase, tension);
    if (previousPhase !== null && secure && previousCashout === null) {
      audio.cashout();
      refugeEntry = { at: now, x: journey.x, y: journey.y };
    }
    if (!secure) refugeEntry = null;
    if (crashed && previousPhase !== 'crashed') audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;

    ctx.save();
    sky(ctx, time, journey.steps, reduced);
    colony(ctx, journey.steps);

    // The lower shelf sits beneath the route and catches the penguin when the ledge breaks.
    const catchY = Math.min(453, journey.y + 74);
    if (crashed) shelf(ctx, journey.x - 5, catchY + 2, 214, 126);

    for (let i = journey.index - 4; i <= journey.index + 4; i += 1) {
      const x = 490 + i * STEP_WIDTH - journey.cameraX;
      const y = 370 - i * STEP_HEIGHT + journey.cameraY;
      if (x < -180 || x > 1080 || y > 555) continue;
      const breaking = crashed && (i === journey.index || i === journey.index + 1);
      if (breaking && age >= 0.16) {
        const fall = reduced ? 110 : Math.min(480, Math.pow(Math.max(0, age - 0.16), 2) * 220);
        const gap = reduced ? 15 : Math.min(70, age * 31);
        ctx.save(); ctx.globalAlpha = 1 - clamp((fall - 70) / 240);
        shelf(ctx, x - 38 - gap, y + fall, 78, 95, true);
        shelf(ctx, x + 38 + gap, y + fall + 15, 73, 118, true);
        ctx.restore();
      } else {
        shelf(ctx, x, y, 156, 119, breaking);
        // Tracks are part of the terrain, so they leave the frame with their shelf.
        if (i < journey.index || i === journey.index && !crashed) {
          for (let mark = 0; mark < 5; mark += 1) {
            const fx = x - 51 + mark * 20;
            if (i === journey.index && fx > journey.x - 14) continue;
            ellipse(ctx, fx, y - 2 + mark % 2 * 3, 3.5, 1.4, '#699eab');
          }
        }
      }
    }
    refuge(ctx, time, secure, reduced);

    let pose: PenguinPose = {
      x: journey.x, y: journey.y, stride: journey.stride, airborne: journey.airborne,
      secure: false, surprised: false, time, reduced,
    };
    if (secure) {
      const u = reduced || !refugeEntry ? 1 : clamp((now - refugeEntry.at) / 1150);
      const ease = smooth(u);
      pose = {
        x: (refugeEntry?.x ?? 789) + (789 - (refugeEntry?.x ?? 789)) * ease,
        y: (refugeEntry?.y ?? 298) + (298 - (refugeEntry?.y ?? 298)) * ease - Math.sin(u * Math.PI) * 68,
        stride: 0, airborne: u < 1, secure: u >= 1, surprised: false, time, reduced, scale: 1 - ease * 0.18,
      };
    } else if (crashed) {
      const landing = reduced ? 1 : smooth((age - 0.18) / 0.68);
      const landed = landing >= 1;
      pose = {
        ...pose, y: journey.y + (catchY - journey.y) * landing,
        stride: 0, airborne: !landed, surprised: !landed,
        tilt: reduced || landed ? 0 : Math.sin(landing * Math.PI) * -0.18,
        time: reduced ? 0 : time + Math.min(age, 1.5),
      };
    }
    penguin(ctx, pose);
    if (crashed && !secure && !reduced) snowPuff(ctx, journey.x, catchY, age - 0.8);
    if (!reduced) flurries(ctx, time + (crashed ? Math.min(age, 2) : 0), tension);

    // The resting foreground frames the expedition without covering the controls or readout.
    polygon(ctx, [[-10, 458], [71, 434], [131, 451], [241, 478], [295, 540], [-10, 540]], '#0d3044');
    polygon(ctx, [[-10, 458], [71, 434], [131, 451], [211, 470], [127, 463], [71, 448]], '#689dab');
    overlay(ctx, view, journey.steps);
    ctx.restore();
  }
  return { draw };
}
