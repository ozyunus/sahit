import React from 'react';

interface AudioWaveformProps {
  color?: string;
  active?: boolean;
  barCount?: number;
  className?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  color = '#38bdf8',
  active = true,
  barCount = 28,
  className = '',
}) => {
  // Generate symmetrical heights for sound wave
  const heights = [
    12, 18, 26, 40, 65, 80, 95, 60, 45, 75, 100, 85, 70, 50, 40, 70, 85, 95, 80, 60, 45, 30, 20, 15,
  ];

  return (
    <div className={`flex items-center justify-center gap-[3px] h-10 ${className}`}>
      {Array.from({ length: barCount }).map((_, i) => {
        const heightPercent = heights[i % heights.length] || 30;
        const animDelay = (i * 0.05).toFixed(2);
        return (
          <div
            key={i}
            style={{
              height: `${heightPercent}%`,
              backgroundColor: color,
              animationDelay: `${animDelay}s`,
              boxShadow: `0 0 8px ${color}66`,
            }}
            className={`w-[2.5px] rounded-full transition-all duration-300 ${
              active ? 'animate-pulse' : 'opacity-40'
            }`}
          />
        );
      })}
    </div>
  );
};
