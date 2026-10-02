import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Zap,
  Info,
  X,
  Bot,
  FileText,
  UserCheck,
  Package,
  Layers,
  ArrowRight,
  Sliders,
  Copy,
} from 'lucide-react';
import { StoreSettings } from '../types';
import {
  fetchTelegramStatus,
  triggerTelegramTest,
  saveTelegramSettings,
  detectTelegramChats,
  TelegramStatusResponse,
  DetectedTelegramChat,
} from '../utils/api';

interface AdminTelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeSettings: StoreSettings;
  onUpdateSettings?: (newSettings: StoreSettings) => void;
}

export const AdminTelegramModal: React.FC<AdminTelegramModalProps> = ({
  isOpen,
  onClose,
  storeSettings,
  onUpdateSettings,
}) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<TelegramStatusResponse | null>(null);

  // Dedicated Chat IDs for each notification type as requested:
  const [preorderChatId, setPreorderChatId] = useState(storeSettings.telegramPreorderChatId || '');
  const [proformaChatId, setProformaChatId] = useState(storeSettings.telegramProformaChatId || '');
  const [accessChatId, setAccessChatId] = useState(storeSettings.telegramAccessChatId || '');
  const [generalChatId, setGeneralChatId] = useState(storeSettings.telegramChatId || '');

  const [botToken, setBotToken] = useState(
    storeSettings.telegramBotToken || '8908435035:AAFYIq74hxJeFeiQAPRx_g_WZ7R5fL0uwu8'
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    storeSettings.telegramNotificationsEnabled !== false
  );

  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    channel?: string;
    message: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAdvancedToken, setShowAdvancedToken] = useState(false);

  // Telegram Chat ID Detector state
  const [detectedChats, setDetectedChats] = useState<DetectedTelegramChat[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectNotice, setDetectNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const runChatDetection = async () => {
    setDetecting(true);
    setDetectNotice(null);
    try {
      const res = await detectTelegramChats(botToken);
      if (res.success && res.detectedChats && res.detectedChats.length > 0) {
        setDetectedChats(res.detectedChats);
        setDetectNotice(`${res.detectedChats.length} canal/canaux et groupes Telegram détectés avec succès !`);
      } else {
        setDetectNotice(res.error || 'Aucun nouveau groupe détecté. Envoyez un message dans le groupe avec le bot puis réessayez.');
      }
    } catch (err: any) {
      setDetectNotice(err.message || 'Erreur lors du scan Telegram.');
    } finally {
      setDetecting(false);
    }
  };

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetchTelegramStatus();
      setStatus(res);
      if (res.preorderChatId && !preorderChatId) setPreorderChatId(res.preorderChatId);
      if (res.proformaChatId && !proformaChatId) setProformaChatId(res.proformaChatId);
      if (res.accessChatId && !accessChatId) setAccessChatId(res.accessChatId);
      if (res.chatId && !generalChatId) setGeneralChatId(res.chatId);
    } catch (err) {
      console.error('Error fetching Telegram status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPreorderChatId(storeSettings.telegramPreorderChatId || '');
      setProformaChatId(storeSettings.telegramProformaChatId || '');
      setAccessChatId(storeSettings.telegramAccessChatId || '');
      setGeneralChatId(storeSettings.telegramChatId || '');
      setBotToken(storeSettings.telegramBotToken || '8908435035:AAFYIq74hxJeFeiQAPRx_g_WZ7R5fL0uwu8');
      setNotificationsEnabled(storeSettings.telegramNotificationsEnabled !== false);
      loadStatus();
      runChatDetection();
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen, storeSettings]);

  if (!isOpen) return null;

  const handleTestChannel = async (
    channelType: 'preorder' | 'proforma' | 'access' | 'general',
    targetChatId: string
  ) => {
    setTestingChannel(channelType);
    setTestResult(null);
    try {
      const effectiveChatId = targetChatId.trim() || generalChatId.trim();
      const res = await triggerTelegramTest(effectiveChatId, botToken, channelType);
      if (res.success) {
        setTestResult({
          success: true,
          channel: channelType,
          message: res.message || 'Notification test reçue avec succès sur Telegram !',
        });
      } else {
        setTestResult({
          success: false,
          channel: channelType,
          message: res.error || "Échec de l'envoi du test sur ce canal.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        channel: channelType,
        message: err.message || 'Erreur réseau.',
      });
    } finally {
      setTestingChannel(null);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveSuccess(false);
    try {
      const newSettingsPayload = {
        telegramChatId: generalChatId.trim(),
        telegramPreorderChatId: preorderChatId.trim(),
        telegramProformaChatId: proformaChatId.trim(),
        telegramAccessChatId: accessChatId.trim(),
        telegramBotToken: botToken.trim(),
        telegramNotificationsEnabled: notificationsEnabled,
      };

      const res = await saveTelegramSettings(newSettingsPayload);
      if (res.success) {
        setSaveSuccess(true);
        if (onUpdateSettings) {
          onUpdateSettings({
            ...storeSettings,
            ...newSettingsPayload,
          });
        }
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const assignChatToChannel = (chatId: string, channel: 'preorder' | 'proforma' | 'access' | 'general') => {
    if (channel === 'preorder') setPreorderChatId(chatId);
    else if (channel === 'proforma') setProformaChatId(chatId);
    else if (channel === 'access') setAccessChatId(chatId);
    else if (channel === 'general') setGeneralChatId(chatId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Routage des Notifications Telegram
                </h3>
                {status?.bot ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Bot En Ligne
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-semibold border border-amber-500/30">
                    Connexion...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Acheminez les précommandes, proformas et demandes d&apos;accès vers différents canaux / groupes Telegram
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Bot Identity Card */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{status?.bot?.first_name || 'Tulip Fragrance Bot'}</span>
                  <span className="text-xs font-mono text-sky-400">@{status?.bot?.username || 'tulip5661bot'}</span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>ID : {status?.bot?.id || '8908435035'}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium">Actif pour alertes automatiques</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={loadStatus}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Rafraîchir la détection des groupes"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Actualiser</span>
              </button>
              <a
                href={`https://t.me/${status?.bot?.username || 'tulip5661bot'}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <span>Ouvrir Telegram</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Master Enable/Disable Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">
                Notifications Automatiques Telegram
              </span>
              <span className="text-[11px] text-slate-400 block">
                Envoyer chaque événement en temps réel vers les canaux correspondants ci-dessous
              </span>
            </div>
            <button
              type="button"
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 cursor-pointer ${
                notificationsEnabled ? 'bg-sky-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-300 ${
                  notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3 Dedicated Channels Configuration */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              Configuration des Destinataires par Type d&apos;Événement :
            </div>

            {/* CHANNEL 1: PREORDERS */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-pink-500/30 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center font-bold text-sm">
                    🌸
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      1. Précommandes Fermes (Commandes Standard)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Reçoit chaque nouvelle commande passée par les clients (PDF, quantités, wilaya)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestChannel('preorder', preorderChatId)}
                  disabled={testingChannel !== null}
                  className="px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Send className={`w-3 h-3 ${testingChannel === 'preorder' ? 'animate-pulse' : ''}`} />
                  <span>{testingChannel === 'preorder' ? 'Envoi...' : 'Tester ce canal'}</span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Chat ID ou Groupe Telegram pour les Précommandes :
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={preorderChatId}
                    onChange={(e) => setPreorderChatId(e.target.value)}
                    placeholder="Ex: -5365585827 (groupe commande) ou ID privé"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-pink-500 transition"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Si vide, utilisera le canal par défaut ({generalChatId || 'groupe commande -5365585827'}).
                </p>
              </div>
            </div>

            {/* CHANNEL 2: PROFORMA */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-amber-500/30 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-sm">
                    📄
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      2. Factures Proforma (Devis Express 48H)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Reçoit les demandes de facture proforma et devis générés par les clients
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestChannel('proforma', proformaChatId)}
                  disabled={testingChannel !== null}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Send className={`w-3 h-3 ${testingChannel === 'proforma' ? 'animate-pulse' : ''}`} />
                  <span>{testingChannel === 'proforma' ? 'Envoi...' : 'Tester ce canal'}</span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Chat ID ou Groupe Telegram pour les Factures Proforma :
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={proformaChatId}
                    onChange={(e) => setProformaChatId(e.target.value)}
                    placeholder="Ex: -5365585827 ou un groupe / canal dédié Proforma"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-amber-500 transition"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Si vide, utilisera le canal par défaut ({generalChatId || 'groupe commande -5365585827'}).
                </p>
              </div>
            </div>

            {/* CHANNEL 3: ACCESS REQUESTS */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-sky-500/30 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold text-sm">
                    🔑
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      3. Demandes d&apos;Accès Professionnel (Inscription Clients)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Reçoit les demandes de création de compte pro à valider par l&apos;administrateur
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestChannel('access', accessChatId)}
                  disabled={testingChannel !== null}
                  className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Send className={`w-3 h-3 ${testingChannel === 'access' ? 'animate-pulse' : ''}`} />
                  <span>{testingChannel === 'access' ? 'Envoi...' : 'Tester ce canal'}</span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Chat ID ou Groupe Telegram pour les Demandes d&apos;Accès :
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={accessChatId}
                    onChange={(e) => setAccessChatId(e.target.value)}
                    placeholder="Ex: 5680755596 (compte admin) ou un groupe dédié Accès Pro"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-sky-500 transition"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Si vide, utilisera le canal par défaut ({generalChatId || 'compte admin 5680755596'}).
                </p>
              </div>
            </div>

            {/* CHANNEL FALLBACK / GENERAL */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Canal Général / Repli par défaut
                </label>
                <button
                  type="button"
                  onClick={() => handleTestChannel('general', generalChatId)}
                  disabled={testingChannel !== null}
                  className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 font-semibold transition cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>Tester canal général</span>
                </button>
              </div>
              <input
                type="text"
                value={generalChatId}
                onChange={(e) => setGeneralChatId(e.target.value)}
                placeholder="Ex: -5365585827, 5680755596"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-slate-500"
              />
              <p className="text-[10px] text-slate-400">
                Canal universel utilisé si un des canaux ci-dessus est non renseigné. Séparez par des virgules pour diffuser à plusieurs IDs.
              </p>
            </div>
          </div>

          {/* CHAT ID DETECTOR SECTION */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-850 border border-sky-500/30 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <span>Détecteur de Chat ID & Groupes Telegram</span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold">
                      {detectedChats.length} détecté(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Détecte automatiquement les IDs de vos groupes et discussions privées pour les assigner en 1 clic
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={runChatDetection}
                disabled={detecting}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${detecting ? 'animate-spin' : ''}`} />
                <span>{detecting ? 'Scan en cours...' : 'Scanner les Nouveaux Groupes'}</span>
              </button>
            </div>

            {/* Notification alert from detector */}
            {detectNotice && (
              <div className="p-2.5 rounded-xl bg-sky-950/60 border border-sky-600/40 text-sky-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>{detectNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDetectNotice(null)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* List of Detected Chats */}
            {detectedChats.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {detectedChats.map((chat) => {
                  const isAssignedPreorder = preorderChatId.includes(chat.chatId);
                  const isAssignedProforma = proformaChatId.includes(chat.chatId);
                  const isAssignedAccess = accessChatId.includes(chat.chatId);
                  const isAssignedGeneral = generalChatId.includes(chat.chatId);

                  return (
                    <div
                      key={chat.chatId}
                      className="p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{chat.name}</span>
                          {chat.chatType === 'group' || chat.chatType === 'supergroup' ? (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-semibold border border-purple-500/30">
                              Groupe
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                              Contact Privé
                            </span>
                          )}
                          {chat.username && (
                            <span className="text-slate-400 font-mono text-[11px]">@{chat.username}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-sky-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1.5">
                            ID: <strong>{chat.chatId}</strong>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(chat.chatId);
                                setCopiedId(chat.chatId);
                                setTimeout(() => setCopiedId(null), 2500);
                              }}
                              className="text-slate-400 hover:text-white p-0.5"
                              title="Copier cet ID"
                            >
                              {copiedId === chat.chatId ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </span>

                          {/* Current Assignments Badges */}
                          {isAssignedPreorder && (
                            <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 text-[10px] font-bold border border-pink-500/30">
                              🌸 Précommandes
                            </span>
                          )}
                          {isAssignedProforma && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                              📄 Proforma
                            </span>
                          )}
                          {isAssignedAccess && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold border border-sky-500/30">
                              🔑 Accès Pro
                            </span>
                          )}
                          {isAssignedGeneral && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-bold">
                              ⚡ Général
                            </span>
                          )}
                        </div>

                        {chat.lastMessage && (
                          <div className="text-[10px] text-slate-400 truncate max-w-md">
                            Dernier message : &ldquo;{chat.lastMessage}&rdquo;
                          </div>
                        )}
                      </div>

                      {/* 1-Click Assignment Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        <span className="text-[10px] text-slate-400 font-semibold mr-0.5 hidden sm:inline">
                          Assigner :
                        </span>
                        <button
                          type="button"
                          onClick={() => assignChatToChannel(chat.chatId, 'preorder')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                            isAssignedPreorder
                              ? 'bg-pink-600 text-white border-pink-500 shadow-xs'
                              : 'bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border-pink-500/30'
                          }`}
                          title="Assigner aux notifications de Précommandes"
                        >
                          🌸 Précommandes
                        </button>

                        <button
                          type="button"
                          onClick={() => assignChatToChannel(chat.chatId, 'proforma')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                            isAssignedProforma
                              ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                              : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}
                          title="Assigner aux Factures Proforma"
                        >
                          📄 Proforma
                        </button>

                        <button
                          type="button"
                          onClick={() => assignChatToChannel(chat.chatId, 'access')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                            isAssignedAccess
                              ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
                              : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border-sky-500/30'
                          }`}
                          title="Assigner aux Demandes d'Accès Client"
                        >
                          🔑 Accès Pro
                        </button>

                        <button
                          type="button"
                          onClick={() => assignChatToChannel(chat.chatId, 'general')}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                            isAssignedGeneral
                              ? 'bg-slate-700 text-white border-slate-500'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                          }`}
                          title="Assigner comme canal de repli général"
                        >
                          ⚡ Général
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400 space-y-1">
                <p>Aucun canal détecté pour le moment.</p>
                <p className="text-[11px] text-slate-500">
                  Cliquez sur « Scanner les Nouveaux Groupes » ou suivez le guide ci-dessous pour ajouter un groupe.
                </p>
              </div>
            )}

            {/* How-to connect a new group banner */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-sky-400" />
                <span>Comment connecter un nouveau groupe ou canal Telegram ?</span>
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-400 pl-1">
                <li>Ajoutez le bot <strong className="text-white">@tulip5661bot</strong> comme administrateur ou membre dans votre groupe Telegram</li>
                <li>Envoyez n&apos;importe quel message dans le groupe (ex : <em>« Bonjour Tulip »</em>)</li>
                <li>Cliquez sur le bouton <strong className="text-sky-300">« Scanner les Nouveaux Groupes »</strong> ci-dessus : le groupe s&apos;affichera automatiquement avec son ID négatif !</li>
              </ol>
            </div>
          </div>

          {/* Collapsible Advanced: Bot Token */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedToken(!showAdvancedToken)}
              className="w-full p-3 bg-slate-900/60 hover:bg-slate-900 flex items-center justify-between text-xs font-semibold text-slate-300 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                Paramètres Avancés : Token du Bot Telegram
              </span>
              <span className="text-[11px] text-sky-400 font-mono">
                {showAdvancedToken ? 'Masquer' : 'Afficher'}
              </span>
            </button>

            {showAdvancedToken && (
              <div className="p-4 bg-slate-950/80 border-t border-slate-800 space-y-2">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Token Bot HTTP API :
                </label>
                <input
                  type="text"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="8908435035:AAFYIq74hxJeFeiQAPRx_g_WZ7R5fL0uwu8"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-sky-500"
                />
                <p className="text-[10px] text-slate-400">
                  Ce token permet au serveur Tulip d&apos;authentifier et poster les messages via @tulip5661bot.
                </p>
              </div>
            )}
          </div>

          {/* Test Feedback Toast / Alert */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{testResult.message}</div>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Configuration des canaux Telegram enregistrée avec succès !
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 text-center sm:text-left">
            Les changements sont immédiatement appliqués sur le serveur central.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Enregistrement...' : 'Enregistrer la configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
