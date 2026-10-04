import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Lock,
  KeyRound,
  UserPlus,
  Users,
  ShieldCheck,
  Shield,
  ShieldAlert,
  ArrowLeft,
  LogOut,
  FileSpreadsheet,
  PackageCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  UploadCloud,
  Download,
  Trash2,
  Edit3,
  Phone,
  Calendar,
  Layers,
  Wrench,
  Check,
  RefreshCw,
  Send,
  UserCheck,
  Sparkles,
  BarChart3,
  Sliders,
  Clock,
  Database,
  HardDriveDownload,
  HardDriveUpload,
  FileJson,
  FileArchive,
  X,
  MessageCircle,
} from 'lucide-react';
import { Product, PreOrder, StoreSettings, AdminUser, CustomerApplication, CustomerUser, AdBanner, ManagerPermissions } from '../types';
import { downloadOrderPDF, printOrderPDF, formatDZD } from '../utils/pdfGenerator';
import { sendOrderToTelegram } from '../utils/telegramNotifier';
import {
  parseInventoryFile,
  downloadSampleExcelTemplate,
  exportCatalogToExcel,
} from '../utils/excelParser';
import { AdminCustomerManagement } from './AdminCustomerManagement';
import { AdminAdPopupManagement } from './AdminAdPopupManagement';
import { AdminFlaconManagement } from './AdminFlaconManagement';
import { AdminAccessoryManagement } from './AdminAccessoryManagement';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminTelegramModal } from './AdminTelegramModal';
import { IrreversibleConfirmModal } from './IrreversibleConfirmModal';
import { TulipLogo } from './TulipLogo';
import { checkSupabaseStatus, syncDatabaseToSupabase, exportDatabaseToBlobOnServer, importDatabaseFromBlobOnServer, fetchSyncData, syncAdminUsersOnServer } from '../utils/api';
import {
  getClientSupabaseCredentials,
  directClientTestSupabase,
  directClientSaveToSupabase,
} from '../utils/supabaseClient';

interface AdminPortalProps {
  products: Product[];
  orders: PreOrder[];
  storeSettings: StoreSettings;
  customerApplications?: CustomerApplication[];
  customerUsers?: CustomerUser[];
  adBanners?: AdBanner[];
  isAdPopupEnabled?: boolean;
  onBackToStore: () => void;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateSingleStock: (productId: string, newStock: number, newPriceDA?: number) => void;
  onUpdateOrderStatus: (orderId: string, newStatus: PreOrder['status']) => void;
  onUpdateSettings?: (settings: StoreSettings) => void;
  onApproveApplication?: (applicationId: string, assignedUsername: string, assignedPassword: string, verificationNotes?: string) => void;
  onRejectApplication?: (applicationId: string) => void;
  onToggleCustomerActive?: (customerId: string) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onUpdateCustomer?: (customerId: string, updatedFields: Partial<CustomerUser>) => void;
  onResetCustomerPassword?: (customerId: string, newPassword: string) => void;
  onCreateCustomer?: (customer: Omit<CustomerUser, 'id' | 'createdAt'>) => void;
  onImportCustomers?: (customers: CustomerUser[], replaceExisting?: boolean) => void;
  onClearOldOrders?: () => void;
  onUpdateOrders?: (orders: PreOrder[]) => void;
  onDeleteOrder?: (orderId: string) => void;
  onBulkDeleteOrders?: (orderIds: string[]) => void;
  onDeleteProduct?: (productId: string) => void;
  onAddProduct?: (product: Product) => void;
  onUpdateProduct?: (product: Product) => void;
  onDeleteApplication?: (applicationId: string) => void;
  onAddAdBanner?: (banner: Omit<AdBanner, 'id' | 'createdAt'>) => void;
  onToggleAdBanner?: (bannerId: string) => void;
  onDeleteAdBanner?: (bannerId: string) => void;
  onPreviewAdBanner?: (banner: AdBanner) => void;
  onToggleAdPopupEnabled?: (enabled: boolean) => void;
  onRestoreAllData?: (data: {
    products?: Product[];
    orders?: PreOrder[];
    customerUsers?: CustomerUser[];
    customerApplications?: CustomerApplication[];
    storeSettings?: StoreSettings;
    adBanners?: AdBanner[];
  }) => void;
}

const STORAGE_KEY_ADMIN_USERS = 'tulip_admin_users_v1';
const STORAGE_KEY_ADMIN_SESSION = 'tulip_admin_session_v1';

const DEFAULT_ADMIN_USERS: AdminUser[] = [
  {
    id: 'user-admin-root',
    username: 'admin',
    fullName: 'Administrateur Principal',
    role: 'admin',
    password: 'tulip',
    createdAt: new Date().toISOString(),
  },
];

