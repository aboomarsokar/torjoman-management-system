-- منظومةُ البرامج المصاحبة الجديدة (طلب المستخدم 2026-11-10): أحدَ عشرَ مقرّراً شهرياً، لكلٍّ خارطةُ طريقٍ أسبوعية
-- (صفحاتٌ من كتاب أو محاضرةٌ مرئية) للمعلّم والطالب — لا اختبارَ أسبوعيّ، والاختبارُ شهريٌّ وحده.
--
-- القرارات:
-- · المقرّرُ يُفتح بالتقويم: الأوّلُ في أكتوبر 2026، والثاني في نوفمبر، وهكذا (`reading_units.opens_on`). فلا يختبر
--   الطالبُ في الشهر إلا مقرّراً جديداً واحداً، إلا من تأخّر فيلحق بما فُتح قبله. `start_reading_test()` تفرضه.
-- · المقرّران 1 و2 كما هما. والمقرّران 3 و4 يُعاد تعريفهما، وأسئلتُهما القديمة (200) تُوقَف ولا تُحذف — يكتب المستخدمُ
--   أسئلةَ الأشهر 3–11 لاحقاً، وما لم يكتمل بنكُه فاختبارُه مقفل.
-- · محاولاتُ المقرّرين 3 و4 تُحذف (تقدّمٌ قبل أوانه) بعد نسخها احتياطاً في `private.reading_attempts_backup_20261110`.
-- · تصحيحاتُ الصفحات التي اعتمدها المستخدم: الشهر 5 من 98، والشهر 7 من 55 وأسبوعه الثاني 62–68، والشهر 8 أسبوعاه
--   102–118 و119–128، والشهر 9 أسبوعاه 28–42 و58–76.

-- ── 1. موعدُ فتح كلّ مقرّر ──
alter table public.reading_units add column opens_on date;
update public.reading_units set opens_on = (date '2026-10-01' + make_interval(months => sort_order - 1))::date;
alter table public.reading_units alter column opens_on set not null;
comment on column public.reading_units.opens_on is
  'أوّلُ يومٍ يُفتح فيه اختبارُ المقرّر (مقرّرٌ لكلّ شهرٍ منذ أكتوبر 2026) — تفرضه start_reading_test()';

-- ── 2. الكتابان الجديدان والمقرّراتُ 5–11 ──
insert into public.reading_books (title) values ('فن التدبر'), ('الطريق إلى القرآن');

insert into public.reading_units (sort_order, title, opens_on)
select s, t, (date '2026-10-01' + make_interval(months => s - 1))::date
  from (values (5, 'المقرّر الخامس'), (6, 'المقرّر السادس'), (7, 'المقرّر السابع'), (8, 'المقرّر الثامن'),
               (9, 'المقرّر التاسع'), (10, 'المقرّر العاشر'), (11, 'المقرّر الحادي عشر')) v(s, t);

-- ── 3. نطاقُ كلّ شهر (الكتاب والصفحات) للمقرّرات 3–11 ──
delete from public.reading_unit_parts p using public.reading_units u where u.id = p.unit_id and u.sort_order >= 3;
insert into public.reading_unit_parts (unit_id, book_id, page_from, page_to, sort_order)
select u.id, b.id, v.f, v.t, 1
  from (values (3, 'صفقات رابحة', 165, 196), (4, 'اليوم النبوي', 1, 97), (5, 'اليوم النبوي', 98, 125),
               (6, 'البناء العقدي', 1, 54), (7, 'البناء العقدي', 55, 88), (8, 'البناء العقدي', 89, 142),
               (9, 'فن التدبر', 1, 76), (10, 'الطريق إلى القرآن', 1, 75), (11, 'الطريق إلى القرآن', 76, 117)) v(s, book, f, t)
  join public.reading_units u on u.sort_order = v.s
  join public.reading_books b on b.title = v.book;

-- ── 4. خارطةُ الطريق الأسبوعية ──
create table public.reading_unit_items (
  id               smallint generated always as identity primary key,
  unit_id          smallint not null references public.reading_units (id) on delete cascade,
  week             smallint not null check (week between 1 and 5),
  sort_order       smallint not null default 1,
  kind             text not null check (kind in ('pages', 'lecture', 'clip')),
  book_id          smallint references public.reading_books (id) on delete restrict,
  page_from        smallint check (page_from > 0),
  page_to          smallint,
  title            text check (title is null or btrim(title) <> ''),
  speaker          text,
  duration_seconds integer check (duration_seconds > 0),
  url              text check (url is null or url ~* '^https?://'),
  constraint reading_unit_items_slot unique (unit_id, week, sort_order),
  constraint reading_unit_items_pages check (kind <> 'pages' or (book_id is not null and page_from is not null and page_to >= page_from)),
  constraint reading_unit_items_video check (kind = 'pages' or title is not null)
);
comment on table public.reading_unit_items is
  'خارطةُ الطريق الأسبوعية لمقرّر الشهر: صفحاتٌ من كتاب أو محاضرةٌ/مقطعٌ مرئيّ — للمتابعة لا للاختبار (2026-11-10)';
create index reading_unit_items_unit on public.reading_unit_items (unit_id);

alter table public.reading_unit_items enable row level security;
create policy reading_unit_items_select on public.reading_unit_items for select to authenticated using (true);
create policy reading_unit_items_write on public.reading_unit_items for all to authenticated
  using ((select public.is_admin_manager())) with check ((select public.is_admin_manager()));
select private.guard_table_for_impersonation('public.reading_unit_items');

