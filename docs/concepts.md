# Idea shelf

These are design concepts, not playable releases. Each can use the same round states and player intents as Balloon Pump. Visual tension follows the displayed multiplier; a character's movement never changes the committed crash point.

## Tower Tension

Now a playable reference: [games/tower-tension](../games/tower-tension). The concept as shelved:

A crane drops successive floors onto a growing tower. Camera movement keeps the top visible. Small springs between floors produce increasing sway. The exit action sends a cashout intent; on an accepted exit, a worker rides an elevator to safety. At the crash event, joints release and the tower collapses. Explore transforms, camera tracking and a deterministic presentation-only debris animation.

## Boiler Room

Now a playable reference: [games/boiler-room](../games/boiler-room). The concept as shelved:

A mechanic works a locomotive's furnace. Pistons reciprocate, belts accelerate and a pressure needle climbs. Exiting asks the server to cash out and, once accepted, the mechanic ducks behind a shield. At the crash event a valve blows and steam fills the scene. Explore linked mechanisms, layered particles and sound driven by the displayed multiplier.

## Thin Ice

Now a playable reference: [games/thin-ice](../games/thin-ice). The concept as shelved:

A skater crosses a frozen lake. Reflections glide below the character and fractures spread outward as tension rises. A successful exit takes the skater toward shore. At the crash event the surface breaks into floating pieces. Explore skeletal motion, surface shaders and transitions between intact and fractured geometry.

## King of the Hill

Now a playable reference: [games/king-of-the-hill](../games/king-of-the-hill). The concept as shelved:

Sisyphus, but the boulder is your token. A degen ape pushes a giant coin stamped with the room's ticker up a hill whose profile is the bonding curve itself, so the slope steepens exactly as the market cap grows. The coin swells with the displayed multiplier, little holders cling to its rim, and jeets leap off at every milestone. King of the Hill puts a crown on the coin; graduation puts a cap and gown on it with confetti; past that the hill leaves the atmosphere and the moon fills the sky. Tension: the ape's legs shake, the coin rolls back an inch on every bump, pebbles slide past, the sky drains of air. An accepted exit is the Lambo: a road appears, a lime Lamborghini pulls up, the ape hops in and it drives off with the SECURED badge. At the crash the dev sells: the coin slips, rolls back down over everyone still pushing, flattens the ape into a Wojak pancake and shatters at the bottom into dust. Captions: PUSH IT, NUMBER GO UP, KING OF THE HILL, WEN GRADUATION, GRADUATED, TO THE MOON, THIS IS FINE; crash: DEV SOLD, JEETED, RUGGED. Explore: a slope generated from the curve formula, rolling contact with wobble, a crowd of clingers, vehicle pick-up choreography.

## Exit Liquidity

Now a playable reference: [games/exit-liquidity](../games/exit-liquidity). The concept as shelved:

The liquidity pool is an actual pool. A backyard party at golden hour: a DJ Wojak, an LP sign, a bar, and the dev lounging by the drain with his sunglasses on and the plug chain wrapped round his wrist. Your degen floats on an inflatable flamingo. As the multiplier rises the green water rises with it, more degens cannonball in, the holder count on the scoreboard ticks up and the ladder queue grows. Tension: the water sloshes higher, turns murkier, the dev's grin widens, the chain goes taut, and at big multipliers a whale surfaces and lifts the whole crowd on its back. An accepted exit is climbing the ladder: a towel, a cocktail, deal-with-it shades, and a lounger to watch from. At the crash the dev yanks the plug: a whirlpool spins the floats, sucks everyone left toward the drain and leaves an empty pool with one sad Wojak in a puddle while the dev strolls off with a bag. Captions: APE IN, NUMBER GO UP, HODL, WAGMI, DIAMOND HANDS, WHALE ALERT, THIS IS FINE; crash: RUG PULL, EXIT LIQUIDITY, NGMI. Explore: a water surface with level and slosh, a particle vortex for the drain, buoyant crowd agents, colour grading of the water.

## Blanket Champ

Now a playable reference: [games/blanket-champ](../games/blanket-champ). The site is age-gated as a whole, so the game carries no rating of its own. The concept as shelved:

