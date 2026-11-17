import { useMemo, useState } from 'react';
import {
  X,
  Heart,
  Check,
  AlertCircle,
  Calendar,
  Plus,
  Minus,
} from 'lucide-react';
import type {
  Product,
  SelectedCustomization,
  DraftOrderItem,
} from '../types/product';
import {
  evaluateProductAvailability,
  formatSpanishDateLabel,
} from '../utils/meridaDate';
import { formatMXN } from '../utils/pricing';
import { ResilientImage } from './ResilientImage';

interface ProductDetailModalProps {
  product: Product;
  selectedDateIso: string;
  globalDateExceptions?: Record<string, string>;
  qtyAlreadyInCart: number;
  isFavorite: boolean;
  onToggleFavorite: (productId: string) => void;
  onAddDraftItem: (item: DraftOrderItem) => void;
  onClose: () => void;
}

export function ProductDetailModal({
  product,
  selectedDateIso,
  globalDateExceptions,
  qtyAlreadyInCart,
  isFavorite,
  onToggleFavorite,
  onAddDraftItem,
  onClose,
}: ProductDetailModalProps) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [validationAttempted, setValidationAttempted] = useState(false);

  const availability = useMemo(
    () => evaluateProductAvailability(product, selectedDateIso, globalDateExceptions),
    [product, selectedDateIso, globalDateExceptions]
  );

  const remainingStock = product.inventory.trackStock
    ? Math.max(0, product.inventory.stock - qtyAlreadyInCart)
    : 20;

  const canAddAny = availability.canOrder && remainingStock > 0;

  const handleToggleOption = (
    groupId: string,
    optionId: string,
    maxSelect: number
  ) => {
    setSelections((prev) => {
      const current = prev[groupId] ?? [];
      if (maxSelect === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= maxSelect) {
        return { ...prev, [groupId]: [...current.slice(1), optionId] };
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const missingGroups = useMemo(() => {
    return product.customizations.filter((group) => {
      const chosenCount = (selections[group.id] ?? []).length;
      if (!group.required && chosenCount === 0) return false;
      return chosenCount < group.minSelect || chosenCount > group.maxSelect;
    });
  }, [product.customizations, selections]);

  const isCustomizationsComplete = missingGroups.length === 0;
  const maxOrderQty = Math.max(1, remainingStock);

  const handleAdd = () => {
    setValidationAttempted(true);
    if (!canAddAny || !isCustomizationsComplete || product.priceMxn === null) {
      return;
    }

    const selectedCustomizations: SelectedCustomization[] = product.customizations.map(
      (group) => {
        const chosenIds = selections[group.id] ?? [];
        const chosenLabels = chosenIds
          .map((id) => group.options.find((opt) => opt.id === id)?.label ?? '')
          .filter(Boolean);
        return {
          groupId: group.id,
          groupLabel: group.label,
          optionIds: chosenIds,
          optionLabels: chosenLabels,
        };
      }
    );

    onAddDraftItem({
      uid: `${product.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      unitPriceMxn: product.priceMxn,
      quantity,
      scheduledDateIso: selectedDateIso,
      selectedCustomizations,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#193B29]/65 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-[#EDF3E5] text-[#193B29] rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto border border-[#234D35]/20 shadow-xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/9] bg-[#DCE8D2]">
          <ResilientImage
            src={product.photo.url}
            alt={product.photo.alt}
            className="w-full h-full object-cover"
            fallbackLabel={product.name}
          />
          <div className="absolute top-3 left-3 bg-[#193B29]/85 text-[#EDF3E5] px-3 py-1.5 rounded-xl text-xs font-medium">
            {product.photo.caption}
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(product.id)}
              aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              aria-pressed={isFavorite}
              className="w-10 h-10 rounded-full bg-[#EDF3E5]/95 text-[#193B29] flex items-center justify-center hover:bg-[#C6DE8B] transition-colors cursor-pointer"
            >
              <Heart
                className={`w-5 h-5 ${isFavorite ? 'fill-[#234D35] text-[#234D35]' : ''}`}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ficha de producto"
              className="w-10 h-10 rounded-full bg-[#EDF3E5]/95 text-[#193B29] flex items-center justify-center hover:bg-[#C6DE8B] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-7 space-y-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-[#234D35]/85">
              <span>{product.categoryLabel}</span>
              <span aria-hidden="true">·</span>
              <span>SKU {product.admin.sku}</span>
              {product.isDailySpecial && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#234D35]">Especial del día</span>
                </>
              )}
            </div>

            <div className="flex items-start justify-between gap-4">
              <h2
                id="product-modal-title"
                className="font-display text-2xl sm:text-3xl font-bold text-[#193B29] leading-tight"
              >
                {product.name}
              </h2>
              <span className="font-display text-2xl font-bold text-[#234D35] tabular-nums whitespace-nowrap shrink-0">
                {product.priceMxn !== null ? `${formatMXN(product.priceMxn)} MXN` : 'Por revisar'}
              </span>
            </div>

            <p className="text-sm sm:text-base text-[#193B29]/85 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Date & Stock Availability Box */}
          <div className="bg-[#DCE8D2]/75 rounded-2xl p-4 border border-[#234D35]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-[#193B29]">
              <Calendar className="w-4 h-4 text-[#234D35] shrink-0" aria-hidden="true" />
              <span>
                Fecha consultada: <strong>{formatSpanishDateLabel(selectedDateIso)}</strong>
              </span>
            </div>
            <div className="text-right">
              <span
                className={`font-semibold ${
                  canAddAny ? 'text-[#234D35]' : 'text-[#7A2E1D]'
                }`}
              >
                {availability.canOrder
                  ? qtyAlreadyInCart > 0
                    ? `${remainingStock} disponibles (${qtyAlreadyInCart} en carrito)`
                    : availability.statusLabel
                  : availability.statusLabel}
              </span>
            </div>
          </div>

          {!availability.canOrder && availability.reason && (
            <div className="bg-[#C6DE8B]/35 rounded-2xl p-4 border border-[#234D35]/20 flex items-start gap-3 text-sm text-[#193B29]">
              <AlertCircle className="w-5 h-5 text-[#234D35] shrink-0 mt-0.5" aria-hidden="true" />
              <p>{availability.reason}</p>
            </div>
          )}

          {availability.canOrder && remainingStock === 0 && (
            <div className="bg-[#C6DE8B]/35 rounded-2xl p-4 border border-[#234D35]/20 flex items-start gap-3 text-sm text-[#193B29]">
              <AlertCircle className="w-5 h-5 text-[#7A2E1D] shrink-0 mt-0.5" aria-hidden="true" />
              <p>Ya tienes todas las existencias disponibles de este producto en tu carrito.</p>
            </div>
          )}

          {product.reviewStatus === 'Por revisar' && (
            <div className="bg-[#C6DE8B]/40 rounded-2xl p-4 border border-[#234D35]/25 flex items-start gap-3 text-sm text-[#193B29]">
              <AlertCircle className="w-5 h-5 text-[#234D35] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold">Dato marcado para revisión</p>
                <p className="text-[#193B29]/85 mt-0.5">
                  {product.reviewNote || 'Dato ambiguo o incompleto en el menú PDF.'}
                </p>
              </div>
            </div>
          )}

          {/* Mandatory Customizations */}
          {product.customizations.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-[#234D35]/12">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-[#193B29]">
                  Personalización obligatoria
                </h3>
                <span className="text-xs font-semibold text-[#28583C]">
                  {isCustomizationsComplete ? 'Completa' : 'Faltan opciones obligatorias'}
                </span>
              </div>

              {product.customizations.map((group) => {
                const chosen = selections[group.id] ?? [];
                const groupMissing =
                  chosen.length < group.minSelect || chosen.length > group.maxSelect;

                return (
                  <div
                    key={group.id}
                    className="bg-[#DCE8D2]/55 rounded-2xl p-4 border border-[#234D35]/12 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-[#193B29]">{group.label}</p>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          groupMissing ? 'text-[#7A2E1D]' : 'text-[#234D35]'
                        }`}
                      >
                        {chosen.length}/{group.maxSelect} obligatoria
                        {group.maxSelect > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {group.options.map((option) => {
                        const active = chosen.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              handleToggleOption(group.id, option.id, group.maxSelect)
                            }
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#28583C] text-[#EDF3E5] border-[#28583C]'
                                : 'bg-[#EDF3E5] text-[#193B29] border-[#234D35]/20 hover:bg-[#C6DE8B]/70'
                            }`}
                          >
                            {active && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    {validationAttempted && groupMissing && (
                      <p className="text-xs font-semibold text-[#7A2E1D]">
                        Selecciona{' '}
                        {group.minSelect === group.maxSelect
                          ? `exactamente ${group.minSelect}`
                          : `al menos ${group.minSelect}`}{' '}
                        opción(es) en esta sección.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Complete Nutrition Sheet */}
          <div className="bg-[#DCE8D2]/65 rounded-2xl p-5 border border-[#234D35]/15 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-[#193B29]">
                Ficha nutricional
              </h3>
              <span className="text-xs font-semibold text-[#234D35]">
                Validación: {product.nutrition.validationStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-[#EDF3E5] rounded-xl p-3 border border-[#234D35]/10">
                <p className="text-xs text-[#193B29]/70">Tamaño de porción</p>
                <p className="font-semibold text-[#193B29] mt-0.5">
                  {product.nutrition.servingSize}
                </p>
              </div>
              <div className="bg-[#EDF3E5] rounded-xl p-3 border border-[#234D35]/10">
                <p className="text-xs text-[#193B29]/70">Energía (kcal)</p>
                <p className="font-semibold text-[#193B29] mt-0.5 tabular-nums">
                  {product.nutrition.energyKcal}
                </p>
              </div>
              <div className="bg-[#EDF3E5] rounded-xl p-3 border border-[#234D35]/10">
                <p className="text-xs text-[#193B29]/70">Proteína (g)</p>
                <p className="font-semibold text-[#193B29] mt-0.5 tabular-nums">
                  {product.nutrition.proteinGrams}
                </p>
              </div>
              <div className="bg-[#EDF3E5] rounded-xl p-3 border border-[#234D35]/10">
                <p className="text-xs text-[#193B29]/70">Carbohidratos (g)</p>
                <p className="font-semibold text-[#193B29] mt-0.5 tabular-nums">
                  {product.nutrition.carbsGrams}
                </p>
              </div>
              <div className="bg-[#EDF3E5] rounded-xl p-3 border border-[#234D35]/10">
                <p className="text-xs text-[#193B29]/70">Grasas (g)</p>
                <p className="font-semibold text-[#193B29] mt-0.5 tabular-nums">
                  {product.nutrition.fatGrams}
                </p>
              </div>
              <div className="bg-[#EDF3E5] rounded-xl p-3 border border-[#234D35]/10">
                <p className="text-xs text-[#193B29]/70">Alérgenos confirmados</p>
                <p className="font-semibold text-[#193B29] mt-0.5">
                  {Array.isArray(product.nutrition.confirmedAllergens)
                    ? product.nutrition.confirmedAllergens.join(', ')
                    : product.nutrition.confirmedAllergens}
                </p>
              </div>
            </div>

            <div className="text-sm text-[#193B29]">
              <span className="font-semibold">Ingredientes confirmados: </span>
              <span className="text-[#193B29]/85">
                {Array.isArray(product.nutrition.confirmedIngredients)
                  ? product.nutrition.confirmedIngredients.join(', ')
                  : product.nutrition.confirmedIngredients}
              </span>
            </div>
          </div>

          {/* Quantity & Action Bar */}
          <div className="pt-2 border-t border-[#234D35]/15 space-y-3">
            {!isCustomizationsComplete && canAddAny && (
              <p className="text-xs font-semibold text-[#7A2E1D]">
                Completa todas las opciones obligatorias para poder agregar este producto al carrito.
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full">
                <div className="inline-flex items-center bg-[#DCE8D2] rounded-xl border border-[#234D35]/20">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Disminuir cantidad"
                    disabled={!canAddAny}
                    className="w-10 h-10 flex items-center justify-center text-[#193B29] disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-bold tabular-nums text-sm">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(maxOrderQty, q + 1))}
                    aria-label="Aumentar cantidad"
                    disabled={!canAddAny || quantity >= maxOrderQty}
                    className="w-10 h-10 flex items-center justify-center text-[#193B29] disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {canAddAny && isCustomizationsComplete ? (
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold bg-[#28583C] text-[#EDF3E5] hover:bg-[#1e432d] rounded-xl transition-colors cursor-pointer"
                  >
                    Agregar al carrito
                    {product.priceMxn !== null && (
                      <span className="tabular-nums">
                        · {formatMXN(product.priceMxn * quantity)} MXN
                      </span>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setValidationAttempted(true)}
                    disabled={!canAddAny}
                    aria-disabled={!canAddAny || !isCustomizationsComplete}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl transition-colors ${
                      !canAddAny
                        ? 'bg-[#234D35]/20 text-[#193B29]/50 cursor-not-allowed'
                        : 'bg-[#28583C]/45 text-[#EDF3E5] cursor-not-allowed'
                    }`}
                  >
                    {!availability.canOrder
                      ? availability.statusLabel
                      : remainingStock === 0
                        ? 'Sin stock adicional'
                        : 'Completa opciones obligatorias'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
