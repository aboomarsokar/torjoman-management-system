# كشف المواصلات (الجزء ٤) — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** يُدخل المشرفُ الميداني والمختبِر رحلاتهما الشهرية ويرى كلٌّ رحلاتِه وحده، ويرى المديرُ الإداريّ الجميعَ مجمَّعين بالموظف فيعلّم كلَّ رحلةٍ مسدَّدةً أو لا، ويسدّد الكلَّ بضغطة، ويصل صاحبَ الرحلات إشعارٌ واحدٌ بكلّ تسديد.

**Architecture:** جدولٌ جديد `transport_trips` بـRLS وحارسٍ يمنع غيرَ المدير الإداري من لمس حالة التسديد ومن تعديل المسدَّد، ودالّةُ `set_transport_paid` (security definer) للتسديد الجماعيّ وإشعاره. الواجهة صفحةٌ واحدة `/transport` بعرضين: «رحلاتي» لصاحب الرحلات، و«كلّ الرحلات» للمدير الإداري (ومشرف المشروع قراءةً). المنطقُ النقيّ في `app/utils/transport.ts`، والوصولُ للقاعدة في `useTransport`.

**Tech Stack:** Nuxt 4 · @nuxt/ui v4 · TypeScript strict · Supabase (Postgres RLS، `private`، `security definer`) · Vitest · pnpm.

**المواصفة:** `docs/superpowers/specs/2026-10-19-v2-batch2-design.md` — «الجزء ٤ — كشف المواصلات» و«عقدُ العمود الفقريّ» (د) و(هـ).

## Global Constraints

