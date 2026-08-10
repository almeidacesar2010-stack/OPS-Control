import React, { useState } from 'react';
import { X, Tag, Calendar, MapPin, Building2, Layers, Activity, AlertTriangle, Clock, FileText, CheckCircle2, Plus, Image as ImageIcon, History, Wrench, ShieldAlert, ShieldCheck, Award, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FleetEquipment, FleetHistoryEntry, FleetNonConformity } from '../types/fleet';
import { ServiceOrder } from '../types';
import { calculateDaysRemaining, getExpirationStatus, formatDateBR, calculateCompletenessScore } from '../utils/fleetUtils';
import { format } from 'date-fns';

interface FleetDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: FleetEquipment | null;
  historyEntries: FleetHistoryEntry[];
  serviceOrders: ServiceOrder[];
  onAddNonConformity: (equipmentId: string, description: string, photoUrl?: string) => Promise<void>;
  onResolveNonConformity: (equipmentId: string, ncId: string) => Promise<void>;
  onEditClick: (equipment: FleetEquipment) => void;
  onDeleteClick?: (equipment: FleetEquipment) => void;
}

export const FleetDetailsDrawer: React.FC<FleetDetailsDrawerProps> = ({
  isOpen,
  onClose,
  equipment,
  historyEntries,
  serviceOrders,
  onAddNonConformity,
  onResolveNonConformity,
  onEditClick,
  onDeleteClick
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'nonconformities' | 'history' | 'orders'>('details');
  const [newNcDesc, setNewNcDesc] = useState('');
  const [newNcPhoto, setNewNcPhoto] = useState('');
  const [isAddingNc, setIsAddingNc] = useState(false);
  const [isSubmittingNc, setIsSubmittingNc] = useState(false);

  if (!isOpen || !equipment) return null;

  const visualDays = calculateDaysRemaining(equipment.nextVisualInspectionDate);
  const visualStatus = getExpirationStatus(visualDays);

  const endDays = calculateDaysRemaining(equipment.nextEndInspectionDate);
  const endStatus = getExpirationStatus(endDays);

  const equipmentOrders = serviceOrders.filter(
    o => (o.equipmentNumber || '').trim().toUpperCase() === (equipment.equipmentNumber || '').trim().toUpperCase()
  );

  const nonConformities = equipment.nonConformities || [];
  const activeNcs = nonConformities.filter(nc => !nc.resolved);

  const handleAddNcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNcDesc.trim()) return;
    try {
      setIsSubmittingNc(true);
      await onAddNonConformity(equipment.id, newNcDesc.trim(), newNcPhoto.trim() || undefined);
      setNewNcDesc('');
      setNewNcPhoto('');
      setIsAddingNc(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingNc(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-slate-950/60 backdrop-blur-sm">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-xl bg-blue-600 text-white font-black text-sm uppercase tracking-wider shadow-md shadow-blue-600/20">
                {equipment.equipmentNumber}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase border ${
                equipment.status === 'Operacional'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300'
                  : equipment.status === 'Em manutenção'
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                  : equipment.status === 'Aguardando inspeção'
                  ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300'
                  : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/80 dark:text-red-300'
              }`}>
                {equipment.status}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-2">
              Tipo: <strong className="text-slate-800 dark:text-slate-200">{equipment.type}</strong> | Cliente: <strong className="text-slate-800 dark:text-slate-200">{equipment.clientId || 'BASE'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditClick(equipment)}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black uppercase rounded-xl transition-all"
            >
              Editar
            </button>
            {onDeleteClick && (
              <button
                onClick={() => onDeleteClick(equipment)}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-black uppercase rounded-xl transition-all flex items-center gap-1.5"
                title="Excluir Equipamento"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/30 px-6 gap-2 text-xs font-black uppercase overflow-x-auto">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Informações
          </button>

          <button
            onClick={() => setActiveTab('nonconformities')}
            className={`py-3 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 relative ${
              activeTab === 'nonconformities'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Não Conformidades
            {activeNcs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-red-600 text-white rounded-full font-bold">
                {activeNcs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            Histórico ({historyEntries.length})
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 px-3 border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Ordens de Serviço ({equipmentOrders.length})
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Validation & Completeness Card */}
              {(() => {
                const score = calculateCompletenessScore(equipment);
                const isPending = equipment.isPendingValidation !== false;
                return (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase">
                        <Award className="w-4 h-4 text-amber-500" />
                        Completude do Cadastro:
                      </span>
                      <span className={score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}>
                        {score}% Completo
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${score}%` }}
                      />
                    </div>

                    {isPending ? (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-amber-800 dark:text-amber-200 text-xs">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            <strong>Cadastro Pendente de Validação PCP:</strong> Confirme os dados e valide este equipamento.
                          </span>
                        </div>
                        <button
                          onClick={() => onEditClick(equipment)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Validar
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Cadastro Verificado e Validado PCP em {formatDateBR(equipment.validatedAt)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Registration Info Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Número/Tag</span>
                  <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{equipment.equipmentNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Tipo</span>
                  <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{equipment.type}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Cliente Atual</span>
                  <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{equipment.clientId || 'NÃO ATRIBUÍDO'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Localização</span>
                  <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{equipment.location}</p>
                </div>
              </div>

              {/* Inspection Status Badges */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Datas e Vencimentos de Inspeções
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Visual Box */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Inspeção Visual</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Última Realizada:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatDateBR(equipment.visualInspectionDate)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Próximo Vencimento:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatDateBR(equipment.nextVisualInspectionDate)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400">Status:</span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs border ${visualStatus.colorClass}`}>
                        {visualStatus.label}
                      </span>
                    </div>
                  </div>

                  {/* END Box */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">END (Ensaio Não Destrutivo)</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Última Realizada:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatDateBR(equipment.endInspectionDate)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Próximo Vencimento:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatDateBR(equipment.nextEndInspectionDate)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400">Status:</span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs border ${endStatus.colorClass}`}>
                        {endStatus.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Observations */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Observações Gerais
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-pre-line">
                  {equipment.observations || 'Nenhuma observação registrada para este equipamento.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'nonconformities' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                  Não Conformidades Registradas ({nonConformities.length})
                </h4>
                <button
                  onClick={() => setIsAddingNc(!isAddingNc)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nova Não Conformidade
                </button>
              </div>

              {/* Add NC Form */}
              {isAddingNc && (
                <form onSubmit={handleAddNcSubmit} className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl space-y-3">
                  <h5 className="text-xs font-black uppercase text-red-800 dark:text-red-300">
                    Registrar Nova Não Conformidade
                  </h5>
                  <textarea
                    required
                    rows={3}
                    placeholder="Descreva detalhadamente a não conformidade identificada..."
                    value={newNcDesc}
                    onChange={(e) => setNewNcDesc(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-red-300 dark:border-red-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <input
                    type="url"
                    placeholder="URL de foto anexada (opcional)..."
                    value={newNcPhoto}
                    onChange={(e) => setNewNcPhoto(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-red-300 dark:border-red-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNc(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingNc}
                      className="px-4 py-1.5 bg-red-600 text-white font-bold text-xs uppercase rounded-xl"
                    >
                      {isSubmittingNc ? 'Salvando...' : 'Registrar NC'}
                    </button>
                  </div>
                </form>
              )}

              {/* NC List */}
              {nonConformities.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-bold bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  Nenhuma não conformidade cadastrada para este equipamento.
                </div>
              ) : (
                <div className="space-y-3">
                  {nonConformities.map((nc) => (
                    <div
                      key={nc.id}
                      className={`p-4 rounded-2xl border space-y-3 transition-all ${
                        nc.resolved
                          ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-80'
                          : 'bg-red-500/5 border-red-200 dark:border-red-900/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {nc.resolved ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300">
                              RESOLVIDO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-600 text-white animate-pulse">
                              NÃO CONFORME ATIVO
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-bold">{nc.date}</span>
                        </div>

                        {!nc.resolved && (
                          <button
                            onClick={() => onResolveNonConformity(equipment.id, nc.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-lg shadow transition-all flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Marcar Resolvido
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium whitespace-pre-line">
                        {nc.description}
                      </p>

                      {nc.photoUrl && (
                        <div className="mt-2">
                          <a
                            href={nc.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 underline"
                          >
                            <ImageIcon className="w-4 h-4" />
                            Visualizar Foto Anexada
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                Histórico Inalterável de Alterações ({historyEntries.length})
              </h4>

              {historyEntries.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-bold bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  Nenhuma alteração registrada até o momento.
                </div>
              ) : (
                <div className="space-y-3">
                  {historyEntries.map((h) => (
                    <div key={h.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>👤 {h.userName} ({h.userEmail})</span>
                        <span>{h.timestamp?.toMillis ? format(new Date(h.timestamp.toMillis()), 'dd/MM/yyyy HH:mm') : '—'}</span>
                      </div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        Campo: <span className="text-blue-600 dark:text-blue-400 uppercase">{h.field}</span>
                      </div>
                      <div className="text-[11px] grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                        <div className="truncate">De: <span className="line-through">{h.oldValue || '—'}</span></div>
                        <div className="truncate font-bold text-emerald-600 dark:text-emerald-400">Para: {h.newValue || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                Ordens de Serviço Relacionadas ({equipmentOrders.length})
              </h4>

              {equipmentOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-bold bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  Nenhuma ordem de serviço vinculada a este equipamento.
                </div>
              ) : (
                <div className="space-y-3">
                  {equipmentOrders.map((os) => (
                    <div key={os.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 dark:text-white uppercase">
                          OS #{os.id.substring(0, 8)}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          os.status === 'Concluído' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {os.status}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">
                        Scope: <strong>{os.maintenanceScope || 'Manutenção Geral'}</strong>
                      </p>
                      <div className="text-[10px] text-slate-400 flex justify-between">
                        <span>Técnico: {os.maintenanceTechnician || '—'}</span>
                        <span>Abertura: {os.startDate?.toMillis ? format(new Date(os.startDate.toMillis()), 'dd/MM/yyyy') : '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
