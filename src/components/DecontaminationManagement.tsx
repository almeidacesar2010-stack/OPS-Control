import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  Container, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Check, 
  Edit3, 
  Trash2, 
  Building2, 
  BarChart3, 
  PieChart as PieChartIcon, 
  History, 
  Droplet, 
  Sparkles, 
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  FileText,
  ShieldAlert,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  Printer,
  Maximize2,
  Minimize2,
  Truck,
  Award,
  Info,
  Gauge,
  Zap,
  Flame,
  Target,
  Scale,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Eye,
  ExternalLink
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
  LineChart,
  Line
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, setDoc, deleteDoc, doc, getDoc, getDocs, where, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

import { FleetEquipment } from '../types/fleet';
import { 
  DecontaminationOperation, 
  DecontaminationStatus, 
  FilterPeriod, 
  DecontaminationFilter,
  DecontaminationCertificate,
  TANK_CLIENTS
} from '../types/decontamination';
import { 
  getWaitTimeHours, 
  getDeconTimeHours, 
  getLeadTimeHours, 
  formatHours, 
  formatDays,
  formatDailyAverage,
  formatDateDisplay,
  calculateDurationDays,
  isOperationInPeriod, 
  calculateDecontaminationKPIs, 
  calculateClientIndicators, 
  calculateModelIndicators, 
  calculateContaminationIndicators,
  generateDailyProductivityChartData,
  ProductivityHorizon,
  DailyProductivityPoint,
  ComparisonResult
} from '../utils/decontaminationUtils';
import { UserRole } from '../types';
import { DecontaminationModal } from './DecontaminationModal';
import { TankHistoryModal } from './TankHistoryModal';
import { DecontaminationCertificateModal } from './DecontaminationCertificateModal';
import { DecontaminationCertificateHistoryModal } from './DecontaminationCertificateHistoryModal';
import { fetchUserProfileSignature } from '../utils/userSignatureHelper';

interface DecontaminationManagementProps {
  operations: DecontaminationOperation[];
  fleetEquipments: FleetEquipment[];
  clients: { id: string; razaoSocial: string }[];
  userRole?: UserRole;
  currentUserName?: string;
  currentUserId?: string;
  currentUserSignatureUrl?: string;
  currentUserJobTitle?: string;
  logoUrl?: string;
  onSaveOperation: (operation: Partial<DecontaminationOperation>) => Promise<void>;
  onDeleteOperation: (id: string) => Promise<void>;
  onRequestDelete?: (itemType: string, itemId: string, itemCollection: string, itemName: string) => void;
}

type SortField = 'arrivalDate' | 'equipmentNumber' | 'client' | 'product' | 'status' | 'deconTime';

const extract6DigitTag = (tag?: string): number => {
  if (!tag) return 0;
  const digits = tag.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits.slice(-6), 10) || 0;
};

