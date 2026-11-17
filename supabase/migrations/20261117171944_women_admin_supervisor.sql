-- المديرةُ الإدارية تُسند حلقاتِ البنات للمشرفات (طلب المستخدم 2026-11-17).
-- دالّةٌ واحدة تكتب `supervisor_id` وحده — لا تعديلَ لسائر أعمدة الحلقة ولا إنشاءَ ولا حذف. والدورُ والجنسُ
-- يحرسهما `guard_halaqa_staff` (المسنَد مشرفٌ ميدانيّ من جنس الحلقة). null = بلا مشرفة.
create or replace function public.assign_halaqa_supervisor(p_halaqa uuid, p_supervisor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role := public.current_user_role();
  v_gender text;
begin
  perform private.assert_session_writable();
  select h.gender::text into v_gender from public.halaqat h where h.id = p_halaqa;
  if v_gender is null then
    raise exception 'الحلقة غير موجودة.' using errcode = '42501';
  end if;
  if not (v_role = 'admin_manager' or (v_role = 'women_admin' and v_gender = 'female')) then
    raise exception 'إسنادُ المشرفة لحلقات البنات للمديرة الإدارية والمدير الإداري.' using errcode = '42501';
  end if;
  if p_supervisor is not null and not exists (select 1 from public.profiles p
       where p.id = p_supervisor and p.role = 'field_supervisor' and p.status = 'active') then
    raise exception 'المختارةُ ليست مشرفةً ميدانيةً نشطة.' using errcode = '23514';
  end if;
  update public.halaqat h set supervisor_id = p_supervisor, assigned_by = (select auth.uid())
   where h.id = p_halaqa;
end;
$$;
revoke execute on function public.assign_halaqa_supervisor(uuid, uuid) from public, anon;
grant execute on function public.assign_halaqa_supervisor(uuid, uuid) to authenticated;
