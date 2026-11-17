import type { DayOfWeek, Product } from '../types/product';

export const MERIDA_TIMEZONE = 'America/Merida';

const SPANISH_WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SPANISH_WEEKDAYS_FULL = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
const SPANISH_MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/**
 * Devuelve la fecha actual en formato YYYY-MM-DD usando la zona horaria America/Merida.
 */
export function getMeridaTodayIso(referenceDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MERIDA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(referenceDate);
}

/**
 * Parsea YYYY-MM-DD a componentes numéricos sin desplazamientos de zona horaria.
 */
export function parseIsoDateParts(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function addDaysToIso(iso: string, offsetDays: number): string {
  const { year, month, day } = parseIsoDateParts(iso);
  const utcDate = new Date(Date.UTC(year, month - 1, day + offsetDays));
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDayOfWeekFromIso(iso: string): DayOfWeek {
  const { year, month, day } = parseIsoDateParts(iso);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return utcDate.getUTCDay() as DayOfWeek;
}

export function getMondayOfWeekIso(iso: string): string {
  const dow = getDayOfWeekFromIso(iso);
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addDaysToIso(iso, diffToMonday);
}

export interface WeekDayOption {
  iso: string;
  dayOfWeek: DayOfWeek;
  shortDay: string;
  fullDay: string;
  dayNumber: number;
  monthShort: string;
  isRestaurantOpen: boolean;
}

export function getWeekDaysFromMonday(mondayIso: string): WeekDayOption[] {
  return Array.from({ length: 7 }, (_, index) => {
    const iso = addDaysToIso(mondayIso, index);
    const { day, month } = parseIsoDateParts(iso);
    const dow = getDayOfWeekFromIso(iso);
    return {
      iso,
      dayOfWeek: dow,
      shortDay: SPANISH_WEEKDAYS_SHORT[dow],
      fullDay: SPANISH_WEEKDAYS_FULL[dow],
      dayNumber: day,
      monthShort: SPANISH_MONTHS_SHORT[month - 1],
      isRestaurantOpen: dow >= 1 && dow <= 6, // Lunes a Sábado
    };
  });
}

export function formatSpanishDateLabel(iso: string): string {
  const { day, month, year } = parseIsoDateParts(iso);
  const dow = getDayOfWeekFromIso(iso);
  return `${SPANISH_WEEKDAYS_FULL[dow]} ${day} de ${SPANISH_MONTHS_SHORT[month - 1]} ${year}`;
}

export interface EvaluatedAvailability {
  canOrder: boolean;
  statusLabel: string;
  statusTone: 'available' | 'out-of-stock' | 'unavailable-date' | 'closed' | 'review';
  reason?: string;
}

/**
 * Evalúa disponibilidad real de un producto para una fecha específica:
 * 1. Horario general del restaurante (Lunes a Sábado; Domingo cerrado).
 * 2. Revisión pendiente de precio/datos en el PDF.
 * 3. Excepciones por fecha puntual.
 * 4. Disponibilidad por día de la semana.
 * 5. Existencias / estado agotado.
 */
export function evaluateProductAvailability(
  product: Product,
  dateIso: string,
  globalDateExceptions?: Record<string, string>
): EvaluatedAvailability {
  const dow = getDayOfWeekFromIso(dateIso);

  if (dow === 0) {
    return {
      canOrder: false,
      statusLabel: 'Cerrado los domingos',
      statusTone: 'closed',
      reason: 'Nutricious H&D atiende de lunes a sábado de 7:30 am a 2:30 pm.',
    };
  }

  if (globalDateExceptions && globalDateExceptions[dateIso]) {
    return {
      canOrder: false,
      statusLabel: 'Fecha con excepción',
      statusTone: 'unavailable-date',
      reason: globalDateExceptions[dateIso],
    };
  }

  if (product.reviewStatus === 'Por revisar' && product.priceMxn === null) {
    return {
      canOrder: false,
      statusLabel: 'Por revisar en PDF',
      statusTone: 'review',
      reason: product.reviewNote || 'Precio o descripción pendiente de confirmación en el menú PDF.',
    };
  }

  const productException = product.availability.dateExceptions?.[dateIso];
  if (productException && !productException.available) {
    return {
      canOrder: false,
      statusLabel: 'No disponible en esta fecha',
      statusTone: 'unavailable-date',
      reason: productException.reason,
    };
  }

  if (!product.availability.daysOfWeek.includes(dow)) {
    const allowedDays = product.availability.daysOfWeek
      .map((d) => SPANISH_WEEKDAYS_SHORT[d])
      .join(', ');
    return {
      canOrder: false,
      statusLabel: 'No disponible este día',
      statusTone: 'unavailable-date',
      reason: `Disponible únicamente: ${allowedDays}.`,
    };
  }

  if (product.inventory.manuallyOutOfStock || (product.inventory.trackStock && product.inventory.stock <= 0)) {
    return {
      canOrder: false,
      statusLabel: 'Agotado',
      statusTone: 'out-of-stock',
      reason: 'Sin existencias disponibles por el momento.',
    };
  }

  return {
    canOrder: true,
    statusLabel: product.inventory.trackStock
      ? `${product.inventory.stock} disponibles`
      : 'Disponible',
    statusTone: 'available',
  };
}
