import { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import type { DemoOrder, OrderPrepStatus, Product } from '../../types/product';
import { formatSpanishDateLabel } from '../../utils/meridaDate';
import { formatModalityLabel } from './AdminOrdersTab';

interface AdminKitchenTabProps {
  products: Product[];
  demoOrders: DemoOrder[];
  distinctOrderDates: string[];
  onUpdateOrderPrepStatus: (
    folio: string,
    nextStatus: OrderPrepStatus
  ) => { ok: boolean; error?: string };
  onNotify: (tone: 'ok' | 'error', text: string) => void;
}

const PREP_STEPS: OrderPrepStatus[] = ['Confirmado', 'En preparación', 'Listo'];

export function AdminKitchenTab({
  products,
  demoOrders,
  distinctOrderDates,
  onUpdateOrderPrepStatus,
  onNotify,
}: AdminKitchenTabProps) {
  const [kitchenDateFilter, setKitchenDateFilter] = useState<string>('all');
  const [kitchenStationFilter, setKitchenStationFilter] = useState<string>('all');

  const productStationMap = useMemo(() => {
    const map = new Map<string, Product['kitchen']['prepStation']>();
    for (const p of products) {
      map.set(p.id, p.kitchen.prepStation);
    }
    return map;
  }, [products]);

  const kitchenGroups = useMemo(() => {
    const relevantOrders = demoOrders.filter(
      (ord) => kitchenDateFilter === 'all' || ord.scheduledDateIso === kitchenDateFilter
    );

    const groupMap = new Map<
      string,
      {
        key: string;
        dateIso: string;
        timeSlot: string;
        orders: DemoOrder[];
        dishTotals: Array<{
          productId: string;
          productName: string;
          station: string;
          totalQuantity: number;
        }>;
      }
    >();

    for (const ord of relevantOrders) {
      const matchingItems =
        kitchenStationFilter === 'all'
          ? ord.items
          : ord.items.filter(
              (line) => productStationMap.get(line.productId) === kitchenStationFilter
            );

      if (matchingItems.length === 0) continue;

      const key = `${ord.scheduledDateIso}__${ord.timeSlot}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          dateIso: ord.scheduledDateIso,
          timeSlot: ord.timeSlot,
          orders: [],
          dishTotals: [],
        });
      }
      groupMap.get(key)!.orders.push(ord);
    }

    for (const group of groupMap.values()) {
      const counts = new Map<
        string,
        { productId: string; productName: string; station: string; totalQuantity: number }
      >();

      for (const ord of group.orders) {
        for (const line of ord.items) {
          const station = productStationMap.get(line.productId) ?? 'Cocina caliente';
          if (kitchenStationFilter !== 'all' && station !== kitchenStationFilter) continue;
          const existing = counts.get(line.productId);
          if (existing) {
            existing.totalQuantity += line.quantity;
          } else {
            counts.set(line.productId, {
              productId: line.productId,
              productName: line.productName,
              station,
              totalQuantity: line.quantity,
            });
          }
        }
      }

      group.dishTotals = Array.from(counts.values()).sort(
        (a, b) => b.totalQuantity - a.totalQuantity
      );
    }

    return Array.from(groupMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [demoOrders, kitchenDateFilter, kitchenStationFilter, productStationMap]);

  return (
    <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#193B29]">
            Tablero de Cocina
          </h2>
          <p className="text-sm text-[#193B29]/80">
            Órdenes agrupadas por fecha y franja horaria, con cantidades totales por platillo, modificaciones visibles y estado de preparación.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filtrar cocina por fecha"
            value={kitchenDateFilter}
            onChange={(e) => setKitchenDateFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-[#DCE8D2] border border-[#234D35]/20 rounded-xl text-[#193B29]"
          >
            <option value="all">Todas las fechas</option>
            {distinctOrderDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar cocina por estación"
            value={kitchenStationFilter}
            onChange={(e) => setKitchenStationFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-[#DCE8D2] border border-[#234D35]/20 rounded-xl text-[#193B29]"
          >
            <option value="all">Todas las estaciones</option>
            <option value="Cocina caliente">Cocina caliente</option>
            <option value="Barra fría y ensaladas">Barra fría y ensaladas</option>
            <option value="Barra de jugos y café">Barra de jugos y café</option>
          </select>
        </div>
      </div>

      {kitchenGroups.length === 0 ? (
        <div className="bg-[#DCE8D2]/70 rounded-2xl p-6 border border-[#234D35]/15 space-y-2">
          <p className="font-display text-lg font-bold text-[#193B29]">
            No hay comandas en cocina para este filtro
          </p>
          <p className="text-sm text-[#193B29]/80">
            Confirma un pedido en la tienda o en <strong>Mi pedido</strong> para verlo aquí agrupado automáticamente por fecha y franja horaria.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {kitchenGroups.map((group) => (
            <div
              key={group.key}
              className="bg-[#DCE8D2]/75 rounded-3xl p-5 sm:p-6 border border-[#234D35]/20 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#234D35]/15 pb-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-[#234D35]" aria-hidden="true" />
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#193B29]">
                      {formatSpanishDateLabel(group.dateIso)} · Franja {group.timeSlot}
                    </h3>
                    <p className="text-xs text-[#28583C] font-semibold">
                      {group.orders.length} pedido(s) en esta franja
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#234D35] text-[#EDF3E5] rounded-2xl p-4 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#C6DE8B]">
                  Cantidades totales por platillo en esta fecha y franja
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {group.dishTotals.map((dish) => (
                    <div
                      key={dish.productId}
                      className="bg-[#193B29]/75 rounded-xl px-3.5 py-2.5 border border-[#EDF3E5]/10 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-sm font-bold">{dish.productName}</p>
                        <p className="text-[11px] text-[#DCE8D2]/80">{dish.station}</p>
                      </div>
                      <span className="font-display text-lg font-bold text-[#C6DE8B] tabular-nums shrink-0">
                        {dish.totalQuantity}×
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.orders.map((ord) => {
                  const visibleItems =
                    kitchenStationFilter === 'all'
                      ? ord.items
                      : ord.items.filter(
                          (line) =>
                            productStationMap.get(line.productId) === kitchenStationFilter
                        );

                  return (
                    <div
                      key={ord.folio}
                      className="bg-[#EDF3E5] rounded-2xl p-4 sm:p-5 border border-[#234D35]/15 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2 border-b border-[#234D35]/10 pb-2.5">
                          <div>
                            <p className="font-mono text-xs font-bold text-[#28583C]">
                              {ord.folio}
                            </p>
                            <p className="font-display text-base font-bold text-[#193B29]">
                              {ord.customer.customerName}
                            </p>
                            <p className="text-xs text-[#193B29]/75">
                              {formatModalityLabel(ord.fulfillmentMode)}
                              {ord.fulfillmentMode === 'dine_in' && ord.customer.tableNumber
                                ? ` · Mesa ${ord.customer.tableNumber}`
                                : ''}
                            </p>
                            {ord.orderType === 'plan_semanal' && ord.planPurchaseFolio && (
                              <p className="text-[11px] font-bold text-[#234D35] mt-0.5">
                                Plan {ord.planPurchaseFolio} · Día {ord.planDayIndex}/{ord.planTotalDays}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                              ord.prepStatus === 'Listo'
                                ? 'bg-[#C6DE8B] text-[#193B29]'
                                : ord.prepStatus === 'En preparación'
                                  ? 'bg-[#28583C] text-[#EDF3E5]'
                                  : 'bg-[#DCE8D2] text-[#193B29]'
                            }`}
                          >
                            {ord.prepStatus}
                          </span>
                        </div>

                        <ul className="space-y-2.5">
                          {visibleItems.map((line) => (
                            <li
                              key={line.uid}
                              className="bg-[#DCE8D2]/60 rounded-xl p-3 border border-[#234D35]/10 space-y-1"
                            >
                              <p className="text-sm font-bold text-[#193B29]">
                                {line.quantity}× {line.productName}
                              </p>
                              <p className="text-[11px] font-semibold text-[#28583C]">
                                Estación: {productStationMap.get(line.productId) ?? 'Cocina'}
                              </p>
                              {line.selectedCustomizations.length > 0 ? (
                                <div className="pt-1 space-y-0.5 text-xs text-[#193B29]">
                                  {line.selectedCustomizations.map((c) => (
                                    <p key={c.groupId} className="font-medium">
                                      <span className="text-[#234D35] font-bold">
                                        Modificación — {c.groupLabel}:
                                      </span>{' '}
                                      {c.optionLabels.join(', ')}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-[#193B29]/65">
                                  Sin modificaciones adicionales
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>

                        {ord.customer.orderNotes && (
                          <div className="rounded-xl bg-[#C6DE8B]/40 border border-[#234D35]/20 px-3 py-2 text-xs text-[#193B29]">
                            <strong>Observación cliente:</strong> {ord.customer.orderNotes}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#234D35]/10 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#28583C]">
                          Cambiar preparación:
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {PREP_STEPS.map((step) => {
                            const active = ord.prepStatus === step;
                            return (
                              <button
                                key={step}
                                type="button"
                                onClick={() => {
                                  const res = onUpdateOrderPrepStatus(ord.folio, step);
                                  if (res.ok) {
                                    onNotify('ok', `Cocina: ${ord.folio} marcado como "${step}".`);
                                  }
                                }}
                                className={`px-2.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#234D35] text-[#C6DE8B] border-[#234D35]'
                                    : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/20 hover:bg-[#C6DE8B]/60'
                                }`}
                              >
                                {step}
                              </button>
                            );
                          })}
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
  );
}
