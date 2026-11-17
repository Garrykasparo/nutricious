import type {
  CapacityScheduleConfig,
  ConfigurablePlanTemplate,
  DayOfWeek,
  DemoOrder,
  SlotCapacitySnapshot,
} from '../types/product';
import { addDaysToIso, getDayOfWeekFromIso } from './meridaDate';
import {
  calculateTurboMandadosDelivery,
  DELIVERY_TIME_SLOTS,
  mxnToCents,
  TURBO_MANDADOS_RULES,
} from './pricing';

export function getSlotRuleKey(dateIso: string, timeSlot: string): string {
  return `${dateIso}__${timeSlot}`;
}

/**
 * Evalúa la capacidad compartida de una franja horaria entre pedidos individuales ('a_la_carta')
 * y órdenes diarias de planes semanales ('plan_semanal').
 * 1 cupo = 1 pedido.
 */
export function evaluateSlotCapacity(params: {
  dateIso: string;
  timeSlot: string;
  capacityConfig: CapacityScheduleConfig;
  demoOrders: DemoOrder[];
  globalDateExceptions?: Record<string, string>;
  pendingAdditionalPlans?: number;
  ignoreOrderFolio?: string;
}): SlotCapacitySnapshot {
  const {
    dateIso,
    timeSlot,
    capacityConfig,
    demoOrders,
    globalDateExceptions,
    pendingAdditionalPlans = 0,
    ignoreOrderFolio,
  } = params;

  const key = getSlotRuleKey(dateIso, timeSlot);
  const customRule = capacityConfig.slotRules[key];
  const limit = Math.max(
    0,
    customRule ? customRule.limit : capacityConfig.defaultSlotLimit
  );
  const manuallyBlocked = Boolean(customRule?.blocked);
  const blockReason = customRule?.blockReason;

  const dow = getDayOfWeekFromIso(dateIso);
  const isSunday = dow === 0;
  const globalDateBlockedReason = globalDateExceptions?.[dateIso];

  let occupiedIndividual = 0;
  let occupiedPlans = 0;

  for (const ord of demoOrders) {
    if (ignoreOrderFolio && ord.folio === ignoreOrderFolio) continue;
    if (ord.scheduledDateIso !== dateIso || ord.timeSlot !== timeSlot) continue;
    if (ord.orderType === 'plan_semanal') {
      occupiedPlans += 1;
    } else {
      occupiedIndividual += 1;
    }
  }

  occupiedPlans += Math.max(0, pendingAdditionalPlans);
  const occupiedTotal = occupiedIndividual + occupiedPlans;
  const remaining = Math.max(0, limit - occupiedTotal);
  const isFull = remaining <= 0 || limit === 0;
  const canBook = !isSunday && !globalDateBlockedReason && !manuallyBlocked && !isFull;

  let statusLabel = `${remaining} cupo${remaining === 1 ? '' : 's'} disp.`;
  if (isSunday) {
    statusLabel = 'Cerrado (domingo)';
  } else if (globalDateBlockedReason) {
    statusLabel = 'Fecha con excepción';
  } else if (manuallyBlocked) {
    statusLabel = 'Bloqueada por admin';
  } else if (isFull) {
    statusLabel = 'Franja llena (0 cupos)';
  }

  return {
    key,
    dateIso,
    timeSlot,
    limit,
    occupiedIndividual,
    occupiedPlans,
    occupiedTotal,
    remaining,
    manuallyBlocked,
    blockReason,
    globalDateBlockedReason,
    isSunday,
    isFull,
    canBook,
    statusLabel,
  };
}

/**
 * Genera N fechas hábiles consecutivas (Lunes a Sábado, respetando días permitidos y excepciones globales)
 * a partir de `startDateIso`.
 */
export function buildDefaultPlanDates(params: {
  startDateIso: string;
  daysCount: number;
  allowedWeekdays?: DayOfWeek[];
  globalDateExceptions?: Record<string, string>;
}): string[] {
  const {
    startDateIso,
    daysCount,
    allowedWeekdays = [1, 2, 3, 4, 5, 6],
    globalDateExceptions,
  } = params;

  const result: string[] = [];
  let cursor = startDateIso;
  let safetyCounter = 0;

  while (result.length < daysCount && safetyCounter < 90) {
    const dow = getDayOfWeekFromIso(cursor);
    const isException = Boolean(globalDateExceptions?.[cursor]);
    if (dow !== 0 && !isException && allowedWeekdays.includes(dow)) {
      result.push(cursor);
    }
    cursor = addDaysToIso(cursor, 1);
    safetyCounter += 1;
  }

  return result;
}

