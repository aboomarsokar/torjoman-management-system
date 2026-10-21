/**
 * حرسُ النيابة في الهجرات القادمة: كلُّ جدولٍ جديدٍ في public يُحرس، وكلُّ دالّة definer كاتبةٍ تفحص الجلسة،
 * ولا سياسةَ كتابةٍ تُفتح على الجداول المستثناة من الحراسة.
 * الهجرةُ نفسُها (`…_impersonation_read_only_sweep.sql`) تفحص الإنتاج لحظةَ تطبيقها؛ وهذا يمسك ما يُكتب بعدها.
 * كلُّ فحصٍ يجمع المخالفات كلَّها ثم يقارنها بـ[] — فتظهر جميعاً في رسالة الفشل لا أوّلُها وحدَه.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

const DIR = 'supabase/migrations'
const SWEEP = readdirSync(DIR).find(f => f.endsWith('_impersonation_read_only_sweep.sql'))!
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '')
const after = readdirSync(DIR)
  .filter(f => f.endsWith('.sql') && f > SWEEP)
  .map(f => [f, strip(readFileSync(`${DIR}/${f}`, 'utf8'))] as const)

/** حارسُ الجلسة في بدن الدالّة. */
const GUARD = /assert_session_writable|session_is_read_only|is_impersonating/
/** كتابةٌ في البدن — ومنها التحديثُ باسمٍ مستعار (`update public.t t set`) وmerge. */
const WRITE = /\b(?:insert\s+into|update\s+(?:only\s+)?[^\s;()]+(?:\s+(?:as\s+)?\w+)?\s+set|delete\s+from|merge\s+into)\b/i
/** الجداولُ المستثناة من الحراسة: لا تُفتح عليها كتابةٌ للعميل أبداً. */
const UNGUARDED_TABLES = 'notifications|impersonation_sessions|impersonation_writes'
/**
 * لبُّ النيابة نفسُه: يكتب جداولَ النيابة أو auth بيد الخادم والمشغّل، فلا يُطلب فيه الحارس.
 * لا يُضاف اسمٌ هنا إلا بعلّةٍ مكتوبة — الحارسُ في دالّةٍ لا جلسةَ لمناديها (cron، service_role) يمرّ بلا أثر.
 */
const CORE = new Set([
  'private.is_impersonating', 'private.session_is_read_only', 'private.assert_session_writable',
  'private.log_impersonation_write', 'private.notify_impersonation', 'private.guard_impersonated_credentials',
  'private.guard_table_for_impersonation', 'private.end_impersonation_sessions', 'public.end_impersonation_sessions',
  // Task 2ب: كنسُ pg_cron يختم الجلسات المنتهية.
  'private.sweep_expired_impersonations'
])

interface ParsedFn { name: string, head: string, body: string }

/** يقسم نصَّ `create function` إلى الاسم والسمات والبدن: وسمُ دولار، أو `begin atomic … end;`، أو نصٌّ مقتبس. */
function parseFunction(chunk: string): ParsedFn {
  const id = chunk.match(/^\s*(?:"?(\w+)"?\s*\.\s*)?"?(\w+)"?/)
  const name = `${(id?.[1] ?? 'public').toLowerCase()}.${(id?.[2] ?? '').toLowerCase()}`
  const semi = chunk.indexOf(';')
  const before = (i: number) => semi < 0 || i < semi
  const atomic = /\bbegin\s+atomic\b/i.exec(chunk)
  const tag = /\$\w*\$/.exec(chunk)
  if (atomic && before(atomic.index) && (!tag || atomic.index < tag.index)) {
    const rest = chunk.slice(atomic.index)
    const end = /\bend\s*;/i.exec(rest)
    return { name, head: chunk.slice(0, atomic.index), body: end ? rest.slice(0, end.index) : rest }
  }
  if (tag && before(tag.index)) {
    const start = tag.index
    const close = chunk.indexOf(tag[0], start + tag[0].length)
    const end = close < 0 ? chunk.length : close
    // سماتُ الدالّة قبل البدن أو بعده (security definer تُكتب في الموضعين).
    const head = chunk.slice(0, start) + chunk.slice(end + tag[0].length).split(';')[0]
    return { name, head, body: chunk.slice(start + tag[0].length, end) }
  }
  const stmt = semi < 0 ? chunk : chunk.slice(0, semi)
  return { name, head: stmt, body: stmt }
}

