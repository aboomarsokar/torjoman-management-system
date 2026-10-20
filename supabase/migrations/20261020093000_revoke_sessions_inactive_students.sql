-- بندان أمنيّان قبل الإطلاق (طلب المستخدم 2026-10-20):
-- (٧) إعادةُ تعيين كلمة المرور والتعطيلُ وتغييرُ الدور لا تُلغي الجلساتِ المفتوحة: من بيده جلسةٌ قديمة (جهازٌ مسروق)
--     يُحوَّل إلى «غيّر كلمتك» فيضع كلمةً جديدة ويستولي على الحساب. الحلّ:
--     • `private.revoke_sessions(uuid[])` — تحذف جلسات الحسابات (رموزُ التجديد تُحذف بالتتالي)، لـ service_role وحده
--       (يستعملها جزءُ النيابة كذلك بهذا الاسم والتوقيع).
--     • مُشغِّلٌ على profiles يستدعيها حين يُعطَّل الحساب أو يتغيّر دوره أو يُرفع علَمُ «غيّر كلمتك» (إعادة التعيين).
--     • `current_user_role()` تشترط أن تكون جلسةُ الرمز قائمة — فالرمزُ الصادر قبل الإبطال يفقد صلاحياته فوراً
--       لا بعد انتهاء صلاحيته (ساعة). ومعها تسقط is_admin_manager وأخواتها وvisible_halaqa_ids.
-- (٨) الطالبُ غيرُ النشط دراسياً (منقطع/متخرّج/منقول) ما زال يدخل: مُشغِّلٌ على students يعطّل حسابه حين تخرج حالته
--     عن «نشط» (فيُخرج وتُبطَل جلساته ويُمنع دخوله بالحاجز القائم)، ويعيده نشطاً حين يعود.
--     والحارسُ guard_profile_privileged يسمح بتغيير الحالة من داخل مُشغِّل (pg_trigger_depth() > 1) لا من العميل.

-- (٧-أ) إبطالُ الجلسات
create or replace function private.revoke_sessions(p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from auth.sessions where user_id = any(p_user_ids);
  get diagnostics n = row_count;
  return n;
end
$$;

revoke all on function private.revoke_sessions(uuid[]) from public, anon, authenticated;
grant execute on function private.revoke_sessions(uuid[]) to service_role;

-- (٧-ب) الإبطالُ عند تغيّر الحساب
create or replace function private.revoke_on_account_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.status = 'active' and new.status <> 'active')
     or new.role is distinct from old.role
     or (new.must_change_password and not old.must_change_password) then
    perform private.revoke_sessions(array[new.id]);
  end if;
  return null;
end
$$;

revoke all on function private.revoke_on_account_change() from public, anon, authenticated;

create trigger profiles_revoke_sessions
  after update of status, role, must_change_password on public.profiles
  for each row execute function private.revoke_on_account_change();

-- (٧-ج) الدورُ لا يُعطى لرمزٍ أُبطلت جلسته
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
    and exists (select 1 from auth.sessions s where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid);
$$;

-- (٨) حالةُ الطالب الدراسية ← حالةُ حسابه
create or replace function private.sync_student_account_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null or new.status is not distinct from old.status then
    return null;
  end if;
  if old.status = 'active' and new.status <> 'active' then
    update public.profiles set status = 'disabled' where id = new.user_id and status = 'active';
  elsif new.status = 'active' and old.status <> 'active' then
    update public.profiles set status = 'active' where id = new.user_id and status = 'disabled';
  end if;
  return null;
end
$$;

revoke all on function private.sync_student_account_status() from public, anon, authenticated;

create trigger students_sync_account_status
  after update of status on public.students
  for each row execute function private.sync_student_account_status();

-- الحارس: تغييرُ الحالة من داخل مُشغِّلٍ (لا من العميل) مسموح
create or replace function public.guard_profile_privileged()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin_manager() then return new; end if; -- الخدمة والهجرات والمدير
  if pg_trigger_depth() > 1 and (new.role, new.employee_number, new.gender, new.must_change_password)
       is not distinct from (old.role, old.employee_number, old.gender, old.must_change_password) then
    return new; -- مُشغِّلُ حالة الطالب يغيّر الحالة وحدها
  end if;
  if (new.role, new.status, new.employee_number, new.gender)
     is distinct from (old.role, old.status, old.employee_number, old.gender) then
    raise exception 'لا تملك تعديل الدور أو الحالة أو الرقم الوظيفي أو الجنس' using errcode = '42501';
  end if;
  if new.must_change_password is distinct from old.must_change_password
     and not (old.must_change_password and not new.must_change_password and new.id = auth.uid()) then
    raise exception 'لا تملك رفع علَم تغيير كلمة المرور' using errcode = '42501';
  end if;
  return new;
end
$$;

revoke execute on function public.guard_profile_privileged() from anon, authenticated;
