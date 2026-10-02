import * as XLSX from 'xlsx';
import { Product, ProductFamily } from '../types';

export interface ParseResult {
  success: boolean;
  products: Product[];
  errors: string[];
  totalRows: number;
}

// Clean string helper
const cleanStr = (val: unknown): string => {
  if (val === undefined || val === null) return '';
  return String(val).trim();
};

// Normalize column key for flexible matching
const normalizeKey = (key: string): string => {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, ''); // alphanumeric only
};

// Detect family from family field or product title
export const detectFamily = (familyInput: string, nameInput: string): ProductFamily => {
  const normFam = familyInput.toLowerCase();
  const normName = nameInput.toLowerCase();

  if (
    normFam.includes('accessoire') ||
    normFam.includes('outil') ||
    normFam.includes('pince') ||
    normFam.includes('sertiss') ||
    normFam.includes('mouillette') ||
    normFam.includes('pipette') ||
    normFam.includes('entonnoir')
  ) {
    return 'Accessoire';
  }
  if (normFam.includes('extrait') || normFam.includes('huile') || normFam.includes('parfum') || normFam.includes('essence') || normFam.includes('concentre')) {
    return 'Extrait';
  }
  if (normFam.includes('flacon') || normFam.includes('bouteille') || normFam.includes('spray') || normFam.includes('roll') || normFam.includes('emballage') || normFam.includes('verre') || normFam.includes('pompe')) {
    return 'Flacon';
  }

  // Fallback to name inspection
  if (
    normName.includes('pince') ||
    normName.includes('sertiss') ||
    normName.includes('pipette') ||
    normName.includes('mouillette') ||
    normName.includes('entonnoir') ||
    normName.includes('accessoire')
  ) {
    return 'Accessoire';
  }
  if (normName.includes('extrait') || normName.includes('concentr') || normName.includes('huile') || normName.includes('musc') || normName.includes('oud') || normName.includes('rose') || normName.includes('ambre')) {
    return 'Extrait';
  }
  return 'Flacon';
};