/**
 * Encuentra la primera franja disponible para una fecha dada.
 */
export function findFirstOpenTimeSlot(params: {
  dateIso: string;
  capacityConfig: CapacityScheduleConfig;
  demoOrders: DemoOrder[];
  globalDateExceptions?: Record<string, string>;
}): string {
  for (const slot of DELIVERY_TIME_SLOTS) {
    const snap = evaluateSlotCapacity({
      dateIso: params.dateIso,
      timeSlot: slot,
      capacityConfig: params.capacityConfig,
      demoOrders: params.demoOrders,
      globalDateExceptions: params.globalDateExceptions,
    });
    if (snap.canBook) {
      return slot;
    }
  }
  return DELIVERY_TIME_SLOTS[0];
}

/**
 * Distribuye un entero `totalCents` entre N cubetas de acuerdo con `weights`
 * usando el método de restos mayores (Hamilton), conservando la suma exacta en centavos.
 */
export function distributeCentsProportionally(
  totalCents: number,
  weights: number[]
): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const normalizedTotal = Math.round(totalCents);
  if (normalizedTotal === 0) return new Array(n).fill(0);

  const safeWeights = weights.map((w) => Math.max(0, w));
  const weightSum = safeWeights.reduce((acc, w) => acc + w, 0);
  const effectiveWeights = weightSum > 0 ? safeWeights : new Array(n).fill(1);
  const effectiveSum = effectiveWeights.reduce((acc, w) => acc + w, 0);

  const exactShares = effectiveWeights.map((w) => (normalizedTotal * w) / effectiveSum);
  const baseFloors = exactShares.map((s) => Math.floor(s));
  let remainder = normalizedTotal - baseFloors.reduce((acc, v) => acc + v, 0);

  const rankedIndices = exactShares
    .map((s, idx) => ({ idx, frac: s - Math.floor(s) }))
    .sort((a, b) => {
      if (b.frac !== a.frac) return b.frac - a.frac;
      return a.idx - b.idx;
    });

  const result = [...baseFloors];
  for (let i = 0; i < remainder; i += 1) {
    const target = rankedIndices[i % rankedIndices.length];
    result[target.idx] += 1;
  }

  return result;
}

export interface PlanDayPricingInput {
  dayIndex: number;
  fulfillmentMode: 'delivery' | 'pickup';
  dishSumCents: number;
}

export interface PlanPricingCalculation {
  covered: boolean;
  reason?: string;
  foodSubtotalCents: number;
  serviceFeeCents: number;
  deliveryTotalCents: number;
  totalCents: number;
  contractedDeliveriesCount: number;
  perDayAllocations: Array<{
    dayIndex: number;
    allocatedFoodCents: number;
    allocatedServiceFeeCents: number;
    allocatedDeliveryFeeCents: number;
    allocatedTotalCents: number;
  }>;
}

/**
 * Calcula los importes del plan en centavos:
 * - Cuota del 4% calculada UNA SOLA VEZ sobre los alimentos del plan (0 si ningún día es a domicilio).
 * - Suma los envíos contratados (solo los días con modalidad 'delivery').
 * - Distribuye alimentos y cuota 4% entre las órdenes diarias conservando el total exacto en centavos.
 */
