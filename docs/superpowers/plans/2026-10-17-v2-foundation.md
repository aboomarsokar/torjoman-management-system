# الإصدار الثاني — الأساس: خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** سبعة أدوار بنطاقاتها، ودخولٌ بالرقم الوظيفي (موظف) أو الهوية (طالب) بلا بريد، وحساباتٌ ينشئها المدير الإداري وحده.

**Architecture:** هجرةٌ واحدة ذرّية تبدّل نوع `user_role` وتعيد كتابة كل سياسات RLS على دوالّ نطاقٍ جديدة؛ ثم ثوابت هوية/دخول منقولة من الصحابة؛ ثم مسارا خادمٍ (دخول الموظف، إنشاء الحسابات)؛ ثم تكييف الواجهة. حذف البيانات آخر خطوة وبتأكيد المستخدم.

**Tech Stack:** Nuxt 4 · @nuxt/ui v4 · @nuxtjs/supabase 2 · supabase-js 2.108 · Postgres 17 (مشروع `qwtqfkayupzijcoguqrf`، فرانكفورت) · Vitest (يُضاف).

**المواصفة:** `docs/superpowers/specs/2026-10-17-v2-foundation-design.md`

## Global Constraints
- الأدوار بالضبط (ثمانية، قرار المستخدم 2026-10-17 بعد مراجعة Task 2): `project_supervisor`, `admin_manager`, `technical_manager`, `women_admin`, `field_supervisor`, `examiner`, `teacher`, `student`.
- **لا عمود `section`**: النطاق في الدور نفسه. المدير الإداري والمدير الفني: القسمان، و**شخصٌ واحد نشط لكلٍّ منهما** (فهرس فريد جزئي). `women_admin` (المديرة الإدارية): قسم البنات فقط — ترى كل شيء فيه، وتُسند الطالبات للحلقات، وتعتمد التقارير الشهرية وكشوف الحوافز؛ **ولا تنشئ حسابات** (الإنشاء للمدير الإداري وحده).
- **تعديل لاحق للمهام 3 و5 و6:** كل ذكرٍ لـ `Section`/`section`/`SECTION_LABEL`/`isFullAdmin`/`assertInSection`/`current_user_section` في نصّها أدناه **ملغى** — المكافئ: `isAdmin` (المدير الإداري) و`isWomenAdmin`، ونطاق المديرة يُحسب من دورها (حلقات `gender = 'female'`).
- الرقم الوظيفي نصّ 4 خانات بالضبط، يبدأ `1001`، فريد. رقم الهوية 9 خانات.
- النطاقات: `staff.torjoman.org` و`students.torjoman.org` — لا يُرسل إليهما بريد.
- رسالة رفض الدخول واحدة: «الرقم أو كلمة المرور غير صحيحة.»
- كل دالّة في سياسة: `SECURITY DEFINER` + `set search_path = public` + `grant execute … to authenticated` (درس الصحابة: سحب PUBLIC بلا منحٍ أعمى المستخدمين).
- لا قيم سرّية في المحادثة أو السجلّات؛ التطبيق على قاعدة `qwtqfkayupzijcoguqrf` عبر MCP `apply_migration`.
- لا تُستعمل أدوات الصَّدفة لتحرير ملفات المشروع — Write/Edit فقط.
- كل نصّ للمستخدم بالعربية. RTL. لمس ≥ 44px.

---

## خريطة الملفات
| الملف | المسؤولية |
|---|---|
| `vitest.config.ts` (جديد) | تشغيل اختبارات الدوالّ النقيّة (بيئة node، الاسم المستعار `~`) |
| `app/constants/identity.ts` (جديد) | تطبيع الأرقام، تحقّق الهوية والرقم الوظيفي، تصنيف معرّف الدخول |
| `app/constants/accounts.ts` (جديد) | النطاقات وبناء البريد الداخلي للموظف والطالب |
| `app/constants/roles.ts` (تعديل) | `Role`، `Section`، `roleLabel(role, gender)`، مجموعات الأدوار |
| `supabase/migrations/20261017120000_v2_roles_rls.sql` (جديد) | تبديل النوع، أعمدة جديدة، دوالّ النطاق، كل السياسات |
| `supabase/tests/v2_rls.sql` (جديد) | اختبار السياسات بجلسة كل دور داخل معاملة تُلغى |
| `server/utils/supabaseAdmin.ts` (تعديل) | `requireAdminManager` يعيد النطاق |
| `server/api/auth/staff-login.post.ts` (جديد) | دخول الموظف بالرقم الوظيفي |
| `server/api/users.post.ts` (تعديل) | إنشاء حساب موظف برقمٍ مولَّد |
| `server/api/students.post.ts` (جديد) | إنشاء طالب + حسابه |
| `server/api/users/reset-password.post.ts` (تعديل) | للمدير الإداري ضمن قسمه |
| `app/composables/useAuth.ts` (تعديل) | `signInWithIdentifier` |
| `app/composables/usePermissions.ts` (جديد) | أعلام الواجهة المشتقّة من الدور |
| `app/pages/login.vue` (تعديل) | حقلٌ واحد، بلا استعادة بالبريد |
| `app/layouts/dashboard.vue` + الصفحات (تعديل) | الأدوار الجديدة |
| `app/pages/me.vue` (جديد) | صفحة الطالب |

---

### Task 1: أداة الاختبار وثوابت الهوية والدخول

**Files:**
- Create: `vitest.config.ts`, `app/constants/identity.ts`, `app/constants/accounts.ts`
- Test: `app/constants/identity.test.ts`, `app/constants/accounts.test.ts`
- Modify: `package.json` (سكربتا `test`)

**Interfaces — Produces:**
- `normalizeDigits(v: string): string` · `digitsOnly(v: string): string`
- `IDENTITY_LENGTH = 9` · `EMPLOYEE_NUMBER_LENGTH = 4` · `FIRST_EMPLOYEE_NUMBER = 1001`
- `isValidIdentity(v): boolean` · `isValidEmployeeNumber(v): boolean`
- `classifyLoginId(v): { kind: 'staff' | 'student', id: string } | { kind: 'invalid' }`
- `OWNED_DOMAIN = 'torjoman.org'` · `STAFF_EMAIL_DOMAIN` · `STUDENT_EMAIL_DOMAIN`
- `staffEmailFromNumber(no: string): string` · `studentEmailFromIdentity(id: string): string`

- [ ] **Step 1: ثبّت Vitest**

```bash
pnpm add -D vitest@^4
```

وأضف إلى `scripts` في `package.json`: `"test": "vitest run"` و`"test:watch": "vitest"`.

- [ ] **Step 2: إعداد Vitest** — `vitest.config.ts`

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// اختبارات الدوالّ النقيّة فقط (ثوابت ومنطق بلا Nuxt ولا قاعدة).
export default defineConfig({
  resolve: { alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts', 'server/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.nuxt/**', '**/.output/**', '**/.claude/**']
  }
})
```

- [ ] **Step 3: اكتب الاختبار الفاشل** — `app/constants/identity.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { classifyLoginId, digitsOnly, isValidEmployeeNumber, isValidIdentity, normalizeDigits } from './identity'

describe('normalizeDigits', () => {
  it('يحوّل الأرقام العربية والفارسية', () => {
    expect(normalizeDigits('١٠٠١')).toBe('1001')
    expect(normalizeDigits('۴۰۷')).toBe('407')
  })
})

describe('digitsOnly', () => {
  it('يُسقط المسافات والشُّرَط', () => {
    expect(digitsOnly(' ٤٠٧ ٧٠٦-٩٥١ ')).toBe('407706951')
  })
})

describe('isValidIdentity / isValidEmployeeNumber', () => {
  it('الهوية 9 خانات بالضبط', () => {
    expect(isValidIdentity('407706951')).toBe(true)
    expect(isValidIdentity('40770695')).toBe(false)
  })
  it('الرقم الوظيفي 4 خانات بالضبط', () => {
    expect(isValidEmployeeNumber('١٠٠١')).toBe(true)
    expect(isValidEmployeeNumber('101')).toBe(false)
    expect(isValidEmployeeNumber('10011')).toBe(false)
  })
})

describe('classifyLoginId', () => {
  it('4 خانات = موظف، 9 = طالب، وغير ذلك غير صالح', () => {
    expect(classifyLoginId(' ١٠٠٢ ')).toEqual({ kind: 'staff', id: '1002' })
    expect(classifyLoginId('407 706 951')).toEqual({ kind: 'student', id: '407706951' })
    expect(classifyLoginId('12345')).toEqual({ kind: 'invalid' })
    expect(classifyLoginId('abc')).toEqual({ kind: 'invalid' })
  })
})
```

- [ ] **Step 4: شغّله ليفشل**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './identity'`

- [ ] **Step 5: اكتب `app/constants/identity.ts`**

```ts
/**
 * أرقام الهوية والرقم الوظيفي — مشتركة بين الواجهة والخادم (منقولة من الصحابة).
 * التطبيع قبل أي تحقّق وقبل الحفظ: لوحة المفاتيح العربية تكتب محارف غير اللاتينية.
 */

/** رقم الهوية الفلسطينية: تسع خانات. */
export const IDENTITY_LENGTH = 9

/**
 * الرقم الوظيفي: أربع خانات تبدأ من 1001 (قرار المستخدم 2026-10-17).
 * ⚠️ نهائيّ: بعد أن يحفظ الناس أرقامهم لا يُغيَّر الطول.
 */
export const EMPLOYEE_NUMBER_LENGTH = 4
export const FIRST_EMPLOYEE_NUMBER = 1001

export function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0)
    const base = code >= 0x06F0 ? 0x06F0 : 0x0660
    return String(code - base)
  })
}

