import { pageAudio } from './audio';
import { bear, box, bull, CREAM, GOLD, GREEN, INK, oval, shape, star, text } from './art';

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
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void }

const TAU = Math.PI * 2;
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const floorAt = (x: number) => 430 - x * 0.17;
const formatX = (value: number) => `${(value / 100).toFixed(2)}×`;
const CHAPTERS = ['STADIUM START', 'ROOFTOP RALLY', 'GOLDEN MILE', 'CLOUD CLUB', 'VICTORY LAP', 'EXTRA INNINGS'];
const BANNERS = ['MAKE SOME NOISE', 'HORNS UP', 'FULL SEND', 'STILL CHARGING', 'THE CROWD IS WITH YOU', 'ONE MORE RAMP'];

function background(c: CanvasRenderingContext2D, seconds: number, motion: number, chapter: number): void {
  const sky = c.createLinearGradient(0, 150, 0, 450);
  sky.addColorStop(0, CREAM); sky.addColorStop(1, '#c9e7b8');
  c.fillStyle = sky; c.fillRect(0, 0, 960, 540);
  oval(c, 595, 247, 103, 103, '#f4d76d', 0);
  for (let i = 0; i < 8; i += 1) {
    const x = ((i * 162 - motion * 13) % 1300 + 1300) % 1300 - 170;
    const y = 180 + (i % 3) * 31;
    oval(c, x, y, 34, 8, '#fffdf0', 0);
    oval(c, x + 25, y - 5, 25, 11, '#fffdf0', 0);
  }
  c.fillStyle = '#a9c99c';
  for (let i = 0; i < 16; i += 1) {
    const x = ((i * 90 - motion * 8) % 1450 + 1450) % 1450 - 150;
    const h = 30 + ((i * 37 + chapter * 11) % 80);
    c.fillRect(x, 345 - h, 63, h);
    c.fillRect(x + 10, 335 - h, 43, 12);
    c.fillStyle = '#d5e7ba';
    for (let row = 0; row < 3; row += 1) {
      c.fillRect(x + 12, 355 - h + row * 15, 8, 7);
      c.fillRect(x + 40, 355 - h + row * 15, 8, 7);
    }
    c.fillStyle = '#a9c99c';
  }
  c.fillStyle = '#699673';
  c.beginPath(); c.moveTo(0, 373); c.lineTo(960, 273); c.lineTo(960, 484); c.lineTo(0, 484); c.closePath(); c.fill();
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 25; i += 1) {
      const x = i * 43 + row * 18;
      const y = 388 - x * 0.112 + row * 19 + Math.sin(seconds * 2.6 + i) * 2;
      oval(c, x, y, 7, 8, i % 3 === 0 ? GOLD : i % 3 === 1 ? CREAM : '#254d35', 0);
    }
  }
  c.strokeStyle = '#e2ecd0'; c.lineWidth = 5;
  c.beginPath(); c.moveTo(0, 410); c.lineTo(960, 304); c.stroke();
}

function track(c: CanvasRenderingContext2D, travel: number, crashAge: number, reduced: boolean): void {
  const tile = 150;
  const scroll = ((travel % tile) + tile) % tile;
  const collapse = reduced ? (crashAge > 0 ? 1 : 0) : ease((crashAge - 0.18) / 0.9);
  for (let i = -1; i < 8; i += 1) {
    const x = i * tile - scroll;
    const y = floorAt(x);
    c.save(); c.translate(x, y);
    if (collapse > 0) {
      c.translate(0, collapse * (50 + ((i + 9) % 3) * 25));
      c.rotate(collapse * (i % 2 === 0 ? 0.17 : -0.24));
    }
    c.beginPath(); c.moveTo(0, 0); c.lineTo(tile, -tile * 0.17); c.lineTo(tile, 85); c.lineTo(0, 105); c.closePath(); shape(c, '#0c7954', 4);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(tile, -tile * 0.17); c.lineTo(tile, -tile * 0.17 + 16); c.lineTo(0, 16); c.closePath(); shape(c, GREEN, 4);
    c.strokeStyle = '#85ec94'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(5, 3); c.lineTo(tile - 7, -tile * 0.17 + 3); c.stroke();
    c.save(); c.translate(65, 48); c.rotate(-0.168);
    c.strokeStyle = '#1c9564'; c.lineWidth = 8;
    c.beginPath(); c.moveTo(-17, -11); c.lineTo(0, 0); c.lineTo(-17, 11); c.moveTo(7, -11); c.lineTo(24, 0); c.lineTo(7, 11); c.stroke(); c.restore();
    for (const bx of [10, 137]) oval(c, bx, 28 - bx * 0.17, 3, 3, GOLD, 1);
    c.restore();
  }
}

