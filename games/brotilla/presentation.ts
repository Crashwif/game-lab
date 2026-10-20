/** Presentation only. No round creation, probability, outcome selection or intents. */
export interface SceneView {
    phase: 'waiting' | 'betting' | 'running' | 'crashed';
    currentX100: number;
    elapsed: number;
    crashAge: number;
    stake: number | null;
    cashoutX100: number | null;
    payout: number | null;
}
export interface Frame {
    phase: SceneView['phase'] | 'escaped';
    elapsed: number;
    currentX100: number;
    stage: number;
    outcomeAge: number;
    held: boolean;
    view: SceneView;
    cue: 'cashout' | 'crash' | null;
    quiet: boolean;
}
export const STAGES = [100, 125, 160, 200, 300, 500, 800, 1200] as const;
export const stageAt = (x100: number): number => STAGES.reduce<number>((n, at, i) => x100 >= at ? i : n, 0);
export function createPresentation() {
    let last: SceneView | null = null;
    let wall: number | null = null;
    let accepted: SceneView | null = null;
    let acceptedAge = 0;
    let crashed: SceneView | null = null;
    let crashAge = 0;
    let encore = 0;
    let quietCrash = false;
    return (input: SceneView, now: number): Frame => {
        const gap = wall === null ? 0 : Math.max(0, (now - wall) / 1000);
        const dt = Math.min(.1, gap);
        const first = last === null;
        // A new running round always wins over an old encore. A backward seek resets it too.
        const freshRound = last && input.phase === 'running' &&
            (last.phase !== 'running' || input.elapsed + 1 < last.elapsed);
        const newInstant = last && input.phase === 'crashed' &&
            (last.phase === 'waiting' || last.phase === 'betting');
        if (freshRound || newInstant || (wall !== null && now < wall)) {
            accepted = crashed = null;
            acceptedAge = crashAge = encore = 0;
        }
        wall = now;
        let cue: Frame['cue'] = null;
        const quiet = first || gap > 1.5;
        if (accepted)
            acceptedAge += dt;
        if (input.cashoutX100 !== null && !accepted) {
            accepted = { ...input, currentX100: input.cashoutX100 };
            acceptedAge = quiet ? 4 : 0;
            if (!quiet)
                cue = 'cashout';
        }
        if (input.phase === 'crashed') {
            if (!crashed) {
                crashed = { ...input };
                quietCrash = quiet || input.crashAge > 1500;
                if (!accepted)
                    cue = 'crash';
            }
            crashAge = Math.max(0, input.crashAge / 1000);
        }
        const idle = input.phase === 'waiting' || input.phase === 'betting';
        if (idle && crashed) {
            encore += dt;
            crashAge += dt;
        }
        const held = idle && !!crashed && !quietCrash && crashAge < 5.4 && encore < 3.5;
        if (idle && !held) {
            accepted = crashed = null;
            acceptedAge = crashAge = encore = 0;
        }
        const shown = accepted ?? (held ? crashed! : input);
        const phase = accepted ? 'escaped' : held ? 'crashed' : input.phase;
        const frame: Frame = {
            phase, elapsed: Math.max(0, shown.elapsed / 1000), currentX100: shown.currentX100,
            stage: stageAt(shown.currentX100), outcomeAge: accepted ? acceptedAge : crashAge,
            held, view: { ...shown }, cue,
            quiet: phase === 'crashed' ? quietCrash : quiet,
        };
        last = { ...input };
        return frame;
    };
}
