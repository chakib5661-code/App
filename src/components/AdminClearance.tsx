import React, { useMemo, useState } from 'react';
import { Flame, Undo2, Eye, CheckCircle2 } from 'lucide-react';
import { Product } from '../types';
import { DEAD_STOCK_CODES, SLOW_STOCK_CODES } from '../data/deadStockCodes';
import {
  ClearanceLine,
  ExistingDiscountMode,
  MAX_CLEARANCE_PERCENT,
  applyClearance,
  batchSummary,
  clampPercent,
  matchCodes,
  parseCodes,
  removeClearance,
  resolveDiscount,
} from '../utils/clearance';
import { calculateDiscountedPrice } from '../utils/productUtils';
import { formatDZD } from '../utils/formatDZD';

interface AdminClearanceProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
}

const input =
  'bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-rose-500 w-full';
const card = 'bg-slate-900 border border-slate-700/80 rounded-2xl p-4 space-y-3';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer';

const deadSet = new Set(DEAD_STOCK_CODES.map((c) => c.toUpperCase()));
const slowSet = new Set(SLOW_STOCK_CODES.map((c) => c.toUpperCase()));
const groupOf = (code: string): 'dead' | 'slow' | 'other' => {
  const c = code.toUpperCase().replace(/\s+/g, '');
  return deadSet.has(c) ? 'dead' : slowSet.has(c) ? 'slow' : 'other';
};
const GROUP_LABEL = { dead: 'Mort', slow: 'Lent', other: 'Autre' } as const;

