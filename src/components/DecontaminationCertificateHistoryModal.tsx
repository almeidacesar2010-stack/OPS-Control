import React, { useState } from 'react';
import { 
  X, 
  Search, 
  FileText, 
  Download, 
  Trash2, 
  Award, 
  Calendar, 
  Building2, 
  User, 
  CheckCircle2, 
  Clock,
  AlertCircle,
  ShieldCheck,
  Container,
  Check,
  Eye,
  Info,
  ExternalLink,
  Printer,
  Sparkles,
  MapPin,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DecontaminationCertificate, CHECKLIST_ITEMS } from '../types/decontamination';
import { 
  generateDecontaminationCertificatePDF, 
  getCertificatePdfFileName, 
  formatCertificateDate,
  getLogoBase64
} from '../utils/generateDecontaminationCertificatePDF';

interface DecontaminationCertificateHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificates: DecontaminationCertificate[];
  canDelete?: boolean;
  userRole?: string;
  currentUserName?: string;
  currentUserId?: string;
  logoUrl?: string;
  onDeleteCertificate?: (id: string) => Promise<void>;
  onRequestDelete?: (itemType: string, itemId: string, itemCollection: string, itemName: string) => void;
  onApproveCertificate?: (certId: string, approverName: string, approverId: string) => Promise<void>;
}

