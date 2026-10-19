# نظام الإشعارات (الجزء ١ من الدفعة الثانية) — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** جرسٌ بقسمين — «بانتظارك» (طوابير محسوبة كما اليوم) و«الإشعارات» (أخبارٌ مخزّنة بمقروء/غير مقروء تصل فوراً) — ومعه أوّلُ مُنتِجَين: التنبيه الإداري والزيارة المجدولة.

**Architecture:** جدول `notifications` تكتبه القاعدة وحدها عبر `private.notify` (مخطّطٌ غير مكشوف)، ويقرؤه صاحبه وحده، ويُعلَّم مقروءاً بدالّةٍ محروسة. العميل يقرأ آخر 30 ويعدّ غير المقروء ويشترك بـRealtime، ويُبقي `useNotifications` الحاليّ للطوابير.

**Tech Stack:** Supabase Postgres (هجرات عبر موصل Supabase على المشروع `qwtqfkayupzijcoguqrf`)، Nuxt 4، `@nuxt/ui` v4، Vitest.

**المواصفة:** `docs/superpowers/specs/2026-10-19-v2-batch2-design.md` (الأسس المشتركة + الجزء ١).

## Global Constraints

- كلُّ نصٍّ يراه المستخدم بالعربية، والشهور والتواريخ أرقام (`19-10-2026`)، والمنطقة الزمنية `Asia/Gaza`.
- الدوالّ التي لا يجوز للعميل استدعاؤها في مخطّط `private` (لا في `public`)، و`security definer` + `set search_path = ''`.
- كلُّ جدولٍ جديد: RLS فور إنشائه + منحٌ صريح لـ`authenticated` (السياسة تقيّد ولا تمنح).
- كلُّ هجرة تنتهي بكتلة `do` تفحص نفسها وتُلغيها بـ`raise exception` إن خالف الواقعُ المقصود.
- اسمُ ملف الهجرة في المستودع = رقمُ نسختها الفعليّ في الإنتاج (يُقرأ بـ`list_migrations` بعد التطبيق) — لا رقمٌ مُختار يدوياً.
- بعد كلّ هجرة: `pnpm db:types` (يحتاج `SUPABASE_ACCESS_TOKEN` في البيئة) ويُفحص الناتج قبل استبدال `app/types/database.types.ts` (ليس فارغاً ويحوي الجدول الجديد).
- الملفات ≤ 300 سطر، وكلُّ مكوّن/composable موثّقٌ بـJSDoc في أعلاه، ولا ألوان مباشرة خارج `app/assets/css/main.css` (المتغيّرات `--ink` `--ink-2` `--ink-3` `--line` `--surface` `--surface-2` `--err` موجودة).
- **لا يُشعَر أحدٌ بفعلٍ فعله هو** — يُطبَّق مرّةً واحدة داخل `private.notify`.
- رسائل الإيداع Conventional بالعربية، وتنتهي بسطر: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- العمل على الفرع `feature/v2-batch2`؛ لا دمج ولا دفع إلا بإذنٍ صريح من المستخدم.

## خريطة الملفات

| الملف | المسؤولية |
|---|---|
| `supabase/migrations/<نسخة>_notifications.sql` (جديد) | المخطّط `private`، الجدول، `private.notify`، `mark_notifications_read`، Realtime، الفحص الذاتيّ |
| `supabase/migrations/<نسخة>_notify_alerts_visits.sql` (جديد) | مُنتِجا `alert_issued` و`visit_scheduled` |
| `app/constants/notifications.ts` (+ `.test.ts`) | قائمة الأنواع (مطابقةٌ لقيد القاعدة) وأيقوناتها وحدُّ الصندوق |
| `app/composables/useInbox.ts` (+ `.test.ts`) | قراءة الصندوق والعدّ والاشتراك والتعليم؛ ودوالّ نقيّة مُصدَّرة للدمج والتعليم والوقت النسبيّ |
| `app/components/NotificationsBell.vue` (جديد) | الجرس والعدّاد واللوحة بقسميها |
| `app/layouts/dashboard.vue` (تعديل) | يستبدل كتلةَ الجرس الحاليّة بـ`<NotificationsBell />` وينقل أنماطها |
| `docs/DATABASE.md` · `docs/FEATURES.md` · `docs/PAGES.md` · `docs/ROADMAP.md` | التوثيق |

---

### Task 1: هجرة عمود الإشعارات

**Files:**
- Create: `supabase/migrations/<نسخة>_notifications.sql`
- Modify: `app/types/database.types.ts` (مولَّد)

**Interfaces:**
- Produces: جدول `public.notifications(id, recipient_id, kind, title, body, link, source_table, source_id, read_at, created_at)`؛ `private.notify(p_recipient uuid, p_kind text, p_title text, p_body text, p_link text, p_source_table text, p_source_id uuid) returns void`؛ `public.mark_notifications_read(p_ids uuid[] default null) returns integer`.
- قائمة الأنواع (حرفياً، بهذا الترتيب): `report_submitted`, `report_approved`, `report_returned`, `alert_issued`, `visit_scheduled`, `exam_nominated`, `exam_graded`, `transport_paid`, `impersonation_started`, `impersonation_write`.

