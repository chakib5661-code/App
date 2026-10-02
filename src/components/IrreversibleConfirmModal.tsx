import React from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert, Database } from 'lucide-react';

export interface IrreversibleConfirmProps {
  isOpen: boolean;
  title: string;
  description: string;
  details?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const IrreversibleConfirmModal: React.FC<IrreversibleConfirmProps> = ({
  isOpen,
  title,
  description,
  details,
  confirmLabel = 'Confirmer la suppression (Réécrire la DB)',
  cancelLabel = 'Annuler (Ne rien modifier)',
  isDangerous = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-rose-600/80 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl shadow-rose-950/50 flex flex-col scale-100 animate-in zoom-in-95 duration-200">
        {/* Warning Header */}
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 p-5 border-b border-rose-800/60 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider mb-1">
                <ShieldAlert className="w-3 h-3" />
                <span>Action Définitive • Can't Undo</span>
              </div>
              <h3 className="text-base font-black text-white leading-tight">
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs text-slate-300">
          <p className="text-slate-200 leading-relaxed font-medium">
            {description}
          </p>

          {details && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-amber-300 break-all">
              {details}
            </div>
          )}

          {/* Database direct rewrite alert banner */}
          <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/80 flex items-start gap-3">
            <Database className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-rose-200 font-bold block text-[11px]">
                Réécriture Directe de la Base de Données
              </strong>
              <p className="text-[11px] text-slate-400 leading-normal">
                Cette modification est enregistrée immédiatement et de façon irréversible sur le serveur central et le cloud Supabase. Aucune annulation ou récupération n'est possible après confirmation.
              </p>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition cursor-pointer"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
              isDangerous
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/50'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
