-- محطةُ منتصف الشهر للرصد القرآنيّ (طلب المستخدم 2026-11-21):
-- ١) يُفتح إدخالُ إنجاز الشهر للمعلّم يومَ 15 (الخميسَ قبله إن كان جمعة) بدل آخر يوم؛ والإرسالُ للاعتماد يبقى آخرَ يوم.
-- ٢) «تسليمُ رصد المنتصف»: المعلّمُ يحفظ صورةً ثابتة من رصد الشهر (`quran_midmonth` + `quran_mid_records`) من يوم 15
--    ما دام الشهرُ مسوّدة، ويُعيد التسليمَ للتصحيح؛ وأوّلُ تسليمٍ يُشعر المشرفَ الميدانيّ.
-- ٣) تذكيرٌ يوميّ (pg_cron): صباحَ 15 للمعلّم الذي لم يسلّم، وصباحَ 17 للمديرين بعدد حلقات نطاقهم غير المسلِّمة.
-- القراءةُ لمن يرى الحلقة (`visible_halaqa_ids`)، والكتابةُ عبر الدالّة وحدها.

-- ── يومُ فتح الإدخال ──
create or replace function private.report_entry_day(p_year integer, p_month integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select case when extract(isodow from d) = 5 then d - 1 else d end
    from (select make_date(p_year, p_month, 15) as d) x;
$$;
revoke all on function private.report_entry_day(integer, integer) from public, anon, authenticated;

create or replace function private.guard_quran_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status public.report_status;
  v_halaqa uuid;
  v_year integer;
  v_month integer;
  v_opens date;
  v_fs smallint;
  v_ts smallint;
  v_student_halaqa uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    -- الحذفُ التتابعيّ (حذفُ طالبٍ/تقريرٍ/حلقة) يجري في عمق ٢ فما فوق فيُتجاوَز؛ المباشرُ يبقى محظوراً.
    if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
    -- التحديثُ التتابعيّ لـrecorded_by (on delete set null) لا يغيّر بياناتٍ فيمرّ ولو كان الشهرُ معتمَداً.
    if tg_op = 'UPDATE' and pg_trigger_depth() > 1
       and (new.report_id, new.student_id, new.from_surah, new.from_ayah, new.to_surah, new.to_ayah,
            new.pages_memorized, new.pages_reviewed, new.notes)
           is not distinct from
           (old.report_id, old.student_id, old.from_surah, old.from_ayah, old.to_surah, old.to_ayah,
            old.pages_memorized, old.pages_reviewed, old.notes) then
      return new;   -- تفريغٌ تتابعيّ لـrecorded_by
    end if;
    select r.status into v_status from public.monthly_reports r where r.id = old.report_id;
    if v_status = 'approved' then
      raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    if (new.report_id, new.student_id, new.from_surah, new.from_ayah, new.to_surah, new.to_ayah,
        new.pages_memorized, new.pages_reviewed, new.notes)
       is not distinct from
       (old.report_id, old.student_id, old.from_surah, old.from_ayah, old.to_surah, old.to_ayah,
        old.pages_memorized, old.pages_reviewed, old.notes) then
      return new;   -- تغيّر recorded_by وحده
    end if;
  end if;

  select r.status, r.halaqa_id, r.report_year, r.report_month into v_status, v_halaqa, v_year, v_month
    from public.monthly_reports r where r.id = new.report_id;
  if v_status = 'approved' then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;

  -- المعلّمُ قبل يوم فتح الإدخال (15 من الشهر — 2026-11-21؛ كان آخرَ يوم بقرار 2026-10-28): لا إدخال
  v_opens := private.report_entry_day(v_year, v_month);
  if private.attendance_today() < v_opens
     and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'teacher') then
    raise exception 'يُفتح إدخالُ إنجاز الشهر % في %.', lpad(v_month::text, 2, '0'), to_char(v_opens, 'DD-MM-YYYY')
      using errcode = 'P0001';
  end if;

  if new.from_surah is not null then
    select s.ayah_count into v_fs from public.surahs s where s.number = new.from_surah;
    select s.ayah_count into v_ts from public.surahs s where s.number = new.to_surah;
    if new.from_ayah < 1 or new.from_ayah > v_fs then
      raise exception 'آيةُ البداية خارج عدد آيات السورة (1-%)', v_fs;
    end if;
    if new.to_ayah < 1 or new.to_ayah > v_ts then
      raise exception 'آيةُ النهاية خارج عدد آيات السورة (1-%)', v_ts;
    end if;
    -- ترتيبُ الحفظ: السورة تنازلياً والآيةُ داخلها تصاعدياً.
    if not (new.from_surah > new.to_surah
            or (new.from_surah = new.to_surah and new.from_ayah <= new.to_ayah)) then
      raise exception 'بدايةُ المسار يجب أن تسبق نهايتَه بترتيب الحفظ (من الناس إلى الفاتحة)';
    end if;
  end if;

  if tg_op = 'INSERT' or new.student_id is distinct from old.student_id
     or new.report_id is distinct from old.report_id then
    select s.halaqa_id into v_student_halaqa from public.students s where s.id = new.student_id;
    if v_student_halaqa is distinct from v_halaqa then
      raise exception 'الطالب ليس في حلقة هذا التقرير';
    end if;
  end if;
  return new;
