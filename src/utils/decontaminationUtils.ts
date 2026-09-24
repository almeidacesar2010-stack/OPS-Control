import { 
  parseISO, 
  format,
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter, 
  endOfQuarter, 
  subMonths, 
  startOfYear, 
  endOfYear,
  differenceInCalendarDays 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DecontaminationOperation, DecontaminationStatus, FilterPeriod } from '../types/decontamination';

export type DeconFilterPeriod = 'days' | 'weeks' | 'all' | 'custom' | 'week' | 'month' | 'quarter' | 'semester';

/**
 * Calculates Easter date for a given year using Meeus/Jones/Butcher algorithm
 */
export function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Returns Brazilian national holidays for a given year in 'YYYY-MM-DD' format
 */
export function getBrazilianHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  const pad = (n: number) => String(n).padStart(2, '0');
  const addHoliday = (m: number, d: number) => {
    holidays.add(`${year}-${pad(m)}-${pad(d)}`);
  };

  // Fixed Brazilian National Holidays
  addHoliday(1, 1);   // Confraternização Universal (Ano Novo)
  addHoliday(4, 21);  // Tiradentes
  addHoliday(5, 1);   // Dia Mundial do Trabalho
  addHoliday(9, 7);   // Independência do Brasil
  addHoliday(10, 12); // Nossa Senhora Aparecida
  addHoliday(11, 2);  // Finados
  addHoliday(11, 15); // Proclamação da República
  addHoliday(11, 20); // Consciência Negra
  addHoliday(12, 25); // Natal

  // Movable holidays based on Easter
  const easter = getEasterDate(year);

  // Carnaval (Terça-feira, 47 dias antes da Páscoa)
  const carnaval = new Date(easter.getTime() - 47 * 24 * 60 * 60 * 1000);
  holidays.add(`${carnaval.getFullYear()}-${pad(carnaval.getMonth() + 1)}-${pad(carnaval.getDate())}`);

  // Sexta-feira Santa / Paixão de Cristo (2 dias antes da Páscoa)
  const sextaSanta = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
  holidays.add(`${sextaSanta.getFullYear()}-${pad(sextaSanta.getMonth() + 1)}-${pad(sextaSanta.getDate())}`);

  // Corpus Christi (60 dias após a Páscoa)
  const corpusChristi = new Date(easter.getTime() + 60 * 24 * 60 * 60 * 1000);
  holidays.add(`${corpusChristi.getFullYear()}-${pad(corpusChristi.getMonth() + 1)}-${pad(corpusChristi.getDate())}`);

  return holidays;
}

/**
 * Checks if a specific date is a calendar business day (Segunda a Sexta, exceto feriados nacionais)
 */
