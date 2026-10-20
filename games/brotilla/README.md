# Brotilla

**The revolution has a guest list.** Direct the publicity around a fictional Europe-to-Gaza flotilla, led by a grandstanding parody of Greta Thunberg in a Washington-crossing-the-Delaware bow pose. The cameras, statements, VIP privileges and self-importance grow with the displayed multiplier. Cash out to leave on the **Personal Boundaries**. When the host reveals a crash, the original party crew discovers its cocaine reserve is empty, the DJ stops, the flag sags and the inflatable Nobel medal deflates.

This is an invented voyage with invented dialogue and supporting characters. Greta is a political caricature; the drug subplot belongs to the separate fictional entourage aboard **Seas the Means**. The game does not depict her taking, holding or supplying drugs and makes no claim about a real flotilla's cargo. The satire targets performative activism, influencer incentives, class hypocrisy and branding a humanitarian cause.

## Play

Use Node 24 and npm 11 from the repository root:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- brotilla
```

Open the printed live URL to use the local emulator, or the replay URL for the verified recording. Join during betting, direct the spectacle while the round runs, and request cash-out before the revealed crash. Credits have no monetary value.

| Control | Direction |
| --- | --- |
| Go live / key 1 | Broadcast the captain and trigger influencer dialogue |
| Deploy drone / key 2 | Move the camera drone and point toward it |
| Issue statement / key 3 | Raise the microphone and produce contradictory declarations |
| Centre yourself / key 4 | Raise the captain's podium and frame the main character |
| Auto / key 0 | Cycle all four stunts every 5.5 seconds |
| Cash out / Space with canvas focused | Request cash-out through the shared shell |
| Sound | Cycle off / on / effects only |

Publicity choices are cosmetic: they change poses, props and dialogue, never the committed outcome, multiplier, payout or cash-out window. Auto works without input for gallery playback. The actual cash-out button sits immediately below the canvas, before publicity controls on phones.

## Escalation

| Displayed multiplier | Act | New excess |
| --- | --- | --- |
| 1.00× | Deeply concerned | Lead ship, film crew, fictional entourage's DJ boat |
| 1.25× | Bearing witness | Drone coverage and ring light |
| 1.60× | Speaking truth to followers | Teleprompter: BE HUMBLE / APPLAUSE |
| 2.00× | Historically significant | Commissioned heroic portrait |
| 3.00× | Centre of the movement | Raised COLLECTIVE EGO podium |
| 5.00× | Solidarity, business class | Yacht Marx, hot tub and luxury privileges |
| 8.00× | Nominated by herself | Inflatable NOBEL ME medal |
| 12.00× | Too important to dock | The First Annual Me Awards |

Props fade into the scene from the displayed multiplier. There is no stash countdown, crash prediction or artificial round-duration limit. After 45 seconds, 24 rotating overtime exchanges keep the spectacle talking; waves, boats, flags, cameras and characters continue beyond three minutes. Render loops and state are bounded.

## Comedy and endings

The script includes 32 act exchanges, 24 overtime exchanges, 16 manual-direction responses, 12 livestream comments and distinct exit/crash dialogue. Examples:

- **Actual sailor:** “Could one of you seize the fucking wheel?”
- **Greta parody:** “Please stop centring yourselves. I am speaking.”
- **Influencer:** “Zoom out until my trust fund looks like a grassroots movement.”
- **Theory bro:** “Abolish class. Keep priority boarding.”
- **Influencer:** “If narcissism were renewable, we could power this bitch to Gaza.”

**Revealed crash:** the fictional party boat opens its EMERGENCY MORALE case and finds the cocaine reserve empty. The DJ slumps, the wind machine spins down, the flag droops, the ring light folds and the Nobel balloon deflates. The captain holds the grand pose before asking why everyone suddenly wants to turn back. The final card says **SOLIDARITY HAS LEFT THE GROUP CHAT** and **CAUSE STILL URGENT. AFTERPARTY CANCELLED.** No characters die and no drug-use instructions are shown.

**Confirmed cash-out:** a separate influencer passenger leaves under a SELF-CARE IS RESISTANCE canopy aboard the **Personal Boundaries**, wearing a heated towel and still filming. “I stand with you. From a different boat.” A later room crash cannot overwrite this accepted exit. A click alone never triggers it.

## Art, animation and sound

Original self-contained Canvas 2D artwork uses a coral-and-gold sunset, teal sea, layered reflections, wake trails, editorial cartoon characters, flowing flag, wooden hulls, portholes, ropes, phones, a working sailor and an increasingly expensive production set. Portrait mode recomposes the boats and hero in a 540×800 space; landscape uses 960×540. No external fonts, images, services or new packages are needed.

The captain has fixed-length two-bone arms and legs, a planted rear foot, a front boot on the OPTICS crate, and a hand pinned to the flagpole. Platform, character, crate and flag all share the rocking deck transform. The supporting crew also has fixed-length rigs. Braid tips lag the head; fan spin-down integrates velocity rather than multiplying elapsed time by a changing rate. Stunt weights blend continuously and freeze on confirmed outcomes. Browser motion preferences do not disable animation, following the shared contract.

Procedural Eurodance, camera shutters, notification sounds, escalation cues and the crash's record scratch use the shared audio bus. The empty `clips.json` requires no media downloads. The audio prompt manifest contains an optional distinct 150-second score recipe; no generated recording is bundled.

## Contract and lifecycle

`main.ts`, `audio.ts` and the CSS prefix remain exact canonical copies. All game code lives in this folder. `presentation.ts` receives only `SceneView`; it never reads or invents a future outcome or sends an intent. A non-null `cashoutX100` is the only exit confirmation. The empty-stash sequence begins only for a revealed crash.

A live crash can finish briefly into waiting/betting, marked LAST ROUND. A new round overrides it. First-frame/late crashes and cash-outs reconstruct the appropriate state without replaying old cues. A quiet crash stays quiet through its secondary effect. Every listener is removed on scene disposal; the scene never closes the shared audio singleton.

Publicity input ignores key repeat, modified keys and editable fields, and leaves Space to the shell. Buttons expose their pressed/disabled states; the caption has a polite live region. `canvas.gameScene` contains copied diagnostic observations, not a mutable controller or future outcome.

## Source map and verification

| File | Purpose |
| --- | --- |
| `scene.ts`, `presentation.ts` | Shell adapter, confirmed outcomes, captions, accessibility and sound |
| `production.ts`, `input.ts`, `layout.ts` | Cosmetic direction, listener lifecycle and composition |
| `content.ts` | Acts, manual responses, overtime, livestream and ending scripts |
| `art.ts`, `sea.ts`, `boats.ts`, `props.ts` | Complete layered flotilla, sea, publicity props and endings |
| `cast.ts`, `ink.ts` | Character poses, fixed-length IK and drawing primitives |
| `presentation.test.mjs` | Outcome isolation, continuity, rig contact, late entry, long rounds, cues and cleanup |
| `browser.test.mjs` | Actual bundle/shell, host bridge, input, mobile, accepted exit and verified replay |

```sh
npm run build
npm run typecheck
npm run check
npm test
node --test games/brotilla/presentation.test.mjs
node --test games/brotilla/browser.test.mjs
npm run test:browser
```

Browser tests require Playwright Chromium. Set `GAME_QA_SHOTS=/absolute/path` to retain QA screenshots. Review early/late crashes, accepted exits, short mobile hosts, both orientations, replay restart and three-minute rounds. Game-specific tests are separate from `npm test`. QA screenshots are not published gallery captures; gallery export uses the repository's pinned capture image.

The 9.07× replay retains the template's verified seed, hash and outcome and changes only the game ID. See the root integration, animation and verification documentation for platform details.
