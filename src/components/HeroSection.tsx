import { motion } from 'motion/react';
import { ArrowRight, MapPin, Clock } from 'lucide-react';
import { MENU_IMAGES } from '../data/menuData';
import { BUSINESS_INFO } from '../utils/pricing';
import { ResilientImage } from './ResilientImage';

interface HeroSectionProps {
  onOpenMenu: () => void;
}

const MARQUEE_WORDS = [
  'COMIDA REAL',
  'MÁS SABOR',
  'MÉRIDA, YUCATÁN',
  'PREPARACIÓN DIARIA',
  'TURBO MANDADOS',
  'NUTRICIOUS H&D',
];

export function HeroSection({ onOpenMenu }: HeroSectionProps) {
  return (
    <section id="inicio" className="relative pt-10 sm:pt-14 pb-0 overflow-hidden sage-botanical-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pb-14 lg:pb-20">
          {/* Left Column: Protagonist Message & Primary Action */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 space-y-6"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-[#234D35]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                {BUSINESS_INFO.city}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                {BUSINESS_INFO.scheduleDays}, {BUSINESS_INFO.scheduleHours}
              </span>
            </div>

            <h1 className="font-display text-[clamp(2.25rem,4.4vw,3.75rem)] font-bold leading-[1.06] tracking-tight text-[#193B29] text-balance">
              Comida real.{' '}
              <span className="inline-block bg-[#234D35] text-[#C6DE8B] px-3.5 py-0.5 rounded-2xl -rotate-1 my-1">
                Más sabor
              </span>{' '}
              para tu vida.
            </h1>

            <p className="text-base sm:text-lg text-[#193B29]/85 leading-relaxed max-w-xl">
              Desayunos preparados al momento, ensaladas personalizadas, baguettes, jugos funcionales y café orgánico de Chiapas en Mérida. Listos para recibir, recoger o disfrutar en restaurante.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={onOpenMenu}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-[#EDF3E5] bg-[#28583C] hover:bg-[#1e432d] rounded-2xl transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193B29]"
              >
                Hacer mi pedido
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 px-5 py-3.5 text-base font-semibold text-[#193B29] bg-[#EDF3E5] hover:bg-[#C6DE8B] border border-[#234D35]/15 rounded-2xl transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193B29]"
              >
                Cómo funciona
              </a>
            </div>

            <div className="pt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#193B29]/75 border-t border-[#234D35]/12">
              <span>Variedad diaria</span>
              <span aria-hidden="true">·</span>
              <span>Recoger o consumir en sucursal</span>
              <span aria-hidden="true">·</span>
              <span>Envíos con {BUSINESS_INFO.deliveryPartner}</span>
            </div>
          </motion.div>

          {/* Right Column: Protagonist Photography + Nutricious Emblem */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 relative"
          >
            <div className="relative rounded-[2rem] overflow-hidden bg-[#234D35] border border-[#234D35]/20 shadow-lg aspect-[4/3] sm:aspect-[16/10]">
              <ResilientImage
                src={MENU_IMAGES.heroSpread}
                alt="Avocado toast, huevos motuleños, bowl de yogurt con fruta y jugo verde preparados en Nutricious H&D"
                className="w-full h-full object-cover"
                fallbackLabel="Platillos frescos de Nutricious H&D"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#193B29]/60 via-transparent to-transparent pointer-events-none"
                aria-hidden="true"
              />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                <div className="bg-[#EDF3E5]/95 backdrop-blur-sm px-4 py-2.5 rounded-2xl border border-[#234D35]/15">
                  <p className="font-display text-sm font-bold text-[#193B29]">
                    {BUSINESS_INFO.brand} · {BUSINESS_INFO.slogan}
                  </p>
                  <p className="text-xs text-[#193B29]/80">
                    Cocina fresca en {BUSINESS_INFO.city}
                  </p>
                </div>
                <img
                  src={MENU_IMAGES.logo}
                  alt="Logotipo oficial Nutricious H&D"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-[#C6DE8B] shadow-md shrink-0"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Organic Forest Green Marquee */}
      <div className="bg-[#234D35] text-[#EDF3E5] py-3.5 -rotate-[0.7deg] scale-[1.02] border-y border-[#C6DE8B]/25 overflow-hidden select-none">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-8 px-4">
              {MARQUEE_WORDS.map((word) => (
                <span
                  key={`${dup}-${word}`}
                  className="font-display text-base sm:text-xl font-bold tracking-wider uppercase flex items-center gap-8 whitespace-nowrap"
                >
                  <span>{word}</span>
                  <span className="text-[#C6DE8B]" aria-hidden="true">
                    ✦
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
