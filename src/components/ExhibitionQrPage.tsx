import React, { useState } from 'react';
import { QrCodeDisplay } from './QrCodeDisplay';
import { ArrowLeft, Printer, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';

interface ExhibitionQrPageProps {
  onBack: () => void;
}

export const ExhibitionQrPage: React.FC<ExhibitionQrPageProps> = ({ onBack }) => {
  const [copied, setCopied] = useState(false);

  // App URL for visitors to submit witness
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sahitlik.art';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a0c10] text-[#e2e4e9] p-6 sm:p-12 flex flex-col justify-between items-center selection:bg-amber-400 selection:text-black">
      {/* Top action bar (hidden during print) */}
      <div className="w-full max-w-2xl flex items-center justify-between pb-6 border-b border-white/10 print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Ağa Geri Dön</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Kopyalandı' : 'Bağlantıyı Kopyala'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-xs font-medium transition-all shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Sergi Afişini Yazdır</span>
          </button>
        </div>
      </div>

      {/* Main Standalone Exhibition Poster Card */}
      <div className="my-auto w-full max-w-lg p-8 sm:p-12 rounded-3xl bg-[#10131a] border border-white/12 shadow-2xl text-center space-y-8 print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
        {/* Exhibition Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono uppercase tracking-[0.2em] text-amber-300 print:text-neutral-800 print:border-neutral-300">
            <Sparkles className="w-3 h-3" />
            <span>YAŞAYAN VERİ ESERİ</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-serif font-medium tracking-tight text-white print:text-black">
            ŞAHİTLİK
          </h1>

          <p className="text-sm sm:text-base font-serif italic text-slate-300 print:text-neutral-700 max-w-sm mx-auto leading-relaxed">
            “Yaşananların değil, fark edilenlerin haritası.”
          </p>
        </div>

        {/* Real Dynamic Scannable QR Code */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-5 bg-white rounded-2xl shadow-xl border border-white/20 print:border-neutral-400">
            <QrCodeDisplay value={appUrl} size={220} />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-serif font-normal text-white print:text-black">
              Sen de şahitlik bırak.
            </h2>
            <p className="text-xs text-slate-400 print:text-neutral-600 max-w-xs mx-auto leading-relaxed">
              Telefonunun kamerasıyla QR kodu tara; bugün fark ettiğin bir anı doğrudan bu alana ekle.
            </p>
          </div>
        </div>

        {/* Direct URL Footnote */}
        <div className="pt-6 border-t border-white/8 print:border-neutral-300 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-slate-400 print:text-neutral-700">
            <ExternalLink className="w-3 h-3" />
            <span>{appUrl.replace(/^https?:\/\//, '')}</span>
          </div>
          <p className="text-[10px] text-slate-400 print:text-neutral-500 font-sans">
            Hesap veya şifre gerekmez · Anonim ve sözsüz ses eşliğinde kaydedilir
          </p>
        </div>
      </div>

      {/* Museum / Gallery Footer */}
      <footer className="w-full max-w-2xl text-center pt-6 text-[11px] text-slate-400 print:text-neutral-500 font-serif italic">
        Eser, insanların zaman içinde bıraktığı şahitliklerin ve makinenin bunlar arasında kurduğu ilişkilerin yaşayan bir yansımasıdır.
      </footer>
    </div>
  );
};
