import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Search,
  Upload,
  Image as ImageIcon,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  Package,
  DollarSign,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Product } from '../types';
import { formatDZD } from '../utils/pdfGenerator';
import { compressImage } from '../utils/imageCompressor';
import { IrreversibleConfirmModal } from './IrreversibleConfirmModal';

interface AdminFlaconManagementProps {
  products: Product[];
  onAddFlacon?: (flacon: Product) => void;
  onUpdateFlacon?: (flacon: Product) => void;
  onDeleteFlacon?: (flaconId: string) => void;
  onUpdateProducts?: (products: Product[]) => void;
}

export const AdminFlaconManagement: React.FC<AdminFlaconManagementProps> = ({
  products,
  onAddFlacon,
  onUpdateFlacon,
  onDeleteFlacon,
  onUpdateProducts,
}) => {
  const flacons = products.filter((p) => p.family === 'Flacon');

  const handleAdd = (newFlacon: Product) => {
    if (onAddFlacon) {
      onAddFlacon(newFlacon);
    } else if (onUpdateProducts) {
      onUpdateProducts([newFlacon, ...products]);
    }
  };

  const handleUpdate = (updated: Product) => {
    if (onUpdateFlacon) {
      onUpdateFlacon(updated);
    } else if (onUpdateProducts) {
      onUpdateProducts(products.map((p) => (p.id === updated.id ? updated : p)));
    }
  };

  const handleDelete = (flaconId: string) => {
    if (onDeleteFlacon) {
      onDeleteFlacon(flaconId);
    } else if (onUpdateProducts) {
      onUpdateProducts(products.filter((p) => p.id !== flaconId));
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlacon, setEditingFlacon] = useState<Product | null>(null);
  const [confirmDeleteFlacon, setConfirmDeleteFlacon] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Flacons Verre & Cristal');
  const [unit, setUnit] = useState('1 pièce');
  const [priceDA, setPriceDA] = useState<number>(180);
  const [stock, setStock] = useState<number>(100);
  const [minAlertStock, setMinAlertStock] = useState<number>(20);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isHidden, setIsHidden] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false);

  const resetForm = () => {
    setName('');
    setCode('');
    setCategory('Flacons Verre & Cristal');
    setUnit('1 pièce');
    setPriceDA(180);
    setStock(100);
    setMinAlertStock(20);
    setDescription('');
    setImageUrl('');
    setIsHidden(false);
    setEditingFlacon(null);
    setFormError(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    const nextNum = flacons.length + 1;
    setCode(`FLAC-${String(nextNum).padStart(3, '0')}`);
    setIsHidden(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (flacon: Product) => {
    setEditingFlacon(flacon);
    setName(flacon.name);
    setCode(flacon.code);
    setCategory(flacon.category || 'Flacons Verre & Cristal');
    setUnit(flacon.unit || '1 pièce');
    setPriceDA(flacon.priceDA);
    setStock(flacon.stock);
    setMinAlertStock(flacon.minAlertStock || 20);
    setDescription(flacon.description || '');
    setImageUrl(flacon.imageUrl || '');
    setIsHidden(Boolean(flacon.isHidden));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleHide = (flacon: Product) => {
    const updated: Product = {
      ...flacon,
      isHidden: !flacon.isHidden,
      lastUpdated: new Date().toISOString(),
    };
    handleUpdate(updated);
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).');
      return;
    }

    try {
      setIsCompressingImage(true);
      setFormError(null);
      // Automatically compress and resize to web-optimized dimensions (< 60KB WebP)
      const compressed = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.82,
        mimeType: 'image/webp',
      });
      setImageUrl(compressed);
    } catch (err) {
      console.warn('Compression error:', err);
      setFormError("Échec de l'optimisation de l'image.");
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Le nom du flacon est requis.');
      return;
    }
    if (!code.trim()) {
      setFormError('La référence / code est requise.');
      return;
    }
    if (priceDA <= 0) {
      setFormError('Le prix unitaire en DA doit être supérieur à zéro.');
      return;
    }
    if (stock < 0) {
      setFormError('Le stock ne peut pas être négatif.');
      return;
    }

    const defaultFlaconImage =
      'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80';

    if (editingFlacon) {
      const updated: Product = {
        ...editingFlacon,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        family: 'Flacon',
        category: category.trim(),
        unit: unit.trim() || '1 pièce',
        priceDA: Math.round(Number(priceDA)),
        stock: Number(stock),
        minAlertStock: Number(minAlertStock),
        description: description.trim(),
        imageUrl: imageUrl.trim() || editingFlacon.imageUrl || defaultFlaconImage,
        isHidden: Boolean(isHidden),
        lastUpdated: new Date().toISOString(),
      };
      handleUpdate(updated);
    } else {
      const newFlacon: Product = {
        id: `flac-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        family: 'Flacon',
        category: category.trim(),
        unit: unit.trim() || '1 pièce',
        priceDA: Math.round(Number(priceDA)),
        stock: Number(stock),
        minAlertStock: Number(minAlertStock),
        description: description.trim(),
        imageUrl: imageUrl.trim() || defaultFlaconImage,
        isHidden: Boolean(isHidden),
        lastUpdated: new Date().toISOString(),
      };
      handleAdd(newFlacon);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const filteredFlacons = flacons.filter((f) => {
    // Visibility filter
    if (visibilityFilter === 'visible' && f.isHidden) return false;
    if (visibilityFilter === 'hidden' && !f.isHidden) return false;

    const q = (searchQuery || '').toLowerCase().trim();
    if (!q) return true;
    return (
      (f.name || '').toLowerCase().includes(q) ||
      (f.code || '').toLowerCase().includes(q) ||
      Boolean(f.category && f.category.toLowerCase().includes(q))
    );
  });

  const hiddenCount = flacons.filter((f) => f.isHidden).length;
  const visibleCount = flacons.length - hiddenCount;

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-fuchsia-700 flex items-center justify-center text-white shadow-md">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">
              Gestion des Flacons & Emballages
            </h3>
            <p className="text-xs text-slate-400">
              Ajout manuel avec photos et prix (indépendant de la synchronisation Excel des Extraits)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Flacon</span>
          </button>
        </div>
      </div>

      {/* Info notice about separation from Excel */}
      <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-200 flex items-start gap-2.5">
        <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
          ✓
        </div>
        <div>
          <strong className="font-semibold text-white">Catalogue Flacons Séparé : </strong>
          L'import Excel n'écrase que les <em>Extraits</em>. Tous les flacons créés ou modifiés ici sont sauvegardés et restent intacts en permanence.
        </div>
      </div>

      {/* Search & Stats & Visibility Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, référence..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setVisibilityFilter('all')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                visibilityFilter === 'all'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tous ({flacons.length})
            </button>
            <button
              type="button"
              onClick={() => setVisibilityFilter('visible')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                visibilityFilter === 'visible'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Visibles ({visibleCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setVisibilityFilter('hidden')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                visibilityFilter === 'hidden'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <EyeOff className="w-3 h-3" />
              <span>Masqués ({hiddenCount})</span>
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Affichage : <strong className="text-white">{filteredFlacons.length}</strong> modèles
        </div>
      </div>

      {/* Flacons Grid */}
      {filteredFlacons.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">
            Aucun flacon ne correspond aux critères
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Cliquez sur "Ajouter un Flacon" ou modifiez vos filtres de recherche.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFlacons.map((flacon) => (
            <div
              key={flacon.id}
              className={`bg-slate-900/90 border rounded-2xl overflow-hidden shadow-md flex flex-col transition group ${
                flacon.isHidden
                  ? 'border-amber-500/40 opacity-90'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Image Preview */}
              <div className="relative aspect-4/3 w-full bg-slate-950 overflow-hidden">
                {flacon.imageUrl ? (
                  <img
                    src={flacon.imageUrl}
                    alt={flacon.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}

                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-xs text-[10px] font-mono font-bold text-rose-300 border border-slate-800">
                    {flacon.code}
                  </span>

                  {flacon.isHidden && (
                    <span className="px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-500/50 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <EyeOff className="w-3 h-3" />
                      <span>Masqué</span>
                    </span>
                  )}
                </div>

                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono font-extrabold text-xs shadow-md">
                  {formatDZD(flacon.priceDA)}
                </div>
              </div>

              {/* Body */}
              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-start justify-between gap-1.5">
                    <h4 className="font-bold text-sm text-white line-clamp-1">
                      {flacon.name}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {flacon.category || 'Flaconnage'} • {flacon.unit}
                  </p>
                  {flacon.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                      {flacon.description}
                    </p>
                  )}
                </div>

                {/* Stock info */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Stock :</span>
                  <span
                    className={`font-mono font-bold ${
                      flacon.stock <= (flacon.minAlertStock || 20)
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {flacon.stock} pièces
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-1">
                  {/* Hide / Show Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleHide(flacon)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                      flacon.isHidden
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                    }`}
                    title={flacon.isHidden ? 'Rendre visible sur le catalogue public' : 'Masquer ce flacon du catalogue public'}
                  >
                    {flacon.isHidden ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden xs:inline sm:inline">Afficher</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        <span className="hidden xs:inline sm:inline">Masquer</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(flacon)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Modifier</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmDeleteFlacon(flacon)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-750 transition cursor-pointer"
                    title="Supprimer définitivement ce flacon (Can't undo - Réécriture DB)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden text-white flex flex-col my-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-white">
                  {editingFlacon ? 'Modifier le Flacon' : 'Ajouter un Nouveau Flacon'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Name & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nom du Flacon *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Flacon Cristal Spray 50ml"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Référence / Code *
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Ex: FLAC-50-CRIS"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Catégorie / Type
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="Flacons Verre & Cristal">Flacons Verre & Cristal</option>
                    <option value="Flacons Plastique PET">Flacons Plastique PET</option>
                    <option value="Flacons Roll-on">Flacons Roll-on</option>
                    <option value="Vaporisateurs Luxe">Vaporisateurs Luxe</option>
                    <option value="Pompes & Bouchons">Pompes & Bouchons</option>
                    <option value="Accessoires Remplissage">Accessoires Remplissage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Unité de Vente
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Ex: 1 pièce, Lot de 10"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Price & Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Prix Unitaire (DA) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={priceDA}
                    onChange={(e) => setPriceDA(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Stock Initial (pièces) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Alerte Stock Bas
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={minAlertStock}
                    onChange={(e) => setMinAlertStock(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Image Upload & URL */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Photo du Flacon (Fichier ou URL)
                </label>
                
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  {/* File input button */}
                  <label className={`w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-rose-300 hover:text-rose-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${isCompressingImage ? 'opacity-70 pointer-events-none' : ''}`}>
                    <Upload className={`w-4 h-4 ${isCompressingImage ? 'animate-spin' : ''}`} />
                    <span>{isCompressingImage ? 'Optimisation web...' : 'Choisir une photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      disabled={isCompressingImage}
                      className="hidden"
                    />
                  </label>

                  <span className="text-xs text-slate-500">ou par URL :</span>

                  {/* URL Input */}
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://... lien image"
                    className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Preview */}
                {imageUrl && (
                  <div className="mt-2 flex items-center gap-3 p-2 bg-slate-950 rounded-xl border border-slate-800">
                    <img
                      src={imageUrl}
                      alt="Aperçu"
                      className="w-14 h-14 object-cover rounded-lg border border-slate-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-xs text-slate-300">
                      <span className="text-emerald-400 font-bold block">✓ Image prête</span>
                      <span className="text-[11px] text-slate-500">Sera affichée dans le catalogue</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Description / Caractéristiques
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Verre épais de haute transparence, bouchon doré magnétique, étanche..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              {/* Hide / Visibility Option */}
              <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="flacon-hidden-toggle"
                  checked={isHidden}
                  onChange={(e) => setIsHidden(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-900 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="flacon-hidden-toggle" className="text-xs font-semibold text-slate-200 cursor-pointer select-none">
                  Masquer ce flacon du catalogue public (Visible uniquement en administration)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingFlacon ? 'Enregistrer les Modifications' : 'Créer le Flacon'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Irreversible Confirm Modal for Flacon Deletion (Can't undo - Database Rewrite) */}
      {confirmDeleteFlacon && (
        <IrreversibleConfirmModal
          isOpen={Boolean(confirmDeleteFlacon)}
          title={`Supprimer Définitivement "${confirmDeleteFlacon.name}"`}
          description={`Attention : Cette action est irréversible (Can't undo) et écrasera définitivement la base de données. Le modèle de flacon sera supprimé de l'inventaire central.`}
          details={`Réf: ${confirmDeleteFlacon.code} • Prix: ${formatDZD(confirmDeleteFlacon.priceDA)} • Stock restant: ${confirmDeleteFlacon.stock} pièces`}
          confirmLabel="Supprimer définitivement (Réécrire DB)"
          cancelLabel="Annuler"
          onConfirm={() => {
            if (confirmDeleteFlacon) {
              handleDelete(confirmDeleteFlacon.id);
            }
            setConfirmDeleteFlacon(null);
          }}
          onCancel={() => setConfirmDeleteFlacon(null)}
        />
      )}
    </div>
  );
};
