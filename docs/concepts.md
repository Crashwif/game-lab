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

## Designing another game

Choose a visible action, a clear build-up of tension, an exit animation after server acceptance, and a crash animation. Keep the player able to read the multiplier and exit control. Consider waiting, short rounds, reconnects, reduced motion, mobile screens and disposal of animation resources. Use generated art as transparent layers or individual rig parts rather than flattening an animated character into one image.
