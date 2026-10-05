/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Sparkles,
  Layers,
  Wrench,
  FileSpreadsheet,
  PackageCheck,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Truck,
  ArrowUpRight,
  ExternalLink,
  Lock,
  Unlock,
  LayoutGrid,
  Globe,
  RotateCcw,
  X,
} from 'lucide-react';
import { Product, ProductFamily, CartItem, CustomerDetails, PreOrder, StoreSettings, CustomerApplication, CustomerUser, CustomerAccountStatus, AdBanner, SavedPreorder } from './types';
import { INITIAL_PRODUCTS, INITIAL_STORE_SETTINGS } from './data/initialProducts';
import { INITIAL_CUSTOMER_APPLICATIONS, INITIAL_AD_BANNERS } from './data/initialCustomerData';
import { Header } from './components/Header';
import { ProductCard } from './components/ProductCard';
import { ProductFilter, StockFilterType, SortOption } from './components/ProductFilter';
import { CartDrawer } from './components/CartDrawer';
import { PreOrderModal } from './components/PreOrderModal';
import { OrderConfirmationModal } from './components/OrderConfirmationModal';
import { ExcelSyncModal } from './components/ExcelSyncModal';
import { AdminOrdersModal } from './components/AdminOrdersModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminPortal } from './components/AdminPortal';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { AdPopupModal } from './components/AdPopupModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { QuickOrderView } from './components/QuickOrderView';
import { ProductSkeletonGrid } from './components/ProductSkeletonGrid';
import { InterfaceChoiceModal } from './components/InterfaceChoiceModal';
import { StickyBottomOrderBar } from './components/StickyBottomOrderBar';
import { LanguageSelectionModal } from './components/LanguageSelectionModal';
import { AppLanguage } from './translations';
import { downloadOrderPDF, formatDZD } from './utils/pdfGenerator';
import { trackCustomEvent, applyServerAnalyticsConfig } from './utils/analytics';
import { isProductTopSeller, calculateDiscountedPrice } from './utils/productUtils';
import { detectUserDevice, DeviceInfo } from './utils/deviceDetector';
import {
  fetchSyncData,
  submitOrderToServer,
  updateOrderStatusOnServer,
  approveCustomerOnServer,
  updateCustomerStatusOnServer,
  resetCustomerPasswordOnServer,
  createDirectCustomerOnServer,
  deleteCustomerOnServer,
  updateCustomerOnServer,
  syncAdminUsersOnServer,
  syncProductsOnServer,
  updateSingleProductOnServer,
  updateBannersOnServer,
  importCustomersOnServer,
  restoreAllDataOnServer,
  syncOrdersOnServer,
  subscribeToServerEvents,
  deleteOrderOnServer,
  deleteCustomerApplicationOnServer,
  deleteSingleProductOnServer,
  createSingleProductOnServer,
  saveSingleProductOnServer,
  bulkDeleteOrdersOnServer,
} from './utils/api';
import { playOrderNotificationSound, playAccessNotificationSound } from './utils/audioAlert';
import { subscribeToSupabaseRealtime, triggerAutoSyncToSupabase } from './utils/supabaseClient';

const STORAGE_KEYS = {
  PRODUCTS: 'elathir_catalog_products',
  ORDERS: 'elathir_preorders_list',
  LAST_SYNC: 'elathir_last_stock_sync',
  CART: 'elathir_cart_items',
  CUSTOMER_APPLICATIONS: 'tulip_customer_applications_v1',
  CUSTOMER_USERS: 'tulip_customer_users_v1',
  CURRENT_CUSTOMER: 'tulip_current_customer_v1',
  AD_BANNERS: 'tulip_ad_banners_v1',
  AD_POPUP_ENABLED: 'tulip_ad_popup_enabled_v1',
  AD_POPUP_DISMISSED_DATE: 'tulip_ad_popup_dismissed_date_v1',
  AD_POPUP_LAST_SHOWN: 'tulip_ad_popup_last_shown_time_v1',
  SAVED_PREORDERS: 'tulip_saved_preorders_v1',
  INTERFACE_MODE: 'tulip_interface_mode_v1',
  INTERFACE_CHOSEN: 'tulip_interface_chosen_v1',
  OFFLINE_ORDERS_QUEUE: 'tulip_offline_orders_queue_v1',
};

// 15-minute delay between advertising popup displays
const AD_POPUP_DELAY_MS = 15 * 60 * 1000;

// Offline Orders Queue Helpers (Permits adding & preordering offline, then auto-sending when connection returns)
const loadOfflineOrdersQueue = (): PreOrder[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.OFFLINE_ORDERS_QUEUE);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load offline orders queue:', e);
  }
  return [];
};

const saveOfflineOrdersQueue = (queue: PreOrder[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.OFFLINE_ORDERS_QUEUE, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline orders queue:', e);
  }
};

const enqueueOfflineOrder = (order: PreOrder): void => {
  const queue = loadOfflineOrdersQueue();
  const existingIdx = queue.findIndex((o) => o.id === order.id || o.orderNumber === order.orderNumber);
  const updatedOrder: PreOrder = { ...order, isOfflinePending: true };
  if (existingIdx >= 0) {
    queue[existingIdx] = updatedOrder;
  } else {
    queue.push(updatedOrder);
  }
  saveOfflineOrdersQueue(queue);
};

const dequeueOfflineOrder = (orderId: string): void => {
  const queue = loadOfflineOrdersQueue();
  const updated = queue.filter((o) => o.id !== orderId);
  saveOfflineOrdersQueue(updated);
};

// Customer-Scoped Helpers for Save For Later
const getSavedPreordersKey = (customer: CustomerUser | null): string => {
  if (customer && customer.id) {
    return `tulip_saved_preorders_cust_${customer.id}`;
  }
  let guestId = '';
  try {
    guestId = localStorage.getItem('tulip_guest_device_id') || '';
    if (!guestId) {
      guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('tulip_guest_device_id', guestId);
    }
  } catch {
    guestId = 'guest_session';
  }
  return `tulip_saved_preorders_guest_${guestId}`;
};

const loadSavedPreordersForCustomer = (customer: CustomerUser | null): SavedPreorder[] => {
  try {
    const key = getSavedPreordersKey(customer);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error(e);
  }
  return [];
};

// Safe localStorage setter that never throws, cleans up bloated cache, and handles QuotaExceededError
const safeSetStorageItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (err: any) {
    console.warn(`[Storage] Quota notice for key "${key}":`, err?.message || err);
    try {
      // Clear non-critical caches to reclaim space
      localStorage.removeItem('tulip_analytics_events');
      localStorage.removeItem('tulip_analytics_search_logs');
      // Retry once after clearing transient logs
      localStorage.setItem(key, value);
    } catch {
      // Gracefully silent: the app functions seamlessly in-memory and on the server
    }
  }
};

const cacheProductsLocally = (products: Product[]): void => {
  // Completely disabled: do not save catalog data offline
};

const cacheBannersLocally = (banners: AdBanner[]): void => {
  // Completely disabled: do not save banner data offline
};

// Safe client session initialization without purging user database
// (Session purging block removed to preserve customer sessions upon refresh)

