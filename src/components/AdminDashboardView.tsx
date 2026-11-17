import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CalendarRange,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  History,
  Layers,
  Package,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Truck,
  UtensilsCrossed,
} from 'lucide-react';
import type {
  AuditLogEntry,
  CapacityScheduleConfig,
  ConfigurablePlanTemplate,
  DeliveryTrackingInfo,
  DemoOrder,
  OrderDeliveryStatus,
  OrderPrepStatus,
  Product,
  SlotCapacitySnapshot,
  WeeklyPlanPurchase,
} from '../types/product';
import { evaluateSlotCapacity } from '../utils/capacityAndPlans';
import {
  addDaysToIso,
  formatSpanishDateLabel,
  getMeridaTodayIso,
  MERIDA_TIMEZONE,
} from '../utils/meridaDate';
import { DELIVERY_TIME_SLOTS, formatCentsMXN } from '../utils/pricing';
import type { AppView } from './MobileBottomBar';
import { AdminCapacityTab } from './admin/AdminCapacityTab';
import { AdminCatalogTab } from './admin/AdminCatalogTab';
import { AdminDeliveriesTab } from './admin/AdminDeliveriesTab';
import { AdminKitchenTab } from './admin/AdminKitchenTab';
import { AdminOrdersTab } from './admin/AdminOrdersTab';
import { AdminPlansTab } from './admin/AdminPlansTab';

export type AdminModuleTab =
  | 'pedidos'
  | 'cocina'
  | 'catalogo'
  | 'entregas'
  | 'agenda'
  | 'planes_activos'
  | 'historial';

interface AdminDashboardViewProps {
  products: Product[];
  globalDateExceptions: Record<string, string>;
  demoOrders: DemoOrder[];
  weeklyPlans: WeeklyPlanPurchase[];
  planTemplates: ConfigurablePlanTemplate[];
  capacityConfig: CapacityScheduleConfig;
  auditLog: AuditLogEntry[];
  onUpdateOrderPrepStatus: (
    folio: string,
    nextStatus: OrderPrepStatus
  ) => { ok: boolean; error?: string };
  onAssignDeliveryTurboDemo: (folio: string) => { ok: boolean; error?: string };
  onUpdateDeliveryStatus: (
    folio: string,
    nextStatus: OrderDeliveryStatus,
    trackingPatch?: Partial<DeliveryTrackingInfo>
  ) => { ok: boolean; error?: string };
  onUpdateProductAdmin: (
    productId: string,
    updater: (prev: Product) => Product,
    auditAction: string,
    auditDetails: string
  ) => void;
  onUpsertGlobalDateException: (dateIso: string, reason: string) => void;
  onRemoveGlobalDateException: (dateIso: string) => void;
  onResetDemoCatalogOverrides: () => void;
  onUpdateDefaultSlotLimit: (nextLimit: number) => void;
  onUpdateSlotRule: (params: {
    dateIso: string;
    timeSlot: string;
    limit: number;
    blocked: boolean;
    blockReason?: string;
  }) => void;
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
  onNavigateView: (view: AppView) => void;
}

