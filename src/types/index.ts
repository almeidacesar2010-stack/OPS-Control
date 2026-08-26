import { Timestamp } from 'firebase/firestore';
import { OperationalChecklistData, ChecklistModelType } from './checklists';

export type UserRole = 'moderator' | 'admin' | 'user';

export type ModuleKey = 
  | 'dashboard' 
  | 'orders' 
  | 'fleet' 
  | 'decontamination' 
  | 'checklists'
  | 'clients' 
  | 'equipments' 
  | 'approvals' 
  | 'access' 
  | 'settings' 
  | 'audits';

export interface RoleVisibility {
  moderator: boolean;
  admin: boolean;
  user: boolean;
}

export type ModuleVisibilityConfig = {
  dashboard: RoleVisibility;
  orders: RoleVisibility;
  fleet: RoleVisibility;
  decontamination: RoleVisibility;
  checklists: RoleVisibility;
  clients: RoleVisibility;
  equipments: RoleVisibility;
};

export interface DeletionRequest {
  id: string;
  requestedBy: string;
  requestedByUid: string;
  userRole: UserRole;
  requestedAt: any;
  itemType: string;
  itemId: string;
  itemCollection: string;
  itemName: string;
  reason: string;
  status: 'Pendente' | 'Aprovada' | 'Rejeitada' | 'Cancelada';
  decidedBy?: string;
  decidedAt?: any;
  rejectionReason?: string;
}

export interface AuditLog {
  id: string;
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'REQUEST_DELETE' | 'APPROVE_DELETE' | 'REJECT_DELETE' | 'APPROVE_OS' | 'PERMISSION_CHANGE';
  module: string;
  targetId: string;
  details: string;
  userName: string;
  userEmail: string;
  userRole: string;
  timestamp: any;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'deletion_request' | 'approval' | 'rejection' | 'permission_change';
  targetRole?: UserRole;
  targetUid?: string;
  read: boolean;
  createdAt: any;
}

export interface Client {
  id: string;
  cnpj: string;
  razaoSocial: string;
  userId: string;
  createdAt: Timestamp;
}

export interface Equipment {
  id?: string;
  tag: string;
  family: string;
  subFamily?: string | null;
  userId?: string;
  createdAt?: any;
}

export * from './fleet';

export interface AppUser {
  id: string;
  email: string;
  username?: string;
  name: string;
  role: UserRole;
  status: 'active' | 'inactive';
  jobTitle?: string; // Cargo do usuário (ex: Inspetor de Qualidade, Engenheiro Mecânico)
  signatureUrl?: string; // Assinatura Digital (PNG com fundo transparente / base64)
  passwordHash?: string;
  mustChangePassword?: boolean;
  isFirstLoginCompleted?: boolean;
  createdAt: any;
  updatedAt?: any;
  lastLoginAt?: any;
}

export interface InspectionCheck {
  status: 'OK' | 'NA' | 'NC';
  value?: string;
}

export interface ServiceOrder {
  id: string;
  equipmentNumber: string;
  family: string;
  subFamily?: string;
  clientId: string;
  startDate: any;
  endDate?: any;
  status: 'Em Manutenção' | 'Concluído';
  priority?: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  maintenanceScope?: string;
  leadTime?: number;
  userId: string;
  createdAt: any;
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
  checklistModel?: ChecklistModelType;
  checklistData?: OperationalChecklistData;
}
