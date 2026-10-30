-- خطةُ القسم الشهرية (طلب المستخدم 2026-10-30): أهدافٌ (حتى 10) تحت كلٍّ منها أنشطةٌ بموعدٍ ومسؤولٍ أو أكثر من العاملين،
-- وحالةٌ يحدّثها المسؤول بنفسه، وتقريرُ القسم آخر الشهر. يكتب الخطةَ المديرُ الإداريّ وحده، ويقرؤها كاملةً هو والمدير
-- الفنيّ والمديرة الإدارية ومشرف المشروع، وكلُّ مسؤولٍ آخر يرى أنشطته وأهدافها فقط.
-- التذكير: إشعارٌ عند الإسناد، وقبل الموعد بيومين، وصباح يومه، وتنبيهٌ للمدير الإداريّ بالمتأخّر، وتذكيرٌ كلّ خميس بالتحديث.

create type public.dept_task_status as enum ('not_started', 'in_progress', 'done', 'not_done');

create table public.dept_plans (
  id                   uuid primary key default gen_random_uuid(),
  plan_year            smallint not null,
  plan_month           smallint not null check (plan_month between 1 and 12),
  report_achievements  text check (report_achievements is null or char_length(report_achievements) <= 3000),
  report_not_done      text check (report_not_done is null or char_length(report_not_done) <= 3000),
  report_obstacles     text check (report_obstacles is null or char_length(report_obstacles) <= 3000),
  report_team_notes    text check (report_team_notes is null or char_length(report_team_notes) <= 3000),
  created_by           uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint dept_plans_month_unique unique (plan_year, plan_month),
  constraint dept_plans_from_project_start check (plan_year * 100 + plan_month >= 202610)
);

create table public.dept_plan_goals (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.dept_plans(id) on delete cascade,
  sort_order  smallint not null default 0,
  title       text not null check (char_length(btrim(title)) between 1 and 300),
  created_at  timestamptz not null default now()
);
create index dept_plan_goals_plan_idx on public.dept_plan_goals (plan_id, sort_order);

create table public.dept_plan_tasks (
  id                 uuid primary key default gen_random_uuid(),
  plan_id            uuid not null references public.dept_plans(id) on delete cascade,
  goal_id            uuid not null references public.dept_plan_goals(id) on delete cascade,
  sort_order         smallint not null default 0,
  title              text not null check (char_length(btrim(title)) between 1 and 400),
  due_on             date not null,
  status             public.dept_task_status not null default 'not_started',
  notes              text check (notes is null or char_length(notes) <= 1000),
  status_updated_by  uuid references public.profiles(id) on delete set null,
  status_updated_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index dept_plan_tasks_plan_idx on public.dept_plan_tasks (plan_id, goal_id, sort_order);
create index dept_plan_tasks_due_idx on public.dept_plan_tasks (due_on) where status in ('not_started', 'in_progress');

create table public.dept_plan_task_owners (
  task_id     uuid not null references public.dept_plan_tasks(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (task_id, profile_id)
);
create index dept_plan_task_owners_profile_idx on public.dept_plan_task_owners (profile_id);

-- سجلُّ التذكيرات المرسلة: لا يُكرَّر تذكيرٌ لنفس المهمة والشخص والنوع
create table private.dept_plan_reminder_log (
  task_id     uuid not null references public.dept_plan_tasks(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('before', 'due', 'overdue')),
  sent_at     timestamptz not null default now(),
  primary key (task_id, profile_id, kind)
);
create table private.dept_plan_weekly_log (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  week_of     date not null,
  primary key (profile_id, week_of)
);

-- ── من يرى ماذا ──────────────────────────────────────────────

-- من يقرأ الخطة كاملة
create or replace function public.can_view_full_dept_plan()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select public.current_user_role()) in ('admin_manager', 'technical_manager', 'women_admin', 'project_supervisor'), false)
$$;
revoke all on function public.can_view_full_dept_plan() from public, anon;
grant execute on function public.can_view_full_dept_plan() to authenticated;

-- أنشطةُ المستخدم الحاليّ (لسياسات القراءة بلا تكرارٍ داخل السياسة)
create or replace function public.my_dept_task_ids()
returns uuid[]
language sql stable security definer
set search_path = public
as $$
  select coalesce(array_agg(task_id), '{}') from public.dept_plan_task_owners where profile_id = (select auth.uid())
