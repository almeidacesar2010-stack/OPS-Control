import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  Layers, 
  Search, 
  Check, 
  Clock, 
  Database, 
  Filter, 
  CheckSquare, 
  Square, 
  Info, 
  Terminal, 
  Settings2, 
  HelpCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Boxes,
  Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FleetEquipment, FleetType } from '../types/fleet';

/**
 * Validates that an equipment number candidate is NOT a Date object, date string, timestamp, or invalid value.
 */
export function isDateOrInvalidEquipmentNumber(val: any): boolean {
  if (val === null || val === undefined) return true;

  // 1. Explicit JS Date object check
  if (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]') {
    return true;
  }

  // 2. Reject non-primitive objects
  if (typeof val === 'object') {
    return true;
  }

  const str = String(val).trim();
  if (!str || str.length === 0) return true;

  // 3. Reject GMT / UTC / Timezone strings (e.g. "Mon Jun 12 2023 00:00:28 GMT-0300")
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i.test(str)) return true;
  if (str.toUpperCase().includes('GMT') || str.toUpperCase().includes('UTC')) return true;

  // 4. Reject standard ISO or BR/US date formats (e.g. "2023-06-12", "12/06/2023")
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true;
  if (/^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}/.test(str)) return true;

  // 5. Reject strings containing month names with numbers/time
  if (/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)/i.test(str)) {
    if (/\d{2,4}/.test(str) || str.includes(':')) {
      return true;
    }
  }

  // 6. Reject time strings
  if (/\b\d{1,2}:\d{2}(:\d{2})?\b/.test(str)) return true;

  // 7. Check if Date.parse works AND it's not a pure number or standard tag
  const isPureNumber = /^\d+$/.test(str);
  const isStandardTag = /^[A-Z0-9\/\-\_]{1,30}$/i.test(str);
  if (!isPureNumber && !isStandardTag) {
    const parsed = Date.parse(str);
    if (!isNaN(parsed) && parsed > 0) {
      return true;
    }
  }

  // 8. Length constraint for equipment tags
  if (str.length > 35) return true;

  return false;
}

interface FleetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportConfirmed: (
    items: Partial<FleetEquipment>[],
    onProgress?: (message: string, current: number, total: number) => void
  ) => Promise<{ created: number; updated: number; errors?: { equipmentNumber: string; reason: string }[] }>;
  existingEquipments: { id?: string; type: string; equipmentNumber: string }[];
  onDeleteAllEquipment?: () => Promise<{ deletedCount: number }>;
}

export interface OegSheetItem {
  id: string;
  equipmentNumber: string;
  type: FleetType;
  sourceSheet: string;
  category: 'CCU\'s' | 'TANK\'s' | 'REEFER\'s' | 'SPOOLER\'s' | 'SLING\'s' | 'OUTROS';
  isUpdate: boolean;
  selected: boolean;
  rawModelText?: string;
  rowIndex: number;
}

export interface SheetDiagnostic {
  sheetName: string;
  category: 'CCU\'s' | 'TANK\'s' | 'REEFER\'s' | 'SPOOLER\'s' | 'SLING\'s' | 'DESCONHECIDO';
  expectedTypeLabel: string;
  foundCount: number;
  status: 'success' | 'warning' | 'error' | 'not_found';
  reason?: string;
  headerRowIdx?: number;
  tagColIdx?: number;
  modelColIdx?: number;
}

export interface ColumnMapping {
  tagColIdx: number;
  modelColIdx: number;
}

const STORAGE_MAPPING_KEY = 'oeg_fleet_import_column_mappings_v1';

