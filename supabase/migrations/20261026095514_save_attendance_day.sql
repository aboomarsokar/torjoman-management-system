-- الحضورُ بلا إنترنت (البند 14، 2026-10-26): يومُ حضورٍ كاملٌ بنداءٍ واحد — يفتح اليومَ ويكتب غياباته ويمحو غيابَ
-- من صار حاضراً في معاملةٍ واحدة، كي لا يُرفع من صندوق الجهاز نصفُ يوم. **بصلاحية المستدعي** (invoker): سياساتُ
-- RLS وحارسا الجدولين (الجمعة، اليومُ الآتي، الشهرُ المعتمَد، الالتحاق، بدايةُ المشروع، النيابة) تعمل كما هي.
--   • طالبٌ خرج من الحلقة أو لم يكن ملتحقاً يومَها **يُتخطّى ولا يُسقط اليوم** (درسُ الصحابة: تسجيلٌ واحدٌ مرفوض
--     كان يحبس الدفعةَ كلَّها) — ويُعاد في الردّ ليُخبَر المعلّم.
--   • `recorded_at` وقتُ التسجيل على الجهاز (لا وقتُ الرفع)، فتعرف الإدارةُ متى سجّل المعلّم فعلاً.

alter table public.attendance_days add column if not exists recorded_at timestamptz;
comment on column public.attendance_days.recorded_at is
  'وقتُ تسجيل الحضور على جهاز المعلّم (بلا إنترنت قد يسبق الرفعَ بساعاتٍ أو أيام)؛ null = سُجّل متّصلاً (created_at).';

create or replace function public.save_attendance_day(
  p_halaqa uuid, p_day date, p_absences jsonb, p_recorded_at timestamptz default null
) returns jsonb
 language plpgsql
 security invoker
 set search_path to ''
as $function$
declare
  v_ids uuid[];
  v_valid uuid[];
  v_skipped uuid[];
  v_recorded timestamptz := least(coalesce(p_recorded_at, now()), now());
begin
  perform private.assert_session_writable();

  if jsonb_typeof(coalesce(p_absences, '{}'::jsonb)) <> 'object'
     or exists (select 1 from jsonb_each_text(coalesce(p_absences, '{}'::jsonb)) e
                 where e.value not in ('excused', 'unexcused')
                    or e.key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'غياباتٌ بصيغةٍ غير صحيحة' using errcode = '22023';
  end if;

  select coalesce(array_agg(e.key::uuid), '{}') into v_ids from jsonb_object_keys(coalesce(p_absences, '{}'::jsonb)) e(key);

  -- من في الحلقة اليومَ وكان ملتحقاً في ذلك اليوم
  select coalesce(array_agg(s.id), '{}') into v_valid
    from public.students s
   where s.id = any (v_ids) and s.halaqa_id = p_halaqa
     and (s.enrollment_date is null or s.enrollment_date <= p_day);
  select coalesce(array_agg(x), '{}') into v_skipped from unnest(v_ids) x where not (x = any (v_valid));

  insert into public.attendance_days (halaqa_id, day, recorded_at)
  values (p_halaqa, p_day, v_recorded)
  on conflict (halaqa_id, day) do update set recorded_at = excluded.recorded_at;

  -- من صار حاضراً: يُمحى غيابُه — لطلاب الحلقة الحاليّين وحدهم (غيابُ من خرج يبقى كما هو)
  delete from public.attendance_absences a
   where a.halaqa_id = p_halaqa and a.day = p_day
     and not (a.student_id = any (v_valid))
     and exists (select 1 from public.students s where s.id = a.student_id and s.halaqa_id = p_halaqa);

  insert into public.attendance_absences (halaqa_id, day, student_id, kind)
  select p_halaqa, p_day, e.key::uuid, e.value
    from jsonb_each_text(p_absences) e
   where e.key::uuid = any (v_valid)
  on conflict (day, student_id) do update set kind = excluded.kind, halaqa_id = excluded.halaqa_id;

  return jsonb_build_object('absences', cardinality(v_valid), 'skipped', to_jsonb(v_skipped));
end;
$function$;

revoke all on function public.save_attendance_day(uuid, date, jsonb, timestamptz) from public, anon;
grant execute on function public.save_attendance_day(uuid, date, jsonb, timestamptz) to authenticated;
