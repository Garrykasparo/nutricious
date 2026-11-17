import type { OrderFulfillmentMode } from '../types/product';

export const TURBO_MANDADOS_RULES = {
  baseKm: 3,
  baseFeeCents: 3000, // $30.00 MXN
  additionalKmFeeCents: 600, // $6.00 MXN por km adicional
  maxCoverageKm: 13,
  serviceFeeRate: 0.04,
} as const;

export type FulfillmentMode = OrderFulfillmentMode;

export interface DeliveryQuote {
  covered: boolean;
  distanceKm: number;
  feeCents: number | null;
  additionalKm: number;
  reason?: string;
}

export interface OrderPricingBreakdown {
  subtotalCents: number;
  serviceFeeCents: number;
  deliveryFeeCents: number;
  totalCents: number | null;
  covered: boolean;
  fulfillmentMode: OrderFulfillmentMode;
  serviceFeeApplied: boolean;
  deliveryQuote: DeliveryQuote | null;
}

export function mxnToCents(amountMxn: number): number {
  return Math.round(amountMxn * 100);
}

export function centsToMxn(cents: number): number {
  return cents / 100;
}

/**
 * Formatea centavos en MXN siempre con dos decimales (ej. $302.00).
 */
export function formatCentsMXN(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Formatea un monto en pesos MXN con dos decimales.
 */
export function formatMXN(amount: number): string {
  return formatCentsMXN(mxnToCents(amount));
}

/**
 * Calcula la tarifa provisional de Turbo Mandados en centavos:
 * - De 0 a 3 km: $30.00 MXN (3000 centavos)
 * - Kilómetro adicional (> 3 km y <= 13 km): $6.00 MXN proporcional por fracción de km
 * - Cobertura máxima: 13 km desde el restaurante
 */
export function calculateTurboMandadosDelivery(distanceKm: number): DeliveryQuote {
  const normalizedKm = Math.max(0, Math.round(distanceKm * 100) / 100);

  if (normalizedKm > TURBO_MANDADOS_RULES.maxCoverageKm) {
    return {
      covered: false,
      distanceKm: normalizedKm,
      feeCents: null,
      additionalKm: Math.max(0, Math.round((normalizedKm - TURBO_MANDADOS_RULES.baseKm) * 100) / 100),
      reason: `Fuera de cobertura máxima (${TURBO_MANDADOS_RULES.maxCoverageKm} km desde el restaurante).`,
    };
  }

  if (normalizedKm <= TURBO_MANDADOS_RULES.baseKm) {
    return {
      covered: true,
      distanceKm: normalizedKm,
      feeCents: TURBO_MANDADOS_RULES.baseFeeCents,
      additionalKm: 0,
    };
  }

  const additionalKm = Math.round((normalizedKm - TURBO_MANDADOS_RULES.baseKm) * 100) / 100;
  const additionalCents = Math.round(additionalKm * TURBO_MANDADOS_RULES.additionalKmFeeCents);
  const feeCents = TURBO_MANDADOS_RULES.baseFeeCents + additionalCents;

  return {
    covered: true,
    distanceKm: normalizedKm,
    feeCents,
    additionalKm,
  };
}

/**
 * Calcula todos los importes en centavos:
 * - Si subtotalCents <= 0 (sin productos), todo debe ser 0.
 * - A domicilio: subtotal + cuota 4% (solo productos) + envío Turbo Mandados.
 * - Recoger en tienda o consumir en restaurante: subtotal (cuota 4% = 0, envío = 0).
 */
export function calculateOrderBreakdownCents(params: {
  subtotalCents: number;
  fulfillmentMode: OrderFulfillmentMode;
  distanceKm: number;
}): OrderPricingBreakdown {
  const subtotalCents = Math.max(0, Math.round(params.subtotalCents));

  if (subtotalCents === 0) {
    return {
      subtotalCents: 0,
      serviceFeeCents: 0,
      deliveryFeeCents: 0,
      totalCents: 0,
      covered: true,
      fulfillmentMode: params.fulfillmentMode,
      serviceFeeApplied: false,
      deliveryQuote: null,
    };
  }

  if (params.fulfillmentMode === 'pickup' || params.fulfillmentMode === 'dine_in') {
    return {
      subtotalCents,
      serviceFeeCents: 0,
      deliveryFeeCents: 0,
      totalCents: subtotalCents,
      covered: true,
      fulfillmentMode: params.fulfillmentMode,
      serviceFeeApplied: false,
      deliveryQuote: null,
    };
  }

  const deliveryQuote = calculateTurboMandadosDelivery(params.distanceKm);
  const serviceFeeCents = Math.round(subtotalCents * TURBO_MANDADOS_RULES.serviceFeeRate);

  if (!deliveryQuote.covered || deliveryQuote.feeCents === null) {
    return {
      subtotalCents,
      serviceFeeCents,
      deliveryFeeCents: 0,
      totalCents: null,
      covered: false,
      fulfillmentMode: 'delivery',
      serviceFeeApplied: true,
      deliveryQuote,
    };
  }

  return {
    subtotalCents,
    serviceFeeCents,
    deliveryFeeCents: deliveryQuote.feeCents,
    totalCents: subtotalCents + serviceFeeCents + deliveryQuote.feeCents,
    covered: true,
    fulfillmentMode: 'delivery',
    serviceFeeApplied: true,
    deliveryQuote,
  };
}

export const DELIVERY_TIME_SLOTS = [
  '07:30 - 09:00',
  '09:00 - 10:30',
  '10:30 - 12:00',
  '12:00 - 13:30',
  '13:30 - 14:30',
] as const;

export const BUSINESS_INFO = {
  brand: 'Nutricious H&D',
  slogan: 'Comida real, vida mejor',
  city: 'Mérida, Yucatán',
  timezone: 'America/Merida',
  scheduleDays: 'Lunes a Sábado',
  scheduleHours: '7:30 am a 2:30 pm',
  whatsappDisplay: '999 259 5555',
  whatsappUrl: 'https://wa.me/529992595555',
  deliveryPartner: 'Turbo Mandados',
} as const;
