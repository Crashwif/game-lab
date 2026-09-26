# Balloon Pump

A complete Canvas 2D reference: an articulated man operates a bicycle floor pump, a balloon grows with the displayed multiplier, and the crash event bursts it.

- `pumper.ts`: limb geometry and the linked handle/piston animation.
- `scene.ts`: background, hose, balloon and burst drawing.
- `main.ts`: SDK connection, round lifecycle, input controls and animation loop.
- `replay.json`: a verifiable settled example round used by the gallery.

Run `npm run dev` from the repository root. Join with 50 local credits, then cash out during a running round. The backend decides whether the exit arrives before the crash. `npm run build` produces the three publishable files in `dist/balloon-pump/`.