/** الأرقام وحدها بعد التطبيع — يتسامح مع المسافات والشُّرَط. */
export function digitsOnly(value: string): string {
  return normalizeDigits(value).replace(/\D/g, '')
}

export function isValidIdentity(value: string): boolean {
  return new RegExp(`^\\d{${IDENTITY_LENGTH}}$`).test(normalizeDigits(value.trim()))
}

export function isValidEmployeeNumber(value: string): boolean {
  return new RegExp(`^\\d{${EMPLOYEE_NUMBER_LENGTH}}$`).test(normalizeDigits(value.trim()))
}

export type LoginId = { kind: 'staff' | 'student', id: string } | { kind: 'invalid' }

/** شاشة الدخول حقلٌ واحد: الطول يفرّق الموظف (4) عن الطالب (9). */
export function classifyLoginId(value: string): LoginId {
  const raw = normalizeDigits(value).replace(/[\s-]/g, '')
  if (!/^\d+$/.test(raw)) return { kind: 'invalid' }
  if (raw.length === EMPLOYEE_NUMBER_LENGTH) return { kind: 'staff', id: raw }
  if (raw.length === IDENTITY_LENGTH) return { kind: 'student', id: raw }
  return { kind: 'invalid' }
}

export const IDENTITY_ERROR = `رقم الهوية ${IDENTITY_LENGTH} أرقام بالضبط`
export const LOGIN_ID_ERROR = 'أدخل رقمك الوظيفي (4 أرقام) أو رقم هويتك (9 أرقام).'
```

- [ ] **Step 6: اختبار وثوابت النطاقات** — `app/constants/accounts.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { STAFF_EMAIL_DOMAIN, STUDENT_EMAIL_DOMAIN, staffEmailFromNumber, studentEmailFromIdentity } from './accounts'

describe('البريد الداخلي', () => {
  it('نطاقان مختلفان تحت torjoman.org', () => {
    expect(STAFF_EMAIL_DOMAIN).toBe('staff.torjoman.org')
    expect(STUDENT_EMAIL_DOMAIN).toBe('students.torjoman.org')
  })
  it('يبنيان من الرقم بعد التطبيع', () => {
    expect(staffEmailFromNumber('١٠٠١')).toBe('1001@staff.torjoman.org')
    expect(studentEmailFromIdentity(' ٤٠٧٧٠٦٩٥١ ')).toBe('407706951@students.torjoman.org')
  })
})
```

- [ ] **Step 7: اكتب `app/constants/accounts.ts`**

```ts
/**
 * البريد الداخلي للحسابات — Supabase يشترط بريداً، والمستخدمون بلا بريد.
 * ⚠️ لا يُرسل إلى هذين النطاقين شيء، ولا خادم بريد عليهما.
 * ⚠️ بريد الطالب يُشتقّ في شاشة الدخول وعند الإنشاء — لو اختلف البناءان حرفاً
 * صار حسابٌ لا يدخله صاحبه. ومثله بريد الموظف في الخادم.
 */
import { normalizeDigits } from './identity'

export const OWNED_DOMAIN = 'torjoman.org'
export const STAFF_EMAIL_DOMAIN = `staff.${OWNED_DOMAIN}`
export const STUDENT_EMAIL_DOMAIN = `students.${OWNED_DOMAIN}`

export function staffEmailFromNumber(employeeNumber: string): string {
  return `${normalizeDigits(employeeNumber.trim())}@${STAFF_EMAIL_DOMAIN}`
}

export function studentEmailFromIdentity(identity: string): string {
  return `${normalizeDigits(identity.trim())}@${STUDENT_EMAIL_DOMAIN}`
}
```

- [ ] **Step 8: شغّل الاختبارات**

Run: `pnpm test`
Expected: PASS (6 اختبارات)

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml app/constants/identity.ts app/constants/identity.test.ts app/constants/accounts.ts app/constants/accounts.test.ts
git commit -m "feat(auth): ثوابت الهوية والرقم الوظيفي والبريد الداخلي + Vitest"
```

---

### Task 2: هجرة الأدوار والنطاق وكل السياسات (TDD على القاعدة)

**Files:**
- Create: `supabase/tests/v2_rls.sql`, `supabase/migrations/20261017120000_v2_roles_rls.sql`
- Modify: `app/types/database.types.ts` (توليد)

**Interfaces — Produces (في القاعدة):**
- النوع `user_role` بالقيم السبع؛ `section_scope` (`all`,`male`,`female`).
- `profiles.section section_scope not null default 'all'`، `profiles.employee_number text unique check (~ '^\d{4}$')`؛ يُحذف `quality_supervisor_id`.
- `students.user_id uuid unique references auth.users on delete set null`.
- `claim_employee_number() returns text` (للخدمة فقط).
- دوالّ النطاق: `current_user_role()`, `current_user_section()`, `is_project_supervisor()`, `is_admin_manager()`, `is_full_admin()` (إداري بقسم `all`), `in_section(g gender_type)`, `can_view_halaqa(hid)`, `can_manage_halaqa(hid)`, `can_assign_in_halaqa(hid)`, `is_halaqa_teacher(hid)`, `my_student_id()`.
- تحويل البيانات القائمة: `manager→admin_manager`، `quality→technical_manager`، `supervisor→field_supervisor`.

- [ ] **Step 1: اكتب اختبار السياسات أولاً** — `supabase/tests/v2_rls.sql`

كل حالة تنتحل دوراً بـ`set local role authenticated` + `request.jwt.claims` داخل معاملة تُلغى، وتُرجع صفّاً واحداً بالعدّ. يُشغَّل كل بلوك بـ MCP `execute_sql` على `qwtqfkayupzijcoguqrf`.

```sql
-- يجهّز في كل بلوك: حساباً لكل دور يُشتقّ من البيانات التجريبية الحالية
-- (manager→admin_manager … بعد الهجرة). المتغيّرات تُملأ بمعرّفات حقيقية
-- من: select id, role, gender from profiles order by role;
-- وحلقة بنين وحلقة بنات: select id, gender, supervisor_id, teacher_id from halaqat;

-- (أ) مشرف المشروع يقرأ كل شيء ولا يكتب
begin;
update profiles set role = 'project_supervisor' where id = :'ANY_STAFF';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ANY_STAFF', 'role', 'authenticated')::text, true);
create temp table _r on commit drop as select
  (select count(*) from halaqat) = (select count(*) from halaqat) as dummy,
  (select count(*) from halaqat) halaqat_seen,
  (select count(*) from students) students_seen,
  (select count(*) from financial_transactions) fin_seen;
reset role; select * from _r; rollback;
-- المتوقّع: halaqat_seen = 9، students_seen = 160

-- (ب) المديرة الإدارية (section=female) ترى حلقات البنات فقط
begin;
update profiles set role = 'admin_manager', gender = 'female', section = 'female' where id = :'ANY_STAFF';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ANY_STAFF', 'role', 'authenticated')::text, true);
create temp table _r on commit drop as select
  (select count(*) from halaqat) halaqat_seen,
  (select count(*) filter (where gender = 'male') from halaqat) male_seen;
reset role; select * from _r; rollback;
-- المتوقّع: halaqat_seen = 5، male_seen = 0

-- (ج) المعلم يرى حلقته وطلابها فقط
-- (د) الطالب يرى صفّه فقط: يُربط students.user_id بحساب ثم يُعدّ
-- (هـ) المشرف الميداني يُسند طالباً في حلقته وتُرفض حلقة غيره
-- (و) مشرف المشروع: insert على halaqat يُرفض (42501)
-- (ز) المعلم: update على profiles.role لنفسه يُرفض (الحارس)
```

