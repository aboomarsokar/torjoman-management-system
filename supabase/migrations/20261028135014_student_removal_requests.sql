-- طلبُ حذف طالب (طلب المستخدم 2026-10-28) — بآلية طلبات الإضافة نفسِها: المعلّمُ يطلب من صفحته حذفَ طالبٍ منتظمٍ في حلقته
-- **بسببٍ إلزاميّ**، فيُشعَر المديرُ الإداريّ (والمديرةُ الإدارية في حلقات البنات)، والمديرُ يُنهي التحاقَه أو يرفض بسبب فيُشعَر
-- المعلّم. «الحذفُ» إنهاءُ التحاق لا حذفٌ من القاعدة (قرار المستخدم): `students.status = 'withdrawn'` من يوم الموافقة — يخرج من
-- قوائم الحلقة والحضور والرصد، ويبقى سجلُّه كلُّه، ويُوقَف حسابُه (`students_sync_account_status`)، ويُعاد من صفحة الطلاب.

alter table public.student_requests
  add column kind text not null default 'add' check (kind in ('add', 'remove')),
  alter column national_id drop not null;

alter table public.student_requests drop constraint student_requests_status_check;
alter table public.student_requests add constraint student_requests_status_check
  check (status in ('open', 'added', 'rejected', 'removed'));
-- الإضافةُ بهويةٍ و«أُضيف»، والحذفُ بسببٍ و«أُنهي التحاقُه»
alter table public.student_requests add constraint student_requests_add_has_identity
  check (kind <> 'add' or national_id is not null);
alter table public.student_requests add constraint student_requests_remove_has_reason
  check (kind <> 'remove' or char_length(btrim(coalesce(note, ''))) >= 3);
alter table public.student_requests add constraint student_requests_status_fits_kind
  check ((status <> 'added' or kind = 'add') and (status <> 'removed' or kind = 'remove'));

-- طلبُ حذفٍ مفتوحٌ واحدٌ للطالب
create unique index student_requests_open_removal on public.student_requests (student_id)
  where status = 'open' and kind = 'remove';

-- حارسُ الإدراج: الإضافةُ كما كانت؛ والحذفُ لطالبٍ منتظمٍ في الحلقة نفسِها، والاسمُ لقطةٌ من سجلّه (يبقى ظاهراً في الطلب)
create or replace function private.guard_student_request()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  st record;
begin
  if new.kind = 'remove' then
    select s.full_name, s.halaqa_id, s.status into st from public.students s where s.id = new.student_id;
    if not found or st.halaqa_id is distinct from new.halaqa_id then
      raise exception 'الطالبُ ليس في حلقتك.' using errcode = '23514';
    end if;
    if st.status <> 'active' then
      raise exception 'الطالبُ ليس منتظماً في الحلقة — لا حاجةَ لطلب حذفه.' using errcode = '23514';
    end if;
    new.full_name := st.full_name;
    new.national_id := null;
    new.note := btrim(new.note);
    return new;
  end if;
  new.full_name := regexp_replace(btrim(new.full_name), '\s+', ' ', 'g');
  if not private.valid_national_id(new.national_id) then
    raise exception 'رقم الهوية غير صحيح — تحقّق من خاناته التسع.' using errcode = '23514';
  end if;
  if exists (select 1 from public.students s where s.national_id = new.national_id) then
    raise exception 'رقم الهوية مسجّلٌ لطالبٍ على المنصّة.' using errcode = '23505';
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_student_request() from public, anon, authenticated;

-- إشعارُ الطلب: «طلب معلّمٌ حذفَ طالب» بالسبب
create or replace function private.notify_student_requested()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  h record;
  v_teacher text;
  v_rcpt uuid;
  v_remove boolean := new.kind = 'remove';
begin
  select name, gender into h from public.halaqat where id = new.halaqa_id;
  select full_name into v_teacher from public.profiles where id = new.requested_by;
  for v_rcpt in select id from public.profiles
                 where status = 'active'
                   and (role = 'admin_manager' or (role = 'women_admin' and h.gender = 'female')) loop
    perform private.notify(
      v_rcpt, 'student_requested',
      case
        when v_remove then case when h.gender = 'female' then 'طلبت معلّمةٌ حذفَ طالبة' else 'طلب معلّمٌ حذفَ طالب' end
        else case when h.gender = 'female' then 'طلبت معلّمةٌ إضافةَ طالبة' else 'طلب معلّمٌ إضافةَ طالب' end
      end,
      coalesce(v_teacher, '—') || ' · ' || h.name || ' · ' || new.full_name
        || case when v_remove then ' · ' || coalesce(new.note, '') else '' end,
      '/student-requests', 'student_requests', new.id);
  end loop;
  return null;
end;
$function$;
revoke all on function private.notify_student_requested() from public, anon, authenticated;

-- إغلاقُ الطلب يُشعر المعلّم: أُضيف · أُنهي التحاقُه · رُفض
create or replace function private.notify_student_request_closed()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_female boolean;
begin
  select h.gender = 'female' into v_female from public.halaqat h where h.id = new.halaqa_id;
  perform private.notify(
    new.requested_by, 'student_request_closed',
    case
      when new.status = 'added' then case when v_female then 'أُضيفت الطالبةُ التي طلبتِها' else 'أُضيف الطالبُ الذي طلبتَه' end
      when new.status = 'removed' then case when v_female then 'أُنهي التحاقُ الطالبة التي طلبتِ حذفها' else 'أُنهي التحاقُ الطالب الذي طلبتَ حذفه' end
      when new.kind = 'remove' then case when v_female then 'رُفض طلبُ حذف الطالبة' else 'رُفض طلبُ حذف الطالب' end
      else case when v_female then 'رُفض طلبُ إضافة الطالبة' else 'رُفض طلبُ إضافة الطالب' end
    end,
    new.full_name || case when new.status = 'rejected' then ' · ' || coalesce(new.reject_note, '') else '' end,
    '/student-requests', 'student_requests', new.id);
  return null;
end;
$function$;
revoke all on function private.notify_student_request_closed() from public, anon, authenticated;

drop trigger student_requests_notify_closed on public.student_requests;
create trigger student_requests_notify_closed
  after update of status on public.student_requests
  for each row when (old.status = 'open' and new.status in ('added', 'rejected', 'removed'))
  execute function private.notify_student_request_closed();

-- موافقةُ المدير الإداريّ على طلب الحذف: يُنهي التحاقَ الطالب ويُغلق الطلب — معاً أو لا شيء
create or replace function public.approve_student_removal(p_request uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r public.student_requests%rowtype;
begin
  perform private.assert_session_writable();
  if not (select public.is_admin_manager()) then
    raise exception 'إنهاءُ التحاق الطالب للمدير الإداريّ وحده.' using errcode = '42501';
  end if;
  select * into r from public.student_requests where id = p_request for update;
  if not found or r.kind <> 'remove' or r.status <> 'open' then
    raise exception 'الطلبُ ليس طلبَ حذفٍ مفتوحاً.' using errcode = 'P0001';
  end if;
  if r.student_id is null then
    raise exception 'الطالبُ لم يعد موجوداً — ارفض الطلب.' using errcode = 'P0001';
  end if;
  update public.students set status = 'withdrawn' where id = r.student_id and status = 'active';
  update public.student_requests
     set status = 'removed', closed_at = now(), closed_by = (select auth.uid())
   where id = p_request;
end;
$function$;
revoke all on function public.approve_student_removal(uuid) from public, anon;
grant execute on function public.approve_student_removal(uuid) to authenticated;
