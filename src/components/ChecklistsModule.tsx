import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Trash2, 
  Edit3, 
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  Calendar,
  Layers,
  Container,
  Boxes,
  Droplet,
  Truck,
  Wrench,
  ArrowLeftRight,
  RotateCw,
  Filter
} from 'lucide-react';
import { 
  OperationalChecklistData, 
  ChecklistStatus, 
  ChecklistCategory, 
  CHECKLIST_CATEGORIES 
} from '../types/checklists';
import { Client, FleetEquipment } from '../types';
import { generateOperationalChecklistPDF } from '../utils/generateChecklistPDF';
import { format } from 'date-fns';

export function getChecklistCategory(chk: OperationalChecklistData): ChecklistCategory {
  if (chk.category && CHECKLIST_CATEGORIES.includes(chk.category)) {
    return chk.category;
  }
  const family = (chk.equipmentFamily || '').trim();
  if (CHECKLIST_CATEGORIES.includes(family as ChecklistCategory)) {
    return family as ChecklistCategory;
  }

  const combined = `${chk.equipmentFamily || ''} ${chk.equipmentModel || ''} ${chk.modelTitle || ''} ${chk.equipmentTag || ''}`.toLowerCase();
  
  if (combined.includes('entrada/saída spooling') || combined.includes('entrada/saida spooling') || combined.includes('entrada spooling') || combined.includes('saida spooling')) {
    return 'Entrada/Saída Spooling Units';
  }
  if (combined.includes('manutenção polia') || combined.includes('manutencao polia') || combined.includes('sheave wheel') || combined.includes('polia')) {
    return 'Manutenção Polia (Sheave Wheel)';
  }
  if (combined.includes('mobilização spooling') || combined.includes('mobilizacao spooling') || combined.includes('spooling')) {
    return 'Mobilização Spooling Units';
  }
  if (chk.modelType === 'REEFER' || combined.includes('refrigerado') || combined.includes('reefer') || combined.includes('camara fria')) {
    return 'Container refrigerado';
  }
  if (chk.modelType === 'TANQUE_5200' || combined.includes('5200')) {
    return 'Tanque 5200 LT';
  }
  if (chk.modelType === 'TANQUE_5000' || combined.includes('5000')) {
    return 'Tanque 5000 LT';
  }
  if (chk.modelType === 'TANQUE_1500' || combined.includes('1500') || combined.includes('1.500') || combined.includes('1325')) {
    return 'Tanque 1500 LT';
  }

  return 'CCU';
}

interface CategoryDefinition {
  id: ChecklistCategory;
  name: ChecklistCategory;
  orderNumber: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
  cardBorder: string;
  iconBg: string;
  iconColor: string;
}

