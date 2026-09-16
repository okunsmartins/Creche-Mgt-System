// Re-export database types
export * from './database'

// ─── Application-level types ──────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T | null
  error: ApiError | null
}

export interface ApiError {
  code: string
  message: string
  field?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface BasketItem {
  studentId: string | null
  manualFirstName?: string
  manualLastName?: string
  classId: string
  className: string
  studentName: string
  activityId: string
  activityName: string
  unitAmountCents: number
  verificationStatus: 'verified' | 'manual'
}

export interface BasketState {
  items: BasketItem[]
  payerType: 'registered' | 'guest_code' | 'guest_manual'
  guestPayerName?: string
  guestPayerEmail?: string
}

export interface MoneyAmount {
  cents: number
  currency: 'EUR'
}

export interface DateRange {
  from: Date | null
  to: Date | null
}

export interface SelectOption {
  value: string
  label: string
}

// Session user shape exposed to client components
export interface SessionUser {
  id: string
  email: string
  emailVerified: boolean
  profile: {
    firstName: string
    lastName: string
  } | null
  roles: string[]
  permissions: string[]
  schoolId: string | null
  schoolName: string | null
  mustChangePassword: boolean
}
