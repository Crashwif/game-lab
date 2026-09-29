/** A small procedural engine on the shell's opt-in, visibility-aware effects bus. */
import type { Audio } from './audio';

export function engineSound(audio: Audio): { update(rpm: number, active: boolean): void; dispose(): void } {
  let context: AudioContext | null = null;
  let gain: GainNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let voices: OscillatorNode[] = [];
  function dispose(): void {
    for (const voice of voices) { voice.stop(); voice.disconnect(); }
    voices = []; gain?.disconnect(); filter?.disconnect(); gain = null; filter = null; context = null;
  }
  return {
    update(rpm, active) {
      if (!audio.enabled || !audio.context || !audio.bus) return;
      if (context !== audio.context) {
        dispose(); context = audio.context;
        gain = context.createGain(); gain.gain.value = 0;
        filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 0.65;
        filter.connect(gain).connect(audio.bus);
        for (const type of ['sawtooth', 'triangle'] as const) {
          const voice = context.createOscillator(); voice.type = type; voice.connect(filter); voice.start(); voices.push(voice);
        }
      }
      const time = context.currentTime;
      voices[0]!.frequency.setTargetAtTime(36 + rpm * 113, time, 0.07);
      voices[1]!.frequency.setTargetAtTime(71 + rpm * 225, time, 0.08);
      filter!.frequency.setTargetAtTime(180 + rpm * 1100, time, 0.12);
      gain!.gain.setTargetAtTime(active ? 0.025 + rpm * 0.05 : 0, time, active ? 0.1 : 0.25);
    },
    dispose,
  };
}
