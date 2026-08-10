import { differenceInDays, parseISO, isValid, format, addYears } from 'date-fns';
import { FleetEquipment } from '../types/fleet';

/**
 * Calculates remaining days from today until the next inspection date.
 * Negative number means overdue (vencido).
 */
export function calculateDaysRemaining(targetDateStr: string | undefined | null): number {
  if (!targetDateStr) return 9999;
  
  try {
    const cleanDate = targetDateStr.trim().substring(0, 10);
    const targetDate = parseISO(cleanDate);
    if (!isValid(targetDate)) return 9999;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);

    return differenceInDays(targetDate, today);
  } catch (e) {
    return 9999;
  }
}

/**
 * Calculates completeness index percentage (0% - 100%) for a equipment record
 */
export function calculateCompletenessScore(equipment: Partial<FleetEquipment>): number {
  if (!equipment) return 0;
  let score = 0;

  // 1. Tag / Equipment number (15%)
  if (equipment.equipmentNumber && equipment.equipmentNumber.trim().length > 0) {
    score += 15;
  }

  // 2. Type (15%)
  if (equipment.type && equipment.type.trim().length > 0) {
    score += 15;
  }

  // 3. Client ID / Client Name (15%)
  if (equipment.clientId && equipment.clientId.trim().length > 0 && equipment.clientId !== '—') {
    score += 15;
  }

  // 4. Location (15%)
  if (equipment.location && equipment.location.trim().length > 0) {
    score += 15;
  }

  // 5. Visual Inspection Date (12.5%)
  if (equipment.visualInspectionDate && equipment.visualInspectionDate.trim().length > 0) {
    score += 12.5;
  }

  // 6. END Inspection Date (12.5%)
  if (equipment.endInspectionDate && equipment.endInspectionDate.trim().length > 0) {
    score += 12.5;
  }

  // 7. Explicitly Validated by User (15%)
  const isValidated = equipment.isPendingValidation === false || equipment.validationStatus === 'validated';
  if (isValidated) {
    score += 15;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Helper to calculate next expiration date (default +1 year)
 */
export function calculateNextInspectionDate(inspectionDateStr: string, yearsToAdd: number = 1): string {
  if (!inspectionDateStr) return '';
  try {
    const parsed = parseISO(inspectionDateStr.trim().substring(0, 10));
    if (!isValid(parsed)) return '';
    const nextDate = addYears(parsed, yearsToAdd);
    return format(nextDate, 'yyyy-MM-dd');
  } catch (e) {
    return '';
  }
}

/**
 * Returns color classes and label for expiration countdown badges
 */
export function getExpirationStatus(days: number) {
  if (days === 9999) {
    return {
      colorClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200',
      label: 'Não informada',
      category: 'normal'
    };
  }

  if (days < 0) {
    const absDays = Math.abs(days);
    return {
      colorClass: 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/30 border-red-500 font-bold',
      label: `Vencido há ${absDays} dia${absDays === 1 ? '' : 's'}`,
      category: 'vencido'
    };
  }

  if (days === 0) {
    return {
      colorClass: 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/30 border-red-500 font-bold',
      label: 'Vence HOJE!',
      category: 'vencido'
    };
  }

  if (days < 30) {
    return {
      colorClass: 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border-red-300 dark:border-red-800 font-bold',
      label: `${days} dia${days === 1 ? '' : 's'}`,
      category: 'urgente'
    };
  }

  if (days <= 90) {
    return {
      colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold',
      label: `${days} dias`,
      category: 'atencao'
    };
  }

  return {
    colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold',
    label: `${days} dias`,
    category: 'ok'
  };
}

export function formatDateBR(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const cleanDate = dateStr.trim().substring(0, 10);
    const parsed = parseISO(cleanDate);
    if (!isValid(parsed)) return dateStr;
    return format(parsed, 'dd/MM/yyyy');
  } catch (e) {
    return dateStr;
  }
}

export interface FleetEquipmentKey {
  id?: string;
  type: string;
  equipmentNumber: string;
}

/**
 * Validates if an equipment record is a duplicate.
 * A record is ONLY considered duplicate when BOTH Type AND Equipment Number match simultaneously.
 */
export function checkDuplicateEquipment(
  type: string,
  equipmentNumber: string,
  existingList: FleetEquipmentKey[],
  currentId?: string
): boolean {
  const normType = (type || '').trim().toUpperCase();
  const normNumber = (equipmentNumber || '').trim().toUpperCase();

  if (!normType || !normNumber) return false;

  return existingList.some(item => {
    if (currentId && item.id === currentId) {
      return false;
    }

    const itemType = (item.type || '').trim().toUpperCase();
    const itemNumber = (item.equipmentNumber || '').trim().toUpperCase();

    return itemType === normType && itemNumber === normNumber;
  });
}

/**
 * Audits the current fleet records and history to detect assets that may have been affected or suppressed by the old single-field duplication rule.
 */
export function auditFleetDuplicates(
  equipments: FleetEquipment[],
  historyEntries: any[] = []
): {
  affectedCount: number;
  duplicateNumbersCount: number;
  duplicateNumbersMap: Record<string, string[]>;
  details: string[];
} {
  const numberToTypesMap: Record<string, Set<string>> = {};

  equipments.forEach(eq => {
    const num = (eq.equipmentNumber || '').trim().toUpperCase();
    const type = (eq.type || 'OUTROS').trim().toUpperCase();
    if (num) {
      if (!numberToTypesMap[num]) {
        numberToTypesMap[num] = new Set();
      }
      numberToTypesMap[num].add(type);
    }
  });

  const duplicateNumbersMap: Record<string, string[]> = {};
  let duplicateNumbersCount = 0;

  Object.entries(numberToTypesMap).forEach(([num, typeSet]) => {
    if (typeSet.size > 1) {
      duplicateNumbersCount++;
      duplicateNumbersMap[num] = Array.from(typeSet);
    }
  });

  const affectedDetails: string[] = [];
  const affectedNumbersSet = new Set<string>();

  historyEntries.forEach(h => {
    if (h.field === 'type' && h.oldValue && h.newValue && h.oldValue !== h.newValue && h.oldValue !== '—') {
      affectedNumbersSet.add(h.equipmentNumber);
      affectedDetails.push(`Ativo #${h.equipmentNumber}: Tipo alterado de '${h.oldValue}' para '${h.newValue}' em importação anterior.`);
    }
  });

  return {
    affectedCount: affectedNumbersSet.size,
    duplicateNumbersCount,
    duplicateNumbersMap,
    details: affectedDetails
  };
}


