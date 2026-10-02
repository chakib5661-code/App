-- =========================================================================
-- TULIP FRAGRANCE COMPANY - SUPABASE DATABASE INITIALIZATION SCHEMA
-- =========================================================================
-- Run this script in your Supabase project's SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- It creates the master state snapshot table and normalized relational tables.
-- =========================================================================

-- 1. MASTER STATE SNAPSHOT TABLE (Atomic Document Storage for Vercel & Fast Sync)
CREATE TABLE IF NOT EXISTS public.tulip_store_state (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for instant JSONB queries
CREATE INDEX IF NOT EXISTS idx_tulip_store_state_updated_at ON public.tulip_store_state (updated_at);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.tulip_products (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  family TEXT NOT NULL,
  sub_family TEXT,
  notes TEXT,
  price_da NUMERIC NOT NULL DEFAULT 0,
  stock NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'g',
  description TEXT,
  image_url TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_new BOOLEAN NOT NULL DEFAULT FALSE,
  discount_percent NUMERIC,
  fragrance_pyramid JSONB,
  safety_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tulip_products_family ON public.tulip_products (family);
CREATE INDEX IF NOT EXISTS idx_tulip_products_code ON public.tulip_products (code);

-- 3. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.tulip_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_da NUMERIC NOT NULL DEFAULT 0,
  is_proforma BOOLEAN NOT NULL DEFAULT FALSE,
  customer JSONB NOT NULL,
  items JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tulip_orders_order_number ON public.tulip_orders (order_number);
CREATE INDEX IF NOT EXISTS idx_tulip_orders_status ON public.tulip_orders (status);

-- 4. CUSTOMER APPLICATIONS TABLE (B2B Demandes d'Ouverture de Compte)
CREATE TABLE IF NOT EXISTS public.tulip_customer_applications (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  company_name TEXT,
  commercial_register_num TEXT,
  nif TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  secondary_phone TEXT,
  wilaya_code TEXT NOT NULL,
  wilaya_name TEXT NOT NULL,
  commune TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  business_activity TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  assigned_username TEXT,
  assigned_password TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tulip_cust_apps_phone ON public.tulip_customer_applications (phone);
CREATE INDEX IF NOT EXISTS idx_tulip_cust_apps_status ON public.tulip_customer_applications (status);

-- 5. CUSTOMER USERS TABLE (Comptes Clients Authentifiés)
CREATE TABLE IF NOT EXISTS public.tulip_customer_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  secondary_phone TEXT,
  wilaya_code TEXT NOT NULL,
  wilaya_name TEXT NOT NULL,
  commune TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tulip_customer_users_username ON public.tulip_customer_users (username);
CREATE INDEX IF NOT EXISTS idx_tulip_customer_users_phone ON public.tulip_customer_users (phone);

-- 6. AD BANNERS TABLE
CREATE TABLE IF NOT EXISTS public.tulip_ad_banners (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  badge_text TEXT,
  button_text TEXT,
  target_url TEXT,
  target_product_ids JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. STORE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.tulip_store_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  store_name TEXT NOT NULL DEFAULT 'Tulip Fragrance Company',
  store_subtitle TEXT,
  phone TEXT NOT NULL DEFAULT '0550 00 00 00',
  secondary_phone TEXT,
  email TEXT,
  address TEXT,
  wilaya TEXT,
  minimum_order_amount_da NUMERIC NOT NULL DEFAULT 0,
  is_prices_visible BOOLEAN NOT NULL DEFAULT TRUE,
  banner_announcement TEXT,
  is_banner_active BOOLEAN NOT NULL DEFAULT FALSE,
  catalog_file_url TEXT,
  catalog_file_name TEXT,
  telegram_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.tulip_store_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tulip_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tulip_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tulip_customer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tulip_customer_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tulip_ad_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tulip_store_settings ENABLE ROW LEVEL SECURITY;

-- Allow full access to service_role (used by server.ts backend on Vercel)
DROP POLICY IF EXISTS "Service role full access on tulip_store_state" ON public.tulip_store_state;
CREATE POLICY "Service role full access on tulip_store_state" ON public.tulip_store_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on tulip_products" ON public.tulip_products;
CREATE POLICY "Service role full access on tulip_products" ON public.tulip_products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on tulip_orders" ON public.tulip_orders;
CREATE POLICY "Service role full access on tulip_orders" ON public.tulip_orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on tulip_customer_applications" ON public.tulip_customer_applications;
CREATE POLICY "Service role full access on tulip_customer_applications" ON public.tulip_customer_applications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on tulip_customer_users" ON public.tulip_customer_users;
CREATE POLICY "Service role full access on tulip_customer_users" ON public.tulip_customer_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on tulip_ad_banners" ON public.tulip_ad_banners;
CREATE POLICY "Service role full access on tulip_ad_banners" ON public.tulip_ad_banners
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on tulip_store_settings" ON public.tulip_store_settings;
CREATE POLICY "Service role full access on tulip_store_settings" ON public.tulip_store_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow public read access to anon key for products, public settings, and banners
DROP POLICY IF EXISTS "Anon read access on tulip_products" ON public.tulip_products;
CREATE POLICY "Anon read access on tulip_products" ON public.tulip_products
  FOR SELECT TO anon USING (is_hidden = false);

DROP POLICY IF EXISTS "Anon read access on tulip_ad_banners" ON public.tulip_ad_banners;
CREATE POLICY "Anon read access on tulip_ad_banners" ON public.tulip_ad_banners
  FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "Anon read access on tulip_store_settings" ON public.tulip_store_settings;
CREATE POLICY "Anon read access on tulip_store_settings" ON public.tulip_store_settings
  FOR SELECT TO anon USING (true);

-- Allow anon key full access on tulip_store_state if using anon key as server key
DROP POLICY IF EXISTS "Anon full access on tulip_store_state" ON public.tulip_store_state;
CREATE POLICY "Anon full access on tulip_store_state" ON public.tulip_store_state
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- =========================================================================
-- SUPABASE REALTIME REPLICATION (Instant Real-Time Multi-Device Sync)
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'tulip_store_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tulip_store_state;
  END IF;
END $$;

-- Confirmation check
SELECT 'Tulip Fragrance Company schema & real-time replication successfully installed!' AS result;
