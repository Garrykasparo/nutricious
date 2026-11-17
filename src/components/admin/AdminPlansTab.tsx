import { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Info,
  Lock,
  Search,
  Sliders,
} from 'lucide-react';
import type {
  CapacityScheduleConfig,
  ConfigurablePlanTemplate,
  DemoOrder,
  WeeklyPlanPurchase,
} from '../../types/product';
import {
  canReschedulePlanOrder,
  evaluateSlotCapacity,
  getPlanDayCalendarBadge,
} from '../../utils/capacityAndPlans';
import { formatSpanishDateLabel, getDayOfWeekFromIso } from '../../utils/meridaDate';
import { DELIVERY_TIME_SLOTS, formatCentsMXN } from '../../utils/pricing';
import { formatModalityLabel } from './AdminOrdersTab';

interface AdminPlansTabProps {
  planTemplates: ConfigurablePlanTemplate[];
  weeklyPlans: WeeklyPlanPurchase[];
  demoOrders: DemoOrder[];
  capacityConfig: CapacityScheduleConfig;
  globalDateExceptions: Record<string, string>;
  onUpdatePlanTemplate: (
    templateId: string,
    patch: Partial<ConfigurablePlanTemplate>
  ) => void;
  onReschedulePlanDay: (params: {
    planFolio: string;
    dailyOrderFolio: string;
    newDateIso: string;
    newTimeSlot: string;
  }) => { ok: boolean; error?: string };
  onNotify: (tone: 'ok' | 'error', text: string) => void;
}

