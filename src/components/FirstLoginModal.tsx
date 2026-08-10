import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, ShieldAlert, CheckCircle2, KeyRound } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { hashPassword } from '../utils/authUtils';

interface FirstLoginModalProps {
  userId: string;
  userName: string;
  userEmail: string;
  onPasswordChanged: () => void;
  onLogout: () => void;
}

export function FirstLoginModal({
  userId,
  userName,
  userEmail,
  onPasswordChanged,
  onLogout
}: FirstLoginModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação de senha não confere com a nova senha.');
      return;
    }

    setIsSubmitting(true);
    try {
      const hashed = await hashPassword(newPassword);

      // Update user in Firestore: invalidate temp password, set new hash, mark first access completed
      await updateDoc(doc(db, 'users', userId), {
        passwordHash: hashed,
        mustChangePassword: false,
        isFirstLoginCompleted: true,
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });

      // Audit log
      try {
        await addDoc(collection(db, 'auditLogs'), {
          userId,
          userName,
          userEmail,
          action: 'UPDATE',
          entity: 'USER',
          entityId: userId,
          details: `Usuário "${userName}" concluiu o primeiro acesso e redefiniu sua senha com sucesso.`,
          timestamp: serverTimestamp()
        });
      } catch (logErr) {
        console.error('Error writing audit log for first login:', logErr);
      }

      onPasswordChanged();
    } catch (err: any) {
      console.error('Error updating password on first login:', err);
      setError(err?.message || 'Erro ao salvar nova senha. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
            <KeyRound className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Primeiro Acesso
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              Por segurança, você precisa criar uma nova senha pessoal para continuar acessando o sistema.
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
              <span>Nova Senha</span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPassword ? 'Ocultar' : 'Exibir'}
              </button>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
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
                type={showPassword ? 'text' : 'password'}
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
              {isSubmitting ? 'Salvando...' : 'Salvar Nova Senha & Entrar'}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Sair da Conta
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
