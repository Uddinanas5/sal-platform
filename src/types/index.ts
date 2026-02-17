// SAL Platform - TypeScript Type Definitions

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ResponseMeta {
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

// =============================================================================
// User Types
// =============================================================================

export type UserRole = 'owner' | 'admin' | 'staff' | 'client';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  authId: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  notificationPreferences: NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  email?: {
    appointments?: boolean;
    marketing?: boolean;
    reminders?: boolean;
  };
  sms?: {
    appointments?: boolean;
    reminders?: boolean;
  };
  push?: {
    appointments?: boolean;
    reminders?: boolean;
  };
}

// =============================================================================
// Business Types
// =============================================================================

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'paused';

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  currency: string;
  timezone: string;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: Date;
  settings: BusinessSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessSettings {
  booking?: {
    requireDeposit?: boolean;
    allowCancellation?: boolean;
    cancellationWindowHours?: number;
    reminderHoursBefore?: number;
    confirmationRequired?: boolean;
  };
  display?: {
    showPrices?: boolean;
    showDuration?: boolean;
    showStaffBio?: boolean;
  };
}

// =============================================================================
// Location Types
// =============================================================================

export interface Location {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  isPrimary: boolean;
  isActive: boolean;
  settings: LocationSettings;
  businessHours?: BusinessHours[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationSettings {
  bookingLeadTimeHours?: number;
  maxAdvanceBookingDays?: number;
}

export interface BusinessHours {
  id: string;
  locationId: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  openTime?: string; // HH:MM
  closeTime?: string; // HH:MM
  isClosed: boolean;
}

// =============================================================================
// Staff Types
// =============================================================================

export type EmploymentType = 'full_time' | 'part_time' | 'contractor';

export interface Staff {
  id: string;
  userId: string;
  locationId: string;
  employeeId?: string;
  title?: string;
  bio?: string;
  specializations: string[];
  commissionRate: number;
  hourlyRate?: number;
  employmentType: EmploymentType;
  hireDate?: Date;
  canAcceptBookings: boolean;
  bookingBufferMinutes: number;
  maxDailyAppointments?: number;
  color?: string;
  sortOrder: number;
  isActive: boolean;
  user?: User;
  services?: StaffService[];
  schedules?: StaffSchedule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffSchedule {
  id: string;
  staffId: string;
  locationId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  breaks?: StaffBreak[];
}

export interface StaffBreak {
  id: string;
  staffScheduleId: string;
  startTime: string;
  endTime: string;
  isPaid: boolean;
}

export interface StaffService {
  id: string;
  staffId: string;
  serviceId: string;
  customDuration?: number;
  customPrice?: number;
  commissionRate?: number;
  isActive: boolean;
}

export type TimeOffType = 'vacation' | 'sick' | 'personal' | 'other';
export type TimeOffStatus = 'pending' | 'approved' | 'rejected';

export interface StaffTimeOff {
  id: string;
  staffId: string;
  startDate: Date;
  endDate: Date;
  startTime?: string;
  endTime?: string;
  type: TimeOffType;
  status: TimeOffStatus;
  notes?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

// =============================================================================
// Service Types
// =============================================================================

export type PriceType = 'fixed' | 'starting_at' | 'variable';
export type DepositType = 'fixed' | 'percentage';

export interface ServiceCategory {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  services?: Service[];
}

export interface Service {
  id: string;
  businessId: string;
  categoryId?: string;
  name: string;
  description?: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  price: number;
  priceType: PriceType;
  maxPrice?: number;
  depositAmount?: number;
  depositType: DepositType;
  taxRate?: number;
  isTaxable: boolean;
  color?: string;
  imageUrl?: string;
  isOnlineBooking: boolean;
  isActive: boolean;
  sortOrder: number;
  variations?: ServiceVariation[];
  category?: ServiceCategory;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceVariation {
  id: string;
  serviceId: string;
  name: string;
  durationMinutes: number;
  price: number;
  sortOrder: number;
  isActive: boolean;
}

// =============================================================================
// Client Types
// =============================================================================

export interface Client {
  id: string;
  businessId: string;
  userId?: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  gender?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  preferredLocationId?: string;
  preferredStaffId?: string;
  notes?: string;
  tags: string[];
  source?: string;
  referralSource?: string;
  marketingConsent: boolean;
  smsConsent: boolean;
  emailConsent: boolean;
  totalSpent: number;
  totalVisits: number;
  lastVisitAt?: Date;
  loyaltyPoints: number;
  isBlocked: boolean;
  blockedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Appointment Types
// =============================================================================

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentSource = 'online' | 'walk_in' | 'phone' | 'app' | 'pos';

export interface Appointment {
  id: string;
  businessId: string;
  locationId: string;
  clientId?: string;
  bookingReference: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  depositAmount: number;
  notes?: string;
  internalNotes?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: Date;
  checkedInAt?: Date;
  completedAt?: Date;
  services?: AppointmentService[];
  products?: AppointmentProduct[];
  payments?: Payment[];
  client?: Client;
  location?: Location;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentService {
  id: string;
  appointmentId: string;
  serviceId: string;
  serviceVariationId?: string;
  staffId: string;
  name: string;
  durationMinutes: number;
  price: number;
  discountAmount: number;
  taxAmount: number;
  finalPrice: number;
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'in_progress' | 'completed';
  notes?: string;
  sortOrder: number;
  service?: Service;
  staff?: Staff;
}

export interface AppointmentProduct {
  id: string;
  appointmentId: string;
  productId: string;
  staffId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  totalPrice: number;
  product?: Product;
}

// =============================================================================
// Payment Types
// =============================================================================

export type PaymentType = 'payment' | 'refund' | 'deposit' | 'tip';
export type PaymentMethod = 'cash' | 'card' | 'online' | 'gift_card' | 'other';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  businessId: string;
  appointmentId?: string;
  clientId?: string;
  paymentReference: string;
  type: PaymentType;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  tipAmount: number;
  totalAmount: number;
  currency: string;
  processor?: string;
  processorId?: string;
  cardLastFour?: string;
  cardBrand?: string;
  receiptUrl?: string;
  notes?: string;
  processedBy?: string;
  processedAt?: Date;
  refundedAmount: number;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Product Types
// =============================================================================

export interface ProductCategory {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  products?: Product[];
}

export interface Product {
  id: string;
  businessId: string;
  categoryId?: string;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  brand?: string;
  costPrice?: number;
  retailPrice: number;
  taxRate?: number;
  isTaxable: boolean;
  imageUrl?: string;
  isActive: boolean;
  isSellableOnline: boolean;
  commissionRate?: number;
  inventory?: ProductInventory[];
  category?: ProductCategory;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductInventory {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  lowStockThreshold?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  lastRestockAt?: Date;
  location?: Location;
}

// =============================================================================
// Booking Types (Public API)
// =============================================================================

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
  staffOptions: {
    staffId: string;
    name: string;
    avatarUrl?: string;
  }[];
}

export interface BookingRequest {
  locationId: string;
  startTime: string;
  client: {
    email?: string;
    phone?: string;
    firstName: string;
    lastName: string;
  };
  services: {
    serviceId: string;
    variationId?: string;
    staffId: string;
  }[];
  notes?: string;
}

// =============================================================================
// Report Types
// =============================================================================

export interface RevenueReport {
  period: {
    start: Date;
    end: Date;
  };
  revenue: {
    services: number;
    products: number;
    tips: number;
    total: number;
  };
  breakdown: {
    date: string;
    amount: number;
  }[];
  growth: number;
}

export interface AppointmentReport {
  period: {
    start: Date;
    end: Date;
  };
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  breakdown: {
    date: string;
    count: number;
  }[];
}

// =============================================================================
// Notification Types
// =============================================================================

export type NotificationChannel = 'email' | 'sms' | 'push';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface NotificationTemplate {
  id: string;
  businessId?: string;
  type: string;
  channel: NotificationChannel;
  name: string;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

// =============================================================================
// Review Types
// =============================================================================

export interface Review {
  id: string;
  businessId: string;
  locationId: string;
  appointmentId?: string;
  clientId: string;
  staffId?: string;
  overallRating: number;
  serviceRating?: number;
  staffRating?: number;
  cleanlinessRating?: number;
  valueRating?: number;
  comment?: string;
  response?: string;
  respondedAt?: Date;
  isPublic: boolean;
  isVerified: boolean;
  client?: Client;
  staff?: Staff;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Discount Types
// =============================================================================

export type DiscountType = 'percentage' | 'fixed' | 'free_service';
export type DiscountAppliesTo = 'all' | 'services' | 'products' | 'specific';

export interface Discount {
  id: string;
  businessId: string;
  code?: string;
  name: string;
  description?: string;
  type: DiscountType;
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  appliesTo: DiscountAppliesTo;
  serviceIds: string[];
  productIds: string[];
  usageLimit?: number;
  usageCount: number;
  perClientLimit?: number;
  firstVisitOnly: boolean;
  validFrom?: Date;
  validUntil?: Date;
  isActive: boolean;
}
