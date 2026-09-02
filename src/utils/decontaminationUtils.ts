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
  endOfYear 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DecontaminationOperation, DecontaminationStatus, FilterPeriod } from '../types/decontamination';

export type DeconFilterPeriod = 'all' | 'week' | 'month' | 'quarter' | 'semester' | 'custom';

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
 * Calculates duration in business days between two YYYY-MM-DD or ISO dates
 */
export function calculateDurationDays(startDateStr?: string, endDateStr?: string): number | null {
  if (!startDateStr || !endDateStr) return null;
  try {
    const start = startOfDay(parseISO(startDateStr.slice(0, 10)));
    const end = startOfDay(parseISO(endDateStr.slice(0, 10)));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    if (start.getTime() > end.getTime()) return 0;
    
    // Início e Fim no mesmo dia contam como 0 dias de duração (ou 0 dias úteis decorridos)
    const bDays = countCalendarBusinessDays(start, end);
    return Math.max(0, bDays - 1);
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
 * Verifies if an operation's date falls within a period filter
 */
export function isOperationInPeriod(
  op: DecontaminationOperation, 
  period: FilterPeriod | DeconFilterPeriod, 
  customStart?: string, 
  customEnd?: string,
  referenceDate: Date = new Date()
): boolean {
  if (period === 'all') return true;
  const opDateStr = op.arrivalDate || op.startDate || op.endDate;
  if (!opDateStr) return false;

  try {
    const opDate = startOfDay(parseISO(opDateStr.slice(0, 10)));
    if (isNaN(opDate.getTime())) return false;

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
      const start = startOfDay(parseISO(customStart));
      const end = endOfDay(parseISO(customEnd));
      return isWithinInterval(opDate, { start, end });
    }
  } catch {
    return false;
  }
  return true;
}

/**
 * Checks if an operation has been FINALIZED within a specific Date interval [start, end]
 */
export function isOpFinalizedInDateRange(op: DecontaminationOperation, start: Date, end: Date): boolean {
  if (op.status !== 'completed') return false;
  const dateStr = op.endDate || op.startDate || op.arrivalDate;
  if (!dateStr) return false;
  try {
    const d = startOfDay(parseISO(dateStr.slice(0, 10)));
    if (isNaN(d.getTime())) return false;
    return d.getTime() >= startOfDay(start).getTime() && d.getTime() <= endOfDay(end).getTime();
  } catch {
    return false;
  }
}

export interface PeriodInterval {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Gets exact current and immediately previous equivalent period bounds
 */
export function getDeconPeriodBounds(
  period: DeconFilterPeriod,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): { current: PeriodInterval; previous: PeriodInterval | null } {
  const ref = startOfDay(referenceDate);

  if (period === 'all') {
    return {
      current: {
        start: new Date(2020, 0, 1),
        end: new Date(2099, 11, 31),
        label: 'Todo o Histórico'
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
  const bounds = getDeconPeriodBounds(period, customStart, customEnd, referenceDate);
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
      label: 'Sem histórico suficiente',
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
      label: metricType === 'RITMO' ? 'AUMENTO DO RITMO' : 'AUMENTO DA PRODUTIVIDADE',
      formattedDiff: `+${percent.toFixed(1).replace('.', ',')}%`,
      hasSufficientData: true
    };
  } else if (rawPercent < -0.05) {
    return {
      percent,
      direction: 'down',
      label: metricType === 'RITMO' ? 'QUEDA DO RITMO' : 'QUEDA DA PRODUTIVIDADE',
      formattedDiff: `-${percent.toFixed(1).replace('.', ',')}%`,
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
  currentPace: number;          // RITMO ATUAL
  maxPace: number;              // MAIOR RITMO
  maxPacePeriod: string | null;
  minPace: number;              // MENOR RITMO
  minPacePeriod: string | null;
  variation: VariationResult;   // VARIAÇÃO DO RITMO
  currentPeriodLabel: string;
}

export function generateRhythmDashboardData(
  allOperations: DecontaminationOperation[],
  period: DeconFilterPeriod,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): RhythmDashboardData {
  const ref = startOfDay(referenceDate);
  const bounds = getDeconPeriodBounds(period, customStart, customEnd, ref);

  interface BucketDef {
    key: string;
    label: string;
    fullPeriodLabel: string;
    start: Date;
    end: Date;
  }

  const buckets: BucketDef[] = [];

  // Find earliest completed operation date registered in the system
  let earliestCompletedDate: Date | null = null;
  allOperations.filter(op => op.status === 'completed').forEach(op => {
    const dStr = op.endDate || op.startDate || op.arrivalDate;
    if (dStr) {
      try {
        const d = startOfDay(parseISO(dStr.slice(0, 10)));
        if (!isNaN(d.getTime())) {
          if (!earliestCompletedDate || d.getTime() < earliestCompletedDate.getTime()) {
            earliestCompletedDate = d;
          }
        }
      } catch {}
    }
  });

  if (period === 'week') {
    // Generate chronological weeks up to current week, starting strictly from the first registered completed operation
    const minWeekStart = earliestCompletedDate 
      ? startOfWeek(earliestCompletedDate, { weekStartsOn: 1 }) 
      : startOfWeek(ref, { weekStartsOn: 1 });
    let cur = minWeekStart;
    const endTarget = endOfWeek(ref, { weekStartsOn: 1 });
    let guard = 0;
    while (cur.getTime() <= endTarget.getTime() && guard < 52) {
      guard++;
      const bStart = startOfWeek(cur, { weekStartsOn: 1 });
      const bEnd = endOfWeek(cur, { weekStartsOn: 1 });
      buckets.push({
        key: format(bStart, 'yyyy-MM-dd'),
        label: `Sem ${format(bStart, 'dd/MM')}`,
        fullPeriodLabel: `Semana de ${format(bStart, 'dd/MM/yyyy')} a ${format(bEnd, 'dd/MM/yyyy')}`,
        start: bStart,
        end: bEnd
      });
      cur = new Date(cur.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  } else if (period === 'month' || period === 'all') {
    // Generate chronological months starting strictly from first completed operation
    const minMonthStart = earliestCompletedDate
      ? startOfMonth(earliestCompletedDate)
      : startOfMonth(ref);
    let cur = minMonthStart;
    const endTarget = endOfMonth(ref);
    let guard = 0;
    while (cur.getTime() <= endTarget.getTime() && guard < 24) {
      guard++;
      const bStart = startOfMonth(cur);
      const bEnd = endOfMonth(cur);
      buckets.push({
        key: format(bStart, 'yyyy-MM'),
        label: format(bStart, 'MMM/yy', { locale: ptBR }).toUpperCase(),
        fullPeriodLabel: format(bStart, 'MMMM yyyy', { locale: ptBR }),
        start: bStart,
        end: bEnd
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  } else if (period === 'quarter') {
    // Generate chronological quarters starting strictly from first completed operation
    const minQuarterStart = earliestCompletedDate
      ? startOfQuarter(earliestCompletedDate)
      : startOfQuarter(ref);
    let cur = minQuarterStart;
    const endTarget = endOfQuarter(ref);
    let guard = 0;
    while (cur.getTime() <= endTarget.getTime() && guard < 12) {
      guard++;
      const bStart = startOfQuarter(cur);
      const bEnd = endOfQuarter(cur);
      const q = Math.floor(cur.getMonth() / 3) + 1;
      buckets.push({
        key: `${cur.getFullYear()}-Q${q}`,
        label: `T${q}/${format(cur, 'yy')}`,
        fullPeriodLabel: `${q}º Trimestre de ${cur.getFullYear()}`,
        start: bStart,
        end: bEnd
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 3, 1);
    }
  } else if (period === 'semester') {
    // Generate chronological semesters
    let curYear = earliestCompletedDate ? earliestCompletedDate.getFullYear() : ref.getFullYear();
    const endYear = ref.getFullYear();
    for (let y = curYear; y <= endYear; y++) {
      for (let s = 1; s <= 2; s++) {
        const bStart = new Date(y, s === 1 ? 0 : 6, 1);
        const bEnd = endOfMonth(new Date(y, s === 1 ? 5 : 11, 1));
        if (bStart.getTime() <= ref.getTime() && (!earliestCompletedDate || bEnd.getTime() >= earliestCompletedDate.getTime())) {
          buckets.push({
            key: `${y}-S${s}`,
            label: `S${s}/${String(y).slice(-2)}`,
            fullPeriodLabel: `${s}º Semestre de ${y}`,
            start: bStart,
            end: bEnd
          });
        }
      }
    }
  } else if (period === 'custom' && customStart && customEnd) {
    try {
      const cStart = startOfDay(parseISO(customStart));
      const cEnd = endOfDay(parseISO(customEnd));
      const daysDiff = Math.ceil((cEnd.getTime() - cStart.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 14) {
        // Daily breakdown
        let cur = new Date(cStart);
        while (cur.getTime() <= cEnd.getTime()) {
          const dStart = startOfDay(cur);
          const dEnd = endOfDay(cur);
          buckets.push({
            key: format(dStart, 'yyyy-MM-dd'),
            label: format(dStart, 'dd/MM'),
            fullPeriodLabel: format(dStart, 'dd/MM/yyyy'),
            start: dStart,
            end: dEnd
          });
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        // Weekly breakdown inside custom range
        let cur = startOfWeek(cStart, { weekStartsOn: 1 });
        let guard = 0;
        while (cur.getTime() <= cEnd.getTime() && guard < 52) {
          guard++;
          const bStart = cur.getTime() < cStart.getTime() ? cStart : cur;
          const wEnd = endOfWeek(cur, { weekStartsOn: 1 });
          const bEnd = wEnd.getTime() > cEnd.getTime() ? cEnd : wEnd;
          buckets.push({
            key: format(bStart, 'yyyy-MM-dd'),
            label: `Sem ${format(bStart, 'dd/MM')}`,
            fullPeriodLabel: `${format(bStart, 'dd/MM/yyyy')} a ${format(bEnd, 'dd/MM/yyyy')}`,
            start: bStart,
            end: bEnd
          });
          cur = new Date(cur.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
      }
    } catch {
      // Fallback to single bucket
      buckets.push({
        key: 'custom-period',
        label: 'Período',
        fullPeriodLabel: bounds.current.label,
        start: bounds.current.start,
        end: bounds.current.end
      });
    }
  }

  // Calculate Rhythm for each bucket: Tanques Descontaminados ÷ Dias Úteis de Calendário do Período
  const initialPoints: RhythmChartPoint[] = buckets.map((b) => {
    const completedOps = allOperations.filter(op => isOpFinalizedInDateRange(op, b.start, b.end));
    const completedCount = completedOps.length;
    const businessDays = Math.max(1, countCalendarBusinessDays(b.start, b.end));
    const ritmo = Number((completedCount / businessDays).toFixed(1));

    return {
      key: b.key,
      label: b.label,
      fullPeriodLabel: b.fullPeriodLabel,
      completedCount,
      businessDays,
      ritmo,
      isCurrent: false,
      isMax: false,
      isMin: false
    };
  });

  // ONLY periods with at least 1 completed operation can appear in the chart and metrics
  let points: RhythmChartPoint[] = initialPoints.filter(p => p.completedCount > 0);

  if (points.length === 0) {
    points = [{
      key: 'current',
      label: 'Atual',
      fullPeriodLabel: bounds.current.label,
      completedCount: 0,
      businessDays: Math.max(1, countCalendarBusinessDays(bounds.current.start, bounds.current.end)),
      ritmo: 0,
      isCurrent: true,
      isMax: false,
      isMin: false
    }];
  }

  let maxPace = 0;
  let maxPacePeriod: string | null = null;
  let minPace = Infinity;
  let minPacePeriod: string | null = null;

  points.forEach((p, idx) => {
    p.isCurrent = idx === points.length - 1;
    if (p.completedCount > 0 && p.ritmo > maxPace) {
      maxPace = p.ritmo;
      maxPacePeriod = p.label;
    }
    if (p.completedCount > 0 && p.ritmo < minPace) {
      minPace = p.ritmo;
      minPacePeriod = p.label;
    }
  });

  if (minPace === Infinity) {
    minPace = 0;
  }

  points.forEach(p => {
    if (maxPace > 0 && p.ritmo === maxPace) p.isMax = true;
    if (minPace > 0 && p.ritmo === minPace) p.isMin = true;
  });

  // Calculate current period pace and previous period pace for variation
  const currentCompleted = allOperations.filter(op => isOpFinalizedInDateRange(op, bounds.current.start, bounds.current.end)).length;
  const currentBusinessDays = Math.max(1, countCalendarBusinessDays(bounds.current.start, bounds.current.end));
  const currentPace = Number((currentCompleted / currentBusinessDays).toFixed(1));

  let prevPace: number | null = null;
  if (bounds.previous) {
    const prevCompleted = allOperations.filter(op => isOpFinalizedInDateRange(op, bounds.previous!.start, bounds.previous!.end)).length;
    const prevBusinessDays = Math.max(1, countCalendarBusinessDays(bounds.previous.start, bounds.previous.end));
    if (prevCompleted > 0 && prevBusinessDays > 0) {
      prevPace = prevCompleted / prevBusinessDays;
    }
  }

  const variation = computePercentageVariation(currentPace, prevPace, 'RITMO');

  return {
    chartData: points,
    currentPace,
    maxPace,
    maxPacePeriod,
    minPace,
    minPacePeriod,
    variation,
    currentPeriodLabel: bounds.current.label
  };
}

/**
 * PRODUCTIVITY DASHBOARD DATA (Parte 5)
 * Mostra a capacidade produtiva real observada:
 * - Pico de Produção Diária (Maior quantidade finalizada em um único dia)
 * - Total Descontaminado no período
 * - Média de Produção por Período
 * - Variação da Produtividade
 * - Gráfico de Linha com quantidade finalizada por período
 */
export interface ProductivityChartPoint {
  key: string;
  label: string;
  fullPeriodLabel: string;
  finalizados: number; // Volume real de tanques finalizados
  isCurrent: boolean;
  isPeak: boolean;
}

export interface ProductivityDashboardData {
  chartData: ProductivityChartPoint[];
  totalDescontaminado: number;          // TOTAL DESCONTAMINADO
  peakDailyCount: number;               // PICO DE PRODUÇÃO DIÁRIA
  peakDailyDate: string | null;         // Data do pico
  avgProductionPerPeriod: number;       // MÉDIA DE PRODUÇÃO POR PERÍODO
  periodUnitLabel: string;              // "por semana", "por mês", "por trimestre", "por semestre"
  variation: VariationResult;          // VARIAÇÃO DA PRODUTIVIDADE
  currentPeriodLabel: string;
}

export function generateProductivityDashboardData(
  allOperations: DecontaminationOperation[],
  period: DeconFilterPeriod,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): ProductivityDashboardData {
  const ref = startOfDay(referenceDate);
  const bounds = getDeconPeriodBounds(period, customStart, customEnd, ref);

  // 1. Operations finalized in current selected period
  const completedInCurrentPeriod = allOperations.filter(op => 
    isOpFinalizedInDateRange(op, bounds.current.start, bounds.current.end)
  );
  const totalDescontaminado = completedInCurrentPeriod.length;

  // 2. Daily completion map to find REAL PEAK in a single calendar day
  const dailyMap = new Map<string, number>();
  completedInCurrentPeriod.forEach(op => {
    const dStr = op.endDate || op.startDate || op.arrivalDate;
    if (dStr) {
      const cleanDate = dStr.slice(0, 10);
      dailyMap.set(cleanDate, (dailyMap.get(cleanDate) || 0) + 1);
    }
  });

  let peakDailyCount = 0;
  let peakDailyDate: string | null = null;
  dailyMap.forEach((count, dateKey) => {
    if (count > peakDailyCount) {
      peakDailyCount = count;
      peakDailyDate = dateKey;
    }
  });

  // 3. Build chronological buckets for the Line Chart (same granularity)
  // Find earliest completed operation date registered in the system
  let earliestCompletedDate: Date | null = null;
  allOperations.filter(op => op.status === 'completed').forEach(op => {
    const dStr = op.endDate || op.startDate || op.arrivalDate;
    if (dStr) {
      try {
        const d = startOfDay(parseISO(dStr.slice(0, 10)));
        if (!isNaN(d.getTime())) {
          if (!earliestCompletedDate || d.getTime() < earliestCompletedDate.getTime()) {
            earliestCompletedDate = d;
          }
        }
      } catch {}
    }
  });

  interface BucketDef {
    key: string;
    label: string;
    fullPeriodLabel: string;
    start: Date;
    end: Date;
  }
  const buckets: BucketDef[] = [];

  let periodUnitLabel = 'por período';

  if (period === 'week') {
    periodUnitLabel = 'por semana';
    const minWeekStart = earliestCompletedDate 
      ? startOfWeek(earliestCompletedDate, { weekStartsOn: 1 }) 
      : startOfWeek(ref, { weekStartsOn: 1 });
    let cur = minWeekStart;
    const endTarget = endOfWeek(ref, { weekStartsOn: 1 });
    let guard = 0;
    while (cur.getTime() <= endTarget.getTime() && guard < 52) {
      guard++;
      const bStart = startOfWeek(cur, { weekStartsOn: 1 });
      const bEnd = endOfWeek(cur, { weekStartsOn: 1 });
      buckets.push({
        key: format(bStart, 'yyyy-MM-dd'),
        label: `Sem ${format(bStart, 'dd/MM')}`,
        fullPeriodLabel: `Semana de ${format(bStart, 'dd/MM/yyyy')} a ${format(bEnd, 'dd/MM/yyyy')}`,
        start: bStart,
        end: bEnd
      });
      cur = new Date(cur.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  } else if (period === 'month' || period === 'all') {
    periodUnitLabel = 'por mês';
    const minMonthStart = earliestCompletedDate
      ? startOfMonth(earliestCompletedDate)
      : startOfMonth(ref);
    let cur = minMonthStart;
    const endTarget = endOfMonth(ref);
    let guard = 0;
    while (cur.getTime() <= endTarget.getTime() && guard < 24) {
      guard++;
      const bStart = startOfMonth(cur);
      const bEnd = endOfMonth(cur);
      buckets.push({
        key: format(bStart, 'yyyy-MM'),
        label: format(bStart, 'MMM/yy', { locale: ptBR }).toUpperCase(),
        fullPeriodLabel: format(bStart, 'MMMM yyyy', { locale: ptBR }),
        start: bStart,
        end: bEnd
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  } else if (period === 'quarter') {
    periodUnitLabel = 'por trimestre';
    const minQuarterStart = earliestCompletedDate
      ? startOfQuarter(earliestCompletedDate)
      : startOfQuarter(ref);
    let cur = minQuarterStart;
    const endTarget = endOfQuarter(ref);
    let guard = 0;
    while (cur.getTime() <= endTarget.getTime() && guard < 12) {
      guard++;
      const bStart = startOfQuarter(cur);
      const bEnd = endOfQuarter(cur);
      const q = Math.floor(cur.getMonth() / 3) + 1;
      buckets.push({
        key: `${cur.getFullYear()}-Q${q}`,
        label: `T${q}/${format(cur, 'yy')}`,
        fullPeriodLabel: `${q}º Trimestre de ${cur.getFullYear()}`,
        start: bStart,
        end: bEnd
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 3, 1);
    }
  } else if (period === 'semester') {
    periodUnitLabel = 'por semestre';
    let curYear = earliestCompletedDate ? earliestCompletedDate.getFullYear() : ref.getFullYear();
    const endYear = ref.getFullYear();
    for (let y = curYear; y <= endYear; y++) {
      for (let s = 1; s <= 2; s++) {
        const bStart = new Date(y, s === 1 ? 0 : 6, 1);
        const bEnd = endOfMonth(new Date(y, s === 1 ? 5 : 11, 1));
        if (bStart.getTime() <= ref.getTime() && (!earliestCompletedDate || bEnd.getTime() >= earliestCompletedDate.getTime())) {
          buckets.push({
            key: `${y}-S${s}`,
            label: `S${s}/${String(y).slice(-2)}`,
            fullPeriodLabel: `${s}º Semestre de ${y}`,
            start: bStart,
            end: bEnd
          });
        }
      }
    }
  } else if (period === 'custom' && customStart && customEnd) {
    periodUnitLabel = 'no intervalo';
    try {
      const cStart = startOfDay(parseISO(customStart));
      const cEnd = endOfDay(parseISO(customEnd));
      const daysDiff = Math.ceil((cEnd.getTime() - cStart.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 14) {
        periodUnitLabel = 'por dia';
        let cur = new Date(cStart);
        while (cur.getTime() <= cEnd.getTime()) {
          const dStart = startOfDay(cur);
          const dEnd = endOfDay(cur);
          buckets.push({
            key: format(dStart, 'yyyy-MM-dd'),
            label: format(dStart, 'dd/MM'),
            fullPeriodLabel: format(dStart, 'dd/MM/yyyy'),
            start: dStart,
            end: dEnd
          });
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        periodUnitLabel = 'por semana';
        let cur = startOfWeek(cStart, { weekStartsOn: 1 });
        let guard = 0;
        while (cur.getTime() <= cEnd.getTime() && guard < 52) {
          guard++;
          const bStart = cur.getTime() < cStart.getTime() ? cStart : cur;
          const wEnd = endOfWeek(cur, { weekStartsOn: 1 });
          const bEnd = wEnd.getTime() > cEnd.getTime() ? cEnd : wEnd;
          buckets.push({
            key: format(bStart, 'yyyy-MM-dd'),
            label: `Sem ${format(bStart, 'dd/MM')}`,
            fullPeriodLabel: `${format(bStart, 'dd/MM/yyyy')} a ${format(bEnd, 'dd/MM/yyyy')}`,
            start: bStart,
            end: bEnd
          });
          cur = new Date(cur.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
      }
    } catch {
      buckets.push({
        key: 'custom-period',
        label: 'Período',
        fullPeriodLabel: bounds.current.label,
        start: bounds.current.start,
        end: bounds.current.end
      });
    }
  }

  const initialPoints: ProductivityChartPoint[] = buckets.map((b) => {
    const finalized = allOperations.filter(op => isOpFinalizedInDateRange(op, b.start, b.end)).length;
    return {
      key: b.key,
      label: b.label,
      fullPeriodLabel: b.fullPeriodLabel,
      finalizados: finalized,
      isCurrent: false,
      isPeak: false
    };
  });

  // ONLY periods with at least 1 finalized operation can appear in the chart and metrics
  let points: ProductivityChartPoint[] = initialPoints.filter(p => p.finalizados > 0);

  if (points.length === 0) {
    points = [{
      key: 'current',
      label: 'Atual',
      fullPeriodLabel: bounds.current.label,
      finalizados: totalDescontaminado,
      isCurrent: true,
      isPeak: false
    }];
  }

  let highestBucketCount = 0;
  points.forEach((p, idx) => {
    p.isCurrent = idx === points.length - 1;
    if (p.finalizados > highestBucketCount) {
      highestBucketCount = p.finalizados;
    }
  });

  points.forEach(p => {
    p.isPeak = (highestBucketCount > 0 && p.finalizados === highestBucketCount);
  });

  // 4. Média de produção por unidade da granularidade selecionada (apenas períodos válidos)
  const sumCompletedInBuckets = points.reduce((acc, p) => acc + p.finalizados, 0);
  const avgProductionPerPeriod = points.length > 0
    ? Number((sumCompletedInBuckets / points.length).toFixed(1))
    : totalDescontaminado;

  // 5. Variação da Produtividade comparando período atual com período anterior equivalente
  let prevCompletedCount: number | null = null;
  if (bounds.previous) {
    const prevOps = allOperations.filter(op => isOpFinalizedInDateRange(op, bounds.previous!.start, bounds.previous!.end));
    if (prevOps.length > 0) {
      prevCompletedCount = prevOps.length;
    }
  }

  const variation = computePercentageVariation(totalDescontaminado, prevCompletedCount, 'PRODUTIVIDADE');

  return {
    chartData: points,
    totalDescontaminado,
    peakDailyCount,
    peakDailyDate,
    avgProductionPerPeriod,
    periodUnitLabel,
    variation,
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