const CATEGORIES_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'CCU',
    name: 'CCU',
    orderNumber: '01',
    description: 'Containers offshore, caixas metálicas, cestos e skids de carga',
    icon: Boxes,
    badgeColor: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    cardBorder: 'hover:border-blue-400 dark:hover:border-blue-600',
    iconBg: 'bg-blue-100 dark:bg-blue-950/80',
    iconColor: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: 'Tanque 1500 LT',
    name: 'Tanque 1500 LT',
    orderNumber: '02',
    description: 'Tanques de transporte de produtos químicos e condensados (1.500 Litros)',
    icon: Droplet,
    badgeColor: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    cardBorder: 'hover:border-cyan-400 dark:hover:border-cyan-600',
    iconBg: 'bg-cyan-100 dark:bg-cyan-950/80',
    iconColor: 'text-cyan-600 dark:text-cyan-400'
  },
  {
    id: 'Tanque 5000 LT',
    name: 'Tanque 5000 LT',
    orderNumber: '03',
    description: 'Tanques cilíndricos offshore certificados DNV 2.7-1 / IMDG (5.000 Litros)',
    icon: Container,
    badgeColor: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    cardBorder: 'hover:border-indigo-400 dark:hover:border-indigo-600',
    iconBg: 'bg-indigo-100 dark:bg-indigo-950/80',
    iconColor: 'text-indigo-600 dark:text-indigo-400'
  },
  {
    id: 'Tanque 5200 LT',
    name: 'Tanque 5200 LT',
    orderNumber: '04',
    description: 'Tanques offshore especiais de alta capacidade em aço inox (5.200 Litros)',
    icon: ShieldCheck,
    badgeColor: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    cardBorder: 'hover:border-purple-400 dark:hover:border-purple-600',
    iconBg: 'bg-purple-100 dark:bg-purple-950/80',
    iconColor: 'text-purple-600 dark:text-purple-400'
  },
  {
    id: 'Container refrigerado',
    name: 'Container refrigerado',
    orderNumber: '05',
    description: 'Containers Reefer offshore com unidade e controle térmico de refrigeração',
    icon: Layers,
    badgeColor: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    cardBorder: 'hover:border-sky-400 dark:hover:border-sky-600',
    iconBg: 'bg-sky-100 dark:bg-sky-950/80',
    iconColor: 'text-sky-600 dark:text-sky-400'
  },
  {
    id: 'Mobilização Spooling Units',
    name: 'Mobilização Spooling Units',
    orderNumber: '06',
    description: 'Inspeção e laudos técnicos de mobilização e prontidão de Spooling Units',
    icon: Truck,
    badgeColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    cardBorder: 'hover:border-amber-400 dark:hover:border-amber-600',
    iconBg: 'bg-amber-100 dark:bg-amber-950/80',
    iconColor: 'text-amber-600 dark:text-amber-400'
  },
  {
    id: 'Manutenção Polia (Sheave Wheel)',
    name: 'Manutenção Polia (Sheave Wheel)',
    orderNumber: '07',
    description: 'Manutenção técnica mecânica, canaletas, eixos e olhais de polias Sheave Wheel',
    icon: Wrench,
    badgeColor: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    cardBorder: 'hover:border-rose-400 dark:hover:border-rose-600',
    iconBg: 'bg-rose-100 dark:bg-rose-950/80',
    iconColor: 'text-rose-600 dark:text-rose-400'
  },
  {
    id: 'Entrada/Saída Spooling Units',
    name: 'Entrada/Saída Spooling Units',
    orderNumber: '08',
    description: 'Controle de conformidade e conferência de entrada e saída de Spooling Units',
    icon: ArrowLeftRight,
    badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    cardBorder: 'hover:border-emerald-400 dark:hover:border-emerald-600',
    iconBg: 'bg-emerald-100 dark:bg-emerald-950/80',
    iconColor: 'text-emerald-600 dark:text-emerald-400'
  }
];

interface ChecklistsModuleProps {
  checklists: OperationalChecklistData[];
  onNewChecklist: (category?: ChecklistCategory) => void;
  onEditChecklist: (checklist: OperationalChecklistData) => void;
  onDeleteChecklist: (id: string, name: string) => void;
  canDelete: boolean;
  clients: Client[];
  fleetEquipment: FleetEquipment[];
  logoUrl?: string | null;
}

