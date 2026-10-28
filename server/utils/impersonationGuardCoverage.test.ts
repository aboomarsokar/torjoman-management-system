/**
 * كلُّ مسارٍ يكتب يحمل requireWritableSession — القائمةُ تُشتقّ من الكود لا تُكتب بيد.
 * service_role يتخطّى RLS كلَّها، فحارسُ القاعدة وحدَه يترك مساراتِ الخادم تكتب بالنيابة.
 * والكتابةُ تُقاس بأثرها لا بفعل HTTP — في المسار نفسِه أو في مساعدٍ من server/utils يناديه
 * (بالاستيراد أو بالاستيراد الآليّ في Nitro: يُطابَق اسمُ الدالّة المُصدَّرة لا سطرُ الاستيراد).
 * النصُّ يُجرَّد من التعليقات أوّلاً: حارسٌ في تعليقٍ لا يحرس، وكتابةٌ في تعليقٍ لا تكتب.
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
  'server/api/impersonate/write-mode.post.ts', // بابُ الكتابة: لا نافذةَ قبل الفتح، وحارسُه دورُ الفاعل في الصفّ
  'server/api/cron/sms.post.ts' // يناديه المجدوِلُ (pg_net) لا مستخدم: لا جلسةَ ولا نائب، وحارسُه رمزٌ لمرّةٍ واحدة (consume_cron_nonce)
])

const code = (p: string) => readFileSync(p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1')
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const full = join(dir, n)
  return statSync(full).isDirectory() ? walk(full) : [full]
})
const sources = (dir: string) => walk(dir).filter(p => p.endsWith('.ts') && !p.endsWith('.test.ts'))
const writesDirectly = (src: string) => WRITES.some(w => NOT_REALLY_WRITES.reduce((t, p) => t.replace(p, ''), src).includes(w))

/** الدوالُّ المُصدَّرة من مساعدات server/utils التي تكتب (كتابةً مباشرة أو بمساعدٍ كاتبٍ آخر). */
function writingHelpers(): Set<string> {
  const utils = sources('server/utils').map(p => ({ p, src: code(p) }))
  const names = new Set<string>()
  const exported = (src: string) => [...src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m => m[1]!)
  for (let changed = true; changed;) {
    changed = false
    for (const { src } of utils) {
      const calls = [...names].some(n => src.includes(`${n}(`))
      if (!writesDirectly(src) && !calls) continue
      for (const n of exported(src)) {
        if (!names.has(n)) {
          names.add(n)
          changed = true
        }
      }
    }
  }
  return names
}

const HELPERS = writingHelpers()
const writes = (src: string) => writesDirectly(src) || [...HELPERS].some(n => src.includes(`${n}(`))

describe('تغطيةُ حارس النيابة', () => {
  it('المساعداتُ الكاتبة تُكتشف — openSessionFor منها، والقارئةُ ليست منها', () => {
    expect(HELPERS.has('openSessionFor')).toBe(true)
    for (const reader of ['requireCaller', 'readSessionClaims', 'isSessionLive', 'requireAdminManager', 'requireWritableSession']) {
      expect(HELPERS.has(reader), reader).toBe(false)
    }
  })
  it('كلُّ مسارٍ يكتب يستدعي requireWritableSession', () => {
    const missing = sources('server/api')
      .filter(p => !EXEMPT.has(p))
      .filter((p) => {
        const s = code(p)
        return writes(s) && !s.includes('requireWritableSession(')
      })
    expect(missing, `مساراتُ كتابةٍ بلا حارس:\n${missing.join('\n')}`).toEqual([])
  })
  it('ومساراتُ القراءة لا تُحرس — فالنيابةُ تقرأ', () => {
    for (const p of ['server/api/public/student/[token].get.ts', 'server/api/me/impersonation.get.ts']) {
      const s = code(p)
      expect(writes(s), `${p} صار يكتب`).toBe(false)
      expect(s).not.toContain('requireWritableSession(')
    }
  })
  it('والمستثنى قليلٌ معروف — يُرفع السقفُ بقرارٍ مكتوب لا بعادة', () => {
    // 3 (قرار 2026-10-27): بابا النيابة، ومسارُ المجدوِل الذي لا مستخدمَ له (cron/sms)
    expect(EXEMPT.size).toBeLessThanOrEqual(3)
  })
  it('والمستثنى موجودٌ فعلاً — اسمٌ قديمٌ في القائمة لا يستر شيئاً', () => {
    for (const p of EXEMPT) expect(() => statSync(p), p).not.toThrow()
  })
})
