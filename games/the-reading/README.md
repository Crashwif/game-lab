# The Reading

A wood-panelled study, four in the afternoon, rain on the window. A long mahogany table, a portrait of **Grandma** over the fireplace — knitted cardigan, reading glasses on a chain, holding a copy of the chart with one candle circled in red pen (the estate's only accurate prophecy). Her armchair by the fire, still warm, and a coffee table with her will in a brown envelope under a paperweight that reads **WHEN**. On the walls: the deer head **Gerald**, a framed sampler (**A PLACE FOR EVERYTHING**), and a hunting cabinet.

The relatives, around the table, all generic cartoons: **the son** (Dad, blazer, expectations), **the daughter** (Mom, cardigan, has prepared a eulogy she will not get to give), **the nephew** (in a crypto hoodie, late, was at the wake, is at the wrong table), **the twins** (sheepish), and **the notary's assistant** (neutral, has seen everything, face like a closed envelope). At the head of the table: **Peterson** the family lawyer — rumpled, bi-focaled, and the only person enjoying this.

The will is the game. The estate is a portfolio. Grandma did not own what the family thought she owned: she owned what the family bought.

The multiplier is the value of the estate, and every step up the curve melts one more item.

## Direction

The comedy is the collision of a death's solemn inventory with the market that grandma's portfolio turns out to have been. Every bequest is read like a valuation and grieved like a keepsake; by the end the family is crying over tokens and the lawyer is crying over the fee. Grandma is the best character in the game and never appears on screen: the portrait's eyes follow the reading, the sampler's missing word is the round's thesis, and every item she left is funnier than the last because she chose it while competent.

- Peterson reads from the will. He does not editorialize. He editorializes with one eyebrow.
- Dad and Mom grieve in real estate: every bequest is a room of the house.
- The nephew is the game's only critic of the estate, and he is right, and nobody listens to him.
- Gerald the deer head hangs over the whole thing. He has seen three readings. He is tired.

## Dialogue ladder

Keyed to the displayed multiplier. Each bequest is read from the will, a speech bubble and a cue, queued so a bubble stays up at least 2.6 seconds before the same speaker's next line replaces it. The caption is the last line read.

- **Betting:** Peterson unfolds the will: "Dearly — we are here for the reading of the last will and testament of the late Margaret Holdern, who we are told kept excellent records. Item one."
- **1.15×:** "Item one: to my son, the house. To my son's *debt*, the house is not actually available, as it is collateral. Moving on."
- **1.35×:** "Item two: to my daughter, my service for twelve. Twelve of what is not specified. She will know."
- **1.55×:** "Item three: to my grandson, my bags." (A silence.) Dad: "Her *what*?" Peterson, one eyebrow: "Bags. Spelled out in full. She was competent."
- **1.8×:** "The bags are held in a wallet whose recovery phrase is hidden where I always hid the good chocolate." The whole family turns to the kitchen.
- **2.1×:** "Item four: to the twins, my car. I say 'car'. It is a lease. The lease is in the wallet with the bags."
- **2.4×:** "Item five: the sampler completes. The missing word is 'dumping'." Mom's eulogy is quietly folded and put away.
- **2.8×:** "Item six: Gerald." (The deer head. A pause.) "Whoever keeps Gerald keeps the house's walls. Gerald is structural."
- **3.2×:** "Item seven: my synthetic grandmother — the one in the attic I had made in 2019 so I could attend two things at once. She goes to whoever is newest to the family. She is not a grandmother. She is a chatbot with my voice."
- **3.8×:** "Item eight: my timeshare, which is in three countries, none of which I visited, one of which does not exist."
- **4.5×:** "Item nine: the crypto hoodie my grandson leaves at my house. I am leaving it back to him, washed. It is worth more than the bags."
- **5.5×:** "Item ten: my subscription to the genealogy site, so the family can find out where the money came from. It came from the money."
- **7×:** "Item eleven: to the notary's assistant, my condolences, and a week of paid leave, effective the moment this document is read aloud."
- **9×:** "Item twelve: my subscription to the daily paper, to be delivered to the family, so that someone in this room knows what the market did without opening an app."
- **12×:** "Item thirteen: whatever is in the freezer. It is not meat. Do not open it. Do not *not* open it."
- **18×:** "Item fourteen: my recovery phrase, in case the chocolate has been found: it is not in the chocolate. Read item one again."
- **25×:** "Item fifteen, final: to the whole family, the chart. It is the only thing I ever actually owned, and now, so do you."

## Suspense layer

Tension is `1 − 1/x` on the displayed multiplier (a third at 1.5×, half at 2×, two thirds at 3×), so it builds through the 1×–3× window where most rounds end, with a slower log driver keeping long rounds changing. All suspense is keyed to the displayed multiplier and elapsed time, never to the outcome.

- **The portrait's eyes** follow the reading, and at every bequest they glance at the relative named. At high tension they glance at the frame's edge, where the chart will appear at the crash.
- **The sampler's missing word** is covered by a doily. The doily moves an inch with tension. Nobody touches it.
- **The nephew's chart** on his phone is the only market data on screen: it is the game's own tell, and it is green until the crash. The family does not look at it.
- **The freezer**, visible at the kitchen door's edge, hums. The hum rises with tension. Its light is on. Nobody has opened it.
- **The recovery phrase hunt** in the kitchen happens off-screen: drawers slam, and the slams keep time with the reading.
- **The fireplace** burns lower as the estate melts. At high tension the fire is out and the chair is cold.
- A quiet heartbeat under the rain quickens with tension until the player cashes out.

## Accepted cash-out

The shell confirms the exit; only a confirmed `cashoutX100` triggers this.

Your bequest: the player's seat at the table accepts item fourteen — the recovery phrase hunt — and the badge reads **ACCEPTED · NOT IN THE CHOCOLATE**. The player stands, is handed the will, and walks out with it: the only family member who has read the document.

If the chart keeps going without you, the caption keeps score: **THE ESTATE MELTS. THE READING CONTINUES.** The bequests continue without the player's seat, the family argues, the portrait keeps its counsel. A crash after a cash-out reads as dodged: **RUG DODGED — WILL UNDER ARM.**

## The crash

Keyed to `view.crashAge`, deterministic from the crash point so a replay melts identically.

1. The nephew's chart goes red in one frame. He looks up from it, the only person in the room who knows what happened, and he does not say anything. He is not asked.
2. Every kept item on the table — the service, the lease, the washed hoodie, the genealogy subscription — is, the lawyer reads from a filing he has been sitting on since the first bequest, **collateral**. Every bequest today has a lien. The family keeps nothing. The bank keeps everything.
3. The sampler's doily comes off on its own. The completed sentence reads **A PLACE FOR EVERYTHING, AND EVERYTHING IS COLLATERAL**.
4. Grandma's portrait's eyes do one thing they have not done all round: they close.
5. The freezer's door, unattended, swings open by itself. Inside: ice trays of frozen chart lines, red pen and all. She froze the dip. She was competent.
6. Peterson, fee schedule out, dries one tear with the will's envelope: the only family member who ends the round richer.
7. Gerald the deer head, structural, stays on the wall. The walls come off around him, piece by piece, leaving him standing in the rain on the last stud. He blinks once. He has seen this before.
8. The fire is out. The chair is cold. The rain stops. The room is dark. The will, on the table, is a receipt.

A short blink to black covers the study resetting for the next round. A crash after a cash-out is the same melt seen small from the hallway, will under arm.

## Caption ladder

- Running: GM FAMILY · ITEM THREE: THE BAGS · NUMBER GO UP · SHE WAS COMPETENT · DIAMOND ESTATE · READ ITEM ONE AGAIN · THIS IS FINE
- Cash-out: ACCEPTED · NOT IN THE CHOCOLATE · WILL UNDER ARM
- Crash: DEV SOLD · EVERYTHING IS COLLATERAL · SHE FROZE THE DIP · NGMI

## Sound

- `audio.ts`: the shared page audio (a copy of the shell's, never edited here). Rain, fire and a solo cello that opens up with the multiplier.
- Cues: Peterson's page turns (`paper`), the drawer slams in the kitchen (`thud`), the portrait's eyes as a single soft tone (`fx`), the freezer hum (`fx`), bequest stamps on milestones (`milestone`), the doily's move (nothing), and the crash: the filing's thud, the sampler's exposure, the fire's last pop, and one cello note held to silence.

## Lines not to cross

- Every relative, the lawyer, the assistant and the portrait are generic cartoons with no likeness to any real person. Margaret Holdern is fictional.
- Comedy only: no death is shown, no body, no funeral — the death is off-screen, recent, and the game begins after it. The grief is genuine and the family is not mocked for it; the portfolio is.
- The synthetic grandmother is a chatbot gag about 2019 tech, not a person, and is never mistaken for one by the game.
- Credits have no monetary value. Nothing in the game implies the player's own money is at stake, and the label names no opponent.

## Builder's notes

This skeleton copies the [Hello World](../hello-world) template verbatim: `main.ts`, `audio.ts` and the shared CSS block are unmodified shared-shell copies; `scene.ts` is the commented template with its circle and greeting, fully functional for every phase. The build, replay fixture (`replay.json`'s `gameId` names this slug) and recorded example are already wired.

To build the game on this skeleton, work in `scene.ts` against the `SceneView` contract documented in the template's [README](../hello-world/README.md#where-to-work): render `waiting`, `betting`, `running` and `crashed` from `view.phase`, use `view.currentX100` for the multiplier (150 means 1.50×), `view.elapsed` for running animation and `view.crashAge` for the ending. Pacing matters more than anything else: about half of all rounds end before 2× (9 seconds in) and two in three before 3×, so the early bequests arrive every few seconds through 3× and a slower `log10` driver keeps long rounds changing. Tension is presentation only — never derive it from the crash point. Every animation is a pure function of the view, so replays, seeks and late entries draw the same frame; cues fire on confirmed changes only, and a late entry shows the current state without replaying an old cash-out or crash. The crash keys off `view.crashAge`. Keep `main.ts`, `audio.ts` and the shared CSS block untouched; shared changes belong in [`scripts/shell/`](../../scripts/shell/).

Read [the animation reference](../../docs/animation.md) before adding or changing character animation: the portrait's eyes are a two-dot rig with a look-at target per bequest, the sampler's doily is a cloth sim on one pin, the family is a seated reaction crowd with per-member lean springs, and the walls coming off Gerald is a seeded panel removal. Check waiting, running, crash, accepted cash-out, replay and small-screen behavior when relevant, then run `npm run build`, `npm run typecheck`, `npm run check` and `npm test`.
