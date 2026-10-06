import { box, clamp, ease, INK, line, oval, shape, text } from './drawing';

function officer(c: CanvasRenderingContext2D, x: number, y: number, walk: number, scale: number) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  oval(c, 0, 0, 21, 5, '#15142b55');
  const step = Math.sin(walk) * 5;
  line(c, [[-9, -36], [-12 - step, -8]], '#252842', 11);
  line(c, [[8, -36], [13 + step, -8]], '#252842', 11);
  box(c, -25 - step, -9, 20, 9, '#1c1c30', 3, 2); box(c, 4 + step, -9, 22, 9, '#1c1c30', 3, 2);
  box(c, -20, -80, 40, 49, '#446e94', 9, 3);
  line(c, [[-20, -40], [20, -40]], '#1c1c30', 8);
  box(c, -4, -44, 9, 8, '#cbb27b', 1, 1);
  shape(c, [[9, -73], [16, -70], [15, -60], [9, -56], [3, -60], [2, -70]], '#edce77', 1);
  line(c, [[-18, -71], [-37, -60], [-52, -75]], '#345a82', 13);
  oval(c, -52, -75, 7, 7, '#d7a980', 2);
  c.save(); c.translate(-56, -77); c.rotate(-0.45); box(c, -25, -5, 29, 10, '#283145', 2, 2); box(c, -30, -8, 10, 16, '#95a6b1', 2, 2); c.restore();
  line(c, [[19, -70], [29, -48]], '#345a82', 12); oval(c, 29, -43, 7, 8, '#d7a980', 2);
  oval(c, 0, -96, 19, 23, '#dbab80', 3);
  box(c, -20, -105, 40, 12, '#272d42', 3, 2);
  line(c, [[-15, -100], [-4, -100]], '#9ab6c9', 2);
  oval(c, -4, -87, 12, 5, '#483138');
  shape(c, [[-21, -110], [-17, -124], [16, -124], [23, -110]], '#436b8a', 3);
  box(c, -24, -112, 48, 7, '#23334c', 2, 2); oval(c, 0, -118, 5, 6, '#efd079', 1);
  c.restore();
}

export function police(c: CanvasRenderingContext2D, age: number, reduced: boolean) {
  if (age < 0) return;
  const arrival = reduced ? 1 : ease(age / 0.8);
  const x = 1090 - arrival * 295;
  const shake = reduced || age > 1.4 ? 0 : Math.sin(age * 18) * 2 * (1 - clamp(age / 1.4));
  c.save(); c.translate(x, 422 + shake);
  oval(c, 0, 23, 117, 13, '#151b2e55');
  shape(c, [[-118, 6], [-109, -33], [-63, -48], [-37, -87], [45, -87], [84, -43], [115, -31], [121, 7]], '#e6e7cf', 5);
  shape(c, [[-59, -47], [-32, -80], [39, -80], [69, -47]], '#76aeb4', 4);
  line(c, [[6, -78], [6, -46]], INK, 5);
  box(c, -115, -29, 231, 28, '#27354f', 3, 3);
  text(c, 'POLICE', 8, -8, 23, '#f6eac3', 'center');
  for (const wheel of [-73, 77]) { oval(c, wheel, 9, 24, 24, '#1d2130', 3); oval(c, wheel, 9, 12, 12, '#8e98a0', 3); }
  box(c, -34, -98, 61, 12, '#23344b', 3, 2);
  const red = reduced ? 0.8 : 0.45 + Math.sin(age * 7) * 0.35;
  c.globalAlpha = red; box(c, -31, -103, 27, 13, '#fa5c76', 4, 1);
  c.globalAlpha = reduced ? 0.8 : 0.9 - red; box(c, 1, -103, 23, 13, '#75c8ff', 4, 1); c.globalAlpha = 1;
  box(c, -115, -27, 17, 12, '#fff2ae', 2, 1);
  c.restore();
  const approach = reduced ? 1 : ease((age - 0.8) / 1.6);
  if (age > 0.7 || reduced) {
    c.save(); c.globalAlpha = reduced ? 0.14 : 0.1 + Math.sin(age * 1.4) * 0.025;
    shape(c, [[696 - approach * 75, 365], [201, 259], [192, 463]], '#fff4b9', 0); c.restore();
    officer(c, 774 - approach * 101, 480, approach < 1 && !reduced ? age * 12 : 0, 0.85);
    officer(c, 897 - approach * 53, 475, approach < 1 && !reduced ? age * 12 + 2 : 0, 0.78);
  }
  if (age > 1.35 || reduced) {
    const reveal = reduced ? 1 : ease((age - 1.35) / 0.5);
    c.save(); c.translate(455, 497); c.rotate(-0.035); c.scale(reveal, 1);
    box(c, -290, -13, 650, 28, '#edd271', 0, 3);
    for (let i = 0; i < 18; i++) shape(c, [[-290 + i * 38, -13], [-277 + i * 38, -13], [-292 + i * 38, 15], [-305 + i * 38, 15]], '#252638', 0);
    box(c, -143, -12, 277, 26, '#f4da75', 0, 0); text(c, 'GARDEN CLOSED', -4, 6, 17, '#fff2ba', 'center'); c.restore();
  }
}
