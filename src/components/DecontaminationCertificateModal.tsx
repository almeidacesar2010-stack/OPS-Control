import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Check, 
  Plus, 
  Trash2, 
  Download, 
  Building2, 
  Calendar, 
  MapPin, 
  User, 
  ShieldCheck, 
  AlertCircle,
  Container,
  Award,
  Search,
  Lock,
  Send,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { 
  DecontaminationOperation, 
  DecontaminationCertificate, 
  TankCertificateItem, 
  VisualChecklistState, 
  InspectionStatus,
  CHECKLIST_ITEMS, 
  OBJECTIVE_TEXT, 
  TANK_CLIENTS 
} from '../types/decontamination';
import { 
  generateDecontaminationCertificatePDF, 
  getNextReportNumber, 
  getCertificatePdfFileName,
  formatCertificateDate,
  getLogoBase64
} from '../utils/generateDecontaminationCertificatePDF';

const DEFAULT_GENERAL_NOTES = 
  "Inspeção Visual realizada nas partes internas e externas do tanque, acessórios de funcionamento e plaquetas de identificação.\n\n" +
  "Os contentores não apresentam qualquer tipo de não conformidade.\n\n" +
  "Inspeção Visual realizada por OEG do Brasil.";

interface DecontaminationCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOperation?: DecontaminationOperation | null;
  allOperations: DecontaminationOperation[];
  existingCertificates?: DecontaminationCertificate[];
  clients?: { id: string; razaoSocial: string }[];
  currentUserName: string;
  currentUserId?: string;
  userRole?: string;
  logoUrl?: string;
  onSaveCertificate: (cert: DecontaminationCertificate) => Promise<void>;
}

