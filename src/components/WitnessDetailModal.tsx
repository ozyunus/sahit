import React from 'react';
import { VoiceFamily, Witness, WitnessEdge } from '../types';
import { soundAdapter } from '../services/soundAdapter';
import { AudioWaveform } from './AudioWaveform';
import { X } from 'lucide-react';

interface WitnessDetailModalProps {
  witness: Witness;
  connectedEdges: WitnessEdge[];
  connectedWitnesses: Witness[];
  onSelectConnected: (witness: Witness) => void;
  onClose: () => void;
}

const AVATARS: Record<VoiceFamily, string> = {
  adult_male: '/assets/avatars/adult_male.jpg',
  adult_female: '/assets/avatars/adult_female.jpg',
  boy: '/assets/avatars/boy.jpg',
  girl: '/assets/avatars/girl.jpg',
};

export const WitnessDetailModal: React.FC<WitnessDetailModalProps> = ({
  witness,
  connectedWitnesses,
  onSelectConnected,
  onClose,
}) => {
  const avatarImg = AVATARS[witness.voice_family] || AVATARS.adult_female;

  const getWeatherIcon = (condition?: string) => {
    if (!condition) return '🌧️';
    if (condition.includes('rain') || condition.includes('yağmur')) return '🌧️';
    if (condition.includes('clear') || condition.includes('güneş')) return '☀️';
    return '⛅';
  };

  const timeFormatted = witness.local_hour
    ? `${witness.local_hour.toString().padStart(2, '0')}:17`
    : '08:17';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0f121a]/95 border border-white/15 p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] space-y-6 text-slate-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. Main Witness Card with Avatar matching Screen 7 */}
        <div className="rounded-2xl bg-[#161a26] border border-white/10 p-5 space-y-4 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-white/20 shadow-md">
              <img src={avatarImg} alt="Avatar" className="w-full h-full object-cover" />
            </div>

            <div className="space-y-2 flex-1">
              <blockquote className="text-base sm:text-lg font-serif italic text-white leading-relaxed">
                “{witness.text}”
              </blockquote>

              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>{timeFormatted}</span>
                <span className="text-slate-600">·</span>
                <span>{witness.city || 'İstanbul'}</span>
                <span className="text-slate-600">·</span>
                <span>
                  {getWeatherIcon(witness.weather?.condition)}{' '}
                  {witness.weather?.temp_c ? `${witness.weather.temp_c}°C` : '14°C'}
                </span>
              </div>
            </div>
          </div>

          {/* Golden Sound Waveform matching Screen 7 */}
          <div
            onClick={() => soundAdapter.playVoiceCue(witness.voice_family)}
            className="pt-2 cursor-pointer group"
            title="Sözsüz sesi dinle"
          >
            <AudioWaveform color="#fbbf24" active={true} barCount={30} />
          </div>
        </div>

        {/* 2. Algoritmik Yorum: "Makinenin yakın bulduğu şahitlikler" */}
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-serif text-slate-200 tracking-wide">
              Makinenin yakın bulduğu şahitlikler
            </h3>
            <p className="text-[11px] text-slate-400 font-serif italic">
              Makine gerçekten bu iki şahitlik arasında bir ilişki mi buldu, yoksa ilişkiyi kendisi mi üretti?
            </p>
          </div>

          <div className="space-y-2">
            {connectedWitnesses.slice(0, 4).map((cw) => {
              const cwAvatar = AVATARS[cw.voice_family] || AVATARS.adult_female;
              return (
                <div
                  key={cw.id}
                  onClick={() => {
                    soundAdapter.playVoiceCue(cw.voice_family);
                    onSelectConnected(cw);
                  }}
                  className="rounded-2xl bg-[#141824] hover:bg-[#1a2030] border border-white/10 hover:border-amber-400/40 p-3.5 flex items-center gap-3.5 transition-all cursor-pointer group shadow-md"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/20">
                    <img src={cwAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  </div>

                  <p className="text-xs sm:text-sm font-serif text-slate-200 group-hover:text-white leading-snug line-clamp-1 flex-1">
                    {cw.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
