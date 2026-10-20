/**
 * كلُّ مسارٍ يكتب يحمل requireWritableSession — القائمةُ تُشتقّ من الكود لا تُكتب بيد.
 * service_role يتخطّى RLS كلَّها، فحارسُ القاعدة وحدَه يترك مساراتِ الخادم تكتب بالنيابة.
 * والكتابةُ تُقاس بأثرها لا بفعل HTTP.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const WRITES = ['.insert(', '.update(', '.upsert(', '.delete(', 'auth.admin.', '.rpc(']
/** ما يشبه الكتابةَ وهو قراءة — بمبدأٍ لا بأسماء ملفات. */
const NOT_REALLY_WRITES: readonly RegExp[] = [
  /auth\.admin\.getUserById\(/g,
  /\.rpc\('claim_employee_number'\)/g // تسلسلٌ لا كتابةَ جدول — والمسارُ كاتبٌ بغيره على أيّ حال
]
/** أبوابُ النيابة نفسِها — حَرْسُها يحبس النائبَ أو يجعل الفتحَ مستحيلاً. */
const EXEMPT = new Set([
  'server/api/impersonate/end.post.ts', // بابُ الخروج: يختم صفَّه ويُبطل جلستَه
  'server/api/impersonate/write-mode.post.ts' // بابُ الكتابة: لا نافذةَ قبل الفتح، وحارسُه دورُ الفاعل في الصفّ
])

const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const full = join(dir, n)
  return statSync(full).isDirectory() ? walk(full) : [full]
})
const writes = (src: string) => WRITES.some(w => NOT_REALLY_WRITES.reduce((t, p) => t.replace(p, ''), src).includes(w))

describe('تغطيةُ حارس النيابة', () => {
  it('كلُّ مسارٍ يكتب يستدعي requireWritableSession', () => {
    const missing = walk('server/api')
      .filter(p => p.endsWith('.ts') && !p.endsWith('.test.ts') && !EXEMPT.has(p))
      .filter((p) => {
        const s = readFileSync(p, 'utf8')
        return writes(s) && !s.includes('requireWritableSession(')
      })
    expect(missing, `مساراتُ كتابةٍ بلا حارس:\n${missing.join('\n')}`).toEqual([])
  })
  it('ومساراتُ القراءة لا تُحرس — فالنيابةُ تقرأ', () => {
    for (const p of ['server/api/public/student/[token].get.ts', 'server/api/me/impersonation.get.ts']) {
      const s = readFileSync(p, 'utf8')
      expect(writes(s), `${p} صار يكتب`).toBe(false)
      expect(s).not.toContain('requireWritableSession(')
    }
  })
  it('والمستثنى قليلٌ معروف — يُرفع السقفُ بقرارٍ مكتوب لا بعادة', () => {
    expect(EXEMPT.size).toBeLessThanOrEqual(2)
  })
  it('والمستثنى موجودٌ فعلاً — اسمٌ قديمٌ في القائمة لا يستر شيئاً', () => {
    for (const p of EXEMPT) expect(() => statSync(p), p).not.toThrow()
  })
})
