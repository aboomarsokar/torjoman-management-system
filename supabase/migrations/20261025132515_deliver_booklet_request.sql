-- «تمّ التسليم» لطلب ملازم يسجّل التسليمَ في الأرشيف (طلب المستخدم 2026-10-25): خطوةٌ واحدةٌ ذرّيّة — صفُّ تسليمٍ في
-- `booklet_deliveries` بملزمة الطلب ونُسخه وتاريخٍ يختاره المدير، ثم يُغلَق الطلب. ومشغّلُ التسليم القائم يُشعر
-- المعلّمَ «استلمت حلقتُك ملازم — الجزء … × … نسخة · التاريخ»؛ ورابطُه صار صفحةَ «الملازم» عنده لا لوحتَه.

create or replace function public.deliver_booklet_request(p_request uuid, p_delivered_on date)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r public.booklet_requests%rowtype;
  v_delivery uuid;
begin
  perform private.assert_session_writable();

  if not public.is_admin_manager() then
    raise exception 'تسليمُ الملازم للمدير الإداري' using errcode = '42501';
  end if;

  select * into r from public.booklet_requests where id = p_request for update;
  if not found then
    raise exception 'الطلبُ غير موجود' using errcode = '22023';
  end if;
  if r.status <> 'open' then
    raise exception 'سُلِّم هذا الطلبُ من قبل' using errcode = '22023';
  end if;

  insert into public.booklet_deliveries (halaqa_id, booklet, copies, delivered_on, note)
  values (r.halaqa_id, r.booklet, r.copies,
          coalesce(p_delivered_on, (now() at time zone 'Asia/Gaza')::date),
          left('بطلب المعلّم' || coalesce(' — ' || nullif(btrim(r.note), ''), ''), 300))
  returning id into v_delivery;

  update public.booklet_requests set status = 'done', closed_at = now() where id = p_request;
  return v_delivery;
end;
$function$;

revoke all on function public.deliver_booklet_request(uuid, date) from public, anon;
grant execute on function public.deliver_booklet_request(uuid, date) to authenticated;

-- إشعارُ التسليم يفتح «الملازم» عند المعلّم (فيها جدولُ التسليمات بتواريخها)
create or replace function private.notify_booklet_delivered()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  h record;
begin
  select name, teacher_id, gender into h from public.halaqat where id = new.halaqa_id;
  perform private.notify(
    h.teacher_id, 'booklet_delivered',
    case when h.gender = 'female' then 'استلمت حلقتُكِ ملازم' else 'استلمت حلقتُك ملازم' end,
    'الجزء ' || (31 - 2 * new.booklet) || ' + ' || (32 - 2 * new.booklet) || ' × ' || new.copies
      || ' نسخة · ' || to_char(new.delivered_on, 'DD-MM-YYYY'),
    '/my-booklets', 'booklet_deliveries', new.id);
  return null;
end;
$function$;
