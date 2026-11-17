import { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Lock,
  Sliders,
  Unlock,
} from 'lucide-react';
import type { CapacityScheduleConfig, DemoOrder } from '../../types/product';
import { evaluateSlotCapacity } from '../../utils/capacityAndPlans';
import {
  addDaysToIso,
  formatSpanishDateLabel,
  getDayOfWeekFromIso,
  getMeridaTodayIso,
  getMondayOfWeekIso,
  getWeekDaysFromMonday,
} from '../../utils/meridaDate';
import { DELIVERY_TIME_SLOTS } from '../../utils/pricing';

interface AdminCapacityTabProps {
  capacityConfig: CapacityScheduleConfig;
  demoOrders: DemoOrder[];
  globalDateExceptions: Record<string, string>;
  onUpdateDefaultSlotLimit: (nextLimit: number) => void;
  onUpdateSlotRule: (params: {
    dateIso: string;
    timeSlot: string;
    limit: number;
    blocked: boolean;
    blockReason?: string;
  }) => void;
  onNotify: (tone: 'ok' | 'error', text: string) => void;
}

function getDefaultOpenDateIso(): string {
  const today = getMeridaTodayIso();
  return getDayOfWeekFromIso(today) === 0 ? addDaysToIso(today, 1) : today;
}

