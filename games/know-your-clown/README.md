# Know Your Clown

A satirical Ministry of Airdrops subjects a hopeful applicant to increasingly absurd identity checks. The applicant is an articulated, expressive character in a coral hoodie. Enamel machinery, a camera iris, paper receipts, a witness desk and a single peanut dispenser form the set. The game collects no identity information: every inspection, demand and data-sale gag is fictional animation.

## Direction and pacing

The room supplies the multiplier and committed crash. `direction.ts` maps elapsed round time to inspection appointments. Most rounds end before 3× (about 14 seconds), so the acts arrive every five to eight seconds. Every appointment has its own apparatus, physical action, caption and sound cues.

| Round time (live curve) | Procedure | Physical action |
| --- | --- | --- |
| 0–6 seconds (1×–1.6×) | Proof of Flesh | Camera tracking, a forced triple blink and grin, then the stamp arm labels him “EXIT LIQUIDITY” at 3.3 seconds |
| 6–11 seconds (to 2.3×) | Dental Due Diligence | An examination probe forces a smile; a second stamp slaps “NGMI” on his shoulder |
| 11–16 seconds (to 3.4×) | Character Witness | His dog testifies (“HE BOUGHT TOP.”); a third stamp flags his ID badge “SYBIL?” and the dog adds “HE’S A SYBIL.” |
| 16–21 seconds | Generational Baggage | An ancestral portrait tree surrounds the applicant |
| 21–27 seconds | CAPTCHA Ballet | An embarrassing dance follows the illuminated floor arrows |
| 27–34 seconds | Deep Thought Scan | A transparent helmet scans an unpromising brain trace |
| 34–42 seconds | Soul Appraisal | A tethered ghost and its appraisal tag rise beside the applicant |
| 42–50 seconds | Final Final Check | Surveillance eyes and a mechanical stamp keep reviewing the review |
| From 50 seconds | Recurring audits | Six procedures rotate in twelve-second appointments with distinct copy and a continuing appointment number |

Between the acts, beats key to the multiplier: the clown nose pops on at 1.5× with a squeak, white face paint arrives at 2.5× and a painted mouth at 4×. The allocation display checks eligibility (“CHECKING…”, a false “ELIGIBLE!” at 2×, then “NOT ELIGIBLE”, “APPEAL FILED” and “SEASON 2”), and a fine-print ticker rotates vesting cliffs, claim fees, points and a snapshot taken last week. After a crash the display keeps processing until the peanut drops. The shipping crate is the anticipation device: its walls start creeping up around him from about 1.3× and keep inching up in very long rounds, and on a fixed schedule (7.6, 12.8, 18.7 seconds and so on) it twitches with a ratchet and an iris flare, then nothing happens. The camera pushes in slowly as dread rises.

Tension is `0.12 + 0.8 × (1 − 1/multiplier)` (about 0.39 at 1.5×, 0.52 at 2× and 0.65 at 3×), plus a slow breath on the round clock for the music. Expressions and props use the curve without the breath, so they only escalate: sweat at about 1.3×, then a clenched grimace once the early stamp reactions end (about 3.4×). A slower log driver keeps the crate and props changing in 10×–10,000× rounds. Paper piles, prop counts and motion amplitudes are bounded; case numbers and appointments continue. The current appointment comes directly from elapsed time and the multiplier, so seeking and joining an ongoing round do not require simulating missed frames. Nothing here reads the committed crash: an appointment, a twitch or a warning is theatrical pacing, never an indication of the time left before a crash.

Phase changes blend the applicant's rig for 0.35 seconds (round start, cash-out, crash) while his feet stay where they stood, and secondary motion (blinks, relaxed lids, glances, badge sway, hair) lives in the rig so the blends cover it. The machinery runs on an integrated presentation clock that never resets, so the scan sheet, iris, belt and peanut do not jump between phases. After a crash, the next applicant rides up through the conveyor hatch while the packed crate sinks away. Limbs use a soft outward pole: elbows and knees never fold through the body, and standing legs stay nearly straight. The hips settle wherever a leg would overreach its foot, as at a stride's double support, and he centres himself as he crouches so his labels stay inside the crate.

## Outcomes and accessibility

An accepted cashout is framed as paper hands: “PAPER-HANDED THE AIRDROP. KEPT FACE.” The applicant walks along the floor to the exit in a tinfoil poncho. Both feet follow the distance travelled, so the planted foot does not skate, and a stride that divides the walk lands both feet home. The round keeps running without him: the cameras keep scanning the empty booth, the header shows both the cashed-out and the live multiplier, and a regret ladder keyed to their ratio escalates from “THE MINISTRY IS NOW SCANNING AN EMPTY BOOTH.” to “THE BOOTH IS A KOL NOW. STILL ONE PEANUT.” The later crash reads as dodged: an empty crate labelled “IDENTITY NOT FOUND” ships back to sender. Clicking the control alone does not start the escape: the SDK's accepted cashout state does. Spectators (no stake) get their own copy: “SPECTATOR: ALSO SCANNED”, “WATCHING IS ALSO KYC. SNAPSHOT TAKEN.” and, at the crash, “SPECTATOR DATA ALSO SOLD. BULK DISCOUNT.”

