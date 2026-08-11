import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  setDoc,
  query, 
  where, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  getDocFromServer,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import firebaseConfig from '../firebase-applet-config.json';
import { db, auth } from './firebase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  differenceInDays, 
  parseISO, 
  isWithinInterval,
  subMonths,
  eachMonthOfInterval
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Plus, 
  LogOut, 
  Calendar,
  Settings,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Building2,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  BarChart3,
  FileText,
  Edit,
  Maximize2,
  X,
  Upload,
  Search,
  CheckSquare,
  Square,
  Image as ImageIcon,
  Sun,
  Moon,
  Check,
  LayoutGrid,
  List,
  Wrench,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Timer,
  Container,
  Boxes,
  Package,
  MoreHorizontal,
  Hash,
  AlertTriangle,
  Eye,
  Printer,
  Droplet,
  KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { FleetEquipment, FleetHistoryEntry, FleetNonConformity } from './types/fleet';
import { FleetManagement } from './components/FleetManagement';
import { isDateOrInvalidEquipmentNumber } from './components/FleetImportModal';
import { calculateDaysRemaining } from './utils/fleetUtils';
import { DecontaminationOperation } from './types/decontamination';
import { DecontaminationManagement } from './components/DecontaminationManagement';
import { PendingApprovals } from './components/PendingApprovals';
import { PermissionsManagement } from './components/PermissionsManagement';
import { FirstLoginModal } from './components/FirstLoginModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { hashPassword, findUserByUsernameOrEmail, getUsernameInternalEmail } from './utils/authUtils';
import { DeleteRequestModal } from './components/DeleteRequestModal';
import { DeletionRequest, ModuleVisibilityConfig, UserRole, AppUser } from './types';

// Types
interface Client {
  id: string;
  cnpj: string;
  razaoSocial: string;
  userId: string;
  createdAt: Timestamp;
}

interface InspectionCheck {
  status: 'OK' | 'NA' | 'NC';
  value?: string;
}

interface ServiceOrder {
  id: string;
  equipmentNumber: string;
  family: string;
  subFamily?: string;
  clientId: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  status: 'Em Manutenção' | 'Concluído';
  priority?: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  maintenanceScope?: string;
  leadTime?: number;
  userId: string;
  createdAt: Timestamp;
  createdBy?: string;
  maintenanceTechnician?: string;
  closedBy?: string;
  slingCheck?: InspectionCheck;
  damagedSlingCheck?: InspectionCheck;
  excessiveCorrosionCheck?: InspectionCheck;
  primaryStructureCheck?: InspectionCheck;
  secondaryStructureCheck?: InspectionCheck;
  damagedBagCheck?: InspectionCheck;
  bottomCheck?: InspectionCheck;
  roofCheck?: InspectionCheck;
  tieDownPointCheck?: InspectionCheck;
  doorCheck?: InspectionCheck;
  lidCheck?: InspectionCheck;
  leverCheck?: InspectionCheck;
  leverSupportCheck?: InspectionCheck;
  roundHeadRivetCheck?: InspectionCheck;
  clawCheck?: InspectionCheck;
  retainerCheck?: InspectionCheck;
  rodCheck?: InspectionCheck;
  simpleRodSupportCheck?: InspectionCheck;
  specialRodSupportCheck?: InspectionCheck;
  rodLockCheck?: InspectionCheck;
  hingeCheck?: InspectionCheck;
  reworkCheck?: InspectionCheck;
}

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'OS' | 'CLIENT' | 'USER' | 'SETTINGS' | 'EQUIPMENT' | 'FLEET';
  entityId: string;
  details: string;
  timestamp: Timestamp;
}

interface Equipment {
  id: string;
  tag: string;
  family: string;
  subFamily?: string;
  userId: string;
  createdAt: Timestamp;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const CCU_SUBFAMILIES = [
  "1.5M TOOL BOX",
  "3M TOOL BOX",
  "4M DRUM BASKET",
  "MINI CONTAINER",
  "6M BASKET",
  "8M BASKET",
  "8M PIPE BASKET",
  "10.3M BASKET",
  "10FT DRY",
  "10FT HH",
  "10FT OPEN TOP",
  "10FT REEFER",
  "12.3M BASKET",
  "12M BASKET",
  "14M BASKET",
  "16.3M BASKET",
  "20FT DRY",
  "20FT OPEN TOP",
  "CUTTING BOX",
  "SKID GBR"
];

const PRE_REGISTERED_CLIENTS = [
  "SLB", "BALEEN", "OCEANEERING", "HALLIBURTON", "EQUINOR", "ONESUBSEA", 
  "NE DRILLING", "CETCO", "WILSON SONS", "UNI", "ESTRUTURAL", "CONTINENTAL", 
  "3R PETROLEUM", "M&I ELETRIC", "GASTROSERVICE", "ISOMARINS", "IKM", 
  "LOADTEST", "PACIFIC", "MARINE", "B-PORT", "MARFOOD", "FRATELLI", 
  "UNIFLEX", "ELASA", "FRANK´S", "WEATHERFORD", "WELLBORE", 
  "PETRO RIO", "CIS BRASIL", "DOW", "M-I SWACO", "PINAMAK", "DORF", 
  "CHAMPIONX", "CONSTELLATION", "SNF", "SHELL", "LUBRITECH", "REDA", 
  "OPEN SEA", "PETROGOTAS", "NOV", "TEJAS WELL", "OIL WELL", "BRAVA ENERGY", "HELIX"
];

const DEMO_EQUIPMENTS = [
  "8MPB14509", "8MPB14514", "SER0000143", "MINI14639", "MINI14695", 
  "M-M-6-1818", "M-M-6-1821", "M-M-6-1837", "365892", "HMHU920466", 
  "OEGU920805", "OEGU920815", "OEGU920819", "OEGU920823", "OEGU920830", 
  "OEGU920832", "OEGU920837", "OEGU920849", "OEGU920850", "OEGU920853", 
  "HMHU920542", "HMHU920636", "HMHU920654", "HMHU920658", "HMHU920675", 
  "MINI14612", "OEGU920821", "HMHU920397", "HMHU920465", "HMHU920519", 
  "HMHU920626", "HMHU920632", "HMHU920644", "HMHU920650", "STC-5000-001", 
  "HMHU920386", "HMHU920472", "HMHU920530", "OEGU920693-4", "OEGU920701-5", 
  "OEGU920713-9", "OEGU920721-0", "HMHU920447", "HMHU920580", "HMHU920642", 
  "HMHU920645", "HMHU920648", "HMHU920649", "12.3MB14533", "12.3MB14535",
  "351980", "354001", "351305", "365905", "351307", "354047", "351961", 
  "351967", "354003", "354019", "354042", "365901", "354038", "351302", 
  "351315", "351326", "351959", "365884", "365894", "365909", "351986", 
  "354006", "351311", "351974", "353996"
];

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-rose-500/20 rounded-3xl flex items-center justify-center mb-8">
            <AlertCircle className="w-10 h-10 text-rose-500" />
          </div>
          <h1 className="text-3xl font-black text-white mb-4 tracking-tight uppercase">Ops! Algo deu errado</h1>
          <p className="text-slate-400 max-w-md mb-8 font-bold leading-relaxed">
            Ocorreu um erro inesperado na aplicação. Tente recarregar a página ou clique no botão abaixo para resetar o estado.
          </p>
          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 mb-8 w-full max-w-lg overflow-auto">
            <code className="text-xs text-rose-400 font-mono block text-left whitespace-pre-wrap">
              {this.state.error?.message}
            </code>
          </div>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 active:scale-95"
          >
            Resetar e Recarregar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

const InspectionRow = ({ 
  label, 
  value, 
  onToggle, 
  onValueChange, 
  placeholder,
  okLabel = "OK",
  ncLabel = "NC",
  naLabel = "NA"
}: { 
  label: string; 
  value: InspectionCheck; 
  onToggle: (status: 'OK' | 'NA' | 'NC') => void;
  onValueChange: (val: string) => void;
  placeholder?: string;
  okLabel?: string;
  ncLabel?: string;
  naLabel?: string;
}) => (
  <div className={cn(
    "flex flex-col gap-2 p-4 rounded-2xl transition-all duration-300 border",
    value.status === 'OK' 
      ? "bg-white dark:bg-slate-900 border-emerald-500/30 shadow-lg shadow-emerald-500/5" 
      : value.status === 'NC'
      ? "bg-white dark:bg-slate-900 border-rose-500/30 shadow-lg shadow-rose-500/5"
      : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800"
  )}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn(
          "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300",
          value.status === 'OK' 
            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" 
            : value.status === 'NC'
            ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
            : "bg-slate-200 dark:bg-slate-800 text-slate-400"
        )}>
          {value.status === 'OK' ? <CheckSquare className="w-3.5 h-3.5" /> : value.status === 'NC' ? <AlertTriangle className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
        </div>
        <span className={cn(
          "text-[11px] font-black uppercase tracking-tight transition-colors truncate",
          value.status === 'OK' ? "text-slate-900 dark:text-white" : value.status === 'NC' ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"
        )}>
          {label}
        </span>
      </div>
      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50 gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onToggle('OK')}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all duration-200 flex items-center justify-center gap-1 whitespace-nowrap",
            value.status === 'OK' 
              ? "bg-emerald-500 text-white shadow-sm" 
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          )}
        >
          <CheckSquare className="w-3 h-3" />
          <span>{okLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => onToggle('NC')}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all duration-200 flex items-center justify-center gap-1 whitespace-nowrap",
            value.status === 'NC' 
              ? "bg-rose-500 text-white shadow-sm" 
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          )}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>{ncLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => onToggle('NA')}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all duration-200 flex items-center justify-center gap-1 whitespace-nowrap",
            value.status === 'NA' 
              ? "bg-slate-800 dark:bg-slate-700 text-white shadow-sm" 
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          )}
        >
          <X className="w-3 h-3" />
          <span>{naLabel}</span>
        </button>
      </div>
    </div>
    <div className="mt-1">
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder || "Observações do item..."}
          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 focus:border-blue-500/40 rounded-xl outline-none transition-all font-bold text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          value={value.value || ''}
          onChange={(e) => onValueChange(e.target.value)}
        />
        {value.value && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
          </div>
        )}
      </div>
    </div>
  </div>
);