- [ ] **Step 1: اكتب الهجرة** (نصٌّ كامل؛ تُطبَّق بالخطوة 2 ثم يُحفظ الملف باسم النسخة):

```sql
-- عمودُ الإشعارات (الجزء ١ من الدفعة الثانية، 2026-10-19) — منقولٌ من الصحابة.
-- الإشعارُ خبرٌ عن أمرٍ وقع؛ أمّا طوابيرُ العمل فتُحسب عند العرض ولا تُخزَّن هنا.

-- ① مخطّطٌ غير مكشوف لـPostgREST: ما فيه لا يُستدعى من العميل.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ② الجدول: لمن · ماذا وقع · رابطُه · متى قُرئ.
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in (
    'report_submitted', 'report_approved', 'report_returned',
    'alert_issued', 'visit_scheduled',
    'exam_nominated', 'exam_graded',
    'transport_paid',
    'impersonation_started', 'impersonation_write'
  )),
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  body          text check (body is null or char_length(body) <= 400),
  -- مسارٌ داخليّ فقط: إشعارٌ يقود خارج المنصّة بابُ تصيّد.
  link          text check (link is null or link ~ '^/[A-Za-z0-9/_?=&-]*$'),
  source_table  text,
  source_id     uuid,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_inbox_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_expiry_idx on public.notifications (created_at);

alter table public.notifications enable row level security;

-- قراءةٌ لصاحبه وحده، ولا سياسةَ كتابةٍ إطلاقاً.
grant select on public.notifications to authenticated;
create policy notifications_read on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

comment on table public.notifications is
  'إشعاراتُ الأحداث المنقضية. تكتبها مُشغّلاتٌ عبر private.notify، ويقرؤها صاحبُها وحده، وتُحذف بعد ثلاثة أشهر.';

-- ③ البابُ الوحيد للكتابة.
create or replace function private.notify(
  p_recipient uuid, p_kind text, p_title text, p_body text,
  p_link text, p_source_table text, p_source_id uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- بلا مستلمٍ لا إشعار (وإلا أسقط القيدُ العمليةَ الأصلية)، ولا يُشعَر أحدٌ بفعله هو.
  if p_recipient is null or p_recipient = (select auth.uid()) then
    return;
  end if;

  insert into public.notifications (recipient_id, kind, title, body, link, source_table, source_id)
  values (p_recipient, p_kind, p_title, nullif(btrim(coalesce(p_body, '')), ''), p_link, p_source_table, p_source_id);

  -- التقليمُ بعد الإدراج وبدفعةٍ محدودة: ما مضى عليه ثلاثة أشهر.
  delete from public.notifications
   where id in (select id from public.notifications
                 where created_at < now() - interval '3 months'
                 order by created_at limit 200);
end;
$$;
revoke all on function private.notify(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;

-- ④ التعليمُ بالقراءة — دالّةٌ لا سياسةُ update (لا يعيد صاحبُ الإشعار كتابةَ نصّه).
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    return 0;
  end if;
  update public.notifications
     set read_at = now()
   where recipient_id = v_uid and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ⑤ الوصولُ الفوريّ (Realtime يحترم RLS).
alter publication supabase_realtime add table public.notifications;

-- ⑥ الفحصُ الذاتيّ.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass) then
    raise exception 'notifications: RLS غير مفعّل';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and cmd <> 'SELECT') then
    raise exception 'notifications: سياسة كتابةٍ غير مقصودة';
  end if;
  if not has_table_privilege('authenticated', 'public.notifications', 'select') then
    raise exception 'notifications: منحُ القراءة ناقص';
  end if;
  if has_table_privilege('authenticated', 'public.notifications', 'insert')
     or has_table_privilege('authenticated', 'public.notifications', 'update')
     or has_table_privilege('authenticated', 'public.notifications', 'delete') then
    raise exception 'notifications: منحُ كتابةٍ غير مقصود';
  end if;
  if has_function_privilege('authenticated', 'private.notify(uuid, text, text, text, text, text, uuid)', 'execute') then
    raise exception 'private.notify: مكشوفةٌ للعميل';
  end if;
  if not has_function_privilege('authenticated', 'public.mark_notifications_read(uuid[])', 'execute') then
    raise exception 'mark_notifications_read: منحُ التنفيذ ناقص';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
    raise exception 'notifications: ليست في supabase_realtime';
  end if;
end $$;
```

- [ ] **Step 2: طبّقها على الإنتاج** بأداة `apply_migration` من موصل Supabase (`project_id: qwtqfkayupzijcoguqrf`، `name: notifications`). المتوقّع: نجاحٌ بلا استثناء (الفحص الذاتيّ مرّ).

