-- طلباتُ الملازم بأربع حالات (طلب المستخدم 2026-10-31): جديد ← أُبلغ المعلّم (جاهزةٌ للاستلام، والنسخُ محجوزة) ←
-- تمّ التسليم، أو ملغى. المعلّمُ يعدّل طلبَه ويلغيه ما لم يُسلَّم، والمديرُ الإداريّ يلغي بسببٍ يصل المعلّم.
-- «إبلاغ بالاستلام» يفحص المخزون (المتوفّر = الرصيد − المحجوز لطلباتٍ أُبلغ أصحابُها) ويرفض إن لم يكفِ،
-- والملزمةُ غير المجرودة يُسمح بها مع تنبيه. ويُشعَر المديرون حين يبلغ المتوفّرُ حدَّ التنبيه.

-- ١) الأعمدةُ والحالات
alter table public.booklet_requests drop constraint booklet_requests_status_check;
alter table public.booklet_requests add constraint booklet_requests_status_check
  check (status in ('open', 'ready', 'done', 'cancelled'));
alter table public.booklet_requests
  add column notified_at   timestamptz,
  add column notified_by   uuid references public.profiles(id) on delete set null,
  add column cancelled_by  uuid references public.profiles(id) on delete set null,
  add column cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 200),
  add column updated_at    timestamptz;

-- ٢) أنواعُ الإشعار الجديدة
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed', 'booklet_delivered', 'booklet_requested', 'announcement',
  'student_requested', 'student_request_closed', 'off_day_reported', 'off_day_rejected',
  'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update',
  'booklet_ready', 'booklet_request_cancelled', 'booklet_stock_low'
));