A crash immediately stops the round and displays the final multiplier and rejection status. Its beats fit inside the room's two-second crash hold. The rejection stamp slams in with a 0.16-second hit-stop and a 10% camera punch-in held for 0.3 seconds. The crate rises from the walls' current height, the applicant crouches into it with his feet planted and his hands on the rim, the dossier is swept in and the flaps close by 1.15 seconds. At 1.25 seconds the peanut drops, a final-allocation receipt stamps in and the closing line reads “The airdrop was you.” A scene first opened after a crash displays the settled aftermath quietly. Returning after a frame gap does not replay missed audio cues. The shared shell handles stale connections, allowed intents, keyboard controls and replay verification.

Portrait screens recompose the shared canvas with a large applicant, current demand, multiplier, allocation strip and punchline. The portrait stage oversamples the canonical 16:9 backing store before scaling into its frame, keeping text and linework sharp. The canvas, round timing and controls retain the shared shell contract. A polite live transcript announces inspection and outcome changes without announcing each multiplier tick.

The published game uses full animation regardless of browser motion preferences. Information remains available through the caseboard, stage-specific apparatus and captions. The shell exposes the actual room status and controls outside the illustration, supports keyboard focus and Space, and turns audio off until enabled by the player.

## Audio

`clips.json` embeds ten clips generated with ElevenLabs. The twelve-second instrumental loop uses industrial electro-funk, rubbery bass, bureaucratic hold-music motifs and mechanical percussion. The shared audio engine opens its filter and gently increases playback speed with tension, which sweeps about 0.12–0.65 across 1×–3×. Procedures provide event-driven variations: a thud as each stamp lands, a squeak for the nose, spray paint for the face and mouth, a ratchet for each crate twitch and a ding for the false eligibility. A quiet synthesised Ministry tick quickens with tension (every 1.4 seconds at 1×, about every 0.7 seconds at 3×) until the player cashes out. The crash cuts the music and leaves space for the peanut's short landing sound.

| Clip | Use |
| --- | --- |
| `music` | Loop with a continuous tension envelope |
| `beep` | Scan pass |
| `camera` | Dental image capture |
| `thud` | Witness, stamp landing or review stamp |
| `ratchet` | Mechanical inspection engagement and crate twitches |
| `engine` | Conveyor movement |
| `buzz` | Department transition |
| `crash` | Rejection and identity packing |
| `coin` | Peanut landing |
| `cashout` | Accepted escape |

Prompts live in `scripts/audio/prompts.json`; raw MP3s and request fingerprints live in `scripts/audio/cache/know-your-clown/`. The committed music is the original twelve-second loop. The current music prompt requests a 150-second score for a future regeneration; its request intentionally differs from the saved loop's fingerprint. Generate that score with `npm run audio -- --game know-your-clown --clip music`, using `ELEVENLABS_API_KEY` in the process environment. This preserves the existing effects and embeds the new score as compact Opus. The complete `clips.json` must stay below the 256 KiB source-file limit. See the root README for dry-run and cache options.

## Preview and checks

Use the repository's pinned Node 24 and npm 11, then `npm ci` and `npm run preview -- know-your-clown`. The printed replay URL plays a verified example lasting approximately 179 seconds before the crash. This is a selected demonstration fixture; live rounds use their own committed outcomes. The replay has no recorded curve and runs on the slower first curve, so multiplier-keyed beats (the nose, the paint, eligibility) arrive about 28% later in replay than in live play. The gallery poster is taken at 26 seconds, during the CAPTCHA ballet with the full makeup and all three stamps.

After `npm run build`, run `npm run typecheck`, `npm run check` and `npm test`. The focused pacing and replay checks are `node --test scripts/gallery/know-your-clown*.test.mjs`. Browser validation covers short and extended rounds, fresh mid-round loads, accepted escapes, crash aftermath, replay restart, narrow layouts, both browser motion preferences and embedded audio decoding.

`main.ts`, `audio.ts` and the CSS above `/* game */` are the canonical shared shell. `direction.ts` holds the schedule, tension, makeup, stamp, crate and eligibility timing; `scene.ts` coordinates the room state, blends and audio cues; `portrait.ts` composes the narrow-screen scene; `ministry.ts` draws the architecture, procedures and crate; `character.ts` draws the applicant (rig, gait, stickers) and witness; `ink.ts` supplies the drawing primitives. Each source import stays inside this flat game directory or uses the shared SDK and crash-math packages.
