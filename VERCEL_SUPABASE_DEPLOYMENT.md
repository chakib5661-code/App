# Guide de Déploiement Vercel & Supabase — Tulip Fragrance Company

Ce guide détaille les étapes simples pour déployer **Tulip Fragrance Company** sur **Vercel** avec **Supabase** comme base de données principale et permanente (pour éviter toute perte de données lors des redémarrages de conteneurs serverless).

---

## 1. Préparation de la Base de Données Supabase

1. Créez un compte ou connectez-vous sur [Supabase](https://supabase.com).
2. Créez un nouveau projet (ex: `tulip-fragrance-db`).
3. Dans le menu de gauche, rendez-vous dans le **SQL Editor** (Éditeur SQL).
4. Cliquez sur **New Query** et copiez-collez l'intégralité du fichier `supabase-schema.sql` situé à la racine du projet.
5. Cliquez sur **Run** (Exécuter). Le script créera :
   - La table maître `public.tulip_store_state` (instantanée, synchronisation continue)
   - Les tables relationnelles `tulip_products`, `tulip_orders`, `tulip_customer_applications`, `tulip_customer_users`, `tulip_store_settings`, `tulip_ad_banners`
   - Les politiques de sécurité RLS (*Row Level Security*)
6. Récupérez vos clés d'API dans **Project Settings** > **API** :
   - **Project URL** (ex: `https://xyzcompany.supabase.co`)
   - **service_role secret key** (clé secrète pour le backend Vercel)
   - **anon / public key** (clé publique)

---

## 2. Déploiement sur Vercel

1. Importez votre dépôt GitHub sur [Vercel](https://vercel.com/new).
2. Configurez les paramètres de build :
   - **Framework Preset** : `Vite` (détecté automatiquement)
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`
3. Dans la section **Environment Variables** sur Vercel, ajoutez :

| Variable d'Environnement | Valeur | Description |
|--------------------------|--------|-------------|
| `SUPABASE_URL` | `https://votre-projet.supabase.co` | URL de votre instance Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `ey...` | Clé secrète `service_role` (permet la lecture/écriture sécurisée côté serveur) |
| `SUPABASE_ANON_KEY` | `ey...` | Clé publique anonyme |
| `VITE_SUPABASE_URL` | `https://votre-projet.supabase.co` | Variable exposée au front-end |
| `VITE_SUPABASE_ANON_KEY` | `ey...` | Variable exposée au front-end |
| `TELEGRAM_BOT_TOKEN` | *(Optionnel)* | Token du bot Telegram pour les commandes |
| `TELEGRAM_CHAT_ID` | *(Optionnel)* | Identifiants des salons Telegram |
| `VITE_GA_MEASUREMENT_ID` | *(Optionnel)* | Identifiant Google Analytics 4 |
| `VITE_CLARITY_PROJECT_ID` | *(Optionnel)* | Identifiant Microsoft Clarity |

4. Cliquez sur **Deploy**.

---

## 3. Première Initialisation & Synchronisation Automatique

- Dès le premier démarrage, l'application vérifie si votre base Supabase contient déjà vos produits et paramètres.
- Si la base Supabase est vide, le serveur **pousse automatiquement l'intégralité du catalogue initial et des paramètres** vers Supabase.
- Vous pouvez également tester la liaison ou forcer la synchronisation à tout moment depuis l'**Espace Gestionnaire** > **Sécurité** > **Stockage Cloud Supabase** (*Tester Connexion* / *Pousser vers Supabase*).