create or replace function private.notify(p_recipient uuid, p_kind text, p_title text, p_body text, p_link text, p_source_table text, p_source_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if p_recipient is null or p_recipient = (select auth.uid()) then
    return;
  end if;
  if p_kind is null or p_kind not in (
    'report_submitted', 'report_approved', 'report_returned',
    'alert_issued', 'visit_scheduled',
    'exam_nominated', 'exam_graded',
    'transport_paid',
    'impersonation_started', 'impersonation_write',
    'statement_returned',
    'visit_result', 'visit_unlocked', 'visit_rescheduled',
    'quality_month', 'quality_unlocked',
    'halaqa_time_changed', 'booklet_delivered', 'booklet_requested',
    'announcement',
    'student_requested', 'student_request_closed',
    'off_day_reported', 'off_day_rejected',
    'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update',
    'booklet_ready', 'booklet_request_cancelled', 'booklet_stock_low'
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
    delete from public.notifications
     where id in (select id from public.notifications
                   where created_at < now() - interval '3 months'
                   order by created_at limit 200
                   for update skip locked);
  exception when others then
    raise warning 'notify failed: %', sqlerrm;
  end;
end;
$function$;

-- ٣) المحجوزُ والمتوفّر
-- المحجوز: نسخُ الطلبات التي أُبلغ أصحابُها ولم تُسلَّم بعد.
create or replace function private.booklet_reserved(p_booklet smallint, p_except uuid default null)
 returns integer
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select coalesce(sum(copies), 0)::integer from public.booklet_requests
   where booklet = p_booklet and status = 'ready' and id is distinct from p_except
$function$;
revoke all on function private.booklet_reserved(smallint, uuid) from public, anon, authenticated;

-- تنبيهُ المديرين حين يبلغ المتوفّرُ حدَّ التنبيه — مرّةً ما دام التنبيهُ السابقُ للملزمة غيرَ مقروء. يُدرج مباشرةً
-- لأنّ `notify` لا يُشعر صاحبَ الفعل، والمديرُ هو من يُبلغ ويسلّم غالباً.
create or replace function private.booklet_stock_low_alert(p_booklet smallint)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  s public.booklet_stock%rowtype;
  v_avail integer;
  v_admin uuid;
begin
  select * into s from public.booklet_stock where booklet = p_booklet;
  if not found then
    return;
  end if;
  v_avail := s.quantity - private.booklet_reserved(p_booklet);
  if v_avail > s.alert_at then
    return;
  end if;
  for v_admin in select id from public.profiles where role = 'admin_manager' and status = 'active' loop
    if not exists (select 1 from public.notifications n
                    where n.recipient_id = v_admin and n.kind = 'booklet_stock_low'
                      and n.source_table = 'booklet_stock' and n.title like '%' || private.booklet_label(p_booklet) || '%'
                      and n.read_at is null) then
      insert into public.notifications (recipient_id, kind, title, body, link, source_table, source_id)
      values (v_admin, 'booklet_stock_low',
              'قارب مخزونُ ' || private.booklet_label(p_booklet) || ' على النفاد',
              'المتوفّر ' || greatest(v_avail, 0) || ' نسخة بعد المحجوز (الرصيد ' || s.quantity || ')، وحدُّ التنبيه ' || s.alert_at || '.',
              '/booklets?view=stock', 'booklet_stock', null);
    end if;
  end loop;
end;
$function$;
revoke all on function private.booklet_stock_low_alert(smallint) from public, anon, authenticated;

-- ٤) «إبلاغ بالاستلام» — المديرُ الإداريّ: يفحص المخزون ويحجز النسخ ويُشعر المعلّم.
create or replace function public.mark_booklet_request_ready(p_request uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r public.booklet_requests%rowtype;
  s public.booklet_stock%rowtype;
  h record;
  v_reserved integer := 0;
  v_tracked boolean;
begin
  perform private.assert_session_writable();
  if not public.is_admin_manager() then
    raise exception 'الإبلاغُ بالاستلام للمدير الإداري' using errcode = '42501';
  end if;
  select * into r from public.booklet_requests where id = p_request for update;
  if not found then
    raise exception 'الطلبُ غير موجود' using errcode = '22023';
  end if;
  if r.status <> 'open' then
    raise exception 'لا يُبلَغ إلا طلبٌ جديد' using errcode = '22023';
  end if;

  select * into s from public.booklet_stock where booklet = r.booklet for update;
  v_tracked := found;
  if v_tracked then
    v_reserved := private.booklet_reserved(r.booklet);
    if s.quantity - v_reserved < r.copies then
      raise exception 'مخزون % لا يكفي: المتوفّر % نسخة (الرصيد % والمحجوز %) والمطلوب %. أضف نسخاً في «المخزون» أولاً.',
        private.booklet_label(r.booklet), greatest(s.quantity - v_reserved, 0), s.quantity, v_reserved, r.copies
        using errcode = '22023';
    end if;
  end if;

  update public.booklet_requests
     set status = 'ready', notified_at = now(), notified_by = auth.uid(), updated_at = now()
   where id = p_request;

  select name, teacher_id, gender into h from public.halaqat where id = r.halaqa_id;
  perform private.notify(
    h.teacher_id, 'booklet_ready',
    case when h.gender = 'female' then 'ملازمُكِ جاهزةٌ للاستلام' else 'ملازمُك جاهزةٌ للاستلام' end,
    private.booklet_label(r.booklet) || ' × ' || r.copies || ' نسخة — '
      || case when h.gender = 'female' then 'تواصلي مع الإدارة لاستلامها.' else 'تواصل مع الإدارة لاستلامها.' end,
    '/my-booklets', 'booklet_requests', r.id);

  perform private.booklet_stock_low_alert(r.booklet);

  return jsonb_build_object(
    'tracked', v_tracked,
    'available', case when v_tracked then s.quantity - v_reserved - r.copies end,
    'alert_at', case when v_tracked then s.alert_at end);
end;
$function$;
revoke all on function public.mark_booklet_request_ready(uuid) from public, anon;
grant execute on function public.mark_booklet_request_ready(uuid) to authenticated;

-- ٥) تعديلُ الطلب — معلّمُ الحلقة ما لم يُسلَّم؛ وإن كان أُبلغ عاد «جديداً» وفُكّ حجزُه.
create or replace function public.update_booklet_request(p_request uuid, p_booklet smallint, p_copies integer, p_note text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r public.booklet_requests%rowtype;
  h record;
  v_admin uuid;
  v_teacher text;
begin
  perform private.assert_session_writable();
  select * into r from public.booklet_requests where id = p_request for update;
  if not found then
    raise exception 'الطلبُ غير موجود' using errcode = '22023';
  end if;
  select name, teacher_id, gender into h from public.halaqat where id = r.halaqa_id;
  if h.teacher_id is distinct from auth.uid() then
    raise exception 'يعدّل الطلبَ معلّمُ الحلقة' using errcode = '42501';
  end if;
  if r.status not in ('open', 'ready') then
    raise exception 'لا يُعدَّل طلبٌ سُلِّم أو أُلغي' using errcode = '22023';
  end if;
  if p_booklet is null or p_booklet not between 1 and 15 then
    raise exception 'رقم الملزمة غير صحيح' using errcode = '22023';
  end if;
  if p_copies is null or p_copies not between 1 and 1000 then
    raise exception 'عدد النسخ غير صحيح' using errcode = '22023';
  end if;
  if char_length(coalesce(p_note, '')) > 300 then
    raise exception 'الملاحظة لا تتجاوز 300 حرف' using errcode = '22023';
  end if;

  update public.booklet_requests
     set booklet = p_booklet, copies = p_copies, note = nullif(btrim(p_note), ''),
         status = 'open', notified_at = null, notified_by = null, updated_at = now()
   where id = p_request;

  select full_name into v_teacher from public.profiles where id = auth.uid();
  for v_admin in select id from public.profiles where role = 'admin_manager' and status = 'active' loop
    perform private.notify(
      v_admin, 'booklet_requested',
      case when h.gender = 'female' then 'عدّلت معلّمةٌ طلبَ ملازم' else 'عدّل معلّمٌ طلبَ ملازم' end,
      coalesce(v_teacher, '—') || ' · ' || h.name || ' · ' || private.booklet_label(p_booklet) || ' × ' || p_copies
        || case when r.status = 'ready' then ' · كان مُبلَغاً فعاد جديداً' else '' end,
      '/booklets?view=requests', 'booklet_requests', r.id);
  end loop;
end;
$function$;
revoke all on function public.update_booklet_request(uuid, smallint, integer, text) from public, anon;
grant execute on function public.update_booklet_request(uuid, smallint, integer, text) to authenticated;

-- ٦) إلغاءُ الطلب — معلّمُ الحلقة أو المديرُ الإداريّ ما لم يُسلَّم، ويُشعَر الطرفُ الآخر.
create or replace function public.cancel_booklet_request(p_request uuid, p_reason text default null)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r public.booklet_requests%rowtype;
  h record;
  v_admin uuid;
  v_is_admin boolean := public.is_admin_manager();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_teacher text;