// Parse file (XLSX, XLS, CSV)
export const parseInventoryFile = async (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve({ success: false, products: [], errors: ['Fichier vide ou illisible.'], totalRows: 0 });
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Parse to JSON rows
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          resolve({ success: false, products: [], errors: ['Aucune donnée trouvée dans la première feuille du fichier.'], totalRows: 0 });
          return;
        }

        const products: Product[] = [];
        const errors: string[] = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2; // account for header line

          // Find values by scanning normalized keys
          let code = '';
          let name = '';
          let familyRaw = '';
          let price = 0;
          let discountPercent = 0;
          let stock = 0;
          let unit = 'Unité';
          let description = '';
          let origin = 'Algérie';

          for (const [rawKey, rawVal] of Object.entries(row)) {
            const key = normalizeKey(rawKey);
            const valStr = cleanStr(rawVal);

            // Match Solde % / Promotion / Remise %
            if (discountPercent === 0 && (key.includes('solde') || key.includes('remise') || key.includes('promo') || key.includes('discount') || key.includes('rabais'))) {
              const cleanedDiscount = String(rawVal).replace(/[^0-9.,]/g, '').replace(',', '.');
              const parsedDiscount = parseFloat(cleanedDiscount) || 0;
              if (parsedDiscount > 0 && parsedDiscount < 100) {
                discountPercent = Math.round(parsedDiscount);
              }
            }
            // Match Reference / Code
            else if (!code && (key.includes('code') || key.includes('ref') || key.includes('sku') || key.includes('articleid'))) {
              code = valStr;
            }
            // Match Name / Designation
            else if (!name && (key.includes('nom') || key.includes('designation') || key.includes('libelle') || key.includes('article') || key.includes('produit') || key === 'name' || key === 'title')) {
              name = valStr;
            }
            // Match Family / Category
            else if (!familyRaw && (key.includes('famille') || key.includes('categorie') || key.includes('type') || key.includes('family') || key.includes('group'))) {
              familyRaw = valStr;
            }
            // Match Price in DA
            else if (price === 0 && (key.includes('prix') || key.includes('tarif') || key.includes('price') || key === 'pu' || key === 'da' || key === 'dzd')) {
              const cleanedPrice = String(rawVal).replace(/[^0-9.,]/g, '').replace(',', '.');
              price = parseFloat(cleanedPrice) || 0;
            }
            // Match Stock / Quantity (DO NOT include 'solde' here!)
            else if (stock === 0 && (key.includes('stock') || key.includes('quantite') || key.includes('qte') || key.includes('dispo') || key === 'qty' || key === 'quantitedispo')) {
              const cleanedStock = String(rawVal).replace(/[^0-9.,-]/g, '').replace(',', '.');
              stock = Math.max(0, Math.floor(parseFloat(cleanedStock) || 0));
            }
            // Match Unit / Contenance
            else if (unit === 'Unité' && (key.includes('unite') || key.includes('volume') || key.includes('contenance') || key.includes('format') || key.includes('condit'))) {
              if (valStr) unit = valStr;
            }
            // Match Description
            else if (!description && (key.includes('desc') || key.includes('detail') || key.includes('note') || key.includes('remarque'))) {
              description = valStr;
            }
            // Match Origin
            else if (origin === 'Algérie' && (key.includes('origine') || key.includes('provenance') || key.includes('pays'))) {
              if (valStr) origin = valStr;
            }
          }

          // Fallback if code or name is missing
          if (!name && row['Désignation']) name = cleanStr(row['Désignation']);
          if (!name && row['Designation']) name = cleanStr(row['Designation']);
          if (!name && row['Nom']) name = cleanStr(row['Nom']);
          if (!code && row['Code']) code = cleanStr(row['Code']);
          if (!code && row['Reference']) code = cleanStr(row['Reference']);

          if (!name) {
            errors.push(`Ligne ${rowNum} ignorée : Nom ou Désignation manquante.`);
            return;
          }

          const family = detectFamily(familyRaw, name);
          const generatedId = code ? `prod-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : `prod-${Date.now()}-${index}`;

          // Default placeholder images matching family
          const defaultImage = family === 'Extrait'
            ? '/tulip-extrait-default.jpg'
            : family === 'Accessoire'
            ? 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600&auto=format&fit=crop&q=80';

          products.push({
            id: generatedId,
            code: code || `ART-${(index + 1).toString().padStart(3, '0')}`,
            name,
            family,
            category: familyRaw || (family === 'Extrait' ? 'Concentrés de Parfum' : family === 'Accessoire' ? 'Accessoires & Outils' : 'Conditionnement'),
            unit: unit !== 'Unité' ? unit : (family === 'Extrait' ? '1g (Contenant 100g)' : family === 'Accessoire' ? '1 pièce' : 'Carton'),
            containerSizeG: family === 'Extrait' ? 100 : undefined,
            priceDA: Number(price.toFixed(2)),
            discountPercent: discountPercent > 0 ? discountPercent : undefined,
            stock,
            minAlertStock: family === 'Extrait' ? 500 : 5,
            description: description || `Matière première qualité professionnelle pour l'industrie du parfum et cosmétique.`,
            origin: origin || 'Import / Local',
            imageUrl: defaultImage,
            lastUpdated: new Date().toISOString(),
          });
        });

        resolve({
          success: products.length > 0,
          products,
          errors,
          totalRows: rawRows.length,
        });
      } catch (err) {
        resolve({
          success: false,
          products: [],
          errors: [`Erreur de lecture du fichier Excel: ${err instanceof Error ? err.message : String(err)}`],
          totalRows: 0,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        products: [],
        errors: ['Erreur lors de la lecture du fichier.'],
        totalRows: 0,
      });
    };

    reader.readAsBinaryString(file);
  });
};

