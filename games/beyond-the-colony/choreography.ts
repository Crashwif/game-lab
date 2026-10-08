import { actAt, between, clamp, recoil, smooth, TAU, windowAt, type Act } from './motion';
import type { PenguinPose } from './penguin';

export interface Performance { pose: PenguinPose; travel: number; sag: number; gale: number; landAge: number; act: Act }
export function perform(seconds: number, active: boolean, idleTime: number, reduced: boolean): Performance {
  const act = actAt(seconds);
  const a = act.age;
  // Each scene pauses for the confrontation, then the camera catches up during the recovery.
  const localRoute = a < 1.1 ? a : a < 2.7 ? 1.1 : a - 1.6;
  const route = act.index * 5.4 + localRoute;
  const walk = active && (a < 1.1 || a >= 2.7);
  const time = reduced ? 0 : active ? seconds : idleTime;
  const p: PenguinPose = {
    x: 437, y: 426, time, gait: route * 1.5, walk: walk && !reduced, angle: 0,
    crouch: 0, stretch: 0, airborne: false, arm: 0, head: 0, mood: 'defiant',
    scarf: .4, scale: 1.12, reduced, look: 1,
  };
  let landAge = -1;
  let sag = 0;
  let gale = .2;
  if (!active) {
    p.walk = false; p.gait = 0; p.mood = 'bored';
    p.angle = reduced ? -.05 : Math.sin(time * 1.8) * .065;
    p.arm = reduced ? .1 : .25 + Math.sin(time * 2.6) * .32;
    p.head = reduced ? -.3 : Math.sin(time * 1.1) * .8;
    p.look = reduced ? -1 : Math.sin(time * .8) > .2 ? -1 : 1;
    p.crouch = reduced ? .1 : .12 + Math.sin(time * 2) * .1;
    return { pose: p, travel: 0, sag: 0, gale, landAge, act };
  }
  const leap = (start: number, end: number, height: number, forward: number, spin = 0): void => {
    if (a < start || a > end) return;
    const u = clamp((a - start) / (end - start));
    p.y -= Math.sin(u * Math.PI) * height;
    p.x += forward * smooth(u);
    p.angle += spin * smooth(u) - .12 * Math.sin(u * Math.PI);
    p.airborne = true; p.walk = false; p.arm = 1.1; p.stretch = Math.sin(u * Math.PI) * .5;
  };
  switch (act.kind) {
    case 0: {
      p.crouch = windowAt(a, .95, 1.55, .23) * .9;
      leap(1.45, 2.6, 82, 105);
      p.x += a > 2.6 ? 105 * (1 - between(2.6, 4.2, a)) : 0;
      landAge = a - 2.6;
      p.paper = a > 3.1 && a < 5.7;
      p.arm += windowAt(a, 3.1, 5.3, .3) * 1.3;
      p.look = a > 3.1 && a < 5.6 ? -1 : 1;
      p.head = a > 3.1 && a < 5.6 ? -.7 : .2;
      p.mood = a > 2.7 ? 'smug' : 'defiant';
      break;
    }
    case 1: {
      const slide = windowAt(a, 1.4, 4.8, .7);
      p.x += slide * 86; p.y += slide * 25; p.angle = slide * 1.42;
      p.walk = walk && slide < .15; p.airborne = slide > .3;
      p.arm = -.45 + slide * .7; p.head = -slide * 1.2;
      p.mood = slide > .4 ? 'panic' : 'defiant'; p.scarf = 1.5;
      leap(5, 5.9, 57, 58); p.x += a > 5.9 ? 58 * (1 - between(5.9, 7, a)) : 0; landAge = a - 5.9;
      break;
    }
    case 2: {
      p.crouch = windowAt(a, .9, 2.25, .35) * .65;
      p.angle = -recoil(a - 2.13, .23);
      p.x -= Math.max(0, recoil(a - 2.13, 37));
      const slap = windowAt(a, 3.1, 4.55, .2);
      p.x += slap * 101; p.arm = -windowAt(a, 2.6, 3.2, .25) * 1.2 + slap * 2.05;
      p.head = -.4 + slap * .8; p.mood = a > 2.1 && a < 2.7 ? 'panic' : a > 3.4 ? 'smug' : 'defiant';
      p.paper = a > 3.4 && a < 5.8; p.walk = walk && slap < .2;
      sag = recoil(a - 2.15, 8);
      break;
    }
    case 3: {
      p.head = Math.sin(a * 3) * .65 * windowAt(a, 1, 3.1, .4);
      p.arm = windowAt(a, .8, 2.7, .3) * 1.4; p.mood = a < 2.8 ? 'bored' : 'defiant';
      p.crouch = windowAt(a, 2.4, 3.1, .25) * .8;
      leap(3, 4.2, 90, 145, .5);
      if (a > 4.2) { p.x += 145 * (1 - between(4.2, 6.6, a)); p.angle = .5 * (1 - between(4.2, 4.6, a)); }
      landAge = a - 4.2; p.paper = a > 4.3; break;
    }
    case 4: {
      const gust = windowAt(a, .6, 5.8, .65);
      p.x -= gust * (79 + (reduced ? 0 : Math.sin(seconds * 5) * 17));
      p.angle = gust * .59; p.crouch = gust * .5; p.scarf = gust * 2.2;
      p.arm = gust * (reduced ? 1.1 : .8 + Math.sin(seconds * 9) * .7);
      p.head = -gust * .7; p.mood = 'panic'; gale = .3 + gust * 1.6;
      leap(5.7, 6.5, 48, 47); if (a > 6.5) p.x += 47 * (1 - between(6.5, 7, a)); landAge = a - 6.5; break;
    }
    case 5: {
      const god = windowAt(a, 1.55, 5.8, 1.0);
      p.crouch = windowAt(a, .8, 1.8, .35) * 1.0;
      p.y -= god * (75 + (reduced ? 0 : Math.sin(seconds * 3) * 13));
      p.x += god * 27; p.arm = god * 1.8; p.walk = walk && god < .15; p.airborne = god > .05;
      p.angle = reduced ? 0 : Math.sin(seconds * 3.1) * .14 * god;
      p.mood = god > .15 ? 'cosmic' : 'defiant'; p.scale += god * .11; p.scarf = 1.5; p.aura = god;
      landAge = a - 5.8; break;
    }
    case 6: {
      const duck = windowAt(a, 1.6, 3.45, .4);
      p.crouch = duck * 1.2; p.arm = duck * -1.1; p.head = duck * .6; p.mood = a < 3.2 ? 'panic' : 'defiant';
      p.x -= duck * 32;
      leap(3.5, 4.6, 77, 117, -.45);
      if (a > 4.6) { p.x += 117 * (1 - between(4.6, 6, a)); p.angle = -.45 * (1 - between(4.6, 4.95, a)); }
      p.paper = a > 4.7; p.arm += windowAt(a, 4.8, 6.5, .3) * 1.5; landAge = a - 4.6; break;
    }
    case 7: {
      p.mood = 'panic'; p.look = -1; p.head = -.7;
      p.arm = .5 + (reduced ? 0 : Math.sin(seconds * 12) * .8); p.scarf = 2;
      p.crouch = windowAt(a, 2.8, 3.35, .2) * .9;
      leap(3.3, 4.7, 84, -67, -TAU);
      if (a > 4.7) { p.x -= 67 * (1 - between(4.7, 6.2, a)); p.angle = -TAU; p.mood = 'dazed'; }
      landAge = a - 4.7; break;
    }
  }
  if (landAge >= 0 && landAge < .75) {
    p.crouch += Math.max(0, recoil(landAge + .06, .7));
    p.head += recoil(landAge, .35); sag += Math.max(0, recoil(landAge, 10));
  }
  p.y += sag;
  if (reduced) {
    p.x = 437; p.y = 426; p.angle = act.kind === 1 ? 1.15 : act.kind === 4 ? .3 : 0;
    if (act.kind === 1) p.y += 15;
    p.crouch = act.kind === 6 ? .45 : 0; p.arm = act.kind === 5 ? 1.6 : .6; p.walk = false;
    p.airborne = false; p.stretch = 0; p.scale = 1.12; p.gait = 0; p.time = 0;
    sag = 0; landAge = -1;
  }
  return { pose: p, travel: reduced ? act.index * 810 : route * 150, sag, gale, landAge, act };
}
