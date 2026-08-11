import React from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Container, 
  Building2, 
  Package, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  User,
  Printer,
  ShieldCheck,
  Zap,
  Tag,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DecontaminationOperation } from '../types/decontamination';
import { getWaitTimeHours, getDeconTimeHours, getLeadTimeHours, formatHours } from '../utils/decontaminationUtils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TankHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentNumber: string | null;
  operations: DecontaminationOperation[];
}

export function TankHistoryModal({
  isOpen,
  onClose,
  equipmentNumber,
  operations
}: TankHistoryModalProps) {
  if (!isOpen || !equipmentNumber) return null;

  // Filter operations belonging to this tank tag, sorted newest to oldest
  const tankOps = operations
    .filter(o => o.equipmentNumber?.trim().toUpperCase() === equipmentNumber.trim().toUpperCase())
    .sort((a, b) => {
      const dateA = a.arrivalDate ? new Date(a.arrivalDate).getTime() : 0;
      const dateB = b.arrivalDate ? new Date(b.arrivalDate).getTime() : 0;
      return dateB - dateA;
    });

  const latestOp = tankOps[0];
  const tankModel = latestOp?.model || 'TANQUE';
  const totalOps = tankOps.length;

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-5xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col print:max-h-none print:shadow-none print:border-none print:my-0"
        >
          {/* Header - Technical Sheet Banner */}
          <div className="p-6 md:p-8 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 border border-blue-400/30 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                <Container className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 bg-blue-950/90 px-3 py-1 rounded-lg border border-blue-800/60">
                    Ficha Técnica do Equipamento
                  </span>
                  <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-md">
                    {tankModel}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase mt-1">
                  TAG: {equipmentNumber}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border border-slate-700"
                title="Imprimir Ficha Técnica"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Tank Resumo / Overview Cards */}
          <div className="p-6 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Modelo do Tanque</p>
              <p className="text-sm font-black text-slate-900 dark:text-white uppercase truncate">{tankModel}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Total de Operações</p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{totalOps}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Último Cliente</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white uppercase truncate">
                {latestOp?.client || '—'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Último Produto</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white uppercase truncate">
                {latestOp?.product || '—'}
              </p>
            </div>

            <div className="col-span-2 md:col-span-1 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Última Descontaminação</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {latestOp?.arrivalDate ? formatDateDisplay(latestOp.arrivalDate) : '—'}
              </p>
            </div>
          </div>

          {/* Timeline & Operations History */}
          <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Histórico Cronológico de Operações de Descontaminação
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                {tankOps.length} registro(s) encontrado(s)
              </span>
            </div>

            {tankOps.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
                <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">Nenhuma operação registrada para este tanque.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-blue-500/30 dark:border-blue-500/20 ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-8">
                {tankOps.map((op, idx) => {
                  const waitHours = getWaitTimeHours(op);
                  const deconHours = getDeconTimeHours(op);
                  const leadHours = getLeadTimeHours(op);

                  // Status badge mapping as per system spec:
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
                      : 'Aguardando Descontaminação';

                  return (
                    <div key={op.id || idx} className="relative group">
                      {/* Timeline Node Dot */}
                      <div className="absolute -left-[37px] sm:-left-[45px] top-2 w-7 h-7 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-600 flex items-center justify-center shadow-md">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                      </div>

                      {/* Operation Record Card */}
                      <div className="bg-slate-50/80 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-all space-y-5">
                        {/* Record Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-700 pb-3">
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${statusColor}`}>
                              {statusLabel}
                            </span>

                            {op.hasContamination ? (
                              <span className="px-3 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Contaminação: SIM
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Contaminação: NÃO
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                              Operação #{tankOps.length - idx}
                            </span>
                          </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
                          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-blue-500" />
                              Cliente
                            </p>
                            <p className="text-slate-900 dark:text-white uppercase mt-1 text-sm font-black">{op.client || '—'}</p>
                          </div>

                          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-purple-500" />
                              Produto / Conteúdo
                            </p>
                            <p className="text-slate-900 dark:text-white uppercase mt-1 text-sm font-black">{op.product || '—'}</p>
                          </div>

                          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-indigo-500" />
                              Nota Fiscal (NF)
                            </p>
                            <p className="text-slate-900 dark:text-white uppercase mt-1 text-sm font-black">{op.invoiceNumber || '—'}</p>
                          </div>
                        </div>

                        {/* Dates Step Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-bold">
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400">Chegada na Base</p>
                            <p className="text-slate-900 dark:text-white mt-1">{formatDateDisplay(op.arrivalDate)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400">Início da Lavagem</p>
                            <p className="text-slate-900 dark:text-white mt-1">{formatDateDisplay(op.startDate)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400">Finalização</p>
                            <p className="text-slate-900 dark:text-white mt-1">{formatDateDisplay(op.endDate)}</p>
                          </div>
                        </div>

                        {/* Main Decontamination Time Indicator */}
                        <div className="bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 p-3.5 rounded-xl flex items-center justify-between text-xs font-black">
                          <span className="text-amber-800 dark:text-amber-300 uppercase tracking-wide flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            Tempo de Descontaminação (Início → Finalização):
                          </span>
                          <span className="text-amber-600 dark:text-amber-400 font-black text-sm">
                            {formatHours(deconHours)}
                          </span>
                        </div>

                        {/* Notes */}
                        {op.notes && (
                          <div className="bg-amber-50/60 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200/60 dark:border-amber-800/40 text-xs">
                            <span className="font-black text-amber-800 dark:text-amber-300 uppercase block mb-1">
                              Observações da Operação:
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 font-medium whitespace-pre-line">
                              {op.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

