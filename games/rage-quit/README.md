# Rage Quit

A full-stage animated rage comic for a RAGEGUY community concept. A furious office worker hammers the keyboard, interrogates a CAPTCHA, argues with Coach Cope, shelters from an update avalanche, wrestles a possessive computer, meets his own algorithmic rage face, nearly tips his chair and fails a mindfulness trial. Eight six-second acts cycle with further dialogue throughout long rounds. The satire concerns fictional office software and gurus; the dialogue includes profanity.

The character uses attached two-bone arms and legs, heavy wind-up/contact/recovery strokes, torso follow-through, eye twitches and squashed expressions. Desk knocks carry into the CRT, chair, fan and terrified plant. Idle acting follows the page clock, so waiting and betting have drinking, breathing and a moving office.

Only the backend crash triggers the desk flip, flying CRT, collapsing wall and closed support ticket. The physical chain and punchline land within 1.6 seconds for the live inter-round delay. Confirmed cash-out rolls the chair away, unplugs the cable and leaves the character smug through the crash. The authoritative round multiplier remains separate from the accepted cash-out value. None of the animation predicts a future result; credits have no monetary value.

## Preview and controls

From the repository root with Node 24 and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- rage-quit
```

Open the printed replay URL. Remove `?mode=replay` for live emulator play. Join during betting, then cash out while running; Space performs the available action unless another control has focus. Sound cycles off, on and effects only. Restart replay plays the verified recording again.

Desktop uses a full 960 × 540 scene with a compact HUD. On phones, a tall close shot keeps the complete acting rig visible and a live CRT cutaway carries the current gag. All artwork is original Canvas 2D code, and the opt-in soundtrack uses the shared hardstyle synthesizer. No external assets, fonts, requests or recordings are needed.

## Integration

`main.ts`, `audio.ts` and the CSS through `/* game */` are canonical shell copies. The scene consumes verified `SceneView` values; round-curve interpolation, intents and replay remain in the shared SDK shell. The recorded seed, hash and result are preserved from the template with this game's ID.

`acting.ts` reconstructs each act and rig pose from the authoritative elapsed time. A late entry shows the current act and crash age without playing missed sounds. Reduced motion uses still characteristic poses, omits impacts, shaking and flying paper, and displays the settled ending. `portrait.ts` rearranges a single evaluated scene for phone screens.

Build and upload `dist/rage-quit/index.html`, `game.generated.js` and `style.css` through Studio's **Your own renderer** flow. Publishing and room linking remain separate actions. The game does not claim an official partnership or configure a token transaction.

Community context: the research prospect is RAGEGUY, mint `GvV7sFu6FHJsSVXfpG7xqFnWar3c7YkcC74rqe7Bpump`. This documentation identifier does not establish eligibility, ownership or endorsement.

See the [integration guide](../../docs/integration.md) for the host contract and validation states.
