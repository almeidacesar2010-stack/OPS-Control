import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Upload, 
  Trash2, 
  Camera, 
  Tag, 
  Calendar, 
  Building2, 
  MapPin, 
  User as UserIcon, 
  ShieldCheck, 
  Check, 
  Layers
} from 'lucide-react';
import { 
  OperationalChecklistData, 
  ChecklistModelType, 
  CheckStatus, 
  ChecklistOperationalType, 
  ChecklistStatus 
} from '../types/checklists';
import { Client, FleetEquipment, Equipment } from '../types';
import { CHECKLIST_TEMPLATES, createDefaultChecklistData, detectChecklistModel } from '../utils/checklistTemplates';
import { generateOperationalChecklistPDF } from '../utils/generateChecklistPDF';
import { format } from 'date-fns';

interface ChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: OperationalChecklistData) => Promise<void>;
  initialData?: OperationalChecklistData | null;
  clients: Client[];
  equipments: Equipment[];
  fleetEquipment: FleetEquipment[];
  currentUserName: string;
  currentUserJobTitle?: string;
  currentUserSignatureUrl?: string;
  logoUrl?: string | null;
}

const EQUIPMENT_FAMILIES = [
  { label: 'CCU (Containers & Baskets)', value: 'CCU', modelType: 'CCU' as ChecklistModelType },
  { label: 'Tanque 1500 LT', value: 'Tanque 1500 LT', modelType: 'TANQUE_1500' as ChecklistModelType },
  { label: 'Tanque 5000 LT', value: 'Tanque 5000 LT', modelType: 'TANQUE_5000' as ChecklistModelType },
  { label: 'Tanque 5200 LT', value: 'Tanque 5200 LT', modelType: 'TANQUE_5200' as ChecklistModelType },
  { label: 'Container Refrigerado (Reefer)', value: 'Container Refrigerado', modelType: 'REEFER' as ChecklistModelType },
  { label: 'Outros Modelos', value: 'Outros', modelType: 'CCU' as ChecklistModelType }
];

const CHECKLIST_TYPES: ChecklistOperationalType[] = [
  'Entrada',
  'Saída',
  'Periódico / Manutenção',
  'Pré-embarque',
  'Devolução',
  'Outro'
];

