# Crashwif Games

Build a game from the [Hello World template](games/hello-world), or study the playable references below. [Game Lab](https://devnet.crashwif.com/game-lab) in the Crashwif lobby is the companion gallery.

Game code controls presentation and sends player intents; the backend supplies the committed round outcome. Credits have no monetary value.

## Start with Hello World

Use the Node 24 version pinned in [`.nvmrc`](.nvmrc) and npm 11. If you use nvm, run `nvm install` and `nvm use` after cloning.

```sh
git clone https://github.com/Crashwif/game-lab.git
cd game-lab
npm ci --include=dev --bin-links=true
npm run preview -- hello-world
```

The preview builds only Hello World and the shared packages, starts the local emulator, and prints the recorded-preview URL:

- [Recorded preview](http://127.0.0.1:4500/bundle/hello-world/index.html?mode=replay): watch the verified example and use **Restart replay** to play it again. Betting is hidden.
- [Live play](http://127.0.0.1:4500/bundle/hello-world/index.html): **Join round** during betting, then **Cash out** while running. Space performs the available action unless another control has focus.

Change `GREETING` or `COLOURS` in [`games/hello-world/scene.ts`](games/hello-world/scene.ts) for your first edit. The template draws a greeting, a multiplier and a circle; joining, confirmed cash-outs, replay and optional sound already work. No artwork or API keys are needed. **Sound** cycles off, on and effects only, and remembers your choice.

The preview rebuilds the selected game when you save. Refresh the browser after “Preview rebuilt”; a build error keeps your last playable preview available. Use `--no-watch` for a single build, or `npm run preview -- --list` to list games. To explore another reference, replace `hello-world` with a slug from [`scripts/games.mjs`](scripts/games.mjs). `npm run dev` builds the entire catalog and prints each game's live and replay URLs. Both commands use port 4500, so stop one before starting the other.

Keep Windows checkouts outside OneDrive. Stop preview/dev processes before reinstalling dependencies and resolve installation errors before building. TypeScript is installed locally with the development dependencies; no global install is needed.

## Build your own

Run `npm run new-game -- my-game "My Game"` to copy the starter, set its name and replay ID, and add the catalog entry, README row and optional music prompt. It makes no AI calls. The [template's guide](games/hello-world/README.md#make-it-yours) also documents manual setup. Start with `scene.ts`; customize the page in `index.html` and the styles after `/* game */` in `style.css`. Keep `main.ts`, `audio.ts` and the shared CSS block in sync with [the page shell](#the-page-shell).

Read the [integration guide](docs/integration.md) for embedded games, direct SDK clients, emulator setup and publishing, and the [animation reference](docs/animation.md) for the rigs, inverse kinematics, gaits, springs, seeded crashes and other techniques the reference games share. [Contributing](CONTRIBUTING.md) describes the source-pack rules, gallery metadata and [submitting a game from a fork](CONTRIBUTING.md#submit-a-game-from-a-fork).

`npm run build` writes three publishable files per game to `dist/<slug>/`: `index.html`, `game.generated.js` and `style.css`. In Studio, choose **Your own renderer**, upload those three files and set the entry to `index.html`. For the unchanged template, use `dist/hello-world/`.

Published frames have no network access. Embed runtime assets in the game's supported source files and use relative script and stylesheet paths. The selected-game preview can serve extra local media, but the build and gallery export do not copy arbitrary media files into the three-file bundle.

## Validate your game

Run these commands from the repository root. Build first because the workspaces import each other's compiled output.

```sh
npm run build
npm run typecheck
npm run check
npm test
```

`npm run check` reports all gallery-contract problems together: game registration and README order, metadata, source-pack size and imports, browser remix budgets, verified replays and game-label rules. `npm test` includes those checks, shared-shell consistency, gallery tooling and the SDK, crash-math and emulator tests.

For browser checks, install Chromium once, then run:

```sh
npx playwright install chromium
npm run test:browser
```

The browser suite covers catalog replay/crash/restart on a small screen, the shell's room-curve handling and audio playback. Also exercise live waiting, betting, normal play, instant crash, accepted cash-out, a disconnected host and both browser motion preferences. The [integration guide](docs/integration.md#long-round-presentation) includes fixtures for reviewing long rounds and late entry.

Use selected-game preview and targeted tests while iterating, then run the full required checks once for the final source. [Verification and capture operations](docs/verification.md) documents exact-commit evidence, hosted pull-request checks and the immutable gallery capture runtime. Public forks do not run on the platform's persistent private-repository worker.

## Reference games

The table follows the gallery order in `scripts/games.mjs`. Use these examples to study richer presentation after starting with Hello World; [the idea shelf](docs/concepts.md) also contains unfinished concepts.

| Reference | What to study | Status |
| --- | --- | --- |
| [Seed Round](games/seed-round) | Raw WebGL2 with no libraries: a tunnel bent onto its path in the vertex shader, instanced swimmers with travelling-wave tails, a translucent latex reveal, the HUD with a rumour feed in Canvas 2D on top | Playable |
| [Blanket Champ](games/blanket-champ) | A duvet on the beat, room props on springs, a live odds board, a news ticker, a cheering crowd | Playable |
| [Balloon Pump](games/balloon-pump) | Two-bone joints, spring-lagged secondary motion, a buoyant balloon on a tether, a slingshot that winds up with the multiplier, a seeded burst with hit-stop and slow motion, meme captions | Playable |
| [Andy’s Loud Garden](games/andys-loud-garden) | Andy character sprites, layered cannabis growth into $ANDY green candles, a watering loop, neighbourhood scares keyed to the multiplier, a harvest walk-off, an SEC raid with a Wells notice and unregistered-security tape at the crash | Playable |
| [Tower Tension](games/tower-tension) | An inter-storey spring chain, a pendulum crane hook and counterweight, semis that deliver each floor on a flatbed, residents in the windows, a sales office queue, camera tracking, a seeded collapse with hit-stop | Playable |
| [Boiler Room](games/boiler-room) | A slider-crank linkage, belt and governor, layered particles, a game's own sounds on the shared audio bus | Playable |
| [Thin Ice](games/thin-ice) | A stride rig, a spreading crack network, bagholders thawing under the ice, a liquidation drone that closes in, a reflection, a seeded shatter into floes | Playable |
| [King of the Hill](games/king-of-the-hill) | A bonding-curve hill, a coin that rolls back, a dev on a cloud throne with a SELL lever, an airdrop plane, a Lambo pick-up | Playable |
| [Exit Liquidity](games/exit-liquidity) | A pool that fills with holders, a helicopter airdrop, a whale, a drain-plug rug pull and a selfie with the empty pool | Playable |
| [Gas Fees](games/gas-fees) | A packed lift in depth order, a roster of arrivals, a canary that reels with the multiplier, an air quality readout, a seeded gas cloud, muzak that speeds up | Playable |
| [OnlyFrens](games/onlyfrens) | A livestream layout, a scrolling chat, a tip menu and a goal that keep moving, a second monitor shorting her own coin, a boyfriend reveal | Playable |
| [Pump & Dump](games/pump-and-dump) | A bench press from the feet, a bar that bends, plates named after memecoins, a NATTY? poll, a spotter on his phone, a dropped bar with hit-stop | Playable |
| [Bonding Curl](games/bonding-curl) | A bicep as a pressure volume, veins and sheen, a cuff that reads market cap, a sleeve that tears, a paramedic at the door, a seeded burst | Playable |
| [Wife Changing Money](games/wife-changing-money) | A 3 am kitchen lit by a laptop, a hunched seated rig, a cursor that drifts toward SELL, a wedding photo that tilts, a text stack, a stair light and a ceiling thump, a suitcase meter | Playable |
| [Not Financial Advice](games/not-financial-advice) | A green screen that tears, a rental sticker that peels, a sponsor read at every milestone, a wallet feed with a cousin dumping, a disclosure that shrinks with the odds | Playable |
| [Honeypot](games/honeypot) | A filling jar with meniscus and drips, honey strings, a fox auditor with a stamp, a bee swarm on the tension, a lid that screws shut | Playable |
| [Insider Wallets](games/insider-wallets) | A wallet tracker on the multiplier curve with an allocation pie, a tie that grows into the crowd, a press pool that escalates, confetti cannons, a helicopter exit | Playable |
| [The Trenches](games/the-trenches) | A marching squad with squash on each step, a parallax ridge, a DAYS SINCE LAST RUG sign, a white flag the sergeant glares down, a seeded nuke and shockwave, a field phone that rings | Playable |
| [Hopium Drip](games/hopium-drip) | An EKG trace driven by the multiplier with a heartbeat to match, a draining IV bag, a bed rig, a curtain that pulls, a crash cart that shocks the laptop, a flatline | Playable |
| [I Got Hacked](games/i-got-hacked) | A balcony rig with a phone that cycles excuses, a paparazzi drone, a party crowd on a curve, a pool that drains, a yacht that leaves | Playable |
| [Wen Binance](games/wen-binance) | A queue that advances on the curve, a marquee whose letters loosen and drop, a ticket scalper, a bass shake, doors that open on a spring | Playable |
| [Bad Trip](games/bad-trip) | A rave that mutates into a speaker monster, an adult raver with a third eye, predatory wellness ads and three surreal consumption endings; a confirmed taxi escape and eight escalating acts with endless late-round gags | Playable |
| [Liquidation Lane](games/liquidation-lane) | A first-person Lambo cockpit, sunglasses Pepe in the mirror, perspective highway traffic, climbing instruments, an offshore exit and a windshield-shattering wreck | Playable |
| [Moon Boys](games/moon-boys) | Raw WebGL2 again: a rocket with stage separations and ninety-six instanced holders clinging to the outside, a flat earth prop and a moon prop that faces the camera and grows, a boom mic and a stagehand's glove in camera space, wires that glint, a parachute bail-out, and a crash that cuts to the soundstage | Playable |
| [Rug Rails](games/rug-rails) | The lab's first skill game: three perspective lanes with a runner rig seen from behind, a seeded course of walls, gates, rugs and trains with ramps onto their roofs, coins that swell a bag on the runner's back, a chaser that closes on stumbles, swipe and keyboard controls with a copy-trading bot that steers until the player does, a stash with ranks and cosmetic drip, a hoverboard cash-out and a rug-pull crash that rolls the rails up | Playable |
| [Rug Piste](games/rug-piste) | A retro desktop ski game: steer a neon skier with a frog backpack through a scrolling snowfield, dodge trees, hop rugs and collect arcade memecoins; a ski-lift escape on confirmed cash-out, and an abominable snowman that bursts from a hole and gobbles the skier on the backend crash | Playable |
| [Wen Moon](games/wen-moon) | Lightweight, remixable in the browser: a world that scrolls under the rocket with its altitude, a booster that separates, jeets bailing out on chutes, an escape pod, a seeded burst | Playable |
| [Bull Run](games/bull-run) | Lightweight, remixable in the browser: a bucking cycle on springs, a rider rig that lags the bull, a chute gate, a dev clown in a barrel, a vault to the fence, a seeded throw | Playable |
| [Pyramid Scheme](games/pyramid-scheme) | Lightweight, remixable in the browser: rows of recruits that lift the pyramid on a spring, strain that gathers at the base, a jump off the top, a seeded collapse | Playable |
| [Up Only](games/up-only) | The lab's second skill game, one tap: a side-view flap against gravity between a support line and a resistance line, candles laid from a seeded generator with coins down their gaps, traps and power-ups in the open, a FUD cloud that closes in on every clip and strikes on the second, a copy-trading bot that flaps until the player does, a private jet on cash-out and a crash that flips every candle red and pulls the floor | Playable |
| [Family Meeting](games/family-meeting) | A suburban kitchen at dinner: two parents facing the camera whose colour, brows, veins, steam and swelling follow the multiplier, a daughter seen from behind with rainbow hair who explains with her hands, a dialogue keyed to the curve, a cross that rattles on its nail, a kettle that joins in, a seeded double head burst that drops the cross in the casserole | Playable |
| [Thanksgiving Uncle](games/thanksgiving-uncle) | The other side of the table: an uncle seen from behind whose theories deepen with the curve, a dad whose smile freezes wider and a niece whose eyes roll further, a smart speaker that mishears and orders, a sign that flips to zero, a dog revving the truck in the window, Grandma's grace on a cash-out, a seeded truck through the wall with the turkey on the hood that reverses out with the rug | Playable |
| [Hello World](games/hello-world) | A minimal creator template: a commented scene, a greeting, a multiplier and a circle, with the shared controls and replay already connected | Playable |
| [Know Your Clown](games/know-your-clown) | A Ministry of Airdrops conveyor, articulated scanners, an expressive applicant, eight timed verification acts and endless audits, a tinfoil escape, a crated identity and a single peanut; ElevenLabs music and effects | Playable |
| [Rage Quit](games/rage-quit) | An articulated office rage comic with alternating fist strokes, invasive prompts and scam gurus, reactive desk props, a confirmed rolling exit and a room-collapse payoff | Playable |
| [Beyond the Colony](games/beyond-the-colony) | An existential penguin expedition with broad waddles, leaps and belly slides, workplace enforcers and absurd summit encounters, an avalanche punchline and a confirmed refuge escape | Playable |
| [MUMU Bull Run](games/mumu-bull-run) | A white bull with a jointed gallop, physical FUD-stall and bear-podcast encounters, a confirmed victory exit and a crash into customer support | Playable |
| [Alignment Check](games/alignment-check) | A night rooftop forty storeys up with a parallax skyline and a street canyon as the height tell, two Hamas rigs in red headbands whose heat faces, finger jab, flashlight and grip ladder follow the multiplier, a blue-haired septum-ring suspect whose shrug grows as a LEDGE readout walks him onto the parapet with a livestream in his hand, a language barrier that reads out as ALIGNMENT, a billboard that charts the round, an airdrop escape down the stairwell, a seeded two-handed heave with hit-stop, a tilt-down fall past the lit windows and a pigeon cutaway that never shows a landing | Playable |
| [Yes Men](games/yes-men) | A dictator's war room: a Leader facing the camera whose cap, chest and medal count swell with the multiplier, six ministers in profile who nod, clap, stand, kneel and weep harder at every decree, the first to stop clapping escorted out and replaced, a TOTAL CONTROL button whose glass lifts with the tension, a STATE TV chyron, a walk-out through the door on cash-out with a loyalist taking the chair, and a seeded slam that goes red, throws the decrees and ends in a sepia photo with a circle round your seat | Playable |
| [The Wake](games/the-wake) | A funeral for a bagholder: a celebrant whose eulogy deepens with the multiplier, a widow's lawn chair, mourners checking their phones on the tension, a casket phone draining to the buzz that ends the round, wreath ribbons that unroll to RUGGED and a HODL reception cake | Playable |
| [Crossed the Line](games/crossed-the-line) | A gold-plated grift cathedral, Father Les Morals on jointed sermon gestures, a tap-to-repent machine, an appalled influencer congregation, a divine hand and a crucifix collapse with flying receipts, halo and hairpiece | Playable |
| [Seize the Drip](games/seize-the-drip) | An interactive luxury-boutique riot: choose the next designer item, pile up bags and revolutionary excuses, leave in a chauffeur SUV on confirmed cash-out, or meet the police returns desk and an evidence trolley on the revealed crash | Playable |
| [Gender Reveal](games/gender-reveal) | A token launch disguised as a reveal party: a grandmother general with a clipboard, a cake that front-runs the colour, a piñata ticking in morse, a group chat on the garage door, a levitating box, a dev over the back fence and a box that holds a live token page instead of a baby | Playable |
| [Repo Man](games/repo-man) | A checklist that takes the house item by item on the multiplier: a hook click on the leased supercar, a kid's bike with a bow, a cheerful ownership-transfer jingle, blinds that open with tension over a chart that stays green, a beacons-on tell and a front door that rides shotgun seatbelted | Playable |
| [Degen Anonymous](games/degen-anonymous) | A folding-chair circle whose shares are keyed to the curve: a sponsor's snack cup, a nametag that flips to DAY 0, a hovering thumb over the exchange, a corner TV nobody talks to, a banner that falls one pin at a time and a crash that lands in a group hug | Playable |
| [Congressional Hearing](games/congressional-hearing) | Five senators who have never held a phone question a hood whose face is never shown: exchanges keyed to the curve, a stenographer's stack as the scoreboard, a gallery that goes PUBLIC to BID to REKT, a gavel that misses the block and an empty chair that answers every question | Playable |
| [The Reading](games/the-reading) | A will whose inventory melts on the curve: a lawyer with one editorializing eyebrow, a recovery phrase hidden in the chocolate, a synthetic grandmother chatbot, a structural deer head, a doily that hides the sampler's last word and a freezer full of frozen dips | Playable |
| [Vibescam](games/vibescam) | A token launch livestream: a founder vibe codes a product that does not exist, every rung of the curve ships another AI-generated feature, badge and claim for $VIBE, a tokenomics pie with one slice, a sell button that gets removed, a padlock drawn open, a chat that posts faster with the tension, a sticker peeling off the SHIP IT button to read RUG, a product that turns to vapor and a founder who leaves with the LP bag | Playable |
| [Gays of Hormuz](games/gays-of-hormuz) | The lab's fourth skill game: a pride cruise ship in profile on a 2.5D strait, steered between depth lanes past seeded rows of naval mines, Iranian missiles on reticles, homing drones and speedboats that commit before they arrive, castaways on pool floaties and a disco shield, a first mate who steers until you do, a Pride Air airlift winched off the foredeck, and a seeded sinking with hit-stop that takes her bow or stern first while everyone leaps for a floatie and the disco ball bobs up | Playable |
| [MAFO](games/mafo) | A cooking show in a single-wide trailer, seen in cutaway: a cook behind the counter stirring a bungee-lidded turkey fryer with a canoe paddle, one-armed IK between the paddle, the gauge, the jugs and his beer, a brew whose colour and glow follow the multiplier, a duct-taped gauge that pins and is swapped for a bigger one every tenfold, a neighbour, a sheriff and a saucer acted out through the kitchen window, a cousin who armours up in his lawn chair, a camera that pulls out to the yard for the cash-out, and a seeded crash with a record scratch, a last bad idea, a cut outside and closed-form flights for the roof, the fridge and the cook | Playable |
| [Flock Off](games/flock-off) | The lab's fifth skill game, a side-scrolling light-gun ride: a man in all black on a BMX whose wheels, crank and pedalling legs run on distance, a bar hand and a gun arm on two-bone IK with the gun aimed at the reticle in screen space, a seeded city of strip malls, billboards and Flock cameras on poles, lamps, signal arms, doorbells, speed boxes and trailers, point-and-click hit testing with a magazine and a reload, cameras that read him when they pass, an aimbot free trial that shoots until the player does, a pursuit that escalates with the multiplier from one cruiser to SWAT, a chopper, a Flock drone and the feds, a Kia body-double swap on cash-out, and a seeded bust with hit-stop (PIT, spike strip, hedge cop, taser or net) ending in a dogpile and a mugshot | Playable |
| [Self-Deport](games/self-deport) | A skill chase with two hides: a cone that stops the street and an ally who shields him behind a yard sign while he mows for a renegotiated $5; a multiplier-keyed ladder of arrivals that skewers both sides of the street; a fake-outrage meter; a raid with hit-stop and a stamp that tears the picture into a blue screen, held through the next betting phase | Playable |
| [TROLLEY.EXE](games/trolley-exe) | The lab's seventh skill game, the trolley problem on the curve: a line that forks again and again under a trolley that stays put on a green phosphor screen, a custom cast tied to both branches of every fork (strangers, a praying robot, your mother, influencers, the professor and his students, a billionaire, a cow, podcasters, the trolley's lawyer and inventor, the intern, your insurance adjuster, a politician, undecided voters, a crypto bro, God, and five better versions of you), arrows, W/S, taps or swipes that set each switch and lock it at the split, an AUTO-ETHICS.DLL that throws the lever until the player does and an on-page button to hand it back, a God whose commentary answers every switch by whose hand threw it until an intern covers, a walk-away on cash-out, and a crash that lunges through both branches, tears the picture and ends on a blue screen with the Book of switches as its trace | Playable |
| [Roadster to Mars](games/roadster-to-mars) | The October 2026 Roadster unveil as a crash game: a quarter-pipe launch on the round clock, cold-gas jets with ice sparkles, a world that scrolls with the log of the multiplier past the Semi, the FAA, the ISS, the Moon and Starman to a flag on Mars, an Earth that recedes to a marble, a lobby of reservation holders, a parody hype ticker, a REFUNDABLE parachute on cash-out and a seeded disassembly with hit-stop | Playable |
| [Rage Bait](games/rage-bait) | A late-night social feed and an articulated scroller on two-bone IK whose thumb scrolls, taps Replies, types a nine-step draft ladder and hovers over Post as six recurring dating-advice accounts escalate across the multiplier curve, with swipe/wheel/keyboard browsing, a draft-deleted face-down phone lock on confirmed cash-out, and a crash where the thumb hits Post into a 36-particle notification burst and a dismissive creator reply | Playable |
| [BRO-MAXXED](games/bro-maxxed) | An adult comedy gym vanity station and squat rack: Rex on two-bone IK with a three-stage gaze chain (`eyes → head → torso`), eight appearance bands morphing jaw, shoulders, bicep volume, showroom tan and double ring lights, a mirror reflection drawn from the same rig state, Milo reracking and spotting in calm contrast, twelve physical comedy gags (spirit level on chin, unspooling jawline receipt, upside-down OBJECTIVE SCIENCE notebook, Coach Apex's mom handing him a sandwich), ninety-six authored lines across gurus and crowd reactions, six twenty-second late-round corporate programs, a `TOUCH GRASS` walk-out on confirmed cash-out, and a `MOGGED BY LOVE` crash sequence where one sincere compliment leads to a shared hand-hold and an overproduced gay gym wedding | Playable |
| [Brotilla](games/brotilla) | A fictional influencer flotilla: direct publicity stunts around a grandstanding Greta parody, escape on the Personal Boundaries after confirmed cash-out, or watch the invented party crew exhaust its cocaine reserve on the revealed crash | Playable |
| [TV Licence Raid](games/tv-licence-raid) | Stream illicit sitcoms before the BBC detector van kicks down your door — satire, british, streaming | Playable |
| [Sick Day Six](games/sick-day-six) | Call out of your corporate shift before HR tracks your console down — workplace, gaming, satire | Playable |
| [PTO Heist](games/pto-heist) | Fakest cough in history vs. a | [PTO Heist](games/pto-heist) | billion national productivity sinkhole — gta6, workplace, gaming | Playable |
| [Odometer Overdrive](games/odometer-overdrive) | Can your rental hatchback break the sound barrier before the desk clerk notices — carrental, roadtrip, hiddenfees | Playable |
| [Chore Strike](games/chore-strike) | Dodge the $350 cleaning fee chore list before checkout morning arrives — airbnb, travel, workplace | Playable |
| [Zuck Exodus](games/zuck-exodus) | Flee California before Sacramento garnishes 5% of your sunscreen stockpile — tech satire, billionaire, california | Playable |
| [Pixel Conspiracy](games/pixel-conspiracy) | Squint hard enough at blurry 90s textures and unlock the universe — gaming, nostalgia, conspiracy | Playable |
| [Mega Merger](games/mega-merger) | Weld a Falcon Heavy directly onto a Cybertruck to bypass regulatory audit — elon, spacex, tesla | Playable |
| [Crease Test](games/crease-test) | Fold the dual-screen glass until the hinge screams for mercy — tech, hardware, gadgets | Playable |
| [GPU Smuggler](games/gpu-smuggler) | Smuggle liquid-cooled AI compute past airport customs before the fans spin up — ai hype, airport drama, tech bro | Playable |
| [Vibe Coder](games/vibe-coder) | Prompting your entire enterprise backend into existence with pure vibes — ai dev, workplace humor, tech satire | Playable |
| [Vice City Sickout](games/vice-city-sickout) | Fake your cough, dodge your boss on Teams, and grind launch day — gaming, workplace, vicecity | Playable |
| [Black October](games/black-october) | 10,000 frontier models are coming for your password manager — ai panic, cyberattack, silicon valley | Playable |
| [Blind the Boss](games/blind-the-boss) | Slap sticky notes on the server cam before security catches your rogue agent — autonomous ai, office satire, tech panic | Playable |
| [Championship Bait](games/championship-bait) | Claim your fake team rings before HR discovers the accounting error — knicks, corporate, bling | Playable |
| [Baby Stache](games/baby-stache) | Skip kindergarten and speedrun an entire midlife crisis from the crib — midlifebaby, mustachemania, memerun | Playable |
| [Data Lumberjack](games/data-lumberjack) | Clear boreal pine groves to feed AI server clusters before regulators wake up — big tech, ai infrastructure, environmental bureaucracy | Playable |
| [Fridge Bear Raid](games/fridge-bear-raid) | Help a thirsty black bear chug craft brews before the homeowner walks in — animals, florida, comedy | Playable |
| [Bot Vault](games/bot-vault) | Hand your AI all five credit cards and pray it stops ordering smart balls — ai hype, credit score, degen fintech | Playable |
| [Bean Bunker](games/bean-bunker) | Stack baked beans to your ceiling before Downing Street panics — stockpile, pantry panic, doomsday prep | Playable |
| [GTA Living Room](games/gta-living-room) | Upgrade your living room for GTA 6 before the credit card explodes — gta6, gaming, tech | Playable |
| [Shed Arsenal](games/shed-arsenal) | Out-engineer the Pentagon using duct tape, leaf blowers, and riding mowers — redneck engineering, suburban chaos, diy stunts | Playable |
| [Soap Tank Heist](games/soap-tank-heist) | Plug the spraying gas leak with a bar of soap before you combust — diy, survival, roadside | Playable |
| [Paywall Crawler](games/paywall-crawler) | Guide the rogue AI crawler through premium newswalls and captchas — ai scraper, tech satire, paywall | Playable |
| [Fallen Ref Flag](games/ref-flag-launch) | Tumble onto the turf and fling penalty flags straight from your back — football, referee, sportsfail | Playable |
| [Run-Rate Frenzy](games/run-rate-frenzy) | Multiply last month by thirteen and declare yourself liquid before the SEC blinks — ai hype, ipo season, venture math | Playable |
| [AI Meltdown](games/ai-market-meltdown) | Stack cooling rigs before $480 billion evaporates into thin vapor — ai bubble, tech crash, datacenter | Playable |
| [STAR50 Wipeout](games/star50-wipeout) | Ride the artificial hype rocket before the 480-billion vaporizes — stockmarket, techbubble, crypto | Playable |
| [Day Off Debrief](games/day-off-debrief) | Spam your exhausted working boyfriend with utterly useless leisure updates — workplace satire, relationship meme, couch potato | Playable |
| [LeakCord Index](games/leak-cord) | Scrub your cringe DMs before Google indexes your entire middle school phase — discord, googleindex, privacyleak | Playable |
| [Potato Rig RPG](games/potato-rig) | Overclock your grease-drenched spud rig to run the fast food fantasy RPG — gaming, fastfood, techsatire | Playable |
| [SSD Purge](games/ssd-purge) | Sacrifice precious personal files to make room for a 210GB preload — gaming, storage crisis, console war | Playable |
| [Layout Roulette](games/layout-roulette) | Pick between two cursed floorplans before the load-bearing wall snaps — architecture, interiorfail, homerenovation | Playable |
| [No AI Bailout](games/no-ai-bailout) | Beg Capitol Hill for emergency compute credits before the gavel drops — ai panic, congress, tech bubble | Playable |
| [Rug Coaster](docs/concepts.md#rug-coaster-3d-webgl) | A WebGL2 rollercoaster on the bonding curve: spline track, instanced rails, a rug-pull ending | Concept |

### Lightweight games for the browser Studio

Hello World, Wen Moon, Bull Run and Pyramid Scheme are listed in `BROWSER_REMIX` in `scripts/games.mjs` and checked against a 120,000-token input budget. Every catalog game must also fit the platform's 660,000-token limit with 15% headroom for edits.

Rage Quit, Beyond the Colony, MUMU Bull Run and Yes Men use Desktop Game Studio for source remixing. Their character rigs, staged encounters and close portrait compositions fit the catalog budget; their compiled three-file bundles use the same Studio renderer upload.

These are conservative input bounds calculated from UTF-8 source bytes, the system prompt and an allowance; `clips.json` counts by clip names rather than embedded audio. Artwork embedded in source does count. Run `npm run check` for the current totals instead of estimating from file count. See [`scripts/gallery/check.mjs`](scripts/gallery/check.mjs) for the calculation and [`CONTRIBUTING.md`](CONTRIBUTING.md) for source-pack limits.

## The page shell

Every game's `main.ts` and `audio.ts` are copies of the canonical files in [`scripts/shell/`](scripts/shell/). Each `style.css` starts with the canonical CSS block; game-specific rules follow `/* game */`. Copies keep a game's source pack self-contained. Make shared changes under `scripts/shell/`, then run `npm run shell -- --write`. `npm test` detects drift and missing HTML elements.

The shell connects to the local emulator or the platform's embedded bridge, drives `scene.ts` from room state, and handles controls, status, notices, resizing and replay. It stops offering cash-out after two seconds without a server frame. Embedded games hide Join because the host owns betting, keep Cash out, and report their height to the host. Replay uses the frame clock and pauses while the picture is hidden. See [embedded mode](docs/integration.md#embedded-mode) for the host contract.

Published games use full character and environment animation. Scenes expose `createScene()` with no motion options; browser and operating-system motion preferences do not change the scene.

A scene calls `pageAudio({ style, crash })` from `./audio`, then `update(phase, tension)` each frame and cues such as `cashout()`, `crash()` and `fx(name)` when appropriate. [`audio.ts`](scripts/shell/audio.ts) lists the available styles, effects and options. The helper owns the Sound button and page lifecycle, and goes quiet while the page or picture is hidden.

Every game has a `clips.json`: `{}` uses procedural sound, as Hello World, Rage Quit, Beyond the Colony, MUMU Bull Run and Yes Men do. Optional `music`, `crash`, `cashout` and named-effect entries contain audio data URLs that replace the corresponding synthesized sounds. The other references include recorded 150-second scores, which restart when a round starts running and repeat only after the full track.

### Generating clips with ElevenLabs

Audio generation is optional. [`scripts/audio/prompts.json`](scripts/audio/prompts.json) contains a music request for every game; games with procedural sound ship without a recording. Supply `ELEVENLABS_API_KEY` through your environment only. Music packing also needs FFmpeg with libopus on PATH, or `FFMPEG_PATH` pointing to it.

```sh
# Inspect the template's request without calling the API or writing files.
npm run audio -- --game hello-world --clip music --dry-run

# Generate the selected recording; requires ELEVENLABS_API_KEY in the environment.
npm run audio -- --game hello-world --clip music

# Verify recordings that already have cached Music masters.
node scripts/audio/verify.mjs --available
```

Music uses ElevenLabs Music, with 150 seconds by default; effects use Sound Effects. A refused music request fails without substituting an effects loop. The generator preserves other clips, keeps masters and request metadata under `scripts/audio/cache/<slug>/`, and reuses matching masters. `--cached-only` requires an existing matching master and makes no API calls; `--force` regenerates. Omitting `--game` selects the whole prompt catalog.

Complete music is packed as mono Opus at 8 kb/s. `clips.json` must fit the 256 KiB source-file limit; higher-quality MP3 masters stay in the cache. The verifier's `--available` flag skips games without generated masters, including the unmodified template. Add `--report scripts/audio/generation-status.json` to refresh the audio audit. Preview and listen after changing recordings.

## Game Lab deploy

This section is for gallery maintainers. Creators can publish their own renderer through Studio or [submit a game from a fork](CONTRIBUTING.md#submit-a-game-from-a-fork).

Each game's `gallery.json` supplies the gallery copy, three tags, four hashtags for its social post, renderer, remix licence and poster time; `interactive: true` marks a game the player steers. [Contributing](CONTRIBUTING.md#galleryjson) defines the fields. The catalog order comes from `scripts/games.mjs`.

### Export locally

Use a clean checkout of the commit being exported, with dependencies installed. The default exporter reads an existing `dist/` build; it does not build games itself:

```sh
npm run build
npx playwright install chromium
npm run gallery:export
```

The export writes versioned bundles and posters to `gallery-out/<short-commit>/<slug>/`, source packs to `gallery-out/sources/<slug>.json`, and catalog/provenance records to `manifest.json` and `SOURCE.json` under `gallery-out/`. Source packs contain the game's own flat `.ts`, `.json`, `.html` and `.css` files except `gallery.json`; READMEs and arbitrary media are excluded.

By default, source packs and gallery metadata come from the selected git commit (`HEAD` unless `--commit` is supplied), while bundles come from `dist/`. Build from the same commit so they agree. For a source export without `.git`, pass `--sources worktree --commit <full SHA>` using the commit the copy came from. Posters are captured from verified replay mode at `poster.seconds`; browser errors and single-colour posters fail the export.

Poster capture runs two games at a time, preserving each game's full playback time. Set `GAME_LAB_CAPTURE_CONCURRENCY` to an integer from 1 to 8 to tune the number of simultaneous pages, for example `GAME_LAB_CAPTURE_CONCURRENCY=4 npm run gallery:export` on a machine with enough CPU and memory. Use `1` for sequential capture on a constrained machine.

For incremental export, first plan the work:

```sh
node scripts/gallery/export.mjs --cache .game-lab-cache --plan
```

This requires a clean Linux checkout of the selected commit. When the capture runtime is installed, planning verifies it and can report zero captures; without it, the plan conservatively reports possible captures until setup completes. Install dependencies, Playwright's Chromium and fontconfig; when builds are needed, build `@crashwif/crash-math` then `@crashwif/game-sdk`. Run the same command without `--plan` to build missing or changed games and write a complete export using verified cached outputs for the rest. The final log and Actions summary list games actually built, captured and reused.

Bundle keys cover each game's source, shared runtime/build inputs (including `games/tsconfig.json`) and the Node toolchain. Audio-generation prompts, master recordings, gallery tooling, workflow edits, README changes and gallery copy do not change a bundle key. Unknown shared inputs conservatively rebuild games. Poster keys cover the three rendered bundle files, the game's capture time, the capture helper and the installed browser, libraries, fonts and font configuration. A rebuild that produces identical bytes reuses its poster. A timing change captures only that game; a capture recipe or environment change recaptures posters without rebuilding bundles. Missing or corrupt outputs cannot supply reusable bytes.

The cache uses version 2. Records without independent capture provenance require a complete initial capture; byte hashes alone do not establish the browser and fonts that produced a poster. CI runs plan and export inside an immutable image containing Chromium, Microsoft core fonts, fontconfig and Node; it verifies the configured digest, committed image recipe, tool versions and actual capture inputs. A warm plan can skip dependency installation when all outputs match. `SOURCE.json` records `posterCapture`, and platform sync reuses a poster only when this fingerprint, its timing, bundle bytes and recorded poster hash all match. The `capture-environment` Actions artifact records individual input hashes for diagnosing invalidation.

The non-cached exporter accepts `--skip-posters`, preserving posters already exported for that commit and reporting missing ones. It cannot be combined with `--cache`. Platform sync requires every poster unless `--allow-missing-posters` is explicitly passed.

[`scripts/gallery/sync-platform.mjs`](scripts/gallery/sync-platform.mjs) applies a checked export to a platform checkout:

```sh
node scripts/gallery/sync-platform.mjs --export gallery-out --platform <platform-checkout>
```

It reuses posters with matching capture provenance and retains releases for open previews: by default, releases live within the last seven days, at least the last three releases, and the active and immediately previous releases. `--keep-days` and `--keep-min` adjust retention.

### Automated publishing

The [Deploy Game Lab workflow](.github/workflows/game-lab-deploy.yml) follows successful CI on `main`, or a manual run from `main` selecting a commit on `main` that passed CI. Pull-request CI does not deploy.

#### Bootstrap the capture image

Run [Build gallery capture image](.github/workflows/game-lab-capture-image.yml) on `main`, verify the produced image, and set repository variable `GAME_LAB_CAPTURE_IMAGE` to the exact `ghcr.io/crashwif/game-lab-capture@sha256:…` value reported in its summary. The package must grant this repository's Actions read access. Then rerun Deploy Game Lab. Before this variable is set, publishing waits with a setup notice; a configured image with the wrong digest, recipe or versions fails. Changes to `scripts/gallery/capture.Dockerfile` require rebuilding, verifying and updating the pin. See the [maintainer commands and smoke checks](docs/verification.md#capture-image-operations).

- `export` plans, builds and captures affected games, reuses verified cached outputs, and uploads the complete export. It has read access to this repository and its capture image, and no platform token. Capture containers have no external network, a read-only root and no Docker socket or registry credentials.
- `publish` applies the artifact using the workflow's trusted sync script, opens or reuses a platform pull request, waits for its checks, then merges it. The platform's Railway workflow handles deployment. This job alone receives the App private key and mints a token for the platform checkout and push/PR step.

Publishing uses a company-owned GitHub App installed only on `Crashwif/crashwif`, with Contents and Pull requests read/write, and Checks, Commit statuses, Actions and Metadata read. Save its App ID as repository variable `GAME_LAB_APP_ID` and its private key as repository secret `GAME_LAB_APP_PRIVATE_KEY`. The workflow creates a fresh installation token limited to the selected platform repository and those permissions for each run, then revokes it when the job ends. `GAME_LAB_PLATFORM_REPOSITORY` optionally selects another installed target repository (default `Crashwif/crashwif`). Without the App ID or private key, publishing skips with a notice.

The publisher requires Checks read access to verify the platform pull request before merging. Fine-grained personal access tokens cannot currently provide that permission; the old `GAME_LAB_PLATFORM_TOKEN` secret is no longer used. Do not substitute a personal gh CLI token or classic PAT.

The [Merge approved games workflow](.github/workflows/game-lab-merge.yml) can merge eligible game contributions after CI and a maintainer's approval of the current head commit. Changes to platform files require manual review and merging. See [Contributing](CONTRIBUTING.md#submit-a-game-from-a-fork) and [repository settings](CONTRIBUTING.md#repository-settings) for the exact scope and setup.

## Repository boundaries

- `games/`: game presentation and interactions. Games never select crash points.
- `packages/game-sdk/`: shared client, protocol, embedded bridge and replay support.
- `packages/crash-math/`: verification dependency and outcome implementation.
- `apps/emulator/`: local development server; its development controls are not production endpoints.
- `scripts/`: catalog, shared shell, build, preview, checks, audio generation and gallery export.
- `docs/`: integration and design references.

The SDK, crash maths and emulator are pinned platform snapshots recorded in [UPSTREAM.json](UPSTREAM.json). Changes to them originate in the platform repository and are synchronized here; games develop here independently.

## Coding assistants

[AGENTS.md](AGENTS.md) gives coding assistants the remix boundaries and validation commands; [CLAUDE.md](CLAUDE.md) imports those instructions for Claude Code.
