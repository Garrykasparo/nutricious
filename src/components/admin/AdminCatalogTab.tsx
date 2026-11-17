import { useMemo, useState } from 'react';
import { Check, Plus, Search, Trash2 } from 'lucide-react';
import { MENU_CATEGORIES } from '../../data/menuData';
import type {
  DayOfWeek,
  Product,
  ProductNutritionSheet,
} from '../../types/product';
import { getMeridaTodayIso } from '../../utils/meridaDate';
import { formatCentsMXN, mxnToCents } from '../../utils/pricing';

interface AdminCatalogTabProps {
  products: Product[];
  globalDateExceptions: Record<string, string>;
  onUpdateProductAdmin: (
    productId: string,
    updater: (prev: Product) => Product,
    auditAction: string,
    auditDetails: string
  ) => void;
  onUpsertGlobalDateException: (dateIso: string, reason: string) => void;
  onRemoveGlobalDateException: (dateIso: string) => void;
  onNotify: (tone: 'ok' | 'error', text: string) => void;
}

const WEEKDAY_OPTIONS: Array<{ day: DayOfWeek; short: string }> = [
  { day: 1, short: 'Lun' },
  { day: 2, short: 'Mar' },
  { day: 3, short: 'Mié' },
  { day: 4, short: 'Jue' },
  { day: 5, short: 'Vie' },
  { day: 6, short: 'Sáb' },
];

