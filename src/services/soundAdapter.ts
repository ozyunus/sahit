import { VoiceFamily } from '../types';

class SoundAdapter {
  private audioCtx: AudioContext | null = null;
  private soundCache: Map<string, AudioBuffer> = new Map();
  private isMuted: boolean = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Play a wordless human vocal gesture for the chosen voice family.
   * Uses real audio file if available, or rich organic acoustic formant synthesis fallback.
   */
  public async playVoiceCue(family: VoiceFamily = 'adult_female'): Promise<void> {
    if (this.isMuted) return;

    // Try loading audio file first
    const played = await this.tryPlayAudioFile(family);
    if (!played) {
      // Fallback: high-quality organic acoustic formant synthesis
      this.synthesizeHumanBreathVocal(family);
    }
  }

  private async tryPlayAudioFile(family: VoiceFamily): Promise<boolean> {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return false;

      // Pick random sample index (1-4)
      const index = Math.floor(Math.random() * 4) + 1;
      const paddedIndex = index.toString().padStart(2, '0');
      const url = `/assets/sounds/${family}/${family}_${paddedIndex}.mp3`;

      if (this.soundCache.has(url)) {
        const buffer = this.soundCache.get(url)!;
        this.playBuffer(buffer, ctx);
        return true;
      }

      // Check if file exists via head/fetch
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        const fullResponse = await fetch(url);
        const arrayBuf = await fullResponse.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuf);
        this.soundCache.set(url, audioBuffer);
        this.playBuffer(audioBuffer, ctx);
        return true;
      }
    } catch {
      // Graceful fallback to synthesizer
    }
    return false;
  }

  private playBuffer(buffer: AudioBuffer, ctx: AudioContext) {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  /**
   * Synthesize a warm, calming wordless human tone with formant filters and breath noise
   * Tailored for each voice family.
   */
  private synthesizeHumanBreathVocal(family: VoiceFamily) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const duration = 1.4 + Math.random() * 0.4;

      // Frequency and formant configurations for natural wordless vocal tones
      const familyConfigs: Record<VoiceFamily, { baseFreq: number; f1: number; f2: number; f3: number }> = {
        adult_male: { baseFreq: 115 + Math.random() * 20, f1: 500, f2: 1000, f3: 2400 },
        adult_female: { baseFreq: 220 + Math.random() * 30, f1: 650, f2: 1400, f3: 2800 },
        boy: { baseFreq: 270 + Math.random() * 30, f1: 750, f2: 1600, f3: 3100 },
        girl: { baseFreq: 330 + Math.random() * 40, f1: 850, f2: 1800, f3: 3400 },
      };

      const config = familyConfigs[family] || familyConfigs.adult_female;

      // Master gain node
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      // Soft organic attack (breath in)
      masterGain.gain.exponentialRampToValueAtTime(0.18, now + 0.35);
      // Natural lingering decay
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      masterGain.connect(ctx.destination);

      // 1. Warm Fundamental Oscillator (Humming / Vowel body)
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(config.baseFreq, now);
      // Gentle micro-inflection (human pitch drift)
      osc.frequency.linearRampToValueAtTime(config.baseFreq * 1.03, now + 0.4);
      osc.frequency.linearRampToValueAtTime(config.baseFreq * 0.98, now + duration);

      // Formant filter (Vowel coloring: gentle "ah / mm")
      const formant1 = ctx.createBiquadFilter();
      formant1.type = 'bandpass';
      formant1.frequency.setValueAtTime(config.f1, now);
      formant1.Q.setValueAtTime(4.0, now);

      const formant2 = ctx.createBiquadFilter();
      formant2.type = 'bandpass';
      formant2.frequency.setValueAtTime(config.f2, now);
      formant2.Q.setValueAtTime(5.0, now);

      osc.connect(formant1);
      formant1.connect(masterGain);

      const oscGain2 = ctx.createGain();
      oscGain2.gain.setValueAtTime(0.4, now);
      osc.connect(formant2);
      formant2.connect(oscGain2);
      oscGain2.connect(masterGain);

      // 2. Breath component (subtle pink/filtered noise for airy presence)
      const bufferSize = ctx.sampleRate * duration;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02; // soft pinking
        lastOut = output[i];
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(config.f3, now);
      noiseFilter.Q.setValueAtTime(2.0, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.04, now + 0.3);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.9);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);

      // Start sound sources
      osc.start(now);
      noiseSource.start(now);

      osc.stop(now + duration);
      noiseSource.stop(now + duration);
    } catch {
      // AudioContext policy blocked until user gesture, safe to ignore
    }
  }

  /**
   * Ambient node chime on hover / selection
   */
  public playSubtleTick(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);

      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // AudioContext may be suspended
    }
  }
}

export const soundAdapter = new SoundAdapter();
