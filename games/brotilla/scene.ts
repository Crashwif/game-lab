import { pageAudio } from './audio';
import { drawArt } from './art';
import { story } from './content';
import { box, label, wrap, type Ctx } from './ink';
import { attachInput } from './input';
import { layout, type Layout } from './layout';
import { createPresentation, type Frame, type SceneView } from './presentation';
import { createProduction, type Production } from './production';
export type { SceneView } from './presentation';
export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  dispose(): void;
}

export function drawHud(c: Ctx, f: Frame, p: Production, l: Layout) {
  const { w, h, top, portrait, footer } = l, copy = story(f, p.active, p.choice !== 'auto');
  const accent = f.phase === 'crashed' ? '#f6a58b' : '#f6d499';
  box(c, 0, 0, w, top, '#152f40', undefined, 0);
  label(c, 'BROTILLA', 19, portrait ? 29 : 28, portrait ? 38 : 42, '#f5d7a4', w * .61 - 20, 'left', 'Georgia');
  label(c, (f.currentX100 / 100).toFixed(2) + '×', w - 19, 28, portrait ? 34 : 37, accent, w * .37, 'right');
  label(c, (f.held ? 'LAST ROUND · ' : '') + copy.title, 20, portrait ? 62 : 58, portrait ? 9.6 : 10, accent, w - 40, 'left');
  if (portrait) label(c, 'FICTIONAL SATIRE · INVENTED VOYAGE & DIALOGUE', 20, 82, 8, '#a8bfba', w - 40, 'left');
  else label(c, 'EUROPE → GAZA · INVENTED VOYAGE', w - 20, 58, 8, '#a8bfba', 285, 'right');
  box(c, 10, h - footer, w - 20, footer - 10, '#152f40fa', '#bd9d6c', 3);
  label(c, copy.speaker, 24, h - footer + 17, portrait ? 8.4 : 8.5, accent, w - 48, 'left');
  let size = portrait ? 25 : 24;
  const available = portrait ? 77 : 49;
  let rows: string[] = [];
  do {
    c.font = `700 ${size}px Georgia`;
    rows = wrap(c, '“' + copy.line + '”', w - 59);
    if (rows.length * (size + 3) <= available) break;
    size--;
  } while (size > 14);
  rows.forEach((row, i) => label(c, row, w / 2, h - footer + 43 + i * (size + 3), size, '#f6e1b8', w - 54, 'center', 'Georgia'));
  const status = f.phase === 'escaped' ? 'CASH-OUT CONFIRMED' : f.view.stake === null ? 'SPECTATING' : f.phase === 'crashed' ? 'ROUND ENDED · STAKE LOST' : 'IN ROUND';
  label(c, portrait ? copy.aside : status + ' / ' + copy.aside, w / 2, h - 25, portrait ? 7.7 : 8, '#aebfaf', w - 42);
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'scratch', bpm: 122, tempoRise: .15, music: .48 });
  const present = createPresentation(), director = createProduction();
  let input: ReturnType<typeof attachInput> | null = null;
  let previous: Frame['phase'] | null = null, lastStage = 0, lastSerial = 0, lastAge = 0, lastLine = '';
  return {
    draw(c, view, now) {
      const f = present(view, now), p = director.update(f), canvas = c.canvas;
      const l = layout(canvas.clientWidth > 0 && canvas.clientHeight > canvas.clientWidth);
      if (!input) input = attachInput(canvas, director.choose);
      input.sync(p);
      audio.update(f.phase === 'escaped' || f.held ? 'waiting' : view.phase, Math.max(0, 1 - 100 / Math.max(100, view.currentX100)));
      if (f.cue === 'cashout') audio.cashout();
      if (f.cue === 'crash') audio.crash('scratch', f.quiet);
      if (!f.quiet && f.phase === 'running' && previous === 'running') {
        if (f.stage > lastStage) audio.milestone(f.stage);
        else if (p.serial > lastSerial) audio.fx(p.active === 'statement' ? 'notify' : 'camera', .35);
      }
      if (!f.quiet && f.phase === 'crashed' && previous === 'crashed' && lastAge < 1.1 && f.outcomeAge >= 1.1 && f.outcomeAge < 1.4) audio.fx('squeak', .65);
      const t = f.phase === 'running' ? f.elapsed : f.phase === 'waiting' || f.phase === 'betting' ? now / 1000 : f.elapsed + f.outcomeAge;
      c.save(); c.setTransform(canvas.width / l.w, 0, 0, canvas.height / l.h, 0, 0);
      drawArt(c, f, p, l, t); drawHud(c, f, p, l);
      c.restore();
      const copy = story(f, p.active, p.choice !== 'auto'), announcement = copy.speaker + ': ' + copy.line;
      if (announcement !== lastLine && typeof document !== 'undefined') {
        const live = document.getElementById('story'); if (live) live.textContent = announcement;
      }
      // Copied observations for browser QA, with no controller, intents or future outcomes.
      (canvas as HTMLCanvasElement & { gameScene?: unknown }).gameScene = {
        phase: f.phase, stage: f.stage, outcomeAge: f.outcomeAge, held: f.held,
        ending: f.phase === 'crashed' ? 'empty-morale' : f.phase === 'escaped' ? 'personal-boundaries' : null,
        portrait: l.portrait, line: copy.line, choice: p.choice, active: p.active,
        weights: { ...p.weights }, serial: p.serial, inputEnabled: p.enabled,
      };
      lastLine = announcement; previous = f.phase; lastStage = f.stage; lastSerial = p.serial; lastAge = f.outcomeAge;
    },
    dispose() { input?.dispose(); input = null; },
  };
}
