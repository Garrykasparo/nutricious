import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  Receipt,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  UtensilsCrossed,
} from 'lucide-react';
import { DEFAULT_CAPACITY_CONFIG, GLOBAL_DATE_EXCEPTIONS } from '../data/menuData';
import type {
  CapacityScheduleConfig,
  CustomerCheckoutInfo,
  DemoOrder,
  DemoPaymentMethod,
  DraftOrderItem,
  OrderFulfillmentMode,
  Product,
} from '../types/product';
import { evaluateSlotCapacity } from '../utils/capacityAndPlans';
import {
  addDaysToIso,
  evaluateProductAvailability,
  formatSpanishDateLabel,
  getDayOfWeekFromIso,
  getMeridaTodayIso,
  getMondayOfWeekIso,
  getWeekDaysFromMonday,
} from '../utils/meridaDate';
import {
  calculateOrderBreakdownCents,
  DELIVERY_TIME_SLOTS,
  formatCentsMXN,
  mxnToCents,
  TURBO_MANDADOS_RULES,
} from '../utils/pricing';
import type { AppView } from './MobileBottomBar';
import { ResilientImage } from './ResilientImage';

export interface ConfirmOrderPayload {
  idempotencyKey: string;
  scheduledDateIso: string;
  timeSlot: string;
  fulfillmentMode: OrderFulfillmentMode;
  distanceKm: number;
  paymentMethod: DemoPaymentMethod;
  customer: CustomerCheckoutInfo;
}

export interface ConfirmOrderResult {
  ok: boolean;
  order?: DemoOrder;
  errors?: string[];
}

