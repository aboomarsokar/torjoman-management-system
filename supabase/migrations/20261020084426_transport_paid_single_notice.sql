-- ============================================================
-- إشعارُ التسديد واحدٌ يُحدَّث (قرار المستخدم 2026-10-20): تشغيلُ مفتاح «مسدَّدة» وإطفاؤه مراراً كان يُرسل
-- خبراً جديداً في كلّ مرّة. الآن لكلّ صاحب رحلاتٍ في كلّ شهرٍ خبرٌ واحدٌ غيرُ مقروء على الأكثر، يحمل عددَ
-- ما سُدّد ومبلغَه منذ آخر خبرٍ قرأه عن ذلك الشهر؛ يُستبدل بخبرٍ جديد عند كلّ تغيير (فيرنّ الجرس)،
-- ويُحذف إن أُلغي تسديدُ ما فيه كلِّه.
-- ============================================================

-- يعيد بناء خبر التسديد لصاحبٍ وشهر: يحذف غيرَ المقروء، ثم ينشئ خبراً بما سُدّد منذ آخر خبرٍ مقروء (إن وُجد شيء).
create or replace function private.refresh_transport_notice(p_owner uuid, p_year int, p_month int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_link text := '/transport?y=' || p_year || '&m=' || p_month;
  v_from date := make_date(p_year, p_month, 1);
  v_since timestamptz;
  v_count integer;
  v_total numeric;
begin
  select max(n.read_at) into v_since
    from public.notifications n
   where n.recipient_id = p_owner and n.kind = 'transport_paid' and n.link = v_link and n.read_at is not null;

  select count(*), coalesce(sum(t.amount), 0) into v_count, v_total
    from public.transport_trips t
   where t.profile_id = p_owner and t.paid
     and t.trip_date >= v_from and t.trip_date < (v_from + interval '1 month')::date
     and t.paid_at > coalesce(v_since, '-infinity'::timestamptz);

  delete from public.notifications n
   where n.recipient_id = p_owner and n.kind = 'transport_paid' and n.link = v_link and n.read_at is null;

  if v_count > 0 then
    perform private.notify(
      p_owner, 'transport_paid', 'سُدّدت رحلاتُك',
      'عدد الرحلات: ' || v_count || ' · المبلغ: ' || to_char(v_total, 'FM999990.00') || ' ₪ · الشهر: '
        || lpad(p_month::text, 2, '0') || '-' || p_year,
      v_link, 'transport_trips', null);
  end if;
end;
$$;
revoke all on function private.refresh_transport_notice(uuid, int, int) from public, anon, authenticated;

-- التسديد الجماعيّ: كما كان، والإشعارُ صار إعادةَ بناءٍ لكلّ (صاحب، شهر) تغيّرت فيه رحلةٌ — تسديداً أو إلغاءً.
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

  for r in
    select distinct c.profile_id, extract(year from c.trip_date)::int as y, extract(month from c.trip_date)::int as m
      from _transport_changed c
  loop
    perform private.refresh_transport_notice(r.profile_id, r.y, r.m);
  end loop;
  return v_count;
end;
$$;
revoke all on function public.set_transport_paid(uuid[], boolean) from public, anon, authenticated;
grant execute on function public.set_transport_paid(uuid[], boolean) to authenticated;

-- فحصٌ ذاتيّ
do $$
begin
  if pg_get_functiondef('public.set_transport_paid(uuid[], boolean)'::regprocedure) not like '%refresh_transport_notice%' then
    raise exception 'set_transport_paid لا يعيد بناء الخبر';
  end if;
  if has_function_privilege('authenticated', 'private.refresh_transport_notice(uuid, int, int)', 'execute')
     or has_function_privilege('anon', 'public.set_transport_paid(uuid[], boolean)', 'execute')
     or not has_function_privilege('authenticated', 'public.set_transport_paid(uuid[], boolean)', 'execute') then
    raise exception 'منحُ دوالّ التسديد خاطئ';
  end if;
end $$;
