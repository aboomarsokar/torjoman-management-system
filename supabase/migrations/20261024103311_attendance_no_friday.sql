-- الجمعةُ عطلةُ الحلقات (الدوامُ من السبت إلى الخميس — قرار المستخدم 2026-10-24): لا يُسجَّل فيها يومُ حضور.
-- كانت حالةُ الرصد ولوحةُ المعلّم وموعدُ الإرسال تعرف الجمعةَ عطلةً، وشاشةُ الحضور وهذا الحارسُ لا يعرفانها.
-- الإدراجُ والتعديلُ إلى يومِ جمعةٍ يُرفضان؛ والغياباتُ تتبع (مفتاحُها الأجنبيّ إلى attendance_days).
-- لا صفوفَ جمعةٍ قائمة (17 يوماً تجريبياً لحلقة النور عند الكتابة، كلُّها من السبت إلى الخميس)، والحذفُ لا يُمسّ.
-- جُرِّب قبل التطبيق في معاملةٍ تُلغى: الجمعةُ إدراجاً وتعديلاً مرفوضة، والخميسُ والسبتُ والحذفُ تمرّ.

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
  if extract(isodow from new.day) = 5 then
    raise exception 'الجمعة عطلة — لا يُسجَّل فيها حضور';
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

-- فحصٌ ذاتيّ: الحارسُ يعرف الجمعة، وبقي definer بمسارٍ فارغ ومُشغِّلُه فعّال
do $$
declare
  v_def text := pg_get_functiondef('private.guard_attendance_days()'::regprocedure);
begin
  if position('isodow from new.day) = 5' in v_def) = 0 then
    raise exception 'guard_attendance_days لا يفحص الجمعة';
  end if;
  if not exists (select 1 from pg_proc where oid = 'private.guard_attendance_days()'::regprocedure
                 and prosecdef and proconfig @> array['search_path=""']) then
    raise exception 'guard_attendance_days فقد security definer أو search_path';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'attendance_days_guard'
                 and tgrelid = 'public.attendance_days'::regclass and tgenabled <> 'D') then
    raise exception 'المُشغِّل attendance_days_guard غائبٌ أو معطَّل';
  end if;
end;
$$;