- [ ] **Step 3: احفظ الملف باسم النسخة الفعليّة**: `list_migrations` ← آخر سطر `version` (14 رقماً) ← احفظ النصّ نفسه في `supabase/migrations/<version>_notifications.sql`.

- [ ] **Step 4: تحقّقٌ بجلسة مستخدم** بأداة `execute_sql` (معاملةٌ تُلغى). خذ معرّفَي حسابين من `profiles` (معلّمٌ ومدير إداري):

```sql
begin;
-- كتابةُ إشعارٍ بصلاحية المالك للمعلّم
select private.notify('<teacher_id>', 'alert_issued', 'اختبار', null, '/alerts', null, null);
-- المعلّم يرى إشعاره
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<teacher_id>', 'role', 'authenticated')::text, true);
select count(*) as mine from public.notifications;                -- المتوقّع 1
select public.mark_notifications_read(null) as marked;             -- المتوقّع 1
-- غيرُه لا يراه
select set_config('request.jwt.claims', json_build_object('sub', '<admin_id>', 'role', 'authenticated')::text, true);
select count(*) as others from public.notifications;              -- المتوقّع 0
rollback;
```

ثم تأكّد أنّ العميل لا يستدعي الكاتب: في معاملةٍ بـ`set local role authenticated` نفّذ `select private.notify(...)` — المتوقّع خطأ `permission denied`.

- [ ] **Step 5: ولّد الأنواع**: `pnpm db:types` إلى ملفٍّ مؤقّت أوّلاً، وتأكّد أنه غير فارغ ويحوي `notifications:` و`mark_notifications_read`، ثم استبدل `app/types/database.types.ts`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_notifications.sql app/types/database.types.ts
git commit -m "feat(notifications): عمودُ الإشعارات — جدولٌ تكتبه القاعدة وحدها ويقرؤه صاحبه ويصل فوراً"
```

---

### Task 2: المُنتِجان الأوّلان — التنبيه الإداري والزيارة المجدولة

**Files:**
- Create: `supabase/migrations/<نسخة>_notify_alerts_visits.sql`

**Interfaces:**
- Consumes: `private.notify(...)` من Task 1.
- Produces: مُشغّل `admin_alerts_notify` (بعد الإدراج) ومُشغّل `supervision_visits_notify` (بعد الإدراج).

- [ ] **Step 1: اكتب الهجرة**

```sql
-- أوّلُ مُنتِجَين للإشعارات (2026-10-19): تنبيهٌ إداريّ للمعلّم، وزيارةٌ جُدولت للمشرف الميداني.

-- ① تنبيهٌ إداريّ جديد ← المعلّمُ المعنيّ.
create or replace function private.notify_alert_issued()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.notify(
    new.teacher_id, 'alert_issued', 'تنبيهٌ إداريّ جديد',
    new.violation_type, '/alerts', 'admin_alerts', new.id);
  return null;
end;
$$;
revoke all on function private.notify_alert_issued() from public, anon, authenticated;

create trigger admin_alerts_notify
  after insert on public.admin_alerts
  for each row execute function private.notify_alert_issued();

-- ② زيارةٌ جُدولت ← المشرفُ الميداني (ولا شيء إن جدولها لنفسه — يمنعه notify).
create or replace function private.notify_visit_scheduled()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_halaqa text;
begin
  select h.name into v_halaqa from public.halaqat h where h.id = new.halaqa_id;
  perform private.notify(
    new.supervisor_id, 'visit_scheduled', 'جُدولت لك زيارةٌ إشرافية',
    coalesce(v_halaqa, 'حلقة') || ' · ' ||
      to_char(new.scheduled_at at time zone 'Asia/Gaza', 'DD-MM-YYYY HH24:MI'),
    '/visits', 'supervision_visits', new.id);
  return null;
end;
$$;
revoke all on function private.notify_visit_scheduled() from public, anon, authenticated;

create trigger supervision_visits_notify
  after insert on public.supervision_visits
  for each row execute function private.notify_visit_scheduled();

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'admin_alerts_notify' and not tgisinternal) then
    raise exception 'admin_alerts_notify غير موجود';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'supervision_visits_notify' and not tgisinternal) then
    raise exception 'supervision_visits_notify غير موجود';
  end if;
end $$;
```

- [ ] **Step 2: طبّقها** (`apply_migration`، `name: notify_alerts_visits`)، ثم احفظ الملف باسم نسختها الفعليّة كما في Task 1 Step 3.

- [ ] **Step 3: تحقّقٌ بجلسات المستخدمين** (معاملةٌ تُلغى). خذ من البيانات التجريبية: حلقةً ومعلّمَها ومشرفَها الميداني، والمديرَ الإداري:

```sql
begin;
set local role authenticated;
-- المدير الإداري يُصدر تنبيهاً للمعلّم ويجدول زيارةً للمشرف
select set_config('request.jwt.claims', json_build_object('sub', '<admin_id>', 'role', 'authenticated')::text, true);
insert into public.admin_alerts (issuer_id, teacher_id, violation_type, severity, alert_date)
  values ('<admin_id>', '<teacher_id>', 'تأخّر عن الحلقة', 'note', current_date);
