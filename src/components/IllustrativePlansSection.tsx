import { Calendar, ArrowRight, Info, ExternalLink } from 'lucide-react';
import { DEFAULT_CONFIGURABLE_PLAN_TEMPLATES } from '../data/menuData';
import type { ConfigurablePlanTemplate } from '../types/product';
import { BUSINESS_INFO, formatMXN } from '../utils/pricing';

interface IllustrativePlansSectionProps {
  planTemplates?: ConfigurablePlanTemplate[];
  onOpenPlanConfigurator?: (templateId?: string) => void;
}

export function IllustrativePlansSection({
  planTemplates = DEFAULT_CONFIGURABLE_PLAN_TEMPLATES,
  onOpenPlanConfigurator,
}: IllustrativePlansSectionProps) {
  const activeTemplates = planTemplates.filter((t) => t.active);

  return (
    <section id="planes" className="py-16 sm:py-24 bg-[#234D35] text-[#EDF3E5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#C6DE8B]">
              Planes semanales · Paquetes ilustrativos configurables
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#EDF3E5] text-balance">
              Planes semanales con órdenes diarias independientes
            </h2>
            <p className="text-base sm:text-lg text-[#DCE8D2]/90 leading-relaxed">
              Los siguientes paquetes son <strong className="text-[#C6DE8B]">ejemplos ilustrativos configurables</strong> para programar tu semana y probar el flujo operativo. No representan tarifas comerciales definitivas confirmadas.
            </p>
          </div>

          {onOpenPlanConfigurator && (
            <button
              type="button"
              onClick={() => onOpenPlanConfigurator()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold bg-[#C6DE8B] text-[#193B29] hover:bg-[#d7eba6] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Calendar className="w-4 h-4" aria-hidden="true" />
              Configurar mi plan semanal
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {activeTemplates.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-7 sm:p-8 flex flex-col justify-between border ${
                plan.highlighted
                  ? 'bg-[#28583C] text-[#EDF3E5] border-[#C6DE8B]/60'
                  : 'bg-[#EDF3E5] text-[#193B29] border-[#C6DE8B]/30'
              }`}
            >
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider opacity-85">
                  {plan.subtitle}
                </div>

                <h3 className="font-display text-2xl font-bold leading-snug">
                  {plan.name}{' '}
                  <span className="text-sm font-semibold opacity-80 block mt-0.5">
                    (Paquete ilustrativo configurable)
                  </span>
                </h3>

                <p className="text-sm sm:text-base leading-relaxed opacity-90">
                  {plan.description}
                </p>

                <div
                  className={`pt-4 border-t ${
                    plan.highlighted ? 'border-[#EDF3E5]/20' : 'border-[#234D35]/15'
                  }`}
                >
                  <p className="font-display text-lg font-bold tabular-nums">
                    {plan.foodPricingMode === 'fixed_example'
                      ? `Referencia ejemplo: ${formatMXN(plan.exampleFoodPriceMxn)} (no definitiva)`
                      : 'Calculado según platillos elegidos · Ejemplo configurable'}
                  </p>
                  <p className="text-xs sm:text-sm opacity-80 mt-1">
                    {plan.includesExample} · {plan.defaultDaysCount} días sugeridos
                  </p>
                </div>
              </div>

              <div className="mt-7 space-y-2.5">
                {onOpenPlanConfigurator && (
                  <button
                    type="button"
                    onClick={() => onOpenPlanConfigurator(plan.id)}
                    className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${
                      plan.highlighted
                        ? 'bg-[#C6DE8B] text-[#193B29] hover:bg-[#d7eba6]'
                        : 'bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d]'
                    }`}
                  >
                    Armar este plan (demo)
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}

                <a
                  href={`${BUSINESS_INFO.whatsappUrl}?text=${encodeURIComponent(
                    `Hola Nutricious H&D, quiero información sobre disponibilidad de planes semanales (${plan.name}).`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${
                    plan.highlighted
                      ? 'border-[#EDF3E5]/25 text-[#EDF3E5] hover:bg-[#193B29]/50'
                      : 'border-[#234D35]/20 text-[#234D35] hover:bg-[#DCE8D2]'
                  }`}
                >
                  Consultar por WhatsApp
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Commercial Rule Transparency Notice */}
        <div className="mt-10 bg-[#193B29]/55 border border-[#C6DE8B]/30 rounded-2xl p-5 sm:p-6 flex items-start gap-4">
          <Info className="w-5 h-5 text-[#C6DE8B] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-[#DCE8D2]/95 leading-relaxed">
            <span className="font-semibold text-[#EDF3E5]">Regla comercial confirmada para planes semanales:</span>{' '}
            al contratar un plan semanal, se genera un registro principal de compra y pago, un calendario y <strong>órdenes diarias independientes</strong> (con entregas vinculadas por día). La cuota de servicio del 4% se calcula una sola vez sobre los alimentos del plan y los envíos con Turbo Mandados (hasta 13 km) se suman según los días contratados a domicilio.
          </div>
        </div>
      </div>
    </section>
  );
}
