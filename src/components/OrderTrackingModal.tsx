import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Package,
  Calendar,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  Download,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  User,
} from 'lucide-react';
import { PreOrder, CustomerUser, StoreSettings } from '../types';
import { formatDZD, downloadOrderPDF } from '../utils/pdfGenerator';
import { AppLanguage, translations } from '../translations';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PreOrder[];
  currentCustomer: CustomerUser | null;
  storeSettings: StoreSettings;
  lang: AppLanguage;
}

function normalizePhoneDigits(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Algerian phone: last 9 digits (e.g., 799938399)
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  orders,
  currentCustomer,
  storeSettings,
  lang,
}) => {
  const t = translations[lang];
  const [searchInput, setSearchInput] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PreOrder | null>(null);

  // Strictly filter orders belonging ONLY to the logged-in customer
  const customerOrders = useMemo(() => {
    if (!currentCustomer) return [];

    const custNormPhone = normalizePhoneDigits(currentCustomer.phone);
    const custSecNormPhone = normalizePhoneDigits(currentCustomer.secondaryPhone);
    const custEmail = (currentCustomer.email || '').toLowerCase().trim();
    const custUsername = (currentCustomer.username || '').toLowerCase().trim();
    const custName = (currentCustomer.fullName || '').toLowerCase().trim();
    const custId = currentCustomer.id;

    return orders.filter((ord) => {
      // 1. Direct ID match
      if (ord.customerId && ord.customerId === custId) return true;

      // 2. Direct username match
      if (
        ord.customerUsername &&
        custUsername &&
        ord.customerUsername.toLowerCase().trim() === custUsername
      ) {
        return true;
      }

      // 3. Exact valid email match (must have @ and not be empty)
      const ordEmail = (ord.customer?.email || '').toLowerCase().trim();
      if (
        custEmail &&
        custEmail.includes('@') &&
        ordEmail &&
        ordEmail.includes('@') &&
        ordEmail === custEmail
      ) {
        return true;
      }

      // 4. Exact primary or secondary phone match (comparing last 9 digits)
      const ordNormPhone = normalizePhoneDigits(ord.customer?.phone);
      if (
        custNormPhone.length >= 8 &&
        ordNormPhone.length >= 8 &&
        ordNormPhone === custNormPhone
      ) {
        return true;
      }
      if (
        custSecNormPhone.length >= 8 &&
        ordNormPhone.length >= 8 &&
        ordNormPhone === custSecNormPhone
      ) {
        return true;
      }

      // 5. Compound Name + Wilaya / Company match (NEVER match name alone to avoid collisions)
      const ordName = (ord.customer?.fullName || '').toLowerCase().trim();
      if (custName.length >= 4 && ordName === custName) {
        const ordWilaya = ord.customer?.wilayaCode;
        const custWilaya = currentCustomer.wilayaCode;
        if (ordWilaya && custWilaya && ordWilaya === custWilaya) {
          return true;
        }
        const ordCompany = (ord.customer?.companyName || '').toLowerCase().trim();
        const custCompany = (currentCustomer.companyName || '').toLowerCase().trim();
        if (ordCompany && custCompany && ordCompany === custCompany) {
          return true;
        }
      }

      return false;
    });
  }, [orders, currentCustomer]);

  // Handle Search Filtering:
  // CRITICAL: When logged in, search MUST ONLY search inside `customerOrders`!
  // No order from any other customer is ever accessible or visible.
  const searchResults = useMemo(() => {
    const query = searchInput.trim().toLowerCase();

    // 1. Case: Customer is logged in
    if (currentCustomer) {
      if (!query) return customerOrders;

      const cleanQ = query.replace(/\D/g, '');
      return customerOrders.filter((ord) => {
        const orderNum = ord.orderNumber.toLowerCase();
        const dateStr = new Date(ord.date || ord.createdAt || Date.now()).toLocaleDateString('fr-DZ');
        const itemsText = ord.items.map((i) => `${i.name} ${i.code}`).join(' ').toLowerCase();

        return (
          orderNum.includes(query) ||
          dateStr.includes(query) ||
          itemsText.includes(query) ||
          (cleanQ && cleanQ.length >= 4 && ord.customer.phone.replace(/\D/g, '').includes(cleanQ))
        );
      });
    }

    // 2. Case: Guest (not logged in)
    // Require a minimum of 4 characters to prevent dumping random orders
    if (!query || query.length < 4) {
      return [];
    }

    const cleanQ = query.replace(/\D/g, '');
    return orders.filter((ord) => {
      const orderNum = ord.orderNumber.toLowerCase();
      const ordNormPhone = normalizePhoneDigits(ord.customer.phone);

      const matchesOrderNumber = query.length >= 4 && orderNum.includes(query);
      const matchesExactPhone = cleanQ.length >= 8 && ordNormPhone === cleanQ.slice(-9);

      return matchesOrderNumber || matchesExactPhone;
    });
  }, [orders, searchInput, customerOrders, currentCustomer]);

  if (!isOpen) return null;

  const getStatusBadge = (status: PreOrder['status']) => {
    switch (status) {
      case 'en_attente':
        return {
          label: t.statusPending,
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          step: 1,
          icon: Clock,
        };
      case 'confirmee':
        return {
          label: t.statusConfirmed,
          bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          step: 2,
          icon: CheckCircle2,
        };
      case 'en_preparation':
        return {
          label: t.statusInPrep,
          bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          step: 3,
          icon: Package,
        };
      case 'livree':
        return {
          label: t.statusDelivered,
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          step: 4,
          icon: Truck,
        };
      case 'annulee':
        return {
          label: t.statusCancelled,
          bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          step: 0,
          icon: AlertCircle,
        };
    }
  };

  const activeOrderToDisplay =
    selectedOrder && searchResults.some((o) => o.id === selectedOrder.id)
      ? selectedOrder
      : searchResults.length > 0
      ? searchResults[0]
      : null;

  const handleWhatsAppInquiry = (order: PreOrder) => {
    const text = encodeURIComponent(
      `Bonjour Tulip Fragrance,\n\nJe souhaite suivre l'avancement de ma commande :\n*Réf :* ${order.orderNumber}\n*Nom :* ${order.customer.fullName}\n*Montant :* ${formatDZD(order.totalDA)}\n\nMerci de me tenir informé.`
    );
    window.open(`https://wa.me/${storeSettings.whatsappPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-[#c2185b]/40 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col text-white my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#500428] flex items-center justify-between bg-gradient-to-r from-[#500428] via-[#70083b] to-[#9f0e4e] shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center text-white shadow-md">
              <Truck className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {t.trackModalTitle}
              </h3>
              <p className="text-[11px] text-rose-200">
                {currentCustomer
                  ? 'Vos précommandes personnelles et statut de préparation'
                  : t.trackModalSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-rose-200 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Authenticated Customer Context Banner */}
        {currentCustomer ? (
          <div className="px-4 py-2.5 bg-[#70083b]/25 border-b border-[#c2185b]/30 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-300">
                Compte client : <strong className="text-white">{currentCustomer.fullName}</strong>
                {currentCustomer.companyName ? ` (${currentCustomer.companyName})` : ''}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#9f0e4e]/30 text-rose-200 text-[11px] font-bold border border-[#c2185b]/40">
              {customerOrders.length} commande(s) enregistrée(s)
            </span>
          </div>
        ) : (
          <div className="px-4 py-2 bg-slate-850 border-b border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Vous n&apos;êtes pas connecté. Saisissez votre référence de bon (ex: PRE-2026-...) ou téléphone.
            </span>
          </div>
        )}

        {/* Search Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-850 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                currentCustomer
                  ? 'Rechercher parmi vos commandes (référence, extrait, date)...'
                  : 'Saisissez votre réf: PRE-2026-... ou votre téléphone'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#c2185b] focus:ring-1 focus:ring-[#9f0e4e] transition font-mono"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {searchResults.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">
                {currentCustomer
                  ? searchInput
                    ? 'Aucune commande ne correspond à votre recherche.'
                    : 'Vous n’avez encore passé aucune commande avec ce compte.'
                  : searchInput.length > 0 && searchInput.length < 4
                  ? 'Veuillez saisir au moins 4 caractères pour rechercher votre commande.'
                  : 'Aucune commande trouvée.'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {currentCustomer
                  ? 'Toutes vos futures précommandes validées apparaîtront automatiquement ici.'
                  : 'Veuillez vérifier votre numéro de référence (ex: PRE-2026-...) ou vous connecter à votre compte.'}
              </p>
            </div>
          ) : (
            <>
              {/* If multiple orders, show small selector pills */}
              {searchResults.length > 1 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Sélectionnez un bon de commande ({searchResults.length}) :
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
                    {searchResults.map((ord) => {
                      const isSelected = activeOrderToDisplay?.id === ord.id;
                      return (
                        <button
                          key={ord.id}
                          type="button"
                          onClick={() => setSelectedOrder(ord)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold shrink-0 transition cursor-pointer border ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#9f0e4e] to-[#c2185b] text-white border-rose-400/50 shadow-sm'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                          }`}
                        >
                          {ord.orderNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Display Active Order Card */}
              {activeOrderToDisplay && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                  {/* Order Reference & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">
                        RÉFÉRENCE OFFICIELLE
                      </span>
                      <span className="text-base sm:text-lg font-mono font-extrabold text-white">
                        {activeOrderToDisplay.orderNumber}
                      </span>
                    </div>

                    {(() => {
                      const badge = getStatusBadge(activeOrderToDisplay.status);
                      const IconComp = badge.icon;
                      return (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${badge.bg}`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Visual Status Stepper */}
                  <div className="py-2">
                    <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center">
                      {[
                        { step: 1, title: 'Reçue', desc: 'Enregistrée' },
                        { step: 2, title: 'Confirmée', desc: 'Stock Bloqué' },
                        { step: 3, title: 'Atelier', desc: 'En Préparation' },
                        { step: 4, title: 'Expédiée', desc: 'Prête / Livrée' },
                      ].map((s) => {
                        const currentStep = getStatusBadge(activeOrderToDisplay.status).step;
                        const isDone = currentStep >= s.step;
                        const isCurrent = currentStep === s.step;

                        return (
                          <div key={s.step} className="flex flex-col items-center">
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition mb-1 ${
                                isDone
                                  ? isCurrent
                                    ? 'bg-gradient-to-r from-[#9f0e4e] to-[#c2185b] text-white ring-4 ring-[#c2185b]/40 shadow-sm'
                                    : 'bg-emerald-600 text-white'
                                  : 'bg-slate-800 text-slate-500 border border-slate-700'
                              }`}
                            >
                              {isDone ? '✓' : s.step}
                            </div>
                            <span
                              className={`text-[10px] sm:text-xs font-bold leading-tight ${
                                isDone ? 'text-white' : 'text-slate-500'
                              }`}
                            >
                              {s.title}
                            </span>
                            <span className="text-[9px] text-slate-500 hidden sm:block">
                              {s.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          Date :{' '}
                          {new Date(
                            activeOrderToDisplay.date || activeOrderToDisplay.createdAt || Date.now()
                          ).toLocaleDateString('fr-DZ', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                        <span>
                          {activeOrderToDisplay.customer.wilayaCode} -{' '}
                          {activeOrderToDisplay.customer.wilayaName} ({activeOrderToDisplay.customer.commune})
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 sm:text-right">
                      <div className="text-slate-400">Total Précommandé :</div>
                      <div className="text-base font-extrabold text-[#f472b6] font-mono">
                        {formatDZD(activeOrderToDisplay.totalDA)}
                      </div>
                    </div>
                  </div>

                  {/* Reserved Items */}
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Articles Réservés ({activeOrderToDisplay.items.length})
                    </h5>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {activeOrderToDisplay.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1.5 px-2.5 rounded bg-slate-900/80 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate mr-2">
                            <span className="font-mono font-bold text-rose-400 shrink-0">
                              {item.family === 'Extrait' ? `${item.quantity}g` : `${item.quantity}x`}
                            </span>
                            <span className="text-slate-200 truncate">{item.name}</span>
                          </div>
                          <span className="font-mono text-slate-300 shrink-0">
                            {formatDZD(item.totalDA)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => downloadOrderPDF(activeOrderToDisplay, storeSettings)}
                      className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white font-black text-xs flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t.downloadPdfBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleWhatsAppInquiry(activeOrderToDisplay)}
                      className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Contacter sur WhatsApp</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            Ligne assistance : {storeSettings.phone} / {storeSettings.phoneSecondary || '0559061552'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-semibold cursor-pointer"
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