export const AdminClearance: React.FC<AdminClearanceProps> = ({ products, onUpdateProducts }) => {
  const [text, setText] = useState('');
  const [deadPct, setDeadPct] = useState(30);
  const [slowPct, setSlowPct] = useState(15);
  const [otherPct, setOtherPct] = useState(20);
  const [until, setUntil] = useState('');
  const [mode, setMode] = useState<ExistingDiscountMode>('raise');
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [done, setDone] = useState<string | null>(null);

  const codes = useMemo(() => parseCodes(text), [text]);
  const { matched, notFound } = useMemo(() => matchCodes(products, codes), [products, codes]);

  const lines = useMemo(
    () =>
      matched.map((p) => {
        const group = groupOf(p.code);
        const wanted = overrides[p.id] ?? (group === 'dead' ? deadPct : group === 'slow' ? slowPct : otherPct);
        const percent = resolveDiscount(p.discountPercent, wanted, mode);
        return { p, group, percent, wanted };
      }),
    [matched, deadPct, slowPct, otherPct, mode, overrides]
  );

  const batches = useMemo(() => batchSummary(products), [products]);
  const withDiscountAlready = lines.filter((l) => (l.p.discountPercent || 0) > 0 && !l.p.clearance).length;
  const outOfStock = lines.filter((l) => !(l.p.stock > 0)).length;

  const loadList = (list: string[], add: boolean) => {
    setDone(null);
    setText((prev) => (add && prev.trim() ? prev.trim() + '\n' : '') + list.join(' '));
  };

  const apply = () => {
    if (!lines.length) return;
    const batch = `clr-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4)}`;
    const payload: ClearanceLine[] = lines.map((l) => ({ id: l.p.id, percent: l.percent, group: l.group }));
    onUpdateProducts(applyClearance(products, payload, { batch, until: until || undefined }));
    setDone(`${payload.length} produits en déstockage${until ? ` jusqu'au ${until}` : ''}.`);
    setText('');
    setOverrides({});
  };

  const undo = (batch?: string) => {
    onUpdateProducts(removeClearance(products, batch));
    setDone(batch ? 'Lot annulé : remises précédentes rétablies.' : 'Tous les déstockages annulés.');
  };

  const setLinePct = (id: string, v: string) => {
    const n = v === '' ? NaN : Number(v);
    setOverrides((o) => {
      const next = { ...o };
      if (Number.isNaN(n)) delete next[id];
      else next[id] = clampPercent(n);
      return next;
    });
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className={card}>
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-500" />
          <h2 className="text-sm font-bold text-white">Déstockage en masse</h2>
        </div>
        <p className="text-[11px] text-slate-400">
          Collez des codes produit (P659, P737…) ou chargez la liste de la revue du 31/10/2026. Les remises sont appliquées sur les
          produits existants du site, sans toucher au stock. Plafond : {MAX_CLEARANCE_PERCENT} %.
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${btn} bg-rose-600 text-white`} onClick={() => loadList(DEAD_STOCK_CODES, false)}>
            Charger les produits morts ({DEAD_STOCK_CODES.length})
          </button>
          <button type="button" className={`${btn} bg-amber-600 text-white`} onClick={() => loadList(SLOW_STOCK_CODES, true)}>
            + Ajouter les lents ({SLOW_STOCK_CODES.length})
          </button>
          <button type="button" className={`${btn} bg-slate-700 text-white`} onClick={() => { setText(''); setOverrides({}); setDone(null); }}>
            Vider
          </button>
        </div>

        <textarea
          id="clearance-codes"
          value={text}
          onChange={(e) => { setText(e.target.value); setDone(null); }}
          rows={4}
          placeholder="P659 P737 P671…"
          className={`${input} font-mono`}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-[11px] text-slate-300">
          <label className="space-y-1">
            <span>Remise morts %</span>
            <input className={input} type="number" min={0} max={MAX_CLEARANCE_PERCENT} value={deadPct} onChange={(e) => setDeadPct(clampPercent(Number(e.target.value)))} />
          </label>
          <label className="space-y-1">
            <span>Remise lents %</span>
            <input className={input} type="number" min={0} max={MAX_CLEARANCE_PERCENT} value={slowPct} onChange={(e) => setSlowPct(clampPercent(Number(e.target.value)))} />
          </label>
          <label className="space-y-1">
            <span>Autres codes %</span>
            <input className={input} type="number" min={0} max={MAX_CLEARANCE_PERCENT} value={otherPct} onChange={(e) => setOtherPct(clampPercent(Number(e.target.value)))} />
          </label>
          <label className="space-y-1">
            <span>Fin (optionnel)</span>
            <input className={input} type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
          <label className="space-y-1 col-span-2">
            <span>Si le produit a déjà une remise</span>
            <select className={input} value={mode} onChange={(e) => setMode(e.target.value as ExistingDiscountMode)}>
              <option value="raise">Garder la plus haute</option>
              <option value="replace">Remplacer</option>
              <option value="keep">Ne pas toucher</option>
            </select>
          </label>
        </div>
      </div>

      {done && (
        <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-xs rounded-xl px-3 py-2">
          <CheckCircle2 className="w-4 h-4" /> {done}
        </div>
      )}

      {codes.length > 0 && (
        <div className={card}>
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <Eye className="w-4 h-4 text-slate-400" />
              <b>{lines.length}</b> produits trouvés sur {codes.length} codes
              {withDiscountAlready > 0 && <span className="text-slate-400">· {withDiscountAlready} ont déjà une remise</span>}
              {outOfStock > 0 && <span className="text-amber-400">· {outOfStock} sans stock</span>}
            </div>
            <button type="button" disabled={!lines.length} onClick={apply} className={`${btn} bg-rose-600 text-white disabled:opacity-40`}>
              Appliquer à {lines.length} produits
            </button>
          </div>

          {notFound.length > 0 && (
            <p className="text-[11px] text-amber-300">
              Codes introuvables sur le site ({notFound.length}) : <span className="font-mono">{notFound.join(' ')}</span>
            </p>
          )}

          <div className="overflow-auto max-h-[460px] rounded-xl border border-slate-800">
            <table className="w-full text-[11px] text-slate-200">
              <thead className="sticky top-0 bg-slate-950 text-slate-400">
                <tr>
                  <th className="text-left px-2 py-2">Code</th>
                  <th className="text-left px-2 py-2">Produit</th>
                  <th className="text-left px-2 py-2">Groupe</th>
                  <th className="text-right px-2 py-2">Stock</th>
                  <th className="text-right px-2 py-2">Prix</th>
                  <th className="text-right px-2 py-2">Remise actuelle</th>
                  <th className="text-right px-2 py-2 w-24">Nouvelle %</th>
                  <th className="text-right px-2 py-2">Nouveau prix</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(({ p, group, percent }) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="px-2 py-1.5 font-mono">{p.code}</td>
                    <td className="px-2 py-1.5">{p.name}</td>
                    <td className="px-2 py-1.5">{GROUP_LABEL[group]}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{p.stock}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatDZD(p.priceDA)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{p.discountPercent ? `-${p.discountPercent}%` : '—'}</td>
                    <td className="px-2 py-1.5">
                      <input
                        aria-label={`Remise ${p.code}`}
                        className={`${input} text-right py-1`}
                        type="number"
                        min={0}
                        max={MAX_CLEARANCE_PERCENT}
                        value={percent}
                        onChange={(e) => setLinePct(p.id, e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-bold text-rose-300">
                      {formatDZD(calculateDiscountedPrice(p.priceDA, percent))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500">
            La colonne « Nouvelle % » peut être modifiée ligne par ligne. Sur un produit en déstockage, le client reçoit le prix le plus bas
            entre la remise et le prix par volume, jamais les deux cumulés.
          </p>
        </div>
      )}

      <div className={card}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-white">Déstockages en cours</h3>
          {batches.length > 1 && (
            <button type="button" className={`${btn} bg-slate-700 text-white`} onClick={() => undo()}>
              Tout annuler
            </button>
          )}
        </div>
        {batches.length === 0 ? (
          <p className="text-[11px] text-slate-500">Aucun déstockage actif.</p>
        ) : (
          <ul className="space-y-2">
            {batches.map((b) => (
              <li key={b.batch} className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200">
                <span>
                  <b>{b.count}</b> produits · depuis le {b.startedAt.slice(0, 10)} · {b.until ? `fin le ${b.until}` : 'sans date de fin'}
                </span>
                <button type="button" className={`${btn} bg-slate-700 text-white inline-flex items-center gap-1`} onClick={() => undo(b.batch)}>
                  <Undo2 className="w-3 h-3" /> Annuler ce lot
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
