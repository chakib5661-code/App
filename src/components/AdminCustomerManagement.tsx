import React, { useState } from 'react';
import {
  UserCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  KeyRound,
  Copy,
  Check,
  UserPlus,
  Shield,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  Calendar,
  Lock,
  Unlock,
  Send,
  MessageSquare,
  MessageCircle,
  Download,
  Upload,
  FileSpreadsheet,
  Database,
  RefreshCw,
} from 'lucide-react';
import { CustomerApplication, CustomerUser } from '../types';
import { ALGERIAN_WILAYAS } from '../data/wilayas';
import { AlgerianPhoneInput } from './AlgerianPhoneInput';
import { toAlgerianWhatsAppPhone, normalizeAlgerianPhone } from '../utils/phoneUtils';
import {
  exportCustomersToExcel,
  exportCustomersToJSON,
  downloadCustomerImportTemplate,
  parseCustomerImportFile,
  CustomerImportResult,
} from '../utils/customerDataSync';
import { IrreversibleConfirmModal } from './IrreversibleConfirmModal';

interface AdminCustomerManagementProps {
  applications: CustomerApplication[];
  customerUsers: CustomerUser[];
  onApproveApplication: (applicationId: string, assignedUsername: string, assignedPassword: string, verificationNotes?: string) => void;
  onRejectApplication: (applicationId: string) => void;
  onDeleteApplication?: (applicationId: string) => void;
  onToggleCustomerActive: (customerId: string) => void;
  onDeleteCustomer: (customerId: string) => void;
  onUpdateCustomer?: (customerId: string, updatedFields: Partial<CustomerUser>) => void;
  onResetCustomerPassword: (customerId: string, newPassword: string) => void;
  onCreateCustomer: (customer: Omit<CustomerUser, 'id' | 'createdAt'>) => void;
  onImportCustomers?: (customers: CustomerUser[], replaceExisting?: boolean) => void;
}