// Generate sample downloadable template
export const downloadSampleExcelTemplate = () => {
  const sampleData = [
    {
      'Code Article': 'EXT-OUD-100G',
      'Désignation / Nom': 'Extrait Oud Royal Pur (Contenant 100g)',
      'Famille (Extrait ou Flacon)': 'Extrait',
      'Contenance / Unité': '1g (Contenant 100g)',
      'Prix Unitaire (DA)': 145, // 145 DA par gramme (soit 14 500 DA le flacon de 100g)
      'Solde %': 15, // 15% de remise promotionnelle
      'Stock Disponible': 3000, // 3 000 grammes (30 flacons de 100g)
      'Origine': 'Grasse (France)',
      'Description': 'Concentré de parfum 100% pur, vendu au gramme (flacon scellé de 100g).',
    },
    {
      'Code Article': 'EXT-MUSC-100G',
      'Désignation / Nom': 'Extrait Musc Blanc Tahara (Contenant 100g)',
      'Famille (Extrait ou Flacon)': 'Extrait',
      'Contenance / Unité': '1g (Contenant 100g)',
      'Prix Unitaire (DA)': 220, // 220 DA par gramme (soit 22 000 DA le flacon de 100g)
      'Solde %': 0, // Pas de solde
      'Stock Disponible': 1500, // 1 500 grammes (15 flacons de 100g)
      'Origine': 'Émirats',
      'Description': 'Musc blanc crémeux haute rémanence, conditionnement d\'origine 100g.',
    },
    {
      'Code Article': 'EXT-ROSE-DAMAS',
      'Désignation / Nom': 'Extrait Rose de Damas Absolue (Contenant 100g)',
      'Famille (Extrait ou Flacon)': 'Extrait',
      'Contenance / Unité': '1g (Contenant 100g)',
      'Prix Unitaire (DA)': 180,
      'Solde %': 10, // 10% de remise
      'Stock Disponible': 2000,
      'Origine': 'Bulgarie',
      'Description': 'Notes florales intenses et pures pour compositions luxueuses.',
    },
    {
      'Code Article': 'EXT-AMBRE-GOLD',
      'Désignation / Nom': 'Extrait Ambre Doré Oriental (Contenant 100g)',
      'Famille (Extrait ou Flacon)': 'Extrait',
      'Contenance / Unité': '1g (Contenant 100g)',
      'Prix Unitaire (DA)': 130,
      'Solde %': 0,
      'Stock Disponible': 4500,
      'Origine': 'Espagne',
      'Description': 'Ambre chaud longue tenue pour parfums orientaux.',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  // Auto column widths
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 42 },
    { wch: 26 },
    { wch: 20 },
    { wch: 18 },
    { wch: 12 }, // Solde %
    { wch: 18 },
    { wch: 18 },
    { wch: 45 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventaire_Extraits');
  XLSX.writeFile(workbook, 'Modele_Inventaire_Extraits_Tulip.xlsx');
};

// Export current active catalog to Excel
export const exportCatalogToExcel = (products: Product[]) => {
  const data = products.map((p) => ({
    'Code Article': p.code,
    'Désignation': p.name,
    'Famille': p.family,
    'Catégorie': p.category || '',
    'Unité / Contenance': p.family === 'Extrait' ? '1g (Contenant 100g)' : p.unit,
    'Prix Unitaire (DA)': p.family === 'Extrait' ? `${p.priceDA} DA / 1g` : `${p.priceDA} DA`,
    'Solde %': p.discountPercent ? `${p.discountPercent}%` : '0%',
    'Prix après Solde (DA)': p.discountPercent ? `${Number((p.priceDA * (1 - p.discountPercent / 100)).toFixed(2))} DA` : '-',
    'Stock Disponible': p.family === 'Extrait' ? `${p.stock} g` : p.stock,
    'Équivalent Flacons (si Extrait)': p.family === 'Extrait' ? `${Math.floor(p.stock / 100)} flacons de 100g` : '-',
    'Statut': p.stock > 0 ? (p.stock < (p.minAlertStock || 5) ? 'Stock Faible' : 'En Stock') : 'Épuisé',
    'Origine': p.origin || '',
    'Dernière Mise à Jour': p.lastUpdated ? new Date(p.lastUpdated).toLocaleDateString('fr-DZ') : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 38 },
    { wch: 12 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 },
    { wch: 26 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock_Actuel');
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Inventaire_Stock_Matières_Premières_${dateStr}.xlsx`);
};
