export type MenuCategoryId =
  | 'desayunos'
  | 'huevos'
  | 'chilaquiles'
  | 'especialidades'
  | 'fruta'
  | 'sandwiches'
  | 'baguettes'
  | 'ensaladas'
  | 'jugos'
  | 'funcionales'
  | 'cafe'
  | 'tes'
  | 'aguas'
  | 'malteadas';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Domingo, 1 = Lunes ... 6 = Sábado

export type ReviewStatus = 'Confirmado' | 'Por revisar';

export interface ProductPhoto {
  url: string;
  alt: string;
  isReferencePhoto: boolean;
  caption: string;
}

export interface CustomizationOption {
  id: string;
  label: string;
}

export interface CustomizationGroup {
  id: string;
  label: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: CustomizationOption[];
}

export type NutritionValue = number | 'Por confirmar';

export interface ProductNutritionSheet {
  servingSize: string;
  energyKcal: NutritionValue;
  proteinGrams: NutritionValue;
  carbsGrams: NutritionValue;
  fatGrams: NutritionValue;
  confirmedIngredients: string[] | 'Por confirmar';
  confirmedAllergens: string[] | 'Por confirmar';
  validationStatus: 'Por confirmar' | 'Validado';
}

export interface DateException {
  available: boolean;
  reason: string;
}

export interface ProductAvailability {
  /** Días de la semana en que se prepara (1=Lunes ... 6=Sábado, 0=Domingo) */
  daysOfWeek: DayOfWeek[];
  /** Excepciones puntuales indexadas por fecha YYYY-MM-DD (America/Merida) */
  dateExceptions?: Record<string, DateException>;
}

export interface ProductInventory {
  stock: number;
  trackStock: boolean;
  manuallyOutOfStock?: boolean;
}

export interface ProductKitchenMeta {
  prepStation: 'Cocina caliente' | 'Barra fría y ensaladas' | 'Barra de jugos y café';
  prepNotes?: string;
}

export interface ProductAdminMeta {
  active: boolean;
  sku: string;
}

/**
 * Modelo único de producto reutilizable por Tienda (Menú inteligente), Cocina y Administración.
 */
export interface Product {
  id: string;
  name: string;
  category: MenuCategoryId;
  categoryLabel: string;
  description: string;
  priceMxn: number | null;
  reviewStatus: ReviewStatus;
  reviewNote?: string;
  photo: ProductPhoto;
  isDailySpecial: boolean;
  inventory: ProductInventory;
  availability: ProductAvailability;
  customizations: CustomizationGroup[];
  nutrition: ProductNutritionSheet;
  /** Borrador nutricional capturado en Admin antes de confirmar su validación para publicar */
  draftNutrition?: ProductNutritionSheet;
  kitchen: ProductKitchenMeta;
  admin: ProductAdminMeta;
}

export interface SelectedCustomization {
  groupId: string;
  groupLabel: string;
  optionIds: string[];
  optionLabels: string[];
}

export interface DraftOrderItem {
  uid: string;
  productId: string;
  productName: string;
  unitPriceMxn: number;
  quantity: number;
  scheduledDateIso: string;
  selectedCustomizations: SelectedCustomization[];
}

export type OrderFulfillmentMode = 'delivery' | 'pickup' | 'dine_in';

export type OrderType = 'a_la_carta' | 'plan_semanal';

export type DemoPaymentMethod = 'card' | 'transfer' | 'cash' | 'whatsapp';

export type OrderPaymentStatus =
  | 'Pagado (demo)'
  | 'Pendiente de validación'
  | 'Pago al recibir / en caja'
  | 'Por coordinar por WhatsApp';

export type OrderPrepStatus =
  | 'Confirmado'
  | 'En preparación'
  | 'Listo';

export type OrderDeliveryStatus =
  | 'Por asignar (Turbo Mandados)'
  | 'Asignado'
  | 'Recolectado'
  | 'En camino'
  | 'Entregado'
  | 'Incidencia'
  | 'Listo para recoger en tienda'
  | 'Servicio en mesa';

export interface DeliveryTrackingInfo {
  assignedToTurboDemo: boolean;
  assignedAtDisplay?: string;
  receivedBy: string;
  deliveryPlace: string;
  deliveryDateIso: string;
  deliveryTime: string;
  observations: string;
}

