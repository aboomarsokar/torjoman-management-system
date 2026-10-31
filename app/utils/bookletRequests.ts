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
