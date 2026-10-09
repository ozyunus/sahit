import React from 'react';
import { VoiceFamily } from '../types';
import { soundAdapter } from '../services/soundAdapter';
import { Volume2 } from 'lucide-react';

interface VoiceSelectorProps {
  selectedFamily: VoiceFamily;
  onSelectFamily: (family: VoiceFamily) => void;
  compact?: boolean;
}

interface FamilyOption {
  key: VoiceFamily;
  label: string;
  sublabel: string;
  avatar: string;
}

const FAMILIES: FamilyOption[] = [
  {
    key: 'adult_male',
    label: 'Yetişkin Erkek',
    sublabel: 'Derin, sakin tını',
    avatar: '/assets/avatars/adult_male.svg',
  },
  {
    key: 'adult_female',
    label: 'Yetişkin Kadın',
    sublabel: 'Yumuşak, duru nefes',
    avatar: '/assets/avatars/adult_female.svg',
  },
  {
    key: 'boy',
    label: 'Erkek Çocuk',
    sublabel: 'Hafif, meraklı soluk',
    avatar: '/assets/avatars/boy.svg',
  },
  {
    key: 'girl',
    label: 'Kız Çocuk',
    sublabel: 'İnce, berrak ses',
    avatar: '/assets/avatars/girl.svg',
  },
];

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedFamily,
  onSelectFamily,
  compact = false,
}) => {
  const handleSelect = (family: VoiceFamily) => {
    onSelectFamily(family);
    soundAdapter.playVoiceCue(family);
  };

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-300">Ses Ailesi</label>
        <div className="grid grid-cols-2 gap-2">
          {FAMILIES.map((fam) => {
            const isSelected = selectedFamily === fam.key;
            return (
              <button
                key={fam.key}
                type="button"
                onClick={() => handleSelect(fam.key)}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-amber-400/50 bg-amber-500/10 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/8'
                }`}
              >
                <img
                  src={fam.avatar}
                  alt={fam.label}
                  className="w-6 h-6 rounded-full border border-white/20"
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{fam.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-slate-200">Sesini seç.</h3>
        <p className="text-xs text-slate-400 font-serif italic">
          Bu seçim yalnızca şahitliğine eşlik eden sözsüz ses ailesini belirler.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {FAMILIES.map((fam) => {
          const isSelected = selectedFamily === fam.key;
          return (
            <button
              key={fam.key}
              type="button"
              onClick={() => handleSelect(fam.key)}
              className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all group ${
                isSelected
                  ? 'border-amber-400/50 bg-amber-500/12 shadow-[0_0_15px_rgba(212,163,115,0.15)] ring-1 ring-amber-400/30'
                  : 'border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={fam.avatar}
                  alt={fam.label}
                  className={`w-9 h-9 rounded-full border transition-transform ${
                    isSelected
                      ? 'border-amber-300 scale-105'
                      : 'border-white/20 group-hover:border-white/40'
                  }`}
                />
                <div>
                  <div className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {fam.label}
                  </div>
                  <div className="text-[11px] text-slate-400">{fam.sublabel}</div>
                </div>
              </div>

              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                  isSelected ? 'text-amber-300' : 'text-slate-500 group-hover:text-slate-300'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
