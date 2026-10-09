# Game Lab creator instructions

Read `README.md`, `docs/integration.md`, and the selected game's source before editing. `docs/animation.md` is the reference for rigs, inverse kinematics, gaits, springs, seeded crashes, late entry, portrait mode and the other techniques the games share; read it before adding or changing character or environment animation. Ask what the creator wants to change when their prompt does not specify a remix.

## Scope and outcomes

- Game presentation lives in `games/<slug>/`. Preserve `studio-lineage.json` and its remix ancestry when present.
- The backend supplies committed crash outcomes. Use the shared SDK for round state, bets and cashout intents; never invent or influence outcomes in a game.
- Keep protocol, verification and outcome changes out of a visual remix. `packages/game-sdk`, `packages/crash-math` and `apps/emulator` are shared platform snapshots.
- Credits have no monetary value. Do not add prizes, token revenue rights or promises of returns.
- Keep credentials out of files, commits and generated bundles. API keys reach local generators through environment variables only.

## Local development

Use Node 24 as pinned in `.nvmrc`, and npm 11. Work from the clone root:

```sh
npm ci --include=dev --bin-links=true
npm run build
npm run typecheck
npm run dev
```

`npm run preview -- <slug>` builds and serves only the selected game and its relative media. `npm run dev` builds the catalog and prints a live and a replay preview URL for each game. Stop its process before reinstalling dependencies. On Windows, prefer a local folder outside OneDrive; `EPERM` during installation can mean a file is locked. Resolve installation errors before building. TypeScript is a local development dependency; it does not require a global install.

## Game structure

Read the selected game's `main.ts`, scene code, controls and assets. Games build into self-contained HTML, JavaScript and CSS. Keep runtime files and imports compatible with the platform's sandbox: relative assets, no external scripts, no network calls inside a published frame.

The shared shell and audio helpers have canonical sources under `scripts/`. Consult `README.md` before changing their copies in a game; the shell check detects drift. Preserve source-pack and gallery metadata. Do not edit the platform's generated gallery files by hand.

Use transparent PNG layers or separate rig parts for generated sprites. Keep animation timing and character joints independent of backend outcome logic. Check waiting, running, crash, accepted cashout, replay, and small screen behavior when relevant.

## Validation and handoff

Build before typechecking and testing because workspaces import built outputs. Run the checks relevant to the change, including `npm run typecheck`, `npm run check`, and relevant tests. Report the commands and any failures. Never hide a failure by weakening a check.

Review the Git diff, preserve unrelated creator edits, and explain what changed and how to preview it. Do not publish or push the creator's work without their authorization. A game submitted from a fork as a pull request merges and deploys on its own once CI passes and a maintainer approves it (`CONTRIBUTING.md`, "Submit a game from a fork"), so keep a game's pull request to its own directory, its row in `scripts/games.mjs` and the README table, and the docs; platform files need a maintainer's hand.