insert into public.supervision_visits (halaqa_id, supervisor_id, scheduled_at, status)
  values ('<halaqa_id>', '<supervisor_id>', now() + interval '1 day', 'scheduled');
-- المشرف يجدول زيارةً لنفسه ← لا إشعار له عنها
select set_config('request.jwt.claims', json_build_object('sub', '<supervisor_id>', 'role', 'authenticated')::text, true);
insert into public.supervision_visits (halaqa_id, supervisor_id, scheduled_at, status)
  values ('<halaqa_id>', '<supervisor_id>', now() + interval '2 day', 'scheduled');
select kind, title, body from public.notifications;   -- المتوقّع: سطرٌ واحد visit_scheduled
select set_config('request.jwt.claims', json_build_object('sub', '<teacher_id>', 'role', 'authenticated')::text, true);
select kind, title, body from public.notifications;   -- المتوقّع: سطرٌ واحد alert_issued بـ«تأخّر عن الحلقة»
rollback;
```

إن رفضت السياساتُ إدراجاً بسبب أعمدةٍ إلزامية أخرى، فاقرأ الأعمدة من `information_schema.columns` وأكمل القيم — الغاية أن يمرّ الإدراج بجلسة الدور الحقيقيّ.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_notify_alerts_visits.sql
git commit -m "feat(notifications): إشعارُ التنبيه الإداري للمعلم والزيارة المجدولة للمشرف"
```

---

### Task 3: ثوابت الإشعارات والدوالّ النقيّة للصندوق

**Files:**
- Create: `app/constants/notifications.ts`
- Test: `app/constants/notifications.test.ts`
- Create: `app/composables/useInbox.ts` (الدوالّ النقيّة فقط في هذه المهمّة)
- Test: `app/composables/useInbox.test.ts`

**Interfaces:**
- Produces (`app/constants/notifications.ts`):
  - `NOTIFICATION_KINDS: readonly [...]` (القائمة العشر حرفياً بترتيب Task 1)
  - `type NotificationKind = typeof NOTIFICATION_KINDS[number]`
  - `NOTIFICATION_ICONS: Record<NotificationKind, string>`
  - `notificationIcon(kind: string): string`
  - `INBOX_LIMIT = 30`
- Produces (`app/composables/useInbox.ts`):
  - `interface InboxRow { id: string, kind: string, title: string, body: string | null, link: string | null, read_at: string | null, created_at: string }`
  - `mergeIncoming(rows: InboxRow[], row: InboxRow, limit?: number): InboxRow[]`
  - `markRowsRead(rows: InboxRow[], ids: string[] | null, at: string): InboxRow[]`
  - `relativeTimeAr(iso: string, now: Date): string`

- [ ] **Step 1: اكتب الاختبارات الفاشلة**

`app/constants/notifications.test.ts`:

```ts
/**
 * أنواعُ الإشعارات في الواجهة تطابق قيدَ `kind` في الهجرة — نوعٌ يُضاف هناك ولا يُسمّى هنا
 * يظهر بلا أيقونة.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NOTIFICATION_ICONS, NOTIFICATION_KINDS, notificationIcon } from './notifications'

function migrationKinds(): string[] {
  const dir = join(process.cwd(), 'supabase/migrations')
  const file = readdirSync(dir).find(f => f.endsWith('_notifications.sql'))
  if (!file) throw new Error('هجرة الإشعارات غير موجودة')
  const sql = readFileSync(join(dir, file), 'utf8')
  const block = sql.match(/kind\s+text not null check \(kind in \(([\s\S]*?)\)\)/)
  if (!block?.[1]) throw new Error('قيد kind غير موجود')
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]!)
}

describe('NOTIFICATION_KINDS', () => {
  it('تطابق قيدَ kind في الهجرة حرفاً وترتيباً', () => {
    expect([...NOTIFICATION_KINDS]).toEqual(migrationKinds())
  })

  it('لكلّ نوعٍ أيقونة', () => {
    for (const k of NOTIFICATION_KINDS) expect(NOTIFICATION_ICONS[k]).toMatch(/^i-lucide-/)
  })

  it('النوعُ المجهول يأخذ أيقونة الجرس', () => {
    expect(notificationIcon('unknown_kind')).toBe('i-lucide-bell')
    expect(notificationIcon('alert_issued')).toBe(NOTIFICATION_ICONS.alert_issued)
  })
})
```

`app/composables/useInbox.test.ts`:

