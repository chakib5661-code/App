import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import compression from "compression";
import * as storeDb from "./storeDb";
import * as supabaseDb from "./supabaseDb";
import { put, list, del } from "@vercel/blob";
import sharp from "sharp";

dotenv.config();

export const app = express();
app.use(compression());
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS for API routes
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Global Serial Lock Queue for Database Writes to prevent concurrent read-modify-write race conditions in Supabase
let writeLockQueue: Promise<any> = Promise.resolve();

app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.path.startsWith("/api/")) {
    const writePromise = new Promise<void>((resolve) => {
      writeLockQueue.then(() => {
        let isResolved = false;
        const release = () => {
          if (!isResolved) {
            isResolved = true;
            resolve();
          }
        };

        // Hijack response methods to guarantee release under all circumstances
        const originalEnd = res.end;
        (res as any).end = function (...args: any[]) {
          const result = originalEnd.apply(res, args as any);
          release();
          return result;
        };

        // Set emergency safety timeout of 10 seconds to prevent any frozen requests from blocking the queue
        setTimeout(release, 10000);

        try {
          next();
        } catch (err) {
          console.error("[Queue] Error in serial route handler:", err);
          release();
        }
      });
    });
    writeLockQueue = writePromise;
  } else {
    next();
  }
});

// Serve public static assets (tulip-extrait-default.jpg, tulip-logo.svg, PWA icons, etc.)
app.use(express.static(path.join(process.cwd(), "public")));

app.use(express.json({ limit: "25mb" }));

// Load / initialize persistent database
storeDb.loadDatabase();

// Attempt non-blocking Supabase sync at startup
if (supabaseDb.isSupabaseConfigured()) {
  storeDb.syncWithSupabaseAsync().catch((e) => {
    console.warn("[Server] Initial Supabase sync notice:", e?.message || e);
  });
}

// Health check & Server Status
  // Real-Time Server-Sent Events (SSE) Client Pool for instant cross-device synchronization
  const sseClients = new Set<express.Response>();

  export function broadcastServerEvent(type: string, payload: any) {
    const dataStr = `data: ${JSON.stringify({ type, payload, timestamp: new Date().toISOString() })}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(dataStr);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // Real-Time SSE Stream Endpoint
  app.get("/api/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial handshake
    res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);
    sseClients.add(res);

    // Keep-alive heartbeat every 15 seconds
    const heartbeat = setInterval(() => {
      try {
        res.write(": keep-alive\n\n");
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 15000);

    // Auto-close connection after 25 seconds to cleanly prevent Serverless/Vercel execution limits
    // The client will automatically, instantly reconnect. Real-time updates remain 100% active with no logs timeout!
    const autoCloseTimer = setTimeout(() => {
      clearInterval(heartbeat);
      sseClients.delete(res);
      if (!res.writableEnded) {
        res.end();
      }
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      clearTimeout(autoCloseTimer);
      sseClients.delete(res);
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      company: "Tulip Fragrance Company",
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      storage: supabaseDb.isSupabaseConfigured() ? "supabase_cloud" : "persistent_file_db",
      supabaseConfigured: supabaseDb.isSupabaseConfigured(),
      timestamp: new Date().toISOString(),
    });
  });

  // Supabase Connection Diagnostics Endpoint
  app.get("/api/supabase/status", async (_req, res) => {
    try {
      const status = await supabaseDb.testSupabaseConnection();
      res.json({ success: true, ...status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // Supabase Manual Sync/Push Endpoint (Admin utility)
  app.post("/api/supabase/sync", async (_req, res) => {
    try {
      if (!supabaseDb.isSupabaseConfigured()) {
        return res.status(400).json({
          success: false,
          error: "Supabase n'est pas encore configuré. Renseignez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans les variables d'environnement.",
        });
      }
      const db = storeDb.loadDatabase();
      const pushed = await supabaseDb.saveDatabaseToSupabase(db);
      res.json({
        success: pushed,
        message: pushed
          ? "Base de données synchronisée avec succès vers Supabase."
          : "Échec de la synchronisation vers Supabase. Vérifiez les logs et exécutez le script SQL supabase-schema.sql.",
        lastUpdated: db.lastUpdated,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // Analytics Environment Configuration Endpoint
  app.get("/api/analytics-config", (_req, res) => {
    const gaMeasurementId = (process.env.VITE_GA_MEASUREMENT_ID || process.env.GA_MEASUREMENT_ID || "").trim();
    const clarityProjectId = (process.env.VITE_CLARITY_PROJECT_ID || process.env.CLARITY_PROJECT_ID || "").trim();
    res.json({
      status: "ok",
      gaMeasurementId,
      clarityProjectId,
    });
  });

  // Global Sync / Bootstrap Endpoint for Real-Time Multi-Device State
  app.get("/api/sync", async (req, res) => {
    try {
      const isAdmin = req.query.admin === 'true';
      const db = await storeDb.loadDatabaseAsync(true);
      const gaMeasurementId = (process.env.VITE_GA_MEASUREMENT_ID || process.env.GA_MEASUREMENT_ID || "").trim();
      const clarityProjectId = (process.env.VITE_CLARITY_PROJECT_ID || process.env.CLARITY_PROJECT_ID || "").trim();

      // Detect country using Vercel GeoIP headers, default to DZ (Algeria) during local dev
      const visitorCountry = String(req.headers['x-vercel-ip-country'] || req.headers['x-ip-country'] || 'DZ').toUpperCase();

      // Configure CDN cache headers on Vercel's Edge network for non-admin requests
      if (!isAdmin) {
        res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=300, stale-while-revalidate=600');
      } else {
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
      }

      res.json({
        status: "ok",
        visitorCountry,
        products: db.products,
        orders: isAdmin ? db.orders : [],
        customerApplications: isAdmin ? db.customerApplications : [],
        customerUsers: isAdmin ? db.customerUsers : [],
        adminUsers: isAdmin ? (db.adminUsers || []) : [],
        adBanners: db.adBanners,
        storeSettings: db.storeSettings,
        storageProvider: supabaseDb.isSupabaseConfigured() ? "supabase" : "local",
        analyticsConfig: {
          gaMeasurementId,
          clarityProjectId,
        },
        lastUpdated: db.lastUpdated,
        serverTime: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[API] /api/sync error:", err);
      res.status(500).json({ error: "Erreur lors de la synchronisation." });
    }
  });

function escapeHtml(str: string = ''): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BOT_SELF_ID = '8908435035';
// Verified active destinations from @tulip5661bot: User "Tulip Oran" (5680755596) (removed deleted group -5365585827)
const DEFAULT_ACTIVE_CHATS = ['5680755596'];

async function removeDeadChatIdFromSettings(deadId: string) {
  try {
    const db = await storeDb.loadDatabaseAsync();
    const settings: any = db.storeSettings || {};
    let changed = false;

    const fields = [
      'telegramChatId',
      'telegramPreorderChatId',
      'telegramProformaChatId',
      'telegramAccessChatId'
    ];

    for (const field of fields) {
      if (settings[field]) {
        const parts = String(settings[field]).split(/[\s,;|]+/);
        const filtered = parts.filter(p => p && p !== deadId);
        const newValue = filtered.join(', ');
        if (newValue !== settings[field]) {
          settings[field] = newValue;
          changed = true;
        }
      }
    }

    if (changed) {
      db.storeSettings = settings;
      await storeDb.persistDatabaseAsync(db);
      console.log(`[Telegram Bot Autoclean] Successfully cleaned up dead ID ${deadId} from store settings.`);
    }
  } catch (err) {
    console.warn(`[Telegram Bot Autoclean] Error in cleanup helper:`, err);
  }
}

function extractChatIds(source?: string | null): string[] {
  if (!source) return [];
  const list: string[] = [];
  const parts = String(source).split(/[\s,;|]+/);
  for (const p of parts) {
    const trimmed = p.trim().replace(/^["']|["']$/g, '');
    if (trimmed && trimmed !== BOT_SELF_ID) {
      list.push(trimmed);
    }
  }
  return list;
}

export type TelegramNotificationType = 'preorder' | 'proforma' | 'access' | 'general';

async function resolveTelegramConfig(type: TelegramNotificationType = 'general') {
  const db = await storeDb.loadDatabaseAsync();
  const settings: any = db.storeSettings || {};

  let token = (process.env.TELEGRAM_BOT_TOKEN || settings.telegramBotToken || '8908435035:AAFYIq74hxJeFeiQAPRx_g_WZ7R5fL0uwu8').trim();
  token = token.replace(/^["']|["']$/g, '');

  if (token && !token.includes(':')) {
    token = `8908435035:${token}`;
  }

  const targetChatIds = new Set<string>();

  // Check specific chat ID based on notification type
  let specificSource: string | undefined;
  if (type === 'preorder') {
    specificSource = settings.telegramPreorderChatId;
  } else if (type === 'proforma') {
    specificSource = settings.telegramProformaChatId;
  } else if (type === 'access') {
    specificSource = settings.telegramAccessChatId;
  }

  const specificChats = extractChatIds(specificSource);
  if (specificChats.length > 0) {
    specificChats.forEach((id) => targetChatIds.add(id));
  } else {
    // Fallback to global/fallback chat IDs
    const fallbackSources = [settings.telegramChatId, process.env.TELEGRAM_CHAT_ID];
    for (const src of fallbackSources) {
      const chats = extractChatIds(src);
      chats.forEach((id) => targetChatIds.add(id));
    }
  }

  // If still empty, use verified default active chats
  if (targetChatIds.size === 0) {
    for (const id of DEFAULT_ACTIVE_CHATS) {
      targetChatIds.add(id);
    }
  }

  return {
    token,
    chatIds: Array.from(targetChatIds),
    primaryChatId: Array.from(targetChatIds)[0] || DEFAULT_ACTIVE_CHATS[0],
    enabled: settings.telegramNotificationsEnabled !== false,
  };
}

async function broadcastTelegramMessage(
  htmlMessage: string,
  type: TelegramNotificationType = 'general',
  overrideChatIds?: string[]
) {
  const config = await resolveTelegramConfig(type);
  const targetIds = overrideChatIds && overrideChatIds.length > 0 ? overrideChatIds : config.chatIds;

  if (!config.token || !config.enabled || targetIds.length === 0) {
    return { sentViaBot: false, error: 'Telegram non configuré ou désactivé' };
  }

  const deliveryReports: any[] = [];
  let successfulSends = 0;

  for (const cId of targetIds) {
    try {
      const tgUrl = `https://api.telegram.org/bot${config.token}/sendMessage`;
      const resp = await fetch(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cId,
          text: htmlMessage,
          parse_mode: 'HTML',
        }),
      });
      const data = await resp.json();
      deliveryReports.push({ chatId: cId, ok: Boolean(data && data.ok), data });
      if (data && data.ok) {
        successfulSends++;
      } else {
        console.warn(`[Telegram Bot] Error sending to ${cId}:`, data?.description);
        
        // Self-healing: if the chat was deleted, kicked, or blocked, remove it!
        const isForbidden = data?.description && (
          data.description.includes('chat was deleted') ||
          data.description.includes('bot was kicked') ||
          data.description.includes('chat not found') ||
          data.description.includes('bot was blocked')
        );
        if (isForbidden) {
          console.log(`[Telegram Bot Autoclean] Removing dead chat ID: ${cId} (Reason: ${data.description})`);
          removeDeadChatIdFromSettings(cId).catch(cleanupErr => {
            console.error(`[Telegram Bot Autoclean] Error cleaning up ${cId}:`, cleanupErr);
          });
        }
      }
    } catch (err: any) {
      console.warn(`[Telegram Bot] Fetch failure for ${cId}:`, err?.message);
      deliveryReports.push({ chatId: cId, ok: false, error: err?.message });
    }
  }

  return {
    sentViaBot: successfulSends > 0,
    successfulSends,
    totalTargets: targetIds.length,
    deliveryReports,
    message: htmlMessage,
    directTelegramUrl: `https://t.me/+213799938399`,
    botUsername: 'tulip5661bot',
  };
}

