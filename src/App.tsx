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
  BarChart3,
  FileText,
  Edit,
  Maximize2,
  X,
  Upload,
  Search,
  Image as ImageIcon,
  Sun,
  Moon,
  Check,
  LayoutGrid,
  List,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Types
interface Client {
  id: string;
  cnpj: string;
  razaoSocial: string;
  userId: string;
  createdAt: Timestamp;
}

interface AppUser {
  id: string;
  email: string;
  username?: string;
  name: string;
  role: 'moderator' | 'admin' | 'user';
  createdAt: Timestamp;
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
  leadTime?: number;
  userId: string;
  createdAt: Timestamp;
}

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'OS' | 'CLIENT' | 'USER' | 'SETTINGS';
  entityId: string;
  details: string;
  timestamp: Timestamp;
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

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'clients' | 'access' | 'settings' | 'audits'>('dashboard');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<'moderator' | 'admin' | 'user'>('user');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'os' | 'client' | 'access'>('os');
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
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inProgressSearchTerm, setInProgressSearchTerm] = useState('');
  const [completedSearchTerm, setCompletedSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeOrderSubTab, setActiveOrderSubTab] = useState<'in-progress' | 'completed'>('in-progress');
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

  // Form States
  const [formData, setFormData] = useState({
    equipmentNumber: '',
    family: '',
    subFamily: '',
    otherFamily: '',
    clientId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    status: 'Em Manutenção' as 'Em Manutenção' | 'Concluído'
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

  const addAuditLog = async (action: 'CREATE' | 'UPDATE' | 'DELETE', entity: 'OS' | 'CLIENT' | 'USER' | 'SETTINGS', entityId: string, details: string) => {
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
    });

    // Clients Listener
    const qClients = collection(db, 'clients');
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      console.log(`Received ${snapshot.docs.length} clients from Firestore`);
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[]);
    }, (error) => {
      console.error("Clients listener error:", error);
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
      });
    }

    return () => {
      unsubOrders();
      unsubClients();
      unsubAudits();
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
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const role = data.role;
        console.log("Current user role updated:", role);
        setCurrentUserRole(role);
        setProfileForm({
          name: data.name || '',
          username: data.username || user.email?.split('@')[0] || ''
        });
      } else {
        // If document doesn't exist and it's not the owner, it means the user was deleted
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
    setIsSubmitting(true);
    setGlobalError(null);
    setLoginError(null);
    
    try {
      if (authForm.username && authForm.password) {
        // Use username as email internally
        const email = authForm.username.includes('@') ? authForm.username : `${authForm.username}@oeg.local`;
        const userCredential = await signInWithEmailAndPassword(auth, email, authForm.password);
        
        // Check if user exists in Firestore immediately
        const userRef = doc(db, 'users', userCredential.user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists() && email !== "almeidacesar2010@gmail.com") {
          await signOut(auth);
          setLoginError('Não existe cadastro para este usuário ou sua conta foi removida.');
          return;
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setLoginError('Usuário ou senha incorretos.');
      } else {
        setLoginError('Erro ao entrar. Verifique seu usuário e senha.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
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

      const orderData = {
        equipmentNumber: formData.equipmentNumber,
        family: finalFamily,
        subFamily: formData.family === 'CCUs' ? formData.subFamily : null,
        clientId: formData.clientId,
        startDate: Timestamp.fromDate(start),
        endDate: end ? Timestamp.fromDate(end) : null,
        status: formData.status,
        leadTime,
        userId: user.uid,
        updatedAt: serverTimestamp()
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
        status: 'Em Manutenção'
      });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving order:', error);
      setGlobalError('Erro ao salvar ordem de serviço. Verifique os dados e tente novamente.');
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'clients');
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

  const handleEditOrder = (order: any) => {
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
      status: order.status || 'Em Manutenção'
    });
    setModalType('os');
    setAccessError(null);
    setIsModalOpen(true);
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
    const client = clients.find(c => c.id === order.clientId);
    const doc = new jsPDF();
    
    // Header with background
    doc.setFillColor(30, 58, 138); // blue-900
    doc.rect(0, 0, 210, 50, 'F');
    
    if (logoUrl) {
      try {
        doc.addImage(logoUrl, 'PNG', 15, 10, 30, 30);
      } catch (e) {
        console.error('Error adding logo to PDF:', e);
      }
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDEM DE SERVIÇO', 105, 25, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('OPS CONTROL - SISTEMA DE GESTÃO OPERACIONAL', 105, 35, { align: 'center' });
    doc.text(`OS #${order.equipmentNumber}`, 105, 42, { align: 'center' });

    // Status Badge
    const statusColor = order.status === 'Concluído' ? [16, 185, 129] : [59, 130, 246];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(160, 15, 35, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(order.status.toUpperCase(), 177.5, 21.5, { align: 'center' });

    // Main Content
    let currentY = 65;

    // Equipment Info Table
    autoTable(doc, {
      startY: currentY,
      head: [['INFORMAÇÕES DO EQUIPAMENTO', '']],
      body: [
        ['Equipamento:', `#${order.equipmentNumber}`],
        ['Família:', order.family],
        ['Status Atual:', order.status]
      ],
      theme: 'plain',
      headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 12 },
      bodyStyles: { fontSize: 10, textColor: [71, 85, 105] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Client Info Table
    autoTable(doc, {
      startY: currentY,
      head: [['INFORMAÇÕES DO CLIENTE', '']],
      body: [
        ['Razão Social:', client?.razaoSocial || 'N/A'],
        ['CNPJ:', client?.cnpj || 'N/A']
      ],
      theme: 'plain',
      headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 12 },
      bodyStyles: { fontSize: 10, textColor: [71, 85, 105] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Timeline Table
    autoTable(doc, {
      startY: currentY,
      head: [['CRONOGRAMA E LEAD TIME', '']],
      body: [
        ['Data de Início:', order.startDate?.toDate ? format(order.startDate.toDate(), 'dd/MM/yyyy') : '-'],
        ['Data de Término:', order.endDate?.toDate ? format(order.endDate.toDate(), 'dd/MM/yyyy') : 'Em andamento'],
        ['Lead Time Total:', order.leadTime !== undefined ? `${order.leadTime} dias` : 'Calculando...']
      ],
      theme: 'plain',
      headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 12 },
      bodyStyles: { fontSize: 10, textColor: [71, 85, 105] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 280, 190, 280);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const now = format(new Date(), 'dd/MM/yyyy HH:mm');
      doc.text(`Documento oficial gerado em ${now} • OPS Control Management System`, 105, 287, { align: 'center' });
      doc.text(`Página ${i} de ${pageCount}`, 190, 287, { align: 'right' });
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

        await updateDoc(orderRef, {
          status: newStatus,
          endDate,
          leadTime: leadTime ?? null,
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
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Ordem de Serviço',
      message: 'Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita.',
      type: 'danger',
      onConfirm: async () => {
        try {
          const orderToDelete = orders.find(o => o.id === id);
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

  // Dashboard Calculations (Strictly by month for stats)
  const filteredOrders = useMemo(() => {
    if (!selectedMonth) return orders;

    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    
    return orders.filter(order => {
      if (!order.startDate?.toDate) return false;
      try {
        const orderDate = order.startDate.toDate();
        return isWithinInterval(orderDate, { start, end });
      } catch (e) {
        console.error("Error parsing order date:", e);
        return false;
      }
    });
  }, [orders, selectedMonth]);

  // UI Display Calculations (Inclusive for Kanban/List)
  const displayOrders = useMemo(() => {
    if (!selectedMonth) return orders;

    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    
    return orders.filter(order => {
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
  }, [orders, selectedMonth]);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, activeOrderSubTab, inProgressSearchTerm, completedSearchTerm, selectedMonth]);

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
            onClick={() => setActiveTab('dashboard')}
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
            <button
              onClick={() => setActiveTab('dashboard')}
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
            <button
              onClick={() => setActiveTab('orders')}
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
            <button
              onClick={() => setActiveTab('clients')}
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
            {(currentUserRole === 'moderator' || user.email === "almeidacesar2010@gmail.com") && (
              <>
                <button
                  onClick={() => setActiveTab('access')}
                  className={cn(
                    "sidebar-item w-full group",
                    activeTab === 'access' ? "sidebar-item-active" : "sidebar-item-inactive"
                  )}
                >
                  <div className={cn("p-2 rounded-xl transition-all duration-300", activeTab === 'access' ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  Acessos
                  {activeTab === 'access' && <motion.div layoutId="active-pill" className="absolute right-4 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
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
                <button
                  onClick={() => setActiveTab('audits')}
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
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all text-[10px] font-black uppercase tracking-[0.2em] border border-transparent hover:border-red-100 dark:hover:border-red-900/30 active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              Sair do Sistema
            </button>
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
                 activeTab === 'clients' ? 'Gestão de Clientes' : 
                 activeTab === 'settings' ? 'Configurações' : 
                 activeTab === 'audits' ? 'Auditoria de Sistema' : 'Gestão de Acessos'}
              </motion.h2>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-5 h-5 rounded-full border-2 border-[#f8fafc] dark:border-[#020617] bg-slate-200 dark:bg-slate-800 animate-pulse" style={{ animationDelay: `${i * 200}ms` }}></div>
                  ))}
                </div>
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                  {activeTab === 'dashboard' 
                    ? 'Performance em tempo real' 
                    : activeTab === 'orders' ? 'Controle operacional' :
                    activeTab === 'clients' ? 'Base de parceiros' :
                    activeTab === 'settings' ? 'Preferências do sistema' :
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
                  
                  {orders.some(o => (o as any).isDemo) && (
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
                      status: 'Em Manutenção'
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
              ) : activeTab === 'orders' ? (
                <div className="space-y-8">
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
                                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-wider">
                                              #{order.equipmentNumber}
                                            </span>
                                            <div className="flex items-center gap-1">
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
                                              <button 
                                                onClick={() => handleDeleteOrder(order.id)}
                                                className="p-2 text-slate-300 dark:text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
                                                title="Excluir OS"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </div>
                                          
                                          <h5 className="text-base font-black text-slate-900 dark:text-white mb-1 truncate tracking-tight">
                                            {client?.razaoSocial || 'Cliente não encontrado'}
                                          </h5>
                                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 truncate">
                                            {order.family} {order.subFamily ? `• ${order.subFamily}` : ''}
                                          </p>
                                          
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
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Equipamento</th>
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Família</th>
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Cliente</th>
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Início</th>
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Fim</th>
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Tempo</th>
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Status</th>
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {ordersList.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-10 py-20 text-center">
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
                                    <td className="px-10 py-6">
                                      <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-[11px] shadow-inner border border-blue-100/50 dark:border-blue-800/50">
                                          #{(order.equipmentNumber || '').slice(-2)}
                                        </div>
                                        <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">#{order.equipmentNumber || '---'}</span>
                                      </div>
                                    </td>
                                    <td className="px-10 py-6">
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
                                    <td className="px-10 py-6">
                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{client?.razaoSocial || 'Cliente não encontrado'}</span>
                                      </div>
                                    </td>
                                    <td className="px-10 py-6">
                                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <Calendar className="w-4 h-4 opacity-50" />
                                        <span className="text-xs font-bold">{order.startDate?.toDate ? format(order.startDate.toDate(), 'dd/MM/yyyy') : '-'}</span>
                                      </div>
                                    </td>
                                    <td className="px-10 py-6">
                                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <Calendar className="w-4 h-4 opacity-50" />
                                        <span className="text-xs font-bold">{order.endDate?.toDate ? format(order.endDate.toDate(), 'dd/MM/yyyy') : '-'}</span>
                                      </div>
                                    </td>
                                    <td className="px-10 py-6">
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
                                    <td className="px-10 py-6">
                                      <button 
                                        onClick={() => handleUpdateStatus(order.id, order.status)}
                                        disabled={updatingStatusId === order.id}
                                        className={cn(
                                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all shadow-sm active:scale-95 border flex items-center gap-2",
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
                                    <td className="px-10 py-6 text-right">
                                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                        <button 
                                          onClick={() => generatePDF(order)}
                                          title="Baixar PDF"
                                          className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-2xl transition-all"
                                        >
                                          <FileText className="w-5 h-5" />
                                        </button>
                                        <button 
                                          onClick={() => handleEditOrder(order)}
                                          title="Editar OS"
                                          className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-2xl transition-all"
                                        >
                                          <Edit className="w-5 h-5" />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteOrder(order.id)}
                                          title="Excluir OS"
                                          className="p-3 text-slate-300 dark:text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-2xl transition-all"
                                        >
                                          <Trash2 className="w-5 h-5" />
                                        </button>
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
                                  <button 
                                    onClick={async () => {
                                      await setDoc(doc(db, 'settings', 'appConfig'), { logoUrl: null }, { merge: true });
                                      await addAuditLog('UPDATE', 'SETTINGS', 'appConfig', 'Removeu logo da empresa');
                                    }}
                                    className="absolute -top-3 -right-3 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover/logo:opacity-100 transition-all hover:scale-110"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
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
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <button
                                  onClick={() => {
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
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-800">
                          <th className="px-6 py-5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nome</th>
                          <th className="px-6 py-5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Usuário (Login)</th>
                          <th className="px-6 py-5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Permissão</th>
                          <th className="px-6 py-5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {appUsers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-20 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                                  <ShieldCheck className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                                </div>
                                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nenhum acesso configurado</p>
                              </div>
                            </td>
                          </tr>
                        ) : appUsers.map((appUser) => (
                          <tr key={appUser.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all duration-200">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-xs uppercase">
                                  {appUser.name.charAt(0)}
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white">{appUser.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {editingUserId === appUser.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingUsername}
                                    onChange={(e) => setEditingUsername(e.target.value)}
                                    className="w-32 px-2 py-1 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-blue-500 rounded-lg outline-none"
                                    autoFocus
                                    onKeyDown={async (e) => {
                                      if (e.key === 'Enter') {
                                        let clean = editingUsername.trim();
                                        if (clean.startsWith('@')) clean = clean.slice(1);
                                        await updateDoc(doc(db, 'users', appUser.id), { username: clean });
                                        setEditingUserId(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingUserId(null);
                                      }
                                    }}
                                  />
                                  <button 
                                    onClick={async () => {
                                      let clean = editingUsername.trim();
                                      if (clean.startsWith('@')) clean = clean.slice(1);
                                      await updateDoc(doc(db, 'users', appUser.id), { username: clean });
                                      setEditingUserId(null);
                                    }}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group/user">
                                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">@{appUser.username || appUser.email.split('@')[0]}</p>
                                  {(currentUserRole === 'moderator' || user?.email === 'almeidacesar2010@gmail.com') && (
                                    <button 
                                      onClick={() => {
                                        setEditingUserId(appUser.id);
                                        setEditingUsername(appUser.username || appUser.email.split('@')[0]);
                                      }}
                                      className="p-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover/user:opacity-100 transition-all"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={async () => {
                                  const isSuperAdmin = user?.email === 'almeidacesar2010@gmail.com';
                                  const isModerator = currentUserRole === 'moderator' || isSuperAdmin;
                                  
                                  if (!isModerator) return;

                                  let newRole: 'moderator' | 'admin' | 'user';
                                  if (appUser.role === 'user') newRole = 'admin';
                                  else if (appUser.role === 'admin') {
                                    // Only super admin can promote to moderator
                                    newRole = isSuperAdmin ? 'moderator' : 'user';
                                  } else {
                                    newRole = 'user';
                                  }

                                  await updateDoc(doc(db, 'users', appUser.id), { role: newRole });
                                  await addAuditLog('UPDATE', 'USER', appUser.id, `Alterou cargo de ${appUser.name} para ${newRole}`);
                                }}
                                className={cn(
                                  "inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95",
                                  appUser.role === 'moderator'
                                    ? "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                                    : appUser.role === 'admin' 
                                      ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50" 
                                      : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                )}
                              >
                                {appUser.role === 'moderator' ? 'Moderador' : appUser.role === 'admin' ? 'Administrador' : 'Usuário'}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={async () => {
                                  const isSuperAdmin = user?.email === 'almeidacesar2010@gmail.com';
                                  const isModerator = currentUserRole === 'moderator' || isSuperAdmin;
                                  if (!isModerator) return;
                                  
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Excluir Acesso',
                                    message: `Tem certeza que deseja excluir o acesso de "${appUser.name}"? Esta ação não pode ser desfeita.`,
                                    type: 'danger',
                                    onConfirm: async () => {
                                      try {
                                        await deleteDoc(doc(db, 'users', appUser.id));
                                        await addAuditLog('DELETE', 'USER', appUser.id, `Excluiu usuário: ${appUser.name}`);
                                        setSuccessMessage('Acesso excluído com sucesso!');
                                        setTimeout(() => setSuccessMessage(null), 3000);
                                      } catch (error) {
                                        console.error('Error deleting user:', error);
                                        setGlobalError('Erro ao excluir acesso.');
                                      } finally {
                                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                      }
                                    }
                                  });
                                }}
                                className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors duration-300"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {modalType === 'os' ? (editingOrder ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço') : 
                     modalType === 'client' ? 'Novo Cliente' : 'Novo Acesso'}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Preencha os dados abaixo</p>
                </div>
                <button 
                  onClick={() => { setIsModalOpen(false); setEditingOrder(null); }}
                  className="p-2 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-xl transition-all group"
                >
                  <Plus className="w-6 h-6 text-slate-400 rotate-45 group-hover:text-red-500 transition-colors" />
                </button>
              </div>

              {modalType === 'os' ? (
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Equipamento</label>
                      <input
                        required
                        type="text"
                        placeholder="Ex: EQ-123"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        value={formData.equipmentNumber}
                        onChange={e => setFormData({...formData, equipmentNumber: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Família</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white cursor-pointer"
                        value={['CCUs', 'Tanques de 1500L', 'Tanques de 5000/5200L', ''].includes(formData.family) ? formData.family : 'Outros'}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'Outros') {
                            setFormData({...formData, family: 'Outros', otherFamily: '', subFamily: ''});
                          } else {
                            setFormData({...formData, family: val, otherFamily: '', subFamily: ''});
                          }
                        }}
                      >
                        <option value="">Selecione a Família</option>
                        <option value="CCUs">CCUs</option>
                        <option value="Tanques de 1500L">Tanques de 1500L</option>
                        <option value="Tanques de 5000/5200L">Tanques de 5000/5200L</option>
                        <option value="Outros">Outros</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Subfamília (Modelo)</label>
                    <button
                      type="button"
                      disabled={formData.family !== 'CCUs'}
                      onClick={() => setIsSubFamilyModalOpen(true)}
                      className={cn(
                        "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-left flex items-center justify-between group",
                        formData.family !== 'CCUs' ? "opacity-40 cursor-not-allowed text-slate-400" : "text-slate-900 dark:text-white hover:border-blue-500/50"
                      )}
                    >
                      <span className="truncate">
                        {formData.subFamily || (formData.family === 'CCUs' ? 'Selecionar Modelo' : 'Não aplicável')}
                      </span>
                      <LayoutGrid className={cn(
                        "w-4 h-4 transition-colors",
                        formData.family === 'CCUs' ? "text-blue-500" : "text-slate-300 dark:text-slate-700"
                      )} />
                    </button>
                    {formData.family === 'CCUs' && !formData.subFamily && (
                      <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest ml-1">Seleção obrigatória para CCUs</p>
                    )}
                  </div>

                  {formData.family === 'Outros' && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Especifique a Família</label>
                      <input
                        required
                        type="text"
                        placeholder="Ex: Torno"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        value={formData.otherFamily}
                        onChange={e => setFormData({...formData, otherFamily: e.target.value})}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Cliente</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white cursor-pointer"
                      value={formData.clientId}
                      onChange={e => setFormData({...formData, clientId: e.target.value})}
                    >
                      <option value="">Selecione um cliente</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.razaoSocial}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Início da Manutenção</label>
                      <input
                        required
                        type="date"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white"
                        value={formData.startDate}
                        onChange={e => setFormData({...formData, startDate: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Fim (Opcional)</label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white"
                        value={formData.endDate}
                        onChange={e => setFormData({...formData, endDate: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Status Inicial</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold text-slate-900 dark:text-white cursor-pointer"
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="Em Manutenção">Em Manutenção</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-blue-100 dark:shadow-none active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSubmitting ? 'Salvando...' : (editingOrder ? 'Atualizar Ordem de Serviço' : 'Salvar Ordem de Serviço')}
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
    </div>
  );
}
