-- إشعارُ رسالة الإدارة بلا تفاصيلها (طلب المستخدم 2026-10-25): الجرسُ يحمل العنوانَ و«اضغط هنا للاطلاع على التفاصيل»،
-- والضغطُ يفتح «رسائل الإدارة» — فتُقرأ الرسالةُ هناك وتُسجَّل مشاهدتُها. لا تغييرَ غيرُه في الدالّة.

create or replace function public.send_staff_message(
  p_title text, p_body text, p_link text, p_roles text[], p_section text, p_target uuid
) returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_role text := public.current_user_role();
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_id uuid;
  v_n integer;
  t record;
begin
  perform private.assert_session_writable();

  if v_role not in ('admin_manager', 'technical_manager', 'women_admin') then
    raise exception 'لا صلاحية لإرسال الرسائل' using errcode = '42501';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'العنوان مطلوب' using errcode = '22023';
  end if;

  if p_target is not null then
    select role::text as role, gender::text as gender, status into t from public.profiles where id = p_target;
    if t is null or t.status <> 'active' or t.role not in ('teacher', 'field_supervisor', 'examiner') then
      raise exception 'المستلمُ ليس من الكادر النشط' using errcode = '22023';
    end if;
    if (v_role = 'technical_manager' and t.gender = 'female') or (v_role = 'women_admin' and t.gender is distinct from 'female') then
      raise exception 'لا صلاحية للمراسلة خارج قسمك' using errcode = '42501';
    end if;
  else
    if p_roles is null or cardinality(p_roles) = 0 or not (p_roles <@ array['teacher', 'field_supervisor', 'examiner']) then
      raise exception 'اختر فئةً واحدةً على الأقلّ' using errcode = '22023';
    end if;
    if not (v_role = 'admin_manager'
            or (v_role = 'technical_manager' and p_section = 'male')
            or (v_role = 'women_admin' and p_section = 'female')) then
      raise exception 'لا صلاحية للمراسلة خارج قسمك' using errcode = '42501';
    end if;
  end if;

  insert into public.staff_messages (title, body, link, roles, section, target_id, sent_by)
  values (btrim(p_title), nullif(btrim(coalesce(p_body, '')), ''), v_link,
          case when p_target is null then p_roles end, case when p_target is null then p_section end, p_target, auth.uid())
  returning id into v_id;

  insert into public.staff_message_recipients (message_id, recipient_id)
  select v_id, p.id from public.profiles p
   where p.status = 'active'
     and p.id <> auth.uid()
     and (case when p_target is not null then p.id = p_target
               else p.role::text = any (p_roles) and (p_section = 'all' or p.gender::text = p_section) end);
  get diagnostics v_n = row_count;

  update public.staff_messages set recipients = v_n where id = v_id;

  perform private.notify(r.recipient_id, 'announcement', btrim(p_title), 'اضغط هنا للاطلاع على التفاصيل', '/messages', 'staff_messages', v_id)
     from public.staff_message_recipients r where r.message_id = v_id;

  return v_n;
end;
$function$;

