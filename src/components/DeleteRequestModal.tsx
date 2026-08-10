import React, { useState } from 'react';
import { ShieldAlert, Trash2, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole } from '../types';

interface DeleteRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  itemType: string;
  itemName: string;
  userRole: UserRole;
}

export function DeleteRequestModal({
  isOpen,
  onClose,
  onSubmit,
  itemType,
  itemName,
  userRole
}: DeleteRequestModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Por favor, informe o motivo da solicitação de exclusão.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(reason.trim());
      setReason('');
      onClose();
    } catch (err: any) {
      console.error('Error submitting deletion request:', err);
      setError(err?.message || 'Erro ao enviar solicitação de exclusão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className="bg-amber-500/10 dark:bg-amber-500/20 px-6 py-5 border-b border-amber-200/50 dark:border-amber-800/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Solicitação de Exclusão
                </h3>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Validação pelo Moderador do Sistema
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Item selecionado para exclusão
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-extrabold uppercase">
                  {itemType}
                </span>
                <span>{itemName}</span>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                {userRole === 'moderator'
                  ? 'Como Moderador, esta ação gerará um registro oficial no histórico de solicitações e auditoria antes da confirmação final.'
                  : 'Para garantir a segurança dos dados, todas as exclusões dependem de autorização prévia do Moderador. Informe o motivo abaixo.'}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Motivo da Exclusão <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva justificativa ou motivo operacional para remover este registro..."
                rows={3}
                required
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs transition-all uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isSubmitting ? 'Enviando...' : 'Solicitar Exclusão'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
