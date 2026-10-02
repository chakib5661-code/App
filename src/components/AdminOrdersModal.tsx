import React, { useState } from 'react';
import {
  X,
  PackageCheck,
  Search,
  Download,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle2,
  Truck,
  Filter,
  Eye,
  Send,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { PreOrder, StoreSettings } from '../types';
import { INITIAL_STORE_SETTINGS } from '../data/initialProducts';
import { downloadOrderPDF, formatDZD } from '../utils/pdfGenerator';
import { sendOrderToTelegram } from '../utils/telegramNotifier';
import { IrreversibleConfirmModal } from './IrreversibleConfirmModal';

interface AdminOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PreOrder[];
  storeSettings?: StoreSettings;
  onUpdateOrderStatus: (orderId: string, newStatus: PreOrder['status']) => void;
  onViewOrderDetails?: (order: PreOrder) => void;
  onDeleteOrder?: (orderId: string) => void;
}

export const AdminOrdersModal: React.FC<AdminOrdersModalProps> = ({
  isOpen,
  onClose,
  orders,
  storeSettings: rawStoreSettings,
  onUpdateOrderStatus,
  onViewOrderDetails,
  onDeleteOrder,
}) => {
  const storeSettings = rawStoreSettings || INITIAL_STORE_SETTINGS;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'preorder' | 'proforma'>('all');
  const [selectedOrder, setSelectedOrder] = useState<PreOrder | null>(null);
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<PreOrder | null>(null);

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    const q = (searchQuery || '').toLowerCase();
    const matchQuery =
      (o.orderNumber || '').toLowerCase().includes(q) ||
      ((o.customer && o.customer.fullName) || '').toLowerCase().includes(q) ||
      ((o.customer && o.customer.phone) || '').includes(searchQuery) ||
      ((o.customer && o.customer.wilayaName) || '').toLowerCase().includes(q);

    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const isProforma = Boolean(o.isProforma || (o.orderNumber && o.orderNumber.startsWith('PRO-')));
    const matchType =
      orderTypeFilter === 'all' ||
      (orderTypeFilter === 'proforma' && isProforma) ||
      (orderTypeFilter === 'preorder' && !isProforma);

    return matchQuery && matchStatus && matchType;
  });

  const totalPreordersDA = orders.reduce((sum, o) => sum + o.totalDA, 0);

  const getStatusBadge = (status: PreOrder['status']) => {
    switch (status) {
      case 'en_attente':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            En attente
          </span>
        );
      case 'confirmee':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Confirmée
          </span>
        );
      case 'en_preparation':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
            <Truck className="w-3 h-3 text-purple-600" />
            En préparation
          </span>
        );
      case 'livree':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Livrée / Récupérée
          </span>
        );
      case 'annulee':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
            Annulée
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                Registre des Précommandes Reçues
              </h3>
              <p className="text-xs text-slate-400">
                Suivi des réservations de stock et réimpression des bons PDF
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar and metrics */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par client, tél, n° commande, Wilaya..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={orderTypeFilter}
                onChange={(e) => setOrderTypeFilter(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
              >
                <option value="all">Tous types</option>
                <option value="preorder">Précommandes uniquement</option>
                <option value="proforma">Proformas uniquement</option>
              </select>

              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="all">Tous les statuts</option>
                <option value="en_attente">En attente</option>
                <option value="confirmee">Confirmée</option>
                <option value="en_preparation">En préparation</option>
                <option value="livree">Livrée</option>
                <option value="annulee">Annulée</option>
              </select>
            </div>
          </div>

          {/* Metric */}
          <div className="flex items-center gap-3">
            <span className="text-slate-600 font-medium">
              Total réservations : <strong className="text-slate-900">{orders.length}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
              {formatDZD(totalPreordersDA)}
            </span>
          </div>
        </div>

        {/* Orders Table */}
        <div className="p-4 overflow-y-auto flex-1">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <PackageCheck className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-slate-600">Aucune précommande trouvée</p>
              <p className="text-xs text-slate-400 mt-1">
                Les précommandes passées par vos clients apparaîtront ici avec possibilité de réimprimer le PDF.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Réf. / Type / Date</th>
                    <th className="p-3">Client & Contact</th>
                    <th className="p-3">Wilaya & Mode</th>
                    <th className="p-3">Articles</th>
                    <th className="p-3 text-right">Total DA</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{order.orderNumber}</span>
                        </div>
                        <div className="my-0.5">
                          {order.isProforma || (order.orderNumber && order.orderNumber.startsWith('PRO-')) ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black uppercase tracking-wide">
                              📄 Proforma
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9px] font-black uppercase tracking-wide">
                              🛒 Précommande
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(order.date).toLocaleDateString('fr-DZ', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900">{order.customer.fullName}</div>
                        {order.customer.companyName && (
                          <div className="text-[10px] text-amber-800 font-semibold">{order.customer.companyName}</div>
                        )}
                        <div className="font-mono text-slate-600 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <a href={`tel:${order.customer.phone}`} className="hover:underline text-emerald-700">
                            {order.customer.phone}
                          </a>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-slate-800">
                          {order.customer.wilayaCode} - {order.customer.wilayaName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {order.customer.deliveryMode === 'magasin'
                            ? 'Retrait Magasin'
                            : order.customer.deliveryMode === 'stop_desk'
                            ? 'Bureau Stop-Desk'
                            : 'À Domicile'}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-medium text-slate-800">
                          {order.items.reduce((s, i) => s + i.quantity, 0)} unité(s)
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={order.items.map(i => i.name).join(', ')}>
                          {order.items[0]?.name} {order.items.length > 1 ? `+${order.items.length - 1}` : ''}
                        </div>
                      </td>

                      <td className="p-3 text-right">
                        <span className="font-extrabold text-slate-900">
                          {formatDZD(order.totalDA)}
                        </span>
                      </td>

                      <td className="p-3">
                        <select
                          value={order.status}
                          onChange={(e) =>
                            onUpdateOrderStatus(order.id, e.target.value as PreOrder['status'])
                          }
                          className="text-[11px] font-bold rounded-lg px-2 py-1 bg-white border border-slate-300 focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="en_attente">⏳ En attente</option>
                          <option value="confirmee">✓ Confirmée</option>
                          <option value="en_preparation">📦 En préparation</option>
                          <option value="livree">🚚 Livrée</option>
                          <option value="annulee">❌ Annulée</option>
                        </select>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* PDF Download */}
                          <button
                            type="button"
                            onClick={() => downloadOrderPDF(order, storeSettings)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Télécharger le Bon PDF"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-700" />
                          </button>

                          {/* Telegram Dispatch to +213799938399 */}
                          <button
                            type="button"
                            onClick={() => sendOrderToTelegram(order, storeSettings, storeSettings.telegramPhone || '+213799938399')}
                            className="p-1.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 transition"
                            title={`Transmettre sur Telegram (${storeSettings.telegramPhone || '+213799938399'})`}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* WhatsApp Customer */}
                          <a
                            href={`https://wa.me/213${order.customer.phone.replace(/^0/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition"
                            title="Contacter sur WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>

                          {/* Delete Order (Can't undo - Database rewrite) */}
                          {onDeleteOrder && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteOrder(order)}
                              className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 transition cursor-pointer"
                              title="Supprimer définitivement ce bon (Irréversible - Réécriture DB)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <strong>Mode Temps Réel Actif :</strong> Toutes les actions et suppressions réécrivent directement la base de données (Can't undo).
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* Irreversible Delete Confirmation Modal */}
      {confirmDeleteOrder && (
        <IrreversibleConfirmModal
          isOpen={Boolean(confirmDeleteOrder)}
          title={`Supprimer Définitivement le Bon ${confirmDeleteOrder.orderNumber}`}
          description={`Attention : Cette action est irréversible (Can't undo) et écrasera définitivement la base de données. Le bon de commande de ${confirmDeleteOrder.customer.fullName} (${formatDZD(confirmDeleteOrder.totalDA)}) sera supprimé du serveur et le stock des articles sera réintégré.`}
          details={`Réf: ${confirmDeleteOrder.orderNumber} • Client: ${confirmDeleteOrder.customer.fullName} (${confirmDeleteOrder.customer.phone}) • Montant: ${formatDZD(confirmDeleteOrder.totalDA)}`}
          confirmLabel="Supprimer définitivement (Réécrire DB)"
          cancelLabel="Annuler"
          onConfirm={() => {
            if (onDeleteOrder && confirmDeleteOrder) {
              onDeleteOrder(confirmDeleteOrder.id);
            }
            setConfirmDeleteOrder(null);
          }}
          onCancel={() => setConfirmDeleteOrder(null)}
        />
      )}
    </div>
  );
};
