import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Witness } from '../types';
import { NetworkCanvas } from './NetworkCanvas';
import { soundAdapter } from '../services/soundAdapter';
import { witnessRepo } from '../services/witnessRepository';
import { QrCodeDisplay } from './QrCodeDisplay';
import { Minimize2, Play, Pause, Sparkles, Volume2, VolumeX } from 'lucide-react';

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
  const [visibleWitnesses, setVisibleWitnesses] = useState<Witness[]>([]);
  const [isPlayingStream, setIsPlayingStream] = useState(true);
  const [activeWitness, setActiveWitness] = useState<Witness | null>(null);
  const [stage, setStage] = useState<SpawnStage>('idle');
  const [spawnCoords, setSpawnCoords] = useState({ startX: 50, startY: 45, targetX: 50, targetY: 45 });
  const [isLiveArrival, setIsLiveArrival] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const ambientTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastArrivalTimestampRef = useRef<number>(Date.now());
  const activeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Full presentation cycle (8.5 seconds for new arrival so everyone in the room reads and hears it)
  const runPresentationCycle = useCallback((targetWitness: Witness, live = false) => {
    setIsLiveArrival(live);
    lastArrivalTimestampRef.current = Date.now();

    // Destination coordinates based on semantic demo_x / demo_y
    const targetX = 50 + targetWitness.demo_x * 35;
    const targetY = 50 + targetWitness.demo_y * 35;

    const startX = 50 + (Math.random() * 6 - 3);
    const startY = 46 + (Math.random() * 6 - 3);

    setSpawnCoords({ startX, startY, targetX, targetY });
    setActiveWitness(targetWitness);

    // 1. Yeni node doğsun & 2. Sesi içeriye gelsin (audible warm chime & formant)
    setStage('birth');
    soundAdapter.unlockAudio();
    soundAdapter.playVoiceCue(targetWitness.voice_family);

    // 3. Şahitlik cümlesi herkesin göreceği şekilde belirsin (read)
    setTimeout(() => {
      setStage('read');
    }, 400);

    // 4. Node ve metin ilişkili bölgeye doğru hareket etsin (drift)
    const driftDelay = live ? 7000 : 4500;
    setTimeout(() => {
      setStage('drift');
    }, driftDelay);

    // 5. Kolektif alana karışsın (settled)
    const settleDelay = live ? 9200 : 6800;
    if (activeTimeoutRef.current) clearTimeout(activeTimeoutRef.current);
    activeTimeoutRef.current = setTimeout(() => {
      setStage('settled');
    }, settleDelay);
  }, []);

  // Handle incoming realtime witness (from mobile, web, or backend SSE)
  const handleRealtimeNewWitness = useCallback(
    (newWitness: Witness) => {
      // 1. Add to exhibition list and maintain strictly last 100 records (FIFO)
      setVisibleWitnesses((prev) => {
        const withoutIncoming = prev.filter((w) => w.id !== newWitness.id);
        const updated = [newWitness, ...withoutIncoming];
        return updated.slice(0, MAX_EXHIBITION_NODES);
      });

      // 2. Play sound and trigger spotlight ceremony immediately
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

      if (latest.length > 0) {
        setTimeout(() => {
          if (isMounted) {
            runPresentationCycle(latest[0], false);
          }
        }, 1000);
      }
    });

    // Realtime subscription (Server-Sent Events + BroadcastChannel)
    const unsubscribe = witnessRepo.subscribeToNewWitnesses((witness) => {
      if (isMounted) {
        handleRealtimeNewWitness(witness);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (activeTimeoutRef.current) clearTimeout(activeTimeoutRef.current);
    };
  }, [handleRealtimeNewWitness, runPresentationCycle]);

  // Ambient showcase cycle (runs when no realtime arrival in last 12 seconds)
  useEffect(() => {
    if (!isPlayingStream) return;

    ambientTimerRef.current = setInterval(() => {
      const timeSinceLastArrival = Date.now() - lastArrivalTimestampRef.current;
      if (timeSinceLastArrival < 12000) return;

      if (visibleWitnesses.length > 0) {
        const randomExisting = visibleWitnesses[Math.floor(Math.random() * visibleWitnesses.length)];
        runPresentationCycle(randomExisting, false);
      }
    }, 13000);

    return () => {
      if (ambientTimerRef.current) clearInterval(ambientTimerRef.current);
    };
  }, [isPlayingStream, visibleWitnesses, runPresentationCycle]);

  const handleTestAudio = () => {
    soundAdapter.unlockAudio();
    setAudioUnlocked(true);
    soundAdapter.playVoiceCue('adult_female');
  };

  const handleToggleMute = () => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    soundAdapter.setMuted(nextMuted);
  };

  // Recent 4 witnesses kept visible so previous thoughts remain readable on screen
  const recentReadableWitnesses = visibleWitnesses.slice(0, 4);

  return (
    <div
      onClick={() => {
        if (!audioUnlocked) {
          soundAdapter.unlockAudio();
          setAudioUnlocked(true);
        }
      }}
      className="relative w-screen h-screen overflow-hidden bg-[#04060a] select-none"
    >
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
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]" />
          <h2 className="text-sm font-serif tracking-[0.2em] uppercase text-white">
            ŞAHİTLİK
          </h2>
          <span className="text-[10px] font-mono text-slate-400 border border-white/10 px-2 py-0.5 rounded-full ml-1 bg-white/5">
            {visibleWitnesses.length} / 100 şahitlik alanda
          </span>
        </div>
        <p className="text-xs text-slate-300 font-serif italic tracking-wide">
          Başkalarının şahitliklerine şahit ol.
        </p>
      </div>

      {/* Top Right: Minimal Gallery Controls */}
      <div className="absolute top-6 right-8 z-10 flex items-center gap-3">
        {/* Sound Test / Status Button */}
        <button
          onClick={handleTestAudio}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-slate-200 bg-black/40 hover:bg-white/10 border border-white/10 transition-colors shadow-lg cursor-pointer"
          title="Sesi Test Et"
        >
          <Volume2 className="w-3.5 h-3.5 text-amber-300" />
          <span className="hidden sm:inline">Ses Açık (Test Et)</span>
        </button>

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
            className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isPlayingStream ? 'Akışı Duraklat' : 'Akışı Başlat'}
          >
            {isPlayingStream ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleToggleMute}
            className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isAudioMuted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-slate-300" />}
          </button>
          <button
            onClick={onExitExhibition}
            className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Sergi Modundan Çık"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Left Floating Stream: "Eski yazılanlar kalsın" - Recent 3 whispers kept visible and readable */}
      <div className="absolute top-20 left-8 z-10 max-w-sm space-y-2 pointer-events-none hidden md:block">
        <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
          Alandaki Son Şahitlikler
        </p>
        <div className="space-y-1.5">
          {recentReadableWitnesses.map((rw) => (
            <div
              key={rw.id}
              className={`p-2.5 rounded-xl border backdrop-blur-md transition-all duration-700 ${
                activeWitness?.id === rw.id
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-100 shadow-[0_0_15px_rgba(251,191,36,0.2)]'
                  : 'bg-black/30 border-white/5 text-slate-300'
              }`}
            >
              <p className="text-xs font-serif leading-snug line-clamp-2">
                “{rw.text}”
              </p>
              <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                <span>{rw.city || 'İstanbul'}</span>
                <span>·</span>
                <span>{rw.local_hour ? `${rw.local_hour}:00` : 'Az önce'}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Center Arrival Ceremony: Bold, Unmistakable Presence for Everyone in the Venue */}
      {activeWitness && stage !== 'idle' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          {/* Animated Glowing Birth Beacon & Expanding Ripple Ring */}
          <div
            style={{
              left: `${stage === 'drift' ? spawnCoords.targetX : spawnCoords.startX}%`,
              top: `${stage === 'drift' ? spawnCoords.targetY : spawnCoords.startY}%`,
              transition: stage === 'drift' ? 'all 2.4s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute flex items-center justify-center pointer-events-none"
          >
            {/* Expanding Golden Ripple Halo on New Arrival */}
            {isLiveArrival && (
              <div className="absolute w-36 h-36 rounded-full border-2 border-amber-400/60 animate-ping" />
            )}
            <div
              className={`rounded-full transition-all duration-700 ${
                stage === 'birth'
                  ? 'w-32 h-32 bg-amber-400/40 blur-2xl scale-150 animate-pulse'
                  : stage === 'read'
                  ? 'w-20 h-20 bg-amber-400/25 blur-lg scale-110'
                  : 'w-6 h-6 bg-white/40 blur-xs scale-90'
              }`}
            />
            <div className="w-5 h-5 rounded-full bg-white shadow-[0_0_25px_#fbbf24]" />
          </div>

          {/* Prominent Typographic Announcement Card / Spotlight (Unmistakable to everyone watching) */}
          <div
            className={`max-w-4xl mx-auto px-6 text-center transition-all duration-700 ${
              stage === 'birth'
                ? 'opacity-80 scale-95 translate-y-2'
                : stage === 'read'
                ? 'opacity-100 scale-100 translate-y-0'
                : stage === 'drift'
                ? 'opacity-40 scale-95 -translate-y-6 blur-xs'
                : 'opacity-0 scale-90'
            }`}
          >
            <div className="p-8 sm:p-12 rounded-3xl bg-black/75 backdrop-blur-2xl border border-amber-400/30 shadow-[0_0_80px_rgba(0,0,0,0.95)] space-y-6">
              {/* Distinctive Live Arrival Banner */}
              <div className="flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="px-4 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-200 text-xs font-medium tracking-[0.2em] uppercase shadow-md">
                  {isLiveArrival ? '✨ YENİ ŞAHİTLİK GELDİ' : 'ŞAHİTLİK YANKISI'}
                </span>
              </div>

              {/* Huge, Dignified Readable Quote */}
              <blockquote className="text-3xl sm:text-5xl md:text-6xl font-serif font-light text-white leading-tight tracking-wide drop-shadow-[0_4px_30px_rgba(0,0,0,0.95)]">
                “{activeWitness.text}”
              </blockquote>

              {/* Attribution and Context */}
              <div className="flex items-center justify-center gap-3 text-xs sm:text-sm text-slate-300 font-sans tracking-widest uppercase">
                <span className="text-amber-200">{activeWitness.city || 'İstanbul'}</span>
                <span className="text-slate-600">·</span>
                <span>{activeWitness.local_hour ? `${activeWitness.local_hour}:00` : 'Şimdi'}</span>
                {activeWitness.weather && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="capitalize">{activeWitness.weather.condition}</span>
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
