# Congressional Hearing

A committee room. Wood panelling, a curved dais, five senators who have clearly never held a phone, and a witness table with one **hoodie** on it. The witness's face is never shown: the hood is a shadow, the answer is the game. A stenographer types on a paper typewriter that feeds the minutes, a sergeant at arms checks his watch, a page runs in and out with notes, and in the gallery the public sits in seats labelled **PUBLIC** — generic cartoons, half of them filming vertical.

The five senators, dais left to right: **Chairman Marcus** (never heard of the internet, chain of office), **Senator Vance** (financial literacy subcommittee chair, owns two boats, both titled to a Cayman entity he calls "the family office"), **Senator Ruiz** (has read one white paper, brings it up), **Senator Howe** (asleep, wakes to vote against), and **Senator Bell** (highest coins, worst questions).

The multiplier is how long the coin holds the committee's attention, and every step up is a worse question, a longer answer, and a bigger opportunity for the gallery.

## Direction

The comedy is the gap between the machine of government (oaths, minutes, seniority, subcommittees) and the machine of the coin (one guy in a hoodie, total supply fixed at birth, liquidity gone). The senators are not evil: they are worse, they are *senatorial*. Every witness answer is technically true and completely useless. Every senator's question reveals an unreported interest. The game never names a real committee, a real party, a real country's government: the flags are two plain blue fields, the seal is a ledger with wings, the letters on the lectern are unassigned.

- The witness answers with a full sentence of nothing: "Chairman, I appreciate the question, and the short answer is yes."
- The senators speak from the dais, one at a time, seniority order, and every one of them has an angle.
- The stenographer's minutes stack on the wall as the round runs — the game's own scoreboard.
- The gallery gets bolder with the multiplier: it is the exits and the bids.

## Dialogue ladder

Keyed to the displayed multiplier. Each exchange is two bubbles (senator, witness) and a cue, queued so a bubble stays up at least 2.6 seconds before the same speaker's next line replaces it. The caption is the last line said.

- **Betting:** Chairman Marcus, gavel: "This hearing is called to order. The committee will hear testimony on… the coin. Which is. Which one is it?" Page brings a card. "The coin."
- **1.15×:** Senator Vance: "So the money is in the computer. Whose computer?" Witness: "Chairman, I appreciate the question, and the short answer is yes."
- **1.35×:** Senator Ruiz: "I've read the white paper. Page nine. Where is the page nine of this hearing?" Witness: "The white paper has been amended in spirit."
- **1.55×:** Senator Bell: "My constituents keep sending me this wallet — they call it a hardware wallet, it sounds like a — what is it, a drive? — is my money in it?" Witness: "No."
- **1.8×:** Chairman Marcus: "Let the record show the witness said no."
- **2.1×:** Senator Vance: "I'm going to ask the hard question. The supply is fixed at 21 million. Who sets the inflation?" Witness: "The market." Senator Vance: "I see. And who sets the market?" Witness: "The market."
- **2.4×:** Senator Ruiz: "For the record, this is the same technology as the internet, which I also use."
- **2.8×:** Senator Howe wakes: "Objection. Whatever we're doing, my state has a refinery." He goes back to sleep.
- **3.2×:** Senator Bell: "The hoodie. Is the hoodie a uniform of any organization?" Witness: "It is not." Chairman Marcus: "Let the record show the hoodie is not a uniform."
- **3.8×:** Senator Vance: "My subcommittee on financial literacy has drafted a bill. I have it here. It is one sentence. 'Give me some.'" Page runs to the witness's table and back.
- **4.5×:** Chairman Marcus: "We're going to go around the room, one line each, for what the members are calling 'a position.'" Every senator, in seniority order: "In." "In." "In." "Refinery." "In."
- **5.5×:** The witness, asked directly if the coin is a security by Senator Ruiz, answers: "The coin is a coin." Chairman Marcus: "Let the record show the coin is a coin."
- **7×:** Senator Bell: "One more from me. The wallet I bought — the hardware one — does it also do the phones?" Witness: "No."
- **9×:** Senator Vance, to the gallery, on the record: "My subcommittee will be accepting a limited number of new investors. This is not an offer of securities. This is a boat." The gallery applauds.
- **12×:** Chairman Marcus, to the page: "What time is the next hearing?" Page: "There is no next hearing, Chairman." Chairman Marcus: "Schedule one."
- **18×:** The witness, asked if he has anything to add: "The coin is gone, Chairman. It left this morning." Chairman Marcus: "Let the record show — "
- **25×:** Chairman Marcus, gavel: "The committee will hear one more question, and then the coin will be in contempt."

## Suspense layer

Tension is `1 − 1/x` on the displayed multiplier (a third at 1.5×, half at 2×, two thirds at 3×), so it builds through the 1×–3× window where most rounds end, with a slower log driver keeping long rounds changing. All suspense is keyed to the displayed multiplier and elapsed time, never to the outcome.

- **The stenographer's minutes** stack on the wall, one page per exchange, and the stack is the round's height. She types faster with tension. By 5× the pages are blank — she has stopped recording the words.
- **The sergeant at arms' watch** is the round's metronome. He checks it more often as tension rises; at high tension he checks it at every exchange.
- **The gallery fills and empties.** Seats label-change from PUBLIC to BID with the multiplier; at high tension the whole gallery is one wallet address.
- **The witness's hood** casts a deeper shadow as tension rises. At no point is a face shown.
- **The page** runs in and out faster. The card he carries grows a longer and longer list.
- **The bail application bouquet** on the clerk's desk: one per senator, growing with tension, each ribbon a committee name.
- A quiet heartbeat under the dais muzak quickens with tension until the player cashes out.

