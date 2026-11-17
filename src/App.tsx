/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { MotionConfig } from 'motion/react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { BrandStorySection } from './components/BrandStorySection';
import { BenefitsSection } from './components/BenefitsSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { FeaturedDishesSection } from './components/FeaturedDishesSection';
import { IllustrativePlansSection } from './components/IllustrativePlansSection';
import { DeliveryCalculatorSection } from './components/DeliveryCalculatorSection';
import { FaqSection } from './components/FaqSection';
import { MenuShowcaseSection } from './components/MenuShowcaseSection';
import {
  CartCheckoutView,
  type ConfirmOrderPayload,
  type ConfirmOrderResult,
} from './components/CartCheckoutView';
import {
  WeeklyPlansView,
  type ConfirmWeeklyPlanPayload,
  type ConfirmWeeklyPlanResult,
} from './components/WeeklyPlansView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { PendingModuleView } from './components/PendingModuleView';
import { FooterSection } from './components/FooterSection';
import { MobileBottomBar, type AppView } from './components/MobileBottomBar';
import {
  DEFAULT_CAPACITY_CONFIG,
  DEFAULT_CONFIGURABLE_PLAN_TEMPLATES,
  GLOBAL_DATE_EXCEPTIONS,
  PRODUCTS,
} from './data/menuData';
import type {
  AuditLogEntry,
  CapacityScheduleConfig,
  ConfigurablePlanTemplate,
  DeliveryTrackingInfo,
  DemoOrder,
  DraftOrderItem,
  OrderDeliveryStatus,
  OrderLineSnapshot,
  OrderPaymentStatus,
  OrderPrepStatus,
  PlanDayCalendarEntry,
  Product,
  WeeklyPlanPurchase,
} from './types/product';
import {
  calculateWeeklyPlanPricing,
  canReschedulePlanOrder,
  evaluateSlotCapacity,
  getSlotRuleKey,
} from './utils/capacityAndPlans';
import {
  addDaysToIso,
  evaluateProductAvailability,
  formatSpanishDateLabel,
  getDayOfWeekFromIso,
  getMeridaTodayIso,
  MERIDA_TIMEZONE,
} from './utils/meridaDate';
import {
  calculateOrderBreakdownCents,
  formatCentsMXN,
  mxnToCents,
  TURBO_MANDADOS_RULES,
} from './utils/pricing';

const FAVORITES_STORAGE_KEY = 'nutricious_favorites_v1';
const DRAFT_ORDER_STORAGE_KEY = 'nutricious_draft_selection_v1';
const STOCK_OVERRIDES_STORAGE_KEY = 'nutricious_stock_overrides_v1';
const PRODUCT_OVERRIDES_STORAGE_KEY = 'nutricious_product_overrides_v1';
const GLOBAL_EXCEPTIONS_STORAGE_KEY = 'nutricious_global_exceptions_v1';
const DEMO_ORDERS_STORAGE_KEY = 'nutricious_orders_v1';
const AUDIT_LOG_STORAGE_KEY = 'nutricious_audit_log_v1';
const PLAN_TEMPLATES_STORAGE_KEY = 'nutricious_plan_templates_v1';
const CAPACITY_CONFIG_STORAGE_KEY = 'nutricious_capacity_config_v1';
const WEEKLY_PLANS_STORAGE_KEY = 'nutricious_weekly_plans_v1';

function getInitialOpenMeridaDateIso(): string {
  const today = getMeridaTodayIso();
  return getDayOfWeekFromIso(today) === 0 ? addDaysToIso(today, 1) : today;
}

