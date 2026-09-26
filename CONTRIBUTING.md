# Add a game

Create `games/<slug>/` with source, relative assets, a short README, and a build entry. Keep game-specific presentation here. Use the shared SDK for room state and player intents, and the emulator for local rounds. Do not add outcome calculations or production development controls.

Document the visual idea, supported inputs, asset attribution, and build/publish steps. Label incomplete concepts clearly. Keep credentials and environment files out of commits. Dispose listeners, sockets and animation frames on exit.

Run `npm run build`, `npm run typecheck`, and `npm test`. Exercise instant crash, normal play, accepted cashout, and a disconnected host. The gallery imports a reviewed build and pins the source commit; repository changes do not execute automatically on the platform.

SDK, crash-math and emulator edits originate in the platform repository. Refresh their snapshots together and update `UPSTREAM.json` so protocol changes remain traceable.