function gantry(c: CanvasRenderingContext2D, crashAge: number, reduced: boolean): void {
  box(c, 900, 175, 14, 151, INK, 4, 0);
  box(c, 706, 174, 209, 10, INK, 4, 0);
  const drop = reduced ? (crashAge > 0 ? 1 : 0) : ease(crashAge / 0.28);
  const y = 193 + drop * 92;
  c.strokeStyle = INK; c.lineWidth = 3;
  for (const x of [734, 877]) {
    c.beginPath(); c.moveTo(x, 182); c.lineTo(x, y); c.stroke();
  }
  box(c, 712, y, 187, 30, GOLD, 5, 4);
  c.save(); c.beginPath(); c.roundRect(714, y + 2, 183, 26, 4); c.clip();
  c.fillStyle = INK;
  for (let i = 0; i < 8; i += 1) {
    const x = 703 + i * 28;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 13, y); c.lineTo(x + 33, y + 32); c.lineTo(x + 20, y + 32); c.closePath(); c.fill();
  }
  c.restore();
  box(c, 756, y + 2, 102, 25, GOLD, 3, 2);
  text(c, 'BEAR-ICADE', 807, y + 15, 12, INK, 'center');
  if (drop > 0.95) {
    star(c, 726, y + 34, 15, GOLD);
    star(c, 889, y + 30, 12, CREAM);
  }
}

function grandstand(c: CanvasRenderingContext2D, secured: boolean): void {
  box(c, 621, 423, 234, 63, '#f7e3a4', 10, 4);
  box(c, 611, 417, 254, 14, GOLD, 6, 4);
  text(c, secured ? 'SAFE IN THE STANDS' : 'CASH OUT →', 738, 455, secured ? 17 : 22, INK, 'center', 220);
  for (const x of [629, 847]) {
    c.strokeStyle = INK; c.lineWidth = 4;
    c.beginPath(); c.moveTo(x, 416); c.lineTo(x, 383); c.stroke();
    c.beginPath(); c.moveTo(x, 381); c.lineTo(x + 22, 388); c.lineTo(x, 396); c.closePath(); shape(c, secured ? GREEN : GOLD, 2);
  }
}