> لكل حالة من (ج) إلى (ز) اكتب بلوكاً بالبنية نفسها: تجهيز داخل المعاملة، ثم الانتحال، ثم العدّ أو المحاولة، ثم `rollback`. الحالات الرافضة تُشغَّل كلٌّ في استدعاءٍ منفصل لأن الخطأ يُجهض المعاملة، والمتوقّع `42501 new row violates row-level security policy` أو رسالة الحارس.

- [ ] **Step 2: شغّل (أ) قبل الهجرة ليفشل**

Expected: خطأ `invalid input value for enum user_role: "project_supervisor"` — الدليل أن الهجرة لم تُطبَّق.

- [ ] **Step 3: اكتب الهجرة** — `supabase/migrations/20261017120000_v2_roles_rls.sql`

```sql
-- ============================================================================
-- الإصدار الثاني — الأساس: الأدوار السبعة والنطاق وكل السياسات
-- المواصفة: docs/superpowers/specs/2026-10-17-v2-foundation-design.md
-- ذرّية: تُسقط كل سياسات public ودوالّ النوع القديم، تبدّل النوع، ثم تعيد البناء.
-- ============================================================================

-- 0) إسقاط كل سياسات public (تعتمد على user_role) ثم الدوالّ المعتمدة عليه
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
drop function if exists public.current_user_role();
drop function if exists public.is_manager();
drop function if exists public.can_access_halaqa(uuid);
drop function if exists public.is_halaqa_examiner(uuid);

-- 1) تبديل نوع الدور (لا DROP VALUE في Postgres) مع تحويل القائم
create type public.user_role_v2 as enum
  ('project_supervisor', 'admin_manager', 'technical_manager', 'field_supervisor', 'examiner', 'teacher', 'student');
alter table public.profiles alter column role type public.user_role_v2 using (
  case role::text
    when 'manager'    then 'admin_manager'
    when 'quality'    then 'technical_manager'
    when 'supervisor' then 'field_supervisor'
    else role::text
  end
)::public.user_role_v2;
drop type public.user_role;
alter type public.user_role_v2 rename to user_role;

-- 2) النطاق والرقم الوظيفي وحساب الطالب
create type public.section_scope as enum ('all', 'male', 'female');
alter table public.profiles
  add column section public.section_scope not null default 'all',
  add column employee_number text unique check (employee_number ~ '^\d{4}$'),
  drop column quality_supervisor_id;
alter table public.students
  add column user_id uuid unique references auth.users(id) on delete set null;

create sequence public.employee_number_seq start 1001 minvalue 1001 maxvalue 9999;
create or replace function public.claim_employee_number()
returns text language sql volatile security definer set search_path = public as $$
  select nextval('public.employee_number_seq')::text;
$$;
revoke all on function public.claim_employee_number() from public, anon, authenticated;
grant execute on function public.claim_employee_number() to service_role;

-- 3) حارس الأعمدة الامتيازية: لا يغيّر أحدٌ دورَه/قسمَه/رقمَه/حالتَه إلا المدير الإداري
create or replace function public.guard_profile_privileged()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- الخدمة والهجرات
  if (new.role, new.section, new.employee_number, new.status)
     is distinct from (old.role, old.section, old.employee_number, old.status)
     and not public.is_admin_manager() then
    raise exception 'لا تملك تعديل الدور أو القسم أو الرقم الوظيفي أو الحالة' using errcode = '42501';
  end if;
  return new;
end $$;

-- 4) دوالّ النطاق
create or replace function public.current_user_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active';
$$;
create or replace function public.current_user_section() returns public.section_scope
language sql stable security definer set search_path = public as $$
  select section from public.profiles where id = auth.uid();
$$;
create or replace function public.is_project_supervisor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'project_supervisor', false);
$$;
create or replace function public.is_admin_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'admin_manager', false);
$$;
-- المدير الإداري بقسم «الكل» — للمالية والأخبار والمحاضر والإعدادات (لا جنس لها)
create or replace function public.is_full_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin_manager() and public.current_user_section() = 'all';
$$;
create or replace function public.in_section(g public.gender_type) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.current_user_section() when 'all' then true else g::text = public.current_user_section()::text end;
$$;
create or replace function public.can_view_halaqa(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.halaqat h where h.id = hid and (
         public.is_project_supervisor()
      or (public.current_user_role() in ('admin_manager', 'technical_manager') and public.in_section(h.gender))
      or h.supervisor_id = auth.uid()
      or h.examiner_id = auth.uid()
      or h.teacher_id = auth.uid()
    ));
$$;
create or replace function public.can_manage_halaqa(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.halaqat h where h.id = hid
      and public.current_user_role() in ('admin_manager', 'technical_manager') and public.in_section(h.gender));
$$;
create or replace function public.can_assign_in_halaqa(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage_halaqa(hid)
      or exists (select 1 from public.halaqat h where h.id = hid and h.supervisor_id = auth.uid()
                 and public.current_user_role() = 'field_supervisor');
$$;
create or replace function public.is_halaqa_teacher(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.halaqat h where h.id = hid and h.teacher_id = auth.uid());
$$;
create or replace function public.is_halaqa_examiner(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.halaqat h where h.id = hid and h.examiner_id = auth.uid());
$$;
create or replace function public.my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.students where user_id = auth.uid();
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'current_user_role()', 'current_user_section()', 'is_project_supervisor()', 'is_admin_manager()',
    'is_full_admin()', 'in_section(public.gender_type)', 'can_view_halaqa(uuid)', 'can_manage_halaqa(uuid)',
    'can_assign_in_halaqa(uuid)', 'is_halaqa_teacher(uuid)', 'is_halaqa_examiner(uuid)', 'my_student_id()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

create trigger profiles_guard_privileged before update on public.profiles
  for each row execute function public.guard_profile_privileged();

-- حارس الإسناد: تغيير students.halaqa_id لمن يملك الإسناد في الحلقة الجديدة فقط
create or replace function public.guard_student_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.halaqa_id is distinct from old.halaqa_id
     and new.halaqa_id is not null
     and not public.can_assign_in_halaqa(new.halaqa_id) then
    raise exception 'لا تملك إسناد الطالب لهذه الحلقة' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger students_guard_assignment before update on public.students
  for each row execute function public.guard_student_assignment();

-- 5) السياسات
-- profiles: الأسماء يحتاجها الجميع؛ الكتابة للمدير الإداري + الذات (والحارس يمنع الامتيازي)
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (public.is_admin_manager());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin_manager() or id = auth.uid()) with check (public.is_admin_manager() or id = auth.uid());
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_full_admin());
create policy fin_all on public.profile_financials for all to authenticated
  using (public.is_full_admin() or public.is_project_supervisor()) with check (public.is_full_admin());

-- halaqat
create policy halaqat_select on public.halaqat for select to authenticated
  using (public.can_view_halaqa(id) or id = (select halaqa_id from public.students where user_id = auth.uid()));
create policy halaqat_insert on public.halaqat for insert to authenticated
  with check (public.current_user_role() in ('admin_manager', 'technical_manager') and public.in_section(gender));
create policy halaqat_update on public.halaqat for update to authenticated
  using (public.can_manage_halaqa(id)) with check (public.current_user_role() in ('admin_manager', 'technical_manager') and public.in_section(gender));
create policy halaqat_delete on public.halaqat for delete to authenticated using (public.is_admin_manager() and public.in_section(gender));

-- students: النطاق + الطالب لنفسه + غير المُسنَد لمن يُسند من جنسه
create policy students_select on public.students for select to authenticated using (
     user_id = auth.uid()
  or public.can_view_halaqa(halaqa_id)
  or (halaqa_id is null and (public.is_project_supervisor()
      or (public.current_user_role() in ('admin_manager', 'technical_manager') and public.in_section(gender))
      or (public.current_user_role() = 'field_supervisor'
          and gender = (select p.gender from public.profiles p where p.id = auth.uid())))));
create policy students_insert on public.students for insert to authenticated
  with check (public.is_admin_manager() and public.in_section(gender));
create policy students_update on public.students for update to authenticated using (
     (public.is_admin_manager() and public.in_section(gender))
  or (halaqa_id is not null and (public.can_assign_in_halaqa(halaqa_id) or public.is_halaqa_teacher(halaqa_id)))
  or (halaqa_id is null and (public.current_user_role() in ('technical_manager', 'field_supervisor')))
) with check (public.in_section(gender) or public.current_user_role() = 'field_supervisor' or public.is_halaqa_teacher(halaqa_id));
create policy students_delete on public.students for delete to authenticated using (public.is_admin_manager() and public.in_section(gender));

-- exam_plan و app_settings و news و المالية والمحاضر
create policy plan_select on public.exam_plan for select to authenticated using (true);
create policy plan_write on public.exam_plan for all to authenticated
  using (public.current_user_role() in ('admin_manager', 'technical_manager'))
  with check (public.current_user_role() in ('admin_manager', 'technical_manager'));
create policy settings_select on public.app_settings for select to authenticated using (true);
create policy settings_write on public.app_settings for all to authenticated using (public.is_full_admin()) with check (public.is_full_admin());
create policy news_select on public.news for select to anon, authenticated using (published or public.is_full_admin() or public.is_project_supervisor());
create policy news_write on public.news for all to authenticated using (public.is_full_admin()) with check (public.is_full_admin());
create policy fintx_all on public.financial_transactions for all to authenticated
  using (public.is_full_admin() or public.is_project_supervisor()) with check (public.is_full_admin());
create policy salaries_all on public.monthly_salaries for all to authenticated
  using (public.is_full_admin() or public.is_project_supervisor()) with check (public.is_full_admin());
create policy minutes_all on public.meeting_minutes for all to authenticated
  using (public.is_full_admin() or public.is_project_supervisor()) with check (public.is_full_admin());

-- exam_lists / items / results
create policy lists_select on public.exam_lists for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy lists_insert on public.exam_lists for insert to authenticated
  with check (public.current_user_role() = 'teacher' and teacher_id = auth.uid() and public.is_halaqa_teacher(halaqa_id));
create policy lists_update on public.exam_lists for update to authenticated
  using (public.can_manage_halaqa(halaqa_id) or public.is_halaqa_examiner(halaqa_id))
  with check (public.can_manage_halaqa(halaqa_id) or public.is_halaqa_examiner(halaqa_id));
create policy lists_delete on public.exam_lists for delete to authenticated
  using (public.can_manage_halaqa(halaqa_id) or teacher_id = auth.uid());
create policy items_select on public.exam_list_items for select to authenticated
  using (exists (select 1 from public.exam_lists l where l.id = exam_list_id and public.can_view_halaqa(l.halaqa_id)));
create policy items_write on public.exam_list_items for all to authenticated
  using (exists (select 1 from public.exam_lists l where l.id = exam_list_id
                 and (public.is_halaqa_teacher(l.halaqa_id) or public.can_manage_halaqa(l.halaqa_id))))
  with check (exists (select 1 from public.exam_lists l where l.id = exam_list_id
                 and (public.is_halaqa_teacher(l.halaqa_id) or public.can_manage_halaqa(l.halaqa_id))));
create policy results_select on public.exam_results for select to authenticated using (
  student_id = public.my_student_id()
  or exists (select 1 from public.students s where s.id = student_id and public.can_view_halaqa(s.halaqa_id)));
create policy results_insert on public.exam_results for insert to authenticated with check (
  exists (select 1 from public.students s where s.id = student_id and (
       public.can_manage_halaqa(s.halaqa_id)
    or (public.current_user_role() = 'examiner' and examiner_id = auth.uid() and public.is_halaqa_examiner(s.halaqa_id)))));
create policy results_update on public.exam_results for update to authenticated
  using (examiner_id = auth.uid() or exists (select 1 from public.students s where s.id = student_id and public.can_manage_halaqa(s.halaqa_id)))
  with check (examiner_id = auth.uid() or exists (select 1 from public.students s where s.id = student_id and public.can_manage_halaqa(s.halaqa_id)));
create policy results_delete on public.exam_results for delete to authenticated
  using (exists (select 1 from public.students s where s.id = student_id and public.is_admin_manager() and public.in_section(s.gender)));

-- التقارير الشهرية: المعلم يكتب تقرير حلقته، والإدارة تعتمد
create policy reports_select on public.monthly_reports for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy reports_write on public.monthly_reports for all to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_manage_halaqa(halaqa_id))
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_manage_halaqa(halaqa_id));
create policy rstudents_select on public.monthly_report_students for select to authenticated using (
  student_id = public.my_student_id()
  or exists (select 1 from public.monthly_reports r where r.id = report_id and public.can_view_halaqa(r.halaqa_id)));
create policy rstudents_write on public.monthly_report_students for all to authenticated
  using (exists (select 1 from public.monthly_reports r where r.id = report_id and (public.is_halaqa_teacher(r.halaqa_id) or public.can_manage_halaqa(r.halaqa_id))))
  with check (exists (select 1 from public.monthly_reports r where r.id = report_id and (public.is_halaqa_teacher(r.halaqa_id) or public.can_manage_halaqa(r.halaqa_id))));
create policy ractivities_select on public.monthly_report_activities for select to authenticated
  using (exists (select 1 from public.monthly_reports r where r.id = report_id and public.can_view_halaqa(r.halaqa_id)));
create policy ractivities_write on public.monthly_report_activities for all to authenticated
  using (exists (select 1 from public.monthly_reports r where r.id = report_id and (public.is_halaqa_teacher(r.halaqa_id) or public.can_manage_halaqa(r.halaqa_id))))
  with check (exists (select 1 from public.monthly_reports r where r.id = report_id and (public.is_halaqa_teacher(r.halaqa_id) or public.can_manage_halaqa(r.halaqa_id))));

-- الزيارات
create policy visits_select on public.supervision_visits for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy visits_insert on public.supervision_visits for insert to authenticated with check (
  public.can_manage_halaqa(halaqa_id)
  or (public.current_user_role() = 'field_supervisor' and supervisor_id = auth.uid() and public.can_view_halaqa(halaqa_id)));
create policy visits_update on public.supervision_visits for update to authenticated
  using (supervisor_id = auth.uid() or public.can_manage_halaqa(halaqa_id))
  with check (supervisor_id = auth.uid() or public.can_manage_halaqa(halaqa_id));
create policy visits_delete on public.supervision_visits for delete to authenticated using (public.can_manage_halaqa(halaqa_id));
create policy reschedule_select on public.visit_reschedule_log for select to authenticated
  using (exists (select 1 from public.supervision_visits v where v.id = visit_id and public.can_view_halaqa(v.halaqa_id)));
create policy reschedule_insert on public.visit_reschedule_log for insert to authenticated
  with check (exists (select 1 from public.supervision_visits v where v.id = visit_id
              and (v.supervisor_id = auth.uid() or public.can_manage_halaqa(v.halaqa_id))));

-- الحوافز
create policy incentives_select on public.halaqa_incentives for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy incentives_write on public.halaqa_incentives for all to authenticated
  using (public.is_admin_manager() and public.can_manage_halaqa(halaqa_id))
  with check (public.is_admin_manager() and public.can_manage_halaqa(halaqa_id));
create policy statements_select on public.incentive_statements for select to authenticated using (public.can_view_halaqa(halaqa_id));
create policy statements_write on public.incentive_statements for all to authenticated
  using (public.is_halaqa_teacher(halaqa_id) or public.can_manage_halaqa(halaqa_id))
  with check (public.is_halaqa_teacher(halaqa_id) or public.can_manage_halaqa(halaqa_id));
create policy sitems_select on public.incentive_statement_items for select to authenticated
  using (exists (select 1 from public.incentive_statements st where st.id = statement_id and public.can_view_halaqa(st.halaqa_id)));
create policy sitems_write on public.incentive_statement_items for all to authenticated
  using (exists (select 1 from public.incentive_statements st where st.id = statement_id and (public.is_halaqa_teacher(st.halaqa_id) or public.can_manage_halaqa(st.halaqa_id))))
  with check (exists (select 1 from public.incentive_statements st where st.id = statement_id and (public.is_halaqa_teacher(st.halaqa_id) or public.can_manage_halaqa(st.halaqa_id))));

-- التنبيهات الإدارية
create policy alerts_select on public.admin_alerts for select to authenticated using (
  issuer_id = auth.uid() or teacher_id = auth.uid() or public.is_project_supervisor()
  or (public.current_user_role() in ('admin_manager', 'technical_manager')
      and exists (select 1 from public.profiles t where t.id = teacher_id and public.in_section(t.gender))));
create policy alerts_insert on public.admin_alerts for insert to authenticated
  with check (public.current_user_role() in ('admin_manager', 'technical_manager', 'field_supervisor') and issuer_id = auth.uid());
create policy alerts_update on public.admin_alerts for update to authenticated
  using (issuer_id = auth.uid() or teacher_id = auth.uid() or public.is_admin_manager())
  with check (issuer_id = auth.uid() or teacher_id = auth.uid() or public.is_admin_manager());
```

