import React, { useState, useMemo } from 'react';
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
  Package, 
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
  Minimize2
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
  Area
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

import { FleetEquipment } from '../types/fleet';
import { 
  DecontaminationOperation, 
  DecontaminationStatus, 
  FilterPeriod, 
  DecontaminationFilter,
  TANK_CLIENTS
} from '../types/decontamination';
import { 
  getWaitTimeHours, 
  getDeconTimeHours, 
  getLeadTimeHours, 
  formatHours, 
  isOperationInPeriod, 
  calculateDecontaminationKPIs, 
  calculateClientIndicators, 
  calculateModelIndicators, 
  calculateProductIndicators, 
  calculateContaminationIndicators,
  generateEvolutionChartData,
  EvolutionChartMode
} from '../utils/decontaminationUtils';
import { DecontaminationModal } from './DecontaminationModal';
import { TankHistoryModal } from './TankHistoryModal';

interface DecontaminationManagementProps {
  operations: DecontaminationOperation[];
  fleetEquipments: FleetEquipment[];
  clients: { id: string; razaoSocial: string }[];
  onSaveOperation: (operation: Partial<DecontaminationOperation>) => Promise<void>;
  onDeleteOperation: (id: string) => Promise<void>;
}

type SortField = 'arrivalDate' | 'equipmentNumber' | 'client' | 'product' | 'status' | 'waitTime' | 'leadTime';

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
  onSaveOperation,
  onDeleteOperation
}: DecontaminationManagementProps) {
  // Modal states
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<DecontaminationOperation | null>(null);
  const [selectedTankForHistory, setSelectedTankForHistory] = useState<string | null>(null);

  // Active view tab for indicators & rankings section
  const [activeIndicatorTab, setActiveIndicatorTab] = useState<'clients' | 'models' | 'contamination'>('clients');

  // Chart mode
  const [chartMode, setChartMode] = useState<EvolutionChartMode>('monthly');

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

  // Compute Overview KPIs with comparative percentage vs previous period
  const kpis = useMemo(() => {
    return calculateDecontaminationKPIs(dateFilteredOperations, filterPeriod, customStartDate, customEndDate);
  }, [dateFilteredOperations, filterPeriod, customStartDate, customEndDate]);

  // Generate Evolution Chart Data
  const chartData = useMemo(() => {
    return generateEvolutionChartData(dateFilteredOperations, chartMode);
  }, [dateFilteredOperations, chartMode]);

  // Compute Client Indicators
  const clientIndicators = useMemo(() => {
    return calculateClientIndicators(dateFilteredOperations);
  }, [dateFilteredOperations]);

  // Compute Model Indicators
  const modelIndicators = useMemo(() => {
    return calculateModelIndicators(dateFilteredOperations);
  }, [dateFilteredOperations]);

  // Compute Product Indicators
  const productIndicators = useMemo(() => {
    return calculateProductIndicators(dateFilteredOperations);
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
      } else if (sortField === 'waitTime') {
        const valA = getWaitTimeHours(a) || 0;
        const valB = getWaitTimeHours(b) || 0;
        if (valA !== valB) {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
      } else if (sortField === 'leadTime') {
        const valA = getLeadTimeHours(a) || 0;
        const valB = getLeadTimeHours(b) || 0;
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

  // Helper for Comparative Badge
  const renderComparisonBadge = (comp: { percent: number; isIncrease: boolean; isNeutral: boolean } | null, inverseColors = false) => {
    if (!comp || comp.isNeutral) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
          <Minus className="w-3 h-3" /> 0% vs ant.
        </span>
      );
    }

    const isGood = inverseColors ? !comp.isIncrease : comp.isIncrease;
    const colorClasses = isGood
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50'
      : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/50';

    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${colorClasses}`}>
        {comp.isIncrease ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {comp.isIncrease ? '+' : '-'}{comp.percent}% vs ant.
      </span>
    );
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

        <div className="flex items-center gap-3 relative z-10 shrink-0">
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
              { id: 'today', label: 'Hoje' },
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

      {/* DASHBOARD TIER 1: 4 MAIN PROMINENT KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Tanques Recebidos (Blue) */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white dark:bg-slate-900 p-7 rounded-[32px] border-2 border-blue-500/20 dark:border-blue-500/30 shadow-md relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tanques Recebidos
            </span>
            <div className="w-12 h-12 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <Container className="w-6 h-6" />
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              {kpis.totalReceived}
            </span>
            {renderComparisonBadge(kpis.comparisons.received)}
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-2">
            Operações registradas na base
          </p>
        </motion.div>

        {/* Card 2: Descontaminações Concluídas (Green) */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white dark:bg-slate-900 p-7 rounded-[32px] border-2 border-emerald-500/20 dark:border-emerald-500/30 shadow-md relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Descontaminações Concluídas
            </span>
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {kpis.completedCount}
            </span>
            {renderComparisonBadge(kpis.comparisons.completed)}
          </div>
          <p className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 mt-2">
            {kpis.completionRatePercent.toFixed(0)}% da demanda finalizada
          </p>
        </motion.div>

        {/* Card 3: Aguardando Descontaminação (Yellow / Amber) */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white dark:bg-slate-900 p-7 rounded-[32px] border-2 border-amber-500/20 dark:border-amber-500/30 shadow-md relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Aguardando Descontaminação
            </span>
            <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/20">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-4xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {kpis.waitingCount}
            </span>
            {renderComparisonBadge(kpis.comparisons.waiting, true)}
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-2">
            Tanques na fila de espera
          </p>
        </motion.div>

        {/* Card 4: Em Descontaminação (Blue) */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white dark:bg-slate-900 p-7 rounded-[32px] border-2 border-blue-500/20 dark:border-blue-500/30 shadow-md relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Em Descontaminação
            </span>
            <div className="w-12 h-12 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <RefreshCw className="w-6 h-6 animate-spin-slow" />
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
              {kpis.inProgressCount}
            </span>
            {renderComparisonBadge(kpis.comparisons.inProgress)}
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-2">
            Processo de lavagem ativo
          </p>
        </motion.div>
      </div>

      {/* DASHBOARD TIER 2: 3 TIME KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Tempo Médio de Espera */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-[28px] text-white border border-slate-800 shadow-xl relative overflow-hidden">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Tempo Médio de Espera</p>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black tracking-tight text-white">
              {formatHours(kpis.avgWaitTimeHours)}
            </span>
            {renderComparisonBadge(kpis.comparisons.avgWait, true)}
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-2">
            Tempo da Chegada até Início da Lavagem
          </p>
        </div>

        {/* Tempo Médio de Descontaminação */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-[28px] text-white border border-slate-800 shadow-xl relative overflow-hidden">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">Tempo Médio de Descontaminação</p>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black tracking-tight text-white">
              {formatHours(kpis.avgDeconTimeHours)}
            </span>
            {renderComparisonBadge(kpis.comparisons.avgDecon, true)}
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-2">
            Duração do Processo de Lavagem/Descontaminação
          </p>
        </div>

        {/* Lead Time Médio Total */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-[28px] text-white border border-slate-800 shadow-xl relative overflow-hidden">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">Lead Time Médio Total</p>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black tracking-tight text-white">
              {formatHours(kpis.avgLeadTimeHours)}
            </span>
            {renderComparisonBadge(kpis.comparisons.avgLead, true)}
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-2">
            Tempo Total da Chegada até Finalização Completa
          </p>
        </div>
      </div>

      {/* EVOLUTION CHARTS SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Evolução Temporal das Operações
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              Acompanhamento gráfico comparativo do fluxo de tanques recebidos e descontaminados
            </p>
          </div>

          {/* Chart View Toggles */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            {[
              { id: 'rx_vs_dc', label: 'Recebidos x Descontaminados' },
              { id: 'weekly', label: 'Semanal' },
              { id: 'monthly', label: 'Mensal' },
              { id: 'quarterly', label: 'Trimestral' },
              { id: 'semestral', label: 'Semestral' }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setChartMode(m.id as EvolutionChartMode)}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  chartMode === m.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Chart */}
        <div className="h-80 w-full pt-2">
          {chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <BarChart3 className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-xs font-bold">Nenhum dado registrado para o período e agrupamento selecionado.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fontWeight: 700 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    borderRadius: '16px', 
                    border: '1px solid #334155',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontWeight: 'bold' }} />
                <Bar dataKey="recebidos" name="Tanques Recebidos" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="descontaminados" name="Descontaminados Concluídos" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="emAndamento" name="Em Andamento / Fila" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* INDICADORES & RANKINGS SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <PieChartIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
              Indicadores Gerenciais e Rankings
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
              <span>Por Cliente</span>
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
              <span>Por Modelo</span>
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart */}
              <div className="lg:col-span-1 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">
                  Top Clientes por Tanques Recebidos
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clientIndicators.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="client" type="category" width={90} tick={{ fontSize: 10, fontWeight: 700 }} />
                      <Tooltip />
                      <Bar dataKey="totalReceived" name="Recebidos" fill="#3b82f6" radius={[0, 8, 8, 0]} />
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
                      <th className="p-3.5 text-center">Recebidos</th>
                      <th className="p-3.5 text-center">Concluídos</th>
                      <th className="p-3.5 text-center">Tempo Médio Espera</th>
                      <th className="p-3.5 text-center">Tempo Médio Descont.</th>
                      <th className="p-3.5 text-center">Lead Time Médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {clientIndicators.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">Nenhum registro para o período.</td>
                      </tr>
                    ) : (
                      clientIndicators.map(ci => (
                        <tr key={ci.client} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3.5 text-slate-900 dark:text-white font-black uppercase">{ci.client}</td>
                          <td className="p-3.5 text-center text-slate-700 dark:text-slate-300">{ci.totalReceived}</td>
                          <td className="p-3.5 text-center text-emerald-600 dark:text-emerald-400">{ci.completedCount}</td>
                          <td className="p-3.5 text-center text-slate-600 dark:text-slate-400">{formatHours(ci.avgWaitTime)}</td>
                          <td className="p-3.5 text-center text-slate-600 dark:text-slate-400">{formatHours(ci.avgDeconTime)}</td>
                          <td className="p-3.5 text-center text-blue-600 dark:text-blue-400 font-black">{formatHours(ci.avgLeadTime)}</td>
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
                        <span className="text-slate-400">Descontaminados:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{info.completedCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tempo Médio Espera:</span>
                        <span className="text-slate-700 dark:text-slate-300">{formatHours(info.avgWaitTime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tempo Descontaminação:</span>
                        <span className="text-slate-700 dark:text-slate-300">{formatHours(info.avgDeconTime)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                        <span className="text-slate-400">Lead Time Médio:</span>
                        <span className="text-blue-600 dark:text-blue-400 font-black">{formatHours(info.avgLeadTime)}</span>
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
                    <th className="p-3.5 text-center">Quantidade Total</th>
                    <th className="p-3.5 text-center">Concluídas</th>
                    <th className="p-3.5 text-center">Tempo Médio Espera</th>
                    <th className="p-3.5 text-center">Tempo Médio Descontaminação</th>
                    <th className="p-3.5 text-center">Lead Time Médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {modelIndicators.map(mi => (
                    <tr key={mi.model} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3.5 text-slate-900 dark:text-white font-black uppercase">{mi.model}</td>
                      <td className="p-3.5 text-center text-slate-700 dark:text-slate-300">{mi.totalReceived}</td>
                      <td className="p-3.5 text-center text-emerald-600 dark:text-emerald-400">{mi.completedCount}</td>
                      <td className="p-3.5 text-center text-slate-600 dark:text-slate-400">{formatHours(mi.avgWaitTime)}</td>
                      <td className="p-3.5 text-center text-slate-600 dark:text-slate-400">{formatHours(mi.avgDeconTime)}</td>
                      <td className="p-3.5 text-center text-blue-600 dark:text-blue-400 font-black">{formatHours(mi.avgLeadTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Indicadores de Contaminação */}
        {activeIndicatorTab === 'contamination' && (
          <div className="space-y-6">
            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 p-6 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center font-black shadow-lg shadow-rose-500/20">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-rose-900 dark:text-rose-200 tracking-tight">
                    Total de Tanques com Contaminação Confirmada
                  </h3>
                  <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                    Apenas contagem exata de operações onde Contaminação = SIM
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
                  {contaminationIndicators.totalContaminatedCount}
                </span>
                <span className="block text-[10px] font-black uppercase text-rose-500">tanques contaminados</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ranking Clientes com Contaminação */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-rose-600" />
                  Ranking de Clientes com Maior Número de Contaminações
                </h4>
                <div className="space-y-2">
                  {contaminationIndicators.topContaminatedClients.length === 0 ? (
                    <p className="text-xs text-slate-400 p-4 text-center">Nenhuma contaminação registrada no período.</p>
                  ) : (
                    contaminationIndicators.topContaminatedClients.map((item, idx) => (
                      <div key={item.client} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs font-black rounded-lg flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{item.client}</span>
                        </div>
                        <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                          {item.count} tanques
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Ranking Produtos com Contaminação */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-rose-600" />
                  Ranking de Produtos com Maior Número de Contaminações
                </h4>
                <div className="space-y-2">
                  {contaminationIndicators.topContaminatedProducts.length === 0 ? (
                    <p className="text-xs text-slate-400 p-4 text-center">Nenhuma contaminação registrada no período.</p>
                  ) : (
                    contaminationIndicators.topContaminatedProducts.map((item, idx) => (
                      <div key={item.product} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs font-black rounded-lg flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{item.product}</span>
                        </div>
                        <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                          {item.count} tanques
                        </span>
                      </div>
                    ))
                  )}
                </div>
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
                <th className="p-3.5 text-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('waitTime')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Espera</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5 text-center">Lavagem</th>
                <th className="p-3.5 text-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('leadTime')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Lead Time</span>
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
                  <td colSpan={14} className="p-12 text-center text-slate-400">
                    Nenhuma operação de descontaminação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedOperations.map(op => {
                  const waitHours = getWaitTimeHours(op);
                  const deconHours = getDeconTimeHours(op);
                  const leadHours = getLeadTimeHours(op);

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

                      {/* Computed Times */}
                      <td className="p-3.5 text-center text-slate-700 dark:text-slate-300 font-black">{formatHours(waitHours)}</td>
                      <td className="p-3.5 text-center text-amber-600 dark:text-amber-400 font-black">{formatHours(deconHours)}</td>
                      <td className="p-3.5 text-center text-emerald-600 dark:text-emerald-400 font-black">{formatHours(leadHours)}</td>

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

                          <button
                            onClick={() => {
                              if (window.confirm(`Tem certeza que deseja excluir esta operação do tanque ${op.equipmentNumber}?`)) {
                                onDeleteOperation(op.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Excluir Operação"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
    </div>
  );
}
