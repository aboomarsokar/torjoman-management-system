/**
 * حراساتُ مسارات النيابة نصّاً (بعد تجريد التعليقات) — ما لا يُختبر بلا جلساتٍ حقيقيّة يُمسك بشكله:
 * البدءُ يفحص النطاقَ والنيابةَ المتداخلة ولا يقبل بريداً، والجلسةُ تُفتح بعميلٍ منفصل،
 * ولا خروجَ global في الخادم، والعميلُ يبدّل الجلسةَ بـrefreshSession لا setSession.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) => readFileSync(p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1')

const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const full = join(dir, n)
  return statSync(full).isDirectory() ? walk(full) : [full]
})

describe('مسارُ البدء', () => {
  const start = code('server/api/impersonate.post.ts')
  it('يفحص النيابةَ المتداخلة والنطاقَ والجلسةَ الكاتبة', () => {
    expect(start).toContain('caller.isImpersonating')
    expect(start).toContain('assertMayImpersonate(')
    expect(start).toContain('requireWritableSession(')
    expect(start).toContain('openSessionFor(')
  })
  it('لا بريدَ من الطلب', () => {
    expect(start).not.toContain('body.email')
    expect(start).not.toMatch(/email/i)
  })
  it('النيابةُ المتداخلة تُردّ قبل أيّ قراءةٍ للجسم', () => {
    expect(start.indexOf('caller.isImpersonating')).toBeLessThan(start.indexOf('readBody('))
  })
})

describe('فتحُ الجلسة', () => {
  const session = code('server/utils/impersonationSession.ts')
  it('البريدُ من auth.users بالمعرّف، والاستهلاكُ بعميلٍ منفصلٍ بلا حفظ', () => {
    expect(session).toContain('getUserById(')
    expect(session).toMatch(/createClient(<\w+>)?\(/)
    expect(session).toMatch(/persistSession:\s*false/)
  })
})

describe('الخروج', () => {
  it('لا signOut في الخادم إلا بنطاق local', () => {
    const bad = walk('server')
      .filter(p => p.endsWith('.ts') && !p.endsWith('.test.ts'))
      .flatMap(p => [...code(p).matchAll(/signOut\(([^)]*)\)/g)]
        .filter(m => !m[1]!.includes('\'local\''))
        .map(m => `${p}: ${m[0]}`))
    expect(bad).toEqual([])
  })
})

// الواجهة (Task 4): تُفحص حين يُبنى useImpersonation.ts.
describe.skipIf(!existsSync('app/composables/useImpersonation.ts'))('الواجهة', () => {
  it('useImpersonation يبدّل الجلسةَ بـrefreshSession لا setSession ثم تحميلٌ كامل', () => {
    const s = code('app/composables/useImpersonation.ts')
    expect(s).toContain('refreshSession(')
    expect(s).not.toContain('setSession(')
    expect(s).toContain('window.location.replace(')
  })
  it('useAuth يخرج محلّياً في النيابة', () => {
    expect(code('app/composables/useAuth.ts')).toContain('scope: \'local\'')
  })
})
