import { UtensilsCrossed, CalendarClock, MapPinCheck } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    kicker: 'Paso 1',
    title: 'Elige tus platillos.',
    description:
      'Explora el menú completo de Nutricious H&D y selecciona tus desayunos, baguettes, ensaladas, jugos o bebidas favoritas.',
    icon: UtensilsCrossed,
    cardClass: 'bg-[#EDF3E5] text-[#193B29]',
  },
  {
    number: '02',
    kicker: 'Paso 2',
    title: 'Selecciona fecha, horario y modalidad.',
    description:
      'Define el día y horario dentro de nuestra jornada de lunes a sábado (7:30 am a 2:30 pm) y elige la modalidad que más te convenga.',
    icon: CalendarClock,
    cardClass: 'bg-[#C6DE8B] text-[#193B29]',
  },
  {
    number: '03',
    kicker: 'Paso 3',
    title: 'Recibe, recoge o consume en restaurante.',
    description:
      'Recibe tu orden mediante Turbo Mandados hasta 13 km desde el restaurante, o pasa a recoger o disfrutar en mesa sin cuota de servicio.',
    icon: MapPinCheck,
    cardClass: 'bg-[#EDF3E5] text-[#193B29]',
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-16 sm:py-20 bg-[#DCE8D2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-14 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#28583C]">
            Cómo comprar
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#193B29] text-balance">
            Así de simple es pedir en Nutricious H&amp;D
          </h2>
          <p className="text-base sm:text-lg text-[#193B29]/80">
            Tres pasos claros para disfrutar tu comida como prefieras.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={`rounded-[2rem] p-7 sm:p-8 border border-[#234D35]/15 flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5 ${step.cardClass}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-display text-3xl font-bold text-[#234D35] tabular-nums">
                      {step.number}
                    </span>
                    <div className="w-11 h-11 rounded-2xl bg-[#234D35] text-[#EDF3E5] flex items-center justify-center">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#234D35]/80 mb-2">
                    {step.kicker}
                  </p>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-[#193B29] mb-3 leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-sm sm:text-base text-[#193B29]/85 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
