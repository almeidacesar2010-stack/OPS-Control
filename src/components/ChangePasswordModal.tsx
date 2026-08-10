import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { KeyRound, Lock, Eye, EyeOff, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { hashPassword } from '../utils/authUtils';

interface ChangePasswordModalProps {
  userId: string;
  userName: string;
  userUsername: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function ChangePasswordModal({
  userId,
  userName,
  userUsername,
  isOpen,
  onClose,
  onSuccess
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword.trim()) {
      setError('Informe sua senha atual.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação de senha não confere com a nova senha.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('A nova senha deve ser diferente da senha atual.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Verify current password
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.passwordHash) {
          const currentHash = await hashPassword(currentPassword);
          if (currentHash !== userData.passwordHash) {
            setError('Senha atual incorreta.');
            setIsSubmitting(false);
            return;
          }
        }
      }

      // 2. Hash new password and update
      const newHash = await hashPassword(newPassword);
      await updateDoc(userRef, {
        passwordHash: newHash,
        mustChangePassword: false,
        updatedAt: serverTimestamp()
      });

      // 3. Write audit log (no passwords in logs)
      try {
        await addDoc(collection(db, 'auditLogs'), {
          userId,
          userName: userName || userUsername,
          userEmail: `${userUsername}@opscontrol.com`,
          action: 'UPDATE',
          entity: 'USER',
          entityId: userId,
          details: `Usuário "@${userUsername}" alterou sua própria senha com sucesso.`,
          timestamp: serverTimestamp()
        });
      } catch (logErr) {
        console.error('Audit log error on password change:', logErr);
      }

      // Reset form & notify
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess('Senha alterada com sucesso!');
      onClose();
    } catch (err: any) {
      console.error('Error changing password:', err);
      setError(err?.message || 'Erro ao alterar senha. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full space-y-6 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/30">
              <KeyRound className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Alterar Senha
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Atualize sua senha de acesso ao sistema.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Senha Atual</span>
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showCurrentPassword ? 'Ocultar' : 'Exibir'}
                </button>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Nova Senha</span>
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showNewPassword ? 'Ocultar' : 'Exibir'}
                </button>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting ? 'Salvando...' : 'Atualizar Senha'}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