begin
  perform private.assert_session_writable();
  select * into r from public.booklet_requests where id = p_request for update;
  if not found then
    raise exception 'الطلبُ غير موجود' using errcode = '22023';
  end if;
  select name, teacher_id, gender into h from public.halaqat where id = r.halaqa_id;
  if not v_is_admin and h.teacher_id is distinct from auth.uid() then
    raise exception 'يلغي الطلبَ معلّمُ الحلقة أو المديرُ الإداري' using errcode = '42501';
  end if;
  if r.status not in ('open', 'ready') then
    raise exception 'لا يُلغى طلبٌ سُلِّم أو أُلغي' using errcode = '22023';
  end if;
  if char_length(coalesce(v_reason, '')) > 200 then
    raise exception 'سببُ الإلغاء لا يتجاوز 200 حرف' using errcode = '22023';
  end if;

  update public.booklet_requests
     set status = 'cancelled', closed_at = now(), cancelled_by = auth.uid(), cancel_reason = v_reason, updated_at = now()
   where id = p_request;

  if v_is_admin then
    perform private.notify(
      h.teacher_id, 'booklet_request_cancelled',
      case when h.gender = 'female' then 'أُلغي طلبُكِ للملازم' else 'أُلغي طلبُك للملازم' end,
      private.booklet_label(r.booklet) || ' × ' || r.copies || coalesce(' · السبب: ' || v_reason, ''),
      '/my-booklets', 'booklet_requests', r.id);
  else
    select full_name into v_teacher from public.profiles where id = auth.uid();
    for v_admin in select id from public.profiles where role = 'admin_manager' and status = 'active' loop
      perform private.notify(
        v_admin, 'booklet_request_cancelled',
        case when h.gender = 'female' then 'ألغت معلّمةٌ طلبَ ملازم' else 'ألغى معلّمٌ طلبَ ملازم' end,
        coalesce(v_teacher, '—') || ' · ' || h.name || ' · ' || private.booklet_label(r.booklet) || ' × ' || r.copies
          || coalesce(' · ' || v_reason, ''),
        '/booklets?view=requests', 'booklet_requests', r.id);
    end loop;
  end if;
end;
$function$;
revoke all on function public.cancel_booklet_request(uuid, text) from public, anon;
grant execute on function public.cancel_booklet_request(uuid, text) to authenticated;