const DocInspectionTableRow = ({
  label,
  value,
  onToggle,
  onValueChange,
  placeholder = "Descreva observações ou 'OK'..."
}: {
  label: string;
  value: InspectionCheck;
  onToggle: (status: 'OK' | 'NA' | 'NC') => void;
  onValueChange: (val: string) => void;
  placeholder?: string;
}) => (
  <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors border-b border-slate-200/80 dark:border-slate-800">
    <td className="py-3 px-4 font-black text-slate-900 dark:text-white uppercase text-xs align-middle">
      {label}
    </td>
    <td className="py-2.5 px-3 text-center align-middle whitespace-nowrap">
      <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-inner gap-1">
        <button
          type="button"
          onClick={() => onToggle('OK')}
          className={cn(
            "px-3 py-1 rounded-lg text-xs font-black tracking-wider transition-all cursor-pointer",
            value?.status === 'OK'
              ? "bg-emerald-600 text-white shadow-md scale-105"
              : "text-slate-500 hover:text-emerald-600 dark:text-slate-400"
          )}
        >
          OK
        </button>
        <button
          type="button"
          onClick={() => onToggle('NC')}
          className={cn(
            "px-3 py-1 rounded-lg text-xs font-black tracking-wider transition-all cursor-pointer",
            value?.status === 'NC'
              ? "bg-rose-600 text-white shadow-md scale-105"
              : "text-slate-500 hover:text-rose-600 dark:text-slate-400"
          )}
        >
          NC
        </button>
        <button
          type="button"
          onClick={() => onToggle('NA')}
          className={cn(
            "px-3 py-1 rounded-lg text-xs font-black tracking-wider transition-all cursor-pointer",
            value?.status === 'NA' || !value?.status
              ? "bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900 shadow-md scale-105"
              : "text-slate-400 hover:text-slate-700 dark:text-slate-500"
          )}
        >
          N/A
        </button>
      </div>
    </td>
    <td className="py-2 px-3 align-middle">
      <input
        type="text"
        value={value?.value || ''}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
    </td>
  </tr>
);

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'fleet' | 'decontamination' | 'clients' | 'equipments' | 'approvals' | 'access' | 'settings' | 'audits'>('decontamination');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [fleetEquipment, setFleetEquipment] = useState<FleetEquipment[]>([]);
  const [fleetHistory, setFleetHistory] = useState<FleetHistoryEntry[]>([]);
  const [decontaminationOperations, setDecontaminationOperations] = useState<DecontaminationOperation[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('user');
  const [moduleVisibility, setModuleVisibility] = useState<ModuleVisibilityConfig>({
    dashboard: { moderator: true, admin: false, user: false },
    orders: { moderator: true, admin: false, user: false },
    fleet: { moderator: true, admin: false, user: false },
    decontamination: { moderator: true, admin: true, user: true },
    clients: { moderator: true, admin: true, user: false },
    equipments: { moderator: true, admin: true, user: true },
  });
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [activeRolePreview, setActiveRolePreview] = useState<UserRole | null>(null);
  const [mustChangePasswordUser, setMustChangePasswordUser] = useState<{
    userId: string;
    userName: string;
    userEmail: string;
  } | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const effectiveRole: UserRole = activeRolePreview || currentUserRole;
  const isSuperAdmin = user?.email === "almeidacesar2010@gmail.com";
  const isModerator = effectiveRole === 'moderator' || (isSuperAdmin && !activeRolePreview);
  const isAdmin = effectiveRole === 'admin' || (isSuperAdmin && activeRolePreview === 'admin');
  const canSeeDelete = effectiveRole === 'admin' || effectiveRole === 'moderator' || (isSuperAdmin && !activeRolePreview);
  const canDelete = canSeeDelete;

  // Authorization helper function
  const isTabAllowed = (tab: string): boolean => {
    if (tab === 'decontamination') return !!moduleVisibility.decontamination?.[effectiveRole];
    if (tab === 'dashboard') return !!moduleVisibility.dashboard?.[effectiveRole];
    if (tab === 'orders') return !!moduleVisibility.orders?.[effectiveRole];
    if (tab === 'fleet') return !!moduleVisibility.fleet?.[effectiveRole];
    if (tab === 'clients') return !!moduleVisibility.clients?.[effectiveRole];
    if (tab === 'equipments') return !!moduleVisibility.equipments?.[effectiveRole];
    if (tab === 'approvals' || tab === 'access' || tab === 'settings' || tab === 'audits') {
      return currentUserRole === 'moderator' || (isSuperAdmin && !activeRolePreview);
    }
    return false;
  };

  // Protection & Redirect Guard Effect
  useEffect(() => {
    if (!user) return;
    if (!isTabAllowed(activeTab)) {
      const fallbackTab = isTabAllowed('decontamination')
        ? 'decontamination'
        : (['decontamination', 'equipments', 'clients', 'orders', 'fleet', 'dashboard', 'approvals', 'access', 'settings', 'audits'] as const).find(t => isTabAllowed(t)) || 'decontamination';
      
      if (activeTab !== fallbackTab) {
        setActiveTab(fallbackTab as any);
        if (window.location.hash) {
          window.location.hash = fallbackTab;
        }
      }
    }
  }, [activeTab, effectiveRole, currentUserRole, moduleVisibility, user, activeRolePreview]);

  // URL Hash Navigation Sync with Authorization Guard
  useEffect(() => {
    if (!user) return;
    const syncHashTab = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        if (isTabAllowed(hash)) {
          if (activeTab !== hash) {
            setActiveTab(hash as any);
          }
        } else {
          // Silent block & redirect to allowed decontamination page
          const fallback = isTabAllowed('decontamination') ? 'decontamination' : 'equipments';
          setActiveTab(fallback as any);
          window.location.hash = fallback;
        }
      }
    };

    syncHashTab();
    window.addEventListener('hashchange', syncHashTab);
    return () => window.removeEventListener('hashchange', syncHashTab);
  }, [user, effectiveRole, currentUserRole, moduleVisibility, activeRolePreview]);
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    itemType: string;
    itemId: string;
    itemCollection: string;
    itemName: string;
  }>({
    isOpen: false,
    itemType: '',
    itemId: '',
    itemCollection: '',
    itemName: ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'os' | 'client' | 'access' | 'equipment'>('os');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', username: '' });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCCUModalOpen, setIsCCUModalOpen] = useState(false);
  const [isSubFamilyModalOpen, setIsSubFamilyModalOpen] = useState(false);
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const seedingRef = useRef(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [osModalTab, setOsModalTab] = useState<'view' | 'edit'>('view');
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inProgressSearchTerm, setInProgressSearchTerm] = useState('');
  const [completedSearchTerm, setCompletedSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeOrderSubTab, setActiveOrderSubTab] = useState<'in-progress' | 'completed'>('in-progress');
  const [osTypeFilter, setOsTypeFilter] = useState<'all' | 'Tanques de 1500L' | 'Tanques de 5000/5200L' | 'CCUs' | 'Outros'>('all');
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });
  const [authForm, setAuthForm] = useState({
    username: '',
    password: ''
  });

  const currentUserInfo = appUsers.find(u => u.id === user?.uid);
  const currentUserName = currentUserInfo?.name || user?.displayName || user?.email || '';

  // Form States
  const [formData, setFormData] = useState({
    equipmentNumber: '',
    family: '',
    subFamily: '',
    otherFamily: '',
    clientId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    status: 'Em Manutenção' as 'Em Manutenção' | 'Concluído',
    priority: 'Média' as 'Baixa' | 'Média' | 'Alta' | 'Urgente',
    maintenanceScope: '',
    createdBy: '',
    maintenanceTechnician: '',
    closedBy: '',
    slingCheck: { status: 'NA', value: '' } as InspectionCheck,
    damagedSlingCheck: { status: 'NA', value: '' } as InspectionCheck,
    excessiveCorrosionCheck: { status: 'NA', value: '' } as InspectionCheck,
    primaryStructureCheck: { status: 'NA', value: '' } as InspectionCheck,
    secondaryStructureCheck: { status: 'NA', value: '' } as InspectionCheck,
    damagedBagCheck: { status: 'NA', value: '' } as InspectionCheck,
    bottomCheck: { status: 'NA', value: '' } as InspectionCheck,
    roofCheck: { status: 'NA', value: '' } as InspectionCheck,
    tieDownPointCheck: { status: 'NA', value: '' } as InspectionCheck,
    doorCheck: { status: 'NA', value: '' } as InspectionCheck,
    lidCheck: { status: 'NA', value: '' } as InspectionCheck,
    leverCheck: { status: 'NA', value: '' } as InspectionCheck,
    leverSupportCheck: { status: 'NA', value: '' } as InspectionCheck,
    roundHeadRivetCheck: { status: 'NA', value: '' } as InspectionCheck,
    clawCheck: { status: 'NA', value: '' } as InspectionCheck,
    retainerCheck: { status: 'NA', value: '' } as InspectionCheck,
    rodCheck: { status: 'NA', value: '' } as InspectionCheck,
    simpleRodSupportCheck: { status: 'NA', value: '' } as InspectionCheck,
    specialRodSupportCheck: { status: 'NA', value: '' } as InspectionCheck,
    rodLockCheck: { status: 'NA', value: '' } as InspectionCheck,
    hingeCheck: { status: 'NA', value: '' } as InspectionCheck,
    reworkCheck: { status: 'NA', value: '' } as InspectionCheck,
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const [clientForm, setClientForm] = useState({
    cnpj: '',
    razaoSocial: ''
  });

  const [equipmentForm, setEquipmentForm] = useState({
    tag: '',
    family: '',
    subFamily: '',
    otherFamily: ''
  });

  const [accessForm, setAccessForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'user' as 'moderator' | 'admin' | 'user'
  });

  useEffect(() => {
    if (globalError) {
      const timer = setTimeout(() => setGlobalError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [globalError]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const addAuditLog = async (action: 'CREATE' | 'UPDATE' | 'DELETE', entity: 'OS' | 'CLIENT' | 'USER' | 'SETTINGS' | 'EQUIPMENT' | 'FLEET', entityId: string, details: string) => {
    try {
      const currentUserData = appUsers.find(u => u.id === user?.uid);
      await addDoc(collection(db, 'auditLogs'), {
        userId: user?.uid,
        userName: currentUserData?.name || user?.displayName || 'Sistema',
        userEmail: user?.email || 'N/A',
        action,
        entity,
        entityId,
        details,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding audit log:', error);
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  // Data Listeners (Orders & Clients)
  useEffect(() => {
    if (!user || !isAuthReady) return;

    console.log("Setting up real-time listeners for Orders and Clients...");

    // Orders Listener
    const qOrders = collection(db, 'serviceOrders');
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      console.log(`Received ${snapshot.docs.length} orders from Firestore`);
      const ordersData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Robust status normalization
        let status = data.status || 'Em Manutenção';
        const normalized = status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (normalized === 'concluido') {
          status = 'Concluído';
        } else if (normalized.includes('manutencao') || normalized.includes('andamento')) {
          status = 'Em Manutenção';
        } else {
          status = 'Em Manutenção';
        }
        
        return { id: doc.id, ...data, status } as ServiceOrder;
      });
      setOrders(ordersData);
    }, (error) => {
      console.error("Orders listener error:", error);
      handleFirestoreError(error, OperationType.GET, 'serviceOrders');
    });

    // Clients Listener
    const qClients = collection(db, 'clients');
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      console.log(`Received ${snapshot.docs.length} clients from Firestore`);
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[]);
    }, (error) => {
      console.error("Clients listener error:", error);
      handleFirestoreError(error, OperationType.GET, 'clients');
    });

    // Audit Logs Listener (Moderators only)
    let unsubAudits = () => {};
    if (currentUserRole === 'moderator' || user.email === "almeidacesar2010@gmail.com") {
      const qAudits = query(collection(db, 'auditLogs'));
      unsubAudits = onSnapshot(qAudits, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AuditLog[];
        // Sort by timestamp descending
        setAuditLogs(logs.sort((a, b) => {
          const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return tB - tA;
        }));
      }, (error) => {
        console.error("Audit logs listener error:", error);
        handleFirestoreError(error, OperationType.GET, 'auditLogs');
      });
    }

    const unsubEquipments = onSnapshot(collection(db, 'equipments'), (snapshot) => {
      setEquipments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Equipment[]);
    }, (error) => {
      console.error("Equipments listener error:", error);
      handleFirestoreError(error, OperationType.GET, 'equipments');
    });

    const unsubFleetEquipment = onSnapshot(collection(db, 'fleetEquipment'), (snapshot) => {
      setFleetEquipment(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FleetEquipment[]);
    }, (error) => {
      console.error("Fleet equipment listener error:", error);
      handleFirestoreError(error, OperationType.GET, 'fleetEquipment');
    });

    const unsubFleetHistory = onSnapshot(collection(db, 'fleetHistory'), (snapshot) => {
      setFleetHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FleetHistoryEntry[]);
    }, (error) => {
      console.error("Fleet history listener error:", error);
      handleFirestoreError(error, OperationType.GET, 'fleetHistory');
    });

    const unsubDecontamination = onSnapshot(collection(db, 'decontaminationOperations'), (snapshot) => {
      setDecontaminationOperations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DecontaminationOperation[]);
    }, (error) => {
      console.error("Decontamination operations listener error:", error);
      handleFirestoreError(error, OperationType.GET, 'decontaminationOperations');
    });

    const unsubVisibility = onSnapshot(doc(db, 'settings', 'moduleVisibility'), (snapshot) => {
      if (snapshot.exists()) {
        setModuleVisibility(snapshot.data() as ModuleVisibilityConfig);
      }
    });

    const unsubDelReqs = onSnapshot(collection(db, 'deletionRequests'), (snapshot) => {
      const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as DeletionRequest[];
      setDeletionRequests(reqs.sort((a, b) => {
        const tA = a.requestedAt?.toMillis ? a.requestedAt.toMillis() : 0;
        const tB = b.requestedAt?.toMillis ? b.requestedAt.toMillis() : 0;
        return tB - tA;
      }));
    });

    return () => {
      unsubOrders();
      unsubClients();
      unsubAudits();
      unsubEquipments();
      unsubFleetEquipment();
      unsubFleetHistory();
      unsubDecontamination();
      unsubVisibility();
      unsubDelReqs();
    };
  }, [user, isAuthReady, currentUserRole]);

  // Fix orders with missing clients
  useEffect(() => {
    if (!user || !isAuthReady || orders.length === 0 || clients.length === 0) return;

    const ordersWithMissingClients = orders.filter(order => !clients.some(c => c.id === order.clientId));
    
    if (ordersWithMissingClients.length > 0) {
      console.log(`Found ${ordersWithMissingClients.length} orders with missing clients. Fixing...`);
      const batch = writeBatch(db);
      ordersWithMissingClients.forEach(order => {
        const randomClient = clients[Math.floor(Math.random() * clients.length)];
        batch.update(doc(db, 'serviceOrders', order.id), {
          clientId: randomClient.id,
          updatedAt: serverTimestamp()
        });
      });
      batch.commit().catch(err => console.error("Error fixing missing clients:", err));
    }
  }, [orders, clients, user, isAuthReady]);

  // User Role & Admin Listeners
  useEffect(() => {
    if (!user || !isAuthReady) return;

    console.log("Setting up role listener for user:", user.uid);

    // User Role Listener
    const userRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Inactive account check
        if (data.status === 'inactive') {
          console.warn("User account is inactive. Signing out...");
          signOut(auth);
          setGlobalError("Sua conta está desativada. Entre em contato com o moderador.");
          return;
        }

        // Mandatory password change check (First login or reset)
        if (data.mustChangePassword === true) {
          setMustChangePasswordUser({
            userId: user.uid,
            userName: data.name || user.displayName || 'Usuário',
            userEmail: data.email || user.email || ''
          });
        } else {
          setMustChangePasswordUser(null);
        }

        const role = data.role || 'user';
        console.log("Current user role updated:", role);
        setCurrentUserRole(role);
        setProfileForm({
          name: data.name || '',
          username: data.username || user.email?.split('@')[0] || ''
        });
      } else {
        // If document doesn't exist under user.uid, try to heal by looking up by email
        let healed = false;
        if (user.email) {
          try {
            const q = query(collection(db, 'users'), where('email', '==', user.email.toLowerCase()));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const matchedDoc = snap.docs[0];
              const matchedData = matchedDoc.data();
              await setDoc(userRef, {
                ...matchedData,
                id: user.uid,
                updatedAt: serverTimestamp()
              });
              if (matchedDoc.id !== user.uid) {
                await deleteDoc(doc(db, 'users', matchedDoc.id));
              }
              healed = true;
            }
          } catch (healErr) {
            console.error('Auto-heal error:', healErr);
          }
        }

        if (!healed) {
          if (user.email !== "almeidacesar2010@gmail.com") {
            console.warn("User document not found. Signing out...");
            signOut(auth);
            setGlobalError("Sua conta não existe mais no sistema.");
          } else {
            // Bootstrap first user as admin if it's the owner email
            console.log("Bootstrapping owner as admin...");
            setCurrentUserRole('admin');
            setDoc(userRef, {
              email: user.email,
              name: user.displayName || 'Admin',
              role: 'admin',
              createdAt: serverTimestamp()
            }).catch(err => console.error("Error bootstrapping admin:", err));
          }
        }
      }
    });

    // Admin-only Users Listener
    let unsubUsers = () => {};
    const isModerator = currentUserRole === 'moderator' || user.email === "almeidacesar2010@gmail.com";
    if (isModerator) {
      console.log("Setting up admin-only users listener...");
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        console.log(`Received ${snapshot.docs.length} users from Firestore`);
        setAppUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AppUser[]);
      }, (error) => {
        console.error("Users listener error:", error);
      });
    }

    return () => {
      unsubUser();
      unsubUsers();
    };
  }, [user, isAuthReady, currentUserRole]);

  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = onSnapshot(doc(db, 'settings', 'appConfig'), (doc) => {
      if (doc.exists()) {
        setLogoUrl(doc.data().logoUrl || null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const rawUsername = authForm.username.trim();
    const rawPassword = authForm.password;

    if (!rawUsername || !rawPassword) {
      setLoginError('Por favor, informe o usuário e a senha.');
      return;
    }

    setIsSubmitting(true);
    setGlobalError(null);
    setLoginError(null);

    try {
      // 1. Search user in Firestore first
      const found = await findUserByUsernameOrEmail(rawUsername);

      if (!found) {
        // Audit log failed login
        try {
          await addDoc(collection(db, 'auditLogs'), {
            userName: rawUsername,
            action: 'LOGIN_FAILED',
            entity: 'AUTH',
            details: `Tentativa de login para o usuário "${rawUsername}" falhou (usuário não encontrado).`,
            timestamp: serverTimestamp()
          });
        } catch (e) {}

        setLoginError('Usuário ou senha incorretos.');
        setIsSubmitting(false);
        return;
      }

      const { docId, data: userDocData } = found;

      // 2. Check if user is inactive
      if (userDocData.status === 'inactive') {
        setLoginError('Este usuário está desativado. Entre em contato com o administrador do sistema.');
        setIsSubmitting(false);
        return;
      }

      // 3. Verify password hash against Firestore
      if (userDocData.passwordHash) {
        const inputHash = await hashPassword(rawPassword);
        if (inputHash !== userDocData.passwordHash) {
          // Audit log failed login
          try {
            await addDoc(collection(db, 'auditLogs'), {
              userId: docId,
              userName: userDocData.name || rawUsername,
              action: 'LOGIN_FAILED',
              entity: 'AUTH',
              details: `Tentativa de login para o usuário "${rawUsername}" falhou (senha incorreta).`,
              timestamp: serverTimestamp()
            });
          } catch (e) {}

          setLoginError('Usuário ou senha incorretos.');
          setIsSubmitting(false);
          return;
        }
      }

      // 4. Authenticate with Firebase Auth using internal technical email
      const cleanUsername = (userDocData.username || rawUsername).trim().toLowerCase().replace(/^@/, '');
      const authEmail = (userDocData.email && userDocData.email.includes('@') && !userDocData.email.includes(' '))
        ? userDocData.email
        : getUsernameInternalEmail(cleanUsername);

      const authPass = userDocData.passwordHash || rawPassword;

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, authEmail, authPass);
      } catch (signInErr: any) {
        // Try with plain rawPassword if passwordHash failed
        try {
          userCredential = await signInWithEmailAndPassword(auth, authEmail, rawPassword);
        } catch (signInErr2: any) {
          // If user doesn't exist in Firebase Auth yet, create the Auth user identity
          try {
            userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPass);
          } catch (createErr: any) {
            if (createErr.code === 'auth/email-already-in-use') {
              const altEmail = `${cleanUsername}_${docId.slice(0, 5)}@opscontrol.internal`;
              try {
                userCredential = await createUserWithEmailAndPassword(auth, altEmail, authPass);
              } catch (altErr) {
                console.error('Error creating user credential:', altErr);
                setLoginError('Erro ao autenticar usuário no sistema.');
                setIsSubmitting(false);
                return;
              }
            } else {
              console.error('Firebase Auth creation error:', createErr);
              setLoginError('Erro ao autenticar no sistema. Tente novamente.');
              setIsSubmitting(false);
              return;
            }
          }
        }
      }

      if (userCredential && userCredential.user) {
        const newUid = userCredential.user.uid;

        // If docId is different from Firebase Auth UID, sync Firestore doc to newUid
        if (docId !== newUid) {
          const userRef = doc(db, 'users', newUid);
          await setDoc(userRef, {
            ...userDocData,
            id: newUid,
            email: authEmail,
            updatedAt: serverTimestamp()
          });
          try {
            await deleteDoc(doc(db, 'users', docId));
          } catch (delErr) {
            console.error('Error deleting old user doc:', delErr);
          }
        }

        // Audit log login success
        try {
          await addDoc(collection(db, 'auditLogs'), {
            userId: newUid,
            userName: userDocData.name || rawUsername,
            action: 'LOGIN_SUCCESS',
            entity: 'AUTH',
            details: `Usuário "@${cleanUsername}" realizou login no sistema.`,
            timestamp: serverTimestamp()
          });
        } catch (e) {}
      }
    } catch (error: any) {
      console.error('Login process error:', error);
      setLoginError('Usuário ou senha incorretos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await addDoc(collection(db, 'auditLogs'), {
          userId: user.uid,
          userName: appUsers.find(u => u.id === user.uid)?.name || user.displayName || 'Usuário',
          action: 'LOGOUT',
          entity: 'AUTH',
          details: `Usuário encerrou a sessão.`,
          timestamp: serverTimestamp()
        });
      } catch (e) {}
    }
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    setGlobalError(null);
    try {
      const start = parseISO(formData.startDate);
      const end = formData.endDate ? parseISO(formData.endDate) : null;
      const leadTime = end ? differenceInDays(end, start) : null;

      const finalFamily = formData.family === 'Outros' ? formData.otherFamily : formData.family;

      if (!finalFamily) {
        setGlobalError('Por favor, especifique a família do equipamento.');
        setIsSubmitting(false);
        return;
      }

      const currentUserData = appUsers.find(u => u.id === user.uid);
      const currentUserName = currentUserData?.name || user.displayName || user.email || 'Sistema';

      const orderData = {
        equipmentNumber: formData.equipmentNumber,
        family: finalFamily,
        subFamily: formData.family === 'CCUs' ? formData.subFamily : null,
        clientId: formData.clientId,
        startDate: Timestamp.fromDate(start),
        endDate: end ? Timestamp.fromDate(end) : null,
        status: formData.status,
        priority: formData.priority,
        maintenanceScope: formData.maintenanceScope,
        leadTime,
        userId: user.uid,
        updatedAt: serverTimestamp(),
        createdBy: editingOrder ? (editingOrder.createdBy || formData.createdBy || currentUserName) : (formData.createdBy || currentUserName),
        maintenanceTechnician: formData.maintenanceTechnician || '',
        closedBy: formData.closedBy || '',
        slingCheck: formData.slingCheck,
        damagedSlingCheck: formData.damagedSlingCheck,
        excessiveCorrosionCheck: formData.excessiveCorrosionCheck,
        primaryStructureCheck: formData.primaryStructureCheck,
        secondaryStructureCheck: formData.secondaryStructureCheck,
        damagedBagCheck: formData.damagedBagCheck,
        bottomCheck: formData.bottomCheck,
        roofCheck: formData.roofCheck,
        tieDownPointCheck: formData.tieDownPointCheck,
        doorCheck: formData.doorCheck,
        lidCheck: formData.lidCheck,
        leverCheck: formData.leverCheck,
        leverSupportCheck: formData.leverSupportCheck,
        roundHeadRivetCheck: formData.roundHeadRivetCheck,
        clawCheck: formData.clawCheck,
        retainerCheck: formData.retainerCheck,
        rodCheck: formData.rodCheck,
        simpleRodSupportCheck: formData.simpleRodSupportCheck,
        specialRodSupportCheck: formData.specialRodSupportCheck,
        rodLockCheck: formData.rodLockCheck,
        hingeCheck: formData.hingeCheck,
        reworkCheck: formData.reworkCheck,
      };

      console.log('Attempting to save order with data:', orderData);

      if (editingOrder) {
        console.log('Updating existing order:', editingOrder.id);
        await updateDoc(doc(db, 'serviceOrders', editingOrder.id), orderData);
        await addAuditLog('UPDATE', 'OS', editingOrder.id, `Atualizou OS #${orderData.equipmentNumber}`);
        setSuccessMessage('Ordem de serviço atualizada com sucesso!');
      } else {
        console.log('Creating new order');
        const docRef = await addDoc(collection(db, 'serviceOrders'), {
          ...orderData,
          createdAt: serverTimestamp()
        });
        await addAuditLog('CREATE', 'OS', docRef.id, `Criou OS #${orderData.equipmentNumber}`);
        setSuccessMessage('Ordem de serviço cadastrada com sucesso!');
      }

      // Automatically validate fleet equipment if OS is completed or opened with valid data
      if (formData.equipmentNumber) {
        const matchedFleetItem = fleetEquipment.find(fe => (fe.equipmentNumber || '').trim().toUpperCase() === formData.equipmentNumber.trim().toUpperCase());
        if (matchedFleetItem && (matchedFleetItem.isPendingValidation !== false || matchedFleetItem.validationStatus === 'pending')) {
          if (formData.status === 'Concluído') {
            try {
              const clientObj = clients.find(c => c.id === formData.clientId);
              await updateDoc(doc(db, 'fleetEquipment', matchedFleetItem.id), {
                isPendingValidation: false,
                validationStatus: 'validated',
                validatedAt: serverTimestamp(),
                validatedBy: currentUserName,
                clientId: clientObj ? clientObj.razaoSocial : (matchedFleetItem.clientId || 'BASE'),
                updatedAt: serverTimestamp()
              });
              await addAuditLog('UPDATE', 'FLEET', matchedFleetItem.id, `Validação de cadastro da frota efetuada via conclusão da OS #${formData.equipmentNumber}`);
            } catch (err) {
              console.error('Error auto-validating fleet equipment:', err);
            }
          }
        }
      }

      setIsModalOpen(false);
      setEditingOrder(null);
      setFormData({
        equipmentNumber: '',
        family: '',
        subFamily: '',
        otherFamily: '',
        clientId: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
        status: 'Em Manutenção',
        priority: 'Média' as const,
        maintenanceScope: '',
        createdBy: '',
        maintenanceTechnician: '',
        closedBy: '',
        slingCheck: { status: 'NA', value: '' },
        damagedSlingCheck: { status: 'NA', value: '' },
        excessiveCorrosionCheck: { status: 'NA', value: '' },
        primaryStructureCheck: { status: 'NA', value: '' },
        secondaryStructureCheck: { status: 'NA', value: '' },
        damagedBagCheck: { status: 'NA', value: '' },
        bottomCheck: { status: 'NA', value: '' },
        roofCheck: { status: 'NA', value: '' },
        tieDownPointCheck: { status: 'NA', value: '' },
        doorCheck: { status: 'NA', value: '' },
        lidCheck: { status: 'NA', value: '' },
        leverCheck: { status: 'NA', value: '' },
        leverSupportCheck: { status: 'NA', value: '' },
        roundHeadRivetCheck: { status: 'NA', value: '' },
        clawCheck: { status: 'NA', value: '' },
        retainerCheck: { status: 'NA', value: '' },
        rodCheck: { status: 'NA', value: '' },
        simpleRodSupportCheck: { status: 'NA', value: '' },
        specialRodSupportCheck: { status: 'NA', value: '' },
        rodLockCheck: { status: 'NA', value: '' },
        hingeCheck: { status: 'NA', value: '' },
        reworkCheck: { status: 'NA', value: '' },
      });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving order:', error);
      const exactError = error?.message || 'Verifique os dados e tente novamente.';
      setGlobalError(`Erro ao salvar ordem de serviço: ${exactError}`);
      try {
        handleFirestoreError(error, OperationType.WRITE, 'serviceOrders');
      } catch (e) {
        // Expected throw
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const seedDemoOrders = async () => {
    console.log("seedDemoOrders triggered. User:", user?.uid, "Clients:", clients.length);
    if (!user || isSubmitting) return;
    
    setIsSubmitting(true);
    setGlobalError('Limpando e gerando 50 novos dados de demonstração (Jan-Mar 2026)...');
    try {
      // 1. Clear existing demo orders first
      const demoOrders = orders.filter(o => (o as any).isDemo);
      if (demoOrders.length > 0) {
        const clearBatch = writeBatch(db);
        demoOrders.forEach(o => {
          clearBatch.delete(doc(db, 'serviceOrders', o.id));
        });
        await clearBatch.commit();
        console.log("Existing demo orders cleared");
      }

      const batch = writeBatch(db);
      const currentClients = [...clients];

      // If no clients exist, inform the user they need to add clients first
      if (currentClients.length === 0) {
        setGlobalError("Por favor, cadastre pelo menos um cliente antes de gerar demos.");
        setIsSubmitting(false);
        return;
      }

      const clientList = currentClients;

      // Generate exactly 50 orders total distributed across Jan, Feb, and March 2026
      for (let i = 0; i < 50; i++) {
        const month = Math.floor(Math.random() * 3); // 0: Jan, 1: Feb, 2: Mar
        const equipment = DEMO_EQUIPMENTS[Math.floor(Math.random() * DEMO_EQUIPMENTS.length)];
        const randomClient = currentClients[Math.floor(Math.random() * currentClients.length)];
        const startDay = Math.floor(Math.random() * 25) + 1;
        const duration = Math.floor(Math.random() * 12) + 2; // 2 to 14 days
        
        const startDate = new Date(2026, month, startDay);
        
        // For Jan and Feb, most should be completed. For March, some still in progress.
        let isCompleted = true;
        if (month === 2) { // March
          isCompleted = Math.random() > 0.4; // 60% completed
        } else {
          isCompleted = Math.random() > 0.1; // 90% completed for older months
        }

        const endDate = isCompleted ? new Date(2026, month, startDay + duration) : null;
        const leadTime = endDate ? differenceInDays(endDate, startDate) : null;

        let family = 'CCUs';
        let subFamily = null;
        if (equipment.startsWith('OEGU') || equipment.startsWith('STC-5000')) {
          family = 'Tanques de 5000/5200L';
        } else if (equipment.startsWith('35') || equipment.startsWith('36')) {
          family = 'Tanques de 1500L';
        } else {
          // It's a CCU, assign a random subFamily
          subFamily = CCU_SUBFAMILIES[Math.floor(Math.random() * CCU_SUBFAMILIES.length)];
        }

        const newDocRef = doc(collection(db, 'serviceOrders'));
        batch.set(newDocRef, {
          equipmentNumber: equipment,
          family,
          subFamily,
          clientId: randomClient.id,
          startDate: Timestamp.fromDate(startDate),
          endDate: endDate ? Timestamp.fromDate(endDate) : null,
          status: isCompleted ? 'Concluído' : 'Em Manutenção',
          leadTime: leadTime ?? null,
          userId: user.uid,
          isDemo: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      console.log("50 Demo orders seeded successfully for Jan-Mar 2026");
      setSuccessMessage('50 novas demonstrações geradas com sucesso para Jan, Fev e Mar 2026!');
      setTimeout(() => setSuccessMessage(null), 4000);
      setSelectedMonth(new Date(2026, 2, 1)); // Switch to March view
    } catch (error) {
      console.error('Error seeding demo orders:', error);
      setGlobalError('Erro ao gerar dados de demonstração. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearDemoOrders = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const demoOrders = orders.filter(o => (o as any).isDemo);
      if (demoOrders.length === 0) {
        setGlobalError('Nenhuma ordem de demonstração encontrada.');
        return;
      }
      const batch = writeBatch(db);
      demoOrders.forEach(o => {
        batch.delete(doc(db, 'serviceOrders', o.id));
      });
      await batch.commit();
      setSuccessMessage('Ordens de demonstração removidas com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error clearing demo orders:', error);
      handleFirestoreError(error, OperationType.DELETE, 'serviceOrders');
    } finally {
      setIsSubmitting(false);
    }
  };

  const seedRealEquipments = async () => {
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    setSuccessMessage('Iniciando importação em massa... Aguarde.');
    
    try {
      const batchList: any[] = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      const addEquip = (tag: string, family: string) => {
        // Skip if already in local state to avoid duplicates (though we'll use a better check)
        if (equipments.some(e => e.tag === tag)) return;
        
        const docRef = doc(collection(db, 'equipments'));
        currentBatch.set(docRef, {
          tag,
          family,
          subFamily: null,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        count++;
        
        if (count === 450) {
          batchList.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          count = 0;
        }
      };

      // Helper for ranges
      const addRange = (prefix: string, start: number, end: number, family: string, padding: number = 0) => {
        for (let i = start; i <= end; i++) {
          const tag = prefix + i.toString().padStart(padding, '0');
          addEquip(tag, family);
        }
      };

      // --- Tanques 1500L ---
      const tanks1500 = [
        ...Array.from({length: 17}, (_, i) => (351301 + i).toString()),
        ...Array.from({length: 10}, (_, i) => (351319 + i).toString()),
        ...Array.from({length: 28}, (_, i) => (351959 + i).toString()),
        ...Array.from({length: 17}, (_, i) => (353995 + i).toString()),
        ...Array.from({length: 7}, (_, i) => (354013 + i).toString()),
        ...Array.from({length: 7}, (_, i) => (354021 + i).toString()),
        ...Array.from({length: 7}, (_, i) => (354029 + i).toString()),
        ...Array.from({length: 11}, (_, i) => (354037 + i).toString()),
        ...Array.from({length: 2}, (_, i) => (354049 + i).toString()),
        ...Array.from({length: 31}, (_, i) => (365881 + i).toString()),
        'CS-12-1501-B', 'CS-12-1502-B', 'CS-12-1504-B', 'CS-12-1505-B', 'CS-12-1507-B', 'CS-12-1508-B'
      ];
      tanks1500.forEach(t => addEquip(t, 'Tanques de 1500L'));

      // --- Tanques 5000/5200L ---
      const specific5000 = ['CS-12-5008-B', 'CS-12-5010-B', 'CS-12-5012-B', 'CS-12-5013-B', 'CS-12-5014-B', 'CS-12-5015-B'];
      specific5000.forEach(t => addEquip(t, 'Tanques de 5000/5200L'));
      
      addRange('HMHU', 120165, 120174, 'Tanques de 5000/5200L');
      addRange('HMHU', 920251, 920265, 'Tanques de 5000/5200L');
      addRange('HMHU', 920360, 920379, 'Tanques de 5000/5200L');
      addRange('HMHU', 920385, 920399, 'Tanques de 5000/5200L');
      addRange('HMHU', 920445, 920459, 'Tanques de 5000/5200L');
      addRange('HMHU', 920464, 920478, 'Tanques de 5000/5200L');
      addRange('HMHU', 920489, 920683, 'Tanques de 5000/5200L');
      addRange('STC-5000-', 1, 5, 'Tanques de 5000/5200L', 3);
      addRange('OEGU', 920684, 920918, 'Tanques de 5000/5200L');
      
      const mixedOEGU = [
        920927, 920929, 920930, 920931, 920932, 920933, 920934, 920935, 920936, 920937, 920938, 920939, 920940, 920941, 920942, 920943, 920944, 920945, 920946,
        920919, 920920, 920921, 920922, 920923, 920924, 920925, 920926, 920928, 920948, 920949, 920950, 920953, 920954, 920955, 920956, 920957, 920958, 920959, 920960,
        920962, 920963, 920964, 920966, 920967, 920951, 920952, 920961, 920965, 920968, 920947
      ];
      mixedOEGU.forEach(n => addEquip('OEGU' + n, 'Tanques de 5000/5200L'));
      
      addRange('OEGU', 921033, 921182, 'Tanques de 5000/5200L');

      if (count > 0) {
        batchList.push(currentBatch.commit());
      }

      await Promise.all(batchList);
      await addAuditLog('CREATE', 'SETTINGS', 'bulk_equip', `Realizou importação em massa de ${tanks1500.length + specific5000.length + (920683-920489+1) + (921182-921033+1) + 120} equipamentos`);
      
      setSuccessMessage('Importação concluída com sucesso!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error('Error seeding real equipments:', error);
      setGlobalError('Erro na importação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEquipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const familyToSave = equipmentForm.family === 'Outros' ? equipmentForm.otherFamily : equipmentForm.family;
      const docRef = await addDoc(collection(db, 'equipments'), {
        tag: equipmentForm.tag,
        family: familyToSave,
        subFamily: equipmentForm.subFamily || null,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      await addAuditLog('CREATE', 'EQUIPMENT', docRef.id, `Cadastrou equipamento: ${equipmentForm.tag}`);
      setSuccessMessage('Equipamento cadastrado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsModalOpen(false);
      setEquipmentForm({ tag: '', family: '', subFamily: '', otherFamily: '' });
    } catch (error: any) {
      console.error('Error saving equipment:', error);
      setGlobalError('Erro ao cadastrar equipamento. Verifique se você tem permissão.');
      try {
        handleFirestoreError(error, OperationType.WRITE, 'equipments');
      } catch (e) {}
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    if (!user) return;
    
    const equipment = equipments.find(e => e.id === id);
    if (!equipment) return;

    if (!isModerator) {
      handleOpenDeleteModal('Equipamento', id, 'equipments', equipment.tag);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Excluir Equipamento',
      message: `Tem certeza que deseja excluir o equipamento ${equipment.tag}? Isso não afetará as OS já criadas.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'equipments', id));
          await addAuditLog('DELETE', 'EQUIPMENT', id, `Excluiu equipamento: ${equipment.tag}`);
          setSuccessMessage('Equipamento excluído com sucesso!');
          setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
          console.error('Error deleting equipment:', error);
          setGlobalError('Erro ao excluir equipamento.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'clients'), {
        ...clientForm,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      await addAuditLog('CREATE', 'CLIENT', docRef.id, `Cadastrou cliente: ${clientForm.razaoSocial}`);
      setSuccessMessage('Cliente cadastrado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsModalOpen(false);
      setClientForm({ cnpj: '', razaoSocial: '' });
    } catch (error: any) {
      console.error('Error saving client:', error);
      setGlobalError('Erro ao cadastrar cliente. Verifique os dados e tente novamente.');
      try {
        handleFirestoreError(error, OperationType.WRITE, 'clients');
      } catch (e) {}
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleAccessSubmit called');
    if (!user) {
      console.log('No user logged in');
      return;
    }
    
    // Moderator check including owner email
    const canManageAccess = currentUserRole === 'moderator' || user.email === "almeidacesar2010@gmail.com";
    console.log('Can manage access:', canManageAccess, 'Role:', currentUserRole, 'Email:', user.email);
    if (!canManageAccess) {
      setAccessError('Você não tem permissão para realizar esta ação.');
      return;
    }

    setIsSubmitting(true);
    setAccessError(null);
    
    // Use a unique name for the secondary app to avoid initialization errors
    const appName = `Secondary-${Date.now()}`;
    console.log('Initializing secondary app:', appName);
    let secondaryApp;
    
    try {
      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const email = `${accessForm.username}@oeg.local`;
      console.log('Creating user with email:', email);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, accessForm.password);
      console.log('User created successfully in Auth');
      await updateProfile(userCredential.user, { displayName: accessForm.name });
      
      // Create user profile in Firestore
      console.log('Creating user profile in Firestore');
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username: accessForm.username,
        email: email,
        name: accessForm.name,
        role: accessForm.role,
        createdAt: serverTimestamp()
      });
      console.log('User profile created successfully');
      
      await addAuditLog('CREATE', 'USER', userCredential.user.uid, `Criou usuário: ${accessForm.name} (${accessForm.role})`);
      setSuccessMessage('Usuário cadastrado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      setAccessForm({ username: '', password: '', name: '', role: 'user' });
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Registration error details:', error);
      if (error.code === 'auth/operation-not-allowed') {
        setAccessError('ERRO: O provedor de E-mail/Senha não está ativado no Firebase Console. Por favor, ative-o em Authentication > Sign-in method.');
      } else if (error.code === 'auth/email-already-in-use') {
        setAccessError('Este nome de usuário já está em uso.');
      } else if (error.code === 'auth/weak-password') {
        setAccessError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setAccessError(`Erro ao cadastrar usuário: ${error.message || 'Erro desconhecido'}`);
      }
    } finally {
      setIsSubmitting(false);
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {
          console.error('Error deleting secondary app:', e);
        }
      }
    }
  };

  const handleEditOrder = (order: any, initialTab: 'view' | 'edit' = 'edit') => {
    const isPredefined = ['CCUs', 'Tanques de 1500L', 'Tanques de 5000/5200L'].includes(order.family);
    setEditingOrder(order);
    setFormData({
      equipmentNumber: order.equipmentNumber || '',
      family: isPredefined ? order.family : 'Outros',
      subFamily: order.subFamily || '',
      otherFamily: isPredefined ? '' : order.family,
      clientId: order.clientId || '',
      startDate: order.startDate?.toDate ? format(order.startDate.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      endDate: order.endDate?.toDate ? format(order.endDate.toDate(), 'yyyy-MM-dd') : '',
      status: order.status || 'Em Manutenção',
      priority: order.priority || 'Média',
      maintenanceScope: order.maintenanceScope || '',
      createdBy: order.createdBy || '',
      maintenanceTechnician: order.maintenanceTechnician || '',
      closedBy: order.closedBy || '',
      slingCheck: order.slingCheck || { status: 'NA', value: '' },
      damagedSlingCheck: order.damagedSlingCheck || { status: 'NA', value: '' },
      excessiveCorrosionCheck: order.excessiveCorrosionCheck || { status: 'NA', value: '' },
      primaryStructureCheck: order.primaryStructureCheck || { status: 'NA', value: '' },
      secondaryStructureCheck: order.secondaryStructureCheck || { status: 'NA', value: '' },
      damagedBagCheck: order.damagedBagCheck || { status: 'NA', value: '' },
      bottomCheck: order.bottomCheck || { status: 'NA', value: '' },
      roofCheck: order.roofCheck || { status: 'NA', value: '' },
      tieDownPointCheck: order.tieDownPointCheck || { status: 'NA', value: '' },
      doorCheck: order.doorCheck || { status: 'NA', value: '' },
      lidCheck: order.lidCheck || { status: 'NA', value: '' },
      leverCheck: order.leverCheck || { status: 'NA', value: '' },
      leverSupportCheck: order.leverSupportCheck || { status: 'NA', value: '' },
      roundHeadRivetCheck: order.roundHeadRivetCheck || { status: 'NA', value: '' },
      clawCheck: order.clawCheck || { status: 'NA', value: '' },
      retainerCheck: order.retainerCheck || { status: 'NA', value: '' },
      rodCheck: order.rodCheck || { status: 'NA', value: '' },
      simpleRodSupportCheck: order.simpleRodSupportCheck || { status: 'NA', value: '' },
      specialRodSupportCheck: order.specialRodSupportCheck || { status: 'NA', value: '' },
      rodLockCheck: order.rodLockCheck || { status: 'NA', value: '' },
      hingeCheck: order.hingeCheck || { status: 'NA', value: '' },
      reworkCheck: order.reworkCheck || { status: 'NA', value: '' },
    });
    setOsModalTab(initialTab);
    setModalType('os');
    setAccessError(null);
    setIsModalOpen(true);
  };

  const handleViewOrder = (order: any) => {
    handleEditOrder(order, 'view');
  };

  const seedClients = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    let count = 0;
    try {
      for (const name of PRE_REGISTERED_CLIENTS) {
        const exists = clients.some(c => c.razaoSocial.toUpperCase() === name.toUpperCase());
        if (!exists) {
          await addDoc(collection(db, 'clients'), {
            cnpj: '00.000.000/0000-00',
            razaoSocial: name,
            userId: user.uid,
            createdAt: serverTimestamp()
          });
          count++;
        }
      }
      setSuccessMessage(`${count} novos clientes importados com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error seeding clients:', error);
      setGlobalError('Erro ao importar clientes.');
    } finally {
      setIsSubmitting(false);
    }
  };

const generatePDF = (order: any) => {
    const doc = new jsPDF();
    const client = clients.find(c => c.id === order.clientId);
    const clientName = order.clientId === 'na' ? 'NÃO DEFINIDO / N/A' : (client?.razaoSocial || 'N/A');

    // --- MODERN PREMIUM TECHNICAL FRAME DESIGN ---
    // Outer border frame for industrial/aeronautical document feel
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.15);
    doc.rect(8, 8, 194, 281); // 210x297 minus 8mm margins

    // --- TOP MARGIN ACCENT STRIP ---
    doc.setFillColor(30, 41, 59); // Slate-800 branding color
    doc.rect(8, 8, 194, 2, 'F');

    // --- DYNAMIC LOGO & HEADER ---
    const logoX = 14;
    const logoY = 14;
    const logoW = 20;
    const logoH = 20;

    let textStartX = 14;
    if (logoUrl) {
      try {
        doc.addImage(logoUrl, 'PNG', logoX, logoY, logoW, logoH);
        textStartX = 39;
      } catch (e) {
        console.error('Error adding logo to PDF:', e);
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(13);
    doc.text('RELATÓRIO OPERACIONAL', textStartX, 19);
    
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text('MANUTENÇÃO, INSPEÇÃO & CONTROLE OPERACIONAL DE ATIVOS', textStartX, 24);
    
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('SISTEMA DE GESTÃO DE EQUIPAMENTOS INTEGRADO', textStartX, 28.5);

    // --- OS STATUS & IDENTIFICATION BADGE ---
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.15);
    doc.roundedRect(138, 13, 58, 23, 2, 2, 'FD');

    // Box label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text('IDENTIFICAÇÃO DO ATIVO', 142, 17.5);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`#${order.equipmentNumber || '---'}`, 142, 22);

    // Little separation line inside badge
    doc.setDrawColor(241, 245, 249);
    doc.line(142, 24, 191, 24);

    // Status visual
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text('STATUS DA ORDEM', 142, 28.5);

    const isDone = (order.status || '').toLowerCase().includes('concl');
    if (isDone) {
      doc.setTextColor(13, 148, 136); // elegant teal-600
      doc.setFontSize(7.5);
      doc.text('CONCLUÍDO', 142, 32.5);
    } else {
      doc.setTextColor(29, 78, 216); // elegant blue-700
      doc.setFontSize(7.5);
      doc.text('EM MANUTENÇÃO', 142, 32.5);
    }

    // Horizontal separator
    let currentY = 42;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(14, currentY, 196, currentY);
    currentY += 6;

    // --- PARSING THE VARIABLES SAFELY ---
    const isSlingNA = order.slingCheck?.status === 'NA';
    const isSlingNC = order.slingCheck?.status === 'NC';
    let slingVal = 'NÃO DESIGNADA';
    if (isSlingNA) {
      slingVal = 'N/A (SEM ESLINGA)';
    } else if (isSlingNC) {
      slingVal = `[NC] ${order.slingCheck?.value || 'NÃO CONFORME'}`;
    } else {
      slingVal = order.slingCheck?.value ? `[OK] ${order.slingCheck.value}` : 'OK';
    }
    
    const formattedStartDate = order.startDate?.toDate ? format(order.startDate.toDate(), 'dd/MM/yyyy') : '-';
    const formattedEndDate = order.endDate?.toDate ? format(order.endDate.toDate(), 'dd/MM/yyyy') : 'EM ANDAMENTO';
    
    let leadTimeText = '---';
    if (order.status === 'Concluído' && order.startDate?.toDate && order.endDate?.toDate) {
      try {
        const days = differenceInDays(order.endDate.toDate(), order.startDate.toDate());
        leadTimeText = `${days} ${days === 1 ? 'DIA' : 'DIAS'}`;
      } catch (e) {
        leadTimeText = '---';
      }
    }

    // --- I. TECHNICAL PARAMETERS METADATA ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('I. DADOS OPERACIONAIS E DETALHES DO ATIVO', 14, currentY);
    currentY += 3.5;

    const metaBody = [
      [
        'CLIENTE RESTRITO:', clientName.toUpperCase(),
        'TAG DO ATIVO:', (order.equipmentNumber || 'N/A').toUpperCase()
      ],
      [
        'FAMÍLIA / MODELO:', `${order.family} ${order.subFamily ? `• ${order.subFamily}` : ''}`.toUpperCase(),
        'Nº DA ESLINGA / CABO:', slingVal.toUpperCase()
      ],
      [
        'GRAU DE PRIORIDADE:', (order.priority || 'MÉDIA').toUpperCase(),
        'STATUS DO PRODUTO:', order.status.toUpperCase()
      ],
      [
        'REGISTRO DE INÍCIO:', formattedStartDate,
        'DATA DE FECHAMENTO:', formattedEndDate
      ],
      [
        'LEAD TIME OPERACIONAL:', leadTimeText.toUpperCase(),
        'RESPONSÁVEL ABERTURA:', (order.createdBy || 'SISTEMA').toUpperCase()
      ],
      [
        'TÉCNICO MANUTENÇÃO:', (order.maintenanceTechnician || 'NÃO INFORMADO').toUpperCase(),
        'FECHAMENTO DA OS:', (order.closedBy || (order.status === 'Concluído' ? 'NÃO INFORMADO' : 'PENDENTE')).toUpperCase()
      ]
    ];

    autoTable(doc, {
      startY: currentY,
      body: metaBody,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        lineColor: [226, 232, 240], // slate-200 (tidy subtle lines)
        lineWidth: 0.15,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 38, fontStyle: 'bold', textColor: [100, 116, 139] }, // Label (slate-500)
        1: { cellWidth: 53, fontStyle: 'bold', textColor: [15, 23, 42] },    // Value (slate-900)
        2: { cellWidth: 38, fontStyle: 'bold', textColor: [100, 116, 139] }, // Label (slate-500)
        3: { cellWidth: 53, fontStyle: 'bold', textColor: [15, 23, 42] }     // Value (slate-900)
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    // --- II. ESCOPO DO SERVIÇO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('II. ESCOPO DO SERVIÇO', 14, currentY);
    currentY += 3.5;

    autoTable(doc, {
      startY: currentY,
      head: [['ITEM DE INSPEÇÃO / ROTINA DE SEGURANÇA', 'STATUS (NA | OK | NÃO CONFORME)', 'OBSERVAÇÕES']],
      body: [
        ['ESTRUTURA PRIMÁRIA', (order.primaryStructureCheck?.status || 'NA'), (order.primaryStructureCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
        ['ESTRUTURA SECUNDÁRIA', (order.secondaryStructureCheck?.status || 'NA'), (order.secondaryStructureCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
        ['BOLSA DE EMPILHADEIRA', (order.damagedBagCheck?.status || 'NA'), (order.damagedBagCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
        ['FUNDO', (order.bottomCheck?.status || 'NA'), (order.bottomCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
        ['TETO', (order.roofCheck?.status || 'NA'), (order.roofCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
        ['PONTO DE AMARRAÇÃO', (order.tieDownPointCheck?.status || 'NA'), (order.tieDownPointCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
        ['PORTA', (order.doorCheck?.status || 'NA'), (order.doorCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
        ['TAMPA', (order.lidCheck?.status || 'NA'), (order.lidCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()]
      ],
      theme: 'grid',
      headStyles: { 
        fillColor: [30, 41, 59], // Slate-800
        textColor: [255, 255, 255], 
        fontStyle: 'bold', 
        fontSize: 7.5,
        halign: 'left',
        cellPadding: { top: 3.2, bottom: 3.2, left: 5, right: 5 }
      },
      bodyStyles: { 
        fontSize: 7, 
        textColor: [51, 65, 85], // Slate-700
        cellPadding: { top: 3.2, bottom: 3.2, left: 5, right: 5 },
        lineColor: [226, 232, 240], // Slate-200
        lineWidth: 0.15
      },
      columnStyles: { 
        0: { fontStyle: 'bold', cellWidth: 70, textColor: [15, 23, 42] }, // Checkpoint tag
        1: { halign: 'center', cellWidth: 45, fontStyle: 'bold' },
        2: { cellWidth: 67, fontStyle: 'normal', textColor: [71, 85, 105] } // notes tag
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const val = data.cell.text[0];
          if (val === 'OK') {
            data.cell.styles.textColor = [13, 148, 136]; // Real elegant teal-600
            data.cell.styles.fillColor = [240, 253, 250]; // Teal-50
          } else if (val === 'NA') {
            data.cell.styles.textColor = [148, 163, 184]; // Slate-400
            data.cell.styles.fillColor = [248, 250, 252]; // Slate-50
          } else {
            data.cell.styles.textColor = [239, 68, 68]; // Red-500
            data.cell.styles.fillColor = [254, 242, 242]; // Red-50
          }
        }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    const isCCU = order.family === 'CCUs' || (order.family || '').toUpperCase().includes('CCU');

    if (isCCU) {
      if (currentY > 160) {
        doc.addPage();
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.rect(8, 8, 194, 281);
        doc.setFillColor(30, 41, 59);
        doc.rect(8, 8, 194, 2, 'F');
        currentY = 18;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('III. TROCA DE PEÇAS', 14, currentY);
      currentY += 3.5;

      autoTable(doc, {
        startY: currentY,
        head: [['PEÇA / COMPONENTE', 'STATUS (NA | OK | NÃO CONFORME)', 'OBSERVAÇÕES / DETALHES']],
        body: [
          ['ALAVANCA', (order.leverCheck?.status || 'NA'), (order.leverCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
          ['SUPORTE PARA ALAVANCA', (order.leverSupportCheck?.status || 'NA'), (order.leverSupportCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
          ['REBITE CABEÇA REDONDA', (order.roundHeadRivetCheck?.status || 'NA'), (order.roundHeadRivetCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
          ['GARRA DO VARÃO', (order.clawCheck?.status || 'NA'), (order.clawCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
          ['RETAINER', (order.retainerCheck?.status || 'NA'), (order.retainerCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
          ['VARÃO', (order.rodCheck?.status || 'NA'), (order.rodCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
          ['ABRAÇADEIRA DO VARÃO SIMPLES', (order.simpleRodSupportCheck?.status || 'NA'), (order.simpleRodSupportCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
          ['ABRAÇADEIRA DO VARÃO ESPECIAL', (order.specialRodSupportCheck?.status || 'NA'), (order.specialRodSupportCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
          ['TRAVA DO VARÃO', (order.rodLockCheck?.status || 'NA'), (order.rodLockCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()],
          ['DOBRADIÇA', (order.hingeCheck?.status || 'NA'), (order.hingeCheck?.value || 'SEM OBSERVAÇÕES').toUpperCase()]
        ],
        theme: 'grid',
        headStyles: { 
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 7.5,
          halign: 'left',
          cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 }
        },
        bodyStyles: { 
          fontSize: 7, 
          textColor: [51, 65, 85],
          cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
          lineColor: [226, 232, 240],
          lineWidth: 0.15
        },
        columnStyles: { 
          0: { fontStyle: 'bold', cellWidth: 70, textColor: [15, 23, 42] },
          1: { halign: 'center', cellWidth: 45, fontStyle: 'bold' },
          2: { cellWidth: 67, fontStyle: 'normal', textColor: [71, 85, 105] }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const val = data.cell.text[0];
            if (val === 'OK') {
              data.cell.styles.textColor = [13, 148, 136];
              data.cell.styles.fillColor = [240, 253, 250];
            } else if (val === 'NA') {
              data.cell.styles.textColor = [148, 163, 184];
              data.cell.styles.fillColor = [248, 250, 252];
            } else {
              data.cell.styles.textColor = [239, 68, 68];
              data.cell.styles.fillColor = [254, 242, 242];
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;
    }

    // --- INDICADOR DE RETRABALHO (CONTROLE DE GARGALOS) ---
    if (currentY > 230) {
      doc.addPage();
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.rect(8, 8, 194, 281);
      doc.setFillColor(30, 41, 59);
      doc.rect(8, 8, 194, 2, 'F');
      currentY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(isCCU ? 'IV. INDICADOR DE RETRABALHO (CONTROLE DE GARGALOS)' : 'III. INDICADOR DE RETRABALHO (CONTROLE DE GARGALOS)', 14, currentY);
    currentY += 3.5;

    autoTable(doc, {
      startY: currentY,
      head: [['MÉTRICA OPERACIONAL', 'EXIGE AJUSTE / EXECUTADO?', 'OBSERVAÇÕES / DIRETRIZES DE REPARO']],
      body: [
        ['RETRABALHO DE SOLDAGEM / PINTURA', (order.reworkCheck?.status === 'OK' ? 'SIM' : 'NÃO'), (order.reworkCheck?.value || 'SEM OCORRÊNCIAS DE RETRABALHO DE SOLDA OU PINTURA REGISTRADAS').toUpperCase()]
      ],
      theme: 'grid',
      headStyles: { 
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255], 
        fontStyle: 'bold', 
        fontSize: 7.5,
        halign: 'left',
        cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 }
      },
      bodyStyles: { 
        fontSize: 7, 
        textColor: [51, 65, 85],
        cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
        lineColor: [226, 232, 240],
        lineWidth: 0.15
      },
      columnStyles: { 
        0: { fontStyle: 'bold', cellWidth: 70, textColor: [15, 23, 42] },
        1: { halign: 'center', cellWidth: 45, fontStyle: 'bold' },
        2: { cellWidth: 67, fontStyle: 'normal', textColor: [71, 85, 105] }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const val = data.cell.text[0];
          if (val === 'SIM') {
            data.cell.styles.textColor = [194, 65, 12];
            data.cell.styles.fillColor = [255, 247, 237];
          } else {
            data.cell.styles.textColor = [13, 148, 136];
            data.cell.styles.fillColor = [240, 253, 250];
          }
        }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    // --- SIGNATURE FOOTER ---
    let signatureY = 242;
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
      signatureY = 60;
      
      // Draw outer page boundary frame
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.rect(8, 8, 194, 281);

      // Top margin accent bar for page
      doc.setFillColor(30, 41, 59);
      doc.rect(8, 8, 194, 2, 'F');
    } else {
      signatureY = Math.max(240, currentY + 12);
    }

    doc.setDrawColor(203, 213, 225); // slate-300 lines
    doc.setLineWidth(0.3);
    doc.line(14, signatureY, 90, signatureY);
    doc.line(120, signatureY, 196, signatureY);
    
    const techName = order.maintenanceTechnician ? order.maintenanceTechnician.toUpperCase() : '_______________________';
    const closedName = order.closedBy ? order.closedBy.toUpperCase() : (order.status === 'Concluído' ? '_______________________' : 'PENDENTE DE FECHAMENTO');

    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTOR DA MANUTENÇÃO (TÉCNICO)', 52, signatureY + 4, { align: 'center' });
    doc.text(order.maintenanceTechnician ? `TÉCNICO: ${techName}` : techName, 52, signatureY + 8, { align: 'center' });
    doc.text('RESPONSÁVEL PELO FECHAMENTO DA OS', 158, signatureY + 4, { align: 'center' });
    doc.text(order.closedBy ? `FECHADO POR: ${closedName}` : closedName, 158, signatureY + 8, { align: 'center' });

    // --- MULTI-PAGE SECURE LOG FOOTERS ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.setFont('helvetica', 'normal');
      const now = format(new Date(), 'dd/MM/yyyy HH:mm');
      doc.text(`DOC REF: OS-${order.equipmentNumber || 'SYS'} • EMITIDO EM ${now}`, 14, 286);
      doc.text(`CONFORMIDADE CRIPTOGRÁFICA INTERNA DE EMISSÃO`, 105, 286, { align: 'center' });
      doc.text(`PÁGINA ${i} DE ${pageCount}`, 196, 286, { align: 'right' });
    }
    
    doc.save(`OS-${order.equipmentNumber}.pdf`);
  };

  const handleUpdateStatus = async (id: string, currentStatus: string) => {
    if (updatingStatusId) return;
    
    setUpdatingStatusId(id);
    setGlobalError(null);
    // Normalize currentStatus to handle variations in casing or accents
    const isCurrentlyCompleted = (currentStatus || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 'concluido';
    const newStatus = isCurrentlyCompleted ? 'Em Manutenção' : 'Concluído';
    const endDate = newStatus === 'Concluído' ? Timestamp.now() : null;
    
    try {
      const orderRef = doc(db, 'serviceOrders', id);
      const orderDoc = orders.find(o => o.id === id);
      
      if (orderDoc) {
        const start = orderDoc.startDate?.toDate ? orderDoc.startDate.toDate() : new Date();
        const end = endDate ? (endDate as Timestamp).toDate() : null;
        const leadTime = end ? differenceInDays(end, start) : null;

        const currentUserData = appUsers.find(u => u.id === user?.uid);
        const currentUserName = currentUserData?.name || user?.displayName || user?.email || 'Sistema';
        const closedByVal = newStatus === 'Concluído' ? (orderDoc.closedBy || currentUserName) : (orderDoc.closedBy || '');

        await updateDoc(orderRef, {
          status: newStatus,
          endDate,
          leadTime: leadTime ?? null,
          closedBy: closedByVal,
          updatedAt: serverTimestamp()
        });

        await addAuditLog('UPDATE', 'OS', id, `Alterou status da OS #${orderDoc.equipmentNumber} para ${newStatus}`);

        // Reset to first page so the user can see the moved item
        setCurrentPage(1);
        
        // If we re-opened an order, make sure we are looking at the "In Progress" tab
        if (newStatus === 'Em Manutenção') {
          setActiveOrderSubTab('in-progress');
        }
        
        // Show a brief success message
        const action = newStatus === 'Concluído' ? 'concluída' : 'reaberta';
        setSuccessMessage(`Ordem de serviço ${action} com sucesso!`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setGlobalError('Erro ao atualizar status da ordem de serviço.');
      try {
        handleFirestoreError(error, OperationType.UPDATE, `serviceOrders/${id}`);
      } catch (e) {}
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    const orderToDelete = orders.find(o => o.id === id);
    const label = orderToDelete ? `OS #${orderToDelete.equipmentNumber || orderToDelete.id}` : 'Ordem de Serviço';

    if (!isModerator) {
      handleOpenDeleteModal('Ordem de Serviço', id, 'serviceOrders', label);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Excluir Ordem de Serviço',
      message: 'Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'serviceOrders', id));
          if (orderToDelete) {
            await addAuditLog('DELETE', 'OS', id, `Excluiu OS #${orderToDelete.equipmentNumber}`);
          }
          setSuccessMessage('Ordem de serviço excluída com sucesso!');
          setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
          console.error('Error deleting order:', error);
          setGlobalError('Erro ao excluir ordem de serviço.');
          try {
            handleFirestoreError(error, OperationType.DELETE, `serviceOrders/${id}`);
          } catch (e) {}
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Gestão da Frota - Handlers
  const handleSaveFleetEquipment = async (data: Partial<FleetEquipment>) => {
    if (!user) return;
    const tag = (data.equipmentNumber || '').trim().toUpperCase();
    const type = (data.type || 'CCU').trim().toUpperCase();

    let existingDoc = data.id ? fleetEquipment.find(e => e.id === data.id) : undefined;
    if (!existingDoc) {
      existingDoc = fleetEquipment.find(e => 
        (e.equipmentNumber || '').trim().toUpperCase() === tag && 
        (e.type || 'CCU').trim().toUpperCase() === type
      );
    }

    try {
      if (existingDoc) {
        const eqRef = doc(db, 'fleetEquipment', existingDoc.id);
        const updatePayload: any = {
          ...data,
          equipmentNumber: tag,
          type: data.type || existingDoc.type || 'CCU',
          updatedAt: serverTimestamp()
        };
        await updateDoc(eqRef, updatePayload);

        const batch = writeBatch(db);
        const fieldsToTrack: (keyof FleetEquipment)[] = [
          'equipmentNumber', 'type', 'clientId', 'location', 'status', 
          'visualInspectionDate', 'nextVisualInspectionDate', 'endInspectionDate', 'nextEndInspectionDate', 'observations'
        ];

        fieldsToTrack.forEach((field) => {
          const oldVal = String(existingDoc[field] || '');
          const newVal = String(data[field] || '');
          if (oldVal !== newVal) {
            const historyRef = doc(collection(db, 'fleetHistory'));
            batch.set(historyRef, {
              equipmentId: existingDoc.id,
              equipmentNumber: tag,
              userName: currentUserName,
              userEmail: user.email || '',
              timestamp: serverTimestamp(),
              field: field,
              oldValue: oldVal,
              newValue: newVal
            });
          }
        });
        await batch.commit();
        setSuccessMessage(`Equipamento ${tag} atualizado com sucesso!`);
      } else {
        const newDocRef = doc(collection(db, 'fleetEquipment'));
        const newEqPayload = {
          ...data,
          equipmentNumber: tag,
          userId: user.uid,
          nonConformities: data.nonConformities || [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await setDoc(newDocRef, newEqPayload);

        await addDoc(collection(db, 'fleetHistory'), {
          equipmentId: newDocRef.id,
          equipmentNumber: tag,
          userName: currentUserName,
          userEmail: user.email || '',
          timestamp: serverTimestamp(),
          field: 'CADASTRADO',
          oldValue: '—',
          newValue: `Equipamento ${tag} cadastrado no sistema`
        });
        setSuccessMessage(`Equipamento ${tag} cadastrado com sucesso!`);
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error saving fleet equipment:", err);
      setGlobalError("Erro ao salvar equipamento da frota.");
    }
  };

  const handleDeleteFleetEquipment = async (id: string, tag: string) => {
    if (!user) {
      const err = new Error("Usuário não autenticado para realizar exclusão.");
      console.error("Erro de autenticação na exclusão do ativo:", err);
      setGlobalError(err.message);
      throw err;
    }

    if (!id) {
      const err = new Error("ID de registro do equipamento não foi informado para exclusão.");
      console.error("Erro de validação de parâmetro na exclusão do ativo:", err);
      setGlobalError(err.message);
      throw err;
    }

    if (!isModerator) {
      handleOpenDeleteModal('Ativo da Frota', id, 'fleetEquipment', tag);
      return;
    }

    try {
      console.log(`Iniciando exclusão permanente do ativo ID=${id}, TAG=${tag} da coleção 'fleetEquipment'...`);
      
      // Permanently remove document from Firestore
      await deleteDoc(doc(db, 'fleetEquipment', id));
      
      // Register history entry for deletion
      try {
        await addDoc(collection(db, 'fleetHistory'), {
          equipmentId: id,
          equipmentNumber: tag,
          userName: currentUserName,
          userEmail: user.email || '',
          timestamp: serverTimestamp(),
          field: 'EXCLUÍDO',
          oldValue: tag,
          newValue: 'REGISTRO EXCLUÍDO PERMANENTEMENTE'
        });
      } catch (histErr) {
        console.warn("Aviso: Falha ao registrar log no histórico de frota:", histErr);
      }

      const msg = `Ativo ${tag} excluído permanentemente do banco de dados com sucesso.`;
      console.log(msg);
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Erro detalhado do banco de dados ao excluir equipamento da frota:", err);
      const detailedError = err?.message || err?.code || String(err);
      setGlobalError(`Erro no banco de dados ao excluir equipamento: ${detailedError}`);
      throw err;
    }
  };

  const handleAddFleetNonConformity = async (equipmentId: string, description: string, photoUrl?: string) => {
    if (!user) return;
    const eq = fleetEquipment.find(e => e.id === equipmentId);
    if (!eq) return;

    try {
      const newNc: FleetNonConformity = {
        id: `nc_${Date.now()}`,
        description,
        date: format(new Date(), 'dd/MM/yyyy HH:mm'),
        resolved: false,
        photoUrl
      };

      const updatedNcs = [...(eq.nonConformities || []), newNc];
      await updateDoc(doc(db, 'fleetEquipment', equipmentId), {
        nonConformities: updatedNcs,
        status: 'Não conforme',
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'fleetHistory'), {
        equipmentId,
        equipmentNumber: eq.equipmentNumber,
        userName: currentUserName,
        userEmail: user.email || '',
        timestamp: serverTimestamp(),
        field: 'NÃO CONFORMIDADE',
        oldValue: eq.status,
        newValue: `Nova NC: ${description}`
      });
      setSuccessMessage(`Não conformidade registrada para ${eq.equipmentNumber}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error adding non conformity:", err);
      setGlobalError("Erro ao registrar não conformidade.");
    }
  };

  const handleResolveFleetNonConformity = async (equipmentId: string, ncId: string) => {
    if (!user) return;
    const eq = fleetEquipment.find(e => e.id === equipmentId);
    if (!eq) return;

    try {
      const updatedNcs = (eq.nonConformities || []).map(nc => {
        if (nc.id === ncId) {
          return {
            ...nc,
            resolved: true,
            resolvedAt: format(new Date(), 'dd/MM/yyyy HH:mm'),
            resolvedBy: currentUserName
          };
        }
        return nc;
      });

      const hasUnresolved = updatedNcs.some(nc => !nc.resolved);
      const newStatus = hasUnresolved ? 'Não conforme' : 'Operacional';

      await updateDoc(doc(db, 'fleetEquipment', equipmentId), {
        nonConformities: updatedNcs,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'fleetHistory'), {
        equipmentId,
        equipmentNumber: eq.equipmentNumber,
        userName: currentUserName,
        userEmail: user.email || '',
        timestamp: serverTimestamp(),
        field: 'NÃO CONFORMIDADE RESOLVIDA',
        oldValue: 'Não conforme',
        newValue: `NC resolvida por ${currentUserName}`
      });
      setSuccessMessage(`Não conformidade resolvida.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error resolving non conformity:", err);
      setGlobalError("Erro ao resolver não conformidade.");
    }
  };

  const handleImportFleetConfirmed = async (
    items: Partial<FleetEquipment>[],
    onProgress?: (msg: string, current: number, total: number) => void
  ) => {
    if (!user) {
      throw new Error("Usuário não autenticado. Faça login para continuar.");
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errorsList: { equipmentNumber: string; reason: string }[] = [];

    onProgress?.("Iniciando leitura da planilha...", 0, items.length);

    // Filter and validate equipment records before saving
    const validItems = items.filter(item => {
      const tag = (item.equipmentNumber || '').trim().toUpperCase();
      if (!tag || tag.length === 0) return false;
      if (isDateOrInvalidEquipmentNumber(tag) || isDateOrInvalidEquipmentNumber(item.equipmentNumber)) {
        errorsList.push({
          equipmentNumber: String(item.equipmentNumber || 'DESCONHECIDO'),
          reason: 'Número do equipamento cancelado por ser identificado como data, objeto Date ou valor inválido.'
        });
        return false;
      }
      return true;
    });

    onProgress?.(`${validItems.length} equipamentos válidos encontrados.`, 0, validItems.length);

    // Fetch fresh snapshot directly from Firestore database
    const fleetSnap = await getDocs(collection(db, 'fleetEquipment'));
    const existingMap = new Map<string, { id: string; status: string; type: string; equipmentNumber: string }>();

    // Scan existing documents in Firestore: map valid ones and auto-clean old corrupt date documents
    for (const d of fleetSnap.docs) {
      const data = d.data();
      const rawTag = (data.equipmentNumber || '').trim();
      const rawType = (data.type || 'CCU').trim();
      if (isDateOrInvalidEquipmentNumber(rawTag) || isDateOrInvalidEquipmentNumber(data.equipmentNumber)) {
        try {
          await deleteDoc(doc(db, 'fleetEquipment', d.id));
          console.info(`[CLEANUP] Documento corrompido com tag de data removido do Firestore: ${d.id} (${rawTag})`);
        } catch (delErr) {
          console.warn("Cleanup warning:", delErr);
        }
      } else {
        const tagUpper = rawTag.toUpperCase();
        const typeUpper = rawType.toUpperCase();
        if (tagUpper && typeUpper) {
          const key = `${typeUpper}|${tagUpper}`;
          existingMap.set(key, { id: d.id, status: data.status || '—', type: typeUpper, equipmentNumber: tagUpper });
        }
      }
    }

    const CHUNK_SIZE = 50;
    for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
      const chunk = validItems.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((item, chunkIdx) => {
        const itemIdx = i + chunkIdx + 1;
        const tag = (item.equipmentNumber || '').trim().toUpperCase();
        const type = (item.type || 'CCU').trim().toUpperCase();
        const key = `${type}|${tag}`;
        
        onProgress?.(`Gravando equipamento ${itemIdx} de ${validItems.length}...`, itemIdx, validItems.length);

        const existing = existingMap.get(key);
        if (existing) {
          updatedCount++;
          const ref = doc(db, 'fleetEquipment', existing.id);
          batch.update(ref, {
            equipmentNumber: tag,
            type: type,
            status: 'Cadastro Pendente de Validação',
            isPendingValidation: true,
            validationStatus: 'pending',
            updatedAt: serverTimestamp()
          });

          const hRef = doc(collection(db, 'fleetHistory'));
          batch.set(hRef, {
            equipmentId: existing.id,
            equipmentNumber: tag,
            userName: currentUserName,
            userEmail: user.email || '',
            timestamp: serverTimestamp(),
            field: 'MIGRAÇÃO PLANILHA OEG',
            oldValue: existing.status,
            newValue: `Atualizado via migração oficial por ${currentUserName}`
          });
        } else {
          createdCount++;
          const newRef = doc(collection(db, 'fleetEquipment'));
          batch.set(newRef, {
            equipmentNumber: tag,
            type: type,
            userId: user.uid,
            location: 'BASE',
            clientId: '',
            status: 'Cadastro Pendente de Validação',
            isPendingValidation: true,
            validationStatus: 'pending',
            nonConformities: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Register in map so duplicates within sheet update rather than duplicate
          existingMap.set(key, { id: newRef.id, status: 'Cadastro Pendente de Validação', type: type, equipmentNumber: tag });

          const hRef = doc(collection(db, 'fleetHistory'));
          batch.set(hRef, {
            equipmentId: newRef.id,
            equipmentNumber: tag,
            userName: currentUserName,
            userEmail: user.email || '',
            timestamp: serverTimestamp(),
            field: 'MIGRAÇÃO PLANILHA OEG',
            oldValue: '—',
            newValue: `Cadastrado via migração oficial OEG por ${currentUserName}`
          });
        }
      });

      try {
        await batch.commit();
      } catch (batchErr: any) {
        console.error("Error committing batch:", batchErr);
        chunk.forEach(item => {
          if (item.equipmentNumber) {
            errorsList.push({
              equipmentNumber: item.equipmentNumber,
              reason: batchErr?.message || 'Falha na gravação do documento no Firestore'
            });
          }
        });
      }
    }

    // AUTOMATIC POST-IMPORT VERIFICATION CHECK
    onProgress?.("Realizando verificação automática no banco de dados...", validItems.length, validItems.length);
    const postVerifySnap = await getDocs(collection(db, 'fleetEquipment'));
    const savedDocs: FleetEquipment[] = postVerifySnap.docs.map(d => ({ id: d.id, ...d.data() } as FleetEquipment));
    const savedTagsSet = new Set(savedDocs.map(d => (d.equipmentNumber || '').trim().toUpperCase()));

    const missingTags: string[] = [];
    validItems.forEach(item => {
      const tag = (item.equipmentNumber || '').trim().toUpperCase();
      if (tag && !savedTagsSet.has(tag)) {
        missingTags.push(tag);
      }
    });

    if (missingTags.length > 0) {
      missingTags.forEach(tag => {
        errorsList.push({
          equipmentNumber: tag,
          reason: 'Registro não foi localizado no banco de dados durante a verificação pós-importação.'
        });
      });
      throw new Error(`Diferença identificada na verificação: ${missingTags.length} equipamento(s) não foram gravados no banco (${missingTags.slice(0, 5).join(', ')}). Importação não concluída.`);
    }

    // Update React local state immediately to trigger synchronous UI/Dashboard refresh
    setFleetEquipment(savedDocs);

    try {
      await addAuditLog('CREATE', 'FLEET', 'MIGRATION', `Migração OEG concluída: ${createdCount} cadastrados, ${updatedCount} atualizados.`);
    } catch (auditErr) {
      console.warn("Audit log notice:", auditErr);
    }

    const successMsg = `Importação concluída com sucesso. ${createdCount} equipamentos cadastrados e ${updatedCount} equipamentos atualizados.`;
    setSuccessMessage(successMsg);
    setTimeout(() => setSuccessMessage(null), 5000);

    onProgress?.("Importação concluída.", validItems.length, validItems.length);

    return { created: createdCount, updated: updatedCount, errors: errorsList };
  };

  const handleSaveDecontaminationOperation = async (data: Partial<DecontaminationOperation>) => {
    if (!user) return;
    try {
      const cleanData: Record<string, any> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanData[key] = value;
        } else {
          cleanData[key] = '';
        }
      });

      if (cleanData.id) {
        const id = cleanData.id;
        delete cleanData.id;
        const docRef = doc(db, 'decontaminationOperations', id);
        await updateDoc(docRef, {
          ...cleanData,
          updatedAt: serverTimestamp()
        });
        await addAuditLog('UPDATE', 'FLEET', id, `Operação de descontaminação atualizada para o tanque ${data.equipmentNumber || ''}`);
      } else {
        delete cleanData.id;
        const docRef = await addDoc(collection(db, 'decontaminationOperations'), {
          ...cleanData,
          userId: user.uid,
          userName: currentUserName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        await addAuditLog('CREATE', 'FLEET', docRef.id, `Nova operação de descontaminação cadastrada para o tanque ${data.equipmentNumber || ''}`);
      }
      setSuccessMessage("Operação de descontaminação salva com sucesso!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: any) {
      console.error("Error saving decontamination operation:", error);
      setGlobalError("Erro ao salvar operação de descontaminação.");
      try {
        handleFirestoreError(error, OperationType.WRITE, 'decontaminationOperations');
      } catch (e) {}
      throw error;
    }
  };

  const handleDeleteDecontaminationOperation = async (id: string) => {
    if (!user) return;
    const op = decontaminationOperations.find(o => o.id === id);
    const tag = op?.equipmentNumber || 'Tanque';

    if (!isModerator) {
      handleOpenDeleteModal('Operação de Descontaminação', id, 'decontaminationOperations', tag);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Excluir Operação de Descontaminação',
      message: `Tem certeza que deseja excluir esta operação do tanque ${tag}? Esta ação não pode ser desfeita.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'decontaminationOperations', id));
          await addAuditLog('DELETE', 'FLEET', id, `Excluiu operação de descontaminação do tanque ${tag}`);
          setSuccessMessage('Operação excluída com sucesso!');
          setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
          console.error('Error deleting decontamination operation:', error);
          setGlobalError('Erro ao excluir operação.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleOpenDeleteModal = (itemType: string, itemId: string, itemCollection: string, itemName: string) => {
    setDeleteModalState({
      isOpen: true,
      itemType,
      itemId,
      itemCollection,
      itemName
    });
  };

  const handleSubmitDeleteRequest = async (reason: string) => {
    if (!user) return;
    const { itemType, itemId, itemCollection, itemName } = deleteModalState;

    try {
      await addDoc(collection(db, 'deletionRequests'), {
        requestedBy: currentUserName,
        requestedByUid: user.uid,
        userRole: effectiveRole,
        requestedAt: serverTimestamp(),
        itemType,
        itemId,
        itemCollection,
        itemName,
        reason,
        status: 'Pendente'
      });

      const mapEntity = (col: string): AuditLog['entity'] => {
        const u = col.toUpperCase();
        if (u.includes('FLEET') || u.includes('DECONTAMINATION')) return 'FLEET';
        if (u.includes('EQUIPMENT')) return 'EQUIPMENT';
        if (u.includes('CLIENT')) return 'CLIENT';
        if (u.includes('USER')) return 'USER';
        if (u.includes('SETTING')) return 'SETTINGS';
        return 'OS';
      };

      await addAuditLog(
        'DELETE',
        mapEntity(itemCollection),
        itemId,
        `Solicitou exclusão de ${itemType} "${itemName}". Motivo: ${reason}`
      );

      setSuccessMessage(`Solicitação de exclusão enviada com sucesso para aprovação do Moderador!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Error submitting deletion request:", err);
      setGlobalError("Erro ao enviar solicitação de exclusão.");
      throw err;
    }
  };

  const handleApproveDeletionRequest = async (req: DeletionRequest) => {
    if (!user) return;
    if (!isModerator) {
      setGlobalError("Apenas o Moderador do sistema pode aprovar e executar exclusões.");
      throw new Error("Apenas o Moderador do sistema pode aprovar e executar exclusões.");
    }
    try {
      await deleteDoc(doc(db, req.itemCollection, req.itemId));

      await updateDoc(doc(db, 'deletionRequests', req.id), {
        status: 'Aprovada',
        decidedBy: currentUserName,
        decidedAt: serverTimestamp()
      });

      const mapEntity = (col: string): AuditLog['entity'] => {
        const u = col.toUpperCase();
        if (u.includes('FLEET') || u.includes('DECONTAMINATION')) return 'FLEET';
        if (u.includes('EQUIPMENT')) return 'EQUIPMENT';
        if (u.includes('CLIENT')) return 'CLIENT';
        if (u.includes('USER')) return 'USER';
        if (u.includes('SETTING')) return 'SETTINGS';
        return 'OS';
      };

      await addAuditLog(
        'DELETE',
        mapEntity(req.itemCollection),
        req.itemId,
        `Aprovou a exclusão de ${req.itemType} "${req.itemName}". Solicitado originalmente por ${req.requestedBy}.`
      );

      setSuccessMessage(`Exclusão do item "${req.itemName}" aprovada e executada!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Error approving deletion:", err);
      setGlobalError("Erro ao aprovar exclusão.");
      throw err;
    }
  };

  const handleRejectDeletionRequest = async (req: DeletionRequest, reason: string) => {
    if (!user) return;
    if (!isModerator) {
      setGlobalError("Apenas o Moderador do sistema pode rejeitar solicitações de exclusão.");
      throw new Error("Apenas o Moderador do sistema pode rejeitar solicitações de exclusão.");
    }
    try {
      await updateDoc(doc(db, 'deletionRequests', req.id), {
        status: 'Rejeitada',
        decidedBy: currentUserName,
        decidedAt: serverTimestamp(),
        rejectionReason: reason
      });

      const mapEntity = (col: string): AuditLog['entity'] => {
        const u = col.toUpperCase();
        if (u.includes('FLEET') || u.includes('DECONTAMINATION')) return 'FLEET';
        if (u.includes('EQUIPMENT')) return 'EQUIPMENT';
        if (u.includes('CLIENT')) return 'CLIENT';
        if (u.includes('USER')) return 'USER';
        if (u.includes('SETTING')) return 'SETTINGS';
        return 'OS';
      };

      await addAuditLog(
        'UPDATE',
        mapEntity(req.itemCollection),
        req.itemId,
        `Rejeitou a exclusão de ${req.itemType} "${req.itemName}". Motivo: ${reason}`
      );

      setSuccessMessage(`Solicitação de exclusão rejeitada.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Error rejecting deletion:", err);
      setGlobalError("Erro ao rejeitar solicitação.");
      throw err;
    }
  };

  const handleUpdateModuleVisibility = async (newConfig: ModuleVisibilityConfig) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'settings', 'moduleVisibility'), newConfig);
      await addAuditLog(
        'UPDATE',
        'SETTINGS',
        'MODULE_VISIBILITY',
        `Atualizou a matriz de visibilidade dos módulos do sistema.`
      );
      setSuccessMessage("Matriz de permissões salva com sucesso!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Error updating module visibility:", err);
      setGlobalError("Erro ao salvar permissões.");
      throw err;
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp()
      });

      const targetUser = appUsers.find(u => u.id === userId);
      await addAuditLog(
        'UPDATE',
        'USER',
        userId,
        `Alterou o perfil do usuário ${targetUser?.name || userId} para ${newRole.toUpperCase()}.`
      );

      setSuccessMessage(`Perfil do usuário atualizado para ${newRole.toUpperCase()}!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Error updating user role:", err);
      setGlobalError("Erro ao atualizar perfil do usuário.");
      throw err;
    }
  };

  const handleUpdateUserFullProfile = async (
    userId: string,
    data: { name: string; username: string; email: string; role: UserRole; password?: string }
  ) => {
    if (!user) return;
    try {
      let cleanUsername = data.username.trim();
      if (cleanUsername.startsWith('@')) cleanUsername = cleanUsername.slice(1);

      const updateData: any = {
        name: data.name.trim(),
        username: cleanUsername,
        email: data.email.trim(),
        role: data.role,
        updatedAt: serverTimestamp()
      };

      if (data.password && data.password.trim() !== '') {
        updateData.password = data.password.trim();
        updateData.plainPassword = data.password.trim();
      }

      await updateDoc(doc(db, 'users', userId), updateData);

      await addAuditLog(
        'UPDATE',
        'USER',
        userId,
        `Atualizou as informações do perfil do usuário "${data.name}" (${data.role.toUpperCase()}).`
      );

      setSuccessMessage(`Perfil do usuário "${data.name}" atualizado com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Error updating user profile:", err);
      setGlobalError("Erro ao atualizar o perfil do usuário.");
      throw err;
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!user) return;
    if (!isModerator) {
      handleOpenDeleteModal('Usuário', userId, 'users', userName);
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', userId));

      await addAuditLog(
        'DELETE',
        'USER',
        userId,
        `Excluiu o usuário "${userName}".`
      );

      setSuccessMessage(`Usuário "${userName}" excluído com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setGlobalError("Erro ao excluir usuário.");
      throw err;
    }
  };

  const handleDeleteAllFleetEquipment = async () => {
    if (!user) {
      const err = new Error("Usuário não autenticado para realizar a exclusão.");
      setGlobalError(err.message);
      throw err;
    }

    if (!isModerator) {
      handleOpenDeleteModal('Ativos da Frota (Todos)', 'all', 'fleetEquipment', 'Todos os Ativos da Frota');
      return;
    }

    try {
      console.log("Iniciando exclusão de TODOS os ativos da frota ('fleetEquipment')...");
      const snap = await getDocs(collection(db, 'fleetEquipment'));
      const docs = snap.docs;

      if (docs.length > 0) {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
          const chunk = docs.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          for (const d of chunk) {
            batch.delete(doc(db, 'fleetEquipment', d.id));
          }
          await batch.commit();
        }
      }

      setFleetEquipment([]);

      try {
        await addAuditLog('DELETE', 'FLEET', 'RESET_ALL', `Reinício da implantação: Excluídos todos os ${docs.length} ativos da Gestão da Frota.`);
      } catch (auditErr) {
        console.warn("Audit log notice:", auditErr);
      }

      const msg = `Reinício executado com sucesso! ${docs.length} ativos da frota foram excluídos. Usuários, Clientes, Ordens de Serviço e outros módulos não foram alterados.`;
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 5000);

      return { deletedCount: docs.length };
    } catch (err: any) {
      console.error("Erro ao reiniciar a frota:", err);
      const detailedError = err?.message || String(err);
      setGlobalError(`Erro ao reiniciar cadastros da frota: ${detailedError}`);
      throw err;
    }
  };

  const handleRecoverUnimportedFleetEquipment = async (
    items: Partial<FleetEquipment>[],
    onProgress?: (msg: string, current: number, total: number) => void
  ) => {
    if (!user) {
      throw new Error("Usuário não autenticado. Faça login para continuar.");
    }

    let alreadyExistingCount = 0;
    let recoveredCount = 0;
    const breakdownByType: Record<string, number> = {};

    onProgress?.("Iniciando leitura da planilha e validação de registros...", 0, items.length);

    // Filter out invalid items
    const validItems = items.filter(item => {
      const tag = (item.equipmentNumber || '').trim().toUpperCase();
      if (!tag || tag.length === 0) return false;
      if (isDateOrInvalidEquipmentNumber(tag) || isDateOrInvalidEquipmentNumber(item.equipmentNumber)) {
        return false;
      }
      return true;
    });

    onProgress?.(`${validItems.length} registros válidos na planilha. Consultando banco de dados...`, 0, validItems.length);

    // Fetch fresh database snapshot
    const fleetSnap = await getDocs(collection(db, 'fleetEquipment'));
    
    // Clean up any corrupt tank documents in Firestore where equipmentNumber was saved as a date/timestamp
    // User directive: "Permitir reprocessar apenas os tanques já importados incorretamente. Não alterar CCU's, REEFER's, SPOOLER's ou SLING's."
    const corruptTankDocsToDelete: string[] = [];
    for (const d of fleetSnap.docs) {
      const data = d.data();
      const rawTag = (data.equipmentNumber || '').trim().toUpperCase();
      const rawType = (data.type || '').trim().toUpperCase();

      const isTankType = rawType.includes('TANQUE') || rawType.includes('TANK');
      const isCorruptTag = isDateOrInvalidEquipmentNumber(rawTag) || isDateOrInvalidEquipmentNumber(data.equipmentNumber);

      // ONLY delete if it's a TANK type and has a corrupt date tag! Never touch CCU, REEFER, SPOOLER, or SLING!
      if (isTankType && isCorruptTag) {
        corruptTankDocsToDelete.push(d.id);
      }
    }

    if (corruptTankDocsToDelete.length > 0) {
      onProgress?.(`Limpando ${corruptTankDocsToDelete.length} registros corrompidos de Tanques...`, 0, validItems.length);
      const CHUNK_SIZE = 400;
      for (let i = 0; i < corruptTankDocsToDelete.length; i += CHUNK_SIZE) {
        const chunk = corruptTankDocsToDelete.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const id of chunk) {
          batch.delete(doc(db, 'fleetEquipment', id));
        }
        await batch.commit();
      }
    }

    // Re-query database after cleaning corrupt tank docs
    const freshFleetSnap = await getDocs(collection(db, 'fleetEquipment'));
    const existingMap = new Map<string, { id: string; type: string; equipmentNumber: string }>();

    for (const d of freshFleetSnap.docs) {
      const data = d.data();
      const rawTag = (data.equipmentNumber || '').trim().toUpperCase();
      const rawType = (data.type || 'CCU').trim().toUpperCase();
      if (!isDateOrInvalidEquipmentNumber(rawTag) && rawTag && rawType) {
        const key = `${rawType}|${rawTag}`;
        existingMap.set(key, { id: d.id, type: rawType, equipmentNumber: rawTag });
      }
    }

    const CHUNK_SIZE = 50;
    for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
      const chunk = validItems.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      let batchHasWrites = false;

      chunk.forEach((item, chunkIdx) => {
        const itemIdx = i + chunkIdx + 1;
        const tag = (item.equipmentNumber || '').trim().toUpperCase();
        const type = (item.type || 'CCU').trim().toUpperCase();
        const key = `${type}|${tag}`;

        onProgress?.(`Analisando registro ${itemIdx} de ${validItems.length}...`, itemIdx, validItems.length);

        if (existingMap.has(key)) {
          // Record exists: IGNORE COMPLETELY. DO NOT UPDATE OR OVERWRITE.
          alreadyExistingCount++;
        } else {
          // Record does NOT exist: CREATE AUTOMATICALLY
          recoveredCount++;
          batchHasWrites = true;

          const displayType = item.type || 'CCU';
          breakdownByType[displayType] = (breakdownByType[displayType] || 0) + 1;

          const newRef = doc(collection(db, 'fleetEquipment'));
          batch.set(newRef, {
            equipmentNumber: tag,
            type: type,
            userId: user.uid,
            location: 'BASE',
            clientId: '',
            status: 'Cadastro Pendente de Validação',
            isPendingValidation: true,
            validationStatus: 'pending',
            nonConformities: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Register in map so intra-sheet duplicates are ignored
          existingMap.set(key, { id: newRef.id, type: type, equipmentNumber: tag });

          const hRef = doc(collection(db, 'fleetHistory'));
          batch.set(hRef, {
            equipmentId: newRef.id,
            equipmentNumber: tag,
            userName: currentUserName,
            userEmail: user.email || '',
            timestamp: serverTimestamp(),
            field: 'RECUPERAÇÃO DE REGISTROS',
            oldValue: '—',
            newValue: `Recuperado e cadastrado via ferramenta de resgate por ${currentUserName}`
          });
        }
      });

      if (batchHasWrites) {
        await batch.commit();
      }
    }

    // Refresh state and database snapshot
    const postVerifySnap = await getDocs(collection(db, 'fleetEquipment'));
    const savedDocs: FleetEquipment[] = postVerifySnap.docs.map(d => ({ id: d.id, ...d.data() } as FleetEquipment));
    setFleetEquipment(savedDocs);

    try {
      await addAuditLog('CREATE', 'FLEET', 'RECOVERY', `Ferramenta de Recuperação: ${recoveredCount} novos registros recuperados de ${validItems.length} analisados.`);
    } catch (auditErr) {
      console.warn("Audit log notice:", auditErr);
    }

    const successMsg = `Recuperação concluída: ${recoveredCount} novos registros adicionados (${alreadyExistingCount} mantidos intactos).`;
    setSuccessMessage(successMsg);
    setTimeout(() => setSuccessMessage(null), 5000);

    return {
      totalAnalyzed: validItems.length,
      alreadyExisting: alreadyExistingCount,
      recoveredCount: recoveredCount,
      breakdownByType: breakdownByType
    };
  };

  // Dashboard Calculations (Strictly by month for stats)
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    if (selectedMonth) {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      filtered = filtered.filter(order => {
        if (!order.startDate?.toDate) return false;
        try {
          const orderDate = order.startDate.toDate();
          return isWithinInterval(orderDate, { start, end });
        } catch (e) {
          console.error("Error parsing order date:", e);
          return false;
        }
      });
    }
    
    if (osTypeFilter !== 'all') {
      filtered = filtered.filter(o => o.family === osTypeFilter);
    }
    
    return filtered;
  }, [orders, selectedMonth, osTypeFilter]);

  // UI Display Calculations (Inclusive for Kanban/List)
  const displayOrders = useMemo(() => {
    let filtered = orders;

    if (selectedMonth) {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      
      filtered = filtered.filter(order => {
        // 1. Include if it started in this month
        if (order.startDate?.toDate) {
          const orderDate = order.startDate.toDate();
          if (isWithinInterval(orderDate, { start, end })) return true;
        }

        // 2. Include if it's "Em Manutenção" AND started BEFORE this month
        // (We don't show future maintenance orders in past months)
        const statusStr = (order.status || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const isMaintenance = statusStr.includes('manutencao') || 
                             statusStr.includes('andamento') ||
                             order.status === 'Em Manutenção';
                             
        if (isMaintenance && order.startDate?.toDate) {
          const orderDate = order.startDate.toDate();
          return orderDate < start;
        }
        
        return false;
      });
    }

    if (osTypeFilter !== 'all') {
      filtered = filtered.filter(o => o.family === osTypeFilter);
    }

    return filtered;
  }, [orders, selectedMonth, osTypeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, activeOrderSubTab, inProgressSearchTerm, completedSearchTerm, selectedMonth]);

  const pcpFleetAlertStats = useMemo(() => {
    let overdueVis = 0;
    let overdueEnd = 0;
    let exp30 = 0;
    let pendingValCount = 0;

    fleetEquipment.forEach(e => {
      const v = calculateDaysRemaining(e.nextVisualInspectionDate);
      const ed = calculateDaysRemaining(e.nextEndInspectionDate);

      if (v < 0) overdueVis++;
      if (ed < 0) overdueEnd++;
      if ((v >= 0 && v <= 30) || (ed >= 0 && ed <= 30)) exp30++;
      if (e.isPendingValidation !== false || e.validationStatus === 'pending') pendingValCount++;
    });

    return { overdueVis, overdueEnd, exp30, pendingValCount };
  }, [fleetEquipment]);

  const getFamilyIcon = (family: string, className = "w-4 h-4") => {
    if (family === 'CCUs') return <LayoutGrid className={className} />;
    if (family && family.includes('Tanque')) return <Container className={className} />;
    return <Package className={className} />;
  };

  const statsByFamily = useMemo(() => {
    const families: Record<string, { count: number, totalLeadTime: number, completedCount: number }> = {};
    
    filteredOrders.forEach(order => {
      // Normalize family name
      let rawFamily = (order.family || '').trim();
      let familyName = rawFamily || 'Outros';
      
      // Merge CCU variations into CCUs
      if (familyName.toUpperCase() === 'CCU' || familyName.toUpperCase() === 'CCUS') {
        familyName = 'CCUs';
      }
      
      if (!families[familyName]) {
        families[familyName] = { count: 0, totalLeadTime: 0, completedCount: 0 };
      }
      families[familyName].count += 1;
      
      if (order.status === 'Concluído') {
        let leadTime = order.leadTime;
        
        // Fallback calculation if leadTime is missing but we have dates
        if (leadTime === undefined && order.endDate?.toDate && order.startDate?.toDate) {
          try {
            leadTime = differenceInDays(order.endDate.toDate(), order.startDate.toDate());
          } catch (e) {
            console.error("Error calculating fallback lead time:", e);
          }
        }

        if (leadTime !== undefined) {
          families[familyName].totalLeadTime += leadTime;
          families[familyName].completedCount += 1;
        }
      }
    });

    return Object.entries(families)
      .filter(([name, data]) => name.length > 0 && data.count > 0) // Only families with orders
      .map(([name, data]) => ({
        name,
        quantidade: data.count,
        leadTimeMedio: data.completedCount > 0 ? Math.round(data.totalLeadTime / data.completedCount) : 0
      }));
  }, [filteredOrders]);

  const statsBySubFamily = useMemo(() => {
    const subFamilies: Record<string, { count: number, totalLeadTime: number, completedCount: number }> = {};
    
    filteredOrders.filter(o => o.family === 'CCUs' && o.subFamily).forEach(order => {
      const subName = order.subFamily!;
      if (!subFamilies[subName]) {
        subFamilies[subName] = { count: 0, totalLeadTime: 0, completedCount: 0 };
      }
      subFamilies[subName].count += 1;
      
      if (order.status === 'Concluído') {
        let leadTime = order.leadTime;
        if (leadTime === undefined && order.endDate?.toDate && order.startDate?.toDate) {
          try { leadTime = differenceInDays(order.endDate.toDate(), order.startDate.toDate()); } catch(e) {}
        }
        if (leadTime !== undefined) {
          subFamilies[subName].totalLeadTime += leadTime;
          subFamilies[subName].completedCount += 1;
        }
      }
    });

    return Object.entries(subFamilies).map(([name, data]) => ({
      name,
      quantidade: data.count,
      leadTimeMedio: data.completedCount > 0 ? Math.round(data.totalLeadTime / data.completedCount) : 0
    }))
    .filter(s => s.leadTimeMedio > 0) // Only show those with completed data for better ranking
    .sort((a, b) => a.leadTimeMedio - b.leadTimeMedio);
  }, [filteredOrders]);

  const statsByClient = useMemo(() => {
    const clientStats: Record<string, { count: number, totalLeadTime: number, completedCount: number }> = {};
    
    filteredOrders.forEach(order => {
      const client = clients.find(c => c.id === order.clientId);
      const clientName = client ? client.razaoSocial : 'Desconhecido';
      
      if (!clientStats[clientName]) {
        clientStats[clientName] = { count: 0, totalLeadTime: 0, completedCount: 0 };
      }
      clientStats[clientName].count += 1;

      if (order.status === 'Concluído') {
        let leadTime = order.leadTime;
        
        // Fallback calculation if leadTime is missing but we have dates
        if (leadTime === undefined && order.endDate?.toDate && order.startDate?.toDate) {
          try {
            leadTime = differenceInDays(order.endDate.toDate(), order.startDate.toDate());
          } catch (e) {
            console.error("Error calculating fallback lead time:", e);
          }
        }

        if (leadTime !== undefined) {
          clientStats[clientName].totalLeadTime += leadTime;
          clientStats[clientName].completedCount += 1;
        }
      }
    });

    return Object.entries(clientStats)
      .filter(([name, data]) => name !== 'Desconhecido' && name.trim() !== '' && data.count > 0)
      .sort((a, b) => b[1].count - a[1].count) // Sort by volume for better readability
      .map(([name, data]) => ({
        name,
        quantidade: data.count,
        leadTimeMedio: data.completedCount > 0 ? Math.round(data.totalLeadTime / data.completedCount) : 0
      }));
  }, [filteredOrders, clients]);

  const monthlyTrend = useMemo(() => {
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    return months.map(m => {
      const start = startOfMonth(m);
      const end = endOfMonth(m);
      const count = orders.filter(o => {
        if (!o.startDate?.toDate) return false;
        try {
          const date = o.startDate.toDate();
          return isWithinInterval(date, { start, end }) && o.status === 'Concluído';
        } catch (e) {
          return false;
        }
      }).length;

      return {
        name: format(m, 'MMM', { locale: ptBR }),
        liberados: count
      };
    });
  }, [orders]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || loginError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-800 transition-colors duration-300"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-white font-black text-2xl tracking-tighter">OEG</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center tracking-tight">OPS Control</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-center font-medium">
            Entre na sua conta de equipe
          </p>

          {loginError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-tight leading-tight">
                  {loginError}
                </p>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 ml-1">Usuário</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                value={authForm.username}
                onChange={(e) => {
                  setAuthForm({ ...authForm, username: e.target.value });
                  if (loginError) setLoginError(null);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 ml-1">Senha</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                value={authForm.password}
                onChange={(e) => {
                  setAuthForm({ ...authForm, password: e.target.value });
                  if (loginError) setLoginError(null);
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-lg shadow-blue-100 dark:shadow-none active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Aguarde...' : 'Entrar'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (!currentUserRole) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl p-10 border border-slate-100 dark:border-slate-800 text-center transition-colors duration-300"
        >
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <ShieldCheck className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tight uppercase">Aguardando Aprovação</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-bold leading-relaxed">
            Sua conta foi criada com sucesso, mas ainda não possui permissões de acesso. 
            Peça ao administrador para liberar seu acesso na aba "Acessos".
          </p>
          <div className="space-y-3">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Seu Usuário</p>
              <p className="font-bold text-slate-900 dark:text-white">{user.email?.split('@')[0]}</p>
            </div>
            <button
              onClick={() => auth.signOut()}
              className="w-full py-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-black uppercase tracking-widest text-xs transition-all"
            >
              Sair da Conta
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex font-sans selection:bg-blue-100 selection:text-blue-900 transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-72 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 flex flex-col fixed h-full z-20 shadow-2xl shadow-slate-200/20 dark:shadow-none transition-all duration-500">
        <div className="p-8">
          <div 
            className="flex items-center gap-4 mb-12 group cursor-pointer active:scale-95 transition-transform duration-200" 
            onClick={() => {
              const target = isTabAllowed('decontamination') ? 'decontamination' : ['equipments', 'clients', 'dashboard'].find(t => isTabAllowed(t)) || 'decontamination';
              setActiveTab(target as any);
              window.location.hash = target;
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded-2xl shadow-2xl shadow-blue-500/20 transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                <span className="text-white font-black text-lg tracking-tighter">OEG</span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-black text-slate-900 dark:text-white text-xl tracking-tight leading-none">OPS Control</span>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mt-1.5 opacity-80">Management</span>
            </div>
          </div>

          <nav className="space-y-2">
            {currentUserRole === 'moderator' && (
              <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Simular Visão:</span>
                  {activeRolePreview && (
                    <button
                      onClick={() => setActiveRolePreview(null)}
                      className="text-[9px] font-black text-rose-500 hover:underline uppercase"
                    >
                      Sair
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['moderator', 'admin', 'user'] as UserRole[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setActiveRolePreview(r === currentUserRole ? null : r)}
                      className={cn(
                        "py-1 px-1.5 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer",
                        effectiveRole === r
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                      )}
                    >
                      {r === 'moderator' ? 'Mod' : r === 'admin' ? 'Adm' : 'User'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isTabAllowed('dashboard') && (
              <button
                onClick={() => { setActiveTab('dashboard'); window.location.hash = 'dashboard'; }}
                className={cn(
                  "sidebar-item w-full group",
                  activeTab === 'dashboard' ? "sidebar-item-active" : "sidebar-item-inactive"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-all duration-300", activeTab === 'dashboard' ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                Dashboard
                {activeTab === 'dashboard' && <motion.div layoutId="active-pill" className="absolute right-4 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
              </button>
            )}

            {isTabAllowed('orders') && (
              <button
                onClick={() => { setActiveTab('orders'); window.location.hash = 'orders'; }}
                className={cn(
                  "sidebar-item w-full group",
                  activeTab === 'orders' ? "sidebar-item-active" : "sidebar-item-inactive"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-all duration-300", activeTab === 'orders' ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>
                  <ClipboardList className="w-4 h-4" />
                </div>
                Ordens de Serviço
                {activeTab === 'orders' && <motion.div layoutId="active-pill" className="absolute right-4 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
              </button>
            )}

            {isTabAllowed('fleet') && (
              <button
                onClick={() => { setActiveTab('fleet'); window.location.hash = 'fleet'; }}
                className={cn(
                  "sidebar-item w-full group",
                  activeTab === 'fleet' ? "sidebar-item-active" : "sidebar-item-inactive"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-all duration-300", activeTab === 'fleet' ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>
                  <Container className="w-4 h-4" />
                </div>
                Gestão da Frota
                {activeTab === 'fleet' && <motion.div layoutId="active-pill" className="absolute right-4 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
              </button>
            )}

            {isTabAllowed('decontamination') && (
              <button
                onClick={() => { setActiveTab('decontamination'); window.location.hash = 'decontamination'; }}
                className={cn(
                  "sidebar-item w-full group",
                  activeTab === 'decontamination' ? "sidebar-item-active" : "sidebar-item-inactive"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-all duration-300", activeTab === 'decontamination' ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>
                  <Droplet className="w-4 h-4" />
                </div>
                Descontaminação
                {activeTab === 'decontamination' && <motion.div layoutId="active-pill" className="absolute right-4 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
              </button>
            )}

            {isTabAllowed('clients') && (
              <button
                onClick={() => { setActiveTab('clients'); window.location.hash = 'clients'; }}
                className={cn(
                  "sidebar-item w-full group",
                  activeTab === 'clients' ? "sidebar-item-active" : "sidebar-item-inactive"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-all duration-300", activeTab === 'clients' ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>
                  <Building2 className="w-4 h-4" />
                </div>
                Clientes
                {activeTab === 'clients' && <motion.div layoutId="active-pill" className="absolute right-4 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
              </button>
            )}

            {isTabAllowed('equipments') && (
              <button
                onClick={() => { setActiveTab('equipments'); window.location.hash = 'equipments'; }}
                className={cn(
                  "sidebar-item w-full group",
                  activeTab === 'equipments' ? "sidebar-item-active" : "sidebar-item-inactive"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-all duration-300", activeTab === 'equipments' ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>
                  <Boxes className="w-4 h-4" />
                </div>
                Equipamentos
                {activeTab === 'equipments' && <motion.div layoutId="active-pill" className="absolute right-4 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
              </button>
            )}

            {(currentUserRole === 'moderator' || (isSuperAdmin && !activeRolePreview)) && (
              <>
                <div className="pt-3 pb-1 border-t border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-3">
                    Moderação
                  </span>
                </div>

                {isTabAllowed('approvals') && (
                  <button
                    onClick={() => { setActiveTab('approvals'); window.location.hash = 'approvals'; }}
                    className={cn(
                      "sidebar-item w-full group relative",
                      activeTab === 'approvals' ? "sidebar-item-active" : "sidebar-item-inactive"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl transition-all duration-300", activeTab === 'approvals' ? "bg-amber-600 text-white" : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 group-hover:bg-amber-100")}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <span>Aprovações</span>
                    {deletionRequests.filter(r => r.status === 'Pendente').length > 0 && (
                      <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                        {deletionRequests.filter(r => r.status === 'Pendente').length}
                      </span>
                    )}
                    {activeTab === 'approvals' && <motion.div layoutId="active-pill" className="absolute right-4 w-1.5 h-1.5 bg-amber-600 rounded-full" />}
                  </button>
                )}

                {isTabAllowed('access') && (
                  <button
                    onClick={() => { setActiveTab('access'); window.location.hash = 'access'; }}
                    className={cn(
                      "sidebar-item w-full group",
                      activeTab === 'access' ? "sidebar-item-active" : "sidebar-item-inactive"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl transition-all duration-300", activeTab === 'access' ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    Permissões & Perfis
                    {activeTab === 'access' && <motion.div layoutId="active-pill" className="absolute right-4 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
                  </button>
                )}

                {isTabAllowed('settings') && (
                  <button
                    onClick={() => { setActiveTab('settings'); window.location.hash = 'settings'; }}
                    className={cn(
                      "sidebar-item w-full group",
                      activeTab === 'settings' ? "sidebar-item-active" : "sidebar-item-inactive"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl transition-all duration-300", activeTab === 'settings' ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>
                      <Settings className="w-4 h-4" />
                    </div>
                    Configurações
                    {activeTab === 'settings' && <motion.div layoutId="active-pill" className="absolute right-4 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
                  </button>
                )}

                {isTabAllowed('audits') && (
                  <button
                    onClick={() => { setActiveTab('audits'); window.location.hash = 'audits'; }}
                    className={cn(
                      "sidebar-item w-full group",
                      activeTab === 'audits' ? "sidebar-item-active" : "sidebar-item-inactive"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl transition-all duration-300", activeTab === 'audits' ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    Auditorias
                    {activeTab === 'audits' && <motion.div layoutId="active-pill" className="absolute right-4 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
                  </button>
                )}
              </>
            )}
          </nav>
        </div>

        <div className="mt-auto p-6">
          <div className="bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-[24px] p-5 border border-slate-200/50 dark:border-slate-700/50 transition-all duration-500 hover:shadow-xl hover:shadow-blue-500/5 group">
            <div className="flex items-center gap-4 mb-5">
              <div className="relative">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=random`} 
                  alt={user.displayName || ''} 
                  className="w-12 h-12 rounded-2xl border-2 border-white dark:border-slate-700 shadow-2xl transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full shadow-lg"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white truncate tracking-tight">{user.displayName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{currentUserRole}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all text-[10px] font-black uppercase tracking-wider border border-slate-200/60 dark:border-slate-700/60 cursor-pointer"
                title="Alterar sua senha de acesso"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Senha
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all text-[10px] font-black uppercase tracking-wider border border-transparent hover:border-red-100 dark:hover:border-red-900/30 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 min-h-screen">
        <AnimatePresence>
          {globalError && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className="fixed top-8 left-1/2 z-[100] w-full max-w-md px-4"
            >
              <div className="bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 px-8 py-5 rounded-[24px] shadow-2xl flex items-center justify-between gap-6 border border-white/10 dark:border-slate-200 backdrop-blur-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-sm font-black tracking-tight">{globalError}</p>
                </div>
                <button onClick={() => setGlobalError(null)} className="p-2 hover:bg-white/10 dark:hover:bg-slate-900/10 rounded-xl transition-colors">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className="fixed top-8 left-1/2 z-[100] w-full max-w-md px-4"
            >
              <div className="bg-emerald-500/90 text-white px-8 py-5 rounded-[24px] shadow-2xl flex items-center justify-between gap-6 border border-emerald-400/30 backdrop-blur-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-black tracking-tight">{successMessage}</p>
                </div>
                <button onClick={() => setSuccessMessage(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <header className="sticky top-0 z-10 bg-[#f8fafc]/80 dark:bg-[#020617]/80 backdrop-blur-2xl border-b border-slate-200/40 dark:border-slate-800/40 px-12 py-8 transition-all duration-500">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between">
            <div>
              <motion.h2 
                key={activeTab}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-3xl font-black text-slate-900 dark:text-white tracking-tight"
              >
                {activeTab === 'dashboard' ? 'Painel de Produtividade' : 
                 activeTab === 'orders' ? 'Gestão de OS' :
                 activeTab === 'fleet' ? 'Gestão da Frota' :
                 activeTab === 'decontamination' ? 'Descontaminação' :
                 activeTab === 'clients' ? 'Gestão de Clientes' : 
                 activeTab === 'equipments' ? 'Gestão de Equipamentos' :
                 activeTab === 'approvals' ? 'Aprovações Pendentes' :
                 activeTab === 'settings' ? 'Configurações' : 
                 activeTab === 'audits' ? 'Auditoria de Sistema' : 'Gestão de Acessos'}
              </motion.h2>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-5 h-5 rounded-full border-2 border-[#f8fafc] dark:border-slate-950 bg-slate-200 dark:bg-slate-800 animate-pulse" style={{ animationDelay: `${i * 200}ms` }}></div>
                  ))}
                </div>
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                  {activeTab === 'dashboard' 
                    ? 'Performance em tempo real' 
                    : activeTab === 'orders' ? 'Controle operacional' :
                    activeTab === 'fleet' ? 'Controle de ativos e inspeções PCP' :
                    activeTab === 'decontamination' ? 'Controle de lavagem e descontaminação' :
                    activeTab === 'clients' ? 'Base de parceiros' :
                    activeTab === 'equipments' ? 'Ativos registrados' :
                    activeTab === 'approvals' ? 'Solicitações e autorizações' :
                    activeTab === 'settings' ? 'Preferências do sistema' :
                    activeTab === 'audits' ? 'Registros e logs de ações' :
                    'Controle de segurança'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {activeTab === 'dashboard' && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={seedDemoOrders}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {isSubmitting ? 'Processando...' : 'Gerar 50 Demos'}
                  </button>
                  
                  {canDelete && orders.some(o => (o as any).isDemo) && (
                    <button
                      onClick={clearDemoOrders}
                      disabled={isSubmitting}
                      className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl shadow-rose-500/20 active:scale-95 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Limpar Demo
                    </button>
                  )}
                  <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl px-5 py-3 shadow-2xl shadow-slate-200/10 dark:shadow-none transition-all duration-500 hover:border-blue-500/30">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <select 
                      className="bg-transparent border-none text-xs font-black text-slate-700 dark:text-slate-300 focus:ring-0 cursor-pointer uppercase tracking-widest"
                      value={selectedMonth ? format(selectedMonth, 'yyyy-MM') : 'all'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedMonth(val === 'all' ? null : parseISO(`${val}-01`));
                      }}
                    >
                      <option value="all">Todos os Períodos</option>
                      {eachMonthOfInterval({
                        start: subMonths(new Date(), 12),
                        end: new Date()
                      }).map(m => (
                        <option key={m.toISOString()} value={format(m, 'yyyy-MM')}>
                          {format(m, 'MMMM yyyy', { locale: ptBR })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              {activeTab === 'orders' && (
                <button
                  onClick={() => { 
                    setEditingOrder(null);
                    setFormData({
                      equipmentNumber: '',
                      family: '',
                      subFamily: '',
                      otherFamily: '',
                      clientId: '',
                      startDate: format(new Date(), 'yyyy-MM-dd'),
                      endDate: '',
                      status: 'Em Manutenção',
                      priority: 'Média' as const,
                      maintenanceScope: '',
                      createdBy: currentUserName,
                      maintenanceTechnician: '',
                      closedBy: '',
                      slingCheck: { status: 'NA', value: '' },
                      damagedSlingCheck: { status: 'NA', value: '' },
                      excessiveCorrosionCheck: { status: 'NA', value: '' },
                      primaryStructureCheck: { status: 'NA', value: '' },
                      secondaryStructureCheck: { status: 'NA', value: '' },
                      damagedBagCheck: { status: 'NA', value: '' },
                      bottomCheck: { status: 'NA', value: '' },
                      roofCheck: { status: 'NA', value: '' },
                      tieDownPointCheck: { status: 'NA', value: '' },
                      doorCheck: { status: 'NA', value: '' },
                      lidCheck: { status: 'NA', value: '' },
                      leverCheck: { status: 'NA', value: '' },
                      leverSupportCheck: { status: 'NA', value: '' },
                      roundHeadRivetCheck: { status: 'NA', value: '' },
                      clawCheck: { status: 'NA', value: '' },
                      retainerCheck: { status: 'NA', value: '' },
                      rodCheck: { status: 'NA', value: '' },
                      simpleRodSupportCheck: { status: 'NA', value: '' },
                      specialRodSupportCheck: { status: 'NA', value: '' },
                      rodLockCheck: { status: 'NA', value: '' },
                      hingeCheck: { status: 'NA', value: '' },
                      reworkCheck: { status: 'NA', value: '' },
                    });
                    setModalType('os'); 
                    setAccessError(null); 
                    setIsModalOpen(true); 
                  }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Nova OS
                </button>
              )}

              {activeTab === 'clients' && (
                <button
                  onClick={() => { setModalType('client'); setAccessError(null); setIsModalOpen(true); }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Novo Cliente
                </button>
              )}

              {activeTab === 'equipments' && (
                <button
                  onClick={() => { setModalType('equipment'); setAccessError(null); setIsModalOpen(true); }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Novo Equipamento
                </button>
              )}

              {activeTab === 'access' && (
                <button
                  onClick={() => { setModalType('access'); setAccessError(null); setIsModalOpen(true); }}
                  className="btn-primary flex items-center gap-2"
                >
                  <UserPlus className="w-5 h-5" />
                  Novo Acesso
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto">
          {/* MODERATOR GLOBAL NOTIFICATION BANNER FOR PENDING DELETION REQUESTS */}
          {(effectiveRole === 'moderator' || (isSuperAdmin && !activeRolePreview)) && 
            activeTab !== 'approvals' && 
            deletionRequests.some(r => r.status === 'Pendente') && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/5 dark:bg-amber-950/40 border-2 border-amber-500/60 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl backdrop-blur-md"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <span>Nova solicitação de exclusão</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black shadow-sm">
                      {deletionRequests.filter(r => r.status === 'Pendente').length} {deletionRequests.filter(r => r.status === 'Pendente').length === 1 ? 'solicitação pendente' : 'solicitações pendentes'}
                    </span>
                  </div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                    {(() => {
                      const pendingList = deletionRequests.filter(r => r.status === 'Pendente');
                      const latest = pendingList[0];
                      return `${latest.requestedBy || 'Admin'} solicitou a exclusão do ${latest.itemType || 'item'} "${latest.itemName}".`;
                    })()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveTab('approvals');
                  window.location.hash = 'approvals';
                }}
                className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 shrink-0 flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                ANALISAR SOLICITAÇÃO
              </button>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >

              {activeTab === 'dashboard' ? (
                <div className="space-y-8">
                  {/* PCP Fleet Inspection & Validation Alert Widget */}
                  {(() => {
                    const { overdueVis, overdueEnd, exp30, pendingValCount } = pcpFleetAlertStats;

                    if (overdueVis === 0 && overdueEnd === 0 && exp30 === 0 && pendingValCount === 0) return null;

                    return (
                      <div className="space-y-4">
                        {/* Validation Pending Card */}
                        {pendingValCount > 0 && (
                          <div className="p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/20">
                                <AlertTriangle className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
                                  <span>Avisos de Validação do Cadastro da Frota</span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
                                    {pendingValCount} {pendingValCount === 1 ? 'pendente' : 'pendentes'}
                                  </span>
                                </h4>
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                                  Atenção PCP: A planilha legada foi importada apenas com Número e Tipo. Os dados completos (Cliente, Localização, Datas) aguardam conferência física.
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => setActiveTab('fleet')}
                              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/25 transition-all shrink-0 active:scale-95 flex items-center gap-2"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              Ver Equipamentos Pendentes
                            </button>
                          </div>
                        )}

                        {/* Overdue Inspections Card */}
                        {(overdueVis > 0 || overdueEnd > 0 || exp30 > 0) && (
                          <div className="p-6 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-transparent border border-red-500/30 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-red-600 text-white rounded-2xl animate-pulse shadow-lg shadow-red-600/30">
                                <AlertTriangle className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wide">
                                  Alerta de Inspeções da Frota (Setor PCP)
                                </h4>
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                                  Atenção PCP: <strong className="text-red-600">{overdueVis} visuais vencidas</strong>, <strong className="text-red-600">{overdueEnd} ENDs vencidos</strong> e <strong className="text-amber-600">{exp30} a vencer nos próximos 30 dias</strong>.
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => setActiveTab('fleet')}
                              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-red-600/25 transition-all shrink-0"
                            >
                              Ir para Gestão da Frota
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <motion.div 
                      whileHover={{ y: -8 }}
                      className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm card-hover relative group transition-all duration-500 overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                      <div className="flex items-center justify-between mb-8">
                        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center shadow-inner">
                          <ClipboardList className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full uppercase tracking-[0.2em]">
                          {selectedMonth ? 'Mensal' : 'Geral'}
                        </span>
                      </div>
                      <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Total de Ordens</p>
                      <div className="flex items-baseline gap-3">
                        <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">{filteredOrders.length}</p>
                        <div className="flex flex-col">
                          <p className="text-xs font-black text-green-600 dark:text-green-400">+{filteredOrders.filter(o => o.status === 'Concluído').length}</p>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Concluídas</p>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      whileHover={{ y: -8 }}
                      className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm card-hover relative group transition-all duration-500 overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 to-orange-600"></div>
                      <div className="flex items-center justify-between mb-8">
                        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center shadow-inner">
                          <Clock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-full uppercase tracking-[0.2em]">Eficiência</span>
                      </div>
                      <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Lead Time Médio</p>
                      <div className="flex items-baseline gap-3">
                        <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                          {Math.round(filteredOrders.reduce((acc, o) => {
                            if (o.status !== 'Concluído') return acc;
                            let lt = o.leadTime;
                            if (lt === undefined && o.endDate?.toDate && o.startDate?.toDate) {
                              try { lt = differenceInDays(o.endDate.toDate(), o.startDate.toDate()); } catch(e) {}
                            }
                            return acc + (lt || 0);
                          }, 0) / (filteredOrders.filter(o => o.status === 'Concluído').length || 1))}
                        </p>
                        <p className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">dias</p>
                      </div>
                    </motion.div>

                    <motion.div 
                      whileHover={{ y: -8 }}
                      className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm card-hover relative group transition-all duration-500 overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                      <div className="flex items-center justify-between mb-8">
                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center shadow-inner">
                          <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full uppercase tracking-[0.2em]">Parceiros</span>
                      </div>
                      <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Clientes Ativos</p>
                      <div className="flex items-baseline gap-3">
                        <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">{statsByClient.length}</p>
                        <p className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          {selectedMonth ? 'Este Mês' : 'No Período'}
                        </p>
                      </div>
                    </motion.div>
                  </div>

                  {/* Family Lead Time Indicators */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                      { name: 'CCUs', color: 'blue', gradient: 'from-blue-500 to-indigo-600' },
                      { name: 'Tanques de 1500L', color: 'emerald', gradient: 'from-emerald-500 to-teal-600' },
                      { name: 'Tanques de 5000/5200L', color: 'indigo', gradient: 'from-indigo-500 to-purple-600' }
                    ].map((family) => {
                      const stats = statsByFamily.find(s => s.name === family.name);
                      const leadTime = stats ? stats.leadTimeMedio : 0;
                      const count = stats ? stats.quantidade : 0;
                      
                      const colorClasses: Record<string, string> = {
                        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',
                        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
                        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30'
                      };

                      return (
                        <motion.div 
                          key={family.name} 
                          whileHover={{ y: -5 }}
                          className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm card-hover relative group transition-all duration-500 overflow-hidden"
                        >
                          <div className={cn("absolute top-0 left-0 w-full h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500", family.gradient)}></div>
                          <div className="flex items-center justify-between mb-6">
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", colorClasses[family.color].split(' ')[0])}>
                              <Clock className={cn("w-6 h-6", colorClasses[family.color].split(' ')[1])} />
                            </div>
                            <span className={cn("text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-[0.2em] border", colorClasses[family.color])}>
                              Lead Time
                            </span>
                          </div>
                          <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2">{family.name}</p>
                          <div className="flex items-baseline gap-3">
                            <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{leadTime}</p>
                            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">dias</p>
                          </div>
                          <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-800/50 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total OS</span>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-1.5 h-1.5 rounded-full", family.color === 'blue' ? 'bg-blue-500' : family.color === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500')}></div>
                              <span className="text-xs font-black text-slate-900 dark:text-white">{count}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* CCU Subfamilies Breakdown */}
                  {statsBySubFamily.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                            <LayoutGrid className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">Top 5 Eficiência CCUs</h3>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Modelos com menor Lead Time Médio</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setIsCCUModalOpen(true)}
                          className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-slate-100 dark:border-slate-700 shadow-sm active:scale-95"
                        >
                          <Maximize2 className="w-4 h-4" />
                          Ver Detalhes
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {statsBySubFamily.slice(0, 5).map((sub) => (
                          <div 
                            key={sub.name}
                            className="bg-slate-50/50 dark:bg-slate-800/30 p-5 rounded-3xl border border-slate-100 dark:border-slate-800/50 transition-all hover:border-blue-500/30 group"
                          >
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 truncate">{sub.name}</p>
                            <div className="flex items-baseline gap-2">
                              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter group-hover:text-blue-600 transition-colors">{sub.leadTimeMedio}</p>
                              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">dias</p>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full" 
                                  style={{ width: `${Math.min(100, (sub.leadTimeMedio / 15) * 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500">{sub.quantidade} OS</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Volume por Família */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm card-hover relative group transition-all duration-500 overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">Volume por Família</h3>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setExpandedChart('volumeFamily')}
                            className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-blue-600 transition-all opacity-0 group-hover:opacity-100 bg-white/80 dark:bg-slate-900/80 shadow-sm border border-slate-100 dark:border-slate-700"
                          >
                            <Maximize2 className="w-5 h-5" />
                          </button>
                          <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </div>
                      <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={statsByFamily}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                              cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }}
                              itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                            />
                            <Bar dataKey="quantidade" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Lead Time por Família */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm card-hover relative group transition-all duration-500 overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">Lead Time por Família</h3>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setExpandedChart('ltFamily')}
                            className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-amber-600 transition-all opacity-0 group-hover:opacity-100 bg-white/80 dark:bg-slate-900/80 shadow-sm border border-slate-100 dark:border-slate-700"
                          >
                            <Maximize2 className="w-5 h-5" />
                          </button>
                          <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                            <Clock className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </div>
                      <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={statsByFamily.filter(s => s.leadTimeMedio > 0)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                              cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }}
                              itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                            />
                            <Bar dataKey="leadTimeMedio" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={24} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>


                    {/* Volume por Cliente */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm lg:col-span-2 card-hover relative group transition-all duration-500 overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">Volume por Cliente</h3>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setExpandedChart('volumeClient')}
                            className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100 bg-white/80 dark:bg-slate-900/80 shadow-sm border border-slate-100 dark:border-slate-700"
                          >
                            <Maximize2 className="w-5 h-5" />
                          </button>
                          <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </div>
                      <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={statsByClient}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                              interval={0}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                              cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }}
                              itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                            />
                            <Bar dataKey="quantidade" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={24} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Lead Time por Cliente */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm lg:col-span-2 card-hover relative group transition-all duration-500 overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">Lead Time por Cliente</h3>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setExpandedChart('ltClient')}
                            className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-emerald-600 transition-all opacity-0 group-hover:opacity-100 bg-white/80 dark:bg-slate-900/80 shadow-sm border border-slate-100 dark:border-slate-700"
                          >
                            <Maximize2 className="w-5 h-5" />
                          </button>
                          <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                            <Clock className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </div>
                      <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={statsByClient.filter(s => s.leadTimeMedio > 0)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                              interval={0}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                              cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }}
                              itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                            />
                            <Bar dataKey="leadTimeMedio" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm lg:col-span-2 card-hover relative group transition-all duration-500 overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">Evolução Mensal (Concluídas)</h3>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setExpandedChart('evolution')}
                            className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-blue-600 transition-all opacity-0 group-hover:opacity-100 bg-white/80 dark:bg-slate-900/80 shadow-sm border border-slate-100 dark:border-slate-700"
                          >
                            <Maximize2 className="w-5 h-5" />
                          </button>
                          <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </div>
                      <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                              interval={0}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                              itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="liberados" 
                              stroke="#3b82f6" 
                              strokeWidth={4}
                              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4, stroke: theme === 'dark' ? '#0f172a' : '#fff' }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'fleet' ? (
                <FleetManagement
                  equipments={fleetEquipment}
                  historyEntries={fleetHistory}
                  clients={clients}
                  serviceOrders={orders}
                  userRole={effectiveRole}
                  onSaveEquipment={handleSaveFleetEquipment}
                  onDeleteEquipment={handleDeleteFleetEquipment}
                  onRequestDelete={handleOpenDeleteModal}
                  onDeleteAllEquipment={handleDeleteAllFleetEquipment}
                  onAddNonConformity={handleAddFleetNonConformity}
                  onResolveNonConformity={handleResolveFleetNonConformity}
                  onImportConfirmed={handleImportFleetConfirmed}
                  onRecoverConfirmed={handleRecoverUnimportedFleetEquipment}
                />
              ) : activeTab === 'decontamination' ? (
                <DecontaminationManagement
                  operations={decontaminationOperations}
                  fleetEquipments={fleetEquipment}
                  clients={clients}
                  userRole={effectiveRole}
                  onSaveOperation={handleSaveDecontaminationOperation}
                  onDeleteOperation={handleDeleteDecontaminationOperation}
                  onRequestDelete={handleOpenDeleteModal}
                />
              ) : activeTab === 'orders' ? (
                <div className="space-y-6">
                  {/* Equipment Type Global Filters */}
                  <div className="flex flex-wrap items-center gap-3 bg-white/50 dark:bg-slate-900/50 p-4 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-sm">
                    {[
                      { id: 'all', label: 'Todos Equipamentos', icon: <Boxes className="w-4 h-4" /> },
                      { id: 'Tanques de 1500L', label: 'Tanques 1500L', icon: <Container className="w-4 h-4" /> },
                      { id: 'Tanques de 5000/5200L', label: 'Tanques 5000L', icon: <Container className="w-4 h-4" /> },
                      { id: 'CCUs', label: 'CCUs', icon: <LayoutGrid className="w-4 h-4" /> },
                      { id: 'Outros', label: 'Outros', icon: <Package className="w-4 h-4" /> }
                    ].map(filter => (
                      <button
                        key={filter.id}
                        onClick={() => {
                          setOsTypeFilter(filter.id as any);
                          setCurrentPage(1);
                        }}
                        className={cn(
                          "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 border shadow-sm active:scale-95",
                          osTypeFilter === filter.id
                            ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                            : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 hover:border-blue-500/30 hover:text-blue-500"
                        )}
                      >
                        {filter.icon}
                        {filter.label}
                      </button>
                    ))}
                  </div>

                  {/* Sub-tabs, Search and View Toggle */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      {viewMode === 'list' && (
                        <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit border border-slate-200/50 dark:border-slate-700/50">
                          <button
                            onClick={() => setActiveOrderSubTab('in-progress')}
                            className={cn(
                              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                              activeOrderSubTab === 'in-progress'
                                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                          >
                            <Clock className="w-4 h-4" />
                            Em Andamento
                          </button>
                          <button
                            onClick={() => setActiveOrderSubTab('completed')}
                            className={cn(
                              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                              activeOrderSubTab === 'completed'
                                ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Concluídas
                          </button>
                        </div>
                      )}

                      <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit border border-slate-200/50 dark:border-slate-700/50">
                        <button
                          onClick={() => setViewMode('list')}
                          className={cn(
                            "p-2.5 rounded-xl transition-all",
                            viewMode === 'list'
                              ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          )}
                          title="Visualização em Lista"
                        >
                          <List className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewMode('kanban')}
                          className={cn(
                            "p-2.5 rounded-xl transition-all",
                            viewMode === 'kanban'
                              ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          )}
                          title="Visualização em Kanban"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 max-w-md">
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                          type="text"
                          placeholder={viewMode === 'kanban' ? "Pesquisar OS..." : (activeOrderSubTab === 'in-progress' ? "Pesquisar em andamento..." : "Pesquisar concluídas...")}
                          value={viewMode === 'kanban' ? inProgressSearchTerm : (activeOrderSubTab === 'in-progress' ? inProgressSearchTerm : completedSearchTerm)}
                          onChange={(e) => {
                            if (viewMode === 'kanban' || activeOrderSubTab === 'in-progress') {
                              setInProgressSearchTerm(e.target.value);
                            } else {
                              setCompletedSearchTerm(e.target.value);
                            }
                          }}
                          className="block w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const currentSearchTerm = viewMode === 'kanban' ? inProgressSearchTerm : (activeOrderSubTab === 'in-progress' ? inProgressSearchTerm : completedSearchTerm);
                    
                    const allFilteredOrders = (displayOrders || [])
                      .filter(order => {
                        if (!order) return false;
                        const matchesSearch = (order.equipmentNumber || '').toLowerCase().includes(currentSearchTerm.toLowerCase());
                        
                        if (viewMode === 'kanban') return matchesSearch;

                        const matchesStatus = activeOrderSubTab === 'in-progress' 
                          ? order.status !== 'Concluído' 
                          : order.status === 'Concluído';
                        return matchesSearch && matchesStatus;
                      })
                      .sort((a, b) => {
                        // Priority 1: Status (Maintenance first)
                        if (a.status !== b.status) {
                          return a.status === 'Em Manutenção' ? -1 : 1;
                        }
                        
                        // Priority 2: Date (Most recent first)
                        const getSortTime = (order: any) => {
                          // 1. Check updatedAt (serverTimestamp)
                          if (order.updatedAt?.toMillis) return order.updatedAt.toMillis();
                          
                          // 2. If updatedAt is null, it's a very recent update (pending serverTimestamp)
                          // We use a very high timestamp to keep it at the top
                          if (order.updatedAt === null) return Date.now() + 1000000;
                          
                          // 3. Fallback to createdAt
                          if (order.createdAt?.toMillis) return order.createdAt.toMillis();
                          
                          // 4. Fallback to startDate if available
                          if (order.startDate?.toMillis) return order.startDate.toMillis();
                          
                          return 0;
                        };
                        
                        const timeA = getSortTime(a);
                        const timeB = getSortTime(b);
                        
                        // Sort descending (most recent first)
                        return timeB - timeA;
                      });

                    const maintenanceList = allFilteredOrders.filter(o => o.status !== 'Concluído');
                    const completedList = allFilteredOrders.filter(o => o.status === 'Concluído');

                    const totalPages = viewMode === 'kanban' 
                      ? Math.max(Math.ceil(maintenanceList.length / 5), Math.ceil(completedList.length / 5))
                      : Math.ceil(allFilteredOrders.length / ITEMS_PER_PAGE);

                    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                    const kanbanStartIndex = (currentPage - 1) * 5;

                    const paginatedOrders = viewMode === 'kanban'
                      ? [
                          ...maintenanceList.slice(kanbanStartIndex, kanbanStartIndex + 5),
                          ...completedList.slice(kanbanStartIndex, kanbanStartIndex + 5)
                        ]
                      : allFilteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);

                    const totalInMaintenance = maintenanceList.length;
                    const totalCompleted = completedList.length;

                    const renderPagination = () => {
                      if (totalPages <= 1) return null;
                      
                      return (
                        <div className="flex items-center justify-center gap-2 mt-8 pb-10">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={cn(
                                "w-10 h-10 rounded-xl text-xs font-black transition-all",
                                currentPage === page
                                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                              )}
                            >
                              {page}
                            </button>
                          ))}

                          <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      );
                    };
                    const renderKanbanView = (ordersList: ServiceOrder[], counts: { maintenance: number, completed: number }) => {
                      const columns = [
                        { id: 'Em Manutenção', title: 'Em Manutenção', total: counts.maintenance, color: 'bg-blue-50/50 dark:bg-blue-900/10', borderColor: 'border-blue-100 dark:border-blue-900/30', icon: <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" /> },
                        { id: 'Concluído', title: 'Concluído', total: counts.completed, color: 'bg-emerald-50/50 dark:bg-emerald-900/10', borderColor: 'border-emerald-100 dark:border-emerald-900/30', icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> }
                      ];

                      const getColumnId = (status: string) => {
                        if (status === 'Concluído') return 'Concluído';
                        return 'Em Manutenção';
                      };

                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
                          {columns.map(col => {
                            const colOrders = ordersList.filter(o => getColumnId(o.status) === col.id);
                            return (
                              <div key={col.id} className="flex flex-col gap-6">
                                <div className={cn(
                                  "flex items-center justify-between p-6 rounded-[32px] border backdrop-blur-sm transition-all duration-500",
                                  col.color,
                                  col.borderColor
                                )}>
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm border border-white/50 dark:border-slate-800">
                                      {col.icon}
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white leading-none">{col.title}</h4>
                                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">Total Geral: {col.total}</p>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex flex-col gap-4 bg-slate-50/20 dark:bg-slate-900/20 p-4 rounded-[40px] border border-slate-100/50 dark:border-slate-800/50 min-h-[600px] transition-all duration-500">
                                  <AnimatePresence mode="popLayout">
                                    {colOrders.length === 0 ? (
                                      <div className="flex flex-col items-center justify-center py-40 text-slate-300 dark:text-slate-700">
                                        <div className="w-20 h-20 bg-white/50 dark:bg-slate-800/50 rounded-[32px] flex items-center justify-center mb-4 shadow-sm border border-white/50 dark:border-slate-800">
                                          <ClipboardList className="w-10 h-10 opacity-20" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Sem itens nesta página</p>
                                      </div>
                                    ) : colOrders.map(order => {
                                      const client = clients.find(c => c.id === order.clientId);
                                      return (
                                        <motion.div
                                          key={order.id}
                                          layout
                                          initial={{ opacity: 0, y: 20 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          exit={{ opacity: 0, scale: 0.95 }}
                                          className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group relative overflow-hidden"
                                        >
                                          <div className={cn(
                                            "absolute top-0 left-0 w-1.5 h-full transition-opacity duration-500",
                                            order.status === 'Concluído' ? "bg-emerald-500" : "bg-blue-500"
                                          )}></div>
                                          
                                          <div className="flex justify-between items-start mb-4">
                                            <div className="flex flex-col gap-2">
                                              <div className="flex items-center gap-2">
                                                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                                                  {getFamilyIcon(order.family, "w-4 h-4")}
                                                </div>
                                                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-wider">
                                                  #{order.equipmentNumber}
                                                </span>
                                              </div>
                                              {order.priority && (
                                                <div className={cn(
                                                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit border shadow-sm",
                                                  order.priority === 'Baixa' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30" :
                                                  order.priority === 'Alta' ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30" :
                                                  order.priority === 'Urgente' ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30" :
                                                  "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30"
                                                )}>
                                                  {order.priority === 'Urgente' && '🚨 '}{order.priority}
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <button 
                                                onClick={() => handleViewOrder(order)}
                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-all"
                                                title="Visualizar OS (PDF)"
                                              >
                                                <Eye className="w-4 h-4" />
                                              </button>
                                              <button 
                                                onClick={() => handleEditOrder(order)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"
                                                title="Editar OS"
                                              >
                                                <Edit className="w-4 h-4" />
                                              </button>
                                              <button 
                                                onClick={() => generatePDF(order)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all"
                                                title="Baixar PDF"
                                              >
                                                <FileText className="w-4 h-4" />
                                              </button>
                                              {canDelete && (
                                                <button 
                                                  onClick={() => handleDeleteOrder(order.id)}
                                                  className="p-2 text-slate-300 dark:text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
                                                  title="Excluir OS"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <h5 className="text-base font-black text-slate-900 dark:text-white mb-1 truncate tracking-tight">
                                            {client?.razaoSocial || 'Cliente não encontrado'}
                                          </h5>
                                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 truncate">
                                            {order.family} {order.subFamily ? `• ${order.subFamily}` : ''}
                                          </p>

                                          {order.maintenanceScope && (
                                            <div className="mb-6 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 group-hover:bg-white dark:group-hover:bg-slate-800 transition-all">
                                              <p className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-[0.15em] mb-1.5 flex items-center gap-2">
                                                <Wrench className="w-3.5 h-3.5" /> Comando de Serviço
                                              </p>
                                              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 font-medium leading-relaxed italic">
                                                "{order.maintenanceScope}"
                                              </p>
                                            </div>
                                          )}

                                          <div className="mb-4 flex items-center gap-2 px-1">
                                            <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-[9px] uppercase border border-blue-100/30">
                                              {(order.createdBy || 'S').charAt(0)}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                              Aberto por: <span className="text-slate-700 dark:text-slate-300 font-bold">{order.createdBy || 'Sistema'}</span>
                                            </span>
                                          </div>
                                          
                                          <div className="flex items-center justify-between pt-5 border-t border-slate-50 dark:border-slate-800/50">
                                            <div className="flex flex-col gap-1.5">
                                              <div className="flex items-center gap-2 text-slate-400">
                                                <Calendar className="w-4 h-4" />
                                                <span className="text-[11px] font-bold uppercase tracking-tighter">
                                                  {order.startDate?.toDate ? format(order.startDate.toDate(), 'dd/MM/yy') : '-'}
                                                </span>
                                              </div>
                                              {order.status === 'Concluído' && order.endDate && (
                                                <div className="flex flex-col gap-1">
                                                  <div className="flex items-center gap-2 text-emerald-500">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    <span className="text-[11px] font-bold uppercase tracking-tighter">
                                                      {format(order.endDate.toDate(), 'dd/MM/yy')}
                                                    </span>
                                                  </div>
                                                  {order.leadTime !== undefined && order.leadTime !== null && (
                                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                                      <Timer className="w-4 h-4" />
                                                      <span className="text-[10px] font-black uppercase tracking-widest">
                                                        {order.leadTime} {order.leadTime === 1 ? 'dia' : 'dias'}
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                            
                                            <button
                                              onClick={() => handleUpdateStatus(order.id, order.status)}
                                              disabled={updatingStatusId === order.id}
                                              className={cn(
                                                "text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-2xl transition-all shadow-sm active:scale-95 border flex items-center gap-2",
                                                order.status === 'Concluído'
                                                  ? "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600"
                                                  : "bg-blue-600 text-white border-blue-700 hover:bg-blue-700",
                                                updatingStatusId === order.id && "opacity-70 cursor-not-allowed"
                                              )}
                                            >
                                              {updatingStatusId === order.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                              ) : (
                                                order.status === 'Concluído' ? 'Reabrir' : 'Concluir'
                                              )}
                                            </button>
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </AnimatePresence>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    };

                    const renderOrderTable = (ordersList: ServiceOrder[], title: string, icon: React.ReactNode, colorClass: string) => (
                      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/20 dark:hover:shadow-none">
                        <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/10">
                          <div className="flex items-center gap-4">
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", colorClass)}>
                              {icon}
                            </div>
                            <div>
                              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">{title}</h3>
                              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Página {currentPage} de {totalPages || 1}</p>
                            </div>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/50">
                                <th className="px-4 md:px-5 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Prioridade</th>
                                <th className="px-4 md:px-5 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Equipamento</th>
                                <th className="px-4 md:px-5 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Família</th>
                                <th className="px-4 md:px-5 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Cliente</th>
                                <th className="px-4 md:px-5 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Início</th>
                                <th className="px-4 md:px-5 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Fim</th>
                                <th className="px-4 md:px-5 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Tempo</th>
                                <th className="px-4 md:px-5 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Responsável</th>
                                <th className="px-4 md:px-5 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Status</th>
                                <th className="px-4 md:px-5 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {ordersList.length === 0 ? (
                                <tr>
                                  <td colSpan={10} className="px-4 md:px-5 py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-[24px] flex items-center justify-center">
                                        <ClipboardList className="w-8 h-8 text-slate-200 dark:text-slate-700" />
                                      </div>
                                      <p className="text-sm font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Nenhuma ordem encontrada</p>
                                    </div>
                                  </td>
                                </tr>
                              ) : ordersList.map((order) => {
                                const client = clients.find(c => c.id === order.clientId);
                                return (
                                  <tr key={order.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all duration-300">
                                    <td className="px-4 md:px-5 py-4">
                                      {order.priority && (
                                        <div className={cn(
                                          "px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm flex items-center justify-center gap-2 w-fit",
                                          order.priority === 'Baixa' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30" :
                                          order.priority === 'Alta' ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30" :
                                          order.priority === 'Urgente' ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30" :
                                          "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30"
                                        )}>
                                          {order.priority === 'Urgente' && '🚨 '}
                                          {order.priority}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 md:px-5 py-4">
                                      <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-[11px] shadow-inner border border-blue-100/50 dark:border-blue-800/50 flex-shrink-0">
                                          {getFamilyIcon(order.family, "w-5 h-5")}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">#{order.equipmentNumber || '---'}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 md:px-5 py-4">
                                      <div className="flex flex-col gap-1.5">
                                        <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200/50 dark:border-slate-700/50 w-fit">
                                          {order.family}
                                        </span>
                                        {order.subFamily && (
                                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                            {order.subFamily}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 md:px-5 py-4">
                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{client?.razaoSocial || 'Cliente não encontrado'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 md:px-5 py-4">
                                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <Calendar className="w-4 h-4 opacity-50" />
                                        <span className="text-xs font-bold">{order.startDate?.toDate ? format(order.startDate.toDate(), 'dd/MM/yyyy') : '-'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 md:px-5 py-4">
                                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <Calendar className="w-4 h-4 opacity-50" />
                                        <span className="text-xs font-bold">{order.endDate?.toDate ? format(order.endDate.toDate(), 'dd/MM/yyyy') : '-'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 md:px-5 py-4">
                                      {order.status === 'Concluído' && order.leadTime !== null && order.leadTime !== undefined ? (
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                          <Timer className="w-4 h-4 text-blue-500" />
                                          <span className="text-xs font-black uppercase tracking-tight">
                                            {order.leadTime} {order.leadTime === 1 ? 'dia' : 'dias'}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-300 dark:text-slate-700">--</span>
                                      )}
                                    </td>
                                    <td className="px-4 md:px-5 py-4">
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {order.createdBy || 'Sistema'}
                                      </span>
                                    </td>
                                    <td className="px-4 md:px-5 py-4">
                                      <button 
                                        onClick={() => handleUpdateStatus(order.id, order.status)}
                                        disabled={updatingStatusId === order.id}
                                        className={cn(
                                          "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all shadow-sm active:scale-95 border flex items-center gap-2",
                                          order.status === 'Concluído' 
                                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" 
                                            : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30",
                                          updatingStatusId === order.id && "opacity-70 cursor-not-allowed"
                                        )}
                                      >
                                        {updatingStatusId === order.id ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Aguarde
                                          </>
                                        ) : (
                                          order.status === 'Concluído' ? 'Reabrir' : 'Concluir'
                                        )}
                                      </button>
                                    </td>
                                    <td className="px-4 md:px-5 py-4 text-right">
                                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-60 md:group-hover:opacity-100 transition-all duration-300">
                                        <button 
                                          onClick={() => handleViewOrder(order)}
                                          title="Visualizar OS (PDF)"
                                          className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-all"
                                        >
                                          <Eye className="w-5 h-5" />
                                        </button>
                                        <button 
                                          onClick={() => generatePDF(order)}
                                          title="Baixar PDF"
                                          className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"
                                        >
                                          <FileText className="w-5 h-5" />
                                        </button>
                                        <button 
                                          onClick={() => handleEditOrder(order)}
                                          title="Editar OS"
                                          className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all"
                                        >
                                          <Edit className="w-5 h-5" />
                                        </button>
                                        {canDelete && (
                                          <button 
                                            onClick={() => handleDeleteOrder(order.id)}
                                            title="Excluir OS"
                                            className="p-2.5 text-slate-300 dark:text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
                                          >
                                            <Trash2 className="w-5 h-5" />
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
                    );

                    return (
                      <div className="space-y-8">
                        {viewMode === 'list' ? (
                          activeOrderSubTab === 'in-progress' ? (
                            renderOrderTable(
                              paginatedOrders, 
                              "Ordens em Andamento", 
                              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
                              "bg-blue-50 dark:bg-blue-900/30"
                            )
                          ) : (
                            renderOrderTable(
                              paginatedOrders, 
                              "Ordens Concluídas", 
                              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
                              "bg-emerald-50 dark:bg-emerald-900/30"
                            )
                          )
                        ) : (
                          renderKanbanView(paginatedOrders, { maintenance: totalInMaintenance, completed: totalCompleted })
                        )}
                        {renderPagination()}
                      </div>
                    );
                  })()}
                </div>
              ) : activeTab === 'settings' ? (
                <div className="space-y-8">
                  <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden p-10 transition-colors duration-300">
                    <div className="flex items-center gap-4 mb-10">
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                        <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Configurações do Sistema</h3>
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Personalize a identidade visual da sua plataforma</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-10">
                        <div>
                          <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 block">Logo da Empresa</label>
                          <div className="flex flex-col gap-6 p-8 bg-slate-50/50 dark:bg-slate-800/50 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-700 group hover:border-blue-400 transition-all duration-300">
                            <div className="flex items-center justify-center">
                              {logoUrl ? (
                                <div className="relative group/logo">
                                  <img src={logoUrl} alt="Logo Preview" className="max-h-32 object-contain rounded-2xl shadow-xl" referrerPolicy="no-referrer" />
                                  {canDelete && (
                                    <button 
                                      onClick={async () => {
                                        await setDoc(doc(db, 'settings', 'appConfig'), { logoUrl: null }, { merge: true });
                                        await addAuditLog('UPDATE', 'SETTINGS', 'appConfig', 'Removeu logo da empresa');
                                      }}
                                      className="absolute -top-3 -right-3 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover/logo:opacity-100 transition-all hover:scale-110"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="w-32 h-32 bg-white dark:bg-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 border border-slate-100 dark:border-slate-700 shadow-sm">
                                  <ImageIcon className="w-10 h-10 mb-2" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Sem Logo</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col items-center gap-4">
                              <p className="text-xs font-bold text-slate-500 text-center px-4">
                                Recomendado: PNG ou SVG com fundo transparente (máx. 2MB)
                              </p>
                              <label className="cursor-pointer bg-white dark:bg-slate-800 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-500 px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-50 dark:shadow-none active:scale-95 flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                {isSubmitting ? 'Enviando...' : 'Selecionar Imagem'}
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    
                                    if (file.size > 2 * 1024 * 1024) {
                                      setGlobalError('A imagem deve ter no máximo 2MB');
                                      return;
                                    }

                                    setIsSubmitting(true);
                                    const reader = new FileReader();
                                    reader.onloadend = async () => {
                                      try {
                                        const base64 = reader.result as string;
                                        await setDoc(doc(db, 'settings', 'appConfig'), { logoUrl: base64 }, { merge: true });
                                        await addAuditLog('UPDATE', 'SETTINGS', 'appConfig', 'Atualizou logo da empresa');
                                      } catch (error) {
                                        console.error('Error saving logo:', error);
                                        setGlobalError('Erro ao salvar logo');
                                      } finally {
                                        setIsSubmitting(false);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 block">Tema do Sistema</label>
                          <div className="flex gap-4 p-2 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 w-fit">
                            <button
                              onClick={async () => {
                                setTheme('light');
                                await addAuditLog('UPDATE', 'SETTINGS', 'theme', 'Alterou tema para Claro');
                              }}
                              className={cn(
                                "flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all",
                                theme === 'light' 
                                  ? "bg-white text-blue-600 shadow-lg shadow-slate-200" 
                                  : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              <Sun className="w-4 h-4" />
                              Claro
                            </button>
                            <button
                              onClick={async () => {
                                setTheme('dark');
                                await addAuditLog('UPDATE', 'SETTINGS', 'theme', 'Alterou tema para Escuro');
                              }}
                              className={cn(
                                "flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all",
                                theme === 'dark' 
                                  ? "bg-slate-900 text-blue-400 shadow-lg shadow-black/20" 
                                  : "text-slate-400 hover:text-slate-300"
                              )}
                            >
                              <Moon className="w-4 h-4" />
                              Escuro
                            </button>
                          </div>
                        </div>

                        {(currentUserRole === 'admin' || user?.email === "almeidacesar2010@gmail.com") && (
                          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                            <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 block">Ações Administrativas</label>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[32px] border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center justify-between gap-6">
                                <div>
                                  <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Importação de Ativos OEG</h4>
                                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Carregar lista completa de tanques pré-definidos</p>
                                </div>
                                <button
                                  onClick={seedRealEquipments}
                                  disabled={isSubmitting}
                                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 active:scale-95"
                                >
                                  {isSubmitting ? 'Importando...' : 'Iniciar Importação'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                          <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 block">Seu Perfil</label>
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                              <input
                                type="text"
                                value={profileForm.name}
                                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:focus:border-blue-500 rounded-2xl text-sm font-bold transition-all outline-none"
                                placeholder="Seu nome"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome de Usuário (@)</label>
                              <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                                <input
                                  type="text"
                                  value={profileForm.username.startsWith('@') ? profileForm.username.slice(1) : profileForm.username}
                                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                                  className="w-full pl-10 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:focus:border-blue-500 rounded-2xl text-sm font-bold transition-all outline-none"
                                  placeholder="cesar.almeida"
                                />
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                if (!user) return;
                                setIsSubmitting(true);
                                try {
                                  let cleanUsername = profileForm.username.trim();
                                  if (cleanUsername.startsWith('@')) cleanUsername = cleanUsername.slice(1);
                                  
                                  await updateDoc(doc(db, 'users', user.uid), {
                                    name: profileForm.name,
                                    username: cleanUsername
                                  });
                                  await addAuditLog('UPDATE', 'USER', user.uid, `Atualizou próprio perfil: ${profileForm.name}`);
                                  setSuccessMessage('Perfil atualizado com sucesso!');
                                  setTimeout(() => setSuccessMessage(null), 3000);
                                } catch (error) {
                                  console.error('Error updating profile:', error);
                                  setGlobalError('Erro ao atualizar perfil');
                                } finally {
                                  setIsSubmitting(false);
                                }
                              }}
                              disabled={isSubmitting}
                              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 disabled:opacity-50"
                            >
                              {isSubmitting ? 'Salvando...' : 'Salvar Perfil'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-[32px] p-8 border border-blue-100 dark:border-blue-900/30 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
                            <ShieldCheck className="w-5 h-5 text-white" />
                          </div>
                          <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs">Dica de Personalização</h4>
                        </div>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                          A logo enviada será exibida no topo da barra lateral esquerda e nos relatórios PDF gerados pelo sistema. 
                          Para melhores resultados, utilize uma imagem com proporções quadradas ou horizontais curtas.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'audits' ? (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-500">
                    <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg bg-indigo-600 text-white">
                          <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Logs de Auditoria</h3>
                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Histórico completo de ações no sistema</p>
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/50">
                            <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Data/Hora</th>
                            <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Usuário</th>
                            <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Ação</th>
                            <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Entidade</th>
                            <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Detalhes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {auditLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-10 py-20 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-[24px] flex items-center justify-center">
                                    <ClipboardList className="w-8 h-8 text-slate-200 dark:text-slate-700" />
                                  </div>
                                  <p className="text-sm font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Nenhum log encontrado</p>
                                </div>
                              </td>
                            </tr>
                          ) : auditLogs.map((log) => (
                            <tr key={log.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all duration-300">
                              <td className="px-10 py-6">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                  {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss') : '---'}
                                </span>
                              </td>
                              <td className="px-10 py-6">
                                <div className="flex flex-col">
                                  <span className="text-sm font-black text-slate-900 dark:text-white">{log.userName}</span>
                                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{log.userEmail}</span>
                                </div>
                              </td>
                              <td className="px-10 py-6">
                                <span className={cn(
                                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                                  log.action === 'CREATE' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" :
                                  log.action === 'UPDATE' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30" :
                                  "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30"
                                )}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-10 py-6">
                                <span className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                                  {log.entity}
                                </span>
                              </td>
                              <td className="px-10 py-6">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                  {log.details}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'clients' ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-end">
                    <div className="flex items-center gap-4">
                      {isSeeding && (
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest animate-pulse">
                          <div className="w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                          Sincronizando...
                        </div>
                      )}
                      {(currentUserRole === 'admin' || currentUserRole === 'moderator') && (
                        <button 
                          onClick={seedClients}
                          disabled={isSubmitting || isSeeding}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          <UserPlus className="w-4 h-4" />
                          Importar Padrão
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/50">
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Razão Social</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">CNPJ</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Data Cadastro</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-right">Ações</th>
                          </tr>
                        </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {clients.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-20 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                                  <Building2 className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                                </div>
                                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nenhum cliente cadastrado</p>
                              </div>
                            </td>
                          </tr>
                        ) : clients.map((client) => (
                          <tr key={client.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all duration-300">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase shadow-inner">
                                  {client.razaoSocial.charAt(0)}
                                </div>
                                <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{client.razaoSocial}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">{client.cnpj}</span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <Calendar className="w-3.5 h-3.5 opacity-50" />
                                <span className="text-xs font-bold">{client.createdAt?.toDate ? format(client.createdAt.toDate(), 'dd/MM/yyyy') : '-'}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300">
                                {canDelete && (
                                  <button
                                    onClick={() => {
                                      if (!isModerator) {
                                        handleOpenDeleteModal('Cliente', client.id, 'clients', client.razaoSocial);
                                        return;
                                      }
                                      setConfirmModal({
                                        isOpen: true,
                                        title: 'Excluir Cliente',
                                        message: `Tem certeza que deseja excluir o cliente "${client.razaoSocial}"? Esta ação não pode ser desfeita.`,
                                        type: 'danger',
                                        onConfirm: async () => {
                                          try {
                                            // 1. Delete all service orders for this client
                                            const ordersQuery = query(collection(db, 'serviceOrders'), where('clientId', '==', client.id));
                                            const ordersSnapshot = await getDocs(ordersQuery);
                                            
                                            const batch = writeBatch(db);
                                            ordersSnapshot.docs.forEach((doc) => {
                                              batch.delete(doc.ref);
                                            });
                                            
                                            // 2. Delete the client
                                            batch.delete(doc(db, 'clients', client.id));
                                            
                                            await batch.commit();
                                            
                                            await addAuditLog('DELETE', 'CLIENT', client.id, `Excluiu cliente: ${client.razaoSocial} e todas as suas OS`);
                                            setSuccessMessage('Cliente e suas ordens excluídos com sucesso!');
                                            setTimeout(() => setSuccessMessage(null), 3000);
                                          } catch (error) {
                                            console.error('Error deleting client and orders:', error);
                                            setGlobalError('Erro ao excluir cliente e suas ordens.');
                                          } finally {
                                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                          }
                                        }
                                      });
                                    }}
                                    className="p-2.5 text-slate-300 dark:text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
                                  >
                                    <Trash2 className="w-4.5 h-4.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              ) : activeTab === 'equipments' ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">Gestão de Equipamentos</h3>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-2">Ativos físicos e containers registrados</p>
                    </div>
                    {equipments.length === 0 && (
                      <button 
                        onClick={seedRealEquipments}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
                      >
                        <Upload className="w-5 h-5" />
                        {isSubmitting ? 'Importando...' : 'Iniciar Importação em Massa'}
                      </button>
                    )}
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/50">
                            <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Equipamento (Tag)</th>
                            <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Tipo / Família</th>
                            <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Subfamília</th>
                            <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Data de Cadastro</th>
                            <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {equipments.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-10 py-20 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-[24px] flex items-center justify-center">
                                    <Boxes className="w-8 h-8 text-slate-200 dark:text-slate-700" />
                                  </div>
                                  <p className="text-sm font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Nenhum equipamento registrado</p>
                                  <button
                                    onClick={seedRealEquipments}
                                    disabled={isSubmitting}
                                    className="mt-4 px-8 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-indigo-100 dark:border-indigo-800 transition-all hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:scale-95"
                                  >
                                    Verificado: Importar Frota Completa
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : equipments.map((equipment) => (
                            <tr key={equipment.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all duration-300">
                              <td className="px-10 py-6">
                                <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">{equipment.tag}</span>
                              </td>
                              <td className="px-10 py-6">
                                <span className={cn(
                                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors",
                                  equipment.family === 'CCUs' ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30" :
                                  equipment.family.includes('1500') ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30" :
                                  equipment.family.includes('5000') ? "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/30" :
                                  "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800"
                                )}>
                                  {equipment.family}
                                </span>
                              </td>
                              <td className="px-10 py-6">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{equipment.subFamily || 'N/A'}</span>
                              </td>
                              <td className="px-10 py-6">
                                <span className="text-xs font-bold text-slate-400">
                                  {equipment.createdAt?.toDate ? format(equipment.createdAt.toDate(), 'dd/MM/yyyy') : '-'}
                                </span>
                              </td>
                              <td className="px-10 py-6 text-right">
                                {canDelete && (
                                  <button 
                                    onClick={() => handleDeleteEquipment(equipment.id)}
                                    className="p-3 text-slate-300 dark:text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-2xl transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'approvals' ? (
                <PendingApprovals
                  requests={deletionRequests}
                  onApprove={handleApproveDeletionRequest}
                  onReject={handleRejectDeletionRequest}
                />
              ) : (
                <PermissionsManagement
                  appUsers={appUsers}
                  moduleVisibility={moduleVisibility}
                  onUpdateModuleVisibility={handleUpdateModuleVisibility}
                  onUpdateUserRole={handleUpdateUserRole}
                  onUpdateUserFullProfile={handleUpdateUserFullProfile}
                  onDeleteUser={handleDeleteUser}
                  onRequestDelete={handleOpenDeleteModal}
                  activeRolePreview={activeRolePreview}
                  setActiveRolePreview={setActiveRolePreview}
                  currentUserId={user?.uid || ''}
                  currentUserRole={effectiveRole}
                />
              )}
          </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Expanded Chart Modal */}
      <AnimatePresence>
        {expandedChart && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpandedChart(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[95vw] bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col h-[92vh] transition-colors duration-300"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {expandedChart === 'volumeFamily' ? 'Volume Detalhado por Família' :
                     expandedChart === 'volumeClient' ? 'Volume Detalhado por Cliente' :
                     expandedChart === 'ltFamily' ? 'Lead Time Detalhado por Família' :
                     expandedChart === 'ltClient' ? 'Lead Time Detalhado por Cliente' : 'Evolução Mensal Detalhada'}
                  </h3>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Visão ampliada e detalhada dos dados</p>
                </div>
                <button 
                  onClick={() => setExpandedChart(null)}
                  className="p-3 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-2xl transition-all group"
                >
                  <Plus className="w-8 h-8 text-slate-400 rotate-45 group-hover:text-red-500 transition-colors" />
                </button>
              </div>

              <div className="flex-1 p-10 overflow-auto">
                <div className="h-full min-h-[500px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {expandedChart === 'volumeFamily' ? (
                      <BarChart data={statsByFamily}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: 700 }} 
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }}
                          itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                        />
                        <Bar dataKey="quantidade" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={40} />
                      </BarChart>
                    ) : expandedChart === 'volumeClient' ? (
                      <BarChart data={statsByClient}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: 700 }} 
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }}
                          itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                        />
                        <Bar dataKey="quantidade" fill="#6366f1" radius={[10, 10, 0, 0]} barSize={40} />
                      </BarChart>
                    ) : expandedChart === 'ltFamily' ? (
                      <BarChart data={statsByFamily.filter(s => s.leadTimeMedio > 0)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: 700 }} 
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }}
                          itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                        />
                        <Bar dataKey="leadTimeMedio" fill="#f59e0b" radius={[10, 10, 0, 0]} barSize={40} />
                      </BarChart>
                    ) : expandedChart === 'ltClient' ? (
                      <BarChart data={statsByClient.filter(s => s.leadTimeMedio > 0)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: 700 }} 
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }}
                          itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                        />
                        <Bar dataKey="leadTimeMedio" fill="#10b981" radius={[10, 10, 0, 0]} barSize={40} />
                      </BarChart>
                    ) : (
                      <LineChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: 700 }} 
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }}
                          itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                        />
                        <Line type="monotone" dataKey="liberados" stroke="#3b82f6" strokeWidth={6} dot={{ fill: '#3b82f6', strokeWidth: 3, r: 6, stroke: theme === 'dark' ? '#0f172a' : '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center transition-colors duration-300">
                <div className="flex gap-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total de Amostras</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white">{filteredOrders.length} OS</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Média Geral</span>
                    <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                      {Math.round(filteredOrders.reduce((acc, o) => acc + (o.leadTime || 0), 0) / (filteredOrders.filter(o => o.status === 'Concluído').length || 1))} dias
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setExpandedChart(null)}
                  className="px-8 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-xl shadow-slate-200 dark:shadow-none"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-3 md:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsModalOpen(false); setEditingOrder(null); }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "relative w-full bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col",
                modalType === 'os' ? "max-w-6xl xl:max-w-7xl w-full h-[98vh] my-auto" : "max-w-lg"
              )}
            >
              <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/50">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    {modalType === 'os' ? (
                      editingOrder ? `Editar OS #${editingOrder.equipmentNumber}` : 'Nova Ordem de Serviço'
                    ) :
                      modalType === 'client' ? 'Novo Cliente' :
                      modalType === 'equipment' ? 'Novo Equipamento' : 'Novo Acesso'}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                    {modalType === 'os' 
                      ? 'Preenchimento em tempo real idêntico ao documento oficial PDF'
                      : 'Preencha os dados abaixo'}
                  </p>
                </div>

                {modalType === 'os' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => generatePDF(editingOrder || { ...formData, id: 'preview' })}
                      className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border border-blue-200 dark:border-blue-800 shadow-sm cursor-pointer"
                      title="Baixar PDF Oficial"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Baixar PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer"
                      title="Imprimir OS"
                    >
                      <Printer className="w-4 h-4" />
                      <span className="hidden sm:inline">Imprimir</span>
                    </button>
                  </div>
                )}

                <button 
                  onClick={() => { setIsModalOpen(false); setEditingOrder(null); }}
                  className="p-2 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-xl transition-all group cursor-pointer"
                >
                  <Plus className="w-6 h-6 text-slate-400 rotate-45 group-hover:text-red-500 transition-colors" />
                </button>
              </div>

              {modalType === 'os' ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-4 md:p-6 bg-slate-100/80 dark:bg-slate-950/90">
                  <form onSubmit={handleSubmit} className="w-full max-w-[1140px] mx-auto bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-3xl border-2 border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 sm:p-10 md:p-12 space-y-8 font-sans my-1">
                    {/* Document Header Accent Strip */}
                    <div className="h-2.5 bg-slate-800 dark:bg-slate-700 w-full rounded-t -mt-5 sm:-mt-8 md:-mt-12 -mx-5 sm:-mx-8 md:-mx-12 mb-6"></div>

                    {/* Document Top Header */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-4">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center font-black text-xl shadow-md">
                            OS
                          </div>
                        )}
                        <div>
                          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                            RELATÓRIO OPERACIONAL
                          </h2>
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            MANUTENÇÃO, INSPEÇÃO & CONTROLE OPERACIONAL DE ATIVOS
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                            SISTEMA DE GESTÃO DE EQUIPAMENTOS INTEGRADO
                          </p>
                        </div>
                      </div>

                      <div className="px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-w-[260px] shadow-sm space-y-2">
                        <div>
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
                            TAG / IDENTIFICAÇÃO DO ATIVO *
                          </span>
                          <input
                            type="text"
                            required
                            list="equipment-list"
                            value={formData.equipmentNumber}
                            onChange={e => {
                              const val = e.target.value.toUpperCase();
                              const matchedFleet = fleetEquipment.find(fe => (fe.equipmentNumber || '').toUpperCase() === val);
                              const matchedOld = equipments.find(eq => eq.tag.toUpperCase() === val);

                              if (matchedFleet) {
                                // Match in new Fleet Management database
                                const fleetClient = clients.find(c => c.razaoSocial.toUpperCase() === (matchedFleet.clientId || '').toUpperCase());
                                let mappedFamily = 'Outros';
                                if (matchedFleet.type.includes('CCU')) mappedFamily = 'CCUs';
                                else if (matchedFleet.type.includes('1500L')) mappedFamily = 'Tanques de 1500L';
                                else if (matchedFleet.type.includes('5000') || matchedFleet.type.includes('5200')) mappedFamily = 'Tanques de 5000/5200L';

                                setFormData(prev => ({
                                  ...prev,
                                  equipmentNumber: val,
                                  clientId: fleetClient ? fleetClient.id : prev.clientId,
                                  family: mappedFamily,
                                  otherFamily: mappedFamily === 'Outros' ? matchedFleet.type : ''
                                }));
                              } else if (matchedOld) {
                                const isPredefined = ['CCUs', 'Tanques de 1500L', 'Tanques de 5000/5200L'].includes(matchedOld.family);
                                setFormData(prev => ({
                                  ...prev,
                                  equipmentNumber: val,
                                  family: isPredefined ? matchedOld.family : 'Outros',
                                  otherFamily: isPredefined ? '' : matchedOld.family,
                                  subFamily: matchedOld.subFamily || ''
                                }));
                              } else {
                                setFormData(prev => ({ ...prev, equipmentNumber: val }));
                              }
                            }}
                            placeholder="Ex: CCU-001"
                            className="w-full mt-0.5 px-3 py-1.5 text-base font-black uppercase bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <datalist id="equipment-list">
                            {fleetEquipment.map((fe, idx) => (
                              <option key={`fe-${fe.id}-${idx}`} value={fe.equipmentNumber}>
                                {fe.type} | {fe.clientId || 'BASE'}
                              </option>
                            ))}
                            {equipments.map((e, idx) => (
                              <option key={e.id ? `${e.id}-${idx}` : `eq-${e.tag}-${idx}`} value={e.tag}>
                                {e.family} {e.subFamily ? `(${e.subFamily})` : ''}
                              </option>
                            ))}
                          </datalist>

                          {/* Fleet Pending Validation Alert in OS Form */}
                          {(() => {
                            const matchedFleet = fleetEquipment.find(fe => (fe.equipmentNumber || '').trim().toUpperCase() === (formData.equipmentNumber || '').trim().toUpperCase());
                            if (matchedFleet && (matchedFleet.isPendingValidation !== false || matchedFleet.validationStatus === 'pending')) {
                              return (
                                <div className="mt-2.5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-200 text-[11px] font-medium flex items-center justify-between gap-2 shadow-sm">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                                    <span>
                                      <strong>Aviso PCP:</strong> O equipamento <strong>#{matchedFleet.equipmentNumber}</strong> possui <strong>cadastro pendente de validação</strong>.
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsModalOpen(false);
                                      setActiveTab('fleet');
                                    }}
                                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase text-[9px] tracking-wider rounded-lg shrink-0 flex items-center gap-1 active:scale-95 transition-all shadow"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Validar na Frota
                                  </button>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
                              STATUS
                            </span>
                            <select
                              value={formData.status}
                              onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                              className="w-full mt-0.5 px-2 py-1 text-[11px] font-black uppercase bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white cursor-pointer"
                            >
                              <option value="Em Manutenção">EM MANUTENÇÃO</option>
                              <option value="Aguardando Peças">AGUARDANDO PEÇAS</option>
                              <option value="Concluído">CONCLUÍDO</option>
                            </select>
                          </div>

                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
                              PRIORIDADE
                            </span>
                            <select
                              value={formData.priority}
                              onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                              className="w-full mt-0.5 px-2 py-1 text-[11px] font-black uppercase bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white cursor-pointer"
                            >
                              <option value="Baixa">BAIXA</option>
                              <option value="Média">MÉDIA</option>
                              <option value="Alta">ALTA</option>
                              <option value="Urgente">URGENTE</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SEÇÃO I */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-800 dark:bg-slate-300"></span>
                        I. DADOS OPERACIONAIS E DETALHES DO ATIVO
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/90 dark:bg-slate-900/70 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-500 uppercase text-[10px] block">CLIENTE RESTRITO *</label>
                          <select
                            required
                            value={formData.clientId}
                            onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                          >
                            <option value="">SELECIONE UM CLIENTE</option>
                            <option value="na">NÃO DEFINIDO / N/A</option>
                            {clients.map((c, idx) => (
                              <option key={c.id ? `${c.id}-${idx}` : `cl-${idx}`} value={c.id}>{c.razaoSocial}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-500 uppercase text-[10px] block">FAMÍLIA / TIPO DE OS *</label>
                          <div className="flex gap-2">
                            <select
                              required
                              value={formData.family}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === 'Outros') {
                                  setFormData({ ...formData, family: 'Outros', otherFamily: '', subFamily: '' });
                                } else {
                                  setFormData({ ...formData, family: val, otherFamily: '', subFamily: '' });
                                }
                              }}
                              className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                            >
                              <option value="">SELECIONE O TIPO</option>
                              <option value="CCUs">CCUs (Containers & Baskets)</option>
                              <option value="Tanques de 1500L">Tanques de 1500L</option>
                              <option value="Tanques de 5000/5200L">Tanques de 5000/5200L</option>
                              <option value="Outros">Outros Equipamentos</option>
                            </select>

                            {formData.family === 'CCUs' && (
                              <button
                                type="button"
                                onClick={() => setIsSubFamilyModalOpen(true)}
                                className="px-3 py-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-xl font-black text-xs uppercase hover:bg-blue-100 transition-all shrink-0 cursor-pointer"
                              >
                                {formData.subFamily || 'Modelo...'}
                              </button>
                            )}
                          </div>
                          {formData.family === 'CCUs' && !formData.subFamily && (
                            <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mt-1">Seleção obrigatória do modelo CCU</p>
                          )}
                          {formData.family === 'Outros' && (
                            <input
                              type="text"
                              required
                              placeholder="Especifique a família..."
                              value={formData.otherFamily}
                              onChange={e => setFormData({ ...formData, otherFamily: e.target.value })}
                              className="w-full mt-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs uppercase text-slate-900 dark:text-white"
                            />
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-500 uppercase text-[10px] block">Nº DA ESLINGA / CABO DE AÇO</label>
                          <div className="flex items-center gap-2">
                            <div className="inline-flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700 shrink-0">
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, slingCheck: { ...formData.slingCheck, status: 'OK' } })}
                                className={cn("px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer", formData.slingCheck.status === 'OK' ? "bg-emerald-600 text-white" : "text-slate-500")}
                              >OK</button>
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, slingCheck: { ...formData.slingCheck, status: 'NC' } })}
                                className={cn("px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer", formData.slingCheck.status === 'NC' ? "bg-rose-600 text-white" : "text-slate-500")}
                              >NC</button>
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, slingCheck: { ...formData.slingCheck, status: 'NA' } })}
                                className={cn("px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer", formData.slingCheck.status === 'NA' ? "bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900" : "text-slate-500")}
                              >N/A</button>
                            </div>
                            <input
                              type="text"
                              placeholder="Digite o número da eslinga..."
                              value={formData.slingCheck.value}
                              onChange={e => setFormData({ ...formData, slingCheck: { ...formData.slingCheck, value: e.target.value } })}
                              className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs uppercase text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="font-bold text-slate-500 uppercase text-[10px] block">INÍCIO MANUTENÇÃO *</label>
                            <input
                              type="date"
                              required
                              value={formData.startDate}
                              onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-bold text-slate-500 uppercase text-[10px] block">FECHAMENTO (OPCIONAL)</label>
                            <input
                              type="date"
                              value={formData.endDate}
                              onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">RESPONSÁVEIS PELA OS</p>
                          
                          <div className="space-y-1">
                            <label className="font-bold text-slate-500 uppercase text-[10px] block">RESPONSÁVEL PELA ABERTURA DA OS</label>
                            <input
                              type="text"
                              list="app-users-list"
                              placeholder="Nome do responsável pela abertura da OS..."
                              value={formData.createdBy}
                              onChange={e => setFormData({ ...formData, createdBy: e.target.value })}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs uppercase text-slate-900 dark:text-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-bold text-slate-500 uppercase text-[10px] block">EXECUTOR DA MANUTENÇÃO (TÉCNICO)</label>
                            <input
                              type="text"
                              list="app-users-list"
                              placeholder="Nome do técnico executante da manutenção..."
                              value={formData.maintenanceTechnician}
                              onChange={e => setFormData({ ...formData, maintenanceTechnician: e.target.value })}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs uppercase text-slate-900 dark:text-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-bold text-slate-500 uppercase text-[10px] block">RESPONSÁVEL PELO FECHAMENTO DA OS</label>
                            <input
                              type="text"
                              list="app-users-list"
                              placeholder="Nome do responsável pelo fechamento..."
                              value={formData.closedBy}
                              onChange={e => setFormData({ ...formData, closedBy: e.target.value })}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs uppercase text-slate-900 dark:text-white"
                            />
                            <datalist id="app-users-list">
                              {appUsers.map((u, idx) => (
                                <option key={u.id ? `${u.id}-${idx}` : `us-${idx}`} value={u.name} />
                              ))}
                            </datalist>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SEÇÃO II */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-800 dark:bg-slate-300"></span>
                        II. ESCOPO DO SERVIÇO & INSPEÇÃO INICIAL
                      </h3>

                      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-800 dark:bg-slate-800 text-white font-black uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="py-3 px-4">ITEM DE INSPEÇÃO / ROTINA DE SEGURANÇA</th>
                              <th className="py-3 px-4 text-center w-36">STATUS</th>
                              <th className="py-3 px-4">OBSERVAÇÕES / DETALHES</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            <DocInspectionTableRow label="ESTRUTURA PRIMÁRIA" value={formData.primaryStructureCheck} onToggle={(status) => setFormData({...formData, primaryStructureCheck: { ...formData.primaryStructureCheck, status }})} onValueChange={(value) => setFormData({...formData, primaryStructureCheck: { ...formData.primaryStructureCheck, value }})} />
                            <DocInspectionTableRow label="ESTRUTURA SECUNDÁRIA" value={formData.secondaryStructureCheck} onToggle={(status) => setFormData({...formData, secondaryStructureCheck: { ...formData.secondaryStructureCheck, status }})} onValueChange={(value) => setFormData({...formData, secondaryStructureCheck: { ...formData.secondaryStructureCheck, value }})} />
                            <DocInspectionTableRow label="BOLSA DE EMPILHADEIRA" value={formData.damagedBagCheck} onToggle={(status) => setFormData({...formData, damagedBagCheck: { ...formData.damagedBagCheck, status }})} onValueChange={(value) => setFormData({...formData, damagedBagCheck: { ...formData.damagedBagCheck, value }})} />
                            <DocInspectionTableRow label="ESTRUTURA DO FUNDO (SOALHO)" value={formData.bottomCheck} onToggle={(status) => setFormData({...formData, bottomCheck: { ...formData.bottomCheck, status }})} onValueChange={(value) => setFormData({...formData, bottomCheck: { ...formData.bottomCheck, value }})} />
                            <DocInspectionTableRow label="ESTRUTURA DO TETO (COBERTURA)" value={formData.roofCheck} onToggle={(status) => setFormData({...formData, roofCheck: { ...formData.roofCheck, status }})} onValueChange={(value) => setFormData({...formData, roofCheck: { ...formData.roofCheck, value }})} />
                            <DocInspectionTableRow label="PONTOS DE AMARRAÇÃO / OLHAIS" value={formData.tieDownPointCheck} onToggle={(status) => setFormData({...formData, tieDownPointCheck: { ...formData.tieDownPointCheck, status }})} onValueChange={(value) => setFormData({...formData, tieDownPointCheck: { ...formData.tieDownPointCheck, value }})} />
                            <DocInspectionTableRow label="PORTA DE ACESSO" value={formData.doorCheck} onToggle={(status) => setFormData({...formData, doorCheck: { ...formData.doorCheck, status }})} onValueChange={(value) => setFormData({...formData, doorCheck: { ...formData.doorCheck, value }})} />
                            <DocInspectionTableRow label="TAMPA DE INSPEÇÃO / ESCOATILHA" value={formData.lidCheck} onToggle={(status) => setFormData({...formData, lidCheck: { ...formData.lidCheck, status }})} onValueChange={(value) => setFormData({...formData, lidCheck: { ...formData.lidCheck, value }})} />
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* SEÇÃO III - Visível apenas para CCUs */}
                    {(formData.family === 'CCUs' || formData.family === 'CCU' || (formData.family === 'Outros' && formData.otherFamily.toUpperCase().includes('CCU'))) && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-800 dark:bg-slate-300"></span>
                          III. TROCA DE PEÇAS & MANUTENÇÃO DE COMPONENTES
                        </h3>

                        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-800 dark:bg-slate-800 text-white font-black uppercase text-[10px] tracking-wider">
                              <tr>
                                <th className="py-3 px-4">PEÇA / COMPONENTE</th>
                                <th className="py-3 px-4 text-center w-36">STATUS</th>
                                <th className="py-3 px-4">OBSERVAÇÕES / DETALHES</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                              <DocInspectionTableRow label="ALAVANCA DE ACIONAMENTO" value={formData.leverCheck} onToggle={(status) => setFormData({...formData, leverCheck: { ...formData.leverCheck, status }})} onValueChange={(value) => setFormData({...formData, leverCheck: { ...formData.leverCheck, value }})} />
                              <DocInspectionTableRow label="SUPORTE DA ALAVANCA" value={formData.leverSupportCheck} onToggle={(status) => setFormData({...formData, leverSupportCheck: { ...formData.leverSupportCheck, status }})} onValueChange={(value) => setFormData({...formData, leverSupportCheck: { ...formData.leverSupportCheck, value }})} />
                              <DocInspectionTableRow label="REBITE CABEÇA REDONDA" value={formData.roundHeadRivetCheck} onToggle={(status) => setFormData({...formData, roundHeadRivetCheck: { ...formData.roundHeadRivetCheck, status }})} onValueChange={(value) => setFormData({...formData, roundHeadRivetCheck: { ...formData.roundHeadRivetCheck, value }})} />
                              <DocInspectionTableRow label="GARRA DO VARÃO" value={formData.clawCheck} onToggle={(status) => setFormData({...formData, clawCheck: { ...formData.clawCheck, status }})} onValueChange={(value) => setFormData({...formData, clawCheck: { ...formData.clawCheck, value }})} />
                              <DocInspectionTableRow label="RETAINER (RETENTOR)" value={formData.retainerCheck} onToggle={(status) => setFormData({...formData, retainerCheck: { ...formData.retainerCheck, status }})} onValueChange={(value) => setFormData({...formData, retainerCheck: { ...formData.retainerCheck, value }})} />
                              <DocInspectionTableRow label="VARÃO DE FECHAMENTO" value={formData.rodCheck} onToggle={(status) => setFormData({...formData, rodCheck: { ...formData.rodCheck, status }})} onValueChange={(value) => setFormData({...formData, rodCheck: { ...formData.rodCheck, value }})} />
                              <DocInspectionTableRow label="ABRAÇADEIRA DO VARÃO SIMPLES" value={formData.simpleRodSupportCheck} onToggle={(status) => setFormData({...formData, simpleRodSupportCheck: { ...formData.simpleRodSupportCheck, status }})} onValueChange={(value) => setFormData({...formData, simpleRodSupportCheck: { ...formData.simpleRodSupportCheck, value }})} />
                              <DocInspectionTableRow label="ABRAÇADEIRA DO VARÃO ESPECIAL" value={formData.specialRodSupportCheck} onToggle={(status) => setFormData({...formData, specialRodSupportCheck: { ...formData.specialRodSupportCheck, status }})} onValueChange={(value) => setFormData({...formData, specialRodSupportCheck: { ...formData.specialRodSupportCheck, value }})} />
                              <DocInspectionTableRow label="TRAVA DO VARÃO" value={formData.rodLockCheck} onToggle={(status) => setFormData({...formData, rodLockCheck: { ...formData.rodLockCheck, status }})} onValueChange={(value) => setFormData({...formData, rodLockCheck: { ...formData.rodLockCheck, value }})} />
                              <DocInspectionTableRow label="DOBRADIÇA" value={formData.hingeCheck} onToggle={(status) => setFormData({...formData, hingeCheck: { ...formData.hingeCheck, status }})} onValueChange={(value) => setFormData({...formData, hingeCheck: { ...formData.hingeCheck, value }})} />
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SEÇÃO IV - RETRABALHO */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-800 dark:bg-slate-300"></span>
                        {(formData.family === 'CCUs' || formData.family === 'CCU' || (formData.family === 'Outros' && formData.otherFamily.toUpperCase().includes('CCU')))
                          ? 'IV. INDICADOR DE RETRABALHO (CONTROLE DE GARGALOS)'
                          : 'III. INDICADOR DE RETRABALHO (CONTROLE DE GARGALOS)'}
                      </h3>

                      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-800 dark:bg-slate-800 text-white font-black uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="py-3 px-4 w-1/3">MÉTRICA OPERACIONAL</th>
                              <th className="py-3 px-4 text-center w-1/4">EXIGE AJUSTE / EXECUTADO?</th>
                              <th className="py-3 px-4">OBSERVAÇÕES / DIRETRIZES DE REPARO</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            <tr>
                              <td className="py-4 px-4 font-black text-slate-900 dark:text-white uppercase text-[11px] align-top pt-5">
                                RETRABALHO DE SOLDAGEM / PINTURA
                              </td>
                              <td className="py-4 px-3 text-center align-top pt-4 whitespace-nowrap">
                                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, reworkCheck: { ...formData.reworkCheck, status: 'OK' } })}
                                    className={cn(
                                      "px-4 py-1.5 rounded-lg text-xs font-black tracking-wider transition-all cursor-pointer",
                                      formData.reworkCheck.status === 'OK'
                                        ? "bg-amber-500 text-white shadow-md scale-105"
                                        : "text-slate-500 hover:text-amber-600 dark:text-slate-400"
                                    )}
                                  >
                                    SIM
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, reworkCheck: { ...formData.reworkCheck, status: 'NA' } })}
                                    className={cn(
                                      "px-4 py-1.5 rounded-lg text-xs font-black tracking-wider transition-all cursor-pointer",
                                      formData.reworkCheck.status === 'NA' || formData.reworkCheck.status === 'NC'
                                        ? "bg-teal-600 text-white shadow-md scale-105"
                                        : "text-slate-400 hover:text-teal-600 dark:text-slate-400"
                                    )}
                                  >
                                    NÃO
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-3 align-top">
                                <textarea
                                  rows={2}
                                  value={formData.reworkCheck.value || ''}
                                  onChange={(e) => setFormData({ ...formData, reworkCheck: { ...formData.reworkCheck, value: e.target.value } })}
                                  placeholder="Descreva as razões do retrabalho e diretrizes de reparo..."
                                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Signatures & Footer Action Bar */}
                    <div className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-center text-xs">
                        <div className="space-y-2">
                          <div className="border-b-2 border-slate-400 dark:border-slate-600 w-3/4 mx-auto mb-2"></div>
                          <p className="font-black text-slate-900 dark:text-white uppercase">{formData.maintenanceTechnician || '_______________________'}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">EXECUTOR DA MANUTENÇÃO (TÉCNICO)</p>
                        </div>
                        <div className="space-y-2">
                          <div className="border-b-2 border-slate-400 dark:border-slate-600 w-3/4 mx-auto mb-2"></div>
                          <p className="font-black text-slate-900 dark:text-white uppercase">{formData.closedBy || (formData.status === 'Concluído' ? '_______________________' : 'PENDENTE DE FECHAMENTO')}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">RESPONSÁVEL PELO FECHAMENTO</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => { setIsModalOpen(false); setEditingOrder(null); }}
                          className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest rounded-2xl transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-xs cursor-pointer"
                        >
                          Cancelar
                        </button>

                        <button
                          type="button"
                          onClick={() => generatePDF(editingOrder || { ...formData, id: 'preview' })}
                          className="px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-95 text-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Baixar PDF</span>
                        </button>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-[2] min-w-[240px] bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 text-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <CheckSquare className="w-4 h-4" />
                          <span>{isSubmitting ? 'Salvando OS...' : (editingOrder ? 'Atualizar Ordem de Serviço' : 'Salvar Ordem de Serviço')}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              ) : modalType === 'equipment' ? (
                <form onSubmit={handleEquipmentSubmit} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tag / Identificador</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: EQ-001"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 uppercase"
                      value={equipmentForm.tag}
                      onChange={e => setEquipmentForm({...equipmentForm, tag: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo / Família</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white cursor-pointer"
                      value={equipmentForm.family}
                      onChange={e => {
                        const val = e.target.value;
                        setEquipmentForm({...equipmentForm, family: val, otherFamily: '', subFamily: ''});
                      }}
                    >
                      <option value="">Selecione a Família</option>
                      <option value="CCUs">CCUs (Containers & Baskets)</option>
                      <option value="Tanques de 1500L">Tanques de 1500L</option>
                      <option value="Tanques de 5000/5200L">Tanques de 5000/5200L</option>
                      <option value="Outros">Outros Equipamentos</option>
                    </select>
                  </div>
                  
                  {equipmentForm.family === 'Outros' && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Especifique a Família</label>
                      <input
                        required
                        type="text"
                        placeholder="Ex: Geradores"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white"
                        value={equipmentForm.otherFamily}
                        onChange={e => setEquipmentForm({...equipmentForm, otherFamily: e.target.value})}
                      />
                    </div>
                  )}

                  {equipmentForm.family === 'CCUs' && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Subfamília (Modelo)</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white cursor-pointer"
                        value={equipmentForm.subFamily}
                        onChange={e => setEquipmentForm({...equipmentForm, subFamily: e.target.value})}
                      >
                        <option value="">Selecione o Modelo</option>
                        {CCU_SUBFAMILIES.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-blue-100 dark:shadow-none active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSubmitting ? 'Cadastrando...' : 'Cadastrar Equipamento'}
                    </button>
                  </div>
                </form>
              ) : modalType === 'client' ? (
                <form onSubmit={handleClientSubmit} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Razão Social</label>
                    <input
                      required
                      type="text"
                      placeholder="Nome da Empresa"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      value={clientForm.razaoSocial}
                      onChange={e => setClientForm({...clientForm, razaoSocial: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">CNPJ</label>
                    <input
                      required
                      type="text"
                      placeholder="00.000.000/0000-00"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      value={clientForm.cnpj}
                      onChange={e => setClientForm({...clientForm, cnpj: e.target.value})}
                    />
                  </div>
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-blue-100 dark:shadow-none active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSubmitting ? 'Cadastrando...' : 'Cadastrar Cliente'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAccessSubmit} className="p-8 space-y-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl border border-blue-100 dark:border-blue-900/30 mb-4">
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400 leading-relaxed">
                      NOTA: Cadastre o usuário e senha para sua equipe. Eles poderão entrar usando apenas o nome de usuário.
                    </p>
                  </div>

                  {accessError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-red-700 dark:text-red-400 leading-relaxed">
                        {accessError}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input
                      required
                      type="text"
                      placeholder="Nome do Usuário"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      value={accessForm.name}
                      onChange={e => setAccessForm({...accessForm, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Usuário (Login)</label>
                      <input
                        required
                        type="text"
                        placeholder="ex: cesar.oeg"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        value={accessForm.username}
                        onChange={e => setAccessForm({...accessForm, username: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                      <input
                        required
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        value={accessForm.password}
                        onChange={e => setAccessForm({...accessForm, password: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Permissão</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white cursor-pointer"
                      value={accessForm.role}
                      onChange={e => setAccessForm({...accessForm, role: e.target.value as any})}
                    >
                      <option value="user">Usuário</option>
                      <option value="admin">Administrador</option>
                      {user?.email === 'almeidacesar2010@gmail.com' && (
                        <option value="moderator">Moderador</option>
                      )}
                    </select>
                  </div>
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        "w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-blue-100 dark:shadow-none active:scale-[0.98] flex items-center justify-center gap-2",
                        isSubmitting && "opacity-70 cursor-not-allowed"
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : 'Conceder Acesso'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-6",
                  confirmModal.type === 'danger' ? "bg-rose-50 dark:bg-rose-900/20 text-rose-500" : "bg-blue-50 dark:bg-blue-900/20 text-blue-500"
                )}>
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                  {confirmModal.title}
                </h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-950/50 flex items-center gap-3">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 px-6 py-4 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black uppercase tracking-widest text-xs rounded-2xl transition-all border border-slate-200 dark:border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={cn(
                    "flex-1 px-6 py-4 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-lg active:scale-95",
                    confirmModal.type === 'danger' ? "bg-rose-500 hover:bg-rose-600 shadow-rose-200 dark:shadow-none" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none"
                  )}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* SubFamily Selection Modal */}
      <AnimatePresence>
        {isSubFamilyModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSubFamilyModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-800/50"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">Selecionar Modelo CCU</h3>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Escolha uma subfamília</p>
                </div>
                <button 
                  onClick={() => setIsSubFamilyModalOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 gap-2">
                  {CCU_SUBFAMILIES.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => {
                        setFormData({ ...formData, subFamily: sub });
                        setIsSubFamilyModalOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-3 rounded-2xl text-left font-bold text-sm transition-all flex items-center justify-between group",
                        formData.subFamily === sub 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none" 
                          : "hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300"
                      )}
                    >
                      <span>{sub}</span>
                      {formData.subFamily === sub && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setIsSubFamilyModalOpen(false)}
                  className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CCU Details Modal */}
      <AnimatePresence>
        {isCCUModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCCUModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[48px] shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-800/50"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>
              
              <div className="p-10">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                      <LayoutGrid className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Detalhamento Completo CCUs</h3>
                      <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Lead Time Médio por Subfamília</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCCUModalOpen(false)}
                    className="p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-2xl transition-all active:scale-95"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                  {statsBySubFamily.map((sub) => (
                    <div 
                      key={sub.name}
                      className="bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800/50 hover:border-blue-500/30 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate max-w-[150px]">{sub.name}</p>
                        <span className="text-[10px] font-black px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg uppercase tracking-widest">
                          {sub.quantidade} OS
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter group-hover:text-blue-600 transition-colors">{sub.leadTimeMedio}</p>
                        <p className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">dias</p>
                      </div>
                      <div className="mt-5 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (sub.leadTimeMedio / 15) * 100)}%` }}
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800/50 flex justify-end">
                  <button 
                    onClick={() => setIsCCUModalOpen(false)}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all active:scale-95"
                  >
                    Fechar Detalhes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      {user && (
        <ChangePasswordModal
          userId={user.uid}
          userName={appUsers.find(u => u.id === user.uid)?.name || user.displayName || 'Usuário'}
          userUsername={appUsers.find(u => u.id === user.uid)?.username || user.email?.split('@')[0] || 'usuario'}
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          onSuccess={(msg) => {
            setSuccessMessage(msg);
            setTimeout(() => setSuccessMessage(null), 4000);
          }}
        />
      )}

      {/* First Login Password Change Modal */}
      {mustChangePasswordUser && (
        <FirstLoginModal
          userId={mustChangePasswordUser.userId}
          userName={mustChangePasswordUser.userName}
          userEmail={mustChangePasswordUser.userEmail}
          onPasswordChanged={() => {
            setMustChangePasswordUser(null);
            setSuccessMessage("Senha alterada com sucesso! Seu acesso foi liberado.");
            setTimeout(() => setSuccessMessage(null), 4000);
          }}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