interface CartCheckoutViewProps {
  products: Product[];
  globalDateExceptions?: Record<string, string>;
  capacityConfig?: CapacityScheduleConfig;
  draftItems: DraftOrderItem[];
  selectedDateIso: string;
  onChangeDateIso: (iso: string) => void;
  onUpdateItemQuantity: (uid: string, nextQuantity: number) => void;
  onRemoveDraftItem: (uid: string) => void;
  onClearDraftItems: () => void;
  onLoadMandatoryExampleCart: () => { ok: boolean; message?: string };
  onConfirmOrder: (payload: ConfirmOrderPayload) => ConfirmOrderResult;
  demoOrders: DemoOrder[];
  onNavigateView: (view: AppView) => void;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

const PAYMENT_OPTIONS: Array<{
  id: DemoPaymentMethod;
  label: string;
  helper: string;
}> = [
  {
    id: 'card',
    label: 'Tarjeta (simulada)',
    helper: 'Simula autorización inmediata en modo demo.',
  },
  {
    id: 'transfer',
    label: 'Transferencia SPEI (demo)',
    helper: 'Queda pendiente de validación administrativa.',
  },
  {
    id: 'cash',
    label: 'Efectivo',
    helper: 'Pago al repartidor o directamente en caja.',
  },
  {
    id: 'whatsapp',
    label: 'Coordinar por WhatsApp',
    helper: 'Genera resumen listo para copiar (sin envío automático).',
  },
];

export function CartCheckoutView({
  products,
  globalDateExceptions = GLOBAL_DATE_EXCEPTIONS,
  capacityConfig = DEFAULT_CAPACITY_CONFIG,
  draftItems,
  selectedDateIso,
  onChangeDateIso,
  onUpdateItemQuantity,
  onRemoveDraftItem,
  onClearDraftItems,
  onLoadMandatoryExampleCart,
  onConfirmOrder,
  demoOrders,
  onNavigateView,
}: CartCheckoutViewProps) {
  const [fulfillmentMode, setFulfillmentMode] = useState<OrderFulfillmentMode>('delivery');
  const [distanceKm, setDistanceKm] = useState<number>(5);
  const [timeSlot, setTimeSlot] = useState<string>(DELIVERY_TIME_SLOTS[1]);
  const [paymentMethod, setPaymentMethod] = useState<DemoPaymentMethod>('card');
  const [customer, setCustomer] = useState<CustomerCheckoutInfo>(INITIAL_CUSTOMER);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => createIdempotencyKey());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [exampleNotice, setExampleNotice] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<DemoOrder | null>(null);
  const [copiedFolio, setCopiedFolio] = useState<string | null>(null);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  const totalQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of draftItems) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return map;
  }, [draftItems]);

  const todayIso = useMemo(() => getMeridaTodayIso(), []);
  const mondayIso = useMemo(() => getMondayOfWeekIso(selectedDateIso), [selectedDateIso]);
  const weekDays = useMemo(() => getWeekDaysFromMonday(mondayIso), [mondayIso]);
  const isSunday = getDayOfWeekFromIso(selectedDateIso) === 0;

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

  const selectedSlotSnapshot = useMemo(
    () => slotSnapshots.find((s) => s.timeSlot === timeSlot) ?? slotSnapshots[0],
    [slotSnapshots, timeSlot]
  );

  const subtotalCents = useMemo(
    () =>
      draftItems.reduce(
        (sum, item) => sum + mxnToCents(item.unitPriceMxn) * item.quantity,
        0
      ),
    [draftItems]
  );

  const breakdown = useMemo(
    () =>
      calculateOrderBreakdownCents({
        subtotalCents,
        fulfillmentMode,
        distanceKm,
      }),
    [subtotalCents, fulfillmentMode, distanceKm]
  );

  const itemValidationWarnings = useMemo(() => {
    const warnings = new Map<string, string>();
    for (const item of draftItems) {
      const liveProduct = productById.get(item.productId);
      if (!liveProduct || !liveProduct.admin.active) {
        warnings.set(item.uid, 'Producto no disponible en el catálogo actual.');
        continue;
      }
      if (liveProduct.priceMxn === null) {
        warnings.set(item.uid, 'Precio pendiente de confirmación en PDF.');
        continue;
      }
      if (liveProduct.priceMxn !== item.unitPriceMxn) {
        warnings.set(
          item.uid,
          `Precio actualizado en catálogo: ${formatCentsMXN(mxnToCents(liveProduct.priceMxn))}.`
        );
        continue;
      }
      const availability = evaluateProductAvailability(
        liveProduct,
        selectedDateIso,
        globalDateExceptions
      );
      if (!availability.canOrder) {
        warnings.set(item.uid, availability.reason || availability.statusLabel);
        continue;
      }
      const requestedTotal = totalQtyByProduct.get(item.productId) ?? item.quantity;
      if (liveProduct.inventory.trackStock && requestedTotal > liveProduct.inventory.stock) {
        warnings.set(
          item.uid,
          `Existencias insuficientes: pediste ${requestedTotal} y quedan ${liveProduct.inventory.stock}.`
        );
      }
    }
    return warnings;
  }, [draftItems, productById, selectedDateIso, totalQtyByProduct, globalDateExceptions]);

  useEffect(() => {
    if (copiedFolio) {
      const timer = window.setTimeout(() => setCopiedFolio(null), 2500);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [copiedFolio]);

  const handleCopyWhatsappSummary = async (order: DemoOrder) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(order.whatsappSummaryText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = order.whatsappSummaryText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedFolio(order.folio);
    } catch {
      setCopiedFolio(null);
    }
  };

  const handleApplyMandatoryExample = () => {
    const res = onLoadMandatoryExampleCart();
    if (!res.ok) {
      setExampleNotice(
        res.message ||
          'No fue posible cargar el ejemplo por existencias insuficientes. Puedes restablecer el inventario demo en Administración.'
      );
      return;
    }
    setFulfillmentMode('delivery');
    setDistanceKm(5);
    if (getDayOfWeekFromIso(selectedDateIso) === 0) {
      onChangeDateIso(addDaysToIso(selectedDateIso, 1));
    }
    setExampleNotice(
      'Cargamos 2x Omelet de jamón y queso ($250.00 MXN) a 5 km ($42.00 MXN) + cuota 4% ($10.00 MXN) = $302.00 MXN.'
    );
    setSubmitErrors([]);
  };

  const handleDistanceInput = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed)) {
      setDistanceKm(0);
      return;
    }
    const clamped = Math.min(20, Math.max(0, Math.round(parsed * 100) / 100));
    setDistanceKm(clamped);
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const clientErrors: string[] = [];
    if (draftItems.length === 0) {
      clientErrors.push('Agrega al menos un platillo antes de confirmar tu pedido.');
    }
    if (isSunday) {
      clientErrors.push('Los domingos Nutricious H&D permanece cerrado. Elige una fecha de lunes a sábado.');
    }
    if (selectedSlotSnapshot && !selectedSlotSnapshot.canBook) {
      clientErrors.push(
        `La franja ${timeSlot} para ${selectedDateIso} no está disponible (${selectedSlotSnapshot.statusLabel}). Elige otra franja o fecha.`
      );
    }
    if (fulfillmentMode === 'delivery' && distanceKm > TURBO_MANDADOS_RULES.maxCoverageKm) {
      clientErrors.push(
        `La distancia (${distanceKm} km) supera la cobertura máxima de ${TURBO_MANDADOS_RULES.maxCoverageKm} km. Cambia a "Recoger en tienda" para continuar.`
      );
    }
    if (!customer.customerName.trim()) {
      clientErrors.push('Ingresa tu nombre completo.');
    }
    if (!customer.customerPhone.trim() || customer.customerPhone.replace(/\D/g, '').length < 8) {
      clientErrors.push('Ingresa un teléfono de contacto válido (al menos 8 dígitos).');
    }
    if (fulfillmentMode === 'delivery') {
      if (!customer.address.trim()) {
        clientErrors.push('Ingresa la dirección de entrega en Mérida.');
      }
      if (!customer.references.trim()) {
        clientErrors.push('Agrega referencias de entrega para ayudar al repartidor.');
      }
      if (
        customer.isSpecialLocation &&
        !customer.building.trim() &&
        !customer.hospital.trim() &&
        !customer.area.trim() &&
        !customer.receiverName.trim()
      ) {
        clientErrors.push(
          'Activaste entrega en edificio/hospital/área; indica al menos edificio, hospital, área o persona que recibirá.'
        );
      }
    }
    if (fulfillmentMode === 'dine_in' && !customer.tableNumber.trim()) {
      clientErrors.push('Indica el número de mesa para consumir en restaurante.');
    }

    if (clientErrors.length > 0) {
      setSubmitErrors(clientErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitErrors([]);

    const result = onConfirmOrder({
      idempotencyKey,
      scheduledDateIso: selectedDateIso,
      timeSlot,
      fulfillmentMode,
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
        tableNumber: customer.tableNumber.trim(),
        cashPaidWith: customer.cashPaidWith?.trim() || '',
        orderNotes: customer.orderNotes?.trim() || '',
      },
    });

    setIsSubmitting(false);

    if (!result.ok || !result.order) {
      setSubmitErrors(result.errors || ['No se pudo confirmar el pedido. Revisa tus datos.']);
      return;
    }

    setActiveReceipt(result.order);
    setExampleNotice(null);
    setIdempotencyKey(createIdempotencyKey());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="py-8 sm:py-12 bg-[#DCE8D2] min-h-[80vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onNavigateView('menu')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#234D35] hover:text-[#193B29] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Volver al Menú inteligente
          </button>

          <button
            type="button"
            onClick={handleApplyMandatoryExample}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold bg-[#C6DE8B] text-[#193B29] hover:bg-[#b8d375] rounded-xl border border-[#234D35]/20 transition-colors cursor-pointer"
          >
            Cargar ejemplo $250.00 a 5 km ($302.00)
          </button>
        </div>

        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#28583C]">
            Fase 3 · Carrito y checkout en modo demo
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#193B29]">
            Mi pedido y confirmación
          </h1>
          <p className="text-sm sm:text-base text-[#193B29]/85 max-w-3xl">
            Revisa tus platillos, selecciona modalidad, fecha y horario en Mérida, y genera un comprobante con folio en modo demo (sin cobros reales ni envíos automáticos).
          </p>
        </header>

        {exampleNotice && (
          <div className="rounded-2xl bg-[#EDF3E5] border border-[#234D35]/25 px-4 py-3 text-sm text-[#193B29] flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#234D35] shrink-0 mt-0.5" aria-hidden="true" />
            <span>{exampleNotice}</span>
          </div>
        )}

        {/* Comprobante de pedido generado */}
        {activeReceipt && (
          <div className="bg-[#234D35] text-[#EDF3E5] rounded-3xl p-6 sm:p-8 border border-[#C6DE8B]/30 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#EDF3E5]/15 pb-5">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#C6DE8B]">
                  <Receipt className="w-4 h-4" aria-hidden="true" />
                  Comprobante generado (Modo demo)
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tabular-nums">
                  Folio {activeReceipt.folio}
                </h2>
                <p className="text-xs sm:text-sm text-[#DCE8D2]/90">
                  Registrado: {activeReceipt.createdAtDisplay} · Programado:{' '}
                  {formatSpanishDateLabel(activeReceipt.scheduledDateIso)} ({activeReceipt.timeSlot})
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveReceipt(null)}
                  className="px-4 py-2 text-xs font-semibold bg-[#193B29]/70 hover:bg-[#193B29] text-[#DCE8D2] rounded-xl transition-colors cursor-pointer"
                >
                  Ocultar comprobante
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateView('menu')}
                  className="px-4 py-2 text-xs font-semibold bg-[#C6DE8B] text-[#193B29] hover:bg-[#d7eba6] rounded-xl transition-colors cursor-pointer"
                >
                  Seguir explorando menú
                </button>
              </div>
            </div>

            {/* Tres estados separados */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[#193B29]/65 p-4 border border-[#EDF3E5]/10">
                <p className="text-[11px] uppercase tracking-wider text-[#C6DE8B]">Estado de pago</p>
                <p className="font-display text-base font-bold mt-1">{activeReceipt.paymentStatus}</p>
              </div>
              <div className="rounded-2xl bg-[#193B29]/65 p-4 border border-[#EDF3E5]/10">
                <p className="text-[11px] uppercase tracking-wider text-[#C6DE8B]">Estado de preparación</p>
                <p className="font-display text-base font-bold mt-1">{activeReceipt.prepStatus}</p>
              </div>
              <div className="rounded-2xl bg-[#193B29]/65 p-4 border border-[#EDF3E5]/10">
                <p className="text-[11px] uppercase tracking-wider text-[#C6DE8B]">Estado de entrega</p>
                <p className="font-display text-base font-bold mt-1">{activeReceipt.deliveryStatus}</p>
              </div>
            </div>

            {/* Detalle de precios aplicados y datos de entrega */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl bg-[#193B29]/55 p-5 space-y-3 border border-[#EDF3E5]/10">
                <h3 className="font-display text-base font-bold text-[#C6DE8B]">
                  Precios aplicados al confirmar (copia guardada)
                </h3>
                <ul className="space-y-2.5 text-sm">
                  {activeReceipt.items.map((line) => (
                    <li
                      key={line.uid}
                      className="flex items-start justify-between gap-3 border-b border-[#EDF3E5]/10 pb-2"
                    >
                      <div>
                        <p className="font-semibold">
                          {line.quantity}x {line.productName}
                        </p>
                        <p className="text-xs text-[#DCE8D2]/80 tabular-nums">
                          {line.sku} · Unitario aplicado: {formatCentsMXN(line.appliedUnitPriceCents)}
                        </p>
                        {line.selectedCustomizations.length > 0 && (
                          <p className="text-xs text-[#C6DE8B]/90 mt-0.5">
                            {line.selectedCustomizations
                              .map((c) => `${c.groupLabel}: ${c.optionLabels.join(', ')}`)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="font-display font-bold tabular-nums shrink-0">
                        {formatCentsMXN(line.lineTotalCents)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2 space-y-1 text-sm">
                  <div className="flex justify-between text-[#DCE8D2]">
                    <span>Subtotal de productos</span>
                    <span className="tabular-nums">
                      {formatCentsMXN(activeReceipt.pricingSnapshot.subtotalCents)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#DCE8D2]">
                    <span>Cuota de servicio (4%)</span>
                    <span className="tabular-nums">
                      {formatCentsMXN(activeReceipt.pricingSnapshot.serviceFeeCents)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#DCE8D2]">
                    <span>
                      Envío Turbo Mandados
                      {activeReceipt.distanceKm !== null ? ` (${activeReceipt.distanceKm} km)` : ''}
                    </span>
                    <span className="tabular-nums">
                      {formatCentsMXN(activeReceipt.pricingSnapshot.deliveryFeeCents)}
                    </span>
                  </div>
                  <div className="flex justify-between font-display text-xl font-bold text-[#C6DE8B] pt-2 border-t border-[#EDF3E5]/15">
                    <span>Total confirmado</span>
                    <span className="tabular-nums">
                      {formatCentsMXN(activeReceipt.pricingSnapshot.totalCents)} MXN
                    </span>
                  </div>
                </div>
              </div>

              {/* Resumen WhatsApp para copiar sin envío automático */}
              <div className="rounded-2xl bg-[#193B29]/55 p-5 space-y-3 border border-[#EDF3E5]/10 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-[#C6DE8B]">
                      Resumen para WhatsApp (copia manual)
                    </h3>
                    <span className="text-[11px] text-[#DCE8D2]/80">
                      Sin envío automático
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed bg-[#142e20] text-[#EDF3E5] p-3.5 rounded-xl border border-[#EDF3E5]/15 max-h-60 overflow-y-auto font-sans">
                    {activeReceipt.whatsappSummaryText}
                  </pre>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyWhatsappSummary(activeReceipt)}
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-semibold bg-[#C6DE8B] text-[#193B29] hover:bg-[#d7eba6] rounded-xl transition-colors cursor-pointer"
                >
                  {copiedFolio === activeReceipt.folio ? (
                    <>
                      <Check className="w-4 h-4" aria-hidden="true" />
                      Resumen copiado al portapapeles
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" aria-hidden="true" />
                      Copiar resumen para WhatsApp
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna izquierda: Carrito y datos del pedido */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Productos en carrito */}
            <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-5 h-5 text-[#234D35]" aria-hidden="true" />
                  <h2 className="font-display text-xl font-bold text-[#193B29]">
                    1. Platillos seleccionados
                  </h2>
                </div>
                {draftItems.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearDraftItems}
                    className="text-xs font-semibold text-[#7A2E1D] hover:underline cursor-pointer"
                  >
                    Vaciar carrito
                  </button>
                )}
              </div>

              {draftItems.length === 0 ? (
                <div className="bg-[#DCE8D2]/70 rounded-2xl p-6 border border-[#234D35]/12 space-y-4">
                  <p className="font-display text-lg font-bold text-[#193B29]">
                    Tu carrito está en $0.00 MXN
                  </p>
                  <p className="text-sm text-[#193B29]/85 leading-relaxed">
                    Sin productos en el pedido, el subtotal, cuota de servicio, envío y total permanecen en $0.00 MXN. Agrega platillos desde el Menú inteligente o carga el ejemplo de $250.00 MXN.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => onNavigateView('menu')}
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl transition-colors cursor-pointer"
                    >
                      <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
                      Explorar Menú inteligente
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyMandatoryExample}
                      className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold bg-[#C6DE8B] text-[#193B29] hover:bg-[#b8d375] rounded-xl border border-[#234D35]/15 transition-colors cursor-pointer"
                    >
                      Probar ejemplo $302.00
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {draftItems.map((item) => {
                    const liveProduct = productById.get(item.productId);
                    const totalForProduct = totalQtyByProduct.get(item.productId) ?? item.quantity;
                    const maxAvailableForThisLine = liveProduct?.inventory.trackStock
                      ? Math.max(
                          item.quantity,
                          liveProduct.inventory.stock - (totalForProduct - item.quantity)
                        )
                      : 99;
                    const canIncrement =
                      !liveProduct?.inventory.trackStock ||
                      totalForProduct < liveProduct.inventory.stock;
                    const lineWarning = itemValidationWarnings.get(item.uid);

                    return (
                      <div
                        key={item.uid}
                        className="bg-[#DCE8D2]/70 rounded-2xl p-4 border border-[#234D35]/15 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            {liveProduct && (
                              <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#234D35]/10 shrink-0">
                                <ResilientImage
                                  src={liveProduct.photo.url}
                                  alt={liveProduct.photo.alt}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="space-y-1">
                              <p className="font-display text-base font-bold text-[#193B29]">
                                {item.productName}
                              </p>
                              <p className="text-xs font-medium text-[#28583C] tabular-nums">
                                Unitario: {formatCentsMXN(mxnToCents(item.unitPriceMxn))} MXN
                                {liveProduct?.inventory.trackStock
                                  ? ` · Existencias actuales: ${liveProduct.inventory.stock}`
                                  : ''}
                              </p>
                              {item.selectedCustomizations.length > 0 && (
                                <ul className="text-xs text-[#193B29]/85 space-y-0.5 pt-0.5">
                                  {item.selectedCustomizations.map((cust) => (
                                    <li key={cust.groupId}>
                                      <strong>{cust.groupLabel}:</strong>{' '}
                                      {cust.optionLabels.join(', ')}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="inline-flex items-center rounded-xl bg-[#EDF3E5] border border-[#234D35]/20">
                              <button
                                type="button"
                                onClick={() =>
                                  item.quantity > 1
                                    ? onUpdateItemQuantity(item.uid, item.quantity - 1)
                                    : onRemoveDraftItem(item.uid)
                                }
                                aria-label={`Disminuir cantidad de ${item.productName}`}
                                className="p-2 text-[#193B29] hover:bg-[#C6DE8B]/40 rounded-l-xl cursor-pointer"
                              >
                                <Minus className="w-4 h-4" aria-hidden="true" />
                              </button>
                              <span className="px-3 text-sm font-bold tabular-nums text-[#193B29]">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                disabled={!canIncrement || item.quantity >= maxAvailableForThisLine}
                                onClick={() => onUpdateItemQuantity(item.uid, item.quantity + 1)}
                                aria-label={`Aumentar cantidad de ${item.productName}`}
                                className="p-2 text-[#193B29] hover:bg-[#C6DE8B]/40 disabled:opacity-40 disabled:cursor-not-allowed rounded-r-xl cursor-pointer"
                              >
                                <Plus className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </div>

                            <span className="font-display text-base sm:text-lg font-bold text-[#234D35] tabular-nums min-w-[92px] text-right">
                              {formatCentsMXN(mxnToCents(item.unitPriceMxn) * item.quantity)}
                            </span>

                            <button
                              type="button"
                              onClick={() => onRemoveDraftItem(item.uid)}
                              aria-label={`Quitar ${item.productName}`}
                              className="p-2 rounded-xl text-[#7A2E1D] hover:bg-[#EDF3E5] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {lineWarning && (
                          <div className="rounded-xl bg-[#7A2E1D]/10 border border-[#7A2E1D]/30 px-3 py-2 text-xs font-medium text-[#7A2E1D] flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>{lineWarning}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Modalidad */}
            <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
              <h2 className="font-display text-xl font-bold text-[#193B29]">
                2. Modalidad del pedido
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFulfillmentMode('delivery')}
                  className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
                    fulfillmentMode === 'delivery'
                      ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35]'
                      : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15 hover:bg-[#DCE8D2]'
                  }`}
                >
                  <Truck className="w-5 h-5 mb-2" aria-hidden="true" />
                  <p className="font-display font-bold text-sm">A domicilio</p>
                  <p className="text-xs opacity-85 mt-0.5">
                    Turbo Mandados + cuota 4%
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFulfillmentMode('pickup')}
                  className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
                    fulfillmentMode === 'pickup'
                      ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35]'
                      : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15 hover:bg-[#DCE8D2]'
                  }`}
                >
                  <Store className="w-5 h-5 mb-2" aria-hidden="true" />
                  <p className="font-display font-bold text-sm">Recoger en tienda</p>
                  <p className="text-xs opacity-85 mt-0.5">
                    Sin envío ni cuota del 4%
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFulfillmentMode('dine_in')}
                  className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
                    fulfillmentMode === 'dine_in'
                      ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35]'
                      : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15 hover:bg-[#DCE8D2]'
                  }`}
                >
                  <UtensilsCrossed className="w-5 h-5 mb-2" aria-hidden="true" />
                  <p className="font-display font-bold text-sm">Consumir en restaurante</p>
                  <p className="text-xs opacity-85 mt-0.5">
                    Con número de mesa · sin cuota 4%
                  </p>
                </button>
              </div>

              {fulfillmentMode === 'delivery' && (
                <div className="bg-[#DCE8D2]/70 rounded-2xl p-4 sm:p-5 border border-[#234D35]/15 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label
                      htmlFor="checkout-distance"
                      className="text-sm font-semibold text-[#193B29]"
                    >
                      Distancia estimada desde el restaurante (km)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="checkout-distance-number"
                        type="number"
                        min={0.5}
                        max={20}
                        step={0.1}
                        value={distanceKm}
                        onChange={(e) => handleDistanceInput(e.target.value)}
                        className="w-24 px-3 py-1.5 text-sm font-bold tabular-nums bg-[#EDF3E5] border border-[#234D35]/25 rounded-xl text-[#193B29]"
                      />
                      <span className="text-sm font-semibold text-[#234D35]">km</span>
                    </div>
                  </div>

                  <input
                    id="checkout-distance"
                    type="range"
                    min={0.5}
                    max={15}
                    step={0.5}
                    value={Math.min(15, distanceKm)}
                    onChange={(e) => handleDistanceInput(e.target.value)}
                    className="w-full accent-[#234D35] cursor-pointer"
                  />

                  <div className="flex flex-wrap gap-2">
                    {[2.5, 4.5, 5, 10, 13, 14].map((presetKm) => (
                      <button
                        key={presetKm}
                        type="button"
                        onClick={() => setDistanceKm(presetKm)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                          distanceKm === presetKm
                            ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35]'
                            : 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/20 hover:bg-[#C6DE8B]/40'
                        }`}
                      >
                        {presetKm} km
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-[#193B29]/80 leading-relaxed">
                    <strong>Regla provisional de demostración:</strong> $30.00 MXN hasta 3 km y $6.00 MXN proporcionales por cada fracción de kilómetro adicional (hasta 13 km). Esta regla es provisional hasta confirmar la cotización real con Turbo Mandados.
                  </p>

                  {distanceKm > TURBO_MANDADOS_RULES.maxCoverageKm && (
                    <div className="rounded-2xl bg-[#7A2E1D]/12 border border-[#7A2E1D]/35 p-4 space-y-3">
                      <div className="flex items-start gap-2.5 text-[#7A2E1D]">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="text-xs sm:text-sm space-y-1">
                          <p className="font-bold">
                            Entrega a domicilio no disponible ({distanceKm} km &gt; 13 km)
                          </p>
                          <p>
                            Turbo Mandados cubre hasta 13 km desde el restaurante en Mérida. Puedes elegir recoger en tienda sin cuota de servicio ni envío.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFulfillmentMode('pickup')}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl cursor-pointer"
                      >
                        <Store className="w-4 h-4" aria-hidden="true" />
                        Cambiar a Recoger en tienda
                      </button>
                    </div>
                  )}
                </div>
              )}

              {fulfillmentMode === 'dine_in' && (
                <div className="bg-[#DCE8D2]/70 rounded-2xl p-4 sm:p-5 border border-[#234D35]/15 space-y-2">
                  <label
                    htmlFor="checkout-table"
                    className="block text-sm font-semibold text-[#193B29]"
                  >
                    Número de mesa *
                  </label>
                  <input
                    id="checkout-table"
                    type="text"
                    value={customer.tableNumber}
                    onChange={(e) =>
                      setCustomer((prev) => ({ ...prev, tableNumber: e.target.value }))
                    }
                    placeholder="Ej. Mesa 4"
                    className="w-full sm:w-64 px-3.5 py-2.5 text-sm bg-[#EDF3E5] border border-[#234D35]/25 rounded-xl text-[#193B29] placeholder:text-[#193B29]/50"
                  />
                  <p className="text-xs text-[#193B29]/80">
                    El consumo en restaurante no cobra envío ni cuota de servicio del 4%.
                  </p>
                </div>
              )}

              {fulfillmentMode === 'pickup' && (
                <div className="bg-[#DCE8D2]/70 rounded-2xl p-4 border border-[#234D35]/15 text-xs sm:text-sm text-[#193B29]/85">
                  Recoge tu pedido en tienda dentro del horario seleccionado (Lunes a Sábado, 7:30 am a 2:30 pm). No aplica cuota de servicio del 4% ni envío.
                </div>
              )}
            </div>

            {/* 3. Fecha y franja horaria */}
            <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#234D35]" aria-hidden="true" />
                  <h2 className="font-display text-xl font-bold text-[#193B29]">
                    3. Fecha y horario (America/Merida)
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeDateIso(addDaysToIso(selectedDateIso, -7))}
                    aria-label="Semana anterior"
                    className="p-2 rounded-xl bg-[#DCE8D2] text-[#193B29] hover:bg-[#C6DE8B] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeDateIso(todayIso)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#DCE8D2] text-[#193B29] hover:bg-[#C6DE8B] transition-colors cursor-pointer"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeDateIso(addDaysToIso(selectedDateIso, 7))}
                    aria-label="Semana siguiente"
                    className="p-2 rounded-xl bg-[#DCE8D2] text-[#193B29] hover:bg-[#C6DE8B] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {weekDays.map((day) => {
                  const isSelected = day.iso === selectedDateIso;
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      onClick={() => onChangeDateIso(day.iso)}
                      className={`p-2 sm:p-2.5 rounded-xl border text-center transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35]'
                          : day.isRestaurantOpen
                            ? 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15 hover:bg-[#DCE8D2]'
                            : 'bg-[#DCE8D2]/35 text-[#7A2E1D] border-[#7A2E1D]/20'
                      }`}
                    >
                      <span className="block text-[11px] font-semibold uppercase">
                        {day.shortDay}
                      </span>
                      <span className="block font-display text-base sm:text-lg font-bold tabular-nums">
                        {day.dayNumber}
                      </span>
                      <span className="block text-[10px] opacity-80">{day.monthShort}</span>
                    </button>
                  );
                })}
              </div>

              {isSunday && (
                <div className="rounded-xl bg-[#7A2E1D]/10 border border-[#7A2E1D]/30 px-4 py-3 text-xs sm:text-sm text-[#7A2E1D] font-medium">
                  Los domingos Nutricious H&amp;D está cerrado. Selecciona un día de lunes a sábado.
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#193B29]">
                    <Clock className="w-4 h-4 text-[#234D35]" aria-hidden="true" />
                    Franja horaria preferida (cupos compartidos con planes semanales)
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {slotSnapshots.map((snap) => {
                    const isSelected = timeSlot === snap.timeSlot;
                    const disabled = !snap.canBook;
                    return (
                      <button
                        key={snap.timeSlot}
                        type="button"
                        disabled={disabled}
                        onClick={() => setTimeSlot(snap.timeSlot)}
                        className={`px-3 py-2.5 text-left rounded-xl border transition-colors ${
                          disabled
                            ? 'bg-[#DCE8D2]/40 text-[#7A2E1D] border-[#7A2E1D]/25 opacity-75 cursor-not-allowed'
                            : isSelected
                              ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35] cursor-pointer'
                              : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15 hover:bg-[#DCE8D2] cursor-pointer'
                        }`}
                      >
                        <span className="block text-xs sm:text-sm font-bold tabular-nums">
                          {snap.timeSlot}
                        </span>
                        <span
                          className={`block text-[11px] font-medium mt-0.5 tabular-nums ${
                            disabled
                              ? 'text-[#7A2E1D]'
                              : isSelected
                                ? 'text-[#C6DE8B]'
                                : 'text-[#28583C]'
                          }`}
                        >
                          {snap.statusLabel} ({snap.occupiedTotal}/{snap.limit})
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedSlotSnapshot && !selectedSlotSnapshot.canBook && (
                  <p className="text-xs font-semibold text-[#7A2E1D]">
                    La franja {selectedSlotSnapshot.timeSlot} está bloqueada o llena ({selectedSlotSnapshot.blockReason || selectedSlotSnapshot.statusLabel}). Selecciona otra franja disponible.
                  </p>
                )}
              </div>
            </div>

            {/* 4. Datos del cliente y entrega */}
            <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#234D35]" aria-hidden="true" />
                <h2 className="font-display text-xl font-bold text-[#193B29]">
                  4. Datos de contacto {fulfillmentMode === 'delivery' ? 'y entrega' : ''}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="cust-name" className="block text-sm font-semibold text-[#193B29]">
                    Nombre completo *
                  </label>
                  <input
                    id="cust-name"
                    type="text"
                    value={customer.customerName}
                    onChange={(e) =>
                      setCustomer((prev) => ({ ...prev, customerName: e.target.value }))
                    }
                    placeholder="Nombre y apellido"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29] placeholder:text-[#193B29]/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="cust-phone" className="block text-sm font-semibold text-[#193B29]">
                    Teléfono / WhatsApp *
                  </label>
                  <input
                    id="cust-phone"
                    type="tel"
                    value={customer.customerPhone}
                    onChange={(e) =>
                      setCustomer((prev) => ({ ...prev, customerPhone: e.target.value }))
                    }
                    placeholder="999 000 0000"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29] placeholder:text-[#193B29]/50"
                  />
                </div>
              </div>

              {fulfillmentMode === 'delivery' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="cust-address"
                      className="block text-sm font-semibold text-[#193B29]"
                    >
                      Dirección de entrega en Mérida *
                    </label>
                    <input
                      id="cust-address"
                      type="text"
                      value={customer.address}
                      onChange={(e) =>
                        setCustomer((prev) => ({ ...prev, address: e.target.value }))
                      }
                      placeholder="Calle, número exterior/interior, cruzamientos y colonia"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29] placeholder:text-[#193B29]/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="cust-refs"
                      className="block text-sm font-semibold text-[#193B29]"
                    >
                      Referencias de ubicación *
                    </label>
                    <textarea
                      id="cust-refs"
                      rows={2}
                      value={customer.references}
                      onChange={(e) =>
                        setCustomer((prev) => ({ ...prev, references: e.target.value }))
                      }
                      placeholder="Color de casa/portón, frente a parque o indicaciones para el repartidor"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29] placeholder:text-[#193B29]/50"
                    />
                  </div>

                  <div className="pt-1 space-y-3">
                    <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#193B29] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customer.isSpecialLocation}
                        onChange={(e) =>
                          setCustomer((prev) => ({
                            ...prev,
                            isSpecialLocation: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 accent-[#234D35] rounded"
                      />
                      <Building2 className="w-4 h-4 text-[#234D35]" aria-hidden="true" />
                      Entrega en edificio, hospital, oficina o con otra persona que recibe
                    </label>

                    {customer.isSpecialLocation && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#DCE8D2]/60 p-4 rounded-2xl border border-[#234D35]/15">
                        <div className="space-y-1">
                          <label htmlFor="cust-building" className="text-xs font-semibold text-[#193B29]">
                            Edificio / Torre
                          </label>
                          <input
                            id="cust-building"
                            type="text"
                            value={customer.building}
                            onChange={(e) =>
                              setCustomer((prev) => ({ ...prev, building: e.target.value }))
                            }
                            placeholder="Ej. Torre Norte / Corporativo"
                            className="w-full px-3 py-2 text-sm bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label htmlFor="cust-hospital" className="text-xs font-semibold text-[#193B29]">
                            Hospital / Clínica (si aplica)
                          </label>
                          <input
                            id="cust-hospital"
                            type="text"
                            value={customer.hospital}
                            onChange={(e) =>
                              setCustomer((prev) => ({ ...prev, hospital: e.target.value }))
                            }
                            placeholder="Nombre del hospital o clínica"
                            className="w-full px-3 py-2 text-sm bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label htmlFor="cust-area" className="text-xs font-semibold text-[#193B29]">
                            Área / Piso / Consultorio / Habitación
                          </label>
                          <input
                            id="cust-area"
                            type="text"
                            value={customer.area}
                            onChange={(e) =>
                              setCustomer((prev) => ({ ...prev, area: e.target.value }))
                            }
                            placeholder="Ej. Piso 3, Recepción / Urgencias"
                            className="w-full px-3 py-2 text-sm bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label htmlFor="cust-receiver" className="text-xs font-semibold text-[#193B29]">
                            Persona que recibirá
                          </label>
                          <input
                            id="cust-receiver"
                            type="text"
                            value={customer.receiverName}
                            onChange={(e) =>
                              setCustomer((prev) => ({ ...prev, receiverName: e.target.value }))
                            }
                            placeholder="Nombre de quien recibe"
                            className="w-full px-3 py-2 text-sm bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <label htmlFor="cust-order-notes" className="block text-sm font-semibold text-[#193B29]">
                  Observaciones para cocina o entrega (opcional)
                </label>
                <textarea
                  id="cust-order-notes"
                  rows={2}
                  value={customer.orderNotes || ''}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, orderNotes: e.target.value }))
                  }
                  placeholder="Ej. Sin cebolla, aderezo aparte, incluir cubiertos..."
                  className="w-full px-3.5 py-2.5 text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29] placeholder:text-[#193B29]/50"
                />
              </div>
            </div>

            {/* 5. Método de pago simulado */}
            <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#234D35]" aria-hidden="true" />
                <h2 className="font-display text-xl font-bold text-[#193B29]">
                  5. Método de pago (Simulación en modo demo)
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PAYMENT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPaymentMethod(option.id)}
                    className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
                      paymentMethod === option.id
                        ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35]'
                        : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15 hover:bg-[#DCE8D2]'
                    }`}
                  >
                    <p className="font-display font-bold text-sm">{option.label}</p>
                    <p className="text-xs opacity-85 mt-1">{option.helper}</p>
                  </button>
                ))}
              </div>

              {paymentMethod === 'cash' && (
                <div className="bg-[#DCE8D2]/60 p-4 rounded-2xl border border-[#234D35]/15 space-y-1.5">
                  <label htmlFor="cash-with" className="block text-xs font-semibold text-[#193B29]">
                    ¿Con cuánto pagas en efectivo? (opcional)
                  </label>
                  <input
                    id="cash-with"
                    type="text"
                    value={customer.cashPaidWith || ''}
                    onChange={(e) =>
                      setCustomer((prev) => ({ ...prev, cashPaidWith: e.target.value }))
                    }
                    placeholder="Ej. $500.00 MXN"
                    className="w-full sm:w-64 px-3 py-2 text-sm bg-[#EDF3E5] border border-[#234D35]/20 rounded-xl text-[#193B29]"
                  />
                </div>
              )}

              <p className="text-xs text-[#193B29]/75">
                Nota: Los pagos con tarjeta y transferencia son únicamente simulados en esta fase demo. No se procesa ningún cargo real.
              </p>
            </div>
          </div>

          {/* Columna derecha: Resumen de importes y confirmación */}
          <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
            <div className="bg-[#234D35] text-[#EDF3E5] rounded-3xl p-6 sm:p-7 space-y-5 border border-[#C6DE8B]/20">
              <div className="space-y-1 border-b border-[#EDF3E5]/15 pb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#C6DE8B]">
                  Resumen en MXN (centavos exactos)
                </p>
                <h2 className="font-display text-2xl font-bold">Total del pedido</h2>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#DCE8D2]">Subtotal de productos</span>
                  <span className="font-display font-bold tabular-nums">
                    {formatCentsMXN(breakdown.subtotalCents)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#DCE8D2]">
                    Cuota de servicio (4%)
                    {!breakdown.serviceFeeApplied && breakdown.subtotalCents > 0 && (
                      <span className="block text-[11px] text-[#C6DE8B]">
                        No aplica en tienda / restaurante
                      </span>
                    )}
                  </span>
                  <span className="font-display font-bold tabular-nums">
                    {formatCentsMXN(breakdown.serviceFeeCents)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#DCE8D2]">
                    Envío Turbo Mandados
                    {fulfillmentMode === 'delivery' && breakdown.subtotalCents > 0
                      ? ` (${distanceKm} km)`
                      : ''}
                  </span>
                  <span className="font-display font-bold tabular-nums">
                    {fulfillmentMode === 'delivery' && !breakdown.covered
                      ? 'Fuera de cobertura'
                      : formatCentsMXN(breakdown.deliveryFeeCents)}
                  </span>
                </div>

                <div className="pt-3 border-t border-[#EDF3E5]/20 flex items-baseline justify-between gap-3">
                  <span className="font-display text-lg font-bold text-[#C6DE8B]">Total</span>
                  <span className="font-display text-3xl font-bold text-[#C6DE8B] tabular-nums">
                    {breakdown.totalCents !== null
                      ? `${formatCentsMXN(breakdown.totalCents)} MXN`
                      : 'Solo recoger'}
                  </span>
                </div>
              </div>

              {breakdown.subtotalCents === 0 && (
                <p className="text-xs text-[#DCE8D2]/85 bg-[#193B29]/60 rounded-xl p-3">
                  Sin productos seleccionados, todos los importes permanecen en $0.00 MXN.
                </p>
              )}

              {submitErrors.length > 0 && (
                <div
                  role="alert"
                  className="rounded-2xl bg-[#7A2E1D] text-[#EDF3E5] p-4 space-y-1.5 text-xs sm:text-sm"
                >
                  <p className="font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Revisa antes de confirmar:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    {submitErrors.map((err, index) => (
                      <li key={index}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  draftItems.length === 0 ||
                  (fulfillmentMode === 'delivery' && !breakdown.covered)
                }
                className="w-full py-3.5 px-5 text-sm sm:text-base font-bold bg-[#C6DE8B] text-[#193B29] hover:bg-[#d7eba6] disabled:opacity-45 disabled:cursor-not-allowed rounded-2xl transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Validando y confirmando...' : 'Confirmar pedido (Modo demo)'}
              </button>

              <p className="text-[11px] text-[#DCE8D2]/80 leading-relaxed">
                Al confirmar, el sistema revalida precios actuales, existencias, opciones obligatorias y fecha seleccionada; descuenta el inventario una sola vez y guarda copia de los precios aplicados.
              </p>
            </div>

            {/* Historial rápido de folios en la sesión */}
            {demoOrders.length > 0 && (
              <div className="bg-[#EDF3E5] rounded-3xl p-5 border border-[#234D35]/15 space-y-3">
                <h3 className="font-display text-base font-bold text-[#193B29]">
                  Comprobantes recientes ({demoOrders.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {demoOrders.map((ord) => (
                    <button
                      key={ord.folio}
                      type="button"
                      onClick={() => {
                        setActiveReceipt(ord);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full text-left p-3 rounded-2xl bg-[#DCE8D2]/70 hover:bg-[#C6DE8B]/45 border border-[#234D35]/15 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div>
                        <p className="font-display text-sm font-bold text-[#193B29] tabular-nums">
                          {ord.folio}
                        </p>
                        <p className="text-xs text-[#28583C]">
                          {ord.paymentStatus} · {ord.prepStatus}
                        </p>
                      </div>
                      <span className="font-display text-sm font-bold text-[#234D35] tabular-nums shrink-0">
                        {formatCentsMXN(ord.pricingSnapshot.totalCents)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </form>
      </div>
    </section>
  );
}
