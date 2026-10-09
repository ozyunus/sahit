import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Witness } from '../types';
import { NetworkCanvas } from './NetworkCanvas';
import { soundAdapter } from '../services/soundAdapter';
import { witnessRepo } from '../services/witnessRepository';
import { QrCodeDisplay } from './QrCodeDisplay';
import { Minimize2, Play, Pause, Sparkles } from 'lucide-react';

interface ExhibitionViewProps {
  onExitExhibition: () => void;
  onOpenComposer: () => void;
  onOpenQrPoster: () => void;
}

type SpawnStage = 'idle' | 'birth' | 'read' | 'drift' | 'settled';

const MAX_EXHIBITION_NODES = 100;

export const ExhibitionView: React.FC<ExhibitionViewProps> = ({
  onExitExhibition,
  onOpenComposer,
  onOpenQrPoster,
}) => {
  // Exactly 100 latest witnesses for the exhibition visual field
  const [visibleWitnesses, setVisibleWitnesses] = useState<Witness[]>([]);
  const [isPlayingStream, setIsPlayingStream] = useState(true);
  const [activeWitness, setActiveWitness] = useState<Witness | null>(null);
  const [stage, setStage] = useState<SpawnStage>('idle');
  const [spawnCoords, setSpawnCoords] = useState({ startX: 50, startY: 45, targetX: 50, targetY: 45 });
  const [isLiveArrival, setIsLiveArrival] = useState(false);

  const ambientTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastArrivalTimestampRef = useRef<number>(Date.now());

  // 5-step lifecycle for witness presentation
  const runPresentationCycle = useCallback((targetWitness: Witness, live = false) => {
    setIsLiveArrival(live);
    lastArrivalTimestampRef.current = Date.now();

    // Destination coordinates based on semantic demo_x / demo_y
    const targetX = 50 + targetWitness.demo_x * 35;
    const targetY = 50 + targetWitness.demo_y * 35;

    // Start near center with slight organic randomness
    const startX = 48 + (Math.random() * 8 - 4);
    const startY = 46 + (Math.random() * 8 - 4);

    setSpawnCoords({ startX, startY, targetX, targetY });
    setActiveWitness(targetWitness);

    // 1. Yeni node doğsun & 2. Kısa sözsüz voice-family sesi çalsın
    setStage('birth');
    soundAdapter.playVoiceCue(targetWitness.voice_family);

    // 3. Şahitlik cümlesi birkaç saniye okunsun
    setTimeout(() => {
      setStage('read');
    }, 500);

    // 4. Node ilişkili bölgeye doğru hareket etsin
    setTimeout(() => {
      setStage('drift');
    }, live ? 5000 : 4200);

    // 5. Kolektif alana karışsın
    setTimeout(() => {
      setStage('settled');
    }, live ? 7600 : 6800);
  }, []);

  // Handle incoming realtime witness (from mobile, web, or backend SSE)
  const handleRealtimeNewWitness = useCallback(
    (newWitness: Witness) => {
      // 1. Add to exhibition list and maintain strictly last 100 records
      setVisibleWitnesses((prev) => {
        const withoutIncoming = prev.filter((w) => w.id !== newWitness.id);
        const updated = [newWitness, ...withoutIncoming];
        // FIFO: Drop oldest if exceeding 100
        return updated.slice(0, MAX_EXHIBITION_NODES);
      });

      // 2. Immediately trigger 5-step lifecycle
      runPresentationCycle(newWitness, true);
    },
    [runPresentationCycle]
  );

  // Initial load: Fetch latest 100 witnesses from server / store
  useEffect(() => {
    let isMounted = true;

    witnessRepo.fetchLatestWitnesses(MAX_EXHIBITION_NODES).then((latest) => {
      if (!isMounted) return;
      setVisibleWitnesses(latest.slice(0, MAX_EXHIBITION_NODES));

      // Trigger initial welcoming witness if available
      if (latest.length > 0) {
        setTimeout(() => {
          if (isMounted) {
            runPresentationCycle(latest[0], false);
          }
        }, 1200);
      }
    });

    // Realtime subscription: receives SSE events from backend instantaneously
    const unsubscribe = witnessRepo.subscribeToNewWitnesses((witness) => {
      if (isMounted) {
        handleRealtimeNewWitness(witness);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [handleRealtimeNewWitness, runPresentationCycle]);

  // Ambient showcase cycle (runs only when no realtime arrival in the last 11 seconds)
  useEffect(() => {
    if (!isPlayingStream) return;

    ambientTimerRef.current = setInterval(() => {
      const timeSinceLastArrival = Date.now() - lastArrivalTimestampRef.current;
      if (timeSinceLastArrival < 11000) return; // Do not interrupt recently arrived realtime witness

      if (visibleWitnesses.length > 0) {
        const randomExisting = visibleWitnesses[Math.floor(Math.random() * visibleWitnesses.length)];
        runPresentationCycle(randomExisting, false);
      }
    }, 12500);

    return () => {
      if (ambientTimerRef.current) clearInterval(ambientTimerRef.current);
    };
  }, [isPlayingStream, visibleWitnesses, runPresentationCycle]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#04060a] select-none">
      {/* Background Living Cosmos Network (strictly rendering last 100 nodes) */}
      <div className="absolute inset-0 z-0 opacity-80">
        <NetworkCanvas
          witnesses={visibleWitnesses}
          selectedWitness={stage === 'drift' || stage === 'settled' ? activeWitness : null}
          connectedEdges={[]}
          onSelectWitness={() => {}}
        />
      </div>

      {/* Cinematic Vignette */}
      <div className="absolute inset-0 z-1 pointer-events-none bg-radial from-transparent via-black/40 to-black/85" />

      {/* Top Left: Conceptual artwork indicator - “Başkalarının şahitliklerine şahit ol.” */}
      <div className="absolute top-6 left-8 z-10 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <h2 className="text-sm font-serif tracking-[0.2em] uppercase text-white">
            ŞAHİTLİK
          </h2>
          <span className="text-[10px] font-mono text-slate-400 border border-white/10 px-1.5 py-0.5 rounded-full ml-1">
            {visibleWitnesses.length} / 100
          </span>
        </div>
        <p className="text-xs text-slate-300 font-serif italic tracking-wide">
          Başkalarının şahitliklerine şahit ol.
        </p>
      </div>

      {/* Top Right: Minimal Controls */}
      <div className="absolute top-6 right-8 z-10 flex items-center gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
          <button
            onClick={() => {
              if (visibleWitnesses.length > 0) {
                const pick = visibleWitnesses[Math.floor(Math.random() * visibleWitnesses.length)];
                runPresentationCycle(pick, true);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Şahitlik Döngüsü"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Yankı</span>
          </button>
          <button
            onClick={() => setIsPlayingStream(!isPlayingStream)}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title={isPlayingStream ? 'Akışı Duraklat' : 'Akışı Başlat'}
          >
            {isPlayingStream ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onExitExhibition}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Sergi Modundan Çık"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Exhibition Experience: Birth -> Reading -> Drift -> Settle */}
      {activeWitness && stage !== 'idle' && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Animated Birth Node Point */}
          <div
            style={{
              left: `${stage === 'drift' ? spawnCoords.targetX : spawnCoords.startX}%`,
              top: `${stage === 'drift' ? spawnCoords.targetY : spawnCoords.startY}%`,
              transition: stage === 'drift' ? 'all 2.4s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute flex items-center justify-center pointer-events-none"
          >
            {/* Glowing Birth Halo */}
            <div
              className={`rounded-full transition-all duration-700 ${
                stage === 'birth'
                  ? 'w-28 h-28 bg-amber-400/35 blur-xl scale-125 animate-pulse'
                  : stage === 'read'
                  ? 'w-16 h-16 bg-amber-400/20 blur-md scale-100'
                  : 'w-4 h-4 bg-white/40 blur-xs scale-75'
              }`}
            />
            <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_15px_#fff]" />
          </div>

          {/* Large Typographic Reading Phase */}
          <div
            className={`absolute inset-0 flex items-center justify-center p-8 transition-all duration-1000 ${
              stage === 'birth'
                ? 'opacity-0 scale-95 translate-y-3'
                : stage === 'read'
                ? 'opacity-100 scale-100 translate-y-0'
                : stage === 'drift'
                ? 'opacity-20 scale-95 -translate-y-6 blur-xs'
                : 'opacity-0'
            }`}
          >
            <div className="max-w-3xl text-center space-y-6">
              {isLiveArrival && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-200 text-xs font-serif tracking-wider uppercase animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-ping" />
                  Yeni Şahitlik İntikali
                </div>
              )}

              <blockquote className="text-2xl sm:text-4xl md:text-5xl font-serif font-light text-white leading-relaxed tracking-wide drop-shadow-[0_4px_40px_rgba(0,0,0,0.95)]">
                “{activeWitness.text}”
              </blockquote>

              <div className="flex items-center justify-center gap-3 text-xs sm:text-sm text-slate-300 font-sans tracking-widest uppercase">
                <span>{activeWitness.city || 'İstanbul'}</span>
                <span className="text-slate-600">·</span>
                <span>{activeWitness.local_hour ? `${activeWitness.local_hour}:00` : 'Şimdi'}</span>
                {activeWitness.weather && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span>{activeWitness.weather.condition}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Right: Clean Exhibition QR Prompt “Sen de şahitlik bırak.” */}
      <div className="absolute bottom-6 right-8 z-10 p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl flex items-center gap-3.5 shadow-2xl">
        <button
          onClick={onOpenComposer}
          className="text-left group cursor-pointer"
        >
          <p className="text-xs font-medium text-white group-hover:text-amber-200 transition-colors">
            Sen de şahitlik bırak.
          </p>
          <p className="text-[11px] text-slate-400">
            Kendi fark ettiğin bir anı ağa ekle
          </p>
        </button>

        <button
          onClick={onOpenQrPoster}
          title="Sergi QR Afişini Aç"
          className="p-1 bg-white rounded-lg shadow-sm hover:ring-2 hover:ring-amber-400/50 transition-all cursor-pointer"
        >
          <QrCodeDisplay
            value={typeof window !== 'undefined' ? window.location.origin : 'https://sahitlik.art'}
            size={40}
          />
        </button>
      </div>

      {/* Bottom Left: Core Artwork Statement */}
      <div className="absolute bottom-6 left-8 z-10 text-xs text-slate-400 font-serif italic max-w-sm hidden sm:block">
        “Yaşananların değil, fark edilenlerin haritası.”
      </div>
    </div>
  );
};
