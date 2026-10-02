import React from 'react';
import {
  CheckCircle,
  Download,
  Printer,
  Calendar,
  ArrowRight,
  MessageSquare,
  Truck,
  FileText,
  MapPin,
  Phone,
  Lock,
  WifiOff,
  Smartphone,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { PreOrder, StoreSettings } from '../types';
import { INITIAL_STORE_SETTINGS } from '../data/initialProducts';
import { downloadOrderPDF, printOrderPDF, formatDZD } from '../utils/pdfGenerator';
import { AppLanguage, translations } from '../translations';
import { DeviceInfo } from '../utils/deviceDetector';

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PreOrder | null;
  storeSettings?: StoreSettings;
  onTrackOrder?: (order: PreOrder) => void;
  lang?: AppLanguage;
  isPricesVisible?: boolean;
  onOpenInstallGuide?: () => void;
  deviceInfo?: DeviceInfo;
}

export const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  isOpen,
  onClose,
  order,
  storeSettings: rawStoreSettings,
  onTrackOrder,
  lang = 'ar',
  isPricesVisible = false,
  onOpenInstallGuide,
  deviceInfo,
}) => {
  const storeSettings = rawStoreSettings || INITIAL_STORE_SETTINGS;
  const t = translations[lang];
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability

  if (!isOpen || !order) return null;

  const isProforma = Boolean(order.isProforma || (order.orderNumber && order.orderNumber.startsWith('PRO-')));
  const isOffline = Boolean(order.isOfflinePending);

  const handleDownloadPDF = () => {
    downloadOrderPDF(order, storeSettings, { hidePrices: !isPricesVisible });
  };

  const handlePrintPDF = () => {
    printOrderPDF(order, storeSettings, { hidePrices: !isPricesVisible });
  };

  const handleWhatsAppShare = () => {
    const itemsSummary = order.items
      .map((i) => {
        const qtyLabel = i.family === 'Extrait' ? `${i.quantity}g (Contenant 100g)` : `${i.quantity}x ${i.unit}`;
        return isPricesVisible
          ? `• ${qtyLabel} - ${i.name} = ${formatDZD(i.totalDA)}`
          : `• ${qtyLabel} - ${i.name}`;
      })
      .join('\n');

    const totalText = isPricesVisible
      ? `*TOTAL :* ${formatDZD(order.totalDA)}`
      : `*TOTAL :* Sur devis / Prix confidentiels`;

    const message = encodeURIComponent(
      `Bonjour ${storeSettings.storeName},\n\nJ'ai effectué une ${isProforma ? 'demande de Facture Proforma' : 'précommande de matières premières'} via le site web :\n\n` +
      `*Réf :* ${order.orderNumber}\n` +
      `*Client :* ${order.customer.fullName} ${order.customer.companyName ? `(${order.customer.companyName})` : ''}\n` +
      `*Téléphone :* ${order.customer.phone}\n` +
      `*Wilaya :* ${order.customer.wilayaCode} - ${order.customer.wilayaName} (${order.customer.commune})\n` +
      `*Mode :* ${order.customer.deliveryMode}\n\n` +
      `*Articles :*\n${itemsSummary}\n\n` +
      `${totalText}\n\n` +
      `Merci de me confirmer la réception et le traitement de mon dossier.`
    );

    const whatsappUrl = `https://wa.me/${storeSettings.whatsappPhone}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 border border-slate-200">
        {/* Top Success Banner */}
        <div className={`p-6 text-white text-center relative ${isProforma ? 'bg-gradient-to-br from-amber-600 via-amber-700 to-slate-900' : 'bg-gradient-to-br from-rose-700 via-rose-600 to-pink-700'}`}>
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-xs shadow-inner">
            {isProforma ? (
              <FileText className="w-8 h-8 text-amber-200" />
            ) : (
              <CheckCircle className="w-8 h-8 text-white" />
            )}
          </div>
          <h3 className="text-xl font-black tracking-tight">
            {isOffline ? (
              lang === 'ar' ? 'تم حفظ الطلبية بنجاح (وضع عدم الاتصال)' : 'Précommande Enregistrée Hors-Ligne !'
            ) : isProforma ? (
              lang === 'ar' ? 'تم إرسال طلب الفاتورة الشكلية بنجاح !' : 'Demande de Facture Proforma Transmise !'
            ) : (
              t.orderSuccessTitle
            )}
          </h3>
          <p className="text-xs text-white/90 mt-1 max-w-sm mx-auto">
            {isOffline ? (
              lang === 'ar'
                ? 'تم حفظ طلبيتكم وحجز المواد محلياً على جهازكم. سيتم إرسالها تلقائياً إلى خوادمنا فور استعادة الاتصال بالإنترنت.'
                : 'Votre document est prêt et vos articles sont réservés. La commande sera transmise automatiquement à Tulip dès que vous retrouverez une connexion Internet.'
            ) : isProforma ? (
              lang === 'ar'
                ? 'تم تسجيل طلبكم وحجز السلعة مبدئياً لمدة 48 ساعة. حملوا وثيقة البروفورما أدناه.'
                : 'Votre demande a été transmise au service commercial. Le stock est réservé pour 48 heures. Téléchargez votre document proforma officiel ci-dessous.'
            ) : (
              t.orderSuccessDesc
            )}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <div className="inline-block px-4 py-1.5 rounded-full bg-slate-950/50 text-white font-mono text-xs font-bold border border-white/20 shadow-sm">
              {t.orderRefLabel} : {order.orderNumber}
            </div>

            {isOffline && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400 text-slate-950 font-sans text-xs font-bold shadow-sm">
                <WifiOff className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'في انتظار استعادة الإنترنت' : 'Envoi auto dès reconnexion'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Primary Action Buttons (PDF, Print, WhatsApp, Tracking) */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Download PDF Button */}
            <button
              id="btn-download-pdf"
              type="button"
              onClick={handleDownloadPDF}
              className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>{isProforma ? (lang === 'ar' ? 'تحميل الفاتورة الشكلية (PDF)' : 'Télécharger la Proforma (PDF)') : t.downloadPdfBtn}</span>
            </button>

            {/* Print Directly */}
            <button
              id="btn-print-order"
              type="button"
              onClick={handlePrintPDF}
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition border border-slate-300 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>{t.printPdfBtn}</span>
            </button>
          </div>

          {/* Follow / Track Order Button */}
          {onTrackOrder && (
            <button
              id="btn-track-order-direct"
              type="button"
              onClick={() => {
                onTrackOrder(order);
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Truck className="w-4 h-4 text-amber-700" />
              <span>{t.trackThisOrderBtn}</span>
            </button>
          )}

          {/* Send via WhatsApp directly to Algerian merchant */}
          <button
            id="btn-whatsapp-order"
            type="button"
            onClick={handleWhatsAppShare}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>{t.whatsappShareBtn}</span>
          </button>

          {/* Order Details Recap Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'تاريخ الإنشاء' : 'Date de création'}
              </span>
              <span className="font-semibold text-slate-800">
                {new Date(order.date).toLocaleString('fr-DZ', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                {t.wilayaLabel}
              </span>
              <span className="font-semibold text-slate-800">
                {order.customer.wilayaCode} - {order.customer.wilayaName} ({order.customer.commune})
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {t.phoneLabel}
              </span>
              <span className="font-mono font-semibold text-slate-800">
                {order.customer.phone}
              </span>
            </div>

            {/* Item summary */}
            <div className="pt-1">
              <div className="text-slate-500 font-bold mb-1.5">
                {lang === 'ar' ? `المواد المحجوزة (${order.items.length}) :` : `Articles réservés (${order.items.length}) :`}
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {order.items.map((item) => (
                  <div key={item.productId} className="flex justify-between items-center text-[11px] py-0.5">
                    <span className="text-slate-800 truncate max-w-[240px]">
                      {item.family === 'Extrait' ? `${item.quantity}g` : `${item.quantity}x`} {item.name} {item.family === 'Extrait' ? `(${Math.floor(item.quantity / 100)} cont. 100g)` : `(${item.unit})`}
                    </span>
                    <span className="font-bold text-slate-900 shrink-0 font-mono">
                      {isPricesVisible ? (
                        formatDZD(item.totalDA)
                      ) : (
                        <span className="text-amber-800 text-[10px] font-semibold">Sur devis</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Row */}
            <div className="flex items-baseline justify-between pt-2 border-t border-slate-300">
              <span className="font-bold text-slate-800 text-sm">
                {lang === 'ar' ? 'المجموع الإجمالي :' : 'TOTAL ESTIMÉ :'}
              </span>
              {isPricesVisible ? (
                <span className="font-black text-rose-700 text-lg font-mono">
                  {formatDZD(order.totalDA)}
                </span>
              ) : (
                <span className="font-bold text-amber-800 text-xs flex items-center gap-1 bg-amber-100 px-2 py-0.5 rounded">
                  <Lock className="w-3 h-3 text-amber-700" />
                  {t.totalHiddenNotice}
                </span>
              )}
            </div>
          </div>

          {/* Customer Advice to Install PWA (Contextual, No Buttons in Header/Interface) */}
          {onOpenInstallGuide && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 text-xs flex items-start gap-3 shadow-xs">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-amber-950 flex items-center gap-1.5 mb-0.5">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>{lang === 'ar' ? 'نصيحة هامة لطلبياتكم القادمة :' : 'Conseil pour vos prochaines commandes :'}</span>
                </div>
                <p className="text-[11px] text-amber-900/80 leading-relaxed">
                  {lang === 'ar'
                    ? `ثبّتوا التطبيق على شاشة هاتفكم ${deviceInfo?.phoneModel ? `(${deviceInfo.phoneModel})` : ''} لإعداد طلبياتكم حتى بدون شبكة وتصفح الأسعار بلمسة واحدة.`
                    : `Installez l'application Tulip sur votre écran d'accueil ${deviceInfo?.phoneModel ? `(${deviceInfo.phoneModel})` : ''} pour préparer vos commandes même sans réseau Internet et accéder à vos tarifs en 1 clic.`}
                </p>
                <button
                  type="button"
                  id="confirm-modal-open-pwa-guide-btn"
                  onClick={onOpenInstallGuide}
                  className="mt-2 inline-flex items-center gap-1 font-bold text-amber-900 hover:text-amber-950 underline text-xs cursor-pointer"
                >
                  <span>{lang === 'ar' ? '👉 عرض خطوات التثبيت بالتفصيل' : '👉 Voir comment installer l\'application sur votre téléphone'}</span>
                  <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </div>
            </div>
          )}

          {/* Continue button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>{lang === 'ar' ? 'العودة إلى الكتالوج' : 'Retourner au catalogue des matières premières'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
