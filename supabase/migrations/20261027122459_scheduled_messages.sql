-- الرسائلُ المجدولة (طلب المستخدم 2026-10-27): تذكيرٌ مرّةً أو أسبوعياً أو شهرياً لفئات الكادر والإدارة، داخل المنصّة
-- (رسائلُ الإدارة للكادر، وجرسُ الإدارة) و/أو SMS. المديرُ الإداريّ للقسمين وبالقناتين، والمديرُ الفنيّ للبنين والمديرةُ
-- الإدارية للبنات داخل المنصّة وحدها. الموعدُ بتوقيت غزة. يُطلقها `pg_cron` كلَّ خمس دقائق (`private.dispatch_scheduled_messages`)،
-- وما كان SMS يُصفّ في `scheduled_sms_queue` ويُرسله مسارُ الخادم `/api/cron/sms` (يُنادى بـ`pg_net` ومعه رمزٌ لمرّةٍ واحدة).

create extension if not exists pg_net;

create table public.scheduled_messages (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  body         text check (body is null or char_length(body) <= 600),
  link         text check (link is null or link ~ '^/[A-Za-z0-9/_?=&-]*$'),
  roles        text[] not null check (cardinality(roles) > 0 and roles <@ array['teacher', 'field_supervisor', 'examiner',
                 'project_supervisor', 'admin_manager', 'technical_manager', 'women_admin']),
  section      text not null default 'all' check (section in ('all', 'male', 'female')),
  in_app       boolean not null default true,
  sms          boolean not null default false,
  recurrence   text not null check (recurrence in ('once', 'weekly', 'monthly')),
  run_at       timestamptz,
  weekday      smallint check (weekday between 0 and 6),
  month_day    smallint check (month_day between 1 and 28),
  time_of_day  time,
  next_run_at  timestamptz,
  last_run_at  timestamptz,
  runs         integer not null default 0,
  active       boolean not null default true,
  created_by   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint scheduled_messages_channel check (in_app or sms),
  constraint scheduled_messages_when check (
    (recurrence = 'once' and run_at is not null)
    or (recurrence = 'weekly' and weekday is not null and time_of_day is not null)
    or (recurrence = 'monthly' and month_day is not null and time_of_day is not null))
);
create index scheduled_messages_due_idx on public.scheduled_messages (next_run_at) where active;

-- الموعدُ التالي بعد لحظةٍ معطاة، بتوقيت غزة (الأحد 0 … السبت 6 كـextract(dow))
create or replace function private.scheduled_next_run(p_recurrence text, p_run_at timestamptz, p_weekday smallint,
  p_month_day smallint, p_time time, p_after timestamptz)
returns timestamptz
language plpgsql stable
set search_path = ''
as $$
declare
  v_local timestamp := p_after at time zone 'Asia/Gaza';
  v_day date := v_local::date;
  v_candidate timestamp;
begin
  if p_recurrence = 'once' then
    return case when p_run_at > p_after then p_run_at end;
  elsif p_recurrence = 'weekly' then
    v_candidate := (v_day + ((p_weekday - extract(dow from v_day)::int + 7) % 7)) + p_time;
    if v_candidate <= v_local then v_candidate := v_candidate + interval '7 days'; end if;
  else
    v_candidate := make_date(extract(year from v_day)::int, extract(month from v_day)::int, p_month_day) + p_time;
    if v_candidate <= v_local then v_candidate := v_candidate + interval '1 month'; end if;
  end if;
  return v_candidate at time zone 'Asia/Gaza';
end;
$$;
revoke all on function private.scheduled_next_run(text, timestamptz, smallint, smallint, time, timestamptz) from public, anon, authenticated;

-- الحارس: الموعدُ التالي يُحسب هنا، وSMS للمدير الإداريّ وحده، والقسمُ للمدير الفنيّ والمديرة الإدارية قسمُهما
create or replace function private.guard_scheduled_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role text := public.current_user_role();
begin
  if auth.uid() is not null then
    if v_role = 'technical_manager' and new.section <> 'male' then
      raise exception 'المدير الفنيّ يجدول لقسم البنين.' using errcode = '42501';
    elsif v_role = 'women_admin' and new.section <> 'female' then
      raise exception 'المديرة الإدارية تجدول لقسم البنات.' using errcode = '42501';
    end if;
    if new.sms and v_role is distinct from 'admin_manager' then
      raise exception 'رسائلُ SMS للمدير الإداريّ وحده.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'INSERT'
     or (new.recurrence, new.run_at, new.weekday, new.month_day, new.time_of_day, new.active)
        is distinct from (old.recurrence, old.run_at, old.weekday, old.month_day, old.time_of_day, old.active) then
    new.next_run_at := private.scheduled_next_run(new.recurrence, new.run_at, new.weekday, new.month_day, new.time_of_day, now());
    if new.active and new.next_run_at is null then
      raise exception 'الموعد في الماضي — اختر موعداً قادماً.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_scheduled_message() from public, anon, authenticated;

create trigger scheduled_messages_guard
  before insert or update on public.scheduled_messages
  for each row execute function private.guard_scheduled_message();

alter table public.scheduled_messages enable row level security;
create policy scheduled_messages_select on public.scheduled_messages for select to authenticated
  using (
    (select public.current_user_role()) in ('admin_manager', 'project_supervisor')
    or created_by = (select auth.uid())
    or ((select public.current_user_role()) = 'technical_manager' and section = 'male')
    or ((select public.current_user_role()) = 'women_admin' and section = 'female')
  );
