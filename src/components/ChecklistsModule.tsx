import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Trash2, 
  Edit3, 
  ChevronRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Check
} from 'lucide-react';
import { OperationalChecklistData, ChecklistStatus } from '../types/checklists';
import { Client, FleetEquipment } from '../types';
import { generateOperationalChecklistPDF } from '../utils/generateChecklistPDF';
import { format } from 'date-fns';

interface ChecklistsModuleProps {
  checklists: OperationalChecklistData[];
  onNewChecklist: () => void;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Filtragem dos checklists
  const filteredChecklists = useMemo(() => {
    return checklists.filter(item => {
      const matchSearch = 
        !searchTerm ||
        (item.equipmentTag || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.inspectorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.equipmentModel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.slingTag || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = 
        statusFilter === 'all' || 
        item.status === statusFilter;

      const matchFamily = 
        familyFilter === 'all' || 
        item.equipmentFamily === familyFilter ||
        (familyFilter === 'CCU' && (item.modelType === 'CCU' || (item.equipmentFamily || '').includes('CCU'))) ||
        (familyFilter === 'Tanques' && (item.modelType?.startsWith('TANQUE') || (item.equipmentFamily || '').includes('Tanque')));

      const matchType = 
        typeFilter === 'all' || 
        item.checklistType === typeFilter;

      return matchSearch && matchStatus && matchFamily && matchType;
    });
  }, [checklists, searchTerm, statusFilter, familyFilter, typeFilter]);

  // Métricas operacionais
  const stats = useMemo(() => {
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

  return (
    <div className="space-y-4">
      
      {/* CABEÇALHO OPERACIONAL LIMPO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Checklists Operacionais</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gerenciamento independente de laudos técnicos de inspeção e conformidade
          </p>
        </div>

        <button
          type="button"
          onClick={onNewChecklist}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Novo Checklist</span>
        </button>
      </div>

      {/* CARDS DE INDICADORES OPERACIONAIS COMPACTOS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Total de Checklists</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">{stats.total}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Concluídos (100% OK)</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Em Preenchimento</span>
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.inProgress}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Não Conformes / NC</span>
            <span className="text-xl font-bold text-rose-600 dark:text-rose-400">{stats.nonConform}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

      </div>

      {/* BARRA DE FILTROS E PESQUISA */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        
        {/* Campo de Pesquisa */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por TAG, Cliente, Inspetor, Eslinga ou Modelo..."
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

          {/* Família */}
          <select
            value={familyFilter}
            onChange={e => setFamilyFilter(e.target.value)}
            className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todas as Famílias</option>
            <option value="CCU">CCUs</option>
            <option value="Tanques">Tanques (1500 / 5000 / 5200)</option>
            <option value="Container Refrigerado">Reefer (Refrigerado)</option>
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

      {/* LISTAGEM DE CHECKLISTS INDEPENDENTES */}
      {filteredChecklists.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <FileText className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Nenhum checklist operacional encontrado
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {checklists.length === 0 
              ? 'Inicie o preenchimento do primeiro checklist operacional independente clicando no botão acima.'
              : 'Nenhum resultado corresponde aos filtros selecionados. Tente ajustar os termos de busca.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Equipamento / TAG</th>
                  <th className="py-3 px-4">Tipo / Modelo</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Eslinga (Indep.)</th>
                  <th className="py-3 px-4">Data / Inspetor</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredChecklists.map(chk => {
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

                      {/* Modelo / Família */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]" title={chk.equipmentModel || chk.equipmentFamily}>
                          {chk.equipmentModel || chk.equipmentFamily}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {chk.equipmentFamily}
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

                      {/* Data / Inspetor */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {chk.inspectionDate ? format(new Date(chk.inspectionDate), 'dd/MM/yyyy') : '-'}
                        </div>
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px] block" title={chk.inspectorName}>
                          {chk.inspectorName || 'Técnico'}
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