$$;
revoke all on function public.my_dept_task_ids() from public, anon;
grant execute on function public.my_dept_task_ids() to authenticated;

alter table public.dept_plans enable row level security;
create policy dept_plans_select on public.dept_plans for select to authenticated
  using ((select public.can_view_full_dept_plan())
         or exists (select 1 from public.dept_plan_tasks t
                     where t.plan_id = dept_plans.id and t.id = any ((select public.my_dept_task_ids())::uuid[])));
create policy dept_plans_insert on public.dept_plans for insert to authenticated with check ((select public.is_admin_manager()));
create policy dept_plans_update on public.dept_plans for update to authenticated
  using ((select public.is_admin_manager())) with check ((select public.is_admin_manager()));
create policy dept_plans_delete on public.dept_plans for delete to authenticated using ((select public.is_admin_manager()));
grant select, insert, update, delete on public.dept_plans to authenticated;
select private.guard_table_for_impersonation('public.dept_plans');

alter table public.dept_plan_goals enable row level security;
create policy dept_plan_goals_select on public.dept_plan_goals for select to authenticated
  using ((select public.can_view_full_dept_plan())
         or exists (select 1 from public.dept_plan_tasks t
                     where t.goal_id = dept_plan_goals.id and t.id = any ((select public.my_dept_task_ids())::uuid[])));
create policy dept_plan_goals_insert on public.dept_plan_goals for insert to authenticated with check ((select public.is_admin_manager()));
create policy dept_plan_goals_update on public.dept_plan_goals for update to authenticated
  using ((select public.is_admin_manager())) with check ((select public.is_admin_manager()));
create policy dept_plan_goals_delete on public.dept_plan_goals for delete to authenticated using ((select public.is_admin_manager()));
grant select, insert, update, delete on public.dept_plan_goals to authenticated;
select private.guard_table_for_impersonation('public.dept_plan_goals');

alter table public.dept_plan_tasks enable row level security;
create policy dept_plan_tasks_select on public.dept_plan_tasks for select to authenticated
  using ((select public.can_view_full_dept_plan()) or id = any ((select public.my_dept_task_ids())::uuid[]));
create policy dept_plan_tasks_insert on public.dept_plan_tasks for insert to authenticated with check ((select public.is_admin_manager()));
create policy dept_plan_tasks_update on public.dept_plan_tasks for update to authenticated
  using ((select public.is_admin_manager())) with check ((select public.is_admin_manager()));
create policy dept_plan_tasks_delete on public.dept_plan_tasks for delete to authenticated using ((select public.is_admin_manager()));
grant select, insert, update, delete on public.dept_plan_tasks to authenticated;
select private.guard_table_for_impersonation('public.dept_plan_tasks');

alter table public.dept_plan_task_owners enable row level security;
create policy dept_plan_task_owners_select on public.dept_plan_task_owners for select to authenticated
  using ((select public.can_view_full_dept_plan()) or task_id = any ((select public.my_dept_task_ids())::uuid[]));
create policy dept_plan_task_owners_insert on public.dept_plan_task_owners for insert to authenticated with check ((select public.is_admin_manager()));
create policy dept_plan_task_owners_delete on public.dept_plan_task_owners for delete to authenticated using ((select public.is_admin_manager()));
grant select, insert, delete on public.dept_plan_task_owners to authenticated;
select private.guard_table_for_impersonation('public.dept_plan_task_owners');

-- ── الحرّاس ──────────────────────────────────────────────────

-- النشاطُ في خطة هدفه نفسها، وموعدُه داخل شهر الخطة أو بعده بأسبوع على الأكثر، ولمسُ الحالة يُسجَّل
create or replace function private.dept_task_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  p public.dept_plans%rowtype;
  v_start date;
