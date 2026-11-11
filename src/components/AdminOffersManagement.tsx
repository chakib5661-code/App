import React, { useEffect, useMemo, useState } from 'react';
import { BadgePercent, Bell, BarChart3, Gift, Layers, Link2, Package, Save, Settings2, Trash2, Plus, RefreshCw, ImagePlus, Loader2 } from 'lucide-react';
import { Bundle, LoyaltyTier, OffersConfig, PreOrder, Product, ProductFamily, RewardTier, VolumeDefaultRule, VolumeTier } from '../types';
import { effectiveTiers, normalizeOffers } from '../utils/offers';
import {
  DueRemindersResponse,
  fetchDueReminders,
  fetchOffers,
  saveOffersOnServer,
} from '../utils/api';
import { formatDZD } from '../utils/formatDZD';
import { compressImage } from '../utils/imageCompressor';
import { uploadMediaToServer } from '../utils/api';

interface AdminOffersManagementProps {
  products: Product[];
  orders: PreOrder[];
  onUpdateProduct?: (product: Product) => void;
}

type SubTab = 'rules' | 'volume' | 'bundles' | 'crosssell' | 'reminders' | 'kpi';

const SUBTABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'rules', label: 'Règles & paliers', icon: <Settings2 className="w-3.5 h-3.5" /> },
  { id: 'volume', label: 'Prix par volume', icon: <BadgePercent className="w-3.5 h-3.5" /> },
  { id: 'bundles', label: 'Packs', icon: <Package className="w-3.5 h-3.5" /> },
  { id: 'crosssell', label: 'Produits associés', icon: <Link2 className="w-3.5 h-3.5" /> },
  { id: 'reminders', label: 'Relances', icon: <Bell className="w-3.5 h-3.5" /> },
  { id: 'kpi', label: 'Indicateurs', icon: <BarChart3 className="w-3.5 h-3.5" /> },
];

const input =
  'bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-rose-500 w-full';
const card = 'bg-slate-900 border border-slate-700/80 rounded-2xl p-4 space-y-3';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer';

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({
  checked,
  onChange,
  label,
  hint,
}) => (
  <label className="flex items-start gap-2.5 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-rose-600" />
    <span>
      <span className="text-xs font-bold text-white block">{label}</span>
      {hint && <span className="text-[11px] text-slate-400 block">{hint}</span>}
    </span>
  </label>
);