export function isCalendarBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  const year = date.getFullYear();
  const holidays = getBrazilianHolidays(year);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateKey = `${year}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return !holidays.has(dateKey);
}

/**
 * Alias for isCalendarBusinessDay for compatibility
 */
export function isBusinessDay(date: Date): boolean {
  return isCalendarBusinessDay(date);
}

/**
 * Counts business days between start date and end date (inclusive) using calendar business days
 */
export function countCalendarBusinessDays(startDate: Date, endDate: Date): number {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  if (start.getTime() > end.getTime()) {
    return 0;
  }

  let count = 0;
  const current = new Date(start);
  while (current.getTime() <= end.getTime()) {
    if (isCalendarBusinessDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function countBusinessDays(startDate: Date, endDate: Date): number {
  return countCalendarBusinessDays(startDate, endDate);
}

/**
 * Calculates duration in days between two YYYY-MM-DD or ISO dates: endDate - startDate
 */
export function calculateDurationDays(startDateStr?: string, endDateStr?: string): number | null {
  if (!startDateStr || !endDateStr) return null;
  try {
    const start = startOfDay(parseISO(startDateStr.slice(0, 10)));
    const end = startOfDay(parseISO(endDateStr.slice(0, 10)));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    if (start.getTime() > end.getTime()) return 0;
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export function calculateDurationHours(startDateStr?: string, endDateStr?: string): number | null {
  return calculateDurationDays(startDateStr, endDateStr);
}

export function getWaitTimeHours(op: DecontaminationOperation): number | null {
  return calculateDurationDays(op.arrivalDate, op.startDate);
}

export function getDeconTimeHours(op: DecontaminationOperation): number | null {
  return calculateDurationDays(op.startDate, op.endDate);
}

export function getLeadTimeHours(op: DecontaminationOperation): number | null {
  return calculateDurationDays(op.arrivalDate, op.endDate);
}

/**
 * Formats duration in days (e.g., "0,3 dias", "1 dia", "3 dias")
 */
export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined || isNaN(days)) return '—';
  if (days === 1) return '1 dia';
  const val = Number.isInteger(days) ? days.toString() : days.toFixed(1).replace('.', ',');
  return `${val} dias`;
}

export function formatHours(hoursOrDays: number | null): string {
  return formatDays(hoursOrDays);
}

export function formatDailyAverage(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0,0';
  return val.toFixed(1).replace('.', ',');
}

export function formatDateDisplay(dateStr?: string): string {
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

export function computeAverage(arr: (number | null)[]): number | null {
  const valid = arr.filter((val): val is number => val !== null && !isNaN(val));
  if (valid.length === 0) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return sum / valid.length;
}

/**
 * Data mínima de corte para o módulo e indicadores de descontaminação: 03/08/2026
 */
export const DECON_MIN_DATE = '2026-08-03';
export const DECON_MIN_DATE_OBJ = new Date(2026, 7, 3); // 03 de Agosto de 2026 (Segunda-feira)

/**
 * Helper para interpretar strings de data nos formatos YYYY-MM-DD, ISO ou DD/MM/YYYY
 */
export function parseDateStringToDate(str?: string | null): Date | null {
  if (!str) return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(parsed.getTime()) ? null : startOfDay(parsed);
  }

  try {
    const parsed = startOfDay(parseISO(trimmed.slice(0, 10)));
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Verifica se a operação de descontaminação pertence ao período a partir de 03/08/2026 em diante
 */
export function isOpOnOrAfterMinDate(
  op: DecontaminationOperation,
  minDate: Date = DECON_MIN_DATE_OBJ
): boolean {
  // Para concluídas, prioriza a data de conclusão
  const dateStr = op.status === 'completed'
    ? (op.endDate || op.startDate || op.arrivalDate)
    : (op.arrivalDate || op.startDate || op.endDate);

  const parsed = parseDateStringToDate(dateStr);
  if (parsed) {
    return parsed.getTime() >= startOfDay(minDate).getTime();
  }

  // Fallback createdAt
  if (op.createdAt) {
    try {
      const cDate = typeof op.createdAt === 'string'
        ? parseDateStringToDate(op.createdAt)
        : (op.createdAt.toDate ? startOfDay(op.createdAt.toDate()) : null);
      if (cDate) {
        return cDate.getTime() >= startOfDay(minDate).getTime();
      }
    } catch {}
  }

  return true;
}

/**
 * Verifies if an operation's date falls within a period filter
 */
export function isOperationInPeriod(
  op: DecontaminationOperation, 
  period: FilterPeriod | DeconFilterPeriod, 
  customStart?: string, 
  customEnd?: string,
  referenceDate: Date = new Date()
): boolean {
  // Considerar apenas a partir de 03/08/2026 em diante
  if (!isOpOnOrAfterMinDate(op, DECON_MIN_DATE_OBJ)) return false;

  if (period === 'all' || period === 'days' || period === 'weeks') return true;
  const opDateStr = op.arrivalDate || op.startDate || op.endDate;
  if (!opDateStr) return false;

  try {
    const opDate = parseDateStringToDate(opDateStr);
    if (!opDate) return false;

    const now = referenceDate;

    if (period === 'today') {
      return isWithinInterval(opDate, { start: startOfDay(now), end: endOfDay(now) });
    }
    if (period === 'week') {
      return isWithinInterval(opDate, { 
        start: startOfWeek(now, { weekStartsOn: 1 }), 
        end: endOfWeek(now, { weekStartsOn: 1 }) 
      });
    }
    if (period === 'month') {
      return isWithinInterval(opDate, { 
        start: startOfMonth(now), 
        end: endOfMonth(now) 
      });
    }
    if (period === 'quarter') {
      return isWithinInterval(opDate, { 
        start: startOfQuarter(now), 
        end: endOfQuarter(now) 
      });
    }
    if (period === 'semester') {
      const isFirstSemester = now.getMonth() < 6;
      const sStart = new Date(now.getFullYear(), isFirstSemester ? 0 : 6, 1);
      const sEnd = endOfMonth(new Date(now.getFullYear(), isFirstSemester ? 5 : 11, 1));
      return isWithinInterval(opDate, { start: sStart, end: sEnd });
    }
    if (period === 'year') {
      return isWithinInterval(opDate, { 
        start: startOfYear(now), 
        end: endOfYear(now) 
      });
    }
    if (period === 'custom' && customStart && customEnd) {
      const start = parseDateStringToDate(customStart) || DECON_MIN_DATE_OBJ;
      const end = parseDateStringToDate(customEnd) || endOfDay(new Date());
      return isWithinInterval(opDate, { start, end: endOfDay(end) });
    }
  } catch {
    return false;
  }
  return true;
}

/**
 * Gets real completion date of a completed decontamination operation
 * Priority: 1. endDate, 2. startDate, 3. arrivalDate
 * Exclui qualquer registro antes de 03/08/2026
 */
export function getOpCompletionDate(op: DecontaminationOperation): Date | null {
  if (op.status !== 'completed') return null;
  const dateStr = op.endDate || op.startDate || op.arrivalDate;
  if (!dateStr) return null;
  try {
    const d = parseDateStringToDate(dateStr);
    if (!d) return null;
    // Considerar apenas a partir de 03/08/2026 em diante
    if (d.getTime() < startOfDay(DECON_MIN_DATE_OBJ).getTime()) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Checks if an operation has been FINALIZED within a specific Date interval [start, end]
 */
export function isOpFinalizedInDateRange(op: DecontaminationOperation, start: Date, end: Date): boolean {
  const d = getOpCompletionDate(op);
  if (!d) return false;
  return d.getTime() >= startOfDay(start).getTime() && d.getTime() <= endOfDay(end).getTime();
}

export interface PeriodInterval {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Gets exact current and immediately previous equivalent period bounds
 * GERAL spans exclusively from the first real operation date to the last real operation date
 */
export function getDeconPeriodBounds(
  period: DeconFilterPeriod,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date(),
  allOperations?: DecontaminationOperation[]
): { current: PeriodInterval; previous: PeriodInterval | null } {
  const ref = startOfDay(referenceDate);

  if (period === 'all' || period === 'days' || period === 'weeks') {
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;

    if (allOperations && allOperations.length > 0) {
      const validOps = allOperations.filter(op => isOpOnOrAfterMinDate(op, DECON_MIN_DATE_OBJ));
      const completed = validOps.filter(op => op.status === 'completed');
      const targetList = completed.length > 0 ? completed : validOps;
      targetList.forEach(op => {
        const d = op.status === 'completed'
          ? getOpCompletionDate(op)
          : parseDateStringToDate(op.startDate || op.arrivalDate || op.endDate);
        if (d && d.getTime() >= DECON_MIN_DATE_OBJ.getTime()) {
          if (!earliestDate || d.getTime() < earliestDate.getTime()) earliestDate = d;
          if (!latestDate || d.getTime() > latestDate.getTime()) latestDate = d;
        }
      });
    }

    if (earliestDate && latestDate) {
      if (earliestDate.getTime() < DECON_MIN_DATE_OBJ.getTime()) {
        earliestDate = DECON_MIN_DATE_OBJ;
      }
      return {
        current: {
          start: earliestDate,
          end: endOfDay(latestDate),
          label: format(earliestDate, 'dd/MM/yyyy') === format(latestDate, 'dd/MM/yyyy')
            ? format(earliestDate, 'dd/MM/yyyy')
            : `${format(earliestDate, 'dd/MM/yyyy')} a ${format(latestDate, 'dd/MM/yyyy')}`
        },
        previous: null
      };
    }

    let defaultLabel = 'Histórico Geral';
    if (period === 'days') defaultLabel = 'Dia a Dia';
    if (period === 'weeks') defaultLabel = 'Semana a Semana';
    if (period === 'all') defaultLabel = 'Todo o Período';

    return {
      current: {
        start: startOfMonth(ref),
        end: endOfMonth(ref),
        label: defaultLabel
      },
      previous: null
    };
  }

  if (period === 'week') {
    const curStart = startOfWeek(ref, { weekStartsOn: 1 });
    const curEnd = endOfWeek(ref, { weekStartsOn: 1 });
    const prevStart = subDays(curStart, 7);
    const prevEnd = subDays(curEnd, 7);
    return {
      current: {
        start: curStart,
        end: curEnd,
        label: `Semana ${format(curStart, 'dd/MM')} a ${format(curEnd, 'dd/MM/yyyy')}`
      },
      previous: {
        start: prevStart,
        end: prevEnd,
        label: `Semana ${format(prevStart, 'dd/MM')} a ${format(prevEnd, 'dd/MM/yyyy')}`
      }
    };
  }

  if (period === 'month') {
    const curStart = startOfMonth(ref);
    const curEnd = endOfMonth(ref);
    const prevStart = startOfMonth(subMonths(ref, 1));
    const prevEnd = endOfMonth(subMonths(ref, 1));
    return {
      current: {
        start: curStart,
        end: curEnd,
        label: format(curStart, 'MMMM/yyyy', { locale: ptBR })
      },
      previous: {
        start: prevStart,
        end: prevEnd,
        label: format(prevStart, 'MMMM/yyyy', { locale: ptBR })
      }
    };
  }

  if (period === 'quarter') {
    const curStart = startOfQuarter(ref);
    const curEnd = endOfQuarter(ref);
    const prevQuarterRef = subMonths(curStart, 1);
    const prevStart = startOfQuarter(prevQuarterRef);
    const prevEnd = endOfQuarter(prevQuarterRef);
    const curQ = Math.floor(ref.getMonth() / 3) + 1;
    const prevQ = Math.floor(prevQuarterRef.getMonth() / 3) + 1;
    return {
      current: {
        start: curStart,
        end: curEnd,
        label: `${curQ}º Trimestre/${ref.getFullYear()}`
      },
      previous: {
        start: prevStart,
        end: prevEnd,
        label: `${prevQ}º Trimestre/${prevQuarterRef.getFullYear()}`
      }
    };
  }

  if (period === 'semester') {
    const isFirstSemester = ref.getMonth() < 6;
    const year = ref.getFullYear();
    const curStart = new Date(year, isFirstSemester ? 0 : 6, 1);
    const curEnd = endOfMonth(new Date(year, isFirstSemester ? 5 : 11, 1));
    
    let prevStart: Date;
    let prevEnd: Date;
    let prevLabel: string;
    if (isFirstSemester) {
      prevStart = new Date(year - 1, 6, 1);
      prevEnd = endOfMonth(new Date(year - 1, 11, 1));
      prevLabel = `2º Semestre/${year - 1}`;
    } else {
      prevStart = new Date(year, 0, 1);
      prevEnd = endOfMonth(new Date(year, 5, 1));
      prevLabel = `1º Semestre/${year}`;
    }

    return {
      current: {
        start: curStart,
        end: curEnd,
        label: `${isFirstSemester ? '1º' : '2º'} Semestre/${year}`
      },
      previous: {
        start: prevStart,
        end: prevEnd,
        label: prevLabel
      }
    };
  }

  if (period === 'custom' && customStart && customEnd) {
    try {
      const curStart = startOfDay(parseISO(customStart));
      const curEnd = endOfDay(parseISO(customEnd));
      const durationMs = curEnd.getTime() - curStart.getTime();
      const prevEnd = new Date(curStart.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - durationMs);
      return {
        current: {
          start: curStart,
          end: curEnd,
          label: `${format(curStart, 'dd/MM/yyyy')} a ${format(curEnd, 'dd/MM/yyyy')}`
        },
        previous: {
          start: prevStart,
          end: prevEnd,
          label: `${format(prevStart, 'dd/MM/yyyy')} a ${format(prevEnd, 'dd/MM/yyyy')}`
        }
      };
    } catch {
      // Fallback below
    }
  }

  const curStart = startOfMonth(ref);
  const curEnd = endOfMonth(ref);
  return {
    current: { start: curStart, end: curEnd, label: format(curStart, 'MMMM/yyyy', { locale: ptBR }) },
    previous: null
  };
}

/**
 * Calculates the 4 Main Top Indicators (Parte 1)
 */
export interface MainIndicatorsData {
  totalCompletedInPeriod: number;       // 1. TANQUES DESCONTAMINADOS (volume puro finalizado no período)
  inProgressCount: number;              // 2. TANQUES EM DESCONTAMINAÇÃO (estoque atual)
  waitingCount: number;                 // 3. TANQUES AGUARDANDO DESCONTAMINAÇÃO (fila atual)
  avgDeconDurationDays: number | null;  // 4. TEMPO MÉDIO DE DESCONTAMINAÇÃO (duração média início -> fim)
  waitingTanksList: DecontaminationOperation[];
  inProgressTanksList: DecontaminationOperation[];
  periodLabel: string;
}

export function calculateMainIndicators(
  allOperations: DecontaminationOperation[],
  period: DeconFilterPeriod,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): MainIndicatorsData {
  const bounds = getDeconPeriodBounds(period, customStart, customEnd, referenceDate, allOperations);
  const currentInterval = bounds.current;

  // 1. TANQUES DESCONTAMINADOS (Volume puro de finalizados no período selecionado)
  const completedInPeriod = allOperations.filter(op => 
    isOpFinalizedInDateRange(op, currentInterval.start, currentInterval.end)
  );
  const totalCompletedInPeriod = completedInPeriod.length;

  // 2. TANQUES EM DESCONTAMINAÇÃO (Estoque atual em processo)
  const inProgressTanksList = allOperations.filter(op => op.status === 'in_progress');
  const inProgressCount = inProgressTanksList.length;

  // 3. TANQUES AGUARDANDO DESCONTAMINAÇÃO (Fila atual)
  const waitingTanksList = allOperations.filter(op => op.status === 'waiting');
  const waitingCount = waitingTanksList.length;

  // 4. TEMPO MÉDIO DE DESCONTAMINAÇÃO (somente finalizados no período selecionado)
  const deconDurations: number[] = [];
  completedInPeriod.forEach(op => {
    if (op.startDate && op.endDate) {
      const dur = calculateDurationDays(op.startDate, op.endDate);
      if (dur !== null && !isNaN(dur)) {
        deconDurations.push(dur);
      }
    }
  });

  const avgDeconDurationDays = deconDurations.length > 0
    ? deconDurations.reduce((a, b) => a + b, 0) / deconDurations.length
    : null;

  return {
    totalCompletedInPeriod,
    inProgressCount,
    waitingCount,
    avgDeconDurationDays,
    waitingTanksList,
    inProgressTanksList,
    periodLabel: currentInterval.label
  };
}

/**
 * Variation Result Structure (Parte 6)
 */
export interface VariationResult {
  percent: number;
  direction: 'up' | 'down' | 'stable' | 'insufficient';
  label: string; // e.g. "AUMENTO DO RITMO", "QUEDA DO RITMO", "ESTÁVEL", "Sem histórico suficiente"
  formattedDiff: string; // e.g. "+14,3%", "-14,3%", "0,0%"
  hasSufficientData: boolean;
}

export function computePercentageVariation(
  current: number,
  previous: number | null | undefined,
  metricType: 'RITMO' | 'PRODUTIVIDADE'
): VariationResult {
  if (previous === null || previous === undefined || previous <= 0) {
    return {
      percent: 0,
      direction: 'insufficient',
      label: 'Histórico em formação',
      formattedDiff: '—',
      hasSufficientData: false
    };
  }

  const diff = current - previous;
  const rawPercent = (diff / previous) * 100;
  const percent = Math.abs(Number(rawPercent.toFixed(1)));

  if (rawPercent > 0.05) {
    return {
      percent,
      direction: 'up',
      label: 'AUMENTO',
      formattedDiff: `↑ ${percent.toFixed(1).replace('.', ',')}%`,
      hasSufficientData: true
    };
  } else if (rawPercent < -0.05) {
    return {
      percent,
      direction: 'down',
      label: 'QUEDA',
      formattedDiff: `↓ ${percent.toFixed(1).replace('.', ',')}%`,
      hasSufficientData: true
    };
  } else {
    return {
      percent: 0,
      direction: 'stable',
      label: 'ESTÁVEL',
      formattedDiff: '0,0%',
      hasSufficientData: true
    };
  }
}

/**
 * RHYTHM DASHBOARD DATA (Parte 4)
 * Ritmo de Descontaminação = Tanques Descontaminados ÷ Dias Úteis do Período (dias úteis de calendário)
 */
export interface RhythmChartPoint {
  key: string;
  label: string;
  periodRange: string; // e.g. "03/08–09/08"
  fullPeriodLabel: string;
  completedCount: number;
  businessDays: number;
  ritmo: number; // Tanques / Dia Útil
  isCurrent: boolean;
  isMax: boolean;
  isMin: boolean;
}

export interface RhythmDashboardData {
  chartData: RhythmChartPoint[];
  averagePace: number;          // 1. RITMO MÉDIO: tanques concluídos ÷ dias úteis
  currentPace: number;          // 2. RITMO ATUAL: ritmo do período mais recente
  currentPaceLabel: string;     // Período do ritmo atual
  bestPace: number;             // 3. MELHOR RITMO: maior ritmo real encontrado
  bestPacePeriod: string | null;// Período onde ocorreu o melhor ritmo
  // Compatibilidade e dados complementares
  maxPace: number;
  maxPacePeriod: string | null;
  minPace: number;
  minPacePeriod: string | null;
  currentPeriodLabel: string;
  completedInCurrent: number;   // Total tanques concluídos analisados
  currentBusinessDays: number;  // Total dias úteis analisados
  totalCompleted: number;
  totalBusinessDays: number;
  variation?: VariationResult;
  previousPace?: number | null;
  previousPeriodLabel?: string | null;
}

/**
 * Comparable period bucket definition
 * Every bucket represents a real period containing at least one real completed operation
 */
export interface DeconComparableBucket {
  key: string;
  label: string;
  periodRange: string;
  fullPeriodLabel: string;
  start: Date;
  end: Date;
  businessDays: number;
}

/**
 * RHYTHM COMPARABLE BUCKETS
 * REGRA FUNDAMENTAL: NUNCA utilizar a quantidade produzida em um único dia como “ritmo”.
 * Ritmo deve representar a VELOCIDADE MÉDIA da operação em períodos agrupados (preferencialmente semanais).
 * Fórmula: tanques produzidos no período ÷ dias úteis do período.
 */
export function getRhythmComparableBuckets(
  allOperations: DecontaminationOperation[],
  period: DeconFilterPeriod,
  currentInterval: PeriodInterval,
  customStart?: string,
  customEnd?: string
): DeconComparableBucket[] {
  const completedOps = allOperations.filter(op => op.status === 'completed' && isOpOnOrAfterMinDate(op, DECON_MIN_DATE_OBJ));

  if (completedOps.length === 0) {
    return [];
  }

  const scopedOps = (period === 'all' || period === 'days' || period === 'weeks')
    ? completedOps
    : completedOps.filter(op => isOpFinalizedInDateRange(op, currentInterval.start, currentInterval.end));

  if (scopedOps.length === 0) {
    return [];
  }

  // Agrupa semanas com contagem de dias úteis reais (Segunda a Sexta, sem feriados)
  const buildWeeklyRhythmBuckets = (ops: DecontaminationOperation[]) => {
    const weekMap = new Map<string, { start: Date; end: Date; ops: DecontaminationOperation[] }>();
    ops.forEach(op => {
      const d = getOpCompletionDate(op);
      if (d) {
        const wStart = startOfWeek(d, { weekStartsOn: 1 });
        const wEnd = endOfWeek(d, { weekStartsOn: 1 });
        const key = format(wStart, 'yyyy-MM-dd');
        if (!weekMap.has(key)) {
          weekMap.set(key, { start: wStart, end: wEnd, ops: [] });
        }
        weekMap.get(key)!.ops.push(op);
      }
    });

    const sortedWeeks = Array.from(weekMap.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
    return sortedWeeks.map((w, idx) => {
      const now = new Date();
      const effectiveEnd = w.end.getTime() > now.getTime() ? now : w.end;
      // Dias úteis reais da semana (segunda a sexta, excluindo feriados)
      const bDays = Math.max(1, countCalendarBusinessDays(w.start, effectiveEnd));

      const weekLabel = `Semana ${idx + 1}`;
      const rangeStr = `${format(w.start, 'dd/MM')} a ${format(w.end, 'dd/MM')}`;

      return {
        key: format(w.start, 'yyyy-MM-dd'),
        label: weekLabel,
        periodRange: `${weekLabel} (${rangeStr})`,
        fullPeriodLabel: `${weekLabel} (${format(w.start, 'dd/MM')} a ${format(w.end, 'dd/MM/yyyy')})`,
        start: w.start,
        end: w.end,
        businessDays: bDays
      };
    });
  };

  // Para 'days', 'weeks' e 'all', o Ritmo é SEMPRE avaliado por períodos agrupados (semanais)
  if (period === 'days' || period === 'weeks' || period === 'all') {
    return buildWeeklyRhythmBuckets(scopedOps);
  }

  if (period === 'custom') {
    let cStart = currentInterval.start;
    let cEnd = currentInterval.end;
    if (customStart && customEnd) {
      try {
        cStart = startOfDay(parseISO(customStart));
        cEnd = endOfDay(parseISO(customEnd));
      } catch {}
    }

    const daysDiff = Math.ceil((cEnd.getTime() - cStart.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff >= 7) {
      return buildWeeklyRhythmBuckets(scopedOps);
    } else {
      const bDays = Math.max(1, countCalendarBusinessDays(cStart, cEnd));
      return [{
        key: format(cStart, 'yyyy-MM-dd'),
        label: `${format(cStart, 'dd/MM')}–${format(cEnd, 'dd/MM')}`,
        periodRange: `${format(cStart, 'dd/MM')} a ${format(cEnd, 'dd/MM')}`,
        fullPeriodLabel: `${format(cStart, 'dd/MM/yyyy')} a ${format(cEnd, 'dd/MM/yyyy')}`,
        start: cStart,
        end: cEnd,
        businessDays: bDays
      }];
    }
  }

  return buildWeeklyRhythmBuckets(scopedOps);
}

/**
 * PRODUCTIVITY COMPARABLE BUCKETS
 * PRODUTIVIDADE = VOLUME (QUANTOS TANQUES FORAM PRODUZIDOS)
 * - 'days': dia a dia real com produção (04/08 → 1, 06/08 → 6, 07/08 → 8, etc.)
 * - 'weeks': semana a semana
 * - 'all': mês a mês
 * - 'custom': dia a dia (<=31 dias) ou semana a semana (>31 dias)
 */
export function getProductivityComparableBuckets(
  allOperations: DecontaminationOperation[],
  period: DeconFilterPeriod,
  currentInterval: PeriodInterval,
  customStart?: string,
  customEnd?: string
): DeconComparableBucket[] {
  const completedOps = allOperations.filter(op => op.status === 'completed' && isOpOnOrAfterMinDate(op, DECON_MIN_DATE_OBJ));

  if (completedOps.length === 0) {
    return [];
  }

  const scopedOps = (period === 'all' || period === 'days' || period === 'weeks')
    ? completedOps
    : completedOps.filter(op => isOpFinalizedInDateRange(op, currentInterval.start, currentInterval.end));

  if (scopedOps.length === 0) {
    return [];
  }

  // 1. DIA A DIA: volume produzido em cada data
  const buildDailyBuckets = (ops: DecontaminationOperation[]) => {
    const dayMap = new Map<string, Date>();
    ops.forEach(op => {
      const d = getOpCompletionDate(op);
      if (d) {
        const k = format(d, 'yyyy-MM-dd');
        if (!dayMap.has(k)) dayMap.set(k, d);
      }
    });

    const sortedDays = Array.from(dayMap.values()).sort((a, b) => a.getTime() - b.getTime());
    return sortedDays.map(d => ({
      key: format(d, 'yyyy-MM-dd'),
      label: format(d, 'dd/MM'),
      periodRange: format(d, 'dd/MM/yyyy'),
      fullPeriodLabel: format(d, 'dd/MM/yyyy'),
      start: startOfDay(d),
      end: endOfDay(d),
      businessDays: 1
    }));
  };

  // 2. SEMANA A SEMANA: volume produzido em cada semana
  const buildWeeklyBuckets = (ops: DecontaminationOperation[]) => {
    const weekMap = new Map<string, { start: Date; end: Date; ops: DecontaminationOperation[] }>();
    ops.forEach(op => {
      const d = getOpCompletionDate(op);
      if (d) {
        const wStart = startOfWeek(d, { weekStartsOn: 1 });
        const wEnd = endOfWeek(d, { weekStartsOn: 1 });
        const key = format(wStart, 'yyyy-MM-dd');
        if (!weekMap.has(key)) {
          weekMap.set(key, { start: wStart, end: wEnd, ops: [] });
        }
        weekMap.get(key)!.ops.push(op);
      }
    });

    const sortedWeeks = Array.from(weekMap.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
    return sortedWeeks.map((w, idx) => {
      const weekLabel = `Semana ${idx + 1}`;
      const rangeStr = `${format(w.start, 'dd/MM')} a ${format(w.end, 'dd/MM')}`;

      return {
        key: format(w.start, 'yyyy-MM-dd'),
        label: weekLabel,
        periodRange: `${weekLabel} (${rangeStr})`,
        fullPeriodLabel: `${weekLabel} (${format(w.start, 'dd/MM')} a ${format(w.end, 'dd/MM/yyyy')})`,
        start: w.start,
        end: w.end,
        businessDays: 1
      };
    });
  };

  // 3. MÊS A MÊS: volume produzido em cada mês
  const buildMonthlyBuckets = (ops: DecontaminationOperation[]) => {
    const monthMap = new Map<string, { start: Date; end: Date; ops: DecontaminationOperation[] }>();
    ops.forEach(op => {
      const d = getOpCompletionDate(op);
      if (d) {
        const mStart = startOfMonth(d);
        const mEnd = endOfMonth(d);
        const key = format(mStart, 'yyyy-MM');
        if (!monthMap.has(key)) {
          monthMap.set(key, { start: mStart, end: mEnd, ops: [] });
        }
        monthMap.get(key)!.ops.push(op);
      }
    });

    const sortedMonths = Array.from(monthMap.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
    return sortedMonths.map(m => ({
      key: format(m.start, 'yyyy-MM'),
      label: format(m.start, 'MM/yy'),
      periodRange: format(m.start, 'MMMM/yyyy', { locale: ptBR }),
      fullPeriodLabel: format(m.start, 'MMMM/yyyy', { locale: ptBR }),
      start: m.start,
      end: m.end,
      businessDays: 1
    }));
  };

  if (period === 'days') {
    return buildDailyBuckets(scopedOps);
  }

  if (period === 'weeks') {
    return buildWeeklyBuckets(scopedOps);
  }

  if (period === 'all') {
    return buildMonthlyBuckets(scopedOps);
  }

  if (period === 'custom') {
    let cStart = currentInterval.start;
    let cEnd = currentInterval.end;
    if (customStart && customEnd) {
      try {
        cStart = startOfDay(parseISO(customStart));
        cEnd = endOfDay(parseISO(customEnd));
      } catch {}
    }

    const daysDiff = Math.ceil((cEnd.getTime() - cStart.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 31) {
      return buildDailyBuckets(scopedOps);
    } else {
      return buildWeeklyBuckets(scopedOps);
    }
  }

  return buildDailyBuckets(scopedOps);
}

// Wrapper para compatibilidade retroativa
export function getDeconComparableBuckets(
  allOperations: DecontaminationOperation[],
  period: DeconFilterPeriod,
  currentInterval: PeriodInterval,
  customStart?: string,
  customEnd?: string
): DeconComparableBucket[] {
  return getProductivityComparableBuckets(allOperations, period, currentInterval, customStart, customEnd);
}

export function generateRhythmDashboardData(
  allOperations: DecontaminationOperation[],
  period: DeconFilterPeriod,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): RhythmDashboardData {
  const ref = startOfDay(referenceDate);
  const bounds = getDeconPeriodBounds(period, customStart, customEnd, ref, allOperations);

  // 1. Gera os buckets da evolução baseados exclusivamente em períodos agrupados de ritmo (semanais)
  const buckets = getRhythmComparableBuckets(allOperations, period, bounds.current, customStart, customEnd);

  let points: RhythmChartPoint[] = buckets.map((b, idx) => {
    const wOps = allOperations.filter(op => isOpFinalizedInDateRange(op, b.start, b.end));
    const completedCount = wOps.length;
    const businessDays = b.businessDays;
    const ritmo = businessDays > 0 ? Number((completedCount / businessDays).toFixed(1)) : completedCount;
    const isCurrent = (b.start.getTime() <= ref.getTime() && b.end.getTime() >= ref.getTime()) || (idx === buckets.length - 1);

    return {
      key: b.key,
      label: b.label,
      periodRange: b.periodRange,
      fullPeriodLabel: b.fullPeriodLabel,
      completedCount,
      businessDays,
      ritmo,
      isCurrent,
      isMax: false,
      isMin: false
    };
  });

  // 1. RITMO MÉDIO: tanques concluídos ÷ dias úteis
  const totalCompleted = points.reduce((acc, p) => acc + p.completedCount, 0);
  const totalBusinessDays = points.reduce((acc, p) => acc + p.businessDays, 0);
  const averagePace = totalBusinessDays > 0
    ? Number((totalCompleted / totalBusinessDays).toFixed(1))
    : 0;

  // 2. RITMO ATUAL: ritmo do período mais recente disponível
  const currentPoint = points.length > 0 ? points[points.length - 1] : null;
  const currentPace = currentPoint ? currentPoint.ritmo : 0;
  const currentPaceLabel = currentPoint ? (currentPoint.fullPeriodLabel || currentPoint.label) : '-';

  // 3. MELHOR RITMO: maior ritmo real encontrado dentro do intervalo analisado
  let bestPace = 0;
  let bestPacePeriod: string | null = null;

  points.forEach(p => {
    if (p.completedCount > 0 && p.ritmo > bestPace) {
      bestPace = p.ritmo;
      bestPacePeriod = p.fullPeriodLabel || p.label;
    }
  });

  points.forEach(p => {
    if (bestPace > 0 && p.ritmo === bestPace) p.isMax = true;
  });

  return {
    chartData: points,
    averagePace,
    currentPace,
    currentPaceLabel,
    bestPace,
    bestPacePeriod,
    maxPace: bestPace,
    maxPacePeriod: bestPacePeriod,
    minPace: 0,
    minPacePeriod: null,
    currentPeriodLabel: bounds.current.label,
    completedInCurrent: totalCompleted,
    currentBusinessDays: totalBusinessDays,
    totalCompleted,
    totalBusinessDays
  };
}

/**
 * PRODUCTIVITY DASHBOARD DATA
 * - PRODUÇÃO MÉDIA: Média de tanques produzidos por período analisado
 * - PICO DE PRODUÇÃO: Maior quantidade REAL de tanques concluídos em um único dia
 * - DIAS PRODUTIVOS: Quantidade de dias com pelo menos uma operação concluída
 */
export interface ProductivityChartPoint {
  key: string;
  label: string;
  periodRange: string;
  fullPeriodLabel: string;
  finalizados: number; // Volume real de tanques finalizados
  isCurrent: boolean;
  isPeak: boolean;
}

export interface ProductivityDashboardData {
  chartData: ProductivityChartPoint[];
  avgProduction: number;          // 1. PRODUÇÃO MÉDIA: tanques por período de comparação
  avgProductionPerPeriod: number; // alias para compatibilidade
  periodUnitLabel: string;        // "tanques / dia", "tanques / semana", "tanques / mês"
  periodSubLabel: string;         // "Média diária de produção", "Média semanal de produção", etc.
  peakDailyVolume: number;        // 2. PICO DE PRODUÇÃO: maior volume real em 1 único dia
  peakDailyCount: number;         // alias para compatibilidade
  peakDailyDate: string | null;   // Data do pico
  productiveDays: number;         // 3. DIAS PRODUTIVOS: contagem de datas com pelo menos 1 operação concluída
  currentPeriodLabel: string;
  totalDescontaminado?: number;
  variation?: VariationResult;
}

export function generateProductivityDashboardData(
  allOperations: DecontaminationOperation[],
  period: DeconFilterPeriod,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): ProductivityDashboardData {
  const ref = startOfDay(referenceDate);
  const bounds = getDeconPeriodBounds(period, customStart, customEnd, ref, allOperations);

  // 1. Gera os buckets da evolução baseados no volume de produção (dia a dia, semana ou mês)
  const buckets = getProductivityComparableBuckets(allOperations, period, bounds.current, customStart, customEnd);

  let points: ProductivityChartPoint[] = buckets.map((b, idx) => {
    const wOps = allOperations.filter(op => isOpFinalizedInDateRange(op, b.start, b.end));
    const finalizados = wOps.length;
    const isCurrent = (b.start.getTime() <= ref.getTime() && b.end.getTime() >= ref.getTime()) || (idx === buckets.length - 1);

    return {
      key: b.key,
      label: b.label,
      periodRange: b.periodRange,
      fullPeriodLabel: b.fullPeriodLabel,
      finalizados,
      isCurrent,
      isPeak: false
    };
  });

  const totalVolume = points.reduce((acc, p) => acc + p.finalizados, 0);

  // 1. PRODUÇÃO MÉDIA: quantidade média de tanques produzidos por período de comparação
  const avgProduction = points.length > 0
    ? Number((totalVolume / points.length).toFixed(1))
    : 0;

  // Unidade e subtítulo adaptados ao filtro
  let periodUnitLabel = 'tanques / período';
  let periodSubLabel = 'Média por período de comparação';
  if (period === 'days') {
    periodUnitLabel = 'tanques / dia';
    periodSubLabel = 'Média diária de produção';
  } else if (period === 'weeks') {
    periodUnitLabel = 'tanques / semana';
    periodSubLabel = 'Média semanal de produção';
  } else if (period === 'all') {
    periodUnitLabel = 'tanques / mês';
    periodSubLabel = 'Média mensal de produção';
  } else if (period === 'custom' && customStart && customEnd) {
    try {
      const cStart = startOfDay(parseISO(customStart));
      const cEnd = endOfDay(parseISO(customEnd));
      const daysDiff = Math.ceil((cEnd.getTime() - cStart.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 31) {
        periodUnitLabel = 'tanques / dia';
        periodSubLabel = 'Média diária de produção';
      } else {
        periodUnitLabel = 'tanques / semana';
        periodSubLabel = 'Média semanal de produção';
      }
    } catch {}
  } else if (period === 'week' || period === 'month') {
    periodUnitLabel = 'tanques / dia';
    periodSubLabel = 'Média diária de produção';
  } else if (period === 'quarter') {
    periodUnitLabel = 'tanques / semana';
    periodSubLabel = 'Média semanal de produção';
  } else if (period === 'semester') {
    periodUnitLabel = 'tanques / mês';
    periodSubLabel = 'Média mensal de produção';
  }

  // 2. PICO DE PRODUÇÃO & 3. DIAS PRODUTIVOS
  // Agrupa operações concluídas pela data real de conclusão
  const dailyMap = new Map<string, number>();
  const scopedOps = (period === 'all' || period === 'days' || period === 'weeks')
    ? allOperations.filter(op => op.status === 'completed' && isOpOnOrAfterMinDate(op, DECON_MIN_DATE_OBJ))
    : allOperations.filter(op => isOpFinalizedInDateRange(op, bounds.current.start, bounds.current.end));

  scopedOps.forEach(op => {
    const d = getOpCompletionDate(op);
    if (d) {
      const cleanDate = format(d, 'yyyy-MM-dd');
      dailyMap.set(cleanDate, (dailyMap.get(cleanDate) || 0) + 1);
    }
  });

  // Dias produtivos: contagem de datas com pelo menos 1 operação concluída
  const productiveDays = dailyMap.size;

  // Pico de produção: maior volume real de tanques concluídos em um único dia
  let peakDailyVolume = 0;
  let peakDailyDate: string | null = null;
  dailyMap.forEach((count, dateKey) => {
    if (count > peakDailyVolume) {
      peakDailyVolume = count;
      peakDailyDate = dateKey;
    }
  });

  // Identifica o bucket de maior volume no gráfico
  let highestBucketCount = 0;
  points.forEach(p => {
    if (p.finalizados > highestBucketCount) {
      highestBucketCount = p.finalizados;
    }
  });
  points.forEach(p => {
    p.isPeak = (highestBucketCount > 0 && p.finalizados === highestBucketCount);
  });

  return {
    chartData: points,
    avgProduction,
    avgProductionPerPeriod: avgProduction,
    periodUnitLabel,
    periodSubLabel,
    peakDailyVolume,
    peakDailyCount: peakDailyVolume,
    peakDailyDate,
    productiveDays,
    totalDescontaminado: totalVolume,
    currentPeriodLabel: bounds.current.label
  };
}

/**
 * UNIFIED PERFORMANCE DASHBOARD (DESEMPENHO DA DESCONTAMINAÇÃO)
 * 1. PRODUÇÃO MÉDIA: Média de tanques concluídos por período analisado
 * 2. RITMO MÉDIO: Quantidade média de tanques concluídos por dia útil (tanques / dia útil)
 * 3. PICO DE PRODUÇÃO: Maior quantidade de tanques concluídos em um único dia (com data do pico)
 * 
 * GRÁFICO ÚNICO COM DUAS LINHAS:
 * - LINHA 1 (Eixo Y Esquerdo): PRODUTIVIDADE (Tanques produzidos)
 * - LINHA 2 (Eixo Y Direito): RITMO (Tanques / dia útil)
 */
export interface PerformanceChartPoint {
  key: string;
  label: string;
  periodRange: string;
  fullPeriodLabel: string;
  start: Date;
  end: Date;
  businessDays: number;
  produtividade: number; // Volume real de tanques concluídos no período
  ritmo: number;         // Ritmo médio = velocidade média em tanques / dia útil
  rhythmNote?: string;   // Contexto explicativo do ritmo (ex: "Semana: 15 tanques ÷ 5 dias úteis")
  isCurrent: boolean;
  isPeak: boolean;
}

export interface PerformanceDashboardData {
  chartData: PerformanceChartPoint[];
  avgProduction: number;          // Mantido por compatibilidade técnica
  periodUnitLabel: string;        // Mantido por compatibilidade técnica
  periodSubLabel: string;         // Mantido por compatibilidade técnica
  granularityLabel: string;       // "Visualização diária", "Visualização semanal", "Visualização mensal"
  granularityType: 'daily' | 'weekly' | 'monthly';
  rhythmAverage: number;          // CARD 1: RITMO MÉDIO (total tanques ÷ total dias úteis)
  totalCompleted: number;
  totalBusinessDays: number;
  productiveDays: number;         // CARD 2: DIAS PRODUTIVOS (dias com ao menos 1 conclusão)
  peakDailyVolume: number;        // CARD 3: PICO DE PRODUÇÃO (tanques em 1 único dia)
  peakDailyDate: string | null;   // Data do pico
  currentPeriodLabel: string;
}

export function generatePerformanceDashboardData(
  allOperations: DecontaminationOperation[],
  period: DeconFilterPeriod,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): PerformanceDashboardData {
  const ref = startOfDay(referenceDate);
  const now = new Date();
  const bounds = getDeconPeriodBounds(period, customStart, customEnd, ref, allOperations);

  // Considerar somente operações concluídas a partir do marco zero operacional (03/08/2026)
  const completedOps = allOperations.filter(
    op => op.status === 'completed' && isOpOnOrAfterMinDate(op, DECON_MIN_DATE_OBJ)
  );

  // Determinar a granularidade e o escopo de operações conforme o filtro
  let scopedOps: DecontaminationOperation[] = [];
  let filterRangeStart: Date | null = null;
  let filterRangeEnd: Date | null = null;

  let granularityType: 'daily' | 'weekly' | 'monthly' = 'weekly';
  let granularityLabel = 'Visualização semanal';

  if (period === 'days') {
    granularityType = 'daily';
    granularityLabel = 'Visualização diária';
    scopedOps = completedOps;
  } else if (period === 'weeks') {
    granularityType = 'weekly';
    granularityLabel = 'Visualização semanal';
    scopedOps = completedOps;
  } else if (period === 'all') {
    granularityType = 'monthly';
    granularityLabel = 'Visualização mensal';
    scopedOps = completedOps;
  } else if (period === 'custom') {
    if (customStart && customEnd) {
      try {
        const parsedStart = startOfDay(parseISO(customStart));
        const parsedEnd = endOfDay(parseISO(customEnd));
        filterRangeStart = parsedStart < DECON_MIN_DATE_OBJ ? DECON_MIN_DATE_OBJ : parsedStart;
        filterRangeEnd = parsedEnd;
        scopedOps = completedOps.filter(op => isOpFinalizedInDateRange(op, filterRangeStart!, filterRangeEnd!));

        const diffDays = Math.max(1, differenceInCalendarDays(parsedEnd, parsedStart) + 1);
        if (diffDays <= 31) {
          granularityType = 'daily';
          granularityLabel = 'Visualização diária';
        } else if (diffDays <= 180) {
          granularityType = 'weekly';
          granularityLabel = 'Visualização semanal';
        } else {
          granularityType = 'monthly';
          granularityLabel = 'Visualização mensal';
        }
      } catch {
        granularityType = 'weekly';
        granularityLabel = 'Visualização semanal';
        scopedOps = completedOps;
      }
    } else {
      granularityType = 'weekly';
      granularityLabel = 'Visualização semanal';
      scopedOps = completedOps;
    }
  } else {
    granularityType = 'weekly';
    granularityLabel = 'Visualização semanal';
    scopedOps = completedOps;
  }

  let points: PerformanceChartPoint[] = [];

  // ====================================================
  // 1. GRANULARIDADE DIÁRIA (DIAS ou PERSONALIZADO <= 31 dias)
  // Cada ponto representa EXATAMENTE UM DIA
  // ====================================================
  if (granularityType === 'daily') {
    const dayMap = new Map<string, { date: Date; ops: DecontaminationOperation[] }>();

    scopedOps.forEach(op => {
      const d = getOpCompletionDate(op);
      if (!d) return;

      const dayKey = format(d, 'yyyy-MM-dd');
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, { date: startOfDay(d), ops: [] });
      }
      dayMap.get(dayKey)!.ops.push(op);
    });

    const sortedDays = Array.from(dayMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    const minHistoricalDate = DECON_MIN_DATE_OBJ;

    points = sortedDays.map((item, idx) => {
      const d = item.date;
      const dayKey = format(d, 'yyyy-MM-dd');
      const label = format(d, 'dd/MM');
      const isBusiness = isCalendarBusinessDay(d);
      const dayOfWeekName = format(d, 'EEEE', { locale: ptBR });
      const capitalizedDay = dayOfWeekName.charAt(0).toUpperCase() + dayOfWeekName.slice(1);
      const fullPeriodLabel = `${format(d, 'dd/MM/yyyy')} (${capitalizedDay})`;

      // 1. LINHA VERDE — PRODUÇÃO: Quantidade de tanques concluídos naquele dia
      const produtividade = item.ops.length;

      // 2. LINHA AZUL — RITMO: RITMO MÉDIO MÓVEL DOS ÚLTIMOS 5 DIAS ÚTEIS
      // Para cada dia, calcular: tanques concluídos nos últimos 5 dias úteis ÷ 5 dias úteis.
      // No início do histórico, quando ainda não existirem 5 dias úteis, utilizar os dias úteis disponíveis.
      const bDaysList: Date[] = [];
      let cursor = d;
      while (cursor.getTime() >= minHistoricalDate.getTime() && bDaysList.length < 5) {
        if (isCalendarBusinessDay(cursor)) {
          bDaysList.push(cursor);
        }
        cursor = subDays(cursor, 1);
      }

      const bDaysCount = Math.max(1, bDaysList.length);
      const windowStart = bDaysList.length > 0 ? startOfDay(bDaysList[bDaysList.length - 1]) : startOfDay(d);
      const windowEnd = endOfDay(d);

      // Quantidade de tanques concluídos nos últimos 5 dias úteis (janela operacional)
      const windowTanks = completedOps.filter(op => isOpFinalizedInDateRange(op, windowStart, windowEnd)).length;
      const ritmo = Number((windowTanks / bDaysCount).toFixed(1));

      const rhythmNote = bDaysCount >= 5
        ? `Média móvel (5 dias úteis): ${windowTanks} tanques ÷ 5 dias úteis = ${ritmo} tanques/dia útil`
        : `Início do histórico (${bDaysCount} ${bDaysCount === 1 ? 'dia útil' : 'dias úteis'}): ${windowTanks} tanques ÷ ${bDaysCount} = ${ritmo} tanques/dia útil`;

      const isCurrent = format(d, 'yyyy-MM-dd') === format(ref, 'yyyy-MM-dd') || idx === sortedDays.length - 1;

      return {
        key: dayKey,
        label,
        periodRange: format(d, 'dd/MM/yyyy'),
        fullPeriodLabel,
        start: d,
        end: endOfDay(d),
        businessDays: bDaysCount,
        produtividade,
        ritmo,
        rhythmNote,
        isCurrent,
        isPeak: false
      };
    });
  }

  // ====================================================
  // 2. GRANULARIDADE SEMANAL (SEMANAS ou PERSONALIZADO 32..180 dias)
  // Cada ponto representa EXATAMENTE UMA SEMANA
  // ====================================================
  else if (granularityType === 'weekly') {
    type WeekGroup = {
      naturalStart: Date;
      naturalEnd: Date;
      effectiveStart: Date;
      effectiveEnd: Date;
      isPartial: boolean;
      ops: DecontaminationOperation[];
    };

    const weekMap = new Map<string, WeekGroup>();

    scopedOps.forEach(op => {
      const d = getOpCompletionDate(op);
      if (!d) return;

      const naturalStart = startOfWeek(d, { weekStartsOn: 1 });
      const naturalEnd = endOfWeek(d, { weekStartsOn: 1 });
      const key = format(naturalStart, 'yyyy-MM-dd');

      if (!weekMap.has(key)) {
        let effectiveStart = naturalStart;
        let effectiveEnd = naturalEnd;
        let isPartial = false;

        if (filterRangeStart && filterRangeStart.getTime() > naturalStart.getTime()) {
          effectiveStart = filterRangeStart;
          isPartial = true;
        }
        if (filterRangeEnd && filterRangeEnd.getTime() < naturalEnd.getTime()) {
          effectiveEnd = filterRangeEnd;
          isPartial = true;
        }

        weekMap.set(key, {
          naturalStart,
          naturalEnd,
          effectiveStart,
          effectiveEnd,
          isPartial,
          ops: []
        });
      }

      const group = weekMap.get(key)!;
      if (isOpFinalizedInDateRange(op, group.effectiveStart, group.effectiveEnd)) {
        group.ops.push(op);
      }
    });

    const sortedWeekGroups = Array.from(weekMap.values()).sort(
      (a, b) => a.effectiveStart.getTime() - b.effectiveStart.getTime()
    );

    points = sortedWeekGroups.map((w, idx) => {
      const weekNumber = idx + 1;
      const weekLabel = w.isPartial ? `Semana ${weekNumber} (parcial)` : `Semana ${weekNumber}`;
      const rangeStr = `${format(w.effectiveStart, 'dd/MM')} a ${format(w.effectiveEnd, 'dd/MM')}`;
      const fullPeriodLabel = `${weekLabel} (${format(w.effectiveStart, 'dd/MM')} a ${format(w.effectiveEnd, 'dd/MM/yyyy')})${w.isPartial ? ' · Semana Parcial' : ''}`;

      // PRODUTIVIDADE: total de tanques concluídos naquela semana
      const produtividade = w.ops.length;

      // DIAS ÚTEIS DA SEMANA (Segunda a Sexta, limitados à data de hoje caso a semana esteja em curso)
      const cappedEnd = w.effectiveEnd.getTime() > now.getTime() ? now : w.effectiveEnd;
      const businessDays = Math.max(1, countCalendarBusinessDays(w.effectiveStart, cappedEnd));

      // RITMO: total de tanques concluídos naquela semana ÷ dias úteis da semana
      const ritmo = Number((produtividade / businessDays).toFixed(1));

      const isCurrent = (w.effectiveStart.getTime() <= ref.getTime() && w.effectiveEnd.getTime() >= ref.getTime()) || (idx === sortedWeekGroups.length - 1);
      const rhythmNote = w.isPartial
        ? `Semana parcial: ${produtividade} tanques ÷ ${businessDays} dias úteis = ${ritmo} tanques/dia útil`
        : `${produtividade} tanques ÷ ${businessDays} dias úteis = ${ritmo} tanques/dia útil`;

      return {
        key: format(w.effectiveStart, 'yyyy-MM-dd'),
        label: weekLabel,
        periodRange: `${weekLabel} (${rangeStr})`,
        fullPeriodLabel,
        start: w.effectiveStart,
        end: w.effectiveEnd,
        businessDays,
        produtividade,
        ritmo,
        rhythmNote,
        isCurrent,
        isPeak: false
      };
    });
  }

  // ====================================================
  // 3. GRANULARIDADE MENSAL (TODO O PERÍODO ou PERSONALIZADO > 180 dias)
  // Cada ponto representa EXATAMENTE UM MÊS
  // ====================================================
  else {
    type MonthGroup = {
      naturalStart: Date;
      naturalEnd: Date;
      effectiveStart: Date;
      effectiveEnd: Date;
      ops: DecontaminationOperation[];
    };

    const monthMap = new Map<string, MonthGroup>();

    scopedOps.forEach(op => {
      const d = getOpCompletionDate(op);
      if (!d) return;

      const naturalStart = startOfMonth(d);
      const naturalEnd = endOfMonth(d);
      const key = format(naturalStart, 'yyyy-MM');

      if (!monthMap.has(key)) {
        let effectiveStart = naturalStart < DECON_MIN_DATE_OBJ ? DECON_MIN_DATE_OBJ : naturalStart;
        let effectiveEnd = naturalEnd;

        if (filterRangeStart && filterRangeStart.getTime() > effectiveStart.getTime()) {
          effectiveStart = filterRangeStart;
        }
        if (filterRangeEnd && filterRangeEnd.getTime() < effectiveEnd.getTime()) {
          effectiveEnd = filterRangeEnd;
        }

        monthMap.set(key, {
          naturalStart,
          naturalEnd,
          effectiveStart,
          effectiveEnd,
          ops: []
        });
      }

      const group = monthMap.get(key)!;
      if (isOpFinalizedInDateRange(op, group.effectiveStart, group.effectiveEnd)) {
        group.ops.push(op);
      }
    });

    const sortedMonthGroups = Array.from(monthMap.values()).sort(
      (a, b) => a.effectiveStart.getTime() - b.effectiveStart.getTime()
    );

    points = sortedMonthGroups.map((m, idx) => {
      const monthRaw = format(m.effectiveStart, 'MMMM/yyyy', { locale: ptBR });
      const monthLabel = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);

      // PRODUTIVIDADE: total de tanques concluídos naquele mês
      const produtividade = m.ops.length;

      // DIAS ÚTEIS DO MÊS (Segunda a Sexta, limitados à data de hoje caso o mês esteja em curso)
      const cappedEnd = m.effectiveEnd.getTime() > now.getTime() ? now : m.effectiveEnd;
      const businessDays = Math.max(1, countCalendarBusinessDays(m.effectiveStart, cappedEnd));

      // RITMO: total de tanques concluídos naquele mês ÷ dias úteis do mês
      const ritmo = Number((produtividade / businessDays).toFixed(1));

      const isCurrent = (m.effectiveStart.getTime() <= ref.getTime() && m.effectiveEnd.getTime() >= ref.getTime()) || (idx === sortedMonthGroups.length - 1);
      const rhythmNote = `${produtividade} tanques ÷ ${businessDays} dias úteis = ${ritmo} tanques/dia útil`;

      return {
        key: format(m.effectiveStart, 'yyyy-MM'),
        label: monthLabel,
        periodRange: monthLabel,
        fullPeriodLabel: monthLabel,
        start: m.effectiveStart,
        end: m.effectiveEnd,
        businessDays,
        produtividade,
        ritmo,
        rhythmNote,
        isCurrent,
        isPeak: false
      };
    });
  }

  // Identifica o ponto de maior volume de produção do gráfico
  let highestProd = 0;
  points.forEach(p => {
    if (p.produtividade > highestProd) highestProd = p.produtividade;
  });
  points.forEach(p => {
    p.isPeak = highestProd > 0 && p.produtividade === highestProd;
  });

  // ==========================================
  // INDICADORES DE DESEMPENHO (CARDS)
  // ==========================================

  // 1. PRODUÇÃO MÉDIA: Média de tanques concluídos pelo período de agregação ativo
  const totalCompleted = points.reduce((acc, p) => acc + p.produtividade, 0);
  const avgProduction = points.length > 0 ? Number((totalCompleted / points.length).toFixed(1)) : 0;

  let periodUnitLabel = 'tanques / semana';
  let periodSubLabel = 'Média semanal de produção';

  if (granularityType === 'daily') {
    periodUnitLabel = 'tanques / dia';
    periodSubLabel = 'Média diária de produção';
  } else if (granularityType === 'monthly') {
    periodUnitLabel = 'tanques / mês';
    periodSubLabel = 'Média mensal de produção';
  }

  // 2. RITMO MÉDIO: Total de tanques concluídos ÷ total de dias úteis no período analisado
  let totalBusinessDays = 0;
  if (points.length > 0) {
    const minStart = points[0].start;
    const maxEnd = points[points.length - 1].end;
    const effectiveEnd = maxEnd.getTime() > now.getTime() ? now : maxEnd;
    totalBusinessDays = Math.max(1, countCalendarBusinessDays(minStart, effectiveEnd));
  }
  const rhythmAverage = totalBusinessDays > 0 ? Number((totalCompleted / totalBusinessDays).toFixed(1)) : 0;

  // 3. PICO DE PRODUÇÃO: Recorde real em um ÚNICO DIA (com data do pico)
  // Permanece diário em todos os filtros conforme regra absoluta
  const dailyMap = new Map<string, number>();
  scopedOps.forEach(op => {
    const d = getOpCompletionDate(op);
    if (d) {
      const k = format(d, 'yyyy-MM-dd');
      dailyMap.set(k, (dailyMap.get(k) || 0) + 1);
    }
  });

  let peakDailyVolume = 0;
  let peakDailyDate: string | null = null;
  dailyMap.forEach((count, dateStr) => {
    if (count > peakDailyVolume) {
      peakDailyVolume = count;
      peakDailyDate = dateStr;
    }
  });

  // DIAS PRODUTIVOS: Quantidade de dias em que houve pelo menos uma operação concluída
  const productiveDays = dailyMap.size;

  return {
    chartData: points,
    avgProduction,
    periodUnitLabel,
    periodSubLabel,
    granularityLabel,
    granularityType,
    rhythmAverage,
    totalCompleted,
    totalBusinessDays,
    productiveDays,
    peakDailyVolume,
    peakDailyDate,
    currentPeriodLabel: bounds.current.label
  };
}

/**
 * Indicators grouped by Client
 */
export function calculateClientIndicators(operations: DecontaminationOperation[]) {
  const clientMap = new Map<string, DecontaminationOperation[]>();

  operations.forEach(op => {
    const clientName = op.client?.trim() || 'Não Informado';
    if (!clientMap.has(clientName)) clientMap.set(clientName, []);
    clientMap.get(clientName)!.push(op);
  });

  const results = Array.from(clientMap.entries()).map(([client, ops]) => {
    const completedOps = ops.filter(o => o.status === 'completed');
    const waitTimes = ops.map(getWaitTimeHours);
    const deconTimes = completedOps.map(getDeconTimeHours);
    const leadTimes = completedOps.map(getLeadTimeHours);

    return {
      client,
      totalReceived: ops.length,
      completedCount: completedOps.length,
      avgWaitTime: computeAverage(waitTimes),
      avgDeconTime: computeAverage(deconTimes),
      avgLeadTime: computeAverage(leadTimes)
    };
  });

  return results.sort((a, b) => b.totalReceived - a.totalReceived);
}

/**
 * Indicators grouped by Tank Model
 */
export function calculateModelIndicators(operations: DecontaminationOperation[]) {
  const modelMap = new Map<string, DecontaminationOperation[]>();

  operations.forEach(op => {
    const modelName = op.model?.trim().toUpperCase() || 'OUTROS';
    if (!modelMap.has(modelName)) modelMap.set(modelName, []);
    modelMap.get(modelName)!.push(op);
  });

  const results = Array.from(modelMap.entries()).map(([model, ops]) => {
    const completedOps = ops.filter(o => o.status === 'completed');
    const waitTimes = ops.map(getWaitTimeHours);
    const deconTimes = completedOps.map(getDeconTimeHours);
    const leadTimes = completedOps.map(getLeadTimeHours);

    return {
      model,
      totalReceived: ops.length,
      completedCount: completedOps.length,
      avgWaitTime: computeAverage(waitTimes),
      avgDeconTime: computeAverage(deconTimes),
      avgLeadTime: computeAverage(leadTimes)
    };
  });

  return results.sort((a, b) => b.totalReceived - a.totalReceived);
}

/**
 * Contamination Indicators
 */
export function calculateContaminationIndicators(operations: DecontaminationOperation[]) {
  const contaminatedOps = operations.filter(o => o.hasContamination === true);
  const nonContaminatedOps = operations.filter(o => o.hasContamination !== true);

  const clientCounts = new Map<string, number>();
  contaminatedOps.forEach(op => {
    const c = op.client?.trim() || 'Não Informado';
    clientCounts.set(c, (clientCounts.get(c) || 0) + 1);
  });

  const topContaminatedClients = Array.from(clientCounts.entries())
    .map(([client, count]) => ({ client, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalContaminatedCount: contaminatedOps.length,
    nonContaminatedCount: nonContaminatedOps.length,
    topContaminatedClients
  };
}
