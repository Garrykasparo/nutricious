import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Lock,
  Receipt,
  Truck,
} from 'lucide-react';
import type {
  CapacityScheduleConfig,
  DemoOrder,
  WeeklyPlanPurchase,
} from '../types/product';
import {
  canReschedulePlanOrder,
  evaluateSlotCapacity,
  getPlanDayCalendarBadge,
} from '../utils/capacityAndPlans';
import { formatSpanishDateLabel, getDayOfWeekFromIso } from '../utils/meridaDate';
import { DELIVERY_TIME_SLOTS, formatCentsMXN } from '../utils/pricing';
import { formatModalityLabel } from './admin/AdminOrdersTab';

interface WeeklyPlanCalendarPanelProps {
  weeklyPlans: WeeklyPlanPurchase[];
  demoOrders: DemoOrder[];
  capacityConfig: CapacityScheduleConfig;
  globalDateExceptions: Record<string, string>;
  highlightedPlanFolio?: string | null;
  onReschedulePlanDay: (params: {
    planFolio: string;
    dailyOrderFolio: string;
    newDateIso: string;
    newTimeSlot: string;
  }) => { ok: boolean; error?: string };
}

export function WeeklyPlanCalendarPanel({
  weeklyPlans,
  demoOrders,
  capacityConfig,
  globalDateExceptions,
  highlightedPlanFolio,
  onReschedulePlanDay,
}: WeeklyPlanCalendarPanelProps) {
  const [copiedPlanFolio, setCopiedPlanFolio] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    planFolio: string;
    dailyOrderFolio: string;
    dateIso: string;
    timeSlot: string;
  } | null>(null);
  const [rescheduleFeedback, setRescheduleFeedback] = useState<{
    tone: 'ok' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!copiedPlanFolio) return undefined;
    const t = window.setTimeout(() => setCopiedPlanFolio(null), 2500);
    return () => window.clearTimeout(t);
  }, [copiedPlanFolio]);

  const orderByFolio = useMemo(() => {
    const map = new Map<string, DemoOrder>();
    for (const o of demoOrders) {
      map.set(o.folio, o);
    }
    return map;
  }, [demoOrders]);

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

  const handleCopyWhatsapp = async (plan: WeeklyPlanPurchase) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(plan.whatsappSummaryText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = plan.whatsappSummaryText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedPlanFolio(plan.planFolio);
    } catch {
      setCopiedPlanFolio(null);
    }
  };

  if (weeklyPlans.length === 0) {
    return (
      <div className="bg-[#EDF3E5] rounded-3xl p-8 border border-[#234D35]/15 text-center space-y-2">
        <p className="font-display text-xl font-bold text-[#193B29]">
          Aún no tienes planes semanales registrados en esta sesión
        </p>
        <p className="text-sm text-[#193B29]/80 max-w-xl mx-auto">
          Arma un plan en la pestaña <strong>Configurar plan semanal</strong> para generar tu registro principal de pago, calendario y órdenes diarias independientes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {rescheduleFeedback && (
        <div
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm font-medium border ${
            rescheduleFeedback.tone === 'error'
              ? 'bg-[#7A2E1D] text-[#EDF3E5] border-[#7A2E1D]'
              : 'bg-[#C6DE8B] text-[#193B29] border-[#234D35]/25'
          }`}
        >
          {rescheduleFeedback.text}
        </div>
      )}

      {weeklyPlans.map((plan) => {
        const isHighlighted = highlightedPlanFolio === plan.planFolio;
        const deliveredCount = plan.days.filter((d) => {
          const ord = orderByFolio.get(d.dailyOrderFolio);
          return ord?.deliveryStatus === 'Entregado';
        }).length;
        const pendingCount = plan.totalDays - deliveredCount;

        return (
          <div
            key={plan.planFolio}
            className={`rounded-3xl p-6 sm:p-8 border space-y-6 ${
              isHighlighted
                ? 'bg-[#234D35] text-[#EDF3E5] border-[#C6DE8B]/50'
                : 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/15'
            }`}
          >
            {/* 1. Registro principal de compra y pago */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 border-b border-current/15 pb-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold ${
                      isHighlighted
                        ? 'bg-[#C6DE8B] text-[#193B29]'
                        : 'bg-[#234D35] text-[#C6DE8B]'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" aria-hidden="true" />
                    Registro principal: {plan.planFolio}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold ${
                      isHighlighted
                        ? 'bg-[#193B29] text-[#EDF3E5]'
                        : 'bg-[#DCE8D2] text-[#28583C]'
                    }`}
                  >
                    Paquete ilustrativo configurable
                  </span>
                </div>

                <h2 className="font-display text-2xl font-bold">
                  {plan.templateName} ({plan.totalDays} días) — {plan.customer.customerName}
                </h2>
                <p className="text-xs sm:text-sm opacity-85">
                  Inicio: {formatSpanishDateLabel(plan.startDateIso)} · Pago:{' '}
                  <strong>{plan.paymentStatus}</strong> · Entregados:{' '}
                  <strong>{deliveredCount}</strong> · Pendientes:{' '}
                  <strong>{pendingCount}</strong>
                </p>
              </div>

              <div
                className={`rounded-2xl p-4 border text-xs sm:text-sm space-y-1.5 min-w-[280px] ${
                  isHighlighted
                    ? 'bg-[#193B29]/75 border-[#EDF3E5]/15'
                    : 'bg-[#DCE8D2]/75 border-[#234D35]/15'
                }`}
              >
                <div className="flex justify-between gap-4">
                  <span>Alimentos del plan:</span>
                  <span className="font-semibold tabular-nums">
                    {formatCentsMXN(plan.pricingSnapshot.foodSubtotalCents)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Cuota 4% (una sola vez sobre alimentos):</span>
                  <span className="font-semibold tabular-nums">
                    {formatCentsMXN(plan.pricingSnapshot.serviceFeeCents)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>
                    Envíos contratados ({plan.pricingSnapshot.contractedDeliveriesCount}):
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatCentsMXN(plan.pricingSnapshot.deliveryTotalCents)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 pt-2 border-t border-current/15 font-display text-base font-bold">
                  <span>Total plan:</span>
                  <span className="tabular-nums">
                    {formatCentsMXN(plan.pricingSnapshot.totalCents)} MXN
                  </span>
                </div>
              </div>
            </div>

            {/* 2 y 3. Calendario + Órdenes diarias independientes + Entregas vinculadas */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold">
                  Calendario, órdenes diarias independientes y entregas vinculadas
                </h3>
                <span className="text-xs opacity-80">
                  Puedes reprogramar un día antes de iniciar preparación o asignar transporte.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plan.days.map((dayEntry) => {
                  const dailyOrder = orderByFolio.get(dayEntry.dailyOrderFolio);
                  if (!dailyOrder) return null;

                  const badge = getPlanDayCalendarBadge(dailyOrder);
                  const reschedCheck = canReschedulePlanOrder(dailyOrder);
                  const isEditingThis =
                    rescheduleTarget?.dailyOrderFolio === dailyOrder.folio;

                  return (
                    <div
                      key={dailyOrder.folio}
                      className={`rounded-2xl p-4 border flex flex-col justify-between gap-3 ${
                        isHighlighted
                          ? 'bg-[#193B29]/65 border-[#EDF3E5]/15 text-[#EDF3E5]'
                          : 'bg-[#DCE8D2]/70 border-[#234D35]/15 text-[#193B29]'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p
                              className={`text-xs font-bold uppercase ${
                                isHighlighted ? 'text-[#C6DE8B]' : 'text-[#28583C]'
                              }`}
                            >
                              Día {dayEntry.dayIndex} de {plan.totalDays}
                            </p>
                            <p className="font-mono text-xs font-bold">
                              Orden: {dailyOrder.folio}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                              badge.tone === 'delivered'
                                ? 'bg-[#C6DE8B] text-[#193B29]'
                                : badge.tone === 'active'
                                  ? 'bg-[#28583C] text-[#EDF3E5]'
                                  : isHighlighted
                                    ? 'bg-[#EDF3E5] text-[#193B29]'
                                    : 'bg-[#234D35] text-[#EDF3E5]'
                            }`}
                          >
                            {badge.label}
                          </span>
                        </div>

                        <div className="text-xs space-y-1">
                          <p className="font-semibold flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            {formatSpanishDateLabel(dailyOrder.scheduledDateIso)}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            Franja: {dailyOrder.timeSlot}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            {formatModalityLabel(dailyOrder.fulfillmentMode)} ·{' '}
                            {dailyOrder.deliveryStatus}
                          </p>
                        </div>

                        <ul
                          className={`text-xs rounded-xl p-2.5 space-y-1 ${
                            isHighlighted ? 'bg-[#142e20]' : 'bg-[#EDF3E5]'
                          }`}
                        >
                          {dailyOrder.items.map((item) => (
                            <li key={item.uid}>
                              <strong>{item.quantity}×</strong> {item.productName}
                              {item.selectedCustomizations.length > 0 && (
                                <span className="block text-[11px] opacity-80">
                                  {item.selectedCustomizations
                                    .map((c) => `${c.groupLabel}: ${c.optionLabels.join(', ')}`)
                                    .join(' · ')}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>

                        <div className="text-[11px] opacity-85 space-y-0.5 tabular-nums">
                          <p>
                            <strong>Cocina:</strong> {dailyOrder.prepStatus}
                          </p>
                          <p>
                            <strong>Importe diario asignado:</strong>{' '}
                            {formatCentsMXN(dailyOrder.pricingSnapshot.totalCents)} (Alim{' '}
                            {formatCentsMXN(dailyOrder.pricingSnapshot.subtotalCents)} + 4%{' '}
                            {formatCentsMXN(dailyOrder.pricingSnapshot.serviceFeeCents)} + Env{' '}
                            {formatCentsMXN(dailyOrder.pricingSnapshot.deliveryFeeCents)})
                          </p>
                        </div>
                      </div>

                      {isEditingThis && rescheduleTarget ? (
                        <div
                          className={`rounded-xl p-3 border space-y-2.5 text-xs ${
                            isHighlighted
                              ? 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/20'
                              : 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/20'
                          }`}
                        >
                          <p className="font-bold">Reprogramar Día {dayEntry.dayIndex}</p>
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
                              className="w-full px-2.5 py-1.5 bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-lg text-[#193B29]"
                            />
                          </label>
                          {getDayOfWeekFromIso(rescheduleTarget.dateIso) === 0 && (
                            <p className="text-[#7A2E1D] font-semibold">
                              Domingo cerrado. Elige un día de lunes a sábado.
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
                              className="w-full px-2.5 py-1.5 bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-lg text-[#193B29]"
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
                                  setRescheduleFeedback({
                                    tone: 'error',
                                    text: res.error || 'No se pudo reprogramar este día.',
                                  });
                                  return;
                                }
                                setRescheduleTarget(null);
                                setRescheduleFeedback({
                                  tone: 'ok',
                                  text: `Día ${dayEntry.dayIndex} (${dailyOrder.folio}) reprogramado a ${formatSpanishDateLabel(
                                    rescheduleTarget.dateIso
                                  )} (${rescheduleTarget.timeSlot}). Se liberó el cupo anterior.`,
                                });
                              }}
                              className="flex-1 py-2 font-semibold bg-[#28583C] text-[#EDF3E5] rounded-lg cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setRescheduleTarget(null)}
                              className="px-3 py-2 font-semibold bg-[#DCE8D2] text-[#193B29] rounded-lg cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : reschedCheck.allowed ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRescheduleFeedback(null);
                            setRescheduleTarget({
                              planFolio: plan.planFolio,
                              dailyOrderFolio: dailyOrder.folio,
                              dateIso: dailyOrder.scheduledDateIso,
                              timeSlot: dailyOrder.timeSlot,
                            });
                          }}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border cursor-pointer ${
                            isHighlighted
                              ? 'bg-[#C6DE8B] text-[#193B29] border-[#C6DE8B] hover:bg-[#d7eba6]'
                              : 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/20 hover:bg-[#C6DE8B]'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                          Reprogramar fecha / franja
                        </button>
                      ) : (
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-xl border ${
                            isHighlighted
                              ? 'bg-[#142e20] text-[#EDF3E5]/85 border-[#EDF3E5]/15'
                              : 'bg-[#EDF3E5]/70 text-[#7A2E1D] border-[#7A2E1D]/20'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{reschedCheck.reason}</span>
                        </div>
                      )}

                      {dayEntry.rescheduleCount > 0 && (
                        <p className="text-[11px] opacity-85 flex items-center gap-1">
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

            {/* Copiar resumen WhatsApp del plan */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-current/15">
              <p className="text-xs opacity-80">
                Resumen completo para WhatsApp listo para copiar manualmente (sin envío automático).
              </p>
              <button
                type="button"
                onClick={() => handleCopyWhatsapp(plan)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl cursor-pointer ${
                  isHighlighted
                    ? 'bg-[#C6DE8B] text-[#193B29] hover:bg-[#d7eba6]'
                    : 'bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d]'
                }`}
              >
                {copiedPlanFolio === plan.planFolio ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    Resumen copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    Copiar resumen WhatsApp del plan
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
