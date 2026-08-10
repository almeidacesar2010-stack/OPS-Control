import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Users, 
  Settings, 
  UserPlus, 
  Check, 
  X, 
  Save, 
  Key, 
  LayoutGrid, 
  Container, 
  Droplet, 
  Building2, 
  Boxes, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle,
  AlertCircle, 
  UserCheck,
  Edit3,
  Trash2,
  Lock,
  Mail,
  User as UserIcon,
  Power,
  KeyRound,
  Copy,
  Clock,
  RefreshCw,
  Send,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser, UserRole, ModuleVisibilityConfig } from '../types';
import { hashPassword, generateTempPassword, sendUserCredentialsEmail } from '../utils/authUtils';

interface PermissionsManagementProps {
  appUsers: AppUser[];
  moduleVisibility: ModuleVisibilityConfig;
  onUpdateModuleVisibility: (newConfig: ModuleVisibilityConfig) => Promise<void>;
  onUpdateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  onUpdateUserFullProfile?: (userId: string, data: { name: string; username: string; email: string; role: UserRole }) => Promise<void>;
  onDeleteUser?: (userId: string, userName: string) => Promise<void>;
  activeRolePreview: UserRole | null;
  setActiveRolePreview: (role: UserRole | null) => void;
  currentUserId: string;
  currentUserRole: UserRole;
}

const MODULE_DEFINITIONS: { key: keyof ModuleVisibilityConfig; name: string; description: string; icon: React.ReactNode }[] = [
  {
    key: 'dashboard',
    name: 'Painel de Produtividade',
    description: 'Dashboard principal com métricas, gráficos e KPIs operacionais',
    icon: <LayoutGrid className="w-4 h-4 text-blue-500" />
  },
  {
    key: 'orders',
    name: 'Gestão de OS (Ordens de Serviço)',
    description: 'Abertura, acompanhamento e fechamento de ordens de manutenção',
    icon: <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
  },
  {
    key: 'fleet',
    name: 'Gestão da Frota & PCP',
    description: 'Controle de ativos de frota, inspeções visuais/END e alertas PCP',
    icon: <Container className="w-4 h-4 text-purple-500" />
  },
  {
    key: 'decontamination',
    name: 'Módulo de Descontaminação',
    description: 'Gestão de lavagem e descontaminação de tanques operacionais',
    icon: <Droplet className="w-4 h-4 text-cyan-500" />
  },
  {
    key: 'clients',
    name: 'Gestão de Clientes',
    description: 'Cadastro e consulta de clientes parceiros',
    icon: <Building2 className="w-4 h-4 text-amber-500" />
  },
  {
    key: 'equipments',
    name: 'Gestão de Equipamentos',
    description: 'Ativos cadastrados e especificações de tanques',
    icon: <Boxes className="w-4 h-4 text-indigo-500" />
  }
];