export function AdminCapacityTab({
  capacityConfig,
  demoOrders,
  globalDateExceptions,
  onUpdateDefaultSlotLimit,
  onUpdateSlotRule,
  onNotify,
}: AdminCapacityTabProps) {
  const [selectedDateIso, setSelectedDateIso] = useState<string>(() => getDefaultOpenDateIso());
  const [defaultLimitInput, setDefaultLimitInput] = useState<string>(
    String(capacityConfig.defaultSlotLimit)
  );
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});

  const todayIso = useMemo(() => getMeridaTodayIso(), []);
  const mondayIso = useMemo(() => getMondayOfWeekIso(selectedDateIso), [selectedDateIso]);
  const weekDays = useMemo(() => getWeekDaysFromMonday(mondayIso), [mondayIso]);

  const slotSnapshots = useMemo(
    () =>
      DELIVERY_TIME_SLOTS.map((slot) =>
        evaluateSlotCapacity({
          dateIso: selectedDateIso,
          timeSlot: slot,
          capacityConfig,
          demoOrders,
          globalDateExceptions,
        })
      ),
    [selectedDateIso, capacityConfig, demoOrders, globalDateExceptions]
  );

  const ordersBySlot = useMemo(() => {
    const map = new Map<string, DemoOrder[]>();
    for (const slot of DELIVERY_TIME_SLOTS) {
      map.set(slot, []);
    }
    for (const ord of demoOrders) {
      if (ord.scheduledDateIso !== selectedDateIso) continue;
      const list = map.get(ord.timeSlot);
      if (list) list.push(ord);
    }
    return map;
  }, [demoOrders, selectedDateIso]);

  const handleSaveDefaultLimit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseInt(defaultLimitInput, 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      onNotify('error', 'Ingresa un límite base válido entre 0 y 100 cupos.');
      return;
    }
    onUpdateDefaultSlotLimit(parsed);
    onNotify('ok', `Límite base por franja actualizado a ${parsed} cupo(s) por horario.`);
  };

  return (
    <div className="space-y-6">
      {/* Regla compartida y límite base */}
      <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-bold text-[#193B29]">
              Agenda y cupos por fecha y franja
            </h2>
            <p className="text-sm text-[#193B29]/80 max-w-3xl">
              Capacidad compartida entre <strong>pedidos individuales</strong> y <strong>órdenes diarias de planes semanales</strong> (1 cupo = 1 pedido). Al completarse el límite o bloquear una franja, ni la tienda ni los planes pueden agendarla ni reprogramar hacia ella.
            </p>
          </div>

          <form onSubmit={handleSaveDefaultLimit} className="flex items-end gap-2 shrink-0">
            <div>
              <label
                htmlFor="default-slot-limit"
                className="block text-xs font-semibold text-[#28583C] mb-1"
              >
                Cupo base por franja
              </label>
              <input
                id="default-slot-limit"
                type="number"
                min={0}
                max={100}
                value={defaultLimitInput}
                onChange={(e) => setDefaultLimitInput(e.target.value)}
                className="w-24 px-3 py-2 text-sm font-bold tabular-nums bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl cursor-pointer"
            >
              <Sliders className="w-4 h-4" aria-hidden="true" />
              Aplicar base
            </button>
          </form>
        </div>

        {/* Navegación semanal */}
        <div className="space-y-3 pt-2 border-t border-[#234D35]/12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#193B29]">
              <Calendar className="w-4 h-4 text-[#234D35]" aria-hidden="true" />
              <span>{formatSpanishDateLabel(selectedDateIso)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedDateIso(addDaysToIso(selectedDateIso, -7))}
                aria-label="Semana anterior"
                className="p-2 rounded-xl bg-[#DCE8D2] text-[#193B29] hover:bg-[#C6DE8B] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDateIso(todayIso)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#DCE8D2] text-[#193B29] hover:bg-[#C6DE8B] cursor-pointer"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => setSelectedDateIso(addDaysToIso(selectedDateIso, 7))}
                aria-label="Semana siguiente"
                className="p-2 rounded-xl bg-[#DCE8D2] text-[#193B29] hover:bg-[#C6DE8B] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const isSelected = day.iso === selectedDateIso;
              const daySlots = DELIVERY_TIME_SLOTS.map((slot) =>
                evaluateSlotCapacity({
                  dateIso: day.iso,
                  timeSlot: slot,
                  capacityConfig,
                  demoOrders,
                  globalDateExceptions,
                })
              );
              const totalOccupiedDay = daySlots.reduce((s, x) => s + x.occupiedTotal, 0);
              const totalLimitDay = daySlots.reduce((s, x) => s + x.limit, 0);
              const closedSlots = daySlots.filter((s) => !s.canBook).length;

              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => setSelectedDateIso(day.iso)}
                  className={`p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35]'
                      : !day.isRestaurantOpen
                        ? 'bg-[#DCE8D2]/35 text-[#7A2E1D] border-[#7A2E1D]/20'
                        : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15 hover:bg-[#DCE8D2]'
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase">
                    {day.shortDay} {day.dayNumber} {day.monthShort}
                  </p>
                  {!day.isRestaurantOpen ? (
                    <p className="text-[11px] mt-1">Cerrado</p>
                  ) : (
                    <>
                      <p className="font-display text-sm font-bold tabular-nums mt-1">
                        {totalOccupiedDay}/{totalLimitDay} cupos
                      </p>
                      <p className="text-[10px] opacity-85">
                        {closedSlots > 0 ? `${closedSlots} franja(s) cerrada(s)` : 'Todas abiertas'}
                      </p>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detalle por franja para la fecha elegida */}
      <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-xl font-bold text-[#193B29]">
            Franjas horarias del {formatSpanishDateLabel(selectedDateIso)}
          </h3>
          {globalDateExceptions[selectedDateIso] && (
            <span className="px-3 py-1 rounded-xl bg-[#7A2E1D] text-[#EDF3E5] text-xs font-semibold">
              Fecha con excepción global: {globalDateExceptions[selectedDateIso]}
            </span>
          )}
        </div>

        <div className="space-y-4">
          {slotSnapshots.map((snap) => {
            const slotOrders = ordersBySlot.get(snap.timeSlot) ?? [];
            const draftLimit = limitDrafts[snap.key] ?? String(snap.limit);
            const draftReason = reasonDrafts[snap.key] ?? snap.blockReason ?? '';

            return (
              <div
                key={snap.key}
                className="bg-[#DCE8D2]/75 rounded-2xl p-4 sm:p-5 border border-[#234D35]/15 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-bold text-[#193B29] tabular-nums">
                        {snap.timeSlot}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          snap.canBook
                            ? 'bg-[#C6DE8B] text-[#193B29]'
                            : 'bg-[#7A2E1D] text-[#EDF3E5]'
                        }`}
                      >
                        {snap.statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-[#193B29]/85 tabular-nums">
                      Ocupación: <strong>{snap.occupiedTotal}</strong> de <strong>{snap.limit}</strong> cupo(s) ·{' '}
                      Individuales: <strong>{snap.occupiedIndividual}</strong> ·{' '}
                      Planes semanales: <strong>{snap.occupiedPlans}</strong> ·{' '}
                      Disponibles: <strong>{snap.remaining}</strong>
                    </p>
                  </div>

                  {/* Controles de límite y bloqueo */}
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#28583C] mb-1">
                        Límite franja
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        aria-label={`Límite de cupos para ${snap.timeSlot}`}
                        value={draftLimit}
                        onChange={(e) =>
                          setLimitDrafts((prev) => ({ ...prev, [snap.key]: e.target.value }))
                        }
                        className="w-20 px-2.5 py-1.5 text-sm font-bold tabular-nums bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const parsed = Number.parseInt(draftLimit, 10);
                        if (Number.isNaN(parsed) || parsed < 0) {
                          onNotify('error', 'Ingresa un número válido de cupos.');
                          return;
                        }
                        onUpdateSlotRule({
                          dateIso: selectedDateIso,
                          timeSlot: snap.timeSlot,
                          limit: parsed,
                          blocked: snap.manuallyBlocked,
                          blockReason: draftReason.trim() || undefined,
                        });
                        onNotify(
                          'ok',
                          `Cupo de ${selectedDateIso} (${snap.timeSlot}) actualizado a ${parsed}.`
                        );
                      }}
                      className="px-3 py-2 text-xs font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl cursor-pointer"
                    >
                      Guardar cupo
                    </button>

                    <input
                      type="text"
                      value={draftReason}
                      onChange={(e) =>
                        setReasonDrafts((prev) => ({ ...prev, [snap.key]: e.target.value }))
                      }
                      placeholder="Motivo de bloqueo (opcional)"
                      aria-label={`Motivo de bloqueo para ${snap.timeSlot}`}
                      className="px-3 py-1.5 text-xs bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29] w-44"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const parsed = Number.parseInt(draftLimit, 10);
                        const safeLimit = Number.isNaN(parsed) ? snap.limit : Math.max(0, parsed);
                        const nextBlocked = !snap.manuallyBlocked;
                        onUpdateSlotRule({
                          dateIso: selectedDateIso,
                          timeSlot: snap.timeSlot,
                          limit: safeLimit,
                          blocked: nextBlocked,
                          blockReason: nextBlocked
                            ? draftReason.trim() || 'Franja cerrada desde Agenda y cupos'
                            : undefined,
                        });
                        onNotify(
                          'ok',
                          nextBlocked
                            ? `Franja ${snap.timeSlot} bloqueada para ${selectedDateIso}.`
                            : `Franja ${snap.timeSlot} habilitada para ${selectedDateIso}.`
                        );
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                        snap.manuallyBlocked
                          ? 'bg-[#C6DE8B] text-[#193B29] hover:bg-[#b8d375]'
                          : 'bg-[#7A2E1D] text-[#EDF3E5] hover:bg-[#612316]'
                      }`}
                    >
                      {snap.manuallyBlocked ? (
                        <>
                          <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                          Desbloquear franja
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                          Bloquear franja
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {slotOrders.length > 0 && (
                  <div className="bg-[#EDF3E5] rounded-xl p-3 border border-[#234D35]/12 space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#28583C]">
                      Pedidos ocupando cupo en esta franja ({slotOrders.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {slotOrders.map((ord) => (
                        <span
                          key={ord.folio}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[#DCE8D2] text-[#193B29] border border-[#234D35]/15"
                        >
                          <span className="font-mono font-bold text-[#234D35]">{ord.folio}</span>
                          <span>· {ord.customer.customerName}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#234D35]/10 text-[#234D35]">
                            {ord.orderType === 'plan_semanal'
                              ? `Plan (${ord.planPurchaseFolio} · Día ${ord.planDayIndex})`
                              : 'A la carta'}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
