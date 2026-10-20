/** منطقُ كشف المواصلات النقيّ: حدودُ الشهر، والترقيم، والمجاميع، والتجميع بالموظف، والتحقّق. */
import { TRANSPORT_AMOUNT_MAX, TRANSPORT_DESCRIPTION_MAX, TRANSPORT_NOTES_MAX } from '~/constants/transport'
import { shiftMonth } from '~/utils/reportWindow'

export interface Trip {
  id: string
  profile_id: string
  trip_date: string
  description: string
  amount: number
  notes: string | null
  paid: boolean
  paid_at: string | null
  created_at: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** أوّلُ يومٍ في الشهر، وأوّلُ يومٍ في الذي يليه (حصريّ) — لاستعلام `gte/lt`. */
export function monthBounds(year: number, month: number): { from: string, to: string } {
  const next = shiftMonth(year, month, 1)
  return { from: `${year}-${pad(month)}-01`, to: `${next.year}-${pad(next.month)}-01` }
}

/** الرقمُ التسلسليّ في الشهر: بالتاريخ ثم بوقت الإنشاء، من 1. */
export function numberTrips(trips: Trip[]): (Trip & { serial: number })[] {
  return [...trips]
    .sort((a, b) => a.trip_date.localeCompare(b.trip_date) || a.created_at.localeCompare(b.created_at))
    .map((t, i) => ({ ...t, serial: i + 1 }))
}

/** مجموعُ المبالغ مقرّباً لخانتين (لا 0.30000000000000004). */
export function sumAmount(trips: Pick<Trip, 'amount'>[]): number {
  return Math.round(trips.reduce((s, t) => s + Number(t.amount), 0) * 100) / 100
}

/** المبلغ بالشيكل: الصحيحُ بلا كسور، والكسريّ بخانتين. */
export function formatAmount(n: number): string {
  return `${Number.isInteger(n) ? String(n) : n.toFixed(2)} ₪`
}

/** يعزل النصَّ في اتجاهٍ لاتينيّ (LRI…PDI) كي لا ينقلب «315 ₪» داخل سياقٍ عربيّ (حقول البطاقات). */
export function isolateLtr(s: string): string {
  return `\u2066${s}\u2069`
}

/** الرحلاتُ غيرُ المسدَّدة وحدها. */
export function unpaid(trips: Trip[]): Trip[] {
  return trips.filter(t => !t.paid)
}

/** صاحبُها ما دامت غيرَ مسدَّدة؛ والمدير الإداري دائماً (كما في RLS). */
export function canEditTrip(trip: Pick<Trip, 'paid'>, opts: { isOwner: boolean, isAdmin: boolean }): boolean {
  return opts.isAdmin || (opts.isOwner && !trip.paid)
}

/** رحلاتُ العرض مجمَّعةً لكلّ موظف، مرتّبةً بالاسم، بمجموعها وغير المسدَّد منه. */
export function groupByEmployee(trips: Trip[], names: Record<string, string>) {
  const by = new Map<string, Trip[]>()
  for (const t of trips) by.set(t.profile_id, [...(by.get(t.profile_id) ?? []), t])
  return [...by.entries()]
    .map(([profileId, list]) => ({
      profileId,
      name: names[profileId] ?? '—',
      trips: numberTrips(list),
      total: sumAmount(list),
      unpaidTotal: sumAmount(unpaid(list))
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

/** لفظُ عدد الرحلات بالعربية: مفرد، ومثنّى، وجمع (3–10 «رحلات»، 11 فما فوق «رحلة»). */
export function tripsCount(n: number): string {
  if (n === 1) return 'رحلة واحدة'
  if (n === 2) return 'رحلتين'
  return n <= 10 ? `${n} رحلات` : `${n} رحلة`
}

/** نصُّ نافذة «تسديد الكل»: العددُ والمبلغ (المبلغُ معزولٌ لاتينيّاً فلا ينقلب «315 ₪»). */
export function payAllText(trips: Pick<Trip, 'amount'>[]): string {
  return `تسديد ${tripsCount(trips.length)} بمبلغ ${isolateLtr(formatAmount(sumAmount(trips)))}؟`
}

/** ما يكتبه المستخدم بلوحة المفاتيح العربية ← صيغةٌ رقميةٌ لاتينية: يقصّ الفراغ، ويحوّل الأرقام الهندية `٠-٩` والفارسية `۰-۹` إلى `0-9`، والفاصلةَ العشرية `٫` والفاصلة `,` إلى `.`. */
export function normalizeAmount(s: string): string {
  return s
    .trim()
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[٫,]/g, '.')
}

/** تحقّقُ نموذج الرحلة (القاعدةُ هي الحَكَم؛ هذا لتجربةٍ أوضح). `today` بتوقيت غزة. */
export function validateTrip(
  input: { trip_date: string, description: string, amount: string, notes: string },
  today: string
): { name: string, message: string }[] {
  const errors: { name: string, message: string }[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.trip_date)) errors.push({ name: 'trip_date', message: 'التاريخ مطلوب.' })
  else if (input.trip_date > today) errors.push({ name: 'trip_date', message: 'لا تُسجَّل رحلةٌ بتاريخٍ لم يأتِ بعد.' })
  const desc = input.description.trim()
  if (!desc) errors.push({ name: 'description', message: 'البيان مطلوب.' })
  else if (desc.length > TRANSPORT_DESCRIPTION_MAX) errors.push({ name: 'description', message: `البيان لا يتجاوز ${TRANSPORT_DESCRIPTION_MAX} حرفاً.` })
  const raw = normalizeAmount(input.amount)
  const amount = Number(raw)
  if (!/^\d+(\.\d{1,2})?$/.test(raw) || !(amount > 0) || amount > TRANSPORT_AMOUNT_MAX) {
    errors.push({ name: 'amount', message: `مبلغٌ موجبٌ حتى ${TRANSPORT_AMOUNT_MAX} بخانتين عشريّتين على الأكثر.` })
  }
  if (input.notes.length > TRANSPORT_NOTES_MAX) errors.push({ name: 'notes', message: `الملاحظات لا تتجاوز ${TRANSPORT_NOTES_MAX} حرف.` })
  return errors
}
