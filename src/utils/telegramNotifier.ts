import { PreOrder, StoreSettings } from '../types';
import { formatDZD } from './pdfGenerator';

export function formatTelegramOrderMessage(order: PreOrder, storeSettings?: StoreSettings): string {
  const storeName = storeSettings?.storeName || 'Tulip Fragrance Company';
  const telegramTarget = storeSettings?.telegramPhone || '+213799938399';

  const itemsList = order.items
    .map((item, index) => {
      const qtyLabel =
        item.family === 'Extrait'
          ? `${item.quantity}g (${Math.floor(item.quantity / 100)} flacon(s) 100g)`
          : `${item.quantity}x ${item.unit}`;
      return `${index + 1}. *${item.name}* [${item.code}]\n   Quantité : ${qtyLabel}\n   Prix : ${formatDZD(item.totalDA)}`;
    })
    .join('\n\n');

  const deliveryLabel =
    order.customer.deliveryMode === 'domicile'
      ? 'À Domicile (58 Wilayas)'
      : order.customer.deliveryMode === 'stop_desk'
      ? 'Bureau Stop-Desk'
      : 'Retrait Magasin';

  return (
    `🌸 *NOUVELLE PRÉCOMMANDE - ${storeName.toUpperCase()}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 *RÉFÉRENCE BON :* \`${order.orderNumber}\`\n` +
    `📅 *Date :* ${new Date(order.date).toLocaleString('fr-DZ')}\n\n` +
    `👤 *INFORMATIONS CLIENT :*\n` +
    `• Nom : ${order.customer.fullName} ${order.customer.companyName ? `(${order.customer.companyName})` : ''}\n` +
    `• Téléphone : ${order.customer.phone}\n` +
    `• Wilaya : ${order.customer.wilayaCode} - ${order.customer.wilayaName}\n` +
    `• Commune / Adresse : ${order.customer.commune}, ${order.customer.deliveryAddress}\n` +
    `• Mode de livraison : ${deliveryLabel}\n` +
    (order.customer.notes ? `• Remarques : ${order.customer.notes}\n` : '') +
    `\n📦 *MATIÈRES PREMIÈRES RÉSERVÉES :*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${itemsList}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💰 *TOTAL À PAYER :* *${formatDZD(order.totalDA)}*\n\n` +
    `📍 Destinataire Telegram : ${telegramTarget}\n` +
    `⚡ Merci de confirmer la prise en charge et la préparation du stock (Réservation 48H).`
  );
}

/**
 * Dispatches order to Telegram:
 * 1. Calls server endpoint to send via Telegram Bot if configured.
 * 2. Opens Telegram chat/share directly to +213799938399.
 */
export async function sendOrderToTelegram(
  order: PreOrder,
  storeSettings?: StoreSettings,
  targetPhone: string = '+213799938399'
): Promise<{ success: boolean; method: string }> {
  const message = formatTelegramOrderMessage(order, storeSettings);

  // 1. Attempt server notification in background (via bot if configured)
  try {
    fetch('/api/telegram/send-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order,
        telegramPhone: targetPhone,
      }),
    }).catch((err) => console.warn('Telegram background server dispatch notice:', err));
  } catch (e) {
    // Non-blocking
  }

  // 2. Open Telegram client-side directly to user or via share
  const cleanPhone = targetPhone.replace(/[^0-9+]/g, '');
  const encodedText = encodeURIComponent(message);

  // Try direct user chat or share link
  // Telegram direct share URL pre-populates message:
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodedText}`;
  
  // Also try copying text to clipboard so it's ready to paste
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // ignore
    }
  }

  // Open Telegram share dialog
  const opened = window.open(telegramShareUrl, '_blank');
  if (!opened) {
    window.location.href = `https://t.me/${cleanPhone}`;
  }

  return { success: true, method: 'direct_share' };
}
