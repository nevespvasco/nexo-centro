/** Formats a local Date as an ISO `YYYY-MM-DD` string, avoiding UTC-shift bugs from `toISOString()`. */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parses an ISO `YYYY-MM-DD` string as a local Date, avoiding the UTC-shift `new Date(str)` causes. */
export function fromISODate(value: string | null): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function calculateAge(dataNascimento: string | null): number | null {
  const birth = fromISODate(dataNascimento)
  if (!birth) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const beforeBirthdayThisYear =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (beforeBirthdayThisYear) age--
  return age
}

export function formatDatePT(value: string | null): string {
  const date = fromISODate(value)
  return date ? date.toLocaleDateString('pt-PT') : '—'
}
