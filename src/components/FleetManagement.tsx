import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, Upload, Filter, RefreshCw, Calendar, Tag, Building2, MapPin, 
  Activity, AlertTriangle, CheckCircle2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Clock, Eye, 
  Trash2, Edit, FileSpreadsheet, ShieldAlert, Boxes, ArrowUpDown, Layers, AlertCircle, ShieldCheck, Award, X, RotateCcw
} from 'lucide-react';
import { FleetEquipment, FleetType, FleetLocation, FleetStatus, FleetHistoryEntry } from '../types/fleet';
import { Client, ServiceOrder, UserRole } from '../types';
import { calculateDaysRemaining, getExpirationStatus, formatDateBR, calculateCompletenessScore, auditFleetDuplicates } from '../utils/fleetUtils';
import { FleetEquipmentModal, FLEET_TYPES, FLEET_LOCATIONS, FLEET_STATUSES } from './FleetEquipmentModal';
import { FleetImportModal } from './FleetImportModal';
import { FleetRecoveryModal } from './FleetRecoveryModal';
import { FleetDetailsDrawer } from './FleetDetailsDrawer';

const FleetRowItem = React.memo<{
  eq: FleetEquipment;
  onOpenDrawer: (eq: FleetEquipment) => void;
  onEdit: (eq: FleetEquipment) => void;
  onDeleteRequest?: (eq: FleetEquipment) => void;
}>(({ eq, onOpenDrawer, onEdit, onDeleteRequest }) => {
  const visDays = calculateDaysRemaining(eq.nextVisualInspectionDate);
  const visStatus = getExpirationStatus(visDays);

  const endDays = calculateDaysRemaining(eq.nextEndInspectionDate);
  const endStatus = getExpirationStatus(endDays);

  const score = calculateCompletenessScore(eq);
  const isPending = eq.isPendingValidation !== false;

  return (
    <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
      {/* Number */}
      <td className="p-4">
        <button
          onClick={() => onOpenDrawer(eq)}
          className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-black hover:underline uppercase flex items-center gap-1.5"
        >
          <Tag className="w-3.5 h-3.5" />
          {eq.equipmentNumber}
        </button>
      </td>

      {/* Type */}
      <td className="p-4 font-bold text-slate-800 dark:text-slate-200 uppercase">
        {eq.type}
      </td>

      {/* Client */}
      <td className="p-4 text-slate-600 dark:text-slate-300 uppercase truncate max-w-[150px]">
        {eq.clientId || 'BASE'}
      </td>

      {/* Location */}
      <td className="p-4">
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
          eq.location === 'BASE'
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            : 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300'
        }`}>
          {eq.location}
        </span>
      </td>

      {/* Status */}
      <td className="p-4">
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
          eq.status === 'Operacional'
            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300'
            : eq.status === 'Em manutenção'
            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
            : eq.status === 'Aguardando inspeção'
            ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300'
            : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/80 dark:text-red-300'
        }`}>
          {eq.status}
        </span>
      </td>

      {/* Cadastro / Validação PCP */}
      <td className="p-4">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            score >= 80 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : score >= 50 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-red-100 text-red-800 border border-red-300'
          }`}>
            {score}%
          </span>
          {isPending ? (
            <button
              onClick={() => onEdit(eq)}
              className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-1"
              title="Clique para conferir e validar este cadastro"
            >
              <ShieldCheck className="w-3 h-3" />
              Validar
            </button>
          ) : (
            <span className="text-[10px] font-black text-emerald-600 flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> Validado
            </span>
          )}
        </div>
      </td>

      {/* Data Visual */}
      <td className="p-4 text-slate-600 dark:text-slate-400 font-bold">
        {formatDateBR(eq.nextVisualInspectionDate)}
      </td>

      {/* Dias Visual */}
      <td className="p-4">
        <span className={`px-2.5 py-1 rounded-lg text-xs border ${visStatus.colorClass}`}>
          {visStatus.label}
        </span>
      </td>

      {/* Data END */}
      <td className="p-4 text-slate-600 dark:text-slate-400 font-bold">
        {formatDateBR(eq.nextEndInspectionDate)}
      </td>

      {/* Dias END */}
      <td className="p-4">
        <span className={`px-2.5 py-1 rounded-lg text-xs border ${endStatus.colorClass}`}>
          {endStatus.label}
        </span>
      </td>

      {/* Actions */}
      <td className="p-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onOpenDrawer(eq)}
            title="Ver Detalhes Completos"
            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(eq)}
            title="Editar Equipamento"
            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          {onDeleteRequest && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRequest(eq);
              }}
              title="Excluir Equipamento"
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

interface FleetManagementProps {
  equipments: FleetEquipment[];
  historyEntries: FleetHistoryEntry[];
  clients: Client[];
  serviceOrders: ServiceOrder[];
  userRole?: UserRole;
  onSaveEquipment: (data: Partial<FleetEquipment>) => Promise<void>;
  onDeleteEquipment: (id: string, equipmentNumber: string) => Promise<void>;
  onDeleteAllEquipment?: () => Promise<{ deletedCount: number }>;
  onAddNonConformity: (equipmentId: string, description: string, photoUrl?: string) => Promise<void>;
  onResolveNonConformity: (equipmentId: string, ncId: string) => Promise<void>;
  onImportConfirmed: (
    items: Partial<FleetEquipment>[],
    onProgress?: (msg: string, current: number, total: number) => void
  ) => Promise<{ created: number; updated: number; errors?: { equipmentNumber: string; reason: string }[] }>;
  onRecoverConfirmed?: (
    items: Partial<FleetEquipment>[],
    onProgress?: (msg: string, current: number, total: number) => void
  ) => Promise<{
    totalAnalyzed: number;
    alreadyExisting: number;
    recoveredCount: number;
    breakdownByType: Record<string, number>;
  }>;
}

export const FleetManagement: React.FC<FleetManagementProps> = ({
  equipments,
  historyEntries,
  clients,
  serviceOrders,
  userRole = 'user',
  onSaveEquipment,
  onDeleteEquipment,
  onDeleteAllEquipment,
  onAddNonConformity,
  onResolveNonConformity,
  onImportConfirmed,
  onRecoverConfirmed
}) => {
  const canDelete = userRole === 'admin' || userRole === 'moderator';

  // Views
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'expirations'>('overview');

  // Modals & Drawers
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<FleetEquipment | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  const [selectedDrawerEquipment, setSelectedDrawerEquipment] = useState<FleetEquipment | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Deletion Modal & Feedback State
  const [deletingEquipment, setDeletingEquipment] = useState<FleetEquipment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!deletingEquipment) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      console.log(`[FleetManagement] Confirmando exclusão permanente do ativo ID=${deletingEquipment.id}, TAG=${deletingEquipment.equipmentNumber}`);
      await onDeleteEquipment(deletingEquipment.id, deletingEquipment.equipmentNumber);

      const msg = `Ativo [${deletingEquipment.type}] #${deletingEquipment.equipmentNumber} foi excluído permanentemente do banco de dados!`;
      setDeleteSuccessMessage(msg);
      setTimeout(() => setDeleteSuccessMessage(null), 5000);

      // Close drawer if open for this equipment
      if (selectedDrawerEquipment?.id === deletingEquipment.id) {
        setIsDrawerOpen(false);
        setSelectedDrawerEquipment(null);
      }

      setDeletingEquipment(null);
    } catch (err: any) {
      console.error("[FleetManagement] Exceção capturada ao excluir equipamento:", err);
      const detailedMessage = err?.message || err?.code || String(err);
      setDeleteError(`Exceção do Banco de Dados: ${detailedMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [onlyVisualOverdue, setOnlyVisualOverdue] = useState(false);
  const [onlyEndOverdue, setOnlyEndOverdue] = useState(false);
  const [onlyExpiring30Days, setOnlyExpiring30Days] = useState(false);
  const [onlyPendingValidation, setOnlyPendingValidation] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<string>('equipmentNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Derived Equipment Keys (Type + Number) for composite duplicate checking
  const existingEquipments = useMemo(() => {
    return equipments.map(e => ({
      id: e.id,
      type: (e.type || 'CCU').trim().toUpperCase(),
      equipmentNumber: (e.equipmentNumber || '').trim().toUpperCase()
    }));
  }, [equipments]);

  // Audit results for duplicate rule compliance
  const auditResult = useMemo(() => {
    return auditFleetDuplicates(equipments, historyEntries);
  }, [equipments, historyEntries]);

  // Filter Logic
  const filteredEquipments = useMemo(() => {
    return equipments.filter((item) => {
      // Free text search
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const numMatch = (item.equipmentNumber || '').toLowerCase().includes(term);
        const clientMatch = (item.clientId || '').toLowerCase().includes(term);
        const obsMatch = (item.observations || '').toLowerCase().includes(term);
        if (!numMatch && !clientMatch && !obsMatch) return false;
      }

      // Filter by Client
      if (selectedClient !== 'ALL') {
        if ((item.clientId || '').toUpperCase() !== selectedClient.toUpperCase()) return false;
      }

      // Filter by Type
      if (selectedType !== 'ALL') {
        if (item.type !== selectedType) return false;
      }

      // Filter by Location
      if (selectedLocation !== 'ALL') {
        if (item.location !== selectedLocation) return false;
      }

      // Filter by Status
      if (selectedStatus !== 'ALL') {
        if (item.status !== selectedStatus) return false;
      }

      // Calculations
      const visDays = calculateDaysRemaining(item.nextVisualInspectionDate);
      const endDays = calculateDaysRemaining(item.nextEndInspectionDate);

      // Filter Visual Overdue
      if (onlyVisualOverdue && visDays >= 0) {
        return false;
      }

      // Filter END Overdue
      if (onlyEndOverdue && endDays >= 0) {
        return false;
      }

      // Filter Expiring within 30 Days (0 to 30 days remaining)
      if (onlyExpiring30Days) {
        const isVis30 = visDays >= 0 && visDays <= 30;
        const isEnd30 = endDays >= 0 && endDays <= 30;
        if (!isVis30 && !isEnd30) return false;
      }

      // Filter Pending Validation
      if (onlyPendingValidation) {
        if (item.isPendingValidation === false || item.validationStatus === 'validated') return false;
      }

      return true;
    });
  }, [
    equipments,
    searchTerm,
    selectedClient,
    selectedType,
    selectedLocation,
    selectedStatus,
    onlyVisualOverdue,
    onlyEndOverdue,
    onlyExpiring30Days,
    onlyPendingValidation
  ]);

  // Sorted Equipments
  const sortedEquipments = useMemo(() => {
    return [...filteredEquipments].sort((a, b) => {
      let aVal: any = a[sortField as keyof FleetEquipment] || '';
      let bVal: any = b[sortField as keyof FleetEquipment] || '';

      if (sortField === 'visualDays') {
        aVal = calculateDaysRemaining(a.nextVisualInspectionDate);
        bVal = calculateDaysRemaining(b.nextVisualInspectionDate);
      } else if (sortField === 'endDays') {
        aVal = calculateDaysRemaining(a.nextEndInspectionDate);
        bVal = calculateDaysRemaining(b.nextEndInspectionDate);
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal, undefined, { numeric: true })
          : bVal.localeCompare(aVal, undefined, { numeric: true });
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredEquipments, sortField, sortDirection]);

  // Pagination State
  const [fleetCurrentPage, setFleetCurrentPage] = useState(1);
  const [fleetItemsPerPage, setFleetItemsPerPage] = useState<number>(20);

  // Reset page to 1 when filters or sorting change
  useEffect(() => {
    setFleetCurrentPage(1);
  }, [
    searchTerm,
    selectedClient,
    selectedType,
    selectedLocation,
    selectedStatus,
    onlyVisualOverdue,
    onlyEndOverdue,
    onlyExpiring30Days,
    onlyPendingValidation,
    sortField,
    sortDirection,
    activeSubTab
  ]);

  const fleetTotalPages = useMemo(() => {
    if (fleetItemsPerPage === 0) return 1;
    return Math.max(1, Math.ceil(sortedEquipments.length / fleetItemsPerPage));
  }, [sortedEquipments.length, fleetItemsPerPage]);

  const validFleetPage = Math.min(fleetCurrentPage, fleetTotalPages);

  const paginatedEquipments = useMemo(() => {
    if (fleetItemsPerPage === 0) return sortedEquipments;
    const start = (validFleetPage - 1) * fleetItemsPerPage;
    return sortedEquipments.slice(start, start + fleetItemsPerPage);
  }, [sortedEquipments, validFleetPage, fleetItemsPerPage]);

  // Top Indicators (Respond to Active Filters!)
  const stats = useMemo(() => {
    let inBase = 0;
    let inClient = 0;
    let inMaintenance = 0;
    let awaitingInspection = 0;
    let nonConform = 0;
    let visualOverdue = 0;
    let endOverdue = 0;
    let visualExpiring30 = 0;
    let endExpiring30 = 0;
    let validatedCount = 0;
    let pendingValidationCount = 0;
    let totalScoreSum = 0;

    filteredEquipments.forEach((e) => {
      if (e.location === 'BASE') inBase++;
      if (e.location === 'CLIENTE') inClient++;

      if (e.status === 'Em manutenção') inMaintenance++;
      if (e.status === 'Aguardando inspeção') awaitingInspection++;
      if (e.status === 'Não conforme') nonConform++;

      const visDays = calculateDaysRemaining(e.nextVisualInspectionDate);
      if (visDays < 0) visualOverdue++;
      else if (visDays <= 30) visualExpiring30++;

      const endDays = calculateDaysRemaining(e.nextEndInspectionDate);
      if (endDays < 0) endOverdue++;
      else if (endDays <= 30) endExpiring30++;

      const isValidated = e.isPendingValidation === false || e.validationStatus === 'validated';
      if (isValidated) {
        validatedCount++;
      } else {
        pendingValidationCount++;
      }

      totalScoreSum += calculateCompletenessScore(e);
    });

    const total = filteredEquipments.length;
    const reliabilityPercent = total > 0 ? Math.round((validatedCount / total) * 100) : 0;
    const avgCompletenessScore = total > 0 ? Math.round(totalScoreSum / total) : 0;

    return {
      total,
      inBase,
      inClient,
      inMaintenance,
      awaitingInspection,
      nonConform,
      visualOverdue,
      endOverdue,
      visualExpiring30,
      endExpiring30,
      validatedCount,
      pendingValidationCount,
      reliabilityPercent,
      avgCompletenessScore
    };
  }, [filteredEquipments]);

  // Sort Handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Open Details Drawer for a tag
  const handleOpenDrawerForEquipment = (eq: FleetEquipment) => {
    setSelectedDrawerEquipment(eq);
    setIsDrawerOpen(true);
  };

  const handleOpenDrawerByTag = (tag: string) => {
    const found = equipments.find(e => (e.equipmentNumber || '').toUpperCase() === tag.toUpperCase());
    if (found) {
      setSelectedDrawerEquipment(found);
      setIsDrawerOpen(true);
    }
  };

  // Central de Vencimentos Buckets
  const expirationHubData = useMemo(() => {
    const visVencidas: FleetEquipment[] = [];
    const vis7: FleetEquipment[] = [];
    const vis15: FleetEquipment[] = [];
    const vis30: FleetEquipment[] = [];
    const vis60: FleetEquipment[] = [];
    const vis90: FleetEquipment[] = [];

    const endVencidos: FleetEquipment[] = [];
    const end7: FleetEquipment[] = [];
    const end15: FleetEquipment[] = [];
    const end30: FleetEquipment[] = [];
    const end60: FleetEquipment[] = [];
    const end90: FleetEquipment[] = [];

    equipments.forEach((e) => {
      const vDays = calculateDaysRemaining(e.nextVisualInspectionDate);
      if (vDays < 0) visVencidas.push(e);
      else if (vDays <= 7) vis7.push(e);
      else if (vDays <= 15) vis15.push(e);
      else if (vDays <= 30) vis30.push(e);
      else if (vDays <= 60) vis60.push(e);
      else if (vDays <= 90) vis90.push(e);

      const eDays = calculateDaysRemaining(e.nextEndInspectionDate);
      if (eDays < 0) endVencidos.push(e);
      else if (eDays <= 7) end7.push(e);
      else if (eDays <= 15) end15.push(e);
      else if (eDays <= 30) end30.push(e);
      else if (eDays <= 60) end60.push(e);
      else if (eDays <= 90) end90.push(e);
    });

    return {
      visual: {
        vencidas: visVencidas,
        d7: vis7,
        d15: vis15,
        d30: vis30,
        d60: vis60,
        d90: vis90
      },
      end: {
        vencidos: endVencidos,
        d7: end7,
        d15: end15,
        d30: end30,
        d60: end60,
        d90: end90
      }
    };
  }, [equipments]);

  // Selected Equipment History for Drawer
  const activeHistoryEntries = useMemo(() => {
    if (!selectedDrawerEquipment) return [];
    return historyEntries.filter(
      h => (h.equipmentNumber || '').toUpperCase() === (selectedDrawerEquipment.equipmentNumber || '').toUpperCase()
    ).sort((a, b) => {
      const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
      const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
      return tB - tA;
    });
  }, [selectedDrawerEquipment, historyEntries]);

  return (
    <div className="space-y-6">
      {/* Navigation Sub-Tabs & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeSubTab === 'overview'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Boxes className="w-4 h-4" />
            Visão Geral e Cadastro da Frota
          </button>

          <button
            onClick={() => setActiveSubTab('expirations')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 relative ${
              activeSubTab === 'expirations'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Central de Vencimentos
            {(expirationHubData.visual.vencidas.length > 0 || expirationHubData.end.vencidos.length > 0) && (
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsRecoveryModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-600/20 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border border-blue-500/30 cursor-pointer"
            title="Comparação Tipo + Número para resgate de registros omitidos"
          >
            <RotateCcw className="w-4 h-4 text-blue-500" />
            Recuperar Registros Não Importados
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/20 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border border-emerald-500/30 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar Planilha
          </button>

          <button
            onClick={() => {
              setEditingEquipment(null);
              setIsEquipmentModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/25 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Equipamento
          </button>
        </div>
      </div>

      {/* Fleet Success Feedback Banner */}
      {deleteSuccessMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{deleteSuccessMessage}</span>
          </div>
          <button
            onClick={() => setDeleteSuccessMessage(null)}
            className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Qualidade do Cadastro da Frota Panel */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-3xl text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Qualidade do Cadastro da Frota
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Métricas de validação PCP e completude de dados da base de ativos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Confiabilidade da Base</span>
              <span className={`text-lg font-black ${stats.reliabilityPercent >= 80 ? 'text-emerald-400' : stats.reliabilityPercent >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {stats.reliabilityPercent}%
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Média de Completude</span>
              <span className="text-lg font-black text-blue-400">
                {stats.avgCompletenessScore}%
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-700/60 text-xs">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 text-[10px] font-bold uppercase block">Total Cadastrado</span>
            <strong className="text-base text-white">{stats.total} ativos</strong>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 text-[10px] font-bold uppercase block">Validados PCP</span>
            <strong className="text-base text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              {stats.validatedCount} ativos
            </strong>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 text-[10px] font-bold uppercase block">Pendentes de Validação</span>
            <strong className="text-base text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {stats.pendingValidationCount} ativos
            </strong>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[10px] font-bold uppercase block">Filtrar Incompletos</span>
              <span className="text-[11px] font-bold text-slate-300">
                {stats.pendingValidationCount > 0 ? 'Conferência pendente' : 'Tudo validado'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOnlyPendingValidation(!onlyPendingValidation)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                onlyPendingValidation
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              {onlyPendingValidation ? 'Exibindo Pendentes' : 'Filtrar'}
            </button>
          </div>
        </div>

        {/* Regra de Duplicidade Composta & Auditoria */}
        <div className="pt-3 border-t border-slate-700/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-slate-300 font-bold text-[11px]">
              Regra de Duplicidade Ativa: <span className="text-white font-black">Tipo + Número do Equipamento</span> simultaneamente.
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
            {auditResult.duplicateNumbersCount > 0 ? (
              <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg font-bold">
                {auditResult.duplicateNumbersCount} número(s) compartilhado(s) entre tipos distintos
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg font-bold">
                Sem conflitos de tipo/número
              </span>
            )}

            {auditResult.affectedCount > 0 && (
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg font-bold">
                {auditResult.affectedCount} registro(s) reclassificado(s) anteriormente
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Indicators Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Total Ativos</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>

        {/* Base */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Na Base</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats.inBase}</p>
        </div>

        {/* Clients */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Em Clientes</span>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{stats.inClient}</p>
        </div>

        {/* Maintenance */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Em Manutenção</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.inMaintenance}</p>
        </div>

        {/* Non conform */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Não Conformes</span>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{stats.nonConform}</p>
        </div>

        {/* Visuais Vencidas */}
        <div className={`p-4 rounded-2xl border shadow-sm transition-all ${
          stats.visualOverdue > 0 ? 'bg-red-500/10 border-red-500/40' : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
        }`}>
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Visual Vencida</span>
          <p className={`text-2xl font-black mt-1 ${stats.visualOverdue > 0 ? 'text-red-600 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
            {stats.visualOverdue}
          </p>
        </div>

        {/* END Vencidos */}
        <div className={`p-4 rounded-2xl border shadow-sm transition-all ${
          stats.endOverdue > 0 ? 'bg-red-500/10 border-red-500/40' : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
        }`}>
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">END Vencido</span>
          <p className={`text-2xl font-black mt-1 ${stats.endOverdue > 0 ? 'text-red-600 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
            {stats.endOverdue}
          </p>
        </div>

        {/* Visual 30d */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Visual ≤ 30 Dias</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.visualExpiring30}</p>
        </div>

        {/* END 30d */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">END ≤ 30 Dias</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.endExpiring30}</p>
        </div>

        {/* Aguardando Inspeção */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Aguard. Inspeção</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats.awaitingInspection}</p>
        </div>
      </div>

      {activeSubTab === 'overview' ? (
        <>
          {/* Filters Bar */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-500" />
                Filtros e Pesquisa Simultânea
              </h3>

              {(searchTerm || selectedClient !== 'ALL' || selectedType !== 'ALL' || selectedLocation !== 'ALL' || selectedStatus !== 'ALL' || onlyVisualOverdue || onlyEndOverdue || onlyExpiring30Days) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedClient('ALL');
                    setSelectedType('ALL');
                    setSelectedLocation('ALL');
                    setSelectedStatus('ALL');
                    setOnlyVisualOverdue(false);
                    setOnlyEndOverdue(false);
                    setOnlyExpiring30Days(false);
                  }}
                  className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Limpar Filtros
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar número, tag..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Client Filter */}
              <div>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Todos os Clientes</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.razaoSocial}>{c.razaoSocial}</option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Todos os Tipos</option>
                  {FLEET_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Location Filter */}
              <div>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Todas Localizações</option>
                  {FLEET_LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Todos os Status</option>
                  {FLEET_STATUSES.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Toggle Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOnlyPendingValidation(!onlyPendingValidation)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all flex items-center gap-1.5 border ${
                  onlyPendingValidation
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Cadastro Pendente
              </button>

              <button
                type="button"
                onClick={() => setOnlyVisualOverdue(!onlyVisualOverdue)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all flex items-center gap-1.5 border ${
                  onlyVisualOverdue
                    ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Visual Vencida
              </button>

              <button
                type="button"
                onClick={() => setOnlyEndOverdue(!onlyEndOverdue)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all flex items-center gap-1.5 border ${
                  onlyEndOverdue
                    ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                END Vencido
              </button>

              <button
                type="button"
                onClick={() => setOnlyExpiring30Days(!onlyExpiring30Days)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all flex items-center gap-1.5 border ${
                  onlyExpiring30Days
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Vencendo em até 30 dias
              </button>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('equipmentNumber')}>
                      <div className="flex items-center gap-1">
                        Número
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('type')}>
                      <div className="flex items-center gap-1">
                        Tipo
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('clientId')}>
                      <div className="flex items-center gap-1">
                        Cliente
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('location')}>
                      <div className="flex items-center gap-1">
                        Localização
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('status')}>
                      <div className="flex items-center gap-1">
                        Status
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                      <div className="flex items-center gap-1">
                        Cadastro / Validação PCP
                      </div>
                    </th>
                    <th className="p-4">Data Visual</th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('visualDays')}>
                      <div className="flex items-center gap-1">
                        Dias Visual
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="p-4">Data END</th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('endDays')}>
                      <div className="flex items-center gap-1">
                        Dias END
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {sortedEquipments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-slate-400 dark:text-slate-500 font-bold">
                        Nenhum equipamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedEquipments.map((eq) => (
                      <FleetRowItem
                        key={eq.id}
                        eq={eq}
                        onOpenDrawer={handleOpenDrawerForEquipment}
                        onEdit={(item) => {
                          setEditingEquipment(item);
                          setIsEquipmentModalOpen(true);
                        }}
                        onDeleteRequest={canDelete ? (item) => {
                          setDeleteError(null);
                          setDeletingEquipment(item);
                        } : undefined}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {sortedEquipments.length > 0 && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-3xl">
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-bold">
                  <span>
                    Exibindo {fleetItemsPerPage === 0 ? 1 : Math.min((validFleetPage - 1) * fleetItemsPerPage + 1, sortedEquipments.length)} a {fleetItemsPerPage === 0 ? sortedEquipments.length : Math.min(validFleetPage * fleetItemsPerPage, sortedEquipments.length)} de <strong className="text-slate-800 dark:text-slate-200">{sortedEquipments.length}</strong> equipamentos
                  </span>
                  
                  <div className="flex items-center gap-1 ml-2">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400">Por página:</span>
                    <select
                      value={fleetItemsPerPage}
                      onChange={(e) => setFleetItemsPerPage(Number(e.target.value))}
                      className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                    >
                      <option value={15}>15</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={0}>Todos ({sortedEquipments.length})</option>
                    </select>
                  </div>
                </div>

                {fleetItemsPerPage > 0 && fleetTotalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFleetCurrentPage(p => Math.max(1, p - 1))}
                      disabled={validFleetPage === 1}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 text-xs font-bold"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </button>

                    <div className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-200">
                      <span>{validFleetPage}</span>
                      <span className="text-slate-400">/</span>
                      <span className="text-slate-500">{fleetTotalPages}</span>
                    </div>

                    <button
                      onClick={() => setFleetCurrentPage(p => Math.min(fleetTotalPages, p + 1))}
                      disabled={validFleetPage === fleetTotalPages}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 text-xs font-bold"
                    >
                      Próxima
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Central de Vencimentos Hub */
        <div className="space-y-8">
          {/* Section 1: Inspeção Visual */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-600 rounded-full" />
              <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white tracking-wide">
                Central de Vencimentos — Inspeção Visual
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Vencidas */}
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 animate-bounce" />
                    Vencidas ({expirationHubData.visual.vencidas.length})
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.visual.vencidas.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum equipamento vencido</span>
                  ) : (
                    expirationHubData.visual.vencidas.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-red-700 transition-all shadow"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* até 7 dias */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <h4 className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">
                  Vencem em até 7 dias ({expirationHubData.visual.d7.length})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.visual.d7.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum nesta faixa</span>
                  ) : (
                    expirationHubData.visual.d7.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold uppercase hover:bg-amber-600 transition-all"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* até 15 dias */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <h4 className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">
                  Vencem em até 15 dias ({expirationHubData.visual.d15.length})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.visual.d15.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum nesta faixa</span>
                  ) : (
                    expirationHubData.visual.d15.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold uppercase hover:bg-amber-600 transition-all"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* até 30 dias */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                  Vencem em até 30 dias ({expirationHubData.visual.d30.length})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.visual.d30.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum nesta faixa</span>
                  ) : (
                    expirationHubData.visual.d30.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold uppercase"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* até 60 dias */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                  Vencem em até 60 dias ({expirationHubData.visual.d60.length})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.visual.d60.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum nesta faixa</span>
                  ) : (
                    expirationHubData.visual.d60.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold uppercase"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* até 90 dias */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                  Vencem em até 90 dias ({expirationHubData.visual.d90.length})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.visual.d90.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum nesta faixa</span>
                  ) : (
                    expirationHubData.visual.d90.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-bold uppercase"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: END (Ensaio Não Destrutivo) */}
          <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-purple-600 rounded-full" />
              <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white tracking-wide">
                Central de Vencimentos — END (Ensaio Não Destrutivo)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Vencidos END */}
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-3">
                <h4 className="text-xs font-black uppercase text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                  Vencidos END ({expirationHubData.end.vencidos.length})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.end.vencidos.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum END vencido</span>
                  ) : (
                    expirationHubData.end.vencidos.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-red-700 transition-all shadow"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* END até 7 dias */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <h4 className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">
                  Vencem em até 7 dias ({expirationHubData.end.d7.length})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.end.d7.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum nesta faixa</span>
                  ) : (
                    expirationHubData.end.d7.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold uppercase hover:bg-amber-600 transition-all"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* END até 15 dias */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <h4 className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">
                  Vencem em até 15 dias ({expirationHubData.end.d15.length})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.end.d15.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum nesta faixa</span>
                  ) : (
                    expirationHubData.end.d15.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold uppercase hover:bg-amber-600 transition-all"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* END até 30 dias */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                  Vencem em até 30 dias ({expirationHubData.end.d30.length})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.end.d30.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum nesta faixa</span>
                  ) : (
                    expirationHubData.end.d30.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold uppercase"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* END até 60 dias */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                  Vencem em até 60 dias ({expirationHubData.end.d60.length})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.end.d60.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum nesta faixa</span>
                  ) : (
                    expirationHubData.end.d60.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold uppercase"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* END até 90 dias */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                  Vencem em até 90 dias ({expirationHubData.end.d90.length})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {expirationHubData.end.d90.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Nenhum nesta faixa</span>
                  ) : (
                    expirationHubData.end.d90.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenDrawerForEquipment(e)}
                        className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-bold uppercase"
                      >
                        {e.equipmentNumber}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Equipment Edit/Create Modal */}
      <FleetEquipmentModal
        isOpen={isEquipmentModalOpen}
        onClose={() => {
          setIsEquipmentModalOpen(false);
          setEditingEquipment(null);
        }}
        onSave={onSaveEquipment}
        initialData={editingEquipment}
        clients={clients}
        existingEquipments={existingEquipments}
      />

      {/* Excel/CSV Import Modal */}
      <FleetImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportConfirmed={onImportConfirmed}
        existingEquipments={existingEquipments}
        onDeleteAllEquipment={onDeleteAllEquipment}
      />

      {/* Recover Unimported Records Modal */}
      {onRecoverConfirmed && (
        <FleetRecoveryModal
          isOpen={isRecoveryModalOpen}
          onClose={() => setIsRecoveryModalOpen(false)}
          onRecoverConfirmed={onRecoverConfirmed}
        />
      )}

      {/* Equipment Lateral Details Drawer */}
      <FleetDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        equipment={selectedDrawerEquipment}
        historyEntries={activeHistoryEntries}
        serviceOrders={serviceOrders}
        onAddNonConformity={onAddNonConformity}
        onResolveNonConformity={onResolveNonConformity}
        onEditClick={(eq) => {
          setIsDrawerOpen(false);
          setEditingEquipment(eq);
          setIsEquipmentModalOpen(true);
        }}
        onDeleteClick={canDelete ? (eq) => {
          setDeleteError(null);
          setDeletingEquipment(eq);
        } : undefined}
      />

      {/* Confirmation & Deletion Modal */}
      {deletingEquipment && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase text-slate-900 dark:text-white">
                  Confirmar Exclusão Permanente
                </h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Esta ação não poderá ser desfeita
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs space-y-2">
              <div className="flex justify-between">
                <span className="font-bold text-slate-500">Número do Equipamento:</span>
                <span className="font-black text-slate-900 dark:text-white uppercase">{deletingEquipment.equipmentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-500">Tipo do Ativo:</span>
                <span className="font-black text-slate-900 dark:text-white uppercase">{deletingEquipment.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-500">Cliente:</span>
                <span className="font-black text-slate-900 dark:text-white uppercase">{deletingEquipment.clientId || 'BASE'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-500">Localização:</span>
                <span className="font-black text-slate-900 dark:text-white uppercase">{deletingEquipment.location}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              O registro do ativo será excluído permanentemente da coleção do banco de dados (<code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-rose-500 font-mono text-[11px]">fleetEquipment</code>). A lista de ativos e os indicadores do Dashboard serão atualizados automaticamente.
            </p>

            {deleteError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-bold space-y-1">
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Exceção detalhada do Banco de Dados:</span>
                </div>
                <p className="font-mono text-[11px] break-all bg-rose-950/20 p-2 rounded-xl border border-rose-500/20">
                  {deleteError}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingEquipment(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Excluindo do Banco...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sim, Excluir Permanentemente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
