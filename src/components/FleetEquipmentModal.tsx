import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, ShieldCheck, Calendar, Building2, Tag, Layers, MapPin, Activity, CheckCircle2, Award } from 'lucide-react';
import { FleetEquipment, FleetType, FleetLocation, FleetStatus } from '../types/fleet';
import { Client } from '../types';
import { calculateCompletenessScore, calculateNextInspectionDate } from '../utils/fleetUtils';

interface FleetEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (equipmentData: Partial<FleetEquipment>) => Promise<void>;
  initialData?: FleetEquipment | null;
  clients: Client[];
  existingEquipments: { id?: string; type: string; equipmentNumber: string }[];
}

export const FLEET_TYPES: FleetType[] = [
  'CCU',
  'REEFER',
  'SPOOLER',
  'TANQUE DE 1325L',
  'TANQUE DE 1500L',
  'TANQUE DE 5000L',
  'TANQUE DE 5200L',
  'ESLINGA',
  'OUTROS'
];

export const FLEET_LOCATIONS: FleetLocation[] = ['BASE', 'CLIENTE'];

export const FLEET_STATUSES: FleetStatus[] = [
  'Cadastro Pendente de Validação',
  'Operacional',
  'Em manutenção',
  'Aguardando inspeção',
  'Não conforme'
];

