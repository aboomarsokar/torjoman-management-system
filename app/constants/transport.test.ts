/**
 * أدوارُ تسجيل المواصلات تطابق `private.can_log_transport()` في أحدث هجرةٍ تعرّفها —
 * دورٌ يُضاف هناك ولا يُسمّى هنا يُرفض في الواجهة بلا سبب.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TRANSPORT_LOGGER_ROLES } from './transport'

const DEFINER = 'create or replace function private.can_log_transport'

/** نصُّ الدالّة من تعريفها إلى `$$;` الختاميّ، ثم الأدوارُ داخل `in (…)`. */
export function extractLoggerRoles(migrations: { name: string, text: string }[]): string[] {
  const latest = [...migrations]
    .filter(m => m.text.includes(DEFINER))
    .sort((a, b) => a.name.localeCompare(b.name))
    .at(-1)
  if (!latest) throw new Error('تعريف private.can_log_transport غير موجود في أيّ هجرة')
  const start = latest.text.indexOf(DEFINER)
  const end = latest.text.indexOf('$$;', latest.text.indexOf('$$', start) + 2)
  const body = latest.text.slice(start, end)
  const list = body.match(/\bin \(([^)]*)\)/)
  if (!list?.[1]) throw new Error('قائمةُ الأدوار غير موجودة في تعريف private.can_log_transport')
  return [...list[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]!)
}

function migrationRoles(): string[] {
  const dir = join(process.cwd(), 'supabase/migrations')
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  return extractLoggerRoles(files.map(name => ({ name, text: readFileSync(join(dir, name), 'utf8') })))
}

describe('extractLoggerRoles', () => {
  const fn = (roles: string) => `create or replace function private.can_log_transport()\nreturns boolean\nas $$\n  select coalesce(public.current_user_role()::text in (${roles}), false);\n$$;`

  it('يأخذ أحدثَ تعريفٍ بترتيب اسم الملف', () => {
    expect(extractLoggerRoles([
      { name: '001.sql', text: fn('\'old_role\'') },
      { name: '002.sql', text: fn('\'new_a\', \'new_b\'') }
    ])).toEqual(['new_a', 'new_b'])
  })

  it('يرفع خطأً إن لم يوجد التعريف', () => {
    expect(() => extractLoggerRoles([{ name: '001.sql', text: 'select 1;' }])).toThrow()
  })
})

describe('TRANSPORT_LOGGER_ROLES', () => {
  it('تطابق أدوار private.can_log_transport في أحدث هجرة حرفاً وترتيباً', () => {
    expect([...TRANSPORT_LOGGER_ROLES]).toEqual(migrationRoles())
  })
})
