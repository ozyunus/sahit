import React from 'react';
import { Witness } from '../types';
import { Volume2, User, ArrowRight } from 'lucide-react';
import { soundAdapter } from '../services/soundAdapter';

interface WitnessListViewProps {
  witnesses: Witness[];
  selectedWitness: Witness | null;
  onSelectWitness: (witness: Witness) => void;
}

export const WitnessListView: React.FC<WitnessListViewProps> = ({
  witnesses,
  selectedWitness,
  onSelectWitness,
}) => {
  return (
    <div className="w-full h-full max-w-4xl mx-auto p-4 sm:p-6 overflow-y-auto space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/8">
        <h2 className="text-base font-serif text-white">Metin Kataloğu</h2>
        <span className="text-xs text-slate-400 font-mono">
          {witnesses.length} şahitlik listeleniyor
        </span>
      </div>

      <div className="divide-y divide-white/6">
        {witnesses.map((w) => {
          const isSelected = selectedWitness?.id === w.id;
          return (
            <div
              key={w.id}
              onClick={() => onSelectWitness(w)}
              className={`py-3.5 px-3 rounded-xl transition-all cursor-pointer flex items-start justify-between gap-4 group ${
                isSelected ? 'bg-white/10 ring-1 ring-white/15' : 'hover:bg-white/5'
              }`}
            >
              <div className="space-y-1.5 min-w-0">
                <p className="text-sm font-serif text-slate-200 group-hover:text-white leading-relaxed">
                  “{w.text}”
                </p>

                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                  {w.is_user && (
                    <>
                      <span className="text-amber-300 flex items-center gap-1 font-mono text-[11px]">
                        <User className="w-3 h-3" />
                        Senin
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                    </>
                  )}
                  <span>{w.city || 'Bilinmiyor'}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>{w.local_hour !== undefined ? `${w.local_hour}:00` : '—'}</span>
                  {w.weather && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>{w.weather.condition} ({w.weather.temp_c}°C)</span>
                    </>
                  )}
                  {w.demo_theme && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="capitalize">{w.demo_theme}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundAdapter.playVoiceCue(w.voice_family);
                  }}
                  title="Ses İzini Çal"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-200 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