export function AdminDashboardView({
  products,
  globalDateExceptions,
  demoOrders,
  weeklyPlans,
  planTemplates,
  capacityConfig,
  auditLog,
  onUpdateOrderPrepStatus,
  onAssignDeliveryTurboDemo,
  onUpdateDeliveryStatus,
  onUpdateProductAdmin,
  onUpsertGlobalDateException,
  onRemoveGlobalDateException,
  onResetDemoCatalogOverrides,
  onUpdateDefaultSlotLimit,
  onUpdateSlotRule,
  onUpdatePlanTemplate,
  onReschedulePlanDay,
  onNavigateView,
}: AdminDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<AdminModuleTab>('pedidos');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'ok' | 'error';
    text: string;
  } | null>(null);

  const [auditScopeFilter, setAuditScopeFilter] = useState<string>('all');
  const [auditSearch, setAuditSearch] = useState<string>('');

  const handleNotify = (tone: 'ok' | 'error', text: string) => {
    setFeedbackBanner({ tone, text });
  };

  const distinctOrderDates = useMemo(() => {
    const set = new Set<string>();
    for (const ord of demoOrders) {
      set.add(ord.scheduledDateIso);
    }
    return Array.from(set).sort();
  }, [demoOrders]);

  const filteredAuditLog = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLog.filter((entry) => {
      if (auditScopeFilter !== 'all' && entry.scope !== auditScopeFilter) return false;
      if (!q) return true;
      return (
        entry.entityId.toLowerCase().includes(q) ||
        entry.entityLabel.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q)
      );
    });
  }, [auditLog, auditScopeFilter, auditSearch]);

  const kitchenPendingCount = demoOrders.filter((o) => o.prepStatus !== 'Listo').length;
  const deliveryOrdersCount = demoOrders.filter((o) => o.fulfillmentMode === 'delivery').length;
  const blockedSlotsCount = Object.values(capacityConfig.slotRules).filter((r) => r.blocked).length;

  const todayIso = getMeridaTodayIso();

  const dailySummary = useMemo(() => {
    const todayOrders = demoOrders.filter((o) => o.scheduledDateIso === todayIso);
    const activeOrdersToday = todayOrders.filter((o) => o.deliveryStatus !== 'Entregado');
    const confirmedIndividualToday = todayOrders.filter(
      (o) => o.orderType === 'a_la_carta'
    ).length;
    const confirmedPlanToday = todayOrders.filter(
      (o) => o.orderType === 'plan_semanal'
    ).length;

    const projectedRevenueCents = todayOrders.reduce(
      (sum, o) => sum + o.pricingSnapshot.totalCents,
      0
    );
    const projectedFoodCents = todayOrders.reduce(
      (sum, o) => sum + o.pricingSnapshot.subtotalCents,
      0
    );
    const projectedFeeCents = todayOrders.reduce(
      (sum, o) => sum + o.pricingSnapshot.serviceFeeCents,
      0
    );
    const projectedDeliveryCents = todayOrders.reduce(
      (sum, o) => sum + o.pricingSnapshot.deliveryFeeCents,
      0
    );

    const candidateDates = new Set<string>();
    for (let i = 0; i < 7; i += 1) {
      candidateDates.add(addDaysToIso(todayIso, i));
    }
    for (const ord of demoOrders) {
      if (ord.scheduledDateIso >= todayIso) {
        candidateDates.add(ord.scheduledDateIso);
      }
    }
    for (const key of Object.keys(capacityConfig.slotRules)) {
      const [datePart] = key.split('__');
      if (datePart && datePart >= todayIso) {
        candidateDates.add(datePart);
      }
    }

    const highOccupancyAlerts: Array<SlotCapacitySnapshot & { occupancyPercent: number }> = [];
    const blockedSlotAlerts: SlotCapacitySnapshot[] = [];
    const todaySlots: SlotCapacitySnapshot[] = [];

    for (const dateIso of Array.from(candidateDates).sort()) {
      for (const slot of DELIVERY_TIME_SLOTS) {
        const snap = evaluateSlotCapacity({
          dateIso,
          timeSlot: slot,
          capacityConfig,
          demoOrders,
          globalDateExceptions,
        });
        if (dateIso === todayIso) {
          todaySlots.push(snap);
        }
        if (snap.isSunday) continue;
        const occupancyRatio = snap.limit > 0 ? snap.occupiedTotal / snap.limit : 0;
        const occupancyPercent = Math.round(occupancyRatio * 100);
        if (snap.limit > 0 && occupancyRatio >= 0.8) {
          highOccupancyAlerts.push({ ...snap, occupancyPercent });
        } else if (snap.manuallyBlocked) {
          blockedSlotAlerts.push(snap);
        }
      }
    }

    return {
      todayOrdersCount: todayOrders.length,
      activeOrdersTodayCount: activeOrdersToday.length,
      confirmedIndividualToday,
      confirmedPlanToday,
      projectedRevenueCents,
      projectedFoodCents,
      projectedFeeCents,
      projectedDeliveryCents,
      todaySlots,
      highOccupancyAlerts,
      blockedSlotAlerts,
    };
  }, [capacityConfig, demoOrders, globalDateExceptions, todayIso]);

  return (
    <section className="py-8 sm:py-12 bg-[#DCE8D2] min-h-[82vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateView('inicio')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#234D35] hover:text-[#193B29] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Volver a Inicio
            </button>
            <span className="text-[#234D35]/30">|</span>
            <button
              type="button"
              onClick={() => onNavigateView('menu')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#28583C] hover:text-[#193B29] cursor-pointer"
            >
              <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
              Ir a Tienda / Menú
            </button>
            <button
              type="button"
              onClick={() => onNavigateView('planes')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#28583C] hover:text-[#193B29] cursor-pointer"
            >
              <CalendarRange className="w-4 h-4" aria-hidden="true" />
              Ir a Planes semanales
            </button>
            <button
              type="button"
              onClick={() => onNavigateView('mi-pedido')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#28583C] hover:text-[#193B29] cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              Ir a Mi pedido
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onResetDemoCatalogOverrides();
              handleNotify(
                'ok',
                'Se restablecieron precios, existencias y disponibilidad del catálogo demo.'
              );
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-[#EDF3E5] hover:bg-[#C6DE8B] text-[#193B29] border border-[#234D35]/20 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Restablecer catálogo y stock demo
          </button>
        </div>

        {/* Sección superior: Resumen del Día */}
        <section
          aria-label="Resumen del Día"
          className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-6 border border-[#234D35]/15 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#28583C]">
                {formatSpanishDateLabel(todayIso)} · {MERIDA_TIMEZONE}
              </p>
              <h2 className="font-display text-2xl font-bold text-[#193B29]">
                Resumen del Día
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('agenda')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#DCE8D2] hover:bg-[#C6DE8B] text-[#193B29] rounded-xl border border-[#234D35]/15 cursor-pointer"
            >
              <CalendarRange className="w-3.5 h-3.5" aria-hidden="true" />
              Gestionar Agenda y cupos
            </button>
          </div>

          {dailySummary.highOccupancyAlerts.length > 0 && (
            <div
              role="alert"
              className="rounded-2xl bg-[#7A2E1D] text-[#EDF3E5] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm">
                <AlertTriangle className="w-5 h-5 text-[#C6DE8B] shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
                <span>
                  <strong>Alerta de capacidad (≥ 80%):</strong>{' '}
                  {dailySummary.highOccupancyAlerts.length} franja(s) horaria(s) han alcanzado el 80% o más de su cupo máximo configurado.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('agenda')}
                className="px-3 py-1.5 text-xs font-bold bg-[#C6DE8B] text-[#193B29] hover:bg-[#d7eba6] rounded-xl shrink-0 cursor-pointer"
              >
                Revisar franjas
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Total de pedidos confirmados hoy */}
            <div className="bg-[#DCE8D2]/75 rounded-2xl p-4 sm:p-5 border border-[#234D35]/15 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#28583C]">
                  Pedidos confirmados hoy
                </span>
                <ShoppingBag className="w-4 h-4 text-[#234D35]" aria-hidden="true" />
              </div>
              <p className="font-display text-3xl font-bold text-[#193B29] tabular-nums">
                {dailySummary.todayOrdersCount}
              </p>
              <p className="text-xs text-[#193B29]/80">
                {dailySummary.confirmedIndividualToday} a la carta ·{' '}
                {dailySummary.confirmedPlanToday} de plan semanal · Activos sin entregar:{' '}
                <strong>{dailySummary.activeOrdersTodayCount}</strong>
              </p>
            </div>

            {/* 2. Suma de importes (ingresos proyectados) del día */}
            <div className="bg-[#DCE8D2]/75 rounded-2xl p-4 sm:p-5 border border-[#234D35]/15 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#28583C]">
                  Ingresos proyectados del día
                </span>
                <TrendingUp className="w-4 h-4 text-[#234D35]" aria-hidden="true" />
              </div>
              <p className="font-display text-3xl font-bold text-[#234D35] tabular-nums">
                {formatCentsMXN(dailySummary.projectedRevenueCents)}
              </p>
              <p className="text-xs text-[#193B29]/80 tabular-nums">
                Alimentos {formatCentsMXN(dailySummary.projectedFoodCents)} · Cuota 4%{' '}
                {formatCentsMXN(dailySummary.projectedFeeCents)} · Envíos{' '}
                {formatCentsMXN(dailySummary.projectedDeliveryCents)}
              </p>
            </div>

            {/* 3. Alerta visual de capacidad >= 80% */}
            <div
              className={`rounded-2xl p-4 sm:p-5 border flex flex-col justify-between gap-2.5 ${
                dailySummary.highOccupancyAlerts.length > 0 ||
                dailySummary.blockedSlotAlerts.length > 0
                  ? 'bg-[#7A2E1D]/12 border-[#7A2E1D]/40 text-[#193B29]'
                  : 'bg-[#DCE8D2]/75 border-[#234D35]/15 text-[#193B29]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    dailySummary.highOccupancyAlerts.length > 0
                      ? 'text-[#7A2E1D]'
                      : 'text-[#28583C]'
                  }`}
                >
                  Franjas al 80% o más de cupo
                </span>
                <BellRing
                  className={`w-4 h-4 ${
                    dailySummary.highOccupancyAlerts.length > 0
                      ? 'text-[#7A2E1D]'
                      : 'text-[#234D35]'
                  }`}
                  aria-hidden="true"
                />
              </div>

              {dailySummary.highOccupancyAlerts.length === 0 &&
              dailySummary.blockedSlotAlerts.length === 0 ? (
                <>
                  <p className="font-display text-lg font-bold text-[#234D35]">
                    Capacidad holgada (&lt; 80%)
                  </p>
                  <p className="text-xs text-[#193B29]/80">
                    Ninguna franja horaria ha alcanzado el 80% de su capacidad máxima configurada.
                  </p>
                </>
              ) : (
                <div className="space-y-1.5">
                  <p className="font-display text-lg font-bold text-[#7A2E1D] tabular-nums">
                    {dailySummary.highOccupancyAlerts.length} franja(s) ≥ 80%
                    {dailySummary.blockedSlotAlerts.length > 0
                      ? ` · ${dailySummary.blockedSlotAlerts.length} bloqueada(s)`
                      : ''}
                  </p>
                  <ul className="space-y-1 max-h-24 overflow-y-auto text-xs">
                    {dailySummary.highOccupancyAlerts.map((snap) => (
                      <li
                        key={snap.key}
                        className="font-semibold text-[#7A2E1D] flex items-center justify-between gap-2"
                      >
                        <span>
                          {snap.dateIso === todayIso ? 'Hoy' : snap.dateIso} · {snap.timeSlot}
                        </span>
                        <span className="tabular-nums">
                          {snap.occupancyPercent}% ({snap.occupiedTotal}/{snap.limit})
                          {snap.isFull ? ' · Llena' : ''}
                        </span>
                      </li>
                    ))}
                    {dailySummary.blockedSlotAlerts.map((snap) => (
                      <li
                        key={snap.key}
                        className="font-medium text-[#193B29] flex items-center justify-between gap-2"
                      >
                        <span>
                          {snap.dateIso === todayIso ? 'Hoy' : snap.dateIso} · {snap.timeSlot}
                        </span>
                        <span>Bloqueada manualmente</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="bg-[#234D35] text-[#EDF3E5] rounded-3xl p-6 sm:p-8 border border-[#C6DE8B]/20 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#C6DE8B]">
                Operación interna en modo demo ({MERIDA_TIMEZONE})
              </p>
              <h1 className="font-display text-2xl sm:text-4xl font-bold">
                Panel de Administración y Cocina
              </h1>
              <p className="text-sm text-[#DCE8D2]/90 max-w-2xl">
                Gestión integrada de pedidos individuales, planes semanales activos, agenda y cupos compartidos, cocina, catálogo/nutrición y entregas vinculadas con Turbo Mandados.
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#193B29] text-[#C6DE8B] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#193B29]/70 rounded-2xl p-4 border border-[#EDF3E5]/10">
              <p className="text-xs text-[#C6DE8B]">Órdenes diarias / individuales</p>
              <p className="font-display text-2xl font-bold tabular-nums mt-1">
                {demoOrders.length}
              </p>
            </div>
            <div className="bg-[#193B29]/70 rounded-2xl p-4 border border-[#EDF3E5]/10">
              <p className="text-xs text-[#C6DE8B]">Planes activos</p>
              <p className="font-display text-2xl font-bold tabular-nums mt-1">
                {weeklyPlans.length}
              </p>
            </div>
            <div className="bg-[#193B29]/70 rounded-2xl p-4 border border-[#EDF3E5]/10">
              <p className="text-xs text-[#C6DE8B]">Activos en cocina</p>
              <p className="font-display text-2xl font-bold tabular-nums mt-1">
                {kitchenPendingCount}
              </p>
            </div>
            <div className="bg-[#193B29]/70 rounded-2xl p-4 border border-[#EDF3E5]/10">
              <p className="text-xs text-[#C6DE8B]">Entregas · Franjas bloq.</p>
              <p className="font-display text-2xl font-bold tabular-nums mt-1">
                {deliveryOrdersCount} · <span className="text-[#EDF3E5]">{blockedSlotsCount}</span>
              </p>
            </div>
          </div>
        </div>

        {feedbackBanner && (
          <div
            role="status"
            className={`rounded-2xl px-4 py-3 text-sm font-medium flex items-center justify-between gap-3 border ${
              feedbackBanner.tone === 'error'
                ? 'bg-[#7A2E1D] text-[#EDF3E5] border-[#7A2E1D]'
                : 'bg-[#C6DE8B] text-[#193B29] border-[#234D35]/25'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackBanner.tone === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>{feedbackBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-xs font-bold underline cursor-pointer shrink-0"
            >
              Cerrar
            </button>
          </div>
        )}

        <div
          role="tablist"
          aria-label="Módulos de administración y cocina"
          className="flex flex-wrap gap-2 bg-[#EDF3E5] p-2 rounded-2xl border border-[#234D35]/15"
        >
          {(
            [
              { id: 'pedidos', label: 'Pedidos', count: demoOrders.length, Icon: ClipboardList },
              { id: 'cocina', label: 'Cocina', count: kitchenPendingCount, Icon: ChefHat },
              { id: 'catalogo', label: 'Menú y existencias', count: products.length, Icon: Package },
              { id: 'entregas', label: 'Entregas', count: deliveryOrdersCount, Icon: Truck },
              { id: 'agenda', label: 'Agenda y cupos', count: capacityConfig.defaultSlotLimit, Icon: CalendarRange },
              { id: 'planes_activos', label: 'Planes activos', count: weeklyPlans.length, Icon: Layers },
              { id: 'historial', label: 'Historial de cambios', count: auditLog.length, Icon: History },
            ] as const
          ).map(({ id, label, count, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#234D35] text-[#C6DE8B]'
                    : 'text-[#193B29] hover:bg-[#DCE8D2]'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{label}</span>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full tabular-nums ${
                    active ? 'bg-[#193B29] text-[#EDF3E5]' : 'bg-[#DCE8D2] text-[#234D35]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {activeTab === 'pedidos' && (
          <AdminOrdersTab
            demoOrders={demoOrders}
            distinctOrderDates={distinctOrderDates}
            onNavigateView={onNavigateView}
            onNotify={handleNotify}
          />
        )}

        {activeTab === 'cocina' && (
          <AdminKitchenTab
            products={products}
            demoOrders={demoOrders}
            distinctOrderDates={distinctOrderDates}
            onUpdateOrderPrepStatus={onUpdateOrderPrepStatus}
            onNotify={handleNotify}
          />
        )}

        {activeTab === 'catalogo' && (
          <AdminCatalogTab
            products={products}
            globalDateExceptions={globalDateExceptions}
            onUpdateProductAdmin={onUpdateProductAdmin}
            onUpsertGlobalDateException={onUpsertGlobalDateException}
            onRemoveGlobalDateException={onRemoveGlobalDateException}
            onNotify={handleNotify}
          />
        )}

        {activeTab === 'entregas' && (
          <AdminDeliveriesTab
            demoOrders={demoOrders}
            onAssignDeliveryTurboDemo={onAssignDeliveryTurboDemo}
            onUpdateDeliveryStatus={onUpdateDeliveryStatus}
            onNotify={handleNotify}
          />
        )}

        {activeTab === 'agenda' && (
          <AdminCapacityTab
            capacityConfig={capacityConfig}
            demoOrders={demoOrders}
            globalDateExceptions={globalDateExceptions}
            onUpdateDefaultSlotLimit={onUpdateDefaultSlotLimit}
            onUpdateSlotRule={onUpdateSlotRule}
            onNotify={handleNotify}
          />
        )}

        {activeTab === 'planes_activos' && (
          <AdminPlansTab
            planTemplates={planTemplates}
            weeklyPlans={weeklyPlans}
            demoOrders={demoOrders}
            capacityConfig={capacityConfig}
            globalDateExceptions={globalDateExceptions}
            onUpdatePlanTemplate={onUpdatePlanTemplate}
            onReschedulePlanDay={onReschedulePlanDay}
            onNotify={handleNotify}
          />
        )}

        {activeTab === 'historial' && (
          <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#193B29]">
                  Historial de cambios
                </h2>
                <p className="text-sm text-[#193B29]/80">
                  Registro cronológico de movimientos en pedidos, planes, agenda/cupos, cocina, catálogo y entregas.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Filtrar por folio, SKU o acción..."
                  aria-label="Filtrar historial de cambios"
                  className="px-3 py-2 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                />
                <select
                  aria-label="Filtrar historial por módulo"
                  value={auditScopeFilter}
                  onChange={(e) => setAuditScopeFilter(e.target.value)}
                  className="px-3 py-2 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                >
                  <option value="all">Todos los módulos</option>
                  <option value="pedido">Pedidos</option>
                  <option value="plan">Planes semanales</option>
                  <option value="agenda">Agenda y cupos</option>
                  <option value="cocina">Cocina</option>
                  <option value="catalogo">Catálogo</option>
                  <option value="entrega">Entregas</option>
                </select>
              </div>
            </div>

            {filteredAuditLog.length === 0 ? (
              <p className="text-sm text-[#193B29]/75 bg-[#DCE8D2]/60 rounded-2xl p-5">
                Aún no hay movimientos registrados con este filtro.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#234D35]/15">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#234D35] text-[#EDF3E5]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Fecha y hora</th>
                      <th className="px-4 py-3 font-semibold">Módulo</th>
                      <th className="px-4 py-3 font-semibold">Referencia</th>
                      <th className="px-4 py-3 font-semibold">Acción</th>
                      <th className="px-4 py-3 font-semibold">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#234D35]/12 bg-[#EDF3E5]">
                    {filteredAuditLog.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-xs text-[#193B29]/80">
                          {entry.timestampDisplay}
                        </td>
                        <td className="px-4 py-2.5 font-semibold uppercase text-[11px] text-[#28583C]">
                          {entry.scope}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs font-bold text-[#193B29] block">
                            {entry.entityId}
                          </span>
                          <span className="text-xs text-[#193B29]/75">{entry.entityLabel}</span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-[#193B29]">{entry.action}</td>
                        <td className="px-4 py-2.5 text-[#193B29]/85">{entry.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