export function AdminCatalogTab({
  products,
  globalDateExceptions,
  onUpdateProductAdmin,
  onUpsertGlobalDateException,
  onRemoveGlobalDateException,
  onNotify,
}: AdminCatalogTabProps) {
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<string>(
    () => products[0]?.id ?? 'omelet-jamon-queso'
  );
  const [globalExDate, setGlobalExDate] = useState(() => getMeridaTodayIso());
  const [globalExReason, setGlobalExReason] = useState('');

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? products[0] ?? null,
    [products, selectedProductId]
  );

  const [lastSyncedId, setLastSyncedId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<string>('');
  const [pricePendingReview, setPricePendingReview] = useState<boolean>(false);
  const [reviewNoteDraft, setReviewNoteDraft] = useState<string>('');
  const [stockDraft, setStockDraft] = useState<string>('0');
  const [prodExDate, setProdExDate] = useState<string>(() => getMeridaTodayIso());
  const [prodExAvailable, setProdExAvailable] = useState<boolean>(false);
  const [prodExReason, setProdExReason] = useState<string>('');

  const [nutriServing, setNutriServing] = useState<string>('');
  const [nutriKcal, setNutriKcal] = useState<string>('');
  const [nutriProtein, setNutriProtein] = useState<string>('');
  const [nutriCarbs, setNutriCarbs] = useState<string>('');
  const [nutriFat, setNutriFat] = useState<string>('');
  const [nutriIngredients, setNutriIngredients] = useState<string>('');
  const [nutriAllergens, setNutriAllergens] = useState<string>('');
  const [nutriValidationConfirmed, setNutriValidationConfirmed] = useState<boolean>(false);

  const syncBuffer = (product: Product) => {
    setLastSyncedId(product.id);
    setPriceDraft(product.priceMxn !== null ? String(product.priceMxn) : '');
    setPricePendingReview(product.priceMxn === null);
    setReviewNoteDraft(product.reviewNote || '');
    setStockDraft(String(product.inventory.stock));
    const sourceNutri = product.draftNutrition ?? product.nutrition;
    setNutriServing(sourceNutri.servingSize === 'Por confirmar' ? '' : sourceNutri.servingSize);
    setNutriKcal(sourceNutri.energyKcal === 'Por confirmar' ? '' : String(sourceNutri.energyKcal));
    setNutriProtein(
      sourceNutri.proteinGrams === 'Por confirmar' ? '' : String(sourceNutri.proteinGrams)
    );
    setNutriCarbs(sourceNutri.carbsGrams === 'Por confirmar' ? '' : String(sourceNutri.carbsGrams));
    setNutriFat(sourceNutri.fatGrams === 'Por confirmar' ? '' : String(sourceNutri.fatGrams));
    setNutriIngredients(
      Array.isArray(sourceNutri.confirmedIngredients)
        ? sourceNutri.confirmedIngredients.join(', ')
        : ''
    );
    setNutriAllergens(
      Array.isArray(sourceNutri.confirmedAllergens)
        ? sourceNutri.confirmedAllergens.join(', ')
        : ''
    );
    setNutriValidationConfirmed(product.nutrition.validationStatus === 'Validado');
  };

  if (selectedProduct && selectedProduct.id !== lastSyncedId) {
    syncBuffer(selectedProduct);
  }

  const filteredCatalogProducts = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (catalogCategory === 'review' && p.reviewStatus !== 'Por revisar') return false;
      if (catalogCategory === 'specials' && !p.isDailySpecial) return false;
      if (
        catalogCategory !== 'all' &&
        catalogCategory !== 'review' &&
        catalogCategory !== 'specials' &&
        p.category !== catalogCategory
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.admin.sku.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [products, catalogSearch, catalogCategory]);

  const handleSaveCatalogPricingAndStock = () => {
    if (!selectedProduct) return;
    const parsedStock = Math.max(0, Number.parseInt(stockDraft || '0', 10) || 0);
    const parsedPrice = pricePendingReview
      ? null
      : Math.max(0, Math.round((Number.parseFloat(priceDraft || '0') || 0) * 100) / 100);

    if (!pricePendingReview && (parsedPrice === null || parsedPrice <= 0)) {
      onNotify(
        'error',
        'Ingresa un precio MXN mayor a 0 o marca "Precio pendiente (Por revisar)".'
      );
      return;
    }

    onUpdateProductAdmin(
      selectedProduct.id,
      (prev) => ({
        ...prev,
        priceMxn: parsedPrice,
        reviewStatus: pricePendingReview ? 'Por revisar' : 'Confirmado',
        reviewNote: pricePendingReview ? reviewNoteDraft.trim() || prev.reviewNote : undefined,
        inventory: {
          ...prev.inventory,
          stock: parsedStock,
        },
      }),
      'Edición de precio y existencias',
      `Precio: ${
        parsedPrice !== null ? formatCentsMXN(mxnToCents(parsedPrice)) : 'Por revisar'
      } · Existencias: ${parsedStock}`
    );

    onNotify('ok', `Precio y existencias actualizados en "${selectedProduct.name}".`);
  };

  const handleToggleDayOfWeek = (day: DayOfWeek) => {
    if (!selectedProduct) return;
    const exists = selectedProduct.availability.daysOfWeek.includes(day);
    const nextDays = exists
      ? selectedProduct.availability.daysOfWeek.filter((d) => d !== day)
      : [...selectedProduct.availability.daysOfWeek, day].sort((a, b) => a - b);

    onUpdateProductAdmin(
      selectedProduct.id,
      (prev) => ({
        ...prev,
        availability: {
          ...prev.availability,
          daysOfWeek: nextDays,
        },
      }),
      'Disponibilidad semanal',
      `Días activos: ${nextDays.join(', ') || 'Ninguno'}`
    );
  };

  const handleAddProductDateException = () => {
    if (!selectedProduct || !prodExDate) return;
    const reason =
      prodExReason.trim() ||
      (prodExAvailable ? 'Habilitado por excepción administrativa' : 'No disponible en esta fecha');

    onUpdateProductAdmin(
      selectedProduct.id,
      (prev) => ({
        ...prev,
        availability: {
          ...prev.availability,
          dateExceptions: {
            ...(prev.availability.dateExceptions ?? {}),
            [prodExDate]: { available: prodExAvailable, reason },
          },
        },
      }),
      'Excepción de fecha en producto',
      `${prodExDate}: ${prodExAvailable ? 'Disponible' : 'Bloqueado'} (${reason})`
    );
    setProdExReason('');
    onNotify('ok', `Excepción para el ${prodExDate} guardada en "${selectedProduct.name}".`);
  };

  const handleRemoveProductDateException = (dateIso: string) => {
    if (!selectedProduct) return;
    onUpdateProductAdmin(
      selectedProduct.id,
      (prev) => {
        const nextEx = { ...(prev.availability.dateExceptions ?? {}) };
        delete nextEx[dateIso];
        return {
          ...prev,
          availability: {
            ...prev.availability,
            dateExceptions: nextEx,
          },
        };
      },
      'Eliminación de excepción de fecha',
      `Fecha eliminada: ${dateIso}`
    );
  };

  const buildNutritionPayload = (
    status: 'Por confirmar' | 'Validado'
  ): ProductNutritionSheet => {
    const parseOptNum = (raw: string): number | 'Por confirmar' => {
      const trimmed = raw.trim();
      if (!trimmed) return 'Por confirmar';
      const num = Number.parseFloat(trimmed);
      return Number.isNaN(num) || num < 0 ? 'Por confirmar' : Math.round(num * 10) / 10;
    };

    const parseOptList = (raw: string): string[] | 'Por confirmar' => {
      const items = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return items.length > 0 ? items : 'Por confirmar';
    };

    return {
      servingSize: nutriServing.trim() || 'Por confirmar',
      energyKcal: parseOptNum(nutriKcal),
      proteinGrams: parseOptNum(nutriProtein),
      carbsGrams: parseOptNum(nutriCarbs),
      fatGrams: parseOptNum(nutriFat),
      confirmedIngredients: parseOptList(nutriIngredients),
      confirmedAllergens: parseOptList(nutriAllergens),
      validationStatus: status,
    };
  };

  const handleSaveNutritionDraft = () => {
    if (!selectedProduct) return;
    const draft = buildNutritionPayload('Por confirmar');
    onUpdateProductAdmin(
      selectedProduct.id,
      (prev) => ({
        ...prev,
        draftNutrition: draft,
      }),
      'Captura borrador nutricional',
      `Porción: ${draft.servingSize} · Kcal: ${draft.energyKcal} (borrador sin publicar)`
    );
    onNotify(
      'ok',
      `Borrador nutricional guardado en "${selectedProduct.name}". En tienda sigue como "Por confirmar" hasta confirmar validación.`
    );
  };

  const handlePublishValidatedNutrition = () => {
    if (!selectedProduct) return;
    const candidate = buildNutritionPayload('Validado');

    if (
      candidate.servingSize === 'Por confirmar' ||
      candidate.energyKcal === 'Por confirmar' ||
      candidate.proteinGrams === 'Por confirmar' ||
      candidate.carbsGrams === 'Por confirmar' ||
      candidate.fatGrams === 'Por confirmar' ||
      candidate.confirmedIngredients === 'Por confirmar'
    ) {
      onNotify(
        'error',
        'Para confirmar y publicar nutrición, captura porción, kcal, proteína, carbohidratos, grasas e ingredientes.'
      );
      return;
    }

    if (!nutriValidationConfirmed) {
      onNotify(
        'error',
        'Marca la casilla de confirmación de validación antes de publicar los datos nutricionales.'
      );
      return;
    }

    onUpdateProductAdmin(
      selectedProduct.id,
      (prev) => ({
        ...prev,
        nutrition: candidate,
        draftNutrition: candidate,
      }),
      'Validación y publicación nutricional',
      `Publicado como Validado: ${candidate.servingSize}, ${candidate.energyKcal} kcal`
    );

    onNotify('ok', `Ficha nutricional validada y publicada en tienda para "${selectedProduct.name}".`);
  };

  const handleUnpublishNutrition = () => {
    if (!selectedProduct) return;
    onUpdateProductAdmin(
      selectedProduct.id,
      (prev) => ({
        ...prev,
        draftNutrition: { ...prev.nutrition, validationStatus: 'Por confirmar' },
        nutrition: {
          servingSize: 'Por confirmar',
          energyKcal: 'Por confirmar',
          proteinGrams: 'Por confirmar',
          carbsGrams: 'Por confirmar',
          fatGrams: 'Por confirmar',
          confirmedIngredients: prev.nutrition.confirmedIngredients,
          confirmedAllergens: 'Por confirmar',
          validationStatus: 'Por confirmar',
        },
      }),
      'Retiro de publicación nutricional',
      'Ficha nutricional regresada a "Por confirmar" en tienda.'
    );
    setNutriValidationConfirmed(false);
    onNotify('ok', `La ficha nutricional de "${selectedProduct.name}" volvió a "Por confirmar".`);
  };

  return (
    <div className="space-y-6">
      {/* Global Date Exceptions */}
      <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-6 border border-[#234D35]/15 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[#193B29]">
            Excepciones globales de fecha (cierre extraordinario en tienda)
          </h2>
          <p className="text-xs sm:text-sm text-[#193B29]/80">
            Bloquea una fecha completa para todo el catálogo en Menú inteligente y Checkout.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="global-ex-date" className="text-xs font-semibold text-[#193B29]">
              Fecha
            </label>
            <input
              id="global-ex-date"
              type="date"
              value={globalExDate}
              onChange={(e) => setGlobalExDate(e.target.value)}
              className="px-3 py-2 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
            />
          </div>
          <div className="flex-1 min-w-[220px] space-y-1">
            <label htmlFor="global-ex-reason" className="text-xs font-semibold text-[#193B29]">
              Motivo
            </label>
            <input
              id="global-ex-reason"
              type="text"
              value={globalExReason}
              onChange={(e) => setGlobalExReason(e.target.value)}
              placeholder="Ej. Día inhábil / mantenimiento de cocina"
              className="w-full px-3 py-2 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!globalExDate) return;
              onUpsertGlobalDateException(
                globalExDate,
                globalExReason.trim() || 'Cierre programado por administración'
              );
              setGlobalExReason('');
              onNotify('ok', `Excepción global agregada para ${globalExDate}.`);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Bloquear fecha
          </button>
        </div>

        {Object.keys(globalDateExceptions).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(globalDateExceptions).map(([dateIso, reason]) => (
              <div
                key={dateIso}
                className="inline-flex items-center gap-2 bg-[#DCE8D2] px-3 py-1.5 rounded-xl border border-[#234D35]/20 text-xs text-[#193B29]"
              >
                <span>
                  <strong>{dateIso}:</strong> {reason}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveGlobalDateException(dateIso)}
                  className="text-[#7A2E1D] hover:underline font-bold cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Editor */}
      <div className="bg-[#EDF3E5] rounded-3xl p-5 sm:p-7 border border-[#234D35]/15 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#193B29]">
              Menú, existencias y validación nutricional
            </h2>
            <p className="text-sm text-[#193B29]/80">
              Edita precios, existencias, especiales, disponibilidad por día/fecha y valida la información nutricional antes de publicarla.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search
                className="w-4 h-4 text-[#234D35]/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Buscar producto o SKU..."
                aria-label="Buscar producto en catálogo"
                className="pl-9 pr-3 py-2 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
              />
            </div>
            <select
              aria-label="Filtrar catálogo por categoría"
              value={catalogCategory}
              onChange={(e) => setCatalogCategory(e.target.value)}
              className="px-3 py-2 text-sm bg-[#DCE8D2]/70 border border-[#234D35]/20 rounded-xl text-[#193B29]"
            >
              <option value="all">Todas las categorías</option>
              <option value="specials">Especiales del día</option>
              <option value="review">Por revisar en PDF</option>
              {MENU_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-2 max-h-[760px] overflow-y-auto pr-1">
            {filteredCatalogProducts.map((p) => {
              const isSelected = selectedProduct?.id === p.id;
              const isOut =
                p.inventory.manuallyOutOfStock ||
                (p.inventory.trackStock && p.inventory.stock <= 0);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProductId(p.id);
                    syncBuffer(p);
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-colors cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-[#234D35] text-[#EDF3E5] border-[#234D35]'
                      : 'bg-[#DCE8D2]/70 text-[#193B29] border-[#234D35]/15 hover:bg-[#C6DE8B]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] opacity-80">{p.admin.sku}</p>
                      <p className="font-display text-sm font-bold">{p.name}</p>
                    </div>
                    <span className="font-display text-sm font-bold tabular-nums shrink-0">
                      {p.priceMxn !== null
                        ? formatCentsMXN(mxnToCents(p.priceMxn))
                        : 'Por revisar'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    <span
                      className={`px-2 py-0.5 rounded-lg ${
                        isSelected ? 'bg-[#193B29] text-[#C6DE8B]' : 'bg-[#EDF3E5] text-[#234D35]'
                      }`}
                    >
                      Stock: {isOut ? 'Agotado' : p.inventory.stock}
                    </span>
                    {p.isDailySpecial && (
                      <span className="px-2 py-0.5 rounded-lg bg-[#C6DE8B] text-[#193B29]">
                        Especial
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-lg ${
                        p.nutrition.validationStatus === 'Validado'
                          ? 'bg-[#C6DE8B] text-[#193B29]'
                          : isSelected
                            ? 'bg-[#193B29] text-[#DCE8D2]'
                            : 'bg-[#EDF3E5] text-[#193B29]/80'
                      }`}
                    >
                      Nutrición: {p.nutrition.validationStatus}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedProduct && (
            <div className="lg:col-span-7 bg-[#DCE8D2]/70 rounded-3xl p-5 sm:p-6 border border-[#234D35]/15 space-y-6">
              <div className="border-b border-[#234D35]/15 pb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-bold text-[#28583C]">
                    {selectedProduct.admin.sku} · {selectedProduct.categoryLabel}
                  </p>
                  <h3 className="font-display text-2xl font-bold text-[#193B29]">
                    {selectedProduct.name}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateProductAdmin(
                        selectedProduct.id,
                        (prev) => ({ ...prev, isDailySpecial: !prev.isDailySpecial }),
                        'Especial del día',
                        `${!selectedProduct.isDailySpecial ? 'Activado' : 'Desactivado'} como Especial del día`
                      )
                    }
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border cursor-pointer ${
                      selectedProduct.isDailySpecial
                        ? 'bg-[#234D35] text-[#C6DE8B] border-[#234D35]'
                        : 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/20'
                    }`}
                  >
                    {selectedProduct.isDailySpecial ? 'Especial del día: Sí' : 'Marcar especial'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateProductAdmin(
                        selectedProduct.id,
                        (prev) => ({
                          ...prev,
                          inventory: {
                            ...prev.inventory,
                            manuallyOutOfStock: !prev.inventory.manuallyOutOfStock,
                          },
                        }),
                        'Estado agotado manual',
                        `${!selectedProduct.inventory.manuallyOutOfStock ? 'Marcado Agotado' : 'Reactivado'}`
                      )
                    }
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border cursor-pointer ${
                      selectedProduct.inventory.manuallyOutOfStock
                        ? 'bg-[#7A2E1D] text-[#EDF3E5] border-[#7A2E1D]'
                        : 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/20'
                    }`}
                  >
                    {selectedProduct.inventory.manuallyOutOfStock
                      ? 'Agotado manual: Sí'
                      : 'Disponible manualmente'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateProductAdmin(
                        selectedProduct.id,
                        (prev) => ({
                          ...prev,
                          admin: { ...prev.admin, active: !prev.admin.active },
                        }),
                        'Visibilidad en catálogo',
                        `${!selectedProduct.admin.active ? 'Activado' : 'Ocultado'} en tienda`
                      )
                    }
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border cursor-pointer ${
                      selectedProduct.admin.active
                        ? 'bg-[#EDF3E5] text-[#234D35] border-[#234D35]/20'
                        : 'bg-[#7A2E1D] text-[#EDF3E5] border-[#7A2E1D]'
                    }`}
                  >
                    {selectedProduct.admin.active ? 'Visible en tienda' : 'Oculto en tienda'}
                  </button>
                </div>
              </div>

              {/* Price & Stock */}
              <div className="bg-[#EDF3E5] rounded-2xl p-4 sm:p-5 border border-[#234D35]/10 space-y-4">
                <h4 className="font-display text-base font-bold text-[#193B29]">
                  Precio y existencias
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="edit-price" className="block text-xs font-semibold text-[#193B29]">
                      Precio MXN
                    </label>
                    <input
                      id="edit-price"
                      type="number"
                      min={0}
                      step={0.5}
                      disabled={pricePendingReview}
                      value={priceDraft}
                      onChange={(e) => setPriceDraft(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-bold tabular-nums bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29] disabled:opacity-50"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-[#193B29] cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={pricePendingReview}
                        onChange={(e) => setPricePendingReview(e.target.checked)}
                        className="accent-[#234D35]"
                      />
                      Marcar precio pendiente (Por revisar)
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="edit-stock" className="block text-xs font-semibold text-[#193B29]">
                      Existencias actuales (unidades)
                    </label>
                    <input
                      id="edit-stock"
                      type="number"
                      min={0}
                      step={1}
                      value={stockDraft}
                      onChange={(e) => setStockDraft(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-bold tabular-nums bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </div>
                </div>

                {pricePendingReview && (
                  <div className="space-y-1">
                    <label htmlFor="edit-review-note" className="block text-xs font-semibold text-[#193B29]">
                      Nota de revisión PDF
                    </label>
                    <input
                      id="edit-review-note"
                      type="text"
                      value={reviewNoteDraft}
                      onChange={(e) => setReviewNoteDraft(e.target.value)}
                      placeholder="Motivo de revisión pendiente..."
                      className="w-full px-3 py-2 text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveCatalogPricingAndStock}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl cursor-pointer"
                >
                  Guardar precio y existencias
                </button>
              </div>

              {/* Weekly & Date Availability */}
              <div className="bg-[#EDF3E5] rounded-2xl p-4 sm:p-5 border border-[#234D35]/10 space-y-4">
                <h4 className="font-display text-base font-bold text-[#193B29]">
                  Disponibilidad por día de la semana y excepciones por fecha
                </h4>

                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((w) => {
                    const active = selectedProduct.availability.daysOfWeek.includes(w.day);
                    return (
                      <button
                        key={w.day}
                        type="button"
                        onClick={() => handleToggleDayOfWeek(w.day)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#234D35] text-[#C6DE8B] border-[#234D35]'
                            : 'bg-[#DCE8D2]/60 text-[#193B29]/70 border-[#234D35]/15'
                        }`}
                      >
                        {w.short}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-[#234D35]/10 space-y-3">
                  <p className="text-xs font-semibold text-[#28583C]">
                    Agregar excepción puntual por fecha:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="date"
                      aria-label="Fecha de excepción del producto"
                      value={prodExDate}
                      onChange={(e) => setProdExDate(e.target.value)}
                      className="px-3 py-2 text-xs sm:text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                    <select
                      aria-label="Tipo de excepción del producto"
                      value={prodExAvailable ? 'allow' : 'block'}
                      onChange={(e) => setProdExAvailable(e.target.value === 'allow')}
                      className="px-3 py-2 text-xs sm:text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    >
                      <option value="block">No disponible ese día</option>
                      <option value="allow">Disponible por excepción</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddProductDateException}
                      className="px-3 py-2 text-xs font-semibold bg-[#28583C] text-[#EDF3E5] rounded-xl cursor-pointer"
                    >
                      Guardar excepción
                    </button>
                  </div>
                  <input
                    type="text"
                    value={prodExReason}
                    onChange={(e) => setProdExReason(e.target.value)}
                    placeholder="Motivo de la excepción (ej. Insumo de temporada)"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                  />

                  {selectedProduct.availability.dateExceptions &&
                    Object.keys(selectedProduct.availability.dateExceptions).length > 0 && (
                      <div className="space-y-1.5">
                        {Object.entries(selectedProduct.availability.dateExceptions).map(
                          ([dateIso, ex]) => (
                            <div
                              key={dateIso}
                              className="flex items-center justify-between gap-2 bg-[#DCE8D2]/70 px-3 py-2 rounded-xl text-xs"
                            >
                              <span>
                                <strong>{dateIso}</strong> (
                                {ex.available ? 'Disponible' : 'No disponible'}): {ex.reason}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveProductDateException(dateIso)}
                                aria-label={`Eliminar excepción ${dateIso}`}
                                className="text-[#7A2E1D] hover:underline font-bold cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                </div>
              </div>

              {/* Nutrition Capture & Validation Gate */}
              <div className="bg-[#EDF3E5] rounded-2xl p-4 sm:p-5 border border-[#234D35]/10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-display text-base font-bold text-[#193B29]">
                      Ficha nutricional (confirmar validación antes de publicar)
                    </h4>
                    <p className="text-xs text-[#193B29]/75">
                      Estado publicado en tienda:{' '}
                      <strong
                        className={
                          selectedProduct.nutrition.validationStatus === 'Validado'
                            ? 'text-[#234D35]'
                            : 'text-[#7A2E1D]'
                        }
                      >
                        {selectedProduct.nutrition.validationStatus}
                      </strong>
                    </p>
                  </div>
                  {selectedProduct.nutrition.validationStatus === 'Validado' && (
                    <button
                      type="button"
                      onClick={handleUnpublishNutrition}
                      className="text-xs font-semibold text-[#7A2E1D] underline cursor-pointer"
                    >
                      Revertir a Por confirmar
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="nut-serving" className="text-xs font-semibold text-[#193B29]">
                      Porción
                    </label>
                    <input
                      id="nut-serving"
                      type="text"
                      value={nutriServing}
                      onChange={(e) => setNutriServing(e.target.value)}
                      placeholder="Por confirmar (ej. 280 g)"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="nut-kcal" className="text-xs font-semibold text-[#193B29]">
                      Energía (kcal)
                    </label>
                    <input
                      id="nut-kcal"
                      type="number"
                      min={0}
                      step={1}
                      value={nutriKcal}
                      onChange={(e) => setNutriKcal(e.target.value)}
                      placeholder="Por confirmar"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="nut-prot" className="text-xs font-semibold text-[#193B29]">
                      Proteína (g)
                    </label>
                    <input
                      id="nut-prot"
                      type="number"
                      min={0}
                      step={0.1}
                      value={nutriProtein}
                      onChange={(e) => setNutriProtein(e.target.value)}
                      placeholder="Por confirmar"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="nut-carbs" className="text-xs font-semibold text-[#193B29]">
                      Carbohidratos (g)
                    </label>
                    <input
                      id="nut-carbs"
                      type="number"
                      min={0}
                      step={0.1}
                      value={nutriCarbs}
                      onChange={(e) => setNutriCarbs(e.target.value)}
                      placeholder="Por confirmar"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="nut-fat" className="text-xs font-semibold text-[#193B29]">
                      Grasas (g)
                    </label>
                    <input
                      id="nut-fat"
                      type="number"
                      min={0}
                      step={0.1}
                      value={nutriFat}
                      onChange={(e) => setNutriFat(e.target.value)}
                      placeholder="Por confirmar"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label htmlFor="nut-ing" className="text-xs font-semibold text-[#193B29]">
                      Ingredientes confirmados (separados por coma)
                    </label>
                    <input
                      id="nut-ing"
                      type="text"
                      value={nutriIngredients}
                      onChange={(e) => setNutriIngredients(e.target.value)}
                      placeholder="Huevo, Jamón, Queso panela..."
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="nut-alg" className="text-xs font-semibold text-[#193B29]">
                      Alérgenos confirmados (separados por coma)
                    </label>
                    <input
                      id="nut-alg"
                      type="text"
                      value={nutriAllergens}
                      onChange={(e) => setNutriAllergens(e.target.value)}
                      placeholder="Huevo, Lácteos (dejar vacío si aún está por confirmar)"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#DCE8D2]/60 border border-[#234D35]/20 rounded-xl text-[#193B29]"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#193B29] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nutriValidationConfirmed}
                    onChange={(e) => setNutriValidationConfirmed(e.target.checked)}
                    className="w-4 h-4 accent-[#234D35]"
                  />
                  Confirmo que estos datos nutricionales fueron validados antes de publicarse en la tienda
                </label>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleSaveNutritionDraft}
                    className="px-4 py-2 text-xs font-semibold bg-[#DCE8D2] text-[#193B29] hover:bg-[#C6DE8B] border border-[#234D35]/20 rounded-xl cursor-pointer"
                  >
                    Guardar borrador (sin publicar)
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishValidatedNutrition}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    Confirmar validación y publicar nutrición
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
