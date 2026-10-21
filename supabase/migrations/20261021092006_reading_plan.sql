-- ============================================================
-- خطّةُ القراءة الشهرية (طلبُ المستخدم 2026-10-21): مقرّراتٌ شهريةٌ متتابعة من كتب، لكلّ مقرّرٍ بنكُ أسئلة
-- (100 سؤال، أربعةُ خيارات)، والطالبُ يختبر نفسه: 20 سؤالاً عشوائياً في 20 دقيقة، والنجاحُ 80٪، والإعادةُ بعد
-- أسبوعٍ من الرسوب، ولا ينتقل إلى المقرّر التالي حتى ينجح في الذي قبله. لكلّ طالبٍ مسارُه (الملتحقُ متأخّراً
-- يبدأ من الأول). الخطّةُ واحدةٌ للبنين والبنات.
--
-- الأمان:
-- · الإجابةُ الصحيحة لا تصل إلى جهاز الطالب أبداً: `reading_questions` لا يقرؤها إلا المديران، والأسئلةُ
--   تصل الطالبَ من `start_reading_test()` بلا إجابات وبخياراتٍ مخلوطة، والتصحيحُ في `submit_reading_test()`.
-- · لا كتابةَ مباشرة في `reading_attempts` لأحد — الدالّتان وحدهما (والمديرُ الإداريّ يحذف محاولةً خاطئة).
-- · النيابةُ لا تقدّم الاختبار عن الطالب ولو في وضع التعديل.
-- ============================================================

create table public.reading_books (
  id          smallint generated always as identity primary key,
  title       text not null unique check (btrim(title) <> ''),
  author      text,
  pages       smallint check (pages > 0),
  description text,
  created_at  timestamptz not null default now()
);

create table public.reading_units (
  id         smallint generated always as identity primary key,
  sort_order smallint not null unique check (sort_order > 0),
  title      text not null check (btrim(title) <> ''),
  created_at timestamptz not null default now()
);

-- مقرّرُ الشهر قد يجمع أكثر من كتاب (الشهر الثالث: صفقات رابحة 165–196 + اليوم النبوي 1–124)
create table public.reading_unit_parts (
  id        smallint generated always as identity primary key,
  unit_id   smallint not null references public.reading_units (id) on delete cascade,
  book_id   smallint not null references public.reading_books (id) on delete restrict,
  page_from smallint not null check (page_from > 0),
  page_to   smallint not null,
  sort_order smallint not null default 1,
  constraint reading_unit_parts_range check (page_to >= page_from)
);
create index reading_unit_parts_unit on public.reading_unit_parts (unit_id);

