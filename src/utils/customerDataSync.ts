import * as XLSX from 'xlsx';
import { CustomerUser } from '../types';
import { ALGERIAN_WILAYAS } from '../data/wilayas';

export interface CustomerImportResult {
  success: boolean;
  importedCustomers: CustomerUser[];
  errors: string[];
  totalRows: number;
}

const cleanVal = (val: unknown): string => {
  if (val === undefined || val === null) return '';
  return String(val).trim();
};

const normalizeKey = (key: string): string => {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

// Intelligent multilingual and fuzzy column extractor
const extractRowField = (row: Record<string, any>, candidates: string[]): string => {
  // 1. Direct match on raw keys (preserves non-latin like Arabic)
  for (const rawKey of Object.keys(row)) {
    const trimmed = rawKey.trim().toLowerCase();
    for (const c of candidates) {
      if (trimmed === c.toLowerCase()) {
        const val = cleanVal(row[rawKey]);
        if (val) return val;
      }
    }
  }

  // 2. Substring inclusion on raw keys (e.g. 'mot de passe client' includes 'mot de passe')
  for (const rawKey of Object.keys(row)) {
    const trimmed = rawKey.trim().toLowerCase();
    for (const c of candidates) {
      if (trimmed.includes(c.toLowerCase())) {
        const val = cleanVal(row[rawKey]);
        if (val) return val;
      }
    }
  }

  // 3. Normalized alphanumeric matching
  const normMap: Record<string, string> = {};
  for (const rawKey of Object.keys(row)) {
    const norm = normalizeKey(rawKey);
    if (norm) normMap[norm] = rawKey;
  }

  for (const c of candidates) {
    const normC = normalizeKey(c);
    if (normC) {
      if (normMap[normC]) {
        const val = cleanVal(row[normMap[normC]]);
        if (val) return val;
      }
      // Substring check on normalized
      for (const [normKey, originalKey] of Object.entries(normMap)) {
        if (normKey.includes(normC)) {
          const val = cleanVal(row[originalKey]);
          if (val) return val;
        }
      }
    }
  }

  return '';
};

// Generates a unique, distinct and memorable password per customer when not provided in file
const generateUniqueCustomerPassword = (username: string, phone: string, index: number): string => {
  const cleanPhone = phone.replace(/\D/g, '');
  const phoneSuffix = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : `${1000 + ((index * 137 + 41) % 8900)}`;
  const cleanPrefix = username.replace(/[^a-zA-Z]/g, '').slice(0, 4) || 'tlp';
  const capitalized = cleanPrefix.charAt(0).toUpperCase() + cleanPrefix.slice(1).toLowerCase();
  return `${capitalized}@${phoneSuffix}`;
};

/**
 * Export customers data to Excel (.xlsx)
 * Includes all customer data: username, password, fullName, company, email, phone, wilaya, address, status, etc.
 */
export const exportCustomersToExcel = (customers: CustomerUser[]): void => {
  const exportRows = customers.map((c, index) => ({
    'N°': index + 1,
    'Identifiant (Username)': c.username || '',
    'Mot de Passe (Password)': c.password || '',
    'Nom Complet (Full Name)': c.fullName || '',
    'Entreprise / Parfumerie': c.companyName || '',
    'Email': c.email || '',
    'Téléphone (Phone)': c.phone || '',
    'Téléphone Secondaire': c.secondaryPhone || '',
    'Code Wilaya': c.wilayaCode || '',
    'Nom Wilaya': c.wilayaName || '',
    'Commune': c.commune || '',
    'Adresse de Livraison': c.deliveryAddress || '',
    'Statut du Compte': c.status || 'approved',
    'Date de Création': c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '',
    'Dernière Connexion': c.lastLogin ? new Date(c.lastLogin).toLocaleDateString('fr-FR') : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  // Auto column widths
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 18 },
    { wch: 26 },
    { wch: 24 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 30 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients Tulip');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `tulip_export_clients_${dateStr}.xlsx`);
};

/**
 * Export customers to JSON backup file
 */
export const exportCustomersToJSON = (customers: CustomerUser[]): void => {
  const jsonStr = JSON.stringify(customers, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `tulip_sauvegarde_clients_${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Download sample customer template for Excel import
 */
export const downloadCustomerImportTemplate = (): void => {
  const sampleData = [
    {
      'Identifiant (Username)': 'parfumerie_oran',
      'Mot de Passe (Password)': 'tulip2026',
      'Nom Complet (Full Name)': 'Karim Benali',
      'Entreprise / Parfumerie': 'Élixir d’Oran',
      'Email': 'karim.oran@gmail.com',
      'Téléphone (Phone)': '0550123456',
      'Téléphone Secondaire': '0770987654',
      'Code Wilaya': '31',
      'Nom Wilaya': 'Oran',
      'Commune': 'Es Senia',
      'Adresse de Livraison': 'Boulevard Front de Mer, N°12',
      'Statut du Compte': 'approved',
    },
    {
      'Identifiant (Username)': 'alger_fragrance',
      'Mot de Passe (Password)': 'alger789',
      'Nom Complet (Full Name)': 'Sofiane Meziane',
      'Entreprise / Parfumerie': 'Atelier Algiers Scent',
      'Email': 'sofiane.alger@outlook.com',
      'Téléphone (Phone)': '0661234567',
      'Téléphone Secondaire': '',
      'Code Wilaya': '16',
      'Nom Wilaya': 'Alger',
      'Commune': 'Hydra',
      'Adresse de Livraison': 'Rue Djenane El Malik, Villa 4',
      'Statut du Compte': 'approved',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 24 },
    { wch: 24 },
    { wch: 26 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 30 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modele_Clients');
  XLSX.writeFile(wb, 'tulip_modele_import_clients.xlsx');
};

/**
 * Parse uploaded file (Excel, CSV, or JSON) into CustomerUser objects
 */
export const parseCustomerImportFile = async (file: File): Promise<CustomerImportResult> => {
  return new Promise((resolve) => {
    // 1. JSON file handling
    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            resolve({
              success: false,
              importedCustomers: [],
              errors: ['Le fichier JSON doit contenir un tableau de clients valides.'],
              totalRows: 0,
            });
            return;
          }

          const validCustomers: CustomerUser[] = parsed
            .filter((item) => item && (item.username || item.fullName || item.phone || item.nom || item.name))
            .map((item, idx) => {
              const uName = cleanVal(item.username || item.user || item.login || item.identifiant).toLowerCase() ||
                cleanVal(item.fullName || item.name || item.nom).replace(/\s+/g, '_').toLowerCase() ||
                `client_${idx + 1}`;
              const phone = cleanVal(item.phone || item.telephone || item.tel || item.mobile) || '0550000000';

              // Multilingual password extraction from JSON
              const providedPass = cleanVal(
                item.password ||
                item.pass ||
                item.mdp ||
                item.motDePasse ||
                item.mot_de_passe ||
                item.pwd ||
                item.psw ||
                item.code ||
                item['mot de passe'] ||
                item['Mot de passe'] ||
                item['كلمة المرور'] ||
                item['كلمة السر'] ||
                item['الرمز السري']
              );

              const individualPassword = providedPass || generateUniqueCustomerPassword(uName, phone, idx);

              return {
                id: item.id || `cust-imported-${Date.now()}-${idx}`,
                username: uName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, ''),
                password: individualPassword,
                fullName: cleanVal(item.fullName || item.name || item.nom || 'Client Tulip'),
                companyName: cleanVal(item.companyName || item.company || item.entreprise || item.parfumerie) || undefined,
                email: cleanVal(item.email || item.mail) || `${uName}@tulip-client.dz`,
                phone: phone,
                secondaryPhone: cleanVal(item.secondaryPhone || item.telephoneSecondaire || item.phone2) || undefined,
                wilayaCode: cleanVal(item.wilayaCode || item.codeWilaya) || '16',
                wilayaName: cleanVal(item.wilayaName || item.nomWilaya) || 'Alger',
                commune: cleanVal(item.commune || item.ville) || 'Alger',
                deliveryAddress: cleanVal(item.deliveryAddress || item.adresse || item.address) || 'Alger',
                status: (['pending', 'approved', 'rejected', 'suspended'].includes(item.status) ? item.status : 'approved') as CustomerUser['status'],
                createdAt: item.createdAt || new Date().toISOString(),
                lastLogin: item.lastLogin,
              };
            });

          resolve({
            success: validCustomers.length > 0,
            importedCustomers: validCustomers,
            errors: validCustomers.length === 0 ? ['Aucun compte client exploitable trouvé dans le fichier JSON.'] : [],
            totalRows: parsed.length,
          });
        } catch (err: any) {
          resolve({
            success: false,
            importedCustomers: [],
            errors: [`Erreur de lecture JSON : ${err.message || 'Format invalide'}`],
            totalRows: 0,
          });
        }
      };
      reader.readAsText(file);
      return;
    }

    // 2. Excel / CSV file handling via XLSX
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve({
            success: false,
            importedCustomers: [],
            errors: ['Fichier vide ou illisible.'],
            totalRows: 0,
          });
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          resolve({
            success: false,
            importedCustomers: [],
            errors: ['La feuille Excel est vide ou ne contient aucune ligne de données.'],
            totalRows: 0,
          });
          return;
        }

        const importedList: CustomerUser[] = [];
        const errors: string[] = [];

        rawJson.forEach((row, index) => {
          const rowNum = index + 2; // header is row 1

          // Flexible field detection using extractRowField with full multilingual synonyms
          const username = extractRowField(row, [
            'identifiant (username)', 'identifiant', 'username', 'user', 'login', 'compte', 'nom d\'utilisateur', 'اسم المستخدم'
          ]);

          const password = extractRowField(row, [
            'mot de passe (password)', 'mot de passe', 'motdepasse', 'mot_de_passe',
            'password', 'pass', 'mdp', 'pwd', 'psw', 'code secret', 'codesecret',
            'code acces', 'codeacces', 'secret', 'code', 'pin',
            'كلمة المرور', 'كلمة السر', 'الرمز السري', 'رمز المرور', 'الرقم السري', 'باسورد', 'باسوورد'
          ]);

          const fullName = extractRowField(row, [
            'nom complet (full name)', 'nom complet', 'nomcomplet', 'fullname', 'nom', 'name', 'client', 'client tulip', 'الاسم الكامل', 'الاسم'
          ]);

          const company = extractRowField(row, [
            'entreprise / parfumerie', 'entreprise', 'parfumerie', 'societe', 'company', 'boutique', 'magasin', 'المحل', 'المؤسسة', 'الشركة'
          ]);

          const email = extractRowField(row, [
            'email', 'mail', 'courriel', 'e-mail', 'البريد الالكتروني'
          ]);

          const phone = extractRowField(row, [
            'téléphone (phone)', 'telephone (phone)', 'telephone', 'téléphone', 'tel', 'phone', 'mobile', 'portable', 'الهاتف', 'رقم الهاتف'
          ]);

          const secondaryPhone = extractRowField(row, [
            'téléphone secondaire', 'telephone secondaire', 'telsecondaire', 'phone2', 'mobile2', 'fixe', 'الهاتف الثانوي'
          ]);

          let wilayaCode = extractRowField(row, [
            'code wilaya', 'codewilaya', 'wilayacode', 'code', 'رقم الولاية'
          ]);

          let wilayaName = extractRowField(row, [
            'nom wilaya', 'nomwilaya', 'wilayaname', 'wilaya', 'province', 'الولاية'
          ]);

          if (!wilayaName && wilayaCode) {
            const foundW = ALGERIAN_WILAYAS.find((w) => w.code === wilayaCode);
            if (foundW) wilayaName = foundW.name;
          } else if (wilayaName && !wilayaCode) {
            const foundW = ALGERIAN_WILAYAS.find(
              (w) => w.name.toLowerCase() === wilayaName.toLowerCase()
            );
            if (foundW) wilayaCode = foundW.code;
          }

          const commune = extractRowField(row, [
            'commune', 'ville', 'daira', 'city', 'البلدية'
          ]);

          const deliveryAddress = extractRowField(row, [
            'adresse de livraison', 'adressedelivraison', 'adresse', 'address', 'livraison', 'العنوان'
          ]);

          const rawStatus = extractRowField(row, [
            'statut du compte', 'statutducompte', 'statut', 'status', 'الحالة'
          ]).toLowerCase();

          const status: CustomerUser['status'] =
            rawStatus.includes('suspend') ? 'suspended' :
            rawStatus.includes('rejet') || rawStatus.includes('reject') ? 'rejected' :
            rawStatus.includes('attente') || rawStatus.includes('pend') ? 'pending' :
            'approved';

          // Must have at least a name or phone or username
          if (!fullName && !phone && !username) {
            errors.push(`Ligne ${rowNum} ignorée : Nom, téléphone ou identifiant manquant.`);
            return;
          }

          const finalUsername = (username || fullName.replace(/\s+/g, '_').toLowerCase() || `client_${index + 1}`)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9_]/g, '');

          // INDIVIDUAL PASSWORD: Use the parsed password from file, OR generate a distinct unique password
          const finalPassword = password || generateUniqueCustomerPassword(finalUsername, phone, index);
          const finalEmail = email || `${finalUsername}@tulip-client.dz`;

          importedList.push({
            id: `cust-imp-${Date.now()}-${index}`,
            username: finalUsername,
            password: finalPassword,
            fullName: fullName || finalUsername,
            companyName: company || undefined,
            email: finalEmail,
            phone: phone || '0550000000',
            secondaryPhone: secondaryPhone || undefined,
            wilayaCode: wilayaCode || '16',
            wilayaName: wilayaName || 'Alger',
            commune: commune || wilayaName || 'Alger',
            deliveryAddress: deliveryAddress || wilayaName || 'Alger',
            status: status,
            createdAt: new Date().toISOString(),
          });
        });

        resolve({
          success: importedList.length > 0,
          importedCustomers: importedList,
          errors,
          totalRows: rawJson.length,
        });
      } catch (err: any) {
        resolve({
          success: false,
          importedCustomers: [],
          errors: [`Erreur lors du traitement du fichier : ${err.message || 'Format non reconnu'}`],
          totalRows: 0,
        });
      }
    };

    reader.readAsBinaryString(file);
  });
};
