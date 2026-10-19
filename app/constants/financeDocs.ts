/**
 * مستنداتُ الحركات المالية (فواتير وإيصالات): المستودعُ الخاصّ وحدودُه.
 * الحدودُ نفسها في القاعدة (المستودع `finance-docs` وقيود `transaction_attachments`) — غيّرهما معاً.
 */
export const FINANCE_DOCS_BUCKET = 'finance-docs'

/** 10 م.ب — صورةُ فاتورةٍ من الهاتف أو PDF ممسوح. */
export const MAX_FINANCE_DOC_BYTES = 10 * 1024 * 1024

/** الأنواعُ المقبولة وامتدادُ كلٍّ في المسار. */
export const FINANCE_DOC_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf'
}

/** مدّةُ الرابط الموقَّع لفتح المستند (ثوانٍ) — يُفتح فوراً فلا حاجة لأطول. */
export const FINANCE_DOC_URL_SECONDS = 60