create table public.reading_questions (
  id         bigint generated always as identity primary key,
  unit_id    smallint not null references public.reading_units (id) on delete cascade,
  body       text not null check (btrim(body) <> ''),
  options    text[] not null check (array_length(options, 1) = 4 and array_position(options, null) is null),
  correct    smallint not null check (correct between 0 and 3),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index reading_questions_unit on public.reading_questions (unit_id) where active;

create table public.reading_attempts (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students (id) on delete cascade,
  unit_id      smallint not null references public.reading_units (id) on delete restrict,
  question_ids bigint[] not null,
  total        smallint not null check (total > 0),
  started_at   timestamptz not null default now(),
  deadline_at  timestamptz not null,
  submitted_at timestamptz,
  answers      jsonb,
  score        smallint,
  percent      smallint,
  passed       boolean
);
create index reading_attempts_student_unit on public.reading_attempts (student_id, unit_id);
-- محاولةٌ مفتوحةٌ واحدةٌ للطالب (ويمنع السباقَ بين نقرتين)
create unique index reading_attempts_one_open on public.reading_attempts (student_id) where submitted_at is null;

-- الإعداداتُ قابلةٌ للضبط لاحقاً بلا هجرة
alter table public.app_settings
  add column reading_pass_mark      smallint not null default 80 check (reading_pass_mark between 1 and 100),
  add column reading_test_questions smallint not null default 20 check (reading_test_questions between 1 and 100),
  add column reading_test_minutes   smallint not null default 20 check (reading_test_minutes between 1 and 180),
  add column reading_retry_days     smallint not null default 7 check (reading_retry_days between 0 and 60);

-- ═══ RLS ═══
alter table public.reading_books enable row level security;
alter table public.reading_units enable row level security;
alter table public.reading_unit_parts enable row level security;
alter table public.reading_questions enable row level security;
alter table public.reading_attempts enable row level security;

-- الخطّةُ يقرؤها كلُّ مسجَّل، ويكتبها المديران (كخطة الاختبارات)
create policy reading_books_select on public.reading_books for select to authenticated using (true);
create policy reading_books_write on public.reading_books for all to authenticated
  using (public.current_user_role() in ('admin_manager', 'technical_manager'))
  with check (public.current_user_role() in ('admin_manager', 'technical_manager'));
create policy reading_units_select on public.reading_units for select to authenticated using (true);
create policy reading_units_write on public.reading_units for all to authenticated
  using (public.current_user_role() in ('admin_manager', 'technical_manager'))
  with check (public.current_user_role() in ('admin_manager', 'technical_manager'));
create policy reading_unit_parts_select on public.reading_unit_parts for select to authenticated using (true);
create policy reading_unit_parts_write on public.reading_unit_parts for all to authenticated
  using (public.current_user_role() in ('admin_manager', 'technical_manager'))
  with check (public.current_user_role() in ('admin_manager', 'technical_manager'));

-- البنكُ للمديرين وحدهم — لا الطالبُ ولا المعلم (لا تتسرّب الإجابات)
create policy reading_questions_manage on public.reading_questions for all to authenticated
  using (public.current_user_role() in ('admin_manager', 'technical_manager'))
  with check (public.current_user_role() in ('admin_manager', 'technical_manager'));

-- المحاولات: الطالبُ محاولاتِه، والعاملُ طلابَ نطاقه؛ ولا إدراجَ ولا تعديل إلا عبر الدالّتين
create policy reading_attempts_select on public.reading_attempts for select to authenticated using (
  student_id = (select public.my_student_id())
  or public.current_user_role() in ('admin_manager', 'technical_manager', 'project_supervisor')
  or exists (
    select 1 from public.students s
    where s.id = reading_attempts.student_id
      and s.halaqa_id = any ((select public.visible_halaqa_ids())::uuid[])
  )
);
create policy reading_attempts_delete on public.reading_attempts for delete to authenticated
  using ((select public.is_admin_manager()));

-- حرّاسُ النيابة (قراءةٌ فقط) على الجداول الجديدة
select private.guard_table_for_impersonation('public.reading_books');
select private.guard_table_for_impersonation('public.reading_units');
select private.guard_table_for_impersonation('public.reading_unit_parts');
select private.guard_table_for_impersonation('public.reading_questions');
select private.guard_table_for_impersonation('public.reading_attempts');

-- ═══ الدوالّ ═══
-- نصُّ المحاولة للطالب: الأسئلةُ بترتيبها، وكلُّ خيارٍ بمفتاحه الأصليّ (k) مخلوطاً — بلا الإجابة الصحيحة.
-- (invoker: لا تُنادى إلا من الدالّتين المالكتين أدناه)
create or replace function private.reading_attempt_payload(p_attempt uuid)
returns jsonb language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'attempt_id', a.id,
    'unit_id', u.id,
    'unit_title', u.title,
    'unit_order', u.sort_order,
    'deadline_at', a.deadline_at,
    'total', a.total,
    'questions', (
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'body', q.body,
        'options', (
          select jsonb_agg(jsonb_build_object('k', o.k - 1, 'text', o.t) order by random())
          from unnest(q.options) with ordinality as o(t, k)
        )
      ) order by x.ord)
      from unnest(a.question_ids) with ordinality as x(qid, ord)
      join public.reading_questions q on q.id = x.qid
    )
  )
  from public.reading_attempts a
  join public.reading_units u on u.id = a.unit_id
  where a.id = p_attempt;
