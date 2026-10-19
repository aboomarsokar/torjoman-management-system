-- إصلاح: حارسا الحضور لا يعترضان العملياتِ التتابعيّة (cascade) ولا تفريغَ «سجّله».
--  ١) حذفُ طالبٍ/حلقةٍ يُسقط غياباتِه/أيامَها عبر FK، والحارسُ يراها «حذفاً في شهرٍ معتمَد» فيفشل الحذفُ الأمّ.
--     الحذفُ التتابعيُّ يجري في عمق ٢ فما فوق من المُشغِّلات (pg_trigger_depth() > 1) فيُتجاوَز،
--     أمّا الحذفُ المباشر (عمق ١) فيبقى محظوراً.
--  ٢) recorded_by ... on delete set null يجري تحديثاً تتابعيّاً؛ التحديثُ الذي لا يمسّ سوى recorded_by مسموحٌ دائماً
--     (لا يغيّر شيئاً من الحضور نفسه)، وأيُّ تحديثٍ لغيره يبقى خاضعاً للحارس.
-- الإدراجُ لا يُتجاوَز أبداً (لا يأتي تتابعيّاً).

create or replace function private.guard_attendance_days()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    if private.attendance_month_approved(old.halaqa_id, old.day) then
      raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and (new.halaqa_id, new.day, new.created_at) is not distinct from (old.halaqa_id, old.day, old.created_at) then
    return new;   -- تغيّر recorded_by وحده (تفريغٌ تتابعيّ أو تصحيح)
  end if;

  if new.day > private.attendance_today() then
    raise exception 'لا يُسجَّل يومٌ لم يأتِ';
  end if;
  if tg_op = 'UPDATE' and private.attendance_month_approved(old.halaqa_id, old.day) then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;
  if private.attendance_month_approved(new.halaqa_id, new.day) then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;
  return new;
end;
$$;

create or replace function private.guard_attendance_absences()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_halaqa uuid;
  v_enrolled date;
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    if private.attendance_month_approved(old.halaqa_id, old.day) then
      raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and (new.halaqa_id, new.day, new.student_id, new.kind, new.created_at)
         is not distinct from (old.halaqa_id, old.day, old.student_id, old.kind, old.created_at) then
    return new;   -- تغيّر recorded_by وحده
  end if;

  if tg_op = 'UPDATE' and private.attendance_month_approved(old.halaqa_id, old.day) then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;
  if private.attendance_month_approved(new.halaqa_id, new.day) then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;
  if tg_op = 'INSERT' or new.student_id is distinct from old.student_id
     or new.halaqa_id is distinct from old.halaqa_id or new.day is distinct from old.day then
    select s.halaqa_id, s.enrollment_date into v_halaqa, v_enrolled
      from public.students s where s.id = new.student_id;
    if v_halaqa is distinct from new.halaqa_id then
      raise exception 'الطالب ليس في هذه الحلقة';
    end if;
    if v_enrolled is not null and v_enrolled > new.day then
      raise exception 'الطالب لم يكن ملتحقاً في ذلك اليوم';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_attendance_days(), private.guard_attendance_absences() from public, anon, authenticated;

-- الفحصُ الذاتيّ: يرفع استثناءً عند أيّ خلل فتُلغى الهجرة كلّها.
do $$
declare
  t text;
  p text;
  f text;
begin
  foreach t in array array['attendance_days', 'attendance_absences'] loop
    foreach p in array array['select', 'insert', 'update', 'delete'] loop
      if not has_table_privilege('authenticated', 'public.' || t, p) then
        raise exception '%: authenticated بلا %', t, p;
      end if;
    end loop;
    if has_table_privilege('anon', 'public.' || t, 'select') then
      raise exception '%: منحٌ لـanon', t;
    end if;
  end loop;
  foreach f in array array['guard_attendance_days', 'guard_attendance_absences'] loop
    if not exists (
      select 1 from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
       where n.nspname = 'private' and pr.proname = f and pr.prosecdef
         and exists (select 1 from unnest(pr.proconfig) c where c in ('search_path=""', 'search_path=')))
    then
      raise exception '%: ليست security definer بـsearch_path فارغ', f;
    end if;
    if pg_get_functiondef(('private.' || f || '()')::regprocedure) not like '%pg_trigger_depth() > 1%' then
      raise exception '%: لا تتجاوز الحذفَ التتابعيّ', f;
    end if;
  end loop;
end $$;
