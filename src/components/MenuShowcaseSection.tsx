import { useMemo, useState } from 'react';
import {
  Search,
  Heart,
  ArrowLeft,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sparkles,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { GLOBAL_DATE_EXCEPTIONS, MENU_CATEGORIES } from '../data/menuData';
import type { DraftOrderItem, MenuCategoryId, Product } from '../types/product';
import {
  addDaysToIso,
  evaluateProductAvailability,
  formatSpanishDateLabel,
  getDayOfWeekFromIso,
  getMeridaTodayIso,
  getMondayOfWeekIso,
  getWeekDaysFromMonday,
} from '../utils/meridaDate';
import { BUSINESS_INFO, formatMXN } from '../utils/pricing';
import { ResilientImage } from './ResilientImage';
import { ProductDetailModal } from './ProductDetailModal';
import type { AppView } from './MobileBottomBar';

type CategoryFilter = 'all' | 'specials' | 'favorites' | 'review' | MenuCategoryId;

interface MenuShowcaseSectionProps {
  products: Product[];
  globalDateExceptions?: Record<string, string>;
  selectedDateIso: string;
  onChangeDateIso: (iso: string) => void;
  favorites: string[];
  onToggleFavorite: (productId: string) => void;
  draftItems: DraftOrderItem[];
  onAddDraftItem: (item: DraftOrderItem) => void;
  onNavigateView: (view: AppView) => void;
}

export function MenuShowcaseSection({
  products,
  globalDateExceptions = GLOBAL_DATE_EXCEPTIONS,
  selectedDateIso,
  onChangeDateIso,
  favorites,
  onToggleFavorite,
  draftItems,
  onAddDraftItem,
  onNavigateView,
}: MenuShowcaseSectionProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [lastAddedName, setLastAddedName] = useState<string | null>(null);

  const todayIso = useMemo(() => getMeridaTodayIso(), []);
  const mondayIso = useMemo(() => getMondayOfWeekIso(selectedDateIso), [selectedDateIso]);
  const weekDays = useMemo(() => getWeekDaysFromMonday(mondayIso), [mondayIso]);

  const selectedDow = useMemo(() => getDayOfWeekFromIso(selectedDateIso), [selectedDateIso]);
  const isSundaySelected = selectedDow === 0;

  const cartQtyByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of draftItems) {
      map[item.productId] = (map[item.productId] ?? 0) + item.quantity;
    }
    return map;
  }, [draftItems]);

  const dateExceptionsOnSelectedDay = useMemo(() => {
    return products
      .filter(
        (p) => p.availability.dateExceptions && p.availability.dateExceptions[selectedDateIso]
      )
      .map((p) => ({
        productName: p.name,
        reason: p.availability.dateExceptions![selectedDateIso].reason,
      }));
  }, [products, selectedDateIso]);

  const dailySpecials = useMemo(
    () => products.filter((p) => p.isDailySpecial),
    [products]
  );

  const reviewCount = useMemo(
    () => products.filter((p) => p.reviewStatus === 'Por revisar').length,
    [products]
  );

  const activeCategoryMeta = useMemo(
    () => MENU_CATEGORIES.find((cat) => cat.id === activeCategory),
    [activeCategory]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      if (!product.admin.active) return false;
      if (activeCategory === 'specials' && !product.isDailySpecial) return false;
      if (activeCategory === 'favorites' && !favorites.includes(product.id)) return false;
      if (activeCategory === 'review' && product.reviewStatus !== 'Por revisar') return false;
      if (
        activeCategory !== 'all' &&
        activeCategory !== 'specials' &&
        activeCategory !== 'favorites' &&
        activeCategory !== 'review' &&
        product.category !== activeCategory
      ) {
        return false;
      }

      if (onlyAvailable) {
        const avail = evaluateProductAvailability(product, selectedDateIso, globalDateExceptions);
        if (!avail.canOrder) return false;
      }

      if (!q) return true;

      const ingredientsText = Array.isArray(product.nutrition.confirmedIngredients)
        ? product.nutrition.confirmedIngredients.join(' ').toLowerCase()
        : '';

      return (
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        product.categoryLabel.toLowerCase().includes(q) ||
        ingredientsText.includes(q)
      );
    });
  }, [
    products,
    activeCategory,
    favorites,
    onlyAvailable,
    searchQuery,
    selectedDateIso,
    globalDateExceptions,
  ]);

  const handleQuickAdd = (product: Product) => {
    const avail = evaluateProductAvailability(product, selectedDateIso, globalDateExceptions);
    const inCart = cartQtyByProduct[product.id] ?? 0;
    const hasRemaining = !product.inventory.trackStock || product.inventory.stock - inCart > 0;

    if (!avail.canOrder || product.priceMxn === null || !hasRemaining) {
      setDetailProduct(product);
      return;
    }

    if (product.customizations.length > 0) {
      setDetailProduct(product);
      return;
    }

    onAddDraftItem({
      uid: `${product.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      unitPriceMxn: product.priceMxn,
      quantity: 1,
      scheduledDateIso: selectedDateIso,
      selectedCustomizations: [],
    });
    setLastAddedName(product.name);
  };

  const handleAddedFromModal = (item: DraftOrderItem) => {
    onAddDraftItem(item);
    setLastAddedName(item.productName);
  };

  const draftCount = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.quantity, 0),
    [draftItems]
  );

  return (
    <section id="menu" className="py-8 sm:py-14 bg-[#DCE8D2] min-h-[85vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#234D35]/15">
          <button
            type="button"
            onClick={() => onNavigateView('inicio')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#234D35] hover:text-[#193B29] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Volver a Inicio
          </button>

          <button
            type="button"
            onClick={() => onNavigateView('mi-pedido')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            Ir al carrito y checkout ({draftCount})
          </button>
        </div>

        {lastAddedName && (
          <div className="bg-[#C6DE8B] text-[#193B29] rounded-2xl px-5 py-3.5 border border-[#234D35]/20 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              Se agregó <strong>{lastAddedName}</strong> al carrito para el{' '}
              {formatSpanishDateLabel(selectedDateIso)}.
            </p>
            <button
              type="button"
              onClick={() => onNavigateView('mi-pedido')}
              className="text-sm font-bold underline underline-offset-4 hover:text-[#234D35] cursor-pointer"
            >
              Ir a Mi pedido ({draftCount})
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#28583C]">
              Menú inteligente · {BUSINESS_INFO.city} ({BUSINESS_INFO.timezone})
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#193B29] text-balance">
              Explora platillos, ingredientes y disponibilidad
            </h1>
            <p className="text-sm sm:text-base text-[#193B29]/85">
              Precios del menú PDF en MXN. Los datos incompletos figuran como{' '}
              <strong>Por revisar</strong> y la nutrición pendiente como{' '}
              <strong>Por confirmar</strong>.
            </p>
          </div>

          <div className="w-full lg:w-96 space-y-2">
            <label htmlFor="smart-menu-search" className="sr-only">
              Buscar por nombre o ingrediente
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-[#234D35]/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="smart-menu-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar platillo o ingrediente (ej. kefir, chía, pollo)..."
                className="w-full pl-10 pr-4 py-3 text-sm bg-[#EDF3E5] text-[#193B29] placeholder:text-[#193B29]/55 rounded-xl border border-[#234D35]/20 focus:outline-none focus:ring-2 focus:ring-[#234D35]"
              />
            </div>
          </div>
        </div>

        {/* Weekly Calendar */}
        <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-6 border border-[#234D35]/15 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-[#234D35] shrink-0" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#28583C]">
                  Disponibilidad por fecha · {BUSINESS_INFO.scheduleDays}
                </p>
                <p className="font-display text-lg font-bold text-[#193B29]">
                  {formatSpanishDateLabel(selectedDateIso)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChangeDateIso(addDaysToIso(mondayIso, -7))}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs sm:text-sm font-semibold bg-[#DCE8D2] hover:bg-[#C6DE8B] text-[#193B29] rounded-xl transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                Semana anterior
              </button>
              <button
                type="button"
                onClick={() => onChangeDateIso(todayIso)}
                className="px-3 py-2 text-xs sm:text-sm font-semibold bg-[#DCE8D2] hover:bg-[#C6DE8B] text-[#193B29] rounded-xl transition-colors cursor-pointer"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => onChangeDateIso(addDaysToIso(mondayIso, 7))}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs sm:text-sm font-semibold bg-[#DCE8D2] hover:bg-[#C6DE8B] text-[#193B29] rounded-xl transition-colors cursor-pointer"
              >
                Semana siguiente
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {weekDays.map((day) => {
              const isSelected = day.iso === selectedDateIso;
              const isToday = day.iso === todayIso;
              const hasProductException = products.some(
                (p) => p.availability.dateExceptions && p.availability.dateExceptions[day.iso]
              );

              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => onChangeDateIso(day.iso)}
                  aria-pressed={isSelected}
                  className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#28583C] text-[#EDF3E5] border-[#28583C]'
                      : !day.isRestaurantOpen
                        ? 'bg-[#DCE8D2]/50 text-[#193B29]/55 border-[#234D35]/10 hover:bg-[#DCE8D2]'
                        : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15 hover:bg-[#C6DE8B]/70'
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase">{day.shortDay}</span>
                  <span className="font-display text-base sm:text-lg font-bold tabular-nums">
                    {day.dayNumber}
                  </span>
                  <span className="text-[10px] opacity-80 truncate max-w-full">
                    {!day.isRestaurantOpen
                      ? 'Cerrado'
                      : isToday
                        ? 'Hoy'
                        : hasProductException
                          ? 'Excep.'
                          : day.monthShort}
                  </span>
                </button>
              );
            })}
          </div>

          {isSundaySelected && (
            <div className="bg-[#C6DE8B]/40 rounded-2xl p-3.5 border border-[#234D35]/20 flex items-start gap-2.5 text-sm text-[#193B29]">
              <AlertCircle className="w-5 h-5 text-[#234D35] shrink-0 mt-0.5" aria-hidden="true" />
              <p>
                Los domingos el restaurante permanece cerrado. Selecciona un día entre{' '}
                <strong>lunes y sábado</strong> para consultar platillos disponibles.
              </p>
            </div>
          )}

          {dateExceptionsOnSelectedDay.length > 0 && (
            <div className="bg-[#C6DE8B]/40 rounded-2xl p-3.5 border border-[#234D35]/20 space-y-1 text-sm text-[#193B29]">
              <p className="font-bold">Excepciones programadas para esta fecha:</p>
              {dateExceptionsOnSelectedDay.map((exc) => (
                <p key={exc.productName} className="text-xs sm:text-sm">
                  <strong>{exc.productName}:</strong> {exc.reason}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Especiales del día */}
        <div className="bg-[#234D35] text-[#EDF3E5] rounded-3xl p-5 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-[#C6DE8B] shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#EDF3E5]">
                  Especiales del día
                </h2>
                <p className="text-xs sm:text-sm text-[#DCE8D2]/85">
                  Platillos y bebidas destacadas para el {formatSpanishDateLabel(selectedDateIso)}.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveCategory('specials')}
              className="text-xs sm:text-sm font-semibold text-[#C6DE8B] underline underline-offset-4 hover:text-[#EDF3E5] cursor-pointer"
            >
              Filtrar solo especiales
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dailySpecials.map((special) => {
              const avail = evaluateProductAvailability(
                special,
                selectedDateIso,
                GLOBAL_DATE_EXCEPTIONS
              );
              const fav = favorites.includes(special.id);
              return (
                <div
                  key={special.id}
                  className="bg-[#EDF3E5] text-[#193B29] rounded-2xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#28583C]">
                        {special.categoryLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(special.id)}
                        aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                        aria-pressed={fav}
                        className="p-1 text-[#234D35] hover:scale-105 transition-transform cursor-pointer"
                      >
                        <Heart
                          className={`w-4 h-4 ${fav ? 'fill-[#234D35]' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                    <h3 className="font-display text-base font-bold leading-snug">
                      {special.name}
                    </h3>
                    <p className="text-xs text-[#193B29]/75 line-clamp-2">
                      {special.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#234D35]/12">
                    <span className="font-display text-base font-bold text-[#234D35] tabular-nums">
                      {special.priceMxn !== null ? formatMXN(special.priceMxn) : 'Por revisar'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailProduct(special)}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-lg transition-colors cursor-pointer"
                    >
                      {avail.canOrder ? 'Ver / Pedir' : avail.statusLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="space-y-3">
          <div
            role="tablist"
            aria-label="Filtros y categorías del menú"
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
              className={`px-3.5 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-[#28583C] text-[#EDF3E5]'
                  : 'bg-[#EDF3E5] text-[#193B29] hover:bg-[#C6DE8B]/70'
              }`}
            >
              Todo ({products.length})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'specials'}
              onClick={() => setActiveCategory('specials')}
              className={`px-3.5 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCategory === 'specials'
                  ? 'bg-[#28583C] text-[#EDF3E5]'
                  : 'bg-[#EDF3E5] text-[#193B29] hover:bg-[#C6DE8B]/70'
              }`}
            >
              Especiales del día ({dailySpecials.length})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'favorites'}
              onClick={() => setActiveCategory('favorites')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCategory === 'favorites'
                  ? 'bg-[#28583C] text-[#EDF3E5]'
                  : 'bg-[#EDF3E5] text-[#193B29] hover:bg-[#C6DE8B]/70'
              }`}
            >
              <Heart className="w-3.5 h-3.5" aria-hidden="true" />
              Favoritos ({favorites.length})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'review'}
              onClick={() => setActiveCategory('review')}
              className={`px-3.5 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCategory === 'review'
                  ? 'bg-[#28583C] text-[#EDF3E5]'
                  : 'bg-[#EDF3E5] text-[#193B29] hover:bg-[#C6DE8B]/70'
              }`}
            >
              Por revisar ({reviewCount})
            </button>

            {MENU_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={activeCategory === category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-3.5 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeCategory === category.id
                    ? 'bg-[#28583C] text-[#EDF3E5]'
                    : 'bg-[#EDF3E5] text-[#193B29] hover:bg-[#C6DE8B]/70'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#234D35]/12">
            <p className="text-sm text-[#193B29]/80">
              Mostrando <strong className="tabular-nums">{filteredProducts.length}</strong> producto(s)
              {activeCategoryMeta?.note ? ` · ${activeCategoryMeta.note}` : ''}
            </p>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-[#193B29] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="w-4 h-4 accent-[#28583C] rounded cursor-pointer"
              />
              Solo disponibles en esta fecha
            </label>
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-[#EDF3E5] rounded-3xl p-10 text-center border border-[#234D35]/15 space-y-3">
            <p className="font-display text-lg font-semibold text-[#193B29]">
              {activeCategory === 'favorites'
                ? 'Todavía no tienes favoritos guardados'
                : 'No encontramos productos con los filtros actuales'}
            </p>
            <p className="text-sm text-[#193B29]/75 max-w-md mx-auto">
              {activeCategory === 'favorites'
                ? 'Pulsa el ícono de corazón en cualquier platillo o bebida para guardarlo aquí.'
                : 'Prueba buscar otro ingrediente, desactivar el filtro de fecha o ver todo el menú.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
                setOnlyAvailable(false);
              }}
              className="px-4 py-2.5 text-sm font-semibold bg-[#28583C] text-[#EDF3E5] rounded-xl hover:bg-[#1e432d] transition-colors cursor-pointer"
            >
              Mostrar todo el menú
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const avail = evaluateProductAvailability(
                product,
                selectedDateIso,
                GLOBAL_DATE_EXCEPTIONS
              );
              const isFavorite = favorites.includes(product.id);
              const hasRequiredCustomizations = product.customizations.length > 0;
              const inCart = cartQtyByProduct[product.id] ?? 0;
              const remaining = product.inventory.trackStock
                ? Math.max(0, product.inventory.stock - inCart)
                : 99;
              const canQuickOrder = avail.canOrder && remaining > 0;

              return (
                <article
                  key={product.id}
                  className={`bg-[#EDF3E5] rounded-3xl overflow-hidden border border-[#234D35]/15 flex flex-col justify-between transition-transform duration-200 ${
                    avail.canOrder ? 'hover:-translate-y-0.5' : 'opacity-90'
                  }`}
                >
                  <div>
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#DCE8D2]">
                      <ResilientImage
                        src={product.photo.url}
                        alt={product.photo.alt}
                        className={`w-full h-full object-cover ${
                          !avail.canOrder ? 'grayscale-[35%]' : ''
                        }`}
                        fallbackLabel={product.name}
                      />

                      <div className="absolute bottom-2.5 left-2.5 bg-[#193B29]/80 text-[#EDF3E5] px-2.5 py-1 rounded-lg text-[11px] font-medium">
                        {product.photo.caption}
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleFavorite(product.id)}
                        aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                        aria-pressed={isFavorite}
                        className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-[#EDF3E5]/95 text-[#193B29] flex items-center justify-center hover:bg-[#C6DE8B] transition-colors cursor-pointer"
                      >
                        <Heart
                          className={`w-4 h-4 ${isFavorite ? 'fill-[#234D35] text-[#234D35]' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    <div className="p-5 sm:p-6 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-[#234D35]/85">
                        <span>{product.categoryLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            avail.canOrder ? 'text-[#234D35] font-semibold' : 'text-[#7A2E1D] font-semibold'
                          }
                        >
                          {avail.statusLabel}
                        </span>
                        {inCart > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#28583C]">
                              {inCart} en carrito
                            </span>
                          </>
                        )}
                        {product.reviewStatus === 'Por revisar' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#7A2E1D] font-semibold">Por revisar</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-bold text-[#193B29] leading-snug">
                          {product.name}
                        </h3>
                        <span className="font-display text-lg font-bold text-[#234D35] tabular-nums whitespace-nowrap shrink-0">
                          {product.priceMxn !== null ? formatMXN(product.priceMxn) : 'Por revisar'}
                        </span>
                      </div>

                      <p className="text-sm text-[#193B29]/80 leading-relaxed">
                        {product.description}
                      </p>

                      {hasRequiredCustomizations && (
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#28583C]">
                          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          Requiere elegir opciones ({product.customizations.length} paso
                          {product.customizations.length > 1 ? 's' : ''})
                        </p>
                      )}

                      {product.reviewStatus === 'Por revisar' && product.reviewNote && (
                        <p className="text-xs text-[#7A2E1D] bg-[#C6DE8B]/30 rounded-lg px-2.5 py-1.5">
                          Revisión PDF: {product.reviewNote}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-3 flex items-center justify-between gap-3 border-t border-[#234D35]/10">
                    <button
                      type="button"
                      onClick={() => setDetailProduct(product)}
                      className="text-sm font-semibold text-[#28583C] hover:text-[#193B29] underline underline-offset-4 transition-colors cursor-pointer"
                    >
                      Ver ficha y nutrición
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickAdd(product)}
                      disabled={!canQuickOrder}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                        !canQuickOrder
                          ? 'bg-[#234D35]/15 text-[#193B29]/50 cursor-not-allowed'
                          : 'bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] cursor-pointer'
                      }`}
                    >
                      {!avail.canOrder
                        ? avail.statusLabel
                        : remaining === 0
                          ? 'Tope de stock'
                          : hasRequiredCustomizations
                            ? 'Personalizar'
                            : 'Agregar'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          selectedDateIso={selectedDateIso}
          globalDateExceptions={globalDateExceptions}
          qtyAlreadyInCart={cartQtyByProduct[detailProduct.id] ?? 0}
          isFavorite={favorites.includes(detailProduct.id)}
          onToggleFavorite={onToggleFavorite}
          onAddDraftItem={handleAddedFromModal}
          onClose={() => setDetailProduct(null)}
        />
      )}
    </section>
  );
}