begin
  select g.plan_id into new.plan_id from public.dept_plan_goals g where g.id = new.goal_id;
  if new.plan_id is null then
    raise exception 'الهدف غير موجود.' using errcode = '23503';
  end if;
  select * into p from public.dept_plans where id = new.plan_id;
  v_start := make_date(p.plan_year, p.plan_month, 1);
  if new.due_on < v_start or new.due_on > (v_start + interval '1 month' + interval '6 days')::date then
    raise exception 'موعد النشاط يكون داخل شهر الخطة.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if new.status is distinct from old.status or new.notes is distinct from old.notes then
      new.status_updated_by := auth.uid();
      new.status_updated_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.dept_task_guard() from public, anon, authenticated;
create trigger dept_plan_tasks_guard before insert or update on public.dept_plan_tasks
  for each row execute function private.dept_task_guard();

-- عددُ الأهداف في الخطة لا يتجاوز 10
create or replace function private.dept_goal_limit()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.dept_plan_goals where plan_id = new.plan_id) >= 10 then
    raise exception 'الخطة لا تتجاوز 10 أهداف.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.dept_goal_limit() from public, anon, authenticated;
create trigger dept_plan_goals_limit before insert on public.dept_plan_goals
  for each row execute function private.dept_goal_limit();

-- المسؤولُ من العاملين النشطين (لا طالب)، ويُشعَر بالإسناد
create or replace function private.dept_owner_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  t public.dept_plan_tasks%rowtype;
begin
  if not exists (select 1 from public.profiles pr
                  where pr.id = new.profile_id and pr.role::text <> 'student' and pr.status::text = 'active') then
    raise exception 'المسؤول يكون من العاملين النشطين في المنصّة.' using errcode = '23514';
  end if;
  select * into t from public.dept_plan_tasks where id = new.task_id;
  perform private.notify(new.profile_id, 'plan_task_assigned', 'أُسندت إليك مهمّة في خطة القسم',
    t.title || ' · الموعد ' || to_char(t.due_on, 'DD/MM'), '/plan', 'dept_plan_tasks', t.id);
  return new;
end;
$$;
revoke all on function private.dept_owner_guard() from public, anon, authenticated;
create trigger dept_plan_task_owners_guard before insert on public.dept_plan_task_owners
  for each row execute function private.dept_owner_guard();

create or replace function private.dept_plan_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.dept_plan_touch() from public, anon, authenticated;
create trigger dept_plans_touch before update on public.dept_plans
  for each row execute function private.dept_plan_touch();

-- ── تحديثُ المسؤول لحالة نشاطه ───────────────────────────────

create or replace function public.update_my_dept_task(p_task uuid, p_status public.dept_task_status, p_notes text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.assert_session_writable();
  if p_status is null then
    raise exception 'اختر الحالة.' using errcode = '22023';
  end if;
  if not (public.is_admin_manager()
          or exists (select 1 from public.dept_plan_task_owners o where o.task_id = p_task and o.profile_id = auth.uid())) then
    raise exception 'تحديثُ النشاط لمسؤوله أو للمدير الإداري.' using errcode = '42501';
  end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'الملاحظة لا تتجاوز 1000 حرف.' using errcode = '22023';
  end if;
  update public.dept_plan_tasks
     set status = p_status, notes = nullif(btrim(coalesce(p_notes, '')), '')
   where id = p_task;
  if not found then
    raise exception 'النشاط غير موجود.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.update_my_dept_task(uuid, public.dept_task_status, text) from public, anon;
grant execute on function public.update_my_dept_task(uuid, public.dept_task_status, text) to authenticated;

-- ── أنواعُ الإشعارات (مع نوعَي «لم تنعقد الحلقة» المنسّقين مع جلستها) ─────────────

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
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
  'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update'
));

