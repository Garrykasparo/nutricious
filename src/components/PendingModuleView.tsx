import {
  ArrowLeft,
  User,
  ShieldCheck,
  UtensilsCrossed,
  ExternalLink,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react';
import type { DemoOrder, Product } from '../types/product';
import { BUSINESS_INFO, formatCentsMXN } from '../utils/pricing';
import type { AppView } from './MobileBottomBar';

interface PendingModuleViewProps {
  view: 'mi-cuenta' | 'admin';
  products: Product[];
  demoOrders: DemoOrder[];
  onResetDemoInventory: () => void;
  onNavigateView: (view: AppView) => void;
}

export function PendingModuleView({
  view,
  products,
  demoOrders,
  onResetDemoInventory,
  onNavigateView,
}: PendingModuleViewProps) {
  if (view === 'admin') {
    const reviewQueue = products.filter((p) => p.reviewStatus === 'Por revisar');
    const outOfStockList = products.filter(
      (p) => p.inventory.manuallyOutOfStock || (p.inventory.trackStock && p.inventory.stock <= 0)
    );

    return (
      <section className="py-12 sm:py-16 bg-[#DCE8D2] min-h-[75vh]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
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
              onClick={onResetDemoInventory}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#EDF3E5] hover:bg-[#C6DE8B] text-[#193B29] border border-[#234D35]/20 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Restablecer existencias demo
            </button>
          </div>

          <div className="bg-[#EDF3E5] rounded-3xl p-6 sm:p-10 border border-[#234D35]/15 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#28583C]">
                  Acceso separado · Modelo reutilizable de producto e inventario en vivo
                </p>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#193B29]">
                  Administración y Cocina (Vista previa)
                </h1>
                <p className="text-sm sm:text-base text-[#193B29]/85 max-w-2xl">
                  Aquí puedes verificar cómo las compras confirmadas en modo demo descuentan las existencias reales del catálogo y registran estados separados de pago, preparación y entrega. El tablero operativo completo de cocina y despacho se habilitará en una fase posterior.
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#234D35] text-[#C6DE8B] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" aria-hidden="true" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-[#DCE8D2]/75 rounded-2xl p-4 border border-[#234D35]/12">
                <p className="text-xs font-medium text-[#28583C]">Productos en catálogo</p>
                <p className="font-display text-2xl font-bold text-[#193B29] tabular-nums mt-1">
                  {products.length}
                </p>
              </div>
              <div className="bg-[#DCE8D2]/75 rounded-2xl p-4 border border-[#234D35]/12">
                <p className="text-xs font-medium text-[#28583C]">Pedidos demo registrados</p>
                <p className="font-display text-2xl font-bold text-[#234D35] tabular-nums mt-1">
                  {demoOrders.length}
                </p>
              </div>
              <div className="bg-[#DCE8D2]/75 rounded-2xl p-4 border border-[#234D35]/12">
                <p className="text-xs font-medium text-[#28583C]">Marcados para revisión PDF</p>
                <p className="font-display text-2xl font-bold text-[#7A2E1D] tabular-nums mt-1">
                  {reviewQueue.length}
                </p>
              </div>
              <div className="bg-[#DCE8D2]/75 rounded-2xl p-4 border border-[#234D35]/12">
                <p className="text-xs font-medium text-[#28583C]">Agotados actualmente</p>
                <p className="font-display text-2xl font-bold text-[#193B29] tabular-nums mt-1">
                  {outOfStockList.length}
                </p>
              </div>
            </div>

            {demoOrders.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-display text-lg font-bold text-[#193B29]">
                  Órdenes confirmadas en modo demo ({demoOrders.length})
                </h2>
                <div className="overflow-x-auto rounded-2xl border border-[#234D35]/15">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#234D35] text-[#EDF3E5]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Folio</th>
                        <th className="px-4 py-3 font-semibold">Cliente</th>
                        <th className="px-4 py-3 font-semibold">Pago</th>
                        <th className="px-4 py-3 font-semibold">Preparación</th>
                        <th className="px-4 py-3 font-semibold">Entrega</th>
                        <th className="px-4 py-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#234D35]/12 bg-[#EDF3E5]">
                      {demoOrders.map((ord) => (
                        <tr key={ord.folio}>
                          <td className="px-4 py-2.5 font-mono text-xs font-bold tabular-nums text-[#193B29]">
                            {ord.folio}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-[#193B29]">
                            {ord.customer.customerName}
                          </td>
                          <td className="px-4 py-2.5 text-[#193B29]/85">{ord.paymentStatus}</td>
                          <td className="px-4 py-2.5 text-[#193B29]/85">{ord.prepStatus}</td>
                          <td className="px-4 py-2.5 text-[#193B29]/85">{ord.deliveryStatus}</td>
                          <td className="px-4 py-2.5 font-bold text-right tabular-nums text-[#234D35]">
                            {formatCentsMXN(ord.pricingSnapshot.totalCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h2 className="font-display text-lg font-bold text-[#193B29]">
                Muestra de inventario vivo (descuento automático al confirmar pedido)
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-[#234D35]/15">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#234D35] text-[#EDF3E5]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">SKU</th>
                      <th className="px-4 py-3 font-semibold">Producto</th>
                      <th className="px-4 py-3 font-semibold">Estación cocina</th>
                      <th className="px-4 py-3 font-semibold">Existencias</th>
                      <th className="px-4 py-3 font-semibold">Revisión PDF</th>
                      <th className="px-4 py-3 font-semibold">Nutrición</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#234D35]/12 bg-[#EDF3E5]">
                    {products
                      .filter(
                        (p) =>
                          p.id === 'omelet-jamon-queso' ||
                          p.id === 'avocado-toast' ||
                          p.id === 'chilaquiles-pollo' ||
                          p.id === 'jugo-verde-nutricious' ||
                          p.reviewStatus === 'Por revisar' ||
                          p.inventory.manuallyOutOfStock
                      )
                      .slice(0, 14)
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-2.5 font-mono text-xs tabular-nums">{p.admin.sku}</td>
                          <td className="px-4 py-2.5 font-semibold text-[#193B29]">{p.name}</td>
                          <td className="px-4 py-2.5 text-[#193B29]/80">{p.kitchen.prepStation}</td>
                          <td className="px-4 py-2.5 tabular-nums font-semibold">
                            {p.inventory.manuallyOutOfStock ||
                            (p.inventory.trackStock && p.inventory.stock === 0)
                              ? 'Agotado (0)'
                              : p.inventory.trackStock
                                ? p.inventory.stock
                                : 'Por confirmar'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={
                                p.reviewStatus === 'Por revisar'
                                  ? 'font-semibold text-[#7A2E1D]'
                                  : 'text-[#234D35]'
                              }
                            >
                              {p.reviewStatus}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[#193B29]/80">
                            {p.nutrition.validationStatus}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 sm:py-20 bg-[#DCE8D2] min-h-[70vh]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onNavigateView('inicio')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#234D35] hover:text-[#193B29] mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Volver a Inicio
        </button>

        <div className="bg-[#EDF3E5] rounded-3xl p-7 sm:p-10 border border-[#234D35]/15 space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-[#234D35] text-[#C6DE8B] flex items-center justify-center">
            <User className="w-6 h-6" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#28583C]">
              Próxima fase · Clientes frecuentes
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#193B29]">
              Mi cuenta
            </h1>
          </div>

          <p className="text-base text-[#193B29]/85 leading-relaxed">
            Este espacio reunirá tu perfil de cliente frecuente en Mérida, historial persistente de compras, direcciones guardadas dentro de la cobertura de 13 km y seguimiento de órdenes diarias de planes semanales. Mientras tanto, tus favoritos y comprobantes demo recientes ({demoOrders.length} en esta sesión) ya están disponibles en el carrito y en el Menú inteligente.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigateView('mi-pedido')}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              Ir a Mi pedido ({demoOrders.length} comprobantes)
            </button>
            <button
              type="button"
              onClick={() => onNavigateView('planes')}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-[#C6DE8B] text-[#193B29] hover:bg-[#d7eba6] rounded-xl border border-[#234D35]/15 transition-colors cursor-pointer"
            >
              Planes semanales y calendario
            </button>
            <button
              type="button"
              onClick={() => onNavigateView('menu')}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-[#DCE8D2] text-[#193B29] hover:bg-[#C6DE8B] rounded-xl border border-[#234D35]/15 transition-colors cursor-pointer"
            >
              <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
              Ir al Menú inteligente
            </button>
            <a
              href={BUSINESS_INFO.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-[#DCE8D2] text-[#193B29] hover:bg-[#C6DE8B] rounded-xl border border-[#234D35]/15 transition-colors"
            >
              WhatsApp {BUSINESS_INFO.whatsappDisplay}
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