function formatNowMeridaDisplay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: MERIDA_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function createAuditEntry(params: {
  scope: AuditLogEntry['scope'];
  entityId: string;
  entityLabel: string;
  action: string;
  details: string;
}): AuditLogEntry {
  const now = new Date();
  return {
    id: `aud-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    timestampIso: now.toISOString(),
    timestampDisplay: formatNowMeridaDisplay(now),
    scope: params.scope,
    entityId: params.entityId,
    entityLabel: params.entityLabel,
    action: params.action,
    details: params.details,
  };
}

function normalizeLegacyOrders(rawOrders: DemoOrder[]): DemoOrder[] {
  return rawOrders.map((ord) => {
    const rawPrep = ord.prepStatus as string;
    const normalizedPrep: OrderPrepStatus =
      rawPrep === 'Pendiente en cocina' ? 'Confirmado' : ord.prepStatus;
    return {
      ...ord,
      orderType: ord.orderType ?? 'a_la_carta',
      prepStatus: normalizedPrep,
    };
  });
}

function buildWhatsappSummaryText(order: Omit<DemoOrder, 'whatsappSummaryText'>): string {
  const modeLabel =
    order.fulfillmentMode === 'delivery'
      ? `A domicilio (Turbo Mandados · ${order.distanceKm ?? 0} km)`
      : order.fulfillmentMode === 'pickup'
        ? 'Recoger en tienda'
        : `Consumir en restaurante (Mesa: ${order.customer.tableNumber})`;

  const linesText = order.items
    .map((line) => {
      const customs = line.selectedCustomizations
        .filter((c) => c.optionLabels.length > 0)
        .map((c) => `${c.groupLabel}: ${c.optionLabels.join(', ')}`)
        .join(' | ');
      return `- ${line.quantity}x ${line.productName}${customs ? ` [${customs}]` : ''} — ${formatCentsMXN(
        line.lineTotalCents
      )}`;
    })
    .join('\n');

  const deliveryDetails: string[] = [];
  if (order.fulfillmentMode === 'delivery') {
    deliveryDetails.push(`Dirección: ${order.customer.address}`);
    deliveryDetails.push(`Referencias: ${order.customer.references}`);
    if (order.customer.isSpecialLocation) {
      if (order.customer.building) deliveryDetails.push(`Edificio: ${order.customer.building}`);
      if (order.customer.hospital) deliveryDetails.push(`Hospital: ${order.customer.hospital}`);
      if (order.customer.area) deliveryDetails.push(`Área: ${order.customer.area}`);
      if (order.customer.receiverName) {
        deliveryDetails.push(`Recibe: ${order.customer.receiverName}`);
      }
    }
  }

  if (order.customer.orderNotes) {
    deliveryDetails.push(`Observaciones: ${order.customer.orderNotes}`);
  }

  return [
    `*Nutricious H&D — Pedido Demo ${order.folio}*`,
    `Fecha: ${formatSpanishDateLabel(order.scheduledDateIso)} (${order.timeSlot})`,
    `Modalidad: ${modeLabel}`,
    `Cliente: ${order.customer.customerName} · Tel: ${order.customer.customerPhone}`,
    ...deliveryDetails,
    '',
    '*Platillos:*',
    linesText,
    '',
    `Subtotal productos: ${formatCentsMXN(order.pricingSnapshot.subtotalCents)}`,
    `Cuota de servicio (4%): ${formatCentsMXN(order.pricingSnapshot.serviceFeeCents)}`,
    `Envío Turbo Mandados: ${formatCentsMXN(order.pricingSnapshot.deliveryFeeCents)}`,
    `*Total: ${formatCentsMXN(order.pricingSnapshot.totalCents)} MXN*`,
    '',
    `Pago: ${order.paymentStatus}`,
    `Preparación: ${order.prepStatus}`,
    `Entrega: ${order.deliveryStatus}`,
  ].join('\n');
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('inicio');
  const [selectedDateIso, setSelectedDateIso] = useState<string>(() =>
    getInitialOpenMeridaDateIso()
  );

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : ['avocado-toast', 'jugo-verde-nutricious'];
    } catch {
      return ['avocado-toast', 'jugo-verde-nutricious'];
    }
  });

  const [draftItems, setDraftItems] = useState<DraftOrderItem[]>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_ORDER_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DraftOrderItem[]) : [];
    } catch {
      return [];
    }
  });

  const [stockOverrides, setStockOverrides] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(STOCK_OVERRIDES_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });

  const [productOverrides, setProductOverrides] = useState<Record<string, Product>>(() => {
    try {
      const raw = localStorage.getItem(PRODUCT_OVERRIDES_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, Product>) : {};
    } catch {
      return {};
    }
  });

  const [globalDateExceptions, setGlobalDateExceptions] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(GLOBAL_EXCEPTIONS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : GLOBAL_DATE_EXCEPTIONS;
    } catch {
      return GLOBAL_DATE_EXCEPTIONS;
    }
  });

  const [demoOrders, setDemoOrders] = useState<DemoOrder[]>(() => {
    try {
      const raw = localStorage.getItem(DEMO_ORDERS_STORAGE_KEY);
      return raw ? normalizeLegacyOrders(JSON.parse(raw) as DemoOrder[]) : [];
    } catch {
      return [];
    }
  });

  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuditLogEntry[]) : [];
    } catch {
      return [];
    }
  });

  const [planTemplates, setPlanTemplates] = useState<ConfigurablePlanTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(PLAN_TEMPLATES_STORAGE_KEY);
      return raw
        ? (JSON.parse(raw) as ConfigurablePlanTemplate[])
        : DEFAULT_CONFIGURABLE_PLAN_TEMPLATES;
    } catch {
      return DEFAULT_CONFIGURABLE_PLAN_TEMPLATES;
    }
  });

  const [capacityConfig, setCapacityConfig] = useState<CapacityScheduleConfig>(() => {
    try {
      const raw = localStorage.getItem(CAPACITY_CONFIG_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CapacityScheduleConfig) : DEFAULT_CAPACITY_CONFIG;
    } catch {
      return DEFAULT_CAPACITY_CONFIG;
    }
  });

  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanPurchase[]>(() => {
    try {
      const raw = localStorage.getItem(WEEKLY_PLANS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as WeeklyPlanPurchase[]) : [];
    } catch {
      return [];
    }
  });

  const [preselectedPlanTemplateId, setPreselectedPlanTemplateId] = useState<string | null>(
    null
  );

  const confirmLockRef = useRef(false);
  const processedIdempotencyKeysRef = useRef<Map<string, DemoOrder>>(new Map());
  const processedPlanIdempotencyKeysRef = useRef<Map<string, WeeklyPlanPurchase>>(new Map());

  const products: Product[] = useMemo(
    () =>
      PRODUCTS.map((baseProduct) => {
        const editedProduct = productOverrides[baseProduct.id] ?? baseProduct;
        const overrideStock = stockOverrides[baseProduct.id];
        if (typeof overrideStock !== 'number') {
          return editedProduct;
        }
        return {
          ...editedProduct,
          inventory: {
            ...editedProduct.inventory,
            stock: Math.max(0, overrideStock),
          },
        };
      }),
    [productOverrides, stockOverrides]
  );

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // ignore storage quota issues
    }
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_ORDER_STORAGE_KEY, JSON.stringify(draftItems));
    } catch {
      // ignore storage quota issues
    }
  }, [draftItems]);

  useEffect(() => {
    try {
      localStorage.setItem(STOCK_OVERRIDES_STORAGE_KEY, JSON.stringify(stockOverrides));
    } catch {
      // ignore storage quota issues
    }
  }, [stockOverrides]);

  useEffect(() => {
    try {
      localStorage.setItem(PRODUCT_OVERRIDES_STORAGE_KEY, JSON.stringify(productOverrides));
    } catch {
      // ignore storage quota issues
    }
  }, [productOverrides]);

  useEffect(() => {
    try {
      localStorage.setItem(GLOBAL_EXCEPTIONS_STORAGE_KEY, JSON.stringify(globalDateExceptions));
    } catch {
      // ignore storage quota issues
    }
  }, [globalDateExceptions]);

  useEffect(() => {
    try {
      localStorage.setItem(DEMO_ORDERS_STORAGE_KEY, JSON.stringify(demoOrders));
    } catch {
      // ignore storage quota issues
    }
  }, [demoOrders]);

  useEffect(() => {
    try {
      localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(auditLog));
    } catch {
      // ignore storage quota issues
    }
  }, [auditLog]);

  useEffect(() => {
    try {
      localStorage.setItem(PLAN_TEMPLATES_STORAGE_KEY, JSON.stringify(planTemplates));
    } catch {
      // ignore storage quota issues
    }
  }, [planTemplates]);

  useEffect(() => {
    try {
      localStorage.setItem(CAPACITY_CONFIG_STORAGE_KEY, JSON.stringify(capacityConfig));
    } catch {
      // ignore storage quota issues
    }
  }, [capacityConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(WEEKLY_PLANS_STORAGE_KEY, JSON.stringify(weeklyPlans));
    } catch {
      // ignore storage quota issues
    }
  }, [weeklyPlans]);

  const appendAudit = useCallback(
    (params: Parameters<typeof createAuditEntry>[0]) => {
      const entry = createAuditEntry(params);
      setAuditLog((prev) => [entry, ...prev].slice(0, 200));
    },
    []
  );

  const handleToggleFavorite = useCallback((productId: string) => {
    setFavorites((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const handleAddDraftItem = useCallback((item: DraftOrderItem) => {
    setDraftItems((prev) => [...prev, item]);
  }, []);

  const handleUpdateDraftItemQuantity = useCallback(
    (uid: string, nextQuantity: number) => {
      setDraftItems((prev) => {
        const target = prev.find((line) => line.uid === uid);
        if (!target) return prev;
        if (nextQuantity <= 0) {
          return prev.filter((line) => line.uid !== uid);
        }
        const liveProduct = products.find((p) => p.id === target.productId);
        if (!liveProduct) return prev;

        const otherLinesQty = prev
          .filter((line) => line.productId === target.productId && line.uid !== uid)
          .reduce((sum, line) => sum + line.quantity, 0);

        const maxAllowedForLine = liveProduct.inventory.trackStock
          ? Math.max(1, liveProduct.inventory.stock - otherLinesQty)
          : 99;

        const clampedQty = Math.min(nextQuantity, maxAllowedForLine);
        return prev.map((line) =>
          line.uid === uid ? { ...line, quantity: clampedQty } : line
        );
      });
    },
    [products]
  );

  const handleRemoveDraftItem = useCallback((uid: string) => {
    setDraftItems((prev) => prev.filter((item) => item.uid !== uid));
  }, []);

  const handleClearDraftItems = useCallback(() => {
    setDraftItems([]);
  }, []);

  const handleResetDemoInventory = useCallback(() => {
    setStockOverrides({});
    setProductOverrides({});
    setGlobalDateExceptions(GLOBAL_DATE_EXCEPTIONS);
    appendAudit({
      scope: 'catalogo',
      entityId: 'CATÁLOGO',
      entityLabel: 'Catálogo completo',
      action: 'Restablecimiento demo',
      details: 'Se restablecieron precios, existencias y excepciones de fecha a valores base.',
    });
  }, [appendAudit]);

  const handleLoadMandatoryExampleCart = useCallback((): { ok: boolean; message?: string } => {
    const omelet = products.find((p) => p.id === 'omelet-jamon-queso');
    if (!omelet || omelet.priceMxn === null) {
      return { ok: false, message: 'No se encontró el platillo de ejemplo en el catálogo.' };
    }
    if (omelet.inventory.trackStock && omelet.inventory.stock < 2) {
      return {
        ok: false,
        message: `El platillo "${omelet.name}" solo tiene ${omelet.inventory.stock} existencias disponibles. Restablece el inventario demo desde Administración para volver a probar.`,
      };
    }
    const targetDate =
      getDayOfWeekFromIso(selectedDateIso) === 0
        ? addDaysToIso(selectedDateIso, 1)
        : selectedDateIso;

    setDraftItems([
      {
        uid: `example-${Date.now()}`,
        productId: omelet.id,
        productName: omelet.name,
        unitPriceMxn: omelet.priceMxn,
        quantity: 2,
        scheduledDateIso: targetDate,
        selectedCustomizations: [],
      },
    ]);
    return { ok: true };
  }, [products, selectedDateIso]);

  const handleConfirmOrder = useCallback(
    (payload: ConfirmOrderPayload): ConfirmOrderResult => {
      if (confirmLockRef.current) {
        return {
          ok: false,
          errors: ['Tu pedido está siendo procesado. Espera un instante para evitar duplicados.'],
        };
      }

      const cachedOrder = processedIdempotencyKeysRef.current.get(payload.idempotencyKey);
      if (cachedOrder) {
        return { ok: true, order: cachedOrder };
      }

      const duplicateOrder = demoOrders.find(
        (existing) => existing.idempotencyKey === payload.idempotencyKey
      );
      if (duplicateOrder) {
        processedIdempotencyKeysRef.current.set(payload.idempotencyKey, duplicateOrder);
        return { ok: true, order: duplicateOrder };
      }

      confirmLockRef.current = true;
      try {
        const errors: string[] = [];

        if (draftItems.length === 0) {
          errors.push('No hay productos en el carrito para confirmar.');
        }

        if (getDayOfWeekFromIso(payload.scheduledDateIso) === 0) {
          errors.push('Los domingos Nutricious H&D está cerrado.');
        }

        const slotCap = evaluateSlotCapacity({
          dateIso: payload.scheduledDateIso,
          timeSlot: payload.timeSlot,
          capacityConfig,
          demoOrders,
          globalDateExceptions,
        });
        if (!slotCap.canBook) {
          errors.push(
            `La franja ${payload.timeSlot} para ${formatSpanishDateLabel(
              payload.scheduledDateIso
            )} no está disponible (${slotCap.blockReason || slotCap.statusLabel}).`
          );
        }

        if (
          payload.fulfillmentMode === 'delivery' &&
          payload.distanceKm > TURBO_MANDADOS_RULES.maxCoverageKm
        ) {
          errors.push(
            `La distancia (${payload.distanceKm} km) supera la cobertura máxima de ${TURBO_MANDADOS_RULES.maxCoverageKm} km.`
          );
        }

        const requestedQtyByProduct = new Map<string, number>();
        for (const item of draftItems) {
          requestedQtyByProduct.set(
            item.productId,
            (requestedQtyByProduct.get(item.productId) ?? 0) + item.quantity
          );
        }

        const liveProductMap = new Map<string, Product>();
        for (const p of products) {
          liveProductMap.set(p.id, p);
        }

        const snapshotItems: OrderLineSnapshot[] = [];

        for (const item of draftItems) {
          const liveProduct = liveProductMap.get(item.productId);
          if (!liveProduct || !liveProduct.admin.active) {
            errors.push(`"${item.productName}" ya no está activo en el catálogo.`);
            continue;
          }

          if (liveProduct.priceMxn === null) {
            errors.push(`"${liveProduct.name}" tiene precio pendiente de confirmación.`);
            continue;
          }

          if (liveProduct.priceMxn !== item.unitPriceMxn) {
            errors.push(
              `El precio de "${liveProduct.name}" cambió de ${formatCentsMXN(
                mxnToCents(item.unitPriceMxn)
              )} a ${formatCentsMXN(mxnToCents(liveProduct.priceMxn))}.`
            );
            continue;
          }

          const availability = evaluateProductAvailability(
            liveProduct,
            payload.scheduledDateIso,
            globalDateExceptions
          );
          if (!availability.canOrder) {
            errors.push(
              `"${liveProduct.name}" no está disponible para ${formatSpanishDateLabel(
                payload.scheduledDateIso
              )}: ${availability.reason || availability.statusLabel}`
            );
            continue;
          }

          for (const group of liveProduct.customizations) {
            if (!group.required) continue;
            const selected = item.selectedCustomizations.find(
              (c) => c.groupId === group.id
            );
            const count = selected ? selected.optionIds.length : 0;
            if (count < group.minSelect || count > group.maxSelect) {
              errors.push(
                `"${liveProduct.name}" requiere completar la opción obligatoria "${group.label}".`
              );
            }
          }

          const appliedUnitPriceCents = mxnToCents(liveProduct.priceMxn);
          snapshotItems.push({
            uid: item.uid,
            productId: liveProduct.id,
            sku: liveProduct.admin.sku,
            productName: liveProduct.name,
            quantity: item.quantity,
            appliedUnitPriceCents,
            lineTotalCents: appliedUnitPriceCents * item.quantity,
            scheduledDateIso: payload.scheduledDateIso,
            selectedCustomizations: item.selectedCustomizations,
          });
        }

        for (const [productId, reqQty] of requestedQtyByProduct.entries()) {
          const liveProduct = liveProductMap.get(productId);
          if (!liveProduct) continue;
          if (liveProduct.inventory.manuallyOutOfStock) {
            errors.push(`"${liveProduct.name}" está marcado como agotado.`);
          } else if (liveProduct.inventory.trackStock && reqQty > liveProduct.inventory.stock) {
            errors.push(
              `Existencias insuficientes de "${liveProduct.name}": pediste ${reqQty} y hay ${liveProduct.inventory.stock}.`
            );
          }
        }

        if (errors.length > 0) {
          return { ok: false, errors };
        }

        const subtotalCents = snapshotItems.reduce((sum, line) => sum + line.lineTotalCents, 0);
        const breakdown = calculateOrderBreakdownCents({
          subtotalCents,
          fulfillmentMode: payload.fulfillmentMode,
          distanceKm: payload.distanceKm,
        });

        if (!breakdown.covered || breakdown.totalCents === null) {
          return {
            ok: false,
            errors: ['El pedido no cumple con las reglas de cobertura a domicilio.'],
          };
        }

        const paymentStatusMap: Record<ConfirmOrderPayload['paymentMethod'], OrderPaymentStatus> = {
          card: 'Pagado (demo)',
          transfer: 'Pendiente de validación',
          cash: 'Pago al recibir / en caja',
          whatsapp: 'Por coordinar por WhatsApp',
        };

        const deliveryStatusMap: Record<
          ConfirmOrderPayload['fulfillmentMode'],
          OrderDeliveryStatus
        > = {
          delivery: 'Por asignar (Turbo Mandados)',
          pickup: 'Listo para recoger en tienda',
          dine_in: 'Servicio en mesa',
        };

        const now = new Date();
        const compactDate = payload.scheduledDateIso.replace(/-/g, '').slice(2);
        const seq = String(demoOrders.length + 1).padStart(3, '0');
        const suffix = String(now.getTime()).slice(-3);
        const folio = `NUT-${compactDate}-${seq}${suffix}`;

        const createdAtDisplay = formatNowMeridaDisplay(now);

        const orderWithoutSummary: Omit<DemoOrder, 'whatsappSummaryText'> = {
          folio,
          idempotencyKey: payload.idempotencyKey,
          orderType: 'a_la_carta',
          createdAtIso: now.toISOString(),
          createdAtDisplay,
          scheduledDateIso: payload.scheduledDateIso,
          timeSlot: payload.timeSlot,
          fulfillmentMode: payload.fulfillmentMode,
          distanceKm: payload.fulfillmentMode === 'delivery' ? payload.distanceKm : null,
          paymentMethod: payload.paymentMethod,
          paymentStatus: paymentStatusMap[payload.paymentMethod],
          prepStatus: 'Confirmado',
          deliveryStatus: deliveryStatusMap[payload.fulfillmentMode],
          customer: payload.customer,
          items: snapshotItems,
          pricingSnapshot: {
            subtotalCents: breakdown.subtotalCents,
            serviceFeeCents: breakdown.serviceFeeCents,
            deliveryFeeCents: breakdown.deliveryFeeCents,
            totalCents: breakdown.totalCents,
            serviceFeeRate: breakdown.serviceFeeApplied
              ? TURBO_MANDADOS_RULES.serviceFeeRate
              : 0,
            deliveryRuleNote:
              payload.fulfillmentMode === 'delivery'
                ? 'Regla provisional demo: $30.00 MXN hasta 3 km + $6.00 MXN proporcional por fracción de km adicional (máx. 13 km).'
                : 'Sin cargo de envío ni cuota de servicio en tienda/restaurante.',
          },
        };

        const newOrder: DemoOrder = {
          ...orderWithoutSummary,
          whatsappSummaryText: buildWhatsappSummaryText(orderWithoutSummary),
        };

        processedIdempotencyKeysRef.current.set(payload.idempotencyKey, newOrder);

        // Descuento único de existencias al confirmar el pedido
        setStockOverrides((prev) => {
          const next = { ...prev };
          for (const [productId, reqQty] of requestedQtyByProduct.entries()) {
            const liveProduct = liveProductMap.get(productId);
            if (liveProduct && liveProduct.inventory.trackStock) {
              const currentStock =
                typeof next[productId] === 'number'
                  ? next[productId]
                  : liveProduct.inventory.stock;
              next[productId] = Math.max(0, currentStock - reqQty);
            }
          }
          return next;
        });

        setDemoOrders((prev) => [newOrder, ...prev]);
        setDraftItems([]);

        appendAudit({
          scope: 'pedido',
          entityId: newOrder.folio,
          entityLabel: newOrder.customer.customerName,
          action: 'Pedido confirmado (tienda)',
          details: `Total ${formatCentsMXN(newOrder.pricingSnapshot.totalCents)} · ${newOrder.scheduledDateIso} (${newOrder.timeSlot}) · Pago: ${newOrder.paymentStatus}`,
        });

        return { ok: true, order: newOrder };
      } finally {
        confirmLockRef.current = false;
      }
    },
    [appendAudit, capacityConfig, demoOrders, draftItems, globalDateExceptions, products]
  );

  const handleConfirmWeeklyPlan = useCallback(
    (payload: ConfirmWeeklyPlanPayload): ConfirmWeeklyPlanResult => {
      if (confirmLockRef.current) {
        return {
          ok: false,
          errors: ['Tu plan está siendo procesado. Espera un instante para evitar duplicados.'],
        };
      }

      const cachedPlan = processedPlanIdempotencyKeysRef.current.get(payload.idempotencyKey);
      if (cachedPlan) {
        return { ok: true, plan: cachedPlan };
      }

      const existingPlan = weeklyPlans.find(
        (p) => p.idempotencyKey === payload.idempotencyKey
      );
      if (existingPlan) {
        processedPlanIdempotencyKeysRef.current.set(payload.idempotencyKey, existingPlan);
        return { ok: true, plan: existingPlan };
      }

      confirmLockRef.current = true;
      try {
        const errors: string[] = [];
        const template = planTemplates.find((t) => t.id === payload.templateId);
        if (!template || !template.active) {
          return { ok: false, errors: ['El paquete ilustrativo seleccionado no está activo.'] };
        }

        const liveProductMap = new Map<string, Product>();
        for (const p of products) {
          liveProductMap.set(p.id, p);
        }

        const requestedQtyByProduct = new Map<string, number>();
        const slotCountInPlan = new Map<string, number>();
        const hasAnyDelivery = payload.days.some((d) => d.fulfillmentMode === 'delivery');

        if (hasAnyDelivery && payload.distanceKm > TURBO_MANDADOS_RULES.maxCoverageKm) {
          errors.push(
            `La distancia (${payload.distanceKm} km) supera la cobertura máxima de ${TURBO_MANDADOS_RULES.maxCoverageKm} km.`
          );
        }

        for (const day of payload.days) {
          if (getDayOfWeekFromIso(day.scheduledDateIso) === 0) {
            errors.push(`Día ${day.dayIndex}: los domingos Nutricious H&D está cerrado.`);
          }

          const slotKey = getSlotRuleKey(day.scheduledDateIso, day.timeSlot);
          const countForSlotInPlan = (slotCountInPlan.get(slotKey) ?? 0) + 1;
          slotCountInPlan.set(slotKey, countForSlotInPlan);

          const slotSnap = evaluateSlotCapacity({
            dateIso: day.scheduledDateIso,
            timeSlot: day.timeSlot,
            capacityConfig,
            demoOrders,
            globalDateExceptions,
            pendingAdditionalPlans: countForSlotInPlan - 1,
          });
          if (!slotSnap.canBook) {
            errors.push(
              `Día ${day.dayIndex} (${day.scheduledDateIso} · ${day.timeSlot}): ${
                slotSnap.blockReason || slotSnap.statusLabel
              }.`
            );
          }

          for (const mealSlot of template.mealSlots) {
            const picked = day.selections[mealSlot.id];
            if (!picked || !picked.productId) {
              errors.push(`Día ${day.dayIndex}: selecciona un platillo para "${mealSlot.label}".`);
              continue;
            }
            const prod = liveProductMap.get(picked.productId);
            if (!prod || !prod.admin.active || prod.priceMxn === null) {
              errors.push(`Día ${day.dayIndex}: "${picked.productId}" no está disponible en catálogo.`);
              continue;
            }
            if (!mealSlot.allowedCategories.includes(prod.category)) {
              errors.push(
                `Día ${day.dayIndex}: "${prod.name}" no pertenece a las categorías elegibles de "${mealSlot.label}".`
              );
              continue;
            }
            const avail = evaluateProductAvailability(
              prod,
              day.scheduledDateIso,
              globalDateExceptions
            );
            if (!avail.canOrder) {
              errors.push(
                `Día ${day.dayIndex} (${prod.name}): ${avail.reason || avail.statusLabel}.`
              );
            }
            for (const group of prod.customizations) {
              if (!group.required) continue;
              const sel = picked.selectedCustomizations.find((c) => c.groupId === group.id);
              const count = sel ? sel.optionIds.length : 0;
              if (count < group.minSelect || count > group.maxSelect) {
                errors.push(
                  `Día ${day.dayIndex} (${prod.name}): completa "${group.label}".`
                );
              }
            }
            requestedQtyByProduct.set(
              prod.id,
              (requestedQtyByProduct.get(prod.id) ?? 0) + 1
            );
          }
        }

        for (const [productId, reqQty] of requestedQtyByProduct.entries()) {
          const prod = liveProductMap.get(productId);
          if (!prod) continue;
          if (prod.inventory.trackStock && reqQty > prod.inventory.stock) {
            errors.push(
              `Existencias insuficientes para "${prod.name}": el plan requiere ${reqQty} unidades en la semana y hay ${prod.inventory.stock}.`
            );
          }
        }

        if (errors.length > 0) {
          return { ok: false, errors };
        }

        const pricingInputs = payload.days.map((day) => {
          let dishSumCents = 0;
          for (const mealSlot of template.mealSlots) {
            const picked = day.selections[mealSlot.id];
            const prod = picked ? liveProductMap.get(picked.productId) : undefined;
            if (prod && prod.priceMxn !== null) {
              dishSumCents += mxnToCents(prod.priceMxn);
            }
          }
          return {
            dayIndex: day.dayIndex,
            fulfillmentMode: day.fulfillmentMode,
            dishSumCents,
          };
        });

        const planPricing = calculateWeeklyPlanPricing({
          template,
          days: pricingInputs,
          distanceKm: payload.distanceKm,
        });

        if (!planPricing.covered) {
          return {
            ok: false,
            errors: [planPricing.reason || 'El plan no cumple cobertura de entrega.'],
          };
        }

        const paymentStatusMap: Record<ConfirmWeeklyPlanPayload['paymentMethod'], OrderPaymentStatus> = {
          card: 'Pagado (demo)',
          transfer: 'Pendiente de validación',
          cash: 'Pago al recibir / en caja',
          whatsapp: 'Por coordinar por WhatsApp',
        };

        const now = new Date();
        const compactDate = payload.startDateIso.replace(/-/g, '').slice(2);
        const seq = String(weeklyPlans.length + 1).padStart(3, '0');
        const suffix = String(now.getTime()).slice(-3);
        const planFolio = `PLAN-${compactDate}-${seq}${suffix}`;
        const createdAtDisplay = formatNowMeridaDisplay(now);

        const dailyOrdersToInsert: DemoOrder[] = [];
        const calendarEntries: PlanDayCalendarEntry[] = [];

        payload.days.forEach((day, idx) => {
          const alloc = planPricing.perDayAllocations[idx];
          const dailyFolio = `NUT-${compactDate}-${seq}${suffix}-D${day.dayIndex}`;
          const lines: OrderLineSnapshot[] = [];

          for (const mealSlot of template.mealSlots) {
            const picked = day.selections[mealSlot.id];
            if (!picked) continue;
            const prod = liveProductMap.get(picked.productId)!;
            const unitCents = mxnToCents(prod.priceMxn ?? 0);
            lines.push({
              uid: `${dailyFolio}-${mealSlot.id}`,
              productId: prod.id,
              sku: prod.admin.sku,
              productName: prod.name,
              quantity: 1,
              appliedUnitPriceCents: unitCents,
              lineTotalCents: unitCents,
              scheduledDateIso: day.scheduledDateIso,
              selectedCustomizations: picked.selectedCustomizations,
            });
          }

          const deliveryStatus: OrderDeliveryStatus =
            day.fulfillmentMode === 'delivery'
              ? 'Por asignar (Turbo Mandados)'
              : 'Listo para recoger en tienda';

          const orderWithoutSummary: Omit<DemoOrder, 'whatsappSummaryText'> = {
            folio: dailyFolio,
            idempotencyKey: `${payload.idempotencyKey}-D${day.dayIndex}`,
            orderType: 'plan_semanal',
            planPurchaseFolio: planFolio,
            planName: template.name,
            planDayIndex: day.dayIndex,
            planTotalDays: payload.days.length,
            createdAtIso: now.toISOString(),
            createdAtDisplay,
            scheduledDateIso: day.scheduledDateIso,
            timeSlot: day.timeSlot,
            fulfillmentMode: day.fulfillmentMode,
            distanceKm: day.fulfillmentMode === 'delivery' ? payload.distanceKm : null,
            paymentMethod: payload.paymentMethod,
            paymentStatus: paymentStatusMap[payload.paymentMethod],
            prepStatus: 'Confirmado',
            deliveryStatus,
            customer: payload.customer,
            items: lines,
            pricingSnapshot: {
              subtotalCents: alloc.allocatedFoodCents,
              serviceFeeCents: alloc.allocatedServiceFeeCents,
              deliveryFeeCents: alloc.allocatedDeliveryFeeCents,
              totalCents: alloc.allocatedTotalCents,
              serviceFeeRate:
                alloc.allocatedServiceFeeCents > 0 ? TURBO_MANDADOS_RULES.serviceFeeRate : 0,
              deliveryRuleNote:
                day.fulfillmentMode === 'delivery'
                  ? `Orden diaria ${day.dayIndex}/${payload.days.length} de ${planFolio} (cuota 4% distribuida en centavos).`
                  : `Orden diaria ${day.dayIndex}/${payload.days.length} de ${planFolio} para recoger en tienda.`,
            },
          };

          dailyOrdersToInsert.push({
            ...orderWithoutSummary,
            whatsappSummaryText: buildWhatsappSummaryText(orderWithoutSummary),
          });

          calendarEntries.push({
            dayIndex: day.dayIndex,
            dailyOrderFolio: dailyFolio,
            scheduledDateIso: day.scheduledDateIso,
            timeSlot: day.timeSlot,
            fulfillmentMode: day.fulfillmentMode,
            allocatedFoodCents: alloc.allocatedFoodCents,
            allocatedServiceFeeCents: alloc.allocatedServiceFeeCents,
            allocatedDeliveryFeeCents: alloc.allocatedDeliveryFeeCents,
            allocatedTotalCents: alloc.allocatedTotalCents,
            rescheduleCount: 0,
          });
        });

        const calendarSummaryLines = calendarEntries
          .map(
            (c) =>
              `- Día ${c.dayIndex} (${c.scheduledDateIso} ${c.timeSlot}) · ${
                c.fulfillmentMode === 'delivery' ? 'Domicilio' : 'Recoger'
              } · ${c.dailyOrderFolio} — ${formatCentsMXN(c.allocatedTotalCents)}`
          )
          .join('\n');

        const whatsappPlanSummary = [
          `*Nutricious H&D — Plan Semanal Demo ${planFolio}*`,
          `Paquete ilustrativo: ${template.name} (${payload.days.length} días)`,
          `Cliente: ${payload.customer.customerName} · Tel: ${payload.customer.customerPhone}`,
          hasAnyDelivery ? `Dirección: ${payload.customer.address}` : 'Modalidad: Recoger en tienda',
          '',
          '*Calendario de órdenes diarias independientes:*',
          calendarSummaryLines,
          '',
          `Alimentos del plan: ${formatCentsMXN(planPricing.foodSubtotalCents)}`,
          `Cuota de servicio (4% una vez sobre alimentos): ${formatCentsMXN(planPricing.serviceFeeCents)}`,
          `Envíos contratados (${planPricing.contractedDeliveriesCount}): ${formatCentsMXN(
            planPricing.deliveryTotalCents
          )}`,
          `*Total del plan: ${formatCentsMXN(planPricing.totalCents)} MXN*`,
          `Pago: ${paymentStatusMap[payload.paymentMethod]}`,
        ].join('\n');

        const newPlan: WeeklyPlanPurchase = {
          planFolio,
          idempotencyKey: payload.idempotencyKey,
          templateId: template.id,
          templateName: template.name,
          isIllustrativeExample: template.isIllustrativeExample,
          foodPricingMode: template.foodPricingMode,
          createdAtIso: now.toISOString(),
          createdAtDisplay,
          startDateIso: payload.startDateIso,
          totalDays: payload.days.length,
          distanceKm: hasAnyDelivery ? payload.distanceKm : null,
          paymentMethod: payload.paymentMethod,
          paymentStatus: paymentStatusMap[payload.paymentMethod],
          customer: payload.customer,
          pricingSnapshot: {
            foodSubtotalCents: planPricing.foodSubtotalCents,
            serviceFeeCents: planPricing.serviceFeeCents,
            deliveryTotalCents: planPricing.deliveryTotalCents,
            totalCents: planPricing.totalCents,
            serviceFeeRate:
              planPricing.serviceFeeCents > 0 ? TURBO_MANDADOS_RULES.serviceFeeRate : 0,
            contractedDeliveriesCount: planPricing.contractedDeliveriesCount,
            pricingRuleNote:
              'Cuota del 4% calculada una sola vez sobre los alimentos del plan y distribuida en centavos exactos entre las órdenes diarias.',
          },
          days: calendarEntries,
          whatsappSummaryText: whatsappPlanSummary,
        };

        processedPlanIdempotencyKeysRef.current.set(payload.idempotencyKey, newPlan);

        setStockOverrides((prev) => {
          const next = { ...prev };
          for (const [productId, reqQty] of requestedQtyByProduct.entries()) {
            const prod = liveProductMap.get(productId);
            if (prod && prod.inventory.trackStock) {
              const currentStock =
                typeof next[productId] === 'number' ? next[productId] : prod.inventory.stock;
              next[productId] = Math.max(0, currentStock - reqQty);
            }
          }
          return next;
        });

        setDemoOrders((prev) => [...dailyOrdersToInsert, ...prev]);
        setWeeklyPlans((prev) => [newPlan, ...prev]);

        appendAudit({
          scope: 'plan',
          entityId: newPlan.planFolio,
          entityLabel: newPlan.customer.customerName,
          action: 'Plan semanal contratado (demo)',
          details: `${newPlan.templateName} (${newPlan.totalDays} días) · Total ${formatCentsMXN(
            newPlan.pricingSnapshot.totalCents
          )} · ${dailyOrdersToInsert.length} órdenes diarias creadas`,
        });

        return { ok: true, plan: newPlan };
      } finally {
        confirmLockRef.current = false;
      }
    },
    [
      appendAudit,
      capacityConfig,
      demoOrders,
      globalDateExceptions,
      planTemplates,
      products,
      weeklyPlans,
    ]
  );

  const handleReschedulePlanDay = useCallback(
    (params: {
      planFolio: string;
      dailyOrderFolio: string;
      newDateIso: string;
      newTimeSlot: string;
    }): { ok: boolean; error?: string } => {
      const targetPlan = weeklyPlans.find((p) => p.planFolio === params.planFolio);
      const targetOrder = demoOrders.find((o) => o.folio === params.dailyOrderFolio);
      if (!targetPlan || !targetOrder) {
        return { ok: false, error: 'No se encontró la orden diaria o el plan.' };
      }

      const reschedGate = canReschedulePlanOrder(targetOrder);
      if (!reschedGate.allowed) {
        return { ok: false, error: reschedGate.reason };
      }

      const dow = getDayOfWeekFromIso(params.newDateIso);
      if (dow === 0) {
        return { ok: false, error: 'Los domingos Nutricious H&D está cerrado.' };
      }
      if (globalDateExceptions[params.newDateIso]) {
        return {
          ok: false,
          error: `La fecha ${params.newDateIso} tiene una excepción: ${globalDateExceptions[params.newDateIso]}.`,
        };
      }

      const liveProductMap = new Map<string, Product>();
      for (const p of products) {
        liveProductMap.set(p.id, p);
      }

      for (const line of targetOrder.items) {
        const prod = liveProductMap.get(line.productId);
        if (!prod || !prod.admin.active) {
          return {
            ok: false,
            error: `"${line.productName}" ya no está activo en el catálogo.`,
          };
        }
        const prodException = prod.availability.dateExceptions?.[params.newDateIso];
        if (prodException && !prodException.available) {
          return {
            ok: false,
            error: `"${prod.name}" no está disponible el ${params.newDateIso}: ${prodException.reason}.`,
          };
        }
        if (!prod.availability.daysOfWeek.includes(dow)) {
          return {
            ok: false,
            error: `"${prod.name}" no se prepara en ese día de la semana.`,
          };
        }
      }

      const slotCap = evaluateSlotCapacity({
        dateIso: params.newDateIso,
        timeSlot: params.newTimeSlot,
        capacityConfig,
        demoOrders,
        globalDateExceptions,
        ignoreOrderFolio: targetOrder.folio,
      });

      if (!slotCap.canBook) {
        return {
          ok: false,
          error: `No hay cupo disponible en ${params.newDateIso} (${params.newTimeSlot}): ${
            slotCap.blockReason || slotCap.statusLabel
          }.`,
        };
      }

      const prevDate = targetOrder.scheduledDateIso;
      const prevSlot = targetOrder.timeSlot;
      const nowDisplay = formatNowMeridaDisplay(new Date());

      setDemoOrders((prev) =>
        prev.map((ord) => {
          if (ord.folio !== targetOrder.folio) return ord;
          const updatedBase: Omit<DemoOrder, 'whatsappSummaryText'> = {
            ...ord,
            scheduledDateIso: params.newDateIso,
            timeSlot: params.newTimeSlot,
            items: ord.items.map((line) => ({ ...line, scheduledDateIso: params.newDateIso })),
          };
          return {
            ...updatedBase,
            whatsappSummaryText: buildWhatsappSummaryText(updatedBase),
          };
        })
      );

      setWeeklyPlans((prev) =>
        prev.map((plan) => {
          if (plan.planFolio !== params.planFolio) return plan;
          return {
            ...plan,
            days: plan.days.map((d) =>
              d.dailyOrderFolio === params.dailyOrderFolio
                ? {
                    ...d,
                    scheduledDateIso: params.newDateIso,
                    timeSlot: params.newTimeSlot,
                    rescheduleCount: d.rescheduleCount + 1,
                    lastRescheduledDisplay: nowDisplay,
                  }
                : d
            ),
          };
        })
      );

      appendAudit({
        scope: 'plan',
        entityId: targetOrder.folio,
        entityLabel: `${targetPlan.planFolio} · ${targetPlan.customer.customerName}`,
        action: 'Día reprogramado',
        details: `${prevDate} (${prevSlot}) → ${params.newDateIso} (${params.newTimeSlot}) · Cupo anterior liberado`,
      });

      return { ok: true };
    },
    [appendAudit, capacityConfig, demoOrders, globalDateExceptions, products, weeklyPlans]
  );

  const handleUpdateDefaultSlotLimit = useCallback(
    (nextLimit: number) => {
      const safe = Math.max(0, Math.min(100, nextLimit));
      setCapacityConfig((prev) => ({
        ...prev,
        defaultSlotLimit: safe,
      }));
      appendAudit({
        scope: 'agenda',
        entityId: 'CAPACIDAD-BASE',
        entityLabel: 'Agenda y cupos',
        action: 'Límite base actualizado',
        details: `Nuevo límite base por franja: ${safe} pedido(s)`,
      });
    },
    [appendAudit]
  );

  const handleUpdateSlotRule = useCallback(
    (params: {
      dateIso: string;
      timeSlot: string;
      limit: number;
      blocked: boolean;
      blockReason?: string;
    }) => {
      const key = getSlotRuleKey(params.dateIso, params.timeSlot);
      setCapacityConfig((prev) => ({
        ...prev,
        slotRules: {
          ...prev.slotRules,
          [key]: {
            limit: Math.max(0, params.limit),
            blocked: params.blocked,
            blockReason: params.blockReason,
          },
        },
      }));
      appendAudit({
        scope: 'agenda',
        entityId: `${params.dateIso} ${params.timeSlot}`,
        entityLabel: 'Franja horaria',
        action: params.blocked ? 'Franja bloqueada' : 'Cupo / franja actualizada',
        details: `Límite: ${params.limit} · ${
          params.blocked ? `Bloqueada (${params.blockReason || 'Sin motivo'})` : 'Habilitada'
        }`,
      });
    },
    [appendAudit]
  );

  const handleUpdatePlanTemplate = useCallback(
    (templateId: string, patch: Partial<ConfigurablePlanTemplate>) => {
      setPlanTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, ...patch } : t))
      );
      appendAudit({
        scope: 'plan',
        entityId: templateId,
        entityLabel: 'Paquete ilustrativo',
        action: 'Configuración de paquete ejemplo actualizada',
        details: Object.keys(patch).join(', '),
      });
    },
    [appendAudit]
  );

  const handleUpdateOrderPrepStatus = useCallback(
    (folio: string, nextStatus: OrderPrepStatus): { ok: boolean; error?: string } => {
      const target = demoOrders.find((o) => o.folio === folio);
      if (!target) {
        return { ok: false, error: 'Pedido no encontrado.' };
      }
      const prevStatus = target.prepStatus;
      setDemoOrders((prev) =>
        prev.map((ord) => (ord.folio === folio ? { ...ord, prepStatus: nextStatus } : ord))
      );
      appendAudit({
        scope: 'cocina',
        entityId: folio,
        entityLabel: target.customer.customerName,
        action: 'Cambio de preparación',
        details: `${prevStatus} → ${nextStatus}`,
      });
      return { ok: true };
    },
    [appendAudit, demoOrders]
  );

  const handleAssignDeliveryTurboDemo = useCallback(
    (folio: string): { ok: boolean; error?: string } => {
      const target = demoOrders.find((o) => o.folio === folio);
      if (!target) {
        return { ok: false, error: 'Pedido no encontrado.' };
      }
      const nowDisplay = formatNowMeridaDisplay(new Date());
      setDemoOrders((prev) =>
        prev.map((ord) => {
          if (ord.folio !== folio) return ord;
          const nextStatus: OrderDeliveryStatus =
            ord.deliveryStatus === 'Por asignar (Turbo Mandados)'
              ? 'Asignado'
              : ord.deliveryStatus;
          return {
            ...ord,
            deliveryStatus: nextStatus,
            deliveryTracking: {
              receivedBy:
                ord.deliveryTracking?.receivedBy ||
                ord.customer.receiverName ||
                ord.customer.customerName,
              deliveryPlace: ord.deliveryTracking?.deliveryPlace || ord.customer.address,
              deliveryDateIso: ord.deliveryTracking?.deliveryDateIso || ord.scheduledDateIso,
              deliveryTime: ord.deliveryTracking?.deliveryTime || '',
              observations: ord.deliveryTracking?.observations || '',
              assignedToTurboDemo: true,
              assignedAtDisplay: nowDisplay,
            },
          };
        })
      );
      appendAudit({
        scope: 'entrega',
        entityId: folio,
        entityLabel: target.customer.customerName,
        action: 'Asignación demostrativa a Turbo Mandados',
        details: `Asignado en modo demo el ${nowDisplay}`,
      });
      return { ok: true };
    },
    [appendAudit, demoOrders]
  );

  const handleUpdateDeliveryStatus = useCallback(
    (
      folio: string,
      nextStatus: OrderDeliveryStatus,
      trackingPatch?: Partial<DeliveryTrackingInfo>
    ): { ok: boolean; error?: string } => {
      const target = demoOrders.find((o) => o.folio === folio);
      if (!target) {
        return { ok: false, error: 'Pedido no encontrado.' };
      }

      const requiresKitchenReady =
        nextStatus === 'Recolectado' ||
        nextStatus === 'En camino' ||
        nextStatus === 'Entregado';

      if (requiresKitchenReady && target.prepStatus !== 'Listo') {
        return {
          ok: false,
          error: `Bloqueado: no se puede marcar "${nextStatus}" en ${folio} porque Cocina aún tiene el pedido en "${target.prepStatus}" (debe estar "Listo").`,
        };
      }

      const prevDelivery = target.deliveryStatus;
      setDemoOrders((prev) =>
        prev.map((ord) => {
          if (ord.folio !== folio) return ord;
          const baseTracking: DeliveryTrackingInfo = ord.deliveryTracking ?? {
            assignedToTurboDemo: nextStatus !== 'Por asignar (Turbo Mandados)',
            receivedBy: ord.customer.receiverName || ord.customer.customerName,
            deliveryPlace: ord.customer.address,
            deliveryDateIso: ord.scheduledDateIso,
            deliveryTime: '',
            observations: '',
          };
          return {
            ...ord,
            deliveryStatus: nextStatus,
            deliveryTracking: {
              ...baseTracking,
              ...trackingPatch,
              assignedToTurboDemo:
                nextStatus === 'Por asignar (Turbo Mandados)'
                  ? baseTracking.assignedToTurboDemo
                  : true,
            },
          };
        })
      );

      const proofParts = trackingPatch
        ? [
            trackingPatch.receivedBy ? `Recibió: ${trackingPatch.receivedBy}` : '',
            trackingPatch.deliveryPlace ? `Lugar: ${trackingPatch.deliveryPlace}` : '',
            trackingPatch.deliveryDateIso
              ? `Fecha/hora: ${trackingPatch.deliveryDateIso} ${trackingPatch.deliveryTime || ''}`
              : '',
            trackingPatch.observations ? `Obs: ${trackingPatch.observations}` : '',
          ].filter(Boolean)
        : [];

      appendAudit({
        scope: 'entrega',
        entityId: folio,
        entityLabel: target.customer.customerName,
        action:
          prevDelivery === nextStatus
            ? 'Actualización de recepción'
            : `Estado entrega: ${nextStatus}`,
        details: [`${prevDelivery} → ${nextStatus}`, ...proofParts].join(' · '),
      });

      return { ok: true };
    },
    [appendAudit, demoOrders]
  );

  const handleUpdateProductAdmin = useCallback(
    (
      productId: string,
      updater: (prev: Product) => Product,
      auditAction: string,
      auditDetails: string
    ) => {
      const currentProduct = products.find((p) => p.id === productId);
      if (!currentProduct) return;
      const updated = updater(currentProduct);

      setProductOverrides((prev) => ({
        ...prev,
        [productId]: updated,
      }));

      setStockOverrides((prev) => {
        if (updated.inventory.stock !== currentProduct.inventory.stock) {
          return { ...prev, [productId]: updated.inventory.stock };
        }
        return prev;
      });

      appendAudit({
        scope: 'catalogo',
        entityId: updated.admin.sku,
        entityLabel: updated.name,
        action: auditAction,
        details: auditDetails,
      });
    },
    [appendAudit, products]
  );

  const handleUpsertGlobalDateException = useCallback(
    (dateIso: string, reason: string) => {
      setGlobalDateExceptions((prev) => ({ ...prev, [dateIso]: reason }));
      appendAudit({
        scope: 'catalogo',
        entityId: dateIso,
        entityLabel: 'Excepción global',
        action: 'Fecha bloqueada en tienda',
        details: reason,
      });
    },
    [appendAudit]
  );

  const handleRemoveGlobalDateException = useCallback(
    (dateIso: string) => {
      setGlobalDateExceptions((prev) => {
        const next = { ...prev };
        delete next[dateIso];
        return next;
      });
      appendAudit({
        scope: 'catalogo',
        entityId: dateIso,
        entityLabel: 'Excepción global',
        action: 'Excepción eliminada',
        details: `Fecha ${dateIso} habilitada nuevamente`,
      });
    },
    [appendAudit]
  );

  const draftCount = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.quantity, 0),
    [draftItems]
  );

  const handleNavigateView = useCallback((view: AppView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleNavigateSection = useCallback((sectionId: string) => {
    setActiveView('inicio');
    window.setTimeout(() => {
      const target = document.getElementById(sectionId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-[#DCE8D2] text-[#193B29]">
        <Navbar
          activeView={activeView}
          draftCount={draftCount}
          onNavigateView={handleNavigateView}
          onNavigateSection={handleNavigateSection}
        />

        <main className="flex-1">
          {activeView === 'inicio' && (
            <>
              <HeroSection onOpenMenu={() => handleNavigateView('menu')} />
              <BrandStorySection onOpenMenu={() => handleNavigateView('menu')} />
              <BenefitsSection />
              <HowItWorksSection />
              <FeaturedDishesSection
                products={products}
                onOpenMenu={() => handleNavigateView('menu')}
              />
              <IllustrativePlansSection
                planTemplates={planTemplates}
                onOpenPlanConfigurator={(templateId) => {
                  setPreselectedPlanTemplateId(templateId ?? null);
                  handleNavigateView('planes');
                }}
              />
              <DeliveryCalculatorSection />
              <FaqSection />
            </>
          )}

          {activeView === 'menu' && (
            <MenuShowcaseSection
              products={products}
              globalDateExceptions={globalDateExceptions}
              selectedDateIso={selectedDateIso}
              onChangeDateIso={setSelectedDateIso}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              draftItems={draftItems}
              onAddDraftItem={handleAddDraftItem}
              onNavigateView={handleNavigateView}
            />
          )}

          {activeView === 'planes' && (
            <WeeklyPlansView
              products={products}
              planTemplates={planTemplates}
              capacityConfig={capacityConfig}
              globalDateExceptions={globalDateExceptions}
              demoOrders={demoOrders}
              weeklyPlans={weeklyPlans}
              selectedDateIso={selectedDateIso}
              initialTemplateId={preselectedPlanTemplateId}
              onConfirmWeeklyPlan={handleConfirmWeeklyPlan}
              onReschedulePlanDay={handleReschedulePlanDay}
              onNavigateView={handleNavigateView}
            />
          )}

          {activeView === 'mi-pedido' && (
            <CartCheckoutView
              products={products}
              globalDateExceptions={globalDateExceptions}
              capacityConfig={capacityConfig}
              draftItems={draftItems}
              selectedDateIso={selectedDateIso}
              onChangeDateIso={setSelectedDateIso}
              onUpdateItemQuantity={handleUpdateDraftItemQuantity}
              onRemoveDraftItem={handleRemoveDraftItem}
              onClearDraftItems={handleClearDraftItems}
              onLoadMandatoryExampleCart={handleLoadMandatoryExampleCart}
              onConfirmOrder={handleConfirmOrder}
              demoOrders={demoOrders}
              onNavigateView={handleNavigateView}
            />
          )}

          {activeView === 'mi-cuenta' && (
            <PendingModuleView
              view="mi-cuenta"
              products={products}
              demoOrders={demoOrders}
              onResetDemoInventory={handleResetDemoInventory}
              onNavigateView={handleNavigateView}
            />
          )}

          {activeView === 'admin' && (
            <AdminDashboardView
              products={products}
              globalDateExceptions={globalDateExceptions}
              demoOrders={demoOrders}
              weeklyPlans={weeklyPlans}
              planTemplates={planTemplates}
              capacityConfig={capacityConfig}
              auditLog={auditLog}
              onUpdateOrderPrepStatus={handleUpdateOrderPrepStatus}
              onAssignDeliveryTurboDemo={handleAssignDeliveryTurboDemo}
              onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
              onUpdateProductAdmin={handleUpdateProductAdmin}
              onUpsertGlobalDateException={handleUpsertGlobalDateException}
              onRemoveGlobalDateException={handleRemoveGlobalDateException}
              onResetDemoCatalogOverrides={handleResetDemoInventory}
              onUpdateDefaultSlotLimit={handleUpdateDefaultSlotLimit}
              onUpdateSlotRule={handleUpdateSlotRule}
              onUpdatePlanTemplate={handleUpdatePlanTemplate}
              onReschedulePlanDay={handleReschedulePlanDay}
              onNavigateView={handleNavigateView}
            />
          )}
        </main>

        <FooterSection
          onNavigateView={handleNavigateView}
          onNavigateSection={handleNavigateSection}
        />

        <MobileBottomBar
          activeView={activeView}
          draftCount={draftCount}
          onSelectView={handleNavigateView}
        />
      </div>
    </MotionConfig>
  );
}
