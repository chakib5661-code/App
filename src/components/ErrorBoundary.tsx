import React, { Component, ErrorInfo } from 'react';
import { RefreshCw, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught unhandled error:', error, errorInfo);
  }

  private handleClearStorageAndReload = () => {
    try {
      // Safely preserve master backups and critical database keys
      const backupKeysToKeep = [
        'tulip_admin_master_backup',
        'tulip_products',
        'tulip_orders',
        'tulip_customer_users',
        'tulip_customer_applications',
        'elathir_preorders_list',
        'elathir_offline_orders_queue',
      ];
      const preserved: Record<string, string> = {};
      for (const k of backupKeysToKeep) {
        const val = localStorage.getItem(k);
        if (val) preserved[k] = val;
      }

      localStorage.clear();
      sessionStorage.clear();

      // Restore critical database backups
      for (const [k, val] of Object.entries(preserved)) {
        localStorage.setItem(k, val);
      }
    } catch (e) {
      console.error(e);
    }
    window.location.href = window.location.origin + window.location.pathname;
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">
                Rétablissement de l'Application
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Une donnée locale obsolète ou temporairement corrompue dans votre navigateur empêche l'affichage direct.
              </p>
              <p className="text-xs text-slate-500 font-arabic leading-relaxed" dir="rtl">
                حدث تعارض في البيانات المحلية المخزنة في متصفحك. يمكنك استعادة التطبيق بنقرة واحدة.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-left text-xs font-mono text-rose-400/90 overflow-x-auto max-h-28">
                {this.state.error.message || 'Erreur inattendue'}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                id="error-boundary-clear-storage-btn"
                onClick={this.handleClearStorageAndReload}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2.5 transition active:scale-[0.98] cursor-pointer"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Réinitialiser les données locales & Recharger</span>
              </button>

              <button
                type="button"
                id="error-boundary-reload-btn"
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl border border-slate-700/60 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Simple rechargement de la page</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Tulip Fragrance Company • Plateforme Sécurisée</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
