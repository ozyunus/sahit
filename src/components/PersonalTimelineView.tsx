import React from 'react';
import { Witness } from '../types';
import { soundAdapter } from '../services/soundAdapter';
import { THEME_PALETTE } from './NetworkCanvas';

interface PersonalTimelineViewProps {
  witnesses: Witness[];
  onSelectWitness: (w: Witness) => void;
  onOpenComposer: () => void;
}

const AVATARS: Record<string, string> = {
  adult_male: '/assets/avatars/adult_male.jpg',
  adult_female: '/assets/avatars/adult_female.jpg',
  boy: '/assets/avatars/boy.jpg',
  girl: '/assets/avatars/girl.jpg',
};

export const PersonalTimelineView: React.FC<PersonalTimelineViewProps> = ({
  witnesses,
  onSelectWitness,
  onOpenComposer,
}) => {
  // If user has no witnesses yet, provide default historical reflections for demo continuity
  const displayWitnesses = witnesses.length > 0 ? witnesses : [
    {
      id: 'demo_1',
      text: 'Bugün vapurda bir adamın martılara simit attığını gördüm.',
      created_at_utc: '2026-10-01T08:17:00Z',
      local_hour: 8,
      voice_family: 'boy' as const,
      city: 'İstanbul',
      weather: { condition: 'rain', temp_c: 14 },
      demo_theme: 'şehir',
      demo_x: 0,
      demo_y: 0,
      is_user: true,
    },
    {
      id: 'demo_2',
      text: 'Annemin saçlarının biraz daha beyazladığını fark ettim.',
      created_at_utc: '2026-09-29T19:42:00Z',
      local_hour: 19,
      voice_family: 'adult_female' as const,
      city: 'İstanbul',
      weather: { condition: 'clear', temp_c: 18 },
      demo_theme: 'aile',
      demo_x: 0,
      demo_y: 0,
      is_user: true,
    },
    {
      id: 'demo_3',
      text: 'Mahalledeki eski ağacı kestiler.',
      created_at_utc: '2026-09-27T17:05:00Z',
      local_hour: 17,
      voice_family: 'adult_male' as const,
      city: 'İstanbul',
      weather: { condition: 'clear', temp_c: 20 },
      demo_theme: 'doğa',
      demo_x: 0,
      demo_y: 0,
      is_user: true,
    },
    {
      id: 'demo_4',
      text: 'Bugün ilk kez sonbaharı hissettim.',
      created_at_utc: '2026-09-25T07:56:00Z',
      local_hour: 7,
      voice_family: 'adult_female' as const,
      city: 'İstanbul',
      weather: { condition: 'rain', temp_c: 12 },
      demo_theme: 'zaman',
      demo_x: 0,
      demo_y: 0,
      is_user: true,
    },
  ];

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Bugün';
    const d = new Date(isoString);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  };

  const getWeatherIcon = (condition?: string) => {
    if (!condition) return '·';
    if (condition.includes('rain') || condition.includes('yağmur')) return '🌧️';
    if (condition.includes('night') || condition.includes('gece')) return '🌙';
    if (condition.includes('clear') || condition.includes('güneş')) return '☀️';
    return '⛅';
  };

  return (
    <div className="w-full h-full max-w-2xl mx-auto p-4 sm:p-8 overflow-y-auto space-y-8 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-white/8">
        <div>
          <h2 className="text-xl font-serif text-white tracking-wide">
            Kişisel Zaman Çizelgesi
          </h2>
          <p className="text-xs text-slate-400 font-serif italic">
            Zaman geçtikçe biriken şahitlik izlerin
          </p>
        </div>
        <button
          onClick={onOpenComposer}
          className="px-3.5 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-xs font-medium transition-all"
        >
          + Yeni Ekle
        </button>
      </div>

      {/* Timeline items matching Screen 4 in ekran.png */}
      <div className="relative pl-6 space-y-8 border-l border-white/10 ml-3">
        {displayWitnesses.map((w) => {
          const themeKey = w.demo_theme?.toLowerCase() || 'diğer';
          const themeColor = THEME_PALETTE[themeKey]?.fill || '#fbbf24';
          const avatarImg = AVATARS[w.voice_family] || AVATARS.adult_female;

          return (
            <div key={w.id} className="relative group">
              {/* Timeline Marker Dot */}
              <div
                style={{ backgroundColor: themeColor, boxShadow: `0 0 10px ${themeColor}88` }}
                className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-[#05070c]"
              />

              {/* Date Header */}
              <div className="text-xs font-medium text-slate-400 mb-2 font-mono">
                {formatDate(w.created_at_utc)}
              </div>

              {/* Witness Card matching Screen 4 */}
              <div
                onClick={() => {
                  soundAdapter.playVoiceCue(w.voice_family);
                  onSelectWitness(w);
                }}
                className="rounded-2xl bg-[#12151f]/90 hover:bg-[#181d2a] border border-white/10 hover:border-white/20 p-4 transition-all duration-300 shadow-xl flex items-center justify-between gap-4 cursor-pointer"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <p className="text-sm sm:text-base font-serif text-slate-100 leading-relaxed">
                    {w.text}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <span>
                      {w.local_hour ? `${w.local_hour.toString().padStart(2, '0')}:00` : '08:17'}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>{w.city || 'İstanbul'}</span>
                    <span className="text-slate-600">·</span>
                    <span>
                      {getWeatherIcon(w.weather?.condition)}{' '}
                      {w.weather?.temp_c ? `${w.weather.temp_c}°C` : '14°C'}
                    </span>
                  </div>
                </div>

                {/* Right avatar circle */}
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-white/20 shadow-md">
                  <img
                    src={avatarImg}
                    alt={w.voice_family}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
