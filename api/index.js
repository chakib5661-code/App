// src/server/app.ts
import express from "express";
import path2 from "path";
import dotenv from "dotenv";

// src/server/storeDb.ts
import fs from "fs";
import path from "path";

// src/data/initialProducts.ts
var INITIAL_STORE_SETTINGS = {
  storeName: "Tulip Fragrance Company",
  tagline: "Maison de Haute Parfumerie & Mati\xE8res Premi\xE8res en Alg\xE9rie",
  phone: "0799938399",
  phoneSecondary: "0559061552",
  whatsappPhone: "213799938399",
  telegramPhone: "213799938399",
  address: "Boulevard des Lions, Bir El Djir",
  wilaya: "31 - Oran",
  email: "contact@tulipfragrance.com",
  allowLowStockPreorder: true,
  minOrderAmountDA: 1e3,
  telegramBotToken: "8908435035:AAFYIq74hxJeFeiQAPRx_g_WZ7R5fL0uwu8",
  telegramChatId: "",
  telegramPreorderChatId: "",
  telegramProformaChatId: "",
  telegramAccessChatId: "",
  telegramNotificationsEnabled: true
};
var INITIAL_PRODUCTS = [];

// src/data/initialCustomerData.ts
var INITIAL_CUSTOMER_APPLICATIONS = [];
var INITIAL_AD_BANNERS = [];

// src/server/supabaseDb.ts
import { createClient } from "@supabase/supabase-js";
function getSupabaseCredentials() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return { url, key };
}
function isSupabaseConfigured() {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key && url.startsWith("http") && !url.includes("your-project-id"));
}
var supabaseInstance = null;
var lastSyncTimestamp = 0;
function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    const { url, key } = getSupabaseCredentials();
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabaseInstance;
}
async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      details: "Supabase credentials not configured in environment variables (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY)."
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return {
      configured: true,
      connected: false,
      error: "Failed to initialize Supabase client."
    };
  }
  try {
    const { url } = getSupabaseCredentials();
    const { data: stateData, error: stateError } = await client.from("tulip_store_state").select("key, updated_at").eq("key", "main_state").maybeSingle();
    const hasStateTable = !stateError || stateError.code !== "42P01";
    return {
      configured: true,
      connected: true,
      url: url ? url.replace(/^(https?:\/\/[^.]+).*/, "$1.supabase.co") : "",
      hasStateTable,
      details: hasStateTable ? "Connected to Supabase. Master state table (tulip_store_state) is active and ready." : "Connected to Supabase. Table tulip_store_state not created yet. Please execute supabase-schema.sql in your Supabase SQL editor."
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      error: err?.message || String(err)
    };
  }
}
async function loadDatabaseFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from("tulip_store_state").select("data, updated_at").eq("key", "main_state").maybeSingle();
    if (!error && data && data.data && Array.isArray(data.data.products)) {
      lastSyncTimestamp = Date.now();
      const loaded = data.data;
      if (Array.isArray(loaded.orders)) {
        loaded.orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      console.log("[Supabase] Loaded store database snapshot from table tulip_store_state.");
      return loaded;
    }
    const [prodsRes, ordersRes, appsRes, usersRes, bannersRes, settingsRes] = await Promise.allSettled([
      client.from("tulip_products").select("*"),
      client.from("tulip_orders").select("*"),
      client.from("tulip_customer_applications").select("*"),
      client.from("tulip_customer_users").select("*"),
      client.from("tulip_ad_banners").select("*"),
      client.from("tulip_store_settings").select("*").limit(1).maybeSingle()
    ]);
    const prods = prodsRes.status === "fulfilled" && prodsRes.value.data ? prodsRes.value.data : null;
    if (prods && Array.isArray(prods) && prods.length > 0) {
      const orders = ordersRes.status === "fulfilled" && ordersRes.value.data ? ordersRes.value.data : [];
      const apps = appsRes.status === "fulfilled" && appsRes.value.data ? appsRes.value.data : [];
      const users = usersRes.status === "fulfilled" && usersRes.value.data ? usersRes.value.data : [];
      const banners = bannersRes.status === "fulfilled" && bannersRes.value.data ? bannersRes.value.data : [];
      const settings = settingsRes.status === "fulfilled" && settingsRes.value.data ? settingsRes.value.data : null;
      const loadedDb = {
        products: prods,
        orders,
        customerApplications: apps,
        customerUsers: users,
        adBanners: banners,
        storeSettings: settings || void 0,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      };
      lastSyncTimestamp = Date.now();
      console.log("[Supabase] Loaded store database from normalized tables.");
      return loadedDb;
    }
    return null;
  } catch (err) {
    console.warn("[Supabase] loadDatabaseFromSupabase notice:", err);
    return null;
  }
}
async function saveDatabaseToSupabase(db) {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    if (Array.isArray(db.orders)) {
      db.orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    const payload = {
      key: "main_state",
      data: db,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { error } = await client.from("tulip_store_state").upsert(payload, { onConflict: "key" });
    if (error) {
      console.warn("[Supabase] Notice upserting to tulip_store_state:", error.message);
      return false;
    }
    lastSyncTimestamp = Date.now();
    syncNormalizedTablesAsync(client, db).catch((syncErr) => {
      console.warn("[Supabase] Normalized tables background sync note:", syncErr?.message || syncErr);
    });
    return true;
  } catch (err) {
    console.warn("[Supabase] saveDatabaseToSupabase error:", err?.message || err);
    return false;
  }
}
async function syncNormalizedTablesAsync(client, db) {
  try {
    if (db.storeSettings) {
      await Promise.resolve(
        client.from("tulip_store_settings").upsert({
          id: "default",
          ...db.storeSettings,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, { onConflict: "id" })
      ).catch(() => {
      });
    }
    if (Array.isArray(db.products) && db.products.length > 0) {
      const batch = db.products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        name_ar: p.arabicName || null,
        family: p.family,
        sub_family: p.category || null,
        notes: null,
        price_da: p.priceDA,
        stock: p.stock,
        unit: p.unit,
        description: p.description || null,
        image_url: p.imageUrl || null,
        is_hidden: Boolean(p.isHidden),
        is_featured: Boolean(p.isTopSeller),
        is_new: false,
        discount_percent: p.discountPercent || null,
        fragrance_pyramid: null,
        safety_data: null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }));
      for (let i = 0; i < batch.length; i += 50) {
        await Promise.resolve(
          client.from("tulip_products").upsert(batch.slice(i, i + 50), { onConflict: "id" })
        ).catch(() => {
        });
      }
    }
    if (Array.isArray(db.orders) && db.orders.length > 0) {
      const ordersBatch = db.orders.map((o) => ({
        id: o.id,
        order_number: o.orderNumber,
        status: o.status,
        date: o.date,
        total_da: o.totalDA,
        is_proforma: Boolean(o.isProforma),
        customer: o.customer,
        items: o.items,
        notes: o.customer?.notes || null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }));
      for (let i = 0; i < ordersBatch.length; i += 25) {
        await Promise.resolve(
          client.from("tulip_orders").upsert(ordersBatch.slice(i, i + 25), { onConflict: "id" })
        ).catch(() => {
        });
      }
    }
  } catch {
  }
}

