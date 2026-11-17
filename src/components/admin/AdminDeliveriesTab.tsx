import { useMemo, useState } from 'react';
import { AlertTriangle, Lock, Search, Truck } from 'lucide-react';
import type {
  DeliveryTrackingInfo,
  DemoOrder,
  OrderDeliveryStatus,
} from '../../types/product';
import { MERIDA_TIMEZONE } from '../../utils/meridaDate';
import { DELIVERY_TIME_SLOTS } from '../../utils/pricing';
import { formatModalityLabel, formatOrderObservations } from './AdminOrdersTab';

interface AdminDeliveriesTabProps {
  demoOrders: DemoOrder[];
  onAssignDeliveryTurboDemo: (folio: string) => { ok: boolean; error?: string };
  onUpdateDeliveryStatus: (
    folio: string,
    nextStatus: OrderDeliveryStatus,
    trackingPatch?: Partial<DeliveryTrackingInfo>
  ) => { ok: boolean; error?: string };
  onNotify: (tone: 'ok' | 'error', text: string) => void;
}

function getMeridaTimeInputNow(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: MERIDA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

export function AdminDeliveriesTab({
  demoOrders,
  onAssignDeliveryTurboDemo,
  onUpdateDeliveryStatus,
  onNotify,
}: AdminDeliveriesTabProps) {
  const [folioLookupQuery, setFolioLookupQuery] = useState<string>('');
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, DeliveryTrackingInfo>>({});

  const deliveryOrdersBySlot = useMemo(() => {
    const onlyDeliveries = demoOrders.filter((ord) => ord.fulfillmentMode === 'delivery');
    const slotMap = new Map<string, DemoOrder[]>();
    for (const slot of DELIVERY_TIME_SLOTS) {
      slotMap.set(slot, []);
    }
    for (const ord of onlyDeliveries) {
      const existing = slotMap.get(ord.timeSlot);
      if (existing) {
        existing.push(ord);
      } else {
        slotMap.set(ord.timeSlot, [ord]);
      }
    }
    return Array.from(slotMap.entries()).filter(([, orders]) => orders.length > 0);
  }, [demoOrders]);

  const folioLookupOrder = useMemo(() => {
    const q = folioLookupQuery.trim().toLowerCase();
    if (!q) return null;
    return demoOrders.find((o) => o.folio.toLowerCase().includes(q)) ?? null;
  }, [demoOrders, folioLookupQuery]);

  const getTrackingForm = (order: DemoOrder): DeliveryTrackingInfo => {
    if (trackingDrafts[order.folio]) return trackingDrafts[order.folio];
    return (
      order.deliveryTracking ?? {
        assignedToTurboDemo: order.deliveryStatus !== 'Por asignar (Turbo Mandados)',
        receivedBy: order.customer.receiverName || order.customer.customerName || '',
        deliveryPlace:
          [
            order.customer.hospital,
            order.customer.building,
            order.customer.area,
            order.customer.address,
          ]
            .filter(Boolean)
            .join(' · ') || '',
        deliveryDateIso: order.scheduledDateIso,
        deliveryTime: getMeridaTimeInputNow(),
        observations: '',
      }
    );
  };

  const patchTrackingForm = (
    folio: string,
    order: DemoOrder,
    patch: Partial<DeliveryTrackingInfo>
  ) => {
    const base = getTrackingForm(order);
    setTrackingDrafts((prev) => ({
      ...prev,
      [folio]: { ...base, ...patch },
    }));
  };

  const handleDeliveryAction = (order: DemoOrder, nextStatus: OrderDeliveryStatus) => {
    const form = getTrackingForm(order);
    const res = onUpdateDeliveryStatus(order.folio, nextStatus, form);
    if (!res.ok) {
      onNotify('error', res.error || 'No se pudo actualizar el estado de entrega.');
      return;
    }
    onNotify('ok', `Pedido ${order.folio} actualizado a estado de entrega: ${nextStatus}.`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#234D35] text-[#EDF3E5] rounded-2xl p-4 sm:p-5 border border-[#C6DE8B]/25 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#C6DE8B] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs sm:text-sm space-y-1">
          <p className="font-bold text-[#C6DE8B]">
            Despacho demostrativo · Sin GPS ni repartidores ficticios
          </p>
          <p className="text-[#DCE8D2]">
            Las asignaciones a Turbo Mandados y los cambios de estado se registran localmente para validar el flujo operativo. No se muestran mapas GPS simulados ni nombres de repartidores inventados. No es posible iniciar recolección hasta que Cocina marque el pedido como <strong>Listo</strong>.
          </p>
        </div>
      </div>

      {/* Consulta de seguimiento por folio */}
      <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-6 border border-[#234D35]/15 space-y-4">
        <h2 className="font-display text-xl font-bold text-[#193B29]">
          Consultar seguimiento por folio
        </h2>
        <div className="relative">
          <Search
            className="w-4 h-4 text-[#234D35]/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={folioLookupQuery}
            onChange={(e) => setFolioLookupQuery(e.target.value)}
            placeholder="Escribe el folio (ej. NUT-...)"
            aria-label="Consultar seguimiento por folio"
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
          />
        </div>

        {folioLookupQuery.trim() && !folioLookupOrder && (
          <p className="text-sm text-[#7A2E1D] font-medium">
            No se encontró ningún pedido con el folio "{folioLookupQuery}".
          </p>
        )}

        {folioLookupOrder && (
          <div className="bg-[#DCE8D2]/80 rounded-2xl p-4 sm:p-5 border border-[#234D35]/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-bold text-[#28583C]">
                  {folioLookupOrder.folio}
                </p>
                <p className="font-display text-lg font-bold text-[#193B29]">
                  {folioLookupOrder.customer.customerName} ·{' '}
                  {formatModalityLabel(folioLookupOrder.fulfillmentMode)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-[#EDF3E5] text-[#234D35]">
                  Cocina: {folioLookupOrder.prepStatus}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#234D35] text-[#C6DE8B]">
                  Entrega: {folioLookupOrder.deliveryStatus}
                </span>
              </div>
            </div>

            {folioLookupOrder.deliveryTracking && (
              <div className="bg-[#EDF3E5] rounded-xl p-3 text-xs space-y-1 text-[#193B29]">
                <p>
                  <strong>Proveedor demo:</strong>{' '}
                  {folioLookupOrder.deliveryTracking.assignedToTurboDemo
                    ? `Turbo Mandados (${folioLookupOrder.deliveryTracking.assignedAtDisplay || 'Asignado'})`
                    : 'Sin asignar'}
                </p>
                {folioLookupOrder.deliveryTracking.receivedBy && (
                  <p>
                    <strong>Quién recibió:</strong> {folioLookupOrder.deliveryTracking.receivedBy}
                  </p>
                )}
                {folioLookupOrder.deliveryTracking.deliveryPlace && (
                  <p>
                    <strong>Lugar:</strong> {folioLookupOrder.deliveryTracking.deliveryPlace}
                  </p>
                )}
                {folioLookupOrder.deliveryTracking.deliveryDateIso && (
                  <p>
                    <strong>Fecha y hora registradas:</strong>{' '}
                    {folioLookupOrder.deliveryTracking.deliveryDateIso}{' '}
                    {folioLookupOrder.deliveryTracking.deliveryTime}
                  </p>
                )}
                {folioLookupOrder.deliveryTracking.observations && (
                  <p>
                    <strong>Observaciones:</strong> {folioLookupOrder.deliveryTracking.observations}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Entregas agrupadas por franja */}
      <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#193B29]">
            Entregas a domicilio agrupadas por franja
          </h2>
          <p className="text-sm text-[#193B29]/80">
            Asigna demostrativamente a Turbo Mandados, gestiona el avance de entrega y registra quién recibió.
          </p>
        </div>

        {deliveryOrdersBySlot.length === 0 ? (
          <div className="bg-[#DCE8D2]/70 rounded-2xl p-6 border border-[#234D35]/15 space-y-2">
            <p className="font-display text-lg font-bold text-[#193B29]">
              Aún no hay pedidos a domicilio registrados
            </p>
            <p className="text-sm text-[#193B29]/80">
              Cuando confirmes un pedido en modalidad <strong>A domicilio</strong> desde la tienda o <strong>Mi pedido</strong>, aparecerá aquí agrupado por su franja horaria.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {deliveryOrdersBySlot.map(([slot, orders]) => (
              <div
                key={slot}
                className="bg-[#DCE8D2]/70 rounded-3xl p-5 border border-[#234D35]/15 space-y-4"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#234D35]/15 pb-3">
                  <h3 className="font-display text-xl font-bold text-[#193B29]">
                    Franja {slot}
                  </h3>
                  <span className="text-xs font-bold px-3 py-1 rounded-xl bg-[#234D35] text-[#C6DE8B] tabular-nums">
                    {orders.length} entrega(s)
                  </span>
                </div>

                <div className="space-y-4">
                  {orders.map((ord) => {
                    const isKitchenReady = ord.prepStatus === 'Listo';
                    const form = getTrackingForm(ord);
                    const isAssignedTurbo =
                      ord.deliveryTracking?.assignedToTurboDemo ||
                      ord.deliveryStatus !== 'Por asignar (Turbo Mandados)';

                    return (
                      <div
                        key={ord.folio}
                        className="bg-[#EDF3E5] rounded-2xl p-5 border border-[#234D35]/15 space-y-4"
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-[#234D35]/10 pb-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#28583C]">
                                {ord.folio}
                              </span>
                              <span className="text-xs text-[#193B29]/70">
                                · {ord.scheduledDateIso}
                              </span>
                              <span className="text-xs font-semibold text-[#234D35]">
                                · {ord.distanceKm ?? 0} km
                              </span>
                              {ord.orderType === 'plan_semanal' && ord.planPurchaseFolio && (
                                <span className="px-2 py-0.5 rounded-lg bg-[#234D35] text-[#C6DE8B] text-[11px] font-bold">
                                  Entrega de Plan {ord.planPurchaseFolio} · Día {ord.planDayIndex}/{ord.planTotalDays}
                                </span>
                              )}
                            </div>
                            <p className="font-display text-lg font-bold text-[#193B29]">
                              {ord.customer.customerName} ({ord.customer.customerPhone})
                            </p>
                            <p className="text-xs sm:text-sm text-[#193B29]/85">
                              <strong>Dirección:</strong> {ord.customer.address}
                            </p>
                            {formatOrderObservations(ord).length > 0 && (
                              <p className="text-xs text-[#193B29]/75">
                                {formatOrderObservations(ord).join(' · ')}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs font-bold shrink-0">
                            <span
                              className={`px-3 py-1 rounded-xl ${
                                isKitchenReady
                                  ? 'bg-[#C6DE8B] text-[#193B29]'
                                  : 'bg-[#7A2E1D]/15 text-[#7A2E1D]'
                              }`}
                            >
                              Cocina: {ord.prepStatus}
                            </span>
                            <span className="px-3 py-1 rounded-xl bg-[#234D35] text-[#EDF3E5]">
                              Entrega: {ord.deliveryStatus}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const res = onAssignDeliveryTurboDemo(ord.folio);
                                if (res.ok) {
                                  onNotify(
                                    'ok',
                                    `Pedido ${ord.folio} asignado demostrativamente a Turbo Mandados.`
                                  );
                                }
                              }}
                              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                                isAssignedTurbo
                                  ? 'bg-[#C6DE8B] text-[#193B29] border-[#234D35]/20'
                                  : 'bg-[#28583C] text-[#EDF3E5] border-[#28583C] hover:bg-[#1e432d]'
                              }`}
                            >
                              <Truck className="w-4 h-4" aria-hidden="true" />
                              {isAssignedTurbo
                                ? 'Asignado a Turbo Mandados (Demo)'
                                : 'Asignar demostrativamente a Turbo Mandados'}
                            </button>

                            {!isKitchenReady && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7A2E1D]">
                                <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                Recolección bloqueada hasta que Cocina marque "Listo"
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                'Asignado',
                                'Recolectado',
                                'En camino',
                                'Entregado',
                                'Incidencia',
                              ] as OrderDeliveryStatus[]
                            ).map((statusOption) => {
                              const requiresKitchenReady =
                                statusOption === 'Recolectado' ||
                                statusOption === 'En camino' ||
                                statusOption === 'Entregado';
                              const disabled = requiresKitchenReady && !isKitchenReady;
                              const active = ord.deliveryStatus === statusOption;

                              return (
                                <button
                                  key={statusOption}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => handleDeliveryAction(ord, statusOption)}
                                  className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors ${
                                    disabled
                                      ? 'bg-[#DCE8D2]/40 text-[#193B29]/40 border-[#234D35]/10 cursor-not-allowed'
                                      : active
                                        ? statusOption === 'Incidencia'
                                          ? 'bg-[#7A2E1D] text-[#EDF3E5] border-[#7A2E1D] cursor-pointer'
                                          : 'bg-[#234D35] text-[#C6DE8B] border-[#234D35] cursor-pointer'
                                        : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/20 hover:bg-[#C6DE8B]/50 cursor-pointer'
                                  }`}
                                >
                                  {statusOption}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="bg-[#DCE8D2]/55 rounded-2xl p-4 border border-[#234D35]/12 space-y-3">
                          <p className="text-xs font-bold text-[#234D35]">
                            Registro de entrega / recepción / incidencia
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-[#193B29]">
                                Quién recibió
                              </label>
                              <input
                                type="text"
                                value={form.receivedBy}
                                onChange={(e) =>
                                  patchTrackingForm(ord.folio, ord, {
                                    receivedBy: e.target.value,
                                  })
                                }
                                placeholder="Nombre de quien recibe"
                                className="w-full px-3 py-1.5 text-xs bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-[#193B29]">
                                Lugar de entrega
                              </label>
                              <input
                                type="text"
                                value={form.deliveryPlace}
                                onChange={(e) =>
                                  patchTrackingForm(ord.folio, ord, {
                                    deliveryPlace: e.target.value,
                                  })
                                }
                                placeholder="Domicilio, recepción, hospital..."
                                className="w-full px-3 py-1.5 text-xs bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-[#193B29]">
                                Fecha de entrega
                              </label>
                              <input
                                type="date"
                                value={form.deliveryDateIso}
                                onChange={(e) =>
                                  patchTrackingForm(ord.folio, ord, {
                                    deliveryDateIso: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-1.5 text-xs bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-[#193B29]">
                                Hora
                              </label>
                              <input
                                type="time"
                                value={form.deliveryTime}
                                onChange={(e) =>
                                  patchTrackingForm(ord.folio, ord, {
                                    deliveryTime: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-1.5 text-xs bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={form.observations}
                              onChange={(e) =>
                                patchTrackingForm(ord.folio, ord, {
                                  observations: e.target.value,
                                })
                              }
                              placeholder="Observaciones de entrega o detalle de incidencia..."
                              className="flex-1 px-3 py-2 text-xs bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeliveryAction(ord, ord.deliveryStatus)}
                              className="px-4 py-2 text-xs font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl cursor-pointer shrink-0"
                            >
                              Guardar datos de recepción
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
