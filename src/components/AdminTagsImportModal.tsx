import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { X, UploadCloud, CheckCircle2, AlertCircle, Tags } from 'lucide-react';
import { Product, OlfactiveSheet } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
}

interface TagRow {
  ref: string;
  name: string;
  brand: string;
  gender: string;
  style: string;
  olfactive: OlfactiveSheet | null;
}

const norm = (s: unknown) => String(s ?? '').trim();
const key = (s: string) => s.toUpperCase().replace(/\s+/g, '');
const cleanGender = (s: string) => {
  const g = s.toLowerCase().replace(/\(likely\)/g, '').trim();
  if (['men', 'homme', 'm', 'h'].includes(g)) return 'Men';
  if (['women', 'femme', 'f'].includes(g)) return 'Women';
  if (['unisex', 'inisex', 'mixte', 'u'].includes(g)) return 'Unisex';
  return '';
};
const cleanStyle = (s: string) => {
  const v = s.toLowerCase().trim();
  const map: Record<string, string> = {
    designer: 'Designer', niche: 'Niche', arabic: 'Arabic', arabe: 'Arabic',
    'own brand': 'Own brand', 'non-perfume': 'Non-perfume',
  };
  return map[v] || '';
};
const SUGGESTED = /\((suggested|likely)\)/i;
const stripSug = (s: string) => s.replace(/\s*\((suggested|likely)\)/gi, '').trim();
const buildOlfactive = (r: Record<string, unknown>): OlfactiveSheet | null => {
  const season = pick(r, ['when to wear (season)', 'season', 'saison']);
  const time = pick(r, ['when to wear (time)', 'time', 'moment']);
  const o: OlfactiveSheet = {
    season: stripSug(season) || undefined,
    time: stripSug(time) || undefined,
    top: pick(r, ['top notes', 'notes de tete']) || undefined,
    middle: pick(r, ['middle notes', 'notes de coeur']) || undefined,
    base: pick(r, ['base notes', 'notes de fond']) || undefined,
    notes: pick(r, ['notes (no pyramid)', 'notes']) || undefined,
    accords: pick(r, ['main accords', 'accords']) || undefined,
    description: pick(r, ['description']) || undefined,
    source: pick(r, ['data source', 'source']) || undefined,
    suggested: SUGGESTED.test(season) || SUGGESTED.test(time) || undefined,
  };
  return Object.values(o).some((v) => v !== undefined) ? o : null;
};
// Column header aliases (case / accent insensitive)
const pick = (row: Record<string, unknown>, names: string[]) => {
  for (const k of Object.keys(row)) {
    const kk = k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    if (names.includes(kk)) return norm(row[k]);
  }
  return '';
};

export const AdminTagsImportModal: React.FC<Props> = ({ isOpen, onClose, products, onUpdateProducts }) => {
  const [rows, setRows] = useState<TagRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const analysis = useMemo(() => {
    const byCode = new Map<string, Product[]>();
    products.forEach((p) => {
      const k = key(p.code || '');
      if (!byCode.has(k)) byCode.set(k, []);
      byCode.get(k)!.push(p);
    });
    const matched: TagRow[] = [];
    const unmatched: TagRow[] = [];
    const invalid: string[] = [];
    rows.forEach((r) => {
      if (!byCode.has(key(r.ref))) unmatched.push(r);
      else matched.push(r);
      if (!r.brand) invalid.push(`${r.ref}: marque vide`);
      if (r.gender && !cleanGender(r.gender)) invalid.push(`${r.ref}: genre "${r.gender}" non reconnu`);
      if (r.style && !cleanStyle(r.style)) invalid.push(`${r.ref}: style "${r.style}" non reconnu`);
    });
    return { matched, unmatched, invalid };
  }, [rows, products]);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setError(null);
    setDone(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const parsed: TagRow[] = raw
        .map((r) => ({
          ref: pick(r, ['ref', 'reference', 'code', 'article ref']),
          name: pick(r, ['name', 'nom', 'product', 'produit', 'article']),
          brand: pick(r, ['brand', 'marque']),
          gender: pick(r, ['gender', 'genre', 'gender_clean']),
          style: pick(r, ['style']),
          olfactive: buildOlfactive(r),
        }))
        .filter((r) => r.ref);
      if (!parsed.length) throw new Error('Aucune ligne avec une colonne "ref" trouvée.');
      setRows(parsed);
      setFileName(file.name);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || 'Fichier illisible.');
    }
  };

  const apply = () => {
    const map = new Map(analysis.matched.map((r) => [key(r.ref), r]));
    let count = 0;
    const next = products.map((p) => {
      const r = map.get(key(p.code || ''));
      if (!r) return p;
      count++;
      return {
        ...p,
        brand: r.brand || p.brand,
        gender: cleanGender(r.gender) || p.gender,
        style: cleanStyle(r.style) || p.style,
        olfactive: r.olfactive || p.olfactive,
      };
    });
    onUpdateProducts(next);
    setDone(`${count} produit(s) mis à jour (marque, genre, style, fiche olfactive).`);
    setRows([]);
    setFileName('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center border border-violet-500/30">
              <Tags className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Filtres Extraits • Marque / Genre / Style</h3>
              <p className="text-xs text-slate-400">
                Excel avec les colonnes <code className="text-violet-300 font-mono">ref, name, brand, gender, style</code> (+ notes, accords, saison… facultatifs)
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full py-6 border-2 border-dashed border-slate-700 hover:border-violet-500 rounded-xl flex flex-col items-center gap-2 text-slate-300 cursor-pointer transition"
          >
            <UploadCloud className="w-6 h-6 text-violet-400" />
            <span className="font-bold">{fileName || 'Choisir le fichier Excel (.xlsx, .xls, .csv)'}</span>
          </button>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {done && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-700 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {done}
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-lg font-black text-white">{rows.length}</div>
                  <div className="text-[11px] text-slate-400">lignes</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-emerald-700/40">
                  <div className="text-lg font-black text-emerald-400">{analysis.matched.length}</div>
                  <div className="text-[11px] text-slate-400">trouvés sur le site</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-amber-700/40">
                  <div className="text-lg font-black text-amber-400">{analysis.unmatched.length}</div>
                  <div className="text-[11px] text-slate-400">ref inconnues (ignorées)</div>
                </div>
              </div>

              {analysis.invalid.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-200 space-y-1 max-h-32 overflow-y-auto">
                  <div className="font-bold">À vérifier ({analysis.invalid.length}) :</div>
                  {analysis.invalid.slice(0, 30).map((m) => <div key={m}>• {m}</div>)}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800">
                <table className="w-full text-left">
                  <thead className="bg-slate-950 text-slate-400 sticky top-0">
                    <tr><th className="p-2">Ref</th><th className="p-2">Nom</th><th className="p-2">Marque</th><th className="p-2">Genre</th><th className="p-2">Style</th><th className="p-2">Fiche</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r) => (
                      <tr key={r.ref} className="border-t border-slate-800">
                        <td className="p-2 font-mono text-violet-300">{r.ref}</td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2">{r.brand}</td>
                        <td className="p-2">{r.gender}</td>
                        <td className="p-2">{r.style}</td>
                        <td className="p-2">{r.olfactive ? '✓' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={apply}
                disabled={analysis.matched.length === 0}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                Appliquer à {analysis.matched.length} produit(s)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