async function sendTelegramOrderNotification(order: any, _customPhone?: string) {
  const isProforma = Boolean(order.isProforma || (order.orderNumber && order.orderNumber.startsWith('PRO-')));
  const notificationType: TelegramNotificationType = isProforma ? 'proforma' : 'preorder';

  const itemsSummary = (order.items || [])
    .map((i: any, idx: number) => {
      const qty = i.family === 'Extrait' ? `${i.quantity}g` : `${i.quantity}x ${i.unit}`;
      return `  <b>${idx + 1}.</b> ${escapeHtml(i.name)} [<code>${escapeHtml(i.code)}</code>] : <b>${qty}</b> = ${(i.totalDA || 0).toLocaleString('fr-DZ')} DA`;
    })
    .join('\n');

  const customerName = `${order.customer?.fullName || 'Client'} ${order.customer?.companyName ? `(${order.customer.companyName})` : ''}`;
  const customerPhone = order.customer?.phone || 'Non spécifié';
  const destination = `${order.customer?.wilayaCode || ''} - ${order.customer?.wilayaName || ''} (${order.customer?.commune || ''})`;
  const deliveryAddress = order.customer?.deliveryAddress ? `\n📍 <b>Adresse :</b> ${escapeHtml(order.customer.deliveryAddress)}` : '';
  const orderDate = new Date(order.date || Date.now()).toLocaleString('fr-DZ');
  const totalAmount = (order.totalDA || 0).toLocaleString('fr-DZ');

  let messageHtml = '';

  if (isProforma) {
    messageHtml =
      `📄 <b>NOUVELLE DEMANDE DE FACTURE PROFORMA</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <b>Type :</b> Devis Proforma Express\n` +
      `📋 <b>N° Proforma :</b> <code>${escapeHtml(order.orderNumber)}</code>\n` +
      `👤 <b>Demandeur :</b> ${escapeHtml(customerName)}\n` +
      `📞 <b>Téléphone :</b> <code>${escapeHtml(customerPhone)}</code>\n` +
      `📍 <b>Destination :</b> ${escapeHtml(destination)}${deliveryAddress}\n\n` +
      `📦 <b>Articles Sélectionnés :</b>\n${itemsSummary}\n\n` +
      `💰 <b>TOTAL ESTIMATIF :</b> <b>${totalAmount} DA</b>\n` +
      `⏳ <b>Réservation stock :</b> 48 Heures\n` +
      `📅 <b>Date :</b> ${orderDate}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 <i>Tulip Fragrance Company • Service Commercial Oran</i>`;
  } else {
    messageHtml =
      `🌸 <b>NOUVELLE PRÉCOMMANDE VALIDÉE - TULIP</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 <b>Type :</b> Précommande Ferme\n` +
      `📋 <b>Bon N° :</b> <code>${escapeHtml(order.orderNumber)}</code>\n` +
      `👤 <b>Client :</b> ${escapeHtml(customerName)}\n` +
      `📞 <b>Téléphone :</b> <code>${escapeHtml(customerPhone)}</code>\n` +
      `📍 <b>Destination :</b> ${escapeHtml(destination)}${deliveryAddress}\n` +
      `🚚 <b>Mode livraison :</b> ${escapeHtml(order.customer?.deliveryMode || 'Standard')}\n\n` +
      `📦 <b>Articles Réservés :</b>\n${itemsSummary}\n\n` +
      `💰 <b>TOTAL À RÉGLER :</b> <b>${totalAmount} DA</b>\n` +
      `📅 <b>Date :</b> ${orderDate}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 <i>Tulip Fragrance Company • Bir El Djir, Oran</i>`;
  }

  return await broadcastTelegramMessage(messageHtml, notificationType);
}

