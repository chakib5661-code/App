import { jsPDF } from 'jspdf';
import { PreOrder, StoreSettings } from '../types';

// Format currency in Algerian Dinars (DA) with up to 2 decimals
export const formatDZD = (amount: number): string => {
  const formatted = new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  
  // Replace any runtime thousands-separator slashes with clean periods
  return formatted.replace(/\//g, '.') + ' DA';
};

let cachedFontBase64: string | null = null;

// Dynamic, multi-source resilient loader for Amiri Arabic TTF Font (tries jsDelivr, unpkg, and Cairo-Arabic fallback)
export const loadArabicFont = async (): Promise<string> => {
  if (cachedFontBase64) return cachedFontBase64;
  
  const urls = [
    'https://cdn.jsdelivr.net/npm/@fontsource/amiri@5.0.8/files/amiri-arabic-400-normal.ttf',
    'https://unpkg.com/@fontsource/amiri@5.0.8/files/amiri-arabic-400-normal.ttf',
    'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.8/files/cairo-arabic-400-normal.ttf'
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Font source ${url} returned status ${response.status}. Trying next fallback...`);
        continue;
      }
      const buffer = await response.arrayBuffer();
      
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = window.btoa(binary);
      cachedFontBase64 = base64;
      return base64;
    } catch (error) {
      console.warn(`Font fetch from ${url} failed. Trying next...`, error);
    }
  }
  
  console.error('All Arabic font sources failed. Operating on standard fallback font.');
  return '';
};

// Premium Arabic shaping & RTL bidirectional engine
export const shapeAndReverseArabic = (text: string): string => {
  if (!text) return '';
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  if (!hasArabic) return text;

  // Map Arabic characters to shaped forms
  const charMap: Record<number, { isolated: number; final: number; medial: number; initial: number; connectsLeft: boolean; connectsRight: boolean }> = {
    0x0621: { isolated: 0xFE80, final: 0xFE80, medial: 0xFE80, initial: 0xFE80, connectsLeft: false, connectsRight: false }, // Hamza
    0x0622: { isolated: 0xFE81, final: 0xFE82, medial: 0xFE82, initial: 0xFE81, connectsLeft: false, connectsRight: true }, // Alef with Madda
    0x0623: { isolated: 0xFE83, final: 0xFE84, medial: 0xFE84, initial: 0xFE83, connectsLeft: false, connectsRight: true }, // Alef with Hamza Above
    0x0624: { isolated: 0xFE85, final: 0xFE86, medial: 0xFE86, initial: 0xFE85, connectsLeft: false, connectsRight: true }, // Waw with Hamza
    0x0625: { isolated: 0xFE87, final: 0xFE88, medial: 0xFE88, initial: 0xFE87, connectsLeft: false, connectsRight: true }, // Alef with Hamza Below
    0x0626: { isolated: 0xFE89, final: 0xFE8A, medial: 0xFE8C, initial: 0xFE8B, connectsLeft: true,  connectsRight: true }, // Yeh with Hamza
    0x0627: { isolated: 0xFE8D, final: 0xFE8E, medial: 0xFE8E, initial: 0xFE8D, connectsLeft: false, connectsRight: true }, // Alef
    0x0628: { isolated: 0xFE8F, final: 0xFE90, medial: 0xFE92, initial: 0xFE91, connectsLeft: true,  connectsRight: true }, // Beh
    0x0629: { isolated: 0xFE93, final: 0xFE94, medial: 0xFE93, initial: 0xFE93, connectsLeft: false, connectsRight: true }, // Teh Marbuta
    0x062A: { isolated: 0xFE95, final: 0xFE96, medial: 0xFE98, initial: 0xFE97, connectsLeft: true,  connectsRight: true }, // Teh
    0x062B: { isolated: 0xFE99, final: 0xFE9A, medial: 0xFE9C, initial: 0xFE9B, connectsLeft: true,  connectsRight: true }, // Theh
    0x062C: { isolated: 0xFE9D, final: 0xFE9E, medial: 0xFEA0, initial: 0xFE9F, connectsLeft: true,  connectsRight: true }, // Jeem
    0x062D: { isolated: 0xFEA1, final: 0xFEA2, medial: 0xFEA4, initial: 0xFEA3, connectsLeft: true,  connectsRight: true }, // Hah
    0x062E: { isolated: 0xFEA5, final: 0xFEA6, medial: 0xFEA8, initial: 0xFEA7, connectsLeft: true,  connectsRight: true }, // Khah
    0x062F: { isolated: 0xFEA9, final: 0xFEAA, medial: 0xFEAA, initial: 0xFEA9, connectsLeft: false, connectsRight: true }, // Dal
    0x0630: { isolated: 0xFEAB, final: 0xFEAC, medial: 0xFEAC, initial: 0xFEAB, connectsLeft: false, connectsRight: true }, // Thal
    0x0631: { isolated: 0xFEAD, final: 0xFEAE, medial: 0xFEAE, initial: 0xFEAD, connectsLeft: false, connectsRight: true }, // Reh
    0x0632: { isolated: 0xFEAF, final: 0xFEB0, medial: 0xFEB0, initial: 0xFEAF, connectsLeft: false, connectsRight: true }, // Zain
    0x0633: { isolated: 0xFEB1, final: 0xFEB2, medial: 0xFEB4, initial: 0xFEB3, connectsLeft: true,  connectsRight: true }, // Seen
    0x0634: { isolated: 0xFEB5, final: 0xFEB6, medial: 0xFEB8, initial: 0xFEB7, connectsLeft: true,  connectsRight: true }, // Sheen
    0x0635: { isolated: 0xFEB9, final: 0xFEBA, medial: 0xFEBC, initial: 0xFEBB, connectsLeft: true,  connectsRight: true }, // Sad
    0x0636: { isolated: 0xFEBD, final: 0xFEBE, medial: 0xFEC0, initial: 0xFEBF, connectsLeft: true,  connectsRight: true }, // Dad
    0x0637: { isolated: 0xFEC1, final: 0xFEC2, medial: 0xFEC4, initial: 0xFEC3, connectsLeft: true,  connectsRight: true }, // Tah
    0x0638: { isolated: 0xFEC5, final: 0xFEC6, medial: 0xFEC8, initial: 0xFEC7, connectsLeft: true,  connectsRight: true }, // Zah
    0x0639: { isolated: 0xFEC9, final: 0xFECA, medial: 0xFECC, initial: 0xFECB, connectsLeft: true,  connectsRight: true }, // Ain
    0x063A: { isolated: 0xFECD, final: 0xFECE, medial: 0xFED0, initial: 0xFEDF, connectsLeft: true,  connectsRight: true }, // Ghain
    0x0641: { isolated: 0xFED1, final: 0xFED2, medial: 0xFED4, initial: 0xFED3, connectsLeft: true,  connectsRight: true }, // Feh
    0x0642: { isolated: 0xFED5, final: 0xFED6, medial: 0xFED8, initial: 0xFED7, connectsLeft: true,  connectsRight: true }, // Qaf
    0x0643: { isolated: 0xFED9, final: 0xFEDA, medial: 0xFEDC, initial: 0xFEDB, connectsLeft: true,  connectsRight: true }, // Kaf
    0x0644: { isolated: 0xFEDD, final: 0xFEDE, medial: 0xFEE0, initial: 0xFEDF, connectsLeft: true,  connectsRight: true }, // Lam
    0x0645: { isolated: 0xFEE1, final: 0xFEE2, medial: 0xFEE4, initial: 0xFEE3, connectsLeft: true,  connectsRight: true }, // Meem
    0x0646: { isolated: 0xFEE5, final: 0xFEE6, medial: 0xFEE8, initial: 0xFEE7, connectsLeft: true,  connectsRight: true }, // Noon
    0x0647: { isolated: 0xFEE9, final: 0xFEEA, medial: 0xFEEC, initial: 0xFEEB, connectsLeft: true,  connectsRight: true }, // Heh
    0x0648: { isolated: 0xFEED, final: 0xFEEE, medial: 0xFEEE, initial: 0xFEED, connectsLeft: false, connectsRight: true }, // Waw
    0x0649: { isolated: 0xFEEF, final: 0xFEF0, medial: 0xFEF0, initial: 0xFEEF, connectsLeft: false, connectsRight: true }, // Alef Maksura
    0x064A: { isolated: 0xFEF1, final: 0xFEF2, medial: 0xFEF4, initial: 0xFEF3, connectsLeft: true,  connectsRight: true }, // Yeh
  };

  const words = text.split(/(\s+)/);
  const processedWords = words.map((word) => {
    const isWordArabic = /[\u0600-\u06FF\uFE70-\uFEFF]/.test(word);
    if (isWordArabic) {
      const wordChars = Array.from(word);
      const wordShaped: string[] = [];
      for (let i = 0; i < wordChars.length; i++) {
        const charCode = wordChars[i].charCodeAt(0);
        const mapEntry = charMap[charCode];
        if (!mapEntry) {
          wordShaped.push(wordChars[i]);
          continue;
        }
        const prevCode = i > 0 ? wordChars[i - 1].charCodeAt(0) : null;
        const nextCode = i < wordChars.length - 1 ? wordChars[i + 1].charCodeAt(0) : null;

        const connectsRight = prevCode && charMap[prevCode]?.connectsLeft;
        const connectsLeft = nextCode && charMap[nextCode]?.connectsRight;

        let gc = mapEntry.isolated;
        if (connectsLeft && connectsRight) {
          gc = mapEntry.medial;
        } else if (connectsLeft) {
          gc = mapEntry.initial;
        } else if (connectsRight) {
          gc = mapEntry.final;
        }
        wordShaped.push(String.fromCharCode(gc));
      }
      return wordShaped.reverse().join('');
    }
    return word;
  });

  return processedWords.reverse().join('');
};

// Generate PDF Bon de Précommande with multi-page automatic pagination support
export const generatePreOrderPDF = (
  order: PreOrder,
  store: StoreSettings,
  options?: { hidePrices?: boolean; arabicFont?: string }
): jsPDF => {
  const isPricesHidden = Boolean(options?.hidePrices);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const hasArabicFont = Boolean(options?.arabicFont);
  if (options?.arabicFont) {
    try {
      doc.addFileToVFS('Amiri.ttf', options.arabicFont);
      doc.addFont('Amiri.ttf', 'Amiri', 'normal');
    } catch (e) {
      console.error('Failed to add Arabic font to VFS:', e);
    }
  }

  // Draw text helper supporting Arabic character substitution if font is available
  const drawSafeText = (textStr: string, x: number, y: number, textOptions?: any) => {
    if (!textStr) return;
    const hasArabic = /[\u0600-\u06FF]/.test(textStr);
    const oldFont = doc.getFont().fontName;
    
    if (hasArabic && hasArabicFont) {
      doc.setFont('Amiri');
      const shaped = shapeAndReverseArabic(textStr);
      doc.text(shaped, x, y, textOptions);
      doc.setFont(oldFont);
    } else {
      // Clean Arabic characters if font is not loaded to avoid block squares
      let clean = textStr;
      if (hasArabic) {
        clean = textStr.replace(/[\u0600-\u06FF]/g, '').trim();
        if (!clean) {
          clean = 'Client / Commande';
        }
      }
      doc.text(clean, x, y, textOptions);
    }
  };

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentPage = 1;

  // Premium Arabic footer drawer
  const drawPageFooter = (pageNum: number) => {
    const footerY = pageHeight - 40;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('CONDITIONS & RÉSERVATION DE STOCK :', margin, footerY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text('• Les matières premières figurant sur ce bon sont réservées pour une durée de 48 heures.', margin, footerY + 9);
    doc.text('• Notre service commercial vous appellera pour confirmer la disponibilité et planifier l\'expédition.', margin, footerY + 13);
    doc.text('• Règlement en espèces à la livraison ou au comptoir du magasin.', margin, footerY + 17);

    // Stamp / signature box
    const stampBoxX = pageWidth - margin - 55;
    doc.setDrawColor(203, 213, 225);
    doc.rect(stampBoxX, footerY + 3, 55, 18);
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Cachet et Signature Magasin', stampBoxX + 27.5, footerY + 7, { align: 'center' });

    // Bottom copyright and pagination
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${store.storeName} — Catalogue et Gestion des Matières Premières en Algérie — ${store.phone}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
    doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  };

  // --- PAGE 1: BRAND HEADER ---
  // Header background banner (Dark Charcoal / Bronze aesthetic)
  doc.setFillColor(24, 28, 36);
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Green/Amber accent line (Algerian warm tones)
  doc.setFillColor(217, 119, 6); // warm amber
  doc.rect(0, 38, pageWidth, 2.5, 'F');

  // Company Name & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  drawSafeText(store.storeName.toUpperCase(), margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  drawSafeText(store.tagline, margin, 20);

  // Store contact info in top right
  doc.setFontSize(8);
  doc.text(`Tél: ${store.phone}`, pageWidth - margin, 13, { align: 'right' });
  doc.text(`Wilaya: ${store.wilaya}`, pageWidth - margin, 18, { align: 'right' });
  doc.text(`Adresse: ${store.address}`, pageWidth - margin, 23, { align: 'right' });
  doc.text(`Email: ${store.email}`, pageWidth - margin, 28, { align: 'right' });

  // Document Title Badge
  let y = 50;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 16, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const isProforma = order.isProforma || (order.orderNumber && order.orderNumber.startsWith('PRO-'));
  doc.text(
    isProforma
      ? 'FACTURE PROFORMA / DEVIS ESTIMATIF'
      : 'BON DE PRÉCOMMANDE / RÉSERVATION DE STOCK',
    margin + 6,
    y + 7
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Réf: ${order.orderNumber}`, margin + 6, y + 12.5);

  const formattedDate = new Date(order.date).toLocaleString('fr-DZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Date: ${formattedDate}`, pageWidth - margin - 6, y + 12.5, { align: 'right' });

  // Two columns info block: Client Details (Left) & Delivery Mode (Right)
  y = 72;
  const colWidth = (pageWidth - (margin * 2) - 8) / 2;

  // Box 1: Client
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, colWidth, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('COORDONNÉES DU CLIENT', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const clientName = order.customer.fullName + (order.customer.companyName ? ` (${order.customer.companyName})` : '');
  drawSafeText(`Nom / Client : ${clientName}`, margin + 4, y + 13);
  doc.text(`Téléphone : ${order.customer.phone}`, margin + 4, y + 19);
  if (order.customer.secondaryPhone) {
    doc.text(`Tél 2 : ${order.customer.secondaryPhone}`, margin + 4, y + 25);
  } else {
    drawSafeText(`Wilaya : ${order.customer.wilayaCode} - ${order.customer.wilayaName}`, margin + 4, y + 25);
  }
  drawSafeText(`Commune : ${order.customer.commune || 'Centre'}`, margin + 4, y + 31);

  // Box 2: Delivery & Payment Details
  const col2X = margin + colWidth + 8;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(col2X, y, colWidth, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('LIVRAISON & VALIDATION', col2X + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  let modeText = 'Livraison à Domicile';
  if (order.customer.deliveryMode === 'stop_desk') modeText = 'Bureau Stop-Desk (Yalidine/Express)';
  if (order.customer.deliveryMode === 'magasin') modeText = 'Retrait Direct au Magasin (0 DA)';

  doc.text(`Mode : ${modeText}`, col2X + 4, y + 13);
  drawSafeText(`Destination : ${order.customer.wilayaName} (${order.customer.wilayaCode})`, col2X + 4, y + 19);
  doc.text(`Paiement : À la livraison / Réception`, col2X + 4, y + 25);

  const shortAddress = order.customer.deliveryAddress ? order.customer.deliveryAddress.slice(0, 35) : 'Adresse spécifiée par téléphone';
  drawSafeText(`Adresse : ${shortAddress}`, col2X + 4, y + 31);

  // --- TABLE DRAWING & PAGINATION CONFIG ---
  y = 118;

  const drawTableHeader = (headerY: number) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, headerY, pageWidth - (margin * 2), 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    doc.text('Réf.', margin + 2, headerY + 5.5);
    doc.text('Désignation de la Matière Première', margin + 20, headerY + 5.5);
    doc.text('Famille', margin + 90, headerY + 5.5);
    doc.text('Unité', margin + 108, headerY + 5.5);
    doc.text('Qté', margin + 134, headerY + 5.5, { align: 'right' });
    if (isPricesHidden) {
      doc.text('Tarif P.U', margin + 162, headerY + 5.5, { align: 'right' });
      doc.text('Montant', pageWidth - margin - 3, headerY + 5.5, { align: 'right' });
    } else {
      doc.text('P.U (DA)', margin + 162, headerY + 5.5, { align: 'right' });
      doc.text('Total (DA)', pageWidth - margin - 3, headerY + 5.5, { align: 'right' });
    }
  };

  drawTableHeader(y);
  y += 8;

  // Table rows config
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const rowHeight = 8.5; // High comfort clear line height spacing

  order.items.forEach((item, index) => {
    // Check if drawing this row exceeds the safe printable boundary (leaving room for footer)
    if (y > 225) {
      drawPageFooter(currentPage);
      doc.addPage();
      currentPage++;

      // New Page Accent Banner
      doc.setFillColor(24, 28, 36);
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setFillColor(217, 119, 6);
      doc.rect(0, 28, pageWidth, 2, 'F');

      // Top logo details
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      drawSafeText(store.storeName.toUpperCase(), margin, 12);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`Réf: ${order.orderNumber} — Page ${currentPage}`, margin, 18);

      // Re-draw table columns
      y = 36;
      drawTableHeader(y);
      y += 8;
    }

    // Alternating zebra backgrounds
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.rect(margin, y, pageWidth - (margin * 2), rowHeight, 'F');

    // Horizontal thin separator
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    // Column 1: Reference Code (Truncated neatly)
    doc.setTextColor(71, 85, 105);
    doc.text(item.code.slice(0, 10), margin + 2, y + 5.5);

    // Column 2: Material Name Designation
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    drawSafeText(item.name.slice(0, 36), margin + 20, y + 5.5);
    doc.setFont('helvetica', 'normal');

    // Column 3: Family Badge
    if (item.family === 'Extrait') {
      doc.setTextColor(180, 83, 9);
    } else if (item.family === 'Accessoire') {
      doc.setTextColor(13, 148, 136);
    } else {
      doc.setTextColor(30, 64, 175);
    }
    doc.text(item.family, margin + 90, y + 5.5);

    // Column 4: Units column (Spaced with clear 26mm margin to Qty column)
    doc.setTextColor(100, 116, 139);
    const unitText = item.family === 'Extrait' ? '1g (100g)' : item.unit;
    doc.text(unitText, margin + 108, y + 5.5);

    // Column 5: Quantity Column (Alight right safely at margin + 134)
    doc.setTextColor(15, 23, 42);
    const qtyText = item.family === 'Extrait' ? `${item.quantity} g` : item.quantity.toString();
    doc.text(qtyText, margin + 134, y + 5.5, { align: 'right' });

    // Column 6: Prices (Replaced "/" with "." inside the currency labels)
    if (isPricesHidden) {
      doc.setTextColor(180, 83, 9);
      doc.text('Sur Devis', margin + 162, y + 5.5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text('Proforma', pageWidth - margin - 3, y + 5.5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    } else {
      const priceText = item.family === 'Extrait' 
        ? `${item.priceDA.toFixed(2).replace(/\.00$/, '')} DA.g` // Replaced "/" with "."
        : formatDZD(item.priceDA);
      doc.text(priceText, margin + 162, y + 5.5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(formatDZD(item.totalDA), pageWidth - margin - 3, y + 5.5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    y += rowHeight;
  });

  // Check if drawing the totals summary box + notes fits on the current page. If not, push to new page.
  if (y > 200) {
    drawPageFooter(currentPage);
    doc.addPage();
    currentPage++;

    // Draw secondary page top banner
    doc.setFillColor(24, 28, 36);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(217, 119, 6);
    doc.rect(0, 28, pageWidth, 2, 'F');

    y = 36;
  }

  // --- DRAW TOTAL SUMMARY BOX ---
  y += 5;
  const totalBoxWidth = isPricesHidden ? 95 : 80;
  const totalBoxX = pageWidth - margin - totalBoxWidth;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(totalBoxX, y, totalBoxWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Articles commandés :', totalBoxX + 5, y + 7);
  doc.text(`${order.items.reduce((s, i) => s + i.quantity, 0)} unités`, totalBoxX + totalBoxWidth - 5, y + 7, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(totalBoxX + 5, y + 10, totalBoxX + totalBoxWidth - 5, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(isPricesHidden ? 'STATUT TARIF :' : 'TOTAL PRÉCOMMANDE :', totalBoxX + 5, y + 17);

  if (isPricesHidden) {
    doc.setTextColor(217, 119, 6); // gold amber
    doc.setFontSize(8.5);
    doc.text('Sur Devis Proforma', totalBoxX + totalBoxWidth - 5, y + 17, { align: 'right' });
  } else {
    doc.setTextColor(217, 119, 6); // gold amber
    doc.text(formatDZD(order.totalDA), totalBoxX + totalBoxWidth - 5, y + 17, { align: 'right' });
  }

  // Draw notes under the items
  if (order.customer.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    drawSafeText(`Note client: "${order.customer.notes.slice(0, 80)}"`, margin, y + 8);
  }

  // Finalize footer drawing for the last page
  drawPageFooter(currentPage);

  return doc;
};

// Direct download helper
export const downloadOrderPDF = async (
  order: PreOrder,
  store: StoreSettings,
  options?: { hidePrices?: boolean }
) => {
  const arabicFont = await loadArabicFont();
  const doc = generatePreOrderPDF(order, store, { ...options, arabicFont });
  doc.save(`Bon_Precommande_${order.orderNumber}.pdf`);
};

// Print directly via browser helper
export const printOrderPDF = async (
  order: PreOrder,
  store: StoreSettings,
  options?: { hidePrices?: boolean }
) => {
  const arabicFont = await loadArabicFont();
  const doc = generatePreOrderPDF(order, store, { ...options, arabicFont });
  const blobUrl = doc.output('bloburl');
  const printWindow = window.open(blobUrl);
  if (printWindow) {
    printWindow.focus();
  }
};
