import type { Frame } from './presentation';
import { box, oval, label, line, ease, hash, type Ctx } from './ink';
/** All dimensions use the church's logical space. Only revealed crashes launch debris. */
export function drawSet(c: Ctx, frame: Frame, w: number, time: number, layer: 'back' | 'front') {
    const x = w / 2, level = frame.stage / 7, age = frame.outcomeAge;
    const crash = frame.phase === 'crashed', hit = crash && age >= 1.08;
    if (layer === 'back') {
        // Ring light and vanity camera: a fake halo with a very real ego.
        const lightX = x + Math.min(w * .24, 184);
        line(c, [lightX, 422, lightX, 248], '#716149', 4);
        oval(c, lightX, 261, 28, 28, '#0000', '#fff2bd');
        box(c, lightX - 8, 248, 16, 28, '#4e4d40', '#d1bd86', 3);
        oval(c, lightX, 253, 2.5, 2.5, '#b34536');
        label(c, 'HOLY FANS', lightX, 307, 10, '#795433', 100);
        if (w > 600) {
            box(c, x - 281, 195, 127, 100, '#56402a', '#c5a368');
            label(c, 'SALVATION+', x - 217, 218, 16, '#f9deb0', 112);
            label(c, 'AD-FREE GUILT', x - 217, 243, 10, '#deb782', 112);
            label(c, level > .5 ? 'ENTERPRISE SIN' : 'UPGRADE YOUR SOUL', x - 217, 270, 9, '#e5ca95', 114);
            // A gilded private jet instead of a saint on the sponsor plaque.
            c.save();
            c.translate(x + 241, 206);
            c.rotate(-.15);
            line(c, [-44, 4, 44, 4], '#b7974f', 13);
            line(c, [-8, 4, 6, -27], '#b7974f', 10);
            line(c, [-8, 4, 9, 32], '#b7974f', 10);
            line(c, [-37, 2, -45, -17], '#b7974f', 8);
            label(c, 'CLOSER TO GOD', 0, 62, 9, '#795433', 120);
            c.restore();
        }
        // The collection station is a cartoon prop; it has no payment interaction.
        const tx = x - Math.min(w * .25, 183);
        box(c, tx - 29, 335, 58, 85, '#ad8950', '#6d4d31');
        box(c, tx - 23, 341, 46, 34, '#394d40', '#d5c295');
        label(c, 'TAP TO', tx, 352, 8, '#dfedb8', 42);
        label(c, 'REPENT', tx, 365, 8, '#dfedb8', 42);
        line(c, [tx - 18, 390, tx + 18, 390], '#64492d', 5);
        const receipt = 14 + level * 42;
        box(c, tx - 12, 394, 24, receipt, '#f8e8bd');
        for (let i = 0; i < 5; i++)
            line(c, [tx - 8, 399 + i * 7, tx + 8, 399 + i * 7], '#967954', 1);
        label(c, 'NO REFUNDS', tx, 450, 8, '#785031', 90);
        for (let i = 0; i < Math.min(6, frame.stage); i++) {
            const bx = tx - 27 + (i % 3) * 24, by = 426 - Math.floor(i / 3) * 24;
            oval(c, bx, by, 13, 16, '#b18b4b', '#74502f');
            label(c, '$', bx, by + 1, 15, '#f5d897', 20);
        }
        // A leased blue-check halo sits above the priest's head and cleanly below the crucifix.
        if (frame.stage >= 3 && !hit && frame.phase !== 'escaped') {
            c.save();
            c.translate(x, 233 + Math.sin(time * 1.3) * 2);
            oval(c, 0, 0, 29, 7, '#0000', '#c8a350');
            oval(c, 28, 0, 10, 10, '#557f96');
            label(c, '✓', 28, 1, 12, '#fff4d5', 16);
            c.restore();
        }
    }
    if (layer === 'front' && hit) {
        const t = Math.min(2.8, age - 1.08);
        // The same revealed final multiplier produces the same 38 trajectories on every replay.
        for (let i = 0; i < 38; i++) {
            const seed = frame.currentX100 + i * 37;
            const vx = (hash(seed) - .5) * 300, vy = -95 - hash(seed + 1) * 190;
            const px = x + vx * t, py = Math.min(438 + hash(seed + 2) * 12, 374 + vy * t + 225 * t * t);
            c.save();
            c.translate(px, py);
            c.rotate((hash(seed + 3) - .5) * Math.min(t, 1.2) * 10);
            if (i % 3 === 0) {
                oval(c, 0, 0, 5, 5, '#cda454', '#805a31');
            }
            else if (i % 3 === 1) {
                box(c, -6, -9, 12, 18, '#f7e6bd', '#b59a6c', 0);
                line(c, [-3, -4, 3, -4], '#8e7451', 1);
            }
            else {
                box(c, -7, -3, 14, 6, '#a47748', '#69472d', 0);
            }
            c.restore();
        }
        // Hairpiece and fake verification badge have inherited launch velocity.
        const fly = Math.min(t, 1.6);
        oval(c, x - 130 * fly, Math.min(439, 256 - 160 * fly + 180 * fly * fly), 25, 10, '#65503c');
        oval(c, x + 115 * fly, Math.min(443, 233 - 110 * fly + 175 * fly * fly), 14, 14, '#557f96');
        label(c, '✓', x + 115 * fly, Math.min(443, 233 - 110 * fly + 175 * fly * fly), 17, '#fff4d5', 20);
        if (age > 2) {
            c.save();
            c.globalAlpha = ease((age - 2) / .4);
            box(c, x - 104, 144, 208, 69, '#faf0d3', '#a17744', 3);
            label(c, 'HEAVENLY HR', x, 160, 11, '#9b382d', 190);
            label(c, '★ ☆ ☆ ☆ ☆', x, 180, 20, '#a47d39', 188);
            label(c, 'WOULD NOT WORSHIP AGAIN', x, 200, 8, '#71563c', 190);
            c.restore();
            label(c, 'DONATIONS STILL OPEN', x - Math.min(w * .25, 183), 321, 8, '#9a382d', 130);
        }
    }
}