$$;

-- يصحّح المحاولة ويختمها. الإجاباتُ تُنقّى (أسئلةُ المحاولة وحدها، ومفتاحٌ 0–3). المتأخّرُ عن المهلة
-- (+5 دقائق سماحاً للشبكة) يُختم بلا إجابات، ووقتُه المهلةُ لا لحظةُ الختم — فالانتظارُ يُحسب منها.
create or replace function private.grade_reading_attempt(p_attempt uuid, p_answers jsonb)
returns public.reading_attempts language plpgsql set search_path = ''
as $$
declare
  a public.reading_attempts;
  v_answers jsonb;
  v_score int;
  v_pass int;
  v_late boolean;
begin
  perform private.assert_session_writable();
  select * into a from public.reading_attempts where id = p_attempt for update;
  if a.submitted_at is not null then return a; end if;

  v_late := now() > a.deadline_at + interval '5 minutes';
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_answers
  from jsonb_each_text(case when v_late then '{}'::jsonb else coalesce(p_answers, '{}'::jsonb) end) e
  where e.key ~ '^\d+$' and e.key::bigint = any (a.question_ids) and e.value in ('0', '1', '2', '3');

  select count(*) into v_score
  from public.reading_questions q
  where q.id = any (a.question_ids) and (v_answers ->> q.id::text)::smallint = q.correct;

  select reading_pass_mark into v_pass from public.app_settings where id = 1;

  update public.reading_attempts
     set submitted_at = case when v_late then a.deadline_at else now() end,
         answers = v_answers,
         score = v_score,
         percent = round(v_score * 100.0 / a.total),
         passed = round(v_score * 100.0 / a.total) >= coalesce(v_pass, 80)
   where id = p_attempt
   returning * into a;
  return a;
end;
$$;

revoke all on function private.reading_attempt_payload(uuid) from public, anon, authenticated;
revoke all on function private.grade_reading_attempt(uuid, jsonb) from public, anon, authenticated;

-- يبدأ الاختبارَ في المقرّر المستحقّ (أو يستأنف المفتوحَ ما بقي وقته) ويُرجع الأسئلة بلا إجابات.
create or replace function public.start_reading_test()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_student public.students;
  v_settings public.app_settings;
  v_open public.reading_attempts;
  v_last public.reading_attempts;
  v_unit public.reading_units;
  v_ids bigint[];
  v_id uuid;
begin
  perform private.assert_session_writable();
  if (select private.is_impersonating()) then
    raise exception 'لا يُقدَّم الاختبار بالنيابة عن الطالب.' using errcode = '42501';
  end if;
  if public.current_user_role() is distinct from 'student' then
    raise exception 'الاختبارُ للطالب نفسه.' using errcode = '42501';
  end if;
  select * into v_student from public.students where user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'لا يوجد سجلّ طالبٍ نشطٍ لحسابك.' using errcode = 'P0002';
  end if;
  select * into v_settings from public.app_settings where id = 1;

  -- محاولةٌ مفتوحة: تُستأنف ما بقي وقتُها، وإلا تُختم (بما حُفظ) ثم يُكمل
  select * into v_open from public.reading_attempts where student_id = v_student.id and submitted_at is null;
  if found then
    if v_open.deadline_at > now() then
      return private.reading_attempt_payload(v_open.id);
    end if;
    perform private.grade_reading_attempt(v_open.id, v_open.answers);
  end if;

  -- المقرّرُ المستحقّ: أوّلُ مقرّرٍ لم ينجح فيه
  select u.* into v_unit from public.reading_units u
  where not exists (
    select 1 from public.reading_attempts a where a.student_id = v_student.id and a.unit_id = u.id and a.passed
  )
  order by u.sort_order limit 1;
  if not found then
    raise exception 'أتممتَ مقرّرات القراءة كلّها.' using errcode = 'P0001';
  end if;

  -- الانتظارُ بعد الرسوب
  select * into v_last from public.reading_attempts
  where student_id = v_student.id and unit_id = v_unit.id and submitted_at is not null
  order by submitted_at desc limit 1;
  if found and v_last.passed = false
     and v_last.submitted_at > now() - make_interval(days => v_settings.reading_retry_days) then
    raise exception 'تستطيع إعادة الاختبار ابتداءً من %.',
      to_char((v_last.submitted_at + make_interval(days => v_settings.reading_retry_days)) at time zone 'Asia/Gaza', 'DD-MM-YYYY')
      using errcode = 'P0001';
  end if;

  select array_agg(q.id) into v_ids from (
    select id from public.reading_questions
    where unit_id = v_unit.id and active
    order by random() limit v_settings.reading_test_questions
  ) q;
  if coalesce(array_length(v_ids, 1), 0) < v_settings.reading_test_questions then
    raise exception 'بنكُ أسئلة هذا المقرّر لم يكتمل بعد — أخبر معلّمك.' using errcode = 'P0001';
  end if;

  insert into public.reading_attempts (student_id, unit_id, question_ids, total, deadline_at)
  values (v_student.id, v_unit.id, v_ids, array_length(v_ids, 1), now() + make_interval(mins => v_settings.reading_test_minutes))
  returning id into v_id;
  return private.reading_attempt_payload(v_id);
