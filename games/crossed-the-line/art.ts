import { drawSet } from './setpieces';
import { solveLimb, walkingFoot, type Point } from './ink';
import type { Frame } from './presentation';
type Ctx = CanvasRenderingContext2D;
type Paint = string | CanvasGradient | CanvasPattern;
const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (v: number) => { v = clamp(v); return v * v * (3 - 2 * v); };
function hash(n: number) { return ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1; }
function oval(c: Ctx, x: number, y: number, rx: number, ry: number, fill: Paint | null, stroke?: Paint | null, width = 1) { c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, TAU); if (fill) {
    c.fillStyle = fill;
    c.fill();
} if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
} }
function rect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: Paint | null, stroke?: Paint | null, width = 1) { c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) {
    c.fillStyle = fill;
    c.fill();
} if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
} }
function line(c: Ctx, pts: number[], color: string, width = 2) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2)
    c.lineTo(pts[i], pts[i + 1]); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
function poly(c: Ctx, pts: number[], fill: Paint | null, stroke?: Paint | null, width = 1) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2)
    c.lineTo(pts[i], pts[i + 1]); c.closePath(); if (fill) {
    c.fillStyle = fill;
    c.fill();
} if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
} }
function text(c: Ctx, copy: string, x: number, y: number, size = 10, color = '#6e563a', align: CanvasTextAlign = 'center', font = 'Georgia') { c.font = size + 'px ' + font; c.textAlign = align; c.fillStyle = color; c.fillText(copy, x, y); }
function windowShape(c: Ctx, x: number, y: number, w: number, h: number) { c.beginPath(); c.moveTo(x - w / 2, y + h); c.lineTo(x - w / 2, y + w / 2); c.quadraticCurveTo(x - w / 2, y + 8, x, y - 20); c.quadraticCurveTo(x + w / 2, y + 8, x + w / 2, y + w / 2); c.lineTo(x + w / 2, y + h); c.closePath(); }
function stainedWindow(c: Ctx, x: number, y: number, w: number, h: number, flip: number) { c.save(); windowShape(c, x, y, w + 18, h + 10); c.fillStyle = '#c0ab82'; c.fill(); windowShape(c, x, y, w, h); c.fillStyle = '#ebc97e'; c.fill(); c.save(); windowShape(c, x, y, w, h); c.clip(); const colors = ['#8b9b86', '#ad6d58', '#e4b666', '#8aa2a2']; for (let r = 0; r < 5; r++) {
    for (let k = 0; k < 2; k++) {
        const xx = x - w / 2 + k * w / 2, yy = y + r * 47;
        poly(c, [xx, yy, xx + w / 2, yy + 23, xx, yy + 47], colors[(r + k + flip) % 4], '#806b50', 2);
        poly(c, [xx + w / 2, yy, xx + w / 2, yy + 47, xx, yy + 23], colors[(r + k + 1) % 4], '#806b50', 2);
    }
} oval(c, x, y + 67, 18, 18, '#f3d58e', '#876d46', 3); line(c, [x, y + 97, x, y + 146], '#f2d7a2', 17); line(c, [x - 21, y + 113, x + 21, y + 113], '#f2d7a2', 10); c.restore(); windowShape(c, x, y, w, h); c.strokeStyle = '#917a55'; c.lineWidth = 5; c.stroke(); line(c, [x, y + 4, x, y + h], '#866d4a', 4); line(c, [x - w / 2, y + h * .58, x + w / 2, y + h * .58], '#866d4a', 4); rect(c, x - w / 2 - 14, y + h + 3, w + 28, 13, 1, '#b89e73', '#957a51'); c.restore(); }
function candle(c: Ctx, x: number, y: number, t: number) { rect(c, x - 5, y - 21, 10, 27, 1, '#eadeb7', '#b49a66'); line(c, [x, y + 6, x, y + 14], '#a58548', 4); rect(c, x - 12, y + 12, 24, 4, 1, '#b49a5e'); const flutter = Math.sin(t * 7 + x) * 2; oval(c, x, y - 28, 4, 8 + flutter, '#f6d586'); oval(c, x, y - 26, 2, 4, '#fff4c9'); }
function drawCrucifix(c: Ctx, x: number, y: number, rotation = 0) { c.save(); c.translate(x, y); c.rotate(rotation); c.shadowColor = '#4a321f40'; c.shadowBlur = 8; c.shadowOffsetY = 4; rect(c, -15, -55, 30, 184, 2, '#775038', '#503825', 2); rect(c, -77, -14, 154, 28, 2, '#775038', '#503825', 2); c.shadowColor = 'transparent'; rect(c, -10, -51, 8, 174, 1, '#a17b4e'); line(c, [-72, -8, 71, -8], '#ad8552', 3); line(c, [9, -48, 9, 124], '#543923', 2); rect(c, -17, -47, 34, 14, 1, '#e0c58b', '#715431'); text(c, 'INRI', 0, -37, 8, '#674b31'); oval(c, 0, -16, 15, 15, '#caac68'); line(c, [-58, 0, -20, 9, 0, 15, 20, 9, 58, 0], '#d2b67c', 9); oval(c, 0, -12, 10, 12, '#e4c898', '#8e7047', 1.5); c.beginPath(); c.arc(0, -16, 10, Math.PI, TAU); c.strokeStyle = '#8c6c42'; c.lineWidth = 4; c.stroke(); poly(c, [-10, 6, 10, 6, 12, 48, 7, 72, -7, 72, -12, 48], '#dbbd83', '#9d7b4b'); poly(c, [-12, 45, 13, 46, 15, 60, -14, 64], '#f0e1bc', '#b49c70'); line(c, [-5, 65, -2, 98, 1, 112], '#d6b67f', 7); line(c, [5, 65, 8, 92, 1, 112], '#d6b67f', 7); line(c, [-3, -11, 3, -9], '#8c6c42', 1); c.restore(); }