-- ٧) «تمّ التسليم» يقبل الطلبَ الجديدَ والمُبلَغ، ويُغلقه قبل إدراج التسليم فيُفكّ حجزُه قبل الخصم.
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
  if r.status = 'done' then
    raise exception 'سُلِّم هذا الطلبُ من قبل' using errcode = '22023';
  end if;
  if r.status = 'cancelled' then
    raise exception 'أُلغي هذا الطلب' using errcode = '22023';
  end if;

  update public.booklet_requests set status = 'done', closed_at = now(), updated_at = now() where id = p_request;

  insert into public.booklet_deliveries (halaqa_id, booklet, copies, delivered_on, note)
  values (r.halaqa_id, r.booklet, r.copies,
          coalesce(p_delivered_on, (now() at time zone 'Asia/Gaza')::date),
          left('بطلب المعلّم' || coalesce(' — ' || nullif(btrim(r.note), ''), ''), 300))
  returning id into v_delivery;
  return v_delivery;
end;
$function$;

-- ٨) الخصمُ عند التسليم يرفض ما يمسّ المحجوزَ لغيره، ثم يفحص حدَّ التنبيه.
create or replace function private.booklet_stock_on_delivery()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  s public.booklet_stock%rowtype;
  v_out integer;
  v_reserved integer;
begin
  if tg_op in ('DELETE', 'UPDATE') then
    select coalesce(-sum(delta), 0) into v_out from public.booklet_stock_moves where delivery_id = old.id;
    if v_out > 0 then
      update public.booklet_stock set quantity = quantity + v_out, updated_at = now()
       where booklet = old.booklet returning * into s;
      if found then
        insert into public.booklet_stock_moves (booklet, delta, balance_after, reason, delivery_id, halaqa_id, note)
        values (old.booklet, v_out, s.quantity, 'delivery_removed', old.id, old.halaqa_id,
                case when tg_op = 'DELETE' then 'حُذف التسليم' else 'عُدِّل التسليم' end);
      end if;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select * into s from public.booklet_stock where booklet = new.booklet for update;
    if found then
      v_reserved := private.booklet_reserved(new.booklet);
      if s.quantity < new.copies then
        raise exception 'رصيد ملزمة % لا يكفي: المتبقّي % نسخة والمطلوب %. أضف نسخاً في «المخزون» أولاً.',
          private.booklet_label(new.booklet), s.quantity, new.copies using errcode = '22023';
      end if;
      if s.quantity - v_reserved < new.copies then
        raise exception 'مخزون % محجوزٌ لطلباتٍ أُبلغ أصحابُها: المتوفّر % نسخة (الرصيد % والمحجوز %) والمطلوب %. سلّم تلك الطلبات أو ألغِها أولاً.',
          private.booklet_label(new.booklet), greatest(s.quantity - v_reserved, 0), s.quantity, v_reserved, new.copies
          using errcode = '22023';
      end if;
      update public.booklet_stock set quantity = quantity - new.copies, updated_at = now()
       where booklet = new.booklet returning * into s;
      insert into public.booklet_stock_moves (booklet, delta, balance_after, reason, delivery_id, halaqa_id, moved_on)
      values (new.booklet, -new.copies, s.quantity, 'delivery', new.id, new.halaqa_id, new.delivered_on);
      perform private.booklet_stock_low_alert(new.booklet);
    end if;
    return new;
  end if;
  return old;
end;
$function$;

-- ٩) إشعارُ الطلب الجديد يقول للمدير إن كان المخزونُ لا يكفي أو الملزمةُ غيرَ مجرودة.
create or replace function private.notify_booklet_requested()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  h record;
  s public.booklet_stock%rowtype;
  v_teacher text;
  v_admin uuid;
  v_avail integer;
  v_title text;
  v_stock text;
begin
  select name, gender into h from public.halaqat where id = new.halaqa_id;
  select full_name into v_teacher from public.profiles where id = new.requested_by;
  v_title := case when h.gender = 'female' then 'طلبت معلّمةٌ ملازم' else 'طلب معلّمٌ ملازم' end;
  select * into s from public.booklet_stock where booklet = new.booklet;
  if not found then
    v_stock := ' · الملزمةُ غيرُ مجرودة';
  else
    v_avail := s.quantity - private.booklet_reserved(new.booklet);
    if v_avail < new.copies then
      v_title := v_title || ' — المخزونُ لا يكفي';
      v_stock := ' · المتوفّر ' || greatest(v_avail, 0);
    else
      v_stock := '';
    end if;
  end if;
  for v_admin in select id from public.profiles where role = 'admin_manager' and status = 'active' loop
    perform private.notify(
      v_admin, 'booklet_requested', v_title,
      coalesce(v_teacher, '—') || ' · ' || h.name || ' · ' || private.booklet_label(new.booklet)
        || ' × ' || new.copies || v_stock || coalesce(' · ' || nullif(btrim(new.note), ''), ''),
      '/booklets?view=requests', 'booklet_requests', new.id);
  end loop;
  return null;
end;
$function$;
