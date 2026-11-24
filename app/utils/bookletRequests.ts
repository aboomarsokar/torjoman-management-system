/**
 * طلباتُ الملازم بأربع حالات (طلب المستخدم 2026-10-31): جديد ← أُبلغ المعلّم (النسخُ محجوزة) ← تمّ التسليم، أو ملغى.
 * المحجوزُ = نسخُ الطلبات المُبلَغة غيرِ المسلَّمة، والمتوفّرُ = الرصيد − المحجوز (كما في `private.booklet_reserved`).
 * منطقٌ صرفٌ مختبَر.
 */
import type { StockRow } from '~/utils/bookletStock'

export type RequestStatus = 'open' | 'ready' | 'done' | 'cancelled'
export interface RequestLike { id: string, booklet: number, copies: number, status: string }

/** الطلبُ ما زال قائماً: يُعدَّل ويُلغى ويُسلَّم. */
export const isPendingRequest = (status: string) => status === 'open' || status === 'ready'

export const REQUEST_STATUS: Record<RequestStatus, { label: string, color: 'warning' | 'info' | 'success' | 'neutral' }> = {
  open: { label: 'جديد', color: 'warning' },
  ready: { label: 'أُبلغ المعلّم', color: 'info' },
  done: { label: 'تمّ التسليم', color: 'success' },
  cancelled: { label: 'ملغى', color: 'neutral' }
}

/** حالةُ الطلب كما يراها المعلّم. */
export const TEACHER_STATUS: Record<RequestStatus, string> = {
  open: 'بانتظار التجهيز',
  ready: 'جاهزةٌ للاستلام',
  done: 'تمّ التسليم',
  cancelled: 'ملغى'
}

export function statusMeta(status: string) {
  return REQUEST_STATUS[status as RequestStatus] ?? REQUEST_STATUS.open
}

/** المحجوزُ لكلّ ملزمة، بلا الطلب المستثنى. */
export function reservedCopies(requests: RequestLike[], booklet: number, exceptId?: string): number {
  return requests
    .filter(r => r.booklet === booklet && r.status === 'ready' && r.id !== exceptId)
    .reduce((s, r) => s + r.copies, 0)
}

export type RequestStock
  = | { kind: 'untracked' }
    | { kind: 'short' | 'low' | 'ok', available: number }

/**
 * هل يكفي المخزونُ لهذا الطلب؟ المتوفّرُ يحسب المحجوزَ لغيره (والمُبلَغُ محجوزٌ لنفسه أصلاً).
 * `low`: يكفي لكنّ ما يبقى بعده عند حدّ التنبيه أو دونه.
 */
export function requestStock(req: RequestLike, stock: StockRow[], requests: RequestLike[]): RequestStock {
  const row = stock.find(s => s.booklet === req.booklet)
  if (!row) return { kind: 'untracked' }
  const available = row.quantity - reservedCopies(requests, req.booklet, req.id)
  if (available < req.copies) return { kind: 'short', available: Math.max(available, 0) }
  return { kind: available - req.copies <= row.alert_at ? 'low' : 'ok', available }
}

/** نصُّ حالة المخزون تحت الطلب، أو null إن كان كافياً بلا تنبيه. */
export function requestStockText(s: RequestStock, copies: number): string | null {
  if (s.kind === 'untracked') return 'الملزمةُ غيرُ مجرودة — لا يمكن التحقّق من توفّرها'
  if (s.kind === 'short') return `المخزونُ لا يكفي: المتوفّر ${s.available} والمطلوب ${copies}`
  if (s.kind === 'low') return `يكفي، ويبقى بعده ${s.available - copies} — عند حدّ التنبيه`
  return null
}

/**
 * حاجةُ الحلقة من ملزمة (طلب المستخدم 2026-11-24 — `booklet_rooms`): طلابُها النشطون، وما استلمته منها،
 * ونسخُ طلباتها القائمة. لا يطلب المعلّمُ ما يجعل المستلَمَ والقائمَ أكثرَ من الطلاب (الحارسُ في القاعدة).
 */
export interface BookletRoom { halaqa_id: string, booklet: number, students: number, received: number, pending: number, female: boolean }

/** المتاحُ لطلب: الطلاب − المستلَم − القائمُ لغيره (`own` نسخُ الطلب نفسه حين يُعدَّل وهو قائم). */
export const roomLeft = (r: BookletRoom, own = 0) => r.students - r.received - (r.pending - own)

/** سطرُ الحاجة تحت حقل النسخ عند المعلّم. */
export function roomLine(r: BookletRoom, own = 0): string {
  const others = r.pending - own
  return `${r.female ? 'طالباتُكِ' : 'طلابُك'} ${r.students} · استلمت الحلقة ${r.received}`
    + (others > 0 ? ` · طلباتٌ قائمة ${others}` : '') + ` — المتاح ${Math.max(roomLeft(r, own), 0)}`
}

/** خطأُ تجاوز الحاجة بالعربية، أو null. */
export function roomError(r: BookletRoom | null | undefined, copies: number, own = 0): string | null {
  if (!r) return null
  const left = roomLeft(r, own)
  if (copies <= left) return null
  if (left <= 0) {
    return `لا تحتاج ${r.female ? 'حلقتُكِ' : 'حلقتُك'} نسخاً إضافية من هذه الملزمة. للحالات الخاصة ${r.female ? 'تواصلي' : 'تواصل'} مع المدير الإداري.`
  }
  return `عددُ النسخ أكبر من حاجة الحلقة — المتاحُ ${left} نسخة.`
}

/** تنبيهُ المدير لطلبٍ قائم يزيد فيه المستلَمُ والقائمُ على عدد الطلاب، أو null. */
export function overNeedText(r: BookletRoom | null | undefined): string | null {
  if (!r || r.received + r.pending <= r.students) return null
  return `يتجاوز الحاجة: ${r.female ? 'الطالبات' : 'الطلاب'} ${r.students} · استُلم ${r.received} · مطلوبٌ قائم ${r.pending}`
}

/** حاجةُ حلقة الطلب وملزمته من قائمة الحاجات، أو null. */
export function roomOfRequest(rooms: BookletRoom[], r: { halaqa_id: string, booklet: number } | null): BookletRoom | null {
  return r ? rooms.find(x => x.halaqa_id === r.halaqa_id && x.booklet === r.booklet) ?? null : null
}

/** «يتجاوز الحاجة» لكلّ طلبٍ قائم في حلقةٍ وملزمةٍ زاد فيهما المستلَمُ والقائمُ على الطلاب. */
export function overNeedNotes(rows: (RequestLike & { halaqa_id: string })[], rooms: BookletRoom[]): Map<string, string> {
  const notes = new Map<string, string>()
  for (const r of rows) {
    const text = isPendingRequest(r.status) ? overNeedText(roomOfRequest(rooms, r)) : null
    if (text) notes.set(r.id, text)
  }
  return notes
}

/** أقصى ما يُبقى عليه طلبٌ قائم ليوافق الحاجة (0: الأنسبُ إلغاؤه). */
export const fitCopies = (r: BookletRoom, own: number) => Math.max(0, roomLeft(r, own))
