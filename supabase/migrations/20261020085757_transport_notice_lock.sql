-- ============================================================
-- قفلٌ استشاريّ في إعادة بناء خبر التسديد (المراجعة الأخيرة للجزء ٤): تسديدان متزامنان لرحلتين من صاحبٍ وشهرٍ
-- واحد كانا يريان الحالَ قبل تثبيت الآخر فيُنشئان خبرين غيرَ مقروءين. القفلُ يجعلهما يتعاقبان.
-- ============================================================

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
  -- تسديدان متزامنان لصاحبٍ وشهرٍ واحد يتعاقبان: الثاني يقرأ بعد أن يُثبَّت الأوّل فلا يولد خبران
  perform pg_advisory_xact_lock(hashtextextended('transport_notice:' || p_owner || ':' || p_year || '-' || p_month, 0));

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

do $$
begin
  if pg_get_functiondef('private.refresh_transport_notice(uuid, int, int)'::regprocedure) not like '%pg_advisory_xact_lock%' then
    raise exception 'القفلُ غير موجود في refresh_transport_notice';
  end if;
  if has_function_privilege('authenticated', 'private.refresh_transport_notice(uuid, int, int)', 'execute') then
    raise exception 'refresh_transport_notice ممنوحةٌ لـauthenticated';
  end if;
end $$;
