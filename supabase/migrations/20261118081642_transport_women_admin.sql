-- كشفُ المواصلات للمديرة الإدارية للقسم النسائي (طلب المستخدم 2026-11-18: «بدي أعمل كشف مواصلات
-- لمشرفة القسم النسائي شيماء عواد في صفحتها»).
--
-- تُدخل رحلاتِها كالمشرف الميدانيّ والمختبِر («رحلاتي»): تُضيف وتعدّل وتحذف ما لم يُسدَّد،
-- **والتسديدُ للمدير الإداري وحده** كما هو، ويصلها إشعارُ «سُدّدت رحلاتُك».
-- ⚠️ **بالدور لا بالشخص** (`women_admin`): الحارسان يقرآن الدور، وصاحبُه اليوم واحدة.
-- ⚠️ والجسمان من نصّ الإنتاج الحيّ 2026-11-18 (`pg_get_functiondef`) — تغيّرت قائمةُ الأدوار وحدَها.

create or replace function private.can_log_transport()
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select coalesce(public.current_user_role()::text in ('field_supervisor', 'examiner', 'women_admin'), false);
$$;

create or replace function private.guard_transport_trip()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.trip_date > (now() at time zone 'Asia/Gaza')::date then
    raise exception 'لا تُسجَّل رحلةٌ بتاريخٍ لم يأتِ بعد.' using errcode = '23514';
  end if;
  if not public.is_admin_manager() then
    if tg_op = 'INSERT' and (new.paid or new.paid_at is not null or new.paid_by is not null) then
      raise exception 'التسديدُ للمدير الإداري وحده.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
         new.paid is distinct from old.paid or new.paid_at is distinct from old.paid_at
         or new.paid_by is distinct from old.paid_by or new.profile_id is distinct from old.profile_id) then
      raise exception 'التسديدُ وصاحبُ الرحلة للمدير الإداري وحده.' using errcode = '42501';
    end if;
  end if;
  if (tg_op = 'INSERT' or new.profile_id is distinct from old.profile_id) and not exists (
       select 1 from public.profiles p
       where p.id = new.profile_id and p.role::text in ('field_supervisor', 'examiner', 'women_admin')) then
    raise exception 'صاحبُ الرحلة ليس مشرفاً ميدانياً ولا مختبِراً ولا المديرةَ الإدارية للقسم النسائي.' using errcode = '23514';
  end if;
  return new;
end;
$$;