// src/server/storeDb.ts
var IS_VERCEL = Boolean(process.env.VERCEL);
var DATA_DIR = process.env.DATA_DIR || (IS_VERCEL ? path.join("/tmp", "tulip-data") : path.join(process.cwd(), "data"));
var DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, "store_db.json");
var SEED_FILE = path.join(process.cwd(), "data", "store_db.json");
function normalizePhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : digits;
}
function getInitialDatabase() {
  const initialUsers = INITIAL_CUSTOMER_APPLICATIONS.filter(
    (app2) => app2.status === "approved"
  ).map((app2) => ({
    id: app2.id,
    username: app2.assignedUsername || app2.email.split("@")[0],
    password: app2.assignedPassword || "tulip2026",
    fullName: app2.fullName,
    companyName: app2.companyName,
    email: app2.email,
    phone: app2.phone,
    secondaryPhone: app2.secondaryPhone,
    wilayaCode: app2.wilayaCode,
    wilayaName: app2.wilayaName,
    commune: app2.commune,
    deliveryAddress: app2.deliveryAddress,
    status: "approved",
    createdAt: app2.approvedAt || app2.submittedAt
  }));
  return {
    products: INITIAL_PRODUCTS,
    orders: [],
    customerApplications: INITIAL_CUSTOMER_APPLICATIONS,
    customerUsers: initialUsers,
    adBanners: INITIAL_AD_BANNERS,
    storeSettings: INITIAL_STORE_SETTINGS,
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var cachedDb = null;
var lastSupabaseFetchTime = 0;
function loadDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE) && fs.existsSync(SEED_FILE) && path.resolve(DB_FILE) !== path.resolve(SEED_FILE)) {
      try {
        fs.copyFileSync(SEED_FILE, DB_FILE);
      } catch (copyErr) {
        console.warn("[StoreDB] Could not copy seed db:", copyErr);
      }
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.products)) {
        const loadedProducts = parsed.products.length > 0 ? parsed.products : INITIAL_PRODUCTS;
        cachedDb = {
          products: loadedProducts,
          orders: Array.isArray(parsed.orders) ? parsed.orders.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          ) : [],
          customerApplications: Array.isArray(parsed.customerApplications) ? parsed.customerApplications : [],
          customerUsers: Array.isArray(parsed.customerUsers) ? parsed.customerUsers : [],
          adBanners: Array.isArray(parsed.adBanners) ? parsed.adBanners : [],
          storeSettings: parsed.storeSettings || INITIAL_STORE_SETTINGS,
          lastUpdated: parsed.lastUpdated || (/* @__PURE__ */ new Date()).toISOString()
        };
        return cachedDb;
      }
    }
  } catch (err) {
    console.error("[StoreDB] Error reading DB_FILE:", err);
  }
  cachedDb = getInitialDatabase();
  return cachedDb;
}
async function loadDatabaseAsync(forceRefresh = false) {
  const now = Date.now();
  if (isSupabaseConfigured()) {
    try {
      const remoteDb = await loadDatabaseFromSupabase();
      if (remoteDb && Array.isArray(remoteDb.products) && remoteDb.products.length > 0) {
        if (Array.isArray(remoteDb.orders)) {
          remoteDb.orders.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        }
        cachedDb = remoteDb;
        lastSupabaseFetchTime = now;
        try {
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
          }
          fs.writeFileSync(DB_FILE, JSON.stringify(remoteDb, null, 2), "utf-8");
        } catch {
        }
        return cachedDb;
      } else {
        const localDb = loadDatabase();
        console.log("[StoreDB] Supabase is empty. Seeding initial data to Supabase...");
        await saveDatabaseToSupabase(localDb);
        cachedDb = localDb;
        lastSupabaseFetchTime = now;
        return cachedDb;
      }
    } catch (err) {
      console.warn("[StoreDB] loadDatabaseAsync error from Supabase, using local cache fallback:", err);
    }
  }
  return loadDatabase();
}
async function persistDatabaseAsync(db) {
  try {
    db.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    if (!Array.isArray(db.products) || db.products.length === 0) {
      if (cachedDb && Array.isArray(cachedDb.products) && cachedDb.products.length > 0) {
        db.products = cachedDb.products;
      } else {
        db.products = [...INITIAL_PRODUCTS];
      }
    }
    if (Array.isArray(db.orders)) {
      db.orders.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }
    cachedDb = db;
    if (isSupabaseConfigured()) {
      const saved = await saveDatabaseToSupabase(db);
      if (!saved) {
        console.warn("[StoreDB] Notice: Supabase cloud write did not report success.");
      }
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    } catch (fsErr) {
    }
  } catch (err) {
    console.error("[StoreDB] Error in persistDatabaseAsync:", err);
  }
}
async function syncWithSupabaseAsync() {
  return await loadDatabaseAsync(true);
}
async function getAllOrdersAsync() {
  const db = await loadDatabaseAsync();
  return [...db.orders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
async function createOrder(orderPayload) {
  const db = await loadDatabaseAsync(true);
  const timestamp = Date.now();
  const isProforma = Boolean(orderPayload.isProforma);
  const prefix = isProforma ? "PRO" : "PRE";
  const orderNumber = orderPayload.orderNumber || `${prefix}-${(/* @__PURE__ */ new Date()).getFullYear()}-${timestamp.toString().slice(-5)}`;
  const orderId = orderPayload.id || `order-${timestamp}-${Math.random().toString(36).slice(2, 6)}`;
  const newOrder = {
    ...orderPayload,
    id: orderId,
    orderNumber,
    date: orderPayload.date || (/* @__PURE__ */ new Date()).toISOString(),
    status: orderPayload.status || "en_attente",
    isProforma,
    isOfflinePending: false
  };
  const existingIndex = db.orders.findIndex(
    (o) => o.id === orderId || o.orderNumber === orderNumber
  );
  if (existingIndex >= 0) {
    db.orders[existingIndex] = newOrder;
  } else {
    db.products = db.products.map((prod) => {
      const item = newOrder.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        const newStock = Math.max(0, prod.stock - item.quantity);
        return {
          ...prod,
          stock: newStock,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      return prod;
    });
    db.orders.unshift(newOrder);
  }
  db.orders.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  await persistDatabaseAsync(db);
  return { order: newOrder, updatedProducts: db.products };
}
async function updateOrderStatus(orderId, status) {
  const db = await loadDatabaseAsync(true);
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return null;
  const oldStatus = order.status;
  order.status = status;
  if (oldStatus !== "annulee" && status === "annulee") {
    db.products = db.products.map((prod) => {
      const item = order.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        return {
          ...prod,
          stock: prod.stock + item.quantity,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      return prod;
    });
  } else if (oldStatus === "annulee" && status !== "annulee") {
    db.products = db.products.map((prod) => {
      const item = order.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - item.quantity),
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      return prod;
    });
  }
  await persistDatabaseAsync(db);
  return { order, updatedProducts: db.products };
}
async function updateOrder(orderId, patch) {
  const db = await loadDatabaseAsync(true);
  const index = db.orders.findIndex((o) => o.id === orderId);
  if (index === -1) return null;
  const currentOrder = db.orders[index];
  const oldStatus = currentOrder.status;
  const newStatus = patch.status !== void 0 ? patch.status : oldStatus;
  if (oldStatus !== "annulee" && newStatus === "annulee") {
    db.products = db.products.map((prod) => {
      const item = currentOrder.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        return {
          ...prod,
          stock: prod.stock + item.quantity,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      return prod;
    });
  } else if (oldStatus === "annulee" && newStatus !== "annulee") {
    db.products = db.products.map((prod) => {
      const item = currentOrder.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - item.quantity),
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      return prod;
    });
  }
  const updated = {
    ...currentOrder,
    ...patch,
    id: currentOrder.id
  };
  db.orders[index] = updated;
  await persistDatabaseAsync(db);
  return { order: updated, updatedProducts: db.products };
}
async function deleteOrder(orderId) {
  const db = await loadDatabaseAsync(true);
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return { success: false };
  if (order.status !== "annulee") {
    db.products = db.products.map((prod) => {
      const item = order.items.find((i) => i.productId === prod.id || i.code === prod.code);
      if (item && item.quantity > 0) {
        return {
          ...prod,
          stock: prod.stock + item.quantity,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      return prod;
    });
  }
  db.orders = db.orders.filter((o) => o.id !== orderId);
  await persistDatabaseAsync(db);
  return { success: true, updatedProducts: db.products };
}
async function bulkDeleteOrders(orderIds) {
  const db = await loadDatabaseAsync(true);
  const idSet = new Set(orderIds);
  const ordersToDelete = db.orders.filter((o) => idSet.has(o.id));
  if (ordersToDelete.length === 0) {
    return { success: false, deletedCount: 0, updatedProducts: db.products };
  }
  ordersToDelete.forEach((order) => {
    if (order.status !== "annulee") {
      db.products = db.products.map((prod) => {
        const item = order.items.find((i) => i.productId === prod.id || i.code === prod.code);
        if (item && item.quantity > 0) {
          return {
            ...prod,
            stock: prod.stock + item.quantity,
            lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
        return prod;
      });
    }
  });
  db.orders = db.orders.filter((o) => !idSet.has(o.id));
  await persistDatabaseAsync(db);
  return { success: true, deletedCount: ordersToDelete.length, updatedProducts: db.products };
}
async function syncOrders(ordersList) {
  const db = await loadDatabaseAsync(true);
  const incomingMap = /* @__PURE__ */ new Map();
  ordersList.forEach((o) => incomingMap.set(o.id, o));
  ordersList.forEach((incoming) => {
    const existing = db.orders.find((o) => o.id === incoming.id);
    if (existing) {
      if (existing.status !== "annulee" && incoming.status === "annulee") {
        db.products = db.products.map((prod) => {
          const item = incoming.items.find((i) => i.productId === prod.id || i.code === prod.code);
          if (item && item.quantity > 0) {
            return {
              ...prod,
              stock: prod.stock + item.quantity,
              lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
            };
          }
          return prod;
        });
      } else if (existing.status === "annulee" && incoming.status !== "annulee") {
        db.products = db.products.map((prod) => {
          const item = incoming.items.find((i) => i.productId === prod.id || i.code === prod.code);
          if (item && item.quantity > 0) {
            return {
              ...prod,
              stock: Math.max(0, prod.stock - item.quantity),
              lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
            };
          }
          return prod;
        });
      }
    }
  });
  const mergedOrders = [];
  const processedIds = /* @__PURE__ */ new Set();
  for (const o of ordersList) {
    mergedOrders.push(o);
    processedIds.add(o.id);
  }
  for (const existing of db.orders) {
    if (!processedIds.has(existing.id)) {
      mergedOrders.push(existing);
      processedIds.add(existing.id);
    }
  }
  mergedOrders.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  db.orders = mergedOrders;
  await persistDatabaseAsync(db);
  return { orders: db.orders, updatedProducts: db.products };
}
async function getCustomersDataAsync() {
  const db = await loadDatabaseAsync();
  return {
    applications: db.customerApplications,
    users: db.customerUsers
  };
}
async function registerCustomer(data) {
  const db = await loadDatabaseAsync(true);
  const id = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const chosenPassword = data.password && data.password.trim() || "tulip2026";
  const cleanUsername = data.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") || data.phone.replace(/\D/g, "") || `client_${Date.now().toString().slice(-4)}`;
  const shouldAutoApprove = Boolean(data.autoApprove);
  const application = {
    id,
    fullName: data.fullName.trim(),
    companyName: data.companyName.trim(),
    phone: data.phone.trim(),
    secondaryPhone: data.secondaryPhone?.trim(),
    email: data.email.trim().toLowerCase(),
    wilayaCode: data.wilayaCode || "16",
    wilayaName: data.wilayaName || "Alger",
    commune: data.commune?.trim(),
    deliveryAddress: data.deliveryAddress?.trim(),
    notes: data.notes?.trim(),
    submittedAt: now,
    status: shouldAutoApprove ? "approved" : "pending",
    assignedUsername: shouldAutoApprove ? cleanUsername : void 0,
    assignedPassword: shouldAutoApprove ? chosenPassword : void 0,
    approvedAt: shouldAutoApprove ? now : void 0,
    approvedBy: shouldAutoApprove ? "admin_auto" : void 0,
    verificationNotes: shouldAutoApprove ? "Acc\xE8s direct valid\xE9." : void 0
  };
  const user = {
    id,
    username: shouldAutoApprove ? cleanUsername : "",
    password: shouldAutoApprove ? chosenPassword : "",
    fullName: data.fullName.trim(),
    companyName: data.companyName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    secondaryPhone: data.secondaryPhone?.trim(),
    wilayaCode: data.wilayaCode || "16",
    wilayaName: data.wilayaName || "Alger",
    commune: data.commune?.trim(),
    deliveryAddress: data.deliveryAddress?.trim(),
    status: shouldAutoApprove ? "approved" : "pending",
    createdAt: now,
    lastLogin: shouldAutoApprove ? now : void 0
  };
  db.customerApplications.unshift(application);
  if (shouldAutoApprove) {
    db.customerUsers.unshift(user);
  }
  await persistDatabaseAsync(db);
  return { application, user };
}
async function authenticateCustomer(identifier, password) {
  const db = await loadDatabaseAsync(true);
  const cleanId = (identifier || "").trim().toLowerCase();
  const cleanInputDigits = normalizePhone(cleanId);
  const cleanPass = (password || "").trim();
  let foundUser = db.customerUsers.find((u) => {
    const matchUsername = u.username.toLowerCase() === cleanId;
    const matchEmail = u.email.toLowerCase() === cleanId;
    const matchPhone = cleanInputDigits && normalizePhone(u.phone) === cleanInputDigits;
    return matchUsername || matchEmail || matchPhone;
  });
  if (!foundUser) {
    const foundApp = db.customerApplications.find((app2) => {
      const matchUsername = app2.assignedUsername && app2.assignedUsername.toLowerCase() === cleanId;
      const matchEmail = app2.email.toLowerCase() === cleanId;
      const matchPhone = cleanInputDigits && normalizePhone(app2.phone) === cleanInputDigits;
      return matchUsername || matchEmail || matchPhone;
    });
    if (foundApp) {
      if (foundApp.status === "pending") {
        return {
          success: false,
          status: "pending",
          error: "Votre demande d'acc\xE8s B2B est en cours d'examen. Nos \xE9quipes commerciales vous transmettront votre identifiant et mot de passe par WhatsApp ou t\xE9l\xE9phone apr\xE8s validation."
        };
      }
      if (foundApp.status === "rejected" || foundApp.status === "suspended") {
        return {
          success: false,
          status: foundApp.status,
          error: "Ce compte client a \xE9t\xE9 suspendu ou d\xE9sactiv\xE9 par l'administrateur."
        };
      }
      foundUser = {
        id: foundApp.id,
        username: foundApp.assignedUsername || foundApp.email.split("@")[0],
        password: foundApp.assignedPassword || "tulip2026",
        fullName: foundApp.fullName,
        companyName: foundApp.companyName,
        email: foundApp.email,
        phone: foundApp.phone,
        secondaryPhone: foundApp.secondaryPhone,
        wilayaCode: foundApp.wilayaCode,
        wilayaName: foundApp.wilayaName,
        commune: foundApp.commune,
        deliveryAddress: foundApp.deliveryAddress,
        status: "approved",
        createdAt: foundApp.approvedAt || foundApp.submittedAt
      };
      db.customerUsers.push(foundUser);
      await persistDatabaseAsync(db);
    }
  }
  if (!foundUser) {
    return {
      success: false,
      error: "Identifiant (nom d'utilisateur, email ou num\xE9ro de t\xE9l\xE9phone) introuvable."
    };
  }
  if (foundUser.status === "suspended") {
    return {
      success: false,
      status: "suspended",
      error: "Votre compte client a \xE9t\xE9 suspendu par l'administrateur."
    };
  }
  if (foundUser.password && cleanPass && foundUser.password !== cleanPass) {
    return {
      success: false,
      error: "Mot de passe incorrect. Veuillez v\xE9rifier ou contacter le support."
    };
  }
  foundUser.lastLogin = (/* @__PURE__ */ new Date()).toISOString();
  await persistDatabaseAsync(db);
  return {
    success: true,
    user: foundUser,
    status: foundUser.status
  };
}
async function approveCustomerApplication(applicationId, assignedUsername, assignedPassword, verificationNotes) {
  const db = await loadDatabaseAsync(true);
  const app2 = db.customerApplications.find((a) => a.id === applicationId);
  if (!app2) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  app2.status = "approved";
  app2.assignedUsername = assignedUsername.trim();
  app2.assignedPassword = assignedPassword.trim();
  app2.approvedAt = now;
  app2.approvedBy = "admin";
  if (verificationNotes) {
    app2.verificationNotes = verificationNotes.trim();
  }
  let user = db.customerUsers.find((u) => u.id === applicationId);
  if (!user) {
    user = {
      id: app2.id,
      username: app2.assignedUsername,
      password: app2.assignedPassword,
      fullName: app2.fullName,
      companyName: app2.companyName,
      email: app2.email,
      phone: app2.phone,
      secondaryPhone: app2.secondaryPhone,
      wilayaCode: app2.wilayaCode,
      wilayaName: app2.wilayaName,
      commune: app2.commune,
      deliveryAddress: app2.deliveryAddress,
      status: "approved",
      createdAt: now
    };
    db.customerUsers.push(user);
  } else {
    user.username = app2.assignedUsername;
    user.password = app2.assignedPassword;
    user.status = "approved";
  }
  await persistDatabaseAsync(db);
  return user;
}
async function updateCustomerStatus(customerId, status) {
  const db = await loadDatabaseAsync(true);
  const user = db.customerUsers.find((u) => u.id === customerId);
  if (user) {
    user.status = status;
  }
  const app2 = db.customerApplications.find((a) => a.id === customerId);
  if (app2) {
    app2.status = status;
  }
  await persistDatabaseAsync(db);
  return user || null;
}
async function resetCustomerPassword(customerId, newPassword) {
  const db = await loadDatabaseAsync(true);
  const user = db.customerUsers.find((u) => u.id === customerId);
  if (user) {
    user.password = newPassword.trim();
  }
  const app2 = db.customerApplications.find((a) => a.id === customerId);
  if (app2) {
    app2.assignedPassword = newPassword.trim();
  }
  await persistDatabaseAsync(db);
  return user || null;
}
async function createDirectCustomer(data) {
  const db = await loadDatabaseAsync(true);
  const id = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const newUser = {
    ...data,
    id,
    createdAt: now,
    status: data.status || "approved"
  };
  const newApp = {
    id,
    fullName: data.fullName,
    companyName: data.companyName,
    phone: data.phone,
    secondaryPhone: data.secondaryPhone,
    email: data.email,
    wilayaCode: data.wilayaCode,
    wilayaName: data.wilayaName,
    commune: data.commune,
    deliveryAddress: data.deliveryAddress,
    submittedAt: now,
    status: data.status || "approved",
    assignedUsername: data.username,
    assignedPassword: data.password || "tulip2026",
    approvedAt: now,
    approvedBy: "admin_direct_creation"
  };
  db.customerUsers.unshift(newUser);
  db.customerApplications.unshift(newApp);
  await persistDatabaseAsync(db);
  return newUser;
}
async function deleteCustomer(customerId) {
  const db = await loadDatabaseAsync(true);
  db.customerUsers = db.customerUsers.filter((u) => u.id !== customerId);
  db.customerApplications = db.customerApplications.filter((a) => a.id !== customerId);
  await persistDatabaseAsync(db);
  return true;
}
async function deleteCustomerApplication(applicationId) {
  const db = await loadDatabaseAsync(true);
  db.customerApplications = db.customerApplications.filter((a) => a.id !== applicationId);
  await persistDatabaseAsync(db);
  return true;
}
async function importCustomers(newCustomers, replaceExisting = false) {
  const db = await loadDatabaseAsync(true);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (replaceExisting) {
    db.customerUsers = newCustomers.map((c) => ({
      ...c,
      status: c.status || "approved",
      createdAt: c.createdAt || now
    }));
    db.customerApplications = newCustomers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      companyName: c.companyName,
      email: c.email,
      phone: c.phone,
      secondaryPhone: c.secondaryPhone,
      wilayaCode: c.wilayaCode,
      wilayaName: c.wilayaName,
      commune: c.commune,
      deliveryAddress: c.deliveryAddress,
      status: c.status || "approved",
      submittedAt: c.createdAt || now,
      approvedAt: c.createdAt || now,
      approvedBy: "import_system",
      assignedUsername: c.username,
      assignedPassword: c.password,
      verificationNotes: "Import\xE9 dans le syst\xE8me."
    }));
  } else {
    newCustomers.forEach((nc) => {
      const idx = db.customerUsers.findIndex(
        (existing) => existing.id === nc.id || nc.username && existing.username.toLowerCase() === nc.username.toLowerCase() || nc.phone && normalizePhone(existing.phone) === normalizePhone(nc.phone) || nc.email && existing.email.toLowerCase() === nc.email.toLowerCase()
      );
      if (idx >= 0) {
        db.customerUsers[idx] = { ...db.customerUsers[idx], ...nc };
      } else {
        db.customerUsers.push({
          ...nc,
          status: nc.status || "approved",
          createdAt: nc.createdAt || now
        });
      }
      const appIdx = db.customerApplications.findIndex(
        (a) => a.id === nc.id || nc.username && a.assignedUsername && a.assignedUsername.toLowerCase() === nc.username.toLowerCase() || nc.phone && normalizePhone(a.phone) === normalizePhone(nc.phone)
      );
      if (appIdx >= 0) {
        db.customerApplications[appIdx] = {
          ...db.customerApplications[appIdx],
          fullName: nc.fullName,
          companyName: nc.companyName,
          phone: nc.phone,
          secondaryPhone: nc.secondaryPhone,
          email: nc.email,
          wilayaCode: nc.wilayaCode,
          wilayaName: nc.wilayaName,
          commune: nc.commune,
          deliveryAddress: nc.deliveryAddress,
          status: nc.status || "approved",
          assignedUsername: nc.username,
          assignedPassword: nc.password
        };
      } else {
        db.customerApplications.push({
          id: nc.id,
          fullName: nc.fullName,
          companyName: nc.companyName,
          email: nc.email,
          phone: nc.phone,
          secondaryPhone: nc.secondaryPhone,
          wilayaCode: nc.wilayaCode,
          wilayaName: nc.wilayaName,
          commune: nc.commune,
          deliveryAddress: nc.deliveryAddress,
          status: nc.status || "approved",
          submittedAt: nc.createdAt || now,
          approvedAt: nc.createdAt || now,
          approvedBy: "import_system",
          assignedUsername: nc.username,
          assignedPassword: nc.password,
          verificationNotes: "Import\xE9 dans le syst\xE8me."
        });
      }
    });
  }
  await persistDatabaseAsync(db);
  return { users: db.customerUsers, applications: db.customerApplications };
}
async function restoreDatabase(backup) {
  const db = await loadDatabaseAsync(true);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (Array.isArray(backup.products) && backup.products.length > 0) {
    db.products = backup.products;
  }
  if (Array.isArray(backup.orders)) {
    db.orders = backup.orders;
  }
  if (Array.isArray(backup.customerUsers)) {
    db.customerUsers = backup.customerUsers;
  }
  if (Array.isArray(backup.customerApplications)) {
    db.customerApplications = backup.customerApplications;
  } else if (Array.isArray(backup.customerUsers) && backup.customerUsers.length > 0) {
    db.customerApplications = backup.customerUsers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      companyName: c.companyName,
      email: c.email,
      phone: c.phone,
      secondaryPhone: c.secondaryPhone,
      wilayaCode: c.wilayaCode,
      wilayaName: c.wilayaName,
      commune: c.commune,
      deliveryAddress: c.deliveryAddress,
      status: c.status || "approved",
      submittedAt: c.createdAt || now,
      approvedAt: c.createdAt || now,
      approvedBy: "restore_system",
      assignedUsername: c.username,
      assignedPassword: c.password,
      verificationNotes: "Restaur\xE9 depuis sauvegarde."
    }));
  }
  if (Array.isArray(backup.adBanners)) {
    db.adBanners = backup.adBanners;
  }
  if (backup.storeSettings && typeof backup.storeSettings === "object") {
    db.storeSettings = { ...db.storeSettings, ...backup.storeSettings };
  }
  db.lastUpdated = now;
  await persistDatabaseAsync(db);
  return db;
}
async function getProductsAsync() {
  const db = await loadDatabaseAsync();
  return db.products;
}
async function syncProducts(newProducts) {
  const db = await loadDatabaseAsync(true);
  db.products = newProducts;
  await persistDatabaseAsync(db);
  return db.products;
}
async function updateSingleProduct(id, stock, priceDA, isHidden) {
  const db = await loadDatabaseAsync(true);
  const prod = db.products.find((p) => p.id === id);
  if (!prod) return null;
  prod.stock = stock;
  if (priceDA !== void 0) prod.priceDA = priceDA;
  if (isHidden !== void 0) prod.isHidden = isHidden;
  prod.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  await persistDatabaseAsync(db);
  return prod;
}
async function createSingleProduct(product) {
  const db = await loadDatabaseAsync(true);
  const existingIdx = db.products.findIndex(
    (p) => p.id === product.id || p.code.toUpperCase() === product.code.toUpperCase()
  );
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const newProd = { ...product, lastUpdated: now };
  if (existingIdx >= 0) {
    db.products[existingIdx] = newProd;
  } else {
    db.products.unshift(newProd);
  }
  await persistDatabaseAsync(db);
  return newProd;
}
async function saveSingleProduct(product) {
  const db = await loadDatabaseAsync(true);
  const existingIdx = db.products.findIndex((p) => p.id === product.id);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = { ...product, lastUpdated: now };
  if (existingIdx >= 0) {
    db.products[existingIdx] = updated;
  } else {
    db.products.unshift(updated);
  }
  await persistDatabaseAsync(db);
  return updated;
}
async function deleteSingleProduct(id) {
  const db = await loadDatabaseAsync(true);
  db.products = db.products.filter((p) => p.id !== id);
  await persistDatabaseAsync(db);
  return { success: true, products: db.products };
}
async function getBannersAsync() {
  const db = await loadDatabaseAsync();
  return db.adBanners;
}
async function updateBanners(banners) {
  const db = await loadDatabaseAsync(true);
  db.adBanners = banners;
  await persistDatabaseAsync(db);
  return db.adBanners;
}
async function getSettingsAsync() {
  const db = await loadDatabaseAsync();
  return db.storeSettings;
}
async function updateSettings(settings) {
  const db = await loadDatabaseAsync(true);
  db.storeSettings = settings;
  await persistDatabaseAsync(db);
  return db.storeSettings;
}

// src/server/app.ts
dotenv.config();
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
var writeLockQueue = Promise.resolve();
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.path.startsWith("/api/")) {
    const writePromise = new Promise((resolve) => {
      writeLockQueue.then(() => {
        let isResolved = false;
        const release = () => {
          if (!isResolved) {
            isResolved = true;
            resolve();
          }
        };
        const originalEnd = res.end;
        res.end = function(...args) {
          const result = originalEnd.apply(res, args);
          release();
          return result;
        };
        setTimeout(release, 1e4);
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
app.use(express.static(path2.join(process.cwd(), "public")));
app.use(express.json({ limit: "25mb" }));
loadDatabase();
if (isSupabaseConfigured()) {
  syncWithSupabaseAsync().catch((e) => {
    console.warn("[Server] Initial Supabase sync notice:", e?.message || e);
  });
}
var sseClients = /* @__PURE__ */ new Set();
function broadcastServerEvent(type, payload) {
  const dataStr = `data: ${JSON.stringify({ type, payload, timestamp: (/* @__PURE__ */ new Date()).toISOString() })}

`;
  for (const client of sseClients) {
    try {
      client.write(dataStr);
    } catch {
      sseClients.delete(client);
    }
  }
}
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  res.write(`data: ${JSON.stringify({ type: "connected", time: (/* @__PURE__ */ new Date()).toISOString() })}

`);
  sseClients.add(res);
  const heartbeat = setInterval(() => {
    try {
      res.write(": keep-alive\n\n");
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 15e3);
  const autoCloseTimer = setTimeout(() => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    if (!res.writableEnded) {
      res.end();
    }
  }, 25e3);
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
    storage: isSupabaseConfigured() ? "supabase_cloud" : "persistent_file_db",
    supabaseConfigured: isSupabaseConfigured(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/supabase/status", async (_req, res) => {
  try {
    const status = await testSupabaseConnection();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.post("/api/supabase/sync", async (_req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(400).json({
        success: false,
        error: "Supabase n'est pas encore configur\xE9. Renseignez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans les variables d'environnement."
      });
    }
    const db = loadDatabase();
    const pushed = await saveDatabaseToSupabase(db);
    res.json({
      success: pushed,
      message: pushed ? "Base de donn\xE9es synchronis\xE9e avec succ\xE8s vers Supabase." : "\xC9chec de la synchronisation vers Supabase. V\xE9rifiez les logs et ex\xE9cutez le script SQL supabase-schema.sql.",
      lastUpdated: db.lastUpdated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.get("/api/analytics-config", (_req, res) => {
  const gaMeasurementId = (process.env.VITE_GA_MEASUREMENT_ID || process.env.GA_MEASUREMENT_ID || "").trim();
  const clarityProjectId = (process.env.VITE_CLARITY_PROJECT_ID || process.env.CLARITY_PROJECT_ID || "").trim();
  res.json({
    status: "ok",
    gaMeasurementId,
    clarityProjectId
  });
});
app.get("/api/sync", async (req, res) => {
  try {
    const isAdmin = req.query.admin === "true";
    const db = await loadDatabaseAsync(true);
    const gaMeasurementId = (process.env.VITE_GA_MEASUREMENT_ID || process.env.GA_MEASUREMENT_ID || "").trim();
    const clarityProjectId = (process.env.VITE_CLARITY_PROJECT_ID || process.env.CLARITY_PROJECT_ID || "").trim();
    if (!isAdmin) {
      res.setHeader("Cache-Control", "public, max-age=15, s-maxage=300, stale-while-revalidate=600");
    } else {
      res.setHeader("Cache-Control", "no-store, must-revalidate");
    }
    res.json({
      status: "ok",
      products: db.products,
      orders: isAdmin ? db.orders : [],
      customerApplications: isAdmin ? db.customerApplications : [],
      customerUsers: isAdmin ? db.customerUsers : [],
      adBanners: db.adBanners,
      storeSettings: db.storeSettings,
      storageProvider: isSupabaseConfigured() ? "supabase" : "local",
      analyticsConfig: {
        gaMeasurementId,
        clarityProjectId
      },
      lastUpdated: db.lastUpdated,
      serverTime: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("[API] /api/sync error:", err);
    res.status(500).json({ error: "Erreur lors de la synchronisation." });
  }
});
function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var BOT_SELF_ID = "8908435035";
var DEFAULT_ACTIVE_CHATS = ["5680755596"];
async function removeDeadChatIdFromSettings(deadId) {
  try {
    const db = await loadDatabaseAsync();
    const settings = db.storeSettings || {};
    let changed = false;
    const fields = [
      "telegramChatId",
      "telegramPreorderChatId",
      "telegramProformaChatId",
      "telegramAccessChatId"
    ];
    for (const field of fields) {
      if (settings[field]) {
        const parts = String(settings[field]).split(/[\s,;|]+/);
        const filtered = parts.filter((p) => p && p !== deadId);
        const newValue = filtered.join(", ");
        if (newValue !== settings[field]) {
          settings[field] = newValue;
          changed = true;
        }
      }
    }
    if (changed) {
      db.storeSettings = settings;
      await persistDatabaseAsync(db);
      console.log(`[Telegram Bot Autoclean] Successfully cleaned up dead ID ${deadId} from store settings.`);
    }
  } catch (err) {
    console.warn(`[Telegram Bot Autoclean] Error in cleanup helper:`, err);
  }
}
function extractChatIds(source) {
  if (!source) return [];
  const list = [];
  const parts = String(source).split(/[\s,;|]+/);
  for (const p of parts) {
    const trimmed = p.trim().replace(/^["']|["']$/g, "");
    if (trimmed && trimmed !== BOT_SELF_ID) {
      list.push(trimmed);
    }
  }
  return list;
}
async function resolveTelegramConfig(type = "general") {
  const db = await loadDatabaseAsync();
  const settings = db.storeSettings || {};
  let token = (process.env.TELEGRAM_BOT_TOKEN || settings.telegramBotToken || "8908435035:AAFYIq74hxJeFeiQAPRx_g_WZ7R5fL0uwu8").trim();
  token = token.replace(/^["']|["']$/g, "");
  if (token && !token.includes(":")) {
    token = `8908435035:${token}`;
  }
  const targetChatIds = /* @__PURE__ */ new Set();
  let specificSource;
  if (type === "preorder") {
    specificSource = settings.telegramPreorderChatId;
  } else if (type === "proforma") {
    specificSource = settings.telegramProformaChatId;
  } else if (type === "access") {
    specificSource = settings.telegramAccessChatId;
  }
  const specificChats = extractChatIds(specificSource);
  if (specificChats.length > 0) {
    specificChats.forEach((id) => targetChatIds.add(id));
  } else {
    const fallbackSources = [settings.telegramChatId, process.env.TELEGRAM_CHAT_ID];
    for (const src of fallbackSources) {
      const chats = extractChatIds(src);
      chats.forEach((id) => targetChatIds.add(id));
    }
  }
  if (targetChatIds.size === 0) {
    for (const id of DEFAULT_ACTIVE_CHATS) {
      targetChatIds.add(id);
    }
  }
  return {
    token,
    chatIds: Array.from(targetChatIds),
    primaryChatId: Array.from(targetChatIds)[0] || DEFAULT_ACTIVE_CHATS[0],
    enabled: settings.telegramNotificationsEnabled !== false
  };
}
async function broadcastTelegramMessage(htmlMessage, type = "general", overrideChatIds) {
  const config = await resolveTelegramConfig(type);
  const targetIds = overrideChatIds && overrideChatIds.length > 0 ? overrideChatIds : config.chatIds;
  if (!config.token || !config.enabled || targetIds.length === 0) {
    return { sentViaBot: false, error: "Telegram non configur\xE9 ou d\xE9sactiv\xE9" };
  }
  const deliveryReports = [];
  let successfulSends = 0;
  for (const cId of targetIds) {
    try {
      const tgUrl = `https://api.telegram.org/bot${config.token}/sendMessage`;
      const resp = await fetch(tgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cId,
          text: htmlMessage,
          parse_mode: "HTML"
        })
      });
      const data = await resp.json();
      deliveryReports.push({ chatId: cId, ok: Boolean(data && data.ok), data });
      if (data && data.ok) {
        successfulSends++;
      } else {
        console.warn(`[Telegram Bot] Error sending to ${cId}:`, data?.description);
        const isForbidden = data?.description && (data.description.includes("chat was deleted") || data.description.includes("bot was kicked") || data.description.includes("chat not found") || data.description.includes("bot was blocked"));
        if (isForbidden) {
          console.log(`[Telegram Bot Autoclean] Removing dead chat ID: ${cId} (Reason: ${data.description})`);
          removeDeadChatIdFromSettings(cId).catch((cleanupErr) => {
            console.error(`[Telegram Bot Autoclean] Error cleaning up ${cId}:`, cleanupErr);
          });
        }
      }
    } catch (err) {
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
    botUsername: "tulip5661bot"
  };
}
async function sendTelegramOrderNotification(order, _customPhone) {
  const isProforma = Boolean(order.isProforma || order.orderNumber && order.orderNumber.startsWith("PRO-"));
  const notificationType = isProforma ? "proforma" : "preorder";
  const itemsSummary = (order.items || []).map((i, idx) => {
    const qty = i.family === "Extrait" ? `${i.quantity}g` : `${i.quantity}x ${i.unit}`;
    return `  <b>${idx + 1}.</b> ${escapeHtml(i.name)} [<code>${escapeHtml(i.code)}</code>] : <b>${qty}</b> = ${(i.totalDA || 0).toLocaleString("fr-DZ")} DA`;
  }).join("\n");
  const customerName = `${order.customer?.fullName || "Client"} ${order.customer?.companyName ? `(${order.customer.companyName})` : ""}`;
  const customerPhone = order.customer?.phone || "Non sp\xE9cifi\xE9";
  const destination = `${order.customer?.wilayaCode || ""} - ${order.customer?.wilayaName || ""} (${order.customer?.commune || ""})`;
  const deliveryAddress = order.customer?.deliveryAddress ? `
\u{1F4CD} <b>Adresse :</b> ${escapeHtml(order.customer.deliveryAddress)}` : "";
  const orderDate = new Date(order.date || Date.now()).toLocaleString("fr-DZ");
  const totalAmount = (order.totalDA || 0).toLocaleString("fr-DZ");
  let messageHtml = "";
  if (isProforma) {
    messageHtml = `\u{1F4C4} <b>NOUVELLE DEMANDE DE FACTURE PROFORMA</b>
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u26A1 <b>Type :</b> Devis Proforma Express
\u{1F4CB} <b>N\xB0 Proforma :</b> <code>${escapeHtml(order.orderNumber)}</code>
\u{1F464} <b>Demandeur :</b> ${escapeHtml(customerName)}
\u{1F4DE} <b>T\xE9l\xE9phone :</b> <code>${escapeHtml(customerPhone)}</code>
\u{1F4CD} <b>Destination :</b> ${escapeHtml(destination)}${deliveryAddress}

\u{1F4E6} <b>Articles S\xE9lectionn\xE9s :</b>
${itemsSummary}

\u{1F4B0} <b>TOTAL ESTIMATIF :</b> <b>${totalAmount} DA</b>
\u23F3 <b>R\xE9servation stock :</b> 48 Heures
\u{1F4C5} <b>Date :</b> ${orderDate}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F3E2} <i>Tulip Fragrance Company \u2022 Service Commercial Oran</i>`;
  } else {
    messageHtml = `\u{1F338} <b>NOUVELLE PR\xC9COMMANDE VALID\xC9E - TULIP</b>
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F4E6} <b>Type :</b> Pr\xE9commande Ferme
\u{1F4CB} <b>Bon N\xB0 :</b> <code>${escapeHtml(order.orderNumber)}</code>
\u{1F464} <b>Client :</b> ${escapeHtml(customerName)}
\u{1F4DE} <b>T\xE9l\xE9phone :</b> <code>${escapeHtml(customerPhone)}</code>
\u{1F4CD} <b>Destination :</b> ${escapeHtml(destination)}${deliveryAddress}
\u{1F69A} <b>Mode livraison :</b> ${escapeHtml(order.customer?.deliveryMode || "Standard")}

\u{1F4E6} <b>Articles R\xE9serv\xE9s :</b>
${itemsSummary}

\u{1F4B0} <b>TOTAL \xC0 R\xC9GLER :</b> <b>${totalAmount} DA</b>
\u{1F4C5} <b>Date :</b> ${orderDate}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F3E2} <i>Tulip Fragrance Company \u2022 Bir El Djir, Oran</i>`;
  }
  return await broadcastTelegramMessage(messageHtml, notificationType);
}
async function sendTelegramAccessRequestNotification(applicant) {
  const applicantName = escapeHtml(applicant.fullName || "Nouveau Client");
  const company = applicant.companyName ? escapeHtml(applicant.companyName) : "Non sp\xE9cifi\xE9";
  const phone = escapeHtml(applicant.phone || "Non sp\xE9cifi\xE9");
  const secondaryPhone = applicant.secondaryPhone ? `
\u{1F4F1} <b>T\xE9l\xE9phone 2 :</b> <code>${escapeHtml(applicant.secondaryPhone)}</code>` : "";
  const email = applicant.email ? escapeHtml(applicant.email) : "Non sp\xE9cifi\xE9";
  const location = `${escapeHtml(applicant.wilayaCode || "")} - ${escapeHtml(applicant.wilayaName || "")} (${escapeHtml(applicant.commune || "")})`;
  const address = applicant.deliveryAddress ? `
\u{1F4CD} <b>Adresse :</b> ${escapeHtml(applicant.deliveryAddress)}` : "";
  const notes = applicant.notes ? `
\u{1F4DD} <b>Activit\xE9 / Notes :</b> <i>${escapeHtml(applicant.notes)}</i>` : "";
  const dateStr = new Date(applicant.createdAt || applicant.date || Date.now()).toLocaleString("fr-DZ");
  const messageHtml = `\u{1F511} <b>NOUVELLE DEMANDE D'ACC\xC8S PROFESSIONNEL</b>
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F3E2} <b>Type :</b> Demande d'acc\xE8s Tarifs Pro / Gros
\u{1F464} <b>Responsable :</b> ${applicantName}
\u{1F3EA} <b>\xC9tablissement :</b> <b>${company}</b>
\u{1F4DE} <b>T\xE9l\xE9phone :</b> <code>${phone}</code>${secondaryPhone}
\u2709\uFE0F <b>Email :</b> ${email}
\u{1F4CD} <b>Localisation :</b> ${location}${address}${notes}
\u23F3 <b>Statut :</b> \u{1F7E1} En attente de validation
\u{1F4C5} <b>Date :</b> ${dateStr}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F449} <i>Rendez-vous dans l'Espace Admin > Clients pour approuver ce compte.</i>
\u{1F3E2} <i>Tulip Fragrance Company \u2022 Bir El Djir, Oran</i>`;
  return await broadcastTelegramMessage(messageHtml, "access");
}
app.get("/api/orders", async (_req, res) => {
  try {
    const orders = await getAllOrdersAsync();
    res.json({ success: true, orders });
  } catch (err) {
    console.error("[API] GET /api/orders error:", err);
    res.status(500).json({ error: "Impossible de r\xE9cup\xE9rer les commandes." });
  }
});
app.post("/api/orders", async (req, res) => {
  try {
    const orderPayload = req.body;
    if (!orderPayload || !orderPayload.customer || !Array.isArray(orderPayload.items)) {
      return res.status(400).json({ error: "Donn\xE9es de commande incompl\xE8tes." });
    }
    const { order, updatedProducts } = await createOrder(orderPayload);
    const isProforma = Boolean(order.isProforma || order.orderNumber && order.orderNumber.startsWith("PRO-"));
    broadcastServerEvent("order:created", {
      order,
      updatedProducts,
      isProforma
    });
    let telegramStatus = null;
    try {
      telegramStatus = await sendTelegramOrderNotification(order);
    } catch (tgErr) {
      console.warn("[Telegram Bot] Notification trigger error:", tgErr?.message);
    }
    res.status(201).json({
      success: true,
      order,
      updatedProducts,
      telegram: telegramStatus
    });
  } catch (err) {
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
    const { orders: updatedOrders, updatedProducts } = await syncOrders(orders);
    broadcastServerEvent("orders:synced", { orders: updatedOrders, updatedProducts });
    res.json({ success: true, orders: updatedOrders, updatedProducts });
  } catch (err) {
    console.error("[API] PUT /api/orders error:", err);
    res.status(500).json({ error: "Erreur lors de la synchronisation des commandes." });
  }
});
app.put("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body;
    const result = await updateOrder(id, patch);
    if (!result) {
      return res.status(404).json({ error: "Commande introuvable." });
    }
    broadcastServerEvent("order:updated", {
      order: result.order,
      updatedProducts: result.updatedProducts
    });
    res.json({
      success: true,
      order: result.order,
      updatedProducts: result.updatedProducts
    });
  } catch (err) {
    console.error("[API] PUT /api/orders/:id error:", err);
    res.status(500).json({ error: "Erreur lors de la mise \xE0 jour de la commande." });
  }
});
app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Le statut est requis." });
    }
    const result = await updateOrderStatus(id, status);
    if (!result) {
      return res.status(404).json({ error: "Commande introuvable." });
    }
    broadcastServerEvent("order:updated", {
      order: result.order,
      updatedProducts: result.updatedProducts
    });
    res.json({
      success: true,
      order: result.order,
      updatedProducts: result.updatedProducts
    });
  } catch (err) {
    console.error("[API] PATCH /api/orders/:id/status error:", err);
    res.status(500).json({ error: "Erreur lors de la mise \xE0 jour du statut." });
  }
});
app.post("/api/orders/bulk-delete", async (req, res) => {
  try {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: "Liste d'identifiants de commandes requise." });
    }
    const result = await bulkDeleteOrders(orderIds);
    broadcastServerEvent("orders:bulk_deleted", {
      orderIds,
      updatedProducts: result.updatedProducts
    });
    res.json({ success: true, deletedCount: result.deletedCount, updatedProducts: result.updatedProducts });
  } catch (err) {
    console.error("[API] POST /api/orders/bulk-delete error:", err);
    res.status(500).json({ error: "Erreur lors de la suppression group\xE9e." });
  }
});
app.delete("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteOrder(id);
    if (result.success) {
      broadcastServerEvent("order:deleted", {
        orderId: id,
        updatedProducts: result.updatedProducts
      });
    }
    res.json({ success: result.success, updatedProducts: result.updatedProducts });
  } catch (err) {
    console.error("[API] DELETE /api/orders/:id error:", err);
    res.status(500).json({ error: "Erreur lors de la suppression de la commande." });
  }
});
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
      autoApprove = false
    } = req.body;
    if (!fullName || !phone) {
      return res.status(400).json({ error: "Le nom complet et le t\xE9l\xE9phone sont obligatoires." });
    }
    const { application, user } = await registerCustomer({
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
      autoApprove
    });
    broadcastServerEvent("customer:registered", {
      application,
      user
    });
    let telegramStatus = null;
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: autoApprove ? "approved" : "pending"
      });
    } catch (tgErr) {
      console.warn("[Telegram Bot] Access request notification error:", tgErr?.message);
    }
    res.status(201).json({
      success: true,
      message: "Compte client cr\xE9\xE9 avec succ\xE8s !",
      customer: user,
      application,
      telegram: telegramStatus
    });
  } catch (err) {
    console.error("[API] POST /api/auth/register error:", err);
    res.status(500).json({ error: "Erreur lors de la cr\xE9ation du compte client." });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: "Identifiant requis." });
    }
    const result = await authenticateCustomer(identifier, password);
    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error || "Identifiants incorrects.",
        status: result.status
      });
    }
    res.json({
      success: true,
      customer: result.user
    });
  } catch (err) {
    console.error("[API] POST /api/auth/login error:", err);
    res.status(500).json({ error: "Erreur lors de la tentative de connexion." });
  }
});
app.get("/api/customers", async (_req, res) => {
  try {
    const data = await getCustomersDataAsync();
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("[API] GET /api/customers error:", err);
    res.status(500).json({ error: "Impossible de r\xE9cup\xE9rer les clients." });
  }
});
app.post("/api/customers/approve", async (req, res) => {
  try {
    const { applicationId, assignedUsername, assignedPassword, verificationNotes } = req.body;
    if (!applicationId || !assignedUsername || !assignedPassword) {
      return res.status(400).json({ error: "Donn\xE9es d'approbation incompl\xE8tes." });
    }
    const user = await approveCustomerApplication(
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
  } catch (err) {
    console.error("[API] POST /api/customers/approve error:", err);
    res.status(500).json({ error: "Erreur lors de l'approbation." });
  }
});
app.patch("/api/customers/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = await updateCustomerStatus(id, status);
    broadcastServerEvent("customer:updated", { customer: user, customerId: id });
    res.json({ success: true, customer: user });
  } catch (err) {
    console.error("[API] PATCH /api/customers/:id/status error:", err);
    res.status(500).json({ error: "Erreur lors de la mise \xE0 jour du statut client." });
  }
});
app.patch("/api/customers/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: "Nouveau mot de passe requis." });
    }
    const user = await resetCustomerPassword(id, newPassword);
    broadcastServerEvent("customer:updated", { customer: user, customerId: id });
    res.json({ success: true, customer: user });
  } catch (err) {
    console.error("[API] PATCH /api/customers/:id/reset-password error:", err);
    res.status(500).json({ error: "Erreur lors de la r\xE9initialisation du mot de passe." });
  }
});
app.post("/api/customers/create-direct", async (req, res) => {
  try {
    const user = await createDirectCustomer(req.body);
    broadcastServerEvent("customer:created", { customer: user });
    res.status(201).json({ success: true, customer: user });
  } catch (err) {
    console.error("[API] POST /api/customers/create-direct error:", err);
    res.status(500).json({ error: "Erreur lors de la cr\xE9ation directe du client." });
  }
});
app.post("/api/customers/import", async (req, res) => {
  try {
    const { customers, replaceExisting } = req.body;
    if (!Array.isArray(customers)) {
      return res.status(400).json({ error: "Liste de clients requise." });
    }
    const result = await importCustomers(customers, Boolean(replaceExisting));
    broadcastServerEvent("customers:imported", {
      customerUsers: result.users,
      customerApplications: result.applications
    });
    res.json({
      success: true,
      count: result.users.length,
      customerUsers: result.users,
      customerApplications: result.applications
    });
  } catch (err) {
    console.error("[API] POST /api/customers/import error:", err);
    res.status(500).json({ error: "Erreur lors de l'importation des clients." });
  }
});
app.post("/api/restore", async (req, res) => {
  try {
    const { backup } = req.body;
    if (!backup || typeof backup !== "object") {
      return res.status(400).json({ error: "Donn\xE9es de sauvegarde requises." });
    }
    const restored = await restoreDatabase(backup);
    broadcastServerEvent("database:restored", { lastUpdated: restored.lastUpdated });
    res.json({
      success: true,
      message: "Restauration effectu\xE9e avec succ\xE8s.",
      data: {
        products: restored.products,
        orders: restored.orders,
        customerApplications: restored.customerApplications,
        customerUsers: restored.customerUsers,
        storeSettings: restored.storeSettings,
        adBanners: restored.adBanners,
        lastUpdated: restored.lastUpdated
      }
    });
  } catch (err) {
    console.error("[API] POST /api/restore error:", err);
    res.status(500).json({ error: "Erreur lors de la restauration du site." });
  }
});
app.delete("/api/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteCustomer(id);
    broadcastServerEvent("customer:deleted", { customerId: id });
    res.json({ success: true });
  } catch (err) {
    console.error("[API] DELETE /api/customers/:id error:", err);
    res.status(500).json({ error: "Erreur lors de la suppression." });
  }
});
app.delete("/api/customers/application/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteCustomerApplication(id);
    broadcastServerEvent("application:deleted", { applicationId: id });
    res.json({ success: true });
  } catch (err) {
    console.error("[API] DELETE /api/customers/application/:id error:", err);
    res.status(500).json({ error: "Erreur lors de la suppression de la demande." });
  }
});
app.get("/api/products", async (req, res) => {
  try {
    const isFresh = req.query.fresh === "true" || req.query.bypass === "true";
    if (!isFresh) {
      res.setHeader("Cache-Control", "public, max-age=15, s-maxage=300, stale-while-revalidate=600");
    } else {
      res.setHeader("Cache-Control", "no-store, must-revalidate");
    }
    const products = await getProductsAsync();
    res.json({ success: true, products });
  } catch (err) {
    console.error("[API] GET /api/products error:", err);
    res.status(500).json({ error: "Impossible de r\xE9cup\xE9rer les produits." });
  }
});
app.post("/api/products/sync", async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: "Liste de produits requise." });
    }
    const updated = await syncProducts(products);
    broadcastServerEvent("products:updated", { products: updated });
    broadcastServerEvent("products:synced", { products: updated });
    res.json({ success: true, count: updated.length, products: updated });
  } catch (err) {
    console.error("[API] POST /api/products/sync error:", err);
    res.status(500).json({ error: "Erreur lors de la synchronisation du catalogue." });
  }
});
app.post("/api/products", async (req, res) => {
  try {
    const product = req.body && req.body.product ? req.body.product : req.body;
    if (!product || !product.name || !product.code) {
      return res.status(400).json({ error: "Nom et code de produit requis." });
    }
    const created = await createSingleProduct(product);
    broadcastServerEvent("product:created", { product: created });
    res.status(201).json({ success: true, product: created });
  } catch (err) {
    console.error("[API] POST /api/products error:", err);
    res.status(500).json({ error: "Erreur lors de la cr\xE9ation du produit." });
  }
});
app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = req.body && req.body.product ? req.body.product : req.body;
    if (!product) {
      return res.status(400).json({ error: "Donn\xE9es de produit requises." });
    }
    const updated = await saveSingleProduct({ ...product, id });
    broadcastServerEvent("product:updated", { product: updated });
    res.json({ success: true, product: updated });
  } catch (err) {
    console.error("[API] PUT /api/products/:id error:", err);
    res.status(500).json({ error: "Erreur lors de la mise \xE0 jour du produit." });
  }
});
app.patch("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, priceDA, isHidden } = req.body;
    const updated = await updateSingleProduct(id, stock, priceDA, isHidden);
    if (!updated) {
      return res.status(404).json({ error: "Produit introuvable." });
    }
    broadcastServerEvent("product:updated", { product: updated });
    res.json({ success: true, product: updated });
  } catch (err) {
    console.error("[API] PATCH /api/products/:id error:", err);
    res.status(500).json({ error: "Erreur lors de la mise \xE0 jour du produit." });
  }
});
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteSingleProduct(id);
    broadcastServerEvent("product:deleted", { productId: id, products: result.products });
    res.json({ success: true, products: result.products });
  } catch (err) {
    console.error("[API] DELETE /api/products/:id error:", err);
    res.status(500).json({ error: "Erreur lors de la suppression du produit." });
  }
});
app.get("/api/banners", async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=600, stale-while-revalidate=1200");
    const banners = await getBannersAsync();
    res.json({ success: true, banners });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la r\xE9cup\xE9ration des banni\xE8res." });
  }
});
app.put("/api/banners", async (req, res) => {
  try {
    const { banners } = req.body;
    if (!Array.isArray(banners)) {
      return res.status(400).json({ error: "Tableau de banni\xE8res attendu." });
    }
    const updated = await updateBanners(banners);
    broadcastServerEvent("banners:updated", { banners: updated });
    res.json({ success: true, banners: updated });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la mise \xE0 jour des banni\xE8res." });
  }
});
app.get("/api/settings", async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=600, stale-while-revalidate=1200");
    const settings = await getSettingsAsync();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la r\xE9cup\xE9ration des param\xE8tres." });
  }
});
app.put("/api/settings", async (req, res) => {
  try {
    const { settings } = req.body;
    const updated = await updateSettings(settings);
    broadcastServerEvent("settings:updated", { settings: updated });
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la mise \xE0 jour des param\xE8tres." });
  }
});
app.post("/api/telegram/send-order", async (req, res) => {
  try {
    const { order, telegramPhone = "+213799938399" } = req.body;
    if (!order) {
      return res.status(400).json({ error: "Les d\xE9tails de la pr\xE9commande sont requis." });
    }
    const result = await sendTelegramOrderNotification(order, telegramPhone);
    return res.json({
      success: true,
      sentViaBot: result.sentViaBot,
      message: result.message,
      botResult: result.deliveryReports || result.botResult,
      directTelegramUrl: result.directTelegramUrl,
      telegramPhone
    });
  } catch (err) {
    console.error("Error in /api/telegram/send-order:", err);
    return res.status(500).json({ error: "Erreur lors du traitement Telegram." });
  }
});
app.get("/api/telegram/status", async (_req, res) => {
  try {
    const db = await loadDatabaseAsync();
    const settings = db.storeSettings || {};
    const config = await resolveTelegramConfig("general");
    const preorderConfig = await resolveTelegramConfig("preorder");
    const proformaConfig = await resolveTelegramConfig("proforma");
    const accessConfig = await resolveTelegramConfig("access");
    let botInfo = null;
    let updates = [];
    let apiError = null;
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
          const seen = /* @__PURE__ */ new Set();
          updates = upJson.result.map((u) => {
            const msg = u.message || u.channel_post || u.edited_message || u.my_chat_member;
            const cId = msg?.chat?.id ? String(msg.chat.id) : "";
            return {
              chatId: cId,
              chatType: msg?.chat?.type,
              name: msg?.chat?.title || `${msg?.from?.first_name || ""} ${msg?.from?.last_name || ""}`.trim() || "Utilisateur",
              username: msg?.chat?.username || msg?.from?.username,
              text: msg?.text || (msg?.chat?.type === "group" ? `Groupe: ${msg?.chat?.title || ""}` : ""),
              date: msg?.date ? new Date(msg.date * 1e3).toISOString() : null
            };
          }).filter((u) => {
            if (!u.chatId || seen.has(u.chatId)) return false;
            seen.add(u.chatId);
            return true;
          });
        }
      } catch (fetchErr) {
        apiError = fetchErr?.message || "Erreur de connexion API Telegram";
      }
    }
    res.json({
      configured: Boolean(config.token && botInfo),
      tokenMasked: config.token ? `${config.token.slice(0, 10)}...` : "",
      activeChats: config.chatIds,
      primaryChatId: config.primaryChatId,
      chatId: settings.telegramChatId || "",
      preorderChatId: settings.telegramPreorderChatId || "",
      proformaChatId: settings.telegramProformaChatId || "",
      accessChatId: settings.telegramAccessChatId || "",
      resolvedPreorderChats: preorderConfig.chatIds,
      resolvedProformaChats: proformaConfig.chatIds,
      resolvedAccessChats: accessConfig.chatIds,
      isChatIdSelfBot: false,
      enabled: config.enabled,
      bot: botInfo,
      subscribers: updates,
      error: apiError
    });
  } catch (err) {
    console.error("[API] GET /api/telegram/status error:", err);
    res.status(500).json({ error: "Erreur lors de la v\xE9rification du statut Telegram." });
  }
});
app.all("/api/telegram/detect", async (req, res) => {
  try {
    const db = await loadDatabaseAsync();
    const settings = db.storeSettings || {};
    const reqToken = req.body?.token || req.query?.token;
    const config = await resolveTelegramConfig("general");
    const token = reqToken || config.token;
    if (!token) {
      return res.status(400).json({
        success: false,
        count: 0,
        detectedChats: [],
        error: "Aucun token Telegram configur\xE9."
      });
    }
    let botInfo = null;
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const meJson = await meRes.json();
      if (meJson.ok) {
        botInfo = meJson.result;
      }
    } catch (e) {
      console.warn("[Telegram Detector] getMe error:", e);
    }
    try {
      const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const whJson = await whRes.json();
      if (whJson.ok && whJson.result?.url) {
        console.log("[Telegram Detector] Clearing webhook to allow getUpdates polling...");
        await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
      }
    } catch (e) {
    }
    const detectedMap = /* @__PURE__ */ new Map();
    const getAssignedChannels = (cId) => {
      const assigned = [];
      const clean = cId.trim();
      if (settings.telegramPreorderChatId && settings.telegramPreorderChatId.includes(clean)) assigned.push("preorder");
      if (settings.telegramProformaChatId && settings.telegramProformaChatId.includes(clean)) assigned.push("proforma");
      if (settings.telegramAccessChatId && settings.telegramAccessChatId.includes(clean)) assigned.push("access");
      if (settings.telegramChatId && settings.telegramChatId.includes(clean)) assigned.push("general");
      return assigned;
    };
    const seedChats = [
      {
        chatId: "-5365585827",
        name: "Groupe commande (Tulip)",
        chatType: "group",
        lastMessage: "Canal de diffusion officiel des commandes"
      },
      {
        chatId: "5680755596",
        name: "Tulip Oran (Admin)",
        username: "tulip_oran",
        chatType: "private",
        lastMessage: "Compte administrateur principal"
      }
    ];
    const configuredCustom = [
      { id: settings.telegramPreorderChatId, label: "Canal Pr\xE9commandes Configur\xE9" },
      { id: settings.telegramProformaChatId, label: "Canal Proforma Configur\xE9" },
      { id: settings.telegramAccessChatId, label: "Canal Acc\xE8s Pro Configur\xE9" },
      { id: settings.telegramChatId, label: "Canal G\xE9n\xE9ral Configur\xE9" }
    ];
    for (const custom of configuredCustom) {
      if (custom.id) {
        const ids = extractChatIds(custom.id);
        for (const cId of ids) {
          if (!seedChats.some((s) => s.chatId === cId)) {
            seedChats.push({
              chatId: cId,
              name: custom.label,
              chatType: cId.startsWith("-") ? "group" : "private",
              lastMessage: "ID enregistr\xE9 dans les param\xE8tres"
            });
          }
        }
      }
    }
    for (const s of seedChats) {
      detectedMap.set(s.chatId, {
        chatId: s.chatId,
        name: s.name,
        username: s.username,
        chatType: s.chatType,
        lastMessage: s.lastMessage,
        date: (/* @__PURE__ */ new Date()).toISOString(),
        isConfigured: getAssignedChannels(s.chatId).length > 0,
        assignedChannels: getAssignedChannels(s.chatId)
      });
    }
    try {
      const upRes = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?limit=100&allowed_updates=${encodeURIComponent(
          JSON.stringify(["message", "edited_message", "channel_post", "my_chat_member", "chat_member"])
        )}`
      );
      const upJson = await upRes.json();
      if (upJson.ok && Array.isArray(upJson.result)) {
        for (const u of upJson.result) {
          const msg = u.message || u.channel_post || u.edited_message || u.my_chat_member;
          if (!msg?.chat?.id) continue;
          const cId = String(msg.chat.id);
          const chatType = msg.chat.type || (cId.startsWith("-") ? "group" : "private");
          const chatTitle = msg.chat.title || `${msg.from?.first_name || ""} ${msg.from?.last_name || ""}`.trim() || msg.chat.username || "Utilisateur Telegram";
          const username = msg.chat.username || msg.from?.username;
          const text = msg.text || (msg.chat.type === "group" || msg.chat.type === "supergroup" ? `Message groupe: ${msg.chat.title || ""}` : "Interaction r\xE9cente");
          const date = msg.date ? new Date(msg.date * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
          detectedMap.set(cId, {
            chatId: cId,
            name: chatTitle,
            username,
            chatType,
            lastMessage: text,
            date,
            isConfigured: getAssignedChannels(cId).length > 0,
            assignedChannels: getAssignedChannels(cId)
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
      bot: botInfo
    });
  } catch (err) {
    console.error("[API] /api/telegram/detect error:", err);
    res.status(500).json({
      success: false,
      count: 0,
      detectedChats: [],
      error: err.message || "Erreur interne du d\xE9tecteur Telegram."
    });
  }
});
app.post("/api/telegram/test", async (req, res) => {
  try {
    const { chatId: reqChatId, token: reqToken, channelType = "general" } = req.body;
    const config = await resolveTelegramConfig(channelType);
    const activeToken = reqToken || config.token;
    if (!activeToken) {
      return res.status(400).json({ error: "Aucun Token de Bot Telegram configur\xE9." });
    }
    const testTargets = reqChatId ? extractChatIds(String(reqChatId)) : config.chatIds;
    if (!testTargets || testTargets.length === 0) {
      return res.status(400).json({
        error: "Aucun destinataire Telegram configur\xE9 pour ce canal."
      });
    }
    let typeTitle = "G\xC9N\xC9RAL";
    let icon = "\u{1F514}";
    let typeDesc = "Liaison directe avec votre boutique Tulip Fragrance";
    if (channelType === "preorder") {
      typeTitle = "PR\xC9COMMANDES FERMES";
      icon = "\u{1F338}";
      typeDesc = "Ce canal recevra automatiquement toutes les nouvelles pr\xE9commandes.";
    } else if (channelType === "proforma") {
      typeTitle = "FACTURES PROFORMA";
      icon = "\u{1F4C4}";
      typeDesc = "Ce canal recevra automatiquement toutes les demandes de devis proforma.";
    } else if (channelType === "access") {
      typeTitle = "DEMANDES D'ACC\xC8S PROFESSIONNEL";
      icon = "\u{1F511}";
      typeDesc = "Ce canal recevra automatiquement toutes les demandes d'inscription / acc\xE8s pro.";
    }
    const testHtml = `${icon} <b>TEST CANAL D\xC9DI\xC9 - ${typeTitle}</b>
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2705 <b>Liaison Telegram confirm\xE9e !</b>
\u{1F916} Bot actif : <code>@tulip5661bot</code>
\u{1F4CC} <b>R\xF4le de ce canal :</b> ${typeDesc}
\u{1F4C5} <i>Date du test : ${(/* @__PURE__ */ new Date()).toLocaleString("fr-DZ")}</i>
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F3E2} <i>Tulip Fragrance Company \u2022 Bir El Djir, Oran</i>`;
    const results = [];
    for (const target of testTargets) {
      if (target === BOT_SELF_ID) continue;
      const tgResp = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: target,
          text: testHtml,
          parse_mode: "HTML"
        })
      });
      const tgJson = await tgResp.json();
      results.push({ target, ok: Boolean(tgJson && tgJson.ok), data: tgJson });
    }
    const anySuccess = results.some((r) => r.ok);
    if (!anySuccess) {
      return res.status(400).json({
        success: false,
        error: "Impossible d'envoyer le message de test sur ce canal Telegram. V\xE9rifiez l'ID et que le bot @tulip5661bot a \xE9t\xE9 d\xE9marr\xE9 ou ajout\xE9 au groupe.",
        results
      });
    }
    return res.json({
      success: true,
      message: `Notification test [${typeTitle}] envoy\xE9e avec succ\xE8s (${results.filter((r) => r.ok).length} canal/canaux) !`,
      results
    });
  } catch (err) {
    console.error("[API] POST /api/telegram/test error:", err);
    return res.status(500).json({ error: "Erreur lors de l'envoi du test Telegram." });
  }
});
app.post("/api/telegram/save-settings", async (req, res) => {
  try {
    const {
      telegramChatId,
      telegramPreorderChatId,
      telegramProformaChatId,
      telegramAccessChatId,
      telegramBotToken,
      telegramNotificationsEnabled
    } = req.body;
    const db = await loadDatabaseAsync();
    const updatedSettings = {
      ...db.storeSettings,
      ...telegramChatId !== void 0 && { telegramChatId },
      ...telegramPreorderChatId !== void 0 && { telegramPreorderChatId },
      ...telegramProformaChatId !== void 0 && { telegramProformaChatId },
      ...telegramAccessChatId !== void 0 && { telegramAccessChatId },
      ...telegramBotToken !== void 0 && { telegramBotToken },
      ...telegramNotificationsEnabled !== void 0 && { telegramNotificationsEnabled }
    };
    updateSettings(updatedSettings);
    return res.json({ success: true, settings: updatedSettings });
  } catch (err) {
    console.error("[API] POST /api/telegram/save-settings error:", err);
    return res.status(500).json({ error: "Erreur lors de l'enregistrement des param\xE8tres Telegram." });
  }
});
app.get("/api", (_req, res) => {
  res.json({
    status: "ok",
    company: "Tulip Fragrance Company",
    message: "Tulip Fragrance Company API is operational.",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var app_default = app;

// src/server/vercelEntry.ts
function handler(req, res) {
  try {
    return app_default(req, res);
  } catch (err) {
    console.error("[Vercel Serverless Function Error]:", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Erreur interne du serveur Vercel",
        details: err?.message || String(err)
      });
    }
  }
}
export {
  handler as default
};
//# sourceMappingURL=index.js.map