async function sendTelegramAccessRequestNotification(applicant: any) {
  const applicantName = escapeHtml(applicant.fullName || 'Nouveau Client');
  const company = applicant.companyName ? escapeHtml(applicant.companyName) : 'Non spécifié';
  const phone = escapeHtml(applicant.phone || 'Non spécifié');
  const secondaryPhone = applicant.secondaryPhone ? `\n📱 <b>Téléphone 2 :</b> <code>${escapeHtml(applicant.secondaryPhone)}</code>` : '';
  const email = applicant.email ? escapeHtml(applicant.email) : 'Non spécifié';
  const location = `${escapeHtml(applicant.wilayaCode || '')} - ${escapeHtml(applicant.wilayaName || '')} (${escapeHtml(applicant.commune || '')})`;
  const address = applicant.deliveryAddress ? `\n📍 <b>Adresse :</b> ${escapeHtml(applicant.deliveryAddress)}` : '';
  const notes = applicant.notes ? `\n📝 <b>Activité / Notes :</b> <i>${escapeHtml(applicant.notes)}</i>` : '';
  const dateStr = new Date(applicant.createdAt || applicant.date || Date.now()).toLocaleString('fr-DZ');

  const messageHtml =
    `🔑 <b>NOUVELLE DEMANDE D'ACCÈS PROFESSIONNEL</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏢 <b>Type :</b> Demande d'accès Tarifs Pro / Gros\n` +
    `👤 <b>Responsable :</b> ${applicantName}\n` +
    `🏪 <b>Établissement :</b> <b>${company}</b>\n` +
    `📞 <b>Téléphone :</b> <code>${phone}</code>${secondaryPhone}\n` +
    `✉️ <b>Email :</b> ${email}\n` +
    `📍 <b>Localisation :</b> ${location}${address}${notes}\n` +
    `⏳ <b>Statut :</b> 🟡 En attente de validation\n` +
    `📅 <b>Date :</b> ${dateStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👉 <i>Rendez-vous dans l'Espace Admin > Clients pour approuver ce compte.</i>\n` +
    `🏢 <i>Tulip Fragrance Company • Bir El Djir, Oran</i>`;

  return await broadcastTelegramMessage(messageHtml, 'access');
}

  // ---------------- ORDERS (COMMANDES) ----------------
  app.get("/api/orders", async (_req, res) => {
    try {
      const orders = await storeDb.getAllOrdersAsync();
      res.json({ success: true, orders });
    } catch (err: any) {
      console.error("[API] GET /api/orders error:", err);
      res.status(500).json({ error: "Impossible de récupérer les commandes." });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const orderPayload = req.body;
      if (!orderPayload || !orderPayload.customer || !Array.isArray(orderPayload.items)) {
        return res.status(400).json({ error: "Données de commande incomplètes." });
      }

      const { order, updatedProducts } = await storeDb.createOrder(orderPayload);
      const isProforma = Boolean(order.isProforma || (order.orderNumber && order.orderNumber.startsWith('PRO-')));

      // Broadcast real-time order creation event to all connected clients & admin
      broadcastServerEvent("order:created", {
        order,
        updatedProducts,
        isProforma,
      });

      // Trigger Telegram notification asynchronously
      let telegramStatus: any = null;
      try {
        telegramStatus = await sendTelegramOrderNotification(order);
      } catch (tgErr: any) {
        console.warn("[Telegram Bot] Notification trigger error:", tgErr?.message);
      }

      res.status(201).json({
        success: true,
        order,
        updatedProducts,
        telegram: telegramStatus,
      });
    } catch (err: any) {
      console.error("[API] POST /api/orders error:", err);
      res.status(500).json({ error: "Erreur lors de l'enregistrement de la commande." });
    }
  });

  app.put("/api/orders", async (req, res) => {
    try {
      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: "Liste de commandes invalide." });
      }
      const { orders: updatedOrders, updatedProducts } = await storeDb.syncOrders(orders);
      broadcastServerEvent("orders:synced", { orders: updatedOrders, updatedProducts });
      res.json({ success: true, orders: updatedOrders, updatedProducts });
    } catch (err: any) {
      console.error("[API] PUT /api/orders error:", err);
      res.status(500).json({ error: "Erreur lors de la synchronisation des commandes." });
    }
  });

  app.put("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const patch = req.body;
      const result = await storeDb.updateOrder(id, patch);
      if (!result) {
        return res.status(404).json({ error: "Commande introuvable." });
      }
      broadcastServerEvent("order:updated", {
        order: result.order,
        updatedProducts: result.updatedProducts,
      });
      res.json({
        success: true,
        order: result.order,
        updatedProducts: result.updatedProducts,
      });
    } catch (err: any) {
      console.error("[API] PUT /api/orders/:id error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour de la commande." });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Le statut est requis." });
      }

      const result = await storeDb.updateOrderStatus(id, status);
      if (!result) {
        return res.status(404).json({ error: "Commande introuvable." });
      }

      broadcastServerEvent("order:updated", {
        order: result.order,
        updatedProducts: result.updatedProducts,
      });

      res.json({
        success: true,
        order: result.order,
        updatedProducts: result.updatedProducts,
      });
    } catch (err: any) {
      console.error("[API] PATCH /api/orders/:id/status error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour du statut." });
    }
  });

  app.post("/api/orders/bulk-delete", async (req, res) => {
    try {
      const { orderIds } = req.body;
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "Liste d'identifiants de commandes requise." });
      }
      const result = await storeDb.bulkDeleteOrders(orderIds);
      broadcastServerEvent("orders:bulk_deleted", {
        orderIds,
        updatedProducts: result.updatedProducts,
      });
      res.json({ success: true, deletedCount: result.deletedCount, updatedProducts: result.updatedProducts });
    } catch (err: any) {
      console.error("[API] POST /api/orders/bulk-delete error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression groupée." });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storeDb.deleteOrder(id);
      if (result.success) {
        broadcastServerEvent("order:deleted", {
          orderId: id,
          updatedProducts: result.updatedProducts,
        });
      }
      res.json({ success: result.success, updatedProducts: result.updatedProducts });
    } catch (err: any) {
      console.error("[API] DELETE /api/orders/:id error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de la commande." });
    }
  });

  // ---------------- CUSTOMER AUTHENTICATION & ACCOUNTS ----------------
  app.post("/api/auth/register", async (req, res) => {
    try {
      const {
        fullName,
        companyName,
        phone,
        secondaryPhone,
        email,
        password,
        wilayaCode,
        wilayaName,
        commune,
        deliveryAddress,
        notes,
        autoApprove = false,
      } = req.body;

      if (!fullName || !phone) {
        return res.status(400).json({ error: "Le nom complet et le téléphone sont obligatoires." });
      }

      const { application, user } = await storeDb.registerCustomer({
        fullName,
        companyName: companyName || fullName,
        phone,
        secondaryPhone,
        email: email || `${phone.replace(/\D/g, "")}@tulip-client.dz`,
        password,
        wilayaCode,
        wilayaName,
        commune,
        deliveryAddress,
        notes,
        autoApprove,
      });

      // Broadcast real-time customer registration event to admin
      broadcastServerEvent("customer:registered", {
        application,
        user,
      });

      // Trigger Telegram notification for new Access Request
      let telegramStatus: any = null;
      try {
        telegramStatus = await sendTelegramAccessRequestNotification({
          fullName,
          companyName,
          phone,
          secondaryPhone,
          email: email || `${phone.replace(/\D/g, "")}@tulip-client.dz`,
          wilayaCode,
          wilayaName,
          commune,
          deliveryAddress,
          notes,
          createdAt: new Date().toISOString(),
          status: autoApprove ? 'approved' : 'pending',
        });
      } catch (tgErr: any) {
        console.warn("[Telegram Bot] Access request notification error:", tgErr?.message);
      }

      res.status(201).json({
        success: true,
        message: "Compte client créé avec succès !",
        customer: user,
        application,
        telegram: telegramStatus,
      });
    } catch (err: any) {
      console.error("[API] POST /api/auth/register error:", err);
      res.status(500).json({ error: "Erreur lors de la création du compte client." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier) {
        return res.status(400).json({ error: "Identifiant requis." });
      }

      const result = await storeDb.authenticateCustomer(identifier, password);
      if (!result.success) {
        return res.status(401).json({
          success: false,
          error: result.error || "Identifiants incorrects.",
          status: result.status,
        });
      }

      res.json({
        success: true,
        customer: result.user,
      });
    } catch (err: any) {
      console.error("[API] POST /api/auth/login error:", err);
      res.status(500).json({ error: "Erreur lors de la tentative de connexion." });
    }
  });

  app.get("/api/customers", async (_req, res) => {
    try {
      const data = await storeDb.getCustomersDataAsync();
      res.json({ success: true, ...data });
    } catch (err: any) {
      console.error("[API] GET /api/customers error:", err);
      res.status(500).json({ error: "Impossible de récupérer les clients." });
    }
  });

  app.post("/api/customers/approve", async (req, res) => {
    try {
      const { applicationId, assignedUsername, assignedPassword, verificationNotes } = req.body;
      if (!applicationId || !assignedUsername || !assignedPassword) {
        return res.status(400).json({ error: "Données d'approbation incomplètes." });
      }

      const user = await storeDb.approveCustomerApplication(
        applicationId,
        assignedUsername,
        assignedPassword,
        verificationNotes
      );

      if (!user) {
        return res.status(404).json({ error: "Demande introuvable." });
      }

      broadcastServerEvent("customer:approved", { customer: user, applicationId });
      res.json({ success: true, customer: user });
    } catch (err: any) {
      console.error("[API] POST /api/customers/approve error:", err);
      res.status(500).json({ error: "Erreur lors de l'approbation." });
    }
  });

  app.patch("/api/customers/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = await storeDb.updateCustomerStatus(id, status);
      broadcastServerEvent("customer:updated", { customer: user, customerId: id });
      res.json({ success: true, customer: user });
    } catch (err: any) {
      console.error("[API] PATCH /api/customers/:id/status error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour du statut client." });
    }
  });

  app.patch("/api/customers/:id/reset-password", async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!newPassword) {
        return res.status(400).json({ error: "Nouveau mot de passe requis." });
      }

      const user = await storeDb.resetCustomerPassword(id, newPassword);
      broadcastServerEvent("customer:updated", { customer: user, customerId: id });
      res.json({ success: true, customer: user });
    } catch (err: any) {
      console.error("[API] PATCH /api/customers/:id/reset-password error:", err);
      res.status(500).json({ error: "Erreur lors de la réinitialisation du mot de passe." });
    }
  });

  app.post("/api/customers/create-direct", async (req, res) => {
    try {
      const user = await storeDb.createDirectCustomer(req.body);
      broadcastServerEvent("customer:created", { customer: user });
      res.status(201).json({ success: true, customer: user });
    } catch (err: any) {
      console.error("[API] POST /api/customers/create-direct error:", err);
      res.status(500).json({ error: "Erreur lors de la création directe du client." });
    }
  });

  app.post("/api/customers/import", async (req, res) => {
    try {
      const { customers, replaceExisting } = req.body;
      if (!Array.isArray(customers)) {
        return res.status(400).json({ error: "Liste de clients requise." });
      }
      const result = await storeDb.importCustomers(customers, Boolean(replaceExisting));
      broadcastServerEvent("customers:imported", {
        customerUsers: result.users,
        customerApplications: result.applications,
      });
      res.json({
        success: true,
        count: result.users.length,
        customerUsers: result.users,
        customerApplications: result.applications,
      });
    } catch (err: any) {
      console.error("[API] POST /api/customers/import error:", err);
      res.status(500).json({ error: "Erreur lors de l'importation des clients." });
    }
  });

  app.post("/api/restore", async (req, res) => {
    try {
      const { backup } = req.body;
      if (!backup || typeof backup !== "object") {
        return res.status(400).json({ error: "Données de sauvegarde requises." });
      }
      const restored = await storeDb.restoreDatabase(backup);
      broadcastServerEvent("database:restored", { lastUpdated: restored.lastUpdated });
      res.json({
        success: true,
        message: "Restauration effectuée avec succès.",
        data: {
          products: restored.products,
          orders: restored.orders,
          customerApplications: restored.customerApplications,
          customerUsers: restored.customerUsers,
          storeSettings: restored.storeSettings,
          adBanners: restored.adBanners,
          lastUpdated: restored.lastUpdated,
        },
      });
    } catch (err: any) {
      console.error("[API] POST /api/restore error:", err);
      res.status(500).json({ error: "Erreur lors de la restauration du site." });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storeDb.deleteCustomer(id);
      broadcastServerEvent("customer:deleted", { customerId: id });
      res.json({ success: true });
    } catch (err: any) {
      console.error("[API] DELETE /api/customers/:id error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression." });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedFields = req.body;
      const customer = await storeDb.updateCustomerDetails(id, updatedFields);
      if (!customer) {
        return res.status(404).json({ success: false, error: "Client introuvable." });
      }
      broadcastServerEvent("customer:updated", { customer });
      res.json({ success: true, customer });
    } catch (err: any) {
      console.error("[API] PUT /api/customers/:id error:", err);
      res.status(500).json({ success: false, error: "Erreur lors de la mise à jour." });
    }
  });

  app.post("/api/admin/users", async (req, res) => {
    try {
      const usersList = req.body;
      if (!Array.isArray(usersList)) {
        return res.status(400).json({ error: "Format invalide." });
      }
      const saved = await storeDb.saveAdminUsers(usersList);
      broadcastServerEvent("admin_users:updated", { adminUsers: saved });
      res.json({ success: true, adminUsers: saved });
    } catch (err: any) {
      console.error("[API] POST /api/admin/users error:", err);
      res.status(500).json({ error: "Erreur lors de la sauvegarde." });
    }
  });

  app.delete("/api/customers/application/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storeDb.deleteCustomerApplication(id);
      broadcastServerEvent("application:deleted", { applicationId: id });
      res.json({ success: true });
    } catch (err: any) {
      console.error("[API] DELETE /api/customers/application/:id error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de la demande." });
    }
  });

  // ---------------- PRODUCTS & INVENTORY ----------------
  app.get("/api/products", async (req, res) => {
    try {
      const isFresh = req.query.fresh === 'true' || req.query.bypass === 'true';
      if (!isFresh) {
        res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=300, stale-while-revalidate=600');
      } else {
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
      }
      const products = await storeDb.getProductsAsync();
      res.json({ success: true, products });
    } catch (err: any) {
      console.error("[API] GET /api/products error:", err);
      res.status(500).json({ error: "Impossible de récupérer les produits." });
    }
  });

  app.post("/api/products/sync", async (req, res) => {
    try {
      const { products } = req.body;
      if (!Array.isArray(products)) {
        return res.status(400).json({ error: "Liste de produits requise." });
      }

      const updated = await storeDb.syncProducts(products);
      broadcastServerEvent("products:updated", { products: updated });
      broadcastServerEvent("products:synced", { products: updated });
      res.json({ success: true, count: updated.length, products: updated });
    } catch (err: any) {
      console.error("[API] POST /api/products/sync error:", err);
      res.status(500).json({ error: "Erreur lors de la synchronisation du catalogue." });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const product = (req.body && req.body.product) ? req.body.product : req.body;
      if (!product || !product.name || !product.code) {
        return res.status(400).json({ error: "Nom et code de produit requis." });
      }
      const created = await storeDb.createSingleProduct(product);
      broadcastServerEvent("product:created", { product: created });
      res.status(201).json({ success: true, product: created });
    } catch (err: any) {
      console.error("[API] POST /api/products error:", err);
      res.status(500).json({ error: "Erreur lors de la création du produit." });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = (req.body && req.body.product) ? req.body.product : req.body;
      if (!product) {
        return res.status(400).json({ error: "Données de produit requises." });
      }
      const updated = await storeDb.saveSingleProduct({ ...product, id });
      broadcastServerEvent("product:updated", { product: updated });
      res.json({ success: true, product: updated });
    } catch (err: any) {
      console.error("[API] PUT /api/products/:id error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour du produit." });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { stock, priceDA, isHidden } = req.body;
      const updated = await storeDb.updateSingleProduct(id, stock, priceDA, isHidden);
      if (!updated) {
        return res.status(404).json({ error: "Produit introuvable." });
      }
      broadcastServerEvent("product:updated", { product: updated });
      res.json({ success: true, product: updated });
    } catch (err: any) {
      console.error("[API] PATCH /api/products/:id error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour du produit." });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storeDb.deleteSingleProduct(id);
      broadcastServerEvent("product:deleted", { productId: id, products: result.products });
      res.json({ success: true, products: result.products });
    } catch (err: any) {
      console.error("[API] DELETE /api/products/:id error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression du produit." });
    }
  });

  // ---------------- BANNERS & SETTINGS ----------------
  app.get("/api/banners", async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=600, stale-while-revalidate=1200');
      const banners = await storeDb.getBannersAsync();
      res.json({ success: true, banners });
    } catch (err: any) {
      res.status(500).json({ error: "Erreur lors de la récupération des bannières." });
    }
  });

  app.put("/api/banners", async (req, res) => {
    try {
      const { banners } = req.body;
      if (!Array.isArray(banners)) {
        return res.status(400).json({ error: "Tableau de bannières attendu." });
      }
      const updated = await storeDb.updateBanners(banners);
      broadcastServerEvent("banners:updated", { banners: updated });
      res.json({ success: true, banners: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Erreur lors de la mise à jour des bannières." });
    }
  });

  app.get("/api/settings", async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=600, stale-while-revalidate=1200');
      const settings = await storeDb.getSettingsAsync();
      res.json({ success: true, settings });
    } catch (err: any) {
      res.status(500).json({ error: "Erreur lors de la récupération des paramètres." });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const { settings } = req.body;
      const updated = await storeDb.updateSettings(settings);
      broadcastServerEvent("settings:updated", { settings: updated });
      res.json({ success: true, settings: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Erreur lors de la mise à jour des paramètres." });
    }
  });

  // Telegram Notification Endpoint for Finalized Pre-Orders
  app.post("/api/telegram/send-order", async (req, res) => {
    try {
      const { order, telegramPhone = "+213799938399" } = req.body;
      if (!order) {
        return res.status(400).json({ error: "Les détails de la précommande sont requis." });
      }

      const result: any = await sendTelegramOrderNotification(order, telegramPhone);
      return res.json({
        success: true,
        sentViaBot: result.sentViaBot,
        message: result.message,
        botResult: result.deliveryReports || result.botResult,
        directTelegramUrl: result.directTelegramUrl,
        telegramPhone,
      });
    } catch (err: any) {
      console.error("Error in /api/telegram/send-order:", err);
      return res.status(500).json({ error: "Erreur lors du traitement Telegram." });
    }
  });

  // Telegram Integration Status & Recent Bot Subscribers
  app.get("/api/telegram/status", async (_req, res) => {
    try {
      const db = await storeDb.loadDatabaseAsync();
      const settings: any = db.storeSettings || {};
      const config = await resolveTelegramConfig('general');
      const preorderConfig = await resolveTelegramConfig('preorder');
      const proformaConfig = await resolveTelegramConfig('proforma');
      const accessConfig = await resolveTelegramConfig('access');

      let botInfo: any = null;
      let updates: any[] = [];
      let apiError: string | null = null;

      if (config.token) {
        try {
          const meResp = await fetch(`https://api.telegram.org/bot${config.token}/getMe`);
          const meJson = await meResp.json();
          if (meJson.ok) {
            botInfo = meJson.result;
          } else {
            apiError = meJson.description;
          }

          const upResp = await fetch(`https://api.telegram.org/bot${config.token}/getUpdates`);
          const upJson = await upResp.json();
          if (upJson.ok && Array.isArray(upJson.result)) {
            const seen = new Set<string>();
            updates = upJson.result
              .map((u: any) => {
                const msg = u.message || u.channel_post || u.edited_message || u.my_chat_member;
                const cId = msg?.chat?.id ? String(msg.chat.id) : '';
                return {
                  chatId: cId,
                  chatType: msg?.chat?.type,
                  name: msg?.chat?.title || `${msg?.from?.first_name || ''} ${msg?.from?.last_name || ''}`.trim() || 'Utilisateur',
                  username: msg?.chat?.username || msg?.from?.username,
                  text: msg?.text || (msg?.chat?.type === 'group' ? `Groupe: ${msg?.chat?.title || ''}` : ''),
                  date: msg?.date ? new Date(msg.date * 1000).toISOString() : null,
                };
              })
              .filter((u: any) => {
                if (!u.chatId || seen.has(u.chatId)) return false;
                seen.add(u.chatId);
                return true;
              });
          }
        } catch (fetchErr: any) {
          apiError = fetchErr?.message || "Erreur de connexion API Telegram";
        }
      }

      res.json({
        configured: Boolean(config.token && botInfo),
        tokenMasked: config.token ? `${config.token.slice(0, 10)}...` : '',
        activeChats: config.chatIds,
        primaryChatId: config.primaryChatId,
        chatId: settings.telegramChatId || '',
        preorderChatId: settings.telegramPreorderChatId || '',
        proformaChatId: settings.telegramProformaChatId || '',
        accessChatId: settings.telegramAccessChatId || '',
        resolvedPreorderChats: preorderConfig.chatIds,
        resolvedProformaChats: proformaConfig.chatIds,
        resolvedAccessChats: accessConfig.chatIds,
        isChatIdSelfBot: false,
        enabled: config.enabled,
        bot: botInfo,
        subscribers: updates,
        error: apiError,
      });
    } catch (err: any) {
      console.error("[API] GET /api/telegram/status error:", err);
      res.status(500).json({ error: "Erreur lors de la vérification du statut Telegram." });
    }
  });

  // Telegram Live Chat ID Detector API
  app.all("/api/telegram/detect", async (req, res) => {
    try {
      const db = await storeDb.loadDatabaseAsync();
      const settings: any = db.storeSettings || {};
      const reqToken = req.body?.token || req.query?.token;
      const config = await resolveTelegramConfig('general');
      const token = reqToken || config.token;

      if (!token) {
        return res.status(400).json({
          success: false,
          count: 0,
          detectedChats: [],
          error: "Aucun token Telegram configuré.",
        });
      }

      // 1. Get bot info
      let botInfo: any = null;
      try {
        const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const meJson = await meRes.json();
        if (meJson.ok) {
          botInfo = meJson.result;
        }
      } catch (e: any) {
        console.warn("[Telegram Detector] getMe error:", e);
      }

      // 2. Check if webhook is active; if so, clear it temporarily to allow getUpdates
      try {
        const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const whJson = await whRes.json();
        if (whJson.ok && whJson.result?.url) {
          console.log("[Telegram Detector] Clearing webhook to allow getUpdates polling...");
          await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
        }
      } catch (e: any) {
        // ignore
      }

      // 3. Query getUpdates
      const detectedMap = new Map<string, any>();

      // Known / configured channels mapping helper
      const getAssignedChannels = (cId: string): string[] => {
        const assigned: string[] = [];
        const clean = cId.trim();
        if (settings.telegramPreorderChatId && settings.telegramPreorderChatId.includes(clean)) assigned.push('preorder');
        if (settings.telegramProformaChatId && settings.telegramProformaChatId.includes(clean)) assigned.push('proforma');
        if (settings.telegramAccessChatId && settings.telegramAccessChatId.includes(clean)) assigned.push('access');
        if (settings.telegramChatId && settings.telegramChatId.includes(clean)) assigned.push('general');
        return assigned;
      };

      // Seed known channels so they always appear in the detector
      const seedChats = [
        {
          chatId: '-5365585827',
          name: 'Groupe commande (Tulip)',
          chatType: 'group',
          lastMessage: 'Canal de diffusion officiel des commandes',
        },
        {
          chatId: '5680755596',
          name: 'Tulip Oran (Admin)',
          username: 'tulip_oran',
          chatType: 'private',
          lastMessage: 'Compte administrateur principal',
        },
      ];

      // Add user custom configured IDs if any
      const configuredCustom = [
        { id: settings.telegramPreorderChatId, label: 'Canal Précommandes Configuré' },
        { id: settings.telegramProformaChatId, label: 'Canal Proforma Configuré' },
        { id: settings.telegramAccessChatId, label: 'Canal Accès Pro Configuré' },
        { id: settings.telegramChatId, label: 'Canal Général Configuré' },
      ];

      for (const custom of configuredCustom) {
        if (custom.id) {
          const ids = extractChatIds(custom.id);
          for (const cId of ids) {
            if (!seedChats.some((s) => s.chatId === cId)) {
              seedChats.push({
                chatId: cId,
                name: custom.label,
                chatType: cId.startsWith('-') ? 'group' : 'private',
                lastMessage: 'ID enregistré dans les paramètres',
              });
            }
          }
        }
      }

      for (const s of seedChats) {
        detectedMap.set(s.chatId, {
          chatId: s.chatId,
          name: s.name,
          username: (s as any).username,
          chatType: s.chatType,
          lastMessage: s.lastMessage,
          date: new Date().toISOString(),
          isConfigured: getAssignedChannels(s.chatId).length > 0,
          assignedChannels: getAssignedChannels(s.chatId),
        });
      }

      // Fetch live updates from Telegram API
      try {
        const upRes = await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?limit=100&allowed_updates=${encodeURIComponent(
            JSON.stringify(['message', 'edited_message', 'channel_post', 'my_chat_member', 'chat_member'])
          )}`
        );
        const upJson = await upRes.json();

        if (upJson.ok && Array.isArray(upJson.result)) {
          for (const u of upJson.result) {
            const msg = u.message || u.channel_post || u.edited_message || u.my_chat_member;
            if (!msg?.chat?.id) continue;

            const cId = String(msg.chat.id);
            const chatType = msg.chat.type || (cId.startsWith('-') ? 'group' : 'private');
            const chatTitle =
              msg.chat.title ||
              `${msg.from?.first_name || ''} ${msg.from?.last_name || ''}`.trim() ||
              msg.chat.username ||
              'Utilisateur Telegram';

            const username = msg.chat.username || msg.from?.username;
            const text =
              msg.text ||
              (msg.chat.type === 'group' || msg.chat.type === 'supergroup'
                ? `Message groupe: ${msg.chat.title || ''}`
                : 'Interaction récente');

            const date = msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString();

            detectedMap.set(cId, {
              chatId: cId,
              name: chatTitle,
              username,
              chatType,
              lastMessage: text,
              date,
              isConfigured: getAssignedChannels(cId).length > 0,
              assignedChannels: getAssignedChannels(cId),
            });
          }
        }
      } catch (err) {
        console.warn("[Telegram Detector] getUpdates call warning:", err);
      }

      const detectedChats = Array.from(detectedMap.values());

      res.json({
        success: true,
        count: detectedChats.length,
        detectedChats,
        bot: botInfo,
      });
    } catch (err: any) {
      console.error("[API] /api/telegram/detect error:", err);
      res.status(500).json({
        success: false,
        count: 0,
        detectedChats: [],
        error: err.message || "Erreur interne du détecteur Telegram.",
      });
    }
  });

  // Telegram Test Notification Trigger
  app.post("/api/telegram/test", async (req, res) => {
    try {
      const { chatId: reqChatId, token: reqToken, channelType = 'general' } = req.body;
      const config = await resolveTelegramConfig(channelType as TelegramNotificationType);
      const activeToken = reqToken || config.token;

      if (!activeToken) {
        return res.status(400).json({ error: "Aucun Token de Bot Telegram configuré." });
      }

      const testTargets = reqChatId ? extractChatIds(String(reqChatId)) : config.chatIds;

      if (!testTargets || testTargets.length === 0) {
        return res.status(400).json({
          error: "Aucun destinataire Telegram configuré pour ce canal.",
        });
      }

      let typeTitle = 'GÉNÉRAL';
      let icon = '🔔';
      let typeDesc = 'Liaison directe avec votre boutique Tulip Fragrance';
      if (channelType === 'preorder') {
        typeTitle = 'PRÉCOMMANDES FERMES';
        icon = '🌸';
        typeDesc = 'Ce canal recevra automatiquement toutes les nouvelles précommandes.';
      } else if (channelType === 'proforma') {
        typeTitle = 'FACTURES PROFORMA';
        icon = '📄';
        typeDesc = 'Ce canal recevra automatiquement toutes les demandes de devis proforma.';
      } else if (channelType === 'access') {
        typeTitle = "DEMANDES D'ACCÈS PROFESSIONNEL";
        icon = '🔑';
        typeDesc = "Ce canal recevra automatiquement toutes les demandes d'inscription / accès pro.";
      }

      const testHtml =
        `${icon} <b>TEST CANAL DÉDIÉ - ${typeTitle}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ <b>Liaison Telegram confirmée !</b>\n` +
        `🤖 Bot actif : <code>@tulip5661bot</code>\n` +
        `📌 <b>Rôle de ce canal :</b> ${typeDesc}\n` +
        `📅 <i>Date du test : ${new Date().toLocaleString('fr-DZ')}</i>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🏢 <i>Tulip Fragrance Company • Bir El Djir, Oran</i>`;

      const results = [];
      for (const target of testTargets) {
        if (target === BOT_SELF_ID) continue;
        const tgResp = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: target,
            text: testHtml,
            parse_mode: "HTML",
          }),
        });
        const tgJson = await tgResp.json();
        results.push({ target, ok: Boolean(tgJson && tgJson.ok), data: tgJson });
      }

      const anySuccess = results.some((r) => r.ok);
      if (!anySuccess) {
        return res.status(400).json({
          success: false,
          error: "Impossible d'envoyer le message de test sur ce canal Telegram. Vérifiez l'ID et que le bot @tulip5661bot a été démarré ou ajouté au groupe.",
          results,
        });
      }

      return res.json({
        success: true,
        message: `Notification test [${typeTitle}] envoyée avec succès (${results.filter((r) => r.ok).length} canal/canaux) !`,
        results,
      });
    } catch (err: any) {
      console.error("[API] POST /api/telegram/test error:", err);
      return res.status(500).json({ error: "Erreur lors de l'envoi du test Telegram." });
    }
  });

  // Save Telegram Settings
  app.post("/api/telegram/save-settings", async (req, res) => {
    try {
      const {
        telegramChatId,
        telegramPreorderChatId,
        telegramProformaChatId,
        telegramAccessChatId,
        telegramBotToken,
        telegramNotificationsEnabled,
      } = req.body;
      const db = await storeDb.loadDatabaseAsync();
      const updatedSettings = {
        ...db.storeSettings,
        ...(telegramChatId !== undefined && { telegramChatId }),
        ...(telegramPreorderChatId !== undefined && { telegramPreorderChatId }),
        ...(telegramProformaChatId !== undefined && { telegramProformaChatId }),
        ...(telegramAccessChatId !== undefined && { telegramAccessChatId }),
        ...(telegramBotToken !== undefined && { telegramBotToken }),
        ...(telegramNotificationsEnabled !== undefined && { telegramNotificationsEnabled }),
      };
      storeDb.updateSettings(updatedSettings);
      return res.json({ success: true, settings: updatedSettings });
    } catch (err: any) {
      console.error("[API] POST /api/telegram/save-settings error:", err);
      return res.status(500).json({ error: "Erreur lors de l'enregistrement des paramètres Telegram." });
    }
  });


// Vercel Blob Storage - Media Upload, Import & Export
app.post("/api/media/upload", async (req, res) => {
  try {
    const { base64, filename = "upload.webp" } = req.body;
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: "Données base64 manquantes." });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.warn("[Media Upload] BLOB_READ_WRITE_TOKEN is missing. Returning raw base64 dataUrl as fallback.");
      return res.json({
        success: true,
        url: base64,
        fallback: true,
        message: "Stocké localement car BLOB_READ_WRITE_TOKEN n'est pas configuré."
      });
    }

    const matches = base64.match(/^data:([A-Za-z0-9\-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    let contentType = "image/webp";

    if (matches && matches.length === 3) {
      contentType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(base64, 'base64');
    }

    let finalFilename = filename;

    // Server-side Image Optimization & Compression via Sharp to reduce transfer sizes/egress
    if (contentType.startsWith("image/")) {
      try {
        const sharp = require('sharp');
        const optimizedBuffer = await sharp(buffer)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 65, effort: 4 })
          .toBuffer();
        
        buffer = optimizedBuffer;
        contentType = "image/webp";
        // Ensure web-optimized WebP extension
        if (!finalFilename.endsWith(".webp")) {
          const baseName = finalFilename.replace(/\.[^/.]+$/, "");
          finalFilename = `${baseName}.webp`;
        }
      } catch (sharpError) {
        console.warn("[Media Upload] Sharp compression notice (using raw buffer instead):", sharpError);
      }
    }

    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${finalFilename}`;

    const blob = await put(`media/${uniqueFilename}`, buffer, {
      access: 'public',
      contentType,
      token,
    });

    return res.json({
      success: true,
      url: blob.url,
      message: "Image mise en ligne avec succès sur Vercel Blob !"
    });
  } catch (err: any) {
    console.error("[Media Upload] Error uploading to Vercel Blob:", err);
    return res.status(500).json({ error: "Erreur lors de la mise en ligne du fichier: " + (err.message || String(err)) });
  }
});

app.post("/api/backup/export-blob", async (req, res) => {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return res.status(400).json({ error: "Vercel Blob n'est pas configuré. BLOB_READ_WRITE_TOKEN est requis." });
    }

    const db = await storeDb.loadDatabaseAsync(true);
    const dbString = JSON.stringify(db, null, 2);
    const buffer = Buffer.from(dbString, 'utf-8');

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `backup-tulip-${dateStr}.json`;

    const blob = await put(`backups/${filename}`, buffer, {
      access: 'public',
      contentType: 'application/json',
      token,
    });

    res.json({
      success: true,
      url: blob.url,
      filename,
      message: "Sauvegarde de la base de données exportée avec succès sur Vercel Blob !"
    });
  } catch (err: any) {
    console.error("[Backup Export] Vercel Blob export error:", err);
    res.status(500).json({ error: "Erreur lors de l'exportation: " + (err.message || String(err)) });
  }
});

app.post("/api/backup/import-blob", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ error: "URL de sauvegarde Vercel Blob requise." });
    }

    const resp = await fetch(url);
    if (!resp.ok) {
      return res.status(400).json({ error: "Impossible de récupérer le fichier de sauvegarde à l'adresse indiquée." });
    }

    const backup = await resp.json();
    if (!backup || typeof backup !== 'object' || !Array.isArray(backup.products)) {
      return res.status(400).json({ error: "Le fichier de sauvegarde récupéré n'est pas un fichier de sauvegarde Tulip valide." });
    }

    const restored = await storeDb.restoreDatabase(backup);
    broadcastServerEvent("database:restored", { lastUpdated: restored.lastUpdated });

    res.json({
      success: true,
      message: "Base de données importée et restaurée avec succès depuis Vercel Blob !",
      data: {
        products: restored.products,
        orders: restored.orders,
        customerApplications: restored.customerApplications,
        customerUsers: restored.customerUsers,
        storeSettings: restored.storeSettings,
        adBanners: restored.adBanners,
        lastUpdated: restored.lastUpdated,
      }
    });
  } catch (err: any) {
    console.error("[Backup Import] Vercel Blob import error:", err);
    res.status(500).json({ error: "Erreur lors de l'importation: " + (err.message || String(err)) });
  }
});

