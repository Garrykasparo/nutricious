import { ArrowRight } from 'lucide-react';
import { MENU_IMAGES } from '../data/menuData';
import { BUSINESS_INFO } from '../utils/pricing';
import { ResilientImage } from './ResilientImage';

interface BrandStorySectionProps {
  onOpenMenu: () => void;
}

export function BrandStorySection({ onOpenMenu }: BrandStorySectionProps) {
  return (
    <section id="nosotros" className="py-16 sm:py-24 bg-[#DCE8D2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-16 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#28583C]">
            Presentación de Nutricious H&amp;D
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#193B29] leading-[1.1] text-balance">
            Comida real, vida mejor para tus días en Mérida
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6">
            <div className="h-full rounded-[2rem] overflow-hidden bg-[#EDF3E5] border border-[#234D35]/15 p-3">
              <div className="rounded-[1.5rem] overflow-hidden h-full min-h-[280px]">
                <ResilientImage
                  src={MENU_IMAGES.authenticSpread}
                  alt="Desayunos, frutas y bebidas naturales servidos por Nutricious H&D"
                  className="w-full h-full object-cover"
                  fallbackLabel="Mesa real de Nutricious H&D"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col justify-center space-y-6 bg-[#EDF3E5] rounded-[2rem] p-7 sm:p-10 border border-[#234D35]/12">
            <div className="flex items-center gap-3">
              <img
                src={MENU_IMAGES.logo}
                alt="Emblema Nutricious H&D"
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border border-[#234D35]/20 shrink-0"
              />
              <div>
                <p className="font-display text-base font-bold text-[#193B29]">
                  {BUSINESS_INFO.brand}
                </p>
                <p className="text-xs text-[#28583C] font-medium">
                  {BUSINESS_INFO.city} · {BUSINESS_INFO.scheduleDays}
                </p>
              </div>
            </div>

            <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#193B29] leading-snug text-balance">
              Preparamos platillos frescos y sabrosos pensados para tu rutina diaria.
            </h3>

            <p className="text-base text-[#193B29]/85 leading-relaxed">
              En Nutricious H&amp;D reunimos opciones prácticas y apetitosas en un mismo lugar: hotcakes de avena, toast de masa madre con queso untable de kefir, huevos motuleños, chilaquiles, sándwiches, baguettes, ensaladas armadas a tu gusto, jugos naturales y café orgánico de Chiapas.
            </p>

            <p className="text-base text-[#193B29]/85 leading-relaxed">
              Nuestro propósito es acercarte comida bien preparada todos los días de lunes a sábado, ya sea para recibir en tu domicilio, pasar por ella o sentarte a disfrutarla en el restaurante.
            </p>

            <div className="pt-4 border-t border-[#234D35]/12 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={onOpenMenu}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl transition-colors cursor-pointer"
              >
                Explorar el menú
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <span className="text-sm text-[#193B29]/80">
                WhatsApp: <strong className="text-[#193B29]">{BUSINESS_INFO.whatsappDisplay}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