- **مكان العمل:** شجرة العمل `/Users/aboomar/Developer/torjoman-v2b2` على `feature/v2-batch2` وحدها؛ لا يُلمس `/Users/aboomar/Developer/torjoman` (جلسةٌ أخرى). لا دفع ولا دمج إلا بإذن المستخدم. خادم التطوير حيّ على 3030 من هذه الشجرة: **لا `nuxt build` ولا `pnpm typecheck`** — بل `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` و`-p .nuxt/tsconfig.server.json` للقراءة (الخطأ القائم سلفاً: `app/pages/students/index.vue` ~235 وحده).
- **القرار:** المواصلاتُ **مستقلّةٌ عن الملفّ المالي** (لا تمسّه)، والرحلةُ تُعدَّل وتُحذف **ما دامت غيرَ مسدَّدة**؛ والمدير الإداريّ يعدّل دائماً.
- **الأدوار:** الإدخال للمشرف الميداني `field_supervisor` والمختبِر `examiner` (قائمةٌ واحدة في القاعدة `private.can_log_transport()` وفي الواجهة `TRANSPORT_LOGGER_ROLES`)؛ القراءة: صاحبُها، والمدير الإداري `admin_manager`، ومشرف المشروع `project_supervisor` (بلا أزرار).
- **الإشعار:** `transport_paid` موجودٌ سلفاً في قيد `notifications_kind_check` وفي `private.notify` وفي `NOTIFICATION_KINDS` — **لا يُعاد تعريف القيد**. خبرٌ واحدٌ لكلّ صاحب رحلاتٍ في عملية التسديد بالعدد والمبلغ والشهر؛ إلغاءُ التسديد لا يُشعِر. الرابط `/transport?y=YYYY&m=M`.
- **القاعدة:** كلُّ جدولٍ/دالّةٍ جديدة في `public` يُسحب منه المنحُ الافتراضيّ (`revoke all … from public, anon, authenticated`) ثم يُمنح صراحةً؛ دوالُّ السياسات `security definer` + `set search_path = ''` + منحٌ لـ`authenticated` **و`service_role`**؛ كلُّ هجرةٍ تفحص نفسها في كتلة `do`؛ **اسمُ الملف = نسختُه الفعليّة** بعد `apply_migration` (اقرأها من `list_migrations`)؛ التحقّقُ السلوكيّ بأدوار حقيقية في كتلة `do` تنتهي بـ`raise exception 'rollback-ok: …'` قبل التطبيق.
- **الأنواع** تُولَّد بعد الهجرة: `generate_typescript_types` (MCP) ← ملفٌّ مؤقّت في المسوّدة ← فرقٌ **إضافيٌّ فقط** ← يُستبدل `app/types/database.types.ts`. لا كتابةَ يدوية للأنواع.
- كلُّ نصٍّ عربيّ، **الشهور بالأرقام** (`10-2026`، والتاريخ `DD-MM-YYYY` بـ`formatDay`)، RTL، لمس ≥ 44px، لا ألوان مباشرة (توكنز `main.css`)، JSDoc عربيّ أعلى كلّ ملفّ، ملفات ≤ 300 سطر، `cursor: pointer` قائمٌ عامّاً.
- **التاريخ بتوقيت غزة:** `gazaToday()` من `app/utils/reportWindow.ts`؛ لا `toISOString().slice(0,10)`.
- **الجوال:** الجداول بطاقاتٌ تحت 720px عبر `UiDataTable` بفتحة `#card` و`UiCardRow` (كما في `app/components/exams/GradeQueue.vue`)؛ لا تمرير أفقيّ على 375px.
- **الأخطاء:** `useErrorHandler().handle(err)` برسالةٍ عربية؛ تحديثٌ/حذفٌ لم يمسّ صفّاً (تصفية RLS) **ليس نجاحاً** — `.select('id')` والتحقّق من الطول.
- `pnpm lint && pnpm test` خضراء قبل كلّ إيداع؛ رسائل Conventional عربية تنتهي بسطرٍ فارغ ثم `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## خريطة الملفات

| الملف | المسؤولية |
|---|---|
| `supabase/migrations/<v>_transport_trips.sql` | الجدول، `private.can_log_transport()`، RLS، الحارس، `public.set_transport_paid()`، الفحص الذاتيّ |
| `app/constants/transport.ts` (+test) | `TRANSPORT_LOGGER_ROLES`، حدود الحقول |
| `app/utils/transport.ts` (+test) | الترقيم في الشهر، المجاميع، التجميع بالموظف، التحقّق من النموذج، نصّ نافذة «تسديد الكل»، حدود الشهر |
| `app/composables/useTransport.ts` | الجلب والحفظ والحذف والتسديد (Supabase) |
| `app/pages/transport/index.vue` | الصفحة: الشهر + العرض بحسب الدور |
| `app/components/transport/MyTrips.vue` | «رحلاتي»: جدول/بطاقات، المجموع، إضافة/تعديل/حذف غير المسدَّد |
| `app/components/transport/TripModal.vue` | نموذج الرحلة (إضافة/تعديل) |
| `app/components/transport/AllTrips.vue` | «كلّ الرحلات»: تصفيةٌ بالموظف، مجموعاتٌ بمجموعها، مفتاحُ التسديد، «تسديد الكل» |
| `app/layouts/dashboard.vue` | بندُ «كشف المواصلات» في القائمة |
| `docs/*` + `CLAUDE.md` | التوثيق وصفّ المصفوفة |

---

### Task 1: الجدول والحارس ودالّة التسديد

**Files:**
- Create: `supabase/migrations/<applied-version>_transport_trips.sql`
- Modify: `app/types/database.types.ts` (مولَّد)

**Interfaces:**
- Produces: جدول `public.transport_trips` (`id uuid`، `profile_id uuid`، `trip_date date`، `description text`، `amount numeric(10,2)`، `notes text|null`، `paid boolean`، `paid_at timestamptz|null`، `paid_by uuid|null`، `created_at`، `updated_at`)؛ RPC `public.set_transport_paid(p_ids uuid[], p_paid boolean) returns integer` (عددُ الصفوف التي تغيّرت).

- [ ] **Step 1: اكتب الهجرة في ملفٍّ مؤقّت `supabase/migrations/transport_trips.sql`**

```sql
-- ============================================================
-- كشف المواصلات (الجزء ٤): رحلاتُ المشرف الميداني والمختبِر، وتسديدُها بيد المدير الإداري.
-- مستقلٌّ عن الملفّ المالي (قرار المستخدم 2026-10-19). الإشعار transport_paid قائمٌ في القيد سلفاً.
-- ============================================================

-- مَن يُدخل رحلات (إضافةُ دورٍ سطرٌ واحد هنا وفي TRANSPORT_LOGGER_ROLES)
create or replace function private.can_log_transport()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_user_role()::text in ('field_supervisor', 'examiner'), false);
$$;
revoke all on function private.can_log_transport() from public, anon, authenticated;
grant execute on function private.can_log_transport() to authenticated, service_role;

create table public.transport_trips (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trip_date date not null,
  description text not null check (btrim(description) <> '' and char_length(description) <= 200),
  amount numeric(10, 2) not null check (amount > 0 and amount <= 10000),
  notes text check (notes is null or char_length(notes) <= 500),
  paid boolean not null default false,
  paid_at timestamptz,
  paid_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_paid_stamp check ((paid and paid_at is not null) or (not paid and paid_at is null and paid_by is null))
);
create index transport_trips_profile_date on public.transport_trips (profile_id, trip_date);
create index transport_trips_date on public.transport_trips (trip_date);

create trigger trg_transport_trips_updated_at before update on public.transport_trips
  for each row execute function public.set_updated_at();

alter table public.transport_trips enable row level security;
revoke all on public.transport_trips from public, anon, authenticated;
grant select, insert, update, delete on public.transport_trips to authenticated;

-- قراءة: صاحبُها، والمدير الإداري، ومشرف المشروع
create policy transport_select on public.transport_trips for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin_manager() or public.is_project_supervisor());

-- إدراج: من يُدخل رحلاتٍ لنفسه، غيرَ مسدَّدة؛ والمدير الإداري لأيّ موظفٍ يُدخل رحلات
create policy transport_insert on public.transport_trips for insert to authenticated
  with check (
    (private.can_log_transport() and profile_id = (select auth.uid()) and not paid)
    or public.is_admin_manager()
  );

-- تعديل/حذف: صاحبُها ما دامت غيرَ مسدَّدة؛ والمدير الإداري دائماً
create policy transport_update on public.transport_trips for update to authenticated
  using ((profile_id = (select auth.uid()) and not paid) or public.is_admin_manager())
  with check ((profile_id = (select auth.uid()) and not paid) or public.is_admin_manager());
create policy transport_delete on public.transport_trips for delete to authenticated
  using ((profile_id = (select auth.uid()) and not paid) or public.is_admin_manager());

-- حارس: غيرُ المدير الإداري لا يلمس التسديد ولا صاحبَ الرحلة؛ والتاريخُ لا يسبق اليوم بتوقيت غزة؛
-- وصاحبُ الرحلة ممّن يُدخلون رحلات (يحمي إدراجَ المدير الإداري لغيرهم).
create or replace function private.guard_transport_trip()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.trip_date > (now() at time zone 'Asia/Gaza')::date then
    raise exception 'لا تُسجَّل رحلةٌ بتاريخٍ لم يأتِ بعد.' using errcode = '23514';
  end if;
  if not public.is_admin_manager() then
    if tg_op = 'INSERT' and (new.paid or new.paid_at is not null or new.paid_by is not null) then
      raise exception 'التسديدُ للمدير الإداري وحده.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
         new.paid is distinct from old.paid or new.paid_at is distinct from old.paid_at
         or new.paid_by is distinct from old.paid_by or new.profile_id is distinct from old.profile_id) then
      raise exception 'التسديدُ وصاحبُ الرحلة للمدير الإداري وحده.' using errcode = '42501';
    end if;
  end if;
  if (tg_op = 'INSERT' or new.profile_id is distinct from old.profile_id) and not exists (
       select 1 from public.profiles p
       where p.id = new.profile_id and p.role::text in ('field_supervisor', 'examiner')) then
    raise exception 'صاحبُ الرحلة ليس مشرفاً ميدانياً ولا مختبِراً.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_transport_trip() from public, anon, authenticated;
create trigger transport_trips_guard before insert or update on public.transport_trips
  for each row execute function private.guard_transport_trip();

-- التسديد الجماعيّ: للمدير الإداري وحده؛ يضبط الحالة ومَن/متى، ويُشعر كلَّ صاحب رحلاتٍ بخبرٍ واحد
-- (العدد والمبلغ والشهر) عند التسديد فقط. يردّ عددَ الرحلات التي تغيّرت حالتُها.
create or replace function public.set_transport_paid(p_ids uuid[], p_paid boolean)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
  r record;
begin
  if not public.is_admin_manager() then
    raise exception 'التسديدُ للمدير الإداري وحده.' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 or p_paid is null then
    return 0;
  end if;

  create temporary table if not exists _transport_changed (id uuid, profile_id uuid, trip_date date, amount numeric) on commit drop;
  truncate _transport_changed;

  with changed as (
    update public.transport_trips t
       set paid = p_paid,
           paid_at = case when p_paid then now() else null end,
           paid_by = case when p_paid then (select auth.uid()) else null end
     where t.id = any (p_ids) and t.paid is distinct from p_paid
    returning t.id, t.profile_id, t.trip_date, t.amount
  )
  insert into _transport_changed select * from changed;
  get diagnostics v_count = row_count;

  if p_paid then
    for r in
      select c.profile_id,
             count(*) as n,
             sum(c.amount) as total,
             string_agg(distinct to_char(c.trip_date, 'MM-YYYY'), '، ' order by to_char(c.trip_date, 'MM-YYYY')) as months,
             min(c.trip_date) as first_day
        from _transport_changed c
       group by c.profile_id
    loop
      perform private.notify(
        r.profile_id, 'transport_paid', 'سُدّدت رحلاتُك',
        'عدد الرحلات: ' || r.n || ' · المبلغ: ' || to_char(r.total, 'FM999990.00') || ' ₪ · الشهر: ' || r.months,
        '/transport?y=' || extract(year from r.first_day)::int || '&m=' || extract(month from r.first_day)::int,
        'transport_trips', null);
    end loop;
  end if;
  return v_count;
end;
$$;
revoke all on function public.set_transport_paid(uuid[], boolean) from public, anon, authenticated;
grant execute on function public.set_transport_paid(uuid[], boolean) to authenticated;

-- فحصٌ ذاتيّ
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.transport_trips'::regclass) then
    raise exception 'RLS غير مفعّل على transport_trips';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'transport_trips') <> 4 then
    raise exception 'سياساتُ transport_trips ليست أربعاً';
  end if;
  if has_table_privilege('anon', 'public.transport_trips', 'select') then
    raise exception 'anon يقرأ transport_trips';
  end if;
  if not has_function_privilege('authenticated', 'private.can_log_transport()', 'execute')
     or not has_function_privilege('service_role', 'private.can_log_transport()', 'execute') then
    raise exception 'can_log_transport: المنحُ ناقص';
  end if;
  if has_function_privilege('anon', 'public.set_transport_paid(uuid[], boolean)', 'execute')
     or not has_function_privilege('authenticated', 'public.set_transport_paid(uuid[], boolean)', 'execute') then
    raise exception 'set_transport_paid: المنحُ خاطئ';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'transport_trips_guard' and not tgisinternal) then
    raise exception 'حارسُ الرحلات مفقود';
  end if;
end $$;
```

> **ملاحظة على `source_id`:** الخبرُ يجمع عدّةَ رحلات، فلا رحلةَ واحدةً مصدرُه — `source_id` فارغ. إن كان `private.notify` أو قيدُ الجدول يرفض الفارغ فاقرأ تعريفهما (هجرة `20261019084801_notify_hardening.sql`) واستعمل `r.profile_id` مصدراً بدله.

- [ ] **Step 2: تحقّقٌ سلوكيّ قبل التطبيق (معاملةٌ تُلغى)** — عبر `execute_sql` بالمشروع `qwtqfkayupzijcoguqrf`: نفّذ نصّ الهجرة كاملاً داخل كتلة `do` واحدة (DDL في PL/pgSQL عبر `execute`)، أو — الأبسط — طبّق الكتل في `begin; … rollback;` إن كانت الأداة تُبقي المعاملة؛ وإلا فاكتب كتلة `do` تُنشئ الجدول والدوالّ ثم تُجري هذه الحالات بأدوارٍ حقيقية (`set local role authenticated; perform set_config('request.jwt.claims', json_build_object('sub', <id>, 'role','authenticated')::text, true);`) وتنتهي بـ`raise exception 'rollback-ok: …'`:
  1. مشرفٌ ميدانيّ تجريبيّ (اسمه يبدأ «تجريبي — مشرف ميداني») يُدرج رحلةً لنفسه ← تنجح؛ ويقرأ رحلتَه وحدها.
  2. المختبِر التجريبيّ لا يرى رحلةَ المشرف (0 صفوف).
  3. المشرف يحاول `paid = true` في الإدراج أو التعديل ← `42501`.
  4. المدير الإداري (الحساب الحقيقيّ `1001` — **قراءةُ معرّفه فقط، لا كتابةَ باسمه خارج المعاملة الملغاة**) يستدعي `set_transport_paid(array[id], true)` ← يردّ 1، ويُنشأ إشعارٌ `transport_paid` واحدٌ للمشرف.
  5. المشرف يعدّل الرحلةَ المسدَّدة أو يحذفها ← 0 صفوف (RLS).
  6. معلمٌ تجريبيّ يُدرج رحلة ← رفض.
  7. تاريخٌ غداً ← `23514`.
  اكتب الناتجَ في التقرير.

- [ ] **Step 3: طبّق** بـ`apply_migration` (الاسم `transport_trips`)، ثم اقرأ النسخة من `list_migrations` وأعد تسمية الملف `supabase/migrations/<version>_transport_trips.sql`.

- [ ] **Step 4: ولّد الأنواع** — `generate_typescript_types` ← استخرج `types` بـ`python3 -I -c` إلى المسوّدة ← `diff` مع `app/types/database.types.ts` يُظهر إضافاتٍ فقط (`transport_trips`، `set_transport_paid`) ← استبدل.

- [ ] **Step 5:** `pnpm lint && pnpm test`؛ vue-tsc (app + server) بلا جديد.

- [ ] **Step 6: Commit** `feat(db): رحلاتُ المواصلات وتسديدُها بيد المدير الإداري`

---

### Task 2: الثوابت والمنطق النقيّ

**Files:**
- Create: `app/constants/transport.ts`, `app/constants/transport.test.ts`, `app/utils/transport.ts`, `app/utils/transport.test.ts`

**Interfaces:**
- Produces:
  - `TRANSPORT_LOGGER_ROLES: readonly ['field_supervisor', 'examiner']`، `TRANSPORT_DESCRIPTION_MAX = 200`، `TRANSPORT_NOTES_MAX = 500`، `TRANSPORT_AMOUNT_MAX = 10000`
  - `type Trip = { id: string, profile_id: string, trip_date: string, description: string, amount: number, notes: string | null, paid: boolean, paid_at: string | null, created_at: string }`
  - `monthBounds(year: number, month: number): { from: string, to: string }` — أوّلُ يومٍ والأوّلُ من الشهر التالي (`to` حصريّ)
  - `numberTrips(trips: Trip[]): (Trip & { serial: number })[]` — بالتاريخ ثم `created_at` تصاعدياً، الرقم من 1
  - `sumAmount(trips: Pick<Trip, 'amount'>[]): number` — مقرّبٌ لخانتين
  - `formatAmount(n: number): string` — `'125.50 ₪'`، والصحيح بلا كسور `'120 ₪'`
  - `groupByEmployee(trips: Trip[], names: Record<string, string>): { profileId: string, name: string, trips: (Trip & { serial: number })[], total: number, unpaidTotal: number }[]` — مرتّبةٌ بالاسم (`localeCompare('ar')`)
  - `unpaid(trips: Trip[]): Trip[]`
  - `payAllText(trips: Trip[]): string` — «تسديد 7 رحلات بمبلغ 315 ₪؟» (مفرد/مثنّى/جمع: «رحلة واحدة»، «رحلتين»، «3 رحلات»، «11 رحلة»)
  - `validateTrip(input: { trip_date: string, description: string, amount: string, notes: string }, today: string): { name: string, message: string }[]`
  - `canEditTrip(trip: Pick<Trip, 'paid'>, opts: { isOwner: boolean, isAdmin: boolean }): boolean`

- [ ] **Step 1: الاختبارات الفاشلة** — `app/utils/transport.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canEditTrip, formatAmount, groupByEmployee, monthBounds, numberTrips, payAllText, sumAmount, unpaid, validateTrip } from './transport'
import type { Trip } from './transport'

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1', profile_id: 'p1', trip_date: '2026-10-05', description: 'زيارة حلقة', amount: 20,
  notes: null, paid: false, paid_at: null, created_at: '2026-10-05T08:00:00Z', ...over
})

describe('monthBounds', () => {
  it('الشهر 10 ← من 1 إلى أوّل 11 حصرياً', () => {
    expect(monthBounds(2026, 10)).toEqual({ from: '2026-10-01', to: '2026-11-01' })
  })
  it('الشهر 12 يعبر السنة', () => {
    expect(monthBounds(2026, 12)).toEqual({ from: '2026-12-01', to: '2027-01-01' })
  })
})

describe('numberTrips', () => {
  it('يرقّم بالتاريخ ثم وقت الإنشاء', () => {
    const rows = numberTrips([
      trip({ id: 'b', trip_date: '2026-10-07' }),
      trip({ id: 'a2', trip_date: '2026-10-03', created_at: '2026-10-03T10:00:00Z' }),
      trip({ id: 'a1', trip_date: '2026-10-03', created_at: '2026-10-03T09:00:00Z' })
    ])
    expect(rows.map(r => [r.id, r.serial])).toEqual([['a1', 1], ['a2', 2], ['b', 3]])
  })
})

describe('sumAmount / formatAmount', () => {
  it('يجمع بلا أخطاء كسور', () => {
    expect(sumAmount([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3)
  })
  it('الصحيح بلا كسور، والكسريّ بخانتين', () => {
    expect(formatAmount(120)).toBe('120 ₪')
    expect(formatAmount(125.5)).toBe('125.50 ₪')
  })
})

describe('groupByEmployee', () => {
  it('مجموعةٌ لكلّ موظف بالاسم، بمجموعها وغير المسدَّد منه', () => {
    const groups = groupByEmployee([
      trip({ id: '1', profile_id: 'p2', amount: 10 }),
      trip({ id: '2', profile_id: 'p1', amount: 15, paid: true, paid_at: 'x' }),
      trip({ id: '3', profile_id: 'p1', amount: 5 })
    ], { p1: 'بلال', p2: 'أحمد' })
    expect(groups.map(g => [g.name, g.total, g.unpaidTotal, g.trips.length])).toEqual([
      ['أحمد', 10, 10, 1], ['بلال', 20, 5, 2]
    ])
  })
  it('موظفٌ بلا اسمٍ معروف ← «—»', () => {
    expect(groupByEmployee([trip()], {})[0]!.name).toBe('—')
  })
})

describe('payAllText', () => {
  it('صيغُ العدد', () => {
    expect(payAllText([trip({ amount: 20 })])).toBe('تسديد رحلة واحدة بمبلغ 20 ₪؟')
    expect(payAllText([trip(), trip()])).toBe('تسديد رحلتين بمبلغ 40 ₪؟')
    expect(payAllText(Array.from({ length: 3 }, () => trip({ amount: 10 })))).toBe('تسديد 3 رحلات بمبلغ 30 ₪؟')
    expect(payAllText(Array.from({ length: 11 }, () => trip({ amount: 1 })))).toBe('تسديد 11 رحلة بمبلغ 11 ₪؟')
  })
})

describe('unpaid / canEditTrip', () => {
  it('غيرُ المسدَّد وحده', () => {
    expect(unpaid([trip({ id: 'a' }), trip({ id: 'b', paid: true, paid_at: 'x' })]).map(t => t.id)).toEqual(['a'])
  })
  it('صاحبُها ما دامت غيرَ مسدَّدة، والمدير الإداري دائماً', () => {
    expect(canEditTrip({ paid: false }, { isOwner: true, isAdmin: false })).toBe(true)
    expect(canEditTrip({ paid: true }, { isOwner: true, isAdmin: false })).toBe(false)
    expect(canEditTrip({ paid: true }, { isOwner: false, isAdmin: true })).toBe(true)
    expect(canEditTrip({ paid: false }, { isOwner: false, isAdmin: false })).toBe(false)
  })
})

describe('validateTrip', () => {
  const ok = { trip_date: '2026-10-05', description: 'زيارة', amount: '20', notes: '' }
  it('سليمٌ ← لا أخطاء', () => {
    expect(validateTrip(ok, '2026-10-20')).toEqual([])
  })
  it('تاريخٌ بعد اليوم، وبيانٌ فارغ، ومبلغٌ غيرُ موجب أو بأكثر من خانتين', () => {
    const names = (i: typeof ok) => validateTrip(i, '2026-10-20').map(e => e.name)
    expect(names({ ...ok, trip_date: '2026-10-21' })).toEqual(['trip_date'])
    expect(names({ ...ok, trip_date: '' })).toEqual(['trip_date'])
    expect(names({ ...ok, description: '   ' })).toEqual(['description'])
    expect(names({ ...ok, amount: '0' })).toEqual(['amount'])
    expect(names({ ...ok, amount: '12.345' })).toEqual(['amount'])
    expect(names({ ...ok, amount: '10001' })).toEqual(['amount'])
    expect(names({ ...ok, notes: 'x'.repeat(501) })).toEqual(['notes'])
  })
})
```

و`app/constants/transport.test.ts` يقرأ أحدثَ هجرةٍ فيها `create or replace function private.can_log_transport` ويتحقّق أنّ الأدوار بين الأقواس تساوي `TRANSPORT_LOGGER_ROLES` (على نمط `app/constants/notifications.test.ts`).

- [ ] **Step 2:** `pnpm exec vitest run app/utils/transport.test.ts app/constants/transport.test.ts` ← تفشل (الدوالّ غير موجودة).

- [ ] **Step 3: التنفيذ** — `app/constants/transport.ts`:

```ts
/** ثوابتُ كشف المواصلات — الأدوارُ تطابق `private.can_log_transport()` (يحرسها اختبار). */
export const TRANSPORT_LOGGER_ROLES = ['field_supervisor', 'examiner'] as const
export const TRANSPORT_DESCRIPTION_MAX = 200
export const TRANSPORT_NOTES_MAX = 500
export const TRANSPORT_AMOUNT_MAX = 10000
```

و`app/utils/transport.ts` (≤ 300 سطر، JSDoc عربيّ لكلّ دالّة):

```ts
/** منطقُ كشف المواصلات النقيّ: حدودُ الشهر، والترقيم، والمجاميع، والتجميع بالموظف، والتحقّق. */
import { TRANSPORT_AMOUNT_MAX, TRANSPORT_DESCRIPTION_MAX, TRANSPORT_NOTES_MAX } from '~/constants/transport'
import { shiftMonth } from '~/utils/reportWindow'

