# Idea shelf

These are design concepts, not playable releases. Each can use the same round states and player intents as Balloon Pump. Visual tension follows the displayed multiplier; a character's movement never changes the committed crash point.

## Tower Tension

Now a playable reference: [games/tower-tension](../games/tower-tension). The concept as shelved:

A crane drops successive floors onto a growing tower. Camera movement keeps the top visible. Small springs between floors produce increasing sway. The exit action sends a cashout intent; on an accepted exit, a worker rides an elevator to safety. At the crash event, joints release and the tower collapses. Explore transforms, camera tracking and a deterministic presentation-only debris animation.

## Boiler Room

A mechanic works a locomotive's furnace. Pistons reciprocate, belts accelerate and a pressure needle climbs. Exiting asks the server to cash out and, once accepted, the mechanic ducks behind a shield. At the crash event a valve blows and steam fills the scene. Explore linked mechanisms, layered particles and sound driven by the displayed multiplier.

## Thin Ice

A skater crosses a frozen lake. Reflections glide below the character and fractures spread outward as tension rises. A successful exit takes the skater toward shore. At the crash event the surface breaks into floating pieces. Explore skeletal motion, surface shaders and transitions between intact and fractured geometry.

## Designing another game

Choose a visible action, a clear build-up of tension, an exit animation after server acceptance, and a crash animation. Keep the player able to read the multiplier and exit control. Consider waiting, short rounds, reconnects, reduced motion, mobile screens and disposal of animation resources. Use generated art as transparent layers or individual rig parts rather than flattening an animated character into one image.