export function DecontaminationCertificateHistoryModal({
  isOpen,
  onClose,
  certificates,
  canDelete: _canDeleteProp,
  userRole = 'user',
  currentUserName = 'Inspetor Técnico OEG',
  currentUserId = '',
  logoUrl,
  onDeleteCertificate,
  onRequestDelete,
  onApproveCertificate
}: DecontaminationCertificateHistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // States for In-App Confirmation Modals
  const [confirmApproveCert, setConfirmApproveCert] = useState<DecontaminationCertificate | null>(null);
  const [confirmDeleteCert, setConfirmDeleteCert] = useState<DecontaminationCertificate | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Visual in-app Feedback Notifications
  const [feedbackNotification, setFeedbackNotification] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    approvedCertToDownload?: DecontaminationCertificate;
  } | null>(null);

  // States for View PDF & View Details modals
  const [previewCert, setPreviewCert] = useState<DecontaminationCertificate | null>(null);
  const [previewPdfUri, setPreviewPdfUri] = useState<string | null>(null);
  const [detailsCert, setDetailsCert] = useState<DecontaminationCertificate | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const isModerator = userRole === 'moderator';
  const isAdmin = userRole === 'admin';
  const canApprove = isAdmin || isModerator;
  const canDelete = isAdmin || isModerator;

  // Filter certificates by search term and status filter
  const filteredCertificates = certificates.filter(cert => {
    const isApproved = cert.approvalStatus === 'approved' || Boolean(cert.approvedByName && cert.approvedDate);
    const isPending = !isApproved;

    // Status filter
    if (statusFilter === 'approved' && !isApproved) return false;
    if (statusFilter === 'pending' && !isPending) return false;

    // Search filter
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchesReport = cert.reportNumber?.toLowerCase().includes(term);
    const matchesClient = cert.client?.toLowerCase().includes(term);
    const matchesIssuer = (cert.issuerName || cert.responsibleName)?.toLowerCase().includes(term);
    const matchesApprover = (cert.approvedByName || cert.approvedBy)?.toLowerCase().includes(term);
    const matchesTank = cert.tanks?.some(t => 
      t.equipmentNumber?.toLowerCase().includes(term) ||
      t.description?.toLowerCase().includes(term) ||
      t.product?.toLowerCase().includes(term)
    );
    return matchesReport || matchesClient || matchesIssuer || matchesApprover || matchesTank;
  });

  // Re-generate and download PDF for any saved certificate
  const handleDownloadPDF = async (cert: DecontaminationCertificate) => {
    try {
      const logoBase64 = await getLogoBase64(logoUrl);
      const doc = generateDecontaminationCertificatePDF(cert, logoBase64);
      const fileName = getCertificatePdfFileName(cert);
      doc.save(fileName);
    } catch (err: any) {
      console.error("Erro ao gerar PDF para download:", err);
      setFeedbackNotification({
        type: 'error',
        title: 'Erro ao Gerar PDF',
        message: 'Não foi possível gerar o arquivo PDF. Verifique os dados do certificado.'
      });
    }
  };

  // Open interactive PDF viewer modal
  const handleOpenPdfPreview = async (cert: DecontaminationCertificate) => {
    setPreviewCert(cert);
    setIsLoadingPreview(true);
    try {
      if (cert.pdfDataUri) {
        setPreviewPdfUri(cert.pdfDataUri);
      } else {
        const logoBase64 = await getLogoBase64(logoUrl);
        const doc = generateDecontaminationCertificatePDF(cert, logoBase64);
        const dataUri = doc.output('datauristring');
        setPreviewPdfUri(dataUri);
      }
    } catch (err: any) {
      console.error("Erro ao preparar visualização do PDF:", err);
      setFeedbackNotification({
        type: 'error',
        title: 'Erro ao Visualizar PDF',
        message: 'Não foi possível gerar a pré-visualização do PDF.'
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Click on Approve button -> opens in-app confirmation modal
  const handleApproveClick = (cert: DecontaminationCertificate) => {
    if (!canApprove) {
      setFeedbackNotification({
        type: 'error',
        title: 'Permissão Insuficiente',
        message: 'Apenas Administradores e Moderadores podem aprovar certificados de descontaminação.'
      });
      return;
    }
    setConfirmApproveCert(cert);
  };

  // Execute approval in Firestore
  const executeApprove = async () => {
    if (!confirmApproveCert || !onApproveCertificate) return;

    setIsApproving(true);
    setApprovingId(confirmApproveCert.id);
    try {
      await onApproveCertificate(confirmApproveCert.id, currentUserName, currentUserId);
      const now = new Date();
      const approvedCert: DecontaminationCertificate = {
        ...confirmApproveCert,
        approvalStatus: 'approved',
        approvedByName: currentUserName,
        approvedById: currentUserId,
        approvedDate: now.toISOString().slice(0, 10),
        approvedTime: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        approvedBy: currentUserName
      };

      if (detailsCert && detailsCert.id === confirmApproveCert.id) {
        setDetailsCert(approvedCert);
      }

      setConfirmApproveCert(null);

      // Download PDF automatically and display success notification
      try {
        await handleDownloadPDF(approvedCert);
      } catch (e) {
        console.warn("Auto-download PDF failed:", e);
      }

      setFeedbackNotification({
        type: 'success',
        title: 'Certificado Aprovado com Sucesso!',
        message: `O Certificado ${confirmApproveCert.reportNumber} foi aprovado oficialmente por ${currentUserName}. O status e os registros de auditoria foram salvos no banco de dados.`,
        approvedCertToDownload: approvedCert
      });
    } catch (err: any) {
      console.error("Erro ao aprovar certificado:", err);
      setFeedbackNotification({
        type: 'error',
        title: 'Erro na Aprovação',
        message: `Não foi possível aprovar o certificado: ${err?.message || 'Falha de comunicação com o banco de dados'}`
      });
    } finally {
      setIsApproving(false);
      setApprovingId(null);
    }
  };

  // Click on Delete button
  const handleDeleteClick = (cert: DecontaminationCertificate) => {
    if (!canDelete) {
      setFeedbackNotification({
        type: 'error',
        title: 'Permissão Insuficiente',
        message: 'Apenas Administradores e Moderadores podem solicitar ou executar exclusões de certificados.'
      });
      return;
    }

    if (isModerator) {
      // Moderator opens permanent deletion confirmation modal
      setConfirmDeleteCert(cert);
    } else if (isAdmin) {
      // Admin requests deletion via standard modal
      if (onRequestDelete) {
        onRequestDelete(
          'Certificado de Descontaminação',
          cert.id,
          'decontaminationCertificates',
          `Certificado ${cert.reportNumber}`
        );
      }
    }
  };

  // Execute deletion in Firestore (Moderator)
  const executeDelete = async () => {
    if (!confirmDeleteCert || !onDeleteCertificate) return;

    setIsDeleting(true);
    setDeletingId(confirmDeleteCert.id);
    try {
      await onDeleteCertificate(confirmDeleteCert.id);
      if (detailsCert && detailsCert.id === confirmDeleteCert.id) {
        setDetailsCert(null);
      }
      if (previewCert && previewCert.id === confirmDeleteCert.id) {
        setPreviewCert(null);
      }

      const reportNumber = confirmDeleteCert.reportNumber;
      setConfirmDeleteCert(null);

      setFeedbackNotification({
        type: 'success',
        title: 'Certificado Excluído',
        message: `O Certificado ${reportNumber} foi excluído permanentemente do histórico.`
      });
    } catch (err: any) {
      console.error("Erro ao excluir certificado:", err);
      setFeedbackNotification({
        type: 'error',
        title: 'Erro na Exclusão',
        message: `Não foi possível excluir o certificado: ${err?.message || 'Falha de comunicação com o banco de dados'}`
      });
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-6xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
          {/* Header Bar */}
          <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 border border-blue-400/30 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 bg-blue-950 px-2.5 py-0.5 rounded-md border border-blue-800/60">
                  Documentação e Auditoria Oficial
                </span>
                <h2 className="text-xl font-black text-white tracking-tight uppercase mt-0.5">
                  Histórico de Certificados de Descontaminação
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

          {/* Search, Filter & Stats Bar */}
          <div className="p-6 bg-slate-50 dark:bg-slate-850 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por Nº (ex: OEG.001.2026), Cliente, Tanque, Emissor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Todos ({certificates.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  statusFilter === 'approved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Aprovados ({certificates.filter(c => c.approvalStatus === 'approved' || (!c.approvalStatus && c.approvedBy)).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Aguardando ({certificates.filter(c => c.approvalStatus === 'pending_approval').length})
              </button>
            </div>
          </div>

          {/* List Table */}
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            {filteredCertificates.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-bold space-y-3">
                <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-sm">Nenhum certificado emitido encontrado.</p>
                <p className="text-xs text-slate-500 font-normal">
                  Utilize o botão <span className="font-bold text-blue-600 dark:text-blue-400">"Novo Certificado"</span> no módulo de descontaminação para emitir um certificado oficial.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                <table className="w-full text-left text-xs font-bold">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3.5">Nº Relatório</th>
                      <th className="p-3.5">Cliente</th>
                      <th className="p-3.5">Tanques Inclusos</th>
                      <th className="p-3.5">Emissor (Data/Hora)</th>
                      <th className="p-3.5">Aprovador (Data/Hora)</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredCertificates.map(cert => {
                      const isApproved = cert.approvalStatus === 'approved' || Boolean(cert.approvedByName && cert.approvedDate);
                      const isPending = !isApproved;
                      const issuerDisplay = cert.issuerName || cert.responsibleName || 'Inspetor OEG';
                      const issuerDateDisplay = formatCertificateDate(cert.issueDate || cert.createdAt);
                      const issuerTimeDisplay = cert.issueTime || '';

                      const approverDisplay = cert.approvedByName || cert.approvedBy;
                      const approverDateDisplay = cert.approvedDate ? formatCertificateDate(cert.approvedDate) : '';
                      const approverTimeDisplay = cert.approvedTime || '';

                      const tankCount = cert.tankCount || cert.tanks?.length || 0;

                      return (
                        <tr key={cert.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3.5 text-blue-600 dark:text-blue-400 font-black uppercase tracking-wider">
                            <button
                              type="button"
                              onClick={() => setDetailsCert(cert)}
                              className="hover:underline flex items-center gap-1.5 text-left"
                              title="Consultar dados do certificado"
                            >
                              <span>{cert.reportNumber}</span>
                              <Info className="w-3 h-3 text-slate-400 hover:text-blue-500 shrink-0" />
                            </button>
                          </td>
                          <td className="p-3.5 text-slate-900 dark:text-white uppercase font-black">
                            {cert.client || '—'}
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-col gap-1 max-w-xs">
                              <span className="text-[10px] text-slate-500 font-bold">
                                {tankCount} {tankCount === 1 ? 'tanque' : 'tanques'}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {(cert.tanks || []).slice(0, 3).map((t, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md text-[10px] font-black uppercase"
                                  >
                                    {t.equipmentNumber}
                                  </span>
                                ))}
                                {(cert.tanks || []).length > 3 && (
                                  <span className="text-[10px] text-slate-400 font-bold self-center">
                                    +{(cert.tanks || []).length - 3} mais
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-600 dark:text-slate-300">
                            <div className="font-bold text-slate-900 dark:text-white">{issuerDisplay}</div>
                            <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{issuerDateDisplay} {issuerTimeDisplay && `às ${issuerTimeDisplay}`}</span>
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-600 dark:text-slate-300">
                            {approverDisplay ? (
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{approverDisplay}</div>
                                <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                  <span>{approverDateDisplay || issuerDateDisplay} {approverTimeDisplay && `às ${approverTimeDisplay}`}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic font-normal">Aguardando aprovação</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            {isPending ? (
                              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Aguardando
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Aprovado
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Action: Approve if pending (Prominent) */}
                              {isPending && canApprove && onApproveCertificate && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveClick(cert)}
                                  disabled={approvingId === cert.id}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                                  title="Aprovar certificado oficialmente"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{approvingId === cert.id ? 'Aprovando...' : 'Aprovar'}</span>
                                </button>
                              )}

                              {/* Action: Consultar Dados */}
                              <button
                                type="button"
                                onClick={() => setDetailsCert(cert)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                                title="Consultar todos os dados do certificado"
                              >
                                <Info className="w-3.5 h-3.5 text-blue-500" />
                                <span className="hidden xl:inline">Dados</span>
                              </button>

                              {/* Action: Visualizar PDF */}
                              <button
                                type="button"
                                onClick={() => handleOpenPdfPreview(cert)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                                title="Visualizar PDF na tela"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="hidden sm:inline">Ver PDF</span>
                              </button>

                              {/* Action: Baixar PDF */}
                              <button
                                type="button"
                                onClick={() => handleDownloadPDF(cert)}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                                title="Baixar PDF com nome oficial"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Baixar</span>
                              </button>

                              {/* Action: Delete if permitted (Admin requests, Moderator executes) */}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(cert)}
                                  disabled={deletingId === cert.id}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-40 cursor-pointer"
                                  title={isModerator ? "Excluir certificado do histórico" : "Solicitar exclusão do certificado ao Moderador"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500 font-bold">
              Exibindo <span className="text-slate-900 dark:text-white font-black">{filteredCertificates.length}</span> de <span className="text-slate-900 dark:text-white font-black">{certificates.length}</span> certificados registrados
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider rounded-2xl transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: VISUALIZAR PDF INTERATIVO */}
      {/* ========================================================================= */}
      {previewCert && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">
                    Visualização do Certificado: {previewCert.reportNumber}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {previewCert.client} • {previewCert.tankCount || previewCert.tanks?.length || 1} Tanque(s)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPDF(previewCert)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewCert(null);
                    setPreviewPdfUri(null);
                  }}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Iframe */}
            <div className="flex-1 bg-slate-950 p-2 overflow-hidden flex items-center justify-center">
              {isLoadingPreview ? (
                <div className="text-center text-white space-y-2">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-400">Renderizando PDF oficial...</p>
                </div>
              ) : previewPdfUri ? (
                <iframe
                  src={previewPdfUri}
                  title={`Certificado ${previewCert.reportNumber}`}
                  className="w-full h-full rounded-xl border border-slate-800 shadow-inner bg-white"
                />
              ) : (
                <div className="text-center text-slate-400 font-bold space-y-2">
                  <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
                  <p className="text-sm">Não foi possível carregar o arquivo PDF.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONSULTAR DADOS DO CERTIFICADO */}
      {/* ========================================================================= */}
      {detailsCert && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 font-black">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800/60">
                      Registro de Auditoria
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      detailsCert.approvalStatus === 'approved' || (!detailsCert.approvalStatus && detailsCert.approvedBy)
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                        : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                    }`}>
                      {detailsCert.approvalStatus === 'approved' || (!detailsCert.approvalStatus && detailsCert.approvedBy) ? 'Aprovado' : 'Aguardando Aprovação'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight mt-0.5">
                    Certificado {detailsCert.reportNumber}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailsCert(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
              {/* Top Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-blue-500" />
                    Cliente Destinatário
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white uppercase">
                    {detailsCert.client}
                  </span>
                  <div className="text-[11px] text-slate-500 font-bold mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {detailsCert.inspectionLocation || 'Base Operacional Macaé'}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-blue-500" />
                    Responsável Emissor
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {detailsCert.issuerName || detailsCert.responsibleName || 'Inspetor OEG'}
                  </span>
                  <div className="text-[11px] text-slate-500 font-bold mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {formatCertificateDate(detailsCert.issueDate || detailsCert.createdAt)} {detailsCert.issueTime && `às ${detailsCert.issueTime}`}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    Responsável Aprovador
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {detailsCert.approvedByName || detailsCert.approvedBy || (
                      <span className="text-amber-500 italic font-normal text-xs">Pendente de aprovação</span>
                    )}
                  </span>
                  {detailsCert.approvedDate && (
                    <div className="text-[11px] text-slate-500 font-bold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      {formatCertificateDate(detailsCert.approvedDate)} {detailsCert.approvedTime && `às ${detailsCert.approvedTime}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Tanques Inclusos */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Container className="w-4 h-4 text-blue-500" />
                  Tanques Inspecionados ({detailsCert.tanks?.length || 0})
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs font-bold">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-3 w-12 text-center">Item</th>
                        <th className="p-3">Nº do Tanque</th>
                        <th className="p-3">Modelo / Descrição</th>
                        <th className="p-3">Último Produto</th>
                        <th className="p-3 text-center">Data Descontaminação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {(detailsCert.tanks || []).map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 text-center text-slate-400 font-black">{idx + 1}</td>
                          <td className="p-3 text-blue-600 dark:text-blue-400 font-black uppercase">{t.equipmentNumber}</td>
                          <td className="p-3 text-slate-800 dark:text-slate-200 uppercase">{t.description}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 uppercase font-bold">{t.product ? t.product.toUpperCase() : '—'}</td>
                          <td className="p-3 text-center text-slate-700 dark:text-slate-300">{formatCertificateDate(t.decontaminationDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Checklist Visual */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Resultado da Inspeção Visual (Checklist de Conformidade)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {CHECKLIST_ITEMS.map(item => {
                    const status = detailsCert.checklist?.[item.key] || 'OK';
                    return (
                      <div
                        key={item.key}
                        className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col justify-between"
                      >
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight mb-2">
                          {item.label}
                        </span>
                        <span
                          className={`self-start px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            status === 'OK'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : status === 'N/A'
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Observações Gerais */}
              {detailsCert.generalNotes && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Parecer Técnico / Observações Gerais
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {detailsCert.generalNotes}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                {detailsCert.approvalStatus !== 'approved' && !detailsCert.approvedByName && canApprove && onApproveCertificate && (
                  <button
                    type="button"
                    onClick={() => handleApproveClick(detailsCert)}
                    disabled={approvingId === detailsCert.id}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{approvingId === detailsCert.id ? 'Aprovando...' : 'Aprovar Certificado'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenPdfPreview(detailsCert)}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-emerald-500" />
                  <span>Visualizar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPDF(detailsCert)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar PDF</span>
                </button>

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(detailsCert)}
                    disabled={deletingId === detailsCert.id}
                    className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all disabled:opacity-40 cursor-pointer"
                    title={isModerator ? "Excluir certificado do histórico" : "Solicitar exclusão do certificado ao Moderador"}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>
                      {deletingId === detailsCert.id 
                        ? 'Excluindo...' 
                        : isModerator 
                        ? 'Excluir' 
                        : 'Solicitar Exclusão'}
                    </span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDetailsCert(null)}
                className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs uppercase rounded-xl transition-all cursor-pointer"
              >
                Fechar Consulta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Modal Visual de Confirmação de Aprovação */}
      {confirmApproveCert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Confirmar Aprovação Técnica</h3>
                  <p className="text-xs text-slate-400">Validação oficial e geração de assinatura</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isApproving && setConfirmApproveCert(null)}
                disabled={isApproving}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase">Certificado:</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white">{confirmApproveCert.reportNumber}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase">Cliente:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{confirmApproveCert.client}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase">Tanques ({confirmApproveCert.tanks?.length || 0}):</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {confirmApproveCert.tanks?.map(t => t.equipmentNumber).join(', ') || 'Nenhum'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase">Emissor Técnico:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {confirmApproveCert.issuerName || confirmApproveCert.responsibleName || 'Inspetor OEG'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  <span className="font-bold block mb-0.5">Aprovador Responsável: {currentUserName}</span>
                  Ao confirmar, o certificado receberá o status <strong>"Aprovado"</strong> com data/hora registradas e o PDF com carimbo de aprovação será emitido.
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmApproveCert(null)}
                disabled={isApproving}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase rounded-xl transition-all disabled:opacity-40 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeApprove}
                disabled={isApproving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-60 cursor-pointer"
              >
                {isApproving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Aprovando no Banco...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar Aprovação</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Visual de Confirmação de Exclusão (Moderador) */}
      {confirmDeleteCert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 bg-rose-950 text-white flex items-center justify-between border-b border-rose-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/30 text-rose-400 border border-rose-500/40 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Confirmar Exclusão de Certificado</h3>
                  <p className="text-xs text-rose-300">Ação irreversível de Moderador</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setConfirmDeleteCert(null)}
                disabled={isDeleting}
                className="p-1.5 text-rose-300 hover:text-white rounded-lg hover:bg-rose-900/50 transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase">Relatório:</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400">{confirmDeleteCert.reportNumber}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase">Cliente:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{confirmDeleteCert.client}</span>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed">
                  Tem certeza de que deseja excluir permanentemente o <strong>Certificado {confirmDeleteCert.reportNumber}</strong>? Todos os dados vinculados a este documento serão excluídos do banco de dados.
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteCert(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase rounded-xl transition-all disabled:opacity-40 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase rounded-xl flex items-center gap-2 transition-all shadow-md shadow-rose-600/20 disabled:opacity-60 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Excluindo do Banco...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Visual de Feedback (Sucesso / Erro) */}
      {feedbackNotification && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-150">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
              feedbackNotification.type === 'success'
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : feedbackNotification.type === 'error'
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                : 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
            }`}>
              {feedbackNotification.type === 'success' ? (
                <CheckCircle2 className="w-7 h-7" />
              ) : feedbackNotification.type === 'error' ? (
                <AlertCircle className="w-7 h-7" />
              ) : (
                <Info className="w-7 h-7" />
              )}
            </div>

            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase mb-2">
              {feedbackNotification.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              {feedbackNotification.message}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
              {feedbackNotification.approvedCertToDownload && (
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadPDF(feedbackNotification.approvedCertToDownload!);
                  }}
                  className="w-full sm:flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar PDF</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setFeedbackNotification(null)}
                className="w-full sm:flex-1 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer"
              >
                OK / Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
