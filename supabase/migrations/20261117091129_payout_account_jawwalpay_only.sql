-- حسابُ الاستلام جوال باي وحده (قرار المستخدم 2026-11-17): المكافآتُ تُحوَّل كلُّها دفعةً واحدة عبر جوال باي، فلا يُقبل
-- بال باي ولا بنك فلسطين في التعديل الجديد. نوعُ `account_type` يبقى بقيمه الثلاث (لا يُمسّ ما سُجّل)، والتوقيعُ كما هو.

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

  if p_type is distinct from 'jawwalpay' then
    raise exception 'يلزم حسابُ جوال باي.' using errcode = '22023';
  end if;
  if v_number !~ '^05[0-9]{8}$' then
    raise exception 'رقمُ المحفظة رقمُ جوّالٍ من 10 أرقام يبدأ بـ05.' using errcode = '22023';
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

revoke all on function public.set_payout_account(uuid, public.account_type, text, text, text) from public, anon;
grant execute on function public.set_payout_account(uuid, public.account_type, text, text, text) to authenticated;
