import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Layers,
  Sparkles,
  Edit3,
  Search,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import { Product, ProductFamily, StoreSettings } from '../types';
import {
  parseInventoryFile,
  downloadSampleExcelTemplate,
  exportCatalogToExcel,
} from '../utils/excelParser';
import { formatDZD } from '../utils/pdfGenerator';
import { syncExtraitImagesFromBlob } from '../utils/api';

interface ExcelSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  storeSettings?: StoreSettings;
  onApplyInventory: (newProducts: Product[]) => void;
  onUpdateSingleStock: (productId: string, newStock: number, newPriceDA?: number) => void;
}

export const ExcelSyncModal: React.FC<ExcelSyncModalProps> = ({
  isOpen,
  onClose,
  products,
  storeSettings,
  onApplyInventory,
  onUpdateSingleStock,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<Product[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge');
  const [applySuccess, setApplySuccess] = useState(false);
  const [blobNotice, setBlobNotice] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState('');
  const [editedStockMap, setEditedStockMap] = useState<Record<string, number>>({});
  const [editedPriceMap, setEditedPriceMap] = useState<Record<string, number>>({});
  const [savedRowId, setSavedRowId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFileProcess(e.target.files[0]);
    }
  };

  const handleFileProcess = async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    setApplySuccess(false);

    try {
      const result = await parseInventoryFile(file);
      setParsedProducts(result.products);
      setParseErrors(result.errors);
    } catch (err) {
      setParseErrors([`Erreur lors du traitement: ${err instanceof Error ? err.message : String(err)}`]);
      setParsedProducts([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedProducts.length === 0) return;

    setIsProcessing(true);
    setBlobNotice(null);

    // All Excel imported lines become Extraits (raw fragrance concentrates sold by gram)
    let newExtraits: Product[] = parsedProducts.map((p) => {
      const existing = products.find((ex) => ex.code === p.code && ex.family === 'Extrait');
      return {
        ...p,
        family: 'Extrait' as const,
        unit: p.unit || '1g (Contenant 100g)',
        imageUrl: existing?.imageUrl || p.imageUrl || '/tulip-extrait-default.jpg',
        lastUpdated: new Date().toISOString(),
      };
    });

    // Auto-associate with Vercel Blob folder images (e.g. P115 -> P115.jpg)
    try {
      const folderName = storeSettings?.vercelBlobFolderName || 'extraits';
      const blobRes = await syncExtraitImagesFromBlob({
        products: newExtraits,
        folderName,
        saveToDatabase: false,
      });
      if (blobRes.success && blobRes.products) {
        newExtraits = blobRes.products.filter((p) => p.family === 'Extrait');
        if (blobRes.matchedCount > 0) {
          setBlobNotice(
            `✨ ${blobRes.matchedCount} extrait(s) ont été associés automatiquement à leurs images Vercel Blob (dossier "${blobRes.folderName}") !`
          );
        }
      }
    } catch (e) {
      console.warn('[ExcelSyncModal] Vercel Blob auto-association note:', e);
    } finally {
      setIsProcessing(false);
    }

    // Keep all manually managed Flacons and Accessories completely untouched
    const existingFlacons = products.filter((p) => p.family === 'Flacon');
    const existingAccessories = products.filter((p) => p.family === 'Accessoire');

    // Erase all old Extraits and replace them with the newly imported ones
    const updatedInventory: Product[] = [...existingFlacons, ...existingAccessories, ...newExtraits];

    onApplyInventory(updatedInventory);
    setApplySuccess(true);
    setTimeout(() => {
      setApplySuccess(false);
      onClose();
    }, 1800);
  };

  const filteredManualProducts = products.filter(
    (p) =>
      (p.name || '').toLowerCase().includes((manualSearch || '').toLowerCase()) ||
      (p.code || '').toLowerCase().includes((manualSearch || '').toLowerCase()) ||
      (p.family || '').toLowerCase().includes((manualSearch || '').toLowerCase())
  );

  const handleSaveManualRow = (product: Product) => {
    const newStock = editedStockMap[product.id] !== undefined ? editedStockMap[product.id] : product.stock;
    const newPrice = editedPriceMap[product.id] !== undefined ? editedPriceMap[product.id] : product.priceDA;

    onUpdateSingleStock(product.id, newStock, newPrice);
    setSavedRowId(product.id);
    setTimeout(() => setSavedRowId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                Synchronisation du Stock via Fichier Excel
              </h3>
              <p className="text-xs text-slate-400">
                Mettez à jour instantanément les stocks & prix exportés de votre logiciel de caisse
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Importer Fichier Excel (.xlsx / .csv)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'manual'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            Ajustement Rapide au Magasin ({products.length} articles)
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'upload' ? (
            <>
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/70'
                    : 'border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 shadow-inner">
                  {isProcessing ? (
                    <RefreshCw className="w-7 h-7 animate-spin" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>

                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  Glissez-déposez l'export Excel de votre logiciel de caisse
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mb-3">
                  Compatible avec les formats <strong className="text-slate-700">.XLSX</strong>,{' '}
                  <strong className="text-slate-700">.XLS</strong> et <strong className="text-slate-700">.CSV</strong>
                </p>

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-xs">
                  <span>Sélectionner un fichier sur votre ordinateur</span>
                </div>
              </div>

              {/* Template and Export Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-900 block">Besoin d'un format modèle ?</span>
                  Colonnes reconnues automatiquement : Code, Désignation, Famille, Prix DA, Stock.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadSampleExcelTemplate}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-300 transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    Télécharger Modèle Excel
                  </button>

                  <button
                    type="button"
                    onClick={() => exportCatalogToExcel(products)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                    Exporter Stock Actuel
                  </button>
                </div>
              </div>

              {/* Vercel Blob Extraits Images Integration info banner */}
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start sm:items-center justify-between gap-3 text-xs text-sky-950">
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-sky-900 block">
                      Association Photos Vercel Blob Automatique
                    </span>
                    <span className="text-slate-600">
                      Les extraits importés seront reliés à leur photo dans votre dossier Vercel Blob{' '}
                      <code className="bg-sky-100 px-1.5 py-0.5 rounded font-mono font-bold text-sky-900">
                        {storeSettings?.vercelBlobFolderName || 'extraits'}/
                      </code>{' '}
                      selon leur référence (ex : <code className="bg-sky-100 px-1 py-0.5 rounded font-mono text-sky-900">P115.jpg</code>, <code className="bg-sky-100 px-1 py-0.5 rounded font-mono text-sky-900">P115.png</code>).
                    </span>
                  </div>
                </div>
              </div>

              {blobNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-800 font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{blobNotice}</span>
                </div>
              )}

              {/* Parse Results Preview */}
              {parsedProducts.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        Aperçu des données détectées ({parsedProducts.length} articles) :
                      </span>
                      {fileName && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {fileName}
                        </span>
                      )}
                    </div>

                    {/* Import strategy selector */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Mode :</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          value="merge"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                        />
                        <span>Mettre à jour & fusionner</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer ml-2">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                        />
                        <span className="text-rose-700 font-medium">Remplacer tout</span>
                      </label>
                    </div>
                  </div>

                  {/* Summary badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-[11px] text-amber-800 block">Extraits</span>
                      <strong className="text-base text-amber-950">
                        {parsedProducts.filter((p) => p.family === 'Extrait').length}
                      </strong>
                    </div>
                    <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-200">
                      <span className="text-[11px] text-indigo-800 block">Flacons</span>
                      <strong className="text-base text-indigo-950">
                        {parsedProducts.filter((p) => p.family === 'Flacon').length}
                      </strong>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                      <span className="text-[11px] text-emerald-800 block">En stock (&gt;0)</span>
                      <strong className="text-base text-emerald-950">
                        {parsedProducts.filter((p) => p.stock > 0).length}
                      </strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-600 block">Valeur Stock</span>
                      <strong className="text-xs text-slate-900 block truncate">
                        {formatDZD(parsedProducts.reduce((s, p) => s + p.priceDA * p.stock, 0))}
                      </strong>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider sticky top-0">
                        <tr>
                          <th className="p-2">Réf.</th>
                          <th className="p-2">Désignation</th>
                          <th className="p-2">Famille</th>
                          <th className="p-2 text-right">Prix DA</th>
                          <th className="p-2 text-right">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {parsedProducts.slice(0, 15).map((prod) => (
                          <tr key={prod.id} className="hover:bg-slate-50">
                            <td className="p-2 font-mono text-slate-600">{prod.code}</td>
                            <td className="p-2 font-medium text-slate-900 max-w-[200px] truncate">
                              {prod.name}
                            </td>
                            <td className="p-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  prod.family === 'Extrait'
                                    ? 'bg-amber-100 text-amber-900'
                                    : prod.family === 'Accessoire'
                                    ? 'bg-teal-100 text-teal-900'
                                    : 'bg-indigo-100 text-indigo-900'
                                }`}
                              >
                                {prod.family}
                              </span>
                            </td>
                            <td className="p-2 text-right font-semibold text-slate-800">
                              {formatDZD(prod.priceDA)}
                            </td>
                            <td className="p-2 text-right">
                              <span
                                className={`font-bold ${
                                  prod.stock > 0 ? 'text-emerald-700' : 'text-rose-600'
                                }`}
                              >
                                {prod.stock} {prod.unit}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {parsedProducts.length > 15 && (
                    <p className="text-[11px] text-slate-500 text-center italic">
                      + {parsedProducts.length - 15} autres articles inclus dans l'import
                    </p>
                  )}

                  {parseErrors.length > 0 && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Remarques lors de la lecture :
                      </div>
                      <ul className="list-disc list-inside text-[11px] space-y-0.5">
                        {parseErrors.slice(0, 3).map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Manual Stock Adjustments Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    placeholder="Rechercher par référence ou désignation..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-xs text-slate-500">
                  {filteredManualProducts.length} articles
                </span>
              </div>

              <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2.5">Article</th>
                      <th className="p-2.5">Famille</th>
                      <th className="p-2.5 text-center">Stock Actuel</th>
                      <th className="p-2.5 text-center">Stock (g / unités)</th>
                      <th className="p-2.5 text-center">Prix DA (/ 1g ou u)</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredManualProducts.map((p) => {
                      const isExtrait = p.family === 'Extrait';
                      const currentStockVal =
                        editedStockMap[p.id] !== undefined ? editedStockMap[p.id] : p.stock;
                      const currentPriceVal =
                        editedPriceMap[p.id] !== undefined ? editedPriceMap[p.id] : p.priceDA;
                      const isSaved = savedRowId === p.id;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900">{p.name}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {p.code} • {isExtrait ? '1g (Contenant 100g)' : p.unit}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isExtrait
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-indigo-100 text-indigo-900'
                              }`}
                            >
                              {p.family}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                value={currentStockVal}
                                onChange={(e) =>
                                  setEditedStockMap((prev) => ({
                                    ...prev,
                                    [p.id]: Math.max(0, parseInt(e.target.value) || 0),
                                  }))
                                }
                                className="w-20 px-2 py-1 text-center font-bold border border-slate-300 rounded bg-white text-slate-900 focus:ring-1 focus:ring-emerald-500"
                              />
                              <span className="text-[10px] text-slate-500">{isExtrait ? 'g' : 'u'}</span>
                            </div>
                            {isExtrait && (
                              <div className="text-[10px] text-amber-800">
                                ~ {Math.floor(currentStockVal / 100)} flacons de 100g
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step={isExtrait ? '1' : '50'}
                                value={currentPriceVal}
                                onChange={(e) =>
                                  setEditedPriceMap((prev) => ({
                                    ...prev,
                                    [p.id]: Math.max(0, parseInt(e.target.value) || 0),
                                  }))
                                }
                                className="w-24 px-2 py-1 text-center font-bold border border-slate-300 rounded bg-white text-slate-900 focus:ring-1 focus:ring-emerald-500"
                              />
                              <span className="text-[10px] text-slate-500">{isExtrait ? 'DA/g' : 'DA'}</span>
                            </div>
                            {isExtrait && (
                              <div className="text-[10px] text-slate-500 font-medium">
                                {formatDZD(currentPriceVal * 100)} / 100g
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleSaveManualRow(p)}
                              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 ml-auto ${
                                isSaved
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-900 hover:bg-slate-800 text-white'
                              }`}
                            >
                              {isSaved ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  Sauvegardé
                                </>
                              ) : (
                                'Enregistrer'
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {applySuccess ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Stocks synchronisés avec succès sur le site !
              </span>
            ) : (
              <span>Les modifications seront visibles immédiatement par vos clients.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
            >
              Fermer
            </button>

            {activeTab === 'upload' && parsedProducts.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isProcessing}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Appliquer {parsedProducts.length} Articles au Site</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
