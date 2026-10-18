-- ═══════════════════════════════════════════════════════════════════════════
-- حارس طاقم الحلقة: الجنس والحلقة الواحدة للمعلم و«عيّنه»
-- ───────────────────────────────────────────────────────────────────────────
-- الثغرة (2026-10-18): نموذج الحلقة يفرز المختبِرين وحدهم بجنس الحلقة، والقاعدة
-- لا تتحقّق من شيء — فأُنشئت حلقة «بنين» معلمتُها أنثى، وهي معلمةُ حلقةٍ أخرى،
-- وبلا «عيّنه». الحكم هنا في القاعدة، والواجهة طبقة تجربة فقط.
--
--   • جنس الحلقة مطلوب، والمعلم والمشرف الميداني والمختبِر من جنسها وبأدوارهم.
--   • المعلم على حلقةٍ نشطة واحدة (قرار v2: «المعلم حلقة واحدة»).
--   • لا يتغيّر جنس حلقة فيها طلاب من الجنس الآخر.
--   • «عيّنه» (assigned_by) يُختم بالمستدعي عند الإنشاء وعند تغيير المعلم أو المشرف.
--   • وفي الاتجاه الآخر: لا يتغيّر جنس موظفٍ يخالف به جنس حلقةٍ هو في طاقمها.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.guard_halaqa_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_gender public.gender_type;
begin
  if new.gender is null then
    raise exception 'جنس الحلقة مطلوب.' using errcode = '23514';
  end if;

  -- المعلم: دوره وجنسه
  select role, gender into v_role, v_gender from public.profiles where id = new.teacher_id;
  if v_role is distinct from 'teacher' then
    raise exception 'المُسنَد للحلقة ليس معلماً.' using errcode = '23514';
  end if;
  if v_gender is distinct from new.gender then
    raise exception 'جنس المعلم لا يطابق جنس الحلقة.' using errcode = '23514';
  end if;

  -- المعلم على حلقةٍ نشطة واحدة — يُفحص حين يتغيّر المعلم أو تُفعَّل الحلقة فقط،
  -- كي لا تحبس مخالفةٌ قديمةٌ في حلقةٍ أخرى تعديلَ هذه الحلقة السليمة
  if new.status = 'active'
     and (tg_op = 'INSERT' or new.teacher_id is distinct from old.teacher_id or old.status is distinct from 'active')
     and exists (
    select 1 from public.halaqat h
    where h.teacher_id = new.teacher_id and h.status = 'active' and h.id <> new.id
  ) then
    raise exception 'هذا المعلم مُسنَدٌ لحلقةٍ نشطة أخرى — لكل معلم حلقة واحدة.' using errcode = '23514';
  end if;

  -- المشرف الميداني
  if new.supervisor_id is not null then
    select role, gender into v_role, v_gender from public.profiles where id = new.supervisor_id;
    if v_role is distinct from 'field_supervisor' then
      raise exception 'المُسنَد مشرفاً ليس مشرفاً ميدانياً.' using errcode = '23514';
    end if;
    if v_gender is distinct from new.gender then
      raise exception 'جنس المشرف لا يطابق جنس الحلقة.' using errcode = '23514';
    end if;
  end if;

  -- المختبِر (دوره يفحصه stamp_halaqa_examiner، والجنس هنا)
  if new.examiner_id is not null then
    select gender into v_gender from public.profiles where id = new.examiner_id;
    if v_gender is distinct from new.gender then
      raise exception 'جنس المختبِر لا يطابق جنس الحلقة.' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.gender is distinct from old.gender and exists (
      select 1 from public.students s where s.halaqa_id = new.id and s.gender is distinct from new.gender
    ) then
      raise exception 'في الحلقة طلاب من الجنس الآخر — أخرجهم قبل تغيير جنسها.' using errcode = '23514';
    end if;
    if (new.teacher_id is distinct from old.teacher_id or new.supervisor_id is distinct from old.supervisor_id)
       and auth.uid() is not null then
      new.assigned_by := auth.uid();
    end if;
  else
    new.assigned_by := coalesce(auth.uid(), new.assigned_by);
  end if;

  return new;
end;
$$;

drop trigger if exists halaqat_guard_staff on public.halaqat;
create trigger halaqat_guard_staff
  before insert or update on public.halaqat
  for each row execute function public.guard_halaqa_staff();

-- الاتجاه الآخر: تغيير جنس موظفٍ في طاقم حلقة
create or replace function public.guard_staff_gender_vs_halaqat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.gender is distinct from old.gender and exists (
    select 1 from public.halaqat h
    where (h.teacher_id = new.id or h.supervisor_id = new.id or h.examiner_id = new.id)
      and h.gender is distinct from new.gender
  ) then
    raise exception 'هذا الموظف في طاقم حلقةٍ من الجنس الآخر — غيّر إسناده أولاً.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_gender_vs_halaqat on public.profiles;
create trigger profiles_guard_gender_vs_halaqat
  before update of gender on public.profiles
  for each row execute function public.guard_staff_gender_vs_halaqat();

-- دوالّ مُشغِّلات لا تُستدعى مباشرةً
revoke execute on function public.guard_halaqa_staff() from public, anon, authenticated;
revoke execute on function public.guard_staff_gender_vs_halaqat() from public, anon, authenticated;