```ts
/**
 * دوالّ الصندوق النقيّة: دمجُ الوارد الفوريّ بلا تكرار، والتعليمُ المحلّيّ، والوقتُ النسبيّ.
 */
import { describe, expect, it } from 'vitest'
import { markRowsRead, mergeIncoming, relativeTimeAr, type InboxRow } from './useInbox'

function row(id: string, created_at: string, read_at: string | null = null): InboxRow {
  return { id, kind: 'alert_issued', title: 't', body: null, link: '/alerts', read_at, created_at }
}

describe('mergeIncoming', () => {
  it('يضع الجديدَ أوّلاً بترتيب الوقت النازل', () => {
    const out = mergeIncoming([row('a', '2026-10-19T08:00:00Z')], row('b', '2026-10-19T09:00:00Z'))
    expect(out.map(r => r.id)).toEqual(['b', 'a'])
  })

  it('لا يكرّر صفّاً وصل مرّتين (Realtime ثم الاستطلاع)', () => {
    const r = row('a', '2026-10-19T08:00:00Z')
    expect(mergeIncoming([r], { ...r })).toHaveLength(1)
  })

  it('يقصّ عند الحدّ', () => {
    const rows = [row('a', '2026-10-19T08:00:00Z'), row('b', '2026-10-19T07:00:00Z')]
    expect(mergeIncoming(rows, row('c', '2026-10-19T09:00:00Z'), 2).map(r => r.id)).toEqual(['c', 'a'])
  })
})

describe('markRowsRead', () => {
  const rows = [row('a', '2026-10-19T08:00:00Z'), row('b', '2026-10-19T07:00:00Z', '2026-10-19T07:30:00Z')]

  it('يعلّم المحدَّد وحده ولا يمسّ المقروء سابقاً', () => {
    const out = markRowsRead(rows, ['a'], '2026-10-19T10:00:00Z')
    expect(out[0]!.read_at).toBe('2026-10-19T10:00:00Z')
    expect(out[1]!.read_at).toBe('2026-10-19T07:30:00Z')
  })

  it('null = الكلّ', () => {
    expect(markRowsRead(rows, null, 'X').every(r => r.read_at)).toBe(true)
  })
})

describe('relativeTimeAr', () => {
  const now = new Date('2026-10-19T12:00:00Z')
  it.each([
    ['2026-10-19T11:59:30Z', 'الآن'],
    ['2026-10-19T11:55:00Z', 'منذ 5 د'],
    ['2026-10-19T09:00:00Z', 'منذ 3 س'],
    ['2026-10-17T09:00:00Z', '17-10']
  ])('%s ← %s', (iso, expected) => {
    expect(relativeTimeAr(iso, now)).toBe(expected)
  })
})
```

- [ ] **Step 2: شغّلها لتفشل**: `pnpm vitest run app/constants/notifications.test.ts app/composables/useInbox.test.ts` — المتوقّع: فشلٌ لأنّ الملفّين غير موجودين.

- [ ] **Step 3: اكتب الثوابت** `app/constants/notifications.ts`:

```ts
/**
 * أنواعُ الإشعارات وأيقوناتُها — القائمةُ تطابق قيدَ `kind` في هجرة `*_notifications.sql`
 * (يحرسها اختبار). الإشعارُ خبرٌ عن أمرٍ وقع؛ طوابيرُ العمل في `useNotifications`.
 */
export const NOTIFICATION_KINDS = [
  'report_submitted',
  'report_approved',
  'report_returned',
  'alert_issued',
  'visit_scheduled',
  'exam_nominated',
  'exam_graded',
  'transport_paid',
  'impersonation_started',
  'impersonation_write'
] as const

export type NotificationKind = typeof NOTIFICATION_KINDS[number]

export const NOTIFICATION_ICONS: Record<NotificationKind, string> = {
  report_submitted: 'i-lucide-file-up',
  report_approved: 'i-lucide-file-check',
  report_returned: 'i-lucide-file-x',
  alert_issued: 'i-lucide-triangle-alert',
  visit_scheduled: 'i-lucide-calendar-clock',
  exam_nominated: 'i-lucide-clipboard-list',
  exam_graded: 'i-lucide-clipboard-check',
  transport_paid: 'i-lucide-wallet',
  impersonation_started: 'i-lucide-eye',
  impersonation_write: 'i-lucide-pencil'
}

/** آخرُ ما يُعرض في لوحة الجرس. */
export const INBOX_LIMIT = 30

export function notificationIcon(kind: string): string {
  return (NOTIFICATION_ICONS as Record<string, string>)[kind] ?? 'i-lucide-bell'
}
```

- [ ] **Step 4: اكتب الدوالّ النقيّة** في `app/composables/useInbox.ts` (الـcomposable نفسه في Task 4):