function drawSleeveArm(c: Ctx, limb: { root: Point; joint: Point; end: Point }, sleeve = '#e9d9ad', outline = '#79553c') {
    line(c, [limb.root.x, limb.root.y, limb.joint.x, limb.joint.y, limb.end.x, limb.end.y], outline, 21);
    line(c, [limb.root.x, limb.root.y, limb.joint.x, limb.joint.y, limb.end.x, limb.end.y], sleeve, 17);
}

export function priestPose(t: number, state: Frame) {
    const running = state.phase === 'running', escape = state.phase === 'escaped', crash = state.phase === 'crashed';
    const stage = state.stage, age = state.outcomeAge;
    const walkSpan = 146;
    const walk = escape ? smooth(age / 1.4) * walkSpan : 0;
    const walkBlend = walk > 0 && walk < walkSpan ? smooth(walk / 18) * smooth((walkSpan - walk) / 18) : 0;
    const bounce = running ? Math.sin(t * 3) * 2 : walkBlend * Math.abs(Math.sin(walk / 48 * TAU)) * 2.5;
    const leftStep = walkingFoot(walk, walkSpan, 48, 0, 9);
    const rightStep = walkingFoot(walk, walkSpan, 48, .5, 9);
    const leftHip = { x: -15, y: -38 };
    const rightHip = { x: 15, y: -38 };
    const leftLeg = solveLimb(leftHip, { x: -16 + leftStep.x, y: 4 + leftStep.y }, 22, 22, 1);
    const rightLeg = solveLimb(rightHip, { x: 16 + rightStep.x, y: 4 + rightStep.y }, 22, 22, 1);
    const leftRoot = { x: -28, y: -119 };
    const rightRoot = { x: 28, y: -119 };
    const actT = escape || crash ? state.elapsed : t;
    let leftTarget = { x: -56 - Math.sin(actT * 2.1) * (running ? 6 + stage : 2), y: -96 - (running ? stage * 2.8 : 0) + Math.cos(actT * 2.1) * 4 };
    let rightTarget = { x: 56 + Math.cos(actT * 2.3) * (running ? 8 : 3), y: -96 - (running ? 16 + stage * 4.2 : 0) + Math.sin(actT * 2.3) * (running ? 9 : 3) };
    if (escape) {
        const settle = smooth(age / .45);
        leftTarget = { x: lerp(leftTarget.x, -52, settle), y: lerp(leftTarget.y, -90 + bounce * .4, settle) };
        rightTarget = { x: lerp(rightTarget.x, 52, settle), y: lerp(rightTarget.y, -134 + Math.sin(t * 5) * 5, settle) };
    } else if (crash) {
        const brace = smooth(age / .32);
        leftTarget = { x: lerp(leftTarget.x, -38, brace), y: lerp(leftTarget.y, -162, brace) };
        rightTarget = { x: lerp(rightTarget.x, 38, brace), y: lerp(rightTarget.y, -162, brace) };
    }
    const leftArm = solveLimb(leftRoot, leftTarget, 29, 29, -1);
    const rightArm = solveLimb(rightRoot, rightTarget, 29, 29, 1);
    return { walk, walkSpan, bounce, leftHip, rightHip, leftLeg, rightLeg, leftRoot, rightRoot, leftArm, rightArm };
}