end;
$function$;

-- ── صورةُ المنتصف ──
create table public.quran_midmonth (
  report_id uuid primary key references public.monthly_reports(id) on delete cascade,
  halaqa_id uuid not null references public.halaqat(id) on delete cascade,
  mid_year smallint not null,
  mid_month smallint not null check (mid_month between 1 and 12),
  submitted_at timestamptz not null default now(),
  submitted_by uuid references public.profiles(id) on delete set null,
  unique (halaqa_id, mid_year, mid_month)
);

create table public.quran_mid_records (
  report_id uuid not null references public.quran_midmonth(report_id) on delete cascade,
  halaqa_id uuid not null references public.halaqat(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  from_surah smallint,
  from_ayah smallint,
  to_surah smallint,
  to_ayah smallint,
  pages_memorized smallint not null default 0,
  pages_reviewed smallint,
  primary key (report_id, student_id)
);
create index quran_mid_records_halaqa_idx on public.quran_mid_records (halaqa_id);
create index quran_mid_records_student_idx on public.quran_mid_records (student_id);
create index quran_midmonth_period_idx on public.quran_midmonth (mid_year, mid_month);

alter table public.quran_midmonth enable row level security;
alter table public.quran_mid_records enable row level security;
revoke all on public.quran_midmonth from public, anon, authenticated;
revoke all on public.quran_mid_records from public, anon, authenticated;
grant select on public.quran_midmonth to authenticated;
grant select on public.quran_mid_records to authenticated;

create policy quran_midmonth_select on public.quran_midmonth for select to authenticated
  using (halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]));
create policy quran_mid_records_select on public.quran_mid_records for select to authenticated
  using (halaqa_id = any ((select public.visible_halaqa_ids())::uuid[]));

select private.guard_table_for_impersonation('public.quran_midmonth');
select private.guard_table_for_impersonation('public.quran_mid_records');

-- ── أنواعُ الإشعارات الجديدة ──
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed', 'booklet_delivered', 'booklet_requested', 'announcement',
  'student_requested', 'student_request_closed', 'off_day_reported', 'off_day_rejected',
  'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update',
  'booklet_ready', 'booklet_request_cancelled', 'booklet_stock_low', 'candidate_registered',
  'track_requested', 'track_decided', 'below_quota', 'payout_account_changed',
  'quran_mid_due', 'quran_mid_submitted', 'quran_mid_missing'
));

