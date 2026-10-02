import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Activity,
  Flame,
  Search,
  CheckCircle2,
  AlertCircle,
  Play,
  Download,
  Trash2,
  RefreshCw,
  ExternalLink,
  Lock,
  Layers,
  ShoppingBag,
  FileText,
  MessageSquare,
  ShieldCheck,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { AnalyticsSettings, CustomAnalyticsEvent, SearchQueryLog } from '../types';
import {
  getAnalyticsSettings,
  saveAnalyticsSettings,
  getStoredEvents,
  getStoredSearchLogs,
  clearAnalyticsData,
  trackCustomEvent,
  getEnvAnalyticsConfig,
} from '../utils/analytics';
import { formatDZD } from '../utils/pdfGenerator';

interface AdminAnalyticsProps {
  isAdmin: boolean;
}

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ isAdmin }) => {
  const [settings, setSettings] = useState<AnalyticsSettings>(getAnalyticsSettings);
  const [events, setEvents] = useState<CustomAnalyticsEvent[]>(getStoredEvents);
  const [searchLogs, setSearchLogs] = useState<SearchQueryLog[]>(getStoredSearchLogs);
  const [activeSubTab, setActiveSubTab] = useState<'ga4' | 'events' | 'heatmaps' | 'search'>('events');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const envConfig = getEnvAnalyticsConfig();

  // Form states
  const [ga4IdInput, setGa4IdInput] = useState(settings.ga4MeasurementId || '');
  const [ga4EnabledInput, setGa4EnabledInput] = useState(settings.ga4Enabled);
  const [heatmapProviderInput, setHeatmapProviderInput] = useState(settings.heatmapProvider);
  const [heatmapIdInput, setHeatmapIdInput] = useState(settings.heatmapProjectId || '');
  const [heatmapEnabledInput, setHeatmapEnabledInput] = useState(settings.heatmapsEnabled);
  const [searchFilter, setSearchFilter] = useState('');
  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>('all');

  // Heatmap simulation interactive view
  const [selectedHeatmapPage, setSelectedHeatmapPage] = useState<'catalog' | 'quick_order' | 'checkout'>('catalog');

  const refreshData = () => {
    setEvents(getStoredEvents());
    setSearchLogs(getStoredSearchLogs());
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveGA4 = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = ga4IdInput.trim().toUpperCase();
    const updated: AnalyticsSettings = {
      ...settings,
      ga4Enabled: ga4EnabledInput,
      ga4MeasurementId: cleanId,
    };
    setSettings(updated);
    saveAnalyticsSettings(updated);
    setSaveToast('Configuration Google Analytics 4 enregistrée avec succès !');
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleSaveHeatmaps = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = heatmapIdInput.trim();
    const updated: AnalyticsSettings = {
      ...settings,
      heatmapsEnabled: heatmapEnabledInput,
      heatmapProvider: heatmapProviderInput,
      heatmapProjectId: cleanId,
    };
    setSettings(updated);
    saveAnalyticsSettings(updated);
    setSaveToast(`Configuration Heatmaps & Replays (${heatmapProviderInput.toUpperCase()}) enregistrée !`);
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleTestPing = () => {
    trackCustomEvent('test_diagnostic_ping', 'interaction', 'Vérification Système Admin', 1, {
      triggeredBy: 'admin_dashboard',
      timestamp: new Date().toISOString(),
    });
    refreshData();
    setSaveToast('Événement de test envoyé avec succès !');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleClearData = () => {
    if (confirm('Voulez-vous réinitialiser l’historique des événements et recherches enregistrés ?')) {
      clearAnalyticsData();
      refreshData();
    }
  };

  const handleExportCSV = () => {
    if (events.length === 0) {
      alert('Aucun événement à exporter.');
      return;
    }
    const headers = ['ID', 'Date', 'Nom Evenement', 'Categorie', 'Libelle', 'Valeur'];
    const rows = events.map((ev) => [
      ev.id,
      ev.timestamp,
      ev.eventName,
      ev.category,
      ev.label || '',
      ev.value || 0,
    ]);
    const csvContent = [headers, ...rows].map((e) => e.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tulip_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics calculation
  const totalEvents = events.length;
  const orderEventsCount = events.filter((e) => e.eventName === 'order_submitted').length;
  const proformaEventsCount = events.filter((e) => e.eventName === 'proforma_requested').length;
  const pdfDownloadsCount = events.filter((e) => e.eventName === 'pdf_downloaded').length;
  const whatsappSharesCount = events.filter((e) => e.eventName === 'whatsapp_shared').length;
  const cartAddsCount = events.filter((e) => e.eventName === 'add_to_cart').length;

  // Search aggregations
  const totalSearches = searchLogs.length;
  const zeroResultSearches = searchLogs.filter((s) => s.resultsCount === 0);

  // Group top queries
  const queryCounts: Record<string, number> = {};
  searchLogs.forEach((log) => {
    queryCounts[log.query] = (queryCounts[log.query] || 0) + 1;
  });
  const topQueries = Object.entries(queryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const filteredEvents = events.filter((e) => {
    if (eventCategoryFilter !== 'all' && e.category !== eventCategoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Outils d'Analyse & Trafic</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold text-[11px] border border-rose-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-rose-400" />
              <span>Accès Administrateur Dédié</span>
            </span>
          </div>
          <h2 className="text-lg font-black text-white tracking-tight">
            Tableau de Bord Analytique & Audience B2B
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Suivi Google Analytics 4, enregistrement d'événements e-commerce, heatmaps de clics et recherche interne.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestPing}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Envoyer un événement test"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Tester Diagnostic</span>
          </button>

          <button
            type="button"
            onClick={refreshData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="Actualiser les données"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Événements</span>
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">{totalEvents}</div>
          <span className="text-[10px] text-blue-400">Total capturé</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Commandes</span>
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono">{orderEventsCount}</div>
          <span className="text-[10px] text-slate-400">Réservations stock</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Proformas</span>
            <FileText className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 font-mono">{proformaEventsCount}</div>
          <span className="text-[10px] text-slate-400">Devis demandés</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>PDF Bons</span>
            <Download className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">{pdfDownloadsCount}</div>
          <span className="text-[10px] text-slate-400">Téléchargements</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Partages WA</span>
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono">{whatsappSharesCount}</div>
          <span className="text-[10px] text-slate-400">Direct WhatsApp</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Recherches</span>
            <Search className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">{totalSearches}</div>
          <span className="text-[10px] text-purple-400">{zeroResultSearches.length} sans résultat</span>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('events')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeSubTab === 'events'
              ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Suivi Événements Personnalisés</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 font-mono">
            {events.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('ga4')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeSubTab === 'ga4'
              ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Configuration Google Analytics 4</span>
          {settings.ga4Enabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('heatmaps')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeSubTab === 'heatmaps'
              ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Heatmaps & Session Replays</span>
          {settings.heatmapsEnabled && (
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('search')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeSubTab === 'search'
              ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Site Search Analytics</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 font-mono">
            {searchLogs.length}
          </span>
        </button>
      </div>

      {/* SUBTAB 1: CUSTOM EVENTS TRACKING */}
      {activeSubTab === 'events' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filtrer par catégorie :</span>
              <select
                value={eventCategoryFilter}
                onChange={(e) => setEventCategoryFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-hidden"
              >
                <option value="all">Toutes les catégories</option>
                <option value="ecommerce">E-commerce (Commandes, Paniers)</option>
                <option value="search">Recherche</option>
                <option value="auth">Authentification & Accès</option>
                <option value="interaction">Interactions & PDF</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter CSV</span>
              </button>
              <button
                type="button"
                onClick={handleClearData}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Effacer l'historique</span>
              </button>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <Activity className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-300">Aucun événement enregistré pour le moment</p>
              <p className="text-xs text-slate-500 mt-1">
                Les actions des clients (ajouts au panier, validations de précommandes, clics WhatsApp, etc.) s'afficheront ici en temps réel.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Date & Heure</th>
                      <th className="px-4 py-3">Nom de l'Événement</th>
                      <th className="px-4 py-3">Catégorie</th>
                      <th className="px-4 py-3">Libellé / Contexte</th>
                      <th className="px-4 py-3">Détails Données</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredEvents.slice(0, 50).map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                          {new Date(ev.timestamp).toLocaleString('fr-DZ', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-white">
                          <span className="font-mono text-amber-300">{ev.eventName}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ev.category === 'ecommerce'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : ev.category === 'search'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : ev.category === 'auth'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {ev.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-200">
                          {ev.label || '—'}
                          {ev.value ? (
                            <span className="ml-2 font-mono font-bold text-emerald-400">
                              ({formatDZD(ev.value)})
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-[10px] max-w-xs truncate">
                          {ev.metadata ? JSON.stringify(ev.metadata) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: GOOGLE ANALYTICS 4 */}
      {activeSubTab === 'ga4' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  Intégration Google Analytics 4 (GA4)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Connectez votre propriété Google Analytics pour mesurer le trafic, les conversions et les utilisateurs en temps réel.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  settings.ga4Enabled && settings.ga4MeasurementId
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    settings.ga4Enabled && settings.ga4MeasurementId
                      ? 'bg-emerald-400'
                      : 'bg-slate-500'
                  }`}
                ></span>
                <span>
                  {settings.ga4Enabled && settings.ga4MeasurementId
                    ? 'Actif & Connecté'
                    : 'Non configuré'}
                </span>
              </span>
            </div>

            <form onSubmit={handleSaveGA4} className="space-y-4 pt-1">
              {envConfig.gaMeasurementId ? (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Variable d'environnement <strong>VITE_GA_MEASUREMENT_ID</strong> détectée :{' '}
                      <code className="font-mono bg-emerald-900/60 px-1.5 py-0.5 rounded text-white font-bold">
                        {envConfig.gaMeasurementId}
                      </code>
                    </span>
                  </div>
                  {ga4IdInput !== envConfig.gaMeasurementId && (
                    <button
                      type="button"
                      onClick={() => {
                        setGa4IdInput(envConfig.gaMeasurementId);
                        setGa4EnabledInput(true);
                      }}
                      className="text-[11px] font-bold text-amber-300 hover:text-white underline cursor-pointer"
                    >
                      Appliquer la valeur .env
                    </button>
                  )}
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ID de mesure Google Analytics 4 (Measurement ID)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={ga4IdInput}
                    onChange={(e) => setGa4IdInput(e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Format : <code className="text-amber-400 font-mono">G-XXXXXXXXXX</code> (Trouvez cet ID dans Google Analytics : <em>Administration &gt; Flux de données &gt; ID de mesure</em>). Vous pouvez également le spécifier comme variable d'environnement <code className="text-amber-300 font-mono">VITE_GA_MEASUREMENT_ID</code> (ou <code className="text-slate-300 font-mono">GA_MEASUREMENT_ID</code>) dans votre fichier <code className="text-slate-300 font-mono">.env</code>.
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="toggle-ga4"
                  checked={ga4EnabledInput}
                  onChange={(e) => setGa4EnabledInput(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-900 focus:ring-amber-500"
                />
                <label htmlFor="toggle-ga4" className="text-xs font-semibold text-slate-200 cursor-pointer">
                  Activer la collecte automatique des données via le tag gtag.js
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition shadow-sm cursor-pointer"
                >
                  Enregistrer les paramètres GA4
                </button>
              </div>
            </form>
          </div>

          {/* Guide & Instructions */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Événements GA4 Pré-intégrés
            </h4>
            <ul className="text-xs text-slate-300 space-y-2.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>view_item_list :</strong> Consultation du catalogue de matières premières.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>add_to_cart :</strong> Ajout d'un extrait ou flacon au bon de commande.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>purchase / preorder_submit :</strong> Enregistrement officiel de la commande avec le montant en DA.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>search :</strong> Requêtes de recherche exécutées par les acheteurs.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>proforma_request :</strong> Demandes de devis estimatifs et factures proforma.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* SUBTAB 3: HEATMAPS & SESSION REPLAYS */}
      {activeSubTab === 'heatmaps' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Configuration Heatmaps & Replays de Sessions
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Visualisez les clics, zones de défilement et enregistrements vidéos anonymisés des parcours clients.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                    settings.heatmapsEnabled && settings.heatmapProjectId
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      settings.heatmapsEnabled && settings.heatmapProjectId
                        ? 'bg-rose-400'
                        : 'bg-slate-500'
                    }`}
                  ></span>
                  <span>
                    {settings.heatmapsEnabled && settings.heatmapProjectId
                      ? 'Enregistrement Actif'
                      : 'Inactif'}
                  </span>
                </span>
              </div>

              <form onSubmit={handleSaveHeatmaps} className="space-y-4">
                {envConfig.clarityProjectId ? (
                  <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        Variable d'environnement <strong>VITE_CLARITY_PROJECT_ID</strong> détectée :{' '}
                        <code className="font-mono bg-rose-900/60 px-1.5 py-0.5 rounded text-white font-bold">
                          {envConfig.clarityProjectId}
                        </code>
                      </span>
                    </div>
                    {heatmapIdInput !== envConfig.clarityProjectId && (
                      <button
                        type="button"
                        onClick={() => {
                          setHeatmapProviderInput('clarity');
                          setHeatmapIdInput(envConfig.clarityProjectId);
                          setHeatmapEnabledInput(true);
                        }}
                        className="text-[11px] font-bold text-rose-300 hover:text-white underline cursor-pointer"
                      >
                        Appliquer la valeur .env
                      </button>
                    )}
                  </div>
                ) : null}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Fournisseur d'outil d'enregistrement
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setHeatmapProviderInput('clarity')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                        heatmapProviderInput === 'clarity'
                          ? 'bg-rose-950/60 border-rose-600 text-white shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Flame className="w-4 h-4 text-rose-400" />
                      <span>Microsoft Clarity (Gratuit / Recommandé)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setHeatmapProviderInput('hotjar')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                        heatmapProviderInput === 'hotjar'
                          ? 'bg-rose-950/60 border-rose-600 text-white shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span>Hotjar</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {heatmapProviderInput === 'clarity'
                      ? 'Project ID Microsoft Clarity'
                      : 'Site ID Hotjar'}
                  </label>
                  <input
                    type="text"
                    value={heatmapIdInput}
                    onChange={(e) => setHeatmapIdInput(e.target.value)}
                    placeholder={
                      heatmapProviderInput === 'clarity'
                        ? 'ex: k9x8w7v6u5'
                        : 'ex: 3456789'
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {heatmapProviderInput === 'clarity' ? (
                      <>
                        Trouvez votre Project ID sur <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-rose-400 underline hover:text-rose-300">clarity.microsoft.com</a>. Vous pouvez également le spécifier comme variable d'environnement <code className="text-rose-300 font-mono">VITE_CLARITY_PROJECT_ID</code> (ou <code className="text-slate-300 font-mono">CLARITY_PROJECT_ID</code>) dans votre fichier <code className="text-slate-300 font-mono">.env</code>.
                      </>
                    ) : (
                      'Le script sera injecté pour capter les sessions d\'utilisateurs sur mobile et desktop.'
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="toggle-heatmaps"
                    checked={heatmapEnabledInput}
                    onChange={(e) => setHeatmapEnabledInput(e.target.checked)}
                    className="w-4 h-4 text-rose-500 rounded border-slate-700 bg-slate-900 focus:ring-rose-500"
                  />
                  <label htmlFor="toggle-heatmaps" className="text-xs font-semibold text-slate-200 cursor-pointer">
                    Activer la capture vidéo des sessions et les cartes thermiques de clics
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition shadow-sm cursor-pointer"
                  >
                    Enregistrer la Configuration Heatmaps
                  </button>
                </div>
              </form>
            </div>

            {/* Quick Links */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Accès aux Replays
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Les enregistrements vidéo et cartes de clics sont hébergés en toute sécurité par Microsoft Clarity ou Hotjar conformément aux normes RGPD.
              </p>
              <div className="space-y-2 pt-1">
                <a
                  href="https://clarity.microsoft.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold flex items-center justify-between border border-slate-700 transition"
                >
                  <span>Console Microsoft Clarity</span>
                  <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
                </a>
                <a
                  href="https://insights.hotjar.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold flex items-center justify-between border border-slate-700 transition"
                >
                  <span>Console Hotjar</span>
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                </a>
              </div>
            </div>
          </div>

          {/* Heatmap Visual Hotspot Simulator */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-500" />
                  <span>Aperçu Interactif des Zones de Clics & Défilement (Simulateur)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualisation thermique montrant les points de friction et les boutons les plus sollicités par les acheteurs.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedHeatmapPage('catalog')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    selectedHeatmapPage === 'catalog'
                      ? 'bg-rose-600 text-white font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Catalogue Showroom
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedHeatmapPage('quick_order')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    selectedHeatmapPage === 'quick_order'
                      ? 'bg-rose-600 text-white font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Commande Rapide
                </button>
              </div>
            </div>

            {/* Simulated Canvas with Hotspots */}
            <div className="relative w-full aspect-16/7 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col justify-between p-4">
              {/* Header mockup bar */}
              <div className="w-full flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-amber-500"></div>
                  <div className="h-3 w-28 bg-slate-800 rounded"></div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Hotspot: Cart Button */}
                  <div className="relative">
                    <div className="h-7 w-24 bg-amber-500/90 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-950">
                      Panier (8)
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rose-500/60 blur-xs animate-ping"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rose-500/80 flex items-center justify-center text-[9px] font-black text-white">
                      89%
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid mockup with Hotspots */}
              <div className="grid grid-cols-4 gap-3 py-3">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 relative flex flex-col justify-between h-28">
                  <div className="h-2 w-16 bg-slate-800 rounded"></div>
                  <div className="h-2 w-24 bg-slate-700 rounded"></div>
                  <div className="h-6 w-full bg-amber-500/40 rounded flex items-center justify-center text-[9px] text-amber-200 font-bold">
                    + Ajouter 100g
                  </div>
                  <div className="absolute inset-0 bg-radial from-rose-500/30 via-transparent to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold">
                    74% clics
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 relative flex flex-col justify-between h-28">
                  <div className="h-2 w-16 bg-slate-800 rounded"></div>
                  <div className="h-2 w-24 bg-slate-700 rounded"></div>
                  <div className="h-6 w-full bg-amber-500/40 rounded flex items-center justify-center text-[9px] text-amber-200 font-bold">
                    + Ajouter 100g
                  </div>
                  <div className="absolute inset-0 bg-radial from-amber-500/25 via-transparent to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-amber-600 text-white text-[9px] font-bold">
                    52% clics
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 relative flex flex-col justify-between h-28">
                  <div className="h-2 w-16 bg-slate-800 rounded"></div>
                  <div className="h-2 w-24 bg-slate-700 rounded"></div>
                  <div className="h-6 w-full bg-amber-500/40 rounded flex items-center justify-center text-[9px] text-amber-200 font-bold">
                    + Ajouter 100g
                  </div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold">
                    28% clics
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 relative flex flex-col justify-between h-28">
                  <div className="h-2 w-16 bg-slate-800 rounded"></div>
                  <div className="h-2 w-24 bg-slate-700 rounded"></div>
                  <div className="h-6 w-full bg-slate-800 rounded"></div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[9px] font-bold">
                    12% clics
                  </div>
                </div>
              </div>

              {/* Sticky bottom bar heatmap */}
              <div className="w-full bg-slate-900 border border-amber-500/40 rounded-xl p-2.5 flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-32 bg-amber-400/60 rounded"></div>
                </div>
                <div className="h-6 w-28 bg-amber-500 rounded text-slate-950 font-black text-[9px] flex items-center justify-center">
                  Valider Précommande
                </div>
                <div className="absolute -top-2 right-6 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black shadow-md animate-pulse">
                  Zone Chaude #1 (94%)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: SITE SEARCH ANALYTICS */}
      {activeSubTab === 'search' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Searched Queries */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-purple-400" />
                <span>Mots-clés les plus recherchés par les clients</span>
              </h3>
              {topQueries.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Aucune recherche enregistrée pour l'instant.
                </p>
              ) : (
                <div className="space-y-3">
                  {topQueries.map(([q, count], index) => {
                    const pct = Math.round((count / totalSearches) * 100);
                    return (
                      <div key={q} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white flex items-center gap-2">
                            <span className="text-slate-500 text-[11px] font-mono">#{index + 1}</span>
                            <span>« {q} »</span>
                          </span>
                          <span className="text-purple-300 font-mono font-bold">
                            {count} recherche{count > 1 ? 's' : ''} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-amber-500 rounded-full"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Zero-result queries (Crucial Business Insights) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Recherches sans aucun résultat (Demandes non comblées)</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-mono text-[11px] font-bold">
                  {zeroResultSearches.length}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ces termes ont été tapés par les acheteurs mais ne figuraient pas dans votre catalogue. Idéal pour orienter vos prochains réapprovisionnements !
              </p>

              {zeroResultSearches.length === 0 ? (
                <div className="p-6 text-center bg-slate-950 rounded-xl border border-slate-800/80">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-300">Toutes les recherches ont abouti à un produit !</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {zeroResultSearches.slice(0, 15).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs"
                    >
                      <span className="font-bold text-rose-300 font-mono">
                        « {log.query} »
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(log.timestamp).toLocaleDateString('fr-DZ', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Timeline Table of Recent Search Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Historique des 30 dernières recherches
              </h4>
              <span className="text-[11px] text-slate-400">
                {searchLogs.length} requêtes au total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Date & Heure</th>
                    <th className="px-4 py-2.5">Terme recherché</th>
                    <th className="px-4 py-2.5">Filtre appliqué</th>
                    <th className="px-4 py-2.5">Résultats trouvés</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {searchLogs.slice(0, 30).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString('fr-DZ', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-white font-mono">
                        {log.query}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">
                        {log.filterFamily || 'Tous'}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold">
                        <span
                          className={
                            log.resultsCount === 0
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }
                        >
                          {log.resultsCount} produit{log.resultsCount > 1 ? 's' : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