export interface AuditLogEntry {
  id: string;
  timestampIso: string;
  timestampDisplay: string;
  scope: 'pedido' | 'cocina' | 'catalogo' | 'entrega' | 'plan' | 'agenda';
  entityId: string;
  entityLabel: string;
  action: string;
  details: string;
}

export interface CustomerCheckoutInfo {
  customerName: string;
  customerPhone: string;
  address: string;
  references: string;
  isSpecialLocation: boolean;
  building: string;
  hospital: string;
  area: string;
  receiverName: string;
  tableNumber: string;
  cashPaidWith?: string;
  orderNotes?: string;
}

export interface OrderLineSnapshot {
  uid: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  appliedUnitPriceCents: number;
  lineTotalCents: number;
  scheduledDateIso: string;
  selectedCustomizations: SelectedCustomization[];
}

export interface DemoOrder {
  folio: string;
  idempotencyKey: string;
  orderType: OrderType;
  /** Referencia al registro principal cuando orderType === 'plan_semanal' */
  planPurchaseFolio?: string;
  planName?: string;
  planDayIndex?: number;
  planTotalDays?: number;
  createdAtIso: string;
  createdAtDisplay: string;
  scheduledDateIso: string;
  timeSlot: string;
  fulfillmentMode: OrderFulfillmentMode;
  distanceKm: number | null;
  paymentMethod: DemoPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  prepStatus: OrderPrepStatus;
  deliveryStatus: OrderDeliveryStatus;
  deliveryTracking?: DeliveryTrackingInfo;
  customer: CustomerCheckoutInfo;
  items: OrderLineSnapshot[];
  pricingSnapshot: {
    subtotalCents: number;
    serviceFeeCents: number;
    deliveryFeeCents: number;
    totalCents: number;
    serviceFeeRate: number;
    deliveryRuleNote: string;
  };
  whatsappSummaryText: string;
}

export interface PlanMealSlotConfig {
  id: string;
  label: string;
  allowedCategories: MenuCategoryId[];
}

export interface ConfigurablePlanTemplate {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  includesExample: string;
  isIllustrativeExample: true;
  highlighted?: boolean;
  active: boolean;
  defaultDaysCount: number;
  minDays: number;
  maxDays: number;
  allowedWeekdays: DayOfWeek[];
  foodPricingMode: 'sum_dishes' | 'fixed_example';
  exampleFoodPriceMxn: number;
  mealSlots: PlanMealSlotConfig[];
}

export interface CapacitySlotRule {
  limit: number;
  blocked: boolean;
  blockReason?: string;
}

export interface CapacityScheduleConfig {
  defaultSlotLimit: number;
  /** Clave: `${dateIso}__${timeSlot}` */
  slotRules: Record<string, CapacitySlotRule>;
}

export interface SlotCapacitySnapshot {
  key: string;
  dateIso: string;
  timeSlot: string;
  limit: number;
  occupiedIndividual: number;
  occupiedPlans: number;
  occupiedTotal: number;
  remaining: number;
  manuallyBlocked: boolean;
  blockReason?: string;
  globalDateBlockedReason?: string;
  isSunday: boolean;
  isFull: boolean;
  canBook: boolean;
  statusLabel: string;
}

export interface PlanDayCalendarEntry {
  dayIndex: number;
  dailyOrderFolio: string;
  scheduledDateIso: string;
  timeSlot: string;
  fulfillmentMode: 'delivery' | 'pickup';
  allocatedFoodCents: number;
  allocatedServiceFeeCents: number;
  allocatedDeliveryFeeCents: number;
  allocatedTotalCents: number;
  rescheduleCount: number;
  lastRescheduledDisplay?: string;
}

export interface WeeklyPlanPurchase {
  planFolio: string;
  idempotencyKey: string;
  templateId: string;
  templateName: string;
  isIllustrativeExample: boolean;
  foodPricingMode: 'sum_dishes' | 'fixed_example';
  createdAtIso: string;
  createdAtDisplay: string;
  startDateIso: string;
  totalDays: number;
  distanceKm: number | null;
  paymentMethod: DemoPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  customer: CustomerCheckoutInfo;
  pricingSnapshot: {
    foodSubtotalCents: number;
    serviceFeeCents: number;
    deliveryTotalCents: number;
    totalCents: number;
    serviceFeeRate: number;
    contractedDeliveriesCount: number;
    pricingRuleNote: string;
  };
  days: PlanDayCalendarEntry[];
  whatsappSummaryText: string;
}