const parseDateToMillis = (dateStr?: string): number => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const str = dateStr.trim();
  if (!str) return 0;

  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const parts = str.split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const rest = parts[2].split(' ');
    const year = rest[0];
    const time = rest[1] ? `T${rest[1]}` : '';
    const iso = `${year}-${month}-${day}${time}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

export function DecontaminationManagement({
  operations,
  fleetEquipments,
  clients,
  userRole = 'user',
  currentUserName = 'Inspetor Técnico OEG',
  currentUserId = '',
  currentUserSignatureUrl,
  currentUserJobTitle,
  logoUrl,
  onSaveOperation,
  onDeleteOperation,
  onRequestDelete
}: DecontaminationManagementProps) {
  const canDelete = userRole === 'admin' || userRole === 'moderator';
  // Modal states
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<DecontaminationOperation | null>(null);
  const [selectedTankForHistory, setSelectedTankForHistory] = useState<string | null>(null);
  
  // Standalone Certificate Modal & History States
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<DecontaminationCertificate | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [certificates, setCertificates] = useState<DecontaminationCertificate[]>([]);

  // Sync Certificates from Firestore
  useEffect(() => {
    try {
      const colRef = collection(db, 'decontaminationCertificates');
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const certsList: DecontaminationCertificate[] = [];
        snapshot.forEach((doc) => {
          const raw = doc.data() as DecontaminationCertificate;
          certsList.push({
            id: doc.id,
            ...raw,
            client: raw.client ? raw.client.toUpperCase() : '',
            tanks: (raw.tanks || []).map(t => ({
              ...t,
              equipmentNumber: (t.equipmentNumber || '').toUpperCase(),
              product: (t.product || 'NÃO INFORMADO').trim().toUpperCase(),
              description: (t.description || 'TANQUE DE ARMAZENAMENTO').toUpperCase()
            }))
          } as DecontaminationCertificate);
        });
        certsList.sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });
        setCertificates(certsList);
      }, (error) => {
        console.error('Error listening to certificates:', error);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error('Firestore listener error for certificates:', e);
    }
  }, []);

  const cleanForFirestore = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) return obj.map(cleanForFirestore);
    if (typeof obj === 'object' && !(obj instanceof Date)) {
      const cleaned: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (val !== undefined) {
          cleaned[key] = cleanForFirestore(val);
        }
      }
      return cleaned;
    }
    return obj;
  };

  const handleSaveCertificate = async (cert: DecontaminationCertificate) => {
    try {
      const { id, ...rawCertData } = cert;
      const certData = cleanForFirestore(rawCertData);
      
      if (id && !id.startsWith('cert_')) {
        await setDoc(doc(db, 'decontaminationCertificates', id), {
          ...certData,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setCertificates(prev => prev.map(c => c.id === id ? { id, ...certData } as DecontaminationCertificate : c));
      } else {
        const docRef = await addDoc(collection(db, 'decontaminationCertificates'), {
          ...certData,
          createdAt: new Date().toISOString()
        });
        const newSavedCert = { id: docRef.id, ...certData } as DecontaminationCertificate;
        setCertificates(prev => [newSavedCert, ...prev.filter(c => c.id !== docRef.id)]);
      }
    } catch (e) {
      console.error('Error saving certificate to Firestore:', e);
      throw e;
    }
  };

  const handleDeleteCertificate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'decontaminationCertificates', id));
      setCertificates(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      console.error('Error deleting certificate:', e);
      throw e;
    }
  };

  const handleApproveCertificate = async (certId: string, approverName: string, approverId: string) => {
    try {
      const now = new Date();
      const approvedDate = format(now, 'yyyy-MM-dd');
      const approvedTime = format(now, 'HH:mm');
      const approvedAt = now.toISOString();

      let approvedByJobTitle: string | undefined = currentUserJobTitle || undefined;
      let approvedBySignatureUrl: string | undefined = currentUserSignatureUrl || undefined;

      // Robustly retrieve approver's profile signature and job title from Firestore
      if (!approvedBySignatureUrl || !approvedByJobTitle) {
        try {
          const profileInfo = await fetchUserProfileSignature(approverId, undefined, approverName);
          if (!approvedBySignatureUrl && profileInfo.signatureUrl) approvedBySignatureUrl = profileInfo.signatureUrl;
          if (!approvedByJobTitle && profileInfo.jobTitle) approvedByJobTitle = profileInfo.jobTitle;
        } catch (err) {
          console.warn('Could not fetch approver user details from profile:', err);
        }
      }

      const updateData: any = {
        approvalStatus: 'approved' as const,
        approvedByName: approverName,
        approvedById: approverId,
        approvedDate,
        approvedTime,
        approvedAt,
        approvedBy: approverName,
        updatedAt: approvedAt
      };

      if (approvedByJobTitle) updateData.approvedByJobTitle = approvedByJobTitle;
      if (approvedBySignatureUrl) updateData.approvedBySignatureUrl = approvedBySignatureUrl;

      await setDoc(doc(db, 'decontaminationCertificates', certId), updateData, { merge: true });

      setCertificates(prev => prev.map(c => c.id === certId ? {
        ...c,
        ...updateData
      } : c));

      return {
        approvedByJobTitle,
        approvedBySignatureUrl,
        approvedDate,
        approvedTime,
        approvedAt,
        approvedByName: approverName,
        approvedById: approverId
      };
    } catch (e) {
      console.error('Error approving certificate:', e);
      throw e;
    }
  };

  // Active view tab for indicators & rankings section
  const [activeIndicatorTab, setActiveIndicatorTab] = useState<'clients' | 'models' | 'contamination'>('clients');

  // Client sorting option
  const [clientSortOption, setClientSortOption] = useState<'decon_desc' | 'decon_asc' | 'tempo_desc' | 'tempo_asc'>('decon_desc');

  // Chart Horizon for Daily Productivity
  const [chartHorizon, setChartHorizon] = useState<ProductivityHorizon>('monthly');

  // Modals for Aguardando and Em Descontaminação lists
  const [isWaitingModalOpen, setIsWaitingModalOpen] = useState(false);
  const [isInProgressModalOpen, setIsInProgressModalOpen] = useState(false);

  // Today ISO date string
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  // Filter state
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Search & Table Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<DecontaminationStatus | 'all'>('all');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('all');
  const [selectedContaminationFilter, setSelectedContaminationFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [selectedPendingFilter, setSelectedPendingFilter] = useState<'all' | 'pending' | 'complete'>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('arrivalDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  // Fullscreen Table Toggle
  const [isTableFullscreen, setIsTableFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!isTableFullscreen) {
      setIsTableFullscreen(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setIsTableFullscreen(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Filter operations by date range period
  const dateFilteredOperations = useMemo(() => {
    return operations.filter(op => 
      isOperationInPeriod(op, filterPeriod, customStartDate, customEndDate)
    );
  }, [operations, filterPeriod, customStartDate, customEndDate]);

  // Specific filtered lists for interactive cards & modals
  const waitingOps = useMemo(() => {
    return dateFilteredOperations.filter(op => op.status === 'waiting');
  }, [dateFilteredOperations]);

  const inProgressOps = useMemo(() => {
    return dateFilteredOperations.filter(op => op.status === 'in_progress');
  }, [dateFilteredOperations]);

  // Compute Overview KPIs with comparative percentage vs previous period
  const kpis = useMemo(() => {
    return calculateDecontaminationKPIs(dateFilteredOperations, filterPeriod, customStartDate, customEndDate, operations);
  }, [dateFilteredOperations, filterPeriod, customStartDate, customEndDate, operations]);

  // Generate Daily Productivity Chart Data (tanques finalizados por dia)
  const dailyProductivity = useMemo(() => {
    return generateDailyProductivityChartData(dateFilteredOperations, filterPeriod, customStartDate, customEndDate, chartHorizon);
  }, [dateFilteredOperations, filterPeriod, customStartDate, customEndDate, chartHorizon]);

  // Compute Client Indicators
  const clientIndicators = useMemo(() => {
    return calculateClientIndicators(dateFilteredOperations);
  }, [dateFilteredOperations]);

  // Sorted Client Indicators based on selected sorting option
  const sortedClientIndicators = useMemo(() => {
    const list = [...clientIndicators];
    if (clientSortOption === 'decon_desc') {
      return list.sort((a, b) => b.completedCount - a.completedCount || b.totalReceived - a.totalReceived);
    }
    if (clientSortOption === 'decon_asc') {
      return list.sort((a, b) => a.completedCount - b.completedCount || a.totalReceived - b.totalReceived);
    }
    if (clientSortOption === 'tempo_desc') {
      return list.sort((a, b) => (b.avgDeconTime ?? 0) - (a.avgDeconTime ?? 0));
    }
    if (clientSortOption === 'tempo_asc') {
      return list.sort((a, b) => {
        const valA = a.avgDeconTime === null ? 999999 : a.avgDeconTime;
        const valB = b.avgDeconTime === null ? 999999 : b.avgDeconTime;
        return valA - valB;
      });
    }
    return list;
  }, [clientIndicators, clientSortOption]);

  // Compute Model Indicators
  const modelIndicators = useMemo(() => {
    return calculateModelIndicators(dateFilteredOperations);
  }, [dateFilteredOperations]);

  // Compute Contamination Indicators
  const contaminationIndicators = useMemo(() => {
    return calculateContaminationIndicators(dateFilteredOperations);
  }, [dateFilteredOperations]);

  // Count operations with pending information (missing product or missing invoice)
  const pendingInfoCount = useMemo(() => {
    return dateFilteredOperations.filter(op => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesTank = op.equipmentNumber?.toLowerCase().includes(term);
        const matchesClient = op.client?.toLowerCase().includes(term);
        const matchesProduct = op.product?.toLowerCase().includes(term);
        const matchesInvoice = op.invoiceNumber?.toLowerCase().includes(term);
        const matchesModel = op.model?.toLowerCase().includes(term);
        if (!matchesTank && !matchesClient && !matchesProduct && !matchesInvoice && !matchesModel) {
          return false;
        }
      }
      if (selectedStatusFilter !== 'all' && op.status !== selectedStatusFilter) return false;
      if (selectedClientFilter !== 'all' && op.client !== selectedClientFilter) return false;
      if (selectedModelFilter !== 'all' && op.model !== selectedModelFilter) return false;
      if (selectedContaminationFilter === 'yes' && !op.hasContamination) return false;
      if (selectedContaminationFilter === 'no' && op.hasContamination) return false;

      return (!op.product || op.product.trim() === '') || (!op.invoiceNumber || op.invoiceNumber.trim() === '');
    }).length;
  }, [
    dateFilteredOperations, 
    searchTerm, 
    selectedStatusFilter, 
    selectedClientFilter, 
    selectedModelFilter, 
    selectedContaminationFilter
  ]);

  // Filter & Sort Operations for Main Table
  const tableFilteredOperations = useMemo(() => {
    return dateFilteredOperations.filter(op => {
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesTank = op.equipmentNumber?.toLowerCase().includes(term);
        const matchesClient = op.client?.toLowerCase().includes(term);
        const matchesProduct = op.product?.toLowerCase().includes(term);
        const matchesInvoice = op.invoiceNumber?.toLowerCase().includes(term);
        const matchesModel = op.model?.toLowerCase().includes(term);
        if (!matchesTank && !matchesClient && !matchesProduct && !matchesInvoice && !matchesModel) {
          return false;
        }
      }

      // Status filter
      if (selectedStatusFilter !== 'all' && op.status !== selectedStatusFilter) {
        return false;
      }

      // Client filter
      if (selectedClientFilter !== 'all' && op.client !== selectedClientFilter) {
        return false;
      }

      // Model filter
      if (selectedModelFilter !== 'all' && op.model !== selectedModelFilter) {
        return false;
      }

      // Contamination filter
      if (selectedContaminationFilter === 'yes' && !op.hasContamination) return false;
      if (selectedContaminationFilter === 'no' && op.hasContamination) return false;

      // Pending Info filter (Produto ou NF vazios)
      const isPending = (!op.product || op.product.trim() === '') || (!op.invoiceNumber || op.invoiceNumber.trim() === '');
      if (selectedPendingFilter === 'pending' && !isPending) return false;
      if (selectedPendingFilter === 'complete' && isPending) return false;

      return true;
    }).sort((a, b) => {
      // Primary evaluation based on chosen sort column
      if (sortField === 'arrivalDate') {
        const valA = parseDateToMillis(a.arrivalDate);
        const valB = parseDateToMillis(b.arrivalDate);
        if (valA !== valB) {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
      } else if (sortField === 'equipmentNumber') {
        const tagA = extract6DigitTag(a.equipmentNumber);
        const tagB = extract6DigitTag(b.equipmentNumber);
        if (tagA !== tagB) {
          return sortDirection === 'asc' ? tagA - tagB : tagB - tagA;
        }
      } else if (sortField === 'client') {
        const valA = a.client || '';
        const valB = b.client || '';
        if (valA !== valB) {
          const res = valA.localeCompare(valB);
          return sortDirection === 'asc' ? res : -res;
        }
      } else if (sortField === 'product') {
        const valA = a.product || '';
        const valB = b.product || '';
        if (valA !== valB) {
          const res = valA.localeCompare(valB);
          return sortDirection === 'asc' ? res : -res;
        }
      } else if (sortField === 'status') {
        const valA = a.status || '';
        const valB = b.status || '';
        if (valA !== valB) {
          const res = valA.localeCompare(valB);
          return sortDirection === 'asc' ? res : -res;
        }
      } else if (sortField === 'deconTime') {
        const valA = getDeconTimeHours(a) || 0;
        const valB = getDeconTimeHours(b) || 0;
        if (valA !== valB) {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
      }

      // Default Tie-breaker 1: Data de entrada mais recente (if sortField was not arrivalDate or dates are equal)
      const dateA = parseDateToMillis(a.arrivalDate);
      const dateB = parseDateToMillis(b.arrivalDate);
      if (dateA !== dateB) {
        return dateB - dateA; // Data de entrada mais recente primeiro
      }

      // Default Tie-breaker 2: Ordem crescente pelos 6 últimos dígitos do número do tanque
      const tagA = extract6DigitTag(a.equipmentNumber);
      const tagB = extract6DigitTag(b.equipmentNumber);
      if (tagA !== tagB) {
        return tagA - tagB; // Ordem crescente
      }

      return (a.equipmentNumber || '').localeCompare(b.equipmentNumber || '');
    });
  }, [
    dateFilteredOperations, 
    searchTerm, 
    selectedStatusFilter, 
    selectedClientFilter, 
    selectedModelFilter, 
    selectedContaminationFilter,
    selectedPendingFilter,
    sortField,
    sortDirection
  ]);

  // Paginated Operations
  const paginatedOperations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return tableFilteredOperations.slice(startIndex, startIndex + itemsPerPage);
  }, [tableFilteredOperations, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(tableFilteredOperations.length / itemsPerPage) || 1;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handlers for Quick Action Buttons
  const handleQuickStart = async (op: DecontaminationOperation) => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    await onSaveOperation({
      ...op,
      startDate: op.startDate || todayStr,
      status: 'in_progress'
    });
  };

  const handleQuickFinish = async (op: DecontaminationOperation) => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    await onSaveOperation({
      ...op,
      startDate: op.startDate || todayStr,
      endDate: todayStr,
      status: 'completed'
    });
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const cleanDate = dateStr.slice(0, 10);
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        if (year && month && day && year.length === 4) {
          return `${day}/${month}/${year}`;
        }
      }
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <Droplet className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-xl border border-blue-200/50 dark:border-blue-800/40">
                Módulo Comercial
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase mt-1">
              Gestão de Descontaminação
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
              Controle de operações, tempos de lavagem, lead time e indicadores gerenciais
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0 flex-wrap">
          <button
            onClick={() => {
              setEditingCert(null);
              setIsCertModalOpen(true);
            }}
            className="px-5 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-2.5"
            title="Criar novo certificado de descontaminação e limpeza"
          >
            <Award className="w-5 h-5" />
            <span>Novo Certificado</span>
          </button>

          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-5 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700 relative"
            title="Histórico de Certificados Emitidos"
          >
            <History className="w-5 h-5 text-slate-500" />
            <span className="hidden sm:inline">Histórico Certificados</span>
            {certificates.filter(c => c.approvalStatus === 'pending_approval').length > 0 && (
              <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-black animate-pulse" title="Certificados aguardando aprovação">
                {certificates.filter(c => c.approvalStatus === 'pending_approval').length} pendente{certificates.filter(c => c.approvalStatus === 'pending_approval').length > 1 ? 's' : ''}
              </span>
            )}
            {certificates.length > 0 && certificates.filter(c => c.approvalStatus === 'pending_approval').length === 0 && (
              <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-black">
                {certificates.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setEditingOp(null);
              setIsOpModalOpen(true);
            }}
            className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-3"
          >
            <Plus className="w-5 h-5" />
            <span>Cadastrar Operação</span>
          </button>
        </div>
      </div>

      {/* Global Date Filter Bar */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-6 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Filtrar Indicadores por Período
            </span>
          </div>

          {/* Quick Period Presets */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'week', label: 'Semana' },
              { id: 'month', label: 'Mês' },
              { id: 'quarter', label: 'Trimestre' },
              { id: 'semester', label: 'Semestre' },
              { id: 'year', label: 'Ano' },
              { id: 'custom', label: 'Personalizado' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setFilterPeriod(p.id as FilterPeriod)}
                className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  filterPeriod === p.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {filterPeriod === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/60 dark:border-slate-800">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data Início</label>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data Fim</label>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO 1: KPIS PROTAGONISTAS — RITMO MÉDIO & PICO DE PRODUÇÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
        {/* CARD PROTAGONISTA 1: RITMO MÉDIO */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 text-white p-6 sm:p-7 rounded-3xl border-2 border-teal-500/50 shadow-xl shadow-teal-950/20 relative overflow-hidden flex flex-col justify-between"
        >
          {/* Subtle Background Glow Accent */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div>
            {/* Protagonist Header Badge */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/20 border border-teal-500/30 rounded-full">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-300">
                  Indicador Principal
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative group/tip shrink-0">
                  <Info className="w-4 h-4 text-teal-400/80 hover:text-teal-300 cursor-help transition-colors" />
                  <div className="absolute right-0 bottom-full mb-2 hidden group-hover/tip:block w-64 p-3 bg-slate-950 text-white text-[11px] font-medium rounded-xl shadow-2xl border border-slate-800 z-50 pointer-events-none leading-relaxed">
                    <strong>Ritmo Médio:</strong> Tanques finalizados ÷ Dias úteis considerados no período selecionado.
                    <div className="absolute right-3 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-950" />
                  </div>
                </div>
                <div className="w-10 h-10 bg-teal-500/20 text-teal-300 rounded-xl flex items-center justify-center border border-teal-500/30">
                  <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>
            </div>

            {/* Protagonist Label */}
            <h3 className="text-xs font-black uppercase tracking-wider text-teal-200">
              Ritmo Médio de Descontaminação
            </h3>

            {/* Protagonist Giant Numeric Display */}
            <div className="mt-3 flex items-baseline gap-3 flex-wrap">
              <span className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-none">
                {formatDailyAverage(kpis.avgDailyDecon)}
              </span>
              <div className="flex flex-col">
                <span className="text-sm sm:text-base font-black uppercase tracking-wide text-teal-300">
                  tanques / dia útil
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  média diária realizada
                </span>
              </div>
            </div>
          </div>

          {/* Context & Description Footer inside Hero Card */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col gap-3">
            <p className="text-xs font-semibold text-teal-100/90 leading-relaxed">
              Média de tanques finalizados por dia útil no período.
            </p>

            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>{kpis.completedCount} finalizados em {kpis.elapsedBusinessDays} dias úteis</span>
              </div>

              {kpis.comparisons.avgDailyDecon && kpis.comparisons.avgDailyDecon.hasSufficientData && (
                <div className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg ${
                  kpis.comparisons.avgDailyDecon.isIncrease
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : !kpis.comparisons.avgDailyDecon.isNeutral
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {kpis.comparisons.avgDailyDecon.isIncrease && <ArrowUpRight className="w-3.5 h-3.5" />}
                  {!kpis.comparisons.avgDailyDecon.isIncrease && !kpis.comparisons.avgDailyDecon.isNeutral && <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span>
                    {kpis.comparisons.avgDailyDecon.isIncrease ? '+' : !kpis.comparisons.avgDailyDecon.isNeutral ? '-' : ''}
                    {kpis.comparisons.avgDailyDecon.percent}% vs. anterior
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* CARD PROTAGONISTA 2: PICO DE PRODUÇÃO */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 text-white p-6 sm:p-7 rounded-3xl border-2 border-amber-500/50 shadow-xl shadow-amber-950/20 relative overflow-hidden flex flex-col justify-between"
        >
          {/* Subtle Background Glow Accent */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div>
            {/* Protagonist Header Badge */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                  Recorde Diário
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative group/tip shrink-0">
                  <Info className="w-4 h-4 text-amber-400/80 hover:text-amber-300 cursor-help transition-colors" />
                  <div className="absolute right-0 bottom-full mb-2 hidden group-hover/tip:block w-64 p-3 bg-slate-950 text-white text-[11px] font-medium rounded-xl shadow-2xl border border-slate-800 z-50 pointer-events-none leading-relaxed">
                    <strong>Pico de Produção:</strong> Maior quantidade de tanques descontaminados em um único dia no período selecionado.
                    <div className="absolute right-3 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-950" />
                  </div>
                </div>
                <div className="w-10 h-10 bg-amber-500/20 text-amber-300 rounded-xl flex items-center justify-center border border-amber-500/30">
                  <Zap className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>
            </div>

            {/* Protagonist Label */}
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-200">
              Pico de Produção
            </h3>

            {/* Protagonist Giant Numeric Display */}
            <div className="mt-3 flex items-baseline gap-3 flex-wrap">
              <span className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-none">
                {kpis.peakDailyCount}
              </span>
              <div className="flex flex-col">
                <span className="text-sm sm:text-base font-black uppercase tracking-wide text-amber-300">
                  tanques em 1 dia
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  maior volume diário
                </span>
              </div>
            </div>
          </div>

          {/* Context & Description Footer inside Peak Card */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col gap-3">
            <p className="text-xs font-semibold text-amber-100/90 leading-relaxed">
              Maior quantidade de tanques finalizados em um único dia no período.
            </p>

            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {kpis.peakProductionDate 
                    ? `Pico registrado em ${formatDateDisplay(kpis.peakProductionDate)}` 
                    : 'Nenhum tanque concluído no período'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* SEÇÃO 2: GRÁFICO PRINCIPAL — PRODUTIVIDADE DIÁRIA DA DESCONTAMINAÇÃO */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <BarChart3 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Produtividade Diária da Descontaminação
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
              Quantidade real de tanques finalizados em cada dia no período selecionado (valores diários reais)
            </p>
          </div>

          {/* Chart View Horizon Switches */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            {[
              { id: 'weekly', label: 'Semanal' },
              { id: 'monthly', label: 'Mensal' },
              { id: 'quarterly', label: 'Trimestral' },
              { id: 'semestral', label: 'Semestral' },
              { id: 'all', label: 'Geral' }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setChartHorizon(m.id as ProductivityHorizon)}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  chartHorizon === m.id
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Line Chart */}
        <div className="h-80 w-full pt-2">
          {dailyProductivity.data.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <BarChart3 className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-xs font-bold">Nenhum registro de atividade para o período selecionado.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyProductivity.data} margin={{ top: 15, right: 30, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 11, fontWeight: 700 }}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis 
                  allowDecimals={false} 
                  tick={{ fontSize: 11, fontWeight: 700 }} 
                  domain={[0, (dataMax: number) => Math.max(3, Math.ceil(dataMax * 1.25))]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    borderRadius: '16px', 
                    border: '1px solid #334155',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as DailyProductivityPoint;
                      return (
                        <div className="p-3 bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-2xl space-y-1">
                          <div className="text-[11px] font-black uppercase text-slate-400 flex items-center justify-between gap-4">
                            <span>{data.fullDate} ({data.dayOfWeek})</span>
                            <span className={data.isBusinessDay ? 'text-emerald-400' : 'text-slate-500'}>
                              {data.isBusinessDay ? 'Dia Útil' : 'Fim de Semana / Feriado'}
                            </span>
                          </div>
                          <div className="text-sm font-black text-teal-400 flex items-center gap-2">
                            <span>{data.finalizados} {data.finalizados === 1 ? 'tanque descontaminado' : 'tanques descontaminados'}</span>
                            {data.isPeak && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30">
                                PICO
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="finalizados" 
                  name="Tanques Descontaminados" 
                  stroke="#0d9488" 
                  strokeWidth={3} 
                  dot={{ r: 3.5, stroke: '#0d9488', strokeWidth: 2, fill: '#ffffff' }}
                  activeDot={{ r: 6, stroke: '#0f766e', strokeWidth: 2.5, fill: '#2dd4bf' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* SEÇÃO 3: CARDS OPERACIONAIS DE CONTEXTO */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-stretch">
        {/* Card 1: Tanques Recebidos */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between min-h-[140px]"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate pr-1">
                Tanques Recebidos
              </span>
              <div className="w-8 h-8 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl flex items-center justify-center border border-sky-500/20 shrink-0">
                <Truck className="w-4 h-4" />
              </div>
            </div>

            <div className="my-1">
              <span className="text-3xl font-black text-sky-600 dark:text-sky-400 tracking-tight leading-none">
                {kpis.totalReceived}
              </span>
            </div>
          </div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-2 leading-snug">
            Chegaram à base no período
          </p>
        </motion.div>

        {/* Card 2: Tanques Descontaminados */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between min-h-[140px]"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate pr-1">
                Descontaminados
              </span>
              <div className="w-8 h-8 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="my-1">
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">
                {kpis.completedCount}
              </span>
            </div>
          </div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-2 leading-snug">
            Finalizados no período
          </p>
        </motion.div>

        {/* Card 3: Aguardando Descontaminação (CLICÁVEL / INTERATIVO) */}
        <motion.button 
          type="button"
          onClick={() => setIsWaitingModalOpen(true)}
          whileHover={{ y: -3, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border-2 border-amber-500/40 dark:border-amber-500/40 hover:border-amber-500 shadow-sm hover:shadow-lg hover:shadow-amber-500/10 flex flex-col justify-between min-h-[140px] text-left cursor-pointer transition-all relative overflow-hidden group"
        >
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-500 text-white rounded-md">
              Ver lista
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 truncate pr-1">
                Aguardando
              </span>
              <div className="w-8 h-8 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20 shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="my-1 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight leading-none">
                {kpis.waitingCount}
              </span>
              <span className="text-[10px] font-bold text-amber-600/70 dark:text-amber-400/70">
                tanques
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-100 dark:border-amber-950/60 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            <span>Clique para ver fila</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </motion.button>

        {/* Card 4: Em Descontaminação (CLICÁVEL / INTERATIVO) */}
        <motion.button 
          type="button"
          onClick={() => setIsInProgressModalOpen(true)}
          whileHover={{ y: -3, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border-2 border-blue-500/40 dark:border-blue-500/40 hover:border-blue-500 shadow-sm hover:shadow-lg hover:shadow-blue-500/10 flex flex-col justify-between min-h-[140px] text-left cursor-pointer transition-all relative overflow-hidden group"
        >
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-500 text-white rounded-md">
              Ver lista
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 truncate pr-1">
                Em Descontaminação
              </span>
              <div className="w-8 h-8 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/20 shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4 group-hover:animate-spin" />
              </div>
            </div>

            <div className="my-1 flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight leading-none">
                {kpis.inProgressCount}
              </span>
              <span className="text-[10px] font-bold text-blue-600/70 dark:text-blue-400/70">
                em processo
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-100 dark:border-blue-950/60 text-[10px] font-bold text-blue-700 dark:text-blue-300">
            <span>Clique para ver tanques</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </motion.button>

        {/* Card 5: Prazo Médio */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between min-h-[140px]"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate pr-1">
                Prazo Médio
              </span>
              <div className="w-8 h-8 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center border border-purple-500/20 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>

            <div className="my-1">
              <span className="text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tight leading-none">
                {formatDays(kpis.avgDeconTimeHours)}
              </span>
            </div>
          </div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-2 leading-snug">
            Início → Fim em dias úteis
          </p>
        </motion.div>
      </div>

      {/* INDICADORES & RANKINGS SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <PieChartIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
              Análise Específica de Descontaminação
            </h2>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => setActiveIndicatorTab('clients')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeIndicatorTab === 'clients'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Indicadores por Cliente</span>
            </button>

            <button
              onClick={() => setActiveIndicatorTab('models')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeIndicatorTab === 'models'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Container className="w-4 h-4" />
              <span>Indicadores por Modelo</span>
            </button>

            <button
              onClick={() => setActiveIndicatorTab('contamination')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeIndicatorTab === 'contamination'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Contaminação</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Indicadores por Cliente */}
        {activeIndicatorTab === 'clients' && (
          <div className="space-y-6">
            {/* Sorting Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-blue-600" />
                Ordenar Tabela de Clientes por:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'decon_desc', label: 'Maior Qtde. Descontaminações' },
                  { id: 'decon_asc', label: 'Menor Qtde. Descontaminações' },
                  { id: 'tempo_desc', label: 'Maior Tempo Médio' },
                  { id: 'tempo_asc', label: 'Menor Tempo Médio' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setClientSortOption(opt.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                      clientSortOption === opt.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart */}
              <div className="lg:col-span-1 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">
                  Top Clientes por Descontaminações Concluídas
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedClientIndicators.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="client" type="category" width={90} tick={{ fontSize: 10, fontWeight: 700 }} />
                      <Tooltip />
                      <Bar dataKey="completedCount" name="Descontaminações" fill="#10b981" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table */}
              <div className="lg:col-span-2 overflow-x-auto">
                <table className="w-full text-left text-xs font-bold">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3.5">Cliente</th>
                      <th className="p-3.5 text-center">Operações Registradas</th>
                      <th className="p-3.5 text-center">Tanques Descontaminados</th>
                      <th className="p-3.5 text-center">Tempo Médio de Descontaminação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {sortedClientIndicators.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400">Nenhum registro para o período.</td>
                      </tr>
                    ) : (
                      sortedClientIndicators.map(ci => (
                        <tr key={ci.client} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3.5 text-slate-900 dark:text-white font-black uppercase">{ci.client}</td>
                          <td className="p-3.5 text-center text-slate-700 dark:text-slate-300">{ci.totalReceived}</td>
                          <td className="p-3.5 text-center text-emerald-600 dark:text-emerald-400 font-black">{ci.completedCount}</td>
                          <td className="p-3.5 text-center text-purple-600 dark:text-purple-400 font-black">{formatDays(ci.avgDeconTime)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Indicadores por Modelo */}
        {activeIndicatorTab === 'models' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {['TANQUE DE 1325L', 'TANQUE DE 1500L', 'TANQUE DE 5000L', 'TANQUE DE 5200L'].map(modelTag => {
                const info = modelIndicators.find(m => m.model === modelTag) || {
                  model: modelTag,
                  totalReceived: 0,
                  completedCount: 0,
                  avgWaitTime: null,
                  avgDeconTime: null,
                  avgLeadTime: null
                };

                return (
                  <div key={modelTag} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                      <span className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">
                        {modelTag}
                      </span>
                      <span className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black">
                        {info.totalReceived} ops
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-bold pt-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tanques Descontaminados:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-black">{info.completedCount}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                        <span className="text-slate-400">Tempo Médio Descontaminação:</span>
                        <span className="text-purple-600 dark:text-purple-400 font-black">{formatDays(info.avgDeconTime)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Complete Models Table */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3.5">Modelo</th>
                    <th className="p-3.5 text-center">Operações Registradas</th>
                    <th className="p-3.5 text-center">Tanques Descontaminados</th>
                    <th className="p-3.5 text-center">Tempo Médio de Descontaminação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {modelIndicators.map(mi => (
                    <tr key={mi.model} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3.5 text-slate-900 dark:text-white font-black uppercase">{mi.model}</td>
                      <td className="p-3.5 text-center text-slate-700 dark:text-slate-300">{mi.totalReceived}</td>
                      <td className="p-3.5 text-center text-emerald-600 dark:text-emerald-400 font-black">{mi.completedCount}</td>
                      <td className="p-3.5 text-center text-purple-600 dark:text-purple-400 font-black">{formatDays(mi.avgDeconTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Indicadores de Contaminação */}
        {activeIndicatorTab === 'contamination' && (
          <div className="space-y-6">
            {/* Contamination Count Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 p-6 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center font-black shadow-lg shadow-rose-500/20">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-rose-900 dark:text-rose-200 tracking-tight">
                      Com Contaminação (SIM)
                    </h3>
                    <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                      Operações com contaminação confirmada
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
                    {contaminationIndicators.totalContaminatedCount}
                  </span>
                  <span className="block text-[10px] font-black uppercase text-rose-500">tanques</span>
                </div>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 p-6 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center font-black shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-emerald-900 dark:text-emerald-200 tracking-tight">
                      Sem Contaminação (NÃO)
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                      Operações sem contaminação
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    {contaminationIndicators.nonContaminatedCount}
                  </span>
                  <span className="block text-[10px] font-black uppercase text-emerald-500">tanques</span>
                </div>
              </div>
            </div>

            {/* Ranking Clientes com Contaminação */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-rose-600" />
                Ranking de Clientes com Maior Número de Operações Contaminadas
              </h4>
              <div className="space-y-2">
                {contaminationIndicators.topContaminatedClients.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 text-center">Nenhuma contaminação registrada no período.</p>
                ) : (
                  contaminationIndicators.topContaminatedClients.map((item, idx) => (
                    <div key={item.client} className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs font-black rounded-lg flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{item.client}</span>
                      </div>
                      <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                        {item.count} tanques contaminados
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* OPERATIONAL TABLE SECTION */}
      <div className={
        isTableFullscreen
          ? "fixed inset-0 z-50 bg-white dark:bg-slate-900 p-6 md:p-8 overflow-y-auto space-y-6 flex flex-col h-screen w-screen"
          : "bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 p-6 md:p-8 shadow-sm space-y-6"
      }>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Tabela Operacional de Descontaminação ({tableFilteredOperations.length})
              </h2>
              {pendingInfoCount > 0 && (
                <button
                  onClick={() => {
                    setSelectedPendingFilter(prev => (prev === 'pending' ? 'all' : 'pending'));
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase transition-all shadow-xs ${
                    selectedPendingFilter === 'pending'
                      ? 'bg-amber-500 text-white shadow-amber-500/20'
                      : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                  }`}
                  title="Clique para filtrar apenas operações com Informações Pendentes"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{pendingInfoCount} Info. Pendente{pendingInfoCount > 1 ? 's' : ''}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 font-bold">
              Clique no TAG do tanque para abrir a Ficha Técnica e histórico do equipamento
            </p>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            {/* Instant Search Bar */}
            <div className="relative flex-1 lg:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por tanque, cliente, produto, NF..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Fullscreen Toggle Button */}
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-2xl text-xs font-black uppercase transition-all shrink-0 shadow-xs active:scale-95"
              title={isTableFullscreen ? "Sair do modo Tela Cheia" : "Expandir em Tela Cheia"}
            >
              {isTableFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="hidden sm:inline">Sair Tela Cheia</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="hidden sm:inline">Tela Cheia</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dropdown Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 mr-1">
              <Filter className="w-4 h-4 text-blue-600" />
              <span>Filtros:</span>
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={e => {
                setSelectedStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="waiting">Aguardando Descontaminação</option>
              <option value="in_progress">Em Descontaminação</option>
              <option value="completed">Descontaminado</option>
            </select>

            {/* Contamination Filter */}
            <select
              value={selectedContaminationFilter}
              onChange={e => {
                setSelectedContaminationFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="all">Contaminação: Todas</option>
              <option value="yes">Contaminação: SIM</option>
              <option value="no">Contaminação: NÃO</option>
            </select>

            {/* Client Filter */}
            <select
              value={selectedClientFilter}
              onChange={e => {
                setSelectedClientFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="all">Todos os Clientes</option>
              {TANK_CLIENTS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Model Filter */}
            <select
              value={selectedModelFilter}
              onChange={e => {
                setSelectedModelFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="all">Todos os Modelos</option>
              <option value="TANQUE DE 1325L">TANQUE DE 1325L</option>
              <option value="TANQUE DE 1500L">TANQUE DE 1500L</option>
              <option value="TANQUE DE 5000L">TANQUE DE 5000L</option>
              <option value="TANQUE DE 5200L">TANQUE DE 5200L</option>
            </select>

            {/* Pending Info Filter */}
            <select
              value={selectedPendingFilter}
              onChange={e => {
                setSelectedPendingFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-2 border rounded-xl text-xs font-bold transition-all focus:outline-none ${
                selectedPendingFilter === 'pending'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/40 font-black'
                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700'
              }`}
            >
              <option value="all">Informações: Todas</option>
              <option value="pending">⚠️ Informações Pendentes {pendingInfoCount > 0 ? `(${pendingInfoCount})` : ''}</option>
              <option value="complete">Informações Completas</option>
            </select>

            {(selectedStatusFilter !== 'all' || selectedClientFilter !== 'all' || selectedModelFilter !== 'all' || selectedContaminationFilter !== 'all' || selectedPendingFilter !== 'all') && (
              <button
                onClick={() => {
                  setSelectedStatusFilter('all');
                  setSelectedClientFilter('all');
                  setSelectedModelFilter('all');
                  setSelectedContaminationFilter('all');
                  setSelectedPendingFilter('all');
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-rose-600 hover:text-rose-700 font-bold text-xs uppercase"
              >
                Limpar Filtros
              </button>
            )}
          </div>

          {/* Items Per Page Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">Itens por página:</span>
            <select
              value={itemsPerPage}
              onChange={e => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>Todos</option>
            </select>
          </div>
        </div>

        {/* Main Table with Sticky Header */}
        <div className={`overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-y-auto ${
          isTableFullscreen ? 'flex-1 max-h-none' : 'max-h-[600px]'
        }`}>
          <table className="w-full text-left text-xs font-bold relative">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 shadow-xs">
              <tr className="text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                <th className="p-3.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('equipmentNumber')}>
                  <div className="flex items-center gap-1">
                    <span>Número Tanque</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5">Modelo</th>
                <th className="p-3.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('client')}>
                  <div className="flex items-center gap-1">
                    <span>Cliente</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('product')}>
                  <div className="flex items-center gap-1">
                    <span>Produto</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5">NF</th>
                <th className="p-3.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('arrivalDate')}>
                  <div className="flex items-center gap-1">
                    <span>Chegada Base</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5">Início</th>
                <th className="p-3.5">Finalização</th>
                <th className="p-3.5 text-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('deconTime')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Tempo Descont. (dias)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5 text-center">Contam.</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 whitespace-nowrap">
              {paginatedOperations.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-400">
                    Nenhuma operação de descontaminação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedOperations.map(op => {
                  const deconHours = getDeconTimeHours(op);

                  const isMissingProduct = !op.product || op.product.trim() === '';
                  const isMissingInvoice = !op.invoiceNumber || op.invoiceNumber.trim() === '';
                  const isPending = isMissingProduct || isMissingInvoice;

                  // Standardized Status Badge Mapping
                  // Aguardando -> Yellow (amber)
                  // Em Descontaminação -> Blue
                  // Descontaminado -> Green (emerald)
                  const statusColor =
                    op.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : op.status === 'in_progress'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';

                  const statusLabel =
                    op.status === 'completed'
                      ? 'Descontaminado'
                      : op.status === 'in_progress'
                      ? 'Em Descontaminação'
                      : 'Aguardando';

                  return (
                    <tr key={op.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Clickable Tank Tag opening History Modal */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedTankForHistory(op.equipmentNumber)}
                            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-600 dark:text-blue-400 font-black text-xs uppercase transition-all flex items-center gap-1.5 shadow-xs"
                            title="Clique para ver o histórico completo do tanque"
                          >
                            <span>{op.equipmentNumber}</span>
                            <History className="w-3.5 h-3.5" />
                          </button>
                          {op.isOegFleet ? (
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-lg text-[9px] font-black uppercase">
                              OEG
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg text-[9px] font-black uppercase">
                              Terceiro
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg text-[9px] font-black uppercase flex items-center gap-1" title="Informações Pendentes (Produto ou NF)">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                              <span>Inf. Pendente</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-700 dark:text-slate-300 font-black uppercase">{op.model}</td>
                      <td className="p-3.5 text-slate-900 dark:text-white uppercase">{op.client || '—'}</td>
                      
                      {/* Product Cell */}
                      <td className="p-3.5 text-slate-700 dark:text-slate-300 uppercase">
                        {isMissingProduct ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-black uppercase">
                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>Produto não informado</span>
                          </span>
                        ) : (
                          op.product
                        )}
                      </td>

                      {/* Invoice Cell */}
                      <td className="p-3.5 text-slate-500 uppercase">
                        {isMissingInvoice ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-black uppercase">
                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>NF não informada</span>
                          </span>
                        ) : (
                          op.invoiceNumber
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400">{formatDateDisplay(op.arrivalDate)}</td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400">{formatDateDisplay(op.startDate)}</td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400">{formatDateDisplay(op.endDate)}</td>

                      {/* Computed Time */}
                      <td className="p-3.5 text-center text-purple-600 dark:text-purple-400 font-black">{formatDays(deconHours)}</td>

                      {/* Contamination Tag */}
                      <td className="p-3.5 text-center">
                        {op.hasContamination ? (
                          <span className="px-2.5 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-black uppercase">
                            SIM
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black uppercase">
                            NÃO
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </td>

                      {/* Quick Actions & Edit/Delete */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {op.status === 'waiting' && (
                            <button
                              onClick={() => handleQuickStart(op)}
                              className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                              title="Iniciar Descontaminação"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Iniciar</span>
                            </button>
                          )}

                          {op.status === 'in_progress' && (
                            <button
                              onClick={() => handleQuickFinish(op)}
                              className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/30 text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                              title="Finalizar Descontaminação"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Finalizar</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEditingOp(op);
                              setIsOpModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Editar Operação"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {canDelete && (
                            <button
                              onClick={() => {
                                if (userRole === 'admin' && onRequestDelete) {
                                  onRequestDelete('Operação de Descontaminação', op.id, 'decontaminationOperations', op.equipmentNumber || 'Tanque');
                                } else if (userRole === 'moderator') {
                                  onDeleteOperation(op.id);
                                } else if (onRequestDelete) {
                                  onRequestDelete('Operação de Descontaminação', op.id, 'decontaminationOperations', op.equipmentNumber || 'Tanque');
                                } else {
                                  onDeleteOperation(op.id);
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Excluir Operação"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-bold">
              Mostrando página {currentPage} de {totalPages} ({tableFilteredOperations.length} registros no total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                Math.max(0, currentPage - 3),
                Math.min(totalPages, currentPage + 2)
              ).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Operation Create/Edit Modal */}
      <DecontaminationModal
        isOpen={isOpModalOpen}
        onClose={() => {
          setIsOpModalOpen(false);
          setEditingOp(null);
        }}
        onSave={onSaveOperation}
        editingOperation={editingOp}
        fleetEquipments={fleetEquipments}
        clients={clients}
      />

      {/* Tank History Modal */}
      <TankHistoryModal
        isOpen={Boolean(selectedTankForHistory)}
        onClose={() => setSelectedTankForHistory(null)}
        equipmentNumber={selectedTankForHistory}
        operations={operations}
      />

      {/* Decontamination Certificate Modal (Standalone / Edit Mode) */}
      <DecontaminationCertificateModal
        isOpen={isCertModalOpen}
        onClose={() => {
          setIsCertModalOpen(false);
          setEditingCert(null);
        }}
        editingCertificate={editingCert}
        allOperations={operations}
        existingCertificates={certificates}
        clients={clients}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
        currentUserSignatureUrl={currentUserSignatureUrl}
        currentUserJobTitle={currentUserJobTitle}
        userRole={userRole}
        logoUrl={logoUrl}
        onSaveCertificate={handleSaveCertificate}
      />

      {/* Decontamination Certificate History Modal */}
      <DecontaminationCertificateHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        certificates={certificates}
        canDelete={canDelete}
        userRole={userRole}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
        currentUserSignatureUrl={currentUserSignatureUrl}
        currentUserJobTitle={currentUserJobTitle}
        logoUrl={logoUrl}
        onDeleteCertificate={handleDeleteCertificate}
        onRequestDelete={onRequestDelete}
        onApproveCertificate={handleApproveCertificate}
        onEditCertificate={(cert) => {
          setEditingCert(cert);
          setIsHistoryModalOpen(false);
          setIsCertModalOpen(true);
        }}
      />

      {/* Modal: Lista de Tanques Aguardando Descontaminação */}
      <AnimatePresence>
        {isWaitingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Aguardando Descontaminação — {waitingOps.length} {waitingOps.length === 1 ? 'tanque' : 'tanques'}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Tanques na fila aguardando início do processo de lavagem
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsWaitingModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* List Content */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 divide-y divide-slate-100 dark:divide-slate-800/60">
                {waitingOps.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-bold">Nenhum tanque aguardando descontaminação no momento.</p>
                  </div>
                ) : (
                  waitingOps.map(op => {
                    const daysWaiting = calculateDurationDays(op.arrivalDate, todayStr);
                    return (
                      <div
                        key={op.id}
                        onClick={() => {
                          setEditingOp(op);
                          setIsWaitingModalOpen(false);
                          setIsOpModalOpen(true);
                        }}
                        className="pt-3 first:pt-0 group cursor-pointer p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                              {op.equipmentNumber}
                            </span>
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                              Aguardando
                            </span>
                            {op.model && (
                              <span className="text-[10px] font-bold text-slate-400">
                                ({op.model})
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 dark:text-slate-300 font-bold truncate">
                            Cliente: <span className="text-slate-900 dark:text-white">{op.client || 'Não Informado'}</span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex-wrap">
                            <span>Recebido: <strong>{formatDateDisplay(op.arrivalDate)}</strong></span>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              Fila: {formatDays(daysWaiting)} {daysWaiting === 1 ? 'útil' : 'úteis'}
                            </span>
                            {op.product && (
                              <>
                                <span>•</span>
                                <span>Produto: <strong className="text-slate-700 dark:text-slate-300">{op.product}</strong></span>
                              </>
                            )}
                            {op.hasContamination && (
                              <>
                                <span>•</span>
                                <span className="text-rose-500 font-bold">Apresentou Contaminação</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1 text-xs font-black text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          <span className="hidden sm:inline">Ver / Editar</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Total de {waitingOps.length} {waitingOps.length === 1 ? 'tanque' : 'tanques'} na fila
                </span>
                <button
                  onClick={() => setIsWaitingModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Lista de Tanques Em Descontaminação */}
      <AnimatePresence>
        {isInProgressModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
                    <RefreshCw className="w-5 h-5 animate-spin-slow" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Em Descontaminação — {inProgressOps.length} {inProgressOps.length === 1 ? 'tanque' : 'tanques'}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Tanques atualmente em processo de lavagem e descontaminação
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsInProgressModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* List Content */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 divide-y divide-slate-100 dark:divide-slate-800/60">
                {inProgressOps.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <RefreshCw className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-bold">Nenhum tanque em descontaminação no momento.</p>
                  </div>
                ) : (
                  inProgressOps.map(op => {
                    const startRefDate = op.startDate || op.arrivalDate;
                    const daysElapsed = calculateDurationDays(startRefDate, todayStr);
                    return (
                      <div
                        key={op.id}
                        onClick={() => {
                          setEditingOp(op);
                          setIsInProgressModalOpen(false);
                          setIsOpModalOpen(true);
                        }}
                        className="pt-3 first:pt-0 group cursor-pointer p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {op.equipmentNumber}
                            </span>
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                              Em lavagem
                            </span>
                            {op.model && (
                              <span className="text-[10px] font-bold text-slate-400">
                                ({op.model})
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 dark:text-slate-300 font-bold truncate">
                            Cliente: <span className="text-slate-900 dark:text-white">{op.client || 'Não Informado'}</span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex-wrap">
                            <span>Início: <strong>{formatDateDisplay(op.startDate || op.arrivalDate)}</strong></span>
                            <span>•</span>
                            <span className="text-blue-600 dark:text-blue-400 font-bold">
                              Em andamento há: {formatDays(daysElapsed)} {daysElapsed === 1 ? 'útil' : 'úteis'}
                            </span>
                            {op.product && (
                              <>
                                <span>•</span>
                                <span>Produto: <strong className="text-slate-700 dark:text-slate-300">{op.product}</strong></span>
                              </>
                            )}
                            {op.hasContamination && (
                              <>
                                <span>•</span>
                                <span className="text-rose-500 font-bold">Apresentou Contaminação</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1 text-xs font-black text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          <span className="hidden sm:inline">Ver / Concluir</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Total de {inProgressOps.length} {inProgressOps.length === 1 ? 'tanque' : 'tanques'} em andamento
                </span>
                <button
                  onClick={() => setIsInProgressModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