- [ ] **Step 4: طبّق الهجرة** — MCP `apply_migration` (الاسم `v2_roles_rls`) على `qwtqfkayupzijcoguqrf`.

Expected: `{"success": true}`. إن فشلت: لا شيء طُبِّق (معاملة واحدة) — اقرأ الخطأ وصحّح الملف ثم أعد.

- [ ] **Step 5: شغّل كل بلوكات `v2_rls.sql`**

Expected: (أ) 9 حلقات و160 طالباً · (ب) 5 حلقات و0 بنين · (ج) حلقة المعلم وحدها · (د) صفّ الطالب وحده · (هـ) الإسناد في حلقته ينجح وفي غيرها `42501` · (و) `42501` · (ز) رسالة الحارس.

- [ ] **Step 6: افحص المنح** — كل دالّة نطاق لها `authenticated=X`:

```sql
select p.proname, array_to_string(p.proacl, ' ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('current_user_role','current_user_section','is_project_supervisor','is_admin_manager','is_full_admin','in_section','can_view_halaqa','can_manage_halaqa','can_assign_in_halaqa','is_halaqa_teacher','is_halaqa_examiner','my_student_id');
```

Expected: 12 صفّاً، كلٌّ فيه `authenticated=X/postgres`.

- [ ] **Step 7: ولّد الأنواع** — MCP `generate_typescript_types`، قارنها بالملف الحالي (`diff` بعد تطبيع التنسيق)، وطبّق الفروق الجوهرية فقط بـ Edit (النوع، الأعمدة الجديدة، الدوالّ).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261017120000_v2_roles_rls.sql supabase/tests/v2_rls.sql app/types/database.types.ts
git commit -m "feat(db): الأدوار السبعة والنطاق بالقسم وإعادة كتابة كل سياسات RLS"
```

---

### Task 3: ثوابت الأدوار وأعلام الصلاحيات في الواجهة

**Files:**
- Modify: `app/constants/roles.ts`
- Create: `app/composables/usePermissions.ts`
- Test: `app/constants/roles.test.ts`

**Interfaces — Produces:**
- `type Role` (من الأنواع) · `type Section = 'all' | 'male' | 'female'`
- `roleLabel(role: Role, gender: 'male' | 'female' | null): string`
- `MANAGER_ROLES: Role[] = ['admin_manager', 'technical_manager']` · `STAFF_ROLES: Role[]` (كل ما عدا `student`)
- `usePermissions()` → `{ role, isReadOnly, isAdmin, isFullAdmin, isManager, canAssign, isTeacher, isStudent, isFieldSupervisor, isExaminer }` (كلها `ComputedRef<boolean>`)

- [ ] **Step 1: الاختبار الفاشل** — `app/constants/roles.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { roleLabel } from './roles'

