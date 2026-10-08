# Know Your Clown

A satirical Ministry of Airdrops subjects a hopeful applicant to increasingly absurd identity checks. The applicant is an articulated, expressive character in a coral hoodie. Enamel machinery, a camera iris, paper receipts, a witness desk and a single peanut dispenser form the set. The game collects no identity information: every inspection, demand and data-sale gag is fictional animation.

## Direction and pacing

The room supplies the multiplier and committed crash. `direction.ts` maps elapsed round time to inspection appointments. Every appointment has its own apparatus, physical action, caption and sound cues. The opening forces an oversized smile, then stamps “EXIT LIQUIDITY” onto the applicant within its first 4.8-second cycle. The opening also contains the mechanical iris, inspection arms and the promised peanut, so a short round has a complete visual premise.

| Round time | Procedure | Physical action |
| --- | --- | --- |
| 0–18 seconds | Proof of Flesh | Camera tracking, face brackets, scanner sheet and nervous applicant |
| 18–37 seconds | Dental Due Diligence | An articulated examination probe and a tooth index |
| 37–57 seconds | Character Witness | A corporate dog gives testimony into a microphone |
| 57–78 seconds | Generational Baggage | An ancestral portrait tree surrounds the applicant |
| 78–100 seconds | CAPTCHA Ballet | An embarrassing dance follows the illuminated floor arrows |
| 100–125 seconds | Deep Thought Scan | A transparent helmet scans an unpromising brain trace |
| 125–150 seconds | Soul Appraisal | A tethered ghost and its appraisal tag rise beside the applicant |
| 150–174 seconds | Final Final Check | Surveillance eyes and a mechanical stamp keep reviewing the review |
| From 174 seconds | Recurring audits | Six procedures rotate in eighteen-second appointments with distinct copy and a continuing appointment number |

Clown makeup and the inspection light bank accumulate through the first eight appointments and persist through recurring audits.

Inspection motions cycle independently of the capped physical dimensions. Paper piles, prop counts and motion amplitudes are bounded; case numbers and appointments continue. The tension envelope increases over minutes and retains a breathing cycle during exceptionally long rounds. The current appointment comes directly from elapsed time, so seeking and joining an ongoing round do not require simulating missed frames. An appointment is theatrical pacing, never an indication of the time left before a crash.

## Outcomes and accessibility

An accepted cashout sends the applicant out in a tinfoil poncho. The accepted multiplier and privacy badge persist through the later crash. Clicking the control alone does not start the escape: the SDK's accepted cashout state does.

A crash immediately stops the round and displays the final multiplier and rejection status. The landscape scene adds a rejection stamp. The machinery packages an identity dossier, then delivers a peanut after 2.8 seconds. The applicant peers out of the packed dossier while a final-allocation receipt displays one peanut. The closing line reads “The airdrop was you.” A scene first opened after a crash displays the settled aftermath quietly. Returning after a frame gap does not replay missed audio cues. The shared shell handles stale connections, allowed intents, keyboard controls and replay verification.

Portrait screens recompose the shared canvas with a large applicant, current demand, multiplier, allocation strip and punchline. The portrait stage oversamples the canonical 16:9 backing store before scaling into its frame, keeping text and linework sharp. The canvas, round timing and controls retain the shared shell contract. A polite live transcript announces inspection and outcome changes without announcing each multiplier tick.

The published game uses full animation regardless of browser motion preferences. Information remains available through the caseboard, stage-specific apparatus and captions. The shell exposes the actual room status and controls outside the illustration, supports keyboard focus and Space, and turns audio off until enabled by the player.

## Audio

`clips.json` embeds ten clips generated with ElevenLabs. The twelve-second instrumental loop uses industrial electro-funk, rubbery bass, bureaucratic hold-music motifs and mechanical percussion. The shared audio engine opens its filter and gently increases playback speed with the long tension envelope. Procedures provide event-driven variations; the crash cuts the music and leaves space for the peanut's short landing sound.

| Clip | Use |
| --- | --- |
| `music` | Loop with a continuous tension envelope |
| `beep` | Scan pass |
| `camera` | Dental image capture |
| `thud` | Witness or review stamp |
| `ratchet` | Mechanical inspection engagement |
| `engine` | Conveyor movement |
| `buzz` | Department transition |
| `crash` | Rejection and identity packing |
| `coin` | Peanut landing |
| `cashout` | Accepted escape |

Prompts live in `scripts/audio/prompts.json`; raw MP3s and request fingerprints live in `scripts/audio/cache/know-your-clown/`. The committed music is the original twelve-second loop. The current music prompt requests a 150-second score for a future regeneration; its request intentionally differs from the saved loop's fingerprint. Generate that score with `npm run audio -- --game know-your-clown --clip music`, using `ELEVENLABS_API_KEY` in the process environment. This preserves the existing effects and embeds the new score as compact Opus. The complete `clips.json` must stay below the 256 KiB source-file limit. See the root README for dry-run and cache options.

## Preview and checks

Use the repository's pinned Node 24 and npm 11, then `npm ci` and `npm run preview -- know-your-clown`. The printed replay URL plays a verified example lasting approximately 179 seconds before the crash. This is a selected demonstration fixture; live rounds use their own committed outcomes. The gallery poster is taken at 76 seconds, before the ancestry appointment ends.

After `npm run build`, run `npm run typecheck`, `npm run check` and `npm test`. The focused pacing and replay checks are `node --test scripts/gallery/know-your-clown*.test.mjs`. Browser validation covers short and extended rounds, fresh mid-round loads, accepted escapes, crash aftermath, replay restart, narrow layouts, both browser motion preferences and embedded audio decoding.

`main.ts`, `audio.ts` and the CSS above `/* game */` are the canonical shared shell. `scene.ts` coordinates the room state; `portrait.ts` composes the narrow-screen scene; `ministry.ts` draws the architecture and procedures; `character.ts` draws the applicant and witness; `ink.ts` supplies the drawing primitives. Each source import stays inside this flat game directory or uses the shared SDK and crash-math packages.
