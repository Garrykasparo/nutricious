import { ArrowRight } from 'lucide-react';
import type { Product } from '../types/product';
import { formatMXN } from '../utils/pricing';
import { ResilientImage } from './ResilientImage';

interface FeaturedDishesSectionProps {
  products: Product[];
  onOpenMenu: () => void;
}

const FEATURED_IDS = ['avocado-toast', 'chilaquiles-pollo', 'jugo-verde-nutricious'];

export function FeaturedDishesSection({ products, onOpenMenu }: FeaturedDishesSectionProps) {
  const featuredDishes = FEATURED_IDS.map((id) =>
    products.find((item) => item.id === id)
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <section className="py-16 sm:py-20 bg-[#DCE8D2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-12">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#28583C]">
              Selección del menú
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#193B29] text-balance">
              Tres platillos destacados de Nutricious H&amp;D
            </h2>
            <p className="text-base sm:text-lg text-[#193B29]/85">
              Una muestra de nuestra cocina diaria en Mérida. Abre el menú completo para explorar todas las categorías y precios en MXN.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenMenu}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm sm:text-base font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Hacer mi pedido
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {featuredDishes.map((dish) => (
            <article
              key={dish.id}
              className="bg-[#EDF3E5] rounded-3xl overflow-hidden border border-[#234D35]/12 flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div>
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#DCE8D2]">
                  <ResilientImage
                    src={dish.photo.url}
                    alt={dish.photo.alt}
                    className="w-full h-full object-cover"
                    fallbackLabel={dish.name}
                  />
                  <div className="absolute bottom-2.5 left-2.5 bg-[#193B29]/80 text-[#EDF3E5] px-2.5 py-1 rounded-lg text-[11px] font-medium">
                    {dish.photo.caption}
                  </div>
                </div>
                <div className="p-6 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#234D35]/80">
                    <span>{dish.categoryLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>Nutrición: {dish.nutrition.validationStatus}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-xl font-bold text-[#193B29] leading-snug">
                      {dish.name}
                    </h3>
                    <span className="font-display text-xl font-bold text-[#234D35] tabular-nums whitespace-nowrap shrink-0">
                      {dish.priceMxn !== null ? formatMXN(dish.priceMxn) : 'Por revisar'}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base text-[#193B29]/80 leading-relaxed">
                    {dish.description}
                  </p>
                </div>
              </div>

              <div className="px-6 pb-6 pt-3 border-t border-[#234D35]/10">
                <button
                  type="button"
                  onClick={onOpenMenu}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#28583C] hover:text-[#193B29] transition-colors cursor-pointer"
                >
                  Ver en el menú completo
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
