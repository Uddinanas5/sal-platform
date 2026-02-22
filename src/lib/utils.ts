import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Default tax rate (8.875%) used across checkout, receipts, and purchase history */
export const TAX_RATE = 0.08875

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatDateRange(start: Date, end: Date): string {
  const startStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const endStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)
  return `${startStr} - ${endStr}`
}

export function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    confirmed: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    cancelled: 'bg-red-500/10 text-red-700 dark:text-red-300',
    'no-show': 'bg-muted text-muted-foreground',
    'checked-in': 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
    'in-progress': 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    inactive: 'bg-muted text-muted-foreground',
    paused: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    draft: 'bg-muted text-muted-foreground',
    scheduled: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    past_due: 'bg-red-500/10 text-red-700 dark:text-red-300',
  }
  return colors[status] || 'bg-muted text-muted-foreground'
}