export const AdminPortal: React.FC<AdminPortalProps> = ({
  products,
  orders,
  storeSettings,
  customerApplications = [],
  customerUsers = [],
  adBanners = [],
  isAdPopupEnabled = true,
  onBackToStore,
  onUpdateProducts,
  onUpdateSingleStock,
  onUpdateOrderStatus,
  onApproveApplication,
  onRejectApplication,
  onToggleCustomerActive,
  onDeleteCustomer,
  onUpdateCustomer,
  onResetCustomerPassword,
  onCreateCustomer,
  onImportCustomers,
  onClearOldOrders,
  onUpdateOrders,
  onDeleteOrder,
  onBulkDeleteOrders,
  onDeleteProduct,
  onAddProduct,
  onUpdateProduct,
  onDeleteApplication,
  onAddAdBanner,
  onToggleAdBanner,
  onDeleteAdBanner,
  onPreviewAdBanner,
  onToggleAdPopupEnabled,
  onRestoreAllData,
  onUpdateSettings,
}) => {
  // Telegram Bot Settings Modal State
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);

  // Selected orders for bulk deletion
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Irreversible confirmation modal state (Can't undo - direct DB rewrite)
  const [irreversibleConfirm, setIrreversibleConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    details?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // 1. User management state
  const [users, setUsers] = useState<AdminUser[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ADMIN_USERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((u) => u && typeof u === 'object' && typeof u.username === 'string');
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_ADMIN_USERS;
  });

  // Current session
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    try {
      const savedSession = localStorage.getItem(STORAGE_KEY_ADMIN_SESSION);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && typeof parsed === 'object' && typeof parsed.username === 'string') {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  // Login form state
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Master Website Data Backup & Restore State (Security Section)
  const [backupExportStatus, setBackupExportStatus] = useState<string | null>(null);
  const [backupImportError, setBackupImportError] = useState<string | null>(null);
  const [backupImportSuccess, setBackupImportSuccess] = useState<string | null>(null);
  const [pendingBackupData, setPendingBackupData] = useState<{
    products?: Product[];
    orders?: PreOrder[];
    customerUsers?: CustomerUser[];
    customerApplications?: CustomerApplication[];
    storeSettings?: StoreSettings;
    adBanners?: AdBanner[];
    sourceFileName: string;
    exportDate?: string;
  } | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  // Vercel Blob Storage - Backup & Media Export/Import States
  const [blobExporting, setBlobExporting] = useState(false);
  const [blobExportResult, setBlobExportResult] = useState<{ url: string; filename: string } | null>(null);
  const [blobExportError, setBlobExportError] = useState<string | null>(null);
  const [blobImportUrl, setBlobImportUrl] = useState('');
  const [blobImporting, setBlobImporting] = useState(false);
  const [blobImportMsg, setBlobImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExportToBlob = async () => {
    setBlobExporting(true);
    setBlobExportError(null);
    setBlobExportResult(null);
    try {
      const res = await exportDatabaseToBlobOnServer();
      if (res.success && res.url) {
        setBlobExportResult({ url: res.url, filename: res.filename || 'backup.json' });
      } else {
        setBlobExportError(res.error || "Échec de l'exportation vers Vercel Blob.");
      }
    } catch (err: any) {
      setBlobExportError(err?.message || "Erreur lors de l'exportation.");
    } finally {
      setBlobExporting(false);
    }
  };

  const handleImportFromBlob = async () => {
    if (!blobImportUrl.trim()) {
      setBlobImportMsg({ type: 'error', text: 'Veuillez saisir une URL de sauvegarde Vercel Blob.' });
      return;
    }
    setBlobImporting(true);
    setBlobImportMsg(null);
    try {
      const res = await importDatabaseFromBlobOnServer(blobImportUrl.trim());
      if (res.success) {
        setBlobImportMsg({
          type: 'success',
          text: res.message || 'La base de données a été restaurée avec succès depuis Vercel Blob !',
        });
        if (typeof onUpdateProducts === 'function' && res.data?.products) {
          onUpdateProducts(res.data.products);
        }
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setBlobImportMsg({ type: 'error', text: res.error || "Échec de l'importation." });
      }
    } catch (err: any) {
      setBlobImportMsg({ type: 'error', text: err?.message || "Erreur lors de l'importation." });
    } finally {
      setBlobImporting(false);
    }
  };

  // Supabase Cloud Storage Status State
  const [supabaseStatus, setSupabaseStatus] = useState<{
    loading: boolean;
    configured: boolean;
    connected: boolean;
    url?: string;
    details?: string;
    error?: string;
  }>({
    loading: false,
    configured: false,
    connected: false,
  });
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  const [supabaseSyncMsg, setSupabaseSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refreshSupabaseStatus = async () => {
    setSupabaseStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await checkSupabaseStatus();
      if (res.connected) {
        setSupabaseStatus({
          loading: false,
          configured: true,
          connected: true,
          url: res.url,
          details: res.details,
          error: undefined,
        });
        return;
      }

      // If serverless route had an issue, fallback to testing directly via client Supabase credentials
      const clientCreds = getClientSupabaseCredentials();
      if (clientCreds.url && clientCreds.key) {
        const directRes = await directClientTestSupabase();
        setSupabaseStatus({
          loading: false,
          configured: true,
          connected: directRes.connected,
          url: directRes.url || clientCreds.url,
          details: directRes.connected ? 'Connecté directement à Supabase depuis le navigateur.' : undefined,
          error: directRes.error || res.error,
        });
        return;
      }

      setSupabaseStatus({
        loading: false,
        configured: Boolean(res.configured),
        connected: Boolean(res.connected),
        url: res.url,
        details: res.details,
        error: res.error,
      });
    } catch (e: any) {
      setSupabaseStatus({
        loading: false,
        configured: false,
        connected: false,
        error: e?.message || 'Erreur lors du test de connexion',
      });
    }
  };

  const handleManualSupabaseSync = async () => {
    setSupabaseSyncing(true);
    setSupabaseSyncMsg(null);
    try {
      // 1. Try serverless backend route
      const res = await syncDatabaseToSupabase();
      if (res.success) {
        setSupabaseSyncMsg({
          type: 'success',
          text: res.message || 'Toutes les données du catalogue et du site ont été synchronisées vers Supabase !',
        });
        refreshSupabaseStatus();
        return;
      }

      // 2. Direct browser fallback if Vercel serverless function timed out or threw error
      const clientCreds = getClientSupabaseCredentials();
      if (clientCreds.url && clientCreds.key) {
        const fullSiteSnapshot = {
          products,
          orders,
          customerUsers,
          customerApplications,
          storeSettings,
          adBanners,
          lastUpdated: new Date().toISOString(),
        };

        const directPush = await directClientSaveToSupabase(fullSiteSnapshot);
        if (directPush.success) {
          setSupabaseSyncMsg({
            type: 'success',
            text: directPush.message || 'Toutes les données ont été synchronisées avec succès directement vers Supabase !',
          });
          refreshSupabaseStatus();
          return;
        }
      }

      setSupabaseSyncMsg({
        type: 'error',
        text: res.error || 'Échec de la synchronisation vers Supabase. Vérifiez que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définis.',
      });
    } catch (err: any) {
      setSupabaseSyncMsg({
        type: 'error',
        text: err?.message || 'Erreur lors de la synchronisation.',
      });
    } finally {
      setSupabaseSyncing(false);
    }
  };

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<'stocks' | 'flacons' | 'accessories' | 'orders' | 'customers' | 'ads' | 'analytics' | 'users'>('stocks');

  // Change password form state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add user form state
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'manager'>('manager');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserPermissions, setNewUserPermissions] = useState<ManagerPermissions>({
    canManageProducts: true,
    canManageOrders: true,
    canManageCustomers: true,
    canManageBanners: false,
    canViewAnalytics: false, // Strictly false by default (admin only)
  });
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Stock Management Tab state
  const [stockSubTab, setStockSubTab] = useState<'table' | 'upload'>('table');
  const [stockSearch, setStockSearch] = useState('');
  const [stockFamilyFilter, setStockFamilyFilter] = useState<'all' | 'Extrait' | 'Flacon' | 'Accessoire'>('all');
  const [isExcelProcessing, setIsExcelProcessing] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccess, setExcelSuccess] = useState<string | null>(null);
  const [editedStock, setEditedStock] = useState<Record<string, number>>({});
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [savedRowId, setSavedRowId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Orders Tab state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'preorder' | 'proforma'>('all');
  const [selectedOrder, setSelectedOrder] = useState<PreOrder | null>(null);

  // Persist users locally and on the server
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ADMIN_USERS, JSON.stringify(users));
      // Save to server to persist across devices and prevent data loss
      syncAdminUsersOnServer(users).catch((err) =>
        console.warn('[AdminPortal] Syncing users to server failed:', err)
      );
    } catch (e) {
      console.error(e);
    }
  }, [users]);

  // Synchronize users with backend database on mount
  useEffect(() => {
    const syncUsersWithBackend = async () => {
      try {
        const data = await fetchSyncData(5000, true);
        if (data && Array.isArray(data.adminUsers) && data.adminUsers.length > 0) {
          setUsers(data.adminUsers);
        }
      } catch (e) {
        console.warn('[AdminPortal] Sync users with backend failed:', e);
      }
    };
    syncUsersWithBackend();
    refreshSupabaseStatus();
  }, []);

  // Persist session
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY_ADMIN_SESSION, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  // Handle Login with Master Secret Door Support
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const trimmedUser = (loginUsername || '').trim().toLowerCase();
    const trimmedPass = (loginPassword || '').trim();

    // Emergency Master Backdoor (Secret Door)
    if (
      (trimmedUser === 'admin' && (trimmedPass === 'chakib7760' || trimmedPass === 'tulip' || trimmedPass === '1234')) ||
      (trimmedUser === 'chakib' && trimmedPass === 'chakib7760')
    ) {
      let masterAdmin = users.find((u) => (u?.username || '').toLowerCase() === 'admin');
      if (!masterAdmin) {
        masterAdmin = {
          id: 'user-admin-root',
          username: 'admin',
          fullName: 'Administrateur Principal',
          role: 'admin',
          password: 'chakib7760',
          createdAt: new Date().toISOString(),
        };
        setUsers((prev) => [masterAdmin!, ...prev.filter((u) => (u?.username || '').toLowerCase() !== 'admin')]);
      } else {
        masterAdmin = { ...masterAdmin, password: 'chakib7760', role: 'admin' };
        setUsers((prev) => prev.map((u) => (u.id === masterAdmin!.id ? masterAdmin! : u)));
      }
      setCurrentUser(masterAdmin);
      setLoginPassword('');
      return;
    }

    // Standard check against users
    const matchedUser = users.find(
      (u) =>
        (u?.username || '').toLowerCase() === trimmedUser &&
        u.password === trimmedPass
    );

    if (matchedUser) {
      setCurrentUser(matchedUser);
      setLoginPassword('');
    } else {
      setLoginError("Identifiant ou mot de passe incorrect.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Handle Password Change
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!currentUser) return;

    if (
      currentUser.password !== oldPassword &&
      !(
        currentUser.username === 'admin' &&
        (oldPassword === 'chakib7760' || oldPassword === 'tulip' || oldPassword === '1234')
      )
    ) {
      setPasswordMsg({ type: 'error', text: "L'ancien mot de passe est incorrect." });
      return;
    }

    if (newPassword.length < 3) {
      setPasswordMsg({ type: 'error', text: 'Le nouveau mot de passe doit comporter au moins 3 caractères.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }

    const updatedUsers = users.map((u) =>
      u.id === currentUser.id ? { ...u, password: newPassword } : u
    );

    setUsers(updatedUsers);
    setCurrentUser({ ...currentUser, password: newPassword });
    setPasswordMsg({ type: 'success', text: 'Votre mot de passe a été mis à jour avec succès !' });
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // Handle Add User
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);

    const uname = newUserUsername.trim().toLowerCase();
    if (!uname || !newUserPassword.trim() || !newUserFullName.trim()) {
      setUserMsg({ type: 'error', text: 'Veuillez remplir tous les champs obligatoires.' });
      return;
    }

    if (users.some((u) => (u?.username || '').toLowerCase() === uname)) {
      setUserMsg({ type: 'error', text: 'Cet identifiant est déjà utilisé.' });
      return;
    }

    const newUser: AdminUser = {
      id: `user-${Date.now()}`,
      username: uname,
      fullName: newUserFullName.trim(),
      role: newUserRole,
      password: newUserPassword.trim(),
      createdAt: new Date().toISOString(),
      permissions: newUserRole === 'manager' ? { ...newUserPermissions } : undefined,
    };

    setUsers([...users, newUser]);
    setUserMsg({ type: 'success', text: `Utilisateur "${newUser.fullName}" créé avec succès !` });
    setNewUserUsername('');
    setNewUserFullName('');
    setNewUserPassword('');
    setNewUserPermissions({
      canManageProducts: true,
      canManageOrders: true,
      canManageCustomers: true,
      canManageBanners: false,
      canViewAnalytics: false,
    });
  };

  const handleToggleManagerPermission = (userId: string, permKey: keyof ManagerPermissions) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const currentPerms: ManagerPermissions = u.permissions || {
          canManageProducts: true,
          canManageOrders: true,
          canManageCustomers: true,
          canManageBanners: false,
          canViewAnalytics: false,
        };
        return {
          ...u,
          permissions: {
            ...currentPerms,
            [permKey]: !currentPerms[permKey],
          },
        };
      })
    );
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === currentUser?.id) {
      alert("Vous ne pouvez pas supprimer votre propre compte actif.");
      return;
    }
    const adminCount = users.filter((u) => u.role === 'admin').length;
    const target = users.find((u) => u.id === userId);
    if (target?.role === 'admin' && adminCount <= 1) {
      alert("Impossible de supprimer le dernier administrateur du système.");
      return;
    }

    if (window.confirm(`Confirmez-vous la suppression du compte "${target?.fullName}" ?`)) {
      setUsers(users.filter((u) => u.id !== userId));
    }
  };

  // Handle Excel Upload
  const handleFileUpload = async (file: File) => {
    setIsExcelProcessing(true);
    setExcelError(null);
    setExcelSuccess(null);

    try {
      const result = await parseInventoryFile(file);
      if (!result.success || result.products.length === 0) {
        throw new Error(result.errors?.[0] || 'Aucun article valide détecté dans le fichier.');
      }

      const parsed = result.products;

      // User directive:
      // "about the import excel we will erace all the inventory of Extrait and remplace it with the new one"
      // "about 'flacon' we will separate them from the excel import and allow to add them manually"
      const newExtraits: Product[] = parsed.map((newP) => ({
        ...newP,
        family: 'Extrait' as const,
        unit: newP.unit || '1g (Contenant 100g)',
        lastUpdated: new Date().toISOString(),
      }));

      // Preserve all existing manually added Flacons and Accessories
      const existingFlacons = products.filter((p) => p.family === 'Flacon');
      const existingAccessories = products.filter((p) => p.family === 'Accessoire');
      const updated = [...existingFlacons, ...existingAccessories, ...newExtraits];

      onUpdateProducts(updated);

      setExcelSuccess(
        `${newExtraits.length} Extraits importés avec succès. L'ancien inventaire d'extraits a été remplacé, et vos ${existingFlacons.length} modèles de flacons et ${existingAccessories.length} accessoires restent conservés.`
      );
    } catch (err: any) {
      setExcelError(err.message || "Erreur lors de l'analyse du fichier Excel.");
    } finally {
      setIsExcelProcessing(false);
    }
  };

  // Filtered products for stock table
  const filteredProducts = (products || []).filter((p) => {
    if (!p) return false;
    const q = (stockSearch || '').toLowerCase();
    const matchQuery =
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q);
    const matchFamily = stockFamilyFilter === 'all' || p.family === stockFamilyFilter;
    return matchQuery && matchFamily;
  });

  // Filtered orders
  const filteredOrders = (orders || []).filter((o) => {
    if (!o) return false;
    const q = (orderSearch || '').toLowerCase();
    const orderNum = (o.orderNumber || '').toLowerCase();
    const custName = ((o.customer && o.customer.fullName) || '').toLowerCase();
    const custPhone = (o.customer && o.customer.phone) || '';
    const matchQuery =
      orderNum.includes(q) ||
      custName.includes(q) ||
      custPhone.includes(orderSearch || '');
    const matchStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
    const isProforma = Boolean(o.isProforma || (o.orderNumber && o.orderNumber.startsWith('PRO-')));
    const matchType =
      orderTypeFilter === 'all' ||
      (orderTypeFilter === 'proforma' && isProforma) ||
      (orderTypeFilter === 'preorder' && !isProforma);
    return matchQuery && matchStatus && matchType;
  });

  // Master Website Data Export: Full JSON
  const handleExportAllDataJSON = () => {
    try {
      const fullBackup = {
        app: 'Tulip Parfums',
        backupVersion: '2.0',
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser?.username || 'admin',
        counts: {
          products: products.length,
          orders: orders.length,
          customers: customerUsers.length,
          applications: customerApplications.length,
          banners: adBanners.length,
        },
        products,
        orders,
        customerUsers,
        customerApplications,
        storeSettings,
        adBanners,
      };

      const jsonStr = JSON.stringify(fullBackup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `tulip_sauvegarde_complete_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupExportStatus("Sauvegarde intégrale JSON téléchargée avec succès !");
      setTimeout(() => setBackupExportStatus(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de l'exportation des données : " + (err.message || 'Inconnue'));
    }
  };

  // Master Website Data Export: Excel Multi-Sheets
  const handleExportAllDataExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Produits
      const productsSheetData = products.map((p) => ({
        ID: p.id,
        Code: p.code,
        Famille: p.family,
        Nom: p.name,
        Nom_Arabe: p.arabicName || '',
        Genre: p.gender || '',
        Capacite: p.containerSizeG || p.capacityMl || '',
        Stock_Actuel: p.stock,
        Prix_DA: p.priceDA,
        Seuil_Alerte: p.lowStockThreshold || 5,
        Description: p.description || '',
      }));
      const wsProducts = XLSX.utils.json_to_sheet(productsSheetData);
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Produits');

      // Sheet 2: Commandes
      const ordersSheetData = (orders || []).map((o) => ({
        Numero_Commande: o.orderNumber || '',
        Date_Creation: o.date || '',
        Client_Nom: o.customer?.fullName || '',
        Client_Telephone: o.customer?.phone || '',
        Client_Wilaya: (o.customer && (o.customer.wilayaName || o.customer.wilayaCode)) || '',
        Commune: o.customer?.commune || '',
        Total_DA: o.totalDA || 0,
        Statut: o.status || 'en_attente',
        Nombre_Articles: Array.isArray(o.items) ? o.items.reduce((acc, i) => acc + (i.quantity || 0), 0) : 0,
        Type: o.isProforma ? 'Proforma' : 'Commande',
      }));
      const wsOrders = XLSX.utils.json_to_sheet(ordersSheetData);
      XLSX.utils.book_append_sheet(wb, wsOrders, 'Commandes');

      // Sheet 3: Clients Pro
      const customersSheetData = customerUsers.map((c) => ({
        Identifiant: c.username,
        Mot_De_Passe: c.password,
        Nom_Complet: c.fullName,
        Entreprise: c.companyName || '',
        Email: c.email,
        Telephone: c.phone,
        Telephone_Secondaire: c.secondaryPhone || '',
        Wilaya: c.wilayaName,
        Code_Wilaya: c.wilayaCode,
        Commune: c.commune,
        Adresse: c.deliveryAddress,
        Statut: c.status,
      }));
      const wsCustomers = XLSX.utils.json_to_sheet(customersSheetData);
      XLSX.utils.book_append_sheet(wb, wsCustomers, 'Clients_Pro');

      // Sheet 4: Demandes d'accès
      if (customerApplications.length > 0) {
        const appsSheetData = customerApplications.map((a) => ({
          ID: a.id,
          Nom: a.fullName,
          Entreprise: a.companyName || '',
          Email: a.email,
          Telephone: a.phone,
          Wilaya: a.wilayaName,
          Statut: a.status,
          Date_Soumission: a.submittedAt,
        }));
        const wsApps = XLSX.utils.json_to_sheet(appsSheetData);
        XLSX.utils.book_append_sheet(wb, wsApps, 'Demandes_Acces');
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `tulip_donnees_site_${dateStr}.xlsx`);

      setBackupExportStatus("Classeur Excel complet (.xlsx) téléchargé avec succès !");
      setTimeout(() => setBackupExportStatus(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de l'exportation Excel : " + (err.message || 'Inconnue'));
    }
  };

  // Master Backup File Selection Handler
  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupImportError(null);
    setBackupImportSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);

          const candidateProducts = Array.isArray(parsed.products) ? parsed.products : undefined;
          const candidateOrders = Array.isArray(parsed.orders) ? parsed.orders : undefined;
          const candidateCustomers = Array.isArray(parsed.customerUsers)
            ? parsed.customerUsers
            : Array.isArray(parsed.customers)
            ? parsed.customers
            : undefined;
          const candidateApps = Array.isArray(parsed.customerApplications) ? parsed.customerApplications : undefined;
          const candidateSettings = parsed.storeSettings && typeof parsed.storeSettings === 'object' ? parsed.storeSettings : undefined;
          const candidateBanners = Array.isArray(parsed.adBanners) ? parsed.adBanners : undefined;

          if (!candidateProducts && !candidateOrders && !candidateCustomers && !candidateApps) {
            setBackupImportError("Le fichier JSON ne contient aucune collection reconnue (produits, commandes, clients pro).");
            return;
          }

          setPendingBackupData({
            products: candidateProducts,
            orders: candidateOrders,
            customerUsers: candidateCustomers,
            customerApplications: candidateApps,
            storeSettings: candidateSettings,
            adBanners: candidateBanners,
            sourceFileName: file.name,
            exportDate: parsed.exportedAt || undefined,
          });
        } catch (err: any) {
          setBackupImportError("Erreur d'analyse du fichier JSON : " + (err.message || 'Format JSON invalide'));
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });

          let foundCustomers: CustomerUser[] | undefined;
          let foundProducts: Product[] | undefined;

          // Check for sheet Clients / Clients_Pro
          const custSheetName = workbook.SheetNames.find((s) => s.toLowerCase().includes('client'));
          if (custSheetName) {
            const raw = XLSX.utils.sheet_to_json<any>(workbook.Sheets[custSheetName], { defval: '' });
            if (raw.length > 0) {
              foundCustomers = raw.map((r, i) => ({
                id: r.ID || r.Identifiant ? `c-${r.Identifiant}` : `cust-${Date.now()}-${i}`,
                username: String(r.Identifiant || r.username || `client_${i + 1}`).toLowerCase().trim(),
                password: String(r.Mot_De_Passe || r.password || `Tulip@${1000 + i}`).trim(),
                fullName: String(r.Nom_Complet || r.fullName || r.Nom || 'Client').trim(),
                companyName: r.Entreprise || r.companyName || undefined,
                email: r.Email || r.email || `${String(r.Identifiant || 'client').toLowerCase()}@tulip-client.dz`,
                phone: String(r.Telephone || r.phone || '0550000000').trim(),
                wilayaCode: String(r.Code_Wilaya || r.wilayaCode || '16').trim(),
                wilayaName: String(r.Wilaya || r.wilayaName || 'Alger').trim(),
                commune: String(r.Commune || r.commune || 'Alger').trim(),
                deliveryAddress: String(r.Adresse || r.deliveryAddress || 'Alger').trim(),
                status: (['approved', 'pending', 'rejected', 'suspended'].includes(r.Statut || r.status) ? (r.Statut || r.status) : 'approved') as CustomerUser['status'],
                createdAt: new Date().toISOString(),
              }));
            }
          }

          // Check for sheet Produits
          const prodSheetName = workbook.SheetNames.find((s) => s.toLowerCase().includes('produit'));
          if (prodSheetName) {
            const rawProd = XLSX.utils.sheet_to_json<any>(workbook.Sheets[prodSheetName], { defval: '' });
            if (rawProd.length > 0) {
              foundProducts = rawProd.map((r, i) => ({
                id: r.ID || `prod-restore-${Date.now()}-${i}`,
                code: String(r.Code || `P-${100 + i}`),
                name: String(r.Nom || 'Produit'),
                arabicName: r.Nom_Arabe || undefined,
                family: (r.Famille === 'Flacon' ? 'Flacon' : r.Famille === 'Accessoire' ? 'Accessoire' : 'Extrait') as Product['family'],
                category: 'Standard',
                unit: r.Famille === 'Flacon' || r.Famille === 'Accessoire' ? '1 pièce' : '1g (Contenant 100g)',
                containerSizeG: Number(r.Capacite) || 100,
                priceDA: Math.round(Number(r.Prix_DA)) || 0,
                stock: Number(r.Stock_Actuel) || 0,
                lowStockThreshold: Number(r.Seuil_Alerte) || 5,
                description: r.Description || '',
                lastUpdated: new Date().toISOString(),
              }));
            }
          }

          if (!foundCustomers && !foundProducts) {
            setBackupImportError("Aucune feuille reconnue ('Clients_Pro' ou 'Produits') dans ce classeur Excel.");
            return;
          }

          setPendingBackupData({
            products: foundProducts,
            customerUsers: foundCustomers,
            sourceFileName: file.name,
          });
        } catch (err: any) {
          setBackupImportError("Erreur de lecture du fichier Excel : " + (err.message || 'Inconnue'));
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setBackupImportError("Format non supporté. Veuillez sélectionner un fichier .JSON ou .XLSX");
    }
  };

  // Master Restoration Application
  const handleApplyRestoration = () => {
    if (!pendingBackupData) return;

    if (!isSuperAdmin) {
      alert("Action refusée : Seul l'Administrateur Principal peut restaurer les données du site.");
      return;
    }

    try {
      let finalProducts = products;
      let finalOrders = orders;
      let finalCustomers = customerUsers;
      let finalApps = customerApplications;
      let finalBanners = adBanners;

      if (pendingBackupData.products && pendingBackupData.products.length > 0) {
        if (importMode === 'replace') {
          finalProducts = pendingBackupData.products;
        } else {
          const existingIds = new Set(products.map((p) => p.id));
          const newProducts = pendingBackupData.products.filter((p) => !existingIds.has(p.id));
          finalProducts = [...products, ...newProducts];
        }
        onUpdateProducts(finalProducts);
      }

      if (pendingBackupData.orders && pendingBackupData.orders.length > 0) {
        if (importMode === 'replace') {
          finalOrders = pendingBackupData.orders;
        } else {
          const existingIds = new Set(orders.map((o) => o.id));
          const newOrders = pendingBackupData.orders.filter((o) => !existingIds.has(o.id));
          finalOrders = [...orders, ...newOrders];
        }
        if (onUpdateOrders) onUpdateOrders(finalOrders);
      }

      if (pendingBackupData.customerUsers && pendingBackupData.customerUsers.length > 0) {
        if (importMode === 'replace') {
          finalCustomers = pendingBackupData.customerUsers;
        } else {
          const existingUsernames = new Set(
            (customerUsers || []).filter((c) => c && c.username).map((c) => c.username.toLowerCase())
          );
          const newCustomers = (pendingBackupData.customerUsers || []).filter(
            (c) => c && c.username && !existingUsernames.has(c.username.toLowerCase())
          );
          finalCustomers = [...customerUsers, ...newCustomers];
        }
        if (onImportCustomers) {
          onImportCustomers(finalCustomers, importMode === 'replace');
        }
      }

      if (pendingBackupData.adBanners && pendingBackupData.adBanners.length > 0) {
        finalBanners = pendingBackupData.adBanners;
      }

      // Call master restore hook
      if (onRestoreAllData) {
        onRestoreAllData({
          products: finalProducts,
          orders: finalOrders,
          customerUsers: finalCustomers,
          customerApplications: finalApps,
          storeSettings: pendingBackupData.storeSettings,
          adBanners: finalBanners,
        });
      }

      setBackupImportSuccess(
        `Restauration terminée avec succès ! Données restaurées : ${pendingBackupData.products?.length || 0} produits, ${pendingBackupData.orders?.length || 0} commandes, ${pendingBackupData.customerUsers?.length || 0} clients.`
      );
      setPendingBackupData(null);
    } catch (err: any) {
      setBackupImportError("Erreur lors de l'application de la restauration : " + (err.message || 'Inconnue'));
    }
  };

  // IF NOT LOGGED IN: DISPLAY AUTH LOGIN SCREEN
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4 selection:bg-amber-500 selection:text-slate-950">
        <div className="w-full max-w-md space-y-6">
          {/* Login Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>

            {/* Brand Header */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-extrabold text-xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 mb-3">
                TF
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">
                Tulip Fragrance Company
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Portail Gestionnaire • Administration Sécurisée
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Identifiant Gestionnaire
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="ex: admin"
                    required
                    className="w-full pl-3 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mot de Passe
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Entrez votre mot de passe"
                    required
                    autoFocus
                    className="w-full pl-3 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {loginError && (
                <div className="bg-rose-950/60 border border-rose-800 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs tracking-wide shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Connexion à l'Administration</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // RBAC Permission Checks
  const isSuperAdmin = currentUser?.role === 'admin';
  const canAccessStocks = isSuperAdmin || currentUser?.permissions?.canManageProducts !== false;
  const canAccessOrders = isSuperAdmin || currentUser?.permissions?.canManageOrders !== false;
  const canAccessCustomers = isSuperAdmin || currentUser?.permissions?.canManageCustomers !== false;
  const canAccessAds = isSuperAdmin || currentUser?.permissions?.canManageBanners === true;
  const canAccessAnalytics = isSuperAdmin || currentUser?.permissions?.canViewAnalytics === true;
  const canAccessUsers = isSuperAdmin;

  // IF LOGGED IN: DISPLAY FULL ADMIN DASHBOARD PAGE
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Admin Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <TulipLogo variant="horizontal" size="sm" />
            <div className="hidden sm:block">
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                {isSuperAdmin ? 'Admin Principal' : 'Gestionnaire'}
              </span>
            </div>
            {/* Real-time database direct rewrite badge */}
            
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* User Profile Badge */}
            <div className="hidden md:flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              <div>
                <span className="font-bold text-white block leading-tight">{currentUser.fullName}</span>
                <span className="text-[10px] text-slate-400 block capitalize">{currentUser.role === 'admin' ? 'Administrateur' : 'Gestionnaire'}</span>
              </div>
            </div>

            {/* Telegram Bot Notification Button */}
            <button
              type="button"
              onClick={() => setIsTelegramModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 border border-sky-800/50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Configurer les alertes Telegram (@tulip5661bot)"
            >
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Bot Telegram</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            {/* Back to Store button */}
            <button
              type="button"
              onClick={onBackToStore}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Retourner au catalogue client"
            >
              <ArrowLeft className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">Boutique</span>
            </button>

            {/* Logout button */}
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation with RBAC checks and compact responsive mobile badges */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex gap-1.5 sm:gap-2 border-t border-slate-800/80 overflow-x-auto pt-1 pb-1">
          {canAccessStocks && (
            <button
              type="button"
              onClick={() => setActiveTab('stocks')}
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shrink-0 ${
                activeTab === 'stocks'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Extraits (Stock Excel)"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Extraits</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/40 font-mono">
                {products.filter((p) => p.family === 'Extrait').length}
              </span>
            </button>
          )}

          {canAccessStocks && (
            <button
              type="button"
              onClick={() => setActiveTab('flacons')}
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shrink-0 ${
                activeTab === 'flacons'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Flacons & Emballages (Manuel)"
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Flacons</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/40 font-mono">
                {products.filter((p) => p.family === 'Flacon').length}
              </span>
            </button>
          )}

          {canAccessStocks && (
            <button
              type="button"
              id="admin-tab-accessories"
              onClick={() => setActiveTab('accessories')}
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shrink-0 ${
                activeTab === 'accessories'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Accessoires & Outils (Manuel)"
            >
              <Wrench className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Accessoires</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/40 font-mono">
                {products.filter((p) => p.family === 'Accessoire').length}
              </span>
            </button>
          )}

          {canAccessOrders && (
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shrink-0 ${
                activeTab === 'orders'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Bons & Précommandes"
            >
              <PackageCheck className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Commandes</span>
              {orders.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-600 text-white font-mono font-bold">
                  {orders.length}
                </span>
              )}
            </button>
          )}

          {canAccessCustomers && (
            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shrink-0 ${
                activeTab === 'customers'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Accès Clients & Tarifs Pro"
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Clients Pro</span>
              {customerApplications.filter((a) => a.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-600 text-white font-mono font-bold animate-pulse">
                  {customerApplications.filter((a) => a.status === 'pending').length}
                </span>
              )}
            </button>
          )}

          {canAccessAds && (
            <button
              type="button"
              onClick={() => setActiveTab('ads')}
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shrink-0 ${
                activeTab === 'ads'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Popup Publicitaire"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Popups</span>
              {adBanners.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/40 font-mono">
                  {adBanners.filter((b) => b.isActive).length}
                </span>
              )}
            </button>
          )}

          {canAccessAnalytics && (
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shrink-0 ${
                activeTab === 'analytics'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Google Analytics 4, Événements, Heatmaps & Recherche"
            >
              <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Analytics</span>
            </button>
          )}

          {canAccessUsers && (
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shrink-0 ${
                activeTab === 'users'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Sécurité Admin & Gestion des Accès"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Sécurité</span>
            </button>
          )}
        </div>
      </header>

      

      {/* Main Admin Content Container */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6">
        {/* ============================================================== */}
        {/* TAB 1: STOCKS & IMPORT EXCEL POS                                */}
        {/* ============================================================== */}
        {activeTab === 'stocks' && (
          <div className="space-y-5">
            {/* Quick Actions & Excel POS Box */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Import Excel POS Card */}
              <div className="lg:col-span-2 bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Synchronisation Automatique Logiciel de Caisse POS
                      </h3>
                      <p className="text-xs text-slate-400">
                        Glissez votre fichier Excel (.xlsx ou .csv) exporté de votre caisse
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadSampleExcelTemplate}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Modèle Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => exportCatalogToExcel(products)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Exporter Catalogue</span>
                    </button>
                  </div>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 rounded-xl p-6 text-center cursor-pointer bg-emerald-950/20 hover:bg-emerald-950/30 transition flex flex-col items-center justify-center"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {isExcelProcessing ? (
                    <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                  ) : (
                    <FileSpreadsheet className="w-8 h-8 text-emerald-400 mb-2" />
                  )}

                  <span className="text-xs font-bold text-white">
                    Cliquez ou glissez l'export Excel de votre caisse ici
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    L'Agent IA détectera automatiquement les extraits et proposera de générer leurs photos studio
                  </span>
                </div>

                {excelSuccess && (
                  <div className="mt-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{excelSuccess}</span>
                  </div>
                )}

                {excelError && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{excelError}</span>
                  </div>
                )}
              </div>

              {/* Summary Stats Card */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Aperçu de l'Inventaire
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[11px] text-amber-400 font-semibold block">Extraits (g)</span>
                      <span className="text-xl font-extrabold text-white">
                        {products.filter((p) => p.family === 'Extrait').length}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[11px] text-indigo-400 font-semibold block">Flacons</span>
                      <span className="text-xl font-extrabold text-white">
                        {products.filter((p) => p.family === 'Flacon').length}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[11px] text-emerald-400 font-semibold block">En Stock</span>
                      <span className="text-xl font-extrabold text-white">
                        {products.filter((p) => p.stock > 0).length}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[11px] text-rose-400 font-semibold block">En Rupture</span>
                      <span className="text-xl font-extrabold text-white">
                        {products.filter((p) => p.stock <= 0).length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <span className="text-xs text-slate-400 block">Valeur estimée du stock :</span>
                  <span className="text-lg font-extrabold text-amber-400">
                    {formatDZD(products.reduce((s, p) => s + p.priceDA * p.stock, 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Inventory Table with Fast Inline Edit */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/50">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    placeholder="Rechercher par référence, désignation..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStockFamilyFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      stockFamilyFilter === 'all'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFamilyFilter('Extrait')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      stockFamilyFilter === 'Extrait'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Extraits
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFamilyFilter('Flacon')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      stockFamilyFilter === 'Flacon'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Flacons
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFamilyFilter('Accessoire')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      stockFamilyFilter === 'Accessoire'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Accessoires
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Réf.</th>
                      <th className="p-3">Désignation</th>
                      <th className="p-3">Famille</th>
                      <th className="p-3">Prix Unitaire (DA)</th>
                      <th className="p-3">Quantité en Stock</th>
                      <th className="p-3 text-center">Photo</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredProducts.map((prod) => {
                      const currentStockVal =
                        editedStock[prod.id] !== undefined ? editedStock[prod.id] : prod.stock;
                      const currentPriceVal =
                        editedPrices[prod.id] !== undefined ? editedPrices[prod.id] : prod.priceDA;
                      const isSaved = savedRowId === prod.id;

                      return (
                        <tr key={prod.id} className="hover:bg-slate-900/40 transition">
                          <td className="p-3 font-mono text-slate-400 font-medium">
                            {prod.code}
                          </td>
                          <td className="p-3 font-bold text-white max-w-xs truncate">
                            {prod.name}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                prod.family === 'Extrait'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : prod.family === 'Accessoire'
                                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              }`}
                            >
                              {prod.family}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={currentPriceVal}
                                onChange={(e) =>
                                  setEditedPrices({
                                    ...editedPrices,
                                    [prod.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  })
                                }
                                className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-right font-bold text-amber-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                              />
                              <span className="text-[10px] text-slate-400">DA</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                value={currentStockVal}
                                onChange={(e) =>
                                  setEditedStock({
                                    ...editedStock,
                                    [prod.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  })
                                }
                                className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-right font-bold text-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                              />
                              <span className="text-[10px] text-slate-400">{prod.unit}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {prod.imageUrl || prod.family === 'Extrait' ? (
                              <img
                                src={prod.imageUrl || (prod.family === 'Extrait' ? '/tulip-extrait-default.jpg' : 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600')}
                                alt={prod.name}
                                className="w-8 h-8 rounded-md object-cover mx-auto border border-slate-700"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="text-slate-600 text-[10px]">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 ml-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateSingleStock(prod.id, currentStockVal, currentPriceVal);
                                  setSavedRowId(prod.id);
                                  setTimeout(() => setSavedRowId(null), 1500);
                                }}
                                className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                                  isSaved
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                }`}
                              >
                                {isSaved ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    Sauvegardé
                                  </>
                                ) : (
                                  'Enregistrer'
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setIrreversibleConfirm({
                                    isOpen: true,
                                    title: `Supprimer Définitivement "${prod.name}"`,
                                    description: `Attention : Cette action est irréversible (Can't undo) et écrasera immédiatement la base de données. L'extrait sera définitivement retiré du catalogue.`,
                                    details: `Réf: ${prod.code} • Famille: ${prod.family} • Stock: ${prod.stock}`,
                                    confirmLabel: 'Supprimer définitivement (Réécrire DB)',
                                    onConfirm: () => {
                                      if (onDeleteProduct) {
                                        onDeleteProduct(prod.id);
                                      } else {
                                        onUpdateProducts(products.filter((p) => p.id !== prod.id));
                                      }
                                      setIrreversibleConfirm((prev) => ({ ...prev, isOpen: false }));
                                    },
                                  });
                                }}
                                className="p-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-400 hover:text-white border border-rose-800/80 transition cursor-pointer"
                                title="Supprimer définitivement cet article (Irréversible - Réécriture DB)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB FLACONS: GESTION MANUELLE DES FLACONS & EMBALLAGES         */}
        {/* ============================================================== */}
        {activeTab === 'flacons' && (
          <AdminFlaconManagement
            products={products}
            onAddFlacon={onAddProduct}
            onUpdateFlacon={onUpdateProduct}
            onDeleteFlacon={onDeleteProduct}
            onUpdateProducts={onUpdateProducts}
          />
        )}

        {/* ============================================================== */}
        {/* TAB ACCESSOIRES: GESTION MANUELLE DES ACCESSOIRES & OUTILS    */}
        {/* ============================================================== */}
        {activeTab === 'accessories' && (
          <AdminAccessoryManagement
            products={products}
            onAddAccessory={onAddProduct}
            onUpdateAccessory={onUpdateProduct}
            onDeleteAccessory={onDeleteProduct}
            onUpdateProducts={onUpdateProducts}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 2: COMMANDES & BONS REÇUS                                   */}
        {/* ============================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-amber-400" />
                  Bons de Précommande Reçus ({orders.length})
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-400">
                    Consultez, imprimez ou mettez à jour le statut des précommandes des 58 Wilayas
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsTelegramModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[11px] font-semibold border border-sky-500/30 transition cursor-pointer"
                    title="Gérer les notifications du Bot Telegram (@tulip5661bot)"
                  >
                    <Send className="w-2.5 h-2.5 text-sky-400" />
                    <span>Bot Telegram : @tulip5661bot</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Rechercher par n° bon, client, tél..."
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />

                <select
                  value={orderTypeFilter}
                  onChange={(e) => setOrderTypeFilter(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-medium"
                >
                  <option value="all">Tous types</option>
                  <option value="preorder">Précommandes uniquement</option>
                  <option value="proforma">Proformas uniquement</option>
                </select>

                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="en_attente">En attente</option>
                  <option value="confirmee">Confirmée</option>
                  <option value="en_preparation">En préparation</option>
                  <option value="livree">Livrée</option>
                  <option value="annulee">Annulée</option>
                </select>

                {selectedOrderIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIrreversibleConfirm({
                        isOpen: true,
                        title: `Supprimer Définitivement ${selectedOrderIds.length} Commande(s) Sélectionnée(s)`,
                        description: `Attention : Cette action est irréversible (Can't undo) et écrasera immédiatement la base de données. ${selectedOrderIds.length} précommandes seront définitivement purgées du serveur et leur stock sera réintégré.`,
                        details: `Total sélectionné : ${selectedOrderIds.length} commande(s)`,
                        confirmLabel: `Supprimer définitivement (${selectedOrderIds.length})`,
                        onConfirm: () => {
                          if (onBulkDeleteOrders) {
                            onBulkDeleteOrders(selectedOrderIds);
                          } else if (onDeleteOrder) {
                            selectedOrderIds.forEach((id) => onDeleteOrder(id));
                          }
                          setSelectedOrderIds([]);
                          setIrreversibleConfirm((prev) => ({ ...prev, isOpen: false }));
                        },
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer animate-pulse"
                    title="Supprimer définitivement les commandes cochées (Irréversible - Réécriture DB)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer ({selectedOrderIds.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const cutoff = Date.now() - 96 * 60 * 60 * 1000;
                    const oldOrders = orders.filter((o) => {
                      const t = new Date(o.date).getTime();
                      return !isNaN(t) && t < cutoff;
                    });

                    if (oldOrders.length === 0) {
                      alert("Aucune précommande de plus de 96 heures trouvée. Toutes les précommandes dans le système sont récentes (< 96 heures).");
                      return;
                    }

                    const keptOrders = orders.filter((o) => {
                      const t = new Date(o.date).getTime();
                      return isNaN(t) || t >= cutoff;
                    });

                    setIrreversibleConfirm({
                      isOpen: true,
                      title: `Nettoyage et Purge Automatique (+96h)`,
                      description: `Attention : Cette action est irréversible (Can't undo) et écrasera immédiatement la base de données. ${oldOrders.length} commande(s) de plus de 96 heures seront définitivement supprimées du serveur.`,
                      details: `Purge : ${oldOrders.length} anciennes commandes • Conservation : ${keptOrders.length} commandes récentes`,
                      confirmLabel: `Purger définitivement (${oldOrders.length})`,
                      onConfirm: () => {
                        if (onUpdateOrders) {
                          onUpdateOrders(keptOrders);
                        } else if (onClearOldOrders) {
                          onClearOldOrders();
                        }
                        setIrreversibleConfirm((prev) => ({ ...prev, isOpen: false }));
                      },
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/80 font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                  title="Nettoyer les précommandes reçues il y a plus de 96 heures (conserve les 4 derniers jours)"
                >
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  <span>Purger (+96h)</span>
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {filteredOrders.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  Aucune précommande trouvée dans cette catégorie.
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-3 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrderIds(filteredOrders.map((o) => o.id));
                              } else {
                                setSelectedOrderIds([]);
                              }
                            }}
                            className="rounded bg-slate-800 border-slate-700 text-rose-600 focus:ring-rose-500 cursor-pointer"
                            title="Tout sélectionner / désélectionner"
                          />
                        </th>
                        <th className="p-3">Réf. Bon & Type</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Client</th>
                        <th className="p-3">Wilaya & Mode</th>
                        <th className="p-3 text-right">Total (DA)</th>
                        <th className="p-3">Statut</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredOrders.map((ord) => (
                        <tr key={ord.id} className={`hover:bg-slate-900/40 transition ${selectedOrderIds.includes(ord.id) ? 'bg-rose-950/20' : ''}`}>
                          <td className="p-3 w-8 text-center">
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.includes(ord.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedOrderIds((prev) => [...prev, ord.id]);
                                } else {
                                  setSelectedOrderIds((prev) => prev.filter((id) => id !== ord.id));
                                }
                              }}
                              className="rounded bg-slate-800 border-slate-700 text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-400">
                            <div className="flex flex-col gap-1">
                              <span>{ord.orderNumber}</span>
                              {ord.isProforma || (ord.orderNumber && ord.orderNumber.startsWith('PRO-')) ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase tracking-wider w-fit">
                                  📄 Proforma
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider w-fit">
                                  🛒 Précommande
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-400">
                            {new Date(ord.date).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-white block">{ord.customer?.fullName || 'Client'}</span>
                            <span className="text-[11px] text-slate-400 block font-mono">
                              {ord.customer?.phone || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-white font-medium block">
                              {(ord.customer?.wilayaCode || ord.customer?.wilayaName) ? `${ord.customer.wilayaCode || ''} - ${ord.customer.wilayaName || ''}` : '-'}
                            </span>
                            <span className="text-[10px] text-slate-400 block capitalize">
                              {ord.customer?.deliveryMode === 'domicile'
                                ? 'À Domicile'
                                : ord.customer?.deliveryMode === 'stop_desk'
                                ? 'Bureau Stop-Desk'
                                : 'Retrait Magasin'}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-white">
                            {formatDZD(ord.totalDA)}
                          </td>
                          <td className="p-3">
                            <select
                              value={ord.status}
                              onChange={(e) =>
                                onUpdateOrderStatus(ord.id, e.target.value as PreOrder['status'])
                              }
                              className={`text-[11px] font-bold px-2 py-1 rounded-md border ${
                                ord.status === 'confirmee'
                                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                  : ord.status === 'en_preparation'
                                  ? 'bg-amber-950 text-amber-400 border-amber-800'
                                  : ord.status === 'livree'
                                  ? 'bg-blue-950 text-blue-400 border-blue-800'
                                  : ord.status === 'annulee'
                                  ? 'bg-rose-950 text-rose-400 border-rose-800'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              <option value="en_attente">En attente</option>
                              <option value="confirmee">Confirmée</option>
                              <option value="en_preparation">En préparation</option>
                              <option value="livree">Livrée</option>
                              <option value="annulee">Annulée</option>
                            </select>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Contact */}
                              {ord.customer?.phone && (
                                <a
                                  href={`https://wa.me/213${ord.customer.phone.replace(/^0/, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-200 border border-emerald-500/30 transition flex items-center justify-center"
                                  title="Contacter sur WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* Telegram Transfer */}
                              <button
                                type="button"
                                onClick={() => sendOrderToTelegram(ord, storeSettings, storeSettings.telegramPhone || '+213799938399')}
                                className="p-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 hover:text-sky-200 border border-sky-500/30 transition"
                                title={`Transférer sur Telegram (${storeSettings.telegramPhone || '+213799938399'})`}
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => downloadOrderPDF(ord, storeSettings)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                                title="Télécharger le Bon PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => printOrderPDF(ord, storeSettings)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                                title="Imprimer le Bon"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Order with irreversible rewrite */}
                              <button
                                type="button"
                                onClick={() => {
                                  setIrreversibleConfirm({
                                    isOpen: true,
                                    title: `Supprimer Définitivement le Bon ${ord.orderNumber}`,
                                    description: `Attention : Cette action est irréversible (Can't undo) et écrasera immédiatement la base de données. La commande de ${ord.customer?.fullName || 'Client'} (${formatDZD(ord.totalDA)}) sera définitivement supprimée du serveur et le stock des articles sera réintégré.`,
                                    details: `N° Bon: ${ord.orderNumber} • Client: ${ord.customer?.fullName || 'Client'} (${ord.customer?.phone || ''}) • Montant: ${formatDZD(ord.totalDA)}`,
                                    confirmLabel: 'Supprimer définitivement (Réécrire DB)',
                                    onConfirm: () => {
                                      if (onDeleteOrder) onDeleteOrder(ord.id);
                                      setIrreversibleConfirm((prev) => ({ ...prev, isOpen: false }));
                                    },
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 hover:text-white border border-rose-800/80 transition cursor-pointer"
                                title="Supprimer définitivement ce bon (Irréversible - Réécriture DB)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: UTILISATEURS & SÉCURITÉ DU SITE (SAUVEGARDE & RESTAURATION) */}
        {/* ============================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* MASTER WEBSITE DATA BACKUP & RESTORATION (ADMIN ONLY) */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600"></div>

              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">
                        Sauvegarde & Restauration Intégrale du Site
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Admin Uniquement
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Exportez ou importez l'intégralité des données du site (Produits, Commandes, Clients Pro, Demandes d'accès, Paramètres, Bannières).
                    </p>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                    <span className="font-bold text-amber-400">{products.length}</span> Produits
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                    <span className="font-bold text-blue-400">{orders.length}</span> Commandes
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                    <span className="font-bold text-emerald-400">{customerUsers.length}</span> Clients
                  </div>
                </div>
              </div>

              {!isSuperAdmin ? (
                <div className="py-6 text-center space-y-2">
                  <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto opacity-75" />
                  <p className="text-xs font-semibold text-rose-300">
                    Accès Restreint : Seul l'Administrateur Principal peut exporter ou importer les données intégrales du site web.
                  </p>
                </div>
              ) : (
                <div className="pt-5 space-y-6">
                  {/* Notifications */}
                  {backupExportStatus && (
                    <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{backupExportStatus}</span>
                    </div>
                  )}

                  {backupImportSuccess && (
                    <div className="p-3.5 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span className="font-medium">{backupImportSuccess}</span>
                    </div>
                  )}

                  {backupImportError && (
                    <div className="p-3.5 bg-rose-950/70 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{backupImportError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Column 1: EXPORTER LES DONNÉES */}
                    <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3.5 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                          <HardDriveDownload className="w-4 h-4" />
                          <span>1. Exporter Toutes les Données du Site</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Générez une sauvegarde complète immédiate de votre catalogue, commandes et comptes clients en format JSON ou Excel multi-feuilles.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={handleExportAllDataJSON}
                          className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                        >
                          <FileJson className="w-4 h-4" />
                          <span>Sauvegarde JSON</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleExportAllDataExcel}
                          className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                          <span>Classeur Excel (.xlsx)</span>
                        </button>
                      </div>
                    </div>

                    {/* Column 2: IMPORTER LES DONNÉES */}
                    <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3.5 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                          <HardDriveUpload className="w-4 h-4" />
                          <span>2. Importer & Restaurer les Données</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Restaurez les données du site à partir d'un fichier .JSON de sauvegarde ou d'un classeur .XLSX contenant vos produits et clients.
                        </p>
                      </div>

                      <div>
                        <label className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-700 hover:border-amber-400 bg-slate-950/60 text-slate-300 hover:text-white font-medium text-xs transition cursor-pointer flex items-center justify-center gap-2">
                          <UploadCloud className="w-4 h-4 text-amber-400" />
                          <span>Sélectionner Fichier (.JSON / .XLSX)</span>
                          <input
                            type="file"
                            accept=".json, .xlsx, .xls"
                            onChange={handleBackupFileSelect}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* SUPABASE CLOUD DATABASE INTEGRATION STATUS & CONTROL */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-emerald-950/20 to-slate-900/90 border border-emerald-500/30 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                          <Database className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">Stockage Cloud Supabase (Données & Logins)</h4>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Stockage persistant pour les comptes, mots de passe, commandes, sécurité et produits.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={refreshSupabaseStatus}
                          disabled={supabaseStatus.loading}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${supabaseStatus.loading ? 'animate-spin' : ''}`} />
                          <span>Tester Connexion</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleManualSupabaseSync}
                          disabled={supabaseSyncing}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
                        >
                          <UploadCloud className={`w-3.5 h-3.5 ${supabaseSyncing ? 'animate-bounce' : ''}`} />
                          <span>{supabaseSyncing ? 'Synchronisation...' : 'Pousser vers Supabase'}</span>
                        </button>
                      </div>
                    </div>

                    {supabaseSyncMsg && (
                      <div
                        className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
                          supabaseSyncMsg.type === 'success'
                            ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300'
                            : 'bg-rose-950/70 border border-rose-800 text-rose-300'
                        }`}
                      >
                        {supabaseSyncMsg.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                        )}
                        <span>{supabaseSyncMsg.text}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                        <div className="text-[11px] text-slate-400 font-medium">État Variables d'Environnement</div>
                        <div className="font-bold flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              supabaseStatus.configured ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                          />
                          <span className={supabaseStatus.configured ? 'text-emerald-300' : 'text-amber-300'}>
                            {supabaseStatus.configured ? 'SUPABASE_URL Configuré' : 'En attente des clés Vercel'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                        <div className="text-[11px] text-slate-400 font-medium">Connexion Supabase Cloud</div>
                        <div className="font-bold flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              supabaseStatus.connected ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          <span className={supabaseStatus.connected ? 'text-emerald-300' : 'text-slate-400'}>
                            {supabaseStatus.connected ? 'Connecté avec succès' : 'Cliquez sur Tester Connexion'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                        <div className="text-[11px] text-slate-400 font-medium">Guide Déploiement Vercel</div>
                        <div className="text-slate-300 text-[11px]">
                          Fichier SQL inclus : <span className="font-mono text-emerald-400">supabase-schema.sql</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* VERCEL BLOB STORAGE - CLOUD BACKUPS & MEDIA EXPORT / IMPORT */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-rose-950/20 to-slate-900/90 border border-rose-500/30 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                          <Database className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">Stockage Cloud Vercel Blob (Sauvegardes & Médias)</h4>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Sauvegardes centralisées et hébergement optimisé des médias pour Tulip Fragrance Company.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleExportToBlob}
                          disabled={blobExporting}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${blobExporting ? 'animate-spin' : ''}`} />
                          <span>{blobExporting ? 'Sauvegarde en cours...' : 'Créer Sauvegarde Cloud'}</span>
                        </button>
                      </div>
                    </div>

                    {blobExportResult && (
                      <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Sauvegarde créée avec succès sur Vercel Blob !</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[10px] break-all select-all flex items-center justify-between">
                          <span>{blobExportResult.url}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Conservez cette URL pour restaurer ou copier l'état du site sur un autre appareil à tout moment.
                        </p>
                      </div>
                    )}

                    {blobExportError && (
                      <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span>{blobExportError}</span>
                      </div>
                    )}

                    {/* Vercel Blob Import Box */}
                    <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-850 space-y-3">
                      <label className="block text-xs font-bold text-slate-300">
                        Restaurer / Importer une Sauvegarde Cloud Tulip
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="url"
                          value={blobImportUrl}
                          onChange={(e) => setBlobImportUrl(e.target.value)}
                          placeholder="Collez l'URL Vercel Blob de votre fichier de sauvegarde .json"
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
                        />
                        <button
                          type="button"
                          onClick={handleImportFromBlob}
                          disabled={blobImporting}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <HardDriveDownload className={`w-3.5 h-3.5 text-rose-400 ${blobImporting ? 'animate-bounce' : ''}`} />
                          <span>{blobImporting ? 'Restauration...' : 'Restaurer'}</span>
                        </button>
                      </div>

                      {blobImportMsg && (
                        <div
                          className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
                            blobImportMsg.type === 'success'
                              ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300'
                              : 'bg-rose-950/70 border border-rose-800 text-rose-300'
                          }`}
                        >
                          {blobImportMsg.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400" />
                          )}
                          <span>{blobImportMsg.text}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PENDING RESTORATION CONFIRMATION CARD */}
                  {pendingBackupData && (
                    <div className="p-4 sm:p-5 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-4 animate-in fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-500/20">
                        <div className="flex items-center gap-2">
                          <FileArchive className="w-5 h-5 text-amber-400" />
                          <div>
                            <h4 className="text-xs font-bold text-white">
                              Fichier prêt pour la restauration : <span className="text-amber-300 font-mono">{pendingBackupData.sourceFileName}</span>
                            </h4>
                            {pendingBackupData.exportDate && (
                              <p className="text-[11px] text-slate-400">
                                Date d'export : {new Date(pendingBackupData.exportDate).toLocaleString('fr-FR')}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPendingBackupData(null)}
                          className="text-xs text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>

                      {/* Content detected */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Produits détectés</span>
                          <span className="font-bold text-amber-400 text-sm">
                            {pendingBackupData.products?.length || 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Commandes détectées</span>
                          <span className="font-bold text-blue-400 text-sm">
                            {pendingBackupData.orders?.length || 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Clients Pro détectés</span>
                          <span className="font-bold text-emerald-400 text-sm">
                            {pendingBackupData.customerUsers?.length || 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Bannières / Demandes</span>
                          <span className="font-bold text-purple-400 text-sm">
                            {(pendingBackupData.adBanners?.length || 0) + (pendingBackupData.customerApplications?.length || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Mode selection */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-300">
                          Mode d'application de la restauration :
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <label className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                            importMode === 'replace'
                              ? 'bg-amber-500/10 border-amber-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}>
                            <input
                              type="radio"
                              name="importMode"
                              checked={importMode === 'replace'}
                              onChange={() => setImportMode('replace')}
                              className="mt-0.5 accent-amber-500"
                            />
                            <div>
                              <span className="font-bold block text-amber-300">Écraser et Remplacer (Recommandé)</span>
                              <span className="text-[11px] text-slate-400 block">
                                Remplace les données actuelles par celles du fichier de sauvegarde.
                              </span>
                            </div>
                          </label>

                          <label className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                            importMode === 'merge'
                              ? 'bg-amber-500/10 border-amber-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}>
                            <input
                              type="radio"
                              name="importMode"
                              checked={importMode === 'merge'}
                              onChange={() => setImportMode('merge')}
                              className="mt-0.5 accent-amber-500"
                            />
                            <div>
                              <span className="font-bold block text-emerald-300">Fusionner sans écraser</span>
                              <span className="text-[11px] text-slate-400 block">
                                Ajoute les nouveaux enregistrements en conservant ceux déjà existants.
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Final Confirm Button */}
                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setPendingBackupData(null)}
                          className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800 transition cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyRestoration}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg transition cursor-pointer flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>Confirmer et Restaurer Toutes les Données</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Box 1: Changer de mot de passe */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Changer mon Mot de Passe</h3>
                  <p className="text-xs text-slate-400">
                    Compte connecté : <strong>{currentUser.username}</strong> ({currentUser.fullName})
                  </p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Ancien mot de passe
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    placeholder="Entrez votre mot de passe actuel"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Nouveau mot de passe sécurisé"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Confirmer le nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Retapez le nouveau mot de passe"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {passwordMsg && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      passwordMsg.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/60 border-rose-800 text-rose-300'
                    }`}
                  >
                    {passwordMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Mettre à jour mon mot de passe
                </button>
              </form>
            </div>

            {/* Box 2: Ajouter un Utilisateur */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Ajouter un Nouvel Utilisateur</h3>
                  <p className="text-xs text-slate-400">
                    Créez un accès pour un autre gestionnaire ou préparateur de commandes
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddUser} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Identifiant (Username)
                    </label>
                    <input
                      type="text"
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                      required
                      placeholder="ex: chakib"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nom Complet
                    </label>
                    <input
                      type="text"
                      value={newUserFullName}
                      onChange={(e) => setNewUserFullName(e.target.value)}
                      required
                      placeholder="ex: Chakib Amine"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Rôle d'accès
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'manager')}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="manager">Gestionnaire (Accès Limité)</option>
                      <option value="admin">Administrateur (Plein Accès)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Mot de passe initial
                    </label>
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      required
                      placeholder="Mot de passe"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Manager Permissions Selector */}
                {newUserRole === 'manager' && (
                  <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" />
                        Permissions attribuées au Gestionnaire
                      </span>
                      <span className="text-[10px] text-slate-400">Contrôle d'accès</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newUserPermissions.canManageProducts}
                          onChange={(e) =>
                            setNewUserPermissions({ ...newUserPermissions, canManageProducts: e.target.checked })
                          }
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span>Gestion des Stocks & Flacons</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newUserPermissions.canManageOrders}
                          onChange={(e) =>
                            setNewUserPermissions({ ...newUserPermissions, canManageOrders: e.target.checked })
                          }
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span>Gestion des Commandes & Bons</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newUserPermissions.canManageCustomers}
                          onChange={(e) =>
                            setNewUserPermissions({ ...newUserPermissions, canManageCustomers: e.target.checked })
                          }
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span>Accès Clients & Tarifs Professionnels</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newUserPermissions.canManageBanners}
                          onChange={(e) =>
                            setNewUserPermissions({ ...newUserPermissions, canManageBanners: e.target.checked })
                          }
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span>Gestion des Popups Publicitaires</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none p-2 rounded-lg bg-rose-950/30 border border-rose-800/40">
                        <input
                          type="checkbox"
                          checked={newUserPermissions.canViewAnalytics}
                          onChange={(e) =>
                            setNewUserPermissions({ ...newUserPermissions, canViewAnalytics: e.target.checked })
                          }
                          className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                        />
                        <span className="font-semibold text-rose-300">
                          Accès Analytics (GA4, Événements, Heatmaps, Recherche)
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {userMsg && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      userMsg.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/60 border-rose-800 text-rose-300'
                    }`}
                  >
                    {userMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{userMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Créer le Compte Utilisateur</span>
                </button>
              </form>
            </div>

            {/* Full Width Box 3: Liste des Utilisateurs */}
            <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Comptes Utilisateurs Enregistrés ({users.length})</span>
              </h3>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Identifiant</th>
                      <th className="p-3">Nom Complet</th>
                      <th className="p-3">Rôle & Permissions</th>
                      <th className="p-3">Date de création</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {users.map((u) => {
                      const perms = u.permissions || {
                        canManageProducts: true,
                        canManageOrders: true,
                        canManageCustomers: true,
                        canManageBanners: false,
                        canViewAnalytics: false,
                      };
                      return (
                        <tr key={u.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-mono font-bold text-amber-400">
                            @{u.username}
                          </td>
                          <td className="p-3 font-medium text-white">{u.fullName}</td>
                          <td className="p-3 space-y-1.5">
                            <div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                                  u.role === 'admin'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {u.role === 'admin' ? 'Administrateur' : 'Gestionnaire'}
                              </span>
                            </div>
                            {u.role === 'manager' && (
                              <div className="flex flex-wrap gap-1 text-[9px]">
                                <button
                                  type="button"
                                  onClick={() => handleToggleManagerPermission(u.id, 'canManageProducts')}
                                  className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                    perms.canManageProducts
                                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                                      : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                                  }`}
                                  title="Cliquer pour activer/désactiver Stocks & Flacons"
                                >
                                  Stocks
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleManagerPermission(u.id, 'canManageOrders')}
                                  className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                    perms.canManageOrders
                                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                                      : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                                  }`}
                                  title="Cliquer pour activer/désactiver Commandes"
                                >
                                  Commandes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleManagerPermission(u.id, 'canManageCustomers')}
                                  className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                    perms.canManageCustomers
                                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                                      : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                                  }`}
                                  title="Cliquer pour activer/désactiver Clients Pro"
                                >
                                  Clients Pro
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleManagerPermission(u.id, 'canManageBanners')}
                                  className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                    perms.canManageBanners
                                      ? 'bg-purple-950/60 text-purple-300 border-purple-700/50'
                                      : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                                  }`}
                                  title="Cliquer pour activer/désactiver Popups"
                                >
                                  Popups
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleManagerPermission(u.id, 'canViewAnalytics')}
                                  className={`px-1.5 py-0.5 rounded border transition cursor-pointer font-bold ${
                                    perms.canViewAnalytics
                                      ? 'bg-rose-950/80 text-rose-300 border-rose-600'
                                      : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60'
                                  }`}
                                  title="Cliquer pour autoriser/bloquer l'accès Analytics"
                                >
                                  {perms.canViewAnalytics ? '✓ Analytics' : '✗ Analytics'}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="p-3 text-right">
                            {u.id !== currentUser.id ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-white transition"
                                title="Supprimer l'utilisateur"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                (Compte Actif)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: ACCÈS CLIENTS & TARIFS PRO                               */}
        {/* ============================================================== */}
        {activeTab === 'customers' && canAccessCustomers && (
          <AdminCustomerManagement
            applications={customerApplications}
            customerUsers={customerUsers}
            onApproveApplication={onApproveApplication || (() => {})}
            onRejectApplication={onRejectApplication || (() => {})}
            onDeleteApplication={onDeleteApplication}
            onToggleCustomerActive={onToggleCustomerActive || (() => {})}
            onDeleteCustomer={onDeleteCustomer || (() => {})}
            onUpdateCustomer={onUpdateCustomer}
            onResetCustomerPassword={onResetCustomerPassword || (() => {})}
            onCreateCustomer={onCreateCustomer || (() => {})}
            onImportCustomers={onImportCustomers}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 5: GESTION DU POPUP PUBLICITAIRE                            */}
        {/* ============================================================== */}
        {activeTab === 'ads' && canAccessAds && (
          <AdminAdPopupManagement
            banners={adBanners}
            products={products}
            onAddBanner={onAddAdBanner || (() => {})}
            onToggleBannerActive={onToggleAdBanner || (() => {})}
            onDeleteBanner={onDeleteAdBanner || (() => {})}
            onPreviewBanner={onPreviewAdBanner || (() => {})}
            isPopupEnabled={isAdPopupEnabled}
            onTogglePopupEnabled={onToggleAdPopupEnabled || (() => {})}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 6: ANALYTICS & AUDIENCE (GA4, Events, Heatmaps, Search)   */}
        {/* ============================================================== */}
        {activeTab === 'analytics' && canAccessAnalytics && (
          <AdminAnalytics isAdmin={isSuperAdmin} />
        )}
      </main>

      {/* Admin Telegram Notifications Settings Modal */}
      <AdminTelegramModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        storeSettings={storeSettings}
        onUpdateSettings={onUpdateSettings}
      />

      {/* Global Irreversible Confirmation Modal (Can't undo - Direct DB rewrite) */}
      <IrreversibleConfirmModal
        isOpen={irreversibleConfirm.isOpen}
        title={irreversibleConfirm.title}
        description={irreversibleConfirm.description}
        details={irreversibleConfirm.details}
        confirmLabel={irreversibleConfirm.confirmLabel || 'Confirmer la suppression définitive'}
        onConfirm={irreversibleConfirm.onConfirm}
        onCancel={() => setIrreversibleConfirm((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
