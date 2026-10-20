-- ============================================================
-- النيابةُ قراءةٌ فقط — في القاعدة لا في الواجهة (الجزء ٥، Task 2).
-- سياساتٌ تقييديّة تُضاف ولا تُمسّ السياساتُ القائمة: سياساتُ ALL الأربع التي هي طريقُ قراءة
-- مشرف المشروع تبقى كما هي (إلحاقُ الحارس بـUSING فيها يُعميه)، وصيغُ visible_halaqa_ids
-- وفروعُ الطالب المنقول لا تُلمس حرفاً. وكلُّ سياسة كتابةٍ تُضاف غداً على جدولٍ هنا محروسةٌ تلقائياً.
-- خطُّ الأساس 2026-10-20: 55 سياسةَ كتابة (47 public على 25 جدولاً + 8 storage.objects)،
-- و31 جدولاً في public يُحرس منها 28 (بلا جدولَي النيابة وnotifications) + storage.objects = 87 سياسةً تقييديّة.
-- ============================================================

-- لقطةُ كلّ السياسات قبل المسّ — تُقارَن في الذيل حرفاً (الاسم، الأمر، النوع، الأدوار، النصّان).
create temporary table _policies_before on commit drop as
select schemaname, tablename, policyname, cmd, permissive, roles::text[] as roles, qual, with_check
from pg_policies where schemaname in ('public', 'storage');