function drawPriest(c: Ctx, x: number, base: number, t: number, state: Frame) {
    const running = state.phase === 'running', escape = state.phase === 'escaped', crash = state.phase === 'crashed';
    const stage = state.stage;
    const pose = priestPose(t, state);
    c.save();
    c.translate(x + pose.walk, base + pose.bounce);
    if (escape) c.scale(.98, .98);
    oval(c, 0, 7, 43, 9, '#3b291c22');
    // 1. Two-bone legs and shoes behind the cassock hem.
    for (const leg of [pose.leftLeg, pose.rightLeg]) {
        line(c, [leg.root.x, leg.root.y, leg.joint.x, leg.joint.y, leg.end.x, leg.end.y], '#40342c', 13);
        oval(c, leg.end.x + (leg === pose.leftLeg ? -4 : 4), leg.end.y + 2, 14, 6.5, '#3d332e');
    }
    // 2. Cassock, liturgical stole, clerical collar and gold '$' chain.
    poly(c, [-32, -131, 31, -131, 47, -20, -48, -20], '#f3e5bb', '#76593d', 2);
    poly(c, [-27, -129, -11, -132, -13, -20, -34, -20], '#8b3b35');
    poly(c, [12, -132, 28, -128, 35, -20, 14, -20], '#8b3b35');
    line(c, [-23, -102, -23, -86], '#dbbd70', 3);
    line(c, [-29, -96, -17, -96], '#dbbd70', 3);
    line(c, [23, -102, 23, -86], '#dbbd70', 3);
    line(c, [17, -96, 29, -96], '#dbbd70', 3);
    rect(c, -13, -136, 26, 14, 2, '#312f2c');
    rect(c, -7, -134, 14, 7, 1, '#fff3d1');
    line(c, [-20, -128, 0, -113, 21, -127], '#d3b269', 4);
    text(c, '$', 0, -99, 13, '#ad813b');
    // 3. Head, hairpiece and facial expression.
    oval(c, 0, -159, 29, 33, '#c28e67', '#76553c', 2);
    oval(c, -28, -157, 5, 8, '#c28e67', '#76553c');
    oval(c, 28, -157, 5, 8, '#c28e67', '#76553c');
    c.beginPath();
    c.arc(0, -167, 27, Math.PI, TAU);
    c.lineTo(26, -171);
    c.quadraticCurveTo(13, -177, 4, -180);
    c.quadraticCurveTo(-9, -180, -28, -164);
    c.fillStyle = '#695849';
    c.fill();
    const pupilY = crash ? -165 : -162;
    oval(c, -9, pupilY, 2.4, crash ? 3.2 : 2.7, '#372e29');
    oval(c, 10, pupilY, 2.4, crash ? 3.2 : 2.7, '#372e29');
    line(c, [-15, -169 - (crash ? 3 : 0), -5, -171 + (crash ? -2 : Math.min(stage, 5))], '#5e4030', 2.6);
    line(c, [5, -170 + (crash ? -2 : Math.min(stage, 3)), 15, -169 - (crash ? 3 : 2)], '#5e4030', 2.6);
    line(c, [0, -158, -3, -149, 3, -148], '#a76d48', 2);
    const talking = running ? Math.sin(t * 11) : 0;
    if (crash) {
        oval(c, 1, -139, 6, 7, '#673b30');
    } else if (running && talking > .1) {
        oval(c, 1, -139, 9, 4 + talking * 2, '#673b30');
        line(c, [-5, -141, 7, -141], '#f8e8cd', 2);
    } else {
        c.beginPath();
        c.moveTo(-8, -140);
        c.quadraticCurveTo(1, -133, 11, -143);
        c.strokeStyle = '#673b30';
        c.lineWidth = 2;
        c.stroke();
    }
    // 4. Two-bone arms, hands, and escape briefcase in front of torso.
    drawSleeveArm(c, pose.leftArm, '#ecdcb3');
    if (escape) {
        const hand = pose.leftArm.end;
        rect(c, hand.x - 19, hand.y + 2, 38, 25, 3, '#784637', '#3b332a', 2);
        rect(c, hand.x - 8, hand.y - 4, 16, 6, 2, null, '#3b332a', 2);
        text(c, 'OFFSHORE', hand.x, hand.y + 17, 6.5, '#f2dfb3');
        text(c, 'AMEN', 0, -212, 16, '#4a6757');
    }
    oval(c, pose.leftArm.end.x, pose.leftArm.end.y, 7.5, 7, '#c28e67', '#79553c');
    drawSleeveArm(c, pose.rightArm, '#e9d9ad');
    if (running && stage > 3) {
        line(c, [pose.rightArm.end.x + 2, pose.rightArm.end.y - 3, pose.rightArm.end.x + 3, pose.rightArm.end.y - 16], '#c28e67', 5);
    }
    oval(c, pose.rightArm.end.x, pose.rightArm.end.y, 7.5, 7, '#c28e67', '#79553c');
    c.restore();
}