export const ChecklistModal: React.FC<ChecklistModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  clients,
  equipments = [],
  fleetEquipment = [],
  currentUserName,
  currentUserJobTitle,
  currentUserSignatureUrl,
  logoUrl
}) => {
  const [formData, setFormData] = useState<OperationalChecklistData>(() => {
    return initialData || createDefaultChecklistData('CCU', {
      inspectorName: currentUserName,
      inspectorJobTitle: currentUserJobTitle || 'TÉCNICO DE INSPEÇÃO',
      inspectorSignatureUrl: currentUserSignatureUrl || ''
    });
  });

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'identification' | 'inspection' | 'photos' | 'finalize'>('identification');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync quando initialData mudar
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData(createDefaultChecklistData('CCU', {
        inspectorName: currentUserName,
        inspectorJobTitle: currentUserJobTitle || 'TÉCNICO DE INSPEÇÃO',
        inspectorSignatureUrl: currentUserSignatureUrl || '',
        inspectionResponsible: currentUserName
      }));
    }
    setValidationError(null);
    setActiveTab('identification');
  }, [initialData, isOpen, currentUserName, currentUserJobTitle, currentUserSignatureUrl]);

  if (!isOpen) return null;

  const currentTemplate = CHECKLIST_TEMPLATES[formData.modelType] || CHECKLIST_TEMPLATES.CCU;

  // Troca de modelo/família de equipamento
  const handleModelChange = (newModelType: ChecklistModelType, familyName?: string) => {
    const newDefault = createDefaultChecklistData(newModelType, {
      ...formData,
      modelType: newModelType,
      equipmentFamily: familyName || formData.equipmentFamily
    });
    setFormData(newDefault);
  };

  // Atualiza item de inspeção
  const handleItemStatusChange = (itemId: string, status: CheckStatus) => {
    const currentItem = formData.items[itemId] || { id: itemId, label: '', category: '', status: 'OK', observation: '' };
    setFormData(prev => ({
      ...prev,
      items: {
        ...prev.items,
        [itemId]: {
          ...currentItem,
          status
        }
      }
    }));
  };

  const handleItemObservationChange = (itemId: string, observation: string) => {
    const currentItem = formData.items[itemId] || { id: itemId, label: '', category: '', status: 'OK', observation: '' };
    setFormData(prev => ({
      ...prev,
      items: {
        ...prev.items,
        [itemId]: {
          ...currentItem,
          observation
        }
      }
    }));
  };

  // Upload e gerenciamento de fotos
  const handlePhotoUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const updatedPhotos = [...formData.photos];
        updatedPhotos[index] = {
          ...updatedPhotos[index],
          photoUrl: reader.result,
          takenAt: format(new Date(), 'dd/MM/yyyy HH:mm')
        };
        setFormData(prev => ({ ...prev, photos: updatedPhotos }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (index: number) => {
    const updatedPhotos = [...formData.photos];
    updatedPhotos[index] = {
      ...updatedPhotos[index],
      photoUrl: undefined,
      takenAt: undefined
    };
    setFormData(prev => ({ ...prev, photos: updatedPhotos }));
  };

  const handlePhotoDescriptionChange = (index: number, description: string) => {
    const updatedPhotos = [...formData.photos];
    updatedPhotos[index] = {
      ...updatedPhotos[index],
      description
    };
    setFormData(prev => ({ ...prev, photos: updatedPhotos }));
  };

  // Helper para seleção de TAG da frota
  const handleSelectEquipmentTag = (tag: string) => {
    const foundFleet = fleetEquipment.find(f => f.equipmentNumber?.toUpperCase() === tag.toUpperCase());
    const foundEquip = equipments.find(e => e.tag?.toUpperCase() === tag.toUpperCase());

    if (foundFleet) {
      const detected = detectChecklistModel(foundFleet.type || '', '', tag);
      const clientObj = clients.find(c => c.id === foundFleet.clientId || c.razaoSocial === foundFleet.clientId);
      
      const newDefault = createDefaultChecklistData(detected, {
        ...formData,
        equipmentTag: foundFleet.equipmentNumber,
        equipmentFamily: foundFleet.type || formData.equipmentFamily,
        equipmentModel: foundFleet.type || formData.equipmentModel,
        clientName: clientObj?.razaoSocial || foundFleet.clientId || formData.clientName,
        clientId: clientObj?.id || formData.clientId,
      });
      setFormData(newDefault);
    } else if (foundEquip) {
      const detected = detectChecklistModel(foundEquip.family || '', foundEquip.subFamily || '', tag);
      const newDefault = createDefaultChecklistData(detected, {
        ...formData,
        equipmentTag: foundEquip.tag,
        equipmentFamily: foundEquip.family || formData.equipmentFamily,
        equipmentModel: foundEquip.subFamily || formData.equipmentModel,
      });
      setFormData(newDefault);
    } else {
      setFormData(prev => ({ ...prev, equipmentTag: tag.toUpperCase() }));
    }
  };

  // Cálculo de não conformidades
  const totalItems = Object.keys(formData.items).length;
  const okCount = Object.values(formData.items).filter(i => i.status === 'OK').length;
  const ncCount = Object.values(formData.items).filter(i => i.status === 'NC').length;
  const naCount = Object.values(formData.items).filter(i => i.status === 'NA').length;
  const isConforme = ncCount === 0;

  // Validação e Salvamento
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validações obrigatórias
    if (!formData.equipmentTag?.trim()) {
      setValidationError('Por favor, informe o Nº / TAG / Identificação do Equipamento.');
      setActiveTab('identification');
      return;
    }
    if (!formData.clientName?.trim()) {
      setValidationError('Por favor, selecione ou informe o Cliente.');
      setActiveTab('identification');
      return;
    }
    if (!formData.inspectionDate?.trim()) {
      setValidationError('Por favor, informe a Data da Inspeção.');
      setActiveTab('identification');
      return;
    }
    if (!formData.inspectorName?.trim()) {
      setValidationError('Por favor, informe o Inspetor / Técnico responsável.');
      setActiveTab('identification');
      return;
    }

    // Valida se itens NC possuem observação
    const ncItemsWithoutObservation = Object.values(formData.items).filter(
      item => item.status === 'NC' && (!item.observation || !item.observation.trim())
    );

    if (ncItemsWithoutObservation.length > 0) {
      setValidationError(`Existem ${ncItemsWithoutObservation.length} item(ns) com Não Conformidade (NC) sem descrição. É obrigatório descrever a não conformidade antes de salvar.`);
      setActiveTab('inspection');
      return;
    }

    try {
      setIsSaving(true);
      const calculatedStatus: ChecklistStatus = ncCount > 0 
        ? 'Reprovado / Com NC' 
        : (formData.status || 'Concluído');

      const payload: OperationalChecklistData = {
        ...formData,
        conforme: isConforme,
        ncCount,
        status: calculatedStatus,
        slingNumber: formData.slingTag || formData.slingNumber || '',
        slingTag: formData.slingTag || formData.slingNumber || '',
        updatedAt: new Date().toISOString()
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar checklist:', err);
      setValidationError(err?.message || 'Erro ao salvar o checklist. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl my-6 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* 1. CABEÇALHO DO MODAL */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              {initialData ? 'Editar Checklist' : 'Novo Checklist'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Preenchimento do checklist operacional
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => generateOperationalChecklistPDF(formData, logoUrl || undefined)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="Gerar / Visualizar PDF"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              <span>Gerar PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BARRA DE NAVEGAÇÃO DE ETAPAS */}
        <div className="px-6 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto bg-white dark:bg-slate-900 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('identification')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'identification'
                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>1. Dados do Checklist & Ativo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inspection')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'inspection'
                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>2. Itens de Inspeção ({okCount} OK • {ncCount} NC)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'photos'
                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>3. Relatório Fotográfico</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('finalize')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'finalize'
                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>4. Status & Assinaturas</span>
          </button>
        </div>

        {/* ALERTA DE ERRO */}
        {validationError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{validationError}</div>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL DO FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          
          {/* TAB 1: IDENTIFICAÇÃO DO CHECKLIST & ESLINGA */}
          {activeTab === 'identification' && (
            <div className="space-y-6">
              
              {/* SEÇÃO 2: DADOS DO CHECKLIST */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm border-b border-slate-200 dark:border-slate-700 pb-2">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>DADOS DO CHECKLIST</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  {/* Tipo de Checklist * */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Tipo de Checklist <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.checklistType}
                      onChange={e => setFormData(prev => ({ ...prev, checklistType: e.target.value as ChecklistOperationalType }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      {CHECKLIST_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  {/* Família / Tipo de Equipamento * */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Família / Tipo de Equipamento <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.equipmentFamily}
                      onChange={e => {
                        const selectedFam = EQUIPMENT_FAMILIES.find(f => f.value === e.target.value);
                        if (selectedFam) {
                          handleModelChange(selectedFam.modelType, selectedFam.value);
                        } else {
                          setFormData(prev => ({ ...prev, equipmentFamily: e.target.value }));
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      {EQUIPMENT_FAMILIES.map(fam => (
                        <option key={fam.value} value={fam.value}>{fam.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Modelo do Equipamento * */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Modelo do Equipamento <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.equipmentModel || ''}
                      onChange={e => setFormData(prev => ({ ...prev, equipmentModel: e.target.value }))}
                      placeholder="Ex: CCU 6', Tanque 1500L, Reefer 20'..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Nº / TAG / Identificação do Equipamento * */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Nº / TAG / Identificação do Equipamento <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.equipmentTag || ''}
                        onChange={e => handleSelectEquipmentTag(e.target.value)}
                        placeholder="Ex: CCU-001, OEGU-500123..."
                        list="fleet-tags-list"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold uppercase focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <datalist id="fleet-tags-list">
                        {fleetEquipment.map(f => (
                          <option key={f.id} value={f.equipmentNumber}>
                            {f.clientId ? `${f.clientId} - ${f.type}` : f.type}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Cliente * */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Cliente <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.clientName || ''}
                        onChange={e => {
                          const val = e.target.value;
                          const foundClient = clients.find(c => c.razaoSocial?.toLowerCase() === val.toLowerCase());
                          setFormData(prev => ({
                            ...prev,
                            clientName: val,
                            clientId: foundClient?.id || prev.clientId
                          }));
                        }}
                        placeholder="Selecione ou digite o cliente..."
                        list="clients-list"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <datalist id="clients-list">
                        {clients.map(c => (
                          <option key={c.id} value={c.razaoSocial} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Data da Inspeção * */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Data da Inspeção <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.inspectionDate || ''}
                      onChange={e => setFormData(prev => ({ ...prev, inspectionDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Local da Inspeção * */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Local da Inspeção <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.inspectionLocation || ''}
                      onChange={e => setFormData(prev => ({ ...prev, inspectionLocation: e.target.value }))}
                      placeholder="Ex: Base Macaé - Pátio 1, Terminal Portuário..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Responsável pela Inspeção * */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Responsável pela Inspeção <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.inspectionResponsible || ''}
                      onChange={e => setFormData(prev => ({ ...prev, inspectionResponsible: e.target.value }))}
                      placeholder="Nome do responsável técnico..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Inspetor / Técnico responsável */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Inspetor / Técnico Responsável <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.inspectorName || ''}
                      onChange={e => setFormData(prev => ({ ...prev, inspectorName: e.target.value }))}
                      placeholder="Nome do inspetor..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                </div>
              </div>

              {/* SEÇÃO 4: DADOS DA ESLINGA */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>DADOS DA ESLINGA / LIFTING SET</span>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.slingApplicable !== false}
                      onChange={e => setFormData(prev => ({ ...prev, slingApplicable: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-slate-700 dark:text-slate-300">Equipamento possui Eslinga</span>
                  </label>
                </div>

                {formData.slingApplicable !== false ? (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {/* Nº / TAG da Eslinga */}
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        Nº / TAG da Eslinga
                      </label>
                      <input
                        type="text"
                        value={formData.slingTag || formData.slingNumber || ''}
                        onChange={e => setFormData(prev => ({ ...prev, slingTag: e.target.value.toUpperCase(), slingNumber: e.target.value.toUpperCase() }))}
                        placeholder="Ex: ESL-9942, SLG-102..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold uppercase focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">Identificação própria e independente do ativo</p>
                    </div>

                    {/* Data da Inspeção da Eslinga */}
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        Data Inspeção da Eslinga
                      </label>
                      <input
                        type="date"
                        value={formData.slingInspectionDate || ''}
                        onChange={e => setFormData(prev => ({ ...prev, slingInspectionDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {/* Validade / Próxima Inspeção */}
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        Validade / Próx. Inspeção
                      </label>
                      <input
                        type="date"
                        value={formData.slingExpirationDate || ''}
                        onChange={e => setFormData(prev => ({ ...prev, slingExpirationDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {/* Status da Eslinga */}
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        Status da Eslinga
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, slingStatus: 'OK' }))}
                          className={`py-2 rounded-lg font-bold text-center transition-colors cursor-pointer ${
                            formData.slingStatus === 'OK'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, slingStatus: 'NC' }))}
                          className={`py-2 rounded-lg font-bold text-center transition-colors cursor-pointer ${
                            formData.slingStatus === 'NC'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          NC
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, slingStatus: 'NA' }))}
                          className={`py-2 rounded-lg font-bold text-center transition-colors cursor-pointer ${
                            formData.slingStatus === 'NA'
                              ? 'bg-slate-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          N/A
                        </button>
                      </div>
                    </div>

                    {/* Observações da Eslinga */}
                    <div className="sm:col-span-4">
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        Observações da Eslinga
                      </label>
                      <input
                        type="text"
                        value={formData.slingNotes || ''}
                        onChange={e => setFormData(prev => ({ ...prev, slingNotes: e.target.value }))}
                        placeholder="Detalhes sobre cabo de aço, olhais, manilhas, lacres ou certificados..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Equipamento configurado sem conjunto de içamento / eslinga.
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('inspection')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
                >
                  Avançar para Itens de Inspeção →
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: ITENS DE INSPEÇÃO (DINÂMICOS POR MODELO) */}
          {activeTab === 'inspection' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                    Template Ativo: {currentTemplate.code}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {currentTemplate.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold rounded">
                    {okCount} OK
                  </span>
                  <span className={`px-2 py-1 font-bold rounded ${
                    ncCount > 0 
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {ncCount} NC
                  </span>
                </div>
              </div>

              {/* RENDERIZAÇÃO DAS SEÇÕES DO MODELO */}
              {currentTemplate.sections.map((section, sIdx) => (
                <div key={section.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center justify-between">
                    <span>{sIdx + 1}. {section.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{section.code}</span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
                    {section.items.map(item => {
                      const itemState = formData.items[item.id] || { id: item.id, label: item.label, category: section.title, status: 'OK', observation: '' };
                      const isNC = itemState.status === 'NC';

                      return (
                        <div key={item.id} className={`p-3 rounded-lg transition-colors space-y-2 ${isNC ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-slate-800 dark:text-slate-200 font-medium flex-1">
                              {item.label}
                            </span>

                            {/* BOTOES OK / NC / NA */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, 'OK')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                  itemState.status === 'OK'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600'
                                }`}
                              >
                                OK
                              </button>

                              <button
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, 'NC')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                  itemState.status === 'NC'
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600'
                                }`}
                              >
                                NC
                              </button>

                              <button
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, 'NA')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                  itemState.status === 'NA'
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700'
                                }`}
                              >
                                N/A
                              </button>
                            </div>
                          </div>

                          {/* CAMPO DE OBSERVAÇÕES / DETALHES */}
                          <div>
                            <input
                              type="text"
                              value={itemState.observation || ''}
                              onChange={e => handleItemObservationChange(item.id, e.target.value)}
                              placeholder={isNC ? "⚠️ OBRIGATÓRIO: Descreva detalhadamente a Não Conformidade..." : "Observações / Detalhes técnicos adicionais..."}
                              className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none transition-all ${
                                isNC
                                  ? 'bg-white dark:bg-slate-900 border border-rose-400 dark:border-rose-700 text-rose-900 dark:text-rose-200 placeholder:text-rose-400 focus:ring-1 focus:ring-rose-500'
                                  : 'bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* TESTE DE ESTANQUEIDADE SE FOR TANQUE */}
              {currentTemplate.hasLeakTestSection && (
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center justify-between">
                    <span>TESTE DE ESTANQUEIDADE / PRESSÃO DO TANQUE</span>
                    <label className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.leakTestApplicable !== false}
                        onChange={e => setFormData(prev => ({ ...prev, leakTestApplicable: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 w-3.5 h-3.5"
                      />
                      <span>Aplicável</span>
                    </label>
                  </div>

                  {formData.leakTestApplicable !== false && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Pressão de Teste (BAR)</label>
                        <input
                          type="text"
                          value={formData.leakTestPressureBar || ''}
                          onChange={e => setFormData(prev => ({ ...prev, leakTestPressureBar: e.target.value }))}
                          placeholder="Ex: 0.5 BAR"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Tempo de Retenção (Minutos)</label>
                        <input
                          type="text"
                          value={formData.leakTestDurationMin || ''}
                          onChange={e => setFormData(prev => ({ ...prev, leakTestDurationMin: e.target.value }))}
                          placeholder="Ex: 10 min"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Resultado do Teste</label>
                        <select
                          value={formData.leakTestStatus || 'OK'}
                          onChange={e => setFormData(prev => ({ ...prev, leakTestStatus: e.target.value as CheckStatus }))}
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
                        >
                          <option value="OK">OK - Aprovado sem vazamentos</option>
                          <option value="NC">NC - Não Conforme / Vazamento</option>
                          <option value="NA">N/A - Não Aplicável</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('identification')}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  ← Voltar para Dados
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('photos')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
                >
                  Avançar para Relatório Fotográfico →
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: RELATÓRIO FOTOGRÁFICO DO CHECKLIST */}
          {activeTab === 'photos' && (
            <div className="space-y-6">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  Relatório Fotográfico Específico do Checklist
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  As fotos registradas pertencem exclusivamente a este checklist de inspeção.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {formData.photos.map((photo, pIdx) => (
                  <div key={photo.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2 flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] block truncate" title={photo.title}>
                        {photo.title}
                      </span>
                      {photo.takenAt && (
                        <span className="text-[10px] text-slate-400 block">{photo.takenAt}</span>
                      )}
                    </div>

                    {photo.photoUrl ? (
                      <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                        <img 
                          src={photo.photoUrl} 
                          alt={photo.title} 
                          className="w-full h-full object-cover" 
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(pIdx)}
                          className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
                          title="Remover Foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-lg aspect-video flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-colors group bg-slate-50/50 dark:bg-slate-800/20">
                        <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-500 mb-1 transition-colors" />
                        <span className="text-[10px] font-medium text-slate-500 group-hover:text-blue-600">
                          Clique ou arraste foto
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handlePhotoUpload(pIdx, e)}
                          className="hidden"
                        />
                      </label>
                    )}

                    <div>
                      <input
                        type="text"
                        value={photo.description || ''}
                        onChange={e => handlePhotoDescriptionChange(pIdx, e.target.value)}
                        placeholder="Legenda / Observação..."
                        className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('inspection')}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  ← Voltar para Itens
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('finalize')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
                >
                  Avançar para Status & Assinaturas →
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: STATUS DO CHECKLIST E ASSINATURAS */}
          {activeTab === 'finalize' && (
            <div className="space-y-6">
              
              {/* STATUS PRÓPRIO DO CHECKLIST */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm border-b border-slate-200 dark:border-slate-700 pb-2">
                  STATUS DO CHECKLIST & PARECER GERAL
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Status da Inspeção
                    </label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as ChecklistStatus }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-semibold outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Em preenchimento">Em preenchimento</option>
                      <option value="Rascunho">Rascunho</option>
                      <option value="Concluído">Concluído</option>
                      <option value="Reprovado / Com NC">Reprovado / Com não conformidades</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Resultado Técnico
                    </label>
                    <div className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2 ${
                      isConforme
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      {isConforme ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>100% Conforme ({okCount} itens conformes)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          <span>{ncCount} Não Conformidade(s) registrada(s)</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Observações Gerais do Checklist
                    </label>
                    <textarea
                      rows={3}
                      value={formData.generalNotes || ''}
                      onChange={e => setFormData(prev => ({ ...prev, generalNotes: e.target.value }))}
                      placeholder="Parecer técnico complementar, orientações para movimentação ou embarque..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* ASSINATURAS E LIBERAÇÃO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* ASSINATURA DO INSPETOR */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    INSPETOR TÉCNICO
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Nome do Inspetor</label>
                    <input
                      type="text"
                      value={formData.inspectorName || ''}
                      onChange={e => setFormData(prev => ({ ...prev, inspectorName: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Cargo / Função</label>
                    <input
                      type="text"
                      value={formData.inspectorJobTitle || ''}
                      onChange={e => setFormData(prev => ({ ...prev, inspectorJobTitle: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  {formData.inspectorSignatureUrl && (
                    <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <span className="text-[10px] text-slate-400 block mb-1">Assinatura Digital Vinculada</span>
                      <img src={formData.inspectorSignatureUrl} alt="Assinatura Inspetor" className="h-10 object-contain" />
                    </div>
                  )}
                </div>

                {/* ASSINATURA DO SUPERVISOR / APROVADOR */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    SUPERVISOR DE QUALIDADE / PCP
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Nome do Supervisor</label>
                    <input
                      type="text"
                      value={formData.approverName || ''}
                      onChange={e => setFormData(prev => ({ ...prev, approverName: e.target.value }))}
                      placeholder="Nome do supervisor responsável..."
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Cargo / Função</label>
                    <input
                      type="text"
                      value={formData.approverJobTitle || ''}
                      onChange={e => setFormData(prev => ({ ...prev, approverJobTitle: e.target.value }))}
                      placeholder="Ex: Supervisor de Qualidade..."
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('photos')}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  ← Voltar para Fotos
                </button>
              </div>
            </div>
          )}

          {/* RODAPÉ DO FORMULÁRIO COM BOTÕES DE AÇÃO */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => generateOperationalChecklistPDF(formData, logoUrl || undefined)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>Gerar PDF</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Salvando...' : 'Salvar Checklist'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
