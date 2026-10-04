import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Upload,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Plus,
  Image as ImageIcon,
  Check,
  RotateCw,
  Layers,
  ShoppingBag,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  LayoutGrid,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdBanner, Product } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { uploadMediaToServer } from '../utils/api';

interface AdminAdPopupManagementProps {
  banners: AdBanner[];
  products?: Product[];
  onAddBanner: (banner: Omit<AdBanner, 'id' | 'createdAt'>) => void;
  onToggleBannerActive: (bannerId: string) => void;
  onDeleteBanner: (bannerId: string) => void;
  onPreviewBanner: (banner: AdBanner) => void;
  isPopupEnabled: boolean;
  onTogglePopupEnabled: (enabled: boolean) => void;
}

export const AdminAdPopupManagement: React.FC<AdminAdPopupManagementProps> = ({
  banners,
  products = [],
  onAddBanner,
  onToggleBannerActive,
  onDeleteBanner,
  onPreviewBanner,
  isPopupEnabled,
  onTogglePopupEnabled,
}) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [badgeText, setBadgeText] = useState('NOUVEAU');
  const [buttonText, setButtonText] = useState('Ajouter au Panier');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetProductIds, setTargetProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  // Popups Section Slide Carousel Navigation States
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'slide' | 'list'>('slide');
  const slideTouchStartX = useRef<number | null>(null);

  const safeIndex = banners.length > 0 ? Math.min(Math.max(0, slideIndex), banners.length - 1) : 0;
  const currentBanner = banners[safeIndex];

  useEffect(() => {
    if (banners.length > 0 && slideIndex >= banners.length) {
      setSlideIndex(Math.max(0, banners.length - 1));
    }
  }, [banners.length, slideIndex]);

  const handlePrevSlide = () => {
    if (banners.length <= 1) return;
    setSlideDir(-1);
    setSlideIndex((prev) => (prev <= 0 ? banners.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    if (banners.length <= 1) return;
    setSlideDir(1);
    setSlideIndex((prev) => (prev >= banners.length - 1 ? 0 : prev + 1));
  };

  const handleSlideTouchStart = (e: React.TouchEvent) => {
    slideTouchStartX.current = e.touches[0].clientX;
  };

  const handleSlideTouchEnd = (e: React.TouchEvent) => {
    if (slideTouchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = slideTouchStartX.current - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNextSlide();
      } else {
        handlePrevSlide();
      }
    }
    slideTouchStartX.current = null;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProducts = products.filter((p) => targetProductIds.includes(p.id));

  const filteredProductsForSelect = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = (productSearch || '').toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      Boolean(p.category && p.category.toLowerCase().includes(q))
    );
  });

  const handleToggleProduct = (prod: Product) => {
    setTargetProductIds((prev) => {
      const exists = prev.includes(prod.id);
      const updated = exists ? prev.filter((id) => id !== prod.id) : [...prev, prod.id];

      // Auto-fill fields if empty and we just added the first product
      if (!exists && updated.length === 1) {
        if (!title) setTitle(prod.name);
        if (!subtitle) {
          const priceText = prod.discountPercent
            ? `Offre promo à ${Math.round(prod.priceDA * (1 - prod.discountPercent / 100))} DA (au lieu de ${prod.priceDA} DA)`
            : `Tarif professionnel ${prod.priceDA} DA (${prod.unit})`;
          setSubtitle(`${prod.family === 'Extrait' ? 'Extrait pur scellé 100g' : 'Flacon'} • ${priceText}`);
        }
        if (prod.discountPercent && prod.discountPercent > 0) {
          setBadgeText(`SOLDE -${prod.discountPercent}%`);
        }
        if (prod.imageUrl && !imageUrl) {
          setImageUrl(prod.imageUrl);
        }
      } else if (updated.length > 1) {
        if (updated.length === 2 && title === prod.name) {
          setTitle(`Sélection Spéciale (${updated.length} Produits)`);
        }
      }

      return updated;
    });
  };

  const handleRemoveProduct = (productId: string) => {
    setTargetProductIds((prev) => prev.filter((id) => id !== productId));
  };

  const handleClearAllProducts = () => {
    setTargetProductIds([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).');
      return;
    }

    try {
      setIsCompressingImage(true);
      const compressed = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.70,
        mimeType: 'image/webp',
      });
      
      const uploadRes = await uploadMediaToServer(compressed, file.name);
      if (uploadRes.success && uploadRes.url) {
        setImageUrl(uploadRes.url);
      } else {
        setImageUrl(compressed);
      }
    } catch (err) {
      console.warn('Banner compression error:', err);
      setUploadError("Erreur lors de l'optimisation de l'image.");
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!title.trim()) {
      setUploadError('Veuillez renseigner au moins un titre publicitaire.');
      return;
    }

    if (!imageUrl.trim()) {
      setUploadError("Veuillez importer une image ou fournir un lien d'image valide.");
      return;
    }

    onAddBanner({
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      badgeText: badgeText.trim() || undefined,
      buttonText: buttonText.trim() || undefined,
      linkUrl: linkUrl.trim() || undefined,
      imageUrl: imageUrl.trim(),
      targetProductId: targetProductIds[0] || undefined,
      targetProductIds: targetProductIds.length > 0 ? targetProductIds : undefined,
      isActive,
    });

    setFormSuccess(true);
    setTimeout(() => setFormSuccess(false), 3000);

    // Reset form
    setTitle('');
    setSubtitle('');
    setBadgeText('NOUVEAU');
    setButtonText('Ajouter au Panier');
    setLinkUrl('');
    setImageUrl('');
    setTargetProductIds([]);
    setIsActive(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const activeBannersCount = banners.filter((b) => b.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Gestion du Popup Publicitaire & Promotions
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold">
              Multi-Sélection Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Ce popup s'ouvre à l'arrivée des clients pour présenter vos offres exclusives. Vous pouvez désormais lier <strong>plusieurs produits</strong> simultanément à une même annonce popup.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Delay Badge */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs text-slate-300 shadow-xs">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Délai anti-répétition : <strong className="text-amber-300">15 min</strong></span>
          </div>

          {/* Global Popup Enable Switch */}
          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-700 px-4 py-3 rounded-xl">
          <div className="text-right">
            <div className="text-xs font-bold text-white">Popup à l'entrée</div>
            <div className="text-[10px] text-slate-400">
              {isPopupEnabled ? 'Activé (visible aux visiteurs)' : 'Désactivé'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onTogglePopupEnabled(!isPopupEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              isPopupEnabled ? 'bg-amber-500' : 'bg-slate-750'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                isPopupEnabled ? 'left-6.5' : 'left-0.5'
              }`}
            />
          </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: ADD NEW BANNER WITH MULTI-PRODUCT SELECTION */}
        <div className="lg:col-span-5 bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              Ajouter une Nouvelle Publicité
            </h3>
            <span className="text-[11px] text-slate-400">Rotation aléatoire</span>
          </div>

          {formSuccess && (
            <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Publicité ajoutée avec succès ! Les produits liés sont actifs.</span>
            </div>
          )}

          {uploadError && (
            <div className="bg-rose-950/80 border border-rose-700 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* MULTI-PRODUCT SELECTION TOOL */}
            <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">
                      Lier des Produits du Catalogue ({targetProductIds.length})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Sélectionnez un ou plusieurs produits à mettre en avant dans ce popup
                    </span>
                  </div>
                </div>

                {targetProductIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllProducts}
                    className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Effacer tout</span>
                  </button>
                )}
              </div>

              {/* Chips of Selected Products */}
              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800/80 rounded-lg border border-slate-700 max-h-32 overflow-y-auto">
                  {selectedProducts.map((sp) => (
                    <div
                      key={sp.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-medium"
                    >
                      <span className="font-mono text-[10px] text-slate-300 font-bold">{sp.code}</span>
                      <span className="max-w-[130px] truncate">{sp.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(sp.id)}
                        className="p-0.5 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search & Select Multiple Products */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Rechercher des produits à cocher (ex: Oud, Santal, Flacon)..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-[11px] placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredProductsForSelect.slice(0, 15).map((prod) => {
                    const isSelected = targetProductIds.includes(prod.id);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => handleToggleProduct(prod)}
                        className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition text-[11px] ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500/60 text-white'
                            : 'bg-slate-800/60 hover:bg-slate-750 border-slate-750 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Checkbox indicator */}
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                              isSelected
                                ? 'bg-amber-500 border-amber-500 text-slate-950'
                                : 'border-slate-600 bg-slate-900'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          <span className="font-mono text-[10px] text-slate-400 font-semibold">{prod.code}</span>
                          <span className="font-medium truncate">{prod.name}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {prod.discountPercent && prod.discountPercent > 0 && (
                            <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-bold">
                              -{prod.discountPercent}%
                            </span>
                          )}
                          <span className="text-amber-400 font-bold">{prod.priceDA} DA</span>
                          <span className="text-[9px] text-slate-400 bg-slate-700 px-1.5 py-0.2 rounded">
                            {prod.family}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Image Upload Area */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Image Publicitaire (Téléversement ou Lien) <span className="text-rose-400">*</span>
              </label>

              {imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-600 aspect-16/9 bg-slate-950 group">
                  <img
                    src={imageUrl}
                    alt="Aperçu publicitaire"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-white transition shadow cursor-pointer"
                    title="Supprimer cette image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-medium">
                    Image publicitaire prête
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !isCompressingImage && fileInputRef.current?.click()}
                  className={`border-2 border-dashed border-slate-600 hover:border-amber-500 rounded-xl p-5 text-center cursor-pointer transition bg-slate-900/50 hover:bg-slate-900 ${isCompressingImage ? 'opacity-70 pointer-events-none' : ''}`}
                >
                  <Upload className={`w-7 h-7 mx-auto text-amber-400 mb-2 ${isCompressingImage ? 'animate-spin' : ''}`} />
                  <div className="font-semibold text-slate-200 text-xs">
                    {isCompressingImage ? 'Optimisation web en cours...' : 'Cliquez pour téléverser une affiche / bannière'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Format JPG, PNG, WEBP (compression automatique)
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Or external URL */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-slate-400 whitespace-nowrap">Ou URL externe :</span>
                <input
                  type="url"
                  value={imageUrl.startsWith('data:') ? '' : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-[11px] placeholder:text-slate-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Titre Principal de l'Annonce <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: ARRIVAGE EXCLUSIF • EXTRAITS OUD & BOIS"
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:border-amber-500"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Description / Message Promotionnel
              </label>
              <textarea
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={2}
                placeholder="Ex: Sélection de concentrés purs en flacons 100g scellés d'origine. Quantités limitées pour professionnels."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:border-amber-500"
              />
            </div>

            {/* Badge & Button Text */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Badge en coin</label>
                <input
                  type="text"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  placeholder="Ex: PACK PROMO"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Bouton d'action</label>
                <input
                  type="text"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="Ex: Ajouter la sélection"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="pt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 font-medium">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded-sm border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                />
                <span>Activer immédiatement dans la rotation</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Enregistrer la Publicité ({targetProductIds.length} produits liés)</span>
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: SLIDE SHOWCASE & LIST OF BANNERS */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-800/80 border border-slate-700 p-3.5 sm:p-4 rounded-xl flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white text-xs">Popups Publicitaires :</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                {activeBannersCount} / {banners.length} actives
              </span>
            </div>

            {/* View Mode & Quick Test */}
            <div className="flex items-center gap-2">
              {banners.length > 1 && (
                <div className="flex items-center bg-slate-900/90 rounded-lg p-0.5 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setViewMode('slide')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      viewMode === 'slide'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Afficher en mode Diaporama avec boutons animés"
                    id="admin-popups-viewmode-slide"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Diaporama</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Afficher toutes les bannières en liste"
                    id="admin-popups-viewmode-list"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Liste ({banners.length})</span>
                  </button>
                </div>
              )}

              {banners.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const active = banners.filter((b) => b.isActive);
                    if (active.length > 0) {
                      const random = active[Math.floor(Math.random() * active.length)];
                      onPreviewBanner(random);
                    } else {
                      onPreviewBanner(banners[0]);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title="Déclencher un test d'affichage aléatoire"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tester en Direct</span>
                </button>
              )}
            </div>
          </div>

          {banners.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <ImageIcon className="w-12 h-12 mx-auto text-slate-600 opacity-60" />
              <div className="text-sm font-semibold text-slate-300">Aucune publicité configurée</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Téléversez vos images publicitaires via le formulaire pour qu'elles s'affichent aux visiteurs du site.
              </p>
            </div>
          ) : (
            <>
              {/* SLIDE CAROUSEL VIEW (Default & Featured) */}
              {(viewMode === 'slide' || banners.length === 1) && currentBanner && (
                <div
                  className="relative group bg-slate-900/90 border border-amber-500/40 rounded-2xl p-3 sm:p-5 shadow-xl overflow-hidden"
                  onTouchStart={handleSlideTouchStart}
                  onTouchEnd={handleSlideTouchEnd}
                >
                  {/* ANIMATED SLIDE TO LEFT BUTTON */}
                  {banners.length > 1 && (
                    <motion.button
                      type="button"
                      onClick={handlePrevSlide}
                      whileHover={{ scale: 1.15, x: -3 }}
                      whileTap={{ scale: 0.9 }}
                      className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-950/90 hover:bg-slate-950 text-amber-400 hover:text-amber-300 border-2 border-amber-500/60 hover:border-amber-400 shadow-xl flex items-center justify-center cursor-pointer transition backdrop-blur-sm"
                      aria-label="Glisser vers la gauche (Précédente)"
                      title="Glisser vers la gauche (Popup Précédent)"
                      id="admin-popups-slide-prev"
                    >
                      <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                    </motion.button>
                  )}

                  {/* ANIMATED SLIDE TO RIGHT BUTTON */}
                  {banners.length > 1 && (
                    <motion.button
                      type="button"
                      onClick={handleNextSlide}
                      whileHover={{ scale: 1.15, x: 3 }}
                      whileTap={{ scale: 0.9 }}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-950/90 hover:bg-slate-950 text-amber-400 hover:text-amber-300 border-2 border-amber-500/60 hover:border-amber-400 shadow-xl flex items-center justify-center cursor-pointer transition backdrop-blur-sm"
                      aria-label="Glisser vers la droite (Suivante)"
                      title="Glisser vers la droite (Popup Suivant)"
                      id="admin-popups-slide-next"
                    >
                      <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </motion.button>
                  )}

                  {/* Top Slide Header with Badge & Counter */}
                  <div className="flex items-center justify-between gap-2 mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Diaporama Popups</span>
                      </span>
                      {banners.length > 1 && (
                        <span className="text-xs text-slate-400 font-semibold">
                          ({safeIndex + 1} / {banners.length})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          currentBanner.isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {currentBanner.isActive ? 'Actif dans la rotation' : 'En pause'}
                      </span>
                    </div>
                  </div>

                  {/* SLIDING CARD ANIMATION */}
                  <div className="overflow-hidden min-h-[320px] flex flex-col justify-center">
                    <AnimatePresence mode="wait" custom={slideDir}>
                      <motion.div
                        key={currentBanner.id || safeIndex}
                        custom={slideDir}
                        variants={{
                          enter: (dir: number) => ({
                            x: dir > 0 ? 80 : -80,
                            opacity: 0,
                          }),
                          center: {
                            x: 0,
                            opacity: 1,
                          },
                          exit: (dir: number) => ({
                            x: dir > 0 ? -80 : 80,
                            opacity: 0,
                          }),
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="space-y-3.5"
                      >
                        {/* Banner Image Preview Container */}
                        <div className="relative aspect-16/9 w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner group/img">
                          <img
                            src={currentBanner.imageUrl}
                            alt={currentBanner.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          {currentBanner.badgeText && (
                            <span className="absolute top-2.5 left-2.5 z-10 bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-md shadow-md border border-amber-400">
                              {currentBanner.badgeText}
                            </span>
                          )}

                          {/* Quick Live Preview Trigger Overlay on Image */}
                          <button
                            type="button"
                            onClick={() => onPreviewBanner(currentBanner)}
                            className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs backdrop-blur-xs cursor-pointer"
                          >
                            <Eye className="w-5 h-5 text-amber-400" />
                            <span>Cliquez pour tester le popup complet en direct</span>
                          </button>
                        </div>

                        {/* Banner Content Details */}
                        <div className="space-y-2 text-left">
                          <div>
                            <h4 className="text-base sm:text-lg font-bold text-white leading-snug">
                              {currentBanner.title}
                            </h4>
                            {currentBanner.subtitle && (
                              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                                {currentBanner.subtitle}
                              </p>
                            )}
                          </div>

                          {/* Target Products Tags */}
                          {(() => {
                            const linkedIds =
                              currentBanner.targetProductIds && currentBanner.targetProductIds.length > 0
                                ? currentBanner.targetProductIds
                                : currentBanner.targetProductId
                                ? [currentBanner.targetProductId]
                                : [];
                            const linkedProductsList = products.filter(
                              (p) => linkedIds.includes(p.id) || linkedIds.includes(p.code)
                            );

                            if (linkedProductsList.length === 0) return null;

                            return (
                              <div className="pt-1">
                                <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                                  <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                                  <span>
                                    Produits attachés à cette publicité ({linkedProductsList.length}) :
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                  {linkedProductsList.map((lp) => (
                                    <span
                                      key={lp.id}
                                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200 text-xs"
                                    >
                                      <span className="font-mono text-amber-400 font-bold">{lp.code}</span>
                                      <span className="truncate max-w-[140px] text-slate-300">{lp.name}</span>
                                      <span className="text-amber-300 font-semibold">{lp.priceDA} DA</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Action Toolbar */}
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onPreviewBanner(currentBanner)}
                                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md"
                                title="Ouvrir le popup exactement comme le visiteur le verra"
                              >
                                <Eye className="w-4 h-4" />
                                <span>Aperçu Visiteur Réel</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onToggleBannerActive(currentBanner.id)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                                  currentBanner.isActive
                                    ? 'bg-slate-800 hover:bg-slate-750 text-amber-300 border-slate-700'
                                    : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                                }`}
                              >
                                {currentBanner.isActive ? 'Mettre en pause' : 'Activer'}
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('Supprimer définitivement ce popup publicitaire ?')) {
                                  onDeleteBanner(currentBanner.id);
                                }
                              }}
                              className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-rose-800/40"
                              title="Supprimer cette publicité"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Supprimer</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* BOTTOM PAGINATION DOTS & SLIDE BUTTONS */}
                  {banners.length > 1 && (
                    <div className="pt-4 mt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handlePrevSlide}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        id="admin-popups-btn-prev-label"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Précédent</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {banners.map((b, idx) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setSlideDir(idx > safeIndex ? 1 : -1);
                              setSlideIndex(idx);
                            }}
                            className={`transition-all duration-300 rounded-full cursor-pointer ${
                              idx === safeIndex
                                ? 'w-7 h-2.5 bg-gradient-to-r from-amber-400 to-amber-500 shadow-sm shadow-amber-400/50'
                                : 'w-2.5 h-2.5 bg-slate-700 hover:bg-slate-500'
                            }`}
                            title={`Glisser vers popup #${idx + 1}: ${b.title}`}
                            id={`admin-popup-dot-${idx}`}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleNextSlide}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        id="admin-popups-btn-next-label"
                      >
                        <span>Suivant</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* DETAILED LIST VIEW (When in list mode or for quick access) */}
              {viewMode === 'list' && banners.length > 1 && (
                <div className="space-y-3">
                  {banners.map((banner, bIdx) => {
                    const linkedIds =
                      banner.targetProductIds && banner.targetProductIds.length > 0
                        ? banner.targetProductIds
                        : banner.targetProductId
                        ? [banner.targetProductId]
                        : [];
                    const linkedProductsList = products.filter(
                      (p) => linkedIds.includes(p.id) || linkedIds.includes(p.code)
                    );

                    return (
                      <div
                        key={banner.id}
                        className={`bg-slate-800 border rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 transition shadow-xs ${
                          banner.isActive
                            ? 'border-slate-700 hover:border-amber-500/50'
                            : 'border-slate-800 opacity-60 bg-slate-850'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-full sm:w-36 h-24 rounded-xl overflow-hidden bg-slate-950 shrink-0 relative border border-slate-700">
                          <img
                            src={banner.imageUrl}
                            alt={banner.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          {banner.badgeText && (
                            <span className="absolute top-1.5 left-1.5 bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-md">
                              {banner.badgeText}
                            </span>
                          )}
                        </div>

                        {/* Content details */}
                        <div className="flex-1 min-w-0 space-y-1 text-left w-full">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-white text-xs sm:text-sm truncate">
                              {banner.title}
                            </h4>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                banner.isActive
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-700 text-slate-400'
                              }`}
                            >
                              {banner.isActive ? 'Actif' : 'En pause'}
                            </span>
                          </div>

                          {banner.subtitle && (
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                              {banner.subtitle}
                            </p>
                          )}

                          {/* Display linked products badges */}
                          {linkedProductsList.length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-1">
                              {linkedProductsList.map((lp) => (
                                <span
                                  key={lp.id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-semibold"
                                >
                                  <ShoppingBag className="w-2.5 h-2.5" />
                                  <span>
                                    {lp.code} ({lp.name})
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="text-[10px] text-slate-500 pt-1 flex items-center gap-3">
                            <span>
                              Bouton :{' '}
                              <strong className="text-slate-300">
                                {banner.buttonText || 'Ajouter'}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>Créé le {new Date(banner.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex sm:flex-col items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-750">
                          <button
                            type="button"
                            onClick={() => {
                              setSlideIndex(bIdx);
                              setViewMode('slide');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-amber-500/30"
                            title="Afficher dans le diaporama interactif"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Diaporama</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onPreviewBanner(banner)}
                            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-650 text-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Aperçu du popup complet"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-400" />
                            <span>Aperçu</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onToggleBannerActive(banner.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                              banner.isActive
                                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                            }`}
                            title={banner.isActive ? 'Mettre en pause' : 'Réactiver'}
                          >
                            {banner.isActive ? 'Suspendre' : 'Activer'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Voulez-vous supprimer cette bannière publicitaire ?')) {
                                onDeleteBanner(banner.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900 text-rose-400 transition cursor-pointer"
                            title="Supprimer la bannière"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