export default function App() {
  // 1. Core State (Always starts empty and fetches fresh from the live database)
  const [products, setProducts] = useState<Product[]>([]);

  // Rapid Store Access: Shell loads with sleek loading animation until fresh data is delivered
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(true);

  useEffect(() => {
    // Ultra-fast safety fallback: reveal catalog shell within 800ms
    const timer = setTimeout(() => {
      setIsCatalogLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Sync live catalog on startup
  useEffect(() => {
    let active = true;

    // Trigger live sync from Server/Supabase database authority on mount
    setIsSyncingStocks(true);
    fetchSyncData(3000).then((data) => {
      if (!active || !data) return;

      // Auto-restore trigger: If client has more products in master backup, restore server!
      const savedBackupStr = localStorage.getItem('tulip_admin_master_backup');
      if (savedBackupStr) {
        try {
          const backup = JSON.parse(savedBackupStr);
          if (backup && Array.isArray(backup.products) && backup.products.length > (data.products?.length || 0)) {
            handleAutoRestoreLocalDb();
            return;
          }
        } catch {}
      }

      if (Array.isArray(data.products) && data.products.length > 0) {
        setProducts(data.products);
        setIsCatalogLoading(false);
      }
      if (Array.isArray(data.orders)) {
        const sorted = [...data.orders].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const offlineQueue = loadOfflineOrdersQueue();
        if (offlineQueue.length > 0) {
          setOrders([
            ...offlineQueue,
            ...sorted.filter(
              (so) => !offlineQueue.some((oo) => oo.id === so.id || oo.orderNumber === so.orderNumber)
            ),
          ]);
        } else {
          setOrders(sorted);
        }
      }
      if (Array.isArray(data.customerApplications)) setCustomerApplications(data.customerApplications);
      if (Array.isArray(data.customerUsers)) setCustomerUsers(data.customerUsers);
      if (Array.isArray(data.adBanners)) setAdBanners(data.adBanners);
      if (data.storeSettings) setStoreSettings(data.storeSettings);
    }).catch(() => {})
    .finally(() => {
      if (active) setIsSyncingStocks(false);
    });

    return () => { active = false; };
  }, []);

  const [orders, setOrders] = useState<PreOrder[]>([]);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CART);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item: any) =>
              item &&
              item.product &&
              typeof item.product.id === 'string' &&
              typeof item.product.priceDA === 'number' &&
              typeof item.quantity === 'number' &&
              item.quantity > 0
          );
        }
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [storeSettings, setStoreSettings] = useState<StoreSettings>(INITIAL_STORE_SETTINGS);

  const [lastStockSyncDate, setLastStockSyncDate] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || new Date().toISOString();
  });

  // 2. Filter & Navigation State
  const [selectedFamily, setSelectedFamily] = useState<ProductFamily | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilterType>('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [showOnlyTopSellers, setShowOnlyTopSellers] = useState(false);
  const [welcomeCustomer, setWelcomeCustomer] = useState<{
    fullName: string;
    companyName?: string;
  } | null>(null);

  // 3. View mode: Store Catalog vs Admin Portal page
  const [currentView, setCurrentView] = useState<'store' | 'admin'>(() => {
    if (typeof window !== 'undefined' && (window.location.hash === '#admin' || window.location.search.includes('view=admin'))) {
      return 'admin';
    }
    return 'store';
  });

  // 4. Modal Controls & Admin Mode
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPreOrderModalOpen, setIsPreOrderModalOpen] = useState(false);
  const [isProformaMode, setIsProformaMode] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isExcelSyncOpen, setIsExcelSyncOpen] = useState(false);
  const [isAdminOrdersOpen, setIsAdminOrdersOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [recentOrder, setRecentOrder] = useState<PreOrder | null>(null);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  // PWA Device Detection, Installation Guide & Offline Network State
  const [isPwaGuideOpen, setIsPwaGuideOpen] = useState(false);
  const deviceInfo: DeviceInfo = useMemo(() => detectUserDevice(), []);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cachedImagesCount, setCachedImagesCount] = useState<number>(0);
  const [isSyncingStocks, setIsSyncingStocks] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // 5. Customer Authentication & Application Management State
  const [customerApplications, setCustomerApplications] = useState<CustomerApplication[]>([]);
  const [customerUsers, setCustomerUsers] = useState<CustomerUser[]>([]);

  const [currentCustomer, setCurrentCustomer] = useState<CustomerUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_CUSTOMER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.id) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  // Keep a reference to currentCustomer to prevent infinite re-render loops during background sync
  const currentCustomerRef = useRef<CustomerUser | null>(currentCustomer);
  useEffect(() => {
    currentCustomerRef.current = currentCustomer;
  }, [currentCustomer]);

  const [isCustomerAuthOpen, setIsCustomerAuthOpen] = useState(false);
  const [customerAuthInitialTab, setCustomerAuthInitialTab] = useState<'login' | 'register'>('login');

  // Strict Rule: Prices are ONLY visible if a verified customer is logged in!
  const isPricesVisible = Boolean(currentCustomer && currentCustomer.status === 'approved');

  // 6. Advertising Popup State
  const [adBanners, setAdBanners] = useState<AdBanner[]>([]);

  const [isAdPopupEnabled, setIsAdPopupEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AD_POPUP_ENABLED);
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return true;
  });

  const [isAdPopupOpen, setIsAdPopupOpen] = useState(false);
  const [currentAdPopup, setCurrentAdPopup] = useState<AdBanner | null>(null);
  const [isOrderTrackingOpen, setIsOrderTrackingOpen] = useState(false);
  const [isMainPageLoaded, setIsMainPageLoaded] = useState(true);

  // Ad banners ref to prevent polling re-triggers from resetting or re-opening the popup
  const adBannersRef = useRef(adBanners);
  useEffect(() => {
    adBannersRef.current = adBanners;
  }, [adBanners]);

  // 7. Multi-Language State (Arabic as default, French, English)
  const [currentLang, setCurrentLang] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem('tulip_app_lang');
      if (saved === 'fr' || saved === 'ar' || saved === 'en') return saved;
    } catch (e) {
      console.error(e);
    }
    return 'ar';
  });

  const handleSelectLanguage = (lang: AppLanguage) => {
    setCurrentLang(lang);
    try {
      localStorage.setItem('tulip_app_lang', lang);
    } catch (e) {
      console.error(e);
    }
  };

  // Synchronize document direction and lang with current language
  useEffect(() => {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = 'ltr'; // Layout stays LTR for accessibility and right-handed reachability
  }, [currentLang]);

  // 8. Interface Mode & Saved Preorders State
  const [currentInterface, setCurrentInterface] = useState<'showroom' | 'quick'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INTERFACE_MODE);
      if (saved === 'showroom' || saved === 'quick') return saved;
    } catch (e) {
      console.error(e);
    }
    return 'showroom';
  });

  const [isInterfaceChoiceOpen, setIsInterfaceChoiceOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  const handleConfirmLanguageSelection = (lang: AppLanguage) => {
    handleSelectLanguage(lang);
    try {
      localStorage.setItem('tulip_lang_chosen_v1', 'true');
    } catch (e) {
      console.error(e);
    }
    setIsLanguageModalOpen(false);
  };

  // Customer Favorites State
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tulip_customer_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('tulip_customer_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error(e);
    }
  }, [favorites]);

  const handleToggleFavorite = (productId: string) => {
    setFavorites((prev) => {
      const exists = prev.includes(productId);
      const updated = exists ? prev.filter((id) => id !== productId) : [...prev, productId];
      return updated;
    });
  };

  const [savedPreorders, setSavedPreorders] = useState<SavedPreorder[]>(() => {
    return loadSavedPreordersForCustomer(currentCustomer);
  });

  const [activeRestoredId, setActiveRestoredId] = useState<string | null>(null);

  // Re-sync saved preorders whenever customer signs in, signs out, or switches accounts
  useEffect(() => {
    setSavedPreorders(loadSavedPreordersForCustomer(currentCustomer));
  }, [currentCustomer]);

  // Automatically scroll to the top of the catalog when search query changes
  useEffect(() => {
    if (!searchQuery) return;
    
    // Debounce the scroll to top so it doesn't jump while typing rapidly
    const timeout = setTimeout(() => {
      const catalogEl = document.getElementById('search-products-input');
      if (catalogEl) {
        // Scroll the filter bar/catalog smoothly into view
        catalogEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Rapid store entry: default directly to showroom on first visit without blocking modal
  useEffect(() => {
    try {
      const hasChosen = localStorage.getItem(STORAGE_KEYS.INTERFACE_CHOSEN);
      if (!hasChosen) {
        localStorage.setItem(STORAGE_KEYS.INTERFACE_CHOSEN, 'true');
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSelectInterface = (mode: 'showroom' | 'quick') => {
    setCurrentInterface(mode);
    try {
      localStorage.setItem(STORAGE_KEYS.INTERFACE_MODE, mode);
      localStorage.setItem(STORAGE_KEYS.INTERFACE_CHOSEN, 'true');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveCurrentCart = (customLabel?: string) => {
    if (cart.length === 0) return;
    const newDraft: SavedPreorder = {
      id: `draft-${Date.now()}`,
      savedAt: new Date().toISOString(),
      label: customLabel || `Bon de précommande (${cart.length} réf.)`,
      items: [...cart],
      totalDA: cartTotalDA,
    };
    const updated = [newDraft, ...savedPreorders];
    setSavedPreorders(updated);
    try {
      const key = getSavedPreordersKey(currentCustomer);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    // Empty the cart drawer after save for later as requested
    setCart([]);
    try {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
    } catch (e) {
      console.error(e);
    }
    setSyncToastMessage(
      currentLang === 'ar'
        ? 'تم حفظ طلبك المسبق وإفراغ السلة بنجاح !'
        : 'Précommande enregistrée avec succès ! Le panier actif a été réinitialisé.'
    );
    setTimeout(() => setSyncToastMessage(null), 3500);
  };

  const handleLoadSavedPreorder = (savedOrder: SavedPreorder) => {
    setCart(savedOrder.items);
    setActiveRestoredId(savedOrder.id);
    setSyncToastMessage(
      currentLang === 'ar'
        ? `تم استرجاع: ${savedOrder.label}`
        : `Le bon « ${savedOrder.label} » a été chargé dans votre panier !`
    );
    setTimeout(() => setSyncToastMessage(null), 3500);
  };

  const handleDeleteSavedPreorder = (id: string) => {
    const updated = savedPreorders.filter((o) => o.id !== id);
    setSavedPreorders(updated);
    try {
      const key = getSavedPreordersKey(currentCustomer);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Global Return / Escape key listener to close active popups, drawers, and modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (quickViewProduct) {
          setQuickViewProduct(null);
        } else if (isCustomerAuthOpen) {
          setIsCustomerAuthOpen(false);
        } else if (isCartOpen) {
          setIsCartOpen(false);
        } else if (isPreOrderModalOpen) {
          setIsPreOrderModalOpen(false);
        } else if (isConfirmationOpen) {
          setIsConfirmationOpen(false);
        } else if (isOrderTrackingOpen) {
          setIsOrderTrackingOpen(false);
        } else if (isLanguageModalOpen) {
          setIsLanguageModalOpen(false);
        } else if (isInterfaceChoiceOpen) {
          setIsInterfaceChoiceOpen(false);
        } else if (isExcelSyncOpen) {
          setIsExcelSyncOpen(false);
        } else if (isAdminOrdersOpen) {
          setIsAdminOrdersOpen(false);
        } else if (isAdPopupOpen) {
          setIsAdPopupOpen(false);
          try {
            localStorage.setItem(STORAGE_KEYS.AD_POPUP_LAST_SHOWN, String(Date.now()));
          } catch (e) {
            console.error(e);
          }
        } else if (isPwaGuideOpen) {
          setIsPwaGuideOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    quickViewProduct,
    isCustomerAuthOpen,
    isCartOpen,
    isPreOrderModalOpen,
    isConfirmationOpen,
    isOrderTrackingOpen,
    isLanguageModalOpen,
    isInterfaceChoiceOpen,
    isExcelSyncOpen,
    isAdminOrdersOpen,
    isAdPopupOpen,
    isPwaGuideOpen,
  ]);

  // Sync window hash with currentView (supports #admin, #main, #/main, '')
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#admin') {
        setCurrentView('admin');
      } else {
        setCurrentView('store');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Main page load trigger: storefront is ready immediately
  useEffect(() => {
    setIsMainPageLoaded(true);
  }, []);

  // Advertising popup: enforces 15-minute delay across reloads and request submissions
  useEffect(() => {
    if (!isMainPageLoaded) return;
    if (currentView !== 'store') return; // Only display on storefront, never in administration
    if (!isAdPopupEnabled) return;

    const checkAndShowPopup = () => {
      if (isAdPopupOpen) return;

      try {
        // Enforce 15-minute delay from last appearance or request submission
        const lastShown = localStorage.getItem(STORAGE_KEYS.AD_POPUP_LAST_SHOWN);
        if (lastShown) {
          const elapsed = Date.now() - Number(lastShown);
          if (elapsed < AD_POPUP_DELAY_MS) {
            return;
          }
        }

        // Check if dismissed today
        const dismissedToday = localStorage.getItem(STORAGE_KEYS.AD_POPUP_DISMISSED_DATE);
        const todayStr = new Date().toISOString().slice(0, 10);
        if (dismissedToday === todayStr) return;

        const activeAds = adBannersRef.current.filter((b) => b.isActive);
        if (activeAds.length > 0) {
          const randomBanner = activeAds[Math.floor(Math.random() * activeAds.length)];
          setCurrentAdPopup(randomBanner);
          setIsAdPopupOpen(true);
          // Set timestamp immediately upon opening so reloads within 15 min do not trigger
          localStorage.setItem(STORAGE_KEYS.AD_POPUP_LAST_SHOWN, String(Date.now()));
        }
      } catch (e) {
        console.warn('[AdPopup] Delay check warning:', e);
      }
    };

    // Check once after storefront has fully loaded
    checkAndShowPopup();

    // Check periodically every minute in case 15 minutes have elapsed while customer is browsing
    const interval = setInterval(checkAndShowPopup, 60000);
    return () => clearInterval(interval);
  }, [isMainPageLoaded, currentView, isAdPopupEnabled]);

  // Safe persistence effects & Offline PWA Caching (Debounced to guarantee 0ms UI lag)
  const isImagePrefetchedRef = useRef(false);

  useEffect(() => {
    // Product caching and offline image prefetching are completely disabled to guarantee fresh delivery
  }, [products]);

  useEffect(() => {
    const timer = setTimeout(() => {
      safeSetStorageItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    }, 200);
    return () => clearTimeout(timer);
  }, [cart]);

  useEffect(() => {
    if (currentCustomer) {
      safeSetStorageItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(currentCustomer));
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_CUSTOMER);
      } catch {}
    }
  }, [currentCustomer]);

  useEffect(() => {
    const timer = setTimeout(() => {
      cacheBannersLocally(adBanners);
    }, 300);
    return () => clearTimeout(timer);
  }, [adBanners]);

  useEffect(() => {
    safeSetStorageItem(STORAGE_KEYS.AD_POPUP_ENABLED, JSON.stringify(isAdPopupEnabled));
  }, [isAdPopupEnabled]);

  // Continuous Local Storage Persistence - completely disabled to prevent cache download/accumulation
  useEffect(() => {
    // Persistent caching of products, orders, customers, and applications is disabled
  }, [products, orders, customerUsers, customerApplications]);

  const handleAutoRestoreLocalDb = async () => {
    try {
      const savedBackupStr = localStorage.getItem('tulip_admin_master_backup');
      if (!savedBackupStr) return;
      const backup = JSON.parse(savedBackupStr);
      if (backup && Array.isArray(backup.products) && backup.products.length > 0) {
        console.log('[Auto-Restore] Ephemeral Vercel reset detected. Silently restoring master database state...');
        const res = await fetch('/api/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backup }),
        });
        const json = await res.json();
        if (json.success) {
          console.log('[Auto-Restore] Successfully self-healed and restored database.');
          setSyncToastMessage('🔄 Récupération : Vos données d\'administration ont été restaurées de votre navigateur.');
          setTimeout(() => setSyncToastMessage(null), 4000);
        }
      }
    } catch (e) {
      console.warn('[Auto-Restore] Failed:', e);
    }
  };

  // Transition to Admin view immediate force sync (bypassing any local caches)
  useEffect(() => {
    if (currentView === 'admin') {
      fetchSyncData(5000, true).then((data) => {
        if (!data) return;
        // ONLY update if server returned actual products! NEVER overwrite with empty array!
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        } else if (products.length > 0) {
          handleAutoRestoreLocalDb();
        }
        if (Array.isArray(data.orders)) {
          const sorted = [...data.orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          if (sorted.length > 0) setOrders(sorted);
        }
        if (Array.isArray(data.customerApplications) && data.customerApplications.length > 0) {
          setCustomerApplications(data.customerApplications);
        }
        if (Array.isArray(data.customerUsers) && data.customerUsers.length > 0) {
          setCustomerUsers(data.customerUsers);
        }
        if (Array.isArray(data.adBanners) && data.adBanners.length > 0) {
          setAdBanners(data.adBanners);
        }
        if (data.storeSettings && typeof data.storeSettings === 'object' && Object.keys(data.storeSettings).length > 0) {
          setStoreSettings(data.storeSettings);
        }
      }).catch((e) => {
        console.warn('[Admin Sync Transition] Failed to force-sync real-time data:', e);
      });
    }
  }, [currentView]);

  // Live Server Database Synchronization (Runs on load and every 15s)
  const lastSyncedServerTimeRef = useRef<string>('');
  const lastMutationTimeRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    async function syncWithServer() {
      try {
        setIsSyncingStocks(true);
        const isAdmin = window.location.hash.toLowerCase() === '#admin';
        const data = await fetchSyncData(isAdmin ? 5000 : 1800, isAdmin);
        if (!isMounted || !data) return;

        // Auto-restore trigger for local Vercel deployments during sync
        if (data.storageProvider === 'local' && isAdmin) {
          const savedBackupStr = localStorage.getItem('tulip_admin_master_backup');
          if (savedBackupStr) {
            try {
              const backup = JSON.parse(savedBackupStr);
              if (backup && Array.isArray(backup.products) && backup.products.length > data.products.length) {
                handleAutoRestoreLocalDb();
                return;
              }
            } catch {}
          }
        }

        if (data.analyticsConfig) {
          applyServerAnalyticsConfig(data.analyticsConfig);
        }

        // Skip state updates entirely if database has not changed on server
        if (data.lastUpdated && data.lastUpdated === lastSyncedServerTimeRef.current) {
          return;
        }

        // Avoid overwriting local state if we mutated data within the last 4 seconds (handles server roundtrip race conditions)
        if (Date.now() - lastMutationTimeRef.current < 4000) {
          console.log('[Sync] Skipping state update: Mutation lock is active.');
          return;
        }

        lastSyncedServerTimeRef.current = data.lastUpdated || '';

        if (Array.isArray(data.products)) {
          setProducts((prev) => {
            if (prev.length !== data.products.length) return data.products;
            const hasChanged = data.products.some((p, idx) => {
              const o = prev[idx];
              return !o || o.id !== p.id || o.stock !== p.stock || o.priceDA !== p.priceDA || o.name !== p.name || o.imageUrl !== p.imageUrl || o.isHidden !== p.isHidden;
            });
            return hasChanged ? data.products : prev;
          });
        }
        if (Array.isArray(data.orders)) {
          const sorted = [...data.orders].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const offlineQueue = loadOfflineOrdersQueue();
          if (offlineQueue.length > 0) {
            // Keep pending offline orders at top so customer/admin knows they are queued
            const mergedOrders = [
              ...offlineQueue,
              ...sorted.filter(
                (so) => !offlineQueue.some((oo) => oo.id === so.id || oo.orderNumber === so.orderNumber)
              ),
            ];
            setOrders(mergedOrders);
          } else {
            setOrders(sorted);
          }
        }
        if (Array.isArray(data.customerApplications)) {
          setCustomerApplications((prev) => {
            if (prev.length !== data.customerApplications.length) return data.customerApplications;
            const hasChanged = data.customerApplications.some((a, idx) => {
              const pa = prev[idx];
              return !pa || pa.id !== a.id || pa.status !== a.status;
            });
            return hasChanged ? data.customerApplications : prev;
          });
        }
        if (Array.isArray(data.customerUsers)) {
          setCustomerUsers((prev) => {
            if (prev.length !== data.customerUsers.length) return data.customerUsers;
            const hasChanged = data.customerUsers.some((u, idx) => {
              const pu = prev[idx];
              return !pu || pu.id !== u.id || pu.status !== u.status;
            });
            return hasChanged ? data.customerUsers : prev;
          });
          // If current customer is logged in, ensure status is safely synced without re-triggering loop
          const curr = currentCustomerRef.current;
          if (curr) {
            const updated = data.customerUsers.find(
              (u) => u.id === curr.id || u.username === curr.username || (u.phone && curr.phone && u.phone === curr.phone)
            );
            if (updated) {
              // Only trigger state update if an actual property changed
              if (
                updated.status !== curr.status ||
                updated.fullName !== curr.fullName ||
                updated.companyName !== curr.companyName ||
                updated.phone !== curr.phone ||
                updated.password !== curr.password ||
                updated.username !== curr.username
              ) {
                setCurrentCustomer(updated);
              }
            } else {
              // Account removed or purged -> log out cleanly
              setCurrentCustomer(null);
            }
          }
        }
        if (Array.isArray(data.adBanners)) {
          setAdBanners((prev) => {
            if (prev.length !== data.adBanners.length) return data.adBanners;
            const hasChanged = data.adBanners.some((b, idx) => {
              const pb = prev[idx];
              return !pb || pb.id !== b.id || pb.isActive !== b.isActive || pb.imageUrl !== b.imageUrl;
            });
            return hasChanged ? data.adBanners : prev;
          });
        }
        if (data.storeSettings && typeof data.storeSettings === 'object') {
          setStoreSettings((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(data.storeSettings)) {
              return data.storeSettings;
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('[Sync] Server sync notice:', err);
      } finally {
        if (isMounted) {
          setIsCatalogLoading(false);
          setIsSyncingStocks(false);
        }
      }
    }

    syncWithServer();

    // SUPABASE REALTIME SUBSCRIPTION (Instant, zero-lag cross-device sync)
    const unsubscribeRealtime = subscribeToSupabaseRealtime((cloudData: any) => {
      if (!isMounted || !cloudData) return;
      if (Date.now() - lastMutationTimeRef.current < 4000) {
        console.log('[Realtime] Skipping cloud update: Mutation lock is active.');
        return;
      }

      // If we are in the admin view, we want full control over database.
      // We disable background automatic overrides to prevent screen resets!
      const isAdmin = window.location.hash.toLowerCase() === '#admin';
      if (isAdmin) {
        console.log('[Realtime] Admin view active. Blocking automatic background products/orders overrides for full database control.');
        return;
      }

      console.log('[Realtime] Applying live changes from other device...');

      if (Array.isArray(cloudData.products) && cloudData.products.length > 0) {
        setProducts(cloudData.products);
        setIsCatalogLoading(false);
      }
      if (Array.isArray(cloudData.orders)) {
        const sorted = [...cloudData.orders].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const offlineQueue = loadOfflineOrdersQueue();
        if (offlineQueue.length > 0) {
          setOrders([
            ...offlineQueue,
            ...sorted.filter(
              (so) => !offlineQueue.some((oo) => oo.id === so.id || oo.orderNumber === so.orderNumber)
            ),
          ]);
        } else {
          setOrders(sorted);
        }
      }
      if (Array.isArray(cloudData.customerApplications)) {
        setCustomerApplications(cloudData.customerApplications);
      }
      if (Array.isArray(cloudData.customerUsers)) {
        setCustomerUsers(cloudData.customerUsers);
      }
      if (Array.isArray(cloudData.adBanners)) {
        setAdBanners(cloudData.adBanners);
      }
      if (cloudData.storeSettings && typeof cloudData.storeSettings === 'object') {
        setStoreSettings(cloudData.storeSettings);
      }
    });

    // REAL-TIME SERVER-SENT EVENTS (SSE) (Pre-orders, proformas, access orders & DB rewrites)
    const unsubscribeSSE = subscribeToServerEvents((event) => {
      if (!isMounted || !event) return;
      console.log('[SSE Event]:', event.type);

      switch (event.type) {
        case 'order:created': {
          const { order, updatedProducts, isProforma } = event.payload || {};
          if (order && order.id) {
            setOrders((prev) => {
              if (prev.some((o) => o.id === order.id || o.orderNumber === order.orderNumber)) {
                return prev;
              }
              // Play soft audible chime for real-time order arrival
              playOrderNotificationSound();
              setSyncToastMessage(
                isProforma
                  ? `📄 Demande de Proforma reçue en direct : ${order.orderNumber} (${order.customer?.fullName || 'Client'})`
                  : `⚡ Nouvelle Précommande reçue en direct : Bon N° ${order.orderNumber} (${order.customer?.fullName || 'Client'})`
              );
              setTimeout(() => setSyncToastMessage(null), 5500);
              return [order, ...prev];
            });
          }
          if (Array.isArray(updatedProducts) && updatedProducts.length > 0) {
            setProducts(updatedProducts);
          }
          break;
        }

        case 'order:updated': {
          const { order, updatedProducts } = event.payload || {};
          if (order && order.id) {
            setOrders((prev) =>
              prev.map((o) => (o.id === order.id ? { ...o, ...order } : o))
            );
          }
          if (Array.isArray(updatedProducts) && updatedProducts.length > 0) {
            setProducts(updatedProducts);
          }
          break;
        }

        case 'order:deleted': {
          const { orderId, updatedProducts } = event.payload || {};
          if (orderId) {
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
          }
          if (Array.isArray(updatedProducts) && updatedProducts.length > 0) {
            setProducts(updatedProducts);
          }
          break;
        }

        case 'orders:bulk_deleted': {
          const { orderIds, updatedProducts } = event.payload || {};
          if (Array.isArray(orderIds)) {
            const set = new Set(orderIds);
            setOrders((prev) => prev.filter((o) => !set.has(o.id)));
          }
          if (Array.isArray(updatedProducts) && updatedProducts.length > 0) {
            setProducts(updatedProducts);
          }
          break;
        }

        case 'orders:synced': {
          const { orders: syncedOrders, updatedProducts } = event.payload || {};
          if (Array.isArray(syncedOrders)) {
            setOrders(syncedOrders);
          }
          if (Array.isArray(updatedProducts) && updatedProducts.length > 0) {
            setProducts(updatedProducts);
          }
          break;
        }

        case 'customer:registered': {
          const { application, user } = event.payload || {};
          if (application && application.id) {
            setCustomerApplications((prev) => {
              if (prev.some((a) => a.id === application.id)) return prev;
              playAccessNotificationSound();
              setSyncToastMessage(
                `🔑 Nouvelle Demande d'Accès Pro reçue en direct de ${application.fullName} (${application.wilayaName || 'Algérie'}) !`
              );
              setTimeout(() => setSyncToastMessage(null), 6000);
              return [application, ...prev];
            });
          }
          if (user && user.id) {
            setCustomerUsers((prev) => {
              if (prev.some((u) => u.id === user.id)) return prev;
              return [user, ...prev];
            });
          }
          break;
        }

        case 'customer:approved': {
          const { customer, applicationId } = event.payload || {};
          if (applicationId) {
            setCustomerApplications((prev) =>
              prev.map((a) =>
                a.id === applicationId
                  ? {
                      ...a,
                      status: 'approved',
                      assignedUsername: customer?.username || a.assignedUsername,
                      assignedPassword: customer?.password || a.assignedPassword,
                    }
                  : a
              )
            );
          }
          if (customer && customer.id) {
            setCustomerUsers((prev) => {
              const idx = prev.findIndex((u) => u.id === customer.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = customer;
                return next;
              }
              return [customer, ...prev];
            });
          }
          break;
        }

        case 'customer:updated':
        case 'customer:created': {
          const { customer } = event.payload || {};
          if (customer && customer.id) {
            setCustomerUsers((prev) => {
              const idx = prev.findIndex((u) => u.id === customer.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...customer };
                return next;
              }
              return [customer, ...prev];
            });
            setCustomerApplications((prev) =>
              prev.map((a) => (a.id === customer.id ? { ...a, status: customer.status } : a))
            );
          }
          break;
        }

        case 'customer:deleted': {
          const { customerId } = event.payload || {};
          if (customerId) {
            setCustomerUsers((prev) => prev.filter((u) => u.id !== customerId));
            setCustomerApplications((prev) => prev.filter((a) => a.id !== customerId));
          }
          break;
        }

        case 'customer:application_deleted': {
          const { applicationId } = event.payload || {};
          if (applicationId) {
            setCustomerApplications((prev) => prev.filter((a) => a.id !== applicationId));
          }
          break;
        }

        case 'product:created': {
          const { product } = event.payload || {};
          if (product && product.id) {
            setProducts((prev) => {
              if (prev.some((p) => p.id === product.id)) return prev;
              return [product, ...prev];
            });
          }
          break;
        }

        case 'product:updated': {
          const { product } = event.payload || {};
          if (product && product.id) {
            setProducts((prev) =>
              prev.map((p) => (p.id === product.id ? product : p))
            );
          }
          break;
        }

        case 'product:deleted': {
          const { productId } = event.payload || {};
          if (productId) {
            setProducts((prev) => prev.filter((p) => p.id !== productId));
          }
          break;
        }

        case 'products:updated':
        case 'products:synced': {
          const { products: updatedCatalog } = event.payload || {};
          if (Array.isArray(updatedCatalog) && updatedCatalog.length > 0) {
            setProducts(updatedCatalog);
          }
          break;
        }

        case 'banners:updated': {
          const { banners: updatedBanners } = event.payload || {};
          if (Array.isArray(updatedBanners)) {
            setAdBanners(updatedBanners);
          }
          break;
        }

        case 'settings:updated': {
          const { settings: updatedSettings } = event.payload || {};
          if (updatedSettings && typeof updatedSettings === 'object') {
            setStoreSettings(updatedSettings);
          }
          break;
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeRealtime();
      unsubscribeSSE();
    };
  }, []);

  // Offline Orders Synchronizer: Transmits queued offline pre-orders once connection is restored
  const syncOfflineQueueToServer = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const queue = loadOfflineOrdersQueue();
    if (queue.length === 0) return;

    for (const pendingOrder of queue) {
      try {
        const res = await submitOrderToServer(pendingOrder);
        if (res.success) {
          dequeueOfflineOrder(pendingOrder.id);
          setOrders((prev) =>
            prev.map((o) =>
              o.id === pendingOrder.id || o.orderNumber === pendingOrder.orderNumber
                ? { ...(res.order || o), isOfflinePending: false, syncedAt: new Date().toISOString() }
                : o
            )
          );

          if (res.updatedProducts && Array.isArray(res.updatedProducts) && res.updatedProducts.length > 0) {
            setProducts(res.updatedProducts);
          }

          // Trigger telegram notification
          try {
            fetch('/api/telegram/send-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order: pendingOrder,
                telegramPhone: storeSettings.telegramPhone || '+213799938399',
              }),
            }).catch(() => {});
          } catch {}

          setSyncToastMessage(
            currentLang === 'ar'
              ? `🌐 تم استعادة الاتصال ! أُرسلت طلبيتك ${pendingOrder.orderNumber} المحفوظة بدون إنترنت بنجاح إلى تولييب.`
              : `🌐 Connexion rétablie ! Votre précommande ${pendingOrder.orderNumber} préparée hors-ligne a été transmise avec succès !`
          );
          setTimeout(() => setSyncToastMessage(null), 6000);
        }
      } catch (err) {
        console.warn('[Offline Queue Sync] Order retry attempt deferred:', err);
      }
    }
  }, [storeSettings.telegramPhone, currentLang]);

  // Online & Offline Event Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncToastMessage(
        currentLang === 'ar'
          ? '🌐 تم استعادة الاتصال بالإنترنت. جاري إرسال الطلبيات غير المتصلة...'
          : '🌐 Connexion Internet rétablie. Envoi automatique des commandes hors-ligne...'
      );
      setTimeout(() => setSyncToastMessage(null), 4000);
      syncOfflineQueueToServer();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncToastMessage(
        currentLang === 'ar'
          ? '📡 وضع عدم الاتصال نشط: يمكنك مواصلة تصفح المنتجات وإجراء الطلبيات بكل حرية.'
          : '📡 Mode Hors-Ligne actif : vous pouvez continuer à préparer et enregistrer vos précommandes !'
      );
      setTimeout(() => setSyncToastMessage(null), 4500);
    };

    const handleFocus = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setIsOnline(true);
        syncOfflineQueueToServer();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);

    // Initial check to drain any pending orders
    syncOfflineQueueToServer();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncOfflineQueueToServer, currentLang]);

  // Family Counts (excluding hidden products in public store)
  const familyCounts = useMemo(() => {
    const visible = products.filter((p) => !p.isHidden);
    return {
      all: visible.length,
      Extrait: visible.filter((p) => p.family === 'Extrait').length,
      Flacon: visible.filter((p) => p.family === 'Flacon').length,
      Accessoire: visible.filter((p) => p.family === 'Accessoire').length,
    };
  }, [products]);

  // Top Sellers Count (products with high stock or marked as top seller)
  const topSellersCount = useMemo(() => {
    return products.filter((p) => !p.isHidden && isProductTopSeller(p)).length;
  }, [products]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Exclude hidden products (e.g. hidden flacons) in customer store
        if (p.isHidden) return false;

        // Favorites filter
        if (showOnlyFavorites && !favorites.includes(p.id)) return false;

        // Top Sellers filter (high stock / best-sellers)
        if (showOnlyTopSellers && !isProductTopSeller(p)) return false;

        // Family filter
        if (selectedFamily !== 'all' && p.family !== selectedFamily) return false;

        // Stock filter
        if (stockFilter === 'in_stock' && p.stock <= 0) return false;
        if (stockFilter === 'low_stock' && (p.stock <= 0 || p.stock > (p.minAlertStock || 5))) return false;
        if (stockFilter === 'out_of_stock' && p.stock > 0) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCode = (p.code || '').toLowerCase().includes(q);
          const matchName = (p.name || '').toLowerCase().includes(q);
          const matchCategory = (p.category || '').toLowerCase().includes(q);
          const matchUnit = (p.unit || '').toLowerCase().includes(q);
          const matchOrigin = (p.origin || '').toLowerCase().includes(q);
          if (!matchCode && !matchName && !matchCategory && !matchUnit && !matchOrigin) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortOption) {
          case 'price_asc':
            return a.priceDA - b.priceDA;
          case 'price_desc':
            return b.priceDA - a.priceDA;
          case 'stock_desc':
            return b.stock - a.stock;
          case 'name_asc':
            return a.name.localeCompare(b.name, 'fr');
          default: {
            // Default sorting: place top-selling products first, then sort alphabetically
            const aTop = isProductTopSeller(a) ? 1 : 0;
            const bTop = isProductTopSeller(b) ? 1 : 0;
            if (bTop !== aTop) {
              return bTop - aTop;
            }
            return a.name.localeCompare(b.name, 'fr');
          }
        }
      });
  }, [products, selectedFamily, stockFilter, searchQuery, sortOption, showOnlyFavorites, favorites, showOnlyTopSellers]);

  // Reset pagination to page 1 whenever search, family, or stock filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFamily, searchQuery, stockFilter, sortOption, showOnlyFavorites, showOnlyTopSellers]);

  // Paginated Products (50 per page to optimize DOM rendering & browser scrolling)
  const productsPerPage = 50;
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * productsPerPage;
    return filteredProducts.slice(startIndex, startIndex + productsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  // Cart operations
  const cartCount = useMemo(() => cart.reduce((s, i) => s + (i?.quantity || 0), 0), [cart]);
  const cartTotalDA = useMemo(
    () =>
      cart.reduce((s, i) => {
        const p = i?.product;
        if (!p) return s;
        const unitPrice = calculateDiscountedPrice(p.priceDA, p.discountPercent);
        return s + unitPrice * (i?.quantity || 0);
      }, 0),
    [cart]
  );

  const handleAddToCart = (product: Product, quantityToAdd: number) => {
    if (!product || !product.id) return;
    setCart((prev) => {
      const existing = prev.find((item) => item?.product?.id === product.id);
      if (existing) {
        const newQty = Math.min(product.stock, existing.quantity + quantityToAdd);
        return prev.map((item) =>
          item?.product?.id === product.id ? { ...item, quantity: newQty } : item
        );
      } else {
        return [...prev, { product, quantity: Math.min(product.stock, quantityToAdd) }];
      }
    });
  };

  const handleDecreaseCartQuantity = (productId: string, quantityToDecrease: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item?.product?.id === productId);
      if (!existing) return prev;
      const newQty = existing.quantity - quantityToDecrease;
      if (newQty <= 0) {
        return prev.filter((item) => item?.product?.id !== productId);
      }
      return prev.map((item) =>
        item?.product?.id === productId ? { ...item, quantity: newQty } : item
      );
    });
  };

  const handleUpdateCartQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(productId);
      return;
    }
    const currentProd = products.find((p) => p.id === productId);
    const maxStock = currentProd ? currentProd.stock : 9999;
    const finalQty = Math.min(maxStock, newQty);

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: finalQty } : item
      )
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Checkout & Proforma flow
  const handleOpenCheckout = () => {
    setIsCartOpen(false);
    setIsProformaMode(false);
    setIsPreOrderModalOpen(true);
  };

  const handleOpenProforma = () => {
    setIsCartOpen(false);
    setIsProformaMode(true);
    setIsPreOrderModalOpen(true);
  };

  const handleSubmitOrder = (customer: CustomerDetails, isProformaOrder?: boolean) => {
    const timestamp = Date.now();
    const isProforma = isProformaOrder ?? isProformaMode;
    const prefix = isProforma ? 'PRO' : 'PRE';
    const orderNumber = `${prefix}-${new Date().getFullYear()}-${timestamp.toString().slice(-5)}`;

    const orderItems = cart.map((item) => ({
      productId: item.product.id,
      code: item.product.code,
      name: item.product.name,
      family: item.product.family,
      unit: item.product.unit,
      priceDA: item.product.priceDA,
      quantity: item.quantity,
      totalDA: item.product.priceDA * item.quantity,
    }));

    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    const newOrder: PreOrder = {
      id: `order-${timestamp}`,
      orderNumber,
      date: new Date().toISOString(),
      customerId: currentCustomer?.id,
      customerUsername: currentCustomer?.username,
      customer,
      items: orderItems,
      totalDA: cartTotalDA,
      status: 'en_attente',
      isProforma,
      isOfflinePending: !isCurrentlyOnline,
    };

    // Deduct stock immediately from current inventory
    setProducts((prev) =>
      prev.map((p) => {
        const ordered = cart.find((item) => item.product.id === p.id);
        if (ordered) {
          return { ...p, stock: Math.max(0, p.stock - ordered.quantity) };
        }
        return p;
      })
    );

    // Save order locally first for instantaneous UX
    setOrders((prev) => [newOrder, ...prev]);
    setRecentOrder(newOrder);

    // Clear cart
    setCart([]);
    setIsPreOrderModalOpen(false);
    setIsConfirmationOpen(true);

    // Delete save for later only after validation after restore to cart
    if (activeRestoredId) {
      const updated = savedPreorders.filter((o) => o.id !== activeRestoredId);
      setSavedPreorders(updated);
      try {
        const key = getSavedPreordersKey(currentCustomer);
        localStorage.setItem(key, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      setActiveRestoredId(null);
    }

    // Enforce 15-minute delay on ad popup after filling / submitting request
    try {
      localStorage.setItem(STORAGE_KEYS.AD_POPUP_LAST_SHOWN, String(Date.now()));
    } catch (e) {
      console.error(e);
    }

    // Automatically trigger PDF download (hiding prices for non-approved/guest users)
    downloadOrderPDF(newOrder, storeSettings, { hidePrices: !isPricesVisible });

    // If offline: save to local queue and provide reassuring advice
    if (!isCurrentlyOnline) {
      enqueueOfflineOrder(newOrder);
      setSyncToastMessage(
        currentLang === 'ar'
          ? `📡 تم حفظ طلبيتكم ${newOrder.orderNumber} في وضع عدم الاتصال ! سيتم إرسالها تلقائياً فور استعادة الإنترنت.`
          : `📡 Mode Hors-Ligne : Précommande ${newOrder.orderNumber} enregistrée ! Envoi automatique dès le retour de votre connexion.`
      );
      setTimeout(() => setSyncToastMessage(null), 6000);
      return;
    }

    // If online: transmit order to Live Central Server (persists in store_db.json and notifies Telegram)
    submitOrderToServer(newOrder)
      .then((res) => {
        if (res.success && res.order) {
          setOrders((prev) => [
            { ...res.order!, isOfflinePending: false },
            ...prev.filter((o) => o.id !== res.order!.id && o.id !== newOrder.id),
          ]);
          setRecentOrder({ ...res.order, isOfflinePending: false });
          if (res.updatedProducts && Array.isArray(res.updatedProducts) && res.updatedProducts.length > 0) {
            setProducts(res.updatedProducts);
          }
        } else {
          // If server failed, buffer in offline queue so order is never lost
          enqueueOfflineOrder(newOrder);
          setOrders((prev) =>
            prev.map((o) => (o.id === newOrder.id ? { ...o, isOfflinePending: true } : o))
          );
        }
      })
      .catch((err) => {
        console.warn('Central server order notification notice (saved to offline buffer):', err);
        enqueueOfflineOrder(newOrder);
        setOrders((prev) =>
          prev.map((o) => (o.id === newOrder.id ? { ...o, isOfflinePending: true } : o))
        );
      });

    if (isProforma) {
      setSyncToastMessage(
        currentLang === 'ar'
          ? `تم إرسال طلب الفاتورة الشكلية ${newOrder.orderNumber} بنجاح ! Document PDF prêt.`
          : `Demande de Facture Proforma ${newOrder.orderNumber} enregistrée ! Document proforma PDF prêt.`
      );
    } else {
      setSyncToastMessage(
        currentLang === 'ar'
          ? `تم تسجيل الطلبية ${newOrder.orderNumber} بنجاح ! Bon PDF et notification prêts.`
          : `Précommande ${newOrder.orderNumber} enregistrée sur le serveur Tulip ! Bon PDF et notification prêts.`
      );
    }
    setTimeout(() => setSyncToastMessage(null), 5000);
  };

  // Stock synchronization from Excel
  const handleApplyExcelInventory = (newProducts: Product[]) => {
    setProducts(newProducts);
    const now = new Date().toISOString();
    setLastStockSyncDate(now);
    safeSetStorageItem(STORAGE_KEYS.LAST_SYNC, now);

    // Persist to server
    syncProductsOnServer(newProducts).catch((err) => console.warn('Sync products error:', err));

    // Sync cart with new stock limits
    setCart((prevCart) => {
      const validItems: CartItem[] = [];
      prevCart.forEach((item) => {
        const matching = newProducts.find((p) => p.id === item.product.id || p.code === item.product.code);
        if (matching && matching.stock > 0) {
          validItems.push({
            product: matching,
            quantity: Math.min(matching.stock, item.quantity),
          });
        }
      });
      return validItems;
    });

    setSyncToastMessage(`Catalogue actualisé avec succès (${newProducts.length} articles synchronisés sur le serveur) !`);
    setTimeout(() => setSyncToastMessage(null), 4000);
  };

  const handleUpdateSingleStock = (productId: string, newStock: number, newPriceDA?: number) => {
    lastMutationTimeRef.current = Date.now();
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          return {
            ...p,
            stock: newStock,
            priceDA: newPriceDA !== undefined ? newPriceDA : p.priceDA,
            lastUpdated: new Date().toISOString(),
          };
        }
        return p;
      })
    );
    updateSingleProductOnServer(productId, newStock, newPriceDA).catch((err) =>
      console.warn('Update stock on server error:', err)
    );
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: PreOrder['status']) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const oldStatus = targetOrder.status;

    // Restore stock to catalog when order is cancelled ('annulee')
    if (oldStatus !== 'annulee' && newStatus === 'annulee') {
      let restoredCount = 0;
      setProducts((prev) =>
        prev.map((p) => {
          const item = targetOrder.items.find((i) => i.productId === p.id || i.code === p.code);
          if (item && item.quantity > 0) {
            restoredCount += item.quantity;
            return {
              ...p,
              stock: p.stock + item.quantity,
              lastUpdated: new Date().toISOString(),
            };
          }
          return p;
        })
      );
      setSyncToastMessage(
        currentLang === 'ar'
          ? `تم إلغاء الطلبية ${targetOrder.orderNumber} واسترجاع ${restoredCount} قطعة إلى المخزون بنجاح !`
          : `Commande ${targetOrder.orderNumber} annulée : ${restoredCount} article(s) réintégré(s) au stock !`
      );
      setTimeout(() => setSyncToastMessage(null), 4500);
    } else if (oldStatus === 'annulee' && newStatus !== 'annulee') {
      // Re-activating order: re-deduct stock
      setProducts((prev) =>
        prev.map((p) => {
          const item = targetOrder.items.find((i) => i.productId === p.id || i.code === p.code);
          if (item && item.quantity > 0) {
            return {
              ...p,
              stock: Math.max(0, p.stock - item.quantity),
              lastUpdated: new Date().toISOString(),
            };
          }
          return p;
        })
      );
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    updateOrderStatusOnServer(orderId, newStatus)
      .then((res) => {
        if (res && res.updatedProducts && Array.isArray(res.updatedProducts) && res.updatedProducts.length > 0) {
          setProducts(res.updatedProducts);
        }
      })
      .catch((err) => console.warn('Update order status on server error:', err));
  };

  const handleResetFilters = () => {
    setSelectedFamily('all');
    setSearchQuery('');
    setStockFilter('all');
    setSortOption('default');
    setShowOnlyFavorites(false);
    setShowOnlyTopSellers(false);
  };

  // 7. Customer Authentication & Application Handlers
  const handleLoginSuccess = (customer: CustomerUser) => {
    setCurrentCustomer(customer);
    setWelcomeCustomer({ fullName: customer.fullName, companyName: customer.companyName });
    setSyncToastMessage(
      currentLang === 'ar'
        ? `أهلاً وسهلاً بعودتك، ${customer.fullName} ! تم تفعيل أسعارك المهنية.`
        : currentLang === 'en'
        ? `Welcome back, ${customer.fullName}! Professional wholesale pricing unlocked.`
        : `Bon retour parmi nous, ${customer.fullName} ! Tarifs professionnels débloqués.`
    );
    setTimeout(() => setSyncToastMessage(null), 5000);
  };

  const handleLogoutCustomer = () => {
    setCurrentCustomer(null);
    setWelcomeCustomer(null);
    setSyncToastMessage("Vous êtes déconnecté. Les tarifs sont désormais masqués.");
    setTimeout(() => setSyncToastMessage(null), 4000);
  };

  const handleRegisterSubmit = (
    newAppRaw: Omit<CustomerApplication, 'id' | 'submittedAt' | 'status'>
  ) => {
    const newApp: CustomerApplication = {
      ...newAppRaw,
      id: `app-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      status: 'pending',
    };
    setCustomerApplications((prev) => [newApp, ...prev]);
    // Enforce 15-minute delay on ad popup after filling registration request
    try {
      localStorage.setItem(STORAGE_KEYS.AD_POPUP_LAST_SHOWN, String(Date.now()));
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveApplication = (
    applicationId: string,
    assignedUsername: string,
    assignedPassword: string,
    verificationNotes?: string
  ) => {
    const targetApp = customerApplications.find((a) => a.id === applicationId);
    if (!targetApp) return;

    const now = new Date().toISOString();

    // Update application
    setCustomerApplications((prev) =>
      prev.map((app) =>
        app.id === applicationId
          ? {
              ...app,
              status: 'approved',
              assignedUsername,
              assignedPassword,
              approvedAt: now,
              approvedBy: 'admin',
              verificationNotes: verificationNotes || app.verificationNotes,
            }
          : app
      )
    );

    // Add or update customer user
    setCustomerUsers((prev) => {
      const existingIdx = prev.findIndex(
        (u) => u.id === applicationId || Boolean(u.username && assignedUsername && u.username.toLowerCase() === assignedUsername.toLowerCase())
      );
      const updatedUser: CustomerUser = {
        id: targetApp.id,
        username: assignedUsername,
        password: assignedPassword,
        fullName: targetApp.fullName,
        companyName: targetApp.companyName,
        email: targetApp.email,
        phone: targetApp.phone,
        secondaryPhone: targetApp.secondaryPhone,
        wilayaCode: targetApp.wilayaCode,
        wilayaName: targetApp.wilayaName,
        commune: targetApp.commune,
        deliveryAddress: targetApp.deliveryAddress,
        status: 'approved',
        createdAt: now,
      };

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = updatedUser;
        return copy;
      }
      return [updatedUser, ...prev];
    });

    setSyncToastMessage(
      `Accès validé pour ${targetApp.fullName} ! Identifiant : "${assignedUsername}"`
    );
    setTimeout(() => setSyncToastMessage(null), 5000);

    approveCustomerOnServer(applicationId, assignedUsername, assignedPassword, verificationNotes).catch((err) =>
      console.warn('Approve customer on server error:', err)
    );
  };

  const handleRejectApplication = (applicationId: string) => {
    setCustomerApplications((prev) =>
      prev.map((app) => (app.id === applicationId ? { ...app, status: 'rejected' } : app))
    );
    updateCustomerStatusOnServer(applicationId, 'rejected').catch((err) =>
      console.warn('Reject customer on server error:', err)
    );
  };

  const handleToggleCustomerActive = (customerId: string) => {
    let nextStatus: CustomerAccountStatus = 'suspended';
    setCustomerUsers((prev) =>
      prev.map((u) => {
        if (u.id === customerId) {
          nextStatus = u.status === 'approved' ? 'suspended' : 'approved';
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
    setCustomerApplications((prev) =>
      prev.map((app) => {
        if (app.id === customerId) {
          return { ...app, status: nextStatus };
        }
        return app;
      })
    );
    updateCustomerStatusOnServer(customerId, nextStatus).catch((err) =>
      console.warn('Toggle customer on server error:', err)
    );
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomerUsers((prev) => prev.filter((u) => u.id !== customerId));
    setCustomerApplications((prev) => prev.filter((a) => a.id !== customerId));
    deleteCustomerOnServer(customerId).catch((err) =>
      console.warn('Delete customer on server error:', err)
    );
  };

  const handleUpdateCustomer = (customerId: string, updatedFields: Partial<CustomerUser>) => {
    setCustomerUsers((prev) =>
      prev.map((u) => (u.id === customerId ? { ...u, ...updatedFields } : u))
    );
    setCustomerApplications((prev) =>
      prev.map((app) =>
        app.id === customerId
          ? {
              ...app,
              fullName: updatedFields.fullName ?? app.fullName,
              companyName: updatedFields.companyName ?? app.companyName,
              phone: updatedFields.phone ?? app.phone,
              secondaryPhone: updatedFields.secondaryPhone ?? app.secondaryPhone,
              email: updatedFields.email ?? app.email,
              wilayaCode: updatedFields.wilayaCode ?? app.wilayaCode,
              wilayaName: updatedFields.wilayaName ?? app.wilayaName,
              commune: updatedFields.commune ?? app.commune,
              deliveryAddress: updatedFields.deliveryAddress ?? app.deliveryAddress,
              assignedUsername: updatedFields.username ?? app.assignedUsername,
              assignedPassword: updatedFields.password ?? app.assignedPassword,
            }
          : app
      )
    );
    updateCustomerOnServer(customerId, updatedFields).catch((err) =>
      console.warn('Update customer on server error:', err)
    );
    setSyncToastMessage('Coordonnées du client mises à jour.');
    setTimeout(() => setSyncToastMessage(null), 3000);
  };

  const handleResetCustomerPassword = (customerId: string, newPassword: string) => {
    setCustomerUsers((prev) =>
      prev.map((u) => (u.id === customerId ? { ...u, password: newPassword } : u))
    );
    setCustomerApplications((prev) =>
      prev.map((app) => (app.id === customerId ? { ...app, assignedPassword: newPassword } : app))
    );
    resetCustomerPasswordOnServer(customerId, newPassword).catch((err) =>
      console.warn('Reset password on server error:', err)
    );
    setSyncToastMessage('Mot de passe client réinitialisé avec succès.');
    setTimeout(() => setSyncToastMessage(null), 3000);
  };

  const handleCreateCustomer = (newCustomerData: Omit<CustomerUser, 'id' | 'createdAt'>) => {
    const id = `cust-${Date.now()}`;
    const now = new Date().toISOString();
    const newCust: CustomerUser = {
      ...newCustomerData,
      id,
      createdAt: now,
    };
    setCustomerUsers((prev) => [newCust, ...prev]);

    const newApp: CustomerApplication = {
      id,
      fullName: newCust.fullName,
      companyName: newCust.companyName,
      email: newCust.email,
      phone: newCust.phone,
      secondaryPhone: newCust.secondaryPhone,
      wilayaCode: newCust.wilayaCode,
      wilayaName: newCust.wilayaName,
      commune: newCust.commune,
      deliveryAddress: newCust.deliveryAddress,
      status: 'approved',
      submittedAt: now,
      approvedAt: now,
      approvedBy: 'admin',
      assignedUsername: newCust.username,
      assignedPassword: newCust.password,
      verificationNotes: 'Création directe en administration.',
    };
    setCustomerApplications((prev) => [newApp, ...prev]);

    createDirectCustomerOnServer(newCustomerData).catch((err) =>
      console.warn('Create customer on server error:', err)
    );
  };

  const handleImportCustomers = (newCustomers: CustomerUser[], replaceExisting: boolean = false) => {
    if (replaceExisting) {
      setCustomerUsers(newCustomers);
      const newApps: CustomerApplication[] = newCustomers.map((c) => ({
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
        status: c.status,
        submittedAt: c.createdAt || new Date().toISOString(),
        approvedAt: c.createdAt || new Date().toISOString(),
        approvedBy: 'import_excel',
        assignedUsername: c.username,
        assignedPassword: c.password,
        verificationNotes: 'Importé depuis fichier Excel / JSON',
      }));
      setCustomerApplications(newApps);
    } else {
      setCustomerUsers((prev) => {
        const merged = [...prev];
        newCustomers.forEach((nc) => {
          const idx = merged.findIndex(
            (existing) =>
              existing.id === nc.id ||
              Boolean(existing.username && nc.username && existing.username.toLowerCase() === nc.username.toLowerCase()) ||
              Boolean(nc.email && existing.email && existing.email.toLowerCase() === nc.email.toLowerCase())
          );
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...nc };
          } else {
            merged.push(nc);
          }
        });
        return merged;
      });
    }

    // Persist immediately to server database so background sync does not revert changes
    importCustomersOnServer(newCustomers, replaceExisting)
      .then((res) => {
        if (res.success && res.customerUsers) {
          setCustomerUsers(res.customerUsers);
          if (res.customerApplications) {
            setCustomerApplications(res.customerApplications);
          }
        }
      })
      .catch((err) => console.warn('[App] Import customers on server error:', err));

    setSyncToastMessage(`${newCustomers.length} clients importés avec succès !`);
    setTimeout(() => setSyncToastMessage(null), 4000);
  };

  const handleClearOldOrders = () => {
    const cutoff = Date.now() - 96 * 60 * 60 * 1000;
    const initialCount = orders.length;
    const kept = orders.filter((o) => {
      const orderTime = new Date(o.date).getTime();
      return orderTime >= cutoff;
    });
    const purged = initialCount - kept.length;
    setOrders(kept);
    syncOrdersOnServer(kept).catch((err) => console.warn('[App] Sync orders error:', err));
    setSyncToastMessage(
      `Purger (+96h) : ${purged} précommande(s) archivée(s)/supprimée(s). ${kept.length} précommande(s) conservée(s).`
    );
    setTimeout(() => setSyncToastMessage(null), 5000);
  };

  const handleDeleteOrder = (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));

    deleteOrderOnServer(orderId).then((res) => {
      if (res.updatedProducts && Array.isArray(res.updatedProducts) && res.updatedProducts.length > 0) {
        setProducts(res.updatedProducts);
      }
    }).catch(console.warn);

    setSyncToastMessage(
      targetOrder
        ? `Commande ${targetOrder.orderNumber} définitivement supprimée de la base de données (Can't undo).`
        : 'Commande définitivement supprimée de la base de données (Can\'t undo).'
    );
    setTimeout(() => setSyncToastMessage(null), 4000);
  };

  const handleBulkDeleteOrders = (orderIds: string[]) => {
    if (!orderIds || orderIds.length === 0) return;
    const set = new Set(orderIds);
    setOrders((prev) => prev.filter((o) => !set.has(o.id)));

    bulkDeleteOrdersOnServer(orderIds).then((res) => {
      if (res && res.updatedProducts && Array.isArray(res.updatedProducts) && res.updatedProducts.length > 0) {
        setProducts(res.updatedProducts);
      }
    }).catch(console.warn);

    setSyncToastMessage(`${orderIds.length} commande(s) définitivement supprimée(s) de la base de données.`);
    setTimeout(() => setSyncToastMessage(null), 4000);
  };

  const handleAddProduct = (newProduct: Product) => {
    lastMutationTimeRef.current = Date.now();
    setProducts((prev) => [newProduct, ...prev.filter((p) => p.id !== newProduct.id)]);
    createSingleProductOnServer(newProduct).catch(console.warn);
    setSyncToastMessage(`Article "${newProduct.name}" ajouté avec succès.`);
    setTimeout(() => setSyncToastMessage(null), 3000);
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    lastMutationTimeRef.current = Date.now();
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    saveSingleProductOnServer(updatedProduct).catch(console.warn);
  };

  const handleDeleteProduct = (productId: string) => {
    lastMutationTimeRef.current = Date.now();
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    deleteSingleProductOnServer(productId).catch(console.warn);
    setSyncToastMessage('Article définitivement supprimé de la base de données (Can\'t undo).');
    setTimeout(() => setSyncToastMessage(null), 3000);
  };

  const handleDeleteApplication = (applicationId: string) => {
    lastMutationTimeRef.current = Date.now();
    setCustomerApplications((prev) => prev.filter((a) => a.id !== applicationId));
    deleteCustomerApplicationOnServer(applicationId).catch(console.warn);
    setSyncToastMessage('Demande d\'accès définitivement supprimée de la base de données (Can\'t undo).');
    setTimeout(() => setSyncToastMessage(null), 3000);
  };

  // 8. Advertising Banner Handlers
  const handleAddAdBanner = (newBannerData: Omit<AdBanner, 'id' | 'createdAt'>) => {
    lastMutationTimeRef.current = Date.now();
    const newBanner: AdBanner = {
      ...newBannerData,
      id: `ad-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newBanner, ...adBanners];
    setAdBanners(updated);
    updateBannersOnServer(updated).catch(console.warn);
  };

  const handleToggleAdBanner = (bannerId: string) => {
    lastMutationTimeRef.current = Date.now();
    const updated = adBanners.map((b) => (b.id === bannerId ? { ...b, isActive: !b.isActive } : b));
    setAdBanners(updated);
    updateBannersOnServer(updated).catch(console.warn);
  };

  const handleDeleteAdBanner = (bannerId: string) => {
    lastMutationTimeRef.current = Date.now();
    const updated = adBanners.filter((b) => b.id !== bannerId);
    setAdBanners(updated);
    updateBannersOnServer(updated).catch(console.warn);
  };

  const handlePreviewAdBanner = (banner: AdBanner) => {
    setCurrentAdPopup(banner);
    setIsAdPopupOpen(true);
  };

  const handleToggleAdPopupEnabled = (enabled: boolean) => {
    setIsAdPopupEnabled(enabled);
  };

  const handleCloseAdPopup = (dontShowAgainToday?: boolean) => {
    setIsAdPopupOpen(false);
    try {
      localStorage.setItem(STORAGE_KEYS.AD_POPUP_LAST_SHOWN, String(Date.now()));
      if (dontShowAgainToday) {
        const todayStr = new Date().toISOString().slice(0, 10);
        localStorage.setItem(STORAGE_KEYS.AD_POPUP_DISMISSED_DATE, todayStr);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdExplore = (ad: AdBanner) => {
    if (ad.linkUrl) {
      if (ad.linkUrl.startsWith('http')) {
        window.open(ad.linkUrl, '_blank');
      }
    } else {
      if (!isPricesVisible) {
        setCustomerAuthInitialTab('login');
        setIsCustomerAuthOpen(true);
      }
    }
  };

  const handleRestoreAllData = (backup: {
    products?: Product[];
    orders?: PreOrder[];
    customerUsers?: CustomerUser[];
    customerApplications?: CustomerApplication[];
    storeSettings?: StoreSettings;
    adBanners?: AdBanner[];
  }) => {
    if (backup.products && Array.isArray(backup.products) && backup.products.length > 0) {
      setProducts(backup.products);
      cacheProductsLocally(backup.products);
    }
    if (backup.orders && Array.isArray(backup.orders)) {
      setOrders(backup.orders);
      safeSetStorageItem(STORAGE_KEYS.ORDERS, JSON.stringify(backup.orders));
    }
    if (backup.customerUsers && Array.isArray(backup.customerUsers)) {
      setCustomerUsers(backup.customerUsers);
      safeSetStorageItem(STORAGE_KEYS.CUSTOMER_USERS, JSON.stringify(backup.customerUsers));
    }
    if (backup.customerApplications && Array.isArray(backup.customerApplications)) {
      setCustomerApplications(backup.customerApplications);
      safeSetStorageItem(STORAGE_KEYS.CUSTOMER_APPLICATIONS, JSON.stringify(backup.customerApplications));
    }
    if (backup.adBanners && Array.isArray(backup.adBanners)) {
      setAdBanners(backup.adBanners);
      cacheBannersLocally(backup.adBanners);
    }

    // Persist completely to server database so 15s sync does not revert
    restoreAllDataOnServer(backup)
      .then((res) => {
        if (res.success && res.data) {
          if (Array.isArray(res.data.products) && res.data.products.length > 0) {
            setProducts(res.data.products);
          }
          if (Array.isArray(res.data.orders)) {
            setOrders(res.data.orders);
          }
          if (Array.isArray(res.data.customerUsers)) {
            setCustomerUsers(res.data.customerUsers);
          }
          if (Array.isArray(res.data.customerApplications)) {
            setCustomerApplications(res.data.customerApplications);
          }
          if (Array.isArray(res.data.adBanners)) {
            setAdBanners(res.data.adBanners);
          }
        }
      })
      .catch((err) => console.warn('[App] Restore all data on server error:', err));
  };

  // IF ADMIN VIEW: RENDER FULL ADMIN PORTAL PAGE
  if (currentView === 'admin') {
    return (
      <AdminPortal
        products={products}
        orders={orders}
        storeSettings={storeSettings}
        customerApplications={customerApplications}
        customerUsers={customerUsers}
        adBanners={adBanners}
        isAdPopupEnabled={isAdPopupEnabled}
        onBackToStore={() => {
          setCurrentView('store');
          window.location.hash = '';
        }}
        onUpdateProducts={(updated) => {
          lastMutationTimeRef.current = Date.now();
          setProducts(updated);
          syncProductsOnServer(updated).catch(console.warn);
        }}
        onAddProduct={handleAddProduct}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
        onDeleteOrder={handleDeleteOrder}
        onBulkDeleteOrders={handleBulkDeleteOrders}
        onDeleteApplication={handleDeleteApplication}
        onUpdateSingleStock={handleUpdateSingleStock}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onApproveApplication={handleApproveApplication}
        onRejectApplication={handleRejectApplication}
        onToggleCustomerActive={handleToggleCustomerActive}
        onDeleteCustomer={handleDeleteCustomer}
        onUpdateCustomer={handleUpdateCustomer}
        onResetCustomerPassword={handleResetCustomerPassword}
        onCreateCustomer={handleCreateCustomer}
        onImportCustomers={handleImportCustomers}
        onClearOldOrders={handleClearOldOrders}
        onUpdateOrders={(newOrders) => {
          setOrders(newOrders);
          syncOrdersOnServer(newOrders).catch(console.warn);
        }}
        onAddAdBanner={handleAddAdBanner}
        onToggleAdBanner={handleToggleAdBanner}
        onDeleteAdBanner={handleDeleteAdBanner}
        onPreviewAdBanner={handlePreviewAdBanner}
        onToggleAdPopupEnabled={handleToggleAdPopupEnabled}
        onRestoreAllData={handleRestoreAllData}
        onUpdateSettings={(newSettings) => setStoreSettings(newSettings)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col selection:bg-amber-500 selection:text-slate-950 font-sans">
      {/* Top Navigation */}
      <Header
        storeSettings={storeSettings}
        activeFamily={selectedFamily}
        onSelectFamily={setSelectedFamily}
        cartCount={cartCount}
        cartTotalDA={cartTotalDA}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenExcelSync={() => setIsExcelSyncOpen(true)}
        onOpenOrders={() => setIsAdminOrdersOpen(true)}
        ordersCount={orders.length}
        lastStockSyncDate={lastStockSyncDate}
        isAdminMode={isAdminMode}
        onToggleAdminMode={() => setIsAdminMode(!isAdminMode)}
        onNavigateToAdmin={() => {
          setCurrentView('admin');
          window.location.hash = 'admin';
        }}
        currentCustomer={currentCustomer}
        isPricesVisible={isPricesVisible}
        onOpenCustomerAuth={(tab) => {
          setCustomerAuthInitialTab(tab || 'login');
          setIsCustomerAuthOpen(true);
        }}
        onLogoutCustomer={handleLogoutCustomer}
        lang={currentLang}
        onSelectLanguage={handleSelectLanguage}
        onOpenOrderTracking={() => setIsOrderTrackingOpen(true)}
        currentInterface={currentInterface}
        onToggleInterface={handleSelectInterface}
        onOpenInterfaceChoiceModal={() => setIsInterfaceChoiceOpen(true)}
        isOnline={isOnline}
        cachedImagesCount={cachedImagesCount}
      />

      {/* Customer Welcome Back Message Banner */}
      {welcomeCustomer && (
        <div
          className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-white border-b border-amber-500/40 px-4 py-3 sm:py-3.5 shadow-lg relative z-30 animate-in fade-in slide-in-from-top-2 duration-200"
          dir="ltr"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                <Sparkles className="w-5 h-5 text-slate-950" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    {currentLang === 'ar'
                      ? `أهلاً وسهلاً بعودتك، ${welcomeCustomer.fullName} !`
                      : currentLang === 'en'
                      ? `Welcome back, ${welcomeCustomer.fullName}!`
                      : `Bon retour parmi nous, ${welcomeCustomer.fullName} !`}
                  </h4>
                  {welcomeCustomer.companyName && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] sm:text-[11px] font-bold truncate max-w-[200px]">
                      {welcomeCustomer.companyName}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] sm:text-[11px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>{currentLang === 'ar' ? 'حساب تاجر مفعل' : 'Accès Grossiste Actif'}</span>
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-amber-100/80 mt-0.5 truncate">
                  {currentLang === 'ar'
                    ? 'تم تفعيل جميع أسعار الجملة ونصف الجملة وتوفر المخزون الحقيقي.'
                    : currentLang === 'en'
                    ? 'All wholesale prices and real-time inventory are now unlocked.'
                    : 'Vos tarifs professionnels de gros & demi-gros ainsi que les stocks physiques en direct sont débloqués.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWelcomeCustomer(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
              title="Fermer ce message"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {syncToastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>{syncToastMessage}</span>
        </div>
      )}

      {/* Main Content Area: Showroom vs Quick Order View */}
      {currentInterface === 'quick' ? (
        <QuickOrderView
          products={products}
          cart={cart}
          onAddToCart={handleAddToCart}
          onUpdateCartQuantity={handleUpdateCartQuantity}
          onOpenCart={() => setIsCartOpen(true)}
          onQuickView={setQuickViewProduct}
          onSwitchToShowroom={() => handleSelectInterface('showroom')}
          isPricesVisible={isPricesVisible}
          onRequireLogin={() => {
            setCustomerAuthInitialTab('login');
            setIsCustomerAuthOpen(true);
          }}
          lang={currentLang}
          selectedFamily={selectedFamily}
          onSelectFamily={setSelectedFamily}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          isLoading={isCatalogLoading}
        />
      ) : (
        <>
          {/* Hero / Information Showcase Banner */}
          <section className="bg-gradient-to-br from-[#3b021d] via-[#4d0427] to-[#1f0210] text-white border-b border-[#70083b]/60 relative overflow-hidden">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ec4899_1.2px,transparent_1.2px)] [background-size:16px_16px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 py-3.5 sm:py-6 lg:py-8 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#be185d]/20 text-rose-200 border border-[#f472b6]/30 text-[11px] sm:text-xs font-bold mb-1.5 sm:mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-300" />
                <span>Vente en Gros & Demi-Gros aux Parfumeurs & Artisans en Algérie</span>
              </div>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white leading-snug">
                Matières Premières de Parfumerie : Extraits & Flacons
              </h2>

              <p className="text-xs sm:text-sm text-rose-100/90 mt-1 sm:mt-2 leading-relaxed max-w-xl">
                <span className="block sm:hidden">
                  Disponibilités réelles synchronisées avec le stock. Réservation en ligne avec Bon de Précommande PDF.
                </span>
                <span className="hidden sm:inline">
                  Consultez nos disponibilités en temps réel directement synchronisées avec notre stock physique.
                  Réservez vos matières premières en ligne avec génération immédiate de votre <strong>Bon de Précommande officiel en PDF</strong>.
                </span>
              </p>

              {/* Family Shortcuts & Delivery Badges (Buttons hidden in mobile version) */}
              <div className="mt-3 sm:mt-5 flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedFamily('Extrait')}
                  className="hidden sm:inline-flex px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#9f0e4e] to-[#c2185b] hover:opacity-95 text-white border border-rose-300/40 font-semibold items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-rose-200" />
                  Famille Extraits ({familyCounts.Extrait} refs)
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFamily('Flacon')}
                  className="hidden sm:inline-flex px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-rose-100 border border-white/20 font-semibold items-center gap-1.5 transition cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-rose-300" />
                  Famille Flacons ({familyCounts.Flacon} refs)
                </button>

                <button
                  type="button"
                  id="hero-shortcut-accessories"
                  onClick={() => setSelectedFamily('Accessoire')}
                  className="hidden sm:inline-flex px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-rose-100 border border-white/20 font-semibold items-center gap-1.5 transition cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5 text-rose-300" />
                  Famille Accessoires ({familyCounts.Accessoire} refs)
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectInterface('quick')}
                  className="hidden sm:inline-flex px-3.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border border-rose-500/40 font-semibold items-center gap-1.5 transition cursor-pointer"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-rose-400" />
                  {currentLang === 'ar' ? 'الطلب السريع (جدول)' : 'Basculer en Commande Rapide'}
                </button>

                <div className="flex items-center gap-1.5 text-rose-200/80 text-[11px] sm:text-xs">
                  <Truck className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Livraison 58 Wilayas (Yalidine / Domicile / Magasin)</span>
                </div>
              </div>
            </div>

            {/* Right Side Showcase: Stock & Pre-Order Guarantee (Hidden on mobile for smaller footprint and less detail) */}
            {isAdminMode ? (
              <div className="hidden sm:block bg-[#240313]/85 backdrop-blur-md border border-emerald-500/50 rounded-2xl p-4 sm:p-5 max-w-sm w-full shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4" />
                    Module Caisse POS (Admin)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                    Excel Sync
                  </span>
                </div>

                <p className="text-xs text-rose-100/90 leading-relaxed mb-3">
                  Votre logiciel de caisse n'a pas d'API ? Exportez simplement votre fichier Excel pour mettre à jour les stocks du site en 1 clic.
                </p>

                <button
                  type="button"
                  onClick={() => setIsExcelSyncOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                  <span>Importer / Mettre à Jour le Stock Excel</span>
                </button>
              </div>
            ) : (
              <div className="hidden sm:block bg-[#240313]/85 backdrop-blur-md border border-[#c2185b]/40 rounded-2xl p-4 sm:p-5 max-w-sm w-full shadow-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-rose-400" />
                    Réservation Express 48H
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#70083b]/80 text-rose-100 border border-[#c2185b]/60 font-semibold">
                    Stock Réel
                  </span>
                </div>

                <p className="text-xs text-rose-100/90 leading-relaxed mb-3">
                  Sélectionnez vos extraits et flacons, téléchargez votre <strong>Bon de Précommande officiel en PDF</strong> et transmettez-le directement pour expédition rapide.
                </p>

                <div className="flex items-center gap-2 pt-1 border-t border-[#70083b]/60 text-xs text-rose-200">
                  <Phone className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Contact Telegram & Vente : <strong className="text-white">+213 799 93 83 99</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Catalog View */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 flex-1 w-full">
        {/* Filters and Search Bar */}
        <ProductFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedFamily={selectedFamily}
          onSelectFamily={setSelectedFamily}
          stockFilter={stockFilter}
          onSelectStockFilter={setStockFilter}
          sortOption={sortOption}
          onSelectSortOption={setSortOption}
          totalCount={products.length}
          filteredCount={filteredProducts.length}
          familyCounts={familyCounts}
          onResetFilters={handleResetFilters}
          lang={currentLang}
          favoritesCount={favorites.length}
          showOnlyFavorites={showOnlyFavorites}
          onToggleOnlyFavorites={() => setShowOnlyFavorites((prev) => !prev)}
          showOnlyTopSellers={showOnlyTopSellers}
          onToggleOnlyTopSellers={() => setShowOnlyTopSellers((prev) => !prev)}
          topSellersCount={topSellersCount}
        />

        {/* Real-time background stock update indicator */}
        {isSyncingStocks && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-[#9f0e4e] rounded-xl flex items-center justify-center gap-2.5 text-xs font-bold animate-pulse shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
            </span>
            <span>
              {currentLang === 'ar'
                ? '🔄 جاري تحميل وتحديث المخزون الحقيقي في الخلفية...'
                : currentLang === 'en'
                ? '🔄 Updating real-time stock quantities in the background...'
                : '🔄 Synchronisation et mise à jour du stock réel en cours...'}
            </span>
          </div>
        )}

        {/* Product Cards Grid or Loading Skeleton */}
        {isCatalogLoading ? (
          <ProductSkeletonGrid lang={currentLang} count={8} />
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center my-6">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {products.length === 0
                ? (currentLang === 'ar' ? 'الكتالوج فارغ حالياً' : 'Le catalogue est actuellement vide')
                : (currentLang === 'ar' ? 'لا توجد منتجات تطابق معايير البحث' : 'Aucune matière première ne correspond à vos critères')}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
              {products.length === 0
                ? (currentLang === 'ar'
                    ? ''
                    : "")
                : (currentLang === 'ar'
                    ? 'يرجى التحقق من كلمات البحث أو إعادة ضبط الفلاتر.'
                    : "Vérifiez vos termes de recherche ou réinitialisez les filtres pour afficher l'ensemble des Extraits et Flacons.")}
            </p>
            {products.length > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                {currentLang === 'ar' ? 'عرض كافة المنتجات' : 'Afficher tout le catalogue'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {paginatedProducts.map((product) => {
                const inCartItem = cart.find((i) => i.product.id === product.id);
                const cartQuantity = inCartItem ? inCartItem.quantity : 0;

                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    cartQuantity={cartQuantity}
                    onAddToCart={handleAddToCart}
                    onDecreaseCartQuantity={handleDecreaseCartQuantity}
                    onQuickView={setQuickViewProduct}
                    isPricesVisible={isPricesVisible}
                    onRequireLogin={() => {
                      setCustomerAuthInitialTab('login');
                      setIsCustomerAuthOpen(true);
                    }}
                    lang={currentLang}
                    isFavorite={favorites.includes(product.id)}
                    onToggleFavorite={() => handleToggleFavorite(product.id)}
                  />
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2" dir="ltr">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {currentLang === 'ar' ? 'السابق' : 'Précédent'}
                </button>

                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pNum = idx + 1;
                    if (
                      pNum === 1 ||
                      pNum === totalPages ||
                      Math.abs(pNum - currentPage) <= 1
                    ) {
                      return (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => {
                            setCurrentPage(pNum);
                            window.scrollTo({ top: 400, behavior: 'smooth' });
                          }}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                            currentPage === pNum
                              ? 'bg-[#9f0e4e] text-white shadow-xs'
                              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {pNum}
                        </button>
                      );
                    } else if (
                      pNum === 2 ||
                      pNum === totalPages - 1
                    ) {
                      return <span key={pNum} className="text-slate-400 px-0.5 text-xs">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {currentLang === 'ar' ? 'التالي' : 'Suivant'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
        </>
      )}

      {/* Footer */}
      <footer className="bg-gradient-to-b from-[#2a0416] via-[#1c020f] to-[#12010a] border-t border-[#70083b]/60 text-rose-200/70 text-xs mt-12">
        <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-white font-bold text-base">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#9f0e4e] via-[#c2185b] to-[#e91e63] flex items-center justify-center text-white font-black text-xs shadow-md border border-rose-300/30">
                TF
              </div>
              <span className="tracking-tight text-white font-extrabold">{storeSettings.storeName}</span>
            </div>
            <p className="text-rose-100/80 text-xs leading-relaxed">
              Fournisseur et grossiste de matières premières pour la parfumerie, la cosmétique et les emballages en Algérie.
            </p>
            <div className="text-[11px] text-rose-300 font-medium">
              Extraits purs de Grasse • Flaconnerie luxe • Livraison 58 Wilayas
            </div>
          </div>

          {/* Col 2 */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-rose-100 uppercase tracking-wider">
              Familles de Produits
            </h4>
            <ul className="space-y-1.5">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFamily('Extrait');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-rose-300 transition cursor-pointer"
                >
                  Extraits & Concentrés de parfum
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFamily('Flacon');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-rose-300 transition cursor-pointer"
                >
                  Flacons vaporisateurs & Roll-on
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFamily('all');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-rose-300 transition cursor-pointer"
                >
                  Catalogue complet matières premières
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-rose-100 uppercase tracking-wider">
              Coordonnées en Algérie
            </h4>
            <p className="flex items-start gap-1.5 text-rose-100/90">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{storeSettings.address}, {storeSettings.wilaya}</span>
            </p>
            <p className="flex items-center gap-1.5 text-rose-100/90">
              <Phone className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{storeSettings.phone}</span>
            </p>
            <p className="flex items-center gap-1.5 text-rose-100/90">
              <Clock className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Samedi au Jeudi : 08h30 - 17h00</span>
            </p>
          </div>

          {/* Col 4: Merchant Tools (Hidden unless in Admin Mode) */}
          <div className="space-y-2">
            

            {isAdminMode ? (
              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsExcelSyncOpen(true)}
                  className="w-full text-left py-1.5 px-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 text-xs flex items-center justify-between border border-slate-700"
                >
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    Mise à jour stock Excel
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-slate-500" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsAdminOrdersOpen(true)}
                  className="w-full text-left py-1.5 px-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 text-xs flex items-center justify-between border border-slate-700"
                >
                  <span className="flex items-center gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5 text-rose-400" />
                    Précommandes reçues ({orders.length})
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-slate-500" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('admin');
                    window.location.hash = 'admin';
                  }}
                  className="w-full text-left py-1.5 px-2.5 rounded-xl bg-[#9f0e4e]/20 hover:bg-[#9f0e4e]/30 text-rose-200 text-xs flex items-center justify-between border border-[#c2185b]/40 font-bold transition"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-rose-300" />
                    Ouvrir la Page Administration
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-rose-300" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsAdminMode(false)}
                  className="w-full text-left py-1.5 px-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white text-xs flex items-center justify-between border border-slate-800 transition"
                >
                  <span>Masquer les outils d'administration</span>
                  <Lock className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <p className="text-rose-200/70 text-xs leading-relaxed">
                  Fournisseur professionnel de matières premières de parfumerie et flaconnage en Algérie.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    id="btn-customer-order-tracking-footer"
                    onClick={() => setIsOrderTrackingOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#9f0e4e]/30 to-[#c2185b]/30 hover:opacity-95 text-rose-200 border border-[#c2185b]/50 text-xs font-semibold transition cursor-pointer shadow-xs"
                  >
                    <Truck className="w-3.5 h-3.5 text-rose-400" />
                    <span>Suivre mes Précommandes</span>
                  </button>
                </div>

                {/* Footer Language Selection */}
                <div className="pt-2 border-t border-[#70083b]/40 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-[11px] text-rose-200/80">Langue / اللغة :</span>
                  <div className="inline-flex rounded-lg bg-black/40 p-0.5 border border-[#70083b]/50 text-xs">
                    <button
                      type="button"
                      onClick={() => handleConfirmLanguageSelection('fr')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${currentLang === 'fr' ? 'bg-gradient-to-r from-[#9f0e4e] to-[#c2185b] text-white font-black' : 'text-rose-200 hover:text-white'}`}
                    >
                      FR
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmLanguageSelection('ar')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${currentLang === 'ar' ? 'bg-gradient-to-r from-[#9f0e4e] to-[#c2185b] text-white font-black' : 'text-rose-200 hover:text-white'}`}
                    >
                      العربية
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmLanguageSelection('en')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${currentLang === 'en' ? 'bg-gradient-to-r from-[#9f0e4e] to-[#c2185b] text-white font-black' : 'text-rose-200 hover:text-white'}`}
                    >
                      EN
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLanguageModalOpen(true)}
                    className="text-[11px] text-rose-300 hover:underline cursor-pointer ml-1"
                  >
                    {currentLang === 'ar' ? 'تغيير...' : 'Changer...'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        
      </footer>

      {/* Unified Sticky Bottom Order Bar across both Showroom and Quick Order interfaces */}
      <StickyBottomOrderBar
        cart={cart}
        isPricesVisible={isPricesVisible}
        lang={currentLang}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Modals & Drawers */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={handleOpenCheckout}
        onProceedToProforma={handleOpenProforma}
        isPricesVisible={isPricesVisible}
        onRequireLogin={() => {
          setCustomerAuthInitialTab('login');
          setIsCustomerAuthOpen(true);
        }}
        lang={currentLang}
        savedPreorders={savedPreorders}
        onSaveCurrentCart={handleSaveCurrentCart}
        onLoadSavedPreorder={handleLoadSavedPreorder}
        onDeleteSavedPreorder={handleDeleteSavedPreorder}
        allProducts={products}
        onAddToCart={handleAddToCart}
      />

      <PreOrderModal
        isOpen={isPreOrderModalOpen}
        onClose={() => setIsPreOrderModalOpen(false)}
        items={cart}
        storeSettings={storeSettings}
        currentCustomer={currentCustomer}
        onSubmitOrder={handleSubmitOrder}
        isProforma={isProformaMode}
        isPricesVisible={isPricesVisible}
        lang={currentLang}
      />

      <OrderConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        order={recentOrder}
        storeSettings={storeSettings}
        onTrackOrder={() => {
          setIsConfirmationOpen(false);
          setIsOrderTrackingOpen(true);
        }}
        isPricesVisible={isPricesVisible}
        lang={currentLang}
        deviceInfo={deviceInfo}
      />

      {/* Language Selection Modal (Asks customer on first visit and remembers choice) */}
      <LanguageSelectionModal
        isOpen={isLanguageModalOpen}
        currentLang={currentLang}
        onSelectLanguage={handleConfirmLanguageSelection}
      />

      <OrderTrackingModal
        isOpen={isOrderTrackingOpen}
        onClose={() => setIsOrderTrackingOpen(false)}
        orders={orders}
        currentCustomer={currentCustomer}
        storeSettings={storeSettings}
        lang={currentLang}
      />

      <ExcelSyncModal
        isOpen={isExcelSyncOpen}
        onClose={() => setIsExcelSyncOpen(false)}
        products={products}
        onApplyInventory={handleApplyExcelInventory}
        onUpdateSingleStock={handleUpdateSingleStock}
      />

      <AdminOrdersModal
        isOpen={isAdminOrdersOpen}
        onClose={() => setIsAdminOrdersOpen(false)}
        orders={orders}
        storeSettings={storeSettings}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onDeleteOrder={handleDeleteOrder}
      />

      <ProductDetailModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        cartQuantity={
          quickViewProduct
            ? cart.find((i) => i.product.id === quickViewProduct.id)?.quantity || 0
            : 0
        }
        onAddToCart={handleAddToCart}
        isPricesVisible={isPricesVisible}
        onRequireLogin={() => {
          setCustomerAuthInitialTab('login');
          setIsCustomerAuthOpen(true);
        }}
        lang={currentLang}
        isFavorite={quickViewProduct ? favorites.includes(quickViewProduct.id) : false}
        onToggleFavorite={() => quickViewProduct && handleToggleFavorite(quickViewProduct.id)}
      />

      {/* Interface Choice Modal (allows customer to choose between Showroom and Quick Order) */}
      <InterfaceChoiceModal
        isOpen={isInterfaceChoiceOpen}
        onClose={() => setIsInterfaceChoiceOpen(false)}
        currentInterface={currentInterface}
        onSelectInterface={handleSelectInterface}
        lang={currentLang}
      />

      {/* Customer Login & Registration Modal */}
      <CustomerAuthModal
        isOpen={isCustomerAuthOpen}
        onClose={() => setIsCustomerAuthOpen(false)}
        initialTab={customerAuthInitialTab}
        applications={customerApplications}
        existingApplications={customerApplications}
        registeredCustomers={customerUsers}
        storeSettings={storeSettings}
        onLoginSuccess={(customer) => {
          handleLoginSuccess(customer);
          setIsCustomerAuthOpen(false);
        }}
        onRegisterSubmit={(appData) => {
          handleRegisterSubmit(appData);
        }}
      />

      {/* Advertising Popup Modal (shows random or previewed promo banner with slide navigation) */}
      <AdPopupModal
        isOpen={isAdPopupOpen}
        onClose={handleCloseAdPopup}
        banner={currentAdPopup}
        banners={adBanners}
        products={products}
        isPricesVisible={isPricesVisible}
        onRequireLogin={() => {
          setCustomerAuthInitialTab('login');
          setIsCustomerAuthOpen(true);
        }}
        lang={currentLang}
        onAddToCart={(prod, qty) => {
          handleAddToCart(prod, qty);
          setIsCartOpen(true);
          setSyncToastMessage(`"${prod.name}" a été ajouté au panier !`);
          setTimeout(() => setSyncToastMessage(null), 3000);
        }}
        onExplore={handleAdExplore}
      />

      {/* Admin Unlock Modal to reveal Excel import tools */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onUnlock={() => {
          setIsAdminMode(true);
          setSyncToastMessage("Mode Gestionnaire activé. Outils d'administration débloqués.");
          setTimeout(() => setSyncToastMessage(null), 4000);
        }}
        onSuccess={() => {
          setIsAdminMode(true);
          setSyncToastMessage("Mode Gestionnaire activé. Outils d'administration débloqués.");
          setTimeout(() => setSyncToastMessage(null), 4000);
        }}
      />
    </div>
  );
}
