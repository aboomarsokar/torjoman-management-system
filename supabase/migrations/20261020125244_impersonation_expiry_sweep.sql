-- ============================================================
-- كنسُ جلسات النيابة المنتهية كلَّ خمس دقائق (Task 2ب، بإذن المستخدم 2026-10-20).
-- لسانٌ أُغلق بلا «إنهاء» يترك جلسةً حيّةً في auth.sessions: تعطي RLS دوراً، وتمنع حارسُ بيانات الدخول
-- الموظفَ نفسَه من تغيير كلمته. فيختمها pg_cron ويُبطل جلستَها في auth.sessions بمعرّفها وحده.
-- ============================================================

create extension if not exists pg_cron;

-- تُرجع عددَ جلسات auth.sessions التي أُبطلت. لا منحَ لأحد: يشغّلها cron بصلاحية postgres.
create or replace function private.sweep_expired_impersonations()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_removed integer;
begin
  update public.impersonation_sessions
     set ended_at = now(), ended_reason = 'expired'
   where ended_at is null and expires_at <= now();

  v_removed := private.end_impersonation_sessions(
    array(select session_id from public.impersonation_sessions where expires_at <= now())
  );
  return v_removed;
end;
$$;
revoke all on function private.sweep_expired_impersonations() from public, anon, authenticated;

-- جدولةٌ متكرّرة الأمان: تُزال المهمّةُ ذاتُ الاسم إن وُجدت ثم تُنشأ.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'impersonation-expiry-sweep') then
    perform cron.unschedule('impersonation-expiry-sweep');
  end if;
  perform cron.schedule('impersonation-expiry-sweep', '*/5 * * * *', $job$select private.sweep_expired_impersonations()$job$);
end $$;

-- ═══ فحصٌ ذاتيّ ═══
do $$
declare
  f record;
begin
  select p.prosecdef, p.proconfig into f
  from pg_proc p where p.oid = 'private.sweep_expired_impersonations()'::regprocedure;
  if not found or not f.prosecdef then
    raise exception 'sweep_expired_impersonations غائبة أو ليست definer';
  end if;
  if f.proconfig is null or not ('search_path=""' = any (f.proconfig)) then
    raise exception 'sweep_expired_impersonations بلا search_path فارغ';
  end if;
  if has_function_privilege('anon', 'private.sweep_expired_impersonations()', 'execute')
     or has_function_privilege('authenticated', 'private.sweep_expired_impersonations()', 'execute')
     or has_function_privilege('service_role', 'private.sweep_expired_impersonations()', 'execute') then
    raise exception 'sweep_expired_impersonations: المنحُ مفتوح';
  end if;
  if not exists (select 1 from cron.job
                 where jobname = 'impersonation-expiry-sweep' and schedule = '*/5 * * * *'
                   and command like '%private.sweep_expired_impersonations()%' and active) then
    raise exception 'مهمّةُ الكنس غير مجدولة كما يجب';
  end if;
end $$;