create or replace function private.notify(p_recipient uuid, p_kind text, p_title text, p_body text, p_link text, p_source_table text, p_source_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_recipient is null or p_recipient = (select auth.uid()) then
    return;
  end if;
  if p_kind is null or p_kind not in (
    'report_submitted', 'report_approved', 'report_returned',
    'alert_issued', 'visit_scheduled',
    'exam_nominated', 'exam_graded',
    'transport_paid',
    'impersonation_started', 'impersonation_write',
    'statement_returned',
    'visit_result', 'visit_unlocked', 'visit_rescheduled',
    'quality_month', 'quality_unlocked',
    'halaqa_time_changed', 'booklet_delivered', 'booklet_requested',
    'announcement',
    'student_requested', 'student_request_closed',
    'off_day_reported', 'off_day_rejected',
    'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update',
    'booklet_ready', 'booklet_request_cancelled', 'booklet_stock_low', 'candidate_registered',
    'track_requested', 'track_decided', 'below_quota', 'payout_account_changed',
    'quran_mid_due', 'quran_mid_submitted', 'quran_mid_missing'
  ) then
    raise warning 'notify: نوعٌ غير معروف %', p_kind;
    return;
  end if;
  if p_link is not null and p_link !~ '^/[A-Za-z0-9/_?=&-]*$' then
    raise warning 'notify: رابطٌ غير مسموح %', p_link;
    return;
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise warning 'notify: عنوانٌ فارغ (النوع %)', p_kind;
    return;
  end if;
  begin
    insert into public.notifications (recipient_id, kind, title, body, link, source_table, source_id)
    values (p_recipient, p_kind, left(btrim(p_title), 120), left(nullif(btrim(coalesce(p_body, '')), ''), 400), p_link, p_source_table, p_source_id);
    delete from public.notifications
     where id in (select id from public.notifications
                   where created_at < now() - interval '3 months'
                   order by created_at limit 200
                   for update skip locked);
  exception when others then
    raise warning 'notify failed: %', sqlerrm;
  end;
end;
$function$;

-- ── التسليم ──
create or replace function public.submit_quran_midmonth(p_report uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rep public.monthly_reports;
  v_h public.halaqat;
  v_today date := private.attendance_today();
  v_first boolean;
  v_n integer;
begin
  perform private.assert_session_writable();
  select * into v_rep from public.monthly_reports where id = p_report;
  if not found then
    raise exception 'لا رصدَ لهذا الشهر بعد — ارصد طلابك أوّلاً.' using errcode = 'P0002';
  end if;
  select * into v_h from public.halaqat where id = v_rep.halaqa_id;
  if v_h.teacher_id is distinct from (select auth.uid()) then
    raise exception 'يسلّم رصدَ المنتصف معلّمُ الحلقة وحده.' using errcode = '42501';
  end if;
  if v_rep.status <> 'draft' then
    raise exception 'أُرسل رصدُ الشهر — لا تسليمَ للمنتصف بعده.' using errcode = '22023';
  end if;
  if v_rep.report_year <> extract(year from v_today) or v_rep.report_month <> extract(month from v_today) then
    raise exception 'رصدُ المنتصف للشهر الجاري وحده.' using errcode = '22023';
  end if;
  if v_today < private.report_entry_day(v_rep.report_year, v_rep.report_month) then
    raise exception 'يُفتح تسليمُ رصد المنتصف في %.', to_char(private.report_entry_day(v_rep.report_year, v_rep.report_month), 'DD-MM-YYYY')
      using errcode = 'P0001';
  end if;

  v_first := not exists (select 1 from public.quran_midmonth where report_id = p_report);
  insert into public.quran_midmonth (report_id, halaqa_id, mid_year, mid_month, submitted_at, submitted_by)
  values (p_report, v_rep.halaqa_id, v_rep.report_year, v_rep.report_month, now(), (select auth.uid()))
  on conflict (report_id) do update set submitted_at = now(), submitted_by = excluded.submitted_by;

  delete from public.quran_mid_records where report_id = p_report;
  insert into public.quran_mid_records (report_id, halaqa_id, student_id, from_surah, from_ayah, to_surah, to_ayah, pages_memorized, pages_reviewed)
  select q.report_id, v_rep.halaqa_id, q.student_id, q.from_surah, q.from_ayah, q.to_surah, q.to_ayah, q.pages_memorized, q.pages_reviewed
    from public.quran_records q where q.report_id = p_report;
  get diagnostics v_n = row_count;

  if v_first then
    perform private.notify(v_h.supervisor_id, 'quran_mid_submitted', 'سُلّم رصدُ منتصف الشهر',
      v_h.name || ' · رُصد ' || v_n || ' طالباً',
      '/reports/midmonth?y=' || v_rep.report_year || '&m=' || v_rep.report_month, 'quran_midmonth', p_report);
  end if;
  return v_n;
end;
$$;
revoke all on function public.submit_quran_midmonth(uuid) from public, anon;
grant execute on function public.submit_quran_midmonth(uuid) to authenticated;

-- ── التذكير ──
create or replace function private.quran_mid_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.attendance_today();
  v_y integer := extract(year from v_today);
  v_m integer := extract(month from v_today);
  v_since timestamptz := v_today::timestamp at time zone 'Asia/Gaza';
  r record;
begin
  perform private.assert_session_writable();  -- بلا جلسةٍ (pg_cron) يمرّ بلا أثر
  if v_today = private.report_entry_day(v_y, v_m) then
    for r in
      select h.id, h.teacher_id
        from public.halaqat h join public.profiles t on t.id = h.teacher_id
       where h.status = 'active' and t.status = 'active'
         and not exists (select 1 from public.quran_midmonth q where q.halaqa_id = h.id and q.mid_year = v_y and q.mid_month = v_m)
         and not exists (select 1 from public.notifications n
                          where n.recipient_id = h.teacher_id and n.kind = 'quran_mid_due' and n.created_at >= v_since)
    loop
      perform private.notify(r.teacher_id, 'quran_mid_due', 'سلّم رصدَ منتصف الشهر',
        'ارصد أين وصل كلُّ طالب، ثم اضغط «تسليم رصد المنتصف» في الإنجاز القرآني.', '/t/quran', 'halaqat', r.id);
    end loop;
  end if;

  if v_today = private.report_entry_day(v_y, v_m) + 2 then
    for r in
      select p.id,
             (select count(*) from public.halaqat h join public.profiles t on t.id = h.teacher_id
               where h.status = 'active' and t.status = 'active'
                 and (p.role = 'admin_manager'
                      or (p.role = 'technical_manager' and h.gender = 'male')
                      or (p.role = 'women_admin' and h.gender = 'female'))
                 and not exists (select 1 from public.quran_midmonth q where q.halaqa_id = h.id and q.mid_year = v_y and q.mid_month = v_m)) as missing
        from public.profiles p
       where p.status = 'active' and p.role in ('admin_manager', 'technical_manager', 'women_admin')
         and not exists (select 1 from public.notifications n
                          where n.recipient_id = p.id and n.kind = 'quran_mid_missing' and n.created_at >= v_since)
    loop
      if r.missing > 0 then
        perform private.notify(r.id, 'quran_mid_missing', 'حلقاتٌ لم تسلّم رصدَ المنتصف',
          r.missing || ' حلقة لم تسلّم رصدَ منتصف الشهر بعد.', '/reports/midmonth', null, null);
      end if;
    end loop;
  end if;
end;
$$;
revoke all on function private.quran_mid_reminders() from public, anon, authenticated;

select cron.schedule('quran-mid-reminders', '0 5 * * *', 'select private.quran_mid_reminders()');