insert into public.reading_unit_items (unit_id, week, kind, book_id, page_from, page_to)
select u.id, v.w, 'pages', b.id, v.f, v.t
  from (values
    (1, 1, 'صفقات رابحة', 1, 28), (1, 2, 'صفقات رابحة', 29, 45), (1, 3, 'صفقات رابحة', 46, 64), (1, 4, 'صفقات رابحة', 65, 88),
    (2, 1, 'صفقات رابحة', 89, 105), (2, 2, 'صفقات رابحة', 106, 126), (2, 3, 'صفقات رابحة', 127, 142), (2, 4, 'صفقات رابحة', 143, 164),
    (3, 1, 'صفقات رابحة', 165, 186), (3, 2, 'صفقات رابحة', 187, 196),
    (4, 1, 'اليوم النبوي', 1, 27), (4, 2, 'اليوم النبوي', 28, 47), (4, 3, 'اليوم النبوي', 48, 71), (4, 4, 'اليوم النبوي', 72, 97),
    (5, 1, 'اليوم النبوي', 98, 125),
    (6, 1, 'البناء العقدي', 1, 30), (6, 2, 'البناء العقدي', 31, 40), (6, 3, 'البناء العقدي', 41, 47), (6, 4, 'البناء العقدي', 48, 54),
    (7, 1, 'البناء العقدي', 55, 61), (7, 2, 'البناء العقدي', 62, 68), (7, 3, 'البناء العقدي', 69, 76), (7, 4, 'البناء العقدي', 77, 88),
    (8, 1, 'البناء العقدي', 89, 101), (8, 2, 'البناء العقدي', 102, 118), (8, 3, 'البناء العقدي', 119, 128), (8, 4, 'البناء العقدي', 129, 142),
    (9, 1, 'فن التدبر', 1, 27), (9, 2, 'فن التدبر', 28, 42), (9, 3, 'فن التدبر', 43, 57), (9, 4, 'فن التدبر', 58, 76),
    (10, 1, 'الطريق إلى القرآن', 1, 20), (10, 2, 'الطريق إلى القرآن', 21, 36), (10, 3, 'الطريق إلى القرآن', 37, 59), (10, 4, 'الطريق إلى القرآن', 60, 75),
    (11, 1, 'الطريق إلى القرآن', 76, 89), (11, 2, 'الطريق إلى القرآن', 90, 117)
  ) v(s, w, book, f, t)
  join public.reading_units u on u.sort_order = v.s
  join public.reading_books b on b.title = v.book;

insert into public.reading_unit_items (unit_id, week, kind, title, speaker, duration_seconds)
select u.id, v.w, v.k, v.title, v.speaker, v.secs
  from (values
    (3, 3, 'lecture', 'هكذا تألق جيل الصحابة', 'د. عبدالله العجيري', 5044),
    (3, 4, 'lecture', 'القلب المنيب', 'د. أحمد السيد', 1723),
    (5, 2, 'lecture', 'فتية عظماء 1 — قصص محفزة للجيل الصاعد', 'د. أحمد السيد', 1960),
    (5, 3, 'lecture', 'فتية عظماء 2', 'د. أحمد السيد', 1929),
    (5, 4, 'lecture', 'فتية عظماء 3', 'د. أحمد السيد', 2141),
    (11, 3, 'lecture', 'إشكالية الهوية لدى الشباب', 'د. أحمد العربي', 3493),
    (11, 4, 'clip', '7 نصائح ليومك', 'الشيخ حسين عبدالرازق', 1798)
  ) v(s, w, k, title, speaker, secs)
  join public.reading_units u on u.sort_order = v.s;

-- ── 5. الأسئلةُ القديمة للمقرّرين 3 و4 تُوقَف (لا تُحذف) ──
update public.reading_questions q set active = false
  from public.reading_units u where u.id = q.unit_id and u.sort_order in (3, 4) and q.active;

-- ── 6. محاولاتُ المقرّرين 3 و4: نسخةٌ احتياطية ثم حذف ──
create table private.reading_attempts_backup_20261110 as
  select a.* from public.reading_attempts a join public.reading_units u on u.id = a.unit_id where u.sort_order in (3, 4);
delete from public.reading_attempts a using public.reading_units u where u.id = a.unit_id and u.sort_order in (3, 4);

-- ── 7. الاختبارُ لا يُبدأ قبل موعد فتح مقرّره ──
create or replace function public.start_reading_test()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  select * into v_open from public.reading_attempts where student_id = v_student.id and submitted_at is null;
  if found then
    if v_open.deadline_at > now() then
      return private.reading_attempt_payload(v_open.id);
    end if;
    perform private.grade_reading_attempt(v_open.id, v_open.answers);
  end if;

  select u.* into v_unit from public.reading_units u
  where not exists (
    select 1 from public.reading_attempts a where a.student_id = v_student.id and a.unit_id = u.id and a.passed
  )
  order by u.sort_order limit 1;
  if not found then
    raise exception 'أتممتَ مقرّرات القراءة كلّها.' using errcode = 'P0001';
  end if;

  -- مقرّرٌ لكلّ شهر: لا يُختبر في مقرّرٍ قبل شهره (2026-11-10)
  if v_unit.opens_on > (now() at time zone 'Asia/Gaza')::date then
    raise exception 'أتممتَ مقرّرات هذا الشهر — يُفتح «%» في %.', v_unit.title, to_char(v_unit.opens_on, 'DD-MM-YYYY')
      using errcode = 'P0001';
  end if;

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
    raise exception 'اختبارُ «%» لم يُفتح بعد — أسئلتُه قيد الإعداد.', v_unit.title using errcode = 'P0001';
  end if;

  insert into public.reading_attempts (student_id, unit_id, question_ids, total, deadline_at)
  values (v_student.id, v_unit.id, v_ids, array_length(v_ids, 1), now() + make_interval(mins => v_settings.reading_test_minutes))
  returning id into v_id;
  return private.reading_attempt_payload(v_id);
end;
$function$;
