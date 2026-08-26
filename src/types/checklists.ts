export type ChecklistModelType = 
  | 'CCU' 
  | 'TANQUE_1500' 
  | 'TANQUE_5000' 
  | 'TANQUE_5200'
  | 'REEFER';

export type CheckStatus = 'OK' | 'NC' | 'NA';

export type ChecklistOperationalType = 
  | 'Entrada' 
  | 'Saída' 
  | 'Periódico / Manutenção' 
  | 'Pré-embarque' 
  | 'Devolução' 
  | 'Outro';

export type ChecklistStatus = 
  | 'Rascunho' 
  | 'Em preenchimento' 
  | 'Concluído' 
  | 'Reprovado / Com NC'
  | 'Em Manutenção';

export interface ChecklistItemState {
  id: string;
  label: string;
  category: string;
  status: CheckStatus;
  observation?: string;
  isMandatoryObservationOnNC?: boolean;
}

export interface ChecklistPhotoItem {
  id: string;
  title: string;
  description?: string;
  photoUrl?: string;
  takenAt?: string;
}

export interface OperationalChecklistData {
  id?: string;
  reportNumber?: string;
  
  // 1. DADOS DO CHECKLIST
  checklistType: ChecklistOperationalType;
  equipmentFamily: string; // Ex: 'CCU', 'Tanques de 1500L', 'Tanques de 5000/5200L', 'Container Refrigerado', 'Outros'
  equipmentType?: string;  // Alias for equipmentFamily
  equipmentModel: string;  // Ex: 'CCU 6\'', 'CCU 10\'', 'Tanque 1500 LT', 'Tanque 5000 LT', 'Tanque 5200 LT', 'Reefer 20\''
  subModel?: string;       // Alias for equipmentModel
  modelType: ChecklistModelType;
  modelTitle?: string;
  version?: string;

  equipmentTag: string; // Nº / TAG / Identificação do Equipamento
  clientId?: string;
  clientName: string;
  inspectionDate: string;
  expirationDate?: string;
  inspectionLocation: string;
  inspectionResponsible: string; // Responsável pela inspeção
  inspectorName: string; // Inspetor / Técnico responsável
  inspectorJobTitle?: string;
  inspectorSignatureUrl?: string;
  
  approverName?: string;
  approverJobTitle?: string;
  approverSignatureUrl?: string;

  priority?: string;

  // 2. DADOS DA ESLINGA
  slingApplicable?: boolean;
  slingTag?: string; // Nº / TAG da eslinga (independente do equipamento)
  slingNumber?: string; // Sinônimo para compatibilidade
  slingCertificate?: string;
  slingInspectionDate?: string;
  slingExpirationDate?: string;
  slingStatus?: CheckStatus;
  slingNotes?: string;

  // GPS / Rastreamento (opcional)
  hasGps?: boolean;
  gpsTag?: string;
  gpsStatus?: CheckStatus;
  gpsNotes?: string;

  // 3. CHECKLIST DE INSPEÇÃO (Itens dinâmicos por modelo)
  items: Record<string, ChecklistItemState>;

  // Testes Específicos
  leakTestApplicable?: boolean;
  leakTestPressureBar?: string;
  leakTestDurationMin?: string;
  leakTestStatus?: CheckStatus;
  leakTestNotes?: string;

  dropsCheckStatus?: CheckStatus;
  dropsNotes?: string;

  // Retrabalho
  reworkRequired?: boolean | string;
  reworkScope?: string;
  reworkNotes?: string;

  // 4. FOTOS (Relatório Fotográfico)
  photos: ChecklistPhotoItem[];

  // 5. STATUS E FINALIZAÇÃO
  status: ChecklistStatus;
  generalNotes?: string;
  conforme?: boolean;
  ncCount?: number;

  userId?: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ChecklistSectionDef {
  id: string;
  title: string;
  code: string;
  items: {
    id: string;
    label: string;
    description?: string;
  }[];
}

export interface ChecklistTemplateDef {
  type: ChecklistModelType;
  title: string;
  code: string;
  familyMatch: string[];
  sections: ChecklistSectionDef[];
  defaultPhotos: { id: string; title: string }[];
  hasSlingSection: boolean;
  hasGpsSection: boolean;
  hasLeakTestSection: boolean;
  hasDropsSection: boolean;
  hasPartsReplacementSection: boolean;
}
