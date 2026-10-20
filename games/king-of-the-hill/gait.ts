/** Alternating uphill steps. Supporting feet stay at their world contact points. */
import { heightAt, slopeAngle } from './hill';
import { clamp, mix, smoothstep } from './motion';

export interface Footstep {
  x: number;
  fromX: number;
  toX: number;
  phase: number;
  duration: number;
  lift: number;
}

export interface Gait {
  baseX: number | null;
  feet: [Footstep, Footstep];
}

const footstep = (x: number): Footstep => ({ x, fromX: x, toX: x, phase: 1, duration: 0.3, lift: 0 });
export const createGait = (): Gait => ({ baseX: null, feet: [footstep(0), footstep(0)] });

function plant(gait: Gait, baseX: number): void {
  const spread = 15 * Math.cos(slopeAngle(baseX));
  gait.baseX = baseX;
  gait.feet = [footstep(baseX - spread), footstep(baseX + spread)];
}

export function stepGait(gait: Gait, baseX: number, walking: boolean, dt: number): void {
  // Joining an advanced round or resuming after a large jump must not stretch the legs.
  if (gait.baseX === null || Math.hypot(baseX - gait.baseX, heightAt(baseX) - heightAt(gait.baseX)) > 70) {
    plant(gait, baseX);
    return;
  }
  const tangentX = Math.cos(slopeAngle(baseX));
  const speed = dt > 0 ? (baseX - gait.baseX) / (dt * tangentX) : 0;
  gait.baseX = baseX;
  if (dt <= 0) return;

  const direction = speed < 0 ? -1 : 1;
  const pace = Math.abs(speed);
  const swinging = gait.feet.find((foot) => foot.phase < 1);
  if (swinging) {
    swinging.phase = Math.min(1, swinging.phase + dt / swinging.duration);
    swinging.x = mix(swinging.fromX, swinging.toX, smoothstep(0, 1, swinging.phase));
    swinging.lift = swinging.phase < 1 ? Math.sin(swinging.phase * Math.PI) * 16 : 0;
  }
  // Finish an airborne step when motion stops, but never march in place.
  if (!walking || pace < 1 || gait.feet.some((foot) => foot.phase < 1)) return;
  const trailing = gait.feet[0].x * direction < gait.feet[1].x * direction ? gait.feet[0] : gait.feet[1];
  if ((baseX - trailing.x) * direction / tangentX < 18) return;
  trailing.fromX = trailing.x;
  trailing.duration = clamp(18 / Math.max(55, pace), 0.04, 0.3);
  trailing.toX = baseX + direction * Math.min(32, 22 + pace * trailing.duration * 0.35) * tangentX;
  trailing.phase = 0;
}
