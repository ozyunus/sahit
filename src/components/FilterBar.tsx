import React from 'react';
import { FilterState, HourFilter, TimeFilter, WeatherFilter } from '../types';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  filteredCount: number;
  totalCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
}) => {
  return (
    <div className="relative z-10 w-full px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
      {/* Screen 6 Time Filters: Bugün | Bu hafta | Bu ay | Tümü */}
      <div className="flex items-center gap-1.5 p-1 bg-[#121520]/80 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
        {(
          [
            ['today', 'Bugün'],
            ['week', 'Bu hafta'],
            ['month', 'Bu ay'],
            ['all', 'Tümü'],
          ] as [TimeFilter, string][]
        ).map(([key, label]) => {
          const isActive = filters.time === key;
          return (
            <button
              key={key}
              onClick={() => onFilterChange({ ...filters, time: key })}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white text-black shadow-md scale-102'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Screen 8 Weather & Time Filters: Tümü | 🌧️ Yağmur | ☀️ Güneşli | 🌅 Sabah | 🌙 Gece */}
      <div className="flex items-center gap-1.5 p-1 bg-[#121520]/80 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
        <button
          onClick={() => onFilterChange({ ...filters, weather: 'all', hour: 'all' })}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            filters.weather === 'all' && filters.hour === 'all'
              ? 'bg-white text-black shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          Tümü
        </button>

        <button
          onClick={() => onFilterChange({ ...filters, weather: 'rain' })}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            filters.weather === 'rain'
              ? 'bg-sky-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.5)]'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>🌧️</span>
          <span>Yağmur</span>
        </button>

        <button
          onClick={() => onFilterChange({ ...filters, weather: 'clear' })}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            filters.weather === 'clear'
              ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>☀️</span>
          <span>Güneşli</span>
        </button>

        <button
          onClick={() => onFilterChange({ ...filters, hour: 'morning' })}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            filters.hour === 'morning'
              ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>🌅</span>
          <span className="hidden sm:inline">Sabah</span>
        </button>

        <button
          onClick={() => onFilterChange({ ...filters, hour: 'night' })}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            filters.hour === 'night'
              ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <span>🌙</span>
          <span className="hidden sm:inline">Gece</span>
        </button>
      </div>
    </div>
  );
};