describe('roleLabel', () => {
  it('يؤنّث حسب الجنس', () => {
    expect(roleLabel('admin_manager', 'male')).toBe('المدير الإداري')
    expect(roleLabel('admin_manager', 'female')).toBe('المديرة الإدارية')
    expect(roleLabel('field_supervisor', 'female')).toBe('مشرفة ميدانية')
    expect(roleLabel('examiner', 'female')).toBe('مختبِرة')
  })
  it('بلا جنس = المذكّر', () => {
    expect(roleLabel('teacher', null)).toBe('معلم')
  })
})
```

- [ ] **Step 2: شغّله ليفشل** — `pnpm test` → FAIL: `roleLabel is not a function`

- [ ] **Step 3: أعد كتابة `app/constants/roles.ts`**

```ts
/** الأدوار ومسمّياتها — مصدر واحد. المسمّى = الدور + جنس صاحب الحساب. */
import type { Database } from '~/types/database.types'

export type Role = Database['public']['Enums']['user_role']
export type Section = Database['public']['Enums']['section_scope']
type Gender = 'male' | 'female'

const LABELS: Record<Role, Record<Gender, string>> = {
  project_supervisor: { male: 'مشرف المشروع', female: 'مشرفة المشروع' },
  admin_manager: { male: 'المدير الإداري', female: 'المديرة الإدارية' },
  technical_manager: { male: 'المدير الفني', female: 'المديرة الفنية' },
  field_supervisor: { male: 'مشرف ميداني', female: 'مشرفة ميدانية' },
  examiner: { male: 'مختبِر', female: 'مختبِرة' },
  teacher: { male: 'معلم', female: 'معلمة' },
  student: { male: 'طالب', female: 'طالبة' }
}

export function roleLabel(role: Role, gender: Gender | null): string {
  return LABELS[role][gender ?? 'male']
}

export const MANAGER_ROLES: Role[] = ['admin_manager', 'technical_manager']
export const STAFF_ROLES: Role[] = ['project_supervisor', 'admin_manager', 'technical_manager', 'field_supervisor', 'examiner', 'teacher']
export const SECTION_LABEL: Record<Section, string> = { all: 'القسمان', male: 'قسم البنين', female: 'قسم البنات' }
```

- [ ] **Step 4: `app/composables/usePermissions.ts`**

```ts
/**
 * أعلام الواجهة المشتقّة من الدور — طبقة تجربة فقط؛ الحكم لـ RLS في القاعدة.
 * مشرف المشروع يرى كل الشاشات بلا أزرار كتابة (isReadOnly).
 */
export function usePermissions() {
  const { role, profile } = useProfile()
  const is = (r: string) => computed(() => role.value === r)
  const section = computed(() => profile.value?.section ?? 'all')
  const isAdmin = is('admin_manager')
  return {
    role,
    section,
    isReadOnly: is('project_supervisor'),
    isAdmin,
    isFullAdmin: computed(() => isAdmin.value && section.value === 'all'),
    isManager: computed(() => role.value === 'admin_manager' || role.value === 'technical_manager'),
    canAssign: computed(() => ['admin_manager', 'technical_manager', 'field_supervisor'].includes(role.value ?? '')),
    isTeacher: is('teacher'),
    isStudent: is('student'),
    isFieldSupervisor: is('field_supervisor'),
    isExaminer: is('examiner')
  }
}
```

- [ ] **Step 5: شغّل الاختبارات** — `pnpm test` → PASS

- [ ] **Step 6: Commit**

```bash
git add app/constants/roles.ts app/constants/roles.test.ts app/composables/usePermissions.ts
git commit -m "feat(ui): مسمّيات الأدوار بالجنس وأعلام الصلاحيات"
```

---

### Task 4: دخول الموظف بالرقم الوظيفي والطالب بالهوية

**Files:**
- Create: `server/api/auth/staff-login.post.ts`
- Modify: `app/composables/useAuth.ts`, `app/pages/login.vue`, `app/middleware/auth.global.ts` (الطالب ← `/me`)

**Interfaces:**
- Consumes: `classifyLoginId`, `studentEmailFromIdentity`, `staffEmailFromNumber` (Task 1)
- Produces: `POST /api/auth/staff-login {employeeNumber, password} → {accessToken, refreshToken}` · `useAuth().signInWithIdentifier(id: string, password: string): Promise<void>`

- [ ] **Step 1: مسار الخادم** — `server/api/auth/staff-login.post.ts`

```ts
/**
 * دخول الموظف بالرقم الوظيفي (منقول من الصحابة).
 * ⚠️ الترجمة في الخادم: الرقم ← الملف ← البريد الداخلي، ثم دخولٌ بعميلٍ بلا حفظ جلسة،
 * وتُعاد الرموز ليضعها المتصفّح. ⚠️ رسالةٌ واحدة لكل فشل كي لا يصير الباب عدّاداً للأرقام.
 */
