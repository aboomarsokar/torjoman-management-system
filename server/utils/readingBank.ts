/**
 * إدخالُ بنك أسئلة القراءة من جدول (Excel أو CSV) — منطقٌ نقيٌّ بلا شبكة يستعمله `scripts/reading-bank.mjs`.
 * الأعمدة: المقرّر (رقمه 1، 2، …)، والسؤال، والخيارات الأربعة (أ، ب، ج، د)، والإجابة (أ/ب/ج/د أو 1–4 أو A–D).
 * يرفض السطرَ الناقص والمقرّرَ غيرَ الموجود والخياراتِ المكرّرة والإجابةَ المجهولة والسؤالَ المكرّرَ في مقرّره،
 * ويُحصي أسئلةَ كلّ مقرّر (الاختبارُ يحتاج 20 على الأقلّ، والمطلوبُ 100). لا يكتب شيئاً حتى يصحّ الملفّ كلّه.
 */
import type { LineError } from './bulkAccounts'

export interface BankQuestion { line: number, unitOrder: number, body: string, options: [string, string, string, string], correct: number }
export interface BankPlan { rows: BankQuestion[], errors: LineError[], perUnit: Map<number, number> }

const HEADERS: Record<string, string[]> = {
  unit: ['المقرر', 'المقرّر', 'رقم المقرر', 'unit'],
  body: ['السؤال', 'question'],
  a: ['أ', 'ا', 'الخيار أ', 'الخيار الأول', 'a'],
  b: ['ب', 'الخيار ب', 'الخيار الثاني', 'b'],
  c: ['ج', 'الخيار ج', 'الخيار الثالث', 'c'],
  d: ['د', 'الخيار د', 'الخيار الرابع', 'd'],
  answer: ['الإجابة', 'الاجابة', 'الإجابة الصحيحة', 'الاجابة الصحيحة', 'answer']
}
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
const ANSWERS: Record<string, number> = { أ: 0, ا: 0, ب: 1, ج: 2, د: 3, 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 }
const ARABIC_DIGITS: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' }
const latinDigits = (s: string) => s.replace(/[٠-٩]/g, d => ARABIC_DIGITS[d] ?? d)

/** صفوفُ الجدول ← سجلّاتٌ بمفاتيح الأعمدة، مع رقم السطر (السطر 1 للعناوين). */
export function bankRecords(table: string[][]): { line: number, record: Record<string, string> }[] {
  const [head, ...body] = table
  if (!head) return []
  const keys = head.map(h => Object.entries(HEADERS).find(([, names]) => names.some(x => norm(x) === norm(h)))?.[0] ?? null)
  return body
    .map((cells, i) => {
      const record: Record<string, string> = {}
      keys.forEach((k, j) => {
        if (k) record[k] = (cells[j] ?? '').trim()
      })
      return { line: i + 2, record }
    })
    .filter(r => Object.values(r.record).some(v => v !== ''))
}

/** أوّلُ خطأٍ في السطر، أو null. */
function lineProblem(l: { unitOrder: number, known: Set<number>, body: string, options: string[], correct: number | undefined, duplicate: boolean }): string | null {
  if (!Number.isInteger(l.unitOrder) || l.unitOrder < 1) return 'رقم المقرّر غير صحيح'
  if (!l.known.has(l.unitOrder)) return `المقرّر ${l.unitOrder} غير موجود في المنصّة`
  if (!l.body) return 'السؤال فارغ'
  if (l.options.some(o => !o)) return 'أحد الخيارات الأربعة فارغ'
  if (new Set(l.options.map(norm)).size < 4) return 'خياران متطابقان'
  if (l.correct === undefined) return 'الإجابة غير مفهومة — اكتب أ أو ب أو ج أو د'
  if (l.duplicate) return 'السؤال مكرّر في المقرّر نفسه'
  return null
}

/** يتحقّق من كلّ سطرٍ ويُحصي كلّ مقرّر؛ `unitOrders` أرقامُ المقرّرات الموجودة في القاعدة. */
export function planBank(records: { line: number, record: Record<string, string> }[], unitOrders: number[]): BankPlan {
  const rows: BankQuestion[] = []
  const errors: LineError[] = []
  const seen = new Set<string>()
  const known = new Set(unitOrders)

  for (const { line, record: r } of records) {
    const unitOrder = Number(latinDigits(r.unit ?? ''))
    const options = [r.a, r.b, r.c, r.d].map(o => (o ?? '').trim())
    const correct = ANSWERS[norm(latinDigits(r.answer ?? ''))]
    const body = (r.body ?? '').trim()

    const problem = lineProblem({ unitOrder, known, body, options, correct, duplicate: seen.has(`${unitOrder}|${norm(body)}`) })
    if (problem) {
      errors.push({ line, message: problem })
      continue
    }
    seen.add(`${unitOrder}|${norm(body)}`)
    rows.push({ line, unitOrder, body, options: options as BankQuestion['options'], correct: correct! })
  }

  const perUnit = new Map<number, number>()
  for (const q of rows) perUnit.set(q.unitOrder, (perUnit.get(q.unitOrder) ?? 0) + 1)
  return { rows, errors, perUnit }
}
