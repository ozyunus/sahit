import React, { useState } from 'react';
import { Human, HumanCredential } from '../types';
import { witnessRepo } from '../services/witnessRepository';
import { QrCodeDisplay } from './QrCodeDisplay';
import { X, Copy, Check, QrCode, KeyRound, AlertTriangle, ShieldCheck } from 'lucide-react';

interface HumanIdModalProps {
  human: Human | null;
  credential: HumanCredential | null;
  onIdentityChanged: () => void;
  onClose: () => void;
}

export const HumanIdModal: React.FC<HumanIdModalProps> = ({
  human,
  credential,
  onIdentityChanged,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'card' | 'recover'>('card');
  const [copied, setCopied] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [recoverSuccess, setRecoverSuccess] = useState(false);

  const handleCopySecret = async () => {
    if (!credential?.recovery_secret) return;
    try {
      await navigator.clipboard.writeText(credential.recovery_secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleRecover = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverError(null);
    const result = witnessRepo.recoverIdentity(recoveryInput);
    if (result.success) {
      setRecoverSuccess(true);
      setTimeout(() => {
        onIdentityChanged();
        onClose();
      }, 1000);
    } else {
      setRecoverError(result.message || 'Hata oluştu.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0e1118] border border-white/12 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-300/80 text-xs font-mono uppercase tracking-wider">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Kişisel Devamlılık ve Güvenlik</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif text-white tracking-wide">
            {activeTab === 'card' ? 'HumanID ve Devam Kartı' : 'Şahitliklerime Devam Et'}
          </h2>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg border border-white/8 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('card')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'card' ? 'bg-white/15 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mevcut Kimlik Kartı
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recover')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'recover' ? 'bg-white/15 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Başka Cihazdan Devam Et
          </button>
        </div>

        {activeTab === 'card' ? (
          <div className="space-y-5">
            {/* The Identity Card */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-[#141824] to-[#0c0e14] border border-amber-400/25 space-y-4 shadow-inner">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/8 pb-3">
                <span className="font-mono text-amber-300/90 font-medium">ŞAHİTLİK HUMAN BELGESİ</span>
                <span className="font-mono text-[11px] text-slate-400">
                  {human?.created_at_utc ? new Date(human.created_at_utc).toLocaleDateString('tr-TR') : 'Bugün'}
                </span>
              </div>

              {/* Public HumanID */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 uppercase font-mono tracking-wider">
                  Public HumanID (Görünür Kimlik)
                </label>
                <div className="font-mono text-sm sm:text-base text-white tracking-widest bg-black/30 px-3 py-2 rounded-lg border border-white/8 flex items-center justify-between">
                  <span>{human?.human_id || 'human_XXXXXXXX'}</span>
                  <span className="text-[10px] text-slate-400 font-sans">Tek başına erişim sağlamaz</span>
                </div>
              </div>

              {/* Secret Recovery Code */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-amber-300 uppercase font-mono tracking-wider">
                    Özel Recovery Kodu (Gizli Tut)
                  </span>
                  {copied && <span className="text-emerald-400 text-[11px]">Kopyalandı!</span>}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    type="password"
                    value={credential?.recovery_secret || ''}
                    className="w-full font-mono text-xs text-slate-200 bg-black/40 px-3 py-2 rounded-lg border border-white/10 select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopySecret}
                    className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                    title="Kodu Kopyala"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Real Dynamic QR Code */}
              <div className="pt-2 flex items-center gap-4">
                <div className="p-2 bg-white rounded-xl shadow-md shrink-0 border border-white/20">
                  <QrCodeDisplay
                    value={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/#continue?rid=${human?.human_id || ''}&secret=${encodeURIComponent(credential?.recovery_secret || '')}`
                        : `https://sahitlik.art/#continue?rid=${human?.human_id || ''}`
                    }
                    size={76}
                  />
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-medium text-white flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-amber-300" />
                    <span>Cihazlar arası devam QR'ı</span>
                  </p>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Telefonunun kamerasıyla bu QR kodu okuttuğunda şahitlik belleğin otomatik olarak diğer cihaza aktarılır.
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy & Safety Warning */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-200/90">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <p className="leading-relaxed">
                E-posta veya şifre kullanılmaz. Recovery kodun kaybolursa geçmiş şahitlik ağına tekrar ulaşmak mümkün olmayabilir.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRecover} className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Daha önce başka bir cihazda aldığın recovery kodunu buraya girerek şahitlik belleğini bu cihaza bağlayabilirsin.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Recovery Kodunu Gir</label>
              <input
                type="text"
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                placeholder="sahit-XXXXXX-XXXXXX-XXXXXX"
                required
                className="w-full bg-[#131722] border border-white/15 focus:border-amber-400/50 rounded-xl p-3 text-sm text-slate-100 font-mono focus:outline-none"
              />
            </div>

            {recoverError && (
              <p className="text-xs text-rose-400">{recoverError}</p>
            )}

            {recoverSuccess && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Kimlik başarıyla bağlandı. Yenileniyor…</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!recoveryInput.trim() || recoverSuccess}
              className="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-400/30 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
            >
              Şahitliklerime Devam Et
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