import { createClient } from '@supabase/supabase-js'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~/types/database.types'
import { isValidEmployeeNumber, normalizeDigits } from '~/constants/identity'
import { staffEmailFromNumber } from '~/constants/accounts'

const REJECTION = 'الرقم أو كلمة المرور غير صحيحة.'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ employeeNumber?: string, password?: string }>(event)
  const employeeNumber = normalizeDigits(body.employeeNumber?.trim() ?? '')
  const password = body.password ?? ''
  if (!isValidEmployeeNumber(employeeNumber) || !password) {
    throw createError({ statusCode: 401, statusMessage: REJECTION })
  }

  const admin = serverSupabaseServiceRole<Database>(event)
  const { data: profile } = await admin.from('profiles')
    .select('id, status').eq('employee_number', employeeNumber).maybeSingle()
  if (!profile || profile.status !== 'active') {
    throw createError({ statusCode: 401, statusMessage: REJECTION })
  }

  const config = useRuntimeConfig()
  const anon = createClient(config.public.supabase.url as string, config.public.supabase.key as string, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const { data, error } = await anon.auth.signInWithPassword({ email: staffEmailFromNumber(employeeNumber), password })
  if (error || !data.session) throw createError({ statusCode: 401, statusMessage: REJECTION })

  return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token }
})
```

- [ ] **Step 2: `useAuth` — استبدل `signIn` و`sendPasswordReset` بـ `signInWithIdentifier`**

```ts
import type { Database } from '~/types/database.types'
import { classifyLoginId, LOGIN_ID_ERROR } from '~/constants/identity'
import { studentEmailFromIdentity } from '~/constants/accounts'

/**
 * المصادقة — الموظف برقمه الوظيفي (عبر الخادم)، والطالب برقم هويته (مباشرةً).
 * لا بريد ولا استعادة ذاتية: كلمة المرور يعيد تعيينها المدير الإداري.
 */
export function useAuth() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  async function signInWithIdentifier(identifier: string, password: string) {
    const id = classifyLoginId(identifier)
    if (id.kind === 'invalid') throw new Error(LOGIN_ID_ERROR)

    if (id.kind === 'staff') {
      const tokens = await $fetch<{ accessToken: string, refreshToken: string }>('/api/auth/staff-login', {
        method: 'POST', body: { employeeNumber: id.id, password }
      })
      const { error } = await supabase.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken })
      if (error) throw error
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: studentEmailFromIdentity(id.id), password })
      if (error) throw new Error('الرقم أو كلمة المرور غير صحيحة.')
    }

    const { data: auth } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('status').eq('id', auth.user!.id).single()
    if (profile?.status !== 'active') {
      await supabase.auth.signOut()
      throw new Error('account_disabled')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    await navigateTo('/login')
  }

  return { user, signInWithIdentifier, signOut }
}
```

- [ ] **Step 3: `login.vue`** — الحقل `state.email` يصير `state.identifier` بتسمية «الرقم الوظيفي أو رقم الهوية» و`inputmode="numeric"` و`dir="ltr"`؛ التحقّق `classifyLoginId(s.identifier).kind !== 'invalid'` وإلا `LOGIN_ID_ERROR`؛ `onSubmit` يستدعي `signInWithIdentifier`؛ احذف نافذة الاستعادة كلّها (`forgotOpen`… و`openForgot`/`sendReset`) واستبدل زرّ «نسيت كلمة المرور؟» بنصّ: «نسيت كلمة المرور؟ تواصل مع المدير الإداري.» وغيّر JSDoc أعلى الملف.

- [ ] **Step 4: التوجيه** — في `pages/dashboard.vue` أضف جانب تحويل المختبِر: `if (r === 'student') navigateTo('/me', { replace: true })`.

- [ ] **Step 5: تحقّق** — `pnpm lint` و`pnpm typecheck` (خادم التطوير موقوف: `.nuxt` مشترك). ثم شغّل خادم التطوير (`torjoman-dev`) وجرّب بحساب موظف تجريبي (Task 5 تنشئه) — الرقم الخاطئ وكلمة المرور الخاطئة يعطيان الرسالة نفسها.

- [ ] **Step 6: Commit**

```bash
git add server/api/auth/staff-login.post.ts app/composables/useAuth.ts app/pages/login.vue app/pages/dashboard.vue
git commit -m "feat(auth): الدخول بالرقم الوظيفي أو الهوية بلا بريد"
```

---

### Task 5: إنشاء الحسابات (موظفون وطلاب) وإعادة تعيين كلمة المرور

**Files:**
- Modify: `server/utils/supabaseAdmin.ts`, `server/api/users.post.ts`, `server/api/users/reset-password.post.ts`
- Create: `server/api/students.post.ts`

**Interfaces:**
- Produces: `requireAdminManager(event) → { admin, user, section: Section }` · `POST /api/users {full_name, role, gender, section?, phone?} → {id, employee_number}` · `POST /api/students {full_name, gender, national_id, halaqa_id?, birth_date?, guardian_phone?} → {id, user_id}`

- [ ] **Step 1: `requireAdminManager`** — يستبدل `requireManager`:

```ts
export async function requireAdminManager(event: H3Event) {
  const client = await serverSupabaseClient<Database>(event)
  const { data: { user } } = await client.auth.getUser()
  if (!user?.id) throw createError({ statusCode: 401, statusMessage: 'يلزم تسجيل الدخول.' })
  const admin = serverSupabaseServiceRole<Database>(event)
  const { data: profile } = await admin.from('profiles').select('role, section, status').eq('id', user.id).single()
  if (!profile || profile.status !== 'active' || profile.role !== 'admin_manager') {
    throw createError({ statusCode: 403, statusMessage: 'هذه العملية للمدير الإداري فقط.' })
  }
  return { admin, user, section: profile.section }
}

/** المديرة الإدارية (قسم البنات) لا تنشئ ولا تعدّل إلا ضمن قسمها. */
export function assertInSection(section: Database['public']['Enums']['section_scope'], gender: 'male' | 'female') {
  if (section !== 'all' && section !== gender) {
    throw createError({ statusCode: 403, statusMessage: 'خارج نطاق قسمك.' })
  }
}
```

وابحث عن كل `requireManager(` في `server/` واستبدله (`grep -rn "requireManager" server`).

- [ ] **Step 2: `users.post.ts`** — يأخذ رقماً من `claim_employee_number`، ينشئ حساب Auth ببريد `staffEmailFromNumber(no)` مؤكَّداً، ثم الملف:

```ts
import { requireAdminManager, assertInSection } from '../utils/supabaseAdmin'
import { staffEmailFromNumber } from '~/constants/accounts'
import { STAFF_ROLES, type Role, type Section } from '~/constants/roles'
import type { Database } from '~/types/database.types'

type Gender = Database['public']['Enums']['gender_type']

export default defineEventHandler(async (event) => {
  const { admin, user, section: mySection } = await requireAdminManager(event)
  const body = await readBody<{ full_name?: string, role?: Role, gender?: Gender, section?: Section, phone?: string, password?: string }>(event)

  const fullName = body.full_name?.trim()
  const role = body.role
  const gender = body.gender
  const password = body.password ?? ''
  if (!fullName) throw createError({ statusCode: 400, statusMessage: 'الاسم الكامل مطلوب.' })
  if (!role || !STAFF_ROLES.includes(role)) throw createError({ statusCode: 400, statusMessage: 'الدور غير صالح.' })
  if (gender !== 'male' && gender !== 'female') throw createError({ statusCode: 400, statusMessage: 'الجنس مطلوب.' })
  if (password.length < 8) throw createError({ statusCode: 400, statusMessage: 'كلمة المرور 8 أحرف على الأقل.' })
  assertInSection(mySection, gender)

  // القسم للإداري/الفني فقط؛ والمديرة الإدارية لا تمنح «الكل»
  const section: Section = (role === 'admin_manager' || role === 'technical_manager')
    ? (body.section ?? (gender === 'female' && role === 'admin_manager' ? 'female' : 'all'))
    : 'all'
  if (mySection !== 'all' && section === 'all' && (role === 'admin_manager' || role === 'technical_manager')) {
    throw createError({ statusCode: 403, statusMessage: 'لا تمنح نطاق القسمين.' })
  }

  const { data: employeeNumber, error: seqErr } = await admin.rpc('claim_employee_number')
  if (seqErr || !employeeNumber) throw createError({ statusCode: 500, statusMessage: 'تعذّر توليد الرقم الوظيفي.' })

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: staffEmailFromNumber(employeeNumber), password, email_confirm: true, user_metadata: { full_name: fullName }
  })
  if (authErr || !created.user) throw createError({ statusCode: 400, statusMessage: authErr?.message ?? 'تعذّر إنشاء الحساب.' })

  const { error: profErr } = await admin.from('profiles').upsert({
    id: created.user.id, full_name: fullName, role, gender, section, employee_number: employeeNumber,
    phone: body.phone?.trim() || null, status: 'active', must_change_password: true, assigned_by: user.id
  }, { onConflict: 'id' })
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    throw createError({ statusCode: 500, statusMessage: `تعذّر حفظ الملف: ${profErr.message}` })
  }
  return { id: created.user.id, employee_number: employeeNumber }
})
```

- [ ] **Step 3: `students.post.ts`** — ينشئ حساب Auth ببريد الهوية + ملفاً بدور `student` + صفّ `students` مربوطاً:

```ts
import { requireAdminManager, assertInSection } from '../utils/supabaseAdmin'
import { isValidIdentity, normalizeDigits, IDENTITY_ERROR } from '~/constants/identity'
import { studentEmailFromIdentity } from '~/constants/accounts'
import type { Database } from '~/types/database.types'

