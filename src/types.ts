export type ProductFamily = 'Extrait' | 'Flacon' | 'Accessoire';

export interface Product {
  id: string;
  code: string;
  name: string;
  family: ProductFamily;
  category?: string;
  unit: string; // e.g., '1g (Contenant 100g)' for Extrait, 'Carton de 50' for Flacon
  containerSizeG?: number; // for Extrait: 100g container size
  priceDA: number; // for Extrait: DA per 1g
  discountPercent?: number; // Solde % (e.g. 10 for 10% discount, 15 for 15% discount)
  stock: number; // for Extrait: total grams available
  minAlertStock?: number;
  description?: string;
  origin?: string; // e.g., 'Grasse, France', 'Espagne', 'Local'
  imageUrl?: string;
  isHidden?: boolean; // In admin flacon/catalog section: button to hide/show from public store
  isTopSeller?: boolean; // Highlighted as top seller / high stock
  lastUpdated?: string;
  arabicName?: string;
  gender?: string;
  capacityMl?: string | number;
  lowStockThreshold?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type DeliveryMode = 'domicile' | 'stop_desk' | 'magasin';

export interface CustomerDetails {
  fullName: string;
  phone: string;
  secondaryPhone?: string;
  wilayaCode: string;
  wilayaName: string;
  commune: string;
  deliveryAddress: string;
  deliveryMode: DeliveryMode;
  notes?: string;
  companyName?: string;
  email?: string;
}

export interface PreOrder {
  id: string;
  orderNumber: string;
  date: string;
  createdAt?: string;
  customerId?: string;
  customerUsername?: string;
  customer: CustomerDetails;
  items: {
    productId: string;
    code: string;
    name: string;
    family: ProductFamily;
    unit: string;
    priceDA: number;
    quantity: number;
    totalDA: number;
  }[];
  totalDA: number;
  status: 'en_attente' | 'confirmee' | 'en_preparation' | 'livree' | 'annulee';
  isProforma?: boolean;
  isOfflinePending?: boolean;
  syncedAt?: string;
}

export interface Wilaya {
  code: string;
  name: string;
  arabicName: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  phone: string;
  phoneSecondary?: string;
  whatsappPhone: string;
  telegramPhone: string;
  address: string;
  wilaya: string;
  email: string;
  allowLowStockPreorder: boolean;
  minOrderAmountDA: number;
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramPreorderChatId?: string;
  telegramProformaChatId?: string;
  telegramAccessChatId?: string;
  telegramNotificationsEnabled?: boolean;
}

export interface ManagerPermissions {
  canManageProducts: boolean;
  canManageOrders: boolean;
  canManageCustomers: boolean;
  canManageBanners: boolean;
  canViewAnalytics: boolean; // Admin only by default!
}

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  role: 'admin' | 'manager';
  password: string;
  createdAt: string;
  permissions?: ManagerPermissions;
}

export type CustomerAccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface CustomerApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  companyName?: string; // Nom de la parfumerie / boutique
  commercialRegister?: string; // Numéro RC / Carte artisan (optionnel)
  wilayaCode?: string;
  wilayaName?: string;
  commune?: string;
  deliveryAddress?: string;
  notes?: string;
  submittedAt: string;
  status: CustomerAccountStatus;
  // Credentials assigned by administrator after verification
  assignedUsername?: string;
  assignedPassword?: string;
  approvedAt?: string;
  approvedBy?: string;
  verificationNotes?: string;
}

export interface CustomerUser {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  companyName?: string;
  wilayaCode?: string;
  wilayaName?: string;
  commune?: string;
  deliveryAddress?: string;
  status: CustomerAccountStatus;
  createdAt?: string;
  lastLogin?: string;
}

export interface AdBanner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  badgeText?: string;
  linkUrl?: string;
  buttonText?: string;
  targetProductId?: string; // Linked product to automatically add to cart!
  targetProductIds?: string[]; // Multiple linked products to add or select!
  isActive: boolean;
  createdAt: string;
}

export interface SavedPreorder {
  id: string;
  savedAt: string;
  label: string;
  items: CartItem[];
  totalDA?: number;
}

export interface AnalyticsSettings {
  ga4Enabled: boolean;
  ga4MeasurementId: string;
  customEventsEnabled: boolean;
  heatmapsEnabled: boolean;
  heatmapProvider: 'clarity' | 'hotjar';
  heatmapProjectId: string;
  siteSearchTrackingEnabled: boolean;
  // Meta / Facebook Pixel
  metaPixelEnabled: boolean;
  metaPixelId: string;
  // TikTok Pixel
  tiktokPixelEnabled: boolean;
  tiktokPixelId: string;
}

export interface CustomAnalyticsEvent {
  id: string;
  eventName: string;
  category: 'ecommerce' | 'search' | 'auth' | 'interaction';
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface SearchQueryLog {
  id: string;
  query: string;
  resultsCount: number;
  timestamp: string;
  filterFamily?: string;
}