export const AdminCustomerManagement: React.FC<AdminCustomerManagementProps> = ({
  applications,
  customerUsers,
  onApproveApplication,
  onRejectApplication,
  onDeleteApplication,
  onToggleCustomerActive,
  onDeleteCustomer,
  onUpdateCustomer,
  onResetCustomerPassword,
  onCreateCustomer,
  onImportCustomers,
}) => {
  const [subTab, setSubTab] = useState<'applications' | 'active_users' | 'create_user' | 'import_export'>('applications');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // Global Irreversible Action Confirmation Modal (Can't undo - Database Rewrite)
  const [irreversibleModal, setIrreversibleModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    details?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // Import / Export State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<CustomerImportResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Approval Modal State
  const [selectedAppForApproval, setSelectedAppForApproval] = useState<CustomerApplication | null>(null);
  const [assignedUsername, setAssignedUsername] = useState('');
  const [assignedPassword, setAssignedPassword] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState<CustomerUser | null>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustCompany, setEditCustCompany] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustSecPhone, setEditCustSecPhone] = useState('');
  const [editCustEmail, setEditCustEmail] = useState('');
  const [editCustWilayaCode, setEditCustWilayaCode] = useState('16');
  const [editCustCommune, setEditCustCommune] = useState('');
  const [editCustAddress, setEditCustAddress] = useState('');
  const [editCustUsername, setEditCustUsername] = useState('');
  const [editCustPassword, setEditCustPassword] = useState('');

  const handleStartEditCustomer = (cust: CustomerUser) => {
    setEditingCustomer(cust);
    setEditCustName(cust.fullName || '');
    setEditCustCompany(cust.companyName || '');
    setEditCustPhone(cust.phone || '');
    setEditCustSecPhone(cust.secondaryPhone || '');
    setEditCustEmail(cust.email || '');
    setEditCustWilayaCode(cust.wilayaCode || '16');
    setEditCustCommune(cust.commune || '');
    setEditCustAddress(cust.deliveryAddress || '');
    setEditCustUsername(cust.username || '');
    setEditCustPassword(cust.password || '');
  };

  // New Direct Customer Form
  const [newCustName, setNewCustName] = useState('');
  const [newCustCompany, setNewCustCompany] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustWilayaCode, setNewCustWilayaCode] = useState('16');
  const [newCustCommune, setNewCustCommune] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustUsername, setNewCustUsername] = useState('');
  const [newCustPassword, setNewCustPassword] = useState('tulip2026');
  const [directCreateMsg, setDirectCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastCreatedUser, setLastCreatedUser] = useState<{ fullName: string; phone: string; username: string; password: string; companyName?: string } | null>(null);

  // WhatsApp Login Info Sender Helper (+213 Algeria Default)
  const generateWhatsAppLoginUrl = (
    phone: string,
    fullName: string,
    companyName: string | undefined,
    username: string,
    password?: string
  ) => {
    const cleanPhone = toAlgerianWhatsAppPhone(phone);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tulip-fragrance.dz';
    const effectivePassword = password || 'tulip2026';

    const text =
      `🌸 *TULIP FRAGRANCE COMPANY - ACCÈS PROFESSIONNEL B2B*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Bonjour *${fullName}*${companyName ? ` (${companyName})` : ''},\n\n` +
      `Votre compte professionnel Tulip Fragrance a été validé avec succès ! Vous avez désormais un accès complet aux tarifs de gros et au passage de précommandes directes.\n\n` +
      `🔑 *Vos identifiants d'accès :*\n` +
      `• *Nom d'utilisateur :* ${username}\n` +
      `• *Mot de passe :* ${effectivePassword}\n\n` +
      `🌐 *Lien d'accès à la plateforme :*\n${origin}\n\n` +
      `📱 *Service Commercial Tulip :* 07 99 93 83 99\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const handleSendWhatsAppLogin = (
    phone: string,
    fullName: string,
    companyName: string | undefined,
    username: string,
    password?: string
  ) => {
    const url = generateWhatsAppLoginUrl(phone, fullName, companyName, username, password);
    window.open(url, '_blank');
  };

  // Password visibility map for active users table
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Reset password modal state
  const [selectedCustForReset, setSelectedCustForReset] = useState<CustomerUser | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // Pending count
  const pendingCount = applications.filter((a) => a.status === 'pending').length;

  const openApprovalModal = (app: CustomerApplication) => {
    setSelectedAppForApproval(app);
    // Generate suggested username from name or company
    const baseClean = (app.fullName || app.companyName || 'client')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 15);
    const wilayaSuffix = app.wilayaCode ? `_${app.wilayaCode}` : '';
    setAssignedUsername(app.assignedUsername || `${baseClean}${wilayaSuffix}`);
    setAssignedPassword(app.assignedPassword || `tulip${Math.floor(1000 + Math.random() * 9000)}`);
    setVerificationNotes(app.verificationNotes || 'Identité et activité vérifiées par téléphone.');
    setCopiedCredentials(false);
  };

  const handleConfirmApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppForApproval) return;
    if (!assignedUsername.trim() || !assignedPassword.trim()) {
      alert('Veuillez spécifier un nom d\'utilisateur et un mot de passe.');
      return;
    }

    onApproveApplication(
      selectedAppForApproval.id,
      assignedUsername.trim(),
      assignedPassword.trim(),
      verificationNotes.trim()
    );
    setSelectedAppForApproval(null);
  };

  const handleCopyCredentials = () => {
    if (!selectedAppForApproval) return;
    const text = `Bonjour ${selectedAppForApproval.fullName},\nVotre compte Tulip Fragrance Company a été validé avec succès !\n\nVos identifiants d'accès pro pour débloquer les tarifs de gros et passer précommande :\n• Identifiant : ${assignedUsername}\n• Mot de passe : ${assignedPassword}\n\nLien d'accès : https://tulip-fragrance.dz`;
    navigator.clipboard.writeText(text);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 3000);
  };

  const handleDirectCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setDirectCreateMsg(null);

    if (!newCustName.trim() || !newCustPhone.trim() || !newCustUsername.trim() || !newCustPassword.trim()) {
      setDirectCreateMsg({ type: 'error', text: 'Veuillez remplir au moins le nom, téléphone, identifiant et mot de passe.' });
      return;
    }

    const wilaya = ALGERIAN_WILAYAS.find((w) => w.code === newCustWilayaCode);
    const wilayaName = wilaya ? wilaya.name : 'Alger';

    const cleanPhone = normalizeAlgerianPhone(newCustPhone) || newCustPhone.trim();
    const createdData = {
      fullName: newCustName.trim(),
      companyName: newCustCompany.trim() || undefined,
      phone: cleanPhone,
      username: newCustUsername.trim().toLowerCase(),
      password: newCustPassword.trim(),
    };

    onCreateCustomer({
      username: createdData.username,
      password: createdData.password,
      fullName: createdData.fullName,
      companyName: createdData.companyName,
      email: newCustEmail.trim() || `${createdData.username}@tulip-client.dz`,
      phone: createdData.phone,
      wilayaCode: newCustWilayaCode,
      wilayaName: wilayaName,
      commune: newCustCommune.trim() || wilayaName,
      deliveryAddress: newCustAddress.trim() || wilayaName,
      status: 'approved',
    });

    setLastCreatedUser(createdData);
    setDirectCreateMsg({
      type: 'success',
      text: `Le compte pour "${newCustName.trim()}" avec l'identifiant "${newCustUsername.trim()}" a été créé avec succès !`,
    });

    // Reset fields
    setNewCustName('');
    setNewCustCompany('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustCommune('');
    setNewCustAddress('');
    setNewCustUsername('');
    setNewCustPassword('tulip2026');
  };

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (app.fullName || '').toLowerCase().includes(query) ||
      (app.phone || '').includes(query) ||
      (app.email || '').toLowerCase().includes(query) ||
      (app.companyName || '').toLowerCase().includes(query) ||
      (app.wilayaName || '').toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  const filteredCustomerUsers = customerUsers.filter((u) => {
    const query = searchQuery.toLowerCase().trim();
    return (
      !query ||
      (u.fullName || '').toLowerCase().includes(query) ||
      (u.username || '').toLowerCase().includes(query) ||
      (u.phone || '').includes(query) ||
      (u.email || '').toLowerCase().includes(query) ||
      (u.wilayaName || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Section / Description */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400" />
              Contrôle d'Accès & Tarification Sécurisée
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold">
              Protection des Prix
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Les prix de vos extraits et flacons sont strictement cachés aux visiteurs ordinaires. 
            Les clients soumettent leur demande d'accès (nom, email, téléphone, adresse, RC). 
            Vous vérifiez leur identité par téléphone ou registre et leur attribuez personnellement leur identifiant et mot de passe.
          </p>
        </div>

        {/* Action quick buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('applications')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              subTab === 'applications'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900/80 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            <span>Demandes d'inscription</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-extrabold animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('active_users')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              subTab === 'active_users'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900/80 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Clients Débloqués ({customerUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('create_user')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              subTab === 'create_user'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900/80 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Ajout Direct</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('import_export')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              subTab === 'import_export'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900/80 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import / Export Excel</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: DEMANDES D'INSCRIPTION */}
      {subTab === 'applications' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, téléphone, wilaya..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap mr-1">Statut :</span>
              {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    statusFilter === st
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-750 border border-slate-750'
                  }`}
                >
                  {st === 'all' && 'Toutes'}
                  {st === 'pending' && `En attente (${pendingCount})`}
                  {st === 'approved' && 'Approuvées'}
                  {st === 'rejected' && 'Rejetées'}
                </button>
              ))}
            </div>
          </div>

          {/* Applications Table / Cards */}
          {filteredApplications.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-12 text-center text-slate-400 space-y-2">
              <UserCheck className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
              <div className="text-sm font-semibold text-slate-300">Aucune demande trouvée</div>
              <p className="text-xs text-slate-500">
                {searchQuery
                  ? 'Aucun résultat ne correspond à votre recherche.'
                  : 'Les demandes d\'accès déposées par les clients apparaîtront ici.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredApplications.map((app) => (
                <div
                  key={app.id}
                  className={`bg-slate-800 border rounded-2xl p-5 flex flex-col justify-between transition shadow-sm ${
                    app.status === 'pending'
                      ? 'border-amber-500/50 hover:border-amber-400'
                      : app.status === 'approved'
                      ? 'border-emerald-500/30 bg-slate-800/80'
                      : 'border-slate-700/60 opacity-75'
                  }`}
                >
                  <div>
                    {/* Header: Name + Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">{app.fullName}</h3>
                          {app.status === 'pending' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold animate-pulse">
                              À Vérifier
                            </span>
                          )}
                          {app.status === 'approved' && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Accès Validé
                            </span>
                          )}
                          {app.status === 'rejected' && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                              Rejeté
                            </span>
                          )}
                        </div>
                        {app.companyName && (
                          <div className="text-xs text-amber-400/90 font-semibold flex items-center gap-1.5 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-amber-500" />
                            <span>{app.companyName}</span>
                          </div>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {new Date(app.submittedAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    {/* Details Box */}
                    <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-750 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Téléphone Principal :</span>
                        <a
                          href={`tel:${app.phone}`}
                          className="font-bold text-amber-400 hover:underline flex items-center gap-1 font-mono"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {app.phone}
                        </a>
                      </div>

                      {app.secondaryPhone && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Deuxième Tél :</span>
                          <span className="font-mono text-slate-300">{app.secondaryPhone}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Email :</span>
                        <a href={`mailto:${app.email}`} className="text-slate-200 hover:text-white truncate max-w-[200px]">
                          {app.email}
                        </a>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Wilaya & Commune :</span>
                        <span className="font-semibold text-slate-200">
                          {app.wilayaName} ({app.wilayaCode}) - {app.commune}
                        </span>
                      </div>

                      <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-800">
                        <span className="text-slate-400 shrink-0">Adresse :</span>
                        <span className="text-slate-300 text-right">{app.deliveryAddress}</span>
                      </div>

                      {app.commercialRegister && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                          <span className="text-slate-400">RC / Registre :</span>
                          <span className="font-mono text-amber-300 font-semibold">{app.commercialRegister}</span>
                        </div>
                      )}

                      {app.notes && (
                        <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-400 italic">
                          "{app.notes}"
                        </div>
                      )}
                    </div>

                    {/* Assigned Credentials if approved */}
                    {app.status === 'approved' && app.assignedUsername && (
                      <div className="mt-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between font-semibold text-emerald-300">
                          <span>Identifiant attribué :</span>
                          <span className="font-mono text-white bg-slate-900 px-2 py-0.5 rounded border border-emerald-500/40">
                            {app.assignedUsername}
                          </span>
                        </div>
                        {app.assignedPassword && (
                          <div className="flex items-center justify-between text-slate-300 text-[11px]">
                            <span>Mot de passe :</span>
                            <span className="font-mono text-amber-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                              {app.assignedPassword}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Buttons */}
                  <div className="mt-4 pt-3 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${app.phone}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Appeler</span>
                      </a>

                      {app.status === 'approved' && app.assignedUsername ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleSendWhatsAppLogin(
                              app.phone,
                              app.fullName,
                              app.companyName,
                              app.assignedUsername!,
                              app.assignedPassword
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                          title="Envoyer les identifiants d'accès B2B par WhatsApp (+213)"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Envoyer Accès WhatsApp</span>
                        </button>
                      ) : (
                        <a
                          href={`https://wa.me/${toAlgerianWhatsAppPhone(app.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-emerald-800/50 hover:bg-emerald-700 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {app.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setIrreversibleModal({
                                isOpen: true,
                                title: `Rejeter la Demande de ${app.fullName}`,
                                description: `Attention : Le rejet passera le statut de cette demande à "Rejetée" et cette modification sera immédiatement enregistrée sur la base de données.`,
                                details: `Demandeur: ${app.fullName} • Entreprise: ${app.companyName || 'N/A'} • Tél: ${app.phone} • Wilaya: ${app.wilayaName}`,
                                confirmLabel: 'Confirmer le rejet',
                                onConfirm: () => {
                                  onRejectApplication(app.id);
                                  setIrreversibleModal(null);
                                },
                              });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-semibold transition cursor-pointer"
                          >
                            Rejeter
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIrreversibleModal({
                                isOpen: true,
                                title: `Supprimer Définitivement la Demande de ${app.fullName}`,
                                description: `Attention : Cette action est irréversible (Can't undo) et écrasera immédiatement la base de données. La demande d'accès sera définitivement purgée du serveur central.`,
                                details: `Demandeur: ${app.fullName} • Tél: ${app.phone} • Wilaya: ${app.wilayaName}`,
                                confirmLabel: 'Supprimer définitivement (Réécrire DB)',
                                onConfirm: () => {
                                  if (onDeleteApplication) {
                                    onDeleteApplication(app.id);
                                  } else {
                                    onDeleteCustomer(app.id);
                                  }
                                  setIrreversibleModal(null);
                                },
                              });
                            }}
                            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 hover:text-white border border-rose-800/80 transition cursor-pointer"
                            title="Supprimer définitivement cette demande de la base de données (Can't undo)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openApprovalModal(app)}
                            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Vérifier & Attribuer Accès</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setIrreversibleModal({
                                isOpen: true,
                                title: `Supprimer la Demande de ${app.fullName}`,
                                description: `Attention : Cette action est irréversible (Can't undo) et supprimera définitivement cette demande d'accès de la base de données.`,
                                details: `Demandeur: ${app.fullName} • Statut: ${app.status} • Tél: ${app.phone}`,
                                confirmLabel: 'Supprimer définitivement',
                                onConfirm: () => {
                                  if (onDeleteApplication) {
                                    onDeleteApplication(app.id);
                                  } else {
                                    onDeleteCustomer(app.id);
                                  }
                                  setIrreversibleModal(null);
                                },
                              });
                            }}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900 text-rose-400 border border-rose-800/60 transition cursor-pointer"
                            title="Supprimer cette demande (Can't undo)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openApprovalModal(app)}
                            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-650 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                            <span>Modifier Identifiants</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: CLIENTS ACTIFS DÉBLOQUÉS */}
      {subTab === 'active_users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par identifiant, nom, ville..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-xs text-slate-400">
                Total : <strong className="text-white">{customerUsers.length}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportCustomersToExcel(customerUsers)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                  title="Exporter tous les clients vers Excel (.xlsx) avec mots de passe et coordonnées"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exporter Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab('import_export')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-amber-400 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importer</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-700 font-semibold">
                  <tr>
                    <th className="p-3.5">Client / Établissement</th>
                    <th className="p-3.5">Identifiant (Username)</th>
                    <th className="p-3.5">Mot de Passe</th>
                    <th className="p-3.5">Contact Téléphonique</th>
                    <th className="p-3.5">Wilaya</th>
                    <th className="p-3.5 text-center">Accès Prix</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {filteredCustomerUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Aucun compte client enregistré pour le moment.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomerUsers.map((cust) => (
                      <tr key={cust.id} className="hover:bg-slate-750/50 transition">
                        <td className="p-3.5">
                          <div className="font-bold text-white text-sm">{cust.fullName}</div>
                          {cust.companyName && (
                            <div className="text-[11px] text-amber-400 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {cust.companyName}
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 font-mono text-slate-200">
                          <span className="bg-slate-900 px-2.5 py-1 rounded border border-slate-700 font-bold text-amber-300">
                            {cust.username}
                          </span>
                        </td>

                        <td className="p-3.5 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-200">
                              {visiblePasswords[cust.id] ? cust.password || 'tulip2026' : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setVisiblePasswords((prev) => ({
                                  ...prev,
                                  [cust.id]: !prev[cust.id],
                                }))
                              }
                              className="p-1 text-slate-400 hover:text-white rounded"
                              title="Afficher/Masquer le mot de passe"
                            >
                              {visiblePasswords[cust.id] ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="p-3.5 font-mono">
                          <a href={`tel:${cust.phone}`} className="text-slate-300 hover:text-amber-400">
                            {cust.phone}
                          </a>
                        </td>

                        <td className="p-3.5">
                          <span className="font-medium text-slate-200">{cust.wilayaName}</span>
                          <span className="text-[10px] text-slate-400 block">{cust.commune}</span>
                        </td>

                        <td className="p-3.5 text-center">
                          {cust.status === 'approved' ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                              <Unlock className="w-3 h-3" />
                              Débloqué
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Suspendu
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {/* Send WhatsApp Login Info */}
                          <button
                            type="button"
                            onClick={() =>
                              handleSendWhatsAppLogin(
                                cust.phone,
                                cust.fullName,
                                cust.companyName,
                                cust.username,
                                cust.password
                              )
                            }
                            className="p-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 transition inline-flex items-center gap-1 cursor-pointer"
                            title="Envoyer les identifiants d'accès B2B par WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[11px] font-bold hidden xl:inline">Envoyer Accès WhatsApp</span>
                          </button>

                          {/* Toggle Active status */}
                          <button
                            type="button"
                            onClick={() => onToggleCustomerActive(cust.id)}
                            className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                              cust.status === 'approved'
                                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                            }`}
                            title={cust.status === 'approved' ? 'Suspendre l\'accès aux prix' : 'Réactiver l\'accès aux prix'}
                          >
                            {cust.status === 'approved' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>

                          {/* Edit Customer Profile Details */}
                          <button
                            type="button"
                            onClick={() => handleStartEditCustomer(cust)}
                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-650 text-slate-200 transition"
                            title="Modifier les coordonnées du client (Nom, Tél, Adresse...)"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                          </button>

                          {/* Reset Password Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustForReset(cust);
                              setNewResetPassword(`tulip${Math.floor(1000 + Math.random() * 9000)}`);
                            }}
                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-650 text-slate-200 transition"
                            title="Modifier le mot de passe"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          {/* Delete Customer Account (Can't undo - Database Rewrite) */}
                          <button
                            type="button"
                            onClick={() => {
                              setIrreversibleModal({
                                isOpen: true,
                                title: `Supprimer Définitivement le Compte de ${cust.fullName}`,
                                description: `Attention : Cette action est irréversible (Can't undo) et écrasera immédiatement la base de données. L'accès aux tarifs pro sera révoqué et le compte sera définitivement effacé du serveur.`,
                                details: `Client: ${cust.fullName} • Identifiant: ${cust.username} • Tél: ${cust.phone} • Wilaya: ${cust.wilayaName}`,
                                confirmLabel: 'Supprimer définitivement (Réécrire DB)',
                                onConfirm: () => {
                                  onDeleteCustomer(cust.id);
                                  setIrreversibleModal(null);
                                },
                              });
                            }}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900 text-rose-400 hover:text-white border border-rose-800/60 transition cursor-pointer"
                            title="Supprimer définitivement ce compte (Can't undo)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: AJOUT DIRECT D'UN CLIENT */}
      {subTab === 'create_user' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-2xl mx-auto shadow-md">
          <div className="mb-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-400" />
              Création Directe d'un Compte Client
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Ajoutez un client que vous connaissez déjà personnellement et attribuez-lui directement son identifiant et mot de passe pour qu'il puisse consulter les tarifs.
            </p>
          </div>

          {directCreateMsg && (
            <div
              className={`p-3.5 rounded-xl text-xs mb-4 space-y-2.5 ${
                directCreateMsg.type === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-300'
                  : 'bg-rose-950/80 border border-rose-700 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {directCreateMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span className="font-semibold">{directCreateMsg.text}</span>
              </div>

              {directCreateMsg.type === 'success' && lastCreatedUser && (
                <div className="pt-2 border-t border-emerald-800/60 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-emerald-200">
                    Envoyer immédiatement les identifiants d'accès au client :
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendWhatsAppLogin(
                        lastCreatedUser.phone,
                        lastCreatedUser.fullName,
                        lastCreatedUser.companyName,
                        lastCreatedUser.username,
                        lastCreatedUser.password
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Envoyer les Identifiants par WhatsApp (+213)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleDirectCreate} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nom et Prénom <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Ex: Mourad Brahimi"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nom de la Parfumerie / Société
                </label>
                <input
                  type="text"
                  value={newCustCompany}
                  onChange={(e) => setNewCustCompany(e.target.value)}
                  placeholder="Ex: Parfumerie L'Essence Pure"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Numéro de Téléphone (Algérie) <span className="text-rose-400">*</span>
                </label>
                <AlgerianPhoneInput
                  value={newCustPhone}
                  onChange={setNewCustPhone}
                  placeholder="05 50 12 34 56"
                  theme="dark"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="Ex: contact@boutique.dz (optionnel)"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Wilaya</label>
                <select
                  value={newCustWilayaCode}
                  onChange={(e) => setNewCustWilayaCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-amber-500"
                >
                  {ALGERIAN_WILAYAS.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.code} - {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Commune & Adresse</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Ex: Bab Ezzouar, Alger"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            {/* Credentials Assignment Box */}
            <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <KeyRound className="w-4 h-4" />
                <span>Identifiants de Connexion à Attribuer</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Nom d'utilisateur (Username) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCustUsername}
                    onChange={(e) => setNewCustUsername(e.target.value)}
                    placeholder="Ex: mourad_parfum"
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono placeholder:text-slate-600 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Mot de passe initial <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCustPassword}
                    onChange={(e) => setNewCustPassword(e.target.value)}
                    placeholder="Ex: tulip2026"
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-amber-300 font-mono placeholder:text-slate-600 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Créer le Compte & Activer les Prix</span>
            </button>
          </form>
        </div>
      )}

      {/* SUB-TAB 4: IMPORT & EXPORT DES DONNÉES CLIENTS */}
      {subTab === 'import_export' && (
        <div className="space-y-6">
          {/* Header Description */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Import & Export des Données Clients (Futures Utilisations & Sauvegardes)</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Générez une copie intégrale de tous vos comptes clients (avec mots de passe, identifiants, emails, téléphones, 
              wilayas et adresses) pour vos archives ou imports futurs. Vous pouvez également injecter directement une liste 
              de clients en important un fichier Excel, CSV ou JSON.
            </p>
          </div>

          {/* Feedback Banner */}
          {importFeedback && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
                importFeedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-600 text-rose-200'
              }`}
            >
              {importFeedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              )}
              <span>{importFeedback.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* BOX 1: EXPORTATION DES DONNÉES */}
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Exporter la Base Clients</h4>
                    <p className="text-xs text-slate-400">
                      Télécharger toutes les fiches clients enregistrées ({customerUsers.length} comptes)
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 text-xs space-y-2 text-slate-300">
                  <span className="font-bold text-amber-400 block">Données exportées dans le fichier :</span>
                  <ul className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 list-disc list-inside">
                    <li>Identifiants (Username)</li>
                    <li>Mots de Passe Déchiffrés</li>
                    <li>Nom Complet & Entreprise</li>
                    <li>Adresses Email & Téléphones</li>
                    <li>Code & Nom Wilaya (58 wilayas)</li>
                    <li>Commune & Adresse de Livraison</li>
                    <li>Statut du compte (Approuvé...)</li>
                    <li>Date de création & Connexion</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    exportCustomersToExcel(customerUsers);
                    setImportFeedback({
                      type: 'success',
                      text: `Fichier Excel "tulip_export_clients_${new Date().toISOString().slice(0, 10)}.xlsx" téléchargé avec succès (${customerUsers.length} clients exportés).`,
                    });
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Télécharger en Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    exportCustomersToJSON(customerUsers);
                    setImportFeedback({
                      type: 'success',
                      text: `Sauvegarde JSON complète générée avec succès (${customerUsers.length} clients exportés).`,
                    });
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sauvegarde Complète JSON (.json)</span>
                </button>
              </div>
            </div>

            {/* BOX 2: IMPORTATION DES DONNÉES */}
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Importer des Clients</h4>
                      <p className="text-xs text-slate-400">
                        Ajouter ou restaurer des comptes clients depuis un fichier
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={downloadCustomerImportTemplate}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white text-[11px] font-semibold border border-slate-700 flex items-center gap-1 transition"
                    title="Télécharger un modèle Excel prêt à remplir avec les colonnes appropriées"
                  >
                    <Download className="w-3 h-3" />
                    <span>Modèle type</span>
                  </button>
                </div>

                {/* File picker */}
                <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl p-5 text-center transition bg-slate-950/60">
                  <input
                    type="file"
                    id="customer-import-input"
                    accept=".xlsx, .xls, .csv, .json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setImportFile(file);
                      setImportLoading(true);
                      setImportFeedback(null);
                      try {
                        const res = await parseCustomerImportFile(file);
                        setImportResult(res);
                        if (!res.success) {
                          setImportFeedback({
                            type: 'error',
                            text: res.errors[0] || 'Erreur lors de la lecture du fichier.',
                          });
                        }
                      } catch (err: any) {
                        setImportFeedback({
                          type: 'error',
                          text: `Erreur : ${err.message || 'Impossible de lire ce fichier'}`,
                        });
                      } finally {
                        setImportLoading(false);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="customer-import-input"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <FileSpreadsheet className="w-8 h-8 text-amber-400 animate-pulse" />
                    <span className="text-xs font-bold text-white">
                      {importFile ? importFile.name : 'Cliquez ou glissez votre fichier ici'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Formats acceptés : Excel (.xlsx, .xls), CSV (.csv) ou JSON (.json)
                    </span>
                  </label>
                </div>

                {/* Mode Selector: Merge vs Replace */}
                {importResult && importResult.success && (
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-white block">Mode d'importation :</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2 ${
                        importMode === 'merge' ? 'bg-amber-500/20 border-amber-500 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}>
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                          className="text-amber-500"
                        />
                        <span>Fusionner (Conserver l'existant)</span>
                      </label>

                      <label className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2 ${
                        importMode === 'replace' ? 'bg-rose-500/20 border-rose-500 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}>
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="text-rose-500"
                        />
                        <span>Remplacer toute la base</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {importResult && importResult.success ? (
                <button
                  type="button"
                  onClick={() => {
                    if (onImportCustomers && importResult.importedCustomers.length > 0) {
                      onImportCustomers(importResult.importedCustomers, importMode === 'replace');
                      setImportFeedback({
                        type: 'success',
                        text: `${importResult.importedCustomers.length} comptes clients ont été ${
                          importMode === 'replace' ? 'remplacés' : 'fusionnés'
                        } avec succès dans le système.`,
                      });
                      setImportFile(null);
                      setImportResult(null);
                    }
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Valider l'import de {importResult.importedCustomers.length} client(s)
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-4 rounded-xl bg-slate-800 text-slate-500 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" />
                  <span>Sélectionnez un fichier pour importer</span>
                </button>
              )}
            </div>
          </div>

          {/* PREVIEW TABLE IF FILE LOADED */}
          {importResult && importResult.success && (
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>Aperçu des comptes détectés ({importResult.importedCustomers.length})</span>
                </h4>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  Prêt pour injection
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2.5">Identifiant</th>
                      <th className="p-2.5">Mot de Passe</th>
                      <th className="p-2.5">Nom Complet</th>
                      <th className="p-2.5">Entreprise</th>
                      <th className="p-2.5">Téléphone</th>
                      <th className="p-2.5">Wilaya</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {importResult.importedCustomers.slice(0, 50).map((c, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono font-bold text-amber-400">{c.username}</td>
                        <td className="p-2.5 font-mono text-emerald-400">{c.password}</td>
                        <td className="p-2.5 text-white">{c.fullName}</td>
                        <td className="p-2.5 text-slate-400">{c.companyName || '—'}</td>
                        <td className="p-2.5 font-mono">{c.phone}</td>
                        <td className="p-2.5">{c.wilayaName} ({c.wilayaCode})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* APPROVAL & CREDENTIALS ASSIGNMENT MODAL */}
      {selectedAppForApproval && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-white animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Vérification & Attribution d'Accès</h3>
                  <p className="text-[11px] text-slate-400">Demande de {selectedAppForApproval.fullName}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAppForApproval(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmApproval} className="p-5 space-y-4 text-xs">
              {/* Summary of Identity */}
              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 space-y-1.5">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>{selectedAppForApproval.fullName}</span>
                  <span className="text-amber-400 font-mono">{selectedAppForApproval.phone}</span>
                </div>
                {selectedAppForApproval.companyName && (
                  <div className="text-slate-300 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-amber-500" />
                    <span>{selectedAppForApproval.companyName}</span>
                  </div>
                )}
                <div className="text-slate-400">
                  {selectedAppForApproval.deliveryAddress}, {selectedAppForApproval.wilayaName} ({selectedAppForApproval.wilayaCode})
                </div>
              </div>

              {/* Assignment inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Identifiant attribué (Nom d'utilisateur) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={assignedUsername}
                    onChange={(e) => setAssignedUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Le client utilisera cet identifiant pour se connecter et voir les tarifs.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Mot de passe attribué <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={assignedPassword}
                      onChange={(e) => setAssignedPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-amber-300 font-mono font-bold focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setAssignedPassword(`tulip${Math.floor(1000 + Math.random() * 9000)}`)}
                      className="px-2.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl border border-slate-700 font-semibold text-[11px] whitespace-nowrap"
                    >
                      Générer
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Notes de vérification administrative (interne)
                  </label>
                  <input
                    type="text"
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Ex: Vérifié par téléphone, client grossiste officiel"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-300"
                  />
                </div>
              </div>

              {/* Send credentials helper (WhatsApp & Copy) */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-amber-300 font-semibold">
                    Transmission des accès au client :
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {selectedAppForApproval.phone}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSendWhatsAppLogin(
                        selectedAppForApproval.phone,
                        selectedAppForApproval.fullName,
                        selectedAppForApproval.companyName,
                        assignedUsername,
                        assignedPassword
                      )
                    }
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Envoyer via WhatsApp (+213)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow-xs transition cursor-pointer"
                  >
                    {copiedCredentials ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCredentials ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAppForApproval(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider & Débloquer l'Accès</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-white flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm text-white">
                  Modifier les Coordonnées Client
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Form Scrollable Area */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateCustomer && editingCustomer) {
                  onUpdateCustomer(editingCustomer.id, {
                    fullName: editCustName,
                    companyName: editCustCompany,
                    phone: editCustPhone,
                    secondaryPhone: editCustSecPhone,
                    email: editCustEmail,
                    wilayaCode: editCustWilayaCode,
                    wilayaName: ALGERIAN_WILAYAS.find((w) => w.code === editCustWilayaCode)?.name || '',
                    commune: editCustCommune,
                    deliveryAddress: editCustAddress,
                    username: editCustUsername,
                    password: editCustPassword,
                  });
                  setEditingCustomer(null);
                }
              }}
              className="p-5 space-y-4 overflow-y-auto"
            >
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 text-[10px] uppercase font-bold tracking-wider mb-1">
                    Nom Complet
                  </label>
                  <input
                    type="text"
                    value={editCustName}
                    onChange={(e) => setEditCustName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-[10px] uppercase font-bold tracking-wider mb-1">
                    Établissement / Société
                  </label>
                  <input
                    type="text"
                    value={editCustCompany}
                    onChange={(e) => setEditCustCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 text-[10px] uppercase font-bold tracking-wider mb-1">
                    Téléphone Principal
                  </label>
                  <AlgerianPhoneInput
                    value={editCustPhone}
                    onChange={setEditCustPhone}
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-[10px] uppercase font-bold tracking-wider mb-1">
                    Téléphone Secondaire
                  </label>
                  <AlgerianPhoneInput
                    value={editCustSecPhone}
                    onChange={setEditCustSecPhone}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-[10px] uppercase font-bold tracking-wider mb-1">
                  Adresse Email
                </label>
                <input
                  type="email"
                  value={editCustEmail}
                  onChange={(e) => setEditCustEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 text-[10px] uppercase font-bold tracking-wider mb-1">
                    Wilaya
                  </label>
                  <select
                    value={editCustWilayaCode}
                    onChange={(e) => setEditCustWilayaCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-500"
                  >
                    {ALGERIAN_WILAYAS.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 text-[10px] uppercase font-bold tracking-wider mb-1">
                    Commune
                  </label>
                  <input
                    type="text"
                    value={editCustCommune}
                    onChange={(e) => setEditCustCommune(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-[10px] uppercase font-bold tracking-wider mb-1">
                  Adresse de Livraison
                </label>
                <textarea
                  value={editCustAddress}
                  onChange={(e) => setEditCustAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-500"
                  placeholder="Quartier, N°, Point de repère..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5 border-t border-slate-800 pt-3">
                <div>
                  <label className="block text-slate-300 text-[10px] uppercase font-bold tracking-wider mb-1">
                    Identifiant d'accès
                  </label>
                  <input
                    type="text"
                    value={editCustUsername}
                    onChange={(e) => setEditCustUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-amber-300 font-mono text-xs focus:border-amber-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-[10px] uppercase font-bold tracking-wider mb-1">
                    Mot de passe
                  </label>
                  <input
                    type="text"
                    value={editCustPassword}
                    onChange={(e) => setEditCustPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-amber-300 font-mono text-xs focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {selectedCustForReset && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden text-white p-5 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              Réinitialiser le mot de passe
            </h3>
            <p className="text-xs text-slate-400">
              Attribuer un nouveau mot de passe à <strong>{selectedCustForReset.fullName}</strong> ({selectedCustForReset.username}) :
            </p>

            <div>
              <label className="block text-slate-300 text-xs mb-1 font-semibold">Nouveau mot de passe</label>
              <input
                type="text"
                value={newResetPassword}
                onChange={(e) => setNewResetPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-amber-300 font-mono text-xs focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCustForReset(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newResetPassword.trim()) {
                    onResetCustomerPassword(selectedCustForReset.id, newResetPassword.trim());
                    handleSendWhatsAppLogin(
                      selectedCustForReset.phone,
                      selectedCustForReset.fullName,
                      selectedCustForReset.companyName,
                      selectedCustForReset.username,
                      newResetPassword.trim()
                    );
                    setSelectedCustForReset(null);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Enregistrer et envoyer les identifiants par WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Enregistrer & WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newResetPassword.trim()) {
                    onResetCustomerPassword(selectedCustForReset.id, newResetPassword.trim());
                    setSelectedCustForReset(null);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Irreversible Confirm Modal for Customer Account / Application Deletion */}
      {irreversibleModal && (
        <IrreversibleConfirmModal
          isOpen={Boolean(irreversibleModal.isOpen)}
          title={irreversibleModal.title}
          description={irreversibleModal.description}
          details={irreversibleModal.details}
          confirmLabel={irreversibleModal.confirmLabel || 'Confirmer la suppression (Réécrire DB)'}
          onConfirm={irreversibleModal.onConfirm}
          onCancel={() => setIrreversibleModal(null)}
        />
      )}
    </div>
  );
};
