# Rage Bait

A Canvas 2D social-feed crash game about staying online long enough to lose your composure. Six recurring fictional advice accounts (`Soft Life CEO`, `Coach Provider`, `SplitCheck King`, `Boundary Babe`, `Couples Court`, and `Engagement Dept`) fill the timeline with 24 escalating takes across six multiplier tiers (`1.00x` through `20.00x+` overtime).

## How it works

- **Browsing vs. Replying**: Swipe, mouse-wheel, or press `ArrowUp` / `ArrowDown` inside the feed to browse recent cards or pull the next available card within the currently unlocked tier. Tap `Replies` (or press `Escape`) to expand and collapse up to three short replies on the active post.
- **Character Rig & Draft Ladder**: On the left (or lower stage in portrait mode), an articulated scroller with two-bone inverse-kinematics arms (`solveLimb`), a separate thumb joint, and damped springs (`stepSpring` / `settleSpring`) reacts to every card while typing and deleting a nine-step draft ladder (`Actually...` up to `I MADE A SPREADSHEET.`).
- **Confirmed Cash-Out (`DRAFT DELETED` / `APP CLOSED`)**: When the backend confirms `cashoutX100 !== null`, the scroller selects and deletes the draft, locks the phone face-down, and leans back in calm room lighting. If the round later crashes, the header finishes the room multiplier while a caption reads `"You left before this."`
- **Crash (`TOOK THE BAIT`)**: When the round crashes without a confirmed cash-out, the scroller's thumb slams the illustrated `Post` button (`0.12–0.30s`), triggering a 36-particle notification burst, live quote-post toasts, a dismissive reply from the bait account (`0.65–1.05s`), and a `TOOK THE BAIT` stamp (`1.05–1.50s`).

## Local development

Run from the clone root:

```sh
npm run preview -- rage-bait
```

Validate before submitting:

```sh
npm run build
npm run typecheck
npm run check
npm test
npm run test:browser
```

The backend supplies committed crash outcomes. Credits have no monetary value. See [integration](../../docs/integration.md), [animation](../../docs/animation.md), and [contributing](../../CONTRIBUTING.md).