export function DecontaminationCertificateModal({
  isOpen,
  onClose,
  initialOperation = null,
  allOperations,
  existingCertificates = [],
  clients = [],
  currentUserName,
  currentUserId,
  userRole = 'user',
  logoUrl,
  onSaveCertificate
}: DecontaminationCertificateModalProps) {
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'dd/MM/yyyy');
  const nowTime = format(new Date(), 'HH:mm');

  // Sequential automatic numbering: OEG.XXX.AAAA
  const [reportNumberData, setReportNumberData] = useState(() => 
    getNextReportNumber(existingCertificates)
  );

  // State for Header Fields
  const [issueDate, setIssueDate] = useState(todayIso);
  const [issueTime, setIssueTime] = useState(nowTime);
  const [client, setClient] = useState('');
  const [inspectionLocation, setInspectionLocation] = useState('Base OEG do Brasil - Macaé/RJ');

  // State for Tanks Table
  const [tanksList, setTanksList] = useState<TankCertificateItem[]>([]);
  const [inputTankNumber, setInputTankNumber] = useState('');
  const [searchFeedback, setSearchFeedback] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // List of all equipment numbers in system for autocomplete
  const uniqueEquipmentNumbers = useMemo(() => {
    const setTags = new Set<string>();
    allOperations.forEach(o => {
      if (o.equipmentNumber) setTags.add(o.equipmentNumber.trim().toUpperCase());
    });
    return Array.from(setTags).sort();
  }, [allOperations]);

  // State for Checklist
  const [checklist, setChecklist] = useState<VisualChecklistState>({
    pintura: 'OK',
    corrosao: 'OK',
    danosDeformacoes: 'OK',
    soldas: 'OK',
    conexoes: 'OK',
    valvulas: 'OK',
    olhal: 'OK',
    plaqueta: 'OK',
    bolsaEmpilhadeira: 'OK'
  });

  // State for Notes & Conclusion
  const [generalNotes, setGeneralNotes] = useState(DEFAULT_GENERAL_NOTES);
  const [isGenerating, setIsGenerating] = useState(false);

  // Available Clients list (strictly from the tanks module TANK_CLIENTS)
  const availableClientsList = useMemo(() => {
    const listSet = new Set<string>();
    TANK_CLIENTS.forEach(c => listSet.add(c));
    if (client && !TANK_CLIENTS.includes(client.toUpperCase() as any)) {
      listSet.add(client.toUpperCase());
    }
    return Array.from(listSet).sort();
  }, [client]);

  // Initialize fields when modal opens
  useEffect(() => {
    const nextReport = getNextReportNumber(existingCertificates);
    setReportNumberData(nextReport);

    const now = new Date();
    setIssueDate(format(now, 'yyyy-MM-dd'));
    setIssueTime(format(now, 'HH:mm'));
    setInspectionLocation('Base OEG do Brasil - Macaé/RJ');
    setGeneralNotes(DEFAULT_GENERAL_NOTES);
    setClient('');
    setInputTankNumber('');
    setSearchFeedback(null);

    if (initialOperation) {
      setTanksList([
        {
          description: (initialOperation.model || 'TANQUE DE ARMAZENAMENTO').toUpperCase(),
          equipmentNumber: (initialOperation.equipmentNumber || '').toUpperCase(),
          product: (initialOperation.product || 'NÃO INFORMADO').trim().toUpperCase(),
          decontaminationDate: formatCertificateDate(initialOperation.endDate || initialOperation.startDate || initialOperation.arrivalDate)
        }
      ]);
    } else {
      setTanksList([]);
    }

    setChecklist({
      pintura: 'OK',
      corrosao: 'OK',
      danosDeformacoes: 'OK',
      soldas: 'OK',
      conexoes: 'OK',
      valvulas: 'OK',
      olhal: 'OK',
      plaqueta: 'OK',
      bolsaEmpilhadeira: 'OK'
    });
  }, [initialOperation, currentUserName, isOpen, existingCertificates]);

  // Search tank history by equipment number and auto-fill certificate item
  const handleSearchAndAddTank = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const searchTag = inputTankNumber.trim().toUpperCase();
    if (!searchTag) return;

    // Check if already in certificate tanks list
    const alreadyAdded = tanksList.some(t => t.equipmentNumber.trim().toUpperCase() === searchTag);
    if (alreadyAdded) {
      setSearchFeedback({
        text: `O tanque ${searchTag} já foi adicionado ao certificado.`,
        type: 'warning'
      });
      return;
    }

    // Search in allOperations for completed operations matching this equipmentNumber
    const matchingOps = allOperations.filter(
      o => o.status === 'completed' &&
           o.equipmentNumber &&
           o.equipmentNumber.trim().toUpperCase() === searchTag
    );

    if (matchingOps.length > 0) {
      // Sort descending by end date (or start/arrival date) to find the most recent completed operation
      matchingOps.sort((a, b) => {
        const dateA = a.endDate || a.startDate || a.arrivalDate || '';
        const dateB = b.endDate || b.startDate || b.arrivalDate || '';
        return dateB.localeCompare(dateA);
      });

      const latestOp = matchingOps[0];
      const decontamDate = formatCertificateDate(latestOp.endDate || latestOp.startDate || latestOp.arrivalDate);

      setTanksList(prev => [
        ...prev,
        {
          description: (latestOp.model || 'TANQUE DE ARMAZENAMENTO').toUpperCase(),
          equipmentNumber: (latestOp.equipmentNumber || searchTag).toUpperCase(),
          product: (latestOp.product || 'NÃO INFORMADO').trim().toUpperCase(),
          decontaminationDate: decontamDate !== '—' ? decontamDate : todayDisplay
        }
      ]);

      setSearchFeedback({
        text: `Tanque ${searchTag} localizado e preenchido com a descontaminação mais recente (${decontamDate})!`,
        type: 'success'
      });
    } else {
      // No completed operation found in history, allow manual entry
      setTanksList(prev => [
        ...prev,
        {
          description: 'TANQUE DE ARMAZENAMENTO',
          equipmentNumber: searchTag,
          product: 'NÃO INFORMADO',
          decontaminationDate: todayDisplay
        }
      ]);

      setSearchFeedback({
        text: `Histórico de descontaminação não encontrado para ${searchTag}. Tanque adicionado para preenchimento manual.`,
        type: 'info'
      });
    }

    setInputTankNumber('');
  };

  // Manual Add Blank Tank
  const handleAddManualTank = () => {
    setTanksList(prev => [
      ...prev,
      {
        description: 'TANQUE DE ARMAZENAMENTO',
        equipmentNumber: '',
        product: 'NÃO INFORMADO',
        decontaminationDate: todayDisplay
      }
    ]);
  };

  const handleRemoveTank = (index: number) => {
    setTanksList(prev => prev.filter((_, i) => i !== index));
  };

  const handleChecklistChange = (key: keyof VisualChecklistState, status: InspectionStatus) => {
    setChecklist(prev => ({ ...prev, [key]: status }));
  };

  // Visual notification and validation state
  const [formError, setFormError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    reportNumber: string;
    isDirectApproved: boolean;
    fileName?: string;
  } | null>(null);

  // PDF Generation & Certificate Creation Logic
  const handleProcessCertificate = async (mode: 'request_approval' | 'direct_approval') => {
    setFormError(null);
    if (tanksList.length === 0) {
      setFormError("Por favor, adicione ao menos 1 tanque para emitir o certificado.");
      return;
    }

    if (!client.trim()) {
      setFormError("Por favor, selecione ou informe o Cliente Destinatário.");
      return;
    }

    setIsGenerating(true);
    try {
      const now = new Date();
      const currentIsoDate = format(now, 'yyyy-MM-dd');
      const currentIsoTime = format(now, 'HH:mm');
      const nowTimestamp = now.toISOString();

      const isDirectApproved = mode === 'direct_approval';

      // Build Certificate object with full audit metadata
      const certObject: DecontaminationCertificate = {
        id: `cert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        reportNumber: reportNumberData.reportNumber,
        sequenceNumber: reportNumberData.sequenceNumber,
        year: reportNumberData.year,

        // Emissor (Automático e Imutável)
        issuerId: currentUserId || '',
        issuerName: currentUserName || 'Inspetor Técnico OEG',
        issueDate: currentIsoDate,
        issueTime: currentIsoTime,
        issuedAt: nowTimestamp,

        // Aprovador & Status
        approvalStatus: isDirectApproved ? 'approved' : 'pending_approval',
        approvedById: isDirectApproved ? (currentUserId || '') : undefined,
        approvedByName: isDirectApproved ? (currentUserName || 'Inspetor Técnico OEG') : undefined,
        approvedDate: isDirectApproved ? currentIsoDate : undefined,
        approvedTime: isDirectApproved ? currentIsoTime : undefined,
        approvedAt: isDirectApproved ? nowTimestamp : undefined,

        // Compatibilidade
        responsibleName: currentUserName || 'Inspetor Técnico OEG',
        approvedBy: isDirectApproved ? (currentUserName || 'Inspetor Técnico OEG') : undefined,

        // Dados Operacionais
        client: client.toUpperCase(),
        inspectionLocation,
        tanks: tanksList.map(t => ({
          description: (t.description || 'TANQUE DE ARMAZENAMENTO').trim().toUpperCase(),
          equipmentNumber: (t.equipmentNumber || '').trim().toUpperCase(),
          product: (t.product || 'NÃO INFORMADO').trim().toUpperCase(),
          decontaminationDate: t.decontaminationDate || todayDisplay
        })),
        checklist,
        generalNotes,
        status: 'CONFORME',
        createdAt: nowTimestamp
      };

      const finalTanks = certObject.tanks;

      if (isDirectApproved) {
        // Load site company logo for official PDF header
        const logoBase64 = await getLogoBase64(logoUrl);

        // Generate formatted PDF using official layout with site logo
        const doc = generateDecontaminationCertificatePDF(certObject, logoBase64);

        // Save PDF dataURI directly in document for instantaneous preview and audit binding
        const pdfDataUri = doc.output('datauristring');
        const fileName = getCertificatePdfFileName(certObject);

        const completeCert: DecontaminationCertificate = {
          ...certObject,
          tankCount: finalTanks.length,
          pdfDataUri,
          pdfFileName: fileName
        };

        // 1. Save to Firebase History
        await onSaveCertificate(completeCert);

        // 2. Download the generated PDF locally with exact standard filename
        try {
          doc.save(fileName);
        } catch (downloadErr) {
          console.warn("Direct download PDF warning:", downloadErr);
        }

        setSuccessInfo({
          reportNumber: certObject.reportNumber,
          isDirectApproved: true,
          fileName
        });
      } else {
        // Mode: 'request_approval' - Do NOT generate or download PDF
        // Launch directly to Certificate History awaiting technical approval
        const pendingCert: DecontaminationCertificate = {
          ...certObject,
          tankCount: finalTanks.length,
          approvalStatus: 'pending_approval'
        };

        // Save to Firebase History
        await onSaveCertificate(pendingCert);

        setSuccessInfo({
          reportNumber: certObject.reportNumber,
          isDirectApproved: false
        });
      }
    } catch (err: any) {
      console.error("Erro ao registrar certificado:", err);
      setFormError(`Erro ao registrar o certificado no histórico: ${err?.message || 'Falha de comunicação'}.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const canDirectApprove = userRole === 'admin' || userRole === 'moderator';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
          <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 border border-blue-400/30 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 bg-blue-950 px-2.5 py-0.5 rounded-md border border-blue-800/60">
                  Emissão de Documento Oficial
                </span>
                <h2 className="text-xl font-black text-white tracking-tight uppercase mt-0.5">
                  Certificado de Descontaminação e Limpeza de Tanques
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form Content */}
          <div className="p-6 md:p-8 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
            
            {/* CABEÇALHO FIELDS */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                1. Cabeçalho e Auditoria do Certificado
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                {/* Automatic Sequential Report Number (LOCKED) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Nº Relatório
                    </label>
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Automático
                    </span>
                  </div>
                  <div className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black text-blue-600 dark:text-blue-400 tracking-wider flex items-center justify-between cursor-not-allowed">
                    <span>{reportNumberData.reportNumber}</span>
                    <span className="text-[9px] text-slate-400 font-normal">Sequencial {reportNumberData.year}</span>
                  </div>
                </div>

                {/* Emission Date & Time (Automatic) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Data e Hora da Emissão
                    </label>
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> Agora
                    </span>
                  </div>
                  <div className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between cursor-not-allowed">
                    <span>{formatCertificateDate(issueDate)}</span>
                    <span className="text-slate-500">{issueTime}</span>
                  </div>
                </div>

                {/* Destination Client */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                    Cliente Destinatário <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={client}
                    onChange={e => setClient(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- SELECIONE O CLIENTE DESTINATÁRIO --</option>
                    {availableClientsList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Inspection Location */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                    Local de Inspeção
                  </label>
                  <input
                    type="text"
                    value={inspectionLocation}
                    onChange={e => setInspectionLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Responsible Issuer (LOCKED to Logged User) */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Responsável Emissor
                    </label>
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Usuário Logado
                    </span>
                  </div>
                  <div className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-not-allowed">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>{currentUserName || 'Inspetor Técnico OEG'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* OBJETIVO */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                2. Objetivo do Serviço
              </h3>
              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300">
                "{OBJECTIVE_TEXT}"
              </div>
            </div>

            {/* CONSULTA E ADIÇÃO DE TANQUE POR NÚMERO/TAG */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                Consulta e Inclusão pelo Número do Tanque (Tag)
              </label>

              <form onSubmit={handleSearchAndAddTank} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    list="equipment-numbers-list"
                    value={inputTankNumber}
                    onChange={e => {
                      setInputTankNumber(e.target.value);
                      setSearchFeedback(null);
                    }}
                    placeholder="Informe o número do tanque (ex: TK-101) para buscar no histórico..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold uppercase focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                  <datalist id="equipment-numbers-list">
                    {uniqueEquipmentNumbers.map(tag => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                </div>

                <button
                  type="submit"
                  disabled={!inputTankNumber.trim()}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buscar e Adicionar</span>
                </button>
              </form>

              {searchFeedback && (
                <div className={`text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-2 ${
                  searchFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' :
                  searchFeedback.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' :
                  'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                }`}>
                  {searchFeedback.type === 'success' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {searchFeedback.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
                  {searchFeedback.type === 'info' && <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />}
                  <span>{searchFeedback.text}</span>
                </div>
              )}
            </div>

            {/* TANQUES LIST TABLE */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Container className="w-4 h-4" />
                  3. Lista de Tanques Inclusos no Certificado ({tanksList.length})
                </h3>

                <button
                  type="button"
                  onClick={handleAddManualTank}
                  className="px-3.5 py-2 bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Tanque Manualmente</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs font-bold">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Descrição (Modelo)</th>
                      <th className="p-3">Nº Tanque (Tag)</th>
                      <th className="p-3">Produto antes da Descontaminação</th>
                      <th className="p-3 text-center">Data Descontaminação</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {tanksList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                          Nenhum tanque adicionado a este certificado. Digite o número do tanque acima para buscar no histórico ou adicione manualmente.
                        </td>
                      </tr>
                    ) : (
                      tanksList.map((tank, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3">
                            <input
                              type="text"
                              value={tank.description}
                              onChange={e => {
                                const val = e.target.value;
                                setTanksList(prev => {
                                  const updated = [...prev];
                                  updated[idx].description = val;
                                  return updated;
                                });
                              }}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                              placeholder="Ex: TANQUE DE 5000L"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={tank.equipmentNumber}
                              onChange={e => {
                                const val = e.target.value.toUpperCase();
                                setTanksList(prev => {
                                  const updated = [...prev];
                                  updated[idx].equipmentNumber = val;
                                  return updated;
                                });
                              }}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-black uppercase text-blue-600 dark:text-blue-400"
                              placeholder="Ex: TK-101"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={tank.product}
                              onChange={e => {
                                const val = e.target.value.toUpperCase();
                                setTanksList(prev => {
                                  const updated = [...prev];
                                  updated[idx].product = val;
                                  return updated;
                                });
                              }}
                              onPaste={e => {
                                e.preventDefault();
                                const pasted = e.clipboardData.getData('text');
                                if (pasted) {
                                  const val = pasted.toUpperCase();
                                  setTanksList(prev => {
                                    const updated = [...prev];
                                    updated[idx].product = val;
                                    return updated;
                                  });
                                }
                              }}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white uppercase"
                              placeholder="EX: GLICERINA"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="text"
                              value={tank.decontaminationDate}
                              onChange={e => {
                                const val = e.target.value;
                                setTanksList(prev => {
                                  const updated = [...prev];
                                  updated[idx].decontaminationDate = val;
                                  return updated;
                                });
                              }}
                              className="w-28 px-2 py-1.5 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                              placeholder="DD/MM/AAAA"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveTank(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                              title="Remover tanque"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CHECKLIST VISUAL */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                4. Inspeção Visual Final - Condição Geral do Equipamento
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CHECKLIST_ITEMS.map(item => {
                  const currentStatus = checklist[item.key] || 'OK';
                  return (
                    <div
                      key={item.key}
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {item.label}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleChecklistChange(item.key, 'OK')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                            currentStatus === 'OK'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChecklistChange(item.key, 'Não OK')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                            currentStatus === 'Não OK'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          Não OK
                        </button>
                        {item.allowNA && (
                          <button
                            type="button"
                            onClick={() => handleChecklistChange(item.key, 'N/A')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                              currentStatus === 'N/A'
                                ? 'bg-slate-700 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            N/A
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* OBSERVAÇÕES E PARECER */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block">
                5. Informações Gerais e Observações
              </label>
              <textarea
                rows={4}
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Error Banner */}
            {formError && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 animate-in fade-in duration-150">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-bold">{formError}</span>
              </div>
            )}
          </div>

          {/* Footer Action Bar */}
          <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {/* Solicitar Aprovação Button (Default workflow) */}
              <button
                type="button"
                onClick={() => handleProcessCertificate('request_approval')}
                disabled={isGenerating}
                className="w-full sm:w-auto px-6 py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isGenerating ? 'Processando...' : 'Solicitar Aprovação'}</span>
              </button>

              {/* Direct Approval Button (If user is Admin / Moderator) */}
              {canDirectApprove && (
                <button
                  type="button"
                  onClick={() => handleProcessCertificate('direct_approval')}
                  disabled={isGenerating}
                  className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isGenerating ? 'Processando...' : 'Emitir e Aprovar'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Visual de Sucesso na Criação */}
        {successInfo && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-150">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase mb-1">
                {successInfo.isDirectApproved ? 'Certificado Aprovado e Emitido!' : 'Certificado Lançado com Sucesso!'}
              </h3>
              
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                {successInfo.isDirectApproved ? (
                  <>
                    O Certificado <strong>{successInfo.reportNumber}</strong> foi registrado no histórico como <strong>Aprovado</strong> e o download do PDF foi iniciado.
                  </>
                ) : (
                  <>
                    O Certificado <strong>{successInfo.reportNumber}</strong> foi adicionado ao Histórico com status <strong>Aguardando Aprovação</strong>. O PDF oficial estará disponível após a aprovação técnica.
                  </>
                )}
              </p>

              <button
                type="button"
                onClick={() => {
                  setSuccessInfo(null);
                  onClose();
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Concluir e Voltar
              </button>
            </div>
          </div>
        )}
      </div>
  );
}
