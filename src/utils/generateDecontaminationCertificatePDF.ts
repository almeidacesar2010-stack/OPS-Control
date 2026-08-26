import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  DecontaminationCertificate, 
  CHECKLIST_ITEMS, 
  OBJECTIVE_TEXT, 
  InspectionStatus 
} from '../types/decontamination';

export function formatCertificateDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const cleanDate = dateStr.slice(0, 10);
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year && month && day && year.length === 4) {
        return `${day}/${month}/${year}`;
      }
    }
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

/**
 * Clean date for safe file names in DD.MM.AAAA format (e.g. "14.08.2026")
 */
export function formatDateForFileName(dateStr?: string): string {
  const display = formatCertificateDate(dateStr);
  if (display === '—') return format(new Date(), 'dd.MM.yyyy');
  return display.replace(/[\/\-]/g, '.');
}

/**
 * Removes "TANQUE DE", "TANQUES DE", "TANQUE" prefix and returns clean model/capacity name
 */
export function cleanModelName(rawModel: string): string {
  let model = (rawModel || '').trim().toUpperCase();
  // Strip leading "TANQUE DE ", "TANQUES DE ", "TANQUE ", "TANQUES "
  model = model.replace(/^TANQUES?\s+DE\s+/i, '');
  model = model.replace(/^TANQUES?\s+/i, '');
  model = model.trim().replace(/[/\\?%*:|"<>]/g, '-');
  return model || 'TANQUE';
}

/**
 * Calculates next sequential report number: OEG.XXX.AAAA (e.g. OEG.001.2026)
 * - Automatically detects year.
 * - Auto-resets to 001 when a new year begins.
 * - Guarantees sequentiality and uniqueness.
 */
export function getNextReportNumber(
  existingCertificates: DecontaminationCertificate[] = [], 
  targetYear?: number
): {
  reportNumber: string;
  sequenceNumber: number;
  year: number;
} {
  const currentYear = targetYear || new Date().getFullYear();
  let maxSeq = 0;

  for (const cert of existingCertificates) {
    let certYear = cert.year;
    let certSeq = cert.sequenceNumber;

    if (!certSeq || !certYear) {
      if (cert.reportNumber) {
        // Regex matches OEG.001.2026 or OEG.1.2026 or CERT-20260813-1234
        const oegMatch = cert.reportNumber.match(/OEG\.(\d+)\.(\d{4})/i);
        if (oegMatch) {
          certSeq = parseInt(oegMatch[1], 10);
          certYear = parseInt(oegMatch[2], 10);
        }
      }
    }

    if (certYear === currentYear && certSeq && certSeq > maxSeq) {
      maxSeq = certSeq;
    }
  }

  const nextSeq = maxSeq + 1;
  const paddedSeq = String(nextSeq).padStart(3, '0');
  const reportNumber = `OEG.${paddedSeq}.${currentYear}`;

  return {
    reportNumber,
    sequenceNumber: nextSeq,
    year: currentYear
  };
}

/**
 * Generates exact PDF filename following official company procedure:
 * Format: [NUMERO_RELATORIO] - Limpeza e Descontaminação - [TANQUES] - [CAPACIDADE] - [CLIENTE] - [DATA].pdf
 *
 * Exemplo:
 * OEG.008.2026 - Limpeza e Descontaminação - HMHU920449, HMHU920566, HMHU920593 - 5000L - [CLIENTE] - 26.08.2026.pdf
 * OEG.009.2026 - Limpeza e Descontaminação - ABC123, ABC456 - 1500L - PETROBRAS - 27.08.2026.pdf
 *
 * ORDEM OBRIGATÓRIA:
 * 1. [Nº DO CERTIFICADO] (ex: OEG.008.2026)
 * 2. [TIPO] (Limpeza e Descontaminação)
 * 3. [EQUIPAMENTOS] (ex: HMHU920449, HMHU920566, HMHU920593)
 * 4. [CAPACIDADE] (ex: 5000L)
 * 5. [CLIENTE] (ex: PETROBRAS - exatamente o cadastrado no sistema, sem abreviar)
 * 6. [DATA] (ex: 26.08.2026)
 */
export function getCertificatePdfFileName(cert: DecontaminationCertificate, clientOverride?: string): string {
  const reportNum = (cert.reportNumber || 'OEG.001.2026').trim().toUpperCase().replace(/[/\\?%*:|"<>]/g, '-');
  const dateFormatted = formatDateForFileName(cert.issueDate || cert.issuedAt);
  const tanks = cert.tanks || [];

  // Extract, clean, and sort tank numbers in ascending alphanumeric order
  const tankNumbers = tanks
    .map(t => (t.equipmentNumber || '').trim().toUpperCase().replace(/[/\\?%*:|"<>]/g, '-'))
    .filter(Boolean);

  tankNumbers.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const tanksStr = tankNumbers.length > 0 ? tankNumbers.join(', ') : 'SEM-TANQUE';

  // Extract, clean, deduplicate, and sort models in ascending alphanumeric order
  const uniqueModels: string[] = [];
  tanks.forEach(t => {
    const rawModel = (t.description || '').trim();
    if (rawModel) {
      const cleanModel = cleanModelName(rawModel);
      if (cleanModel && !uniqueModels.includes(cleanModel)) {
        uniqueModels.push(cleanModel);
      }
    }
  });

  uniqueModels.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  let modelStr = 'TANQUE';
  if (uniqueModels.length === 1) {
    modelStr = uniqueModels[0];
  } else if (uniqueModels.length > 1) {
    modelStr = uniqueModels.join(' + ');
  }

  // Exact client name registered in the system (without abbreviation)
  const rawClient = (clientOverride || cert.client || '').trim();
  const clientClean = rawClient ? rawClient.replace(/[/\\?%*:|"<>]/g, '-').trim() : 'CLIENTE';

  // MANDATORY ORDER: [Nº] - Limpeza e Descontaminação - [EQUIPAMENTOS] - [CAPACIDADE] - [CLIENTE] - [DATA].pdf
  return `${reportNum} - Limpeza e Descontaminação - ${tanksStr} - ${modelStr} - ${clientClean} - ${dateFormatted}.pdf`;
}

/**
 * Converts image url or default svg to base64 data url for embedding in jsPDF
 */
export async function getLogoBase64(url?: string | null): Promise<string | null> {
  const targetUrl = url || '/oeg-logo.svg';
  if (!targetUrl) return null;

  const trimmed = targetUrl.trim();
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // If http or relative, try fetch blob first
  try {
    const res = await fetch(trimmed);
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (fetchErr) {
    // Fallback to Image element
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 240;
          canvas.height = img.naturalHeight || 240;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
          } else {
            resolve(null);
          }
        } catch (e) {
          console.warn('Canvas conversion failed for logo:', e);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = trimmed;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Converts digital signature image (URL, data URI, or raw base64) to clean base64 data URL for jsPDF
 */
export async function getSignatureBase64(url?: string | null): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;
  let trimmed = url.trim();
  if (!trimmed) return null;

  // 1. If it's already a full data URI, return immediately
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // 2. If it's raw base64 without prefix
  if (!trimmed.startsWith('http') && !trimmed.startsWith('blob:') && !trimmed.startsWith('data:')) {
    if (trimmed.length > 50) {
      return `data:image/png;base64,${trimmed}`;
    }
  }

  // 3. If it's an HTTP or blob URL, try fetch blob -> FileReader first
  if (trimmed.startsWith('http') || trimmed.startsWith('blob:')) {
    try {
      const res = await fetch(trimmed, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (dataUrl && dataUrl.startsWith('data:image/')) {
          return dataUrl;
        }
      }
    } catch (e) {
      // Fetch failed, try Image canvas fallback
    }
  }

  // 4. Fallback using Image + Canvas
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      const timeout = setTimeout(() => {
        resolve(trimmed.startsWith('data:') ? trimmed : null);
      }, 3000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          const maxW = 400;
          const maxH = 150;
          let w = img.naturalWidth || 320;
          let h = img.naturalHeight || 100;

          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }

          canvas.width = Math.max(w, 1);
          canvas.height = Math.max(h, 1);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(trimmed.startsWith('data:') ? trimmed : null);
          }
        } catch (e) {
          console.warn('Canvas conversion failed for signature:', e);
          resolve(trimmed.startsWith('data:') ? trimmed : null);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(trimmed.startsWith('data:') ? trimmed : null);
      };

      img.src = trimmed;
    } catch {
      resolve(trimmed.startsWith('data:') ? trimmed : null);
    }
  });
}

export function generateDecontaminationCertificatePDF(
  cert: DecontaminationCertificate,
  logoBase64?: string | null,
  signatureBase64?: string | null
): jsPDF {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let currentY = 12;

  // Outer Framing Border (Dark Navy double border matching official certificate)
  doc.setDrawColor(15, 23, 42); // #0F172A
  doc.setLineWidth(0.7);
  doc.rect(margin - 4, margin - 4, pageWidth - (margin - 4) * 2, pageHeight - (margin - 4) * 2);

  // Subtle inner border line
  doc.setDrawColor(226, 232, 240); // #E2E8F0
  doc.setLineWidth(0.2);
  doc.rect(margin - 2, margin - 2, pageWidth - (margin - 2) * 2, pageHeight - (margin - 2) * 2);

  // ==========================================
  // 1. TOP HEADER BANNER
  // ==========================================
  const headerHeight = 22;
  doc.setFillColor(11, 25, 44); // Deep Navy (#0B192C)
  doc.rect(margin, currentY, pageWidth - margin * 2, headerHeight, 'F');

  // Top Left Company Logo
  const logoX = margin + 5;
  const logoY = currentY + 3;
  const logoWidth = 16;
  const logoHeight = 16;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight, undefined, 'FAST');
    } catch (e) {
      console.warn("Could not draw logo image in PDF:", e);
      // Fallback vector OEG logo badge
      doc.setFillColor(0, 71, 255); // #0047FF OEG Blue
      doc.roundedRect(logoX, logoY, logoWidth, logoHeight, 2.5, 2.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text("oeg", logoX + logoWidth / 2, logoY + 11, { align: 'center' });
    }
  } else {
    // Default official OEG logo badge in top-left
    doc.setFillColor(0, 71, 255); // #0047FF OEG Blue
    doc.roundedRect(logoX, logoY, logoWidth, logoHeight, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text("oeg", logoX + logoWidth / 2, logoY + 11, { align: 'center' });
  }

  // Document Title (Centered with both lines in white font)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text("CERTIFICADO DE DESCONTAMINAÇÃO", pageWidth / 2, currentY + 8.5, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text("E LIMPEZA DE TANQUES", pageWidth / 2, currentY + 15.5, { align: 'center' });

  currentY += headerHeight + 5;

  // ==========================================
  // 2. METADATA INFORMATION BLOCK (WITH FULL AUDIT TRAIL)
  // ==========================================
  const metaBoxHeight = 26;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, metaBoxHeight, 1.5, 1.5, 'FD');

  const issuerDisplayName = cert.issuerName || cert.responsibleName || 'Inspetor Técnico';
  const issueDateStr = formatCertificateDate(cert.issueDate || cert.issuedAt);

  const isApproved = cert.approvalStatus === 'approved';
  const approverDisplayName = isApproved 
    ? (cert.approvedByName || cert.approvedBy || 'Aprovador')
    : 'Aguardando Aprovação';
  const approverJobTitle = isApproved
    ? (cert.approvedByJobTitle || 'Aprovador')
    : '';
  const approvalDateStr = isApproved
    ? formatCertificateDate(cert.approvedDate || cert.issueDate || cert.issuedAt)
    : 'Pendente';

  // Left Column
  const col1X = margin + 5;
  doc.setFontSize(7.5);

  // Row 1 Left
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("Nº RELATÓRIO:", col1X, currentY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 71, 255); // OEG Blue
  doc.text(cert.reportNumber || '—', col1X + 27, currentY + 5.5);

  // Row 2 Left
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("DATA DE EMISSÃO:", col1X, currentY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(issueDateStr, col1X + 32, currentY + 11.5);

  // Row 3 Left
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("RESP. EMISSOR:", col1X, currentY + 17.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(issuerDisplayName, col1X + 28, currentY + 17.5);

  // Row 4 Left (Status)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("STATUS:", col1X, currentY + 23.5);
  if (isApproved) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // Green
    doc.text("APROVADO / CONFORME", col1X + 17, currentY + 23.5);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(217, 119, 6); // Amber
    doc.text("AGUARDANDO APROVAÇÃO", col1X + 17, currentY + 23.5);
  }

  // Right Column
  const col2X = margin + 98;

  // Row 1 Right
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("CLIENTE:", col2X, currentY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text((cert.client || '—').toUpperCase(), col2X + 17, currentY + 5.5);

  // Row 2 Right
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("LOCAL INSPEÇÃO:", col2X, currentY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(cert.inspectionLocation || 'Base OEG do Brasil - Macaé/RJ', col2X + 28, currentY + 11.5);

  // Row 3 Right
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("RESP. APROVADOR:", col2X, currentY + 17.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(isApproved ? 51 : 180, isApproved ? 65 : 83, isApproved ? 85 : 9);
  doc.text(approverDisplayName, col2X + 32, currentY + 17.5);

  // Row 4 Right
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("DATA APROVAÇÃO:", col2X, currentY + 23.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(approvalDateStr, col2X + 32, currentY + 23.5);

  currentY += metaBoxHeight + 5;

  // ==========================================
  // SECTION 1: OBJETIVO
  // ==========================================
  const sectionHeaderHeight = 5.5;
  const navyBlue = [22, 46, 97] as const; // #162E61 Royal Navy

  doc.setFillColor(...navyBlue);
  doc.rect(margin, currentY, pageWidth - margin * 2, sectionHeaderHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text("1. OBJETIVO", margin + 4, currentY + 3.8);

  currentY += sectionHeaderHeight;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, currentY, pageWidth - margin * 2, 8, 'FD');
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(cert.objective || OBJECTIVE_TEXT, margin + 4, currentY + 5.2);

  currentY += 8 + 4;

  // ==========================================
  // SECTION 2: LISTA DE TANQUES LIMPOS E DESCONTAMINADOS
  // ==========================================
  doc.setFillColor(...navyBlue);
  doc.rect(margin, currentY, pageWidth - margin * 2, sectionHeaderHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text("2. LISTA DE TANQUES LIMPOS E DESCONTAMINADOS", margin + 4, currentY + 3.8);

  currentY += sectionHeaderHeight;

  const tanksTableBody = (cert.tanks || []).map(t => [
    (t.description || 'TANQUE DE ARMAZENAMENTO').toUpperCase(),
    (t.equipmentNumber || '').toUpperCase(),
    (t.product || 'NÃO INFORMADO').toUpperCase(),
    formatCertificateDate(t.decontaminationDate)
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Descrição', 'Nº Tanque', 'Produto antes da Descontaminação', 'Data Descontaminação']],
    body: tanksTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      lineWidth: 0.2,
      lineColor: [203, 213, 225]
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      lineWidth: 0.2,
      lineColor: [226, 232, 240]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 35, fontStyle: 'bold' },
      2: { cellWidth: 55 },
      3: { cellWidth: 46, halign: 'center' }
    },
    tableLineColor: [203, 213, 225],
    tableLineWidth: 0.2
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 4;

  // ==========================================
  // SECTION 3: INSPEÇÃO VISUAL FINAL
  // ==========================================
  doc.setFillColor(...navyBlue);
  doc.rect(margin, currentY, pageWidth - margin * 2, sectionHeaderHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text("3. INSPEÇÃO VISUAL FINAL - CONDIÇÃO GERAL DO EQUIPAMENTO", margin + 4, currentY + 3.8);

  currentY += sectionHeaderHeight;

  const totalItems = CHECKLIST_ITEMS.length;
  const midPoint = Math.ceil(totalItems / 2);
  const checklistRows: string[][] = [];
  for (let i = 0; i < midPoint; i++) {
    const item1 = CHECKLIST_ITEMS[i];
    const item2 = CHECKLIST_ITEMS[i + midPoint];

    const val1 = item1 && cert.checklist ? (cert.checklist[item1.key] || 'OK') : 'OK';
    const val2 = item2 && cert.checklist ? (cert.checklist[item2.key] || 'OK') : '';

    checklistRows.push([
      item1 ? item1.label : '',
      item1 ? val1 : '',
      item2 ? item2.label : '',
      item2 ? val2 : ''
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Item de Inspeção', 'Status', 'Item de Inspeção', 'Status']],
    body: checklistRows,
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.5,
      lineWidth: 0.2,
      lineColor: [203, 213, 225]
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      lineWidth: 0.2,
      lineColor: [226, 232, 240]
    },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 33, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 60, fontStyle: 'bold' },
      3: { cellWidth: 33, halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && (data.column.index === 1 || data.column.index === 3)) {
        const val = String(data.cell.raw);
        if (val === 'OK') {
          data.cell.styles.textColor = [16, 185, 129]; // Green (#10B981)
        } else if (val === 'Não OK') {
          data.cell.styles.textColor = [225, 29, 72]; // Red (#E11D48)
        } else {
          data.cell.styles.textColor = [100, 116, 139]; // Slate (#64748B)
        }
      }
    },
    tableLineColor: [203, 213, 225],
    tableLineWidth: 0.2
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 4;

  // ==========================================
  // SECTION 4: INFORMAÇÕES GERAIS E OBSERVAÇÕES
  // ==========================================
  doc.setFillColor(...navyBlue);
  doc.rect(margin, currentY, pageWidth - margin * 2, sectionHeaderHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text("4. INFORMAÇÕES GERAIS E OBSERVAÇÕES", margin + 4, currentY + 3.8);

  currentY += sectionHeaderHeight;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);

  const notesText = cert.generalNotes || 
    "Inspeção Visual realizada nas partes internas e externas do tanque, acessórios de funcionamento e plaquetas de identificação.\n" +
    "Os contentores não apresentam qualquer tipo de não conformidade.\n" +
    "Inspeção Visual realizada por OEG do Brasil.";

  const splitNotes = doc.splitTextToSize(notesText, pageWidth - margin * 2 - 8);
  const notesHeight = Math.max(14, splitNotes.length * 4 + 4);

  doc.rect(margin, currentY, pageWidth - margin * 2, notesHeight, 'FD');
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(splitNotes, margin + 4, currentY + 4.5);

  currentY += notesHeight + 4;

  // ==========================================
  // SECTION 5: CONCLUSÃO E APROVAÇÃO DA INSPEÇÃO
  // ==========================================
  doc.setFillColor(...navyBlue);
  doc.rect(margin, currentY, pageWidth - margin * 2, sectionHeaderHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text("5. CONCLUSÃO E APROVAÇÃO DA INSPEÇÃO", margin + 4, currentY + 3.8);

  currentY += sectionHeaderHeight;

  const conclusionBoxHeight = 24;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, currentY, pageWidth - margin * 2, conclusionBoxHeight, 'FD');

  if (isApproved) {
    // Green Conforme/Aprovado Badge
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.roundedRect(margin + 4, currentY + 4, 30, 16, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text("APROVADO", margin + 19, currentY + 13.5, { align: 'center' });

    // Parecer Final & Audit info
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text("PARECER: EQUIPAMENTO(S) APROVADO(S) E DESCONTAMINADO(S)", margin + 37, currentY + 6.5);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Emissor: ${issuerDisplayName} (${issueDateStr})`, margin + 37, currentY + 11);
    doc.text(`Aprovador: ${approverDisplayName}${approverJobTitle ? ` - ${approverJobTitle}` : ''}`, margin + 37, currentY + 15);
    doc.text(`Aprovação Digital: ${approvalDateStr}`, margin + 37, currentY + 19);
  } else {
    // Amber Aguardando Aprovação Badge
    doc.setFillColor(217, 119, 6); // Amber 600
    doc.roundedRect(margin + 4, currentY + 4, 30, 16, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text("AGUARDANDO", margin + 19, currentY + 10.5, { align: 'center' });
    doc.text("APROVAÇÃO", margin + 19, currentY + 15, { align: 'center' });

    // Parecer Final & Emissor info
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text("PARECER: SOLICITAÇÃO DE APROVAÇÃO TÉCNICA EMITIDA", margin + 37, currentY + 7);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Emissor: ${issuerDisplayName} (${issueDateStr})`, margin + 37, currentY + 12.5);
    doc.setTextColor(217, 119, 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`Status: Aguardando aprovação e assinatura digital do aprovador.`, margin + 37, currentY + 17.5);
  }

  // Signature Block
  const sigBoxWidth = 54;
  const sigBoxX = pageWidth - margin - sigBoxWidth - 4;

  const rawSig = signatureBase64 || cert.approvedBySignatureUrl || cert.issuerSignatureUrl;
  let finalSigData: string | null = null;
  if (rawSig && typeof rawSig === 'string' && rawSig.trim()) {
    const trimmed = rawSig.trim();
    if (!trimmed.startsWith('data:') && !trimmed.startsWith('http')) {
      finalSigData = `data:image/png;base64,${trimmed}`;
    } else {
      finalSigData = trimmed;
    }
  }

  if (isApproved) {
    // If digital signature image is provided, render it centered above the line
    if (finalSigData) {
      try {
        const sigImgW = 38;
        const sigImgH = 10.5;
        const sigImgX = sigBoxX + (sigBoxWidth - sigImgW) / 2;
        const sigImgY = currentY + 1.8;

        let imgFormat = 'PNG';
        if (finalSigData.startsWith('data:image/jpeg') || finalSigData.startsWith('data:image/jpg')) {
          imgFormat = 'JPEG';
        } else if (finalSigData.startsWith('data:image/webp')) {
          imgFormat = 'WEBP';
        }

        doc.addImage(finalSigData, imgFormat, sigImgX, sigImgY, sigImgW, sigImgH);
      } catch (sigErr) {
        console.warn("Could not embed signature image in PDF:", sigErr);
        try {
          const sigImgW = 38;
          const sigImgH = 10.5;
          const sigImgX = sigBoxX + (sigBoxWidth - sigImgW) / 2;
          const sigImgY = currentY + 1.8;
          (doc as any).addImage(finalSigData, sigImgX, sigImgY, sigImgW, sigImgH);
        } catch (fallbackErr) {
          console.warn("Secondary signature embedding failed:", fallbackErr);
        }
      }
    }

    // Signature Line
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.3);
    doc.line(sigBoxX, currentY + 13, sigBoxX + sigBoxWidth, currentY + 13);

    // Signer Full Name
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(approverDisplayName, sigBoxX + sigBoxWidth / 2, currentY + 16.5, { align: 'center' });

    // Signer Cargo / Job Title
    doc.setFontSize(5.8);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.text(approverJobTitle || 'Aprovador', sigBoxX + sigBoxWidth / 2, currentY + 19.5, { align: 'center' });

    // Digital Signature Timestamp Tag
    doc.setFontSize(5.2);
    doc.setTextColor(16, 185, 129); // Emerald
    doc.setFont('helvetica', 'bold');
    doc.text(`✓ ASSINADO DIGITALMENTE`, sigBoxX + sigBoxWidth / 2, currentY + 22.5, { align: 'center' });
  } else if (finalSigData) {
    // Certificate emitted with linked issuer signature, awaiting homologation
    try {
      const sigImgW = 38;
      const sigImgH = 10.5;
      const sigImgX = sigBoxX + (sigBoxWidth - sigImgW) / 2;
      const sigImgY = currentY + 1.8;

      let imgFormat: 'PNG' | 'JPEG' | 'WEBP' = 'PNG';
      if (finalSigData.startsWith('data:image/jpeg') || finalSigData.startsWith('data:image/jpg')) {
        imgFormat = 'JPEG';
      } else if (finalSigData.startsWith('data:image/webp')) {
        imgFormat = 'WEBP';
      }

      doc.addImage(finalSigData, imgFormat, sigImgX, sigImgY, sigImgW, sigImgH);
    } catch (sigErr) {
      console.warn("Could not embed issuer signature image in PDF:", sigErr);
      try {
        const sigImgW = 38;
        const sigImgH = 10.5;
        const sigImgX = sigBoxX + (sigBoxWidth - sigImgW) / 2;
        const sigImgY = currentY + 1.8;
        (doc as any).addImage(finalSigData, sigImgX, sigImgY, sigImgW, sigImgH);
      } catch (fallbackErr) {
        console.warn("Secondary issuer signature embedding failed:", fallbackErr);
      }
    }

    // Signature Line
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.3);
    doc.line(sigBoxX, currentY + 13, sigBoxX + sigBoxWidth, currentY + 13);

    // Emissor Full Name
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(issuerDisplayName, sigBoxX + sigBoxWidth / 2, currentY + 16.5, { align: 'center' });

    // Emissor Cargo / Job Title
    doc.setFontSize(5.8);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.text(cert.issuerJobTitle || 'Inspetor Técnico OEG', sigBoxX + sigBoxWidth / 2, currentY + 19.5, { align: 'center' });

    // Status Tag
    doc.setFontSize(5.2);
    doc.setTextColor(217, 119, 6); // Amber
    doc.setFont('helvetica', 'bold');
    doc.text(`EMISSÃO TÉCNICA ASSINADA`, sigBoxX + sigBoxWidth / 2, currentY + 22.5, { align: 'center' });
  } else {
    // Pending approval state without signature
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(sigBoxX, currentY + 13, sigBoxX + sigBoxWidth, currentY + 13);

    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text("Aguardando Assinatura Digital", sigBoxX + sigBoxWidth / 2, currentY + 17.5, { align: 'center' });

    doc.setFontSize(5.2);
    doc.setTextColor(217, 119, 6);
    doc.setFont('helvetica', 'bold');
    doc.text("PENDENTE DE APROVAÇÃO", sigBoxX + sigBoxWidth / 2, currentY + 21, { align: 'center' });
  }

  return doc;
}