// Helper functions for Vercel Blob Extrait Image Association
function normalizeReferenceKey(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function extractReferenceVariants(str: string): string[] {
  const norm = normalizeReferenceKey(str);
  if (!norm) return [];
  const variants = new Set<string>([norm]);
  if (norm.startsWith('ext')) variants.add(norm.slice(3));
  if (norm.startsWith('art')) variants.add(norm.slice(3));
  if (norm.startsWith('prod')) variants.add(norm.slice(4));
  return Array.from(variants).filter(Boolean);
}

// 1. Check Vercel Blob Status
app.get("/api/blob/status", async (req, res) => {
  try {
    const db = await storeDb.loadDatabaseAsync(false);
    const token = db.storeSettings?.vercelBlobToken || process.env.BLOB_READ_WRITE_TOKEN;
    const folder = (db.storeSettings?.vercelBlobFolderName || 'extraits').trim();

    res.json({
      configured: Boolean(token),
      hasEnvToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      folderName: folder,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 2. List Extrait Images in Vercel Blob Folder
app.get("/api/blob/list-extrait-images", async (req, res) => {
  try {
    const db = await storeDb.loadDatabaseAsync(false);
    const token = (req.query.token as string) || db.storeSettings?.vercelBlobToken || process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return res.status(200).json({
        success: false,
        isConfigured: false,
        count: 0,
        files: [],
        error: "Vercel Blob n'est pas configuré. BLOB_READ_WRITE_TOKEN est requis.",
      });
    }

    let folder = ((req.query.folder as string) || db.storeSettings?.vercelBlobFolderName || 'extraits').trim();
    folder = folder.replace(/^\/+|\/+$/g, '');
    const folderPrefix = folder ? `${folder}/` : '';

    let allBlobs: any[] = [];
    let cursor: string | undefined = undefined;

    try {
      do {
        const result = await list({
          prefix: folderPrefix || undefined,
          limit: 1000,
          cursor,
          token,
        });
        allBlobs = allBlobs.concat(result.blobs || []);
        cursor = result.hasMore ? result.cursor : undefined;
      } while (cursor);
    } catch (listErr: any) {
      console.warn("[Blob API] List with prefix error, trying root:", listErr);
      try {
        const rootRes = await list({ limit: 1000, token });
        allBlobs = rootRes.blobs || [];
      } catch (rootErr: any) {
        return res.status(400).json({
          success: false,
          isConfigured: true,
          error: "Erreur de communication avec Vercel Blob: " + (rootErr.message || String(rootErr)),
        });
      }
    }

    const imageExtensions = /\.(jpg|jpeg|png|webp|avif|gif|svg)$/i;
    const imageBlobs = allBlobs.filter((b) => imageExtensions.test(b.pathname || b.url));

    const files = imageBlobs.map((b) => {
      const pathname = b.pathname || '';
      const filename = pathname.split('/').pop() || pathname;
      const nameWithoutExt = filename.replace(/\.[a-zA-Z0-9]+$/i, '');
      const refCandidate = nameWithoutExt.replace(/-[a-zA-Z0-9]{6,}$/, '');
      return {
        pathname,
        url: b.url,
        filename,
        referenceCandidate: refCandidate,
        size: b.size || 0,
        uploadedAt: b.uploadedAt,
      };
    });

    res.json({
      success: true,
      isConfigured: true,
      folder: folder || 'racine',
      count: files.length,
      files,
    });
  } catch (err: any) {
    console.error("[Blob API] list-extrait-images error:", err);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des fichiers: " + (err.message || String(err)),
    });
  }
});

// 3. Sync & Associate Extrait Images with Products
app.post("/api/blob/sync-extrait-images", async (req, res) => {
  try {
    const db = await storeDb.loadDatabaseAsync(true);
    const token =
      req.body?.token ||
      db.storeSettings?.vercelBlobToken ||
      process.env.BLOB_READ_WRITE_TOKEN;

    const requestedFolder = (
      req.body?.folderName ||
      db.storeSettings?.vercelBlobFolderName ||
      'extraits'
    ).trim();

    if (!token) {
      return res.status(200).json({
        success: false,
        isConfigured: false,
        matchedCount: 0,
        unmatchedCount: 0,
        totalExtraits: 0,
        folderName: requestedFolder,
        error: "Vercel Blob n'est pas encore configuré (BLOB_READ_WRITE_TOKEN manquant).",
      });
    }

    let folder = requestedFolder.replace(/^\/+|\/+$/g, '');
    const folderPrefix = folder ? `${folder}/` : '';

    let allBlobs: any[] = [];
    let cursor: string | undefined = undefined;

    try {
      do {
        const result = await list({
          prefix: folderPrefix || undefined,
          limit: 1000,
          cursor,
          token,
        });
        allBlobs = allBlobs.concat(result.blobs || []);
        cursor = result.hasMore ? result.cursor : undefined;
      } while (cursor);
    } catch (listErr: any) {
      console.warn("[Blob Sync] List with prefix error, fallback to root:", listErr);
      try {
        const rootResult = await list({ limit: 1000, token });
        allBlobs = rootResult.blobs || [];
      } catch (rootErr: any) {
        return res.status(400).json({
          success: false,
          isConfigured: true,
          error: "Erreur de connexion à Vercel Blob: " + (rootErr.message || String(rootErr)),
        });
      }
    }

    const imageExtensions = /\.(jpg|jpeg|png|webp|avif|gif|svg)$/i;
    const imageBlobs = allBlobs.filter((b) => imageExtensions.test(b.pathname || b.url));

    // Index images by candidate reference variants
    const blobMap = new Map<string, { url: string; pathname: string; filename: string }>();
    const blobRefRecords: Array<{ filename: string; variants: string[]; url: string; pathname: string }> = [];

    for (const b of imageBlobs) {
      const pathname = b.pathname || '';
      const filename = pathname.split('/').pop() || pathname;
      const nameWithoutExt = filename.replace(/\.[a-zA-Z0-9]+$/i, '');
      const withoutVercelHash = nameWithoutExt.replace(/-[a-zA-Z0-9]{6,}$/, '');

      const variants = new Set<string>();
      extractReferenceVariants(nameWithoutExt).forEach((v) => variants.add(v));
      extractReferenceVariants(withoutVercelHash).forEach((v) => variants.add(v));

      const record = {
        filename,
        variants: Array.from(variants),
        url: b.url,
        pathname,
      };
      blobRefRecords.push(record);

      for (const v of variants) {
        if (!blobMap.has(v)) {
          blobMap.set(v, { url: b.url, pathname, filename });
        }
      }
    }

    const inputProducts: any[] = Array.isArray(req.body?.products)
      ? req.body.products
      : db.products;

    let matchedCount = 0;
    const matchedList: Array<{ code: string; name: string; imageUrl: string; filename: string }> = [];
    const unmatchedCodes: string[] = [];
    const matchedBlobFilenames = new Set<string>();

    const updatedProducts = inputProducts.map((p) => {
      if (p.family !== 'Extrait') {
        return p;
      }

      const prodVariants = new Set<string>();
      extractReferenceVariants(p.code).forEach((v) => prodVariants.add(v));
      extractReferenceVariants(p.id).forEach((v) => prodVariants.add(v));

      const nameCodeMatches = (p.name || '').match(/\b([A-Za-z]{1,4}[-_ ]?\d{1,5})\b/g);
      if (nameCodeMatches) {
        nameCodeMatches.forEach((m: string) => {
          extractReferenceVariants(m).forEach((v) => prodVariants.add(v));
        });
      }

      let matchedMatch: { url: string; pathname: string; filename: string } | null = null;
      for (const v of prodVariants) {
        if (blobMap.has(v)) {
          matchedMatch = blobMap.get(v)!;
          break;
        }
      }

      if (matchedMatch) {
        matchedCount++;
        matchedBlobFilenames.add(matchedMatch.filename);
        matchedList.push({
          code: p.code,
          name: p.name,
          imageUrl: matchedMatch.url,
          filename: matchedMatch.filename,
        });
        return {
          ...p,
          imageUrl: matchedMatch.url,
          lastUpdated: new Date().toISOString(),
        };
      } else {
        unmatchedCodes.push(p.code);
        return p;
      }
    });

    const unmatchedBlobs = blobRefRecords
      .filter((r) => !matchedBlobFilenames.has(r.filename))
      .map((r) => r.filename);

    const totalExtraits = inputProducts.filter((p) => p.family === 'Extrait').length;
    const unmatchedCount = totalExtraits - matchedCount;

    const saveToDatabase = req.body?.saveToDatabase !== false;
    if (saveToDatabase && matchedCount > 0) {
      await storeDb.syncProducts(updatedProducts);
      broadcastServerEvent("products:updated", { products: updatedProducts });
    }

    res.json({
      success: true,
      isConfigured: true,
      folderName: folder,
      totalExtraits,
      matchedCount,
      unmatchedCount,
      totalImagesInFolder: imageBlobs.length,
      matchedList,
      unmatchedCodes: unmatchedCodes.slice(0, 50),
      unmatchedBlobs: unmatchedBlobs.slice(0, 50),
      products: updatedProducts,
      message: `${matchedCount} images d'extraits associées avec succès depuis le dossier Vercel Blob "${folder}".`,
    });
  } catch (err: any) {
    console.error("[Blob Sync] Error syncing extrait images:", err);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la synchronisation des images: " + (err.message || String(err)),
    });
  }
});

// 4. Compress & Move Extrait Images in Vercel Blob
app.post("/api/blob/compress-and-move-extrait-images", async (req, res) => {
  try {
    const db = await storeDb.loadDatabaseAsync(true);
    const token =
      req.body?.token ||
      db.storeSettings?.vercelBlobToken ||
      process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
      return res.status(200).json({
        success: false,
        error: "Vercel Blob n'est pas configuré (BLOB_READ_WRITE_TOKEN manquant).",
      });
    }

    const sourceFolder = (req.body?.sourceFolder || 'extraits-raw').trim().replace(/^\/+|\/+$/g, '');
    const targetFolder = (req.body?.targetFolder || db.storeSettings?.vercelBlobFolderName || 'extraits').trim().replace(/^\/+|\/+$/g, '');
    const deleteSource = Boolean(req.body?.deleteSourceAfter);
    const maxDimension = Math.min(2400, Math.max(400, Number(req.body?.maxDimension) || 1200));
    const quality = Math.min(100, Math.max(50, Number(req.body?.quality) || 82));

    const sourcePrefix = sourceFolder ? `${sourceFolder}/` : '';
    let allBlobs: any[] = [];
    let cursor: string | undefined = undefined;

    do {
      const result = await list({
        prefix: sourcePrefix || undefined,
        limit: 1000,
        cursor,
        token,
      });
      allBlobs = allBlobs.concat(result.blobs || []);
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);

    const imageExtensions = /\.(jpg|jpeg|png|webp|avif|tiff|bmp)$/i;
    const candidateBlobs = allBlobs.filter((b) => imageExtensions.test(b.pathname || b.url));

    if (candidateBlobs.length === 0) {
      return res.json({
        success: true,
        processedCount: 0,
        totalOriginalBytes: 0,
        totalCompressedBytes: 0,
        savedBytes: 0,
        overallSavedPercent: 0,
        matchedProductsCount: 0,
        sourceFolder,
        targetFolder,
        details: [],
        message: `Aucune image trouvée dans le dossier source "${sourceFolder}".`,
      });
    }

    let processedCount = 0;
    let totalOriginalBytes = 0;
    let totalCompressedBytes = 0;
    const processedList: Array<{
      filename: string;
      originalUrl: string;
      compressedUrl: string;
      originalSize: number;
      compressedSize: number;
      savedPercent: number;
    }> = [];

    for (const b of candidateBlobs) {
      try {
        const pathname = b.pathname || '';
        const rawFilename = pathname.split('/').pop() || pathname;
        const nameWithoutExt = rawFilename.replace(/\.[a-zA-Z0-9]+$/i, '');
        const cleanName = nameWithoutExt.replace(/-[a-zA-Z0-9]{6,}$/, '');
        const targetFilename = `${cleanName}.webp`;
        const targetPath = targetFolder ? `${targetFolder}/${targetFilename}` : targetFilename;

        // Fetch original
        const resp = await fetch(b.url);
        if (!resp.ok) continue;
        const arrayBuf = await resp.arrayBuffer();
        const originalBuffer = Buffer.from(arrayBuf);
        const originalSize = originalBuffer.length;
        totalOriginalBytes += originalSize;

        // Compress to responsive WebP with sharp
        const compressedBuffer = await sharp(originalBuffer)
          .rotate()
          .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
          .webp({ quality, effort: 4 })
          .toBuffer();

        const compressedSize = compressedBuffer.length;
        totalCompressedBytes += compressedSize;

        // Upload compressed image
        const uploadedBlob = await put(targetPath, compressedBuffer, {
          access: 'public',
          contentType: 'image/webp',
          token,
          addRandomSuffix: false,
        });

        // Optionally delete original uncompressed image from source folder
        if (deleteSource && b.url !== uploadedBlob.url) {
          try {
            await del(b.url, { token });
          } catch (delErr) {
            console.warn('[Blob Compress] Del original warning:', delErr);
          }
        }

        const savedPercent = originalSize > 0 ? Math.round(((originalSize - compressedSize) / originalSize) * 100) : 0;
        processedCount++;
        processedList.push({
          filename: targetFilename,
          originalUrl: b.url,
          compressedUrl: uploadedBlob.url,
          originalSize,
          compressedSize,
          savedPercent,
        });
      } catch (itemErr: any) {
        console.error(`[Blob Compress] Error on ${b.url}:`, itemErr?.message || itemErr);
      }
    }

    // Automatically re-sync and associate with products
    let matchedProductsCount = 0;
    if (processedList.length > 0) {
      const blobMap = new Map<string, string>();
      for (const item of processedList) {
        const baseName = item.filename.replace(/\.[a-zA-Z0-9]+$/i, '');
        extractReferenceVariants(baseName).forEach((v) => blobMap.set(v, item.compressedUrl));
      }

      let updatedAny = false;
      const updatedProducts = db.products.map((p) => {
        if (p.family !== 'Extrait') return p;
        const variants = [
          ...extractReferenceVariants(p.code),
          ...extractReferenceVariants(p.id),
        ];
        for (const v of variants) {
          if (blobMap.has(v)) {
            matchedProductsCount++;
            updatedAny = true;
            return {
              ...p,
              imageUrl: blobMap.get(v)!,
              lastUpdated: new Date().toISOString(),
            };
          }
        }
        return p;
      });

      if (updatedAny) {
        await storeDb.syncProducts(updatedProducts);
        broadcastServerEvent("products:updated", { products: updatedProducts });
      }
    }

    const savedBytes = Math.max(0, totalOriginalBytes - totalCompressedBytes);
    const overallSavedPercent = totalOriginalBytes > 0
      ? Math.round((savedBytes / totalOriginalBytes) * 100)
      : 0;

    res.json({
      success: true,
      processedCount,
      totalOriginalBytes,
      totalCompressedBytes,
      savedBytes,
      overallSavedPercent,
      matchedProductsCount,
      targetFolder,
      sourceFolder,
      details: processedList,
      message: `${processedCount} photos compressées avec succès (-${overallSavedPercent}% de poids) et transférées vers "${targetFolder}". ${matchedProductsCount} extraits mis à jour.`,
    });
  } catch (err: any) {
    console.error("[Blob Compress] Error:", err);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la compression des images: " + (err.message || String(err)),
    });
  }
});

