import { drawSet } from './setpieces';
import { solveLimb, swingLimb, walkingFoot } from './ink';
import type { Frame } from './presentation';
type Ctx = CanvasRenderingContext2D;
type Paint = string | CanvasGradient | CanvasPattern;
const TAU = Math.PI * 2, clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v)), mix = (a: number, b: number, t: number) => a + (b - a) * t, ease = (v: number) => { v = clamp(v); return v * v * (3 - 2 * v); };
function hash(i: number) { return ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1; }
function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: Paint | null, stroke?: Paint | null, width = 1) { c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, TAU); if (fill) {
    c.fillStyle = fill;
    c.fill();
} if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
} }
function round(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: Paint | null, stroke?: Paint | null) { c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) {
    c.fillStyle = fill;
    c.fill();
} if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1;
    c.stroke();
} }
function line(c: Ctx, points: number[], color: string, width: number) { c.beginPath(); c.moveTo(points[0]!, points[1]!); for (let i = 2; i < points.length; i += 2)
    c.lineTo(points[i]!, points[i + 1]!); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
function eye(c: Ctx, x: number, y: number, r: number, t: number, open = 1, color = '#efe8d8') { ellipse(c, x, y, r, r * .55 * open, color); ellipse(c, x + Math.sin(t) * r * .18, y, r * .29, r * .45 * open, '#241c36'); ellipse(c, x + r * .13, y - r * .12, r * .07, r * .1, '#faffdf'); }

export function raverPose(t: number, i: number, level: number) {
    const sway = Math.sin(t * 1.7 + i) * (.05 + level * .045);
    const wave = Math.sin(t * 2 + i) * 11;
    const bounce = Math.abs(Math.sin(t * 2 + i)) * 2.5;
    const leftHip = { x: -10, y: -45 + bounce }, rightHip = { x: 10, y: -45 + bounce };
    const leftLeg = solveLimb(leftHip, { x: -18, y: 0 }, 23, 23, -1);
    const rightLeg = solveLimb(rightHip, { x: 18, y: 0 }, 23, 23, 1);
    const leftRoot = { x: -20, y: -89 + bounce }, rightRoot = { x: 20, y: -89 + bounce };
    const leftArm = solveLimb(leftRoot, { x: -42, y: -124 - wave + bounce }, 25, 25, -1);
    const rightArm = solveLimb(rightRoot, { x: 41, y: -123 + wave + bounce }, 25, 25, 1);
    return { sway, bounce, leftHip, rightHip, leftLeg, rightLeg, leftRoot, rightRoot, leftArm, rightArm };
}

function drawRaver(c: Ctx, x: number, y: number, s: number, t: number, i: number, level: number, collective = false) {
    const pose = raverPose(t, i, level);
    const { bounce } = pose;
    c.save();
    c.translate(x, y);
    c.rotate(pose.sway);
    c.scale(s, s);
    const hue = ['#4a365a', '#3c3d60', '#664759', '#454252', '#5f436d'][i % 5]!;
    const skin = collective ? '#e1b49d' : ['#917084', '#6b6b8b', '#9b7287'][i % 3]!;
    for (const leg of [pose.leftLeg, pose.rightLeg]) {
        line(c, [leg.root.x, leg.root.y, leg.joint.x, leg.joint.y, leg.end.x, leg.end.y], hue, 13);
    }
    round(c, -23, -104 + bounce, 46, 65, 17, hue);
    for (const a of [pose.leftArm, pose.rightArm]) {
        line(c, [a.root.x, a.root.y, a.joint.x, a.joint.y, a.end.x, a.end.y], hue, 11);
        ellipse(c, a.end.x, a.end.y, 4.5, 5, skin);
    }
    ellipse(c, 0, -126 + bounce, 22, 25, skin);
    c.fillStyle = hue;
    c.beginPath();
    c.arc(0, -136 + bounce, 23, Math.PI, TAU);
    c.fill();
    if (level > .25 || collective) {
        eye(c, -8, -126 + bounce, 5, t + i, 1, collective ? '#d9fd85' : '#b0a9c3');
        eye(c, 8, -126 + bounce, 5, t + i, 1, collective ? '#d9fd85' : '#b0a9c3');
    }
    c.restore();
}

export function djPose(t: number, level: number) {
    const scratch = Math.sin(t * 3.4) * (3 + level * 2.5);
    const leftRoot = { x: -18, y: -16 }, rightRoot = { x: 18, y: -16 };
    const leftArm = solveLimb(leftRoot, { x: -32 + scratch, y: 5 }, 16, 16, -1);
    const rightArm = solveLimb(rightRoot, { x: 32 - scratch, y: 5 }, 16, 16, 1);
    return { leftRoot, rightRoot, leftArm, rightArm };
}

export function playerPose(t: number, level: number, consume = 0, walkDist = 0, walkSpan = 180) {
    const walkBlend = walkDist > 0 && walkDist < walkSpan ? ease(walkDist / 18) * ease((walkSpan - walkDist) / 18) : 0;
    const bounce = walkBlend * Math.abs(Math.sin(walkDist / 52 * TAU)) * 3;
    const sway = (1 - walkBlend * .6) * Math.sin(t * 1.9) * (.025 + level * .07);
    const leftStep = walkingFoot(walkDist, walkSpan, 52, 0, 11);
    const rightStep = walkingFoot(walkDist, walkSpan, 52, .5, 11);
    const leftHip = { x: -15, y: -75 + bounce }, rightHip = { x: 15, y: -75 + bounce };
    const leftLeg = solveLimb(leftHip, { x: -21 + leftStep.x, y: -6 + leftStep.y }, 36, 36, 1);
    const rightLeg = solveLimb(rightHip, { x: 23 + rightStep.x, y: -6 + rightStep.y }, 36, 36, 1);
    const leftRoot = { x: -30, y: -136 + bounce };
    const rightRoot = { x: 31, y: -135 + bounce };
    const leftArm = solveLimb(leftRoot, { x: -40 - Math.sin(t * 1.9) * 3, y: -80 + bounce }, 34, 34, 1);
    const restRight = solveLimb(rightRoot, { x: 49, y: -88 + bounce }, 34, 34, -1);
    const mouthRight = solveLimb(rightRoot, { x: 6, y: -176 + bounce }, 34, 34, 1);
    const rightArm = swingLimb(rightRoot, restRight, mouthRight, consume, 34, 34);
    return { bounce, sway, leftHip, rightHip, leftLeg, rightLeg, leftRoot, rightRoot, leftArm, rightArm };
}

function drawPlayer(c: Ctx, x: number, y: number, s: number, t: number, level: number, consume = 0, alpha = 1, walkDist = 0, walkSpan = 180) {
    const pose = playerPose(t, level, consume, walkDist, walkSpan);
    const { bounce } = pose;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.globalAlpha *= alpha;
    c.rotate(pose.sway);
    ellipse(c, 0, 0, 47, 12, '#08071380');
    // 1. Two-bone legs and shoes anchored to solved ankle endpoints.
    for (const [isRight, leg] of [[false, pose.leftLeg], [true, pose.rightLeg]] as const) {
        line(c, [leg.root.x, leg.root.y, leg.joint.x, leg.joint.y, leg.end.x, leg.end.y], '#534664', 19);
        round(c, leg.end.x - (isRight ? 12 : 22), leg.end.y - 6, 34, 13, 6, '#e8e1c9');
    }
    // 2. Left arm and hand behind torso flank.
    line(c, [pose.leftArm.root.x, pose.leftArm.root.y, pose.leftArm.joint.x, pose.leftArm.joint.y, pose.leftArm.end.x, pose.leftArm.end.y], '#d7c296', 15);
    ellipse(c, pose.leftArm.end.x, pose.leftArm.end.y, 7.5, 8, '#e8c7a3');
    // 3. Torso shirt, vest panels and nametag.
    c.save();
    c.translate(0, bounce);
    c.beginPath();
    c.moveTo(-34, -148);
    c.quadraticCurveTo(0, -165, 34, -148);
    c.lineTo(29, -70);
    c.quadraticCurveTo(0, -57, -30, -70);
    c.closePath();
    c.fillStyle = '#d6ed76';
    c.fill();
    c.strokeStyle = '#8f9f52';
    c.lineWidth = 2;
    c.stroke();
    round(c, -30, -143, 15, 63, 5, '#556654');
    round(c, 15, -143, 15, 63, 5, '#556654');
    round(c, -10, -121, 20, 25, 3, '#f5eee1');
    c.fillStyle = '#6a595e';
    c.font = '5px monospace';
    c.textAlign = 'center';
    c.fillText('BRAIN', 0, -109);
    c.fillText('free trial', 0, -103);
    // 4. Neck, head, hair and facial features.
    line(c, [0, -158, 0, -178], '#d2ab8e', 17);
    ellipse(c, 0, -195, 32, 38, '#e6c3a0', '#8c6e63', 1.5);
    c.beginPath();
    c.moveTo(-33, -197);
    c.lineTo(-31, -224);
    c.lineTo(-17, -234);
    c.lineTo(-4, -229);
    c.lineTo(7, -236);
    c.lineTo(20, -229);
    c.lineTo(28, -232);
    c.lineTo(34, -207);
    c.lineTo(19, -213);
    c.lineTo(4, -217);
    c.lineTo(-18, -211);
    c.closePath();
    c.fillStyle = '#40344a';
    c.fill();
    const pupils = 1 + level * .42;
    eye(c, -12, -195, 8 * pupils, t * .3, 1, '#f1e7d3');
    eye(c, 12, -195, 8 * pupils, t * .3, 1, '#f1e7d3');
    line(c, [-21, -208, -8, -211], '#514048', 2);
    line(c, [8, -211, 21, -208], '#514048', 2);
    c.beginPath();
    c.moveTo(-9, -178);
    c.quadraticCurveTo(0, -173 + level * 11, 10, -179);
    c.strokeStyle = '#6e4f50';
    c.lineWidth = 2;
    c.stroke();
    for (let stubble = 0; stubble < 9; stubble++) {
        const xx = -15 + stubble * 3.5;
        line(c, [xx, -166 + Math.abs(xx) * .14, xx + 1, -163 + Math.abs(xx) * .14], '#8c6e63', 1);
    }
    if (level > .45) {
        ellipse(c, -13, -184, 8, 3, '#9e728550');
        ellipse(c, 13, -184, 8, 3, '#9e728550');
    }
    if (level > .7)
        eye(c, 0, -216, 7 * (level - .7) / .3, t, 1, '#dfff82');
    c.restore();
    // 5. Right arm, hand and pill drawn in front of head so consumption gesture is never occluded by the chin.
    const held = pose.rightArm.end;
    line(c, [pose.rightArm.root.x, pose.rightArm.root.y, pose.rightArm.joint.x, pose.rightArm.joint.y, held.x, held.y], '#d7c296', 15);
    ellipse(c, held.x, held.y, 8, 9, '#e8c7a3');
    if (consume > .05) {
        c.save();
        c.translate(held.x - 1, held.y - 8);
        c.rotate(-.5);
        round(c, -6, -3, 12, 6, 3, '#eeb5ff', '#f9dcff');
        c.restore();
    }
    c.restore();
}

export function drawArt(c: Ctx, state: Frame, w: number, h: number, time: number) {
    const visH = h - (w < 650 ? 150 : 100);
    const t = time, s = w < 600 ? w / 620 : Math.min(w / 960, h / 600), running = state.phase === 'running', crashed = state.phase === 'crashed', escaped = state.phase === 'escaped';
    const age = state.outcomeAge || 0, final = ease(age / 2.6), baseLevel = clamp(state.stage / 7), level = escaped ? baseLevel * (1 - ease(age / 1.8)) : crashed ? mix(baseLevel, 1, final) : baseLevel;
    const wavy = 1, cy = visH * .29, cx = w * .5, r = Math.min(w * .23, visH * .25), mouthY = cy + r * .36, ground = visH * .91;
    c.save();
    c.clearRect(0, 0, w, h);
    let bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, escaped && age > 1.5 ? '#1d2541' : '#151020');
    bg.addColorStop(.55, '#2d1c3f');
    bg.addColorStop(1, '#151020');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    let glow = c.createRadialGradient(cx, visH * .42, 4, cx, visH * .4, w * .65);
    glow.addColorStop(0, `rgba(116,72,154,${.2 + level * .23})`);
    glow.addColorStop(1, '#13101b00');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    // Fine stars and the overhead rig.
    for (let i = 0; i < 72; i++) {
        const x = hash(i + 2) * w, y = hash(i + 80) * visH * .62, sz = (i % 4 ? 1 : 1.8) * s;
        c.globalAlpha = .15 + hash(i + 100) * .38;
        c.fillStyle = i % 3 ? '#ddbbd3' : '#d1f87b';
        c.fillRect(x, y, sz, sz);
    }
    c.globalAlpha = 1;
    c.strokeStyle = '#6d587b';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, visH * .16);
    c.quadraticCurveTo(w * .5, visH * .24, w, visH * .16);
    c.stroke();
    for (let i = 0; i < 18; i++) {
        const x = w * i / 17, y = visH * .16 + Math.sin(i / 17 * Math.PI) * visH * .04;
        c.fillStyle = i % 3 === 0 ? '#cbe788' : i % 3 === 1 ? '#be8ba9' : '#9a89ba';
        ellipse(c, x, y, 2 * s, 4 * s, c.fillStyle);
    }
    // Slow ribbons rather than strobing lights.
    for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.moveTo(cx, visH * .35);
        const swing = Math.sin(t * .17 + k * 1.7) * w * .1 * wavy;
        c.lineTo(w * (k / 4) + swing, -10);
        c.lineTo(w * (k / 4) + swing + 15 * s, -10);
        c.closePath();
        c.fillStyle = k % 2 ? `rgba(194,158,224,${.025 + level * .025})` : `rgba(203,237,137,${.025 + level * .02})`;
        c.fill();
    }
    // Stage architecture.
    round(c, w * .12, visH * .25, w * .76, visH * .38, 12 * s, '#211a2a', '#594467');
    for (let i = 0; i < 4; i++) {
        const x = w * (.14 + i * .235);
        round(c, x, visH * .27, 6 * s, visH * .34, 2 * s, '#5b3e61');
    }
    const floor = c.createLinearGradient(0, visH * .6, 0, h);
    floor.addColorStop(0, '#3a2647');
    floor.addColorStop(1, '#17131e');
    c.fillStyle = floor;
    c.fillRect(0, visH * .61, w, h - visH * .61);
    c.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
        c.beginPath();
        c.moveTo(cx, visH * .61);
        c.quadraticCurveTo(w * i / 15 + Math.sin(t + i) * 12 * level * wavy, visH * .78, (i - 4) * w / 7, h);
        c.strokeStyle = '#79608425';
        c.stroke();
    }
    for (let i = 0; i < 7; i++) {
        const y = visH * .63 + (i * i / 36) * (h - visH * .63);
        c.beginPath();
        c.moveTo(0, y);
        c.bezierCurveTo(w * .3, y - 10 * level * Math.sin(t + i) * wavy, w * .7, y + 10 * level * Math.sin(t + i) * wavy, w, y);
        c.strokeStyle = '#8a718e25';
        c.stroke();
    }
    drawSet(c, state, w, h, t, 'back');
    // Sound-tentacles form the monster's body.
    if (level > .1) {
        for (let i = 0; i < 8; i++) {
            const side = i % 2 ? -1 : 1, rootX = cx + side * r * .75, rootY = cy + r * .65;
            const endX = cx + side * (r * 1.4 + Math.sin(t * .55 + i) * r * .25 * wavy), endY = visH * (.64 + (i % 4) * .06);
            c.beginPath();
            c.moveTo(rootX, rootY);
            c.bezierCurveTo(rootX + side * r * .8, rootY + r * .2, endX - side * r * .8, endY - r * .2, endX, endY);
            c.strokeStyle = i % 3 === 0 ? '#7b537d' : i % 3 === 1 ? '#7f8270' : '#a57c78';
            c.lineWidth = (5 + level * 14) * s;
            c.lineCap = 'round';
            c.globalAlpha = level * .7;
            c.stroke();
            c.globalAlpha = 1;
        }
    }
    // The giant face emerges behind the ordinary DJ, positioned above the DJ booth so the mouth never covers the DJ's head.
    if (level > .18 || crashed) {
        const a = clamp((level - .18) * 1.5);
        c.save();
        c.globalAlpha = a;
        const breathe = 1 + Math.sin(t * .9) * .025 * wavy;
        ellipse(c, cx, cy, r * breathe, r * .86, '#4d355c', '#9a6b98', 2 * s);
        for (let k = 0; k < 4; k++) {
            c.beginPath();
            c.ellipse(cx, cy, r * (1 + k * .12), r * (.86 + k * .1), Math.sin(t * .1) * .08, 0, TAU);
            c.strokeStyle = `rgba(180,132,190,${.17 - k * .03})`;
            c.lineWidth = 1;
            c.stroke();
        }
        eye(c, cx - r * .39, cy - r * .14, r * .28, t * .35, 1, '#d6e7a1');
        eye(c, cx + r * .39, cy - r * .14, r * .28, t * .35 + 1, 1, '#d6e7a1');
        if (level <= .35 && !crashed) {
            ellipse(c, cx, mouthY, r * .42, r * (.05 + level * .11), '#110e1b', '#b991ac', 2 * s);
        }
        if (level > .7) {
            eye(c, cx, cy - r * .55, r * .14, t * .5, 1, '#ffb298');
        }
        c.restore();
    }
    // Stage mouth and DJ crown layer behind the foreground DJ and booth.
    drawSet(c, state, w, h, t, 'stage');
    // Speakers have eyes in place of cones.
    for (const side of [-1, 1]) {
        if (escaped && side === 1 && age > .4) continue;
        const x = cx + side * w * .315, sw = 94 * s, sh = 148 * s, y = visH * .36;
        round(c, x - sw / 2, y, sw, sh, 10 * s, '#25202d', '#7d6485');
        round(c, x - sw / 2 + 7 * s, y + 8 * s, sw - 14 * s, sh - 16 * s, 7 * s, '#191620');
        for (let k = 0; k < 2; k++) {
            const yy = y + (38 + k * 66) * s, rr = (k ? 30 : 22) * s;
            ellipse(c, x, yy, rr, rr, '#463a50', '#8b768e', 1.5 * s);
            ellipse(c, x, yy, rr * .7, rr * .7, '#272231', '#615365', 1 * s);
            if (level > .22) {
                c.save();
                c.globalAlpha = clamp((level - .22) * 2);
                eye(c, x, yy, rr * .78, t * .4 + side, 1, '#dce7ad');
                c.restore();
            }
            else
                ellipse(c, x, yy, rr * .32, rr * .32, '#83718c');
        }
    }
    // The DJ booth and a small suspiciously calm DJ with two-bone IK arms.
    const djY = visH * .56;
    const dj = djPose(t, level);
    ellipse(c, cx, djY - 38 * s, 16 * s, 18 * s, '#bea6af');
    round(c, cx - 20 * s, djY - 24 * s, 40 * s, 30 * s, 8 * s, '#4d3b61');
    for (const a of [dj.leftArm, dj.rightArm]) {
        line(c, [cx + a.root.x * s, djY + a.root.y * s, cx + a.joint.x * s, djY + a.joint.y * s, cx + a.end.x * s, djY + a.end.y * s], '#baa0b0', 6.5 * s);
        ellipse(c, cx + a.end.x * s, djY + a.end.y * s, 4 * s, 4 * s, '#d8c2ce');
    }
    round(c, cx - 16 * s, djY - 42 * s, 32 * s, 8 * s, 3 * s, '#201b2a');
    round(c, cx - 115 * s, djY, 230 * s, 58 * s, 7 * s, '#32243e', '#80608d');
    round(c, cx - 104 * s, djY + 8 * s, 208 * s, 36 * s, 3 * s, '#17131f');
    for (let k = 0; k < 20; k++) {
        const bar = (8 + Math.sin(t * 2.2 + k * .9) * 6 + level * 7) * s;
        round(c, cx - 94 * s + k * 9.8 * s, djY + 34 * s - bar, 4 * s, bar, 1 * s, k % 3 ? '#aaa0bd' : '#d5ed88');
    }
    c.font = `${Math.max(8, 10 * s)}px monospace`;
    c.textAlign = 'center';
    c.fillStyle = '#bda7c7';
    c.fillText(level > .75 ? 'GOOD VIBES MANDATORY' : 'GOOD VIBES ONLY', cx, djY + 54 * s);
    // Back crowd row behind the protagonist.
    const collective = crashed && state.ending === 'collective' && age > .6;
    for (let i = 0; i < 9; i++) {
        const x = (i - .15) * w / 8, y = visH * .77, ss = s * .52;
        if (escaped && x > w * .6) continue;
        drawRaver(c, x, y, ss, t, i, level, collective || level > .85);
    }
    // Floating thought fragments and tiny selves.
    if (level > .25) {
        for (let i = 0; i < 10; i++) {
            const x = w * (.08 + .84 * hash(i + 33)) + Math.sin(t * .3 + i) * 15 * s * wavy, y = visH * (.2 + .5 * hash(i + 75)) + Math.sin(t * .6 + i) * 18 * s * wavy;
            c.save();
            c.globalAlpha = (level - .25) * .5;
            c.translate(x, y);
            c.rotate(Math.sin(t * .2 + i) * .3);
            if (i % 3 === 0) {
                eye(c, 0, 0, 11 * s, t + i, 1, '#d4d69b');
            }
            else {
                c.font = `${(14 + i % 3 * 4) * s}px monospace`;
                c.fillStyle = i % 2 ? '#e7afc8' : '#d5e49e';
                c.textAlign = 'center';
                c.fillText(i % 2 ? '?' : 'ME', 0, 0);
            }
            c.restore();
        }
    }
    // Outside exit doorway, park bench and sober friend sit above the HUD footer and behind the walking protagonist.
    drawSet(c, state, w, h, t, 'outside');
    let px = cx, py = ground, ps = s * (w < 600 ? 1.08 : 1.05), pa = 1, walkDist = 0;
    const walkSpan = 180;
    if (escaped) {
        const p = ease(age / 2.3);
        walkDist = p * walkSpan;
        px = mix(cx, w * .78, p);
        py = mix(ground, visH * .89, p);
        ps *= mix(1, .78, p);
        if (age > 1) {
            c.save();
            c.globalAlpha = ease((age - 1) / 1);
            round(c, w * .67, visH * .88, w * .25, 8 * s, 2 * s, '#8b827e');
            line(c, [w * .7, visH * .89, w * .7, visH * .95], '#8b827e', 4 * s);
            line(c, [w * .89, visH * .89, w * .89, visH * .95], '#8b827e', 4 * s);
            drawRaver(c, w * .65, visH * .88, s * .74, t * .3, 5, 0);
            c.restore();
        }
    }
    if (crashed) {
        const p = ease(age / 2.5);
        if (state.ending === 'monster') {
            px = mix(cx, cx, p);
            py = mix(ground, mouthY + r * .04, p);
            ps *= 1 - p * .96;
            pa = 1 - ease((age - 1.7) / .7);
        }
        else if (state.ending === 'music') {
            py = mix(ground, visH * .48, p);
            pa = 1 - p;
            ps *= 1 - p * .3;
        }
        else {
            pa = 1 - p;
        }
    }
    const cycle = (state.elapsed % 4.3), gesture = ease(1 - Math.abs(cycle - 1) / .65), consume = running ? gesture : gesture * (1 - ease(age / .35));
    if (level > .4 && !escaped && pa > .1) {
        for (let ghost = 2; ghost > 0; ghost--) {
            drawPlayer(c, px - Math.sin(t * .8 + ghost) * ghost * 12 * s * wavy, py + ghost * 3 * s, ps, t - ghost * .2, level, consume, .07 * level * pa, walkDist, walkSpan);
        }
    }
    drawPlayer(c, px, py, ps, t, level, consume, pa, walkDist, walkSpan);
    if (crashed && state.ending === 'monster' && ease(age / 2.5) > .52) {
        drawSet(c, state, w, h, t, 'maw');
    }
    // Foreground flank ravers frame the dancefloor in front of the protagonist and above the HUD footer.
    for (let i = 0; i < 9; i++) {
        const x = (i + .25) * w / 8, y = visH * .94, ss = s * .66;
        if (Math.abs(x - cx) < 110 * s) continue;
        if (escaped && x > cx) continue;
        drawRaver(c, x, y, ss, t, i + 9, level, collective || level > .85);
    }
    if (crashed && state.ending === 'music') {
        const p = ease(age / 2.5);
        for (let i = 0; i < 30; i++) {
            const u = i / 29, x = mix(cx + (hash(i + 55) - .5) * 100 * s, cx + (u - .5) * w * .72, p), yy = mix(ground - 100 * s, visH * .45 + Math.sin(u * TAU * 2 + t) * visH * .13, p);
            c.strokeStyle = i % 3 ? '#cce98f' : '#dfa0d0';
            c.lineWidth = (3 + hash(i) * 3) * s;
            c.globalAlpha = p * .8;
            c.beginPath();
            c.moveTo(x, yy - 8 * s);
            c.quadraticCurveTo(x + 15 * s, yy + 8 * s, x + 20 * s, yy - 8 * s);
            c.stroke();
        }
        c.globalAlpha = 1;
    }
    if (crashed && state.ending === 'collective') {
        c.save();
        c.globalAlpha = final * .8;
        for (let i = 0; i < 6; i++) {
            const rr = (.12 + i * .08) * w;
            c.beginPath();
            c.ellipse(cx, visH * .52, rr, rr * .42, 0, 0, TAU);
            c.strokeStyle = i % 2 ? '#c1dd8a' : '#b597cc';
            c.lineWidth = 1.4 * s;
            c.stroke();
        }
        c.restore();
    }
    drawSet(c, state, w, h, t, 'front');
    // Foreground vignette protects subtitles and gives the room depth.
    let vignette = c.createLinearGradient(0, visH * .82, 0, h);
    vignette.addColorStop(0, '#100e1900');
    vignette.addColorStop(1, '#100e19ee');
    c.fillStyle = vignette;
    c.fillRect(0, visH * .82, w, h - visH * .82);
    if (escaped && age > 2.1) {
        c.font = `${Math.max(9, 12 * s)}px monospace`;
        c.textAlign = 'center';
        c.fillStyle = '#cee49f';
        c.fillText('EXIT  ↗', w * .84, visH * .34);
    }
    c.restore();
}
