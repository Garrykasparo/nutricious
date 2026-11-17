import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Info,
  MapPin,
  Sparkles,
  Store,
  Truck,
  UtensilsCrossed,
} from 'lucide-react';
import type {
  CapacityScheduleConfig,
  ConfigurablePlanTemplate,
  CustomerCheckoutInfo,
  DemoOrder,
  DemoPaymentMethod,
  Product,
  SelectedCustomization,
  WeeklyPlanPurchase,
} from '../types/product';
import {
  buildDefaultPlanDates,
  calculateWeeklyPlanPricing,
  evaluateSlotCapacity,
  findFirstOpenTimeSlot,
} from '../utils/capacityAndPlans';
import {
  evaluateProductAvailability,
  formatSpanishDateLabel,
  getDayOfWeekFromIso,
} from '../utils/meridaDate';
import {
  DELIVERY_TIME_SLOTS,
  formatCentsMXN,
  mxnToCents,
  TURBO_MANDADOS_RULES,
} from '../utils/pricing';
import type { AppView } from './MobileBottomBar';
import { WeeklyPlanCalendarPanel } from './WeeklyPlanCalendarPanel';

export interface PlanDaySelectionDraft {
  dayIndex: number;
  scheduledDateIso: string;
  timeSlot: string;
  fulfillmentMode: 'delivery' | 'pickup';
  /** Map keyed by mealSlot.id */
  selections: Record<
    string,
    {
      productId: string;
      selectedCustomizations: SelectedCustomization[];
    }
  >;
}

export interface ConfirmWeeklyPlanPayload {
  idempotencyKey: string;
  templateId: string;
  startDateIso: string;
  distanceKm: number;
  paymentMethod: DemoPaymentMethod;
  customer: CustomerCheckoutInfo;
  days: PlanDaySelectionDraft[];
}

export interface ConfirmWeeklyPlanResult {
  ok: boolean;
  plan?: WeeklyPlanPurchase;
  errors?: string[];
}

interface WeeklyPlansViewProps {
  products: Product[];
  planTemplates: ConfigurablePlanTemplate[];
  capacityConfig: CapacityScheduleConfig;
  globalDateExceptions: Record<string, string>;
  demoOrders: DemoOrder[];
  weeklyPlans: WeeklyPlanPurchase[];
  selectedDateIso: string;
  initialTemplateId?: string | null;
  onConfirmWeeklyPlan: (payload: ConfirmWeeklyPlanPayload) => ConfirmWeeklyPlanResult;
  onReschedulePlanDay: (params: {
    planFolio: string;
    dailyOrderFolio: string;
    newDateIso: string;
    newTimeSlot: string;
  }) => { ok: boolean; error?: string };
  onNavigateView: (view: AppView) => void;
}

function createPlanIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const INITIAL_CUSTOMER: CustomerCheckoutInfo = {
  customerName: '',
  customerPhone: '',
  address: '',
  references: '',
  isSpecialLocation: false,
  building: '',
  hospital: '',
  area: '',
  receiverName: '',
  tableNumber: '',
  cashPaidWith: '',
  orderNotes: '',
};

const PAYMENT_OPTIONS: Array<{ id: DemoPaymentMethod; label: string; helper: string }> = [
  { id: 'card', label: 'Tarjeta (simulada)', helper: 'Autorización inmediata en modo demo.' },
  {
    id: 'transfer',
    label: 'Transferencia SPEI (demo)',
    helper: 'Queda pendiente de validación administrativa.',
  },
  { id: 'cash', label: 'Efectivo', helper: 'Pago al recibir o en caja.' },
  {
    id: 'whatsapp',
    label: 'Coordinar por WhatsApp',
    helper: 'Genera resumen listo para copiar (sin envío automático).',
  },
];

function buildDefaultCustomizationsForProduct(product: Product): SelectedCustomization[] {
  const result: SelectedCustomization[] = [];
  for (const group of product.customizations) {
    if (!group.required || group.minSelect <= 0) continue;
    const picks = group.options.slice(0, group.minSelect);
    if (picks.length === group.minSelect) {
      result.push({
        groupId: group.id,
        groupLabel: group.label,
        optionIds: picks.map((o) => o.id),
        optionLabels: picks.map((o) => o.label),
      });
    }
  }
  return result;
}

