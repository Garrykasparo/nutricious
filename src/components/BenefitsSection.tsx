import { Layers, Clock3, CalendarCheck } from 'lucide-react';

const BENEFITS = [
  {
    id: 'variedad',
    icon: Layers,
    title: 'Variedad para cada momento',
    description:
      'Más de 50 opciones entre desayunos dulces y salados, huevos al gusto, chilaquiles, baguettes, ensaladas armables, jugos funcionales, tés, aguas frescas y café orgánico de Chiapas.',
  },
  {
    id: 'comodidad',
    icon: Clock3,
    title: 'Comodidad sin perder tiempo',
    description:
      'Resuelve tus mañanas y mediodías sin planear compras ni pasar horas cocinando. Elige recibir en casa o trabajo, recoger en sucursal o comer directamente en restaurante.',
  },
  {
    id: 'organizacion',
    icon: CalendarCheck,
    title: 'Organización práctica de tus comidas',
    description:
      'Ordena platillos por día o prepara tu semana con anticipación mediante modalidades claras, horarios definidos de lunes a sábado y tarifas transparentes.',
  },
];

export function BenefitsSection() {
  return (
    <section id="beneficios" className="py-16 sm:py-24 bg-[#234D35] text-[#EDF3E5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-14 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#C6DE8B]">
            Beneficios de nuestra propuesta
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#EDF3E5] text-balance">
            Variedad, comodidad y orden en tu día a día
          </h2>
          <p className="text-base sm:text-lg text-[#DCE8D2]/90">
            Una experiencia pensada para que disfrutar comida fresca sea sencillo de lunes a sábado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {BENEFITS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="bg-[#EDF3E5] text-[#193B29] rounded-[2rem] p-7 sm:p-8 flex flex-col justify-between border border-[#C6DE8B]/40 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#C6DE8B] text-[#193B29] flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#193B29] mb-3">
                    {item.title}
                  </h3>
                  <p className="text-sm sm:text-base text-[#193B29]/85 leading-relaxed">
                    {item.description}
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