```ts
/**
 * صندوقُ الإشعارات المخزّنة — قراءةُ آخر 30 وعدُّ غير المقروء والاشتراكُ الفوريّ والتعليم.
 * الدوالّ النقيّة أعلاه مُصدَّرةٌ ومختبَرة في useInbox.test.ts.
 */
import { INBOX_LIMIT } from '~/constants/notifications'

export interface InboxRow {
  id: string
  kind: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

/** يدمج صفّاً واصلاً (فوريّاً أو باستطلاع) بلا تكرار، بترتيب الوقت النازل، مقصوصاً عند الحدّ. */
export function mergeIncoming(rows: InboxRow[], row: InboxRow, limit = INBOX_LIMIT): InboxRow[] {
  return [row, ...rows.filter(r => r.id !== row.id)]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
}

/** يعلّم المحدَّد (أو الكلّ إن كانت `null`) مقروءاً محلّياً، ولا يغيّر وقتَ ما قُرئ قبلُ. */
export function markRowsRead(rows: InboxRow[], ids: string[] | null, at: string): InboxRow[] {
  return rows.map(r => (r.read_at || (ids && !ids.includes(r.id))) ? r : { ...r, read_at: at })
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** «الآن» · «منذ N د» · «منذ N س» · وبعد يومٍ: اليوم-الشهر بالأرقام. */
export function relativeTimeAr(iso: string, now: Date): string {
  const then = new Date(iso)
  const diff = now.getTime() - then.getTime()
  if (diff < MINUTE) return 'الآن'
  if (diff < HOUR) return `منذ ${Math.floor(diff / MINUTE)} د`
  if (diff < DAY) return `منذ ${Math.floor(diff / HOUR)} س`
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Gaza', day: '2-digit', month: '2-digit' })
    .formatToParts(then)
  const day = parts.find(p => p.type === 'day')!.value
  const month = parts.find(p => p.type === 'month')!.value
  return `${day}-${month}`
}
```

- [ ] **Step 5: شغّل الاختبارات لتنجح**: الأمر نفسه — المتوقّع: كلّها PASS.

- [ ] **Step 6: Commit**

```bash
git add app/constants/notifications.ts app/constants/notifications.test.ts app/composables/useInbox.ts app/composables/useInbox.test.ts
git commit -m "feat(notifications): أنواعُ الإشعارات وأيقوناتُها ودوالُّ الصندوق النقيّة"
```

---

### Task 4: الـcomposable `useInbox` والجرس بقسميه

**Files:**
- Modify: `app/composables/useInbox.ts` (يُضاف `useInbox()` أسفل الدوالّ النقيّة)
- Create: `app/components/NotificationsBell.vue`
- Modify: `app/layouts/dashboard.vue:30` (حذف `useNotifications` من التخطيط)، و`:261-310` تقريباً (كتلة `<UPopover>` الجرس كلّها ← `<NotificationsBell />`)، وأنماط `.bell-wrap` `.bell-badge` `.notif*` (تُنقل إلى المكوّن).

**Interfaces:**
- Consumes: `InboxRow`, `mergeIncoming`, `markRowsRead`, `relativeTimeAr` (Task 3)؛ `notificationIcon`, `INBOX_LIMIT` (Task 3)؛ `useNotifications()` القائم ← `{ count, items, refresh }` و`NotifItem = { id, label, sub?, to, icon }`؛ `mark_notifications_read` (Task 1).
- Produces: `useInbox(): { rows: Ref<InboxRow[]>, unread: Ref<number>, load: () => Promise<void>, markRead: (ids: string[] | null) => Promise<void> }`؛ المكوّن `<NotificationsBell />` بلا خصائص.

- [ ] **Step 1: أضف `useInbox()`** أسفل `app/composables/useInbox.ts`:

```ts
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'

export function useInbox() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const rows = ref<InboxRow[]>([])
  const unread = ref(0)
  const { handle } = useErrorHandler()

  async function load() {
    const uid = user.value?.sub
    if (!uid) {
      rows.value = []
      unread.value = 0
      return
    }
    const [list, count] = await Promise.all([
      supabase.from('notifications')
        .select('id, kind, title, body, link, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(INBOX_LIMIT),
      supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
    ])
    if (list.error) return handle(list.error)
    rows.value = list.data ?? []
    unread.value = count.count ?? 0
  }

  async function markRead(ids: string[] | null) {
    const { data, error } = await supabase.rpc('mark_notifications_read', { p_ids: ids ?? undefined })
    if (error) return handle(error)
    rows.value = markRowsRead(rows.value, ids, new Date().toISOString())
    unread.value = Math.max(0, unread.value - (data ?? 0))
  }

  let channel: RealtimeChannel | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  function subscribe(uid: string) {
    channel?.unsubscribe()
    channel = supabase.channel(`inbox:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as InboxRow
          rows.value = mergeIncoming(rows.value, row)
          if (!row.read_at) unread.value += 1
        })
      .subscribe()
  }

  function onVisible() {
    if (!document.hidden) load()
  }

  onMounted(() => {
    load()
    const uid = user.value?.sub
    if (uid) subscribe(uid)
    // احتياطٌ إن انقطع الاتصال الفوريّ — ويتوقّف والتبويب مخفيّ
    timer = setInterval(() => {
      if (!document.hidden) load()
    }, 60000)
    document.addEventListener('visibilitychange', onVisible)
  })
  onUnmounted(() => {
    channel?.unsubscribe()
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })

  return { rows, unread, load, markRead }
}
```

ملاحظات مُتحقَّقٌ منها: `useErrorHandler()` يُرجع `{ handle, translateError }` (اقرأ توقيع `handle` في `app/composables/useErrorHandler.ts` قبل الاستعمال)، ومعرّفُ المستخدم `user.value?.sub` (كما في `useProfile.ts:51`). وإن كان `rpc` يتطلّب `p_ids` صراحةً في الأنواع المولّدة فمرّر `null` بالتحويل المناسب.

- [ ] **Step 2: اكتب المكوّن** `app/components/NotificationsBell.vue`:

```vue
<script setup lang="ts">
/**
 * جرسُ الشريط العلوي بقسمين: «بانتظارك» (طوابيرُ محسوبة من useNotifications)
 * و«الإشعارات» (أخبارٌ مخزّنة من useInbox). العدّاد = غيرُ المقروء + ما ينتظر.
 * الضغط على خبرٍ يعلّمه مقروءاً وينتقل إلى رابطه.
 */
