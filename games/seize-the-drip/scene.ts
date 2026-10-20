import { pageAudio } from './audio';
import { drawArt } from './art';
import { story } from './content';
import { box, label, wrap } from './ink';
import { attachInput } from './input';
import { layout, type Layout } from './layout';
import { createHaul, type Haul } from './loot';
import { createPresentation, type Frame, type SceneView } from './presentation';
export type { SceneView } from './presentation';
export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  dispose(): void;
}

export function drawHud(c: CanvasRenderingContext2D, frame: Frame, haul: Haul, l: Layout) {
  const { w, h, portrait, top, footer } = l, copy = story(frame, haul.next);
  const gold = frame.phase === 'crashed' ? '#ffac97' : '#e7c67d';
  box(c, 0, 0, w, top, '#261e26', undefined, 0);
  label(c, 'SEIZE THE DRIP', 20, portrait ? 28 : 27, portrait ? 30 : 36, '#f7eacf', w * .62 - 24, 'left', 'Georgia');
  label(c, (frame.currentX100 / 100).toFixed(2) + '×', w - 20, 28, portrait ? 38 : 39, gold, w * .33, 'right');
  label(c, (frame.held ? 'LAST ROUND · ' : '') + copy.title, 20, portrait ? 60 : 55, portrait ? 11 : 10, gold, w - 40, 'left');
  const accepted = frame.phase === 'escaped';
  const status = accepted ? 'CASH-OUT CONFIRMED' : frame.view.stake === null ? 'SPECTATING · NO CREDITS RIDING' : frame.phase === 'crashed' ? 'ROUND ENDED · STAKE LOST' : frame.phase === 'running' ? 'IN ROUND · CASH OUT TO LEAVE' : 'CREDITS HAVE NO MONETARY VALUE';
  if (portrait) label(c, status, 20, 80, 9, '#c7b69f', w - 40, 'left');
  box(c, 12, h - footer, w - 24, footer - 12, '#281e27f5', '#a9824e', 4);
  label(c, copy.speaker, 26, h - footer + 16, portrait ? 9 : 9, gold, w - 52, 'left');
  let size = portrait ? 25 : 24;
  const available = portrait ? 86 : 51;
  let rows: string[] = [];
  do {
    c.font = `700 ${size}px Georgia`;
    rows = wrap(c, '“' + copy.line + '”', w - 62);
    if (rows.length * (size + 3) <= available) break;
    size--;
  } while (size > 15);
  rows.forEach((row, i) => label(c, row, w / 2, h - footer + 43 + i * (size + 3), size, '#f4e7cb', w - 56, 'center', 'Georgia'));
  label(c, portrait ? copy.aside : status + '  /  ' + copy.aside, w / 2, h - 24, 8, '#c7b69f', w - 52);
  // The inventory is a visual prop count, never a score or a cash payout.
  if (frame.phase === 'running') {
    const badgeY = h - footer - 12;
    box(c, w / 2 - 100, badgeY - 16, 200, 25, '#ead6ae', '#8c6341', 2);
    label(c, `${haul.items.length}${haul.items.length === 12 ? '+' : ''} ACCESSORIES · ${haul.choice === 'auto' ? 'AUTO REDISTRIBUTION' : 'PERSONAL SHOPPING'}`, w / 2, badgeY - 3, 8, '#5c3033', 190);
  }
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'club', crash: 'siren', bpm: 110, tempoRise: .18, music: .5 });
  const present = createPresentation(), inventory = createHaul();
  let input: ReturnType<typeof attachInput> | null = null;
  let previous: Frame['phase'] | null = null, lastStage = -1, lastSerial = -1, lastAge = 0, lastLine = '';
  return {
    draw(ctx, view, now) {
      const frame = present(view, now), haul = inventory.update(frame);
      const canvas = ctx.canvas;
      const l = layout(canvas.clientWidth > 0 && canvas.clientHeight > canvas.clientWidth);
      if (!input) input = attachInput(canvas, inventory.choose);
      input.sync(haul, l);
      audio.update(frame.phase === 'escaped' || frame.held ? 'waiting' : view.phase, Math.max(0, 1 - 100 / Math.max(100, view.currentX100)));
      if (frame.cue === 'cashout') audio.cashout();
      if (frame.cue === 'crash') audio.crash('siren', frame.quiet);
      if (!frame.quiet && frame.phase === 'running' && previous === 'running') {
        if (frame.stage > lastStage) audio.milestone(frame.stage);
        else if (haul.serial > lastSerial) audio.fx('kaching', .23);
      }
      if (!frame.quiet && frame.phase === 'crashed' && previous === 'crashed' && lastAge < 1.3 && frame.outcomeAge >= 1.3 && frame.outcomeAge < 1.6) audio.fx('thud', .65);
      const time = frame.phase === 'running' ? frame.elapsed : frame.phase === 'waiting' || frame.phase === 'betting' ? now / 1000 : frame.elapsed + frame.outcomeAge;
      ctx.save(); ctx.setTransform(canvas.width / l.w, 0, 0, canvas.height / l.h, 0, 0);
      drawArt(ctx, frame, haul, l, time);
      drawHud(ctx, frame, haul, l);
      ctx.restore();
      const copy = story(frame, haul.next), announcement = copy.speaker + ': ' + copy.line;
      if (lastLine !== announcement && typeof document !== 'undefined') {
        const live = document.getElementById('story');
        if (live) live.textContent = announcement;
      }
      lastLine = announcement;
      // A copied diagnostic observation only: no setters, inputs or future outcomes.
      (canvas as HTMLCanvasElement & { gameScene?: unknown }).gameScene = {
        phase: frame.phase, stage: frame.stage, ending: frame.phase === 'crashed' ? 'confiscation' : null,
        outcomeAge: frame.outcomeAge, held: frame.held, portrait: l.portrait, line: copy.line,
        choice: haul.choice, next: haul.next, items: [...haul.items], serial: haul.serial, inputEnabled: haul.enabled,
      };
      previous = frame.phase; lastStage = frame.stage; lastSerial = haul.serial; lastAge = frame.outcomeAge;
    },
    dispose() { input?.dispose(); input = null; },
  };
}