function drawPulpit(c: Ctx, x: number, broken: boolean) {
    if (broken) {
        poly(c, [x - 69, 405, x + 57, 401, x + 76, 436, x - 80, 441], '#956440', '#60432e', 2);
        poly(c, [x - 61, 397, x - 3, 415, x - 25, 435, x - 80, 415], '#ac7d4f', '#60432e', 2);
        line(c, [x + 17, 403, x + 38, 433, x + 46, 402], '#63452e', 2);
        return;
    }
    poly(c, [x - 57, 344, x + 57, 344, x + 45, 431, x - 45, 431], '#986744', '#5e442e', 2);
    rect(c, x - 67, 336, 134, 16, 2, '#b68a55', '#62452f', 2);
    rect(c, x - 51, 423, 102, 13, 2, '#a47649', '#62452f', 2);
    rect(c, x - 31, 362, 62, 49, 16, '#7c5238', '#bb915b', 2);
    line(c, [x, 371, x, 403], '#d6b56e', 5);
    line(c, [x - 10, 382, x + 10, 382], '#d6b56e', 5);
    poly(c, [x - 36, 333, x - 4, 326, x + 31, 331, x + 35, 340, x - 2, 336, x - 36, 340], '#f5e8c4', '#846e46');
    line(c, [x - 2, 328, x - 2, 337], '#c4b08c', 1);
    line(c, [x + 46, 337, x + 43, 303, x + 30, 291], '#4b483b', 2.5);
    oval(c, x + 28, 289, 6, 4, '#383a31');
}

