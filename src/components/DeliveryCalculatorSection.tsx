import { useMemo, useState } from 'react';
import { Truck, Store, Utensils, AlertTriangle } from 'lucide-react';
import {
  BUSINESS_INFO,
  TURBO_MANDADOS_RULES,
  calculateOrderBreakdownCents,
  formatCentsMXN,
  mxnToCents,
  type FulfillmentMode,
} from '../utils/pricing';

const PRESET_EXAMPLES = [
  { label: 'Ejemplo $250.00 a 5 km ($302.00)', amount: 250, distance: 5 },
  { label: 'Desayuno $154.00 a 3 km', amount: 154, distance: 3 },
  { label: 'Ensalada + jugo $224.00 a 4.5 km', amount: 224, distance: 4.5 },
];

export function DeliveryCalculatorSection() {
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('delivery');
  const [subtotalMxn, setSubtotalMxn] = useState<number>(250);
  const [distanceKm, setDistanceKm] = useState<number>(5);

  const breakdown = useMemo(
    () =>
      calculateOrderBreakdownCents({
        subtotalCents: mxnToCents(subtotalMxn),
        fulfillmentMode,
        distanceKm,
      }),
    [subtotalMxn, fulfillmentMode, distanceKm]
  );

  return (
    <section id="simulador-envio" className="py-16 sm:py-20 bg-[#DCE8D2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Explanation */}
          <div className="lg:col-span-5 space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#28583C]">
              Entregas mediante {BUSINESS_INFO.deliveryPartner}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#193B29] leading-tight text-balance">
              Tarifas claras con {BUSINESS_INFO.deliveryPartner}
            </h2>
            <p className="text-base text-[#193B29]/85 leading-relaxed">
              Calcula de forma transparente cuánto pagarás por tu pedido en Mérida según la modalidad y la distancia desde nuestro restaurante.
            </p>

            <div className="bg-[#EDF3E5] rounded-2xl p-6 border border-[#234D35]/15 space-y-3 text-sm text-[#193B29]">
              <h3 className="font-display text-base font-bold text-[#234D35]">
                Reglas tarifarias en modo demo:
              </h3>
              <ul className="space-y-2">
                <li className="flex justify-between gap-4">
                  <span>De 0 a {TURBO_MANDADOS_RULES.baseKm} km</span>
                  <span className="font-bold tabular-nums">
                    {formatCentsMXN(TURBO_MANDADOS_RULES.baseFeeCents)} MXN
                  </span>
                </li>
                <li className="flex justify-between gap-4">
                  <span>Kilómetro adicional</span>
                  <span className="font-bold tabular-nums">
                    +{formatCentsMXN(TURBO_MANDADOS_RULES.additionalKmFeeCents)} MXN / km
                  </span>
                </li>
                <li className="flex justify-between gap-4">
                  <span>Cobertura máxima</span>
                  <span className="font-bold tabular-nums">
                    {TURBO_MANDADOS_RULES.maxCoverageKm} km
                  </span>
                </li>
                <li className="pt-2 border-t border-[#234D35]/12 text-xs text-[#193B29]/80 leading-relaxed">
                  Las fracciones de kilómetro se cobran proporcionalmente en esta demo de manera provisional hasta confirmar la cotización real con Turbo Mandados. La cuota de servicio del 4% aplica solo sobre el subtotal de productos en entregas a domicilio.
                </li>
              </ul>
            </div>
          </div>

          {/* Right Interactive Simulator */}
          <div className="lg:col-span-7 bg-[#EDF3E5] rounded-2xl p-6 sm:p-8 border border-[#234D35]/15 space-y-6">
            <div>
              <p className="text-sm font-bold text-[#193B29] mb-2.5">
                Modalidad del pedido
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFulfillmentMode('delivery')}
                  className={`flex items-center justify-center gap-2 px-3.5 py-3 text-xs sm:text-sm font-semibold rounded-xl border transition-colors cursor-pointer ${
                    fulfillmentMode === 'delivery'
                      ? 'bg-[#28583C] text-[#EDF3E5] border-[#28583C]'
                      : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/20 hover:bg-[#C6DE8B]/70'
                  }`}
                >
                  <Truck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  A domicilio
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentMode('pickup')}
                  className={`flex items-center justify-center gap-2 px-3.5 py-3 text-xs sm:text-sm font-semibold rounded-xl border transition-colors cursor-pointer ${
                    fulfillmentMode === 'pickup'
                      ? 'bg-[#28583C] text-[#EDF3E5] border-[#28583C]'
                      : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/20 hover:bg-[#C6DE8B]/70'
                  }`}
                >
                  <Store className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Recoger en tienda
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentMode('dine_in')}
                  className={`flex items-center justify-center gap-2 px-3.5 py-3 text-xs sm:text-sm font-semibold rounded-xl border transition-colors cursor-pointer ${
                    fulfillmentMode === 'dine_in'
                      ? 'bg-[#28583C] text-[#EDF3E5] border-[#28583C]'
                      : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/20 hover:bg-[#C6DE8B]/70'
                  }`}
                >
                  <Utensils className="w-4 h-4 shrink-0" aria-hidden="true" />
                  En restaurante
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="subtotal-range" className="text-sm font-bold text-[#193B29]">
                  Subtotal de productos de ejemplo
                </label>
                <span className="font-display text-lg font-bold text-[#234D35] tabular-nums">
                  {formatCentsMXN(breakdown.subtotalCents)} MXN
                </span>
              </div>
              <input
                id="subtotal-range"
                type="range"
                min={0}
                max={800}
                step={5}
                value={subtotalMxn}
                onChange={(e) => setSubtotalMxn(Number(e.target.value))}
                className="w-full accent-[#28583C] cursor-pointer"
              />
              <div className="flex flex-wrap gap-2">
                {PRESET_EXAMPLES.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setFulfillmentMode('delivery');
                      setSubtotalMxn(preset.amount);
                      setDistanceKm(preset.distance);
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-[#DCE8D2] hover:bg-[#C6DE8B] text-[#193B29] rounded-lg transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {fulfillmentMode === 'delivery' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="distance-range" className="text-sm font-bold text-[#193B29]">
                    Distancia desde el restaurante
                  </label>
                  <span className="font-display text-lg font-bold text-[#234D35] tabular-nums">
                    {distanceKm.toFixed(1)} km
                  </span>
                </div>
                <input
                  id="distance-range"
                  type="range"
                  min={0.5}
                  max={15}
                  step={0.5}
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  className="w-full accent-[#28583C] cursor-pointer"
                />
                <div className="flex justify-between text-xs text-[#193B29]/70 tabular-nums">
                  <span>0–3 km ($30.00)</span>
                  <span>5 km ($42.00)</span>
                  <span>13 km ($90.00 máx.)</span>
                  <span>15 km (fuera)</span>
                </div>
              </div>
            )}

            <div className="bg-[#DCE8D2]/75 rounded-xl p-5 border border-[#234D35]/15 space-y-3">
              <div className="flex justify-between text-sm text-[#193B29]">
                <span>Subtotal de productos</span>
                <span className="font-semibold tabular-nums">
                  {formatCentsMXN(breakdown.subtotalCents)} MXN
                </span>
              </div>

              <div className="flex justify-between text-sm text-[#193B29]">
                <span>
                  Cuota de servicio (4% sobre productos)
                  {!breakdown.serviceFeeApplied && breakdown.subtotalCents > 0 && ' · No aplica en sucursal'}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatCentsMXN(breakdown.serviceFeeCents)} MXN
                </span>
              </div>

              <div className="flex justify-between text-sm text-[#193B29]">
                <span>
                  Envío {BUSINESS_INFO.deliveryPartner}
                  {fulfillmentMode === 'delivery' && breakdown.covered && breakdown.subtotalCents > 0
                    ? ` (${distanceKm.toFixed(1)} km)`
                    : ''}
                </span>
                <span className="font-semibold tabular-nums">
                  {fulfillmentMode !== 'delivery' || breakdown.subtotalCents === 0
                    ? '$0.00 MXN'
                    : breakdown.covered
                      ? `${formatCentsMXN(breakdown.deliveryFeeCents)} MXN`
                      : 'Fuera de cobertura'}
                </span>
              </div>

              {!breakdown.covered ? (
                <div className="pt-3 border-t border-[#234D35]/15 space-y-2 text-sm text-[#193B29]">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-[#7A2E1D] shrink-0 mt-0.5" aria-hidden="true" />
                    <p>
                      {breakdown.deliveryQuote?.reason} El servicio a domicilio no está disponible arriba de 13 km.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFulfillmentMode('pickup')}
                    className="px-4 py-2 text-xs font-semibold bg-[#28583C] text-[#EDF3E5] rounded-lg hover:bg-[#1e432d] transition-colors cursor-pointer"
                  >
                    Cambiar a Recoger en tienda
                  </button>
                </div>
              ) : (
                <div className="pt-3 border-t border-[#234D35]/20 flex items-baseline justify-between">
                  <span className="font-display text-base font-bold text-[#193B29]">
                    Total estimado a pagar
                  </span>
                  <span className="font-display text-2xl font-bold text-[#234D35] tabular-nums">
                    {breakdown.totalCents !== null ? `${formatCentsMXN(breakdown.totalCents)} MXN` : '—'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