export function PermissionsManagement({
  appUsers,
  moduleVisibility,
  onUpdateModuleVisibility,
  onUpdateUserRole,
  onUpdateUserFullProfile,
  onDeleteUser,
  activeRolePreview,
  setActiveRolePreview,
  currentUserId,
  currentUserRole
}: PermissionsManagementProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'new_user' | 'visibility'>('users');
  const [localConfig, setLocalConfig] = useState<ModuleVisibilityConfig>(moduleVisibility);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // User edit state
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    email: '',
    role: 'user' as UserRole
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // User deletion state
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Reset password state
  const [userToResetPassword, setUserToResetPassword] = useState<AppUser | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Success modal after creation / reset
  const [createdCredentialsModal, setCreatedCredentialsModal] = useState<{
    isOpen: boolean;
    title: string;
    userName: string;
    userEmail: string;
    tempPassword: string;
    isReset: boolean;
    emailSent: boolean;
  }>({
    isOpen: false,
    title: '',
    userName: '',
    userEmail: '',
    tempPassword: '',
    isReset: false,
    emailSent: false
  });

  const [copiedPassword, setCopiedPassword] = useState(false);

  // User creation form
  const [accessForm, setAccessForm] = useState({
    name: '',
    username: '',
    email: '',
    role: 'user' as UserRole
  });
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const formatDate = (val: any) => {
    if (!val) return 'Nunca acessou';
    try {
      const date = val?.toDate ? val.toDate() : new Date(val);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return 'N/A';
    }
  };

  const handleOpenEditUser = (usr: AppUser) => {
    setEditingUser(usr);
    setEditForm({
      name: usr.name || '',
      username: usr.username || (usr.email ? usr.email.split('@')[0] : ''),
      email: usr.email || '',
      role: usr.role || 'user'
    });
  };

  const handleSaveEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingEdit(true);
    setSaveError(null);
    try {
      let cleanUsername = editForm.username.trim();
      if (cleanUsername.startsWith('@')) cleanUsername = cleanUsername.slice(1);

      if (onUpdateUserFullProfile) {
        await onUpdateUserFullProfile(editingUser.id, {
          name: editForm.name.trim(),
          username: cleanUsername,
          email: editForm.email.trim(),
          role: editForm.role
        });
      } else {
        await updateDoc(doc(db, 'users', editingUser.id), {
          name: editForm.name.trim(),
          username: cleanUsername,
          email: editForm.email.trim(),
          role: editForm.role,
          updatedAt: serverTimestamp()
        });
      }

      await addDoc(collection(db, 'auditLogs'), {
        userId: currentUserId,
        userName: 'Moderador',
        userEmail: 'moderador@opscontrol.com',
        action: 'UPDATE',
        entity: 'USER',
        entityId: editingUser.id,
        details: `Atualizou o perfil do usuário "${editForm.name}" para perfil "${editForm.role.toUpperCase()}".`,
        timestamp: serverTimestamp()
      });

      setSaveSuccess(`Perfil de "${editForm.name}" atualizado com sucesso!`);
      setTimeout(() => setSaveSuccess(null), 4000);
      setEditingUser(null);
    } catch (err: any) {
      console.error('Error saving user edit:', err);
      setSaveError(err?.message || 'Erro ao atualizar dados do usuário.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleUserStatus = async (usr: AppUser) => {
    const newStatus = (usr.status || 'active') === 'active' ? 'inactive' : 'active';
    const actionName = newStatus === 'active' ? 'Ativou' : 'Desativou';

    try {
      await updateDoc(doc(db, 'users', usr.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'auditLogs'), {
        userId: currentUserId,
        userName: 'Moderador',
        userEmail: 'moderador@opscontrol.com',
        action: 'UPDATE',
        entity: 'USER',
        entityId: usr.id,
        details: `${actionName} o acesso do usuário "${usr.name}".`,
        timestamp: serverTimestamp()
      });

      setSaveSuccess(`Usuário "${usr.name}" foi ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso!`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      console.error('Error toggling user status:', err);
      setSaveError('Erro ao alterar status do usuário.');
    }
  };

  const handleConfirmResetPassword = async () => {
    if (!userToResetPassword) return;
    setIsResettingPassword(true);
    setSaveError(null);

    try {
      const tempPassword = generateTempPassword(10);
      const passwordHash = await hashPassword(tempPassword);

      // Invalidate previous password and set mustChangePassword to true
      await updateDoc(doc(db, 'users', userToResetPassword.id), {
        passwordHash,
        mustChangePassword: true,
        updatedAt: serverTimestamp()
      });

      // Send email via backend service
      const emailRes = await sendUserCredentialsEmail({
        to: userToResetPassword.email,
        name: userToResetPassword.name,
        email: userToResetPassword.email,
        tempPassword,
        isReset: true
      });

      // Audit log (never log password)
      await addDoc(collection(db, 'auditLogs'), {
        userId: currentUserId,
        userName: 'Moderador',
        userEmail: 'moderador@opscontrol.com',
        action: 'UPDATE',
        entity: 'USER',
        entityId: userToResetPassword.id,
        details: `Redefiniu a senha do usuário "${userToResetPassword.name}". Nova senha temporária gerada e e-mail enviado.`,
        timestamp: serverTimestamp()
      });

      setCreatedCredentialsModal({
        isOpen: true,
        title: 'Senha Redefinida com Sucesso!',
        userName: userToResetPassword.name,
        userEmail: userToResetPassword.email,
        tempPassword,
        isReset: true,
        emailSent: emailRes.success
      });

      setUserToResetPassword(null);
    } catch (err: any) {
      console.error('Error resetting user password:', err);
      setSaveError(err?.message || 'Erro ao redefinir a senha do usuário.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    setSaveError(null);
    try {
      if (onDeleteUser) {
        await onDeleteUser(userToDelete.id, userToDelete.name);
      } else {
        await deleteDoc(doc(db, 'users', userToDelete.id));
      }

      await addDoc(collection(db, 'auditLogs'), {
        userId: currentUserId,
        userName: 'Moderador',
        userEmail: 'moderador@opscontrol.com',
        action: 'DELETE',
        entity: 'USER',
        entityId: userToDelete.id,
        details: `Excluiu a conta do usuário "${userToDelete.name}".`,
        timestamp: serverTimestamp()
      });

      setSaveSuccess(`Usuário "${userToDelete.name}" foi removido do sistema.`);
      setTimeout(() => setSaveSuccess(null), 4000);
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setSaveError(err?.message || 'Erro ao excluir usuário.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessError(null);

    if (!accessForm.name.trim() || !accessForm.email.trim()) {
      setAccessError('Por favor, preencha o Nome Completo e o E-mail do usuário.');
      return;
    }

    setIsSubmittingUser(true);
    try {
      let cleanUsername = accessForm.username.trim();
      if (!cleanUsername) {
        cleanUsername = accessForm.email.trim().split('@')[0];
      }
      if (cleanUsername.startsWith('@')) cleanUsername = cleanUsername.slice(1);

      // Generate random temporary password
      const tempPassword = generateTempPassword(10);
      const passwordHash = await hashPassword(tempPassword);

      // Save user to Firestore with hashed temp password and mustChangePassword = true
      const newUserRef = await addDoc(collection(db, 'users'), {
        name: accessForm.name.trim(),
        username: cleanUsername,
        email: accessForm.email.trim().toLowerCase(),
        role: accessForm.role,
        status: 'active',
        passwordHash,
        mustChangePassword: true,
        isFirstLoginCompleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Send credentials email via backend API
      const emailRes = await sendUserCredentialsEmail({
        to: accessForm.email.trim().toLowerCase(),
        name: accessForm.name.trim(),
        email: accessForm.email.trim().toLowerCase(),
        tempPassword,
        isReset: false
      });

      // Write audit log
      await addDoc(collection(db, 'auditLogs'), {
        userId: currentUserId,
        userName: 'Moderador',
        userEmail: 'moderador@opscontrol.com',
        action: 'CREATE',
        entity: 'USER',
        entityId: newUserRef.id,
        details: `Cadastrou o novo usuário "${accessForm.name.trim()}" (${accessForm.role.toUpperCase()}). Senha temporária enviada por e-mail.`,
        timestamp: serverTimestamp()
      });

      setCreatedCredentialsModal({
        isOpen: true,
        title: 'Novo Usuário Cadastrado!',
        userName: accessForm.name.trim(),
        userEmail: accessForm.email.trim().toLowerCase(),
        tempPassword,
        isReset: false,
        emailSent: emailRes.success
      });

      setAccessForm({ name: '', username: '', email: '', role: 'user' });
      setActiveTab('users');
    } catch (err: any) {
      console.error('Error creating user:', err);
      setAccessError(err?.message || 'Erro ao cadastrar novo usuário.');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Sync state if prop changes
  React.useEffect(() => {
    setLocalConfig(moduleVisibility);
  }, [moduleVisibility]);

  const handleToggleModule = (moduleKey: keyof ModuleVisibilityConfig, role: 'moderator' | 'admin' | 'user') => {
    if (role === 'moderator') return;

    setLocalConfig(prev => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [role]: !prev[moduleKey][role]
      }
    }));
  };

  const handleSaveVisibility = async () => {
    setIsSavingVisibility(true);
    setSaveError(null);
    try {
      await onUpdateModuleVisibility(localConfig);
      setSaveSuccess('Configurações de visibilidade dos módulos salvas com sucesso!');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      console.error('Error saving module visibility:', err);
      setSaveError(err?.message || 'Erro ao salvar configurações de visibilidade.');
    } finally {
      setIsSavingVisibility(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  const getRoleBadge = (role: UserRole) => {
    if (role === 'moderator') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 font-black text-[10px] uppercase border border-purple-300">
          MODERADOR
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 font-black text-[10px] uppercase border border-blue-300">
          ADMIN
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-black text-[10px] uppercase border border-slate-300">
        USUÁRIO
      </span>
    );
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-black uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Painel do Moderador
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              Gerenciamento de Usuários e Permissões
            </h1>
            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed">
              Crie e gerencie contas de usuários com senhas temporárias enviadas por e-mail, controle níveis de acesso e redefina credenciais com total segurança.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4" />
              Gerenciar Usuários ({appUsers.length})
            </button>

            <button
              onClick={() => setActiveTab('new_user')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'new_user'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              Criar Usuário
            </button>

            <button
              onClick={() => setActiveTab('visibility')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'visibility'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-4 h-4" />
              Visibilidade de Módulos
            </button>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccess}</span>
          </motion.div>
        )}

        {saveError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TAB 1: GERENCIAR USUÁRIOS */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Usuários Registrados ({appUsers.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Como Moderador, você pode visualizar dados dos usuários, alterar perfis de acesso, ativar/desativar contas e redefinir senhas com envio de e-mail.
              </p>
            </div>

            <button
              onClick={() => setActiveTab('new_user')}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Novo Usuário
            </button>
          </div>

          {/* Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {appUsers.map(usr => {
              const isActive = (usr.status || 'active') === 'active';
              const isFirstLoginCompleted = usr.isFirstLoginCompleted ?? (!usr.mustChangePassword);

              return (
                <div
                  key={usr.id}
                  className={`rounded-3xl p-6 border transition-all flex flex-col justify-between space-y-5 ${
                    isActive
                      ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80'
                      : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40 opacity-85'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header Info */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(usr.name || 'User')}&background=random`}
                          alt={usr.name}
                          className="w-12 h-12 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0 object-cover"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {usr.name}
                          </div>
                          <div className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate">
                            @{usr.username || (usr.email ? usr.email.split('@')[0] : 'usuario')}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {usr.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {getRoleBadge(usr.role || 'user')}
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border flex items-center gap-1 ${
                          isActive
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border-rose-300'
                        }`}>
                          {isActive ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                          {isActive ? 'ATIVO' : 'INATIVO'}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Box */}
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-bold">1º Acesso Concluído:</span>
                        {isFirstLoginCompleted ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Sim
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-black flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Não (Pendente)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-bold">Último Acesso:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {formatDate(usr.lastLoginAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 font-bold">Data de Criação:</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                          {formatDate(usr.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Role selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Perfil de Acesso
                      </label>
                      <select
                        value={usr.role || 'user'}
                        onChange={(e) => onUpdateUserRole(usr.id, e.target.value as UserRole)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="moderator">MODERADOR (Acesso Total)</option>
                        <option value="admin">ADMIN (Acesso Operacional)</option>
                        <option value="user">USUÁRIO (Acesso Restrito)</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="space-y-2 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditUser(usr)}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/60 dark:border-blue-800/60 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar
                      </button>

                      <button
                        onClick={() => setUserToResetPassword(usr)}
                        className="flex-1 py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200/60 dark:border-amber-800/60 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Redefinir Senha Temporária e enviar por e-mail"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Redefinir Senha
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleUserStatus(usr)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isActive
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-300/60'
                            : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 border-emerald-200/60'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {isActive ? 'Desativar' : 'Ativar'}
                      </button>

                      <button
                        onClick={() => setUserToDelete(usr)}
                        className="py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/60 dark:border-rose-800/60 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Excluir Conta do Usuário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CRIAR NOVO USUÁRIO */}
      {activeTab === 'new_user' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Cadastrar Novo Usuário
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                O sistema gerará automaticamente uma senha temporária segura e enviará as credenciais de acesso para o e-mail do usuário.
              </p>
            </div>
          </div>

          {accessError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{accessError}</span>
            </div>
          )}

          <form onSubmit={handleCreateUserSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={accessForm.name}
                onChange={(e) => setAccessForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Carlos Eduardo Silva"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-500" />
                  E-mail de Login *
                </label>
                <input
                  type="email"
                  required
                  value={accessForm.email}
                  onChange={(e) => setAccessForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@empresa.com"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-purple-500" />
                  Nome de Usuário (Username)
                </label>
                <input
                  type="text"
                  value={accessForm.username}
                  onChange={(e) => setAccessForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Opcional (Ex: carlos.silva)"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                Perfil de Acesso
              </label>
              <select
                value={accessForm.role}
                onChange={(e) => setAccessForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="moderator">MODERADOR (Acesso Total e Gestão)</option>
                <option value="admin">ADMIN (Acesso Operacional e Leitura)</option>
                <option value="user">USUÁRIO (Acesso Restrito)</option>
              </select>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 text-xs text-blue-800 dark:text-blue-300 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                Início Seguro com Senha Temporária:
              </p>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                • Uma senha aleatória temporária será gerada no cadastro.<br />
                • As instruções e dados de login serão automaticamente enviados por e-mail.<br />
                • No primeiro login, o usuário será obrigado a cadastrar sua nova senha pessoal.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmittingUser}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {isSubmittingUser ? 'Cadastrando e Enviando E-mail...' : 'Cadastrar Usuário'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: VISIBILIDADE DE MÓDULOS */}
      {activeTab === 'visibility' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                Matriz de Visibilidade dos Módulos
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Defina quais menus e visões ficam visíveis no menu lateral para Administradores e Usuários.
              </p>
            </div>

            <button
              onClick={handleSaveVisibility}
              disabled={isSavingVisibility}
              className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSavingVisibility ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400">
                  <th className="py-4 px-4">Módulo da Plataforma</th>
                  <th className="py-4 px-4 text-center w-36">Moderador</th>
                  <th className="py-4 px-4 text-center w-36">Admin</th>
                  <th className="py-4 px-4 text-center w-36">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {MODULE_DEFINITIONS.map(mod => {
                  const cfg = localConfig[mod.key] || { moderator: true, admin: true, user: true };

                  return (
                    <tr key={mod.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                            {mod.icon}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {mod.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {mod.description}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Moderador - Sempre True */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold text-xs cursor-not-allowed">
                          <Check className="w-4 h-4" />
                        </div>
                      </td>

                      {/* Admin Toggle */}
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleModule(mod.key, 'admin')}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            cfg.admin
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-200'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {cfg.admin ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </button>
                      </td>

                      {/* User Toggle */}
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleModule(mod.key, 'user')}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            cfg.user
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {cfg.user ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUCCESS CREDENTIALS & TEMP PASSWORD MODAL */}
      <AnimatePresence>
        {createdCredentialsModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full space-y-6"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {createdCredentialsModal.title}
                  </h3>
                  <p className="text-xs text-slate-500">Credenciais geradas e armazenadas com hash seguro</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Usuário:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{createdCredentialsModal.userName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">E-mail:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{createdCredentialsModal.userEmail}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4" />
                      Senha Temporária Gerada
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdCredentialsModal.tempPassword)}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedPassword ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <div className="font-mono text-base font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-300 dark:border-amber-700/50 text-center tracking-widest select-all">
                    {createdCredentialsModal.tempPassword}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1 leading-relaxed">
                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-500" />
                    Status do Envio de E-mail:
                  </p>
                  <p>
                    {createdCredentialsModal.emailSent
                      ? `✓ As instruções e a senha temporária foram enviadas por e-mail para ${createdCredentialsModal.userEmail}.`
                      : `• O e-mail foi registrado. Caso necessário, forneça a senha temporária acima ao usuário.`
                    }
                  </p>
                  <p className="text-[11px] text-slate-400 pt-1">
                    • No próximo login, o usuário será obrigado a cadastrar sua nova senha pessoal.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreatedCredentialsModal(prev => ({ ...prev, isOpen: false }))}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT USER MODAL */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Editar Perfil do Usuário
                    </h3>
                    <p className="text-xs text-slate-500">ID: {editingUser.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditUserSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-purple-500" />
                    Nome de Usuário (Username)
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-500" />
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    Perfil de Acesso
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="moderator">MODERADOR (Acesso Total)</option>
                    <option value="admin">ADMIN (Acesso Operacional)</option>
                    <option value="user">USUÁRIO (Acesso Restrito)</option>
                  </select>
                </div>

                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
                  💡 Para redefinir a senha deste usuário, utilize o botão <strong className="text-amber-600 dark:text-amber-400">"Redefinir Senha"</strong> no painel.
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM RESET PASSWORD MODAL */}
      <AnimatePresence>
        {userToResetPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full space-y-6"
            >
              <div className="flex items-center gap-4 text-amber-600 dark:text-amber-400">
                <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/60">
                  <KeyRound className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                    Redefinir Senha do Usuário
                  </h3>
                  <p className="text-xs text-slate-500">Envio automático de senha temporária</p>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
                <p>
                  Tem certeza que deseja redefinir a senha de <strong className="text-slate-900 dark:text-white">{userToResetPassword.name}</strong> ({userToResetPassword.email})?
                </p>
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-bold">• O que acontecerá:</p>
                  <p>1. Uma nova senha temporária será gerada automaticamente.</p>
                  <p>2. A senha anterior deixará de funcionar imediatamente.</p>
                  <p>3. As novas credenciais serão enviadas para o e-mail do usuário.</p>
                  <p>4. O usuário será obrigado a cadastrar uma nova senha no próximo login.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUserToResetPassword(null)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResetPassword}
                  disabled={isResettingPassword}
                  className="flex-1 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-600/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isResettingPassword ? 'animate-spin' : ''}`} />
                  {isResettingPassword ? 'Gerando...' : 'Confirmar Redefinição'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE USER MODAL */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full space-y-6"
            >
              <div className="flex items-center gap-4 text-rose-600 dark:text-rose-400">
                <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/60">
                  <Trash2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                    Excluir Conta do Usuário
                  </h3>
                  <p className="text-xs text-slate-500">Ação de exclusão permanente</p>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <p>
                  Tem certeza que deseja excluir permanentemente a conta de <strong className="text-slate-900 dark:text-white">{userToDelete.name}</strong> ({userToDelete.email})?
                </p>
                <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-medium">
                  • Este usuário perderá imediatamente todo o acesso à plataforma.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteUser}
                  disabled={isDeletingUser}
                  className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingUser ? 'Excluindo...' : 'Sim, Excluir Usuário'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