export interface Trip {
  id: string
  profile_id: string
  trip_date: string
  description: string
  amount: number
  notes: string | null
  paid: boolean
  paid_at: string | null
  created_at: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** أوّلُ يومٍ في الشهر، وأوّلُ يومٍ في الذي يليه (حصريّ) — لاستعلام `gte/lt`. */
export function monthBounds(year: number, month: number): { from: string, to: string } {
  const next = shiftMonth(year, month, 1)
  return { from: `${year}-${pad(month)}-01`, to: `${next.year}-${pad(next.month)}-01` }
}

/** الرقمُ التسلسليّ في الشهر: بالتاريخ ثم بوقت الإنشاء. */
export function numberTrips<T extends Pick<Trip, 'trip_date' | 'created_at'>>(trips: T[]): (T & { serial: number })[] {
  return [...trips]
    .sort((a, b) => a.trip_date.localeCompare(b.trip_date) || a.created_at.localeCompare(b.created_at))
    .map((t, i) => ({ ...t, serial: i + 1 }))
}

/** مجموعُ المبالغ مقرّباً لخانتين (لا 0.30000000000000004). */
export function sumAmount(trips: Pick<Trip, 'amount'>[]): number {
  return Math.round(trips.reduce((s, t) => s + Number(t.amount), 0) * 100) / 100
}

/** المبلغ بالشيكل: الصحيحُ بلا كسور، والكسريّ بخانتين. */
export function formatAmount(n: number): string {
  return `${Number.isInteger(n) ? String(n) : n.toFixed(2)} ₪`
}

export function unpaid<T extends Pick<Trip, 'paid'>>(trips: T[]): T[] {
  return trips.filter(t => !t.paid)
}

/** صاحبُها ما دامت غيرَ مسدَّدة؛ والمدير الإداري دائماً (كما في RLS). */
export function canEditTrip(trip: Pick<Trip, 'paid'>, opts: { isOwner: boolean, isAdmin: boolean }): boolean {
  return opts.isAdmin || (opts.isOwner && !trip.paid)
}

/** رحلاتُ العرض مجمَّعةً لكلّ موظف، مرتّبةً بالاسم، بمجموعها وغير المسدَّد منه. */
export function groupByEmployee(trips: Trip[], names: Record<string, string>) {
  const by = new Map<string, Trip[]>()
  for (const t of trips) by.set(t.profile_id, [...(by.get(t.profile_id) ?? []), t])
  return [...by.entries()]
    .map(([profileId, list]) => ({
      profileId,
      name: names[profileId] ?? '—',
      trips: numberTrips(list),
      total: sumAmount(list),
      unpaidTotal: sumAmount(unpaid(list))
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

function tripsCount(n: number): string {
  if (n === 1) return 'رحلة واحدة'
  if (n === 2) return 'رحلتين'
  return n <= 10 ? `${n} رحلات` : `${n} رحلة`
}

/** نصُّ نافذة «تسديد الكل»: العددُ والمبلغ. */
export function payAllText(trips: Pick<Trip, 'amount'>[]): string {
  return `تسديد ${tripsCount(trips.length)} بمبلغ ${formatAmount(sumAmount(trips))}؟`
}

/** تحقّقُ نموذج الرحلة (القاعدةُ هي الحَكَم؛ هذا لتجربةٍ أوضح). `today` بتوقيت غزة. */
export function validateTrip(
  input: { trip_date: string, description: string, amount: string, notes: string },
  today: string
): { name: string, message: string }[] {
  const errors: { name: string, message: string }[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.trip_date)) errors.push({ name: 'trip_date', message: 'التاريخ مطلوب.' })
  else if (input.trip_date > today) errors.push({ name: 'trip_date', message: 'لا تُسجَّل رحلةٌ بتاريخٍ لم يأتِ بعد.' })
  const desc = input.description.trim()
  if (!desc) errors.push({ name: 'description', message: 'البيان مطلوب.' })
  else if (desc.length > TRANSPORT_DESCRIPTION_MAX) errors.push({ name: 'description', message: `البيان لا يتجاوز ${TRANSPORT_DESCRIPTION_MAX} حرفاً.` })
  const amount = Number(input.amount)
  if (!/^\d+(\.\d{1,2})?$/.test(input.amount.trim()) || !(amount > 0) || amount > TRANSPORT_AMOUNT_MAX) {
    errors.push({ name: 'amount', message: `مبلغٌ موجبٌ حتى ${TRANSPORT_AMOUNT_MAX} بخانتين عشريّتين على الأكثر.` })
  }
  if (input.notes.length > TRANSPORT_NOTES_MAX) errors.push({ name: 'notes', message: `الملاحظات لا تتجاوز ${TRANSPORT_NOTES_MAX} حرف.` })
  return errors
}
```

- [ ] **Step 4:** الاختبارات تمرّ؛ `pnpm lint && pnpm test`.
- [ ] **Step 5: Commit** `feat(transport): منطقُ الكشف — الترقيم والمجاميع والتجميع والتحقّق`

---

### Task 3: «رحلاتي» — الصفحة وعرضُ صاحب الرحلات

**Files:**
- Create: `app/composables/useTransport.ts`, `app/pages/transport/index.vue`, `app/components/transport/MyTrips.vue`, `app/components/transport/TripModal.vue`
- Modify: `app/layouts/dashboard.vue` (بندٌ في `mainNav`)

**Interfaces:**
- Consumes (Task 2): `Trip`، `monthBounds`، `numberTrips`، `sumAmount`، `formatAmount`، `validateTrip`، `canEditTrip`، `TRANSPORT_LOGGER_ROLES`؛ `gazaToday`، `formatDay` من `~/utils/reportWindow`؛ `QuranMonthPicker` (`v-model:year`، `v-model:month`، `:max`).
- Produces: `useTransport()` ← `{ fetchMonth(year, month, opts?: { profileId?: string }): Promise<Trip[]>, saveTrip(input: { id?: string, trip_date: string, description: string, amount: number, notes: string | null }): Promise<void>, deleteTrip(id: string): Promise<void>, setPaid(ids: string[], paid: boolean): Promise<number>, fetchLoggers(): Promise<{ id: string, full_name: string }[]> }` — كلُّها ترمي `Error` عربياً، وتحديثٌ/حذفٌ بلا صفٍّ يرمي «لم يُحفظ — قد تكون الرحلةُ سُدّدت.».

- [ ] **Step 1: `useTransport`** — الجلب: `.from('transport_trips').select('id, profile_id, trip_date, description, amount, notes, paid, paid_at, created_at').gte('trip_date', from).lt('trip_date', to).order('trip_date').order('created_at')`، و`.eq('profile_id', profileId)` إن مُرّر. `amount` يُحوَّل `Number()`. الإدراجُ بلا `profile_id` (الافتراضيّ `auth.uid()`). التعديل `.update({...}).eq('id', id).select('id')` والتحقّق من الطول. الحذفُ كذلك. `setPaid` ← `supabase.rpc('set_transport_paid', { p_ids: ids, p_paid: paid })`. `fetchLoggers` ← `profiles` بأدوار `TRANSPORT_LOGGER_ROLES` و`status = 'active'`، مرتّبةً بالاسم.

- [ ] **Step 2: الصفحة `app/pages/transport/index.vue`** (`definePageMeta({ layout: 'dashboard' })`، `useSeoMeta({ title: 'كشف المواصلات — ترجمان' })`):
  - الشهر من `?y=&m=` إن صحّ وإلا شهرُ اليوم بتوقيت غزة (`gazaToday()`)، ويُكتب في الرابط عند التغيير (`router.replace({ query })`).
  - `UiPageHeader` بعنوان «كشف المواصلات» ووصفٍ بحسب الدور.
  - بطاقة الشهر: `QuranMonthPicker` بعرض السطر.
  - المشرف/المختبِر (`TRANSPORT_LOGGER_ROLES`) ← `TransportMyTrips`؛ المدير الإداري ومشرف المشروع ← `TransportAllTrips` (Task 4 — ضع الآن `UiEmptyState` مؤقّتاً «يُبنى في المهمة التالية» يُزال في Task 4)؛ غيرُهم ← `UiEmptyState` «هذه الشاشة للمشرفين الميدانيين والمختبِرين والإدارة.».

- [ ] **Step 3: `MyTrips.vue`** — props `{ year: number, month: number }`:
  - `useLazyAsyncData` بمفتاحٍ يحوي الشهر و`watch: [year, month]`، `server: false`.
  - شريطٌ علويّ: «المجموع: 315 ₪ · غير المسدَّد: 120 ₪» وزرّ «إضافة رحلة» (`i-lucide-plus`، 44px).
  - `UiDataTable` بالأعمدة: `#`، التاريخ (`formatDay`)، البيان، المبلغ (`formatAmount`، `dir="ltr"` معزول)، الملاحظات، الحالة (شارة «مسدَّدة» خضراء / «غير مسدَّدة» محايدة)، والإجراءات (تعديل/حذف — معطَّلان مع `title` «سُدّدت فلا تُعدَّل» للمسدَّد بحسب `canEditTrip`).
  - فتحة `#card` بـ`UiCardRow` للجوال.
  - حذفٌ عبر `UiConfirmModal` «حذف رحلة 05-10-2026؟».
  - `UiEmptyState` «لا رحلات في 10-2026» بزرّ الإضافة.

- [ ] **Step 4: `TripModal.vue`** — `v-model:open`، prop `trip?: Trip | null` (تعديل) ، emit `saved`:
  - الحقول بتسمياتٍ فوقها لا بجانبها، بعرضٍ كامل على الجوال وعمودين على سطح المكتب (التاريخ + المبلغ في صفّ، البيان والملاحظات كاملان): التاريخ `UInput type="date"` بـ`:max="gazaToday()"`، البيان `UInput`، المبلغ `UInput inputmode="decimal" dir="ltr"` مع لاحقة «₪»، الملاحظات `UTextarea` اختيارية.
  - `UForm :validate` بـ`validateTrip(state, gazaToday())`؛ الحفظ يستدعي `saveTrip` ثم `toast` «حُفظت الرحلة.» و`emit('saved')`.
  - التاريخ الافتراضيّ للجديدة: اليوم إن كان في الشهر المعروض، وإلا آخرُ يومٍ منه.

- [ ] **Step 5: القائمة** — في `app/layouts/dashboard.vue` بعد `incentives`: `{ key: 'transport', label: 'كشف المواصلات', icon: 'i-lucide-bus', to: '/transport', roles: [PS, ADMIN, FIELD, 'examiner'] }`.

- [ ] **Step 6:** `pnpm lint && pnpm test`؛ vue-tsc بلا جديد؛ افتح `http://localhost:3030/transport` (إن كانت جلسةٌ مفتوحة) وتأكّد من خلوّ سجلّ الخادم من أخطاء — لا كتابةَ في القاعدة.
- [ ] **Step 7: Commit** `feat(transport): «رحلاتي» — إدخالُ الرحلات الشهرية وتعديلُ غير المسدَّد`

---

### Task 4: «كلّ الرحلات» — عرضُ المدير الإداري والتسديد

**Files:**
- Create: `app/components/transport/AllTrips.vue` (وإن تجاوز 300 سطر: `app/components/transport/EmployeeGroup.vue` لمجموعة موظفٍ واحد)
- Modify: `app/pages/transport/index.vue` (يزيل الحالة المؤقّتة ويعرض `TransportAllTrips`)

**Interfaces:**
- Consumes: `useTransport()` (`fetchMonth`، `fetchLoggers`، `setPaid`)، `groupByEmployee`، `unpaid`، `payAllText`، `formatAmount`، `formatDay`؛ `usePermissions().isAdmin` و`isReadOnly`.

- [ ] **Step 1: البيانات** — props `{ year, month }`؛ رحلاتُ الشهر كلُّها (بلا `profileId`) والموظفون (`fetchLoggers`) بالتوازي؛ `names` من الموظفين.
- [ ] **Step 2: الرأس** — `UiSelect` «كلّ الموظفين» + الموظفون (عرضُ نصف السطر على الجوال)، وملخّص «المجموع X · غير المسدَّد Y · Z موظفين»، وزرّ «تسديد الكل» (`i-lucide-check-check`، للمدير الإداري وحده، معطَّلٌ إن لم يبقَ غيرُ مسدَّد في العرض الحاليّ بعد التصفية) يفتح `UiConfirmModal` بنصّ `payAllText(unpaid(visible))` ثم `setPaid(ids, true)` و`toast` «سُدّدت N رحلة.» وتحديث.
- [ ] **Step 3: المجموعات** — لكلّ موظف بطاقةٌ: الاسم ومجموعه وغير المسدَّد، ثم جدولُ رحلاته (`UiDataTable` + `#card`) بالأعمدة: `#`، التاريخ، البيان، المبلغ، الملاحظات، «مسدَّدة» (`USwitch` بـ`aria-label` «مسدَّدة: <البيان> <التاريخ>»؛ للمدير الإداري يستدعي `setPaid([id], value)` بتحديثٍ متفائلٍ يُرجَع عند الخطأ؛ لمشرف المشروع شارةٌ نصّية بلا مفتاح).
- [ ] **Step 4: الحالات** — تحميلٌ بـ`UiSkeletonTable`، و`UiEmptyState` «لا رحلات في 10-2026» (أو «لهذا الموظف»)، والأخطاء عبر `handle`.
- [ ] **Step 5:** `pnpm lint && pnpm test`؛ vue-tsc؛ لا تمرير أفقيّ على 375 (افحص بـ`document.documentElement.scrollWidth` إن أمكن).
- [ ] **Step 6: Commit** `feat(transport): «كلّ الرحلات» للمدير الإداري — مفتاحُ التسديد و«تسديد الكل»`

---

### Task 5: التحقّق في المتصفّح والتوثيق (المتحكّم)

- [ ] **المتصفّح** (المستخدم يُدخل الحسابات؛ بياناتُ التجربة على الإنتاج **تُحذف بالمعرّفات بإذنه**): المشرف الميداني التجريبيّ يضيف رحلتين ويعدّل واحدة ويحذف أخرى؛ المختبِر لا يراها؛ المدير الإداري يرى المجموعة ويسدّد واحدةً بالمفتاح ثم «تسديد الكل» ← إشعارٌ واحدٌ للمشرف بالعدد والمبلغ والشهر؛ المشرف لا يعدّل المسدَّد؛ 375 بلا تمرير.
- [ ] **التوثيق:** `docs/DATABASE.md` (قسم `transport_trips` والحارس و`set_transport_paid` و`can_log_transport`)، `docs/FEATURES.md` (بند + Changelog 2026-10-20)، `docs/PAGES.md` (`/transport`)، `docs/ROADMAP.md` (الدفعة الثانية: الجزء ٤ ✅)، و`CLAUDE.md` صفٌّ جديد في المصفوفة «كشف المواصلات» (م.م 👁 قراءة · إدا ✅ الكلّ والتسديد · فني ❌ · مدي ❌ · ميد ✅ رحلاته · مخت ✅ رحلاته · معل ❌ · طال ❌)، ثم وثيقة السيناريوهات بعد النشر.
- [ ] **Commit** `docs(transport): توثيقُ كشف المواصلات`
