import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  AlertCircle,
  Check,
  X,
  Package,
  Sparkles,
  Info,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { Product } from '../types';
import { formatDZD } from '../utils/pdfGenerator';
import { compressImage } from '../utils/imageCompressor';
import { IrreversibleConfirmModal } from './IrreversibleConfirmModal';

interface AdminAccessoryManagementProps {
  products: Product[];
  onAddAccessory?: (accessory: Product) => void;
  onUpdateAccessory?: (accessory: Product) => void;
  onDeleteAccessory?: (accessoryId: string) => void;
  onUpdateProducts: (updated: Product[]) => void;
}

const ACCESSORY_CATEGORIES = [
  'Sertisseuses & Pinces',
  'Pipettes & Dosages',
  'Entonnoirs & Verrerie',
  'Testeurs & Mouillettes',
  'Pompes & Sprays',
  'Outils & Ateliers',
  'Accessoires Divers',
];

const UNIT_PRESETS = [
  '1 pièce',
  'Lot de 5 pcs',
  'Lot de 10 pcs',
  'Boîte de 50 pcs',
  'Boîte de 100 pcs',
  'Paquet de 500 pcs',
  'Carton',
];

export const AdminAccessoryManagement: React.FC<AdminAccessoryManagementProps> = ({
  products,
  onAddAccessory,
  onUpdateAccessory,
  onDeleteAccessory,
  onUpdateProducts,
}) => {
  // Filter for accessories only
  const accessories = products.filter((p) => p.family === 'Accessoire');

  const handleAdd = (newAcc: Product) => {
    if (onAddAccessory) {
      onAddAccessory(newAcc);
    } else {
      onUpdateProducts([newAcc, ...products]);
    }
  };

  const handleUpdate = (updated: Product) => {
    if (onUpdateAccessory) {
      onUpdateAccessory(updated);
    } else {
      onUpdateProducts(products.map((p) => (p.id === updated.id ? updated : p)));
    }
  };

  const handleDelete = (accessoryId: string) => {
    if (onDeleteAccessory) {
      onDeleteAccessory(accessoryId);
    } else {
      onUpdateProducts(products.filter((p) => p.id !== accessoryId));
    }
  };

  // Search and view state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccessory, setEditingAccessory] = useState<Product | null>(null);
  const [confirmDeleteAccessory, setConfirmDeleteAccessory] = useState<Product | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState(ACCESSORY_CATEGORIES[0]);
  const [unit, setUnit] = useState('1 pièce');
  const [priceDA, setPriceDA] = useState<number>(1000);
  const [stock, setStock] = useState<number>(50);
  const [minAlertStock, setMinAlertStock] = useState<number>(10);
  const [description, setDescription] = useState('');
  const [origin, setOrigin] = useState('Import');
  const [imageUrl, setImageUrl] = useState('');
  const [isHidden, setIsHidden] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false);

  // Generate next recommended reference code (e.g. ACC-001, ACC-002...)
  const generateNextCode = () => {
    const existingCodes = accessories
      .map((a) => {
        const match = a.code.match(/ACC-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const nextNum = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : accessories.length + 1;
    return `ACC-${nextNum.toString().padStart(3, '0')}`;
  };

  // Open Modal for New Accessory
  const handleOpenAddModal = () => {
    setEditingAccessory(null);
    setName('');
    setCode(generateNextCode());
    setCategory(ACCESSORY_CATEGORIES[0]);
    setUnit('1 pièce');
    setPriceDA(1200);
    setStock(30);
    setMinAlertStock(5);
    setDescription('');
    setOrigin('Import');
    setImageUrl('https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80');
    setIsHidden(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Modal for Editing Accessory
  const handleOpenEditModal = (acc: Product) => {
    setEditingAccessory(acc);
    setName(acc.name);
    setCode(acc.code);
    setCategory(acc.category || ACCESSORY_CATEGORIES[0]);
    setUnit(acc.unit || '1 pièce');
    setPriceDA(acc.priceDA);
    setStock(acc.stock);
    setMinAlertStock(acc.minAlertStock ?? 5);
    setDescription(acc.description || '');
    setOrigin(acc.origin || 'Import');
    setImageUrl(acc.imageUrl || '');
    setIsHidden(Boolean(acc.isHidden));
    setFormError(null);
    setIsModalOpen(true);
  };

  // Image File Upload Handler with client-side compression (< 60KB WebP)
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

  // Submit Add or Edit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Le nom de l'accessoire est obligatoire.");
      return;
    }

    if (!code.trim()) {
      setFormError('La référence / code est obligatoire.');
      return;
    }

    const cleanedCode = code.trim().toUpperCase();

    // Check code collision with other products
    const collision = products.find(
      (p) => p.code.toUpperCase() === cleanedCode && p.id !== editingAccessory?.id
    );
    if (collision) {
      setFormError(`Le code de référence "${cleanedCode}" est déjà utilisé par un autre article.`);
      return;
    }

    if (editingAccessory) {
      // Update existing accessory
      const updatedItem: Product = {
        ...editingAccessory,
        name: name.trim(),
        code: cleanedCode,
        family: 'Accessoire' as const,
        category: category.trim(),
        unit: unit.trim() || '1 pièce',
        priceDA: Math.round(Math.max(0, priceDA)),
        stock: Math.max(0, stock),
        minAlertStock: Math.max(0, minAlertStock),
        description: description.trim(),
        origin: origin.trim(),
        imageUrl: imageUrl.trim() || undefined,
        isHidden,
        lastUpdated: new Date().toISOString(),
      };

      handleUpdate(updatedItem);
    } else {
      // Create new accessory
      const newAcc: Product = {
        id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        code: cleanedCode,
        family: 'Accessoire' as const,
        category: category.trim(),
        unit: unit.trim() || '1 pièce',
        priceDA: Math.round(Math.max(0, priceDA)),
        stock: Math.max(0, stock),
        minAlertStock: Math.max(0, minAlertStock),
        description: description.trim(),
        origin: origin.trim(),
        imageUrl: imageUrl.trim() || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
        isHidden,
        lastUpdated: new Date().toISOString(),
      };

      handleAdd(newAcc);
    }

    setIsModalOpen(false);
  };

  // Toggle Visibility in public store
  const handleToggleVisibility = (accessoryId: string) => {
    const acc = products.find((p) => p.id === accessoryId);
    if (!acc) return;
    const updated = { ...acc, isHidden: !acc.isHidden, lastUpdated: new Date().toISOString() };
    handleUpdate(updated);
  };

  // Delete Accessory
  const handleDeleteAccessory = (accessoryId: string) => {
    handleDelete(accessoryId);
  };

  // Filtered accessories list for display
  const filteredAccessories = accessories.filter((acc) => {
    // Visibility
    if (visibilityFilter === 'visible' && acc.isHidden) return false;
    if (visibilityFilter === 'hidden' && !acc.isHidden) return false;

    // Category
    if (categoryFilter !== 'all' && acc.category !== categoryFilter) return false;

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = (acc.name || '').toLowerCase().includes(q);
      const matchCode = (acc.code || '').toLowerCase().includes(q);
      const matchCat = (acc.category || '').toLowerCase().includes(q);
      const matchDesc = (acc.description || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchCat && !matchDesc) return false;
    }

    return true;
  });

  // Key KPI stats
  const totalCount = accessories.length;
  const inStockCount = accessories.filter((a) => a.stock > 0).length;
  const lowStockCount = accessories.filter((a) => a.stock > 0 && a.stock <= (a.minAlertStock ?? 5)).length;
  const totalStockValueDA = accessories.reduce((sum, a) => sum + a.priceDA * a.stock, 0);

  return (
    <div className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <span>Gestion Manuelle des Accessoires & Outils</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {totalCount} modèles
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ajoutez, modifiez, masquez ou supprimez vos pinces à sertir, pipettes, entonnoirs et touches olfactives.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          id="btn-add-accessory-manual"
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-900/30 transition cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un Accessoire</span>
        </button>
      </div>

      {/* Information Notice on Excel isolation */}
      <div className="p-3.5 rounded-2xl bg-teal-950/40 border border-teal-500/30 flex items-start gap-3">
        <Info className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-bold text-teal-300 block mb-0.5">
            Catalogue Accessoires Indépendant & Protégé :
          </span>
          Tout comme vos flacons, les accessoires créés ici sont gérés manuellement avec leurs photos, prix et fiches techniques.
          Lors de vos imports de fichiers Excel (inventaire de caisse des extraits), <strong>vos accessoires restent intégralement conservés et ne sont jamais écrasés</strong>.
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Références</span>
            <Package className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-xl font-extrabold text-white mt-1 font-mono">{totalCount}</p>
          <span className="text-[10px] text-slate-500">Accessoires répertoriés</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Disponibles</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">{inStockCount}</p>
          <span className="text-[10px] text-slate-500">En stock prêt à livrer</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Stock Bas</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-extrabold text-amber-400 mt-1 font-mono">{lowStockCount}</p>
          <span className="text-[10px] text-slate-500">Sous seuil de réappro</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Valeur Stock</span>
            <DollarSign className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-lg font-extrabold text-teal-300 mt-1 font-mono truncate">
            {formatDZD(totalStockValueDA)}
          </p>
          <span className="text-[10px] text-slate-500">Estimation totale</span>
        </div>
      </div>

      {/* Control Bar: Search + Category + Visibility Toggle */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher nom, référence (ex: ACC-001)..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Dropdown */}
        <div className="w-full md:w-auto flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full md:w-auto bg-slate-950 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
          >
            <option value="all">Toutes les catégories ({accessories.length})</option>
            {ACCESSORY_CATEGORIES.map((cat) => {
              const count = accessories.filter((a) => a.category === cat).length;
              return (
                <option key={cat} value={cat}>
                  {cat} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* Visibility Filter Buttons */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full md:w-auto justify-center">
          <button
            type="button"
            onClick={() => setVisibilityFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              visibilityFilter === 'all'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tous ({accessories.length})
          </button>
          <button
            type="button"
            onClick={() => setVisibilityFilter('visible')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
              visibilityFilter === 'visible'
                ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visibles ({accessories.filter((a) => !a.isHidden).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setVisibilityFilter('hidden')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
              visibilityFilter === 'hidden'
                ? 'bg-amber-600/30 text-amber-300 font-bold border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Masqués ({accessories.filter((a) => a.isHidden).length})</span>
          </button>
        </div>
      </div>

      {/* Accessories Grid */}
      {filteredAccessories.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
          <Wrench className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">Aucun accessoire trouvé</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm || categoryFilter !== 'all' || visibilityFilter !== 'all'
              ? 'Aucun modèle ne correspond à vos critères de recherche.'
              : 'Commencez par ajouter votre premier accessoire (sertisseuse, pipettes, entonnoirs...) en cliquant sur le bouton ci-dessus.'}
          </p>
          {(searchTerm || categoryFilter !== 'all' || visibilityFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setVisibilityFilter('all');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAccessories.map((acc) => (
            <div
              key={acc.id}
              className={`rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                acc.isHidden
                  ? 'bg-slate-900/40 border-slate-800/80 opacity-75'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-md'
              }`}
            >
              {/* Card Top: Photo & Badges */}
              <div className="relative h-44 bg-slate-950 overflow-hidden group">
                <img
                  src={
                    acc.imageUrl ||
                    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80'
                  }
                  alt={acc.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80';
                  }}
                />

                {/* Reference Code Badge */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-950/80 text-teal-300 border border-teal-500/30 backdrop-blur-xs">
                    {acc.code}
                  </span>
                </div>

                {/* Stock Status Badge */}
                <div className="absolute top-2.5 right-2.5">
                  {acc.stock <= 0 ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-950/90 text-rose-300 border border-rose-500/40 backdrop-blur-xs">
                      Épuisé
                    </span>
                  ) : acc.stock <= (acc.minAlertStock ?? 5) ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-500/40 backdrop-blur-xs">
                      Alerte ({acc.stock})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 backdrop-blur-xs">
                      En stock ({acc.stock})
                    </span>
                  )}
                </div>

                {/* Hidden Status Ribbon */}
                {acc.isHidden && (
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-amber-500/90 text-slate-950 text-[10px] font-black uppercase text-center py-0.5 rounded backdrop-blur-xs">
                    Masqué du Catalogue Public
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30">
                      {acc.category || 'Accessoire'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {acc.unit}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-white line-clamp-2" title={acc.name}>
                    {acc.name}
                  </h3>

                  {acc.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {acc.description}
                    </p>
                  )}
                </div>

                {/* Price and Stock row */}
                <div className="pt-2 border-t border-slate-800/80 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Prix de Vente :</span>
                    <span className="text-base font-extrabold text-teal-300 font-mono">
                      {formatDZD(acc.priceDA)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Disponibilité :</span>
                    <span className="text-xs font-bold font-mono text-slate-200">
                      {acc.stock} <span className="text-[10px] font-normal text-slate-500">pièces</span>
                    </span>
                  </div>
                </div>

                {/* Action Buttons: Quick visibility, Edit, Delete */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleVisibility(acc.id)}
                    className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                      acc.isHidden
                        ? 'bg-amber-950/60 text-amber-300 border-amber-500/40 hover:bg-amber-900/60'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                    title={acc.isHidden ? 'Rendre visible dans le store' : 'Masquer du store public'}
                  >
                    {acc.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{acc.isHidden ? 'Masqué' : 'Visible'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(acc)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition cursor-pointer"
                      title="Modifier cet accessoire"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-teal-400" />
                      <span>Modifier</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAccessory(acc)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-750 transition cursor-pointer"
                      title="Supprimer cet accessoire (Can't undo - Réécriture DB)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Accessory Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-teal-500/40 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden text-white flex flex-col my-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white">
                  <Wrench className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-white">
                  {editingAccessory ? "Modifier l'Accessoire" : 'Ajouter un Nouvel Accessoire'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
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
                    Nom de l'Accessoire *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Pince à Sertir Manuelle FEA 15/20"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
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
                    placeholder="Ex: ACC-SERT-1520"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    {ACCESSORY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Unité de Vente / Format
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Ex: 1 pièce, Boîte 100 pcs"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                  {/* Quick unit suggestion pills */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {UNIT_PRESETS.slice(0, 4).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setUnit(preset)}
                        className={`text-[10px] px-2 py-0.5 rounded transition ${
                          unit === preset
                            ? 'bg-teal-500/30 text-teal-300 border border-teal-500/40'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Origin */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Origine / Marque
                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Ex: Import Italie, France, Local"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Image Upload & URL */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Photo de l'Accessoire (Fichier ou URL)
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <label className={`w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-teal-300 hover:text-teal-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${isCompressingImage ? 'opacity-70 pointer-events-none' : ''}`}>
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

                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://... lien image"
                    className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
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
                      <span className="text-teal-400 font-bold block">✓ Image prête</span>
                      <span className="text-[11px] text-slate-500">Sera affichée dans le catalogue</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Description / Caractéristiques Techniques
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Acier trempé inoxydable, mâchoire 15/20mm interchangeable, poignée ergonomique..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              {/* Hide / Visibility Option */}
              <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="acc-hidden-toggle"
                  checked={isHidden}
                  onChange={(e) => setIsHidden(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-900 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="acc-hidden-toggle" className="text-xs font-semibold text-slate-200 cursor-pointer select-none">
                  Masquer cet accessoire du catalogue public (Visible uniquement en administration)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingAccessory ? 'Enregistrer les Modifications' : "Créer l'Accessoire"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Irreversible Confirm Modal for Accessory Deletion (Can't undo - Database Rewrite) */}
      {confirmDeleteAccessory && (
        <IrreversibleConfirmModal
          isOpen={Boolean(confirmDeleteAccessory)}
          title={`Supprimer Définitivement "${confirmDeleteAccessory.name}"`}
          description={`Attention : Cette action est irréversible (Can't undo) et écrasera définitivement la base de données. L'accessoire sera supprimé de l'inventaire central.`}
          details={`Réf: ${confirmDeleteAccessory.code} • Prix: ${formatDZD(confirmDeleteAccessory.priceDA)} • Stock restant: ${confirmDeleteAccessory.stock} ${confirmDeleteAccessory.unit}`}
          confirmLabel="Supprimer définitivement (Réécrire DB)"
          cancelLabel="Annuler"
          onConfirm={() => {
            if (confirmDeleteAccessory) {
              handleDelete(confirmDeleteAccessory.id);
            }
            setConfirmDeleteAccessory(null);
          }}
          onCancel={() => setConfirmDeleteAccessory(null)}
        />
      )}
    </div>
  );
};