-- ═══ مشغّلُ السجلّ — يُعاد بتأمين: صفُّ جلسةٍ غائبٌ لا يُسقط كتابةً أبداً ═══
-- يُعلَّق AFTER … FOR EACH ROW WHEN (private.is_impersonating()) وحدَه، فالغيابُ هنا سباقٌ نادر
-- (حُذف الصفّ بين WHEN والبدن) — والسجلُّ الفارغ أهونُ من كتابةٍ مشروعةٍ تسقط.
create or replace function private.log_impersonation_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  s record;
begin
  select session_id, actor_profile_id, target_profile_id into s
  from public.impersonation_sessions
  where session_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
  if not found then
    return null;
  end if;

  insert into public.impersonation_writes (session_id, actor_profile_id, target_profile_id, op, table_name, old_row, new_row)
  values (s.session_id, s.actor_profile_id, s.target_profile_id, tg_op, tg_table_schema || '.' || tg_table_name,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return null;
end;
$$;
revoke all on function private.log_impersonation_write() from public, anon, authenticated;

-- WHEN يُقيَّم بصلاحية المنفِّذ لا المالك (درس «شرطُ المُشغِّل يحتاج منحاً») — منحٌ صريحٌ للدورين الكاتبين.
grant execute on function private.is_impersonating() to authenticated, service_role;

-- ═══ الحارسُ لكلّ جدول — للهجرات وحدها، بلا منحٍ لأحد ═══
-- كلُّ جدولٍ يُنشأ في public بعد اليوم تناديه هجرتُه (يحرسه impersonationDbGuards.test.ts).
create or replace function private.guard_table_for_impersonation(p_table regclass, p_audit boolean default true)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_schema text;
  v_name text;
  v_guard constant text := '(select private.assert_session_writable())';
begin
  select n.nspname, c.relname into v_schema, v_name
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.oid = p_table;

  execute format('drop policy if exists impersonation_ro_insert on %I.%I', v_schema, v_name);
  execute format('drop policy if exists impersonation_ro_update on %I.%I', v_schema, v_name);
  execute format('drop policy if exists impersonation_ro_delete on %I.%I', v_schema, v_name);
  execute format('create policy impersonation_ro_insert on %I.%I as restrictive for insert to authenticated with check (%s)', v_schema, v_name, v_guard);
  execute format('create policy impersonation_ro_update on %I.%I as restrictive for update to authenticated using (%s) with check (%s)', v_schema, v_name, v_guard, v_guard);
  execute format('create policy impersonation_ro_delete on %I.%I as restrictive for delete to authenticated using (%s)', v_schema, v_name, v_guard);

  if p_audit then
    execute format('drop trigger if exists log_impersonation_write on %I.%I', v_schema, v_name);
    -- WHEN بدالّة: مُنحت لـauthenticated وservice_role أعلاه (يُقيَّم بصلاحية المنفِّذ).
    execute format('create trigger log_impersonation_write after insert or update or delete on %I.%I '
                   'for each row when (private.is_impersonating()) execute function private.log_impersonation_write()',
                   v_schema, v_name);
  end if;
end;
$$;
revoke all on function private.guard_table_for_impersonation(regclass, boolean) from public, anon, authenticated, service_role;

-- كلُّ جداول public (لا ذاتُ السياسات وحدها — كي تُحرس سياسةٌ تُضاف غداً على جدولٍ بلا سياسةٍ اليوم)،
-- إلا جدولَي النيابة (يكتبهما الخادم والمشغّل؛ والسجلُّ لا يُدقِّق نفسَه) و notifications (تكتبه دوالّ definer).
do $$
declare
  t record;
begin
  for t in
    select c.oid::regclass as rel
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
      and c.relname not in ('impersonation_sessions', 'impersonation_writes', 'notifications')
  loop
    perform private.guard_table_for_impersonation(t.rel, true);
  end loop;
  -- المستودعات: حارسٌ بلا سجلّ (لا مشغّلات منّا على storage.objects).
  perform private.guard_table_for_impersonation('storage.objects'::regclass, false);
end $$;

-- ═══ حرسُ البدن في الدوالّ definer الثلاث التي يستدعيها العميل — منقولةٌ حرفاً من الإنتاج + سطرٌ بعد begin ═══

-- في كلّ نيابة، ولو في وضع التعديل: قراءةُ المدير لإشعارات الموظف ليست قراءةَ الموظف،
-- وتعليمُها يُخفيها عنه (عقد العمود الفقريّ ب).
create or replace function public.mark_notifications_read(p_ids uuid[] default null::uuid[])
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if private.is_impersonating() then return 0; end if;
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
$function$;

create or replace function public.set_transport_paid(p_ids uuid[], p_paid boolean)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_count integer;
  r record;
begin
  perform private.assert_session_writable();
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

  for r in
    select distinct c.profile_id, extract(year from c.trip_date)::int as y, extract(month from c.trip_date)::int as m
      from _transport_changed c
  loop
    perform private.refresh_transport_notice(r.profile_id, r.y, r.m);
  end loop;
  return v_count;
end;
$function$;

-- search_path = public كما في الإنتاج (لا يُغيَّر هنا)؛ والحارسُ مؤهَّلٌ بمخطّطه.
create or replace function public.update_my_contact(p_phone text, p_guardian_email text, p_residence text, p_nearest_mosque text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_phone text := nullif(btrim(p_phone), '');
  v_email text := nullif(lower(btrim(p_guardian_email)), '');
  v_residence text := nullif(btrim(p_residence), '');
  v_mosque text := nullif(btrim(p_nearest_mosque), '');
begin
  perform private.assert_session_writable();
  if public.current_user_role() is distinct from 'student' then
    raise exception 'تعديل هذه البيانات للطالب نفسه.' using errcode = '42501';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'رقم الجوال غير صحيح — أرقامٌ فقط (7 إلى 15).' using errcode = '22023';
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'البريد الإلكتروني غير صحيح.' using errcode = '22023';
  end if;
  if length(coalesce(v_residence, '')) > 120 or length(coalesce(v_mosque, '')) > 120 then
    raise exception 'النصّ أطول من 120 حرفاً.' using errcode = '22023';
  end if;

  update public.students
     set phone = v_phone,
         guardian_email = v_email,
         residence = v_residence,
         nearest_mosque = v_mosque
   where user_id = auth.uid();
  if not found then
    raise exception 'لا يوجد سجلّ طالبٍ لحسابك.' using errcode = 'P0002';
  end if;
end $function$;

-- ═══ حارسُ بيانات الدخول يشمل phone_change (مراجعة Task 1) — WHEN بمقارنة أعمدةٍ فقط بلا دالّة ═══
drop trigger if exists impersonation_credentials_guard on auth.users;
create trigger impersonation_credentials_guard
  before update of encrypted_password, email, email_change, phone, phone_change on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password
        or old.email is distinct from new.email
        or old.email_change is distinct from new.email_change
        or old.phone is distinct from new.phone
        or old.phone_change is distinct from new.phone_change)
  execute function private.guard_impersonated_credentials();

-- ═══ فحصٌ ذاتيّ ═══
do $$
declare
  v_missing text;
begin
  -- ① لا سياسةَ قائمةٌ تغيّرت (الاسم/الأمر/النوع/الأدوار/النصّان) ولا اختفت.
  if exists (
    select * from _policies_before
    except
    select schemaname, tablename, policyname, cmd, permissive, roles::text[], qual, with_check
    from pg_policies where schemaname in ('public', 'storage')
  ) then
    raise exception 'سياسةٌ قائمةٌ تغيّرت أو اختفت — الهجرةُ تُضيف ولا تمسّ';
  end if;
  -- ①ب وما أُضيف هو سياساتُ النيابة وحدها.
  if exists (
    select schemaname, tablename, policyname, cmd, permissive, roles::text[], qual, with_check
    from pg_policies where schemaname in ('public', 'storage')
    except
    select * from _policies_before
    except
    select schemaname, tablename, policyname, cmd, permissive, roles::text[], qual, with_check
    from pg_policies where policyname like 'impersonation_ro_%' and permissive = 'RESTRICTIVE'
  ) then
    raise exception 'سياسةٌ جديدةٌ غيرُ سياسات النيابة';
  end if;

  -- ② كلُّ جدولٍ فيه سياسةُ كتابةٍ مسموحة محروسٌ بالثلاث (ومنها storage.objects).
  select string_agg(distinct p.schemaname || '.' || p.tablename, ', ') into v_missing
  from pg_policies p
  where p.schemaname in ('public', 'storage') and p.permissive = 'PERMISSIVE'
    and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and (select count(*) from pg_policies g
         where g.schemaname = p.schemaname and g.tablename = p.tablename
           and g.permissive = 'RESTRICTIVE' and g.policyname like 'impersonation_ro_%'
           and g.roles = '{authenticated}'::name[]
           and coalesce(g.qual, '') || coalesce(g.with_check, '') like '%assert_session_writable%') <> 3;
  if v_missing is not null then
    raise exception 'جداولُ كتابةٍ بلا حارس النيابة: %', v_missing;
  end if;

  -- ③ العدد: 3 × (جداول public المحروسة + storage.objects).
  if (select count(*) from pg_policies where policyname like 'impersonation_ro_%')
     <> 3 * ((select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')
              and relname not in ('impersonation_sessions', 'impersonation_writes', 'notifications')) + 1) then
    raise exception 'عددُ السياسات التقييديّة لا يطابق';
  end if;

  -- ④ كلُّ جدولٍ مُدقَّق عليه المشغّل، بعد الصفّ وبشرط الدالّة.
  if exists (
    select 1 from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
      and c.relname not in ('impersonation_sessions', 'impersonation_writes', 'notifications')
      and not exists (select 1 from pg_trigger tr where tr.tgrelid = c.oid and tr.tgname = 'log_impersonation_write'
                        and tr.tgenabled = 'O'
                        and pg_get_triggerdef(tr.oid) ~ 'AFTER INSERT OR DELETE OR UPDATE .* FOR EACH ROW WHEN \(private\.is_impersonating\(\)\)')
  ) then
    raise exception 'جدولٌ محروسٌ بلا مشغّل السجلّ';
  end if;

  -- ⑤ كلُّ دالّة definer في public يستدعيها authenticated وتكتب ← فيها الحارس.
  select string_agg(p.proname, ', ') into v_missing
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prosecdef
    and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('authenticated', p.oid, 'execute')
    and pg_get_functiondef(p.oid) ~* '\m(insert\s+into|update\s+[a-z_.]+\s+set|delete\s+from)'
    and pg_get_functiondef(p.oid) !~ '(assert_session_writable|session_is_read_only|is_impersonating)';
  if v_missing is not null then
    raise exception 'دوالّ definer كاتبةٌ بلا حارس: %', v_missing;
  end if;

  -- ⑥ دوالُّ مشغّلات النيابة (log_/notify_/guard_) وحارسُ الجداول ليست لـanon/authenticated.
  select string_agg(p.oid::regprocedure::text, ', ') into v_missing
  from pg_proc p
  where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
    and (p.prorettype = 'trigger'::regtype and p.proname ~ '^(log_|notify_|guard_)'
         or p.oid = 'private.guard_table_for_impersonation(regclass, boolean)'::regprocedure)
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  if v_missing is not null then
    raise exception 'دوالُّ مشغّلاتٍ ممنوحةٌ للعميل: %', v_missing;
  end if;

  -- ⑦ شرطُ WHEN ممنوحٌ لكلّ دورٍ يكتب.
  if not has_function_privilege('authenticated', 'private.is_impersonating()', 'execute')
     or not has_function_privilege('service_role', 'private.is_impersonating()', 'execute')
     or not has_function_privilege('authenticated', 'private.assert_session_writable()', 'execute') then
    raise exception 'منحُ الحارسين ناقص — ستسقط الكتابة';
  end if;

  -- ⑧ حارسُ بيانات الدخول يشمل phone_change.
  if not exists (select 1 from pg_trigger where tgname = 'impersonation_credentials_guard' and tgrelid = 'auth.users'::regclass
                 and pg_get_triggerdef(oid) like '%old.phone_change IS DISTINCT FROM new.phone_change%') then
    raise exception 'حارسُ بيانات الدخول لا يشمل phone_change';
  end if;
end $$;

-- ⑨ الكتابةُ بـservice_role ما زالت تمرّ (درس الصحابة 2026-09-22: شرطُ WHEN أسقط كلَّ كتابة الخادم).
do $$
begin
  begin
    set local role service_role;
    update public.app_settings set updated_at = updated_at where true;
    raise exception 'PROBE' using errcode = 'P9002';
  exception
    when sqlstate 'P9002' then reset role;
    when others then reset role; raise exception 'الكتابةُ بـservice_role تسقط: % — %', sqlstate, sqlerrm;
  end;
end $$;