create or replace function private.notify(p_recipient uuid, p_kind text, p_title text, p_body text, p_link text, p_source_table text, p_source_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
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
    'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update'
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
$$;

-- ── التذكيرُ اليوميّ (pg_cron، الثامنة صباحاً بتوقيت غزة) ───────────────────

create or replace function private.dept_plan_reminders()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Gaza')::date;
  r record;
  v_week date;
begin
  perform private.assert_session_writable();  -- بلا جلسةٍ (pg_cron) يمرّ بلا أثر، والاتّفاقُ أن تبدأ به كلُّ دالّةٍ كاتبة
  -- قبل الموعد بيومين، وصباح يومه: لكلّ مسؤولٍ عن نشاطٍ مفتوح
  for r in
    select t.id, t.title, t.due_on, o.profile_id,
           case when t.due_on = v_today then 'due' else 'before' end as kind
      from public.dept_plan_tasks t
      join public.dept_plan_task_owners o on o.task_id = t.id
     where t.status in ('not_started', 'in_progress')
       and t.due_on in (v_today, v_today + 2)
       and not exists (select 1 from private.dept_plan_reminder_log l
                        where l.task_id = t.id and l.profile_id = o.profile_id
                          and l.kind = case when t.due_on = v_today then 'due' else 'before' end)
  loop
    insert into private.dept_plan_reminder_log (task_id, profile_id, kind) values (r.id, r.profile_id, r.kind);
    perform private.notify(r.profile_id, 'plan_task_due',
      case when r.kind = 'due' then 'اليوم موعد مهمّتك في خطة القسم' else 'بعد يومين موعد مهمّتك في خطة القسم' end,
      r.title || ' · الموعد ' || to_char(r.due_on, 'DD/MM'), '/plan', 'dept_plan_tasks', r.id);
  end loop;

  -- المتأخّر: مرّةً واحدةً للمدير الإداريّ عن كلّ نشاط فات موعده ولم يُغلق
  for r in
    select t.id, t.title, t.due_on, a.id as admin_id,
           (select string_agg(pr.full_name, '، ') from public.dept_plan_task_owners o2
              join public.profiles pr on pr.id = o2.profile_id where o2.task_id = t.id) as owners
      from public.dept_plan_tasks t
      cross join (select id from public.profiles where role::text = 'admin_manager' and status::text = 'active') a
     where t.status in ('not_started', 'in_progress')
       and t.due_on < v_today
       and not exists (select 1 from private.dept_plan_reminder_log l
                        where l.task_id = t.id and l.profile_id = a.id and l.kind = 'overdue')
  loop
    insert into private.dept_plan_reminder_log (task_id, profile_id, kind) values (r.id, r.admin_id, 'overdue');
    perform private.notify(r.admin_id, 'plan_task_overdue', 'مهمّةٌ متأخّرة في خطة القسم',
      r.title || ' · كان موعدها ' || to_char(r.due_on, 'DD/MM') || coalesce(' · ' || r.owners, ''),
      '/plan', 'dept_plan_tasks', r.id);
  end loop;

  -- كلّ خميس: تذكيرٌ بتحديث الحالة لمن عنده أنشطةٌ مفتوحة في خطة الشهر الجاري
  if extract(dow from v_today) = 4 then
    v_week := v_today;
    for r in
      select o.profile_id, count(*) as open_count
        from public.dept_plan_tasks t
        join public.dept_plans p on p.id = t.plan_id
        join public.dept_plan_task_owners o on o.task_id = t.id
       where t.status in ('not_started', 'in_progress')
         and p.plan_year = extract(year from v_today) and p.plan_month = extract(month from v_today)
         and not exists (select 1 from private.dept_plan_weekly_log w where w.profile_id = o.profile_id and w.week_of = v_week)
       group by o.profile_id
    loop
      insert into private.dept_plan_weekly_log (profile_id, week_of) values (r.profile_id, v_week);
      perform private.notify(r.profile_id, 'plan_weekly_update', 'حدّث حالة مهامك في خطة القسم',
        'لديك ' || r.open_count || ' من المهامّ المفتوحة هذا الشهر.', '/plan', null, null);
    end loop;
  end if;
end;
$$;
revoke all on function private.dept_plan_reminders() from public, anon, authenticated;

select cron.schedule('dept-plan-reminders', '0 5 * * *', 'select private.dept_plan_reminders()');

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'dept_plan_task_owners_guard')
     or not exists (select 1 from pg_trigger where tgname = 'dept_plan_tasks_guard') then
    raise exception 'حرّاس خطة القسم ناقصة';
  end if;
  if has_function_privilege('authenticated', 'private.dept_plan_reminders()', 'execute') then
    raise exception 'دالّة التذكير مكشوفةٌ للعميل';
  end if;
  if not exists (select 1 from cron.job where jobname = 'dept-plan-reminders') then
    raise exception 'مهمّة التذكير غير مجدولة';
  end if;
end $$;
