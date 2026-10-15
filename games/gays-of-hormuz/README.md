# Gays of Hormuz

The SS Sashay, a pride cruise ship with a rainbow funnel, a disco ball over the pool and a drag queen in the Titanic pose at the bow, tries to run the Strait of Hormuz outbound, Iran's coast on the horizon, open water somewhere ahead. The strait throws naval mines, Iranian missiles from the coast, drones and speedboats at her; you steer her between them, or leave the first mate at the helm. A confirmed cash-out sends a Pride Air helicopter to winch you off the foredeck. The round's crash sinks the ship.

The lab's fourth skill game (`interactive: true`), after Rug Rails, Up Only and Rug Piste.

## Preview

From the repository root, with Node 24 from `.nvmrc` and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- gays-of-hormuz
```

- Recorded round: <http://127.0.0.1:4500/bundle/gays-of-hormuz/index.html?mode=replay>
- Live emulator: <http://127.0.0.1:4500/bundle/gays-of-hormuz/index.html>

**Board** joins the round during betting and **Cash out · airlift** leaves it while she sails. **Restart replay** plays the recorded round again; the recording sails a fixed strait and the first mate steers it until you do. **Sound** cycles off, on and effects only.

## Controls

| Action | Keyboard | Touch / pointer |
| --- | --- | --- |
| Steer to port (up the picture, toward Iran) | Up arrow or W | Hold **PORT**, or drag the ship up |
| Steer to starboard (down the picture, toward Oman) | Down arrow or S | Hold **STARBOARD**, or drag the ship down |
| Board the next sailing | Space during betting | Board |
| Request the airlift | Space while she sails | Cash out · airlift |

The first steering input takes the helm from the first mate for the rest of the page (a replaced scene keeps it). Dragging puts the middle of the hull under your finger. A keyboard or assistive press of a helm button moves one lane. Clicking a helm button never takes focus, so Space still cashes out; the picture says **SPACE = CASH OUT** (or **TAP CASH OUT** on touch screens) while your bet is aboard. Space belongs to the shared shell and never steers.

## How the strait plays

The view looks north across the strait in 2.5D: the ship sails east (to the right) and steers in depth, between a far lane under Iran's coast and a near lane on the Omani side, marked by red and green channel buoys. Things further off are drawn higher and smaller; a dashed drop line and a shadow show where a drone will come down, and a reticle on the water shows where a missile will land, red when it is on your lane.

Hazards arrive in rows, laid from a local seed and the multiplier at the time (never the crash point). Every hazard in a row meets the hull at the same moment, so the helm only has to be somewhere clear when a row arrives and can move freely between rows. A row fills at most three of five lanes, so two are always clear, and the tests check it.

- **Mines** float where they were laid, horns up and a lamp blinking. A mine the bow misses is shouldered aside by the hull.
- **Missiles** launch from batteries on the coast and take aim at where the ship is at launch; then they fly a fixed arc onto a reticle. Turn after the launch and they splash into the sea.
- **Drones** come in low from off the bow and follow the ship's depth until about a second before they arrive; then they commit, so a late turn clears them.
- **Speedboats** run in at a share of the ship's speed and follow her the same way until they commit.

The mix thickens with the multiplier: mines only at the start, missiles from 1.2×, boats from 1.5×, drones from 1.9×, and from 3× two or three hazards a row. Chevrons at the edge of the picture warn of arrivals from off the bow, and a beep warns of a lock on your lane.

A hit is presentation only. It shakes the ship, scorches the hull, slows her for a moment, and knocks a fifth of the rescued guests overboard onto pool floaties, where they bob and wave as she sails on. It never sinks her and never touches the round, the bet or the payout. Castaways on unicorns, flamingos, doughnuts, swans and rainbow rings wait in clear lanes; sail through one to bring them aboard, and they join the dancers on deck. From 1.3× a floating disco ball now and then gives six seconds of **disco shield**, a mirrorball rainbow over the ship that bounces hazards off. **Guests** and **Dodged** are arcade counts with no value of any kind.

The first mate steers the recorded round and any round until the player takes the helm: they plan for the next rows' clear lanes, swing by castaways, and look at their phone for about one hazard in seven, so the demo takes the odd hit.

## The round, keyed to the multiplier

- **The public address** runs a ladder of announcements from the captain, the cruise director Anita Lifeboat, the bridge, the purser and DJ Sonar, a few seconds apart through 1× to 3× ("The Strait of Hormuz. Straight? Not on our watch.", "Missiles inbound. Please remain seated and stunning.", "Halfway to open water. Shantay, we stay.") and on to 22×, then an overtime line every 1.35× for as long as the voyage lasts.
- **Open water** is 60 nautical miles over the multiplier on the chart in the corner: it halves, then halves again, and drops to metres and centimetres in long rounds without ever arriving.
- **The light** goes from afternoon through golden hour and sunset to night by about 20×: stars, a moon, lit portholes, party lights in the bunting and a laser show from the sun deck.
- **A heartbeat** under the eurodance quickens with the multiplier while your bet is aboard; milestone stingers mark 1.5×, 2×, 3×, 5×, 10× and on.

Inbound tankers (MT STRAIGHT ACTING, MT DISCREET, MT NO DRAMA) sail the far lane the other way; Hormuz Island's ochre and rainbow soils pass with a sign that says NO RELATION; the start buoy says STRAIT OF HORMUZ, (WE'LL BE THE JUDGE OF THAT).

## The airlift and the sinking

Only a cash-out the backend confirms brings the airlift. The Pride Air helicopter flies in from the top corner, hovers over the foredeck, winches the player up in their captain's hat and pride sash, and climbs to a safe hover, where it stays tagged **YOU · AIRLIFTED** while the first mate takes the helm back and the voyage goes on. A card under the top bar compares your exit with the ship's multiplier and keeps backing it ("Double without you. Still dry, still iconic.").

The crash is the backend's alone and is decided from the crash point with a seeded generator: what lands the last blow (a mine nobody charted, one missile too many, a drone swarm or a speedboat that did not RSVP) and where. A 0.14 s hit-stop and a slow-motion blast with glitter in the shrapnel, a punch-in and a shake, then she goes down as a pure function of crash time: hit forward, bow first with the stern and the flag lifting clear; hit aft, stern first. Everyone leaps for a floatie, two lifeboats drop from their davits, a player whose bet was aboard jumps last onto a flamingo tagged YOU, the camera eases over to the wreck, bubbles come up, and the disco ball breaks free and bobs to the surface, still turning. **SASHAY AWAY**, the cause, and what it meant for you; then "Everyone made it to a floatie. The disco ball floats." Nobody is hurt.

The ending takes about 5.4 seconds. If the host opens betting sooner it finishes under a **NEXT SAILING BOARDING NOW** banner while the shell already offers the new round, and the next ship fades up at the start buoy. A new running round or a replay restart cuts it short. A scene opened after the crash settles the same frame from crash time and plays the quiet crash; a scene opened mid-round rebuilds the strait at the right distance with nothing live at the hull and a fresh arcade score, and one replaced after a short hidden-tab gap gets its voyage back.

## Small screens

Below 600 px wide (and in an embedded frame of that width) the picture recomposes for a 540 × 800 canvas: a taller sky for the missile arcs, deeper lanes, the HUD in two rows and the announcement in two lines. The canvas is drawn 2.5 times larger and scaled down so the tall picture stays sharp. The helm buttons sit under the round controls.

## Files

| File | What it holds |
| --- | --- |
| `strait.ts` | The course: the helm and the ship's speed, rows of hazards laid from the seed, the distance-driven flight of missiles and drones and the run of the boats, homing until they commit, contacts, hits, near misses, rescues, the disco shield, the first mate's planner, and the closed-form distance for late entry. No stake, payout or crash point enters it. |
| `ship.ts` | The SS Sashay in hull coordinates: decks, lifeboats, the funnel, the bunting, the flags, the dancers, the DJ, the drag queen, the player, scorch marks, the shield and the wake; the ship's frame and `toScreen`; the sinking pose as a function of crash time. |
| `art.ts` | The sky and its time of day, the Zagros, the coast with its batteries, the sea, islands and tankers, mines, missiles, reticles, drones, speedboats, people, floaties, the disco ball and the helicopter. |
| `scene.ts` | Phases, clocks and cues; the depth-sorted picture; blasts and floaters; the airlift; the wreck and its leapers; the HUD, the chart and the announcements; the portrait layout. |
| `script.ts` | The announcement ladder and overtime lines, toasts, the regret ladder, the causes and the last announcements. |
| `input.ts` | Keyboard, drag and the helm buttons, wired from the game's own files. |
| `motion.ts` | The shared spring toolkit (Boiler Room's copy). |
| `*.test.mjs` | Headless tests for the course and the ship, and a Chromium test of the real scene. Not part of the source pack or `npm test`. |
| `main.ts`, `audio.ts`, the start of `style.css` | Unmodified copies of the shared shell in `scripts/shell/`. |
| `replay.json` | Hello World's verified 9.07× round with this game's ID. |
| `clips.json` | Empty: the sound is the shared helper's procedural eurodance and effects. |

## Validation

From the repository root, in this order:

```sh
npm run build
npm run typecheck
npm run check
npm test
node --test games/gays-of-hormuz/*.test.mjs
```

The game's own tests check that every row leaves a clear lane, that the first mate dodges most of the strait and still takes the odd hit, that a ship that never steers is hit again and again yet sails on with bounded memory for ten minutes, that the closed-form distance matches sailing at 30, 60 and 144 Hz, that a late arrival finds nothing live at the hull, that missiles aim at launch and miss after a turn, that a homing drone commits, that castaways come aboard once, that the ship's frame and the sinking are continuous and pure, and that the real scene finishes its ending into the next betting phase, hands the helm over and draws every phase in both layouts.

Build output is `dist/gays-of-hormuz/index.html`, `game.generated.js` and `style.css`, the three files Studio's **Your own renderer** takes. Published frames use only these files and the platform bridge.

## Credits and boundaries

All artwork is original Canvas 2D drawing; the sound is the repository's shared procedural helper, and `scripts/audio/prompts.json` holds an optional music request. No external images, fonts, recordings, scripts or API keys. The game is an open remix origin (`gallery.json`).

The game presents the shared round and sends the player's intents through the SDK; it never selects, predicts or influences the crash. Steering, hits, guests, dodges and the shield are arcade play and never change the round, a bet or a payout. Credits have no monetary value.