## Accepted cash-out

The shell confirms the exit; only a confirmed `cashoutX100` triggers this.

Your gallery seat leaves the record: the player's PUBLIC seat stands, which triggers the chairman to say "the record will reflect one member of the public had somewhere to be," and the badge reads **TAKEN AT MY MINUTE · SEE THE RECORD**.

If the chart keeps going without you, the caption keeps score: **THE RECORD CONTINUES. YOUR MINUTE STANDS.** The hearing continues without the player's seat, the minutes stack, the senators angle. A crash after a cash-out reads as dodged: **RUG DODGED — OUTSIDE THE RECORD.**

## The crash

Keyed to `view.crashAge`, deterministic from the crash point so a replay collapses identically.

1. The witness's phone, on the table in front of the hood, buzzes. The screen reads **DEV SOLD**. He never looks at it. He does not have to.
2. The gallery's screens all turn the same red at the same frame, and the gallery — one wallet address now — goes from PUBLIC to REKT in the same frame.
3. The stenographer's stack, the game's scoreboard, is pulled off the wall by one page at the bottom, and the whole stack falls as one sheet: every word the committee said, gone.
4. Chairman Marcus, gavel up, says the round's last line: "Let the record show the record is gone." The gavel comes down and misses the block.
5. The sergeant at arms' watch beeps: the round ran out of time. He picks up the bouquet of bail applications and hands them to the page.
6. Senator Vance's boats, in a window cutaway at the frame's edge, both turn to the same red.
7. The page runs to the witness's table one more time and hands him a card. The card reads: **THE COIN WAS THE RECORD**.
8. The witness stands, picks up the phone, and walks out of the hood's shadow and out of the frame, leaving the hoodie on the chair. Inside the hood: nothing, an empty chair, and the phone still glowing on the table.

A short blink to black covers the room resetting for the next round. A crash after a cash-out is the same collapse seen small from the doorway, on the record.

## Caption ladder

- Running: GM COMMITTEE · SO THE MONEY IS IN THE COMPUTER · NUMBER GO UP · IN THE RECORD · DIAMOND HOODIE · LET THE RECORD SHOW · THIS IS FINE
- Cash-out: TAKEN AT MY MINUTE · SEE THE RECORD · OUTSIDE THE RECORD
- Crash: DEV SOLD · THE RECORD IS GONE · CONTEMPT · NGMI

## Sound

- `audio.ts`: the shared page audio (a copy of the shell's, never edited here). A string quartet of dais muzak that opens up with the multiplier.
- Cues: gavel on programme beats (`fx`), the stenographer's typing as a rising rattle (`tick`), the page's footsteps (`step`), senator phone buzzes (`notify`), gallery applause on milestones (`milestone`), the sergeant at arms' watch (`tick`), the boats' window cutaway (nothing), and the crash: the watch's beep, the stack falling as one sheet, and one gavel miss.

## Lines not to cross

- Every senator, the witness, the page, the stenographer and the gallery are generic cartoons with no likeness to any real person. No real committee, party, government or country is named, shown or implied: the flags are plain blue, the seal is invented, the letters on the lectern are unassigned.
- Comedy only: no real legislation, no real securities law advice, nothing in the game is a legal opinion. The boat line is a joke about a bill, not an offer.
- The gallery's loss is the punchline, and it lands on the room's theatrics, not on any person or class of person.
- Credits have no monetary value. Nothing in the game implies the player's own money is at stake, and the label names no opponent.

## Builder's notes

This skeleton copies the [Hello World](../hello-world) template verbatim: `main.ts`, `audio.ts` and the shared CSS block are unmodified shared-shell copies; `scene.ts` is the commented template with its circle and greeting, fully functional for every phase. The build, replay fixture (`replay.json`'s `gameId` names this slug) and recorded example are already wired.

To build the game on this skeleton, work in `scene.ts` against the `SceneView` contract documented in the template's [README](../hello-world/README.md#where-to-work): render `waiting`, `betting`, `running` and `crashed` from `view.phase`, use `view.currentX100` for the multiplier (150 means 1.50×), `view.elapsed` for running animation and `view.crashAge` for the ending. Pacing matters more than anything else: about half of all rounds end before 2× (9 seconds in) and two in three before 3×, so the early exchanges arrive every few seconds through 3× and a slower `log10` driver keeps long rounds changing. Tension is presentation only — never derive it from the crash point. Every animation is a pure function of the view, so replays, seeks and late entries draw the same frame; cues fire on confirmed changes only, and a late entry shows the current state without replaying an old cash-out or crash. The crash keys off `view.crashAge`. Keep `main.ts`, `audio.ts` and the shared CSS block untouched; shared changes belong in [`scripts/shell/`](../../scripts/shell/).

Read [the animation reference](../../docs/animation.md) before adding or changing character animation: the dais is a profile lineup of five senators in seniority order, the stenographer's stack is a growing pile with page springs, the gallery is a layered crowd that swaps label states, and the witness is a single hood shape with a phone — the cheapest rig in the catalog and the funniest if the timing holds. Check waiting, running, crash, accepted cash-out, replay and small-screen behavior when relevant, then run `npm run build`, `npm run typecheck`, `npm run check` and `npm test`.
