import { pageAudio } from './audio';
import { drawArt } from './art';
import { THEME, story } from './content';
import { box, label, wrap } from './ink';
import { createPresentation, type SceneView, type Frame } from './presentation';
export type { SceneView } from './presentation';
export interface Scene {
    draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
    dispose?(): void;
}
/** The shell retains canonical controls. All themed language stays in the picture. */
export function drawHud(ctx: CanvasRenderingContext2D, frame: Frame, width: number, height: number) {
    const portrait = width < 650, copy = story(frame);
    const colour = frame.phase === 'crashed' ? THEME.danger : THEME.accent;
    box(ctx, 0, 0, width, portrait ? 91 : 67, THEME.bg, undefined, 0);
    label(ctx, THEME.title, 20, portrait ? 27 : 25, portrait ? 29 : 32, THEME.ink, width * .6 - 24, 'left', THEME.font);
    label(ctx, (frame.currentX100 / 100).toFixed(2) + '×', width - 20, portrait ? 29 : 28, portrait ? 40 : 42, colour, width * .34, 'right');
    label(ctx, frame.held ? 'LAST ROUND · ' + copy.title : copy.title, 20, portrait ? 63 : 51, portrait ? 12 : 11, colour, width - 40, 'left');
    const accepted = frame.phase === 'escaped';
    const status = accepted ? 'CASH-OUT CONFIRMED' : frame.view.stake === null ? 'SPECTATING · NO CREDITS RIDING' : frame.phase === 'crashed' ? 'ROUND ENDED · STAKE LOST' : frame.phase === 'running' ? 'IN ROUND · CASH OUT TO LEAVE' : 'CREDITS HAVE NO MONETARY VALUE';
    if (portrait)
        label(ctx, status, 20, 82, 10, '#c8baca', width - 40, 'left');
    const footer = portrait ? 156 : 106;
    box(ctx, 13, height - footer, width - 26, footer - 13, THEME.bg + 'ee', '#8d779c66', 7);
    label(ctx, copy.speaker, width / 2, height - footer + 17, portrait ? 11 : 10, colour, width - 52);
    ctx.font = '700 ' + (portrait ? 24 : 23) + 'px Georgia';
    const lines = wrap(ctx, '“' + copy.line + '”', width - (portrait ? 64 : 92));
    lines.slice(0, portrait ? 3 : 2).forEach((line, i) => label(ctx, line, width / 2, height - footer + 46 + i * (portrait ? 27 : 25), portrait ? 24 : 23, THEME.ink, width - 50, 'center', 'Georgia'));
    label(ctx, portrait ? copy.aside : status + '  /  ' + copy.aside, width / 2, height - 24, portrait ? 10 : 10, '#bcacc6', width - 52);
    if ((frame.phase === 'crashed' || accepted) && frame.outcomeAge > 2.6) {
        ctx.save();
        ctx.translate(width * .5, height * .43);
        ctx.rotate(-.04);
        box(ctx, -width * .37, -39, width * .74, 78, THEME.bg + 'ef', colour, 5);
        label(ctx, accepted ? 'I STILL HAVE A BODY.' : copy.title, 0, -10, portrait ? 25 : 31, colour, width * .69, 'center', THEME.font);
        label(ctx, accepted ? 'IT WANTS A TAXI.' : 'REALITY HAS LEFT THE CHAT.', 0, 20, 12, THEME.ink, width * .68);
        ctx.restore();
    }
}
export function createScene(): Scene {
    const audio = pageAudio({ style: THEME.style, crash: THEME.crash, bpm: 118, tempoRise: .22, music: .55 });
    const present = createPresentation();
    let lastStage = -1, lastLine = '', previousMode: Frame['phase'] | null = null;
    let lastAge = 0;
    return { draw(ctx, view, now) {
            const frame = present(view, now);
            audio.update(frame.phase === 'escaped' || frame.held ? 'waiting' : view.phase, Math.max(0, 1 - 100 / Math.max(100, view.currentX100)));
            if (frame.cue === 'cashout')
                audio.cashout();
            if (frame.cue === 'crash')
                audio.crash(THEME.crash, frame.quiet);
            if (previousMode === 'running' && frame.phase === 'running' && frame.stage > lastStage && !frame.quiet)
                audio.milestone(frame.stage);
            if (!frame.quiet && frame.phase === 'crashed' && previousMode === 'crashed' && lastAge < 1.1 && frame.outcomeAge >= 1.1 && frame.outcomeAge < 1.5)
                audio.fx('thud', .8);
            const canvas = ctx.canvas;
            const portrait = canvas.clientHeight > canvas.clientWidth && canvas.clientWidth > 0;
            const width = portrait ? 540 : 960, height = portrait ? 800 : 540;
            ctx.save();
            ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
            const top = portrait ? 91 : 67;
            ctx.translate(0, top);
            drawArt(ctx, frame, width, height - top, frame.phase === 'running' ? frame.elapsed : frame.phase === 'waiting' || frame.phase === 'betting' ? now / 1000 : frame.elapsed + frame.outcomeAge);
            ctx.translate(0, -top);
            drawHud(ctx, frame, width, height);
            ctx.restore();
            const copy = story(frame), announcement = copy.speaker + ': ' + copy.line;
            if (announcement !== lastLine && typeof document !== 'undefined') {
                const live = document.getElementById('story');
                if (live)
                    live.textContent = announcement;
                lastLine = announcement;
            }
            // Read-only observations aid QA; they never expose or alter a future outcome.
            (canvas as HTMLCanvasElement & {
                gameScene?: unknown;
            }).gameScene = { phase: frame.phase, stage: frame.stage, ending: frame.phase === 'crashed' ? frame.ending : null, outcomeAge: frame.outcomeAge, held: frame.held, portrait, line: copy.line };
            previousMode = frame.phase;
            lastStage = frame.stage;
            lastAge = frame.outcomeAge;
        } };
}