export function AdminPlansTab({
  planTemplates,
  weeklyPlans,
  demoOrders,
  capacityConfig,
  globalDateExceptions,
  onUpdatePlanTemplate,
  onReschedulePlanDay,
  onNotify,
}: AdminPlansTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    planFolio: string;
    dailyOrderFolio: string;
    dateIso: string;
    timeSlot: string;
  } | null>(null);

  const orderByFolio = useMemo(() => {
    const map = new Map<string, DemoOrder>();
    for (const o of demoOrders) {
      map.set(o.folio, o);
    }
    return map;
  }, [demoOrders]);

  const financialReconciliation = useMemo(() => {
    const individualOrdersCents = demoOrders
      .filter((o) => o.orderType === 'a_la_carta')
      .reduce((sum, o) => sum + o.pricingSnapshot.totalCents, 0);

    const planMastersCents = weeklyPlans.reduce(
      (sum, p) => sum + p.pricingSnapshot.totalCents,
      0
    );

    const planDailyOrdersCents = demoOrders
      .filter((o) => o.orderType === 'plan_semanal')
      .reduce((sum, o) => sum + o.pricingSnapshot.totalCents, 0);

    return {
      individualOrdersCents,
      planMastersCents,
      planDailyOrdersCents,
      consolidatedTotalCents: individualOrdersCents + planDailyOrdersCents,
      centsDiff: planMastersCents - planDailyOrdersCents,
    };
  }, [demoOrders, weeklyPlans]);

  const filteredPlans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return weeklyPlans;
    return weeklyPlans.filter(
      (p) =>
        p.planFolio.toLowerCase().includes(q) ||
        p.customer.customerName.toLowerCase().includes(q) ||
        p.templateName.toLowerCase().includes(q)
    );
  }, [weeklyPlans, searchQuery]);

  const rescheduleSlotSnapshots = useMemo(() => {
    if (!rescheduleTarget) return [];
    return DELIVERY_TIME_SLOTS.map((slot) =>
      evaluateSlotCapacity({
        dateIso: rescheduleTarget.dateIso,
        timeSlot: slot,
        capacityConfig,
        demoOrders,
        globalDateExceptions,
        ignoreOrderFolio: rescheduleTarget.dailyOrderFolio,
      })
    );
  }, [rescheduleTarget, capacityConfig, demoOrders, globalDateExceptions]);

  return (
    <div className="space-y-6">
      {/* Conciliación financiera sin doble conteo */}
      <div className="bg-[#234D35] text-[#EDF3E5] rounded-3xl p-5 sm:p-6 border border-[#C6DE8B]/25 space-y-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#C6DE8B] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs sm:text-sm space-y-1">
            <p className="font-bold text-[#C6DE8B]">
              Regla contable: sin doble conteo entre registro principal y órdenes diarias
            </p>
            <p className="text-[#DCE8D2]">
              Cada plan genera un <strong>registro principal de compra y pago</strong> más sus <strong>órdenes diarias independientes</strong>. Los importes de alimentos y la cuota del 4% (calculada una vez) se distribuyen exactamente en centavos entre las órdenes diarias. Al reportar totales consolidados, el registro principal no se vuelve a sumar sobre sus órdenes diarias.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#193B29]/70 rounded-2xl p-4 border border-[#EDF3E5]/10">
            <p className="text-xs text-[#C6DE8B]">A la carta (órdenes individuales)</p>
            <p className="font-display text-xl font-bold tabular-nums mt-1">
              {formatCentsMXN(financialReconciliation.individualOrdersCents)}
            </p>
          </div>
          <div className="bg-[#193B29]/70 rounded-2xl p-4 border border-[#EDF3E5]/10">
            <p className="text-xs text-[#C6DE8B]">Planes (registros principales)</p>
            <p className="font-display text-xl font-bold tabular-nums mt-1">
              {formatCentsMXN(financialReconciliation.planMastersCents)}
            </p>
          </div>
          <div className="bg-[#193B29]/70 rounded-2xl p-4 border border-[#EDF3E5]/10">
            <p className="text-xs text-[#C6DE8B]">Suma órdenes diarias de planes</p>
            <p className="font-display text-xl font-bold tabular-nums mt-1">
              {formatCentsMXN(financialReconciliation.planDailyOrdersCents)}
            </p>
            <p className="text-[11px] text-[#DCE8D2]/80 mt-0.5 tabular-nums">
              Diferencia exacta: {formatCentsMXN(financialReconciliation.centsDiff)}
            </p>
          </div>
          <div className="bg-[#193B29]/70 rounded-2xl p-4 border border-[#C6DE8B]/40">
            <p className="text-xs text-[#C6DE8B]">Total consolidado (sin duplicar)</p>
            <p className="font-display text-xl font-bold tabular-nums mt-1 text-[#C6DE8B]">
              {formatCentsMXN(financialReconciliation.consolidatedTotalCents)}
            </p>
          </div>
        </div>
      </div>

      {/* Paquetes ilustrativos configurables */}
      <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-bold text-[#193B29]">
            Paquetes ilustrativos configurables
          </h2>
          <p className="text-sm text-[#193B29]/80">
            Configura los paquetes de ejemplo visibles en tienda y planes. Se muestran identificados como <strong>ejemplos ilustrativos configurables</strong> y no como tarifas comerciales confirmadas.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {planTemplates.map((tpl) => {
            const isEditing = editingTemplateId === tpl.id;
            return (
              <div
                key={tpl.id}
                className="bg-[#DCE8D2]/75 rounded-2xl p-4 sm:p-5 border border-[#234D35]/15 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#28583C]">
                        Ejemplo ilustrativo configurable
                      </span>
                      <h3 className="font-display text-lg font-bold text-[#193B29]">
                        {tpl.name}
                      </h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                        tpl.active
                          ? 'bg-[#C6DE8B] text-[#193B29]'
                          : 'bg-[#7A2E1D] text-[#EDF3E5]'
                      }`}
                    >
                      {tpl.active ? 'Activo' : 'Oculto'}
                    </span>
                  </div>

                  <p className="text-xs text-[#193B29]/80">{tpl.subtitle}</p>
                  <p className="text-xs font-semibold text-[#234D35]">
                    Días sugeridos: {tpl.defaultDaysCount} (rango {tpl.minDays}–{tpl.maxDays}) ·{' '}
                    {tpl.foodPricingMode === 'fixed_example'
                      ? `Tarifa ejemplo: $${tpl.exampleFoodPriceMxn.toFixed(2)} MXN`
                      : 'Suma real de platillos del menú'}
                  </p>
                </div>

                {isEditing ? (
                  <div className="bg-[#EDF3E5] rounded-xl p-3.5 border border-[#234D35]/15 space-y-2.5 text-xs">
                    <label className="block space-y-1">
                      <span className="font-semibold text-[#193B29]">Nombre del ejemplo</span>
                      <input
                        type="text"
                        value={tpl.name}
                        onChange={(e) =>
                          onUpdatePlanTemplate(tpl.id, { name: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-lg text-[#193B29]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="font-semibold text-[#193B29]">Días sugeridos</span>
                      <input
                        type="number"
                        min={tpl.minDays}
                        max={tpl.maxDays}
                        value={tpl.defaultDaysCount}
                        onChange={(e) => {
                          const parsed = Number.parseInt(e.target.value, 10);
                          if (!Number.isNaN(parsed)) {
                            onUpdatePlanTemplate(tpl.id, {
                              defaultDaysCount: Math.min(
                                tpl.maxDays,
                                Math.max(tpl.minDays, parsed)
                              ),
                            });
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-lg text-[#193B29]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="font-semibold text-[#193B29]">
                        Modo de precio de alimentos
                      </span>
                      <select
                        value={tpl.foodPricingMode}
                        onChange={(e) =>
                          onUpdatePlanTemplate(tpl.id, {
                            foodPricingMode: e.target.value as 'sum_dishes' | 'fixed_example',
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-lg text-[#193B29]"
                      >
                        <option value="sum_dishes">Suma real de platillos elegidos</option>
                        <option value="fixed_example">
                          Tarifa ejemplo configurable (MXN)
                        </option>
                      </select>
                    </label>

                    {tpl.foodPricingMode === 'fixed_example' && (
                      <label className="block space-y-1">
                        <span className="font-semibold text-[#193B29]">
                          Precio alimentos ejemplo (MXN, no definitivo)
                        </span>
                        <input
                          type="number"
                          min={50}
                          step={10}
                          value={tpl.exampleFoodPriceMxn}
                          onChange={(e) => {
                            const parsed = Number.parseFloat(e.target.value);
                            if (!Number.isNaN(parsed) && parsed >= 0) {
                              onUpdatePlanTemplate(tpl.id, { exampleFoodPriceMxn: parsed });
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-lg text-[#193B29]"
                        />
                      </label>
                    )}

                    <label className="flex items-center gap-2 font-semibold text-[#193B29] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tpl.active}
                        onChange={(e) =>
                          onUpdatePlanTemplate(tpl.id, { active: e.target.checked })
                        }
                        className="accent-[#234D35]"
                      />
                      Visible para configurar en tienda
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplateId(null);
                        onNotify('ok', `Paquete ilustrativo "${tpl.name}" guardado.`);
                      }}
                      className="w-full py-2 text-xs font-semibold bg-[#28583C] text-[#EDF3E5] rounded-xl cursor-pointer"
                    >
                      Listo
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTemplateId(tpl.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#EDF3E5] text-[#193B29] hover:bg-[#C6DE8B] border border-[#234D35]/20 rounded-xl cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
                    Configurar paquete ejemplo
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Planes activos contratados */}
      <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#193B29]">
              Planes activos ({filteredPlans.length})
            </h2>
            <p className="text-sm text-[#193B29]/80">
              Consulta el registro principal de pago, el calendario de entregas pendientes/completadas, sus órdenes diarias independientes y reprograma días antes de cocina o transporte.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              className="w-4 h-4 text-[#234D35]/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar folio PLAN-... o cliente..."
              aria-label="Buscar planes activos"
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
            />
          </div>
        </div>

        {filteredPlans.length === 0 ? (
          <div className="bg-[#DCE8D2]/70 rounded-2xl p-6 border border-[#234D35]/15 space-y-2">
            <p className="font-display text-lg font-bold text-[#193B29]">
              Aún no hay planes semanales contratados
            </p>
            <p className="text-sm text-[#193B29]/80">
              Configura un plan semanal desde la pestaña <strong>Planes</strong> para ver aquí su registro principal, calendario y órdenes diarias vinculadas.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPlans.map((plan) => {
              const deliveredDaysCount = plan.days.filter((d) => {
                const ord = orderByFolio.get(d.dailyOrderFolio);
                return ord?.deliveryStatus === 'Entregado';
              }).length;

              const sumDailyOrdersCents = plan.days.reduce((sum, d) => {
                const ord = orderByFolio.get(d.dailyOrderFolio);
                return sum + (ord ? ord.pricingSnapshot.totalCents : d.allocatedTotalCents);
              }, 0);

              return (
                <div
                  key={plan.planFolio}
                  className="bg-[#DCE8D2]/75 rounded-3xl p-5 sm:p-6 border border-[#234D35]/20 space-y-5"
                >
                  {/* 1. Registro principal de compra y pago */}
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-[#234D35]/15 pb-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#234D35] text-[#C6DE8B]">
                          {plan.planFolio}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#EDF3E5] text-[#28583C]">
                          {plan.totalDays} días · {deliveredDaysCount} entregado(s) ·{' '}
                          {plan.totalDays - deliveredDaysCount} pendiente(s)
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-bold text-[#193B29]">
                        {plan.templateName} — {plan.customer.customerName}
                      </h3>
                      <p className="text-xs text-[#193B29]/80">
                        Tel: {plan.customer.customerPhone} · Inicio: {formatSpanishDateLabel(plan.startDateIso)} · Pago: <strong>{plan.paymentStatus}</strong>
                      </p>
                    </div>

                    <div className="bg-[#EDF3E5] rounded-2xl p-3.5 border border-[#234D35]/15 text-xs space-y-1 min-w-[260px]">
                      <div className="flex justify-between gap-4">
                        <span>Alimentos del plan:</span>
                        <span className="font-semibold tabular-nums">
                          {formatCentsMXN(plan.pricingSnapshot.foodSubtotalCents)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Cuota 4% (una sola vez):</span>
                        <span className="font-semibold tabular-nums">
                          {formatCentsMXN(plan.pricingSnapshot.serviceFeeCents)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>
                          Envíos ({plan.pricingSnapshot.contractedDeliveriesCount}):
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatCentsMXN(plan.pricingSnapshot.deliveryTotalCents)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 pt-1 border-t border-[#234D35]/15 font-bold text-[#234D35] text-sm">
                        <span>Total registro principal:</span>
                        <span className="tabular-nums">
                          {formatCentsMXN(plan.pricingSnapshot.totalCents)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#28583C] tabular-nums">
                        Suma de {plan.days.length} órdenes diarias: {formatCentsMXN(sumDailyOrdersCents)}
                      </p>
                    </div>
                  </div>

                  {/* 2 y 3. Calendario + órdenes diarias independientes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {plan.days.map((dayEntry) => {
                      const dailyOrder = orderByFolio.get(dayEntry.dailyOrderFolio);
                      if (!dailyOrder) return null;

                      const calBadge = getPlanDayCalendarBadge(dailyOrder);
                      const rescheduleCheck = canReschedulePlanOrder(dailyOrder);
                      const isEditingThisDay =
                        rescheduleTarget?.dailyOrderFolio === dailyOrder.folio;

                      return (
                        <div
                          key={dailyOrder.folio}
                          className="bg-[#EDF3E5] rounded-2xl p-4 border border-[#234D35]/15 flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold uppercase text-[#28583C]">
                                  Día {dayEntry.dayIndex} de {plan.totalDays}
                                </p>
                                <p className="font-mono text-xs font-bold text-[#193B29]">
                                  {dailyOrder.folio}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                                  calBadge.tone === 'delivered'
                                    ? 'bg-[#234D35] text-[#C6DE8B]'
                                    : calBadge.tone === 'active'
                                      ? 'bg-[#28583C] text-[#EDF3E5]'
                                      : 'bg-[#C6DE8B] text-[#193B29]'
                                }`}
                              >
                                {calBadge.label}
                              </span>
                            </div>

                            <div className="text-xs text-[#193B29] space-y-1">
                              <p className="font-semibold flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-[#28583C]" aria-hidden="true" />
                                {formatSpanishDateLabel(dailyOrder.scheduledDateIso)}
                              </p>
                              <p className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-[#28583C]" aria-hidden="true" />
                                Franja {dailyOrder.timeSlot} ·{' '}
                                {formatModalityLabel(dailyOrder.fulfillmentMode)}
                              </p>
                            </div>

                            <ul className="text-xs text-[#193B29]/85 space-y-0.5 bg-[#DCE8D2]/50 rounded-xl p-2.5">
                              {dailyOrder.items.map((item) => (
                                <li key={item.uid}>
                                  <strong>{item.quantity}x</strong> {item.productName}
                                </li>
                              ))}
                            </ul>

                            <div className="text-[11px] text-[#193B29]/80 space-y-0.5 tabular-nums">
                              <p>
                                <strong>Cocina:</strong> {dailyOrder.prepStatus} ·{' '}
                                <strong>Entrega:</strong> {dailyOrder.deliveryStatus}
                              </p>
                              <p>
                                Asignación día: {formatCentsMXN(dailyOrder.pricingSnapshot.totalCents)}{' '}
                                (Alim {formatCentsMXN(dailyOrder.pricingSnapshot.subtotalCents)} + 4%{' '}
                                {formatCentsMXN(dailyOrder.pricingSnapshot.serviceFeeCents)} + Env{' '}
                                {formatCentsMXN(dailyOrder.pricingSnapshot.deliveryFeeCents)})
                              </p>
                            </div>
                          </div>

                          {isEditingThisDay && rescheduleTarget ? (
                            <div className="bg-[#DCE8D2]/80 rounded-xl p-3 border border-[#234D35]/20 space-y-2.5 text-xs">
                              <p className="font-bold text-[#193B29]">
                                Reprogramar Día {dayEntry.dayIndex}
                              </p>
                              <label className="block space-y-1">
                                <span className="font-semibold">Nueva fecha</span>
                                <input
                                  type="date"
                                  value={rescheduleTarget.dateIso}
                                  onChange={(e) =>
                                    setRescheduleTarget((prev) =>
                                      prev ? { ...prev, dateIso: e.target.value } : null
                                    )
                                  }
                                  className="w-full px-2.5 py-1.5 bg-[#EDF3E5] border border-[#234D35]/20 rounded-lg text-[#193B29]"
                                />
                              </label>
                              {getDayOfWeekFromIso(rescheduleTarget.dateIso) === 0 && (
                                <p className="text-[#7A2E1D] font-semibold">
                                  Domingo cerrado. Elige lunes a sábado.
                                </p>
                              )}
                              <label className="block space-y-1">
                                <span className="font-semibold">Nueva franja (cupos)</span>
                                <select
                                  value={rescheduleTarget.timeSlot}
                                  onChange={(e) =>
                                    setRescheduleTarget((prev) =>
                                      prev ? { ...prev, timeSlot: e.target.value } : null
                                    )
                                  }
                                  className="w-full px-2.5 py-1.5 bg-[#EDF3E5] border border-[#234D35]/20 rounded-lg text-[#193B29]"
                                >
                                  {rescheduleSlotSnapshots.map((snap) => (
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
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = onReschedulePlanDay({
                                      planFolio: plan.planFolio,
                                      dailyOrderFolio: dailyOrder.folio,
                                      newDateIso: rescheduleTarget.dateIso,
                                      newTimeSlot: rescheduleTarget.timeSlot,
                                    });
                                    if (!res.ok) {
                                      onNotify('error', res.error || 'No se pudo reprogramar.');
                                      return;
                                    }
                                    setRescheduleTarget(null);
                                    onNotify(
                                      'ok',
                                      `Día ${dayEntry.dayIndex} (${dailyOrder.folio}) reprogramado a ${rescheduleTarget.dateIso} (${rescheduleTarget.timeSlot}).`
                                    );
                                  }}
                                  className="flex-1 py-2 font-semibold bg-[#28583C] text-[#EDF3E5] rounded-lg cursor-pointer"
                                >
                                  Confirmar cambio
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRescheduleTarget(null)}
                                  className="px-3 py-2 font-semibold bg-[#EDF3E5] text-[#193B29] rounded-lg border border-[#234D35]/20 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : rescheduleCheck.allowed ? (
                            <button
                              type="button"
                              onClick={() =>
                                setRescheduleTarget({
                                  planFolio: plan.planFolio,
                                  dailyOrderFolio: dailyOrder.folio,
                                  dateIso: dailyOrder.scheduledDateIso,
                                  timeSlot: dailyOrder.timeSlot,
                                })
                              }
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#DCE8D2] hover:bg-[#C6DE8B] text-[#193B29] rounded-xl border border-[#234D35]/20 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                              Reprogramar fecha / franja
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold bg-[#DCE8D2]/50 text-[#7A2E1D] rounded-xl border border-[#7A2E1D]/20">
                              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>{rescheduleCheck.reason}</span>
                            </div>
                          )}

                          {dayEntry.rescheduleCount > 0 && (
                            <p className="text-[11px] text-[#28583C] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                              Reprogramado {dayEntry.rescheduleCount} vez/veces (
                              {dayEntry.lastRescheduledDisplay})
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
