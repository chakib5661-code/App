import React, { useState, useEffect } from 'react';
import { X, Phone, FileText, CheckCircle2, User, Building, ShieldCheck, MapPin, Truck, Lock, Store } from 'lucide-react';
import { CartItem, CustomerDetails, CustomerUser, DeliveryMode, StoreSettings } from '../types';
import { ALGERIAN_WILAYAS } from '../data/wilayas';
import { formatDZD } from '../utils/pdfGenerator';
import { calculateDiscountedPrice } from '../utils/productUtils';
import { AppLanguage, translations } from '../translations';
import { getProductLocalizedDetails } from '../data/productTranslations';
import { AlgerianPhoneInput } from './AlgerianPhoneInput';
import { normalizeAlgerianPhone } from '../utils/phoneUtils';

interface PreOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  storeSettings: StoreSettings;
  currentCustomer?: CustomerUser | CustomerDetails | null;
  onSubmitOrder: (details: CustomerDetails, isProforma?: boolean) => void;
  isProforma?: boolean;
  isPricesVisible?: boolean;
  lang?: AppLanguage;
}

export const PreOrderModal: React.FC<PreOrderModalProps> = ({
  isOpen,
  onClose,
  items,
  storeSettings,
  currentCustomer,
  onSubmitOrder,
  isProforma = false,
  isPricesVisible = false,
  lang = 'ar',
}) => {
  const t = translations[lang];
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability

  const [fullName, setFullName] = useState(currentCustomer?.fullName || '');
  const [companyName, setCompanyName] = useState(currentCustomer?.companyName || '');
  const [phone, setPhone] = useState(currentCustomer?.phone || '');
  const [secondaryPhone, setSecondaryPhone] = useState(currentCustomer?.secondaryPhone || '');
  const [wilayaCode, setWilayaCode] = useState(currentCustomer?.wilayaCode || '31');
  const [commune, setCommune] = useState(currentCustomer?.commune || '');
  const [deliveryAddress, setDeliveryAddress] = useState(currentCustomer?.deliveryAddress || '');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('domicile');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync if customer changes
  useEffect(() => {
    if (currentCustomer) {
      if (currentCustomer.fullName && !fullName) setFullName(currentCustomer.fullName);
      if (currentCustomer.companyName && !companyName) setCompanyName(currentCustomer.companyName);
      if (currentCustomer.phone && !phone) setPhone(currentCustomer.phone);
      if (currentCustomer.wilayaCode && wilayaCode === '31') setWilayaCode(currentCustomer.wilayaCode);
      if (currentCustomer.commune && !commune) setCommune(currentCustomer.commune);
      if (currentCustomer.deliveryAddress && !deliveryAddress) setDeliveryAddress(currentCustomer.deliveryAddress);
    }
  }, [currentCustomer]);

  if (!isOpen) return null;

  const totalAmountDA = items.reduce((sum, item) => {
    const unitPrice = calculateDiscountedPrice(item.product.priceDA, item.product.discountPercent);
    return sum + unitPrice * item.quantity;
  }, 0);

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedWilaya = ALGERIAN_WILAYAS.find((w) => w.code === wilayaCode) || ALGERIAN_WILAYAS[30];

  // Validate Algerian phone number (Algeria only)
  const validateAlgerianPhone = (num: string): boolean => {
    const norm = normalizeAlgerianPhone(num);
    return /^0[2-7][0-9]{8}$/.test(norm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    const cleanPhone = normalizeAlgerianPhone(phone);
    const cleanSecondaryPhone = normalizeAlgerianPhone(secondaryPhone);

    // PROFORMA: Ask ONLY for name and phone number
    if (isProforma) {
      if (!fullName.trim()) {
        newErrors.fullName = lang === 'ar' ? 'يرجى إدخال الاسم واللقب.' : 'Veuillez saisir votre nom et prénom.';
      }

      if (!phone.trim()) {
        newErrors.phone = lang === 'ar' ? 'رقم الهاتف مطلوب لاستلام الفاتورة الشكلية.' : 'Le numéro de téléphone est obligatoire pour la confirmation.';
      } else if (!validateAlgerianPhone(phone)) {
        newErrors.phone = lang === 'ar' ? 'صيغة غير صالحة. مثال: 0550 12 34 56' : 'Format invalide. Ex : 0550 12 34 56 ou 06 / 07 / 02.';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setErrors({});
      onSubmitOrder(
        {
          fullName: fullName.trim(),
          phone: cleanPhone || phone.trim(),
          wilayaCode: currentCustomer?.wilayaCode || selectedWilaya.code || '31',
          wilayaName: currentCustomer?.wilayaName || selectedWilaya.name || 'Oran',
          commune: currentCustomer?.commune || 'Demande Proforma',
          deliveryAddress: currentCustomer?.deliveryAddress || 'Devis Proforma Express',
          deliveryMode: 'magasin',
        },
        true
      );
      return;
    }

    // STANDARD PREORDER: Full validation
    if (!fullName.trim()) {
      newErrors.fullName = lang === 'ar' ? 'يرجى إدخال الاسم واللقب.' : 'Veuillez saisir votre nom et prénom ou raison sociale.';
    }

    if (!phone.trim()) {
      newErrors.phone = lang === 'ar' ? 'رقم الهاتف مطلوب لتأكيد الطلب.' : 'Le numéro de téléphone est obligatoire pour la confirmation.';
    } else if (!validateAlgerianPhone(phone)) {
      newErrors.phone = lang === 'ar' ? 'صيغة غير صالحة. مثال: 0550 12 34 56' : 'Format invalide. Ex : 0550 12 34 56 ou 06 / 07 / 02.';
    }

    if (secondaryPhone && !validateAlgerianPhone(secondaryPhone)) {
      newErrors.secondaryPhone = lang === 'ar' ? 'صيغة غير صحيحة للرقم الثاني.' : 'Format invalide pour le deuxième numéro.';
    }

    if (!commune.trim() && deliveryMode !== 'magasin') {
      newErrors.commune = lang === 'ar' ? 'يرجى تحديد البلدية أو الدائرة.' : 'Veuillez préciser la commune / daïra.';
    }

    if (!deliveryAddress.trim() && deliveryMode === 'domicile') {
      newErrors.deliveryAddress = lang === 'ar' ? 'يرجى تحديد عنوان التسليم الدقيق.' : "Veuillez préciser l'adresse de livraison exacte.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onSubmitOrder(
      {
        fullName: fullName.trim(),
        companyName: companyName.trim() || undefined,
        phone: cleanPhone || phone.trim(),
        secondaryPhone: cleanSecondaryPhone || undefined,
        wilayaCode: selectedWilaya.code,
        wilayaName: selectedWilaya.name,
        commune: deliveryMode === 'magasin' ? (commune.trim() || 'Oran') : commune.trim(),
        deliveryAddress:
          deliveryAddress.trim() ||
          (deliveryMode === 'magasin'
            ? `Retrait au magasin (${storeSettings.wilaya || 'Oran'})`
            : `Bureau Stop-Desk ${selectedWilaya.name}`),
        deliveryMode,
        notes: notes.trim() || undefined,
      },
      false
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-100">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#500428] via-[#70083b] to-[#9f0e4e] text-white flex items-center justify-between border-b border-[#500428] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center border border-white/25 shadow-xs">
              <FileText className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {isProforma ? t.requestProformaTitle : t.preorderTitle}
                </h3>
                {isProforma && (
                  <span className="px-2 py-0.5 rounded-full bg-white/25 text-white text-[10px] font-black uppercase border border-white/30">
                    Facture Proforma
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-100 mt-0.5">
                {isProforma
                  ? (lang === 'ar'
                      ? 'أدخل فقط اسمك ورقم هاتفك لإنشاء الفاتورة الشكلية الرسمية (PDF).'
                      : 'Renseignez uniquement votre nom et numéro de téléphone pour éditer votre proforma en PDF.')
                  : t.preorderSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-rose-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Quick Recap Banner */}
          <div className="bg-rose-50/80 border border-rose-200/90 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[#70083b] font-bold block">
                {isProforma ? 'Contenu de la demande de proforma :' : 'Récapitulatif de votre commande :'}
              </span>
              <span className="text-slate-600 mt-0.5 block">
                {items.length} références ({totalUnits} {lang === 'ar' ? 'وحدة / غرام' : 'unités / grammes'})
              </span>
            </div>
            <div className="text-right">
              {isPricesVisible ? (
                <>
                  <span className="text-lg font-black text-[#9f0e4e] block">
                    {formatDZD(totalAmountDA)}
                  </span>
                  <span className="text-[11px] text-[#880e4f] font-semibold">
                    {isProforma ? 'Devis Proforma officiel avec réservation 48H' : 'Paiement à la livraison / retrait'}
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-1 text-[#70083b] font-bold text-xs bg-rose-100/80 px-2.5 py-1 rounded-lg border border-rose-300">
                  <Lock className="w-3.5 h-3.5 text-[#9f0e4e]" />
                  <span>{t.totalHiddenNotice}</span>
                </div>
              )}
            </div>
          </div>

          {/* CONDITIONAL RENDERING: PROFORMA (2 FIELDS ONLY) VS PREORDER (FULL DESTINATION) */}
          {isProforma ? (
            <div className="space-y-4">
              {/* Express Proforma Banner */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-xs text-amber-950">
                <FileText className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-bold text-amber-900 text-sm block">
                    {lang === 'ar'
                      ? '⚡ طلب فاتورة شكلية سريعة (Proforma Express)'
                      : '⚡ Demande Rapide de Facture Proforma'}
                  </strong>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {lang === 'ar'
                      ? 'يكفي إدخال الاسم ورقم الهاتف فقط. سيتم إصدار وثيقة الفاتورة الشكلية الرسمية وحجز المخزون مباشرة.'
                      : 'Indiquez uniquement votre nom et numéro de téléphone mobile. Votre document PDF officiel sera généré immédiatement avec réservation du stock pendant 48 heures.'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
                {/* Field 1: Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>
                      {t.fullNameLabel} <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {lang === 'ar' ? 'الاسم واللقب أو التسمية التجارية' : 'Nom & Prénom ou Raison sociale'}
                    </span>
                  </label>
                  <div className="relative">
                    <User className={`w-4 h-4 text-slate-400 absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2`} />
                    <input
                      id="proforma-fullname"
                      type="text"
                      autoFocus
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={lang === 'ar' ? 'مثال: كريم بن علي' : 'Ex : Karim Benali / Atelier Parfums'}
                      className={`w-full ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2.5 text-sm bg-white border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                        errors.fullName ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {errors.fullName && (
                    <span className="text-[11px] text-rose-600 mt-1 block font-medium">{errors.fullName}</span>
                  )}
                </div>

                {/* Field 2: Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>
                      {t.phoneLabel} <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {lang === 'ar' ? 'رقم الهاتف للتواصل وتأكيد الحجز' : 'Numéro mobile pour confirmation'}
                    </span>
                  </label>
                  <AlgerianPhoneInput
                    id="proforma-phone"
                    value={phone}
                    onChange={setPhone}
                    placeholder="05 XX XX XX XX"
                    error={errors.phone}
                    theme="light"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Section: Client Identity */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <User className="w-4 h-4 text-amber-600" />
                  1. {t.fullNameLabel} & Contact
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.fullNameLabel} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="client-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={lang === 'ar' ? 'مثال: كريم بن علي' : 'Ex : Karim Benali'}
                      className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                        errors.fullName ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                      }`}
                    />
                    {errors.fullName && (
                      <span className="text-[11px] text-rose-600 mt-1 block">{errors.fullName}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.companyLabel}
                    </label>
                    <div className="relative">
                      <Building className={`w-4 h-4 text-slate-400 absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2`} />
                      <input
                        id="client-company"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder={lang === 'ar' ? 'مثال: ورشة الهناء للعطور' : 'Ex : Parfumerie El Hana'}
                        className={`w-full ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500`}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.phoneLabel} <span className="text-rose-500">*</span>
                    </label>
                    <AlgerianPhoneInput
                      id="client-phone"
                      value={phone}
                      onChange={setPhone}
                      placeholder="05 XX XX XX XX"
                      error={errors.phone}
                      theme="light"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {lang === 'ar' ? 'رقم هاتف ثانٍ (اختياري)' : 'Deuxième Numéro (Optionnel)'}
                    </label>
                    <AlgerianPhoneInput
                      id="client-secondary-phone"
                      value={secondaryPhone}
                      onChange={setSecondaryPhone}
                      placeholder={lang === 'ar' ? '07 XX XX XX XX' : '07 XX XX XX XX'}
                      error={errors.secondaryPhone}
                      theme="light"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Delivery Destination */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  2. {t.wilayaLabel} & Mode de Livraison
                </h4>

                {/* Delivery mode: 3 restored options (Domicile, Stop-Desk, Magasin) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition ${
                      deliveryMode === 'domicile'
                        ? 'border-amber-500 bg-amber-50/70 text-slate-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryMode"
                      value="domicile"
                      checked={deliveryMode === 'domicile'}
                      onChange={() => setDeliveryMode('domicile')}
                      className="text-amber-500 focus:ring-amber-500"
                    />
                    <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs">{t.deliveryModeHome}</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition ${
                      deliveryMode === 'stop_desk'
                        ? 'border-amber-500 bg-amber-50/70 text-slate-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryMode"
                      value="stop_desk"
                      checked={deliveryMode === 'stop_desk'}
                      onChange={() => setDeliveryMode('stop_desk')}
                      className="text-amber-500 focus:ring-amber-500"
                    />
                    <Building className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs">{t.deliveryModeDesk}</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition ${
                      deliveryMode === 'magasin'
                        ? 'border-amber-500 bg-amber-50/70 text-slate-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryMode"
                      value="magasin"
                      checked={deliveryMode === 'magasin'}
                      onChange={() => setDeliveryMode('magasin')}
                      className="text-amber-500 focus:ring-amber-500"
                    />
                    <Store className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs">{t.deliveryModeStore}</span>
                  </label>
                </div>

                {/* Info banner when Magasin pickup is chosen */}
                {deliveryMode === 'magasin' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
                    <Store className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <strong className="font-bold text-emerald-900 block">
                        {lang === 'ar'
                          ? 'استلام مباشر من المتجر / المستودع (0 دج - مجاني)'
                          : 'Retrait direct au magasin / comptoir (0 DA - Gratuit)'}
                      </strong>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        {storeSettings.address ? `${storeSettings.address}, ${storeSettings.wilaya}` : 'Oran, Algérie'} &bull; {lang === 'ar' ? 'طلبك سيكون متاحاً للاستلام فور تجهيزه خلال 24-48 ساعة.' : 'Votre commande sera préparée et mise à votre disposition au comptoir sous 24h à 48h dès confirmation.'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.wilayaLabel} <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="client-wilaya"
                      value={wilayaCode}
                      onChange={(e) => setWilayaCode(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    >
                      {ALGERIAN_WILAYAS.map((wilaya) => (
                        <option key={wilaya.code} value={wilaya.code}>
                          {wilaya.code} - {wilaya.name} ({wilaya.arabicName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.communeLabel} {deliveryMode !== 'magasin' && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      id="client-commune"
                      type="text"
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                      placeholder={
                        deliveryMode === 'magasin'
                          ? (lang === 'ar' ? 'اختياري في حالة الاستلام من المتجر' : 'Optionnel pour retrait magasin')
                          : (lang === 'ar' ? 'مثال: وهران، بئر الجير، السانية...' : 'Ex : Bir El Djir, Es Senia, Oran...')
                      }
                      className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                        errors.commune ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                      }`}
                    />
                    {errors.commune && (
                      <span className="text-[11px] text-rose-600 mt-1 block">{errors.commune}</span>
                    )}
                  </div>
                </div>

                {/* Address: Only when Domicile */}
                {deliveryMode === 'domicile' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.addressLabel} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="client-address"
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder={lang === 'ar' ? 'رقم الشارع، الحي، نقطة دالة' : 'Numéro de rue, quartier, repère pour le livreur'}
                      className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                        errors.deliveryAddress ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                      }`}
                    />
                    {errors.deliveryAddress && (
                      <span className="text-[11px] text-rose-600 mt-1 block">{errors.deliveryAddress}</span>
                    )}
                  </div>
                )}

                {/* Preparation Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.notesLabel}
                  </label>
                  <textarea
                    id="client-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={lang === 'ar' ? 'ملاحظات خاصة بالتجهيز أو الشحن...' : 'Ex : emballage renforcé pour flacons verre, préférences de livraison...'}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </>
          )}
        </form>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {isProforma
                ? 'Génération immédiate de la Facture Proforma officielle en format PDF'
                : 'Votre Bon de précommande sera téléchargeable en PDF immédiatement'}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              {lang === 'ar' ? 'رجوع' : 'Retour au bon'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="w-1/2 sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white font-black text-xs rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>{isProforma ? t.confirmProformaBtn : t.confirmPreorderBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
