/**
 * منطقُ أرشيف الملازم النقيّ: التجميعُ حسب الملزمة وحسب الحلقة، وأرقامُ الرأس، وعرضُ التاريخ.
 * الصفوفُ من `booklet_deliveries` كما تُجلب (تسليمٌ لكلّ صفّ، والتسليمُ يتكرّر).
 */
import type { StatItem } from '~/components/ui/StatStrip.vue'
import { BOOKLETS } from '~/constants/booklets'

export type DeliveryRow = {
  id: string
  halaqa_id: string
  booklet: number
  copies: number
  delivered_on: string
  note: string | null
}

export interface HalaqaLite {
  id: string
  name: string
  status: string
  /** للبحث باسم المعلّم والفلترة بالجنس (2026-10-25). */
  gender?: string | null
  teacher?: { full_name: string } | null
}

export interface BookletTotal {
  no: number
  label: string
  copies: number
  /** عددُ الحلقات التي استلمت منها. */
  halaqat: number
}

// type لا interface: يُمرَّر صفّاً لـ`UiDataTable` (المقيَّد بـRecord<string, unknown>)
export type HalaqaBooklets = {
  id: string
  name: string
  status: string
  gender: string | null
  teacher: string | null
  total: number
  /** الملازمُ المستلَمة بترتيبها (1 = الجزء 29 + 30) ونُسخُ كلٍّ منها. */
  booklets: { no: number, label: string, copies: number }[]
  lastOn: string | null
}

/** مجموعُ النسخ لكلّ ملزمةٍ من الخمسَ عشرة — والملزمةُ التي لم تُسلَّم بصفر. */
export function totalsByBooklet(rows: DeliveryRow[]): BookletTotal[] {
  return BOOKLETS.map((b) => {
    const mine = rows.filter(r => r.booklet === b.no)
    return {
      no: b.no,
      label: b.label,
      copies: mine.reduce((s, r) => s + r.copies, 0),
      halaqat: new Set(mine.map(r => r.halaqa_id)).size
    }
  })
}

/** لكلّ حلقةٍ مجموعُ ما استلمته وتفصيلُه بالملزمة وآخرُ تسليم — الحلقاتُ كلُّها (ومن لم تستلم بصفر)، المستلِمةُ أوّلاً. */
export function halaqaBooklets(rows: DeliveryRow[], halaqat: HalaqaLite[]): HalaqaBooklets[] {
  return halaqat.map((h) => {
    const mine = rows.filter(r => r.halaqa_id === h.id)
    const booklets = BOOKLETS
      .map(b => ({ no: b.no, label: b.label, copies: mine.filter(r => r.booklet === b.no).reduce((s, r) => s + r.copies, 0) }))
      .filter(b => b.copies > 0)
    const lastOn = mine.reduce<string | null>((m, r) => (m === null || r.delivered_on > m ? r.delivered_on : m), null)
    return { id: h.id, name: h.name, status: h.status, gender: h.gender ?? null, teacher: h.teacher?.full_name ?? null, total: booklets.reduce((s, b) => s + b.copies, 0), booklets, lastOn }
  }).sort((a, b) => (b.total > 0 ? 1 : 0) - (a.total > 0 ? 1 : 0) || a.name.localeCompare(b.name, 'ar'))
}

/** أرقامُ رأس الأرشيف: مجموعُ النسخ، والتسليمات، والحلقاتُ المستلِمة، والملازمُ الموزَّعة. */
export function bookletStats(rows: DeliveryRow[], halaqatCount: number): StatItem[] {
  const served = new Set(rows.map(r => r.halaqa_id)).size
  return [
    { key: 'copies', icon: 'i-lucide-book-copy', value: rows.reduce((s, r) => s + r.copies, 0), label: 'نسخةً مسلَّمة' },
    { key: 'deliveries', icon: 'i-lucide-package-check', value: rows.length, label: 'تسليماً', tone: 'neutral' },
    { key: 'halaqat', icon: 'i-lucide-book-open', value: served, label: 'حلقةً استلمت', sub: `من ${halaqatCount}`, tone: 'green' },
    { key: 'booklets', icon: 'i-lucide-layers', value: new Set(rows.map(r => r.booklet)).size, label: 'ملزمةً وُزِّعت', sub: `من ${BOOKLETS.length}`, tone: 'neutral' }
  ]
}

/** تاريخُ التسليم بالأرقام `DD-MM-YYYY` من نصّ التاريخ مباشرةً (بلا منطقةٍ زمنيّة). */
export function deliveryDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}-${m}-${y}` : iso
}
