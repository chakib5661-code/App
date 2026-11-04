import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2, Loader2 } from 'lucide-react';
import type { StoreSettings } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { uploadMediaToServer, updateSettingsOnServer } from '../utils/api';

interface Props {
  storeSettings: StoreSettings;
  onUpdateSettings?: (settings: StoreSettings) => void;
}

/** Admin card: upload the advertising picture shown behind the storefront hero. */
export const AdminHeroImage: React.FC<Props> = ({ storeSettings, onUpdateSettings }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (heroImageUrl: string | undefined) => {
    const next: StoreSettings = { ...storeSettings, heroImageUrl };
    const saved = await updateSettingsOnServer(next);
    if (!saved) {
      setMessage({ ok: false, text: "Échec de l'enregistrement sur le serveur." });
      return;
    }
    onUpdateSettings?.(saved);
    setMessage({ ok: true, text: heroImageUrl ? 'Image enregistrée.' : 'Image retirée.' });
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    setMessage(null);
    if (!file.type.startsWith('image/')) {
      setMessage({ ok: false, text: 'Choisissez une image (JPG, PNG, WebP).' });
      return;
    }
    try {
      setBusy(true);
      const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 900, quality: 0.78, mimeType: 'image/webp' });
      const up = await uploadMediaToServer(compressed, file.name);
      await save(up.success && up.url ? up.url : compressed);
    } catch (err) {
      console.warn('Hero image error:', err);
      setMessage({ ok: false, text: "Erreur lors de l'optimisation de l'image." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const url = storeSettings.heroImageUrl;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
      <h3 className="font-black text-slate-900 text-sm mb-1">Image publicitaire de l'en-tête</h3>
      <p className="text-xs text-slate-500 mb-3">Affichée derrière le bandeau du haut de la boutique. Format large conseillé (1600×900).</p>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div
          className="w-full sm:w-56 h-28 rounded-xl border border-slate-200 bg-slate-100 bg-cover bg-center flex items-center justify-center text-xs text-slate-500"
          style={url ? { backgroundImage: `url("${url.replace(/"/g, '%22')}")` } : undefined}
        >
          {!url && 'Aucune image'}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#9f0e4e] hover:bg-[#70083b] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {url ? "Changer l'image" : 'Téléverser une image'}
          </button>
          {url && (
            <button
              type="button"
              disabled={busy}
              onClick={() => save(undefined)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" /> Retirer
            </button>
          )}
        </div>
      </div>
      {message && <p className={`mt-2 text-xs font-semibold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
    </div>
  );
};
