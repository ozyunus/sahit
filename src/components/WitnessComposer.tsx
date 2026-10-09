import React, { useState } from 'react';
import { VoiceFamily, Witness } from '../types';
import { soundAdapter } from '../services/soundAdapter';
import { witnessRepo } from '../services/witnessRepository';
import { AudioWaveform } from './AudioWaveform';
import { X } from 'lucide-react';

interface WitnessComposerProps {
  initialVoiceFamily: VoiceFamily;
  onSuccess: (newWitness: Witness) => void;
  onClose: () => void;
}

const AVATAR_OPTIONS: { key: VoiceFamily; label: string; img: string }[] = [
  { key: 'adult_male', label: 'Erkek', img: '/assets/avatars/adult_male.jpg' },
  { key: 'adult_female', label: 'Kadın', img: '/assets/avatars/adult_female.jpg' },
  { key: 'boy', label: 'Erkek çocuk', img: '/assets/avatars/boy.jpg' },
  { key: 'girl', label: 'Kız çocuk', img: '/assets/avatars/girl.jpg' },
];

export const WitnessComposer: React.FC<WitnessComposerProps> = ({
  initialVoiceFamily,
  onSuccess,
  onClose,
}) => {
  const [text, setText] = useState('');
  const [voiceFamily, setVoiceFamily] = useState<VoiceFamily>(initialVoiceFamily);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [newlyCreated, setNewlyCreated] = useState<Witness | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    soundAdapter.playVoiceCue(voiceFamily);

    const witness = witnessRepo.addWitness({
      text: text.trim(),
      voice_family: voiceFamily,
    });

    setNewlyCreated(witness);
    setIsSubmitted(true);

    // Screen 3 celebration phase
    setTimeout(() => {
      onSuccess(witness);
    }, 2800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05070c]/90 backdrop-blur-xl animate-fade-in select-none">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full bg-radial from-sky-500/10 via-amber-500/5 to-transparent blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSubmitted ? (
          /* Screen 2: Şahitlik Yazma */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl sm:text-3xl font-serif font-light text-white text-left tracking-wide">
                Bugün<br />neye şahit oldun?
              </h2>

              {/* Voice Family Selector Switcher */}
              <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-full border border-white/10">
                {AVATAR_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setVoiceFamily(opt.key);
                      soundAdapter.playVoiceCue(opt.key);
                    }}
                    title={opt.label}
                    className={`w-7 h-7 rounded-full overflow-hidden transition-all ${
                      voiceFamily === opt.key ? 'ring-2 ring-amber-400 scale-110' : 'opacity-50 hover:opacity-100'
                    }`}
                  >
                    <img src={opt.img} alt={opt.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

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

              {/* Glowing ivory pill button "Gönder →" */}
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
        ) : (
          /* Screen 3: Gönderim Sonrası (Ses) */
          <div className="text-center space-y-8 animate-scale-up py-4">
            <h2 className="text-2xl sm:text-3xl font-serif text-white tracking-wide">
              Şahitliğin<br />kaydedildi.
            </h2>

            {/* Central Avatar with glowing ripple rings */}
            <div className="relative flex items-center justify-center my-6">
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

            {/* Sound Waveform */}
            <div className="space-y-2">
              <AudioWaveform color="#38bdf8" active={true} barCount={32} />
              <p className="text-xs text-slate-400 font-serif italic">
                (rastgele kısa bir ses)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