export function congregationPose(i: number, t: number, state: Frame) {
    const sway = Math.sin(t * 1.1 + i) * 1.5;
    const shocked = state.stage > 3 || state.phase === 'crashed';
    const leftRoot = { x: -18, y: 8 };
    const rightRoot = { x: 18, y: 8 };
    const leftTarget = state.stage >= 5 && i === 0
        ? { x: -7, y: -22 }
        : state.phase === 'crashed' && i % 2 === 1
            ? { x: -24, y: -12 + Math.sin(t * 4 + i) * 2 }
            : { x: -22, y: 22 };
    const rightTarget = state.stage >= 2 && i === 4
        ? { x: 28, y: -24 + Math.sin(t * 2) * 1.5 }
        : state.phase === 'crashed' && i % 2 === 0
            ? { x: 24, y: -12 + Math.cos(t * 4 + i) * 2 }
            : { x: 22, y: 22 };
    const leftArm = solveLimb(leftRoot, leftTarget, 19, 19, -1);
    const rightArm = solveLimb(rightRoot, rightTarget, 19, 19, 1);
    return { sway, shocked, leftRoot, rightRoot, leftArm, rightArm };
}

function drawCongregation(c: Ctx, W: number, t: number, state: Frame) {
    const faces = [-.42, -.30, -.18, .18, .30, .42];
    const skins = ['#b77e59', '#d6ac7b', '#865e48', '#c1936a', '#bd8b63', '#e0ba92'];
    const coats = ['#626c5a', '#8b5947', '#796653', '#586973', '#8e8061', '#8b5c4d'];
    faces.forEach((pos, i) => {
        const x = W * .5 + pos * Math.max(W, 610), base = 426 + (i % 2) * 8;
        const pose = congregationPose(i, t, state);
        c.save();
        c.translate(x, base + pose.sway);
        oval(c, 0, 14, 29, 32, coats[i]!);
        oval(c, 0, -22, 19, 23, skins[i]!, '#6d5340', 1.5);
        if (i === 1) {
            poly(c, [-22, -17, -18, -42, 0, -50, 19, -40, 24, -14, 16, -10, 12, -37, -10, -39, -16, -13], '#4e4b40');
        } else {
            c.beginPath();
            c.arc(0, -27, 18, Math.PI, TAU);
            c.strokeStyle = i % 2 ? '#e4d6b9' : '#5a4737';
            c.lineWidth = 8;
            c.stroke();
        }
        oval(c, -6, -23, 1.4, 2, '#3e3228');
        oval(c, 6, -23, 1.4, 2, '#3e3228');
        if (pose.shocked) oval(c, 0, -12, 3, 4, '#664735');
        else line(c, [-3, -11, 3, -11], '#77523d', 1.2);
        if (state.stage >= 2 && i === 4) {
            const a = pose.rightArm;
            line(c, [a.root.x, a.root.y, a.joint.x, a.joint.y, a.end.x, a.end.y], coats[i]!, 8);
            rect(c, a.end.x - 5, a.end.y - 17, 13, 23, 2, '#3e4646', '#d0b98b');
            rect(c, a.end.x - 2, a.end.y - 13, 7, 13, 1, '#8caab2');
            oval(c, a.end.x, a.end.y, 4.5, 4.5, skins[i]!);
        } else if (state.phase === 'crashed' && i % 2 === 0) {
            const a = pose.rightArm;
            line(c, [a.root.x, a.root.y, a.joint.x, a.joint.y, a.end.x, a.end.y], coats[i]!, 8);
            oval(c, a.end.x, a.end.y, 4.5, 4.5, skins[i]!);
        }
        if (state.stage >= 5 && i === 0) {
            const a = pose.leftArm;
            line(c, [a.root.x, a.root.y, a.joint.x, a.joint.y, a.end.x, a.end.y], coats[i]!, 8);
            oval(c, a.end.x, a.end.y, 6, 8, skins[i]!);
        } else if (state.phase === 'crashed' && i % 2 === 1) {
            const a = pose.leftArm;
            line(c, [a.root.x, a.root.y, a.joint.x, a.joint.y, a.end.x, a.end.y], coats[i]!, 8);
            oval(c, a.end.x, a.end.y, 4.5, 4.5, skins[i]!);
        }
        c.restore();
    });
    rect(c, 0, 444, W, 16, 1, '#805436', '#583d2a', 2);
    rect(c, 0, 460, W, 50, 1, '#68482f');
    for (let x = 27; x < W; x += 87)
        rect(c, x, 464, 53, 36, 1, '#735035', '#5d402c');
}