type Gender = Database['public']['Enums']['gender_type']

export default defineEventHandler(async (event) => {
  const { admin, user, section } = await requireAdminManager(event)
  const body = await readBody<{ full_name?: string, gender?: Gender, national_id?: string, halaqa_id?: string | null, birth_date?: string | null, guardian_phone?: string | null, password?: string }>(event)

  const fullName = body.full_name?.trim()
  const nationalId = normalizeDigits(body.national_id?.trim() ?? '')
  const password = body.password ?? ''
  if (!fullName) throw createError({ statusCode: 400, statusMessage: 'اسم الطالب مطلوب.' })
  if (body.gender !== 'male' && body.gender !== 'female') throw createError({ statusCode: 400, statusMessage: 'الجنس مطلوب.' })
  if (!isValidIdentity(nationalId)) throw createError({ statusCode: 400, statusMessage: IDENTITY_ERROR })
  if (password.length < 8) throw createError({ statusCode: 400, statusMessage: 'كلمة المرور 8 أحرف على الأقل.' })
  assertInSection(section, body.gender)

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: studentEmailFromIdentity(nationalId), password, email_confirm: true, user_metadata: { full_name: fullName }
  })
  if (authErr || !created.user) {
    const dup = /already|exists|registered/i.test(authErr?.message ?? '')
    throw createError({ statusCode: 400, statusMessage: dup ? 'رقم الهوية مسجّل لطالب آخر.' : (authErr?.message ?? 'تعذّر إنشاء الحساب.') })
  }
  const uid = created.user.id
  const rollback = () => admin.auth.admin.deleteUser(uid)

  const { error: profErr } = await admin.from('profiles').insert({
    id: uid, full_name: fullName, role: 'student', gender: body.gender, status: 'active', must_change_password: true, assigned_by: user.id
  })
  if (profErr) { await rollback(); throw createError({ statusCode: 500, statusMessage: profErr.message }) }

  const { data: student, error: stuErr } = await admin.from('students').insert({
    full_name: fullName, gender: body.gender, national_id: nationalId, user_id: uid,
    halaqa_id: body.halaqa_id || null, birth_date: body.birth_date || null,
    guardian_phone: body.guardian_phone || null, created_by: user.id, status: 'active'
  }).select('id').single()
  if (stuErr) { await admin.from('profiles').delete().eq('id', uid); await rollback(); throw createError({ statusCode: 400, statusMessage: stuErr.message }) }

  return { id: student.id, user_id: uid }
})
```

- [ ] **Step 4: `reset-password.post.ts`** — `requireAdminManager` + جلب جنس الهدف و`assertInSection(section, target.gender)` قبل التعيين.

- [ ] **Step 5: تحقّق يدوي على القاعدة** — بعد تسجيل دخول مدير إداري تجريبي في خادم التطوير: أنشئ موظفاً (يعود `employee_number` = التالي في التسلسل) وطالباً (هوية 9 خانات)، ثم ادخل بكلٍّ منهما. واحذفهما بعدها من لوحة المستخدمين.

- [ ] **Step 6: Commit**

```bash
git add server/utils/supabaseAdmin.ts server/api/users.post.ts server/api/students.post.ts server/api/users/reset-password.post.ts
git commit -m "feat(accounts): إنشاء حسابات الموظفين برقمٍ مولَّد والطلاب بالهوية — للمدير الإداري"
```

---

### Task 6: الواجهة للأدوار الجديدة

**Files:** `app/layouts/dashboard.vue`، و`app/pages/{users,halqat,students,visits,exams,reports,alerts,finance,minutes,news,supervisors,metrics,profile,incentives,exam-plan}/…`، و`app/pages/dashboard.vue`، و`app/composables/useNotifications.ts`، و`app/components/exams/ResultsBrowser.vue`، و`app/components/finance/Salaries.vue`.

**Interfaces:** Consumes `usePermissions()`, `roleLabel`, `MANAGER_ROLES`, `SECTION_LABEL` (Task 3).

- [ ] **Step 1: احصر المواضع** — `grep -rnE "'(manager|quality|supervisor)'" app server | grep -v database.types` (70 موضعاً في 21 ملفاً عند كتابة الخطة).

- [ ] **Step 2: طبّق جدول الاستبدال في كل موضع**

| القديم | الجديد |
|---|---|
| `role === 'manager'` لكتابةٍ عامّة | `isManager` (إداري أو فني) — أو `isAdmin` للحسابات والحوافز والحذف |
| `role === 'manager'` للمالية/الأخبار/المحاضر/الإعدادات | `isFullAdmin` |
| `'quality'` | `'technical_manager'` |
| `'supervisor'` (الدور) | `'field_supervisor'` |
| `roles: [...]` في القائمة الجانبية | تُضاف `project_supervisor` لكل عنصر قراءة، و`student` لا يرى إلا «صفحتي» |
| أزرار الكتابة | `v-if="!isReadOnly && …"` |
| `ROLE_LABEL[x]` | `roleLabel(x, gender)` |

> ⚠️ `supervisor_id` و`supervisor:supervisor_id(...)` أعمدةٌ لا أدوار — لا تُغيَّر. وكل `quality_supervisor_id` يُحذف (العمود سقط): صفحات `supervisors/*` و`profile/[id].vue` و`dashboard.vue` (لوحة الجودة تصير لوحة المدير الفني).

- [ ] **Step 3: `users/index.vue`** — نموذج الإنشاء: الدور من `STAFF_ROLES` بمسمّياته، الجنس إلزامي، القسم يظهر للإداري/الفني؛ لا حقل بريد (يُحذف)؛ بعد الإنشاء رسالة «الرقم الوظيفي: 1003» قابلة للنسخ. عمود «الرقم الوظيفي» في الجدول. زرّ «إعادة تعيين كلمة المرور» للإداري.

- [ ] **Step 4: `students/index.vue`** — «إضافة طالب» للإداري تستدعي `POST /api/students` (الهوية إلزامية)؛ الإسناد (اختيار الحلقة) لمن `canAssign`؛ المعلم لا يضيف.

- [ ] **Step 5: تحقّق** — `pnpm lint` و`pnpm typecheck` (خادم التطوير موقوف) ثم `grep -rnE "'(manager|quality|supervisor)'" app server | grep -v database.types` = 0.

- [ ] **Step 6: Commit**

```bash
git add app server
git commit -m "feat(ui): الشاشات والقوائم للأدوار السبعة ومشرف المشروع للعرض فقط"
```

---

### Task 6b: الصورة الشخصية (منقولة من الصحابة) — طلب المستخدم 2026-10-18

> قرار المستخدم: لكل مستخدم صورة اختيارية (موظفون وطلاب)، **ولا صور في قسم البنات** — أي حساب `gender = 'female'` لا صورة له، والقاعدة ترفض الرفع، والعرض الحرف الأول دائماً (كقرار الصحابة 2026-10-07 لمدارس البنات).

**المرجع للنقل (اقرأه قبل الكتابة):** في `/Users/aboomar/Developer/sahaba-schools`:
- `supabase/migrations/20260927120000_employee_photo.sql` (+ `20260928120000_employee_photo_write_guards.sql`) — مخزن خاص، مسار ثابت `<id>/photo.webp`، روابط موقَّعة لساعة.
- `app/components/profile/Avatar.vue` — صورة أو الحرف الأول، ويسقط إلى الحرف عند فشل التحميل.
- `app/components/employees/PhotoField.vue` + `app/composables/useEmployeePhoto.ts` — تصغير في المتصفح إلى WebP، رفع `upsert`، إزالة.
- `app/composables/useEmployeePhotoUrls.ts` (ذاكرة الروابط الموقَّعة) + `app/composables/useMyPhoto.ts` (صورة صاحب الحساب للشريط).
- اختباراتها: `app/constants/employeePhoto.test.ts`, `app/composables/useMyPhoto.test.ts`, `app/components/employees/photoField.test.ts`.

**Files:**
- Create: `supabase/migrations/<version>_profile_photos.sql`, `app/components/profile/Avatar.vue`, `app/components/profile/PhotoField.vue`, `app/composables/useProfilePhoto.ts`, `app/composables/useProfilePhotoUrls.ts`, `app/composables/useMyPhoto.ts`, `app/constants/profilePhoto.ts` (+ اختبار)
- Modify: `app/pages/profile/[id].vue` (يستبدل رفع `avatar_url` القديم)، `app/layouts/dashboard.vue` (صورة الشريط)، قوائم المستخدمين والطلاب وملف الطالب وصفحة `/me` (المهمة 7) لعرض `ProfileAvatar`.

**القاعدة:**
- `profiles.photo_path text` بقيد: `photo_path is null or (photo_path = id::text || '/photo.webp' and gender is distinct from 'female')`.
- مخزن **خاص** `profile-photos` (حدّ 262144 بايت، webp/png/jpeg).
- سياسات `storage.objects` للمخزن: **القراءة** (توليد الرابط الموقَّع) لصاحب الصورة، ولمن يرى ملفه بحسب RLS `profiles` (الموظفون يرون كل الملفات، والطالب ملفه فقط)؛ **الكتابة/الحذف** لصاحب المجلّد `<auth.uid()>/photo.webp` أو `is_admin_manager()`، وفقط إن لم يكن صاحب المجلّد أنثى. احترس من `storage.foldername()` الذي يعيد NULL للأسماء الجذرية (`coalesce(…, false)`).
- `avatar_url` في `profiles` و`students` يبقى ولا يُستعمل (يُحذف لاحقاً بعد النشر — درس «إسقاط العمود بعد النشر»).

**التحقّق:** اختبارات Vitest المنقولة والمكيَّفة تمرّ؛ واختبار سياسات بجلسة: موظف ذكر يرفع لنفسه ✅، لغيره ❌، أنثى ترفع لنفسها ❌ (القيد/السياسة)، المدير الإداري يرفع لموظف ذكر ✅، الطالب يقرأ صورة غيره ❌.

**Commit:** `feat(photos): الصورة الشخصية الاختيارية منقولةً من الصحابة — بلا صور لقسم البنات`

---

### Task 7: صفحة الطالب `/me`

**Files:** Create `app/pages/me.vue`؛ Modify `app/layouts/dashboard.vue` (عنصر «صفحتي» للطالب).

- [ ] **Step 1: الصفحة** — تجلب `students` حيث `user_id = auth.uid()` (RLS يقصرها عليه) ثم تعرض البطاقات والرحلة بإعادة استعمال ما في `pages/students/[id].vue` و`components/StudentJourney.vue` للقراءة فقط (بلا أزرار تعديل).

```vue
<script setup lang="ts">
/** صفحة الطالب — ملفّه ورحلته للقراءة (تُوسَّع في الأولوية ٢ بالحضور والإنجاز). */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'صفحتي — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { data: me, pending } = useLazyAsyncData('my-student', async () => {
  const { data } = await supabase.from('students').select('*, halaqa:halaqa_id(name)').maybeSingle()
  return data
}, { server: false })
</script>
```

وفي القالب: `UiPageHeader` باسم الطالب، وبطاقة البيانات الأساسية، و`<StudentJourney :student-id="me.id" />` — بنفس خصائص استعماله في `students/[id].vue`.

- [ ] **Step 2: تحقّق** — ادخل بطالب تجريبي (Task 5) فتفتح `/me` وتعرض بياناته وحده.

- [ ] **Step 3: Commit**

```bash
git add app/pages/me.vue app/layouts/dashboard.vue
git commit -m "feat(student): صفحة الطالب بحسابه"
```

---

### Task 8: التوثيق والدمج (بلا حذف)

- [ ] **Step 1:** حدّث `CLAUDE.md` (جدول الأدوار ومصفوفة الصلاحيات ومبدأ الطالب صار له حساب)، و`docs/DATABASE.md` (الدور، `section`، `employee_number`، `students.user_id`، الدوالّ)، و`docs/PAGES.md`، و`docs/FEATURES.md`، و`docs/ROADMAP.md` (المهام 2–7 ✅).
- [ ] **Step 2:** `pnpm test && pnpm lint && pnpm typecheck` كلّها خضراء.
- [ ] **Step 3:** Commit `docs: توثيق أساس الإصدار الثاني`، ثم **اطلب إذن المستخدم** للدمج في `dev` و`main` (قاعدة: إذنٌ صريح كل مرّة)، وتحقّق بعد الدفع بـ `git ls-remote`.

---

### Task 9: حذف البيانات التجريبية وأول حساب (بتأكيد المستخدم لحظتها)

> ⚠️ **يُنفَّذ بعد Task 5 مباشرةً، قبل Task 6** — لا في آخر الخطة: بعد Task 4 لا يدخل أحدٌ ببريد،
> والحسابات التجريبية بلا رقمٍ وظيفي، فلا حساب يُختبر به Task 6 و7 إلا المدير الإداري الأول.
> والحسابات الأخرى للاختبار تُنشأ من `/users` بعده.

- [ ] **Step 1: اطلب التأكيد صراحةً** بنصّ: «سأحذف كل البيانات التجريبية (X طالب، Y حلقة، Z حساباً) وأبقي خطة الاختبارات والإعدادات. أؤكّد؟» — ولا تتابع بلا «نعم».

- [ ] **Step 2: التفريغ** — MCP `execute_sql`:

```sql
begin;
truncate public.exam_results, public.exam_list_items, public.exam_lists,
  public.monthly_report_students, public.monthly_report_activities, public.monthly_reports,
  public.incentive_statement_items, public.incentive_statements, public.halaqa_incentives,
  public.visit_reschedule_log, public.supervision_visits, public.admin_alerts,
  public.financial_transactions, public.monthly_salaries, public.profile_financials,
  public.meeting_minutes, public.news, public.students, public.halaqat restart identity cascade;
delete from public.profiles;
delete from auth.users;
alter sequence public.employee_number_seq restart with 1001;
commit;
select (select count(*) from public.exam_plan) plan_kept, (select count(*) from public.app_settings) settings_kept,
       (select count(*) from auth.users) users_left, (select count(*) from public.students) students_left;
```

Expected: `plan_kept = 12`، `settings_kept = 1`، والباقي `0`. ثم احذف ملفات المخزن `media` القديمة بالمفتاح السرّي (3 ملفات).

- [ ] **Step 3: أول مدير إداري** — بسكربت `withenv.py` (لا أسرار في المحادثة): `claim_employee_number` → `1001`، وحساب Auth ببريد `1001@staff.torjoman.org` وكلمة مرور افتراضية مولَّدة، وملف `role=admin_manager, section=all, gender=male, must_change_password=true`. سلّم المستخدم الرقم وكلمة المرور ويغيّرها عند أول دخول.

- [ ] **Step 4: تحقّق** — الدخول بـ `1001` على `torjoman.org` يفتح اللوحة، و`/users` يعرض حساباً واحداً.
