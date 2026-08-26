import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  Camera, 
  Trash2, 
  FileText, 
  Upload, 
  AlertTriangle,
  ShieldCheck,
  Tag,
  Calendar,
  Layers,
  Wrench,
  Navigation,
  Gauge
} from 'lucide-react';
import { OperationalChecklistData, CheckStatus, ChecklistModelType } from '../types/checklists';
import { CHECKLIST_TEMPLATES } from '../utils/checklistTemplates';
import { generateOperationalChecklistPDF } from '../utils/generateChecklistPDF';
import { cn } from '../lib/utils';

interface ChecklistRendererProps {
  data: OperationalChecklistData;
  onChange: (updated: OperationalChecklistData) => void;
  onSave?: () => void;
  onPrintPDF?: () => void;
  isSaving?: boolean;
  isSubmitting?: boolean;
  canEdit?: boolean;
  isReadOnly?: boolean;
  logoUrl?: string;
  clients?: any[];
  equipments?: any[];
  fleetEquipment?: any[];
  currentUser?: any;
  currentUserName?: string;
  currentUserRole?: string;
  currentUserSignatureUrl?: string;
  currentUserJobTitle?: string;
}

export const ChecklistRenderer: React.FC<ChecklistRendererProps> = ({
  data,
  onChange,
  onSave,
  onPrintPDF,
  isSaving = false,
  isSubmitting = false,
  canEdit = true,
  isReadOnly = false,
  logoUrl,
  clients = [],
  equipments = [],
  fleetEquipment = [],
  currentUser,
  currentUserName,
  currentUserRole,
  currentUserSignatureUrl,
  currentUserJobTitle
}) => {
  const effectiveCanEdit = canEdit && !isReadOnly;
  const [activeTab, setActiveTab] = useState<'inspection' | 'special' | 'photos' | 'signatures'>('inspection');
  const template = CHECKLIST_TEMPLATES[data.modelType] || CHECKLIST_TEMPLATES.CCU;

  const handleItemStatusChange = (itemId: string, status: CheckStatus) => {
    if (!effectiveCanEdit) return;
    const currentItem = data.items[itemId] || { id: itemId, label: '', category: '', status: 'OK', observation: '' };
    onChange({
      ...data,
      items: {
        ...data.items,
        [itemId]: {
          ...currentItem,
          status
        }
      }
    });
  };

  const handleItemObservationChange = (itemId: string, observation: string) => {
    if (!effectiveCanEdit) return;
    const currentItem = data.items[itemId] || { id: itemId, label: '', category: '', status: 'OK', observation: '' };
    onChange({
      ...data,
      items: {
        ...data.items,
        [itemId]: {
          ...currentItem,
          observation
        }
      }
    });
  };

  const handlePhotoChange = (index: number, field: 'photoUrl' | 'description', value: string) => {
    if (!effectiveCanEdit) return;
    const updatedPhotos = [...data.photos];
    updatedPhotos[index] = {
      ...updatedPhotos[index],
      [field]: value
    };
    onChange({
      ...data,
      photos: updatedPhotos
    });
  };

  const handleFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!effectiveCanEdit || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handlePhotoChange(index, 'photoUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Count metrics
  const totalItems = Object.keys(data.items).length;
  const okCount = Object.values(data.items).filter(i => i.status === 'OK').length;
  const ncCount = Object.values(data.items).filter(i => i.status === 'NC').length;
  const naCount = Object.values(data.items).filter(i => i.status === 'NA').length;

  return (
    <div className="space-y-6">
      {/* Model Indicator & Quick Stats Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider">
              {template.code}
            </span>
            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">
              MODELO VINCULADO AO ATIVO
            </span>
          </div>
          <h2 className="text-lg font-black tracking-tight mt-1 text-white uppercase">
            {template.title}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <span className="text-xs font-bold text-emerald-400">{okCount} OK</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
            <span className="text-xs font-bold text-rose-400">{ncCount} NC</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
            <span className="text-xs font-bold text-slate-300">{naCount} N/A</span>
          </div>

          <button
            type="button"
            onClick={() => generateOperationalChecklistPDF(data, logoUrl)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md active:scale-95 cursor-pointer ml-2"
          >
            <FileText className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('inspection')}
          className={cn(
            "px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
            activeTab === 'inspection'
              ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
          )}
        >
          <Layers className="w-4 h-4" />
          <span>Itens de Inspeção ({totalItems})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('special')}
          className={cn(
            "px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
            activeTab === 'special'
              ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
          )}
        >
          <Gauge className="w-4 h-4" />
          <span>Testes, Eslinga & Drops</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('photos')}
          className={cn(
            "px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
            activeTab === 'photos'
              ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
          )}
        >
          <Camera className="w-4 h-4" />
          <span>Relatório Fotográfico ({data.photos?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('signatures')}
          className={cn(
            "px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
            activeTab === 'signatures'
              ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
          )}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Assinaturas e Liberação</span>
        </button>
      </div>

      {/* TAB 1: INSPECTION ITEMS */}
      {activeTab === 'inspection' && (
        <div className="space-y-6">
          {template.sections.map((section, sIdx) => (
            <div key={section.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-black flex items-center justify-center">
                    {sIdx + 1}
                  </span>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {section.title}
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {section.items.length} ITENS
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-4 w-5/12">Item de Inspeção</th>
                      <th className="py-2.5 px-4 text-center w-36">Status</th>
                      <th className="py-2.5 px-4">Observações / Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {section.items.map(item => {
                      const current = data.items[item.id] || { id: item.id, label: item.label, category: section.title, status: 'OK', observation: '' };
                      const isNC = current.status === 'NC';

                      return (
                        <tr key={item.id} className={cn("transition-colors", isNC && "bg-rose-50/30 dark:bg-rose-950/10")}>
                          <td className="py-3 px-4 align-top">
                            <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                              {item.label}
                            </div>
                            {item.description && (
                              <p className="text-[10px] text-slate-400 mt-0.5">{item.description}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center align-top whitespace-nowrap">
                            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                              <button
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, 'OK')}
                                className={cn(
                                  "px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer",
                                  current.status === 'OK'
                                    ? "bg-teal-600 text-white shadow-sm"
                                    : "text-slate-500 hover:text-teal-600"
                                )}
                              >
                                OK
                              </button>
                              <button
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, 'NC')}
                                className={cn(
                                  "px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer",
                                  current.status === 'NC'
                                    ? "bg-rose-600 text-white shadow-sm"
                                    : "text-slate-500 hover:text-rose-600"
                                )}
                              >
                                NC
                              </button>
                              <button
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, 'NA')}
                                className={cn(
                                  "px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer",
                                  current.status === 'NA'
                                    ? "bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                N/A
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 align-top">
                            <input
                              type="text"
                              disabled={!effectiveCanEdit}
                              value={current.observation || ''}
                              onChange={e => handleItemObservationChange(item.id, e.target.value)}
                              placeholder={isNC ? "OBRIGATÓRIO: Descreva a não conformidade identificada..." : "Observações opcionais..."}
                              className={cn(
                                "w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs text-slate-900 dark:text-white uppercase outline-none transition-all",
                                isNC 
                                  ? (current.observation?.trim() ? "border-rose-400 dark:border-rose-700 focus:ring-2 focus:ring-rose-500" : "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 focus:ring-2 focus:ring-rose-500")
                                  : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                              )}
                            />
                            {isNC && !current.observation?.trim() && (
                              <p className="text-[9px] font-bold text-rose-500 mt-1 uppercase tracking-wider flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Justificativa obrigatória para itens NC
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: SPECIAL SECTIONS (ESLINGA, GPS, LEAK TEST, DROPS, RETRABALHO) */}
      {activeTab === 'special' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Eslinga / Lifting Set */}
          {template.hasSlingSection && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-black">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase">Eslinga / Conjunto de Içamento</h4>
                    <p className="text-[10px] text-slate-400">Lifting Set 4 Pernas / Cabos</p>
                  </div>
                </div>

                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => onChange({ ...data, slingStatus: 'OK' })}
                    className={cn("px-2 py-1 text-[10px] font-black rounded-lg", data.slingStatus === 'OK' ? "bg-teal-600 text-white" : "text-slate-500")}
                  >OK</button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...data, slingStatus: 'NC' })}
                    className={cn("px-2 py-1 text-[10px] font-black rounded-lg", data.slingStatus === 'NC' ? "bg-rose-600 text-white" : "text-slate-500")}
                  >NC</button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...data, slingStatus: 'NA' })}
                    className={cn("px-2 py-1 text-[10px] font-black rounded-lg", data.slingStatus === 'NA' ? "bg-slate-700 text-white" : "text-slate-400")}
                  >N/A</button>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-500 text-[10px] uppercase block">Número da Eslinga</label>
                  <input
                    type="text"
                    disabled={!effectiveCanEdit}
                    placeholder="Ex: ESL-8849-24"
                    value={data.slingNumber || ''}
                    onChange={e => onChange({ ...data, slingNumber: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-500 text-[10px] uppercase block">Certificado</label>
                    <input
                      type="text"
                      disabled={!effectiveCanEdit}
                      placeholder="Nº Certificado..."
                      value={data.slingCertificate || ''}
                      onChange={e => onChange({ ...data, slingCertificate: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-500 text-[10px] uppercase block">Validade</label>
                    <input
                      type="date"
                      disabled={!effectiveCanEdit}
                      value={data.slingExpirationDate || ''}
                      onChange={e => onChange({ ...data, slingExpirationDate: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Teste de Estanqueidade (Tanques) */}
          {template.hasLeakTestSection && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center font-black">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase">Teste de Estanqueidade</h4>
                    <p className="text-[10px] text-slate-400">Ensaio de Pressão e Vedação</p>
                  </div>
                </div>

                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => onChange({ ...data, leakTestStatus: 'OK' })}
                    className={cn("px-2 py-1 text-[10px] font-black rounded-lg", data.leakTestStatus === 'OK' ? "bg-teal-600 text-white" : "text-slate-500")}
                  >OK</button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...data, leakTestStatus: 'NC' })}
                    className={cn("px-2 py-1 text-[10px] font-black rounded-lg", data.leakTestStatus === 'NC' ? "bg-rose-600 text-white" : "text-slate-500")}
                  >NC</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-500 text-[10px] uppercase block">Pressão de Teste (BAR)</label>
                  <input
                    type="text"
                    disabled={!effectiveCanEdit}
                    placeholder="Ex: 0.5"
                    value={data.leakTestPressureBar || ''}
                    onChange={e => onChange({ ...data, leakTestPressureBar: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 text-[10px] uppercase block">Tempo de Teste (MIN)</label>
                  <input
                    type="text"
                    disabled={!effectiveCanEdit}
                    placeholder="Ex: 10"
                    value={data.leakTestDurationMin || ''}
                    onChange={e => onChange({ ...data, leakTestDurationMin: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="font-bold text-slate-500 text-[10px] uppercase block">Parecer do Teste</label>
                  <input
                    type="text"
                    disabled={!effectiveCanEdit}
                    placeholder="Ex: Estanqueidade 100% conforme sem vazamentos"
                    value={data.leakTestNotes || ''}
                    onChange={e => onChange({ ...data, leakTestNotes: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* GPS / Rastreamento */}
          {template.hasGpsSection && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center font-black">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase">GPS / Rastreamento</h4>
                    <p className="text-[10px] text-slate-400">Dispositivo Telemático</p>
                  </div>
                </div>

                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => onChange({ ...data, gpsStatus: 'OK', hasGps: true })}
                    className={cn("px-2 py-1 text-[10px] font-black rounded-lg", data.gpsStatus === 'OK' ? "bg-teal-600 text-white" : "text-slate-500")}
                  >OK</button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...data, gpsStatus: 'NC', hasGps: true })}
                    className={cn("px-2 py-1 text-[10px] font-black rounded-lg", data.gpsStatus === 'NC' ? "bg-rose-600 text-white" : "text-slate-500")}
                  >NC</button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...data, gpsStatus: 'NA', hasGps: false })}
                    className={cn("px-2 py-1 text-[10px] font-black rounded-lg", data.gpsStatus === 'NA' ? "bg-slate-700 text-white" : "text-slate-400")}
                  >N/A</button>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-500 text-[10px] uppercase block">ID / Tag do GPS</label>
                  <input
                    type="text"
                    disabled={!effectiveCanEdit}
                    placeholder="Ex: GPS-TNK-9921"
                    value={data.gpsTag || ''}
                    onChange={e => onChange({ ...data, gpsTag: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Drops (Partes Soltas) */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center font-black">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase">Inspeção de Drops</h4>
                  <p className="text-[10px] text-slate-400">Prevenção de Objetos Caídos</p>
                </div>
              </div>

              <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => onChange({ ...data, dropsCheckStatus: 'OK' })}
                  className={cn("px-2 py-1 text-[10px] font-black rounded-lg", data.dropsCheckStatus === 'OK' ? "bg-teal-600 text-white" : "text-slate-500")}
                >OK</button>
                <button
                  type="button"
                  onClick={() => onChange({ ...data, dropsCheckStatus: 'NC' })}
                  className={cn("px-2 py-1 text-[10px] font-black rounded-lg", data.dropsCheckStatus === 'NC' ? "bg-rose-600 text-white" : "text-slate-500")}
                >NC</button>
              </div>
            </div>

            <div className="text-xs">
              <label className="font-bold text-slate-500 text-[10px] uppercase block">Observação / Medidas de Segurança</label>
              <input
                type="text"
                disabled={!effectiveCanEdit}
                placeholder="Ex: Equipamento limpo e livre de itens soltos"
                value={data.dropsNotes || ''}
                onChange={e => onChange({ ...data, dropsNotes: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase text-xs"
              />
            </div>
          </div>

          {/* Retrabalho */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 md:col-span-2">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center font-black">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase">Indicador de Retrabalho</h4>
                  <p className="text-[10px] text-slate-400">Soldagem, Pintura ou Ajustes Mecânicos Adicionais</p>
                </div>
              </div>

              <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => onChange({ ...data, reworkRequired: true })}
                  className={cn("px-3 py-1 text-[10px] font-black rounded-lg", data.reworkRequired ? "bg-amber-600 text-white" : "text-slate-500")}
                >SIM</button>
                <button
                  type="button"
                  onClick={() => onChange({ ...data, reworkRequired: false })}
                  className={cn("px-3 py-1 text-[10px] font-black rounded-lg", !data.reworkRequired ? "bg-teal-600 text-white" : "text-slate-500")}
                >NÃO</button>
              </div>
            </div>

            {data.reworkRequired && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-500 text-[10px] uppercase block">Escopo do Retrabalho</label>
                  <input
                    type="text"
                    disabled={!effectiveCanEdit}
                    placeholder="Ex: Retrabalho de solda no olhal superior..."
                    value={data.reworkScope || ''}
                    onChange={e => onChange({ ...data, reworkScope: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 text-[10px] uppercase block">Diretrizes de Reparo</label>
                  <input
                    type="text"
                    disabled={!effectiveCanEdit}
                    placeholder="Ex: Lixar, ressoldar com eletrodo E7018 e repintar..."
                    value={data.reworkNotes || ''}
                    onChange={e => onChange({ ...data, reworkNotes: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PHOTO REPORT */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800/60 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
              <Camera className="w-5 h-5 text-blue-600" />
              <span>
                <strong>Relatório Fotográfico Padrão:</strong> Anexe as imagens de cada posição obrigatória do modelo <strong>{template.title}</strong>.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {data.photos?.map((photo, pIdx) => (
              <div key={photo.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
                <div className="px-3 py-2 bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider truncate">
                  {photo.title}
                </div>

                <div className="p-3 flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/30 min-h-[160px] relative group">
                  {photo.photoUrl ? (
                    <div className="relative w-full h-full min-h-[140px] flex items-center justify-center">
                      <img
                        src={photo.photoUrl}
                        alt={photo.title}
                        className="max-h-36 object-contain rounded-xl shadow"
                      />
                      {effectiveCanEdit && (
                        <button
                          type="button"
                          onClick={() => handlePhotoChange(pIdx, 'photoUrl', '')}
                          className="absolute top-1 right-1 p-1.5 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remover foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer p-4 text-center">
                      <Camera className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2 group-hover:text-blue-500 transition-colors" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Clique para anexar foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={!effectiveCanEdit}
                        onChange={e => handleFileUpload(pIdx, e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    disabled={!effectiveCanEdit}
                    placeholder="Legenda / observação..."
                    value={photo.description || ''}
                    onChange={e => handlePhotoChange(pIdx, 'description', e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-900 dark:text-white uppercase outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SIGNATURES & RELEASE */}
      {activeTab === 'signatures' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Assinaturas & Responsabilidade Técnica
            </h3>
            <p className="text-xs text-slate-400">Preencha os responsáveis pela inspeção e liberação operacional do ativo</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                INSPETOR / TÉCNICO EXECUTANTE
              </span>
              <div>
                <label className="font-bold text-slate-500 uppercase text-[10px] block">Nome Completo</label>
                <input
                  type="text"
                  disabled={!effectiveCanEdit}
                  placeholder="Nome do inspetor..."
                  value={data.inspectorName || ''}
                  onChange={e => onChange({ ...data, inspectorName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase font-bold text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-500 uppercase text-[10px] block">Cargo / Função</label>
                <input
                  type="text"
                  disabled={!effectiveCanEdit}
                  placeholder="Ex: TÉCNICO DE INSPEÇÃO"
                  value={data.inspectorJobTitle || ''}
                  onChange={e => onChange({ ...data, inspectorJobTitle: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase text-xs"
                />
              </div>
            </div>

            <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider block">
                APROVADOR / SUPERVISOR QUALIDADE
              </span>
              <div>
                <label className="font-bold text-slate-500 uppercase text-[10px] block">Nome do Responsável</label>
                <input
                  type="text"
                  disabled={!effectiveCanEdit}
                  placeholder="Nome do supervisor..."
                  value={data.approverName || ''}
                  onChange={e => onChange({ ...data, approverName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase font-bold text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-500 uppercase text-[10px] block">Cargo / Função</label>
                <input
                  type="text"
                  disabled={!effectiveCanEdit}
                  placeholder="Ex: SUPERVISOR PCP / QUALIDADE"
                  value={data.approverJobTitle || ''}
                  onChange={e => onChange({ ...data, approverJobTitle: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action Controls */}
      <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {template.title} • {data.equipmentTag || 'TAG NÃO DEFINIDA'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onPrintPDF ? onPrintPDF() : generateOperationalChecklistPDF(data, logoUrl)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border border-slate-300 dark:border-slate-700 shadow-sm cursor-pointer"
          >
            <FileText className="w-4 h-4 text-blue-500" />
            <span>Gerar PDF Oficial</span>
          </button>

          {!isReadOnly && onSave && (
            <button
              type="button"
              disabled={isSaving || isSubmitting}
              onClick={onSave}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving || isSubmitting ? 'Salvando...' : 'Salvar Checklist Operacional'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
