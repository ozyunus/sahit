import React, { useState, useEffect, useMemo } from 'react';
import { FilterState, ViewMode, Witness } from './types';
import { witnessRepo } from './services/witnessRepository';
import { soundAdapter } from './services/soundAdapter';
import { HeaderNav } from './components/HeaderNav';
import { FilterBar } from './components/FilterBar';
import { NetworkCanvas, THEME_PALETTE } from './components/NetworkCanvas';
import { WitnessListView } from './components/WitnessListView';
import { PersonalTimelineView } from './components/PersonalTimelineView';
import { WitnessComposer } from './components/WitnessComposer';
import { WitnessDetailModal } from './components/WitnessDetailModal';
import { HumanIdModal } from './components/HumanIdModal';
import { ExhibitionView } from './components/ExhibitionView';
import { ExhibitionQrPage } from './components/ExhibitionQrPage';
import { FirstVisitPrompt } from './components/FirstVisitPrompt';
import { Plus, CheckCircle2, ChevronDown, RotateCcw } from 'lucide-react';

export default function App() {
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [currentView, setCurrentView] = useState<ViewMode>('biz');
  const [personalSubView, setPersonalSubView] = useState<'map' | 'timeline'>('map');
  const [selectedWitness, setSelectedWitness] = useState<Witness | null>(null);

  // Modals & Panels
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isHumanModalOpen, setIsHumanModalOpen] = useState(false);
  const [isQrPosterOpen, setIsQrPosterOpen] = useState(false);
  const [isListView, setIsListView] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  // First-visit onboarding state
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  // Filters state matching Screen 6 & 8
  const [filters, setFilters] = useState<FilterState>({
    time: 'today',
    weather: 'all',
    hour: 'all',
    search: '',
  });

  const [selectedCity, setSelectedCity] = useState<string>('İstanbul');

  // Load initial data
  const refreshData = () => {
    setWitnesses([...witnessRepo.getAllWitnesses()]);
  };

  useEffect(() => {
    refreshData();

    // Check QR continuation URL hash
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && (hash.includes('continue') || hash.includes('secret='))) {
        const urlParams = new URLSearchParams(hash.replace(/^#\??(continue\??)?/, ''));
        const secret = urlParams.get('secret');
        if (secret) {
          const res = witnessRepo.recoverIdentity(decodeURIComponent(secret));
          if (res.success) {
            setRecoveryNotice('Şahitlik hafızan QR kod ile bu cihaza bağlandı.');
            refreshData();
            setTimeout(() => setRecoveryNotice(null), 5000);
          }
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      const visited = localStorage.getItem('sahitlik_visited_v1');
      if (!visited) {
        setIsFirstVisit(true);
      }
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(motionQuery.matches);
    }

    // Subscribe to incoming realtime witnesses from backend SSE stream
    const unsubscribe = witnessRepo.subscribeToNewWitnesses(() => {
      refreshData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleFirstVisitComplete = (newWitness?: Witness) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sahitlik_visited_v1', 'true');
    }
    setIsFirstVisit(false);
    refreshData();
    if (newWitness) {
      setCurrentView('ben');
      setSelectedWitness(newWitness);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundAdapter.setMuted(nextMuted);
  };

  // Connected edges and neighbor calculation for selected node (Screen 7)
  const { connectedEdges, connectedTargets } = useMemo(() => {
    if (!selectedWitness) return { connectedEdges: [], connectedTargets: [] };
    const { edges, targets } = witnessRepo.getWitnessConnections(selectedWitness.id, 4);
    return { connectedEdges: edges, connectedTargets: targets };
  }, [selectedWitness, witnesses]);

  // User-specific witnesses
  const userWitnesses = useMemo(() => {
    return witnesses.filter((w) => w.is_user);
  }, [witnesses]);

  // Base list depending on BEN vs BİZ
  const activeBaseWitnesses = useMemo(() => {
    if (currentView === 'ben') {
      return userWitnesses.length > 0 ? userWitnesses : witnesses.slice(0, 48);
    }
    return witnesses;
  }, [currentView, witnesses, userWitnesses]);

  // Filtered witnesses
  const filteredWitnesses = useMemo(() => {
    return witnessRepo.filterWitnesses(activeBaseWitnesses, filters);
  }, [activeBaseWitnesses, filters]);

  const highlightedIds = useMemo(() => {
    return new Set(filteredWitnesses.map((w) => w.id));
  }, [filteredWitnesses]);

  const currentHuman = witnessRepo.getHuman();
  const currentCredential = witnessRepo.getCredential();

  // If QR poster page is requested, render standalone printable exhibition poster
  if (isQrPosterOpen) {
    return <ExhibitionQrPage onBack={() => setIsQrPosterOpen(false)} />;
  }

  // If in exhibition mode, render standalone immersive view (Screen 9)
  if (currentView === 'exhibition') {
    return (
      <>
        <ExhibitionView
          onExitExhibition={() => setCurrentView('biz')}
          onOpenComposer={() => setIsComposerOpen(true)}
          onOpenQrPoster={() => setIsQrPosterOpen(true)}
        />
        {isComposerOpen && (
          <WitnessComposer
            onClose={() => setIsComposerOpen(false)}
            onSuccess={handleComposerSuccess}
          />
        )}
      </>
    );
  }

  return (
    <div className="relative w-screen h-screen flex flex-col bg-[#04060a] text-[#e2e4e9] overflow-hidden select-none">
      {/* Recovery notification banner if transferred via QR */}
      {recoveryNotice && (
        <div className="z-50 bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-200 px-4 py-2 text-xs flex items-center justify-center gap-2 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{recoveryNotice}</span>
        </div>
      )}

      {/* 1. Header Navigation */}
      <HeaderNav
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          setSelectedWitness(null);
        }}
        onOpenHumanModal={() => setIsHumanModalOpen(true)}
        onOpenComposer={() => setIsComposerOpen(true)}
        onOpenQrPoster={() => setIsQrPosterOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isListView={isListView}
        onToggleListView={() => setIsListView(!isListView)}
        userWitnessCount={userWitnesses.length}
      />

      {/* 2. Top Filter Bar (matching Screen 6 & 8) */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        filteredCount={filteredWitnesses.length}
        totalCount={activeBaseWitnesses.length}
      />

      {/* 3. Main Viewport */}
      <main className="relative flex-1 w-full overflow-hidden">
        {/* In BEN mode: Sub-toggle between "İlişki Haritası" (Screen 5) and "Zaman Çizelgesi" (Screen 4) */}
        {currentView === 'ben' && (
          <div className="absolute top-4 left-6 z-20 flex items-center gap-2 p-1 bg-[#121520]/80 backdrop-blur-md rounded-full border border-white/10 shadow-lg text-xs">
            <button
              onClick={() => setPersonalSubView('map')}
              className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                personalSubView === 'map'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Kişisel İlişki Haritası
            </button>
            <button
              onClick={() => setPersonalSubView('timeline')}
              className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                personalSubView === 'timeline'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Zaman Çizelgesi
            </button>
          </div>
        )}

        {isListView ? (
          <WitnessListView
            witnesses={filteredWitnesses}
            selectedWitness={selectedWitness}
            onSelectWitness={(w) => setSelectedWitness(w)}
          />
        ) : currentView === 'ben' && personalSubView === 'timeline' ? (
          /* Screen 4: Kişisel Zaman Çizelgesi */
          <PersonalTimelineView
            witnesses={userWitnesses}
            onSelectWitness={(w) => setSelectedWitness(w)}
            onOpenComposer={() => setIsComposerOpen(true)}
          />
        ) : (
          /* Screen 5 & Screen 6 & Screen 8: Living Constellation Canvas */
          <div className="relative w-full h-full">
            <NetworkCanvas
              witnesses={activeBaseWitnesses}
              selectedWitness={selectedWitness}
              highlightedIds={highlightedIds}
              connectedEdges={connectedEdges}
              onSelectWitness={(w) => setSelectedWitness(w)}
              reducedMotion={reducedMotion}
              isPersonalView={currentView === 'ben'}
              activeWeatherFilter={filters.weather}
            />

            {/* Conceptual Question & Subtext Overlay */}
            {currentView === 'biz' ? (
              <div className="absolute top-4 left-6 z-10 pointer-events-none space-y-0.5">
                <h2 className="text-base sm:text-lg font-serif text-white tracking-wide">
                  Biz neye şahit oluyoruz?
                </h2>
                <p className="text-xs text-slate-400 font-serif italic">
                  Yaşananların değil, fark edilenlerin kolektif topografyası.
                </p>
              </div>
            ) : (
              <div className="absolute top-4 left-6 z-10 pointer-events-none space-y-0.5">
                <h2 className="text-base sm:text-lg font-serif text-white tracking-wide">
                  Ben neye şahit oluyorum?
                </h2>
                <p className="text-xs text-slate-400 font-serif italic">
                  Zaman içinde kendi dikkatinin tekrarlarını ve değişimini keşfet.
                </p>
              </div>
            )}

            {/* In BEN mode: Sub-toggle between "İlişki Haritası" and "Zaman Çizelgesi" */}
            {currentView === 'ben' && (
              <div className="absolute top-4 right-6 z-20 flex items-center gap-1.5 p-1 bg-[#121520]/80 backdrop-blur-md rounded-full border border-white/10 shadow-lg text-xs">
                <button
                  onClick={() => setPersonalSubView('map')}
                  className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                    personalSubView === 'map'
                      ? 'bg-white text-black shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Kişisel İlişki Haritası
                </button>
                <button
                  onClick={() => setPersonalSubView('timeline')}
                  className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                    personalSubView === 'timeline'
                      ? 'bg-white text-black shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Zaman Çizelgesi
                </button>
              </div>
            )}

            {/* Bottom Controls: Quiet, unencumbered artistic touchpoints */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
              <button
                onClick={() => setIsComposerOpen(true)}
                title="Şahitlik Bırak"
                className="w-12 h-12 rounded-full bg-[#121522]/90 hover:bg-[#1a1f30] border border-white/20 text-white flex items-center justify-center shadow-[0_0_25px_rgba(0,0,0,0.8)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-6 h-6" />
              </button>
              <span className="text-[11px] text-slate-400 font-serif tracking-wider">
                Yakınlaş · Keşfet · Dokun
              </span>
            </div>

            {/* Weather active indicator: Positioned at bottom-20 right-6 to eliminate collision with bottom-6 right-6 zoom panel */}
            {filters.weather !== 'all' && (
              <div className="absolute bottom-20 right-6 z-10 flex items-center gap-2 pointer-events-auto">
                <div className="px-3.5 py-1.5 bg-[#121520]/90 backdrop-blur-md rounded-full border border-white/10 text-xs text-sky-200 shadow-xl">
                  <span>🌧️ Yağmur altında fark edilenler</span>
                </div>
                <button
                  onClick={() => setFilters({ ...filters, weather: 'all' })}
                  className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-full border border-white/10 text-xs text-white transition-colors cursor-pointer"
                >
                  Tümüne dön
                </button>
              </div>
            )}

            {/* Screen 5 Bottom Pill Filters in BEN Mode */}
            {currentView === 'ben' && personalSubView === 'map' && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 p-1 bg-[#121520]/80 backdrop-blur-md rounded-full border border-white/10 shadow-lg text-xs">
                {['Tümü', 'Son 1 ay', 'Son 1 yıl'].map((label, i) => (
                  <button
                    key={label}
                    onClick={() => {}}
                    className={`px-4 py-1.5 rounded-full font-medium transition-all ${
                      i === 0 ? 'bg-white text-black shadow-md' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 4. Selected Node Detail Modal matching Screen 7 */}
      {selectedWitness && (
        <WitnessDetailModal
          witness={selectedWitness}
          connectedEdges={connectedEdges}
          connectedWitnesses={connectedTargets}
          onSelectConnected={(w) => setSelectedWitness(w)}
          onClose={() => setSelectedWitness(null)}
        />
      )}

      {/* 5. Composer Modal matching Screen 2 & 3 */}
      {isComposerOpen && (
        <WitnessComposer
          initialVoiceFamily={currentHuman?.voice_family || 'adult_female'}
          onSuccess={(newWitness) => {
            setIsComposerOpen(false);
            refreshData();
            setCurrentView('ben');
            setSelectedWitness(newWitness);
          }}
          onClose={() => setIsComposerOpen(false)}
        />
      )}

      {/* 6. HumanID & Recovery Modal */}
      {isHumanModalOpen && (
        <HumanIdModal
          human={currentHuman}
          credential={currentCredential}
          onIdentityChanged={() => refreshData()}
          onClose={() => setIsHumanModalOpen(false)}
        />
      )}

      {/* 7. First Visit Onboarding Prompt matching Screen 1, 2, and 3 */}
      {isFirstVisit && (
        <FirstVisitPrompt onComplete={handleFirstVisitComplete} />
      )}
    </div>
  );
}
