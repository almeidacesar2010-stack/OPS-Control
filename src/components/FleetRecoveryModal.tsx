import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  RotateCcw, 
  Sparkles,
  ShieldCheck,
  Check,
  ChevronRight,
  Database,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FleetEquipment, FleetType } from '../types/fleet';
import { isDateOrInvalidEquipmentNumber } from './FleetImportModal';

interface FleetRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecoverConfirmed: (
    items: Partial<FleetEquipment>[],
    onProgress?: (message: string, current: number, total: number) => void
  ) => Promise<{
    totalAnalyzed: number;
    alreadyExisting: number;
    recoveredCount: number;
    breakdownByType: Record<string, number>;
  }>;
}

export const FleetRecoveryModal: React.FC<FleetRecoveryModalProps> = ({
  isOpen,
  onClose,
  onRecoverConfirmed
}) => {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'recovering' | 'report'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  // Parsed items from spreadsheet
  const [parsedItems, setParsedItems] = useState<Partial<FleetEquipment>[]>([]);

  // Recovery Results Report
  const [recoveryReport, setRecoveryReport] = useState<{
    totalAnalyzed: number;
    alreadyExisting: number;
    recoveredCount: number;
    breakdownByType: Record<string, number>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetModal = () => {
    setStep('upload');
    setSelectedFile(null);
    setIsProcessing(false);
    setErrorMessage(null);
    setProgressMsg('');
    setProgressCurrent(0);
    setProgressTotal(0);
    setParsedItems([]);
    setRecoveryReport(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Recovery mode selection: 'tanks_only' (Default - focus exclusively on TANK's sheet correction) or 'all'
  const [recoveryMode, setRecoveryMode] = useState<'tanks_only' | 'all'>('tanks_only');

  // Helper to categorize tab/sheet name
  const categorizeSheetName = (name: string): { category: string; defaultType: FleetType } => {
    const upper = name.toUpperCase().trim();
    if (upper.includes('CCU')) return { category: "CCU's", defaultType: 'CCU' };
    if (upper.includes('TANK')) return { category: "TANK's", defaultType: 'TANQUE DE 1325L' };
    if (upper.includes('REEFER')) return { category: "REEFER's", defaultType: 'REEFER' };
    if (upper.includes('SPOOLER')) return { category: "SPOOLER's", defaultType: 'SPOOLER' };
    if (upper.includes('SLING') || upper.includes('ESLINGA')) return { category: "SLING's", defaultType: 'ESLINGA' };
    return { category: 'OUTROS', defaultType: 'OUTROS' };
  };

  const determineTankType = (modelStr: string, tagStr: string, rowText: string): FleetType => {
    const combined = `${modelStr} ${tagStr} ${rowText}`.toUpperCase();
    if (combined.includes('1325')) return 'TANQUE DE 1325L';
    if (combined.includes('1500')) return 'TANQUE DE 1500L';
    if (combined.includes('5000')) return 'TANQUE DE 5000L';
    if (combined.includes('5200')) return 'TANQUE DE 5200L';
    return 'TANQUE DE 1325L';
  };

  const parseWorkbook = (wb: XLSX.WorkBook, mode: 'tanks_only' | 'all'): Partial<FleetEquipment>[] => {
    const extracted: Partial<FleetEquipment>[] = [];

    const dateHeaderKeywords = [
      'DATA', 'DATE', 'VALIDADE', 'INSPEC', 'INSP', 'FABRICA', 'FABRICACAO', 'TESTE', 
      'NEXT', 'PRÓXIMA', 'PROXIMA', 'MANUTENCAO', 'CERTIFICADO', 
      'ÚLTIMO TESTE', 'ULTIMO TESTE', 'PRÓXIMO TESTE', 'PROXIMO TESTE', 'DIAS PARA VENCIMENTO', 'DIAS'
    ];
    const tagKeywords = ['NÚMERO', 'NUMERO', 'TAG', 'EQUIPAMENTO', 'CÓDIGO', 'CODIGO', 'IDENTIFICAÇÃO', 'IDENTIFICACAO', 'SERIAL', 'SÉRIE', 'SERIE', 'UNIT', 'NO.', 'Nº', 'NO', 'ID', 'ATIVO', 'UNIDADE'];
    const tankSerialKeywords = ['SERIAL NUMBER', 'SERIAL NO.', 'SERIAL NO', 'SERIAL N°', 'SERIAL Nº', 'SERIAL', 'NÚMERO DE SÉRIE', 'NUMERO DE SERIE'];
    const modelKeywords = ['MODELO', 'MODEL', 'DESCRICAO', 'DESCRIÇÃO', 'TIPO', 'CAPACIDADE', 'SUBFAMILIA', 'SUBFAMÍLIA', 'FAMILIA', 'FAMÍLIA'];

    for (const sheetName of wb.SheetNames) {
      const { category, defaultType } = categorizeSheetName(sheetName);
      const isTankSheet = category === "TANK's" || sheetName.toUpperCase().includes('TANK');

      // If mode is tanks_only, skip non-tank sheets completely!
      if (mode === 'tanks_only' && !isTankSheet) {
        continue;
      }

      const worksheet = wb.Sheets[sheetName];
      if (!worksheet) continue;

      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!rows || rows.length === 0) continue;

      let tagColIdx = -1;
      let modelColIdx = -1;
      let headerRowIdx = -1;

      for (let r = 0; r < Math.min(rows.length, 30); r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;
        const rowUpper = row.map(cell => String(cell || '').trim().toUpperCase());

        let foundTag = -1;
        if (isTankSheet) {
          // MANDATORY FOR TANKS: Serial Number column exclusively. Exclude date/inspection headers.
          foundTag = rowUpper.findIndex(cell => 
            tankSerialKeywords.some(kw => cell === kw || cell.includes(kw)) &&
            !dateHeaderKeywords.some(dkw => cell.includes(dkw))
          );
        } else {
          foundTag = rowUpper.findIndex(cell => 
            tagKeywords.some(kw => cell.includes(kw)) &&
            !dateHeaderKeywords.some(dkw => cell.includes(dkw))
          );
        }

        if (foundTag !== -1) {
          headerRowIdx = r;
          tagColIdx = foundTag;
          const foundModel = rowUpper.findIndex(cell => modelKeywords.some(kw => cell.includes(kw)));
          if (foundModel !== -1 && foundModel !== foundTag) {
            modelColIdx = foundModel;
          }
          break;
        }
      }

      // Auto-heuristic guessing ONLY FOR NON-TANK SHEETS!
      if (tagColIdx === -1 && !isTankSheet) {
        for (let c = 0; c < Math.min(15, rows[0]?.length || 15); c++) {
          let matchesPatternCount = 0;
          for (let r = 0; r < Math.min(rows.length, 25); r++) {
            const rawVal = rows[r]?.[c];
            if (isDateOrInvalidEquipmentNumber(rawVal)) continue;

            const val = String(rawVal || '').trim().toUpperCase();
            if (/^[A-Z0-9\/\-\_]{3,20}$/.test(val) && !tagKeywords.includes(val) && !['TOTAL', 'SUBTOTAL'].includes(val)) {
              matchesPatternCount++;
            }
          }
          if (matchesPatternCount >= 3) {
            tagColIdx = c;
            break;
          }
        }
      }

      if (tagColIdx === -1) continue;

      const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
      for (let r = startRow; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;

        const rawTag = row[tagColIdx];

        // PRE-SAVE VALIDATION: Reject any Serial Number that is a Date object, date string or timestamp!
        if (isDateOrInvalidEquipmentNumber(rawTag)) {
          console.warn(`[FleetRecoveryModal] Serial Number da linha ${r + 1} cancelado por conter data/timestamp: ${String(rawTag)}`);
          continue;
        }

        const cleanTag = String(rawTag || '').trim().toUpperCase();
        if (!cleanTag || cleanTag.length < 2 || cleanTag.length > 35) continue;

        const rawModelText = modelColIdx !== -1 ? String(row[modelColIdx] || '').trim() : '';
        const rowText = row.map(c => String(c || '')).join(' ');

        let finalType: FleetType = defaultType;
        if (isTankSheet) {
          finalType = determineTankType(rawModelText, cleanTag, rowText);
        }

        extracted.push({
          equipmentNumber: cleanTag,
          type: finalType,
          location: 'BASE',
          status: 'Cadastro Pendente de Validação',
          isPendingValidation: true,
          validationStatus: 'pending'
        });
      }
    }

    return extracted;
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    setIsProcessing(true);
    setStep('analyzing');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        
        const items = parseWorkbook(wb, recoveryMode);
        if (items.length === 0) {
          setErrorMessage('Nenhum registro de ativo válido foi encontrado no arquivo selecionado.');
          setIsProcessing(false);
          setStep('upload');
          return;
        }

        setParsedItems(items);
        setIsProcessing(false);
      } catch (err: any) {
        console.error('Erro ao ler arquivo excel:', err);
        setErrorMessage(`Falha na leitura do arquivo: ${err?.message || 'Arquivo inválido'}`);
        setIsProcessing(false);
        setStep('upload');
      }
    };

    reader.onerror = () => {
      setErrorMessage('Erro de leitura do arquivo.');
      setIsProcessing(false);
      setStep('upload');
    };

    reader.readAsArrayBuffer(file);
  };

  const handleStartRecovery = async () => {
    if (parsedItems.length === 0) return;

    setStep('recovering');
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const report = await onRecoverConfirmed(parsedItems, (msg, curr, tot) => {
        setProgressMsg(msg);
        setProgressCurrent(curr);
        setProgressTotal(tot);
      });

      setRecoveryReport(report);
      setStep('report');
    } catch (err: any) {
      console.error('Erro ao executar recuperação:', err);
      setErrorMessage(`Erro durante o processo de recuperação: ${err?.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 border border-blue-500/30 rounded-2xl text-blue-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wide">
                Recuperar Registros Não Importados
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Resgate seguro de ativos com a regra Tipo + Número simultâneos
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-900 dark:text-slate-100">
          
          {/* Rules Banner */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs space-y-2">
            <div className="flex items-center gap-2 font-black text-blue-600 dark:text-blue-400 uppercase">
              <ShieldCheck className="w-4 h-4" />
              Garantias da Ferramenta de Recuperação
            </div>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-1 font-medium">
              <li>Comparação estrita por <strong className="text-slate-900 dark:text-white">Tipo do Ativo + Número do Equipamento</strong> simultaneamente.</li>
              <li><strong className="text-emerald-600 dark:text-emerald-400">Sem Sobrescrever:</strong> Registros existentes no banco são mantidos sem qualquer alteração.</li>
              <li><strong className="text-emerald-600 dark:text-emerald-400">Sem Exclusões:</strong> Nenhum dado será excluído ou mesclado.</li>
              <li><strong className="text-blue-600 dark:text-blue-400">Apenas Adição:</strong> Cadastra unicamente os ativos legítimos que deixaram de ser importados.</li>
            </ul>
          </div>

          {errorMessage && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Target Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                  Modo de Operação
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRecoveryMode('tanks_only')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      recoveryMode === 'tanks_only'
                        ? 'bg-blue-600/10 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-black text-xs uppercase mb-1">
                      <span>1. Reprocessar Tanques (TANK's)</span>
                      {recoveryMode === 'tanks_only' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                    </div>
                    <p className="text-[11px] font-medium leading-relaxed opacity-90">
                      Mapeamento exclusivo: <strong className="underline">Serial Number</strong> → Número e <strong className="underline">Model</strong> → Tipo. Ignora datas de teste e não altera CCUs, Reefers ou Slings.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecoveryMode('all')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      recoveryMode === 'all'
                        ? 'bg-blue-600/10 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-black text-xs uppercase mb-1">
                      <span>2. Resgate Geral da Frota</span>
                      {recoveryMode === 'all' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                    </div>
                    <p className="text-[11px] font-medium leading-relaxed opacity-90">
                      Verifica todas as abas (CCU, Tank, Reefer, Spooler, Sling) e adiciona apenas registros omitidos.
                    </p>
                  </button>
                </div>
              </div>

              <label 
                htmlFor="recovery-file-input"
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group text-center space-y-3"
              >
                <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Clique para selecionar ou arraste a planilha (.xlsx, .xls, .csv)
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {recoveryMode === 'tanks_only' 
                      ? 'Processará exclusivamente a aba TANK\'s para extração direta de Serial Number'
                      : 'Selecione a planilha completa da frota OEG para auditoria e resgate'}
                  </p>
                </div>
                <input 
                  id="recovery-file-input"
                  ref={fileInputRef}
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          )}

          {/* STEP 2: Analyzing / Preview */}
          {step === 'analyzing' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-500">Arquivo Analisado:</span>
                  <p className="font-black text-slate-900 dark:text-white text-sm">{selectedFile?.name}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-500">Registros Encontrados:</span>
                  <p className="font-black text-blue-600 dark:text-blue-400 text-sm">{parsedItems.length} ativos</p>
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs space-y-2 text-amber-800 dark:text-amber-200">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  Pronto para comparar com o Banco de Dados
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Clique no botão abaixo para iniciar a comparação. O sistema verificará se cada um dos {parsedItems.length} registros já existe no banco de dados com o mesmo Tipo e Número. Registros não encontrados serão adicionados automaticamente.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Selecionar Outro Arquivo
                </button>
                <button
                  type="button"
                  onClick={handleStartRecovery}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Iniciar Processamento de Recuperação
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Recovering Progress */}
          {step === 'recovering' && (
            <div className="py-8 text-center space-y-5">
              <div className="inline-flex p-4 bg-blue-500/10 text-blue-500 rounded-3xl animate-bounce">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">
                  Comparando e Recuperando Ativos...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {progressMsg || 'Processando registros do banco de dados...'}
                </p>
              </div>

              {progressTotal > 0 && (
                <div className="max-w-md mx-auto space-y-2">
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300"
                      style={{ width: `${Math.round((progressCurrent / progressTotal) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                    {progressCurrent} de {progressTotal} ({Math.round((progressCurrent / progressTotal) * 100)}%)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Report */}
          {step === 'report' && recoveryReport && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white">
                  Processo de Recuperação Concluído!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Relatório detalhado do resgate de registros omitidos
                </p>
              </div>

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Total Analisado</span>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {recoveryReport.totalAnalyzed}
                  </p>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-center">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase">Já Existentes (Ignorados)</span>
                  <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
                    {recoveryReport.alreadyExisting}
                  </p>
                </div>

                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Novos Recuperados</span>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {recoveryReport.recoveredCount}
                  </p>
                </div>
              </div>

              {/* Breakdown by Type */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-3xl space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  Total Recuperado por Tipo de Ativo
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(recoveryReport.breakdownByType).length > 0 ? (
                    Object.entries(recoveryReport.breakdownByType).map(([type, count]) => (
                      <div key={type} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                        <span className="font-bold text-slate-700 dark:text-slate-300 uppercase truncate">{type}</span>
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black rounded-lg text-xs">
                          +{count} recuperado(s)
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 p-3 text-center text-slate-500 font-medium">
                      Nenhum novo registro precisou ser recuperado. Todos os registros da planilha já existiam no banco de dados.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
