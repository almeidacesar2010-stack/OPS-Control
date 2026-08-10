import { Timestamp } from 'firebase/firestore';

export type FleetType = 
  | 'CCU' 
  | 'REEFER'
  | 'SPOOLER' 
  | 'TANQUE DE 1325L' 
  | 'TANQUE DE 1500L' 
  | 'TANQUE DE 5000L' 
  | 'TANQUE DE 5200L' 
  | 'ESLINGA' 
  | 'OUTROS';

export type FleetLocation = 'BASE' | 'CLIENTE';

export type FleetStatus = 'Operacional' | 'Em manutenção' | 'Aguardando inspeção' | 'Não conforme' | 'Cadastro Pendente de Validação';

export interface FleetNonConformity {
  id: string;
  description: string;
  date: string;
  resolved: boolean;
  photoUrl?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface FleetEquipment {
  id: string;
  equipmentNumber: string; // Mandatory unique equipment tag/number
  type: FleetType;
  clientId?: string; // Current Client Name/ID
  location?: FleetLocation;
  status?: FleetStatus;
  visualInspectionDate?: string; // YYYY-MM-DD
  nextVisualInspectionDate?: string; // YYYY-MM-DD
  endInspectionDate?: string; // YYYY-MM-DD
  nextEndInspectionDate?: string; // YYYY-MM-DD
  observations?: string;
  nonConformities?: FleetNonConformity[];
  userId?: string;
  isPendingValidation?: boolean; // true if pending validation
  validationStatus?: 'pending' | 'validated';
  validatedAt?: string;
  validatedBy?: string;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
}

export interface FleetHistoryEntry {
  id: string;
  equipmentId: string;
  equipmentNumber: string;
  userName: string;
  userEmail: string;
  timestamp: Timestamp | any;
  field: string;
  oldValue: string;
  newValue: string;
}