export function calculateWeeklyPlanPricing(params: {
  template: ConfigurablePlanTemplate;
  days: PlanDayPricingInput[];
  distanceKm: number;
}): PlanPricingCalculation {
  const { template, days, distanceKm } = params;
  const sumOfSelectedDishesCents = days.reduce((sum, d) => sum + Math.max(0, d.dishSumCents), 0);

  const foodSubtotalCents =
    template.foodPricingMode === 'fixed_example'
      ? mxnToCents(template.exampleFoodPriceMxn)
      : sumOfSelectedDishesCents;

  const hasAnyDelivery = days.some((d) => d.fulfillmentMode === 'delivery');
  const deliveryQuote = hasAnyDelivery ? calculateTurboMandadosDelivery(distanceKm) : null;

  if (hasAnyDelivery && deliveryQuote && (!deliveryQuote.covered || deliveryQuote.feeCents === null)) {
    return {
      covered: false,
      reason:
        deliveryQuote.reason ||
        `Fuera de cobertura máxima (${TURBO_MANDADOS_RULES.maxCoverageKm} km).`,
      foodSubtotalCents,
      serviceFeeCents: Math.round(foodSubtotalCents * TURBO_MANDADOS_RULES.serviceFeeRate),
      deliveryTotalCents: 0,
      totalCents: 0,
      contractedDeliveriesCount: days.filter((d) => d.fulfillmentMode === 'delivery').length,
      perDayAllocations: [],
    };
  }

  const singleDeliveryFeeCents =
    hasAnyDelivery && deliveryQuote && deliveryQuote.feeCents !== null
      ? deliveryQuote.feeCents
      : 0;

  const serviceFeeCents =
    foodSubtotalCents > 0 && hasAnyDelivery
      ? Math.round(foodSubtotalCents * TURBO_MANDADOS_RULES.serviceFeeRate)
      : 0;

  const allocatedFoods =
    template.foodPricingMode === 'fixed_example'
      ? distributeCentsProportionally(
          foodSubtotalCents,
          days.map((d) => (d.dishSumCents > 0 ? d.dishSumCents : 1))
        )
      : days.map((d) => Math.max(0, d.dishSumCents));

  const allocatedServiceFees = distributeCentsProportionally(serviceFeeCents, allocatedFoods);

  const perDayAllocations = days.map((d, idx) => {
    const allocatedFoodCents = allocatedFoods[idx] ?? 0;
    const allocatedServiceFeeCents = allocatedServiceFees[idx] ?? 0;
    const allocatedDeliveryFeeCents =
      d.fulfillmentMode === 'delivery' ? singleDeliveryFeeCents : 0;
    const allocatedTotalCents =
      allocatedFoodCents + allocatedServiceFeeCents + allocatedDeliveryFeeCents;
    return {
      dayIndex: d.dayIndex,
      allocatedFoodCents,
      allocatedServiceFeeCents,
      allocatedDeliveryFeeCents,
      allocatedTotalCents,
    };
  });

  const deliveryTotalCents = perDayAllocations.reduce(
    (sum, a) => sum + a.allocatedDeliveryFeeCents,
    0
  );
  const totalCents = foodSubtotalCents + serviceFeeCents + deliveryTotalCents;

  return {
    covered: true,
    foodSubtotalCents,
    serviceFeeCents,
    deliveryTotalCents,
    totalCents,
    contractedDeliveriesCount: days.filter((d) => d.fulfillmentMode === 'delivery').length,
    perDayAllocations,
  };
}

/**
 * Regla de reprogramación:
 * Solo se permite reprogramar ANTES de iniciar preparación (prepStatus === 'Confirmado')
 * y ANTES de asignar transporte (deliveryStatus sin asignación a Turbo Mandados ni recolección/entrega).
 */
export function canReschedulePlanOrder(order: DemoOrder): {
  allowed: boolean;
  reason?: string;
} {
  if (order.prepStatus !== 'Confirmado') {
    return {
      allowed: false,
      reason: `Bloqueado: Cocina ya cambió el estado a "${order.prepStatus}".`,
    };
  }

  const isTransportAssigned =
    Boolean(order.deliveryTracking?.assignedToTurboDemo) ||
    order.deliveryStatus === 'Asignado' ||
    order.deliveryStatus === 'Recolectado' ||
    order.deliveryStatus === 'En camino' ||
    order.deliveryStatus === 'Entregado' ||
    order.deliveryStatus === 'Incidencia';

  if (isTransportAssigned) {
    return {
      allowed: false,
      reason: `Bloqueado: el pedido ya tiene gestión de entrega (${order.deliveryStatus}).`,
    };
  }

  return { allowed: true };
}

export function getPlanDayCalendarBadge(order: DemoOrder): {
  label: 'Entregado' | 'En curso' | 'Pendiente';
  tone: 'delivered' | 'active' | 'pending';
} {
  if (order.deliveryStatus === 'Entregado') {
    return { label: 'Entregado', tone: 'delivered' };
  }
  if (
    order.prepStatus !== 'Confirmado' ||
    order.deliveryStatus === 'Asignado' ||
    order.deliveryStatus === 'Recolectado' ||
    order.deliveryStatus === 'En camino'
  ) {
    return { label: 'En curso', tone: 'active' };
  }
  return { label: 'Pendiente', tone: 'pending' };
}
