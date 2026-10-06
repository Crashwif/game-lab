import { pageAudio } from './audio';
import { box, clamp, ease, INK, line, noise, oval, text } from './drawing';
import { backdrop, beds, flyingLeaves, plant } from './garden';
import { police } from './police';
import { SPRITES } from './sprites';

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
  dispose(): void;
}

const RUNGS = [1.5, 2, 3, 5, 10, 25];
const CAPTIONS = ['JUST A LITTLE GARDENING', 'THAT IS DEFINITELY NOT BASIL', 'THE NEIGHBORS CAN SMELL IT', 'SUBURBAN RAINFOREST', 'BOTANICAL MAIN CHARACTER'];

/** The room supplies every outcome; growth, actors and effects only present its view. */
export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'lofi', crash: 'siren', music: 0.6, effects: 0.8 });
  const atlas = new Image();
  atlas.src = SPRITES;
  let disposed = false;
  let previous: SceneView['phase'] | null = null;
  let lastElapsed = 0;
  let lastNow: number | null = null;
  let cashoutAt: number | null = null;
  let secured: number | null = null;
  let lastRung = -1;
  let lastWater = -1;

  function reset() {
    cashoutAt = null; secured = null; lastRung = -1; lastWater = -1;
  }

  function actor(c: CanvasRenderingContext2D, pose: number, x: number, y: number, time: number, walking: boolean) {
    const bob = reduced ? 0 : Math.sin(time * (walking ? 10 : 3.2)) * (walking ? 5 : 2);
    oval(c, x - 5, y - 7, walking ? 48 : 63, 10, '#183a394d');
    if (!atlas.complete || atlas.naturalWidth === 0) {
      text(c, 'WAKING ANDY…', x, y - 100, 15, '#ffe786', 'center');
      return;
    }
    const w = atlas.naturalWidth / 3; const h = atlas.naturalHeight / 2;
    c.save(); c.translate(x, y + bob); c.rotate(reduced ? 0 : Math.sin(time * 2.1) * 0.008);
    c.drawImage(atlas, (pose % 3) * w, Math.floor(pose / 3) * h, w, h, -145, -288, 288, 288);
    c.restore();
  }

  function hud(c: CanvasRenderingContext2D, view: SceneView, growth: number, bustAge: number, time: number) {
    const running = view.phase === 'running'; const crashed = view.phase === 'crashed';
    const cap = crashed ? secured !== null ? 'ANDY LEFT. THE COPS DID NOT.' : 'SHOULD HAVE GROWN TOMATOES.'
      : secured !== null ? 'HARVEST HOME. FEET UP.'
      : running ? CAPTIONS[Math.min(4, Math.floor(growth * 5))] : 'A LITTLE WATER. A LOT OF AMBITION.';
    const top = c.createLinearGradient(0, 0, 0, 155); top.addColorStop(0, '#201b36ee'); top.addColorStop(1, '#201b3600');
    c.fillStyle = top; c.fillRect(0, 0, 960, 155);
    text(c, "ANDY'S", 27, 34, 17, '#edc795');
    text(c, 'LOUD GARDEN', 24, 79, 42, '#f9e58c', 'left', 410);
    text(c, cap, 27, 105, 13, '#f6eedc', 'left', 600);
    box(c, 733, 22, 203, 91, '#28233ddb', 16, 2);
    text(c, crashed ? 'BUST MULTIPLIER' : running ? 'GROWING' : 'READY TO GROW', 834, 44, 11, '#d2c0b8', 'center');
    text(c, `${(view.currentX100 / 100).toFixed(2)}×`, 834, 92, 45, crashed ? '#ff8b90' : '#c5ed91', 'center', 175);
    if (secured !== null) {
      box(c, 307, 124, 325, 43, '#245847', 12, 3);
      text(c, `HARVESTED AT ${(secured / 100).toFixed(2)}×`, 469, 152, 20, '#d8f4ad', 'center', 299);
    } else if (running) {
      c.save(); c.translate(222, 178 + (reduced ? 0 : Math.sin(time * 2) * 2));
      box(c, -84, -21, 175, 38, '#fcf0c9', 12, 3);
      c.fillStyle = INK; c.font = 'bold 13px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText(growth > 0.7 ? 'bro… they are tomatoes.' : growth > 0.35 ? 'smells like success.' : 'just one more sprinkle.', 3, 3);
      line(c, [[-15, 18], [-20, 26], [-2, 18]], INK, 2); c.restore();
    }
    if (crashed) {
      const arrival = reduced ? 1 : ease(bustAge / 0.32);
      c.save(); c.translate(509, 229); c.rotate(-0.065); c.scale(arrival, arrival);
      box(c, -168, -52, 336, 99, '#f06c78', 14, 6);
      text(c, 'BUSTED', 0, 22, 62, '#fff0c5', 'center'); c.restore();
    }
    box(c, 19, 507, 142, 23, '#25394a', 6, 2);
    text(c, crashed ? 'PATCH CONFISCATED' : growth < 0.28 ? 'SEEDLING ENERGY' : growth < 0.67 ? 'GROWING LOUD' : 'FULL JUNGLE', 90, 522, 10, '#e7ecb2', 'center');
    text(c, 'FREE PLAY · VALUELESS CREDITS', 938, 527, 10, '#faf0d8', 'right');
  }

  function draw(c: CanvasRenderingContext2D, view: SceneView, now: number) {
    if (disposed) return;
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if ((view.phase === 'betting' && previous !== 'betting') || (running && view.elapsed < lastElapsed)) reset();
    const time = reduced ? 0 : now / 1000;
    const delta = lastNow === null ? 0 : Math.max(0, (now - lastNow) / 1000);
    const growth = running || crashed ? clamp(Math.log2(Math.max(1, view.currentX100 / 100)) / 2.3) : 0;
    const bustAge = crashed ? Math.max(0, view.crashAge / 1000) : -1;
    if (view.cashoutX100 !== null && secured === null) {
      secured = view.cashoutX100;
      cashoutAt = now - (previous === null ? 3500 : 0);
      if (previous !== null && delta < 0.3) audio.cashout();
    }
    audio.update(view.phase, growth);
    if (crashed && previous !== 'crashed') audio.crash('siren', bustAge > 0.4);
    if (running) {
      const rung = RUNGS.filter(value => view.currentX100 >= value * 100).length - 1;
      if (rung > lastRung && previous === 'running' && delta < 0.3) audio.milestone(rung);
      lastRung = rung;
      const water = Math.floor(view.elapsed / 2400);
      if (water !== lastWater && secured === null && previous === 'running' && delta < 0.3) audio.fx('glug', 0.25);
      lastWater = water;
    }
    c.save();
    backdrop(c);
    const quake = !reduced && bustedRecently(bustAge) ? Math.sin(bustAge * 35) * 4 * (1 - bustAge / 0.55) : 0;
    c.save(); c.translate(quake, 0);
    for (let i = 0; i < 3; i++) plant(c, 419 + i * 151, 451, growth * (i === 1 ? 1 : 0.9), time, i + 1, bustAge, reduced);
    beds(c);
    if (running && secured === null && !reduced) {
      for (let i = 0; i < 16; i++) {
        const t = (time * 0.8 + i / 16) % 1;
        const x = 294 + t * 102 + noise(i + 40) * 8;
        const y = 366 + t * t * 63;
        c.globalAlpha = (1 - t) * 0.7; oval(c, x, y, 2, 3, '#97e8f0');
      }
      c.globalAlpha = 1;
    }
    const exitAge = cashoutAt === null ? -1 : Math.max(0, (now - cashoutAt) / 1000);
    const walking = secured !== null;
    const departure = walking ? reduced ? 1 : ease((exitAge - 0.6) / 2.7) : 0;
    const actorX = 216 - departure * 350;
    const pose = walking ? 5 : crashed ? 4 : running ? growth > 0.74 ? 3 : reduced ? 1 : 1 + (Math.floor(time * 1.8) % 2) : 0;
    actor(c, pose, actorX, 480, time, walking);
    if (walking && departure > 0.9) {
      c.save(); c.translate(121, 327); c.rotate(-0.075); box(c, -76, -29, 152, 60, '#f7df9f', 8, 3);
      text(c, 'GONE HOME', 0, -2, 16, '#352b48', 'center'); text(c, 'GOOD TIMING.', 0, 18, 11, '#345844', 'center'); c.restore();
    }
    flyingLeaves(c, bustAge, reduced);
    police(c, bustAge, reduced);
    c.restore();
    if (running && !reduced) {
      for (let i = 0; i < 10; i++) {
        const t = (time * 0.13 + noise(i + 20)) % 1;
        const x = 365 + noise(i + 40) * 420 + Math.sin(time * 1.2 + i) * 8;
        const y = 432 - t * 180 * growth;
        c.globalAlpha = Math.sin(t * Math.PI) * 0.5; oval(c, x, y, 2, 2, '#ecf8a9');
      }
      c.globalAlpha = 1;
    }
    hud(c, view, growth, bustAge, time);
    c.restore();
    previous = view.phase; lastElapsed = view.elapsed; lastNow = now;
  }

  return { draw, dispose() { disposed = true; } };
}

function bustedRecently(age: number) { return age >= 0 && age < 0.55; }