export const FleetImportModal: React.FC<FleetImportModalProps> = ({
  isOpen,
  onClose,
  onImportConfirmed,
  existingEquipments,
  onDeleteAllEquipment
}) => {
  // Step state: 'upload' | 'mapping' | 'preview' | 'importing' | 'report'
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'report'>('upload');
  
  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Workbook cached data for re-parsing
  const [rawWorkbook, setRawWorkbook] = useState<XLSX.WorkBook | null>(null);

  // Column Mappings saved by sheet category or sheet name
  const [columnMappings, setColumnMappings] = useState<Record<string, ColumnMapping>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MAPPING_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Sheet mapping requirement prompt state
  const [sheetsNeedingMapping, setSheetsNeedingMapping] = useState<{
    sheetName: string;
    sampleRows: any[][];
    reason: string;
  }[]>([]);
  const [currentMappingSheetIndex, setCurrentMappingSheetIndex] = useState(0);
  const [tempTagCol, setTempTagCol] = useState<number>(0);
  const [tempModelCol, setTempModelCol] = useState<number>(-1);

  // Items parsed for preview
  const [parsedItems, setParsedItems] = useState<OegSheetItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<SheetDiagnostic[]>([]);
  
  // UI filters in preview
  const [activeSheetFilter, setActiveSheetFilter] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [allowUpdateExisting, setAllowUpdateExisting] = useState<boolean>(true);
  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(false);

  // Import execution & progress
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStartTime, setImportStartTime] = useState<number>(0);
  const [importElapsedTimeMs, setImportElapsedTimeMs] = useState<number>(0);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importErrors, setImportErrors] = useState<{ equipmentNumber: string; reason: string }[]>([]);

  // Final Report stats
  const [reportData, setReportData] = useState<{
    totalFound: number;
    totalImported: number;
    totalCreated: number;
    totalUpdated: number;
    totalSkipped: number;
    totalErrors: number;
    durationMs: number;
    typeBreakdown: { type: string; count: number }[];
    sheetBreakdown: { sheetName: string; found: number; imported: number }[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      resetAllState();
    }
  }, [isOpen]);

  const resetAllState = () => {
    setStep('upload');
    setSelectedFile(null);
    setIsProcessing(false);
    setErrorMessage(null);
    setRawWorkbook(null);
    setParsedItems([]);
    setDiagnostics([]);
    setSheetsNeedingMapping([]);
    setCurrentMappingSheetIndex(0);
    setActiveSheetFilter('TODAS');
    setSearchTerm('');
    setImportProgress(0);
    setReportData(null);
    setIsDebugOpen(false);
  };

  if (!isOpen) return null;

  // Save mapping to localStorage
  const saveMappingForSheet = (sheetKey: string, mapping: ColumnMapping) => {
    const updated = { ...columnMappings, [sheetKey]: mapping };
    setColumnMappings(updated);
    try {
      localStorage.setItem(STORAGE_MAPPING_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save column mapping to localStorage', e);
    }
  };

  // Helper to categorize sheet names based on OEG Official specification
  const categorizeSheetName = (sheetName: string): {
    category: 'CCU\'s' | 'TANK\'s' | 'REEFER\'s' | 'SPOOLER\'s' | 'SLING\'s' | 'DESCONHECIDO';
    expectedType: string;
  } => {
    const clean = sheetName.trim().toUpperCase().replace(/[\'\`\"\-\_\s]/g, '');
    
    if (clean.includes('CCU')) {
      return { category: 'CCU\'s', expectedType: 'CCU' };
    }
    if (clean.includes('TANK') || clean.includes('TANQUE')) {
      return { category: 'TANK\'s', expectedType: 'TANQUE (Modelo)' };
    }
    if (clean.includes('REEFER') || clean.includes('REF')) {
      return { category: 'REEFER\'s', expectedType: 'REEFER' };
    }
    if (clean.includes('SPOOLER') || clean.includes('SPOOL')) {
      return { category: 'SPOOLER\'s', expectedType: 'SPOOLER' };
    }
    if (clean.includes('SLING') || clean.includes('ESLINGA') || clean.includes('CABO')) {
      return { category: 'SLING\'s', expectedType: 'ESLINGA' };
    }

    return { category: 'DESCONHECIDO', expectedType: 'OUTROS' };
  };

  // Determine FleetType for TANK's based on Model field or text
  const determineTankType = (modelStr: string, tagStr: string, rowText: string): FleetType => {
    const combined = `${modelStr} ${tagStr} ${rowText}`.toUpperCase();
    if (combined.includes('1325')) return 'TANQUE DE 1325L';
    if (combined.includes('1500')) return 'TANQUE DE 1500L';
    if (combined.includes('5000')) return 'TANQUE DE 5000L';
    if (combined.includes('5200')) return 'TANQUE DE 5200L';
    return 'OUTROS';
  };

  // Core Workbook Analysis Algorithm
  const analyzeWorkbook = (wb: XLSX.WorkBook) => {
    setRawWorkbook(wb);
    
    const targetCategories = ['CCU\'s', 'TANK\'s', 'REEFER\'s', 'SPOOLER\'s', 'SLING\'s'] as const;
    const allSheetNames = wb.SheetNames;

    const items: OegSheetItem[] = [];
    const diagList: SheetDiagnostic[] = [];
    const missingMappingSheets: { sheetName: string; sampleRows: any[][]; reason: string }[] = [];

    const existingKeysSet = new Set(
      existingEquipments.map(e => `${(e.type || '').trim().toUpperCase()}|${(e.equipmentNumber || '').trim().toUpperCase()}`)
    );

    // Keep track of matched categories to diagnose missing target sheets
    const processedCategoriesSet = new Set<string>();

    for (const sheetName of allSheetNames) {
      const { category, expectedType } = categorizeSheetName(sheetName);
      if (category !== 'DESCONHECIDO') {
        processedCategoriesSet.add(category);
      }

      const worksheet = wb.Sheets[sheetName];
      if (!worksheet) continue;

      // Convert sheet to 2D matrix
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (!rows || rows.length === 0) {
        diagList.push({
          sheetName,
          category,
          expectedTypeLabel: expectedType,
          foundCount: 0,
          status: 'error',
          reason: 'Aba está completamente vazia (nenhuma linha ou célula encontrada).'
        });
        continue;
      }

      // Check if user saved a custom mapping for this sheet name or category
      const savedMap = columnMappings[sheetName] || columnMappings[category];

      let headerRowIdx = -1;
      let tagColIdx = savedMap ? savedMap.tagColIdx : -1;
      let modelColIdx = savedMap ? savedMap.modelColIdx : -1;

      // Date keywords to strictly ignore when detecting tag columns
      const dateHeaderKeywords = [
        'DATA', 'DATE', 'VALIDADE', 'INSPEC', 'INSP', 'FABRICA', 'FABRICACAO', 'TESTE', 
        'NEXT', 'PRÓXIMA', 'PROXIMA', 'MANUTENCAO', 'CERTIFICADO', 'ÚLTIMO TESTE', 'ULTIMO TESTE', 
        'PRÓXIMO TESTE', 'PROXIMO TESTE', 'DIAS PARA VENCIMENTO', 'DIAS'
      ];

      // Explicit layout mapping per category according to user specification
      let sheetTagKeywords: string[] = [];
      let sheetModelKeywords: string[] = [];

      if (category === "TANK's" || sheetName.toUpperCase().includes('TANK')) {
        // TANK's Layout: Serial Number -> Equipment Number; Model -> Equipment Type
        sheetTagKeywords = ['SERIAL NUMBER', 'SERIAL NO.', 'SERIAL NO', 'SERIAL N°', 'SERIAL Nº', 'SERIAL', 'NÚMERO DE SÉRIE', 'NUMERO DE SERIE'];
        sheetModelKeywords = ['MODELO', 'MODEL', 'CAPACIDADE', 'DESCRICAO', 'DESCRIÇÃO', 'TIPO'];
      } else if (category === "CCU's" || sheetName.toUpperCase().includes('CCU')) {
        // CCU's Layout
        sheetTagKeywords = ['TAG', 'NÚMERO', 'NUMERO', 'EQUIPAMENTO', 'UNIDADE', 'UNIT', 'NO.', 'ID', 'SERIAL', 'CÓDIGO', 'CODIGO'];
        sheetModelKeywords = ['MODELO', 'MODEL', 'DESCRICAO', 'DESCRIÇÃO', 'TIPO', 'SUBFAMILIA', 'SUBFAMÍLIA', 'FAMILIA', 'FAMÍLIA'];
      } else if (category === "REEFER's" || sheetName.toUpperCase().includes('REEFER') || sheetName.toUpperCase().includes('REF')) {
        // REEFER's Layout
        sheetTagKeywords = ['EQUIPAMENTO', 'TAG', 'SERIAL', 'CONTAINER', 'UNIT', 'NUMERO', 'NÚMERO', 'ID', 'SÉRIE', 'SERIE', 'CÓDIGO', 'CODIGO'];
        sheetModelKeywords = ['MODELO', 'MODEL', 'DESCRICAO', 'DESCRIÇÃO', 'TIPO'];
      } else if (category === "SPOOLER's" || sheetName.toUpperCase().includes('SPOOLER') || sheetName.toUpperCase().includes('SPOOL')) {
        // SPOOLER's Layout
        sheetTagKeywords = ['SPOOLER', 'TAG', 'EQUIPAMENTO', 'SERIAL', 'NUMERO', 'NÚMERO', 'UNIT', 'ID', 'CÓDIGO', 'CODIGO'];
        sheetModelKeywords = ['MODELO', 'MODEL', 'TIPO', 'DESCRICAO', 'DESCRIÇÃO'];
      } else if (category === "SLING's" || sheetName.toUpperCase().includes('SLING') || sheetName.toUpperCase().includes('ESLINGA')) {
        // SLING's Layout
        sheetTagKeywords = ['SLING', 'ESLINGA', 'TAG', 'EQUIPAMENTO', 'SERIAL', 'NUMERO', 'NÚMERO', 'UNIT', 'ID', 'CABO', 'CÓDIGO', 'CODIGO'];
        sheetModelKeywords = ['MODELO', 'MODEL', 'TIPO', 'DESCRICAO', 'DESCRIÇÃO', 'CABO'];
      } else {
        sheetTagKeywords = ['TAG', 'NÚMERO', 'NUMERO', 'EQUIPAMENTO', 'SERIAL', 'IDENTIFICAÇÃO', 'IDENTIFICACAO', 'UNIT', 'NO.', 'ID'];
        sheetModelKeywords = ['MODELO', 'MODEL', 'DESCRICAO', 'DESCRIÇÃO', 'TIPO'];
      }

      if (!savedMap) {
        for (let r = 0; r < Math.min(rows.length, 30); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          
          const rowUpper = row.map(cell => String(cell || '').trim().toUpperCase());

          // Find exact header tag column based on layout keywords
          const foundTag = rowUpper.findIndex(cell => 
            sheetTagKeywords.some(kw => cell === kw || cell.includes(kw)) &&
            !dateHeaderKeywords.some(dkw => cell.includes(dkw))
          );

          if (foundTag !== -1) {
            headerRowIdx = r;
            tagColIdx = foundTag;

            const foundModel = rowUpper.findIndex(cell => sheetModelKeywords.some(kw => cell === kw || cell.includes(kw)));
            if (foundModel !== -1 && foundModel !== foundTag) {
              modelColIdx = foundModel;
            }
            break;
          }
        }
      } else {
        headerRowIdx = 0; // standard offset if saved mapping exists
      }

      // User Directive: "Não utilizar detecção automática de colunas. Cada aba possui um layout próprio e deverá possuir um mapeamento específico."
      // If tagColIdx is not located from explicit headers or saved mapping, request manual mapping for this sheet layout!

      // If still unable to locate tag column automatically, request mapping UI from user
      if (tagColIdx === -1) {
        diagList.push({
          sheetName,
          category,
          expectedTypeLabel: expectedType,
          foundCount: 0,
          status: 'warning',
          reason: category === "TANK's"
            ? 'Coluna "Serial Number" não localizada na aba TANK\'s. A coluna deve se chamar "Serial Number" ou "Serial".'
            : `Coluna com o Número do Equipamento não localizada no layout da aba '${sheetName}'. Requer mapeamento específico.`
        });

        missingMappingSheets.push({
          sheetName,
          sampleRows: rows.slice(0, 15),
          reason: `Layout da aba '${sheetName}': Cabeçalho de Número/Serial não identificado.`
        });

        continue;
      }

      // Now iterate over rows to extract valid equipment records
      let sheetEquipmentCount = 0;
      const startRowIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

      for (let r = startRowIdx; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row) || row.length === 0) continue;

        // Joined row string for general noise inspection
        const fullRowText = row.map(cell => String(cell || '').trim()).join(' ').toUpperCase();

        // Skip blank lines
        if (!fullRowText || fullRowText.replace(/\s/g, '').length === 0) continue;

        // Skip totals, subtotals, summary notes, titles, formulas banners
        if (
          fullRowText.includes('TOTAL') || 
          fullRowText.includes('SUBTOTAL') || 
          fullRowText.includes('QUANTIDADE') || 
          fullRowText.includes('RESUMO') || 
          fullRowText.includes('OEG OFFSHORE') || 
          fullRowText.includes('GESTAO DE FROTA') || 
          fullRowText.includes('RELATORIO') || 
          fullRowText.includes('MÉDIA') || 
          fullRowText.includes('FORMULA')
        ) {
          continue;
        }

        const rawCell = row[tagColIdx];

        // MANDATORY VALIDATION: Check if Serial Number cell contains a Date object, date string, timestamp or invalid tag
        if (isDateOrInvalidEquipmentNumber(rawCell)) {
          const logMsg = `Linha ${r + 1} (Aba '${sheetName}'): O campo Número/Serial contém uma data/inválido (${String(rawCell)}). Registro cancelado.`;
          console.warn(logMsg);
          continue;
        }

        let rawTag = String(rawCell ?? '').trim();

        const isTankSheet = category === "TANK's" || sheetName.toUpperCase().includes('TANK');

        // Sequence number override check: DO NOT apply to TANK's! Serial numbers on tanks can be numeric (e.g. 228691, 229722).
        if (!isTankSheet && /^\d{1,4}$/.test(rawTag) && row[tagColIdx + 1] && String(row[tagColIdx + 1]).trim().length > 2) {
          const nextColVal = row[tagColIdx + 1];
          if (!isDateOrInvalidEquipmentNumber(nextColVal)) {
            const nextColStr = String(nextColVal).trim();
            if (!/^\d+$/.test(nextColStr)) {
              rawTag = nextColStr;
            }
          }
        }

        const cleanTag = rawTag.toUpperCase();

        // Skip if tag is header label or invalid short string or date
        if (
          !cleanTag || 
          cleanTag.length < 2 || 
          isDateOrInvalidEquipmentNumber(cleanTag) ||
          sheetTagKeywords.includes(cleanTag) || 
          ['ITEM', 'NO', 'Nº', 'SEQ', 'CCU', 'TANK', 'REEFER', 'SPOOLER', 'SLING'].includes(cleanTag)
        ) {
          continue;
        }

        // Extract Model value
        const rawModel = modelColIdx !== -1 && modelColIdx < row.length ? String(row[modelColIdx] ?? '').trim() : '';

        // Determine equipment type based on category
        let finalType: FleetType = 'CCU';

        if (category === 'CCU\'s') {
          finalType = 'CCU';
        } else if (category === 'REEFER\'s') {
          finalType = 'REEFER';
        } else if (category === 'SPOOLER\'s') {
          finalType = 'SPOOLER';
        } else if (category === 'SLING\'s') {
          finalType = 'ESLINGA';
        } else if (category === 'TANK\'s') {
          finalType = determineTankType(rawModel, cleanTag, fullRowText);
        } else {
          // Desconhecido tab: attempt heuristic
          if (cleanTag.includes('SLING') || cleanTag.includes('ESL')) finalType = 'ESLINGA';
          else if (cleanTag.includes('REEF') || cleanTag.includes('REF')) finalType = 'REEFER';
          else if (cleanTag.includes('SPOOL')) finalType = 'SPOOLER';
          else if (cleanTag.includes('1325') || cleanTag.includes('1500') || cleanTag.includes('5000') || cleanTag.includes('5200')) {
            finalType = determineTankType(rawModel, cleanTag, fullRowText);
          } else {
            finalType = 'OUTROS';
          }
        }

        const compositeKey = `${finalType.trim().toUpperCase()}|${cleanTag.trim().toUpperCase()}`;
        const isExisting = existingKeysSet.has(compositeKey);

        items.push({
          id: `${sheetName}-${r}-${cleanTag}`,
          equipmentNumber: cleanTag,
          type: finalType,
          sourceSheet: sheetName,
          category: category !== 'DESCONHECIDO' ? category : 'OUTROS',
          isUpdate: isExisting,
          selected: true,
          rawModelText: rawModel,
          rowIndex: r
        });

        sheetEquipmentCount++;
      }

      if (sheetEquipmentCount > 0) {
        diagList.push({
          sheetName,
          category,
          expectedTypeLabel: expectedType,
          foundCount: sheetEquipmentCount,
          status: 'success',
          headerRowIdx: headerRowIdx !== -1 ? headerRowIdx : 0,
          tagColIdx,
          modelColIdx
        });
      } else {
        diagList.push({
          sheetName,
          category,
          expectedTypeLabel: expectedType,
          foundCount: 0,
          status: 'warning',
          reason: 'Nenhuma linha de equipamento válida foi localizada nesta aba (verifique se há dados ou títulos mesclados).'
        });
      }
    }

    // Verify if any target categories were missing from the Excel file
    targetCategories.forEach(cat => {
      if (!processedCategoriesSet.has(cat)) {
        diagList.push({
          sheetName: cat,
          category: cat,
          expectedTypeLabel: cat === 'CCU\'s' ? 'CCU' : cat === 'REEFER\'s' ? 'REEFER' : cat === 'SPOOLER\'s' ? 'SPOOLER' : cat === 'SLING\'s' ? 'ESLINGA' : 'TANQUE',
          foundCount: 0,
          status: 'not_found',
          reason: `Aba '${cat}' não foi encontrada na planilha enviada.`
        });
      }
    });

    setParsedItems(items);
    setDiagnostics(diagList);

    if (missingMappingSheets.length > 0) {
      setSheetsNeedingMapping(missingMappingSheets);
      setCurrentMappingSheetIndex(0);
      setTempTagCol(0);
      setTempModelCol(-1);
      setStep('mapping');
    } else if (items.length === 0) {
      setErrorMessage('Nenhum equipamento válido foi encontrado em nenhuma das abas da planilha. Verifique a estrutura do arquivo.');
      setStep('upload');
    } else {
      setErrorMessage(null);
      setStep('preview');
    }

    setIsProcessing(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMessage(null);
  };

  const handleProcessFile = () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('O arquivo de planilha está vazio ou corrompido.');
        }

        analyzeWorkbook(workbook);
      } catch (err: any) {
        setIsProcessing(false);
        setErrorMessage(`Erro ao analisar arquivo Excel: ${err.message || 'Formato inválido'}`);
      }
    };

    reader.onerror = () => {
      setIsProcessing(false);
      setErrorMessage('Erro ao ler o arquivo selecionado.');
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  // Handle confirming custom mapping for a sheet
  const handleConfirmSheetMapping = () => {
    if (!rawWorkbook || sheetsNeedingMapping.length === 0) return;

    const currentSheet = sheetsNeedingMapping[currentMappingSheetIndex];
    if (!currentSheet) return;

    // Save mapping
    const mapping: ColumnMapping = {
      tagColIdx: tempTagCol,
      modelColIdx: tempModelCol
    };

    saveMappingForSheet(currentSheet.sheetName, mapping);

    if (currentMappingSheetIndex + 1 < sheetsNeedingMapping.length) {
      setCurrentMappingSheetIndex(prev => prev + 1);
      setTempTagCol(0);
      setTempModelCol(-1);
    } else {
      // Re-run workbook analysis with updated mappings saved
      setSheetsNeedingMapping([]);
      analyzeWorkbook(rawWorkbook);
    }
  };

  // Selection Toggles in Preview
  const handleToggleSelectAll = (checked: boolean) => {
    setParsedItems(prev => prev.map(item => {
      if (activeSheetFilter === 'TODAS' || item.sourceSheet === activeSheetFilter || item.category === activeSheetFilter) {
        return { ...item, selected: checked };
      }
      return item;
    }));
  };

  const handleToggleItem = (id: string) => {
    setParsedItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  // Confirm Import Action
  const handleConfirmImport = async () => {
    const selectedItems = parsedItems.filter(i => i.selected);
    if (selectedItems.length === 0) {
      setErrorMessage('Selecione pelo menos 1 equipamento para importar.');
      return;
    }

    setStep('importing');
    setImportProgress(0);
    setErrorMessage(null);
    setImportErrors([]);

    const initialLogs = [
      'Iniciando leitura da planilha...',
      `${selectedItems.length} equipamentos encontrados.`
    ];
    setImportLogs(initialLogs);

    const start = performance.now();
    setImportStartTime(start);

    // Prepare payload with ONLY essential fields
    const payload: Partial<FleetEquipment>[] = selectedItems.map(item => ({
      equipmentNumber: item.equipmentNumber,
      type: item.type,
      status: 'Cadastro Pendente de Validação',
      isPendingValidation: true,
      validationStatus: 'pending',
      clientId: '',
      location: 'BASE',
      observations: `Migrado da aba '${item.sourceSheet}' (${item.category}) em ${new Date().toLocaleDateString('pt-BR')}`
    }));

    try {
      const summary = await onImportConfirmed(payload, (msg, current, total) => {
        setImportLogs(prev => [...prev, msg]);
        if (total > 0) {
          setImportProgress(Math.round((current / total) * 100));
        }
      });

      setImportProgress(100);
      setImportLogs(prev => [...prev, 'Importação concluída.']);

      const end = performance.now();
      const elapsed = Math.round(end - start);
      setImportElapsedTimeMs(elapsed);

      // Type Breakdown stats
      const typeBreakdownMap = new Map<string, number>();
      selectedItems.forEach(item => {
        const t = item.type || 'CCU';
        typeBreakdownMap.set(t, (typeBreakdownMap.get(t) || 0) + 1);
      });

      const typeBreakdown = Array.from(typeBreakdownMap.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      // Sheet Breakdown stats
      const breakdownMap = new Map<string, { found: number; imported: number }>();

      parsedItems.forEach(item => {
        const cur = breakdownMap.get(item.sourceSheet) || { found: 0, imported: 0 };
        cur.found += 1;
        if (item.selected) {
          cur.imported += 1;
        }
        breakdownMap.set(item.sourceSheet, cur);
      });

      const sheetBreakdown = Array.from(breakdownMap.entries()).map(([sheetName, stats]) => ({
        sheetName,
        found: stats.found,
        imported: stats.imported
      }));

      const skippedCount = parsedItems.length - selectedItems.length;

      setReportData({
        totalFound: parsedItems.length,
        totalImported: summary.created + summary.updated,
        totalCreated: summary.created,
        totalUpdated: summary.updated,
        totalSkipped: skippedCount,
        totalErrors: summary.errors ? summary.errors.length : 0,
        durationMs: elapsed,
        typeBreakdown,
        sheetBreakdown
      });

      if (summary.errors && summary.errors.length > 0) {
        setImportErrors(summary.errors);
      }

      setStep('report');
    } catch (err: any) {
      console.error("Import failure:", err);
      const errText = err?.message || String(err);
      setErrorMessage(`Falha na gravação do banco de dados: ${errText}`);
      setImportLogs(prev => [...prev, `[ERRO] ${errText}`]);
    }
  };

  // Filtered items list for preview table
  const filteredItems = parsedItems.filter(item => {
    const matchesSheet = activeSheetFilter === 'TODAS' || item.sourceSheet === activeSheetFilter || item.category === activeSheetFilter;
    const matchesSearch = !searchTerm || item.equipmentNumber.toLowerCase().includes(searchTerm.toLowerCase()) || item.type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSheet && matchesSearch;
  });

  const selectedCount = parsedItems.filter(i => i.selected).length;
  const newSelectedCount = parsedItems.filter(i => i.selected && !i.isUpdate).length;
  const updateSelectedCount = parsedItems.filter(i => i.selected && i.isUpdate).length;

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(i => i.selected);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[32px] shadow-2xl w-full max-w-5xl overflow-hidden my-6 flex flex-col max-h-[92vh] transition-all duration-300">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shadow-inner">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Importador Oficial da Frota (OEG Offshore)
                </h3>
                <span className="px-3 py-1 bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-500/20">
                  Migração Inicial
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Reconhecimento automático das abas CCU's, TANK's, REEFER's, SPOOLER's e SLING's
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar space-y-6">

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs font-bold animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-black uppercase tracking-wider mb-0.5">Atenção na Operação</p>
                <p className="leading-relaxed font-medium">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* STEP 1: UPLOAD FILE */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Informational Guidance Box */}
              <div className="p-6 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl space-y-3">
                <div className="flex items-center gap-3 text-indigo-900 dark:text-indigo-200 font-black text-xs uppercase tracking-wider">
                  <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Diretrizes de Migração OEG Offshore
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Abas Oficialmente Reconhecidas:</strong> CCU's, TANK's, REEFER's, SPOOLER's, SLING's.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Filtro Inteligente:</strong> Ignora automaticamente títulos, subtítulos, linhas em branco e totais.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Classificação de Tanques:</strong> Modelo contendo 1325, 1500, 5000 ou 5200.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Status Inicial:</strong> Criados como "Cadastro Pendente de Validação" para conferência no PCP.</span>
                  </div>
                </div>
              </div>

              {/* Upload Drop Zone */}
              <div className="p-10 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-[32px] bg-slate-50/50 dark:bg-slate-800/20 text-center space-y-4 transition-all group flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-3xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/10">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
                    Selecione a Planilha Oficial da OEG
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto font-medium">
                    Carregue a planilha em formato Excel (.xlsx, .xls) contendo as abas oficiais da frota.
                  </p>
                </div>

                <label className="cursor-pointer px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-500/20 transition-all inline-flex items-center gap-3 active:scale-95 mt-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>Escolher Planilha Excel...</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>

                {selectedFile && (
                  <div className="w-full max-w-md mt-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-sm">
                    <div className="flex items-center gap-3 overflow-hidden text-left">
                      <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <p className="font-black text-slate-900 dark:text-white truncate">{selectedFile.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleProcessFile}
                  disabled={!selectedFile || isProcessing}
                  className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3 active:scale-95"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Analisando Abas OEG...</span>
                    </>
                  ) : (
                    <>
                      <span>Analisar Planilha e Abas</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: MANUAL COLUMN MAPPING (WHEN NEEDED) */}
          {step === 'mapping' && sheetsNeedingMapping.length > 0 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-3xl flex items-start gap-4 text-xs font-bold text-amber-900 dark:text-amber-200">
                <Settings2 className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-black uppercase tracking-wide">Mapeamento de Coluna Necessário ({currentMappingSheetIndex + 1} de {sheetsNeedingMapping.length})</p>
                  <p className="font-medium mt-1">
                    Não foi possível identificar automaticamente a coluna do <strong>Número do Equipamento</strong> na aba <span className="underline font-black">{sheetsNeedingMapping[currentMappingSheetIndex].sheetName}</span>. 
                    Por favor, informe uma única vez qual coluna contém esses dados. Este mapeamento ficará salvo.
                  </p>
                </div>
              </div>

              {/* Sample Rows Table */}
              <div className="space-y-3">
                <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Amostra dos Dados da Aba: <span className="text-indigo-600 dark:text-indigo-400">{sheetsNeedingMapping[currentMappingSheetIndex].sheetName}</span>
                </p>
                <div className="max-h-56 overflow-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-black tracking-wider sticky top-0">
                      <tr>
                        <th className="p-3 w-12 text-center">Linha</th>
                        {sheetsNeedingMapping[currentMappingSheetIndex].sampleRows[0]?.map((_, colIdx) => (
                          <th key={colIdx} className="p-3 border-l border-slate-200 dark:border-slate-700">
                            Coluna {colIdx + 1} {colIdx === tempTagCol ? ' (Nº Tag)' : colIdx === tempModelCol ? ' (Modelo)' : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                      {sheetsNeedingMapping[currentMappingSheetIndex].sampleRows.slice(0, 8).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2 text-center text-[10px] text-slate-400 font-bold">{rIdx + 1}</td>
                          {row.map((cell, cIdx) => (
                            <td 
                              key={cIdx} 
                              className={`p-2.5 text-xs truncate max-w-[180px] border-l border-slate-100 dark:border-slate-800/50 ${
                                cIdx === tempTagCol ? 'bg-indigo-50 dark:bg-indigo-900/40 font-black text-indigo-700 dark:text-indigo-300' : 
                                cIdx === tempModelCol ? 'bg-amber-50 dark:bg-amber-900/40 font-black text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {String(cell || '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Column Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider block">
                    Coluna com o Número do Equipamento *
                  </label>
                  <select
                    value={tempTagCol}
                    onChange={(e) => setTempTagCol(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-2xl font-bold text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {sheetsNeedingMapping[currentMappingSheetIndex].sampleRows[0]?.map((_, cIdx) => (
                      <option key={cIdx} value={cIdx}>
                        Coluna {cIdx + 1} {sheetsNeedingMapping[currentMappingSheetIndex].sampleRows[0]?.[cIdx] ? `("${String(sheetsNeedingMapping[currentMappingSheetIndex].sampleRows[0][cIdx]).substring(0, 25)}")` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider block">
                    Coluna do Modelo (Opcional - p/ Tanques)
                  </label>
                  <select
                    value={tempModelCol}
                    onChange={(e) => setTempModelCol(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-2xl font-bold text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value={-1}>Não existe nesta aba</option>
                    {sheetsNeedingMapping[currentMappingSheetIndex].sampleRows[0]?.map((_, cIdx) => (
                      <option key={cIdx} value={cIdx}>
                        Coluna {cIdx + 1} {sheetsNeedingMapping[currentMappingSheetIndex].sampleRows[0]?.[cIdx] ? `("${String(sheetsNeedingMapping[currentMappingSheetIndex].sampleRows[0][cIdx]).substring(0, 25)}")` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmSheetMapping}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95"
                >
                  <span>Salvar Mapeamento e Continuar</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & SELECTION */}
          {step === 'preview' && (
            <div className="space-y-6 animate-in fade-in duration-200">

              {/* Top Bar Summary Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Encontrados</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{parsedItems.length} ativos</p>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-widest">Selecionados</p>
                    <p className="text-lg font-black text-emerald-900 dark:text-emerald-200">{selectedCount} de {parsedItems.length}</p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-blue-600/80 dark:text-blue-400/80 uppercase tracking-widest">Novos Cadastros</p>
                    <p className="text-lg font-black text-blue-900 dark:text-blue-200">{newSelectedCount}</p>
                  </div>
                </div>

                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-amber-600/80 dark:text-amber-400/80 uppercase tracking-widest">Atualizações</p>
                    <p className="text-lg font-black text-amber-900 dark:text-amber-200">{updateSelectedCount}</p>
                  </div>
                </div>
              </div>

              {/* Sheet Sub-Tabs and Search Controls */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full custom-scrollbar">
                  {['TODAS', 'CCU\'s', 'TANK\'s', 'REEFER\'s', 'SPOOLER\'s', 'SLING\'s'].map((tab) => {
                    const count = tab === 'TODAS' 
                      ? parsedItems.length 
                      : parsedItems.filter(i => i.sourceSheet === tab || i.category === tab).length;

                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveSheetFilter(tab)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 border shrink-0 ${
                          activeSheetFilter === tab
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>{tab}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                          activeSheetFilter === tab ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative shrink-0 w-full md:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar por número ou tipo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Table Container */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 font-black uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3.5 w-12 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectAll(!allFilteredSelected)}
                            className="text-slate-500 hover:text-indigo-600 transition-colors"
                            title="Selecionar / Desmarcar Todos"
                          >
                            {allFilteredSelected ? (
                              <CheckSquare className="w-5 h-5 text-indigo-600" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </th>
                        <th className="p-3.5">Número do Equipamento</th>
                        <th className="p-3.5">Tipo Identificado</th>
                        <th className="p-3.5">Aba de Origem</th>
                        <th className="p-3.5">Status no Banco</th>
                        <th className="p-3.5 text-center">Status Inicial PCP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-10 text-center text-slate-400 font-bold">
                            Nenhum equipamento localizado com os filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => (
                          <tr 
                            key={item.id} 
                            onClick={() => handleToggleItem(item.id)}
                            className={`cursor-pointer transition-colors ${
                              item.selected ? 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40' : 'opacity-60 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                            }`}
                          >
                            <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => handleToggleItem(item.id)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-3.5 font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">
                              {item.equipmentNumber}
                            </td>
                            <td className="p-3.5">
                              <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {item.type}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px]">
                              {item.sourceSheet}
                            </td>
                            <td className="p-3.5">
                              {item.isUpdate ? (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Atualização
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Novo Registro
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                Cadastro Pendente de Validação
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DEBUG ACCORDION TOGGLE */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
                <button
                  type="button"
                  onClick={() => setIsDebugOpen(!isDebugOpen)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Modo Debug: Diagnóstico por Aba ({diagnostics.length} abas analisadas)</span>
                  </div>
                  {isDebugOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isDebugOpen && (
                  <div className="p-5 border-t border-slate-200 dark:border-slate-700/80 space-y-3 font-mono text-xs">
                    {diagnostics.map((diag, idx) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-2 ${
                          diag.status === 'success' ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-300' :
                          diag.status === 'warning' ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-300' :
                          'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold">{diag.sheetName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-white/60 dark:bg-slate-800 font-sans uppercase font-black">
                            {diag.category}
                          </span>
                        </div>
                        <div className="font-sans font-bold text-xs">
                          {diag.foundCount > 0 ? (
                            <span>{diag.sheetName} → <strong>{diag.foundCount}</strong> equipamentos encontrados</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-medium">Motivo: {diag.reason || 'Nenhum equipamento localizado'}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-6 py-3 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Trocar Arquivo
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={selectedCount === 0}
                  className="px-10 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/25 flex items-center gap-3 disabled:opacity-40 active:scale-95 transition-all"
                >
                  <span>Confirmar e Migrar Frota ({selectedCount} ativos)</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORTING PROGRESS BAR & LIVE LOG CONSOLE */}
          {step === 'importing' && (
            <div className="py-8 px-4 space-y-6 max-w-2xl mx-auto animate-in fade-in">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/10">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-1 text-center">
                <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Gravando Equipamentos no Banco de Dados
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Processando cadastros e garantindo a persistência permanente no banco...
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  <span>Status do Processamento</span>
                  <span>{importProgress}% concluído</span>
                </div>
              </div>

              {/* Live Execution Logs Console */}
              <div className="bg-slate-950 text-slate-200 rounded-2xl p-4 font-mono text-xs shadow-2xl border border-slate-800 space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider pb-2 border-b border-slate-800">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Log Detalhado da Importação</span>
                </div>
                {importLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed">
                    <span className="text-indigo-400 shrink-0">&gt;</span>
                    <span className={log.includes('[ERRO]') ? 'text-rose-400 font-bold' : log.includes('concluída') ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>

              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <p className="font-black uppercase">Falha na Operação</p>
                  </div>
                  <p>{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => setStep('preview')}
                    className="mt-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                  >
                    Voltar para Revisão
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: FINAL REPORT */}
          {step === 'report' && reportData && (
            <div className="space-y-6 animate-in zoom-in-95 duration-200">
              {/* Success Callout Header */}
              <div className="p-8 text-center space-y-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-[32px]">
                <div className="w-16 h-16 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-2xl font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-tight">
                  Importação concluída com sucesso. {reportData.totalCreated} equipamentos cadastrados e {reportData.totalUpdated} equipamentos atualizados.
                </h4>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 max-w-xl mx-auto">
                  A migração inicial foi verificada e executada com sucesso no banco de dados. Os equipamentos já estão disponíveis na Gestão da Frota e no Dashboard.
                </p>
              </div>

              {/* Stats Summary Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Localizados</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{reportData.totalFound}</p>
                </div>
                <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 text-center">
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Total Importados</p>
                  <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1">{reportData.totalImported}</p>
                </div>
                <div className="p-5 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/50 text-center">
                  <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Registros Ignorados</p>
                  <p className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-1">{reportData.totalSkipped}</p>
                </div>
                <div className="p-5 bg-rose-50/60 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800/50 text-center">
                  <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Quantidade de Erros</p>
                  <p className="text-2xl font-black text-rose-900 dark:text-rose-200 mt-1">{reportData.totalErrors}</p>
                </div>
              </div>

              {/* Quantidade Importada por Tipo */}
              <div className="space-y-3">
                <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Quantidade Importada por Tipo de Equipamento</span>
                </h5>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {reportData.typeBreakdown.map((tb, idx) => (
                    <div 
                      key={idx}
                      className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between"
                    >
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{tb.type}</p>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="text-xl font-black text-slate-900 dark:text-white">{tb.count}</span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">ativos</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sheet Breakdown List */}
              <div className="space-y-3">
                <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Resumo de Equipamentos por Aba da Planilha</span>
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reportData.sheetBreakdown.map((sb, idx) => (
                    <div 
                      key={idx}
                      className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase">{sb.sheetName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          Encontrados: {sb.found} equipamentos
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-black text-xs rounded-xl border border-emerald-200 dark:border-emerald-800">
                        {sb.imported} importados
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error Details List if any */}
              {importErrors.length > 0 && (
                <div className="space-y-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl">
                  <h5 className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Detalhes dos {importErrors.length} Registros com Erros</span>
                  </h5>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs font-mono">
                    {importErrors.map((err, idx) => (
                      <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-800 flex justify-between">
                        <span className="font-bold text-rose-700 dark:text-rose-300">{err.equipmentNumber}</span>
                        <span className="text-slate-500">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-4 flex justify-center border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-12 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all hover:opacity-90 active:scale-95"
                >
                  Concluir e Acessar Gestão da Frota
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
