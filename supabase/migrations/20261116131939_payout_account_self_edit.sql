-- حسابُ استلام المكافأة بيد صاحبه (طلب المستخدم 2026-11-16): العاملُ يرى حسابَه ويعدّله من ملفّه الشخصيّ، والمديرُ
-- الإداريّ لأيّ عامل؛ والتعديلُ يُعتمد فوراً ويُشعَر به المديرُ الإداريّ (القديمُ والجديد)، ويُحفظ في سجلٍّ خاصّ.
-- وخانةٌ جديدة: رقمُ هوية صاحب الحساب (9 أرقام). لا يمسّ العاملُ المكافأةَ الأساسية ولا يراها — فلا سياسةَ قراءةٍ
-- له على الجدول، والقراءةُ والكتابةُ عبر دالّتين.

alter table public.profile_financials
  add column holder_national_id text
  constraint profile_financials_holder_national_id_check check (holder_national_id ~ '^[0-9]{9}$');

comment on column public.profile_financials.holder_national_id is 'رقمُ هوية صاحب الحساب (9 أرقام) — قد يكون غيرَ العامل نفسه.';

-- سجلُّ التعديلات: خاصٌّ لا يُقرأ من الواجهة، يبقى ولا يُحذف كالإشعارات بعد ثلاثة أشهر
create table private.payout_account_changes (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  changed_by  uuid references public.profiles (id) on delete set null,
  old_value   jsonb,
  new_value   jsonb not null,
  changed_at  timestamptz not null default now()
);
alter table private.payout_account_changes enable row level security;
create index payout_account_changes_profile_idx on private.payout_account_changes (profile_id, changed_at desc);

-- نوعُ الإشعار الجديد (والقائمةُ هي الحيّة كما هي، ومنها أنواعُ المسارات)
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'report_submitted', 'report_approved', 'report_returned', 'alert_issued', 'visit_scheduled',
  'exam_nominated', 'exam_graded', 'transport_paid', 'impersonation_started', 'impersonation_write',
  'statement_returned', 'visit_result', 'visit_unlocked', 'visit_rescheduled', 'quality_month', 'quality_unlocked',
  'halaqa_time_changed', 'booklet_delivered', 'booklet_requested', 'announcement',
  'student_requested', 'student_request_closed', 'off_day_reported', 'off_day_rejected',
  'plan_task_assigned', 'plan_task_due', 'plan_task_overdue', 'plan_weekly_update',
  'booklet_ready', 'booklet_request_cancelled', 'booklet_stock_low', 'candidate_registered',
  'track_requested', 'track_decided', 'below_quota', 'payout_account_changed'
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
    'booklet_ready', 'booklet_request_cancelled', 'booklet_stock_low', 'candidate_registered',
    'track_requested', 'track_decided', 'below_quota', 'payout_account_changed'
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

