import React, { useMemo, useState } from 'react';
import { X, FileText, Download, Loader2 } from 'lucide-react';
import type { AppLanguage } from '../translations';
import type { PreOrder, StoreSettings } from '../types';
import { formatDZD } from '../utils/formatDZD';

interface MyInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PreOrder[];
  storeSettings: StoreSettings;
  isPricesVisible?: boolean;
  lang: AppLanguage;
  /** How many of the most recent invoices to list. */
  limit?: number;
}

/** "My invoices": the customer's latest orders, each with a re-download button. */
export const MyInvoicesModal: React.FC<MyInvoicesModalProps> = ({
  isOpen,
  onClose,
  orders,
  storeSettings,
  isPricesVisible = true,
  lang,
  limit = 5,
}) => {
  const L = (fr: string, en: string, ar: string) => (lang === 'ar' ? ar : lang === 'en' ? en : fr);
  const [busyId, setBusyId] = useState<string | null>(null);

  const latest = useMemo(
    () =>
      orders
        .filter((o) => o.status !== 'annulee')
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
        )
        .slice(0, limit),
    [orders, limit]
  );

  if (!isOpen) return null;

  const download = async (order: PreOrder) => {
    setBusyId(order.id);
    try {
      const { downloadOrderPDF } = await import('../utils/pdfGenerator');
      await downloadOrderPDF(order, storeSettings, { hidePrices: !isPricesVisible });
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const dateLabel = (o: PreOrder) => {
    const d = new Date(o.createdAt || o.date);
    return isNaN(d.getTime())
      ? o.date
      : d.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : lang === 'en' ? 'en-GB' : 'fr-FR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      onClick={onClose}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-label={L('Mes factures', 'My invoices', 'فواتيري')}
    >
      <div
        className="bg-white w-full sm:max-w-lg max-h-[85vh] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#9f0e4e]" />
            {L('Mes factures', 'My invoices', 'فواتيري')}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label={L('Fermer', 'Close', 'إغلاق')}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-2">
          {latest.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              {L('Aucune facture pour le moment.', 'No invoices yet.', 'لا توجد فواتير بعد.')}
            </p>
          ) : (
            latest.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">#{o.orderNumber}</p>
                  <p className="text-xs text-slate-500">
                    {dateLabel(o)} · {o.items.length} {L('article(s)', 'item(s)', 'منتج')}
                    {isPricesVisible ? ` · ${formatDZD(o.totalDA)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => download(o)}
                  disabled={busyId === o.id}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#9f0e4e] text-white text-xs font-bold disabled:opacity-60"
                >
                  {busyId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  PDF
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
