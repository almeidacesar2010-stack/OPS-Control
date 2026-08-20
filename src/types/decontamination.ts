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
  'HELIX',
  'BRAVA ENERGY'
] as const;

export type DecontaminationStatus = 'waiting' | 'in_progress' | 'completed';

export interface TankCertificateItem {
  description: string;
  equipmentNumber: string;
  product: string;
  decontaminationDate: string;
}

export type InspectionStatus = 'OK' | 'Não OK' | 'N/A';

export interface VisualChecklistState {
  pintura: InspectionStatus;
  corrosao: InspectionStatus;
  danosDeformacoes: InspectionStatus;
  soldas: InspectionStatus;
  conexoes: InspectionStatus;
  valvulas: InspectionStatus;
  olhal: InspectionStatus;
  plaqueta: InspectionStatus;
  bolsaEmpilhadeira: InspectionStatus;
  liftingSet?: InspectionStatus;
}

export type CertificateApprovalStatus = 'pending_approval' | 'approved';

export interface CertificateEditLog {
  editedAt: string; // ISO
  editedByName: string;
  editedById?: string;
  previousApprovalStatus?: CertificateApprovalStatus;
  changesSummary?: string;
}

export interface DecontaminationCertificate {
  id: string;
  reportNumber: string; // Padrão: OEG.XXX.AAAA (ex: OEG.001.2026)
  sequenceNumber?: number; // XXX
  year?: number; // AAAA

  // Dados do Emissor (Automático e Imutável)
  issuerId?: string;
  issuerName: string; // Nome do usuário logado emissor
  issuerJobTitle?: string; // Cargo do emissor
  issuerSignatureUrl?: string; // Imagem da assinatura vinculada do emissor
  issueDate: string; // YYYY-MM-DD
  issueTime?: string; // HH:mm
  issuedAt?: string; // ISO timestamp completo da emissão

  // Dados do Aprovador e Fluxo de Aprovação
  approvalStatus: CertificateApprovalStatus; // 'pending_approval' | 'approved'
  approvedById?: string;
  approvedByName?: string; // Nome do usuário logado que aprovou
  approvedByJobTitle?: string; // Cargo do aprovador
  approvedBySignatureUrl?: string; // Imagem da assinatura digital PNG com fundo transparente
  approvedDate?: string; // YYYY-MM-DD
  approvedTime?: string; // HH:mm
  approvedAt?: string; // ISO timestamp completo da aprovação

  // Compatibilidade com campos legados
  responsibleName?: string;
  approvedBy?: string;

  // Histórico e Auditoria de Edição
  lastEditedByName?: string;
  lastEditedById?: string;
  lastEditedAt?: string; // ISO
  lastEditedDate?: string; // YYYY-MM-DD
  lastEditedTime?: string; // HH:mm
  editCount?: number;
  editHistory?: CertificateEditLog[];

  // Dados Operacionais
  client: string;
  inspectionLocation: string;
  objective?: string; // Objetivo descritivo editável
  tanks: TankCertificateItem[];
  tankCount?: number; // Quantidade de tanques
  checklist: VisualChecklistState;
  generalNotes: string;
  status: 'CONFORME' | 'NÃO CONFORME';
  pdfDataUri?: string; // PDF gerado vinculado ao registro
  pdfFileName?: string; // Nome oficial padronizado do arquivo
  createdAt?: string | any;
  updatedAt?: string | any;
}

export const OBJECTIVE_TEXT = "Registrar serviço de limpeza e descontaminação industrial e garantir conformidade de inspeção do equipamento.";

export const CHECKLIST_ITEMS: { key: keyof VisualChecklistState; label: string; allowNA?: boolean }[] = [
  { key: 'pintura', label: '1. Pintura' },
  { key: 'corrosao', label: '2. Corrosão' },
  { key: 'danosDeformacoes', label: '3. Danos - Deformações' },
  { key: 'soldas', label: '4. Soldas' },
  { key: 'conexoes', label: '5. Conexões' },
  { key: 'valvulas', label: '6. Válvulas' },
  { key: 'olhal', label: '7. Olhal' },
  { key: 'plaqueta', label: '8. Plaqueta' },
  { key: 'bolsaEmpilhadeira', label: '9. Bolsa Empilhadeira' }
];

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
