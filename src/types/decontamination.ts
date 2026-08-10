import { Timestamp } from 'firebase/firestore';

export const TANK_CLIENTS = [
  'DORF',
  'CHAMPIONX',
  'SLB',
  'HALLIBURTON',
  'BAKER',
  'REDA',
  'REP',
  'EQUINOR BACALHAU',
  'EQUINOR RAIA',
  'PRIO',
  'HELIX'
] as const;

export type DecontaminationStatus = 'waiting' | 'in_progress' | 'completed';

export interface DecontaminationOperation {
  id: string;
  equipmentNumber: string; // Número do Tanque
  model: string; // Modelo do Tanque (e.g. TANQUE DE 1325L, 1500L, 5000L, 5200L)
  isOegFleet?: boolean; // Tanque pertencente à frota OEG (true = Frota OEG, false = Terceiro)
  client: string; // Cliente
  product: string; // Produto / Conteúdo
  invoiceNumber: string; // Nota Fiscal de Entrada
  arrivalDate: string; // Data de Chegada na Base (YYYY-MM-DD)
  startDate?: string; // Data de Início da Descontaminação (YYYY-MM-DD)
  endDate?: string; // Data de Finalização da Descontaminação (YYYY-MM-DD)
  hasContamination: boolean; // Apresentou contaminação? (true = SIM, false = NÃO)
  status: DecontaminationStatus; // waiting: Aguardando Descontaminação, in_progress: Em Descontaminação, completed: Descontaminado
  notes?: string; // Observações
  userId?: string;
  userName?: string;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
}

export type FilterPeriod = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'semester' | 'year' | 'custom';

export interface DecontaminationFilter {
  period: FilterPeriod;
  customStartDate?: string;
  customEndDate?: string;
  searchTank?: string;
  status?: DecontaminationStatus | 'all';
  client?: string | 'all';
  model?: string | 'all';
  product?: string | 'all';
  hasContamination?: 'all' | 'yes' | 'no';
}