end;
$$;

-- يسلّم المحاولة ويُرجع النتيجة (تسليمٌ ثانٍ يُرجع النتيجةَ نفسها).
create or replace function public.submit_reading_test(p_attempt uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  a public.reading_attempts;
begin
  perform private.assert_session_writable();
  if (select private.is_impersonating()) then
    raise exception 'لا يُقدَّم الاختبار بالنيابة عن الطالب.' using errcode = '42501';
  end if;
  select ra.* into a from public.reading_attempts ra
  join public.students s on s.id = ra.student_id
  where ra.id = p_attempt and s.user_id = auth.uid();
  if not found then
    raise exception 'لا توجد هذه المحاولة.' using errcode = 'P0002';
  end if;
  a := private.grade_reading_attempt(p_attempt, p_answers);
  return jsonb_build_object('score', a.score, 'total', a.total, 'percent', a.percent, 'passed', a.passed, 'unit_id', a.unit_id);
end;
$$;

revoke all on function public.start_reading_test() from public, anon;
revoke all on function public.submit_reading_test(uuid, jsonb) from public, anon;
grant execute on function public.start_reading_test() to authenticated;
grant execute on function public.submit_reading_test(uuid, jsonb) to authenticated;

-- ═══ البياناتُ الأولية (من المستخدم 2026-10-21) ═══
insert into public.reading_books (title, author, pages, description) values
  ('صفقات رابحة', 'الشيخ خالد أبو شادي', 196, 'رحلة في أحوال القلوب والتزكية'),
  ('اليوم النبوي', 'الشيخ عبد الوهاب الطريري', 129, 'التأسي بالنبي ﷺ في تفاصيل يومه'),
  ('البناء العقدي', 'الشيخ أحمد السيد', 142, 'تأسيس أصول الدين وإيضاح أمور العقيدة');

insert into public.reading_units (sort_order, title) values
  (1, 'المقرّر الأول'), (2, 'المقرّر الثاني'), (3, 'المقرّر الثالث'), (4, 'المقرّر الرابع');

insert into public.reading_unit_parts (unit_id, book_id, page_from, page_to, sort_order)
select u.id, b.id, p.f, p.t, p.o
from (values
  (1, 'صفقات رابحة', 1, 88, 1),
  (2, 'صفقات رابحة', 89, 164, 1),
  (3, 'صفقات رابحة', 165, 196, 1),
  (3, 'اليوم النبوي', 1, 124, 2),
  (4, 'البناء العقدي', 1, 88, 1)
) as p(n, book, f, t, o)
join public.reading_units u on u.sort_order = p.n
join public.reading_books b on b.title = p.book;
