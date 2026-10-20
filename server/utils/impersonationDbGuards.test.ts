/**
 * حرسُ النيابة في الهجرات القادمة: كلُّ جدولٍ جديدٍ في public يُحرس، وكلُّ دالّة definer كاتبةٍ تفحص الجلسة.
 * الهجرةُ نفسُها (`…_impersonation_read_only_sweep.sql`) تفحص الإنتاج لحظةَ تطبيقها؛ وهذا يمسك ما يُكتب بعدها.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

const DIR = 'supabase/migrations'
const SWEEP = readdirSync(DIR).find(f => f.endsWith('_impersonation_read_only_sweep.sql'))!
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '')
const after = readdirSync(DIR)
  .filter(f => f.endsWith('.sql') && f > SWEEP)
  .map(f => [f, strip(readFileSync(`${DIR}/${f}`, 'utf8'))] as const)

describe('حرسُ النيابة في الهجرات اللاحقة', () => {
  it('هجرةُ الحراسة موجودة', () => expect(SWEEP).toBeTruthy())

  it('كلُّ create table public.* تنادي guard_table_for_impersonation', () => {
    for (const [file, sql] of after) {
      for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)) {
        expect(sql, `${file}: ${m[1]} بلا حارس النيابة`).toMatch(new RegExp(`guard_table_for_impersonation\\(\\s*'public\\.${m[1]}'`))
      }
    }
  })

  it('كلُّ دالّة public security definer كاتبةٍ تفحص الجلسة', () => {
    for (const [file, sql] of after) {
      for (const fn of sql.split(/create (?:or replace )?function /i).slice(1)) {
        // أيُّ وسم دولار ($$ أو $function$ …) — لا $$ وحدَه، وإلا مرّت الدالّةُ بلا فحص.
        const tag = fn.match(/\$\w*\$/)
        if (!tag) continue
        const start = fn.indexOf(tag[0])
        const end = fn.indexOf(tag[0], start + tag[0].length)
        // سماتُ الدالّة قبل البدن أو بعده (security definer تُكتب في الموضعين).
        const head = fn.slice(0, start) + fn.slice(end, end + 200).split(';')[0]
        if (!/^public\./.test(fn) || !/security definer/i.test(head) || /returns trigger/i.test(head)) continue
        const body = fn.slice(start + tag[0].length, end)
        if (!/\b(insert\s+into|update\s+[\w.]+\s+set|delete\s+from)\b/i.test(body)) continue
        expect(body, `${file}: ${fn.slice(0, 60)}`).toMatch(/assert_session_writable|session_is_read_only|is_impersonating/)
      }
    }
  })
})
