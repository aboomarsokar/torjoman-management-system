-- تصليبُ private.notify (المراجعة النهائية للجزء ١، 2026-10-19):
-- فشلٌ داخل notify يجب ألّا يُسقط العمليةَ الأصلية للمستخدم أبداً — فمنتِجو الأجزاء القادمة
-- سيُشعِرون عدّة مستلمين داخل معاملةٍ واحدة. لذلك: تحقّقٌ مسبقٌ يُنذر ولا يرمي،
-- وأيّ خطأٍ في الإدراج أو التقليم يُحوَّل إلى تحذير، والتقليمُ يتخطّى الصفوفَ المقفلة.

create or replace function private.notify(
  p_recipient uuid, p_kind text, p_title text, p_body text,
  p_link text, p_source_table text, p_source_id uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- بلا مستلمٍ لا إشعار، ولا يُشعَر أحدٌ بفعله هو.
  if p_recipient is null or p_recipient = (select auth.uid()) then
    return;
  end if;

  -- التحقّق نفسُه قيودُ الجدول، لكنّه هنا تحذيرٌ لا استثناء: القيدُ كان سيُسقط العمليةَ الأصلية.
  -- (قائمةُ الأنواع تطابق notifications_kind_check — تُحدَّث معه عند إضافة نوع.)
  if p_kind is null or p_kind not in (
    'report_submitted', 'report_approved', 'report_returned',
    'alert_issued', 'visit_scheduled',
    'exam_nominated', 'exam_graded',
    'transport_paid',
    'impersonation_started', 'impersonation_write'
  ) then
    raise warning 'notify: نوعٌ غير معروف %', p_kind;
    return;
  end if;
  if p_link is not null and p_link !~ '^/[A-Za-z0-9/_?=&-]*$' then
    raise warning 'notify: رابطٌ غير مسموح %', p_link;
    return;
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise warning 'notify: عنوانٌ فارغ (النوع %)', p_kind;
    return;
  end if;

  begin
    insert into public.notifications (recipient_id, kind, title, body, link, source_table, source_id)
    values (p_recipient, p_kind, left(btrim(p_title), 120), left(nullif(btrim(coalesce(p_body, '')), ''), 400), p_link, p_source_table, p_source_id);

    -- التقليمُ بعد الإدراج وبدفعةٍ محدودة: ما مضى عليه ثلاثة أشهر، وما أقفله غيرُنا يُترك لدورةٍ لاحقة.
    delete from public.notifications
     where id in (select id from public.notifications
                   where created_at < now() - interval '3 months'
                   order by created_at limit 200
                   for update skip locked);
  exception when others then
    raise warning 'notify failed: %', sqlerrm;
  end;
end;
$$;
revoke all on function private.notify(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;

-- الفحصُ الذاتيّ.
do $$
begin
  if to_regprocedure('private.notify(uuid, text, text, text, text, text, uuid)') is null then
    raise exception 'private.notify: غير موجودة';
  end if;
  if has_function_privilege('authenticated', 'private.notify(uuid, text, text, text, text, text, uuid)', 'execute')
     or has_function_privilege('anon', 'private.notify(uuid, text, text, text, text, text, uuid)', 'execute') then
    raise exception 'private.notify: مكشوفةٌ للعميل';
  end if;
  if not (select prosecdef from pg_proc where oid = 'private.notify(uuid, text, text, text, text, text, uuid)'::regprocedure) then
    raise exception 'private.notify: ليست security definer';
  end if;
end $$;