export const ChecklistsModule: React.FC<ChecklistsModuleProps> = ({
  checklists,
  onNewChecklist,
  onEditChecklist,
  onDeleteChecklist,
  canDelete,
  logoUrl
}) => {
  // Categoria ativa selecionada (null = tela principal das 8 categorias)
  const [selectedCategory, setSelectedCategory] = useState<ChecklistCategory | null>(null);

  // Filtros internos (ativos na visualização da categoria)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Contagem de checklists por categoria
  const categoryCounts = useMemo(() => {
    const counts: Record<ChecklistCategory, { total: number; completed: number; ncCount: number; inProgress: number }> = {
      'CCU': { total: 0, completed: 0, ncCount: 0, inProgress: 0 },
      'Tanque 1500 LT': { total: 0, completed: 0, ncCount: 0, inProgress: 0 },
      'Tanque 5000 LT': { total: 0, completed: 0, ncCount: 0, inProgress: 0 },
      'Tanque 5200 LT': { total: 0, completed: 0, ncCount: 0, inProgress: 0 },
      'Container refrigerado': { total: 0, completed: 0, ncCount: 0, inProgress: 0 },
      'Mobilização Spooling Units': { total: 0, completed: 0, ncCount: 0, inProgress: 0 },
      'Manutenção Polia (Sheave Wheel)': { total: 0, completed: 0, ncCount: 0, inProgress: 0 },
      'Entrada/Saída Spooling Units': { total: 0, completed: 0, ncCount: 0, inProgress: 0 }
    };

    checklists.forEach(chk => {
      const cat = getChecklistCategory(chk);
      if (counts[cat]) {
        counts[cat].total += 1;
        if (chk.status === 'Concluído') {
          counts[cat].completed += 1;
        } else if (chk.status === 'Reprovado / Com NC' || (chk.ncCount && chk.ncCount > 0)) {
          counts[cat].ncCount += 1;
        } else {
          counts[cat].inProgress += 1;
        }
      }
    });

    return counts;
  }, [checklists]);

  // Checklists pertencentes estritamente à categoria selecionada
  const categoryChecklists = useMemo(() => {
    if (!selectedCategory) return [];
    return checklists.filter(item => getChecklistCategory(item) === selectedCategory);
  }, [checklists, selectedCategory]);

  // Filtragem dos checklists dentro da categoria selecionada
  const filteredCategoryChecklists = useMemo(() => {
    return categoryChecklists.filter(item => {
      const matchSearch = 
        !searchTerm ||
        (item.equipmentTag || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.inspectionResponsible || item.inspectorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.equipmentModel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.slingTag || item.slingNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = 
        statusFilter === 'all' || 
        item.status === statusFilter;

      const matchType = 
        typeFilter === 'all' || 
        item.checklistType === typeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [categoryChecklists, searchTerm, statusFilter, typeFilter]);

  // Métricas operacionais da categoria selecionada
  const categoryStats = useMemo(() => {
    const total = categoryChecklists.length;
    const completed = categoryChecklists.filter(c => c.status === 'Concluído').length;
    const inProgress = categoryChecklists.filter(c => c.status === 'Em preenchimento' || c.status === 'Rascunho').length;
    const nonConform = categoryChecklists.filter(c => c.status === 'Reprovado / Com NC' || (c.ncCount && c.ncCount > 0)).length;
    return { total, completed, inProgress, nonConform };
  }, [categoryChecklists]);

  // Métricas gerais de todas as 8 categorias
  const overallStats = useMemo(() => {
    const total = checklists.length;
    const completed = checklists.filter(c => c.status === 'Concluído').length;
    const inProgress = checklists.filter(c => c.status === 'Em preenchimento' || c.status === 'Rascunho').length;
    const nonConform = checklists.filter(c => c.status === 'Reprovado / Com NC' || (c.ncCount && c.ncCount > 0)).length;
    return { total, completed, inProgress, nonConform };
  }, [checklists]);

  const getStatusBadge = (status?: ChecklistStatus, ncCount?: number) => {
    if (status === 'Reprovado / Com NC' || (ncCount && ncCount > 0)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <AlertTriangle className="w-3 h-3" />
          {ncCount ? `${ncCount} NC` : 'Reprovado / NC'}
        </span>
      );
    }
    if (status === 'Concluído') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3 h-3" />
          Concluído
        </span>
      );
    }
    if (status === 'Rascunho') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <FileText className="w-3 h-3" />
          Rascunho
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
        <Clock className="w-3 h-3" />
        Em preenchimento
      </span>
    );
  };

  const selectedCategoryDef = CATEGORIES_DEFINITIONS.find(c => c.id === selectedCategory);

  // =========================================================================
  // CENÁRIO 1: VISÃO GERAL DAS 8 CATEGORIAS PRINCIPAIS
  // =========================================================================
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        
        {/* CABEÇALHO PRINCIPAL DO MÓDULO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Divisão Operacional Independente
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Módulo de Checklists</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Selecione uma das 8 categorias principais abaixo para acessar exclusivamente os checklists daquele tipo.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNewChecklist('CCU')}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Checklist</span>
            </button>
          </div>
        </div>

        {/* RESUMO RÁPIDO DO MÓDULO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Total de Checklists</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">{overallStats.total}</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Concluídos (100% OK)</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{overallStats.completed}</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Em Preenchimento</span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">{overallStats.inProgress}</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Com Não Conformidade</span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400">{overallStats.nonConform}</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

        </div>

        {/* GRADE DAS 8 CATEGORIAS PRINCIPAIS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Categorias Principais ({CATEGORIES_DEFINITIONS.length})
            </h3>
            <span className="text-xs text-slate-400">
              Clique em uma categoria para abrir seus checklists
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CATEGORIES_DEFINITIONS.map(cat => {
              const Icon = cat.icon;
              const stats = categoryCounts[cat.id] || { total: 0, completed: 0, ncCount: 0, inProgress: 0 };

              return (
                <div
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSearchTerm('');
                    setStatusFilter('all');
                    setTypeFilter('all');
                  }}
                  className={`group bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer ${cat.cardBorder} hover:-translate-y-0.5`}
                >
                  <div>
                    {/* Topo do Card: Número e Ícone */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-11 h-11 rounded-xl ${cat.iconBg} ${cat.iconColor} flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="font-mono text-xs font-black text-slate-400 dark:text-slate-600">
                        #{cat.orderNumber}
                      </span>
                    </div>

                    {/* Título exato da categoria */}
                    <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {cat.name}
                    </h4>

                    {/* Descrição objetiva */}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                      {cat.description}
                    </p>
                  </div>

                  {/* Rodapé do Card: Quantidade de checklists e ação */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {stats.total} {stats.total === 1 ? 'checklist' : 'checklists'}
                      </span>
                      {stats.total > 0 && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {stats.completed > 0 && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              {stats.completed} OK
                            </span>
                          )}
                          {stats.ncCount > 0 && (
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              • {stats.ncCount} NC
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                      <span>Abrir</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  }

  // =========================================================================
  // CENÁRIO 2: DENTRO DE UMA CATEGORIA ESPECÍFICA (ABRIR SOMENTE OS CHECKLISTS DELA)
  // =========================================================================
  const CategoryIcon = selectedCategoryDef?.icon || ShieldCheck;

  return (
    <div className="space-y-4">
      
      {/* BARRA SUPERIOR DE NAVEGAÇÃO E BREADCRUMB */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        
        {/* Linha 1: Voltar + Título da Categoria + Botão Novo Checklist */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                setSearchTerm('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Todas as Categorias</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${selectedCategoryDef?.iconBg} ${selectedCategoryDef?.iconColor} flex items-center justify-center`}>
                <CategoryIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white leading-none">
                  {selectedCategory}
                </h2>
                <span className="text-[10px] text-slate-400 font-medium">
                  Categoria Principal de Checklists
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNewChecklist(selectedCategory)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Checklist</span>
            </button>
          </div>
        </div>

        {/* Linha 2: Barra de troca rápida entre as 8 categorias */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 shrink-0">
              Categorias:
            </span>
            {CATEGORIES_DEFINITIONS.map(cat => {
              const isCurrent = cat.id === selectedCategory;
              const count = categoryCounts[cat.id]?.total || 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSearchTerm('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isCurrent 
                      ? 'bg-white/20 text-white' 
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* CARDS DE INDICADORES OPERACIONAIS ESPECÍFICOS DESTA CATEGORIA */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Total nesta Categoria</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">{categoryStats.total}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Concluídos (100% OK)</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{categoryStats.completed}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Em Preenchimento</span>
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{categoryStats.inProgress}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Não Conformes / NC</span>
            <span className="text-xl font-bold text-rose-600 dark:text-rose-400">{categoryStats.nonConform}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

      </div>

      {/* BARRA DE FILTROS E PESQUISA DA CATEGORIA */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        
        {/* Campo de Pesquisa */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={`Pesquisar em ${selectedCategory} por TAG, Cliente, Responsável, Eslinga...`}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filtros Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs">
          
          {/* Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todos os Status</option>
            <option value="Concluído">Concluídos</option>
            <option value="Em preenchimento">Em preenchimento</option>
            <option value="Rascunho">Rascunhos</option>
            <option value="Reprovado / Com NC">Reprovados / NC</option>
          </select>

          {/* Tipo de Checklist */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todos os Tipos</option>
            <option value="Entrada">Entrada</option>
            <option value="Saída">Saída</option>
            <option value="Periódico / Manutenção">Periódico / Manutenção</option>
            <option value="Pré-embarque">Pré-embarque</option>
            <option value="Devolução">Devolução</option>
          </select>

        </div>
      </div>

      {/* LISTAGEM DE CHECKLISTS EXCLUSIVA DESTA CATEGORIA */}
      {filteredCategoryChecklists.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <CategoryIcon className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
              Nenhum checklist encontrado em {selectedCategory}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              {categoryChecklists.length === 0 
                ? `Esta categoria ainda não possui checklists registrados. Inicie o primeiro preenchimento clicando no botão abaixo.`
                : `Nenhum checklist corresponde aos filtros de busca aplicados. Tente limpar os filtros.`}
            </p>
          </div>

          {categoryChecklists.length === 0 && (
            <button
              type="button"
              onClick={() => onNewChecklist(selectedCategory)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Criar Primeiro Checklist em {selectedCategory}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Equipamento / TAG</th>
                  <th className="py-3 px-4">Tipo / Modelo</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Eslinga (Indep.)</th>
                  <th className="py-3 px-4">Data / Responsável</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredCategoryChecklists.map(chk => {
                  const safeTag = chk.equipmentTag || 'S/ TAG';
                  const slingText = chk.slingTag || chk.slingNumber || (chk.slingApplicable === false ? 'N/A' : '-');

                  return (
                    <tr 
                      key={chk.id || `${chk.equipmentTag}-${chk.inspectionDate}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* TAG / Identificação */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {safeTag}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {chk.checklistType || 'Operacional'}
                        </span>
                      </td>

                      {/* Modelo */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]" title={chk.equipmentModel || chk.equipmentFamily}>
                          {chk.equipmentModel || chk.equipmentFamily}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {selectedCategory}
                        </span>
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]" title={chk.clientName}>
                          {chk.clientName || 'Não Informado'}
                        </div>
                        {chk.inspectionLocation && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[160px]" title={chk.inspectionLocation}>
                            {chk.inspectionLocation}
                          </span>
                        )}
                      </td>

                      {/* Eslinga */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-700 dark:text-slate-300 text-xs">
                          {slingText}
                        </div>
                        {chk.slingStatus && chk.slingStatus !== 'NA' && (
                          <span className={`text-[10px] font-bold ${chk.slingStatus === 'OK' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {chk.slingStatus === 'OK' ? 'Eslinga OK' : 'Eslinga NC'}
                          </span>
                        )}
                      </td>

                      {/* Data / Responsável */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {chk.inspectionDate ? format(new Date(chk.inspectionDate), 'dd/MM/yyyy') : '-'}
                        </div>
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px] block" title={chk.inspectionResponsible || chk.inspectorName}>
                          {chk.inspectionResponsible || chk.inspectorName || 'Responsável'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(chk.status, chk.ncCount)}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Gerar PDF */}
                          <button
                            type="button"
                            onClick={() => generateOperationalChecklistPDF(chk, logoUrl || undefined)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Gerar / Visualizar PDF do Checklist"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Editar Checklist */}
                          <button
                            type="button"
                            onClick={() => onEditChecklist(chk)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Editar Checklist"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Excluir (Se tiver permissão) */}
                          {canDelete && chk.id && (
                            <button
                              type="button"
                              onClick={() => onDeleteChecklist(chk.id!, `Checklist ${chk.equipmentTag} (${chk.clientName})`)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir Checklist"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