function cushion(c: CanvasRenderingContext2D, age: number, reduced: boolean): void {
  const compression = reduced ? 0 : Math.sin(clamp((age - 0.7) / 0.55) * Math.PI) * 8;
  box(c, 340, 445 + compression, 218, 43 - compression, '#f2c349', 17, 4);
  c.strokeStyle = '#be871e'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(358, 465 + compression / 2); c.lineTo(541, 465 + compression / 2); c.stroke();
  text(c, 'SOFT LANDING', 449, 475, 13, INK, 'center');
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'phonk', bpm: 124, tempoRise: 0.15, crash: 'thud', music: 0.65 });
  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousElapsed = 0;
  let cashoutAt: number | null = null;
  let lastStomp = -1;
  let lastChapter = -1;

  return {
    draw(c, view, now) {
      const running = view.phase === 'running';
      const crashed = view.phase === 'crashed';
      const seconds = Math.max(0, view.elapsed / 1000);
      const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
      const confirmed = view.cashoutX100 !== null;
      const restarted = view.elapsed < previousElapsed || ((view.phase === 'waiting' || view.phase === 'betting') && previousPhase !== view.phase);
      if (restarted) {
        previousCashout = null; cashoutAt = null; lastStomp = -1; lastChapter = -1;
      }
      const fresh = previousPhase === null || restarted;
      if (confirmed && previousCashout === null) {
        cashoutAt = fresh || crashed ? seconds - 2 : seconds;
        if (!fresh && running) { audio.cashout(); audio.fx('whoosh', 0.4); }
      }
      if (!confirmed) cashoutAt = null;
      const tension = clamp(Math.log2(Math.max(1, view.currentX100 / 100)) / 10);
      audio.update(view.phase, tension);
      if (crashed && previousPhase !== 'crashed') {
        const quiet = fresh || age > 1.5;
        audio.crash('thud', quiet);
        if (!quiet) audio.fx('clang', 0.65);
      }
      const chapter = Math.floor(seconds / 25) % CHAPTERS.length;
      const stride = seconds * 2.25;
      const step = Math.floor(stride * 2);
      if (running && !fresh && !confirmed && step !== lastStomp) audio.fx('stomp', 0.12 + tension * 0.1);
      if (running && !fresh && chapter !== lastChapter) audio.fx('crowd', 0.2);
      lastStomp = step; lastChapter = chapter;
      previousPhase = view.phase; previousCashout = view.cashoutX100; previousElapsed = view.elapsed;

      const motion = reduced ? 0 : seconds;
      const ambient = reduced ? 0 : (running || crashed ? seconds : now / 1000);
      const travel = motion * 185;
      const escape = confirmed ? (reduced ? 1 : ease((seconds - (cashoutAt ?? seconds - 2) + age) / 1.15)) : 0;
      c.save();
      background(c, reduced ? 0 : ambient, motion, chapter);
      track(c, travel, crashed ? Math.max(age, 0.001) : 0, reduced);
      gantry(c, crashed ? Math.max(age, 0.001) : 0, reduced);
      bear(c, 832, floorAt(832) - 3, ambient, crashed);
      grandstand(c, confirmed);
      if (crashed && !confirmed) cushion(c, age, reduced);

      if (running && !confirmed && !reduced) {
        for (let i = 0; i < 7; i += 1) {
          const progress = ((seconds * 2.1 + i / 7) % 1);
          const x = 263 - progress * 170;
          const y = floorAt(x) - 9 - progress * 24;
          c.globalAlpha = (1 - progress) * 0.7;
          oval(c, x, y, 6 + progress * 17, 4 + progress * 9, CREAM, 0);
        }
        c.globalAlpha = 1;
        c.strokeStyle = '#f8fff0'; c.lineWidth = 3;
        for (let i = 0; i < 5; i += 1) {
          const x = 250 - ((seconds * 95 + i * 48) % 230);
          const y = 262 + i * 17;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + 23, y - 4); c.stroke();
        }
      }

      const startX = 377;
      const startY = floorAt(startX) - 3;
      if (confirmed) {
        const x = startX + (733 - startX) * escape;
        const y = startY + (416 - startY) * escape - Math.sin(escape * Math.PI) * 114;
        bull(c, x, y, 1 - escape * 0.4, reduced ? 0 : stride, !reduced && escape < 1, escape === 1, ambient, -0.168 * (1 - escape));
        if (escape === 1) {
          star(c, 650, 336, 12, GOLD);
          star(c, 826, 348, 9, GREEN);
        }
      } else if (crashed) {
        const drop = reduced ? 1 : ease((age - 0.22) / 0.68);
        const recoil = reduced ? 0 : Math.sin(clamp(age / 0.6) * Math.PI) * 25;
        bull(c, startX + drop * 59 - recoil, startY + (444 - startY) * drop, 1 - drop * 0.18, 0, false, drop === 1, reduced ? 0 : age * 0.5, -0.168 * (1 - drop));
      } else {
        bull(c, startX, startY, 1, reduced ? 0 : stride, running && !reduced, false, ambient);
        if (view.phase === 'betting' && !reduced) {
          const snort = (now / 1000) % 3;
          if (snort < 0.65) {
            c.globalAlpha = 1 - snort / 0.65;
            oval(c, 548 + snort * 35, 269 - snort * 8, 5 + snort * 12, 4 + snort * 7, '#fffdf0', 0);
            c.globalAlpha = 1;
          }
        }
      }

      // The header and footer stay still while the course moves underneath them.
      c.fillStyle = CREAM; c.fillRect(0, 0, 960, 156);
      c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(28, 157); c.lineTo(931, 157); c.stroke();
      box(c, 30, 23, 164, 24, INK, 4, 0);
      text(c, 'COMMUNITY ARCADE', 112, 36, 11, CREAM, 'center');
      text(c, 'MUMU', 26, 91, 70, INK);
      text(c, 'BULL RUN', 280, 92, 35, GREEN);
      text(c, 'Horns up. Ramp up. Know your exit.', 33, 134, 16, '#45644c');
      box(c, 625, 22, 305, 118, INK, 14, 0);
      text(c, crashed ? 'ROUND COMPLETE' : 'ROUND MULTIPLIER', 648, 44, 13, '#b6d7ac');
      text(c, formatX(view.currentX100), 776, 92, 58, crashed ? GOLD : CREAM, 'center', 271);
      box(c, 31, 174, 221, 28, GOLD, 5, 2);
      const label = crashed ? 'BEAR-ICADE DOWN' : view.phase === 'betting' ? 'ON YOUR MARKS' : view.phase === 'waiting' ? 'THE HERD IS GATHERING' : CHAPTERS[chapter]!;
      text(c, label, 141, 189, 14, INK, 'center', 201);
      if (running) text(c, `LAP ${Math.floor(seconds / 150) + 1}`, 268, 189, 13, INK);
      c.fillStyle = INK; c.fillRect(0, 488, 960, 52);
      const caption = confirmed ? 'EXIT TAKEN. HORNS STILL UP.' : crashed ? 'THE BEAR HAD ONE JOB.' : running ? BANNERS[chapter]! : view.phase === 'betting' ? 'THE NEXT CHARGE STARTS HERE.' : 'BIG HORNS. BIG PERSONALITY.';
      text(c, caption, 26, 514, 20, CREAM, 'left', confirmed ? 475 : 510);
      if (confirmed) {
        text(c, `CASHED OUT ${formatX(view.cashoutX100!)}`, 932, 515, 20, '#88ed9f', 'right', 410);
      } else {
        text(c, crashed ? 'ROUND CRASHED' : running ? 'CASH OUT TO TAKE THE EXIT' : 'PLAY WITH VALUELESS CREDITS', 932, 515, 13, '#b6d7ac', 'right', 367);
      }
      c.restore();
    },
  };
}
