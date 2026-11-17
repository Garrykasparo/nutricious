import { useMemo, useState } from 'react';
import { Download, Search, ShoppingBag } from 'lucide-react';
import type {
  DemoOrder,
  OrderFulfillmentMode,
  OrderType,
} from '../../types/product';
import { formatSpanishDateLabel, getMeridaTodayIso } from '../../utils/meridaDate';
import { DELIVERY_TIME_SLOTS, formatCentsMXN } from '../../utils/pricing';
import type { AppView } from '../MobileBottomBar';

interface AdminOrdersTabProps {
  demoOrders: DemoOrder[];
  distinctOrderDates: string[];
  onNavigateView: (view: AppView) => void;
  onNotify: (tone: 'ok' | 'error', text: string) => void;
}

export function formatModalityLabel(mode: OrderFulfillmentMode): string {
  if (mode === 'delivery') return 'A domicilio';
  if (mode === 'pickup') return 'Recoger en tienda';
  return 'Consumir en restaurante';
}

export function formatOrderTypeLabel(orderType: OrderType): string {
  return orderType === 'plan_semanal' ? 'Plan semanal' : 'A la carta';
}

export function formatOrderObservations(order: DemoOrder): string[] {
  const obs: string[] = [];
  if (order.customer.orderNotes) obs.push(`Nota cliente: ${order.customer.orderNotes}`);
  if (order.fulfillmentMode === 'delivery') {
    if (order.customer.references) obs.push(`Referencias: ${order.customer.references}`);
    if (order.customer.isSpecialLocation) {
      const parts = [
        order.customer.building ? `Edificio: ${order.customer.building}` : '',
        order.customer.hospital ? `Hospital: ${order.customer.hospital}` : '',
        order.customer.area ? `Área: ${order.customer.area}` : '',
        order.customer.receiverName ? `Recibe: ${order.customer.receiverName}` : '',
      ].filter(Boolean);
      if (parts.length > 0) obs.push(parts.join(' · '));
    }
  }
  if (order.fulfillmentMode === 'dine_in' && order.customer.tableNumber) {
    obs.push(`Mesa: ${order.customer.tableNumber}`);
  }
  if (order.customer.cashPaidWith) {
    obs.push(`Paga en efectivo con: ${order.customer.cashPaidWith}`);
  }
  return obs;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function AdminOrdersTab({
  demoOrders,
  distinctOrderDates,
  onNavigateView,
  onNotify,
}: AdminOrdersTabProps) {
  const [orderSearch, setOrderSearch] = useState('');
  const [orderDateFilter, setOrderDateFilter] = useState<string>('all');
  const [orderSlotFilter, setOrderSlotFilter] = useState<string>('all');
  const [orderModalityFilter, setOrderModalityFilter] = useState<'all' | OrderFulfillmentMode>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | OrderType>('all');
  const [orderStateFilter, setOrderStateFilter] = useState<string>('all');
  const [selectedOrderFolio, setSelectedOrderFolio] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return demoOrders.filter((ord) => {
      if (orderDateFilter !== 'all' && ord.scheduledDateIso !== orderDateFilter) return false;
      if (orderSlotFilter !== 'all' && ord.timeSlot !== orderSlotFilter) return false;
      if (orderModalityFilter !== 'all' && ord.fulfillmentMode !== orderModalityFilter) return false;
      if (orderTypeFilter !== 'all' && ord.orderType !== orderTypeFilter) return false;

      if (orderStateFilter !== 'all') {
        const matchesState =
          ord.prepStatus === orderStateFilter ||
          ord.deliveryStatus === orderStateFilter ||
          ord.paymentStatus === orderStateFilter;
        if (!matchesState) return false;
      }

      if (!q) return true;
      return (
        ord.folio.toLowerCase().includes(q) ||
        ord.customer.customerName.toLowerCase().includes(q) ||
        ord.customer.customerPhone.toLowerCase().includes(q)
      );
    });
  }, [
    demoOrders,
    orderSearch,
    orderDateFilter,
    orderSlotFilter,
    orderModalityFilter,
    orderTypeFilter,
    orderStateFilter,
  ]);

  const activeOrderDetail = useMemo(() => {
    if (selectedOrderFolio) {
      return filteredOrders.find((o) => o.folio === selectedOrderFolio) ?? filteredOrders[0] ?? null;
    }
    return filteredOrders[0] ?? null;
  }, [filteredOrders, selectedOrderFolio]);

  const handleExportFilteredCsv = () => {
    const headers = [
      'Folio',
      'Fecha programada',
      'Franja horaria',
      'Modalidad',
      'Tipo',
      'Cliente',
      'Telefono',
      'Ubicacion / Mesa',
      'Productos y opciones',
      'Observaciones',
      'Subtotal MXN',
      'Cuota 4% MXN',
      'Envio MXN',
      'Total MXN',
      'Estado pago',
      'Estado preparacion',
      'Estado entrega',
    ];

    const rows = filteredOrders.map((ord) => {
      const locationText =
        ord.fulfillmentMode === 'delivery'
          ? ord.customer.address
          : ord.fulfillmentMode === 'dine_in'
            ? `Mesa ${ord.customer.tableNumber}`
            : 'Recoger en tienda';
      const itemsText = ord.items
        .map((line) => {
          const customs = line.selectedCustomizations
            .filter((c) => c.optionLabels.length > 0)
            .map((c) => `${c.groupLabel}: ${c.optionLabels.join('/')}`)
            .join('; ');
          return `${line.quantity}x ${line.productName}${customs ? ` (${customs})` : ''}`;
        })
        .join(' | ');
      const obsText = formatOrderObservations(ord).join(' | ');

      return [
        ord.folio,
        ord.scheduledDateIso,
        ord.timeSlot,
        formatModalityLabel(ord.fulfillmentMode),
        formatOrderTypeLabel(ord.orderType),
        ord.customer.customerName,
        ord.customer.customerPhone,
        locationText,
        itemsText,
        obsText,
        (ord.pricingSnapshot.subtotalCents / 100).toFixed(2),
        (ord.pricingSnapshot.serviceFeeCents / 100).toFixed(2),
        (ord.pricingSnapshot.deliveryFeeCents / 100).toFixed(2),
        (ord.pricingSnapshot.totalCents / 100).toFixed(2),
        ord.paymentStatus,
        ord.prepStatus,
        ord.deliveryStatus,
      ]
        .map(escapeCsvCell)
        .join(',');
    });

    const csvContent = `\uFEFF${[headers.map(escapeCsvCell).join(','), ...rows].join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `nutricious-pedidos-${getMeridaTodayIso()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onNotify('ok', `Se exportaron ${filteredOrders.length} pedido(s) filtrado(s) a CSV.`);
  };

  return (
    <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#193B29]">
            Gestión de Pedidos
          </h2>
          <p className="text-sm text-[#193B29]/80">
            Busca por folio o cliente, filtra por fecha, franja, modalidad, tipo y estado, y exporta los resultados a CSV.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportFilteredCsv}
          disabled={filteredOrders.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] disabled:opacity-45 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Exportar CSV ({filteredOrders.length})
        </button>
      </div>

      {/* Resumen contable de órdenes filtradas sin doble conteo */}
      <div className="bg-[#DCE8D2]/70 rounded-2xl p-3.5 border border-[#234D35]/15 flex flex-wrap items-center justify-between gap-3 text-xs text-[#193B29]">
        <span>
          <strong>Suma de órdenes listadas (sin doble conteo con registros de plan):</strong>{' '}
          {formatCentsMXN(
            filteredOrders.reduce((s, o) => s + o.pricingSnapshot.totalCents, 0)
          )}
        </span>
        <span className="text-[#28583C] font-semibold">
          A la carta: {filteredOrders.filter((o) => o.orderType === 'a_la_carta').length} · Órdenes diarias de plan:{' '}
          {filteredOrders.filter((o) => o.orderType === 'plan_semanal').length}
        </span>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2 relative">
          <Search
            className="w-4 h-4 text-[#234D35]/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            placeholder="Buscar por folio, nombre o teléfono..."
            aria-label="Buscar pedidos por folio o cliente"
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
          />
        </div>

        <select
          aria-label="Filtrar por fecha"
          value={orderDateFilter}
          onChange={(e) => setOrderDateFilter(e.target.value)}
          className="px-3 py-2.5 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
        >
          <option value="all">Todas las fechas</option>
          {distinctOrderDates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por franja horaria"
          value={orderSlotFilter}
          onChange={(e) => setOrderSlotFilter(e.target.value)}
          className="px-3 py-2.5 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
        >
          <option value="all">Todas las franjas</option>
          {DELIVERY_TIME_SLOTS.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por modalidad"
          value={orderModalityFilter}
          onChange={(e) =>
            setOrderModalityFilter(e.target.value as 'all' | OrderFulfillmentMode)
          }
          className="px-3 py-2.5 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
        >
          <option value="all">Todas las modalidades</option>
          <option value="delivery">A domicilio</option>
          <option value="pickup">Recoger en tienda</option>
          <option value="dine_in">Consumir en restaurante</option>
        </select>

        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Filtrar por tipo de pedido"
            value={orderTypeFilter}
            onChange={(e) => setOrderTypeFilter(e.target.value as 'all' | OrderType)}
            className="px-2.5 py-2.5 text-xs sm:text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
          >
            <option value="all">Tipo: Todos</option>
            <option value="a_la_carta">A la carta</option>
            <option value="plan_semanal">Plan semanal</option>
          </select>

          <select
            aria-label="Filtrar por estado"
            value={orderStateFilter}
            onChange={(e) => setOrderStateFilter(e.target.value)}
            className="px-2.5 py-2.5 text-xs sm:text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
          >
            <option value="all">Estado: Todos</option>
            <option value="Confirmado">Cocina: Confirmado</option>
            <option value="En preparación">Cocina: En preparación</option>
            <option value="Listo">Cocina: Listo</option>
            <option value="Por asignar (Turbo Mandados)">Entrega: Por asignar</option>
            <option value="Asignado">Entrega: Asignado</option>
            <option value="Recolectado">Entrega: Recolectado</option>
            <option value="En camino">Entrega: En camino</option>
            <option value="Entregado">Entrega: Entregado</option>
            <option value="Incidencia">Entrega: Incidencia</option>
            <option value="Pagado (demo)">Pago: Pagado (demo)</option>
          </select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-[#DCE8D2]/70 rounded-2xl p-6 border border-[#234D35]/15 space-y-3">
          <p className="font-display text-lg font-bold text-[#193B29]">
            No hay pedidos con estos filtros
          </p>
          <p className="text-sm text-[#193B29]/80">
            Crea un pedido desde la tienda o desde <strong>Mi pedido</strong> y aparecerá aquí inmediatamente, así como en Cocina y Entregas.
          </p>
          <button
            type="button"
            onClick={() => onNavigateView('mi-pedido')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#28583C] text-[#EDF3E5] rounded-xl cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            Ir a crear un pedido en Mi pedido
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
            {filteredOrders.map((ord) => {
              const isSelected = activeOrderDetail?.folio === ord.folio;
              return (
                <button
                  key={ord.folio}
                  type="button"
                  onClick={() => setSelectedOrderFolio(ord.folio)}
                  className={`w-full text-left p-4 rounded-2xl border transition-colors cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35]'
                      : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15 hover:bg-[#C6DE8B]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-bold tabular-nums">{ord.folio}</p>
                      <p className="font-display text-base font-bold">
                        {ord.customer.customerName}
                      </p>
                    </div>
                    <span className="font-display text-base font-bold tabular-nums shrink-0">
                      {formatCentsMXN(ord.pricingSnapshot.totalCents)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-90">
                    <span>{ord.scheduledDateIso}</span>
                    <span>· {ord.timeSlot}</span>
                    <span>· {formatModalityLabel(ord.fulfillmentMode)}</span>
                    <span>· {formatOrderTypeLabel(ord.orderType)}</span>
                  </div>
                  {ord.orderType === 'plan_semanal' && ord.planPurchaseFolio && (
                    <p
                      className={`text-[11px] font-semibold ${
                        isSelected ? 'text-[#C6DE8B]' : 'text-[#28583C]'
                      }`}
                    >
                      Plan {ord.planPurchaseFolio} · Día {ord.planDayIndex} de {ord.planTotalDays}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    <span
                      className={`px-2 py-0.5 rounded-lg ${
                        isSelected ? 'bg-[#193B29] text-[#C6DE8B]' : 'bg-[#EDF3E5] text-[#234D35]'
                      }`}
                    >
                      Cocina: {ord.prepStatus}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg ${
                        isSelected ? 'bg-[#193B29] text-[#EDF3E5]' : 'bg-[#EDF3E5] text-[#193B29]'
                      }`}
                    >
                      Entrega: {ord.deliveryStatus}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeOrderDetail && (
            <div className="lg:col-span-7 bg-[#DCE8D2]/75 rounded-2xl p-5 sm:p-6 border border-[#234D35]/15 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#234D35]/15 pb-4">
                <div>
                  <p className="font-mono text-xs font-bold text-[#28583C]">
                    {activeOrderDetail.folio} · {formatOrderTypeLabel(activeOrderDetail.orderType)}
                  </p>
                  <h3 className="font-display text-2xl font-bold text-[#193B29]">
                    {activeOrderDetail.customer.customerName}
                  </h3>
                  <p className="text-sm text-[#193B29]/80">
                    Tel: {activeOrderDetail.customer.customerPhone} ·{' '}
                    {formatSpanishDateLabel(activeOrderDetail.scheduledDateIso)} (
                    {activeOrderDetail.timeSlot})
                  </p>
                </div>
                <div className="text-right text-xs space-y-1">
                  <p className="font-semibold text-[#234D35]">
                    {formatModalityLabel(activeOrderDetail.fulfillmentMode)}
                  </p>
                  <p className="text-[#193B29]/75">
                    Registrado: {activeOrderDetail.createdAtDisplay}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-[#EDF3E5] rounded-xl p-3 border border-[#234D35]/10">
                  <p className="text-[#28583C] font-semibold">Pago</p>
                  <p className="font-bold text-[#193B29] mt-0.5">
                    {activeOrderDetail.paymentStatus}
                  </p>
                </div>
                <div className="bg-[#EDF3E5] rounded-xl p-3 border border-[#234D35]/10">
                  <p className="text-[#28583C] font-semibold">Preparación (Cocina)</p>
                  <p className="font-bold text-[#193B29] mt-0.5">
                    {activeOrderDetail.prepStatus}
                  </p>
                </div>
                <div className="bg-[#EDF3E5] rounded-xl p-3 border border-[#234D35]/10">
                  <p className="text-[#28583C] font-semibold">Entrega</p>
                  <p className="font-bold text-[#193B29] mt-0.5">
                    {activeOrderDetail.deliveryStatus}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-display text-base font-bold text-[#193B29]">
                  Productos y opciones aplicadas
                </h4>
                <div className="space-y-2">
                  {activeOrderDetail.items.map((line) => (
                    <div
                      key={line.uid}
                      className="bg-[#EDF3E5] rounded-xl p-3 border border-[#234D35]/10 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-[#193B29]">
                          {line.quantity}x {line.productName}{' '}
                          <span className="font-mono text-xs font-normal text-[#28583C]">
                            ({line.sku})
                          </span>
                        </p>
                        {line.selectedCustomizations.length > 0 && (
                          <ul className="text-xs text-[#193B29]/85 space-y-0.5">
                            {line.selectedCustomizations.map((c) => (
                              <li key={c.groupId}>
                                <strong>{c.groupLabel}:</strong> {c.optionLabels.join(', ')}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display font-bold text-sm text-[#234D35] tabular-nums">
                          {formatCentsMXN(line.lineTotalCents)}
                        </p>
                        <p className="text-[11px] text-[#193B29]/70 tabular-nums">
                          {formatCentsMXN(line.appliedUnitPriceCents)} c/u
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#EDF3E5] rounded-xl p-4 border border-[#234D35]/10 space-y-1.5 text-xs sm:text-sm">
                <p className="font-display font-bold text-[#193B29]">
                  Observaciones y datos de entrega
                </p>
                {activeOrderDetail.fulfillmentMode === 'delivery' && (
                  <p className="text-[#193B29]/90">
                    <strong>Dirección:</strong> {activeOrderDetail.customer.address}{' '}
                    {activeOrderDetail.distanceKm !== null
                      ? `(${activeOrderDetail.distanceKm} km)`
                      : ''}
                  </p>
                )}
                {formatOrderObservations(activeOrderDetail).length > 0 ? (
                  formatOrderObservations(activeOrderDetail).map((obs, idx) => (
                    <p key={idx} className="text-[#193B29]/85">
                      {obs}
                    </p>
                  ))
                ) : (
                  <p className="text-[#193B29]/65">Sin observaciones adicionales.</p>
                )}
              </div>

              <div className="bg-[#234D35] text-[#EDF3E5] rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#DCE8D2]">Subtotal de productos</span>
                  <span className="tabular-nums font-semibold">
                    {formatCentsMXN(activeOrderDetail.pricingSnapshot.subtotalCents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#DCE8D2]">Cuota de servicio (4%)</span>
                  <span className="tabular-nums font-semibold">
                    {formatCentsMXN(activeOrderDetail.pricingSnapshot.serviceFeeCents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#DCE8D2]">Envío Turbo Mandados</span>
                  <span className="tabular-nums font-semibold">
                    {formatCentsMXN(activeOrderDetail.pricingSnapshot.deliveryFeeCents)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#EDF3E5]/15 font-display text-lg font-bold text-[#C6DE8B]">
                  <span>Total aplicado</span>
                  <span className="tabular-nums">
                    {formatCentsMXN(activeOrderDetail.pricingSnapshot.totalCents)} MXN
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
