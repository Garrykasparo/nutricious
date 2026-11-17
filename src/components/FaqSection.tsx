import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BUSINESS_INFO, formatCentsMXN, TURBO_MANDADOS_RULES } from '../utils/pricing';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'horario',
    question: '¿Cuál es el horario de atención en Mérida?',
    answer: `Atendemos de ${BUSINESS_INFO.scheduleDays} de ${BUSINESS_INFO.scheduleHours} (zona horaria ${BUSINESS_INFO.timezone}). También puedes comunicarte por WhatsApp al ${BUSINESS_INFO.whatsappDisplay}.`,
  },
  {
    id: 'modalidades',
    question: '¿Qué modalidades de entrega o consumo ofrecen?',
    answer:
      'Puedes elegir entre entrega a domicilio mediante Turbo Mandados, pasar a recoger tu pedido o consumir directamente en el restaurante.',
  },
  {
    id: 'tarifa-envio',
    question: '¿Cómo se calcula el envío con Turbo Mandados y cuál es la cobertura?',
    answer: `La tarifa de entrega es de ${formatCentsMXN(TURBO_MANDADOS_RULES.baseFeeCents)} MXN de 0 a ${TURBO_MANDADOS_RULES.baseKm} km y ${formatCentsMXN(TURBO_MANDADOS_RULES.additionalKmFeeCents)} MXN por cada kilómetro adicional, con cobertura máxima de ${TURBO_MANDADOS_RULES.maxCoverageKm} km desde el restaurante en Mérida.`,
  },
  {
    id: 'cuota-servicio',
    question: '¿Cuándo se aplica la cuota de servicio del 4%?',
    answer:
      'La cuota de servicio del 4% se calcula únicamente sobre el subtotal de los productos en pedidos con entrega a domicilio. No se aplica sobre el envío, no se aplica sobre la propia cuota y tampoco aplica en compras realizadas en la plataforma para recoger o consumir en restaurante.',
  },
  {
    id: 'planes-semanales',
    question: '¿Cómo funcionan los planes semanales y su cuota de servicio?',
    answer:
      'Los planes semanales están pensados para generar órdenes diarias independientes. Cuando se contrata un plan semanal, la cuota de servicio del 4% se calcula una sola vez sobre el precio de los alimentos del plan. Actualmente los paquetes mostrados son ilustrativos y sus precios finales están por confirmar.',
  },
  {
    id: 'info-nutricional',
    question: '¿Dónde puedo consultar las calorías y macros de cada platillo?',
    answer:
      'Los valores nutricionales detallados de cada platillo están en proceso de confirmación, por lo que aparecen marcados como "Por confirmar" en el menú.',
  },
];

export function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id);

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section id="faq" className="py-16 sm:py-20 bg-[#DCE8D2]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#28583C]">
            Dudas comunes
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#193B29] text-balance">
            Preguntas frecuentes
          </h2>
          <p className="text-base sm:text-lg text-[#193B29]/85">
            Información clara sobre horarios, modalidades, envíos y menú de Nutricious H&amp;D.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className="bg-[#EDF3E5] rounded-2xl border border-[#234D35]/15 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${item.id}`}
                  className="w-full px-5 sm:px-7 py-5 text-left flex items-center justify-between gap-4 hover:bg-[#C6DE8B]/25 transition-colors cursor-pointer"
                >
                  <span className="font-display text-base sm:text-lg font-bold text-[#193B29]">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-[#234D35] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isOpen && (
                  <div
                    id={`faq-panel-${item.id}`}
                    className="px-5 sm:px-7 pb-5 pt-1 text-sm sm:text-base text-[#193B29]/85 leading-relaxed border-t border-[#234D35]/10"
                  >
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
