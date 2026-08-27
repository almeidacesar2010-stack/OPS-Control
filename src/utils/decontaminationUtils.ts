import { 
  parseISO, 
  format,
  differenceInMinutes, 
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
import { DecontaminationOperation, DecontaminationFilter, FilterPeriod } from '../types/decontamination';

/**
 * Calculates duration in days between two YYYY-MM-DD or ISO dates using Business Days (Dias Úteis)
 */
export function calculateDurationDays(startDateStr?: string, endDateStr?: string): number | null {
  if (!startDateStr || !endDateStr) return null;
  try {
    const start = startOfDay(parseISO(startDateStr));
    const end = startOfDay(parseISO(endDateStr));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    if (start.getTime() > end.getTime()) return 0;
    const bDays = countBusinessDays(start, end);
    return Math.max(0, bDays - 1);
  } catch {
    return null;
  }
}

/**
 * Legacy alias for calculateDurationDays
 */
export function calculateDurationHours(startDateStr?: string, endDateStr?: string): number | null {
  return calculateDurationDays(startDateStr, endDateStr);
}

/**
 * Tempo de Espera: Chegada -> Início (em dias)
 */
export function getWaitTimeHours(op: DecontaminationOperation): number | null {
  return calculateDurationDays(op.arrivalDate, op.startDate);
}

/**
 * Tempo de Descontaminação: Início -> Finalização (em dias)
 */
export function getDeconTimeHours(op: DecontaminationOperation): number | null {
  return calculateDurationDays(op.startDate, op.endDate);
}

/**
 * Lead Time: Chegada -> Finalização (em dias)
 */
export function getLeadTimeHours(op: DecontaminationOperation): number | null {
  return calculateDurationDays(op.arrivalDate, op.endDate);
}

/**
 * Formats numeric days into human readable text (e.g., "0 dias", "1 dia", "3 dias")
 */
export function formatDays(days: number | null): string {
  if (days === null || days === undefined || isNaN(days)) return '—';
  if (days === 1) return '1 dia';
  const val = Number.isInteger(days) ? days.toString() : days.toFixed(1);
  return `${val} dias`;
}

/**
 * Alias formatHours to formatDays for component compatibility
 */
export function formatHours(hoursOrDays: number | null): string {
  return formatDays(hoursOrDays);
}

/**
 * Formats date string into dd/mm/yyyy format
 */
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

/**
 * Checks if an operation date falls within the selected period filter
 */
export function isOperationInPeriod(op: DecontaminationOperation, period: FilterPeriod, customStart?: string, customEnd?: string): boolean {
  if (period === 'all') return true;
  if (!op.arrivalDate) return false;

  try {
    const opDate = parseISO(op.arrivalDate);
    if (isNaN(opDate.getTime())) return false;

    const now = new Date();

    if (period === 'today') {
      return isWithinInterval(opDate, { start: startOfDay(now), end: endOfDay(now) });
    }
    if (period === 'week') {
      return isWithinInterval(opDate, { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) });
    }
    if (period === 'month') {
      return isWithinInterval(opDate, { start: startOfMonth(now), end: endOfMonth(now) });
    }
    if (period === 'quarter') {
      return isWithinInterval(opDate, { start: startOfQuarter(now), end: endOfQuarter(now) });
    }
    if (period === 'semester') {
      const sixMonthsAgo = subMonths(now, 6);
      return isWithinInterval(opDate, { start: startOfDay(sixMonthsAgo), end: endOfDay(now) });
    }
    if (period === 'year') {
      return isWithinInterval(opDate, { start: startOfYear(now), end: endOfYear(now) });
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
 * Computes average of an array of numbers
 */
export function computeAverage(arr: (number | null)[]): number | null {
  const valid = arr.filter((val): val is number => val !== null && !isNaN(val));
  if (valid.length === 0) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return sum / valid.length;
}

/**
 * Gets the previous period date bounds given the current FilterPeriod and custom dates
 */
export function getPreviousPeriodBounds(period: FilterPeriod, customStart?: string, customEnd?: string): { start: Date; end: Date } | null {
  const now = new Date();
  
  if (period === 'today') {
    const startCurr = startOfDay(now);
    const prevDay = subDays(startCurr, 1);
    return { start: startOfDay(prevDay), end: endOfDay(prevDay) };
  }
  if (period === 'week') {
    const startCurr = startOfWeek(now, { weekStartsOn: 0 });
    const prevWeek = subDays(startCurr, 7);
    return { start: startOfWeek(prevWeek, { weekStartsOn: 0 }), end: endOfWeek(prevWeek, { weekStartsOn: 0 }) };
  }
  if (period === 'month') {
    const startCurr = startOfMonth(now);
    const prevMonth = subMonths(startCurr, 1);
    return { start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) };
  }
  if (period === 'quarter') {
    const startCurr = startOfQuarter(now);
    const prevQuarter = subMonths(startCurr, 3);
    return { start: startOfQuarter(prevQuarter), end: endOfQuarter(prevQuarter) };
  }
  if (period === 'semester') {
    const startCurr = startOfDay(subMonths(now, 6));
    const prevSemStart = subMonths(startCurr, 6);
    return { start: startOfDay(prevSemStart), end: endOfDay(startCurr) };
  }
  if (period === 'year') {
    const startCurr = startOfYear(now);
    const prevYear = subMonths(startCurr, 12);
    return { start: startOfYear(prevYear), end: endOfYear(prevYear) };
  }
  if (period === 'custom' && customStart && customEnd) {
    try {
      const startCurr = startOfDay(parseISO(customStart));
      const endCurr = endOfDay(parseISO(customEnd));
      const diffMs = endCurr.getTime() - startCurr.getTime();
      const prevEnd = new Date(startCurr.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - diffMs);
      return { start: prevStart, end: prevEnd };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Checks if an operation date falls within explicit Date bounds
 */
export function isOperationInDateBounds(op: DecontaminationOperation, bounds: { start: Date; end: Date } | null): boolean {
  if (!bounds || !op.arrivalDate) return false;
  try {
    const opDate = parseISO(op.arrivalDate);
    if (isNaN(opDate.getTime())) return false;
    return isWithinInterval(opDate, bounds);
  } catch {
    return false;
  }
}

export interface ComparisonResult {
  percent: number;
  isIncrease: boolean;
  isNeutral: boolean;
  hasSufficientData: boolean;
}

/**
 * Calculates percentage change between current value and previous value
 */
export function calculatePercentageChange(current: number, previous: number | null | undefined): ComparisonResult {
  if (previous === null || previous === undefined || previous === 0) {
    return { percent: 0, isIncrease: false, isNeutral: false, hasSufficientData: false };
  }
  const diff = current - previous;
  const percent = Math.round((diff / previous) * 100);
  return {
    percent: Math.abs(percent),
    isIncrease: diff > 0,
    isNeutral: diff === 0,
    hasSufficientData: true
  };
}

/**
 * Formats daily average with 1 decimal place (e.g. 1,9 or 0,0)
 */
export function formatDailyAverage(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0,0';
  return val.toFixed(1).replace('.', ',');
}

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
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
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
  addHoliday(11, 20); // Dia Nacional de Zumbi e da Consciência Negra
  addHoliday(12, 25); // Natal

  // Movable holidays based on Easter
  const easter = getEasterDate(year);

  // Carnaval (Tuesday, 47 days before Easter)
  const carnaval = new Date(easter.getTime() - 47 * 24 * 60 * 60 * 1000);
  holidays.add(`${carnaval.getFullYear()}-${pad(carnaval.getMonth() + 1)}-${pad(carnaval.getDate())}`);

  // Sexta-feira Santa / Paixão de Cristo (2 days before Easter)
  const sextaSanta = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
  holidays.add(`${sextaSanta.getFullYear()}-${pad(sextaSanta.getMonth() + 1)}-${pad(sextaSanta.getDate())}`);

  // Corpus Christi (60 days after Easter)
  const corpusChristi = new Date(easter.getTime() + 60 * 24 * 60 * 60 * 1000);
  holidays.add(`${corpusChristi.getFullYear()}-${pad(corpusChristi.getMonth() + 1)}-${pad(corpusChristi.getDate())}`);

  return holidays;
}

/**
 * Checks if a specific date is a business day (Monday-Friday, not a weekend, not a national holiday)
 */
export function isBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
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
 * Counts business days between start date and end date (inclusive)
 */
export function countBusinessDays(startDate: Date, endDate: Date): number {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  if (start.getTime() > end.getTime()) {
    return 0;
  }

  let count = 0;
  const current = new Date(start);
  while (current.getTime() <= end.getTime()) {
    if (isBusinessDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Calculates days elapsed in a given filter period
 */
export function calculatePeriodElapsedDays(
  period: FilterPeriod,
  customStart?: string,
  customEnd?: string,
  allOperations: DecontaminationOperation[] = []
): number {
  const now = startOfDay(new Date());

  if (period === 'today') {
    return 1;
  }

  let periodStart: Date;
  let periodEnd: Date;

  if (period === 'week') {
    periodStart = startOfWeek(now, { weekStartsOn: 0 });
    periodEnd = endOfWeek(now, { weekStartsOn: 0 });
  } else if (period === 'month') {
    periodStart = startOfMonth(now);
    periodEnd = endOfMonth(now);
  } else if (period === 'quarter') {
    periodStart = startOfQuarter(now);
    periodEnd = endOfQuarter(now);
  } else if (period === 'semester') {
    periodStart = startOfDay(subMonths(now, 6));
    periodEnd = endOfDay(now);
  } else if (period === 'year') {
    periodStart = startOfYear(now);
    periodEnd = endOfYear(now);
  } else if (period === 'custom' && customStart && customEnd) {
    try {
      periodStart = startOfDay(parseISO(customStart));
      periodEnd = endOfDay(parseISO(customEnd));
    } catch {
      return 1;
    }
  } else if (period === 'all') {
    if (!allOperations || allOperations.length === 0) return 1;
    let minTime = now.getTime();
    allOperations.forEach(op => {
      const dateStr = op.arrivalDate || op.startDate || op.endDate;
      if (dateStr) {
        try {
          const d = startOfDay(parseISO(dateStr));
          if (!isNaN(d.getTime()) && d.getTime() < minTime) {
            minTime = d.getTime();
          }
        } catch {}
      }
    });
    periodStart = new Date(minTime);
    periodEnd = now;
  } else {
    return 1;
  }

  // Determine if period is ongoing vs past
  if (now.getTime() < periodStart.getTime()) {
    return 1;
  }

  const targetEnd = now.getTime() <= periodEnd.getTime() ? now : periodEnd;
  const businessDays = countBusinessDays(periodStart, targetEnd);
  return Math.max(1, businessDays);
}

/**
 * Calculates duration in days for an explicit Date interval
 */
export function calculateElapsedDaysForBounds(start: Date, end: Date): number {
  const now = startOfDay(new Date());
  const startDay = startOfDay(start);
  const endDay = endOfDay(end);

  if (now.getTime() < startDay.getTime()) {
    return 1;
  }

  const targetEnd = now.getTime() <= endDay.getTime() ? now : endDay;
  const businessDays = countBusinessDays(startDay, targetEnd);
  return Math.max(1, businessDays);
}

/**
 * Calculates total business days in the full period range (or elapsed if ongoing)
 */
export function getTotalPeriodBusinessDays(
  period: FilterPeriod,
  customStart?: string,
  customEnd?: string,
  allOperations: DecontaminationOperation[] = []
): number {
  const now = startOfDay(new Date());

  if (period === 'today') return 1;
  if (period === 'week') {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return Math.max(1, countBusinessDays(start, end));
  }
  if (period === 'month') {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return Math.max(1, countBusinessDays(start, end));
  }
  if (period === 'quarter') {
    const start = startOfQuarter(now);
    const end = endOfQuarter(now);
    return Math.max(1, countBusinessDays(start, end));
  }
  if (period === 'semester') {
    const start = startOfDay(subMonths(now, 6));
    return Math.max(1, countBusinessDays(start, now));
  }
  if (period === 'year') {
    const start = startOfYear(now);
    const end = endOfYear(now);
    return Math.max(1, countBusinessDays(start, end));
  }
  if (period === 'custom' && customStart && customEnd) {
    try {
      const start = startOfDay(parseISO(customStart));
      const end = endOfDay(parseISO(customEnd));
      return Math.max(1, countBusinessDays(start, end));
    } catch {
      return 1;
    }
  }
  return calculatePeriodElapsedDays(period, customStart, customEnd, allOperations);
}

/**
 * Dashboard Overview KPIs with comparative percentage vs previous period,
 * Capacity estimation, and Demand vs Capacity metrics.
 */
export function calculateDecontaminationKPIs(
  operations: DecontaminationOperation[],
  period: FilterPeriod = 'all',
  customStart?: string,
  customEnd?: string,
  allOperations?: DecontaminationOperation[]
) {
  const totalReceived = operations.length;
  const waitingOps = operations.filter(o => o.status === 'waiting');
  const inProgressOps = operations.filter(o => o.status === 'in_progress');
  const completedOps = operations.filter(o => o.status === 'completed' && o.endDate && o.endDate.trim() !== '');

  const waitTimes = operations.map(getWaitTimeHours);
  const deconTimes = completedOps.map(getDeconTimeHours);
  const leadTimes = completedOps.map(getLeadTimeHours);

  const avgWaitTime = computeAverage(waitTimes);
  const avgDeconTime = computeAverage(deconTimes);
  const avgLeadTime = computeAverage(leadTimes);

  // Compute daily average of completed decontaminations (ritmo médio em todo o período)
  const sourceAllOps = allOperations && allOperations.length > 0 ? allOperations : operations;
  const elapsedDays = calculatePeriodElapsedDays(period, customStart, customEnd, sourceAllOps);
  const totalPeriodDays = getTotalPeriodBusinessDays(period, customStart, customEnd, sourceAllOps);
  
  // 1. RITMO MÉDIO: Tanques finalizados ÷ Dias úteis considerados no período
  const avgDailyDecon = elapsedDays > 0 ? completedOps.length / elapsedDays : 0;

  // 2. PICO DE PRODUÇÃO (Maior volume de tanques descontaminados em um único dia no período)
  const dailyCompletionCounts = new Map<string, number>();
  completedOps.forEach(op => {
    if (op.endDate && op.endDate.trim() !== '') {
      const cleanDate = op.endDate.trim().slice(0, 10);
      dailyCompletionCounts.set(cleanDate, (dailyCompletionCounts.get(cleanDate) || 0) + 1);
    }
  });

  let peakDailyCount = 0;
  let peakProductionDate: string | null = null;
  dailyCompletionCounts.forEach((count, date) => {
    if (count > peakDailyCount) {
      peakDailyCount = count;
      peakProductionDate = date;
    }
  });

  // Compute previous period comparative
  const prevBounds = getPreviousPeriodBounds(period, customStart, customEnd);
  let prevKPIs: {
    totalReceived: number;
    completedCount: number;
    waitingCount: number;
    inProgressCount: number;
    avgWaitTimeHours: number | null;
    avgDeconTimeHours: number | null;
    avgLeadTimeHours: number | null;
    avgDailyDecon: number | null;
    peakDailyCount: number | null;
  } | null = null;

  if (prevBounds) {
    const prevOps = sourceAllOps.filter(o => isOperationInDateBounds(o, prevBounds));
    const prevCompleted = prevOps.filter(o => o.status === 'completed' && o.endDate && o.endDate.trim() !== '');
    const prevElapsedDays = calculateElapsedDaysForBounds(prevBounds.start, prevBounds.end);
    const prevAvgDailyDecon = prevElapsedDays > 0 ? prevCompleted.length / prevElapsedDays : 0;

    const prevDailyMap = new Map<string, number>();
    prevCompleted.forEach(op => {
      if (op.endDate && op.endDate.trim() !== '') {
        const cleanDate = op.endDate.trim().slice(0, 10);
        prevDailyMap.set(cleanDate, (prevDailyMap.get(cleanDate) || 0) + 1);
      }
    });
    let prevPeak = 0;
    prevDailyMap.forEach((c) => {
      if (c > prevPeak) prevPeak = c;
    });

    prevKPIs = {
      totalReceived: prevOps.length,
      completedCount: prevCompleted.length,
      waitingCount: prevOps.filter(o => o.status === 'waiting').length,
      inProgressCount: prevOps.filter(o => o.status === 'in_progress').length,
      avgWaitTimeHours: computeAverage(prevOps.map(getWaitTimeHours)),
      avgDeconTimeHours: computeAverage(prevCompleted.map(getDeconTimeHours)),
      avgLeadTimeHours: computeAverage(prevCompleted.map(getLeadTimeHours)),
      avgDailyDecon: prevAvgDailyDecon,
      peakDailyCount: prevPeak
    };
  }

  return {
    totalReceived,
    waitingCount: waitingOps.length,
    inProgressCount: inProgressOps.length,
    completedCount: completedOps.length,
    avgWaitTimeHours: avgWaitTime,
    avgDeconTimeHours: avgDeconTime,
    avgLeadTimeHours: avgLeadTime,
    avgDailyDecon,
    peakDailyCount,
    peakProductionDate,
    elapsedBusinessDays: elapsedDays,
    totalPeriodBusinessDays: totalPeriodDays,
    comparisons: {
      received: prevKPIs ? calculatePercentageChange(totalReceived, prevKPIs.totalReceived) : null,
      completed: prevKPIs ? calculatePercentageChange(completedOps.length, prevKPIs.completedCount) : null,
      waiting: prevKPIs ? calculatePercentageChange(waitingOps.length, prevKPIs.waitingCount) : null,
      inProgress: prevKPIs ? calculatePercentageChange(inProgressOps.length, prevKPIs.inProgressCount) : null,
      avgDecon: prevKPIs && avgDeconTime !== null && prevKPIs.avgDeconTimeHours !== null ? calculatePercentageChange(avgDeconTime, prevKPIs.avgDeconTimeHours) : null,
      avgDailyDecon: prevKPIs && prevKPIs.avgDailyDecon !== null && prevKPIs.avgDailyDecon > 0 ? calculatePercentageChange(avgDailyDecon, prevKPIs.avgDailyDecon) : null
    }
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
 * Specific Contamination Indicators (Strictly counting ops where hasContamination === true)
 */
export function calculateContaminationIndicators(operations: DecontaminationOperation[]) {
  const contaminatedOps = operations.filter(o => o.hasContamination === true);
  const nonContaminatedOps = operations.filter(o => o.hasContamination !== true);

  // Group by Client
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

export type ProductivityHorizon = 'weekly' | 'monthly' | 'quarterly' | 'semestral' | 'all';

export interface DailyProductivityPoint {
  dateKey: string;      // '2026-08-01'
  label: string;        // '01/08'
  fullDate: string;     // '01/08/2026'
  dayOfWeek: string;    // 'Seg', 'Ter', etc.
  finalizados: number;  // Quantidade de tanques finalizados naquele dia
  isBusinessDay: boolean;
  isPeak: boolean;
}

/**
 * Generates Daily Productivity line chart data (Produtividade Diária da Descontaminação)
 * Each point represents the REAL count of tanks decontaminated on that specific day (or 0 if none).
 */
export function generateDailyProductivityChartData(
  operations: DecontaminationOperation[],
  period: FilterPeriod,
  customStart?: string,
  customEnd?: string,
  chartHorizon: ProductivityHorizon = 'monthly'
): { data: DailyProductivityPoint[]; peakCount: number; peakDate: string | null } {
  const now = startOfDay(new Date());

  let startDate: Date;
  let endDate: Date;

  if (period === 'custom' && customStart && customEnd) {
    try {
      startDate = startOfDay(parseISO(customStart));
      endDate = startOfDay(parseISO(customEnd));
    } catch {
      startDate = startOfMonth(now);
      endDate = now;
    }
  } else if (period === 'today') {
    startDate = startOfWeek(now, { weekStartsOn: 1 });
    endDate = endOfWeek(now, { weekStartsOn: 1 });
  } else if (chartHorizon === 'weekly' || period === 'week') {
    startDate = startOfWeek(now, { weekStartsOn: 1 });
    endDate = endOfWeek(now, { weekStartsOn: 1 });
  } else if (chartHorizon === 'monthly' || period === 'month') {
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
  } else if (chartHorizon === 'quarterly' || period === 'quarter') {
    startDate = startOfQuarter(now);
    endDate = endOfQuarter(now);
  } else if (chartHorizon === 'semestral' || period === 'semester') {
    startDate = startOfDay(subMonths(now, 6));
    endDate = now;
  } else {
    // 'all' / 'geral' or 'year'
    let earliest = startOfMonth(subMonths(now, 2));
    operations.forEach(op => {
      const dStr = op.arrivalDate || op.startDate || op.endDate;
      if (dStr) {
        try {
          const d = startOfDay(parseISO(dStr));
          if (!isNaN(d.getTime()) && d.getTime() < earliest.getTime()) {
            earliest = d;
          }
        } catch {}
      }
    });
    startDate = earliest;
    endDate = now;
  }

  // Count completions on each exact day (using endDate of completed ops)
  const completedMap = new Map<string, number>();
  operations.forEach(op => {
    if (op.status === 'completed' && op.endDate && op.endDate.trim() !== '') {
      const cleanDate = op.endDate.trim().slice(0, 10);
      completedMap.set(cleanDate, (completedMap.get(cleanDate) || 0) + 1);
    }
  });

  // Calculate peak in the active filtered operations
  let peakCount = 0;
  let peakDate: string | null = null;
  completedMap.forEach((count, date) => {
    if (count > peakCount) {
      peakCount = count;
      peakDate = date;
    }
  });

  const points: DailyProductivityPoint[] = [];
  const current = new Date(startDate);
  const endLimit = endDate.getTime() < startDate.getTime() ? startDate : endDate;

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  let guard = 0;
  while (current.getTime() <= endLimit.getTime() && guard < 400) {
    guard++;
    const dateKey = format(current, 'yyyy-MM-dd');
    const label = format(current, 'dd/MM');
    const fullDate = format(current, 'dd/MM/yyyy');
    const dayOfWeek = dayNames[current.getDay()];
    const isBusDay = isBusinessDay(current);
    const finalizados = completedMap.get(dateKey) || 0;

    points.push({
      dateKey,
      label,
      fullDate,
      dayOfWeek,
      finalizados,
      isBusinessDay: isBusDay,
      isPeak: finalizados > 0 && finalizados === peakCount
    });

    current.setDate(current.getDate() + 1);
  }

  return { data: points, peakCount, peakDate };
}