-- القراءة: صاحبُ الحساب والمديرُ الإداريّ ومشرفُ المشروع — بلا المكافأة الأساسية
create or replace function public.get_payout_account(p_profile uuid)
returns table (account_type public.account_type, account_number text, account_holder text, holder_national_id text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_profile is distinct from (select auth.uid()) and not public.is_admin_manager() and not public.is_project_supervisor() then
    raise exception 'لا تملك عرض هذا الحساب.' using errcode = '42501';
  end if;
  return query
    select f.account_type, f.account_number, f.account_holder, f.holder_national_id, f.updated_at
      from public.profile_financials f
     where f.profile_id = p_profile;
end;
$$;

-- الكتابة: العاملُ لحسابه والمديرُ الإداريّ لأيّ عامل؛ والمحافظُ (جوال باي وبال باي) رقمُها رقمُ جوّال
create or replace function public.set_payout_account(
  p_profile uuid,
  p_type public.account_type,
  p_number text,
  p_holder text,
  p_holder_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text := upper(regexp_replace(coalesce(p_number, ''), '[[:space:]-]', '', 'g'));
  v_holder text := regexp_replace(btrim(coalesce(p_holder, '')), '[[:space:]]+', ' ', 'g');
  v_holder_id text := regexp_replace(coalesce(p_holder_id, ''), '[[:space:]-]', '', 'g');
  v_target public.profiles%rowtype;
  v_old public.profile_financials%rowtype;
  v_labels constant jsonb := '{"jawwalpay": "جوال باي", "palpay": "بال باي", "bank_palestine": "بنك فلسطين"}';
  v_admin uuid;
  v_body text;
begin
  -- النيابةُ في وضع القراءة لا تكتب (الرسالةُ والرمز من الحارس نفسه)
  perform private.assert_session_writable();

  select * into v_target from public.profiles where id = p_profile;
  if not found or v_target.role = 'student' then
    raise exception 'الحسابُ للعاملين وحدهم.' using errcode = '22023';
  end if;
  if p_profile is distinct from (select auth.uid()) and not public.is_admin_manager() then
    raise exception 'تعديلُ هذا الحساب لصاحبه وللمدير الإداريّ.' using errcode = '42501';
  end if;

  if p_type is null then
    raise exception 'اختر نوعَ الحساب.' using errcode = '22023';
  end if;
  if p_type in ('jawwalpay', 'palpay') and v_number !~ '^05[0-9]{8}$' then
    raise exception 'رقمُ المحفظة رقمُ جوّالٍ من 10 أرقام يبدأ بـ05.' using errcode = '22023';
  end if;
  if p_type = 'bank_palestine' and v_number !~ '^[A-Z0-9]{4,34}$' then
    raise exception 'رقمُ الحساب البنكيّ غير صحيح.' using errcode = '22023';
  end if;
  if length(v_holder) < 3 or length(v_holder) > 80 then
    raise exception 'اكتب اسمَ صاحب الحساب كاملاً.' using errcode = '22023';
  end if;
  if v_holder_id !~ '^[0-9]{9}$' then
    raise exception 'رقمُ هوية صاحب الحساب تسعةُ أرقام.' using errcode = '22023';
  end if;

  select * into v_old from public.profile_financials where profile_id = p_profile;
  if found and v_old.account_type is not distinct from p_type and v_old.account_number is not distinct from v_number
     and v_old.account_holder is not distinct from v_holder and v_old.holder_national_id is not distinct from v_holder_id then
    return;
  end if;

  insert into public.profile_financials (profile_id, account_type, account_number, account_holder, holder_national_id)
  values (p_profile, p_type, v_number, v_holder, v_holder_id)
  on conflict (profile_id) do update
    set account_type = excluded.account_type,
        account_number = excluded.account_number,
        account_holder = excluded.account_holder,
        holder_national_id = excluded.holder_national_id;

  insert into private.payout_account_changes (profile_id, changed_by, old_value, new_value)
  values (
    p_profile, (select auth.uid()),
    case when v_old.profile_id is null then null else jsonb_build_object(
      'account_type', v_old.account_type, 'account_number', v_old.account_number,
      'account_holder', v_old.account_holder, 'holder_national_id', v_old.holder_national_id) end,
    jsonb_build_object('account_type', p_type, 'account_number', v_number, 'account_holder', v_holder, 'holder_national_id', v_holder_id)
  );

  v_body := case
    when v_old.account_number is null then 'أضاف '
    else 'كان: ' || coalesce(v_labels ->> v_old.account_type::text, '—') || ' ' || v_old.account_number
         || ' باسم ' || coalesce(v_old.account_holder, '—') || ' — وصار: '
  end || (v_labels ->> p_type::text) || ' ' || v_number || ' باسم ' || v_holder || ' (هوية ' || v_holder_id || ')';

  for v_admin in select id from public.profiles where role = 'admin_manager' and status = 'active' loop
    perform private.notify(
      v_admin, 'payout_account_changed',
      'تغيّر حسابُ استلام ' || v_target.full_name,
      v_body, '/profile/' || p_profile::text, 'profile_financials', p_profile
    );
  end loop;
end;
$$;

revoke all on function public.get_payout_account(uuid) from public, anon;
revoke all on function public.set_payout_account(uuid, public.account_type, text, text, text) from public, anon;
grant execute on function public.get_payout_account(uuid) to authenticated;
grant execute on function public.set_payout_account(uuid, public.account_type, text, text, text) to authenticated;
