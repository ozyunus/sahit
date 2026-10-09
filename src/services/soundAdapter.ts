import { VoiceFamily } from '../types';

class SoundAdapter {
  private audioCtx: AudioContext | null = null;
  private soundCache: Map<string, AudioBuffer> = new Map();
  private isMuted: boolean = false;

  public getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public unlockAudio() {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Play a resonant, wordless human vocal gesture for the chosen voice family.
   * Audible, warm, and room-filling for gallery/exhibition environments.
   */
  public async playVoiceCue(family: VoiceFamily = 'adult_female'): Promise<void> {
    if (this.isMuted) return;
    this.unlockAudio();

    // Fallback: high-quality organic acoustic formant synthesis with acoustic chime
    this.synthesizeHumanBreathVocal(family);
  }

  /**
   * Rich organic acoustic formant synthesis + warm singing bowl acoustic shimmer
   */
  private synthesizeHumanBreathVocal(family: VoiceFamily) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const duration = 2.4;

      // Pitch configurations
      const familyConfigs: Record<VoiceFamily, { baseFreq: number; f1: number; f2: number; f3: number; chimeFreq: number }> = {
        adult_male: { baseFreq: 120, f1: 520, f2: 1040, f3: 2400, chimeFreq: 432 },
        adult_female: { baseFreq: 230, f1: 680, f2: 1450, f3: 2800, chimeFreq: 528 },
        boy: { baseFreq: 280, f1: 760, f2: 1620, f3: 3100, chimeFreq: 588 },
        girl: { baseFreq: 340, f1: 880, f2: 1850, f3: 3400, chimeFreq: 660 },
      };

      const config = familyConfigs[family] || familyConfigs.adult_female;

      // Master gain node (increased to 0.42 for clear room presence)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.42, now + 0.25);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      masterGain.connect(ctx.destination);

      // 1. Resonant Tibetan Bell / Singing Bowl Chime (immediate audible arrival feedback)
      const chimeOsc = ctx.createOscillator();
      chimeOsc.type = 'sine';
      chimeOsc.frequency.setValueAtTime(config.chimeFreq, now);

      const chimeGain = ctx.createGain();
      chimeGain.gain.setValueAtTime(0.35, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

      chimeOsc.connect(chimeGain);
      chimeGain.connect(masterGain);
      chimeOsc.start(now);
      chimeOsc.stop(now + 1.9);

      // 2. Warm Fundamental Oscillator (Humming / Vowel body)
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(config.baseFreq, now);
      osc.frequency.linearRampToValueAtTime(config.baseFreq * 1.02, now + 0.4);
      osc.frequency.linearRampToValueAtTime(config.baseFreq * 0.98, now + duration);

      // Formant filters (Vowel coloring: gentle "aah / omm")
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

      osc.start(now);
      osc.stop(now + duration);

      // 3. Breath Component (subtle pink/filtered noise for airy presence)
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
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
      noiseGain.gain.linearRampToValueAtTime(0.12, now + 0.2);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);

      noiseSource.start(now);
      noiseSource.stop(now + duration);
    } catch (e) {
      console.warn('[SoundAdapter] Synthesis audio error:', e);
    }
  }

  public playSubtleTick() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.03);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    } catch {}
  }
}

export const soundAdapter = new SoundAdapter();

// Auto-unlock on first document interaction
if (typeof window !== 'undefined') {
  const unlock = () => {
    soundAdapter.unlockAudio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}
