import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Users, 
  Eye, 
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
  AlertCircle, 
  UserCheck,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser, UserRole, ModuleVisibilityConfig, RoleVisibility } from '../types';

interface PermissionsManagementProps {
  appUsers: AppUser[];
  moduleVisibility: ModuleVisibilityConfig;
  onUpdateModuleVisibility: (newConfig: ModuleVisibilityConfig) => Promise<void>;
  onUpdateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
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
  activeRolePreview,
  setActiveRolePreview,
  currentUserId,
  currentUserRole
}: PermissionsManagementProps) {
  const [activeTab, setActiveTab] = useState<'visibility' | 'users' | 'new_user'>('visibility');
  const [localConfig, setLocalConfig] = useState<ModuleVisibilityConfig>(moduleVisibility);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Local state for user creation form
  const [accessForm, setAccessForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'user' as UserRole
  });
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessError(null);
    setIsSubmittingUser(true);
    try {
      let cleanUsername = accessForm.username.trim();
      if (cleanUsername.startsWith('@')) cleanUsername = cleanUsername.slice(1);

      await addDoc(collection(db, 'users'), {
        name: accessForm.name.trim(),
        username: cleanUsername,
        email: `${cleanUsername.toLowerCase()}@opscontrol.com`,
        role: accessForm.role,
        createdAt: serverTimestamp()
      });

      setSaveSuccess(`Usuário "${accessForm.name}" criado com sucesso!`);
      setTimeout(() => setSaveSuccess(null), 4000);
      setAccessForm({ username: '', password: '', name: '', role: 'user' });
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
    // Moderador access cannot be toggled off for essential safety
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
    } fontFinally: {
      setIsSavingVisibility(false);
    }
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
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <ShieldCheck className="w-64 h-64" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                Controle de Acessos & Perfis
              </span>
              <span className="text-xs font-bold text-slate-400">Exclusivo para Moderador</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">Perfis, Permissões & Visibilidade de Módulos</h1>
            <p className="text-sm font-medium text-slate-300 mt-1 max-w-2xl">
              Defina os níveis de acesso dos usuários, controle quais módulos estão visíveis para cada perfil e gerencie credenciais com segurança.
            </p>
          </div>

          {/* Role Preview Switcher */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-2">
            <div className="text-[10px] font-black uppercase text-slate-300 tracking-wider flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-blue-400" /> Testar Visão de Perfil
            </div>
            <div className="flex items-center gap-1.5">
              {(['moderator', 'admin', 'user'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => setActiveRolePreview(activeRolePreview === role ? null : role)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                    (activeRolePreview === role || (activeRolePreview === null && role === 'moderator'))
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-white/10 hover:bg-white/20 text-slate-300'
                  }`}
                >
                  {role === 'moderator' ? 'Moderador' : role === 'admin' ? 'Admin' : 'Usuário'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Messages */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
            <button onClick={() => setSaveSuccess(null)} className="p-1 hover:bg-emerald-500/20 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {saveError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm font-bold flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{saveError}</span>
            </div>
            <button onClick={() => setSaveError(null)} className="p-1 hover:bg-red-500/20 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtabs Bar */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('visibility')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'visibility'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          Visibilidade dos Módulos
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'users'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Usuários e Perfis ({appUsers.length})
        </button>

        <button
          onClick={() => setActiveTab('new_user')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'new_user'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      {/* TAB 1: VISIBILIDADE DOS MÓDULOS */}
      {activeTab === 'visibility' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Matriz de Visibilidade por Perfil de Acesso
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Marque quais módulos ficam visíveis na barra lateral de navegação para cada nível de perfil.
              </p>
            </div>

            <button
              onClick={handleSaveVisibility}
              disabled={isSavingVisibility}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 active:scale-95 disabled:opacity-50 shrink-0"
            >
              <Save className="w-4 h-4" />
              {isSavingVisibility ? 'Salvando...' : 'Salvar Matriz de Permissões'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-4 px-4 w-1/2">Módulo do Sistema</th>
                  <th className="py-4 px-4 text-center w-1/6">
                    <span className="px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300">
                      MODERADOR
                    </span>
                  </th>
                  <th className="py-4 px-4 text-center w-1/6">
                    <span className="px-2.5 py-1 rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                      ADMIN
                    </span>
                  </th>
                  <th className="py-4 px-4 text-center w-1/6">
                    <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      USUÁRIO
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {MODULE_DEFINITIONS.map(mod => {
                  const modConfig = localConfig[mod.key] || { moderator: true, admin: true, user: false };
                  return (
                    <tr key={mod.key} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800">
                            {mod.icon}
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-900 dark:text-white">
                              {mod.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {mod.description}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Moderador Checkbox */}
                      <td className="py-5 px-4 text-center">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={modConfig.moderator}
                            disabled
                            className="w-5 h-5 rounded-lg text-purple-600 focus:ring-purple-500 cursor-not-allowed opacity-80"
                          />
                        </div>
                      </td>

                      {/* Admin Checkbox */}
                      <td className="py-5 px-4 text-center">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={modConfig.admin}
                            onChange={() => handleToggleModule(mod.key, 'admin')}
                            className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </div>
                      </td>

                      {/* User Checkbox */}
                      <td className="py-5 px-4 text-center">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={modConfig.user}
                            onChange={() => handleToggleModule(mod.key, 'user')}
                            className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div className="font-bold text-slate-900 dark:text-white">Observação de Segurança:</div>
            <div>
              • Os módulos administrativos (Aprovações, Configurações, Gestão de Acessos e Auditorias) são de uso <strong>exclusivo do Moderador</strong> e permanecem restritos por padrão.
            </div>
            <div>
              • A permissão é validada tanto na interface quanto nas requisições do sistema.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USUÁRIOS E PERFIS */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Usuários Registrados & Alteração de Perfis
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Gerencie os níveis de acesso individuais de cada usuário cadastrado na plataforma.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {appUsers.map(usr => (
              <div
                key={usr.id}
                className="bg-slate-50 dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={`https://ui-avatars.com/api/?name=${usr.name || 'User'}&background=random`}
                      alt={usr.name}
                      className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {usr.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {usr.email}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Perfil do Usuário
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

                <div className="flex items-center justify-between pt-1">
                  {getRoleBadge(usr.role || 'user')}
                  <span className="text-[10px] text-slate-400">ID: {usr.id.slice(0, 8)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: NOVO USUÁRIO */}
      {activeTab === 'new_user' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-500" />
              Cadastrar Novo Usuário
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Crie novas credenciais de acesso para a equipe com o perfil apropriado.
            </p>
          </div>

          {accessError && (
            <div className="p-4 rounded-2xl bg-red-50 text-red-600 border border-red-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{accessError}</span>
            </div>
          )}

          <form onSubmit={handleCreateUserSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={accessForm.name}
                onChange={(e) => setAccessForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: João da Silva"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                Nome de Usuário (Username)
              </label>
              <input
                type="text"
                required
                value={accessForm.username}
                onChange={(e) => setAccessForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Ex: joao.silva"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                Senha de Acesso
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={accessForm.password}
                onChange={(e) => setAccessForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                Perfil de Acesso Inicial
              </label>
              <select
                value={accessForm.role}
                onChange={(e) => setAccessForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="user">USUÁRIO (Acesso Restrito)</option>
                <option value="admin">ADMIN (Acesso Operacional)</option>
                <option value="moderator">MODERADOR (Acesso Total)</option>
              </select>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmittingUser}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50"
              >
                {isSubmittingUser ? 'Cadastrando...' : 'Cadastrar Usuário'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