export function WeeklyPlansView({
  products,
  planTemplates,
  capacityConfig,
  globalDateExceptions,
  demoOrders,
  weeklyPlans,
  selectedDateIso,
  initialTemplateId,
  onConfirmWeeklyPlan,
  onReschedulePlanDay,
  onNavigateView,
}: WeeklyPlansViewProps) {
  const activeTemplates = useMemo(
    () => planTemplates.filter((t) => t.active),
    [planTemplates]
  );

  const [subTab, setSubTab] = useState<'configurator' | 'active'>('configurator');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    () =>
      (initialTemplateId && activeTemplates.find((t) => t.id === initialTemplateId)?.id) ||
      activeTemplates[0]?.id ||
      'plan-mananas'
  );

  useEffect(() => {
    if (initialTemplateId && activeTemplates.some((t) => t.id === initialTemplateId)) {
      setSelectedTemplateId(initialTemplateId);
      setSubTab('configurator');
    }
  }, [initialTemplateId, activeTemplates]);

  const currentTemplate = useMemo(
    () => activeTemplates.find((t) => t.id === selectedTemplateId) ?? activeTemplates[0],
    [activeTemplates, selectedTemplateId]
  );

  const [startDateIso, setStartDateIso] = useState<string>(selectedDateIso);
  const [daysCount, setDaysCount] = useState<number>(
    currentTemplate?.defaultDaysCount ?? 5
  );
  const [defaultFulfillment, setDefaultFulfillment] = useState<'delivery' | 'pickup'>(
    'delivery'
  );
  const [distanceKm, setDistanceKm] = useState<number>(5);
  const [paymentMethod, setPaymentMethod] = useState<DemoPaymentMethod>('card');
  const [customer, setCustomer] = useState<CustomerCheckoutInfo>(INITIAL_CUSTOMER);
  const [dayDrafts, setDayDrafts] = useState<PlanDaySelectionDraft[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    createPlanIdempotencyKey()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [newlyCreatedPlanFolio, setNewlyCreatedPlanFolio] = useState<string | null>(null);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  const generateDraftDays = (params: {
    template: ConfigurablePlanTemplate;
    startIso: string;
    count: number;
    mode: 'delivery' | 'pickup';
  }): PlanDaySelectionDraft[] => {
    const dates = buildDefaultPlanDates({
      startDateIso: params.startIso,
      daysCount: params.count,
      allowedWeekdays: params.template.allowedWeekdays,
      globalDateExceptions,
    });

    return dates.map((dateIso, idx) => {
      const firstOpenSlot = findFirstOpenTimeSlot({
        dateIso,
        capacityConfig,
        demoOrders,
        globalDateExceptions,
      });

      const selections: PlanDaySelectionDraft['selections'] = {};
      for (const mealSlot of params.template.mealSlots) {
        const eligible = products.filter(
          (p) =>
            p.admin.active &&
            p.priceMxn !== null &&
            mealSlot.allowedCategories.includes(p.category) &&
            evaluateProductAvailability(p, dateIso, globalDateExceptions).canOrder
        );
        const pick = eligible[idx % Math.max(1, eligible.length)] ?? eligible[0];
        if (pick) {
          selections[mealSlot.id] = {
            productId: pick.id,
            selectedCustomizations: buildDefaultCustomizationsForProduct(pick),
          };
        }
      }

      return {
        dayIndex: idx + 1,
        scheduledDateIso: dateIso,
        timeSlot: firstOpenSlot,
        fulfillmentMode: params.mode,
        selections,
      };
    });
  };

  useEffect(() => {
    if (!currentTemplate) return;
    setDaysCount(currentTemplate.defaultDaysCount);
    setDayDrafts(
      generateDraftDays({
        template: currentTemplate,
        startIso: startDateIso,
        count: currentTemplate.defaultDaysCount,
        mode: defaultFulfillment,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId]);

  const handleRebuildSchedule = (params: {
    nextStartIso?: string;
    nextCount?: number;
    nextMode?: 'delivery' | 'pickup';
  }) => {
    if (!currentTemplate) return;
    const effectiveStart = params.nextStartIso ?? startDateIso;
    const effectiveCount = params.nextCount ?? daysCount;
    const effectiveMode = params.nextMode ?? defaultFulfillment;
    if (params.nextStartIso !== undefined) setStartDateIso(params.nextStartIso);
    if (params.nextCount !== undefined) setDaysCount(params.nextCount);
    if (params.nextMode !== undefined) setDefaultFulfillment(params.nextMode);

    setDayDrafts(
      generateDraftDays({
        template: currentTemplate,
        startIso: effectiveStart,
        count: effectiveCount,
        mode: effectiveMode,
      })
    );
  };

  const handleApplyGlobalFulfillment = (mode: 'delivery' | 'pickup') => {
    setDefaultFulfillment(mode);
    setDayDrafts((prev) => prev.map((d) => ({ ...d, fulfillmentMode: mode })));
  };

  const pricingPreview = useMemo(() => {
    if (!currentTemplate) return null;
    const dayInputs = dayDrafts.map((day) => {
      let dishSumCents = 0;
      for (const mealSlot of currentTemplate.mealSlots) {
        const picked = day.selections[mealSlot.id];
        if (!picked) continue;
        const prod = productById.get(picked.productId);
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

    return calculateWeeklyPlanPricing({
      template: currentTemplate,
      days: dayInputs,
      distanceKm,
    });
  }, [currentTemplate, dayDrafts, distanceKm, productById]);

  const pendingSlotCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of dayDrafts) {
      const k = `${day.scheduledDateIso}__${day.timeSlot}`;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [dayDrafts]);

  const updateDayField = (
    dayIndex: number,
    patch: Partial<Pick<PlanDaySelectionDraft, 'scheduledDateIso' | 'timeSlot' | 'fulfillmentMode'>>
  ) => {
    setDayDrafts((prev) =>
      prev.map((d) => (d.dayIndex === dayIndex ? { ...d, ...patch } : d))
    );
  };

  const updateDayDish = (dayIndex: number, mealSlotId: string, productId: string) => {
    const prod = productById.get(productId);
    setDayDrafts((prev) =>
      prev.map((d) => {
        if (d.dayIndex !== dayIndex) return d;
        return {
          ...d,
          selections: {
            ...d.selections,
            [mealSlotId]: {
              productId,
              selectedCustomizations: prod ? buildDefaultCustomizationsForProduct(prod) : [],
            },
          },
        };
      })
    );
  };

  const toggleDayDishCustomization = (
    dayIndex: number,
    mealSlotId: string,
    groupId: string,
    groupLabel: string,
    maxSelect: number,
    optionId: string,
    optionLabel: string
  ) => {
    setDayDrafts((prev) =>
      prev.map((d) => {
        if (d.dayIndex !== dayIndex) return d;
        const currentPick = d.selections[mealSlotId];
        if (!currentPick) return d;

        const existingGroup = currentPick.selectedCustomizations.find(
          (g) => g.groupId === groupId
        );
        const currentIds = existingGroup?.optionIds ?? [];
        const currentLabels = existingGroup?.optionLabels ?? [];

        let nextIds: string[];
        let nextLabels: string[];

        if (maxSelect === 1) {
          nextIds = [optionId];
          nextLabels = [optionLabel];
        } else if (currentIds.includes(optionId)) {
          const idx = currentIds.indexOf(optionId);
          nextIds = currentIds.filter((_, i) => i !== idx);
          nextLabels = currentLabels.filter((_, i) => i !== idx);
        } else {
          if (currentIds.length >= maxSelect) {
            return d;
          }
          nextIds = [...currentIds, optionId];
          nextLabels = [...currentLabels, optionLabel];
        }

        const otherGroups = currentPick.selectedCustomizations.filter(
          (g) => g.groupId !== groupId
        );
        const nextCustomizations =
          nextIds.length > 0
            ? [
                ...otherGroups,
                {
                  groupId,
                  groupLabel,
                  optionIds: nextIds,
                  optionLabels: nextLabels,
                },
              ]
            : otherGroups;

        return {
          ...d,
          selections: {
            ...d.selections,
            [mealSlotId]: {
              ...currentPick,
              selectedCustomizations: nextCustomizations,
            },
          },
        };
      })
    );
  };

  const handleSubmitPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !currentTemplate) return;

    const errors: string[] = [];
    const hasAnyDelivery = dayDrafts.some((d) => d.fulfillmentMode === 'delivery');

    if (hasAnyDelivery && distanceKm > TURBO_MANDADOS_RULES.maxCoverageKm) {
      errors.push(
        `La distancia (${distanceKm} km) supera la cobertura máxima de ${TURBO_MANDADOS_RULES.maxCoverageKm} km de Turbo Mandados. Cambia a "Recoger en tienda" para continuar.`
      );
    }
    if (!customer.customerName.trim()) {
      errors.push('Ingresa el nombre completo del cliente.');
    }
    if (!customer.customerPhone.trim() || customer.customerPhone.replace(/\D/g, '').length < 8) {
      errors.push('Ingresa un teléfono de contacto válido (al menos 8 dígitos).');
    }
    if (hasAnyDelivery) {
      if (!customer.address.trim()) {
        errors.push('Ingresa la dirección de entrega en Mérida para los días a domicilio.');
      }
      if (!customer.references.trim()) {
        errors.push('Agrega referencias de entrega para Turbo Mandados.');
      }
    }

    for (const day of dayDrafts) {
      if (getDayOfWeekFromIso(day.scheduledDateIso) === 0) {
        errors.push(`Día ${day.dayIndex}: los domingos Nutricious H&D está cerrado.`);
      }
      for (const mealSlot of currentTemplate.mealSlots) {
        const picked = day.selections[mealSlot.id];
        if (!picked || !picked.productId) {
          errors.push(`Día ${day.dayIndex}: falta elegir platillo para "${mealSlot.label}".`);
          continue;
        }
        const prod = productById.get(picked.productId);
        if (!prod) continue;
        for (const group of prod.customizations) {
          if (!group.required) continue;
          const sel = picked.selectedCustomizations.find((c) => c.groupId === group.id);
          const cnt = sel ? sel.optionIds.length : 0;
          if (cnt < group.minSelect || cnt > group.maxSelect) {
            errors.push(
              `Día ${day.dayIndex} (${prod.name}): completa "${group.label}" (${group.minSelect} opción/es).`
            );
          }
        }
      }
    }

    if (errors.length > 0) {
      setSubmitErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitErrors([]);

    const res = onConfirmWeeklyPlan({
      idempotencyKey,
      templateId: currentTemplate.id,
      startDateIso,
      distanceKm,
      paymentMethod,
      customer: {
        ...customer,
        customerName: customer.customerName.trim(),
        customerPhone: customer.customerPhone.trim(),
        address: customer.address.trim(),
        references: customer.references.trim(),
        building: customer.building.trim(),
        hospital: customer.hospital.trim(),
        area: customer.area.trim(),
        receiverName: customer.receiverName.trim(),
        orderNotes: customer.orderNotes?.trim() || '',
      },
      days: dayDrafts,
    });

    setIsSubmitting(false);

    if (!res.ok || !res.plan) {
      setSubmitErrors(res.errors || ['No se pudo confirmar el plan semanal.']);
      return;
    }

    setNewlyCreatedPlanFolio(res.plan.planFolio);
    setSubTab('active');
    setIdempotencyKey(createPlanIdempotencyKey());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!currentTemplate) {
    return (
      <section className="py-12 bg-[#DCE8D2] min-h-[75vh]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-[#EDF3E5] rounded-3xl p-8 border border-[#234D35]/15 space-y-3">
            <h1 className="font-display text-2xl font-bold text-[#193B29]">
              No hay paquetes ilustrativos activos
            </h1>
            <p className="text-sm text-[#193B29]/80">
              Habilita un paquete ilustrativo desde Administración → Planes activos.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 sm:py-12 bg-[#DCE8D2] min-h-[82vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onNavigateView('inicio')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#234D35] hover:text-[#193B29] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Volver a Inicio
          </button>

          <button
            type="button"
            onClick={() => onNavigateView('menu')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#28583C] hover:text-[#193B29] cursor-pointer"
          >
            <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
            Ir al Menú a la carta
          </button>
        </div>

        {/* Encabezado y aviso de ejemplos ilustrativos */}
        <div className="bg-[#234D35] text-[#EDF3E5] rounded-3xl p-6 sm:p-8 border border-[#C6DE8B]/20 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#C6DE8B]">
                Planes semanales · Paquetes ilustrativos configurables
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold">
                Programa tu plan semanal y calendario
              </h1>
              <p className="text-sm text-[#DCE8D2]/90 max-w-3xl">
                Cada compra genera <strong>1 registro principal de compra y pago</strong>, su{' '}
                <strong>calendario</strong>, <strong>órdenes diarias independientes</strong> y{' '}
                <strong>entregas vinculadas por día</strong> (sin agrupar toda la semana en un solo envío).
              </p>
            </div>
          </div>

          <div className="bg-[#193B29]/75 rounded-2xl p-3.5 border border-[#C6DE8B]/30 flex items-start gap-2.5 text-xs text-[#DCE8D2]">
            <Info className="w-4 h-4 text-[#C6DE8B] shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong>Nota sobre paquetes ilustrativos:</strong> Los paquetes disponibles son{' '}
              <strong>ejemplos ilustrativos configurables</strong> para demostrar la programación semanal y los cálculos de cuota del 4% (una vez sobre alimentos) y envíos. No son tarifas comerciales definitivas confirmadas.
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSubTab('configurator')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl cursor-pointer transition-colors ${
                subTab === 'configurator'
                  ? 'bg-[#C6DE8B] text-[#193B29]'
                  : 'bg-[#193B29] text-[#EDF3E5] hover:bg-[#28583C]'
              }`}
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Configurar plan semanal
            </button>
            <button
              type="button"
              onClick={() => setSubTab('active')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl cursor-pointer transition-colors ${
                subTab === 'active'
                  ? 'bg-[#C6DE8B] text-[#193B29]'
                  : 'bg-[#193B29] text-[#EDF3E5] hover:bg-[#28583C]'
              }`}
            >
              <Calendar className="w-4 h-4" aria-hidden="true" />
              Mis planes activos y calendario ({weeklyPlans.length})
            </button>
          </div>
        </div>

        {subTab === 'active' ? (
          <WeeklyPlanCalendarPanel
            weeklyPlans={weeklyPlans}
            demoOrders={demoOrders}
            capacityConfig={capacityConfig}
            globalDateExceptions={globalDateExceptions}
            highlightedPlanFolio={newlyCreatedPlanFolio}
            onReschedulePlanDay={onReschedulePlanDay}
          />
        ) : (
          <form
            onSubmit={handleSubmitPlan}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Columna izquierda: Configuración completa del plan */}
            <div className="lg:col-span-8 space-y-6">
              {/* 1. Elegir paquete ilustrativo configurable */}
              <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-4">
                <h2 className="font-display text-xl font-bold text-[#193B29]">
                  1. Elige un paquete ilustrativo configurable (ejemplo)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {activeTemplates.map((tpl) => {
                    const selected = tpl.id === currentTemplate.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer space-y-1.5 ${
                          selected
                            ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35]'
                            : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15 hover:bg-[#DCE8D2]'
                        }`}
                      >
                        <span
                          className={`block text-[10px] font-bold uppercase tracking-wider ${
                            selected ? 'text-[#C6DE8B]' : 'text-[#28583C]'
                          }`}
                        >
                          Ejemplo ilustrativo
                        </span>
                        <span className="block font-display text-base font-bold">
                          {tpl.name}
                        </span>
                        <span className="block text-xs opacity-85">{tpl.includesExample}</span>
                        <span className="block text-[11px] font-semibold opacity-90 pt-1">
                          {tpl.defaultDaysCount} días sugeridos
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Fecha inicial, duración y modalidad base */}
              <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
                <h2 className="font-display text-xl font-bold text-[#193B29]">
                  2. Fecha inicial, duración y modalidad
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="block space-y-1.5 text-sm">
                    <span className="font-semibold text-[#193B29]">Fecha inicial *</span>
                    <input
                      type="date"
                      value={startDateIso}
                      onChange={(e) =>
                        handleRebuildSchedule({ nextStartIso: e.target.value })
                      }
                      className="w-full px-3 py-2.5 bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </label>

                  <label className="block space-y-1.5 text-sm">
                    <span className="font-semibold text-[#193B29]">
                      Días del plan ({currentTemplate.minDays}–{currentTemplate.maxDays})
                    </span>
                    <input
                      type="number"
                      min={currentTemplate.minDays}
                      max={currentTemplate.maxDays}
                      value={daysCount}
                      onChange={(e) => {
                        const parsed = Number.parseInt(e.target.value, 10);
                        if (!Number.isNaN(parsed)) {
                          const clamped = Math.min(
                            currentTemplate.maxDays,
                            Math.max(currentTemplate.minDays, parsed)
                          );
                          handleRebuildSchedule({ nextCount: clamped });
                        }
                      }}
                      className="w-full px-3 py-2.5 bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29] font-bold tabular-nums"
                    />
                  </label>

                  <div className="space-y-1.5 text-sm">
                    <span className="block font-semibold text-[#193B29]">
                      Modalidad general
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyGlobalFulfillment('delivery')}
                        className={`px-3 py-2.5 text-xs font-bold rounded-xl border cursor-pointer ${
                          defaultFulfillment === 'delivery'
                            ? 'bg-[#234D35] text-[#C6DE8B] border-[#234D35]'
                            : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/20'
                        }`}
                      >
                        A domicilio
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyGlobalFulfillment('pickup')}
                        className={`px-3 py-2.5 text-xs font-bold rounded-xl border cursor-pointer ${
                          defaultFulfillment === 'pickup'
                            ? 'bg-[#234D35] text-[#C6DE8B] border-[#234D35]'
                            : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/20'
                        }`}
                      >
                        Recoger
                      </button>
                    </div>
                  </div>
                </div>

                {dayDrafts.some((d) => d.fulfillmentMode === 'delivery') && (
                  <div className="bg-[#DCE8D2]/70 rounded-2xl p-4 border border-[#234D35]/15 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="plan-distance-km"
                        className="text-sm font-semibold text-[#193B29]"
                      >
                        Distancia de entrega con Turbo Mandados (km):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="plan-distance-km"
                          type="number"
                          min={0.5}
                          max={20}
                          step={0.5}
                          value={distanceKm}
                          onChange={(e) => {
                            const val = Number.parseFloat(e.target.value);
                            setDistanceKm(Number.isNaN(val) ? 0 : Math.min(20, Math.max(0, val)));
                          }}
                          className="w-24 px-3 py-1.5 text-sm font-bold tabular-nums bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                        />
                        <span className="text-xs font-bold text-[#234D35]">km</span>
                      </div>
                    </div>

                    {distanceKm > TURBO_MANDADOS_RULES.maxCoverageKm && (
                      <div className="rounded-xl bg-[#7A2E1D]/12 border border-[#7A2E1D]/35 p-3 text-xs text-[#7A2E1D] flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <strong>Fuera de cobertura (&gt; 13 km):</strong> Cambia la modalidad a Recoger en tienda.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleApplyGlobalFulfillment('pickup')}
                          className="px-3 py-1.5 bg-[#28583C] text-[#EDF3E5] font-semibold rounded-lg cursor-pointer"
                        >
                          Cambiar plan a Recoger en tienda
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Programación por día: Fecha, Franja (cupos) y Platillos elegibles */}
              <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#193B29]">
                      3. Calendario diario, franjas y platillos elegibles ({dayDrafts.length} días)
                    </h2>
                    <p className="text-xs sm:text-sm text-[#193B29]/80">
                      Cada día creará una orden diaria independiente con su entrega vinculada y ocupará 1 cupo en su franja.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRebuildSchedule({})}
                    className="px-3.5 py-2 text-xs font-semibold bg-[#DCE8D2] hover:bg-[#C6DE8B] text-[#193B29] border border-[#234D35]/20 rounded-xl cursor-pointer"
                  >
                    Re-generar días sugeridos
                  </button>
                </div>

                <div className="space-y-4">
                  {dayDrafts.map((day) => {
                    const daySlotKey = `${day.scheduledDateIso}__${day.timeSlot}`;
                    const sameSlotCountInThisPlan = pendingSlotCounts.get(daySlotKey) ?? 1;

                    const slotOptions = DELIVERY_TIME_SLOTS.map((slot) => {
                      const k = `${day.scheduledDateIso}__${slot}`;
                      const extraFromOtherDaysInPlan =
                        (pendingSlotCounts.get(k) ?? 0) -
                        (day.timeSlot === slot ? 1 : 0);
                      return evaluateSlotCapacity({
                        dateIso: day.scheduledDateIso,
                        timeSlot: slot,
                        capacityConfig,
                        demoOrders,
                        globalDateExceptions,
                        pendingAdditionalPlans: extraFromOtherDaysInPlan,
                      });
                    });

                    const activeSlotSnap =
                      slotOptions.find((s) => s.timeSlot === day.timeSlot) ?? slotOptions[0];

                    const currentSlotCheckWithSelf = evaluateSlotCapacity({
                      dateIso: day.scheduledDateIso,
                      timeSlot: day.timeSlot,
                      capacityConfig,
                      demoOrders,
                      globalDateExceptions,
                      pendingAdditionalPlans: Math.max(0, sameSlotCountInThisPlan - 1),
                    });

                    return (
                      <div
                        key={day.dayIndex}
                        className="bg-[#DCE8D2]/75 rounded-2xl p-4 sm:p-5 border border-[#234D35]/15 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#234D35]/15 pb-3">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-[#28583C]">
                              Día {day.dayIndex} de {dayDrafts.length}
                            </span>
                            <h3 className="font-display text-lg font-bold text-[#193B29]">
                              {formatSpanishDateLabel(day.scheduledDateIso)}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateDayField(day.dayIndex, { fulfillmentMode: 'delivery' })
                              }
                              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl border cursor-pointer ${
                                day.fulfillmentMode === 'delivery'
                                  ? 'bg-[#234D35] text-[#C6DE8B] border-[#234D35]'
                                  : 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/20'
                              }`}
                            >
                              <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                              Domicilio
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateDayField(day.dayIndex, { fulfillmentMode: 'pickup' })
                              }
                              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl border cursor-pointer ${
                                day.fulfillmentMode === 'pickup'
                                  ? 'bg-[#234D35] text-[#C6DE8B] border-[#234D35]'
                                  : 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/20'
                              }`}
                            >
                              <Store className="w-3.5 h-3.5" aria-hidden="true" />
                              Recoger
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <label className="block space-y-1">
                            <span className="font-semibold text-[#193B29]">
                              Fecha de preparación
                            </span>
                            <input
                              type="date"
                              value={day.scheduledDateIso}
                              onChange={(e) =>
                                updateDayField(day.dayIndex, {
                                  scheduledDateIso: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                            />
                          </label>

                          <label className="block space-y-1">
                            <span className="font-semibold text-[#193B29]">
                              Franja horaria (cupos compartidos)
                            </span>
                            <select
                              value={day.timeSlot}
                              onChange={(e) =>
                                updateDayField(day.dayIndex, { timeSlot: e.target.value })
                              }
                              className="w-full px-3 py-2 bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                            >
                              {slotOptions.map((snap) => (
                                <option
                                  key={snap.timeSlot}
                                  value={snap.timeSlot}
                                  disabled={!snap.canBook}
                                >
                                  {snap.timeSlot} — {snap.statusLabel} ({snap.occupiedTotal}/
                                  {snap.limit})
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        {(!currentSlotCheckWithSelf.canBook || !activeSlotSnap.canBook) && (
                          <div className="rounded-xl bg-[#7A2E1D]/12 border border-[#7A2E1D]/30 px-3 py-2 text-xs font-semibold text-[#7A2E1D]">
                            Franja no disponible ({currentSlotCheckWithSelf.blockReason || currentSlotCheckWithSelf.statusLabel}). Cambia la fecha o selecciona otra franja con cupo.
                          </div>
                        )}

                        {/* Platillos elegibles por tiempo */}
                        <div className="space-y-3">
                          {currentTemplate.mealSlots.map((mealSlot) => {
                            const eligibleProducts = products.filter(
                              (p) =>
                                p.admin.active &&
                                p.priceMxn !== null &&
                                mealSlot.allowedCategories.includes(p.category) &&
                                evaluateProductAvailability(
                                  p,
                                  day.scheduledDateIso,
                                  globalDateExceptions
                                ).canOrder
                            );

                            const picked = day.selections[mealSlot.id];
                            const selectedProduct = picked
                              ? productById.get(picked.productId)
                              : undefined;

                            return (
                              <div
                                key={mealSlot.id}
                                className="bg-[#EDF3E5] rounded-xl p-3.5 border border-[#234D35]/15 space-y-2.5"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-[#28583C]">
                                    {mealSlot.label}
                                  </span>
                                  {selectedProduct && selectedProduct.priceMxn !== null && (
                                    <span className="text-xs font-bold text-[#234D35] tabular-nums">
                                      Menú: {formatCentsMXN(mxnToCents(selectedProduct.priceMxn))}
                                    </span>
                                  )}
                                </div>

                                <select
                                  aria-label={`Día ${day.dayIndex} - ${mealSlot.label}`}
                                  value={picked?.productId ?? ''}
                                  onChange={(e) =>
                                    updateDayDish(day.dayIndex, mealSlot.id, e.target.value)
                                  }
                                  className="w-full px-3 py-2 text-xs sm:text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                                >
                                  <option value="">Selecciona un platillo elegible...</option>
                                  {eligibleProducts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({formatCentsMXN(mxnToCents(p.priceMxn ?? 0))})
                                      {p.inventory.trackStock
                                        ? ` · Stock ${p.inventory.stock}`
                                        : ''}
                                    </option>
                                  ))}
                                </select>

                                {selectedProduct && selectedProduct.customizations.length > 0 && (
                                  <div className="space-y-2 pt-1">
                                    {selectedProduct.customizations.map((group) => {
                                      const currentSel = picked?.selectedCustomizations.find(
                                        (c) => c.groupId === group.id
                                      );
                                      const selectedIds = currentSel?.optionIds ?? [];
                                      return (
                                        <div
                                          key={group.id}
                                          className="bg-[#DCE8D2]/50 rounded-lg p-2.5 space-y-1.5"
                                        >
                                          <p className="text-[11px] font-bold text-[#193B29]">
                                            {group.label}{' '}
                                            {group.required
                                              ? `(Obligatorio: ${group.minSelect}${
                                                  group.maxSelect > group.minSelect
                                                    ? `–${group.maxSelect}`
                                                    : ''
                                                })`
                                              : `(Opcional hasta ${group.maxSelect})`}
                                            : {selectedIds.length}/{group.maxSelect}
                                          </p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {group.options.map((opt) => {
                                              const active = selectedIds.includes(opt.id);
                                              return (
                                                <button
                                                  key={opt.id}
                                                  type="button"
                                                  onClick={() =>
                                                    toggleDayDishCustomization(
                                                      day.dayIndex,
                                                      mealSlot.id,
                                                      group.id,
                                                      group.label,
                                                      group.maxSelect,
                                                      opt.id,
                                                      opt.label
                                                    )
                                                  }
                                                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer transition-colors ${
                                                    active
                                                      ? 'bg-[#234D35] text-[#C6DE8B] border-[#234D35]'
                                                      : 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/20 hover:bg-[#C6DE8B]/40'
                                                  }`}
                                                >
                                                  {opt.label}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Datos de entrega y pago demo */}
              <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#234D35]" aria-hidden="true" />
                  <h2 className="font-display text-xl font-bold text-[#193B29]">
                    4. Datos de contacto, entrega y pago (demo)
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-[#193B29]">Nombre completo *</span>
                    <input
                      type="text"
                      value={customer.customerName}
                      onChange={(e) =>
                        setCustomer((p) => ({ ...p, customerName: e.target.value }))
                      }
                      placeholder="Nombre y apellido"
                      className="w-full px-3.5 py-2.5 bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-[#193B29]">Teléfono / WhatsApp *</span>
                    <input
                      type="tel"
                      value={customer.customerPhone}
                      onChange={(e) =>
                        setCustomer((p) => ({ ...p, customerPhone: e.target.value }))
                      }
                      placeholder="999 000 0000"
                      className="w-full px-3.5 py-2.5 bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </label>
                </div>

                {dayDrafts.some((d) => d.fulfillmentMode === 'delivery') && (
                  <div className="space-y-4">
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-[#193B29]">
                        Dirección en Mérida *
                      </span>
                      <input
                        type="text"
                        value={customer.address}
                        onChange={(e) =>
                          setCustomer((p) => ({ ...p, address: e.target.value }))
                        }
                        placeholder="Calle, número, cruzamientos y colonia"
                        className="w-full px-3.5 py-2.5 bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                      />
                    </label>

                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-[#193B29]">Referencias *</span>
                      <input
                        type="text"
                        value={customer.references}
                        onChange={(e) =>
                          setCustomer((p) => ({ ...p, references: e.target.value }))
                        }
                        placeholder="Fachada, portón o indicaciones para Turbo Mandados"
                        className="w-full px-3.5 py-2.5 bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                      />
                    </label>

                    <div className="bg-[#DCE8D2]/60 rounded-2xl p-4 border border-[#234D35]/15 space-y-3">
                      <label className="flex items-center gap-2.5 text-sm font-semibold text-[#193B29] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customer.isSpecialLocation}
                          onChange={(e) =>
                            setCustomer((p) => ({
                              ...p,
                              isSpecialLocation: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 accent-[#234D35]"
                        />
                        <Building2 className="w-4 h-4 text-[#234D35]" aria-hidden="true" />
                        Entrega en edificio, hospital, área o con persona distinta
                      </label>

                      {customer.isSpecialLocation && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <input
                            type="text"
                            placeholder="Edificio / Torre"
                            value={customer.building}
                            onChange={(e) =>
                              setCustomer((p) => ({ ...p, building: e.target.value }))
                            }
                            className="px-3 py-2 bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl"
                          />
                          <input
                            type="text"
                            placeholder="Hospital / Clínica"
                            value={customer.hospital}
                            onChange={(e) =>
                              setCustomer((p) => ({ ...p, hospital: e.target.value }))
                            }
                            className="px-3 py-2 bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl"
                          />
                          <input
                            type="text"
                            placeholder="Área / Piso / Consultorio"
                            value={customer.area}
                            onChange={(e) =>
                              setCustomer((p) => ({ ...p, area: e.target.value }))
                            }
                            className="px-3 py-2 bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl"
                          />
                          <input
                            type="text"
                            placeholder="Nombre de quien recibirá"
                            value={customer.receiverName}
                            onChange={(e) =>
                              setCustomer((p) => ({ ...p, receiverName: e.target.value }))
                            }
                            className="px-3 py-2 bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-[#193B29]">
                    Observaciones generales para cocina o entregas (opcional)
                  </span>
                  <textarea
                    rows={2}
                    value={customer.orderNotes ?? ''}
                    onChange={(e) =>
                      setCustomer((p) => ({ ...p, orderNotes: e.target.value }))
                    }
                    placeholder="Ej. Sin picante, entregar en recepción..."
                    className="w-full px-3.5 py-2 bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                  />
                </label>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#234D35]" aria-hidden="true" />
                    <span className="text-sm font-semibold text-[#193B29]">
                      Método de pago simulado (modo demo)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PAYMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPaymentMethod(opt.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer ${
                          paymentMethod === opt.id
                            ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35]'
                            : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15'
                        }`}
                      >
                        <p className="text-xs sm:text-sm font-bold">{opt.label}</p>
                        <p className="text-[11px] opacity-85">{opt.helper}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Columna derecha: Desglose exacto en centavos y distribución por día */}
            <aside className="lg:col-span-4 lg:sticky lg:top-20 space-y-5">
              <div className="bg-[#234D35] text-[#EDF3E5] rounded-3xl p-6 border border-[#C6DE8B]/25 space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#C6DE8B]">
                    Resumen del plan (ejemplo configurable)
                  </p>
                  <h2 className="font-display text-2xl font-bold mt-1">
                    {currentTemplate.name} · {dayDrafts.length} días
                  </h2>
                </div>

                {pricingPreview && (
                  <div className="space-y-2.5 text-sm border-y border-[#EDF3E5]/15 py-4">
                    <div className="flex justify-between gap-2">
                      <span>
                        Alimentos del plan (
                        {currentTemplate.foodPricingMode === 'fixed_example'
                          ? 'tarifa ejemplo'
                          : 'suma platillos'}
                        ):
                      </span>
                      <span className="font-bold tabular-nums">
                        {formatCentsMXN(pricingPreview.foodSubtotalCents)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Cuota de servicio 4% (una sola vez sobre alimentos):</span>
                      <span className="font-bold tabular-nums">
                        {formatCentsMXN(pricingPreview.serviceFeeCents)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>
                        Envíos contratados ({pricingPreview.contractedDeliveriesCount}):
                      </span>
                      <span className="font-bold tabular-nums">
                        {pricingPreview.covered
                          ? formatCentsMXN(pricingPreview.deliveryTotalCents)
                          : 'Fuera de 13 km'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 pt-2 border-t border-[#EDF3E5]/15 font-display text-xl font-bold text-[#C6DE8B]">
                      <span>Total del plan:</span>
                      <span className="tabular-nums">
                        {pricingPreview.covered
                          ? `${formatCentsMXN(pricingPreview.totalCents)} MXN`
                          : 'No cubierto'}
                      </span>
                    </div>
                  </div>
                )}

                {pricingPreview && pricingPreview.covered && (
                  <div className="bg-[#193B29]/75 rounded-2xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-[#C6DE8B]">
                      Distribución exacta en {pricingPreview.perDayAllocations.length} órdenes diarias:
                    </p>
                    <ul className="space-y-1 text-[#DCE8D2] tabular-nums">
                      {pricingPreview.perDayAllocations.map((alloc) => (
                        <li key={alloc.dayIndex} className="flex justify-between gap-2">
                          <span>Día {alloc.dayIndex}:</span>
                          <span>
                            {formatCentsMXN(alloc.allocatedTotalCents)} (Alim{' '}
                            {formatCentsMXN(alloc.allocatedFoodCents)} + 4%{' '}
                            {formatCentsMXN(alloc.allocatedServiceFeeCents)} + Env{' '}
                            {formatCentsMXN(alloc.allocatedDeliveryFeeCents)})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="pt-1.5 border-t border-[#EDF3E5]/15 font-bold text-[#EDF3E5] flex justify-between tabular-nums">
                      <span>Suma exacta órdenes diarias:</span>
                      <span>
                        {formatCentsMXN(
                          pricingPreview.perDayAllocations.reduce(
                            (s, a) => s + a.allocatedTotalCents,
                            0
                          )
                        )}
                      </span>
                    </p>
                  </div>
                )}

                {submitErrors.length > 0 && (
                  <div
                    role="alert"
                    className="rounded-2xl bg-[#7A2E1D] text-[#EDF3E5] p-4 space-y-1.5 text-xs"
                  >
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      Revisa antes de confirmar:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      {submitErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !pricingPreview?.covered}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold bg-[#C6DE8B] text-[#193B29] hover:bg-[#d7eba6] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  {isSubmitting ? 'Procesando plan...' : 'Confirmar plan semanal (demo)'}
                </button>

                <p className="text-[11px] text-[#DCE8D2]/80 leading-relaxed">
                  Al confirmar, se revalidarán cupos compartidos, disponibilidad por fecha y existencias acumuladas, generando el registro principal, calendario y órdenes diarias independientes.
                </p>
              </div>
            </aside>
          </form>
        )}
      </div>
    </section>
  );
}
