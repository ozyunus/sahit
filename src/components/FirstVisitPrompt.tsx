import React, { useState } from 'react';
import { VoiceFamily, Witness } from '../types';
import { soundAdapter } from '../services/soundAdapter';
import { witnessRepo } from '../services/witnessRepository';
import { AudioWaveform } from './AudioWaveform';

interface FirstVisitPromptProps {
  onComplete: (newWitness?: Witness) => void;
}

const AVATAR_OPTIONS: { key: VoiceFamily; label: string; img: string }[] = [
  { key: 'adult_male', label: 'Erkek', img: '/assets/avatars/adult_male.jpg' },
  { key: 'adult_female', label: 'Kadın', img: '/assets/avatars/adult_female.jpg' },
  { key: 'boy', label: 'Erkek çocuk', img: '/assets/avatars/boy.jpg' },
  { key: 'girl', label: 'Kız çocuk', img: '/assets/avatars/girl.jpg' },
];

export const FirstVisitPrompt: React.FC<FirstVisitPromptProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [voiceFamily, setVoiceFamily] = useState<VoiceFamily>('adult_female');
  const [text, setText] = useState('');
  const [createdWitness, setCreatedWitness] = useState<Witness | null>(null);

  const handleSelectVoice = (family: VoiceFamily) => {
    setVoiceFamily(family);
    witnessRepo.updateVoiceFamily(family);
    soundAdapter.playVoiceCue(family);
    setTimeout(() => {
      setStep(2);
    }, 400);
  };

  const handleSkip = () => {
    witnessRepo.updateVoiceFamily(voiceFamily);
    onComplete();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    soundAdapter.playVoiceCue(voiceFamily);

    const newWitness = witnessRepo.addWitness({
      text: text.trim(),
      voice_family: voiceFamily,
    });

    setCreatedWitness(newWitness);
    setStep(3);

    // Screen 3: Post-submission audio & celebration, then transition to personal map
    setTimeout(() => {
      onComplete(newWitness);
    }, 2800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05070c]/95 backdrop-blur-xl animate-fade-in overflow-hidden select-none">
      {/* Background Cosmic Nebula Glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full bg-radial from-sky-500/15 via-indigo-500/5 to-transparent blur-3xl" />
      </div>

      {step === 1 && (
        /* Screen 1: Açılış Ekranı */
        <div className="relative z-10 w-full max-w-md text-center space-y-9">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-serif font-light text-white leading-tight tracking-wide drop-shadow-lg">
              Bugün<br />neye şahit oldun?
            </h1>
            <p className="text-xs sm:text-sm font-serif italic text-slate-400/90 tracking-wide">
              Yaşananların değil, fark edilenlerin haritası.
            </p>
          </div>

          <div className="space-y-5">
            <p className="text-xs font-serif italic text-slate-300">
              Sesini seç.
            </p>

            {/* 4 Circular 3D Avatars horizontally matching Screen 1 in ekran.png */}
            <div className="flex items-center justify-center gap-4 sm:gap-6">
              {AVATAR_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectVoice(opt.key)}
                  className="flex flex-col items-center gap-2.5 group cursor-pointer focus:outline-none"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[3px] bg-white/10 group-hover:bg-amber-300/40 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.6)] group-hover:scale-105">
                    <img
                      src={opt.img}
                      alt={opt.label}
                      className="w-full h-full rounded-full object-cover border border-white/20"
                    />
                  </div>
                  <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-slate-400 hover:text-slate-300 transition-colors pt-4"
          >
            Ağı doğrudan keşfet →
          </button>
        </div>
      )}

      {step === 2 && (
        /* Screen 2: Şahitlik Yazma */
        <div className="relative z-10 w-full max-w-md space-y-8 animate-fade-in">
          <h2 className="text-2xl sm:text-3xl font-serif font-light text-white text-left tracking-wide">
            Bugün<br />neye şahit oldun?
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative rounded-2xl bg-[#11141d]/90 border border-white/15 p-5 shadow-2xl space-y-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Bugün vapurda bir adamın martılara simit attığını gördüm."
                rows={5}
                maxLength={500}
                autoFocus
                required
                className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 font-serif text-sm sm:text-base leading-relaxed focus:outline-none resize-none"
              />
              <div className="text-right text-xs font-mono text-slate-400">
                {text.length}/500
              </div>
            </div>

            {/* Glowing ivory pill button "Gönder →" matching Screen 2 */}
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={!text.trim()}
                className="px-8 py-3 rounded-full bg-[#f1f3f7] hover:bg-white text-[#11131a] font-medium text-sm tracking-wide transition-all shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 cursor-pointer"
              >
                Gönder →
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 3 && (
        /* Screen 3: Gönderim Sonrası (Ses) */
        <div className="relative z-10 w-full max-w-md text-center space-y-8 animate-scale-up">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-serif text-white tracking-wide">
              Şahitliğin<br />kaydedildi.
            </h2>
          </div>

          {/* Central Avatar with glowing ripple wave rings */}
          <div className="relative flex items-center justify-center my-6">
            {/* Ripple rings */}
            <div className="absolute w-36 h-36 rounded-full border border-sky-400/20 animate-ping" />
            <div className="absolute w-28 h-28 rounded-full border border-sky-400/40 animate-pulse" />
            
            <div className="relative z-10 w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-sky-400 to-indigo-500 shadow-[0_0_35px_rgba(56,189,248,0.5)]">
              <img
                src={AVATAR_OPTIONS.find((a) => a.key === voiceFamily)?.img}
                alt="Voice Avatar"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
          </div>

          {/* Sound waveform frequency bars */}
          <div className="space-y-2">
            <AudioWaveform color="#38bdf8" active={true} barCount={32} />
            <p className="text-xs text-slate-400 font-serif italic">
              (rastgele kısa bir ses)
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
