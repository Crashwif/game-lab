import type { Frame } from './presentation';
import { box, oval, label, line, ease, hash, type Ctx } from './ink';
/** Fixed, bounded stage props; none of these props is a crash warning. */
export function drawSet(c: Ctx, state: Frame, w: number, h: number, t: number, layer: 'back' | 'stage' | 'outside' | 'maw' | 'front') {
    const visH = h - (w < 650 ? 150 : 100);
    const level = state.stage / 7, s = Math.min(w / 960, h / 540), cx = w / 2;
    const crash = state.phase === 'crashed', age = state.outcomeAge;
    const r = Math.min(w * .23, visH * .25), mouthY = visH * .29 + r * .36;
    if (layer === 'back') {
        // A nightclub stained-glass window: the sacred geometry is a giant tracking pixel.
        c.save();
        c.globalAlpha = .25 + level * .3;
        c.translate(cx, visH * .25);
        for (let ring = 0; ring < 3; ring++) {
            c.save();
            c.rotate(t * .07 * (ring % 2 ? 1 : -1));
            c.beginPath();
            c.ellipse(0, 0, 80 + ring * 29, 25 + ring * 17, ring, 0, Math.PI * 2);
            c.strokeStyle = ring % 2 ? '#ff86cf' : '#d9ff6b';
            c.lineWidth = 1.5;
            c.stroke();
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3;
                const x = Math.cos(a) * (80 + ring * 29), y = Math.sin(a) * (25 + ring * 17);
                oval(c, x, y, 8, 4, '#edf3a2');
                oval(c, x, y, 2, 3, '#321a42');
            }
            c.restore();
        }
        c.restore();
        // These cosmetic adverts change with elapsed time, even in a very long round.
        const ad = Math.floor(state.elapsed / 8) % 4;
        if (w > 650) {
            box(c, 24, visH * .25, 160, 64, '#21152d', '#ac6f9c');
            label(c, ['EGO DEATH', 'AYAHUASCA+', 'SPIRITUAL CEO', 'K-HOLE VIP'][ad]!, 104, visH * .25 + 20, 16, '#ffc1de', 146);
            label(c, ['SERVICE FEES APPLY', 'CANCEL NEVER', 'NO REFUNDS', 'CONCIERGE INCLUDED'][ad]!, 104, visH * .25 + 43, 9, '#d9ff6b', 146);
            if (state.phase !== 'escaped') {
                box(c, w - 178, visH * .24, 151, 82, '#22172e', '#b6ba70');
                label(c, 'REALITY', w - 102, visH * .24 + 20, 17, '#d9ff6b', 130);
                label(c, 'TEMPORARILY', w - 102, visH * .24 + 42, 11, '#d8cadb', 130);
                label(c, 'OUT OF STOCK', w - 102, visH * .24 + 61, 11, '#ff9bc7', 130);
            }
        }
    }
    if (layer === 'stage') {
        // A pair of giant lips makes the speaker architecture physically predatory above the DJ booth.
        if (level > .35 || crash) {
            const open = crash && state.ending === 'monster' ? ease(age / 2) : level * .22;
            const gums = r * (.09 + open * .42);
            c.save();
            c.globalAlpha = Math.min(1, level + (crash ? .7 : 0));
            oval(c, cx, mouthY, r * .54, gums, '#271020', '#d98cbb');
            if (open > .15) {
                oval(c, cx + Math.sin(t) * 8, mouthY + gums * .48, r * .26, gums * .36, '#b65e87');
                line(c, [cx, mouthY + gums * .28, cx, mouthY + gums * .68], '#783b63', 2);
            }
            for (let i = 0; i < 9; i++) {
                const x = cx + (i - 4) * r * .108;
                box(c, x - r * .044, mouthY - gums + 2, r * .085, Math.max(4, gums * .44), i === 2 ? '#d5af58' : '#f3e4bc', '#6a415d', 2);
            }
            c.restore();
        }
        // A corporate shaman DJ in a halo of unpaid exposure.
        const dy = visH * .56 - 58 * s;
        c.save();
        c.translate(cx, dy);
        c.rotate(Math.sin(t * .8) * .06);
        line(c, [-25 * s, -2 * s, -14 * s, -24 * s, 0, -13 * s, 14 * s, -24 * s, 25 * s, -2 * s], '#d9b274', 4.5 * s);
        c.restore();
        if (level > .5)
            label(c, 'DJ DISSOCIATION', cx, visH * .69, w < 650 ? 10 : 12, '#e6b2db', w * .5);
    }
    if (layer === 'outside' && state.phase === 'escaped') {
        const p = ease(age / 1.7);
        c.save();
        c.globalAlpha = p;
        box(c, w * .64, visH * .26, w * .3, visH * .64, '#314c49', '#bfdbb1');
        box(c, w * .66, visH * .28, w * .26, visH * .6, '#263340');
        oval(c, w * .86, visH * .36, 14, 14, '#e3dba1');
        label(c, 'ACTUAL OUTSIDE', w * .79, visH * .47, w < 650 ? 11 : 14, '#d9ff6b', w * .25);
        label(c, 'NO ENTRY FEE', w * .79, visH * .53, 9, '#d9d4c2', w * .25);
        c.restore();
    }
    if (layer === 'maw' && crash && state.ending === 'monster') {
        // Upper teeth and lip overlap the protagonist as they are pulled inside the mouth.
        const open = ease(age / 2);
        const gums = r * (.09 + open * .42);
        c.save();
        for (let i = 0; i < 9; i++) {
            const x = cx + (i - 4) * r * .108;
            box(c, x - r * .044, mouthY - gums + 2, r * .085, Math.max(4, gums * .44), i === 2 ? '#d5af58' : '#f3e4bc', '#6a415d', 2);
        }
        line(c, [cx - r * .52, mouthY - gums + 2, cx, mouthY - gums - 4, cx + r * .52, mouthY - gums + 2], '#d98cbb', 4 * s);
        c.restore();
    }
    if (layer === 'front') {
        // The dancefloor starts invoice-shaped; during the crash the charge becomes personal.
        if (crash && age > 1.5) {
            const p = ease((age - 1.5) / 1.2);
            for (let i = 0; i < 18; i++) {
                const seed = state.currentX100 + i * 13;
                const x = cx + (hash(seed) - .5) * w * .75 * p;
                const y = visH * .68 - hash(seed + 1) * visH * .42 * p + Math.sin(t + i) * 8;
                c.save();
                c.globalAlpha = p * .7;
                c.translate(x, y);
                c.rotate((hash(seed + 2) - .5) * p * 3);
                label(c, ['ME', '404', 'VIP', 'WHY', 'WE', 'HELP'][i % 6]!, 0, 0, 13 + hash(seed + 3) * 7, i % 2 ? '#d9ff6b' : '#ff9cd5', 70);
                c.restore();
            }
        }
        // A guest holds a placard larger than their personality.
        if (w > 650 && state.stage > 2 && !crash) {
            const x = w * .12, y = visH * .66 + Math.sin(t * 1.1) * 3;
            line(c, [x, y + 65, x, y + 10], '#a38a72', 5);
            c.save();
            c.translate(x, y);
            c.rotate(-.1 + Math.sin(t) * .025);
            box(c, -71, -22, 142, 47, '#dfefa8', '#647344');
            label(c, 'HEALING MY', 0, -5, 12, '#333242', 130);
            label(c, 'INNER BRAND', 0, 12, 12, '#333242', 130);
            c.restore();
        }
    }
}
