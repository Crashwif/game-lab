# Beyond the Colony

A little penguin walks away from the colony toward a distant Antarctic summit. A jade aurora hangs over layered midnight mountains; a red wool scarf, expedition pack and determined little footsteps give the journey its character. The foreground keeps climbing through long rounds with alternating steps and leaps across icy shelves.

This is an independent community game concept inspired by Nietzschean Penguin, targeting the Solana mint `8Jx8AAHj86wbQgUTjGuj6GTTL5Ps3cqxKRTvpaJApump`. It includes original Canvas 2D illustrations and procedural audio, with no project logos, documentary footage or third-party recordings. It does not claim official affiliation, establish a room/token link, or imply approval from the token's community.

## Play and preview

From the repository root with Node 24 and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- beyond-the-colony
```

The printed recorded-preview URL includes `?mode=replay`; remove the query for live play with the local emulator. Join during betting and use **Cash out** while the round runs. Space performs the available action unless another control has focus. **Sound** cycles off, on and effects only. Credits have no monetary value.

The shared shell supplies the authoritative multiplier, room phase and accepted cash-out. The penguin reaches a glowing refuge only after cash-out confirmation and rests there through the ice break. A backend crash fractures the route and drops the penguin onto a safe lower shelf with a soft snow puff. Neither the terrain nor the character selects the crash point.

## Scene structure

- `scene.ts` composes the expedition, analytic step/hop motion, continuous chapter rotation, accurate multiplier and confirmed outcome states.
- `landscape.ts` draws aurora ribbons, layered mountain faces, glacial shelves, the receding colony and the refuge.
- `penguin.ts` articulates the feet, flippers, body, scarf and backpack with original vector shapes.
- `main.ts`, `audio.ts` and the shared portion of `style.css` use the canonical page shell.
- `clips.json` is empty; the ambient score and shattering sound are generated through the opt-in audio helper.
- `replay.json` is the verified template recording with this game's ID.

Elapsed round time determines terrain and footsteps directly, including late entry and the final crash pose. Story chapters rotate throughout long rounds. Reduced motion holds parallax, snow, scarf and footsteps still, represents progress in discrete ledges, and shows outcomes without falling or travel animation. Large multipliers fit their own reserved readout area.

The source pack is self-contained and has no runtime network requests or external media. Build output consists of `dist/beyond-the-colony/index.html`, `game.generated.js` and `style.css` for Studio's **Your own renderer** flow. Publication and room eligibility/linking follow the platform's existing creator process.
