import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  User, 
  FileText, 
  Check, 
  X, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DeletionRequest } from '../types';

interface PendingApprovalsProps {
  requests: DeletionRequest[];
  onApprove: (request: DeletionRequest) => Promise<void>;
  onReject: (request: DeletionRequest, reason: string) => Promise<void>;
}

export function PendingApprovals({
  requests,
  onApprove,
  onReject
}: PendingApprovalsProps) {
  const [filterStatus, setFilterStatus] = useState<'Pendente' | 'Aprovada' | 'Rejeitada' | 'all'>('Pendente');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Rejection modal state
  const [rejectingReq, setRejectingReq] = useState<DeletionRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredRequests = requests.filter(req => {
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      req.itemName?.toLowerCase().includes(term) ||
      req.itemType?.toLowerCase().includes(term) ||
      req.requestedBy?.toLowerCase().includes(term) ||
      req.reason?.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = requests.filter(r => r.status === 'Pendente').length;

  const handleConfirmApprove = async (req: DeletionRequest) => {
    setIsProcessing(true);
    setActionError(null);
    try {
      await onApprove(req);
      setActionSuccess(`Exclusão do item "${req.itemName}" aprovada e executada com sucesso!`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error('Error approving deletion:', err);
      setActionError(err?.message || 'Erro ao aprovar exclusão.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingReq) return;
    if (!rejectionReason.trim()) {
      setActionError('Informe o motivo da rejeição.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);
    try {
      await onReject(rejectingReq, rejectionReason.trim());
      setActionSuccess(`Solicitação de exclusão para "${rejectingReq.itemName}" foi rejeitada.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setRejectingReq(null);
      setRejectionReason('');
    } catch (err: any) {
      console.error('Error rejecting deletion:', err);
      setActionError(err?.message || 'Erro ao rejeitar solicitação.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (val: any) => {
    if (!val) return '—';
    try {
      if (val.toDate) return format(val.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      return format(new Date(val), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (e) {
      return '—';
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <ShieldCheck className="w-64 h-64" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Aprovações Pendentes
              </span>
              <span className="text-xs font-bold text-slate-400">Controle do Moderador</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">Gestão de Aprovações de Exclusão</h1>
            <p className="text-sm font-medium text-slate-300 mt-1 max-w-2xl">
              Análise e autorização centralizada para solicitações de remoção de dados operacionais, equipamentos, OS e clientes.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <div className="text-center px-4 border-r border-white/10">
              <div className="text-3xl font-black text-amber-400">{pendingCount}</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-300">Pendentes</div>
            </div>
            <div className="text-center px-4">
              <div className="text-3xl font-black text-white">{requests.length}</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-300">Total Geral</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Messages */}
      <AnimatePresence>
        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="p-1 hover:bg-emerald-500/20 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm font-bold flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="p-1 hover:bg-red-500/20 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full md:w-auto">
          {(['Pendente', 'Aprovada', 'Rejeitada', 'all'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                filterStatus === st
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st === 'all' ? 'Todos' : st}
              {st === 'Pendente' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por item, solicitante, motivo..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Requests List Grid */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center">
          <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-black text-slate-800 dark:text-slate-200 uppercase">
            Nenhuma solicitação encontrada
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Não há solicitações de exclusão para o filtro ou busca selecionada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRequests.map(req => (
            <motion.div
              key={req.id}
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                req.status === 'Pendente'
                  ? 'border-amber-300/80 dark:border-amber-700/50 bg-amber-500/5'
                  : req.status === 'Aprovada'
                  ? 'border-emerald-200 dark:border-emerald-800/40'
                  : 'border-red-200 dark:border-red-800/40 opacity-75'
              }`}
            >
              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-200/50 dark:border-blue-800/50">
                    {req.itemType || 'Registro'}
                  </span>

                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border ${
                    req.status === 'Pendente'
                      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                      : req.status === 'Aprovada'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/80 dark:text-red-300'
                  }`}>
                    {req.status}
                  </span>
                </div>

                {/* Item Name */}
                <h3 className="text-base font-black text-slate-900 dark:text-white truncate mb-3">
                  {req.itemName}
                </h3>

                {/* Details list */}
                <div className="space-y-2 text-xs mb-4">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Solicitante: <strong className="text-slate-900 dark:text-white">{req.requestedBy}</strong>{' '}
                      <span className="text-[10px] uppercase font-bold text-slate-400">({req.userRole})</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Solicitado em: {formatDate(req.requestedAt)}</span>
                  </div>
                </div>

                {/* Reason Box */}
                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-3.5 border border-slate-200/60 dark:border-slate-700/60 mb-4">
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Motivo Declarado
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 italic leading-relaxed">
                    "{req.reason}"
                  </p>
                </div>

                {/* Decision outcome if not pending */}
                {req.status !== 'Pendente' && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>Decidido por: <strong>{req.decidedBy || 'Moderador'}</strong> em {formatDate(req.decidedAt)}</div>
                    {req.rejectionReason && (
                      <div className="mt-1 text-red-600 dark:text-red-400 font-medium">
                        Motivo da rejeição: {req.rejectionReason}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons for Pending */}
              {req.status === 'Pendente' && (
                <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setRejectingReq(req)}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 font-black text-xs hover:bg-red-50 dark:hover:bg-red-950/40 transition-all uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    Rejeitar
                  </button>

                  <button
                    onClick={() => handleConfirmApprove(req)}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Aprovar
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal for Rejection Reason */}
      {rejectingReq && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                Rejeitar Solicitação
              </h3>
              <button onClick={() => setRejectingReq(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Informe a justificativa para rejeitar a exclusão do item <strong>"{rejectingReq.itemName}"</strong>.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Digite o motivo da recusa..."
              rows={3}
              required
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingReq(null)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-red-600/20"
              >
                {isProcessing ? 'Gravando...' : 'Confirmar Rejeição'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
