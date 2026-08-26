import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { OperationalChecklistData } from '../types/checklists';
import { CHECKLIST_TEMPLATES } from './checklistTemplates';

export function generateOperationalChecklistPDF(data: OperationalChecklistData, logoUrl?: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const template = CHECKLIST_TEMPLATES[data.modelType] || CHECKLIST_TEMPLATES.CCU;
  let currentY = 14;

  const drawPageBorder = (pageNum: number) => {
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.2);
    doc.rect(8, 8, 194, 281);

    // Top accent strip
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(8, 8, 194, 3, 'F');

    // Page footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`CHECKLIST OPERACIONAL • LAUDO TÉCNICO DE INSPEÇÃO • PÁGINA ${pageNum}`, 14, 285);
    doc.text(`DATA DE EMISSÃO: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 196 - 45, 285);
  };

  drawPageBorder(1);

  // Document Top Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(template.title, 14, currentY + 3);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFont('helvetica', 'normal');
  doc.text(`TIPO: ${(data.checklistType || 'ENTRADA / SAÍDA').toUpperCase()} • CÓDIGO: ${template.code} • STATUS: ${(data.status || 'CONCLUÍDO').toUpperCase()}`, 14, currentY + 8);
  doc.text(`EQUIPAMENTO: ${(data.equipmentTag || 'S/TAG').toUpperCase()} • CLIENTE: ${(data.clientName || 'NÃO DEFINIDO').toUpperCase()}`, 14, currentY + 12);

  currentY += 16;

  // I. DADOS DO CHECKLIST E IDENTIFICAÇÃO DO ATIVO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('I. DADOS DO CHECKLIST E IDENTIFICAÇÃO DO EQUIPAMENTO', 14, currentY);
  currentY += 3;

  const infoRows = [
    [
      'TIPO DE CHECKLIST:', (data.checklistType || 'INSPEÇÃO OPERACIONAL').toUpperCase(),
      'CLIENTE:', (data.clientName || 'NÃO DEFINIDO').toUpperCase()
    ],
    [
      'FAMÍLIA DO EQUIPAMENTO:', (data.equipmentFamily || 'N/A').toUpperCase(),
      'MODELO DO EQUIPAMENTO:', (data.equipmentModel || template.title).toUpperCase()
    ],
    [
      'Nº / TAG DO EQUIPAMENTO:', (data.equipmentTag || 'NÃO INFORMADO').toUpperCase(),
      'LOCAL DA INSPEÇÃO:', (data.inspectionLocation || 'BASE OPERACIONAL').toUpperCase()
    ],
    [
      'DATA DA INSPEÇÃO:', data.inspectionDate ? format(new Date(data.inspectionDate), 'dd/MM/yyyy') : '-',
      'RESPONSÁVEL / SOLICITANTE:', (data.inspectionResponsible || data.inspectorName || 'TÉCNICO').toUpperCase()
    ],
    [
      'INSPETOR / TÉCNICO:', (data.inspectorName || 'NÃO INFORMADO').toUpperCase(),
      'STATUS DO CHECKLIST:', (data.status || 'CONCLUÍDO').toUpperCase()
    ]
  ];

  if (data.slingApplicable || data.slingTag || data.slingNumber) {
    const slingStr = data.slingStatus === 'NA' 
      ? 'N/A (SEM ESLINGA)' 
      : (data.slingTag || data.slingNumber ? `[${data.slingStatus || 'OK'}] TAG: ${data.slingTag || data.slingNumber}` : `[${data.slingStatus || 'OK'}]`);
    
    infoRows.push([
      'TAG DA ESLINGA (INDEP.):', slingStr.toUpperCase(),
      'DATA / VALIDADE ESLINGA:', `${data.slingInspectionDate ? format(new Date(data.slingInspectionDate), 'dd/MM/yyyy') : '-'} ${data.slingExpirationDate ? `(Val: ${format(new Date(data.slingExpirationDate), 'dd/MM/yyyy')})` : ''}`.toUpperCase()
    ]);
  }

  if (data.hasGps) {
    infoRows.push([
      'GPS / RASTREAMENTO:', `[${data.gpsStatus || 'OK'}] TAG: ${data.gpsTag || 'INSTALADO'}`.toUpperCase(),
      'OBSERVAÇÕES GPS:', (data.gpsNotes || 'OPERACIONAL').toUpperCase()
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    body: infoRows,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', textColor: [100, 116, 139] },
      1: { cellWidth: 55, fontStyle: 'bold', textColor: [15, 23, 42] },
      2: { cellWidth: 42, fontStyle: 'bold', textColor: [100, 116, 139] },
      3: { cellWidth: 55, fontStyle: 'bold', textColor: [15, 23, 42] }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // II. SEÇÕES DE INSPEÇÃO DINÂMICAS DO MODELO
  template.sections.forEach((section, sIdx) => {
    if (currentY > 230) {
      doc.addPage();
      drawPageBorder(doc.getNumberOfPages());
      currentY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`${sIdx + 2}. ${section.title}`, 14, currentY);
    currentY += 3;

    const tableRows = section.items.map(item => {
      const state = data.items[item.id] || { status: 'OK', observation: '' };
      const obsText = (state.observation && state.observation.trim() !== '') 
        ? state.observation.toUpperCase() 
        : (state.status === 'OK' ? 'CONFORME / SEM OBSERVAÇÕES' : (state.status === 'NA' ? 'NÃO APLICÁVEL' : 'NÃO CONFORME'));

      return [
        item.label,
        state.status || 'OK',
        obsText
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['ITEM DE INSPEÇÃO / ESCOPO TÉCNICO', 'STATUS', 'OBSERVAÇÕES / DETALHES TÉCNICOS']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 }
      },
      bodyStyles: {
        fontSize: 6.5,
        textColor: [51, 65, 85],
        cellPadding: { top: 2.2, bottom: 2.2, left: 4, right: 4 },
        lineColor: [226, 232, 240],
        lineWidth: 0.15
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 76, textColor: [15, 23, 42] },
        1: { fontStyle: 'bold', cellWidth: 20, halign: 'center' },
        2: { cellWidth: 98 }
      },
      didParseCell: (cellData) => {
        if (cellData.section === 'body' && cellData.column.index === 1) {
          const val = cellData.cell.raw;
          if (val === 'OK') {
            cellData.cell.styles.textColor = [16, 185, 129]; // emerald
          } else if (val === 'NC') {
            cellData.cell.styles.textColor = [225, 29, 72]; // rose
          } else {
            cellData.cell.styles.textColor = [148, 163, 184]; // slate-400
          }
        }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;
  });

  // TESTES DE ESTANQUEIDADE / HIDROSTÁTICO SE APLICÁVEL
  if (template.hasLeakTestSection && data.leakTestApplicable) {
    if (currentY > 235) {
      doc.addPage();
      drawPageBorder(doc.getNumberOfPages());
      currentY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('TESTE DE ESTANQUEIDADE / ESTADO OPERACIONAL DO VASO', 14, currentY);
    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [['PARÂMETRO DO TESTE', 'VALOR / RESULTADO', 'OBSERVAÇÕES']],
      body: [
        ['PRESSÃO DE TESTE (BAR):', `${data.leakTestPressureBar || '0.5'} BAR`, 'CONFORME ESPECIFICAÇÃO DNV / IMDG'],
        ['TEMPO DE RETENÇÃO (MIN):', `${data.leakTestDurationMin || '10'} MINUTOS`, 'TEMPO MÍNIMO REGULAMENTAR'],
        ['STATUS DO TESTE:', (data.leakTestStatus || 'OK').toUpperCase(), (data.leakTestNotes || 'SEM VAZAMENTOS IDENTIFICADOS').toUpperCase()]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 }
      },
      bodyStyles: {
        fontSize: 6.8,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: [226, 232, 240],
        lineWidth: 0.15
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50, textColor: [15, 23, 42] },
        1: { fontStyle: 'bold', cellWidth: 40 },
        2: { cellWidth: 104, textColor: [51, 65, 85] }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;
  }

  // FOTOS / EVIDÊNCIAS FOTOGRÁFICAS (Se existirem fotos preenchidas)
  const populatedPhotos = (data.photos || []).filter(p => p.photoUrl);
  if (populatedPhotos.length > 0) {
    if (currentY > 160 || populatedPhotos.length >= 2) {
      doc.addPage();
      drawPageBorder(doc.getNumberOfPages());
      currentY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('REGISTRO FOTOGRÁFICO DE INSPEÇÃO', 14, currentY);
    currentY += 4;

    const photoWidth = 58;
    const photoHeight = 44;
    let photoX = 14;
    let photoY = currentY;

    populatedPhotos.forEach((photo, idx) => {
      if (photoY + photoHeight + 10 > 275) {
        doc.addPage();
        drawPageBorder(doc.getNumberOfPages());
        photoY = 16;
        photoX = 14;
      }

      try {
        doc.addImage(photo.photoUrl!, 'JPEG', photoX, photoY, photoWidth, photoHeight, undefined, 'FAST');
      } catch (err) {
        doc.rect(photoX, photoY, photoWidth, photoHeight);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(30, 41, 59);
      doc.text(photo.title, photoX, photoY + photoHeight + 3);

      if (photo.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.text(photo.description.substring(0, 35), photoX, photoY + photoHeight + 6);
      }

      if ((idx + 1) % 3 === 0) {
        photoX = 14;
        photoY += photoHeight + 12;
      } else {
        photoX += photoWidth + 6;
      }
    });

    currentY = photoY + photoHeight + 14;
  }

  // ASSINATURAS E LIBERAÇÃO TÉCNICA
  if (currentY > 235) {
    doc.addPage();
    drawPageBorder(doc.getNumberOfPages());
    currentY = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('ASSINATURAS E LIBERAÇÃO OPERACIONAL', 14, currentY);
  currentY += 4;

  const boxW = 88;
  const boxH = 34;

  // Box Inspetor
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.rect(14, currentY, boxW, boxH);

  if (data.inspectorSignatureUrl) {
    try {
      doc.addImage(data.inspectorSignatureUrl, 'PNG', 18, currentY + 2, 40, 16, undefined, 'FAST');
    } catch (e) {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.inspectorName || 'INSPETOR TÉCNICO', 18, currentY + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(data.inspectorJobTitle || 'Técnico de Inspeção e Qualidade', 18, currentY + 26);
  doc.text(`DATA: ${data.inspectionDate ? format(new Date(data.inspectionDate), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy')}`, 18, currentY + 30);

  // Box Supervisor / Aprovador
  doc.rect(106, currentY, boxW, boxH);

  if (data.approverSignatureUrl) {
    try {
      doc.addImage(data.approverSignatureUrl, 'PNG', 110, currentY + 2, 40, 16, undefined, 'FAST');
    } catch (e) {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.approverName || 'SUPERVISOR QUALIDADE / PCP', 110, currentY + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(data.approverJobTitle || 'Supervisor de Qualidade e Operações', 110, currentY + 26);
  doc.text(`STATUS: ${(data.status || 'CONCLUÍDO').toUpperCase()} • LIBERADO`, 110, currentY + 30);

  // Save / Trigger Download
  const safeTag = (data.equipmentTag || 'EQUIPAMENTO').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDate = data.inspectionDate || format(new Date(), 'yyyy-MM-dd');
  doc.save(`CHECKLIST_${safeTag}_${safeDate}.pdf`);
}