/** جدولٌ جديدٌ في public بلا نداء guard_table_for_impersonation في هجرته. */
function tableViolations(file: string, sql: string): string[] {
  const out: string[] = []
  for (const m of sql.matchAll(/create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?"?public"?\s*\.\s*"?(\w+)/gi)) {
    const guard = new RegExp(`guard_table_for_impersonation\\(\\s*'(?:"?public"?\\.)?"?${m[1]}"?'`, 'i')
    if (!guard.test(sql)) out.push(`${file}: public.${m[1]} بلا حارس النيابة`)
  }
  return out
}

/** دالّةُ security definer كاتبةٌ (في أيّ مخطّط، لا المشغّلات ولا اللبّ) بلا حارس الجلسة. */
/** أهدافُ الكتابة في البدن (insert/update/delete/merge) — جدولاً جدولاً بلا المخطّط. */
const WRITE_TARGET = /\b(?:insert\s+into|update\s+(?:only\s+)?|delete\s+from|merge\s+into)\s+(?:"?\w+"?\s*\.\s*)?"?(\w+)"?/gi
function writesOnlyUnguarded(body: string): boolean {
  const unguarded = new Set(UNGUARDED_TABLES.split('|'))
  const targets = [...body.matchAll(WRITE_TARGET)].map(m => m[1]!.toLowerCase())
  return targets.length > 0 && targets.every(t => unguarded.has(t))
}

function functionViolations(file: string, sql: string): string[] {
  const out: string[] = []
  for (const chunk of sql.split(/create\s+(?:or\s+replace\s+)?function\s+/i).slice(1)) {
    const fn = parseFunction(chunk)
    if (CORE.has(fn.name) || !/security\s+definer/i.test(fn.head) || /returns\s+(?:event_)?trigger\b/i.test(fn.head)) continue
    // كتابةٌ في جدولٍ مستثنى وحده (مثل `private.notify` تُدرج في notifications) لا تحتاج حارساً: الإشعارُ
    // يصدر حتى في نيابة التعديل، ولا يُفتح ذلك الجدولُ للعميل أبداً (policyViolations تحرسه)
    if (WRITE.test(fn.body) && !GUARD.test(fn.body) && !writesOnlyUnguarded(fn.body)) out.push(`${file}: ${fn.name} تكتب بلا حارس الجلسة`)
  }
  return out
}

/** سياسةٌ غيرُ SELECT (وبلا FOR = ALL) على جدولٍ مستثنى من الحراسة. */
function policyViolations(file: string, sql: string): string[] {
  const out: string[] = []
  const re = new RegExp(`create\\s+policy\\s+(?:"[^"]+"|\\w+)\\s+on\\s+(?:"?public"?\\s*\\.\\s*)?"?(${UNGUARDED_TABLES})"?\\b([^;]*);`, 'gi')
  for (const m of sql.matchAll(re)) {
    if (!/\bfor\s+select\b/i.test(m[2] ?? '')) out.push(`${file}: سياسةُ كتابةٍ على public.${m[1]} — جدولٌ بلا حارس النيابة`)
  }
  return out
}

describe('حرسُ النيابة في الهجرات اللاحقة', () => {
  it('هجرةُ الحراسة موجودة', () => expect(SWEEP).toBeTruthy())

  it('كلُّ create table public.* تنادي guard_table_for_impersonation', () => {
    expect(after.flatMap(([f, s]) => tableViolations(f, s))).toEqual([])
  })

  it('كلُّ دالّة security definer كاتبةٍ (أيَّ مخطّط) تفحص الجلسة', () => {
    expect(after.flatMap(([f, s]) => functionViolations(f, s))).toEqual([])
  })

  it('لا سياسةَ كتابةٍ على notifications ولا جدولَي النيابة', () => {
    expect(after.flatMap(([f, s]) => policyViolations(f, s))).toEqual([])
  })
})

describe('المحلّل نفسُه — أمثلةٌ موجبة وسالبة', () => {
  it('يمسك التحديثَ بالاسم المستعار وmerge وbegin atomic والمخطّطَ الخاصّ', () => {
    const bad = `
      create or replace function public.a() returns int language plpgsql security definer as $function$
      begin update public.transport_trips t set paid = true; return 1; end $function$;
      create function private.b() returns void language plpgsql security definer as $$ begin merge into public.x using y on true when matched then delete; end $$;
      create function public.c() returns void language sql security definer begin atomic delete from public.x; end;
      create function public.d() returns void language plpgsql as $$ begin insert into public.x values (1); end $$ security definer;`
    expect(functionViolations('f', bad)).toEqual([
      'f: public.a تكتب بلا حارس الجلسة', 'f: private.b تكتب بلا حارس الجلسة',
      'f: public.c تكتب بلا حارس الجلسة', 'f: public.d تكتب بلا حارس الجلسة'
    ])
  })

  it('لا يرفع المحروسةَ ولا المشغّلات ولا اللبَّ ولا invoker', () => {
    const ok = `
      create function public.a() returns void language plpgsql security definer as $$ begin perform private.assert_session_writable(); update public.x t set y = 1; end $$;
      create function private.t() returns trigger language plpgsql security definer as $$ begin insert into public.x values (1); return null; end $$;
      create function private.end_impersonation_sessions(p uuid[]) returns int language plpgsql security definer as $$ begin delete from auth.sessions; return 0; end $$;
      create function public.i() returns void language sql begin atomic delete from public.x; end;`
    expect(functionViolations('f', ok)).toEqual([])
  })

  it('يمسك الجدولَ غيرَ المسجَّل والمقتبس والسطرَ بعد table', () => {
    const sql = `create unlogged table public.a (id int);\ncreate table\n  if not exists "public"."b" (id int);\ncreate table public.c (id int);
      select private.guard_table_for_impersonation('public.c');`
    expect(tableViolations('f', sql)).toEqual(['f: public.a بلا حارس النيابة', 'f: public.b بلا حارس النيابة'])
  })

  it('يمسك سياسةَ الكتابة (وبلا FOR) على الجداول المستثناة ويُمرّر SELECT', () => {
    const sql = `create policy n_ins on public.notifications for insert to authenticated with check (true);
      create policy "s all" on public.impersonation_sessions to authenticated using (true);
      create policy w_sel on public.impersonation_writes for select to authenticated using (true);
      create policy x_ins on public.students for insert to authenticated with check (true);`
    expect(policyViolations('f', sql)).toEqual([
      'f: سياسةُ كتابةٍ على public.notifications — جدولٌ بلا حارس النيابة',
      'f: سياسةُ كتابةٍ على public.impersonation_sessions — جدولٌ بلا حارس النيابة'
    ])
  })
})