export function heavenPose(state: Frame) {
    const crash = state.phase === 'crashed', age = state.outcomeAge;
    const p = crash ? smooth(age / .4) : 0;
    const root = { x: 40, y: 28 };
    const target = { x: 21, y: 66 + p * 9 };
    const arm = solveLimb(root, target, 28, 28, -1);
    return { p, root, arm };
}

function drawHeaven(c: Ctx, x: number, t: number, state: Frame) {
    const crash = state.phase === 'crashed', age = state.outcomeAge;
    const vis = crash ? clamp(age * 3) : state.stage >= 4 ? .3 : 0;
    if (vis <= 0) return;
    const pose = heavenPose(state);
    c.save();
    c.globalAlpha = vis;
    const glow = c.createRadialGradient(x, 28, 8, x, 70, 140);
    glow.addColorStop(0, '#fff9d2dd');
    glow.addColorStop(1, '#fff9d200');
    c.fillStyle = glow;
    c.fillRect(x - 150, 0, 300, 195);
    for (let i = 0; i < 5; i++)
        oval(c, x + (i - 2) * 24, 25 + Math.sin(i + t * .4) * 5, 29, 18, '#fff4d2', '#d4be8c');
    line(c, [x - 18, 24, x - 8, 28], '#8d7352', 2);
    line(c, [x + 8, 28, x + 18, 24], '#8d7352', 2);
    oval(c, x - 11, 32, 1.6, 2, '#7c6245');
    oval(c, x + 11, 32, 1.6, 2, '#7c6245');
    line(c, [x - 5, 41, x + 5, 41], '#a18356', 1.5);
    if (crash && age < 1.8) {
        const a = pose.arm;
        line(c, [x + a.root.x, a.root.y, x + a.joint.x, a.joint.y, x + a.end.x, a.end.y], '#f4deb0', 13);
        oval(c, x + a.end.x, a.end.y, 8, 9, '#f4deb0', '#c5a774');
        line(c, [x + a.end.x, a.end.y, x + a.end.x - 14, a.end.y + 6], '#f4deb0', 5);
    }
    c.restore();
}

export function impactPose(state: Frame) {
    if (state.phase !== 'crashed') return { fall: 0, impact: false };
    const fall = clamp((state.outcomeAge - .3) / .78);
    return { fall, impact: fall >= 1 };
}

