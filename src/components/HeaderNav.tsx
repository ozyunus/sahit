import React from 'react';
import { ViewMode } from '../types';
import { Volume2, VolumeX, Sparkles, User, Users, PlusCircle, Maximize2, List, QrCode, Download } from 'lucide-react';

interface HeaderNavProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onOpenHumanModal: () => void;
  onOpenComposer: () => void;
  onOpenQrPoster: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isListView: boolean;
  onToggleListView: () => void;
  userWitnessCount: number;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentView,
  onViewChange,
  onOpenHumanModal,
  onOpenComposer,
  onOpenQrPoster,
  isMuted,
  onToggleMute,
  isListView,
  onToggleListView,
  userWitnessCount,
}) => {
  return (
    <header className="relative z-20 w-full border-b border-white/8 bg-[#0b0d13]/85 backdrop-blur-md px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onViewChange('biz')}
          className="text-left group focus-visible:outline-none"
        >
          <h1 className="text-lg md:text-xl font-medium tracking-[0.16em] uppercase text-white font-serif transition-colors group-hover:text-amber-200/90">
            Şahitlik
          </h1>
          <p className="text-[11px] md:text-xs text-slate-400 font-serif italic tracking-wide">
            Yaşananların değil, fark edilenlerin haritası.
          </p>
        </button>
      </div>

      {/* Main Navigation Tabs */}
      <nav className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => onViewChange('biz')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            currentView === 'biz'
              ? 'bg-white/12 text-white shadow-sm ring-1 ring-white/15'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>BİZ</span>
        </button>

        <button
          onClick={() => onViewChange('ben')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            currentView === 'ben'
              ? 'bg-white/12 text-white shadow-sm ring-1 ring-white/15'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <User className="w-3.5 h-3.5 text-amber-300/80" />
          <span>BEN</span>
          {userWitnessCount > 0 && (
            <span className="text-[10px] text-amber-300 font-mono ml-0.5">
              ({userWitnessCount})
            </span>
          )}
        </button>

        <button
          onClick={onOpenComposer}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 border border-amber-400/25 transition-all shadow-sm"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Şahitlik Bırak</span>
        </button>
      </nav>

      {/* Aux Actions: View mode, Exhibition, Audio, Identity */}
      <div className="flex items-center gap-2">
        {/* Toggle List/Graph Mode for Accessibility */}
        <button
          onClick={onToggleListView}
          title={isListView ? 'Ağ Grafiğini Göster' : 'Metin Listesini Göster (Erişilebilirlik)'}
          className={`p-2 rounded-md border text-xs transition-colors ${
            isListView
              ? 'bg-white/15 border-white/25 text-white'
              : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <List className="w-3.5 h-3.5" />
        </button>

        {/* Exhibition Mode Button */}
        <button
          onClick={() => onViewChange('exhibition')}
          title="Sergi Modu (Tam Ekran Projeksiyon)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline">Sergi Modu</span>
        </button>

        {/* Dedicated QR Poster Page Button */}
        <button
          onClick={onOpenQrPoster}
          title="Sergi QR Afişi & Yazdır"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <QrCode className="w-3.5 h-3.5 text-amber-300/80" />
          <span className="hidden lg:inline">QR Afişi</span>
        </button>

        {/* Mute/Unmute Audio */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
          className="p-2 rounded-md border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* HumanID Modal Trigger */}
        <button
          onClick={onOpenHumanModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20 transition-colors font-mono"
        >
          <Sparkles className="w-3 h-3 text-amber-300" />
          <span className="hidden sm:inline">HumanID</span>
        </button>

        {/* Project ZIP Download */}
        <a
          href="/sahitlik-app.zip"
          download="sahitlik-app.zip"
          title="Tüm Proje Dosyalarını İndir (.ZIP)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all shadow-sm font-medium"
        >
          <Download className="w-3.5 h-3.5 text-amber-300" />
          <span className="hidden sm:inline">İndir (.ZIP)</span>
        </a>
      </div>
    </header>
  );
};
