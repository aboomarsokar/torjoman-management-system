-- ملاحظةُ الاعتماد (طلب المستخدم 2026-11-02): المشرفُ يكتب كلمةً اختيارية وهو يعتمد رصدَ الشهر — كي لا يستعمل
-- «الإعادة بملاحظة» للشكر فيعود الرصدُ مسوّدة (حدث في 11 تقريراً لشهر 10). تظهر للمعلم مع الاعتماد وفي إشعاره،
-- ولا يكتبها إلا المعتمِد (`can_approve_report_in_halaqa`).
alter table public.monthly_reports add column approval_note text
  constraint monthly_reports_approval_note_check check (approval_note is null or char_length(approval_note) <= 500);

create or replace function public.guard_report_status()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and public.current_user_role() is distinct from 'admin_manager' then
      raise exception 'لا يُحذف التقرير بعد إرساله إلا بيد المدير الإداري' using errcode = '42501';
    end if;
    return old;
  end if;
  if public.can_approve_report_in_halaqa(new.halaqa_id)
     and (tg_op = 'INSERT' or public.can_approve_report_in_halaqa(old.halaqa_id)) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    raise exception 'لا يُعدَّل التقرير بعد إرساله إلا بيد الإدارة' using errcode = '42501';
  end if;
  if new.status not in ('draft', 'submitted') then
    raise exception 'لا تملك اعتماد التقرير' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' and (new.approved_by is not null or new.approved_at is not null or new.approval_note is not null))
     or (tg_op = 'UPDATE' and (new.approved_by, new.approved_at, new.approval_note)
                              is distinct from (old.approved_by, old.approved_at, old.approval_note)) then
    raise exception 'لا تملك اعتماد التقرير' using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function private.notify_report_status()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text;
  v_teacher uuid;
  v_supervisor uuid;
  v_body text;
  v_link text;
begin
  select h.name, h.teacher_id, h.supervisor_id into v_name, v_teacher, v_supervisor
    from public.halaqat h where h.id = new.halaqa_id;
  v_body := v_name || ' · ' || lpad(new.report_month::text, 2, '0') || '-' || new.report_year;
  v_link := '/reports?y=' || new.report_year || '&m=' || new.report_month;

  if new.status = 'submitted' then
    -- للمشرف وحده (قرار 2026-10-21) — والمسارُ يرفض الإرسال في حلقةٍ بلا مشرف
    perform private.notify(v_supervisor, 'report_submitted', 'أُرسل رصدُ شهرٍ للاعتماد', v_body,
                           v_link, 'monthly_reports', new.id);
  elsif new.status = 'approved' then
    perform private.notify(v_teacher, 'report_approved', 'اعتُمد رصدُ الشهر',
                           v_body || coalesce(' — ' || nullif(btrim(new.approval_note), ''), ''),
                           v_link, 'monthly_reports', new.id);
  elsif new.status = 'draft' and old.status in ('submitted', 'approved') then
    perform private.notify(v_teacher, 'report_returned', 'أُعيد رصدُ الشهر إليك',
                           v_body || ' — ' || coalesce(new.return_note, ''),
                           v_link, 'monthly_reports', new.id);
  end if;
  return null;
end;
$$;