// 5. Direct Upload & Auto-Compress to Vercel Blob
app.post("/api/blob/upload-and-compress-extrait-image", async (req, res) => {
  try {
    const db = await storeDb.loadDatabaseAsync(true);
    const token =
      req.body?.token ||
      db.storeSettings?.vercelBlobToken ||
      process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
      return res.status(200).json({
        success: false,
        error: "Vercel Blob n'est pas configuré (BLOB_READ_WRITE_TOKEN manquant).",
      });
    }

    const { fileName, base64Data, folderName } = req.body || {};
    if (!base64Data || !fileName) {
      return res.status(400).json({ success: false, error: "fileName et base64Data sont obligatoires." });
    }

    const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9\-+.]+;base64,/, '');
    const rawBuffer = Buffer.from(cleanBase64, 'base64');
    const originalSize = rawBuffer.length;

    // Compress to WebP
    const compressedBuffer = await sharp(rawBuffer)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    const compressedSize = compressedBuffer.length;

    const baseName = fileName.replace(/\.[a-zA-Z0-9]+$/i, '');
    const cleanName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetFolder = (folderName || db.storeSettings?.vercelBlobFolderName || 'extraits').trim().replace(/^\/+|\/+$/g, '');
    const targetPath = targetFolder ? `${targetFolder}/${cleanName}.webp` : `${cleanName}.webp`;

    const blob = await put(targetPath, compressedBuffer, {
      access: 'public',
      contentType: 'image/webp',
      token,
      addRandomSuffix: false,
    });

    const savedPercent = originalSize > 0 ? Math.round(((originalSize - compressedSize) / originalSize) * 100) : 0;

    // Associate with matching extrait product if exists
    let matchedProductCode: string | null = null;
    const variants = extractReferenceVariants(cleanName);
    const updatedProducts = db.products.map((p) => {
      if (p.family !== 'Extrait') return p;
      const pVariants = [
        ...extractReferenceVariants(p.code),
        ...extractReferenceVariants(p.id),
      ];
      for (const v of variants) {
        if (pVariants.includes(v)) {
          matchedProductCode = p.code;
          return {
            ...p,
            imageUrl: blob.url,
            lastUpdated: new Date().toISOString(),
          };
        }
      }
      return p;
    });

    if (matchedProductCode) {
      await storeDb.syncProducts(updatedProducts);
      broadcastServerEvent("products:updated", { products: updatedProducts });
    }

    res.json({
      success: true,
      url: blob.url,
      filename: `${cleanName}.webp`,
      originalSize,
      compressedSize,
      savedPercent,
      matchedProductCode,
      message: `Image ${cleanName}.webp compressée (-${savedPercent}%) et téléversée dans Vercel Blob.${matchedProductCode ? ` Associée à l'extrait ${matchedProductCode}.` : ''}`,
    });
  } catch (err: any) {
    console.error("[Blob Direct Upload] Error:", err);
    res.status(500).json({
      success: false,
      error: "Erreur de téléversement et compression: " + (err.message || String(err)),
    });
  }
});

// Fallback for root API endpoint
app.get("/api", (_req, res) => {
  res.json({
    status: "ok",
    company: "Tulip Fragrance Company",
    message: "Tulip Fragrance Company API is operational.",
    timestamp: new Date().toISOString(),
  });
});

export default app;