import { notificationIcon } from '~/constants/notifications'
import { relativeTimeAr, type InboxRow } from '~/composables/useInbox'

const { count: queueCount, items: queueItems } = useNotifications()
const { rows, unread, markRead } = useInbox()

const badge = computed(() => queueCount.value + unread.value)
const now = ref(new Date())

async function openRow(row: InboxRow) {
  if (!row.read_at) await markRead([row.id])
  if (row.link) await navigateTo(row.link)
}
</script>

<template>
  <UPopover
    :ui="{ content: 'w-96 max-w-[94vw]' }"
    @update:open="(o: boolean) => { if (o) now = new Date() }"
  >
    <div class="bell-wrap">
      <button
        class="top-icon"
        aria-label="الإشعارات"
      >
        <UIcon
          name="i-lucide-bell"
          class="size-5"
        />
      </button>
      <span
        v-if="badge > 0"
        class="bell-badge"
      >{{ badge > 99 ? '99+' : badge }}</span>
    </div>
    <template #content>
      <div class="notif">
        <template v-if="queueItems.length">
          <div class="notif-head">
            بانتظارك
          </div>
          <NuxtLink
            v-for="n in queueItems"
            :key="n.id"
            :to="n.to"
            class="notif-item"
          >
            <UIcon
              :name="n.icon"
              class="size-[18px]"
            />
            <div class="notif-text">
              <div class="notif-label">
                {{ n.label }}
              </div>
              <div
                v-if="n.sub"
                class="notif-sub"
              >
                {{ n.sub }}
              </div>
            </div>
          </NuxtLink>
        </template>

        <div class="notif-head notif-head-row">
          <span>الإشعارات</span>
          <button
            v-if="unread > 0"
            class="notif-markall"
            @click="markRead(null)"
          >
            تعليم الكل مقروءاً
          </button>
        </div>
        <div
          v-if="!rows.length"
          class="notif-empty"
        >
          <UIcon
            name="i-lucide-bell-off"
            class="size-6"
          />
          لا إشعارات بعد
        </div>
        <div class="notif-list">
          <button
            v-for="r in rows"
            :key="r.id"
            class="notif-item"
            :class="{ 'is-unread': !r.read_at }"
            @click="openRow(r)"
          >
            <UIcon
              :name="notificationIcon(r.kind)"
              class="size-[18px]"
            />
            <div class="notif-text">
              <div class="notif-label">
                {{ r.title }}
              </div>
              <div
                v-if="r.body"
                class="notif-sub"
              >
                {{ r.body }}
              </div>
              <div class="notif-time">
                {{ relativeTimeAr(r.created_at, now) }}
              </div>
            </div>
            <span
              v-if="!r.read_at"
              class="notif-dot"
              aria-label="غير مقروء"
            />
          </button>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
.bell-wrap { position: relative; display: inline-flex; }
.bell-badge { position: absolute; top: -7px; inset-inline-end: -7px; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--err); color: #fff; font-size: 13px; font-weight: 800; line-height: 22px; text-align: center; box-shadow: 0 0 0 2px var(--surface); font-variant-numeric: tabular-nums; pointer-events: none; }
.notif { padding: 6px; }
.notif-head { font-size: 14px; font-weight: 700; color: var(--ink); padding: 8px 10px 10px; border-bottom: 1px solid var(--line); }
.notif-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.notif-markall { font-size: 12.5px; font-weight: 600; color: var(--ink-2); min-height: 44px; padding: 0 6px; }
.notif-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; color: var(--ink-3); font-size: 14px; }
.notif-list { max-height: 60vh; overflow-y: auto; }
.notif-item { display: flex; width: 100%; text-align: start; align-items: flex-start; gap: 10px; padding: 11px 10px; border-radius: 11px; color: var(--ink-2); transition: background .15s; }
.notif-item:hover { background: var(--surface-2); }
.notif-item.is-unread { background: var(--surface-2); }
.notif-text { min-width: 0; flex: 1; }
.notif-label { font-size: 14px; font-weight: 600; color: var(--ink); }
.notif-sub { font-size: 12.5px; color: var(--ink-3); margin-top: 3px; }
.notif-time { font-size: 12px; color: var(--ink-3); margin-top: 4px; font-variant-numeric: tabular-nums; }
.notif-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--err); margin-top: 6px; flex: none; }
</style>
```

إن كان `#fff` في `.bell-badge` مخالفاً لقاعدة الألوان، فهو منقولٌ حرفياً من التخطيط القائم — أبقه كما هو (لا توسيع نطاق).

