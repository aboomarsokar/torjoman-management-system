-- حارسُ الجلسة في دالّتي المجدوِل (يمرّ بلا أثرٍ إذ لا جلسةَ لـcron ولا service_role) — قاعدةُ الدوالّ الكاتبة.
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