A stamina crash game played entirely under a duvet. A couple is in bed, fully covered; the only things visible are the blanket lump, two pairs of feet at the foot of the bed and a hand gripping the headboard. Behind the bed a bleacher of Wojak fans with foam fingers and signs (DON'T PULL OUT EARLY, DIAMOND HANDS, HODL) and a two-man commentary booth. The lump bobs at a tempo that rises with the multiplier, the readout doubles as minutes lasted, and the crowd noise builds. Tension: the headboard knocks faster, the lamp wobbles, the glass of water walks off the nightstand, the cat leaves, the neighbours bang on the wall, the champ's knuckles go white and the bed legs start to buckle; milestones bring the wave, a sports-desk caption (HISTORIC PACE), and past 10x the fire department at the window. An accepted exit is your supporter cashing with the bookie Wojak and strutting out with a SECURED foam finger and shades. At the crash the lump goes still: a cartoon puff, an arm flops out with a shaky thumbs-up, confetti for a legendary number, and the fans still holding tickets put their heads in their hands. Captions: GM CHAMP, NUMBER GO UP, HODL, HE'S GOT LEGS, DIAMOND HANDS, LEGENDARY, THIS IS FINE; crash: GG, FINISHED EARLY, REKT. Content rules: consenting adults, nothing ever shown under the blanket, innuendo only. Explore: procedural cloth for the blanket, secondary motion on every prop in the room, crowd-reaction layers, a commentary caption system.

## Rug Coaster (3D, WebGL)

A rollercoaster whose lift hill is the bonding curve, rendered in WebGL2 with no libraries. The car clanks up the chain lift with the displayed multiplier as its height: the rider, a low-poly Wojak, grips the bar, the chain ticks, the supports creak, and the track ahead keeps unrolling out of the fog toward a moon that grows as the car climbs. Tension: the rails flex and rattle, bolts pop off the ties and spin away, the fog thins into stars, the camera shake builds. An accepted exit slides a side platform in beside the car; the rider hops onto it, waves with shades on and shrinks into the distance as the car carries on without him. At the crash the rug is pulled: the track ahead rolls up like a carpet from the far end, the car launches off the last tie, tumbles with the rider screaming, and the camera follows it down into the fog before cutting to the rider on the platform (CALLED IT) or to the wreck (REKT). Captions share the ladder of the other games.

Technical plan: a raw WebGL2 renderer in about seven hundred lines, no dependencies, everything procedural so the bundle stays three files. Geometry: the track is a Catmull-Rom spline sampled from the bonding-curve height function, with rails swept along it as strips, ties and supports as instanced boxes, the car and rider as a handful of boxes and cylinders with per-vertex colour. Shading: one Blinn-Phong program with a directional light, hemispheric ambient, distance fog and a sky gradient; a second small program for instanced particle quads (sparks, fog wisps, debris). Camera: a rig behind the car with a spring-lagged look-at and roll from the track banking, the same closed-form springs as the 2D games. Deterministic debris seeded from the crash point so a replay tumbles identically. Budget: under twenty thousand triangles, one draw call per material, device pixel ratio capped at 1.5, `prefers-reduced-motion` removes the shake and fog flicker. Fallback: when `getContext('webgl2')` fails, a Canvas 2D side-view chart of the same track plays the same beats so the round is never blank. Integration is unchanged: the same `SceneView` contract, `main.ts`, replay mode and HUD; the HUD stays a Canvas 2D overlay drawn over the WebGL canvas.

## Gas Fees

Now a playable reference: [games/gas-fees](../games/gas-fees). The concept as shelved:

A man in a suit holds one in inside a packed glass lift; the floor indicator is the multiplier. Every milestone the doors open and someone else squeezes in: a Chad, a grandma with a pug, a Shiba in the wif hat, a Karen, a bro filming vertical, a nun, a whale in a suit that shoves everyone toward the middle, a bride, a delivery guy with a stack of boxes, until the load plaque flashes red. Tension: his face goes pale to red to purple, his cheeks puff, his knees buckle, he trembles, a vein appears, the cable creaks, the light flickers, and past 5× a green haze gathers at the ankles while the pug sniffs first. An accepted exit is his floor: the doors open, he strides into the lobby, shades drop, the doors close on everyone else. The crash is the release: a green cloud fills the cabin, the glass fogs, the light dies, the cabin bounces on its cable, the pug faints, the wig lifts, the nun crosses herself, the whale blows, and everyone stares at him; if he already got off, the cabin is crop-dusted behind him. Captions: HOLD IT, CLENCH, NUMBER GO UP, HODL, DIAMOND CHEEKS, WHALE ALERT, SILENT BUT DEADLY, GAS GAS GAS, THIS IS FINE; crash: RIPPED, GAS LEAK, CROP DUSTED, HE WHO SMELT IT. Explore: a crowd packed into a fixed box in depth order, a gas volume that fills a cabin, a cable bounce, face state machines.

## OnlyFrens

Now a playable reference: [games/onlyfrens](../games/onlyfrens). Innuendo only, nothing is ever revealed but him. The concept as shelved:

A coin launched on a livestream. The queen sits in a hoodie and cat-ear headset under LED strips and a ring light; the chat column scrolls faster with the multiplier, tips light up, money bags stack on her desk, and a tip goal promises a reveal at a multiplier that moves up every time it is reached. Tension: the mods nod off, her eyes flick to the door behind her, the handle starts turning, a shadow gathers under it, the front row of simps waves roses and cards harder. An accepted exit is your simp closing the tab: UNSUBSCRIBED, shades, a walk out of frame to touch grass. The crash is the boyfriend reveal: the door opens, a gigachad walks through carrying the bag, the feed cuts to static and STREAM ENDED, the goal bar drains, the chat floods with RUGGED, the simps put their heads in their hands. Captions: GM QUEEN, SIMP HARDER, NUMBER GO UP, WEN REVEAL, HODL, DIAMOND HANDS, MODS ASLEEP, ONE MORE MILESTONE, IS THAT A DOOR, THIS IS FINE; crash: RUGGED, BOYFRIEND REVEAL, NGMI, TOUCHED GRASS. Explore: a scrolling message list, a goal ladder, a two-column layout with the HUD confined to the video.

## Pump & Dump

Now a playable reference: [games/pump-and-dump](../games/pump-and-dump). The concept as shelved:

A bench press at Degen Fitness seen from the feet. A shirtless, oiled, square-jawed lifter works reps whose cadence follows the multiplier; at each milestone an arm reaches in from the edge of the frame and slides another plate onto the bar. Tension: the bar bends and shakes, the arms tremble, the face reddens and grits, veins show, sweat flies, the spotter behind his head stays on his phone, and the crowd along the mirror films vertical and heckles (GYATT). An accepted exit racks the bar: a chalk cloud, the lifter sits up in shades and flexes for the phones, then the spotter takes the bench with nobody spotting him. The crash drops the bar on whoever is under it and sends the plates bouncing and rolling out of frame; the spotter, if he was still spotting, looks up too late. Captions: PUMP IT, ONE MORE REP, NUMBER GO UP, NO PAIN NO GAINZ, HODL, LIGHT WEIGHT BABY, DIAMOND HANDS, GYATT, THIS IS FINE; crash: DUMPED, REKT, SPOTTER SOLD, NO SPOTTER NGMI. Explore: a bar bent by its load, plates as bouncing bodies, a foreshortened lying rig with a face, a set shared with Bonding Curl.

## Bonding Curl

Now a playable reference: [games/bonding-curl](../games/bonding-curl). The concept as shelved:

Balloon Pump, but the balloon is his arm. Gigachad, the only grayscale thing in the gym, curls a dumbbell in profile; the bicep swells along the curve of the multiplier, puffs with every rep, goes veiny, then red, then shiny, tears its sleeve, and reads its own pressure on a cuff. His face never moves: the tension lives in the arm, the sweat, the cracking mirror and the crowd. Past 10× an arrow points at the legs he never trained. An accepted exit drops the weight, kisses the peak, drops the shades, and sends hearts up from the girls while the arm keeps growing. The crash is snap city: the bicep bursts into a seeded cloud of protein powder, the arm hangs like a noodle, the dumbbell sinks through the floor, the girls walk out, and one tear crosses the stone face. Captions: WE GO JIM, ONE MORE REP, NUMBER GO UP, HODL, SLEEVE BUSTED, SUNS OUT GUNS OUT, DIAMOND HANDS, PEAK IS IN, NEVER SKIP LEG DAY, THIS IS FINE; crash: SNAP CITY, POPPED, NOODLE ARM, NGMI, SOLD THE PEAK. Explore: a pressure volume with squash and stretch, vein splines, sleeve tearing, a burst that reuses the balloon's shred idea.

## Designing another game

Choose a visible action, a clear build-up of tension, an exit animation after server acceptance, and a crash animation. Keep the player able to read the multiplier and exit control. Consider waiting, short rounds, reconnects, reduced motion, mobile screens and disposal of animation resources. Use generated art as transparent layers or individual rig parts rather than flattening an animated character into one image.
