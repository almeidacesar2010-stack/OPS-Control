import React, { useState, useEffect } from 'react';
import { X, Check, Container, AlertCircle, AlertTriangle } from 'lucide-react';
import { FleetEquipment } from '../types/fleet';
import { DecontaminationOperation, DecontaminationStatus, TANK_CLIENTS } from '../types/decontamination';
import { format } from 'date-fns';

interface DecontaminationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (operation: Partial<DecontaminationOperation>) => Promise<void>;
  editingOperation?: DecontaminationOperation | null;
  fleetEquipments?: FleetEquipment[];
  clients: { id: string; razaoSocial: string }[];
}

export function DecontaminationModal({
  isOpen,
  onClose,
  onSave,
  editingOperation,
  clients
}: DecontaminationModalProps) {
  const [equipmentNumber, setEquipmentNumber] = useState('');
  const [model, setModel] = useState('');
  const [isOegFleet, setIsOegFleet] = useState(false);
  const [client, setClient] = useState('');
  const [product, setProduct] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasContamination, setHasContamination] = useState(false);
  const [status, setStatus] = useState<DecontaminationStatus>('waiting');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
    if (editingOperation) {
      setEquipmentNumber(editingOperation.equipmentNumber ? editingOperation.equipmentNumber.toUpperCase() : '');
      setModel(editingOperation.model ? editingOperation.model.toUpperCase() : '');
      setIsOegFleet(Boolean(editingOperation.isOegFleet));
      setClient(editingOperation.client ? editingOperation.client.toUpperCase() : '');
      setProduct(editingOperation.product ? editingOperation.product.toUpperCase() : '');
      setInvoiceNumber(editingOperation.invoiceNumber ? editingOperation.invoiceNumber.toUpperCase() : '');
      setArrivalDate(editingOperation.arrivalDate ? editingOperation.arrivalDate.slice(0, 10) : '');
      setStartDate(editingOperation.startDate ? editingOperation.startDate.slice(0, 10) : '');
      setEndDate(editingOperation.endDate ? editingOperation.endDate.slice(0, 10) : '');
      setHasContamination(Boolean(editingOperation.hasContamination));
      setStatus(editingOperation.status || 'waiting');
      setNotes(editingOperation.notes || '');
    } else {
      setEquipmentNumber('');
      setModel('');
      setIsOegFleet(false);
      setClient('');
      setProduct('');
      setInvoiceNumber('');
      setArrivalDate(format(new Date(), 'yyyy-MM-dd'));
      setStartDate('');
      setEndDate('');
      setHasContamination(false);
      setStatus('waiting');
      setNotes('');
    }
  }, [editingOperation, isOpen]);

  if (!isOpen) return null;

  // Form Validation: All required fields must be filled for button to be enabled
  const isFormValid = Boolean(
    equipmentNumber.trim() !== '' &&
    model.trim() !== '' &&
    client.trim() !== '' &&
    arrivalDate.trim() !== '' &&
    status &&
    (status !== 'in_progress' || startDate.trim() !== '') &&
    (status !== 'completed' || (startDate.trim() !== '' && endDate.trim() !== ''))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const payload: Partial<DecontaminationOperation> = {
        equipmentNumber: equipmentNumber.trim().toUpperCase(),
        model: model.trim().toUpperCase(),
        isOegFleet,
        client: client.trim().toUpperCase(),
        product: product.trim().toUpperCase(),
        invoiceNumber: invoiceNumber.trim().toUpperCase(),
        arrivalDate: arrivalDate.trim(),
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        hasContamination,
        status,
        notes: notes.trim()
      };
      if (editingOperation?.id) {
        payload.id = editingOperation.id;
      }
      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error("Error saving decontamination operation:", err);
      setErrorMessage(err?.message || "Erro ao salvar operação de descontaminação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 md:p-8 bg-slate-50/80 dark:bg-slate-850 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center font-black">
              <Container className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {editingOperation ? 'Editar Operação de Descontaminação' : 'Nova Operação de Descontaminação'}
              </h2>
              <p className="text-xs text-slate-500 font-bold">
                Cadastre ou atualize a operação de descontaminação do tanque
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {errorMessage && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Tank Number & OEG Fleet Checkbox */}
          <div className="space-y-3">
            <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
              Número do Tanque *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: STC-5000-001, OEGU920805..."
              value={equipmentNumber}
              onChange={e => setEquipmentNumber(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase transition-all"
            />

            {/* Checkbox OEG Fleet */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex items-center justify-between">
              <label htmlFor="isOegFleetModal" className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="isOegFleetModal"
                  checked={isOegFleet}
                  onChange={e => setIsOegFleet(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                  Tanque pertencente à frota OEG
                </span>
              </label>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                isOegFleet
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                  : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600'
              }`}>
                {isOegFleet ? 'Frota OEG' : 'Tanque de Terceiro'}
              </span>
            </div>
          </div>

          {/* Model & Client */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2">
                Modelo do Tanque *
              </label>
              <input
                type="text"
                required
                list="model-suggestions"
                placeholder="Ex: TANQUE DE 5000L, 1325L..."
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase transition-all"
              />
              <datalist id="model-suggestions">
                <option value="TANQUE DE 1325L" />
                <option value="TANQUE DE 1500L" />
                <option value="TANQUE DE 5000L" />
                <option value="TANQUE DE 5200L" />
              </datalist>
            </div>

            {/* Client */}
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2">
                Cliente *
              </label>
              <select
                required
                value={client}
                onChange={e => setClient(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase transition-all"
              >
                <option value="">SELECIONE O CLIENTE...</option>
                {TANK_CLIENTS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                {client && !TANK_CLIENTS.includes(client.toUpperCase() as any) && (
                  <option value={client}>{client.toUpperCase()}</option>
                )}
              </select>
            </div>
          </div>

          {/* Product & Invoice */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2">
                Produto / Conteúdo
              </label>
              <input
                type="text"
                placeholder="EX: ÓLEO SINTÉTICO, SOLVENTE (OPCIONAL)..."
                value={product}
                onChange={e => setProduct(e.target.value.toUpperCase())}
                onPaste={e => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  if (pastedText) {
                    const uppercaseText = pastedText.toUpperCase();
                    const target = e.target as HTMLInputElement;
                    const start = target.selectionStart || 0;
                    const end = target.selectionEnd || 0;
                    const nextVal = (product.slice(0, start) + uppercaseText + product.slice(end)).toUpperCase();
                    setProduct(nextVal);
                  }
                }}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2">
                Nota Fiscal de Entrada (NF)
              </label>
              <input
                type="text"
                placeholder="EX: NF-12345 (OPCIONAL)"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value.toUpperCase())}
                onPaste={e => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  if (pastedText) {
                    const uppercaseText = pastedText.toUpperCase();
                    const target = e.target as HTMLInputElement;
                    const start = target.selectionStart || 0;
                    const end = target.selectionEnd || 0;
                    const nextVal = (invoiceNumber.slice(0, start) + uppercaseText + invoiceNumber.slice(end)).toUpperCase();
                    setInvoiceNumber(nextVal);
                  }
                }}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase transition-all"
              />
            </div>
          </div>

          {/* Dates Row (type="date" - dd/mm/yyyy) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2">
                Chegada na Base *
              </label>
              <input
                type="date"
                required
                value={arrivalDate}
                onChange={e => setArrivalDate(e.target.value)}
                className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2">
                Início da Descontaminação {status === 'in_progress' && '*'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  if (e.target.value && status === 'waiting') {
                    setStatus('in_progress');
                  }
                }}
                className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2">
                Finalização {status === 'completed' && '*'}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  if (e.target.value) {
                    setStatus('completed');
                  }
                }}
                className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Status & Contamination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2">
                Status da Operação *
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as DecontaminationStatus)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="waiting">Aguardando Descontaminação</option>
                <option value="in_progress">Em Descontaminação</option>
                <option value="completed">Descontaminado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2">
                Apresentou Contaminação?
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setHasContamination(false)}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${
                    !hasContamination
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  NÃO
                </button>
                <button
                  type="button"
                  onClick={() => setHasContamination(true)}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${
                    hasContamination
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  SIM
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2">
              Observações Operacionais
            </label>
            <textarea
              rows={3}
              placeholder="Digite detalhes sobre a contaminação, resíduos, lavagem ou observações gerais..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Missing fields alert notice if disabled */}
          {!isFormValid && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Preencha todos os campos obrigatórios (*) para habilitar o cadastro.</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{editingOperation ? 'Salvar Alterações' : 'Cadastrar Operação'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

