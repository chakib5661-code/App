import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  UserCheck,
  Building2,
  Phone,
  Mail,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Send,
  Info,
  AlertCircle,
  MapPin,
  Sparkles,
  KeyRound,
  Loader2,
  Clock,
  MessageCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { CustomerApplication, CustomerUser, StoreSettings } from '../types';
import { AppLanguage, translations } from '../translations';
import { ALGERIAN_WILAYAS } from '../data/wilayas';
import { loginCustomerOnServer, registerCustomerOnServer } from '../utils/api';
import { AlgerianPhoneInput } from './AlgerianPhoneInput';
import { normalizeAlgerianPhone, toAlgerianWhatsAppPhone } from '../utils/phoneUtils';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: AppLanguage;
  initialTab?: 'login' | 'register';
  applications?: CustomerApplication[];
  existingApplications?: CustomerApplication[];
  registeredCustomers?: CustomerUser[];
  onLoginSuccess: (customer: CustomerUser) => void;
  onRegisterSubmit: (application: Omit<CustomerApplication, 'id' | 'submittedAt' | 'status'> & { password?: string }) => void;
  storeSettings?: StoreSettings;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  lang = 'ar',
  initialTab = 'login',
  applications = [],
  existingApplications = [],
  registeredCustomers = [],
  onLoginSuccess,
  onRegisterSubmit,
  storeSettings,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const t = translations[lang];
  const isRtl = false; // Layout stays LTR for accessibility and right-handed reachability

  const safeStoreSettings: StoreSettings = storeSettings || {
    storeName: 'Tulip Fragrance Company',
    tagline: 'Maison de Haute Parfumerie & Matières Premières en Algérie',
    phone: '+213 799 93 83 99',
    whatsappPhone: '213799938399',
    telegramPhone: '+213799938399',
    address: 'Zone Industrielle Oued Smar, Lot B N°14',
    wilaya: '16 - Alger',
    email: 'contact@tulipfragrance.com',
    allowLowStockPreorder: true,
    minOrderAmountDA: 1000,
  };

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const allApplications = applications.length > 0 ? applications : existingApplications;

  // Login form state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register form state (Credentials assigned by Tulip administration - no password creation)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [wilayaCode, setWilayaCode] = useState('16');
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<{
    fullName: string;
    companyName: string;
    phone: string;
    wilayaName: string;
    wilayaCode: string;
  } | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanInput = usernameInput.trim();
    const cleanPassword = passwordInput.trim();

    if (!cleanInput || !cleanPassword) {
      setLoginError(
        lang === 'ar'
          ? 'يرجى إدخال اسم المستخدم أو رقم الهاتف وكلمة المرور.'
          : lang === 'en'
          ? 'Please enter your username/phone and password.'
          : 'Veuillez renseigner votre identifiant/téléphone et mot de passe.'
      );
      return;
    }

    setIsLoggingIn(true);

    try {
      // 1. Authenticate with Live Central Server
      const serverResult = await loginCustomerOnServer(cleanInput, cleanPassword);

      if (serverResult && serverResult.success && serverResult.customer) {
        setIsLoggingIn(false);
        onLoginSuccess(serverResult.customer);
        onClose();
        return;
      }

      if (serverResult && !serverResult.success && serverResult.error) {
        // If it's a specific credential error (e.g. wrong password/user suspended), show it directly
        if (!serverResult.error.includes('communication') && !serverResult.error.includes('serveur')) {
          setIsLoggingIn(false);
          setLoginError(serverResult.error);
          return;
        }
        // If communication failed (cold start, network, or offline), proceed to local fallback check below!
      }
    } catch {
      // If server temporarily failed, proceed to local fallback check
    }

    // 2. Offline / Local Fallback Check
    const cleanLower = cleanInput.toLowerCase();
    const cleanDigits = cleanInput.replace(/\D/g, '');

    const foundRegistered = registeredCustomers.find(
      (cust) =>
        (cust.username.toLowerCase() === cleanLower ||
          cust.email.toLowerCase() === cleanLower ||
          (cleanDigits && cust.phone.replace(/\D/g, '').endsWith(cleanDigits.slice(-9)))) &&
        cust.password === cleanPassword
    );

    if (foundRegistered) {
      setIsLoggingIn(false);
      if (foundRegistered.status === 'suspended') {
        setLoginError(
          lang === 'ar'
            ? 'تم تعليق هذا الحساب من طرف الإدارة.'
            : "Ce compte client a été suspendu par l'administrateur."
        );
        return;
      }
      onLoginSuccess(foundRegistered);
      onClose();
      return;
    }

    // Check in applications list
    const foundApp = allApplications.find(
      (app) =>
        (app.assignedUsername?.toLowerCase() === cleanLower ||
          app.email.toLowerCase() === cleanLower ||
          (cleanDigits && app.phone.replace(/\D/g, '').endsWith(cleanDigits.slice(-9)))) &&
        app.assignedPassword === cleanPassword
    );

    setIsLoggingIn(false);

    if (foundApp) {
      if (foundApp.status === 'pending') {
        setLoginError(
          lang === 'ar'
            ? 'حسابكم قيد التدقيق من طرف مصلحة المبيعات. سيتم تفعيله قريباً.'
            : "Votre compte est en cours d'activation par notre service commercial."
        );
        return;
      }

      const customerUser: CustomerUser = {
        id: foundApp.id,
        username: foundApp.assignedUsername || foundApp.email.split('@')[0],
        password: foundApp.assignedPassword,
        fullName: foundApp.fullName,
        email: foundApp.email,
        phone: foundApp.phone,
        secondaryPhone: foundApp.secondaryPhone,
        companyName: foundApp.companyName,
        wilayaCode: foundApp.wilayaCode,
        wilayaName: foundApp.wilayaName,
        commune: foundApp.commune,
        deliveryAddress: foundApp.deliveryAddress,
        status: foundApp.status,
        lastLogin: new Date().toISOString(),
      };

      onLoginSuccess(customerUser);
      onClose();
      return;
    }

    setLoginError(
      lang === 'ar'
        ? 'بيانات الدخول غير صحيحة. يرجى التحقق أو طلب فتح حساب من النموذج أسفله.'
        : "Identifiants ou mot de passe incorrects. Vérifiez vos données ou demandez l'ouverture d'un compte ci-dessous."
    );
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    if (!fullName.trim()) {
      setRegisterError(
        lang === 'ar' ? 'يرجى إدخال الاسم واللقب.' : 'Veuillez saisir votre Nom et Prénom.'
      );
      return;
    }

    if (!phone.trim()) {
      setRegisterError(
        lang === 'ar' ? 'يرجى إدخال رقم الهاتف.' : 'Veuillez renseigner votre numéro de téléphone.'
      );
      return;
    }

    const defaultCompanyName = 'Parfumerie Client';
    const foundWilaya = ALGERIAN_WILAYAS.find((w) => w.code === wilayaCode);
    const selectedWilayaCode = wilayaCode;
    const selectedWilayaName = foundWilaya ? foundWilaya.name : 'Alger';
    const defaultCommune = selectedWilayaName;
    const defaultNotes = 'Demande rapide (Adresse à préciser ultérieurement)';

    setIsRegistering(true);

    const cleanPhone = normalizeAlgerianPhone(phone);

    const appData = {
      fullName: fullName.trim(),
      companyName: defaultCompanyName,
      phone: cleanPhone || phone.trim(),
      secondaryPhone: undefined,
      email: email.trim().toLowerCase() || `${(cleanPhone || phone).replace(/\D/g, '')}@tulip-client.dz`,
      wilayaCode: selectedWilayaCode,
      wilayaName: selectedWilayaName,
      commune: defaultCommune,
      notes: defaultNotes,
      autoApprove: false,
    };

    try {
      // Call Central Server (persists to store_db.json as pending application)
      const res = await registerCustomerOnServer(appData);

      setIsRegistering(false);

      if (res && res.success) {
        setSubmittedApp({
          fullName: fullName.trim(),
          companyName: defaultCompanyName,
          phone: phone.trim(),
          wilayaName: selectedWilayaName,
          wilayaCode: selectedWilayaCode,
        });
        setRegisterSuccess(true);
        onRegisterSubmit({
          fullName: fullName.trim(),
          companyName: defaultCompanyName,
          phone: phone.trim(),
          secondaryPhone: undefined,
          email: email.trim().toLowerCase(),
          wilayaCode: selectedWilayaCode,
          wilayaName: selectedWilayaName,
          commune: defaultCommune,
          notes: defaultNotes,
        });
        return;
      }

      if (res && !res.success && res.error) {
        setRegisterError(res.error);
        return;
      }
    } catch {
      // Server call failed, fallback below
    }

    setIsRegistering(false);
    // Offline fallback: save application locally as pending
    onRegisterSubmit({
      fullName: fullName.trim(),
      companyName: defaultCompanyName,
      phone: phone.trim(),
      secondaryPhone: undefined,
      email: email.trim().toLowerCase(),
      wilayaCode: selectedWilayaCode,
      wilayaName: selectedWilayaName,
      commune: defaultCommune,
      notes: defaultNotes,
    });

    setSubmittedApp({
      fullName: fullName.trim(),
      companyName: defaultCompanyName,
      phone: phone.trim(),
      wilayaName: selectedWilayaName,
      wilayaCode: selectedWilayaCode,
    });
    setRegisterSuccess(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col relative max-h-[94vh] animate-in fade-in zoom-in duration-150">
        {/* Top Tulip Royal Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] shrink-0" />

        {/* Modal Top Header */}
        <div className="p-4 sm:p-6 pb-2.5 flex items-start justify-between bg-white border-b border-rose-100 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-50 text-[#9f0e4e] flex items-center justify-center border border-rose-200/90 shadow-xs shrink-0">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  {t.authModalTitle}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-[#70083b] border border-rose-300 text-[10px] sm:text-[11px] font-bold">
                  B2B • Serveur En Ligne
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                {t.authModalSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-800 rounded-lg sm:rounded-xl hover:bg-slate-100 transition cursor-pointer"
              title="Fermer (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-4 sm:px-6 pt-3 pb-2 bg-rose-50/50 border-b border-rose-100 shrink-0">
          <div className="grid grid-cols-2 p-1 bg-rose-100/70 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setLoginError(null);
              }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                tab === 'login'
                  ? 'bg-white text-[#9f0e4e] shadow-xs font-black'
                  : 'text-slate-600 hover:text-[#70083b]'
              }`}
            >
              <UserCheck className="w-4 h-4 text-[#9f0e4e]" />
              <span>{t.authLoginTab}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setRegisterError(null);
              }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                tab === 'register'
                  ? 'bg-white text-[#9f0e4e] shadow-xs font-black'
                  : 'text-slate-600 hover:text-[#70083b]'
              }`}
            >
              <Building2 className="w-4 h-4 text-[#9f0e4e]" />
              <span>{t.authRegisterTab}</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 max-h-[78vh] overflow-y-auto">
          {tab === 'login' ? (
            <div className="space-y-4">
              <div className="bg-rose-50/80 border border-rose-200/90 rounded-2xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-[#9f0e4e] shrink-0 mt-0.5" />
                <p className="text-xs text-[#70083b] leading-relaxed font-medium">
                  {t.authNoticeText}
                </p>
              </div>

              {loginError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-semibold">{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    {lang === 'ar'
                      ? 'اسم المستخدم أو رقم الهاتف أو البريد الإلكتروني'
                      : 'Identifiant, N° de téléphone ou Email'}
                  </label>
                  <div className="relative">
                    <UserCheck className={`w-4 h-4 text-slate-400 absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2`} />
                    <input
                      id="login-username-input"
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder={lang === 'ar' ? 'مثال: 0555123456 أو اسم المستخدم' : 'Ex: 0555 12 34 56 ou votre identifiant'}
                      className={`w-full ${isRtl ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-[#9f0e4e] transition`}
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {lang === 'ar'
                      ? 'يمكنك تسجيل الدخول مباشرة برقم هاتفك المسجل أو بريدك.'
                      : 'Vous pouvez vous connecter avec votre numéro de téléphone (Ex: 0555 12 34 56) ou votre identifiant.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    {t.authPasswordLabel}
                  </label>
                  <div className="relative">
                    <Lock className={`w-4 h-4 text-slate-400 absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 pointer-events-none`} />
                    <input
                      id="login-password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder={t.authPasswordPlaceholder}
                      className={`w-full ${isRtl ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-[#9f0e4e] transition`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer focus:outline-hidden`}
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      title={showPassword ? (lang === 'ar' ? 'إخفاء كلمة المرور' : 'Masquer le mot de passe') : (lang === 'ar' ? 'إظهار كلمة المرور' : 'Afficher le mot de passe')}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-500" />}
                    </button>
                  </div>
                </div>

                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer transition active:scale-[0.99] disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === 'ar' ? 'جارٍ التحقق والتسجيل...' : 'Connexion au serveur...'}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>{t.authLoginSubmit}</span>
                    </>
                  )}
                </button>
              </form>

              <div className="pt-3 text-center border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">
                  {lang === 'ar' ? 'ليس لديك حساب بعد؟' : "Vous n'avez pas encore d'identifiants d'accès ?"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setRegisterError(null);
                  }}
                  className="text-[#9f0e4e] hover:text-[#70083b] text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer hover:underline"
                >
                  <span>{lang === 'ar' ? 'طلب فتح حساب واستلام اسم المستخدم وكلمة المرور' : "Demander l'ouverture d'un compte & recevoir mes identifiants"}</span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          ) : registerSuccess && submittedApp ? (
            /* Registration Success: Credentials assigned by Tulip Administration */
            <div className="p-5 sm:p-6 text-center space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-100 text-[#70083b] flex items-center justify-center mx-auto border-2 border-rose-300 shadow-md">
                <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-[#9f0e4e]" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-300 text-[#70083b] text-xs font-black uppercase tracking-wider mb-2">
                  <Clock className="w-3.5 h-3.5 text-[#9f0e4e] animate-pulse" />
                  {lang === 'ar' ? 'طلب مسجل • قيد المراجعة' : "Demande enregistrée • En cours de validation"}
                </span>
                <h4 className="text-lg sm:text-xl font-black text-slate-900">
                  {lang === 'ar' ? 'تم استلام طلب فتح الحساب بنجاح !' : "Demande d'accès transmise avec succès !"}
                </h4>
                <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
                  {lang === 'ar'
                    ? 'شكراً لكم. للحفاظ على أمان وسرية شبكة التوزيع بالجملة، نحن من نقوم بتعيين اسم المستخدم وكلمة المرور الخاصة بكم. سيقوم فريق المبيعات بالتواصل معكم وتزويدكم ببيانات الدخول.'
                    : "Merci pour votre confiance. Pour protéger la confidentialité de notre réseau grossiste, nous vous attribuons personnellement votre Nom d'utilisateur et Mot de passe d'accès. Notre équipe commerciale vous les transmettra directement."}
                </p>
              </div>

              {/* Submitted Details Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-left max-w-md mx-auto space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">{lang === 'ar' ? 'المسؤول :' : 'Responsable :'}</span>
                  <span className="font-bold text-slate-900">{submittedApp.fullName}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">{lang === 'ar' ? 'المحل / الورشة :' : 'Boutique / Atelier :'}</span>
                  <span className="font-bold text-slate-900">{submittedApp.companyName}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">{lang === 'ar' ? 'الهاتف لاستلام الحساب :' : 'Téléphone (WhatsApp / SMS) :'}</span>
                  <span className="font-bold text-[#880e4f] font-mono">{submittedApp.phone}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">{lang === 'ar' ? 'الولاية :' : 'Wilaya :'}</span>
                  <span className="font-semibold text-slate-800">{submittedApp.wilayaCode} - {submittedApp.wilayaName}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500 font-medium">{lang === 'ar' ? 'الحالة :' : 'Statut :'}</span>
                  <span className="font-bold text-[#70083b] bg-rose-100/90 px-2.5 py-0.5 rounded-md text-[11px] flex items-center gap-1 border border-rose-200">
                    <Clock className="w-3 h-3 text-[#9f0e4e]" />
                    {lang === 'ar' ? 'في انتظار تزويدكم ببيانات الدخول' : "Attribution des identifiants en cours"}
                  </span>
                </div>
              </div>

              {/* WhatsApp direct expedite button */}
              <div className="pt-2 flex flex-col gap-2.5 max-w-md mx-auto">
                <a
                  href={`https://wa.me/213799938399?text=${encodeURIComponent(
                    `Bonjour Tulip Fragrance Company,\nJe viens d'envoyer ma demande d'accès grossiste B2B pour :\n• Nom : ${submittedApp.fullName}\n• Établissement : ${submittedApp.companyName}\n• Téléphone : ${submittedApp.phone}\n• Wilaya : ${submittedApp.wilayaName}\n\nPouvez-vous s'il vous plaît valider mon compte et me communiquer mes identifiants de connexion ? Merci !`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {lang === 'ar'
                      ? 'مراسلة الإدارة عبر واتساب لاستلام بيانات الدخول فوراً (+213 799 93 83 99)'
                      : 'Accélérer la réception de vos identifiants via WhatsApp (+213 799 93 83 99)'}
                  </span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setUsernameInput(submittedApp.phone);
                    setRegisterSuccess(false);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'لدي حساب بالفعل -> الذهاب لتسجيل الدخول' : "J'ai reçu mes identifiants -> Me connecter"}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-slate-500 hover:text-slate-700 py-1 transition cursor-pointer"
                >
                  {lang === 'ar' ? 'متابعة تصفح الكتالوج' : 'Continuer la visite du showroom'}
                </button>
              </div>
            </div>
          ) : (
            /* Registration Form: Request Access (Credentials given by Tulip) */
            <div className="space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#9f0e4e] shrink-0 mt-0.5" />
                <div className="text-xs text-[#70083b] leading-relaxed space-y-1">
                  <p className="font-bold">
                    {lang === 'ar'
                      ? 'نظام الحسابات المهنية المعتمدة (B2B) :'
                      : 'Attribution de vos identifiants par Tulip Fragrance :'}
                  </p>
                  <p className="font-normal text-[#880e4f]">
                    {lang === 'ar'
                      ? 'للحفاظ على سرية وهوامش أرباح زبائننا وصناع العطور، لا تحتاج إلى إنشاء كلمة مرور. نحن من نقوم بتعيين اسم المستخدم وكلمة المرور الرسمية وتزويدكم بها عبر الهاتف أو واتساب بعد مراجعة بيانات نشاطكم.'
                      : "Afin de protéger la confidentialité des marges de nos artisans et revendeurs, vous n'avez pas de mot de passe à créer. Notre équipe commerciale vous attribuera personnellement votre Nom d'utilisateur et Mot de passe après vérification de votre activité."}
                  </p>
                </div>
              </div>

              {registerError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold">{registerError}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    {t.authRegisterFullName} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="reg-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: كريم عمراني' : 'Ex: Karim Amrani'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-[#9f0e4e] transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    {t.authRegisterPhone} <span className="text-rose-500">*</span>
                  </label>
                  <AlgerianPhoneInput
                    id="reg-phone"
                    value={phone}
                    onChange={setPhone}
                    placeholder="05 55 12 34 56"
                    theme="light"
                    required
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {lang === 'ar' ? 'الرقم الذي ستصلك عليه بيانات الدخول عبر واتساب أو الهاتف' : 'Le numéro qui recevra vos identifiants par WhatsApp ou appel'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    {t.authRegisterEmail}
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: contact@parfumerie.dz"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-[#9f0e4e] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    {t.wilayaLabel} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="reg-wilaya"
                    value={wilayaCode}
                    onChange={(e) => setWilayaCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#9f0e4e] transition cursor-pointer"
                    required
                  >
                    {ALGERIAN_WILAYAS.map((wilaya) => (
                      <option key={wilaya.code} value={wilaya.code}>
                        {wilaya.code} - {wilaya.name} ({wilaya.arabicName})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-600 text-[11px] leading-relaxed">
                  {lang === 'ar'
                    ? '💡 سنطلب منكم تفاصيل وعنوان التوصيل (الولاية، البلدية والعنوان الكامل) لاحقاً عند تأكيد طلبيتكم الأولى.'
                    : '💡 Vos coordonnées de livraison complètes (Wilaya, Commune, Adresse) vous seront demandées ultérieurement lors de la validation de votre première précommande.'}
                </div>

                <button
                  id="btn-register-submit"
                  type="submit"
                  disabled={isRegistering}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#70083b] via-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer transition disabled:opacity-50"
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === 'ar' ? 'جارٍ إرسال الطلب...' : "Envoi de la demande d'accès..."}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'إرسال الطلب للحصول على اسم مستخدم وكلمة مرور' : "Envoyer ma demande d'accès & recevoir mes identifiants"}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