create policy scheduled_messages_write on public.scheduled_messages for all to authenticated
  using (
    (select public.is_admin_manager())
    or ((select public.current_user_role()) = 'technical_manager' and section = 'male')
    or ((select public.current_user_role()) = 'women_admin' and section = 'female')
  )
  with check (
    (select public.is_admin_manager())
    or ((select public.current_user_role()) = 'technical_manager' and section = 'male' and not sms)
    or ((select public.current_user_role()) = 'women_admin' and section = 'female' and not sms)
  );
grant select, insert, update, delete on public.scheduled_messages to authenticated;
select private.guard_table_for_impersonation('public.scheduled_messages');

-- صفُّ SMS المجدولة: رقمٌ لكلّ سطر، يُرسله الخادم
create table public.scheduled_sms_queue (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid references public.scheduled_messages(id) on delete set null,
  body         text not null check (char_length(body) between 1 and 1000),
  name         text,
  phone        text not null check (phone ~ '^05\d{8}$'),
  sent_by      uuid references public.profiles(id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  code         text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index scheduled_sms_queue_pending_idx on public.scheduled_sms_queue (created_at) where status = 'pending';
alter table public.scheduled_sms_queue enable row level security;
create policy scheduled_sms_queue_select on public.scheduled_sms_queue for select to authenticated
  using ((select public.current_user_role()) in ('admin_manager', 'project_supervisor'));
grant select on public.scheduled_sms_queue to authenticated;
select private.guard_table_for_impersonation('public.scheduled_sms_queue');

-- رمزٌ لمرّةٍ واحدة يُثبت للخادم أنّ النداءَ من المجدوِل (لا سرَّ مشتركاً ولا سياسةَ للعميل)
create table private.cron_nonces (
  nonce       uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now()
);
revoke all on private.cron_nonces from public, anon, authenticated;

create or replace function public.consume_cron_nonce(p_nonce uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  perform private.assert_session_writable();
  delete from private.cron_nonces where created_at < now() - interval '10 minutes';
  delete from private.cron_nonces where nonce = p_nonce returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;
revoke all on function public.consume_cron_nonce(uuid) from public, anon, authenticated;
grant execute on function public.consume_cron_nonce(uuid) to service_role;

-- المُطلِق: يُرسل ما حان، ويحسب الموعدَ التالي، ويصفّ SMS ويوقظ الخادمَ إن كان في الصفّ شيء
create or replace function private.dispatch_scheduled_messages()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  s record;
  v_msg uuid;
  v_n integer;
  v_staff text[];
  v_done integer := 0;
  v_nonce uuid;
begin
  perform private.assert_session_writable();
  for s in select * from public.scheduled_messages
            where active and next_run_at is not null and next_run_at <= now()
            order by next_run_at for update skip locked loop
    if s.in_app then
      v_staff := array(select unnest(s.roles) intersect select unnest(array['teacher', 'field_supervisor', 'examiner']));
      if cardinality(v_staff) > 0 then
        insert into public.staff_messages (title, body, link, roles, section, sent_by)
        values (btrim(s.title), s.body, s.link, v_staff, s.section, s.created_by)
        returning id into v_msg;
        insert into public.staff_message_recipients (message_id, recipient_id)
        select v_msg, p.id from public.profiles p
         where p.status = 'active' and p.role::text = any (v_staff)
           and (s.section = 'all' or p.gender::text = s.section);
        get diagnostics v_n = row_count;
        update public.staff_messages set recipients = v_n where id = v_msg;
        perform private.notify(r.recipient_id, 'announcement', btrim(s.title), 'اضغط هنا للاطلاع على التفاصيل', '/messages', 'staff_messages', v_msg)
           from public.staff_message_recipients r where r.message_id = v_msg;
      end if;
      -- الإدارةُ لا صفحةَ «رسائل الإدارة» لها: يصلها النصُّ في الجرس
      perform private.notify(p.id, 'announcement', btrim(s.title), coalesce(s.body, ''), coalesce(s.link, '/dashboard'), 'scheduled_messages', s.id)
         from public.profiles p
        where p.status = 'active' and p.role::text = any (s.roles)
          and p.role::text in ('project_supervisor', 'admin_manager', 'technical_manager', 'women_admin')
          and (s.section = 'all' or p.gender::text = s.section or p.role::text in ('project_supervisor', 'admin_manager'));
    end if;
    if s.sms then
      insert into public.scheduled_sms_queue (schedule_id, body, name, phone, sent_by)
      select s.id, btrim(s.title) || case when s.body is not null then E'\n' || s.body else '' end, p.full_name, x.phone, s.created_by
        from public.profiles p
        cross join lateral (select case
            when regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') ~ '^05\d{8}$' then regexp_replace(p.phone, '\D', '', 'g')
            when regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') ~ '^9705\d{8}$' then '0' || substr(regexp_replace(p.phone, '\D', '', 'g'), 4)
          end as phone) x
       where p.status = 'active' and p.role::text = any (s.roles) and x.phone is not null
         and (s.section = 'all' or p.gender::text = s.section);
    end if;
    update public.scheduled_messages
       set last_run_at = now(), runs = runs + 1,
           next_run_at = private.scheduled_next_run(recurrence, run_at, weekday, month_day, time_of_day, now()),
           active = recurrence <> 'once'
     where id = s.id;
    v_done := v_done + 1;
  end loop;

  if exists (select 1 from public.scheduled_sms_queue where status = 'pending') then
    insert into private.cron_nonces default values returning nonce into v_nonce;
    perform net.http_post(
      url := 'https://torjoman.org/api/cron/sms',
      body := jsonb_build_object('nonce', v_nonce),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 30000);
  end if;
  return v_done;
end;
$$;
revoke all on function private.dispatch_scheduled_messages() from public, anon, authenticated;

select cron.schedule('dispatch-scheduled-messages', '*/5 * * * *', 'select private.dispatch_scheduled_messages()');
