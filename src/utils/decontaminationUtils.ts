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
 * Calculates duration in days between two YYYY-MM-DD or ISO dates
 */
export function calculateDurationDays(startDateStr?: string, endDateStr?: string): number | null {
  if (!startDateStr || !endDateStr) return null;
  try {
    const start = startOfDay(parseISO(startDateStr));
    const end = startOfDay(parseISO(endDateStr));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return 0;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
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

  if (now.getTime() <= periodEnd.getTime()) {
    // Ongoing period: count days from periodStart up to today inclusive
    const diffMs = now.getTime() - periodStart.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
  } else {
    // Past/Completed period: total duration of period in days
    const diffMs = periodEnd.getTime() - periodStart.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
  }
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

  if (now.getTime() <= endDay.getTime()) {
    // Ongoing interval
    const diffMs = now.getTime() - startDay.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
  } else {
    // Past interval
    const diffMs = endDay.getTime() - startDay.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
  }
}

/**
 * Dashboard Overview KPIs with comparative percentage vs previous period
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

  // Compute daily average of completed decontaminations
  const sourceAllOps = allOperations && allOperations.length > 0 ? allOperations : operations;
  const elapsedDays = calculatePeriodElapsedDays(period, customStart, customEnd, sourceAllOps);
  const avgDailyDecon = completedOps.length / elapsedDays;

  const completionRate = totalReceived > 0 ? (completedOps.length / totalReceived) * 100 : 0;

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
  } | null = null;

  if (prevBounds) {
    const prevOps = sourceAllOps.filter(o => isOperationInDateBounds(o, prevBounds));
    const prevCompleted = prevOps.filter(o => o.status === 'completed' && o.endDate && o.endDate.trim() !== '');
    const prevElapsedDays = calculateElapsedDaysForBounds(prevBounds.start, prevBounds.end);
    const prevAvgDailyDecon = prevCompleted.length / prevElapsedDays;

    prevKPIs = {
      totalReceived: prevOps.length,
      completedCount: prevCompleted.length,
      waitingCount: prevOps.filter(o => o.status === 'waiting').length,
      inProgressCount: prevOps.filter(o => o.status === 'in_progress').length,
      avgWaitTimeHours: computeAverage(prevOps.map(getWaitTimeHours)),
      avgDeconTimeHours: computeAverage(prevCompleted.map(getDeconTimeHours)),
      avgLeadTimeHours: computeAverage(prevCompleted.map(getLeadTimeHours)),
      avgDailyDecon: prevAvgDailyDecon
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
    completionRatePercent: completionRate,
    comparisons: {
      received: prevKPIs ? calculatePercentageChange(totalReceived, prevKPIs.totalReceived) : null,
      completed: prevKPIs ? calculatePercentageChange(completedOps.length, prevKPIs.completedCount) : null,
      waiting: prevKPIs ? calculatePercentageChange(waitingOps.length, prevKPIs.waitingCount) : null,
      inProgress: prevKPIs ? calculatePercentageChange(inProgressOps.length, prevKPIs.inProgressCount) : null,
      avgWait: prevKPIs && avgWaitTime !== null && prevKPIs.avgWaitTimeHours !== null ? calculatePercentageChange(avgWaitTime, prevKPIs.avgWaitTimeHours) : null,
      avgDecon: prevKPIs && avgDeconTime !== null && prevKPIs.avgDeconTimeHours !== null ? calculatePercentageChange(avgDeconTime, prevKPIs.avgDeconTimeHours) : null,
      avgLead: prevKPIs && avgLeadTime !== null && prevKPIs.avgLeadTimeHours !== null ? calculatePercentageChange(avgLeadTime, prevKPIs.avgLeadTimeHours) : null,
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
 * Indicators grouped by Product
 */
export function calculateProductIndicators(operations: DecontaminationOperation[]) {
  const prodMap = new Map<string, DecontaminationOperation[]>();

  operations.forEach(op => {
    const prodName = op.product?.trim() || 'Não Informado';
    if (!prodMap.has(prodName)) prodMap.set(prodName, []);
    prodMap.get(prodName)!.push(op);
  });

  const results = Array.from(prodMap.entries()).map(([product, ops]) => {
    const completedOps = ops.filter(o => o.status === 'completed');
    const deconTimes = completedOps.map(getDeconTimeHours);

    return {
      product,
      totalReceived: ops.length,
      completedCount: completedOps.length,
      avgDeconTime: computeAverage(deconTimes)
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

export type EvolutionChartMode = 'rx_vs_dc' | 'weekly' | 'monthly' | 'quarterly' | 'semestral';

export interface EvolutionChartDataPoint {
  label: string;
  recebidos: number;
  descontaminados: number;
  emAndamento: number;
  avgDeconTimeDays: number | null;
}

/**
 * Generates evolution chart data based on selected mode and operations list
 */
export function generateEvolutionChartData(operations: DecontaminationOperation[], mode: EvolutionChartMode): EvolutionChartDataPoint[] {
  if (operations.length === 0) return [];

  // Sort operations ascending by arrival date
  const sorted = [...operations].sort((a, b) => {
    const da = a.arrivalDate ? parseISO(a.arrivalDate).getTime() : 0;
    const db = b.arrivalDate ? parseISO(b.arrivalDate).getTime() : 0;
    return da - db;
  });

  const map = new Map<string, { label: string; recebidos: number; descontaminados: number; emAndamento: number; deconTimes: number[] }>();

  sorted.forEach(op => {
    if (!op.arrivalDate) return;
    try {
      const date = parseISO(op.arrivalDate);
      if (isNaN(date.getTime())) return;

      let key = '';
      let label = '';

      if (mode === 'weekly') {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        key = format(weekStart, 'yyyy-MM-dd');
        label = `Sem ${format(weekStart, 'dd/MM')}`;
      } else if (mode === 'monthly') {
        key = format(date, 'yyyy-MM');
        label = format(date, 'MMM/yy', { locale: ptBR }).toUpperCase();
      } else if (mode === 'quarterly') {
        const q = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${q}`;
        label = `${q}º Trim. ${date.getFullYear()}`;
      } else if (mode === 'semestral') {
        const s = date.getMonth() < 6 ? 1 : 2;
        key = `${date.getFullYear()}-S${s}`;
        label = `${s}º Sem. ${date.getFullYear()}`;
      } else {
        key = format(date, 'yyyy-MM');
        label = format(date, 'MMM/yy', { locale: ptBR }).toUpperCase();
      }

      if (!map.has(key)) {
        map.set(key, { label, recebidos: 0, descontaminados: 0, emAndamento: 0, deconTimes: [] });
      }

      const item = map.get(key)!;
      item.recebidos += 1;
      if (op.status === 'completed') {
        item.descontaminados += 1;
        const dt = getDeconTimeHours(op);
        if (dt !== null && !isNaN(dt)) {
          item.deconTimes.push(dt);
        }
      } else if (op.status === 'in_progress' || op.status === 'waiting') {
        item.emAndamento += 1;
      }
    } catch {
      // ignore invalid dates
    }
  });

  return Array.from(map.values()).map(item => ({
    label: item.label,
    recebidos: item.recebidos,
    descontaminados: item.descontaminados,
    emAndamento: item.emAndamento,
    avgDeconTimeDays: computeAverage(item.deconTimes)
  }));
}

