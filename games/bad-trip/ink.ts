export type Ctx = CanvasRenderingContext2D;
export type Point = {
    x: number;
    y: number;
};
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const ease = (v: number) => { const n = clamp(v); return n * n * (3 - 2 * n); };
export const hash = (i: number) => ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
export function box(c: Ctx, x: number, y: number, w: number, h: number, fill: string, stroke?: string, r = 4) {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = 1.5;
        c.stroke();
    }
}
export function label(c: Ctx, value: string, x: number, y: number, size: number, color: string, max = 900, align: CanvasTextAlign = 'center', family = 'monospace') {
    c.font = '700 ' + size + 'px ' + family;
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillText(value, x, y, max);
}
export function oval(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string) {
    c.beginPath();
    c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = 2;
        c.stroke();
    }
}
export function line(c: Ctx, points: number[], color: string, width = 2) {
    c.beginPath();
    c.moveTo(points[0]!, points[1]!);
    for (let i = 2; i < points.length; i += 2)
        c.lineTo(points[i]!, points[i + 1]!);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
}
/** Fixed-length two-bone chain, including coincident and unreachable targets. */
export function solveLimb(root: Point, target: Point, upper: number, lower: number, pole = 1) {
    let dx = target.x - root.x, dy = target.y - root.y;
    const distance = Math.hypot(dx, dy);
    if (distance < .000001) {
        dx = 0;
        dy = 1;
    }
    const length = distance < .000001 ? 1 : distance;
    const reach = clamp(distance, Math.abs(upper - lower) + .001, upper + lower - .001);
    const ux = dx / length, uy = dy / length;
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * pole;
    return { root, joint: { x: root.x + ux * along - uy * bend, y: root.y + uy * along + ux * bend }, end: { x: root.x + ux * reach, y: root.y + uy * reach } };
}
export function arm(c: Ctx, root: Point, target: Point, upper: number, lower: number, color: string, width: number, pole = 1) {
    const solved = solveLimb(root, target, upper, lower, pole);
    line(c, [root.x, root.y, solved.joint.x, solved.joint.y, solved.end.x, solved.end.y], color, width);
    return solved.end;
}
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const heading = (from: Point, to: Point): number => Math.atan2(to.y - from.y, to.x - from.x);
export const turnTo = (a: number, b: number, t: number): number => a + ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * clamp(t);
/** Angular blend between two solved two-bone poses; preserves exact bone lengths and avoids mid-swing pole flips. */
export function swingLimb(root: Point, a: { joint: Point; end: Point }, b: { joint: Point; end: Point }, t: number, upper: number, lower: number) {
    const u = clamp(t);
    if (u <= 0) return { root, ...a };
    if (u >= 1) return { root, ...b };
    const up = turnTo(heading(root, a.joint), heading(root, b.joint), u);
    const joint = { x: root.x + Math.cos(up) * upper, y: root.y + Math.sin(up) * upper };
    const fore = turnTo(heading(a.joint, a.end), heading(b.joint, b.end), u);
    return { root, joint, end: { x: joint.x + Math.cos(fore) * lower, y: joint.y + Math.sin(fore) * lower } };
}
/** Distance-driven foot: stance cancels root travel exactly; swing returns with zero endpoint velocity. */
export function stepFoot(distance: number, stride: number, offset: number, lift: number, dir = 1): Point {
    const phase = ((distance / stride + offset) % 1 + 1) % 1;
    const half = stride * .58 / 2;
    if (phase < .58) return { x: (half - phase * stride) * dir, y: 0 };
    const u = (phase - .58) / .42;
    return { x: (-half - u * stride * .42 + stride * u * u * (3 - 2 * u)) * dir, y: -lift * Math.sin(Math.PI * u) ** 2 };
}
/** Ramps a distance-driven gait smoothly out of and back into a planted standing pose. */
export function walkingFoot(distance: number, span: number, stride: number, offset: number, lift: number, dir = 1): Point {
    if (distance <= 0 || distance >= span) return { x: 0, y: 0 };
    const ramp = ease(distance / 18) * ease((span - distance) / 18);
    const step = stepFoot(distance, stride, offset, lift, dir);
    return { x: step.x * ramp, y: step.y * ramp };
}
export function wrap(c: Ctx, copy: string, width: number): string[] {
    const rows: string[] = [];
    let row = '';
    for (const word of copy.split(' ')) {
        const trial = row ? row + ' ' + word : word;
        if (row && c.measureText(trial).width > width) {
            rows.push(row);
            row = word;
        }
        else
            row = trial;
    }
    if (row)
        rows.push(row);
    return rows;
}