export function drawArt(c: Ctx, state: Frame, w: number, h: number, time: number) {
    c.save();
    c.clearRect(0, 0, w, h);
    const scale = h / 600, W = w / scale, H = 600;
    c.scale(scale, scale);
    const center = W * .5, pose = impactPose(state), age = state.outcomeAge;
    const shake = state.phase === 'crashed' && age > 1.05 && age < 1.45 ? Math.sin(age * 74) * (1.45 - age) * 9 : 0;
    c.translate(shake, 0);
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#eadebe');
    bg.addColorStop(.7, '#d9c39a');
    bg.addColorStop(1, '#aa8251');
    c.fillStyle = bg;
    c.fillRect(-10, 0, W + 20, H);
    for (let y = 10; y < 380; y += 38) {
        line(c, [0, y, W, y], '#c0a57930', 1);
        for (let x = (Math.floor(y / 38) % 2) * 64; x < W; x += 128)
            line(c, [x, y, x, y + 38], '#c0a57930', 1);
    }
    // Architecture frames the priest; the crucifix stays still until the actual crash.
    c.beginPath();
    c.moveTo(center - 182, 384);
    c.lineTo(center - 182, 131);
    c.quadraticCurveTo(center - 182, 45, center, -31);
    c.quadraticCurveTo(center + 182, 45, center + 182, 131);
    c.lineTo(center + 182, 384);
    c.strokeStyle = '#c6ae81';
    c.lineWidth = 18;
    c.stroke();
    c.strokeStyle = '#a98c5d';
    c.lineWidth = 2;
    c.stroke();
    stainedWindow(c, center - Math.min(W * .35, 320), 103, Math.min(83, W * .15), 220, 0);
    stainedWindow(c, center + Math.min(W * .35, 320), 103, Math.min(83, W * .15), 220, 2);
    for (const side of [-1, 1]) {
        const px = center + side * Math.min(W * .43, 400);
        rect(c, px - 17, 42, 34, 346, 2, '#d4bf94', '#b49a6b');
        rect(c, px - 23, 45, 46, 17, 2, '#dbc69a', '#aa8f60');
        rect(c, px - 23, 374, 46, 17, 2, '#c8ad7d', '#a88a58');
        line(c, [px - 8, 72, px - 8, 362], '#e5d2a9', 5);
    }
    poly(c, [center - 130, 150, center + 130, 150, center + 260, 444, center - 260, 444], '#f9e3ad18');
    rect(c, 0, 384, W, 8, 1, '#a7895d');
    rect(c, 0, 392, W, 64, 0, '#baa077');
    for (let i = -5; i <= 5; i++)
        line(c, [center + i * 37, 392, center + i * 105, 560], '#9a7c5440', 1);
    for (const y of [414, 438])
        line(c, [0, y, W, y], '#99754c50', 1);
    rect(c, center - 126, 356, 252, 21, 2, '#cbb38c', '#ab8a5d');
    rect(c, center - 126, 356, 252, 8, 1, '#ede0bd');
    candle(c, center - 108, 351, time);
    candle(c, center + 108, 351, time + 2);
    // Two fixed wall mounts are decoration, never a countdown.
    rect(c, center - 21, 74, 42, 7, 2, '#8e8166');
    oval(c, center - 17, 77, 2, 2, '#c4b58f');
    oval(c, center + 17, 77, 2, 2, '#c4b58f');
    drawSet(c, state, W, time, 'back');
    if (!pose.impact)
        drawPriest(c, center, 424, time, state);
    drawPulpit(c, center, pose.impact);
    if (state.phase === 'crashed') {
        const f = pose.fall * pose.fall;
        drawCrucifix(c, center - 35 * f, lerp(86, 412, f), -1.31 * f);
        if (pose.impact) {
            const dust = smooth((age - 1.08) / .15) * (1 - clamp((age - 1.5) / 1.6));
            for (let i = 0; i < 13; i++) {
                const xx = center + (hash(i + 7) - .5) * 185, yy = 411 - (age - 1.05) * 21 + hash(i + 21) * 32;
                oval(c, xx, yy, 20 + hash(i) * 24, 13 + hash(i + 5) * 21, 'rgba(227,209,171,' + dust * .72 + ')');
            }
            const wiggle = Math.sin(age * 6) * 4;
            line(c, [center + 67, 426, center + 94, 420 + wiggle], '#f1dfb2', 17);
            line(c, [center + 94, 420 + wiggle, center + 111, 415 + wiggle], '#3e332c', 12);
            oval(c, center + 113, 411 + wiggle, 9, 14, '#3c332e');
            for (let i = 0; i < 3; i++) {
                const xx = center - 20 + Math.cos(time * 1.2 + i * TAU / 3) * 31, yy = 378 + Math.sin(time * 1.2 + i * TAU / 3) * 7;
                text(c, '✦', xx, yy, 16, '#a27638');
            }
        }
    }
    else {
        drawCrucifix(c, center, 86, 0);
    }
    drawHeaven(c, center, time, state);
    drawCongregation(c, W, time, state);
    drawSet(c, state, W, time, 'front');
    if (state.phase === 'crashed' && pose.impact && age > 2.1) {
        rect(c, center - 74, 342, 147, 29, 8, '#fbf0d2', '#a58b5c');
        text(c, 'I stand corrected.', center, 361, 13, '#665034');
    }
    // Fine stipple gives the scene a printed cartoon texture without external assets.
    c.globalAlpha = .055;
    c.fillStyle = '#4a3820';
    for (let i = 0; i < 500; i++) {
        c.fillRect(hash(i + 101) * W, hash(i + 901) * H, 1, 1);
    }
    c.globalAlpha = 1;
    c.restore();
}
