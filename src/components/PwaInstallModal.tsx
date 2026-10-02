/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  Share2,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  Zap,
  WifiOff,
  ShieldCheck,
  Sparkles,
  X,
  ExternalLink,
  ChevronRight,
  Info,
  HelpCircle,
  Laptop,
  Check,
} from 'lucide-react';
import { DeviceInfo, detectUserDevice } from '../utils/deviceDetector';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceInfo?: DeviceInfo;
  isInstallable?: boolean;
  isInstalled?: boolean;
  onPromptInstall?: () => Promise<boolean>;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
  deviceInfo: rawDeviceInfo,
  isInstallable = false,
  isInstalled = false,
  onPromptInstall = async () => false,
}) => {
  const deviceInfo = rawDeviceInfo || detectUserDevice();
  const [activeTab, setActiveTab] = useState<'install' | 'advice'>('install');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      const outcome = await onPromptInstall();
      if (outcome) {
        setInstallSuccess(true);
        setTimeout(() => {
          setInstallSuccess(false);
          onClose();
        }, 2000);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const isApple = deviceInfo.deviceType === 'iphone' || deviceInfo.deviceType === 'ipad';
  const isAndroid = deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'tablet';

  return (
    <div
      id="pwa-install-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        id="pwa-install-modal-container"
        className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col border border-slate-200/80 max-h-[94vh]"
      >
        {/* Modal Top Header */}
        <div className="bg-linear-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-5 sm:p-6 relative">
          <button
            type="button"
            id="close-pwa-modal-btn"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 p-2 shadow-inner">
              <img
                src="/tulip-logo.svg"
                alt="Tulip Logo"
                className="w-full h-full object-contain drop-shadow"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  APPLICATION WEB PROGRESSIVE (PWA)
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Installer Tulip Fragrance
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                Profitez d'un accès ultra-rapide et sécurisé à vos commandes de matières premières directement depuis votre écran d'accueil.
              </p>
            </div>
          </div>

          

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-white/10">
            <button
              type="button"
              id="pwa-tab-install"
              onClick={() => setActiveTab('install')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'install'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Guide d'Installation</span>
            </button>
            <button
              type="button"
              id="pwa-tab-advice"
              onClick={() => setActiveTab('advice')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'advice'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Avantages &amp; Conseils</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-slate-700 text-sm">
          {/* In-App Browser Warning Alert */}
          {deviceInfo.isInAppBrowser && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm">
                  Navigateur interne détecté ({deviceInfo.inAppName || 'Réseau social'})
                </p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Les applications comme {deviceinfoInAppText(deviceInfo.inAppName)} bloquent l'installation native des applications sur votre téléphone.
                  Pour installer Tulip, appuyez sur les <strong>3 petits points (⋮)</strong> en haut ou en bas et choisissez <strong>« Ouvrir dans Chrome »</strong> ou <strong>« Ouvrir dans Safari »</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Already installed state */}
          {isInstalled && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-900">Application déjà installée !</h4>
                <p className="text-xs text-emerald-700">
                  Tulip Fragrance est installée sur votre {deviceInfo.phoneModel}. Vous pouvez y accéder directement depuis l'écran d'accueil de votre téléphone.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'install' ? (
            <div className="space-y-5">
              {/* Direct 1-Click Install Button if supported by browser */}
              {isInstallable && !isApple && !isInstalled && (
                <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-slate-950/10">
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        Installation Directe Prête
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white">
                      Installer en 1 clic sur votre {deviceInfo.phoneBrand}
                    </p>
                    <p className="text-xs text-slate-400">
                      Ajoute l'icône Tulip à vos applications sans passer par le Play Store
                    </p>
                  </div>

                  <button
                    type="button"
                    id="pwa-native-install-button"
                    onClick={handleInstallClick}
                    disabled={isInstalling}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition shadow-md shadow-amber-500/20 shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isInstalling ? 'Installation en cours...' : 'Installer Maintenant'}</span>
                  </button>
                </div>
              )}

              {/* Success Message Banner */}
              {installSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500 text-white font-bold text-xs text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Application installée avec succès sur votre téléphone !</span>
                </div>
              )}

              {/* Tailored Phone Guides */}
              {isApple ? (
                /* IPHONE / IPAD SPECIFIC STEP-BY-STEP */
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-amber-600" />
                      <span>Guide d'installation pour iPhone ({deviceInfo.phoneModel})</span>
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      Navigateur Safari
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Apple requiert l'utilisation du navigateur <strong>Safari</strong> pour installer une application sur l'écran d'accueil. Suivez ces 3 étapes simples :
                  </p>

                  <div className="space-y-3">
                    {/* Step 1 */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-700 font-black text-xs flex items-center justify-center shrink-0">
                        1
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>Appuyez sur le bouton Partager</span>
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-blue-50 text-blue-600 border border-blue-200">
                            <Share2 className="w-3 h-3" />
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          En bas de votre écran Safari, appuyez sur l'icône carrée avec une flèche vers le haut (Partager).
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-700 font-black text-xs flex items-center justify-center shrink-0">
                        2
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>Sélectionnez « Sur l'écran d'accueil »</span>
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-amber-50 text-amber-600 border border-amber-200">
                            <PlusSquare className="w-3 h-3" />
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Faites défiler le menu d'options vers le bas et touchez la ligne <strong>« Sur l'écran d'accueil »</strong> (ou <em>« Add to Home Screen »</em>).
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-700 font-black text-xs flex items-center justify-center shrink-0">
                        3
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-slate-900">
                          Appuyez sur « Ajouter » en haut à droite
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Confirmez l'ajout. L'icône Tulip apparaîtra immédiatement sur votre écran d'accueil avec vos autres applications !
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ANDROID (SAMSUNG, XIAOMI, PIXEL, OPPO, ETC.) STEP-BY-STEP */
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span>Guide d'installation pour {deviceInfo.phoneBrand} ({deviceInfo.phoneModel})</span>
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {deviceInfo.browserName}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Si le bouton d'installation directe ci-dessus ne s'est pas affiché, vous pouvez installer l'application manuellement en 2 secondes :
                  </p>

                  <div className="space-y-3">
                    {/* Step 1 */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0">
                        1
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>Ouvrez le menu du navigateur</span>
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-200 text-slate-700 font-bold text-xs">
                            ⋮
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Appuyez sur les <strong>trois points verticaux (⋮)</strong> en haut à droite sur Chrome (ou les barres en bas sur Samsung Internet).
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0">
                        2
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>Appuyez sur « Installer l'application »</span>
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">
                            <Download className="w-3 h-3" />
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Sélectionnez <strong>« Installer l'application »</strong> (ou <strong>« Ajouter à l'écran d'accueil »</strong>).
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0">
                        3
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-slate-900">
                          Validez l'installation
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Confirmez en touchant <strong>« Installer »</strong>. L'application Tulip sera ajoutée à votre tiroir d'applications et à votre écran d'accueil.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ADVICE & BEST PRACTICES TAB */
            <div className="space-y-5">
              {/* Why install? */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>Pourquoi installer Tulip Fragrance sur votre téléphone ?</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                      <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Accès Direct en 1 Clic</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Fini les recherches de liens ou la saisie d'adresses. Lancez votre catalogue Tulip comme WhatsApp ou Instagram.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                      <WifiOff className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>Mode Hors-Ligne & 3G/4G</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Idéal en Algérie lors des baisses de connexion : le catalogue et vos brouillons restent accessibles même sans Internet.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Session Grossiste Mémorisée</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Vos tarifs professionnels et votre compte validé restent connectés en toute sécurité sur votre téléphone.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
                      <span>Affichage Plein Écran</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Expérience fluide et immersive sans barres d'onglets de navigateur encombrantes.
                    </p>
                  </div>
                </div>
              </div>

              {/* What to DO vs what to AVOID */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Conseils essentiels d'utilisation (À faire &amp; À éviter)</span>
                </h3>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 flex items-start gap-2.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>À FAIRE :</strong> Utilisez votre navigateur officiel par défaut (<strong>Safari</strong> sur iPhone, <strong>Google Chrome</strong> ou <strong>Samsung Internet</strong> sur Android) pour une synchronisation fluide.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 flex items-start gap-2.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>À FAIRE :</strong> Utilisez le bouton <em>« Sauvegarder la précommande »</em> dans le panier pour conserver des listes de réapprovisionnement récurrentes sans devoir chercher chaque extrait.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-950 flex items-start gap-2.5 text-xs">
                    <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>À ÉVITER :</strong> N'essayez pas d'installer l'application depuis le navigateur interne de Facebook, WhatsApp, Instagram ou TikTok. Ouvrez le lien dans Chrome ou Safari.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-950 flex items-start gap-2.5 text-xs">
                    <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>À ÉVITER :</strong> Ne supprimez pas les cookies ou données de navigation de l'application sur votre téléphone pour ne pas effacer vos favoris et sessions locales.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 text-center sm:text-left">
            Application certifiée conforme PWA pour <strong>{deviceInfo.phoneBrand} ({deviceInfo.phoneModel})</strong>
          </div>

          <button
            type="button"
            id="close-pwa-modal-footer-btn"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

function deviceinfoInAppText(inAppName: string | null): string {
  if (!inAppName) return 'Facebook, Instagram ou WhatsApp';
  return inAppName;
}