export const FleetEquipmentModal: React.FC<FleetEquipmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  clients,
  existingEquipments
}) => {
  const [formData, setFormData] = useState<Partial<FleetEquipment>>({
    equipmentNumber: '',
    type: 'CCU',
    clientId: '',
    location: 'BASE',
    status: 'Operacional',
    visualInspectionDate: '',
    nextVisualInspectionDate: '',
    endInspectionDate: '',
    nextEndInspectionDate: '',
    observations: '',
    isPendingValidation: true,
    validationStatus: 'pending'
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        equipmentNumber: initialData.equipmentNumber || '',
        type: initialData.type || 'CCU',
        clientId: initialData.clientId || '',
        location: initialData.location || 'BASE',
        status: initialData.status || 'Operacional',
        visualInspectionDate: initialData.visualInspectionDate || '',
        nextVisualInspectionDate: initialData.nextVisualInspectionDate || '',
        endInspectionDate: initialData.endInspectionDate || '',
        nextEndInspectionDate: initialData.nextEndInspectionDate || '',
        observations: initialData.observations || '',
        isPendingValidation: initialData.isPendingValidation !== false,
        validationStatus: initialData.validationStatus || (initialData.isPendingValidation === false ? 'validated' : 'pending'),
        validatedAt: initialData.validatedAt || '',
        validatedBy: initialData.validatedBy || ''
      });
    } else {
      setFormData({
        equipmentNumber: '',
        type: 'CCU',
        clientId: clients[0]?.razaoSocial || '',
        location: 'BASE',
        status: 'Operacional',
        visualInspectionDate: '',
        nextVisualInspectionDate: '',
        endInspectionDate: '',
        nextEndInspectionDate: '',
        observations: '',
        isPendingValidation: true,
        validationStatus: 'pending'
      });
    }
    setError(null);
  }, [initialData, isOpen, clients]);

  if (!isOpen) return null;

  const completenessScore = calculateCompletenessScore(formData);
  const isPending = formData.isPendingValidation !== false;

  const handleVisualDateChange = (val: string) => {
    const nextVal = val ? calculateNextInspectionDate(val, 1) : '';
    setFormData(prev => ({
      ...prev,
      visualInspectionDate: val,
      nextVisualInspectionDate: prev.nextVisualInspectionDate || nextVal
    }));
  };

  const handleEndDateChange = (val: string) => {
    const nextVal = val ? calculateNextInspectionDate(val, 1) : '';
    setFormData(prev => ({
      ...prev,
      endInspectionDate: val,
      nextEndInspectionDate: prev.nextEndInspectionDate || nextVal
    }));
  };

  const checkIsDuplicate = (tag: string, type: string) => {
    return existingEquipments.some(item => {
      const itemTag = (item.equipmentNumber || '').trim().toUpperCase();
      const itemType = (item.type || '').trim().toUpperCase();

      if (itemTag !== tag || itemType !== type) return false;

      // If editing existing item, ignore self
      if (initialData) {
        if (initialData.id && item.id && item.id === initialData.id) {
          return false;
        }
        if (!initialData.id && 
            (initialData.equipmentNumber || '').trim().toUpperCase() === tag && 
            (initialData.type || '').trim().toUpperCase() === type) {
          return false;
        }
      }

      return true;
    });
  };

  const handleValidateClick = async () => {
    const tag = (formData.equipmentNumber || '').trim().toUpperCase();
    const type = (formData.type || 'CCU').trim().toUpperCase();

    if (!tag) {
      setError('Número do equipamento é obrigatório antes de validar.');
      return;
    }

    if (!type) {
      setError('Tipo do ativo é obrigatório.');
      return;
    }

    if (checkIsDuplicate(tag, type)) {
      setError(`Já existe um ativo cadastrado com o mesmo Tipo (${formData.type}) e Número (${tag}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      const validatedData = {
        ...formData,
        equipmentNumber: tag,
        type: formData.type || 'CCU',
        isPendingValidation: false,
        validationStatus: 'validated' as const,
        validatedAt: new Date().toISOString()
      };
      await onSave(validatedData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao validar equipamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const tag = (formData.equipmentNumber || '').trim().toUpperCase();
    const type = (formData.type || 'CCU').trim().toUpperCase();

    if (!tag) {
      setError('Número do equipamento é obrigatório.');
      return;
    }

    if (!type) {
      setError('Tipo do ativo é obrigatório.');
      return;
    }

    if (checkIsDuplicate(tag, type)) {
      setError(`Já existe um ativo cadastrado simultaneamente com o mesmo Tipo (${formData.type}) e mesmo Número (${tag}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        ...formData,
        equipmentNumber: tag,
        type: formData.type || 'CCU'
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar equipamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                {initialData ? `Equipamento ${initialData.equipmentNumber}` : 'Novo Equipamento da Frota'}
                {isPending ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 text-[10px] font-black uppercase">
                    Pendente de Validação
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-[10px] font-black uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Validado
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Conferência e cadastro de ativos para a frota PCP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Completeness & Validation Status Bar */}
        <div className="px-6 pt-5">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                Índice de Completude do Cadastro:
              </span>
              <span className={`font-black text-sm ${completenessScore >= 80 ? 'text-emerald-600' : completenessScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {completenessScore}% Completo
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  completenessScore >= 80 ? 'bg-emerald-500' : completenessScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${completenessScore}%` }}
              />
            </div>

            {isPending ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-amber-800 dark:text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Atenção PCP:</strong> Cadastro não verificado. Confirme os dados antes de clicar em Validar.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleValidateClick}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shadow-md shrink-0 flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Validar Cadastro
                </button>
              </div>
            ) : (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Cadastro Verificado e Validado no Sistema.</span>
              </div>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-600 dark:text-red-400 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Equipment Number */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-500" />
                Número do Equipamento *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: CCU-102, TNK-5000-01"
                value={formData.equipmentNumber || ''}
                onChange={(e) => setFormData({ ...formData, equipmentNumber: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                Tipo de Equipamento *
              </label>
              <select
                required
                value={formData.type || 'CCU'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as FleetType })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {FLEET_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Client */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                Cliente Atual
              </label>
              <input
                type="text"
                list="fleet-clients-list"
                placeholder="Selecione ou digite o nome do cliente..."
                value={formData.clientId || ''}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <datalist id="fleet-clients-list">
                {clients.map((c) => (
                  <option key={c.id} value={c.razaoSocial} />
                ))}
              </datalist>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                Localização *
              </label>
              <select
                value={formData.location || 'BASE'}
                onChange={(e) => setFormData({ ...formData, location: e.target.value as FleetLocation })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {FLEET_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-500" />
                Status Operacional *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {FLEET_STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFormData({ ...formData, status: st })}
                    className={`px-3 py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${
                      formData.status === st
                        ? st === 'Operacional'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                          : st === 'Em manutenção'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                          : st === 'Aguardando inspeção'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                          : 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Inspeções */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Controle de Validades das Inspeções
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Visual Inspection */}
              <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Inspeção Visual</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Data Realizada</label>
                    <input
                      type="date"
                      value={formData.visualInspectionDate || ''}
                      onChange={(e) => handleVisualDateChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Próximo Vencimento</label>
                    <input
                      type="date"
                      value={formData.nextVisualInspectionDate || ''}
                      onChange={(e) => setFormData({ ...formData, nextVisualInspectionDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* END Inspection */}
              <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">END (Ensaio Não Destrutivo)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Data Realizada</label>
                    <input
                      type="date"
                      value={formData.endInspectionDate || ''}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Próximo Vencimento</label>
                    <input
                      type="date"
                      value={formData.nextEndInspectionDate || ''}
                      onChange={(e) => setFormData({ ...formData, nextEndInspectionDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">Observações Gerais</label>
            <textarea
              rows={3}
              placeholder="Anotações técnicas, histórico prévio ou observações de manuseio..."
              value={formData.observations || ''}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 gap-3">
            {isPending ? (
              <button
                type="button"
                onClick={handleValidateClick}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/25 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Validar Cadastro Agora
              </button>
            ) : (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Cadastro Validado
              </span>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-black uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-600/25 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
