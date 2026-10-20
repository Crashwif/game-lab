import { drawDog, walked, type ApplicantPose, type Rig } from './character';
import { PEANUT, allocationAt, mix, multiplierLabel, testimony } from './direction';
import { C, box, label, line, mono, oval } from './ink';
import { drawBackdrop, drawBay, drawPeanut, drawProcedure, type MinistryView } from './ministry';
import type { SceneView } from './scene';

export const PORTRAIT = { width: 540, height: 752 } as const;

/** CSS selects the composition; the platform retains its canonical canvas and clock. */
export function isPortrait(canvas: Pick<HTMLCanvasElement, 'clientWidth' | 'clientHeight'>): boolean {
  return canvas.clientWidth > 0 && canvas.clientHeight > canvas.clientWidth;
}

function wrap(c: CanvasRenderingContext2D, text: string, y: number, color: string, size = 27): void {
  c.font = `800 ${size}px Arial, sans-serif`;
  let row = '';
  for (const word of text.split(' ')) {
    if (row && c.measureText(`${row} ${word}`).width > 490) {
      label(c, row, 24, y, size, color); row = word; y += size * 1.2;
    } else row += `${row ? ' ' : ''}${word}`;
  }
  if (row) label(c, row, 24, y, size, color);
}

/** Recompose the apparatus around the applicant, with one demand and one punchline. */
export function drawPortrait(c: CanvasRenderingContext2D, v: MinistryView, view: SceneView, accepted: number | null, exit: number,
  pose: ApplicantPose, figure: (c: CanvasRenderingContext2D, pose: ApplicantPose, crate: boolean) => Rig, punchline: string): Rig {
  const { d, crash, running } = v;
  c.save();
  c.setTransform(c.canvas.width / PORTRAIT.width, 0, 0, c.canvas.height / PORTRAIT.height, 0, 0);
  box(c, 0, 0, 540, 752, 0, C.ink, C.ink, 0);
  oval(c, 34, 31, 21, 21, C.lime, C.lime, 0);
  oval(c, 28, 27, 2.5, 3.5, C.ink, C.ink, 0); oval(c, 40, 27, 2.5, 3.5, C.ink, C.ink, 0);
  oval(c, 34, 36, 5, 5, C.coral, C.ink, 1.5);
  c.beginPath(); c.arc(34, 35, 12, .2, Math.PI - .2); c.strokeStyle = C.ink; c.lineWidth = 2; c.stroke();
  label(c, 'KNOW YOUR CLOWN', 66, 40, 28, C.cream, 'left', 453);
  mono(c, 'MINISTRY OF AIRDROPS', 23, 67, 14, C.mint);
  label(c, accepted !== null ? 'ESCAPED' : crash !== null ? 'CRASHED' : running ? 'LIVE AUDIT' : 'NEXT APPLICANT', 23, 99, 20, accepted !== null ? C.mint : crash !== null ? C.coral : C.cream, 'left', 190);
  label(c, multiplierLabel(accepted ?? view.currentX100), 518, 107, 60, accepted !== null ? C.mint : crash !== null ? C.coral : C.lime, 'right', 296, 900);

  box(c, 0, 126, 540, 460, 0, C.paper, C.paper, 0);
  label(c, accepted !== null ? 'CLAIM ABANDONED' : crash !== null ? 'IDENTITY EXPORTED' : d.title, 23, 159, 27, C.ink, 'left', 494);
  wrap(c, accepted !== null ? `Cashed out at ${multiplierLabel(accepted)}. Paper hands.` : crash !== null ? 'Thank you for being the product.' : d.demand, 190, C.ink);

  c.save(); c.beginPath(); c.rect(0, 236, 540, 348); c.clip(); c.translate(-241, 115);
  drawBackdrop(c, v);
  // The exit panel cross-fades over the bay and its machinery here; the crate stays with the landscape composition.
  if (v.gone < .99) { c.save(); c.globalAlpha *= 1 - v.gone; drawBay(c, v); drawProcedure(c, v, false); c.restore(); }
  if (v.gone > .01) {
    c.save(); c.globalAlpha *= v.gone;
    box(c, 347, 129, 330, 302, 32, C.mint, C.ink, 4);
    box(c, 369, 152, 286, 275, 18, '#284844', C.ink, 3);
    label(c, 'EXIT / NO DATA REQUIRED', 512, 181, 21, C.lime, 'center', 265);
    c.restore();
  }
  // The escape walks along the doorway floor toward the exit panel, away from the camera; the gait follows its own floor distance.
  const rig = figure(c, accepted === null ? pose : { ...pose, x: mix(511, 592, exit), scale: mix(1, .63, exit), ...walked(81, exit) }, accepted === null);
  c.restore();
  const witness = 1 - Math.max(v.park, v.gone);
  if (d.stage === 2 && witness > .01) {
    c.save(); c.globalAlpha *= witness;
    drawDog(c, 74, 548, d.seconds, d.dread);
    box(c, 14, 407, 157, 32, 9, C.cream, C.ink, 2);
    label(c, testimony(d), 92, 429, 16, C.ink, 'center', 143);
    line(c, [75, 439, 82, 449, 87, 439], C.ink, 2);
    c.restore();
  }

  const payoff = crash !== null && crash >= PEANUT && accepted === null;
  box(c, 0, 586, 540, 64, 0, accepted !== null ? C.mint : payoff ? C.lime : C.brass, C.ink, 0);
  if (accepted === null) {
    drawPeanut(c, 49, 617, 1.08, -.22);
    label(c, payoff ? 'YOUR ALLOCATION: 1 PEANUT.' : crash !== null ? 'ALLOCATION PROCESSING…' : running ? `ALLOCATION: ${allocationAt(d.x100).text}` : 'ALLOCATION STILL PENDING', 87, 625, 24, C.ink, 'left', 426);
  } else label(c, 'PRIVACY INTACT', 270, 627, 29, C.ink, 'center');

  wrap(c, punchline, 692, payoff ? C.coral : accepted !== null ? C.mint : C.cream, payoff ? 32 : punchline.length > 34 ? 24 : 28);
  c.restore();
  return rig;
}
