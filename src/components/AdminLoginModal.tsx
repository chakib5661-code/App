import React, { useState } from 'react';
import { X, Lock, KeyRound, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock?: () => void;
  onSuccess?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onUnlock,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default PIN: "tulip" or "1234" or direct confirmation
    if (pin.toLowerCase().trim() === 'tulip' || pin.trim() === '1234' || pin.trim() === '') {
      if (onUnlock) onUnlock();
      if (onSuccess) onSuccess();
      setPin('');
      setError(false);
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-white">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Espace Gestionnaire</h3>
              <p className="text-[11px] text-slate-400">Tulip Fragrance Company</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Pour afficher les outils d'administration (import Excel, gestion des stocks et précommandes), confirmez votre accès :
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Code d'accès administrateur :
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(false);
                }}
                placeholder="Saisissez votre code administrateur"
                autoFocus
                className="w-full pl-3 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition p-1 cursor-pointer"
                title={showPin ? 'Masquer le code' : 'Afficher le code'}
                aria-label={showPin ? 'Masquer le code' : 'Afficher le code'}
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-950/60 border border-rose-800 rounded-lg p-2 text-xs text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Code d'accès incorrect. Veuillez vérifier votre saisie.</span>
            </div>
          )}

          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition cursor-pointer"
            >
              Déverrouiller
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