const ProductPicker: React.FC<{ products: Product[]; value: string; onChange: (id: string) => void }> = ({ products, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = products.find((p) => p.id === value);
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = words.length
      ? products.filter((p) => {
          const hay = `${p.code} ${p.name} ${p.brand || ''}`.toLowerCase();
          return words.every((w) => hay.includes(w));
        })
      : products;
    return list.slice(0, 50);
  }, [products, q]);
  return (
    <div className="relative flex-1 min-w-0">
      <input
        value={open ? q : current ? `${current.code} · ${current.name}` : ''}
        onFocus={() => {
          setQ('');
          setOpen(true);
        }}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Rechercher un produit (code, nom, marque)…"
        className={input}
      />
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {results.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Aucun résultat</div>}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(p.id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 cursor-pointer ${p.id === value ? 'text-amber-300' : 'text-slate-200'}`}
            >
              {p.code} · {p.name}
              {p.brand ? <span className="text-slate-500"> — {p.brand}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Num: React.FC<{ value: number; onChange: (v: number) => void; min?: number; step?: number; className?: string }> = ({
  value,
  onChange,
  min = 0,
  step = 1,
  className = '',
}) => (
  <input
    type="number"
    min={min}
    step={step}
    value={Number.isFinite(value) ? value : 0}
    onChange={(e) => onChange(Number(e.target.value))}
    className={`${className.includes('w-') ? input.replace(' w-full', '') : input} ${className}`}
  />
);

export const AdminOffersManagement: React.FC<AdminOffersManagementProps> = ({ products, orders, onUpdateProduct }) => {
  const [tab, setTab] = useState<SubTab>('rules');
  const [draft, setDraft] = useState<OffersConfig>(() => normalizeOffers(null));
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOffers().then((r) => {
      if (r) setDraft(normalizeOffers(r.offers));
      setLoaded(true);
    });
  }, []);

  const update = (fn: (d: OffersConfig) => OffersConfig) => {
    setDraft((d) => fn(d));
    setDirty(true);
    setStatus(null);
  };

  const save = async () => {
    setSaving(true);
    const saved = await saveOffersOnServer(draft);
    setSaving(false);
    if (saved) {
      setDraft(normalizeOffers(saved));
      setDirty(false);
      setStatus({ ok: true, text: 'Enregistré. Les clients voient les nouvelles règles à leur prochain chargement.' });
    } else {
      setStatus({ ok: false, text: "Échec de l'enregistrement. Vérifiez la connexion au serveur." });
    }
  };

  const productName = (id: string) => products.find((p) => p.id === id)?.name || id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Gift className="w-5 h-5 text-rose-400" /> Offres & règles de commande
          </h2>
          <p className="text-xs text-slate-400">
            Minimum de commande, paliers de récompense, prix par volume, packs, fidélité et relances.
          </p>
        </div>
        {(tab === 'rules' || tab === 'bundles' || tab === 'volume') && (
          <div className="flex items-center gap-2">
            {dirty && <span className="text-[11px] text-amber-300 font-bold">Modifications non enregistrées</span>}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className={`${btn} bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40 flex items-center gap-1.5`}
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>

      {status && (
        <div
          className={`text-xs font-bold px-3 py-2 rounded-lg border ${
            status.ok ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300' : 'bg-rose-950/60 border-rose-700 text-rose-300'
          }`}
        >
          {status.text}
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {SUBTABS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setTab(s.id)}
            className={`${btn} flex items-center gap-1.5 shrink-0 ${
              tab === s.id ? 'bg-slate-100 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {!loaded && <div className="text-xs text-slate-400">Chargement…</div>}

      {loaded && tab === 'rules' && <RulesTab draft={draft} update={update} />}
      {loaded && tab === 'volume' && <VolumeTab products={products} onUpdateProduct={onUpdateProduct} draft={draft} update={update} />}
      {loaded && tab === 'bundles' && <BundlesTab draft={draft} update={update} products={products} />}
      {loaded && tab === 'crosssell' && <CrossSellTab products={products} onUpdateProduct={onUpdateProduct} draft={draft} update={update} />}
      {loaded && tab === 'reminders' && <RemindersTab draft={draft} update={update} onSave={save} dirty={dirty} saving={saving} />}
      {loaded && tab === 'kpi' && <KpiTab orders={orders} productName={productName} />}
    </div>
  );
};

type UpdateFn = (fn: (d: OffersConfig) => OffersConfig) => void;

// ---------------------------------------------------------------- rules

const RulesTab: React.FC<{ draft: OffersConfig; update: UpdateFn }> = ({ draft, update }) => {
  const setTier = (id: string, patch: Partial<RewardTier>) =>
    update((d) => ({ ...d, rewardLadder: { ...d.rewardLadder, tiers: d.rewardLadder.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) } }));
  const setLoyal = (id: string, patch: Partial<LoyaltyTier>) =>
    update((d) => ({ ...d, loyalty: { ...d.loyalty, tiers: d.loyalty.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) } }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={card}>
        <h3 className="text-sm font-black text-white">Minimum de commande</h3>
        <p className="text-[11px] text-slate-400">
          Appliqué aux précommandes (pas aux demandes de proforma). Le panier est bloqué en dessous de ce montant, et le serveur le vérifie aussi.
        </p>
        <label className="text-[11px] text-slate-300 font-bold block">Montant minimum (DA)</label>
        <Num value={draft.minOrderAmountDA} onChange={(v) => update((d) => ({ ...d, minOrderAmountDA: Math.max(0, v) }))} step={500} />
      </div>

      <div className={card}>
        <h3 className="text-sm font-black text-white">Fonctions pour les clients</h3>
        <Toggle
          checked={draft.volumePricing.enabled}
          onChange={(v) => update((d) => ({ ...d, volumePricing: { ...d.volumePricing, enabled: v } }))}
          label="Prix par volume"
          hint="Utilise les paliers définis par produit dans l'onglet Prix par volume."
        />
        <Toggle
          checked={draft.crossSell.enabled}
          onChange={(v) => update((d) => ({ ...d, crossSell: { ...d.crossSell, enabled: v } }))}
          label="Suggestions « Complétez votre commande »"
        />
        {draft.crossSell.enabled && (
          <div className="pl-6 flex items-center gap-2 text-[11px] text-slate-300">
            Nombre de suggestions
            <Num value={draft.crossSell.maxSuggestions} min={1} onChange={(v) => update((d) => ({ ...d, crossSell: { ...d.crossSell, maxSuggestions: Math.min(6, Math.max(1, v)) } }))} className="w-20" />
          </div>
        )}
        <Toggle
          checked={draft.bundles.enabled}
          onChange={(v) => update((d) => ({ ...d, bundles: { ...d.bundles, enabled: v } }))}
          label="Packs"
          hint="Gérés dans l'onglet Packs."
        />
        <Toggle
          checked={draft.reorder.enabled}
          onChange={(v) => update((d) => ({ ...d, reorder: { enabled: v } }))}
          label="Recommander en un clic et produits habituels"
        />
        <Toggle
          checked={draft.socialProof.enabled}
          onChange={(v) => update((d) => ({ ...d, socialProof: { ...d.socialProof, enabled: v } }))}
          label="Preuve sociale « commandé par N clients »"
          hint="Affiche uniquement un nombre, jamais de noms."
        />
        {draft.socialProof.enabled && (
          <div className="pl-6 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
            Sur
            <Num value={draft.socialProof.windowDays} min={1} onChange={(v) => update((d) => ({ ...d, socialProof: { ...d.socialProof, windowDays: Math.max(1, v) } }))} className="w-20" />
            jours, à partir de
            <Num value={draft.socialProof.minCustomers} min={1} onChange={(v) => update((d) => ({ ...d, socialProof: { ...d.socialProof, minCustomers: Math.max(1, v) } }))} className="w-20" />
            clients
          </div>
        )}
        <Toggle
          checked={draft.addToOrder.enabled}
          onChange={(v) => update((d) => ({ ...d, addToOrder: { ...d.addToOrder, enabled: v } }))}
          label="Ajouter des articles après la commande"
        />
        {draft.addToOrder.enabled && (
          <div className="pl-6 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-300">
              Délai (heures)
              <Num value={draft.addToOrder.windowHours} min={0} onChange={(v) => update((d) => ({ ...d, addToOrder: { ...d.addToOrder, windowHours: Math.max(0, v) } }))} className="w-20" />
            </div>
            <Toggle
              checked={draft.addToOrder.pushEnabled}
              onChange={(v) => update((d) => ({ ...d, addToOrder: { ...d.addToOrder, pushEnabled: v } }))}
              label="Notification push après la commande"
              hint="Prévient le client que la commande peut encore recevoir des articles. Nécessite les clés VAPID sur le serveur (voir OFFERS.md)."
            />
          </div>
        )}
      </div>

      <div className={`${card} lg:col-span-2`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-black text-white">Paliers de récompense (barre de progression du panier)</h3>
          <Toggle
            checked={draft.rewardLadder.enabled}
            onChange={(v) => update((d) => ({ ...d, rewardLadder: { ...d.rewardLadder, enabled: v } }))}
            label="Activer"
          />
        </div>
        <p className="text-[11px] text-slate-400">
          Mesurés sur le montant après prix par volume et packs. Une remise en pourcentage ne se cumule pas avec la remise fidélité : la plus élevée s'applique.
        </p>
        <div className="space-y-2">
          <div className="hidden sm:grid gap-2 sm:grid-cols-[120px_150px_90px_1fr_auto] text-[10px] uppercase tracking-wider text-slate-500 font-bold">
            <span>Seuil (DA)</span><span>Type</span><span>Valeur</span><span>Texte affiché</span><span className="w-8" />
          </div>
          {draft.rewardLadder.tiers.map((t) => (
            <div key={t.id} className="grid gap-2 sm:grid-cols-[120px_150px_90px_1fr_auto] items-center">
              <Num value={t.thresholdDA} step={1000} onChange={(v) => setTier(t.id, { thresholdDA: Math.max(0, v) })} />
              <select
                value={t.type}
                onChange={(e) => setTier(t.id, { type: e.target.value as RewardTier['type'] })}
                className={input}
              >
                <option value="percent">Remise %</option>
                <option value="free_delivery">Livraison offerte</option>
                <option value="gift">Cadeau</option>
              </select>
              {t.type === 'percent' ? (
                <Num value={t.value || 0} step={0.5} onChange={(v) => setTier(t.id, { value: v })} />
              ) : (
                <span className="text-[11px] text-slate-500">—</span>
              )}
              <input value={t.label} onChange={(e) => setTier(t.id, { label: e.target.value })} className={input} placeholder="Texte affiché au client" />
              <button
                type="button"
                onClick={() => update((d) => ({ ...d, rewardLadder: { ...d.rewardLadder, tiers: d.rewardLadder.tiers.filter((x) => x.id !== t.id) } }))}
                className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                aria-label="Supprimer le palier"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            update((d) => ({
              ...d,
              rewardLadder: {
                ...d.rewardLadder,
                tiers: [...d.rewardLadder.tiers, { id: uid('tier'), thresholdDA: 50000, type: 'percent', value: 5, label: '5% de remise sur la commande' }],
              },
            }))
          }
          className={`${btn} bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5`}
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter un palier
        </button>
      </div>

      <div className={`${card} lg:col-span-2`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-black text-white">Niveaux de fidélité</h3>
          <Toggle
            checked={draft.loyalty.enabled}
            onChange={(v) => update((d) => ({ ...d, loyalty: { ...d.loyalty, enabled: v } }))}
            label="Activer"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
          Dépenses cumulées sur
          <Num value={draft.loyalty.windowDays} min={1} onChange={(v) => update((d) => ({ ...d, loyalty: { ...d.loyalty, windowDays: Math.max(1, v) } }))} className="w-20" />
          jours (commandes non annulées, hors proforma)
        </div>
        <div className="space-y-2">
          <div className="hidden sm:grid gap-2 sm:grid-cols-[130px_130px_90px_1fr_auto] text-[10px] uppercase tracking-wider text-slate-500 font-bold">
            <span>Nom</span><span>Dépenses min. (DA)</span><span>Remise %</span><span>Avantage affiché</span><span className="w-8" />
          </div>
          {draft.loyalty.tiers.map((t) => (
            <div key={t.id} className="grid gap-2 sm:grid-cols-[130px_130px_90px_1fr_auto] items-center">
              <input value={t.name} onChange={(e) => setLoyal(t.id, { name: e.target.value })} className={input} placeholder="Nom (ex : Or)" />
              <Num value={t.minSpendDA} step={10000} onChange={(v) => setLoyal(t.id, { minSpendDA: Math.max(0, v) })} />
              <Num value={t.discountPercent} step={0.5} onChange={(v) => setLoyal(t.id, { discountPercent: Math.max(0, v) })} />
              <input value={t.perk || ''} onChange={(e) => setLoyal(t.id, { perk: e.target.value })} className={input} placeholder="Avantage affiché" />
              <button
                type="button"
                onClick={() => update((d) => ({ ...d, loyalty: { ...d.loyalty, tiers: d.loyalty.tiers.filter((x) => x.id !== t.id) } }))}
                className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                aria-label="Supprimer le niveau"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            update((d) => ({
              ...d,
              loyalty: { ...d.loyalty, tiers: [...d.loyalty.tiers, { id: uid('loyal'), name: 'Nouveau', minSpendDA: 500000, discountPercent: 5, perk: '' }] },
            }))
          }
          className={`${btn} bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5`}
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter un niveau
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- volume prices

const VolumeTab: React.FC<{ products: Product[]; onUpdateProduct?: (p: Product) => void; draft: OffersConfig; update: UpdateFn }> = ({
  products,
  onUpdateProduct,
  draft,
  update,
}) => {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [rows, setRows] = useState<VolumeTier[]>([]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.code.toLowerCase().includes(needle))
      .sort((a, b) => Number(Boolean(b.tierPrices?.length)) - Number(Boolean(a.tierPrices?.length)))
      .slice(0, 40);
  }, [products, q]);

  const open = (p: Product) => {
    setOpenId(p.id);
    setRows((p.tierPrices || []).map((t) => ({ ...t })));
  };

  const saveRows = (p: Product) => {
    const clean = rows.filter((r) => r.minQty > 0 && r.priceDA > 0).sort((a, b) => a.minQty - b.minQty);
    onUpdateProduct?.({ ...p, tierPrices: clean.length ? clean : undefined });
    setOpenId(null);
  };

  const setRule = (i: number, patch: Partial<VolumeDefaultRule>) =>
    update((d) => ({ ...d, volumePricing: { ...d.volumePricing, defaults: d.volumePricing.defaults.map((r, j) => (j === i ? { ...r, ...patch } : r)) } }));

  const defaultsCard = (
    <div className={card}>
      <h3 className="text-sm font-black text-white">Réductions par défaut par famille</h3>
      <p className="text-[11px] text-slate-400">
        À partir de la quantité indiquée, le prix unitaire baisse du montant indiqué, pour toute la quantité. Exemple : extraits, 500 g et plus, -0,5 DA par gramme. Un produit qui a ses propres paliers (ci-dessous) ignore ces valeurs. Cliquez sur Enregistrer en haut pour publier.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
        Conseil « ajoutez X pour économiser » dès que le client atteint
        <Num value={draft.volumePricing.adviceFromPercent} min={1} onChange={(v) => update((d) => ({ ...d, volumePricing: { ...d.volumePricing, adviceFromPercent: Math.min(100, Math.max(1, v)) } }))} className="w-16" />
        % du palier suivant (par défaut 60 % : 300 g avant 500 g, 72 pièces avant 120)
      </div>
      <div className="hidden sm:grid gap-2 sm:grid-cols-[150px_120px_120px_auto] text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        <span>Famille</span><span>À partir de</span><span>Baisse par unité (DA)</span><span className="w-8" />
      </div>
      {draft.volumePricing.defaults.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[150px_120px_120px_auto] items-center">
          <select value={r.family} onChange={(e) => setRule(i, { family: e.target.value as ProductFamily })} className={input}>
            <option value="Extrait">Extraits (g)</option>
            <option value="Flacon">Flacons (pièces)</option>
            <option value="Accessoire">Accessoires (pièces)</option>
          </select>
          <Num value={r.minQty} min={1} onChange={(v) => setRule(i, { minQty: Math.max(1, v) })} />
          <Num value={r.offDA} min={0} step={0.5} onChange={(v) => setRule(i, { offDA: Math.max(0, v) })} />
          <button
            type="button"
            onClick={() => update((d) => ({ ...d, volumePricing: { ...d.volumePricing, defaults: d.volumePricing.defaults.filter((_, j) => j !== i) } }))}
            className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
            aria-label="Supprimer la règle"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => update((d) => ({ ...d, volumePricing: { ...d.volumePricing, defaults: [...d.volumePricing.defaults, { family: 'Extrait', minQty: 2000, offDA: 1.5 }] } }))}
        className={`${btn} bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5`}
      >
        <Plus className="w-3.5 h-3.5" /> Ajouter une règle
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
    {defaultsCard}
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-black text-white">Paliers propres à un produit</h3>
        <span className="text-[11px] text-slate-400">
          Extraits : seuil en grammes, prix par gramme. Flacons et accessoires : seuil en unités, prix à l'unité.
        </span>
      </div>
      {!draft.volumePricing.enabled && (
        <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <span>La fonction est désactivée : les paliers ne s'appliquent pas aux clients.</span>
          <button
            type="button"
            className={`${btn} bg-amber-500 text-slate-950`}
            onClick={() => update((d) => ({ ...d, volumePricing: { ...d.volumePricing, enabled: true } }))}
          >
            Activer (puis enregistrer dans Règles)
          </button>
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit (nom ou code)…" className={input} />
      <div className="divide-y divide-slate-800">
        {list.map((p) => (
          <div key={p.id} className="py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">
                  {p.code} · {p.name}
                </span>
                <span className="text-[11px] text-slate-400">
                  Prix de base {formatDZD(p.priceDA)} / {p.family === 'Extrait' ? 'g' : 'u'}
                  {effectiveTiers(p, draft).length > 0 && (
                    <span className="text-emerald-400 font-bold">
                      {' '}
                      · {p.tierPrices && p.tierPrices.length > 0 ? '' : 'par défaut '}
                      {effectiveTiers(p, draft).map((t) => `≥${t.minQty}: ${t.priceDA}`).join('  ')}
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => (openId === p.id ? setOpenId(null) : open(p))}
                className={`${btn} bg-slate-800 hover:bg-slate-700 text-white shrink-0`}
              >
                {openId === p.id ? 'Fermer' : 'Modifier'}
              </button>
            </div>
            {openId === p.id && (
              <div className="mt-2 space-y-2 bg-slate-950/60 rounded-xl p-3">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-slate-300">
                    À partir de
                    <Num value={r.minQty} min={1} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, minQty: v } : x)))} className="w-24" />
                    {p.family === 'Extrait' ? 'g' : 'u'} : prix
                    <Num value={r.priceDA} min={0} step={0.5} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, priceDA: v } : x)))} className="w-24" />
                    DA
                    {r.priceDA >= p.priceDA && r.priceDA > 0 && <span className="text-amber-300">≥ prix de base</span>}
                    <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer" aria-label="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRows((rs) => [...rs, { minQty: p.family === 'Extrait' ? 300 : 10, priceDA: Math.round(p.priceDA * 0.95 * 100) / 100 }])}
                    className={`${btn} bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Palier
                  </button>
                  <button type="button" onClick={() => saveRows(p)} className={`${btn} bg-rose-600 hover:bg-rose-500 text-white`}>
                    Enregistrer ce produit
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="text-xs text-slate-500 py-3">Aucun produit.</div>}
      </div>
    </div>
    </div>
  );
};

// ---------------------------------------------------------------- bundles

const BundlesTab: React.FC<{ draft: OffersConfig; update: UpdateFn; products: Product[] }> = ({ draft, update, products }) => {
  const [bannerBusy, setBannerBusy] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const uploadBanner = async (id: string, file?: File) => {
    if (!file) return;
    setBannerError(null);
    if (!file.type.startsWith('image/')) {
      setBannerError('Veuillez sélectionner une image (JPG, PNG, WebP).');
      return;
    }
    try {
      setBannerBusy(id);
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 600, quality: 0.8, mimeType: 'image/webp' });
      const res = await uploadMediaToServer(compressed, file.name);
      if (res.success && res.url) setBundle(id, { imageUrl: res.url });
      else setBannerError(res.error || res.message || "Échec de l'envoi de l'image.");
    } catch {
      setBannerError("Erreur lors de l'optimisation de l'image.");
    } finally {
      setBannerBusy(null);
    }
  };
  const setBundle = (id: string, patch: Partial<Bundle>) =>
    update((d) => ({ ...d, bundles: { ...d.bundles, items: d.bundles.items.map((b) => (b.id === id ? { ...b, ...patch } : b)) } }));

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-white">Packs</h3>
        <button
          type="button"
          onClick={() =>
            update((d) => ({
              ...d,
              bundles: { ...d.bundles, items: [...d.bundles.items, { id: uid('pack'), name: 'Nouveau pack', items: [], discountPercent: 5, isActive: false }] },
            }))
          }
          className={`${btn} bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5`}
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau pack
        </button>
      </div>
      <p className="text-[11px] text-slate-400">
        Dès qu'un panier contient toutes les quantités d'un pack, la remise s'applique aux produits du pack (par pack complet). Un bouton « Ajouter le pack » apparaît dans le panier.
        Cliquez sur Enregistrer en haut pour publier.
      </p>
      {draft.bundles.items.length === 0 && <div className="text-xs text-slate-500">Aucun pack pour le moment.</div>}
      {draft.bundles.items.map((b) => (
        <div key={b.id} className="bg-slate-950/60 rounded-xl p-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_100px_auto_auto] items-center">
            <input value={b.name} onChange={(e) => setBundle(b.id, { name: e.target.value })} className={input} placeholder="Nom du pack" />
            <div className="flex items-center gap-1 text-[11px] text-slate-300">
              <Num value={b.discountPercent} step={0.5} onChange={(v) => setBundle(b.id, { discountPercent: Math.max(0, v) })} />%
            </div>
            <Toggle checked={b.isActive} onChange={(v) => setBundle(b.id, { isActive: v })} label="Actif" />
            <button
              type="button"
              onClick={() => update((d) => ({ ...d, bundles: { ...d.bundles, items: d.bundles.items.filter((x) => x.id !== b.id) } }))}
              className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
              aria-label="Supprimer le pack"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
            <input value={b.description || ''} onChange={(e) => setBundle(b.id, { description: e.target.value })} className={input} placeholder="Description courte affichée dans l'en-tête des packs" />
            <input value={b.badgeText || ''} onChange={(e) => setBundle(b.id, { badgeText: e.target.value })} className={input} placeholder="Étiquette (ex : Meilleur choix)" />
          </div>
          <div className="flex items-center gap-3">
            {b.imageUrl ? (
              <img src={b.imageUrl} alt="" className="h-16 w-32 rounded-lg object-cover border border-slate-700" />
            ) : (
              <div className="h-16 w-32 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-500">Pas de bannière</div>
            )}
            <div className="flex flex-wrap gap-2">
              <label className={`${btn} bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1 cursor-pointer`}>
                {bannerBusy === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                {b.imageUrl ? "Remplacer l'image" : 'Ajouter une bannière'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={bannerBusy === b.id}
                  onChange={(e) => {
                    uploadBanner(b.id, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {b.imageUrl && (
                <button type="button" onClick={() => setBundle(b.id, { imageUrl: undefined })} className={`${btn} bg-slate-800 hover:bg-rose-900 text-rose-300 flex items-center gap-1`}>
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer l'image
                </button>
              )}
            </div>
          </div>
          {bannerError && bannerBusy === null && <div className="text-[11px] text-rose-400">{bannerError}</div>}
          {b.items.map((bi, i) => (
            <div key={i} className="flex items-center gap-2">
              <ProductPicker
                products={products}
                value={bi.productId}
                onChange={(id) => setBundle(b.id, { items: b.items.map((x, j) => (j === i ? { ...x, productId: id } : x)) })}
              />
              <Num
                value={bi.quantity}
                min={1}
                onChange={(v) => setBundle(b.id, { items: b.items.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, v) } : x)) })}
                className="w-24"
              />
              <span className="text-[11px] text-slate-400 w-4">{products.find((p) => p.id === bi.productId)?.family === 'Extrait' ? 'g' : 'u'}</span>
              <button
                type="button"
                onClick={() => setBundle(b.id, { items: b.items.filter((_, j) => j !== i) })}
                className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                aria-label="Retirer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={products.length === 0}
            onClick={() => setBundle(b.id, { items: [...b.items, { productId: products[0]?.id || '', quantity: 1 }] })}
            className={`${btn} bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1`}
          >
            <Plus className="w-3.5 h-3.5" /> Produit du pack
          </button>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- cross-sell

const CrossSellTab: React.FC<{ products: Product[]; onUpdateProduct?: (p: Product) => void; draft: OffersConfig; update: UpdateFn }> = ({
  products,
  onUpdateProduct,
}) => {
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Record<string, string>>({});
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.code.toLowerCase().includes(needle))
      .sort((a, b) => Number(Boolean(b.relatedProductIds?.length)) - Number(Boolean(a.relatedProductIds?.length)))
      .slice(0, 30);
  }, [products, q]);

  return (
    <div className={card}>
      <h3 className="text-sm font-black text-white">Produits associés</h3>
      <p className="text-[11px] text-slate-400">
        Sans réglage, le panier propose automatiquement des flacons et accessoires pour un extrait (et des extraits pour un panier sans extrait), classés par popularité. Ici, vous imposez des produits précis pour un article. Les changements sont enregistrés tout de suite.
      </p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit…" className={input} />
      <div className="divide-y divide-slate-800">
        {list.map((p) => (
          <div key={p.id} className="py-2 space-y-1.5">
            <span className="text-xs font-bold text-white block">{p.code} · {p.name}</span>
            <div className="flex flex-wrap gap-1.5">
              {(p.relatedProductIds || []).map((rid) => (
                <span key={rid} className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-slate-200 flex items-center gap-1.5">
                  {products.find((x) => x.id === rid)?.name || rid}
                  <button
                    type="button"
                    className="text-slate-400 hover:text-rose-400 cursor-pointer"
                    onClick={() => onUpdateProduct?.({ ...p, relatedProductIds: (p.relatedProductIds || []).filter((x) => x !== rid) })}
                    aria-label="Retirer"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <select value={pick[p.id] || ''} onChange={(e) => setPick((s) => ({ ...s, [p.id]: e.target.value }))} className={input}>
                <option value="">Ajouter un produit associé…</option>
                {products
                  .filter((x) => x.id !== p.id && !(p.relatedProductIds || []).includes(x.id))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.code} · {x.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!pick[p.id]}
                onClick={() => {
                  onUpdateProduct?.({ ...p, relatedProductIds: [...(p.relatedProductIds || []), pick[p.id]] });
                  setPick((s) => ({ ...s, [p.id]: '' }));
                }}
                className={`${btn} bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40`}
              >
                Ajouter
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- reminders

const RemindersTab: React.FC<{ draft: OffersConfig; update: UpdateFn; onSave: () => void; dirty: boolean; saving: boolean }> = ({
  draft,
  update,
  onSave,
  dirty,
  saving,
}) => {
  const [due, setDue] = useState<DueRemindersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    fetchDueReminders().then((r) => {
      setDue(r);
      setLoading(false);
    });
  };
  useEffect(load, []);

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-white">Réglages des relances</h3>
          <Toggle
            checked={draft.reminders.enabled}
            onChange={(v) => update((d) => ({ ...d, reminders: { ...d.reminders, enabled: v } }))}
            label="Activer"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
          Panier non finalisé après
          <Num value={draft.reminders.abandonedCartAfterHours} min={1} onChange={(v) => update((d) => ({ ...d, reminders: { ...d.reminders, abandonedCartAfterHours: Math.max(1, v) } }))} className="w-20" />
          h · Réassort conseillé après
          <Num value={draft.reminders.reorderAfterDays} min={1} onChange={(v) => update((d) => ({ ...d, reminders: { ...d.reminders, reorderAfterDays: Math.max(1, v) } }))} className="w-20" />
          jours sans commande
          <button type="button" onClick={onSave} disabled={!dirty || saving} className={`${btn} bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40`}>
            Enregistrer
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Un résumé est envoyé chaque matin à 08:00 sur Telegram (équipe commerciale), avec un lien WhatsApp par client. Les clients reçoivent en plus un push si activé ci-dessous.
          Les paniers ne sont suivis que pour les clients connectés et approuvés.
        </p>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-white">Notifications push aux clients</h3>
          <Toggle
            checked={draft.notifications.enabled}
            onChange={(v) => update((d) => ({ ...d, notifications: { ...d.notifications, enabled: v } }))}
            label="Activer"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {([
            ['orderStatus', 'Statut de commande (confirmée, en préparation, livrée, annulée)'],
            ['abandonedCart', 'Panier non finalisé'],
            ['reorder', 'Rappel de réassort'],
            ['loyaltyLevelUp', 'Nouveau niveau de fidélité'],
          ] as const).map(([key, label]) => (
            <Toggle
              key={key}
              checked={draft.notifications[key]}
              onChange={(v) => update((d) => ({ ...d, notifications: { ...d.notifications, [key]: v } }))}
              label={label}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
          Maximum
          <Num value={draft.notifications.maxPerWeek} min={0} onChange={(v) => update((d) => ({ ...d, notifications: { ...d.notifications, maxPerWeek: Math.max(0, v) } }))} className="w-16" />
          par semaine, au moins
          <Num value={draft.notifications.minHoursBetween} min={0} onChange={(v) => update((d) => ({ ...d, notifications: { ...d.notifications, minHoursBetween: Math.max(0, v) } }))} className="w-16" />
          h entre deux · envoi entre
          <Num value={draft.notifications.sendFromHour} min={0} onChange={(v) => update((d) => ({ ...d, notifications: { ...d.notifications, sendFromHour: Math.min(23, Math.max(0, v)) } }))} className="w-16" />
          h et
          <Num value={draft.notifications.sendToHour} min={1} onChange={(v) => update((d) => ({ ...d, notifications: { ...d.notifications, sendToHour: Math.min(24, Math.max(1, v)) } }))} className="w-16" />
          h (heure d'Alger)
          <button type="button" onClick={onSave} disabled={!dirty || saving} className={`${btn} bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40`}>
            Enregistrer
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Seuls les clients ayant activé les notifications dans leur menu de compte reçoivent un push. Le statut de commande n'entre pas dans le plafond ; panier, réassort et fidélité, si. Chaque client peut couper « Offres et rappels » depuis son menu.
          Les relances panier et réassort partent avec le job quotidien (09:00 heure d'Alger) ; il faut les clés VAPID (voir OFFERS.md).
        </p>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-black text-white">À relancer maintenant</h3>
          <button type="button" onClick={load} className={`${btn} bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5`}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
        </div>
        {!due && !loading && <div className="text-xs text-slate-500">Impossible de charger la liste.</div>}
        {due && due.carts.length === 0 && due.reorders.length === 0 && (
          <div className="text-xs text-slate-500">Rien à relancer pour le moment.</div>
        )}
        {due && due.carts.length > 0 && (
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">Paniers non finalisés</h4>
            {due.carts.map((c) => (
              <div key={c.customerId} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800 text-xs">
                <span className="text-white min-w-0 truncate">
                  <b>{c.companyName || c.customerName}</b> · {c.items.length} réf. · {formatDZD(c.totalDA)}
                </span>
                {c.whatsapp && (
                  <a href={c.whatsapp} target="_blank" rel="noreferrer" className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white shrink-0`}>
                    WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        {due && due.reorders.length > 0 && (
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">Clients à relancer pour un réassort</h4>
            {due.reorders.map((r) => (
              <div key={r.customerId} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800 text-xs">
                <span className="text-white min-w-0 truncate">
                  <b>{r.companyName || r.fullName}</b> · dernière commande il y a {r.daysSince} j
                </span>
                {r.whatsapp && (
                  <a href={r.whatsapp} target="_blank" rel="noreferrer" className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white shrink-0`}>
                    WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- KPIs

const DAY = 24 * 3600 * 1000;

function stats(list: PreOrder[]) {
  const n = list.length;
  const revenue = list.reduce((s, o) => s + (Number(o.totalDA) || 0), 0);
  const items = list.reduce((s, o) => s + o.items.length, 0);
  const byCustomer = new Map<string, number>();
  list.forEach((o) => {
    const k = o.customerId || o.customer?.phone || o.id;
    byCustomer.set(k, (byCustomer.get(k) || 0) + 1);
  });
  const customers = byCustomer.size;
  const repeat = Array.from(byCustomer.values()).filter((c) => c > 1).length;
  const discounts = list.reduce((s, o) => s + (Number(o.discountDA) || 0), 0);
  return {
    n,
    revenue,
    aov: n ? revenue / n : 0,
    itemsPerOrder: n ? items / n : 0,
    ordersPerCustomer: customers ? n / customers : 0,
    repeatRate: customers ? (repeat / customers) * 100 : 0,
    discounts,
  };
}

const KpiTab: React.FC<{ orders: PreOrder[]; productName: (id: string) => string }> = ({ orders, productName }) => {
  const real = useMemo(() => orders.filter((o) => !o.isProforma && o.status !== 'annulee'), [orders]);
  const now = Date.now();
  const last = stats(real.filter((o) => now - new Date(o.date).getTime() <= 30 * DAY));
  const prev = stats(real.filter((o) => {
    const age = now - new Date(o.date).getTime();
    return age > 30 * DAY && age <= 60 * DAY;
  }));

  const pairs = useMemo(() => {
    const m = new Map<string, number>();
    real.forEach((o) => {
      const ids = Array.from(new Set(o.items.map((i) => i.productId))).sort();
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const k = `${ids[i]}|${ids[j]}`;
        m.set(k, (m.get(k) || 0) + 1);
      }
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [real]);

  const rows: { label: string; a: number; b: number; fmt: (n: number) => string; goodUp: boolean }[] = [
    { label: 'Commandes', a: last.n, b: prev.n, fmt: (n) => String(n), goodUp: true },
    { label: 'Chiffre d’affaires', a: last.revenue, b: prev.revenue, fmt: formatDZD, goodUp: true },
    { label: 'Panier moyen', a: last.aov, b: prev.aov, fmt: formatDZD, goodUp: true },
    { label: 'Références par commande', a: last.itemsPerOrder, b: prev.itemsPerOrder, fmt: (n) => n.toFixed(1), goodUp: true },
    { label: 'Commandes par client', a: last.ordersPerCustomer, b: prev.ordersPerCustomer, fmt: (n) => n.toFixed(2), goodUp: true },
    { label: 'Clients ayant recommandé', a: last.repeatRate, b: prev.repeatRate, fmt: (n) => `${n.toFixed(0)} %`, goodUp: true },
    { label: 'Remises accordées', a: last.discounts, b: prev.discounts, fmt: formatDZD, goodUp: false },
  ];

  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="text-sm font-black text-white flex items-center gap-2"><Layers className="w-4 h-4 text-rose-400" /> 30 derniers jours contre les 30 jours précédents</h3>
        <p className="text-[11px] text-slate-400">
          Précommandes non annulées, hors proforma. Notez la date de chaque changement de règle pour pouvoir comparer. Avec peu de commandes, lisez ces écarts avec prudence.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-1.5 pr-3 font-bold">Indicateur</th>
                <th className="py-1.5 pr-3 font-bold">30 derniers jours</th>
                <th className="py-1.5 pr-3 font-bold">Période précédente</th>
                <th className="py-1.5 font-bold">Écart</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const diff = r.b > 0 ? ((r.a - r.b) / r.b) * 100 : null;
                const good = diff === null ? null : r.goodUp ? diff >= 0 : diff <= 0;
                return (
                  <tr key={r.label} className="border-t border-slate-800 text-white">
                    <td className="py-1.5 pr-3">{r.label}</td>
                    <td className="py-1.5 pr-3 font-mono">{r.fmt(r.a)}</td>
                    <td className="py-1.5 pr-3 font-mono text-slate-400">{r.fmt(r.b)}</td>
                    <td className={`py-1.5 font-mono ${good === null ? 'text-slate-500' : good ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${diff.toFixed(0)} %`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-black text-white">Produits souvent commandés ensemble</h3>
        <p className="text-[11px] text-slate-400">Utile pour choisir les produits associés et composer les packs.</p>
        {pairs.length === 0 && <div className="text-xs text-slate-500">Pas encore assez de commandes.</div>}
        {pairs.map(([k, n]) => {
          const [a, b] = k.split('|');
          return (
            <div key={k} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800 text-xs text-white">
              <span className="min-w-0 truncate">{productName(a)} + {productName(b)}</span>
              <span className="font-mono text-slate-300 shrink-0">{n} commande(s)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