- [ ] **Step 3: عدّل التخطيط** `app/layouts/dashboard.vue`:
  1. احذف السطر `const { count: notifCount, items: notifItems } = useNotifications()` (السطر 30 تقريباً) بعد التأكّد بـ`grep -n "notifCount\|notifItems" app/layouts/dashboard.vue` أنّه لا استعمال آخر.
  2. استبدل كتلة `<UPopover …> … </UPopover>` الخاصّة بالجرس داخل `.top-end` بـ`<NotificationsBell />`.
  3. احذف من `<style>` الأسطر `.bell-wrap` `.bell-badge` `.notif` `.notif-head` `.notif-empty` `.notif-item` `.notif-item:hover` `.notif-text` `.notif-label` `.notif-sub` (انتقلت إلى المكوّن) — بعد `grep -rn "notif-\|bell-" app` للتأكّد أنّها لا تُستعمل في غيره.

- [ ] **Step 4: الفحوص**: `pnpm typecheck && pnpm lint && pnpm test` — المتوقّع: كلُّها خضراء.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useInbox.ts app/components/NotificationsBell.vue app/layouts/dashboard.vue
git commit -m "feat(notifications): الجرس بقسمين — بانتظارك والإشعارات — مع الوصول الفوريّ وتعليم المقروء"
```

---

### Task 5: التحقّق في المتصفّح والتوثيق

**Files:**
- Modify: `docs/DATABASE.md`, `docs/FEATURES.md`, `docs/PAGES.md`, `docs/ROADMAP.md`

- [ ] **Step 1: شغّل خادم التطوير** بـ`preview_start` (الإعداد في `.claude/launch.json` بالمستودع أو في `~/Developer/.claude/launch.json`). **لا تبنِ (`nuxt build`) والخادم حيّ** — يتشاركان `.nuxt`.

- [ ] **Step 2: جرّب بحسابين** من `torjoman/.test-accounts.local` (لا تكرّر كلماتهما في المحادثة): ادخل بحساب المعلّم في تبويب، وبالمدير الإداري في تبويبٍ آخر (أو أنشئ التنبيه بـ`execute_sql` بجلسة المدير). أصدر تنبيهاً إدارياً للمعلّم ← يجب أن يظهر العدّاد الأحمر عند المعلّم **بلا تحديث الصفحة** (Realtime)، وفي اللوحة «تنبيهٌ إداريّ جديد» بنقطةٍ حمراء. اضغطه ← ينتقل إلى `/alerts` وينقص العدّاد. خذ لقطة شاشة للّوحة.

- [ ] **Step 3: نظّف ما أنشأته التجربة** على الإنتاج (التنبيه التجريبيّ وإشعاره) بحذفٍ دقيقٍ بالمعرّف، بعد عرضه على المستخدم وإذنه.

- [ ] **Step 4: حدّث التوثيق**:
  - `docs/DATABASE.md`: قسمٌ لجدول `notifications` (الأعمدة، القيود، الفهارس، السياسة الواحدة، المنح) ومخطّط `private` ودوالّه (`private.notify`، `private.notify_alert_issued`، `private.notify_visit_scheduled`) و`public.mark_notifications_read`، ومُشغّلا `admin_alerts_notify` و`supervision_visits_notify`.
  - `docs/FEATURES.md`: سطرٌ في Changelog بتاريخ 2026-10-19: «الإشعارات داخل المنصّة (جدولٌ + جرسٌ بقسمين + Realtime) وأوّلُ مُنتِجَين؛ إشعار الهاتف مؤجَّل».
  - `docs/PAGES.md`: الشريط العلوي — الجرس بقسمين.
  - `docs/ROADMAP.md`: البند 34 «مركز الإشعارات الدائم» ← ✅ (داخل المنصّة، 2026-10-19)، وسطرٌ في الإصدار الثاني يشير إلى المواصفة.

- [ ] **Step 5: Commit**

```bash
git add docs/DATABASE.md docs/FEATURES.md docs/PAGES.md docs/ROADMAP.md
git commit -m "docs(notifications): توثيقُ عمود الإشعارات والجرس"
```

- [ ] **Step 6: اعرض على المستخدم** ما أُنجز ولقطةَ الجرس، واطلب إذنه لدمج الفرع في `dev` ثم `main` — **ولا تدمج قبل الإذن**.
