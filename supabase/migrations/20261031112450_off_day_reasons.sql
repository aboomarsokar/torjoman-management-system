-- أسبابُ «لم تنعقد الحلقة» عند المعلّم (طلب المستخدم 2026-10-31): مرضُ المعلم · عذرٌ طارئ · سببٌ آخر — بندٌ لكلٍّ منها.
--   • `emergency` سببٌ جديد، و`teacher_sick` صار «مرض المعلم» وحده (كان «مرض المعلم أو عذر طارئ»).
--   • «عطلة رسمية» و«ظرف أمني» أُخفيا عن المعلّم (العطلةُ والظرفُ العامّ إجازةٌ يعيّنها المدير الإداري)، ويبقيان مقبولَين
--     في القاعدة كي لا يُرفض بلاغٌ من جهازٍ لم يصله التحديث بعد. لا بلاغاتٍ قائمةً عند الكتابة.
--   • report_off_day من نسخة 20261030111156 حرفاً، ولا يتغيّر فيها إلا قائمةُ الأسباب المقبولة وتسميةُ الإشعار.

alter table public.attendance_off_days drop constraint attendance_off_days_reason_check,
  add constraint attendance_off_days_reason_check
  check (reason in ('teacher_sick', 'emergency', 'other', 'official_holiday', 'security'));

create or replace function public.report_off_day(
  p_halaqa uuid, p_day date, p_reason text, p_note text, p_reported_at timestamptz default null
) returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_err text;
  v_id uuid;
  v_status text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_name text;
  v_gender text;
  v_supervisor uuid;
  v_label text;
  v_rcpt uuid;
begin
  perform private.assert_session_writable();

  select h.name, h.gender::text, h.supervisor_id into v_name, v_gender, v_supervisor
    from public.halaqat h
   where h.id = p_halaqa and h.teacher_id = v_uid;
  if not found or public.current_user_role() is null then
    raise exception 'هذه الحلقة ليست حلقتك' using errcode = '42501';
  end if;

  if p_day is null then
    raise exception 'اليومُ مطلوب' using errcode = '22023';
  end if;
  if p_reason is null or p_reason not in ('teacher_sick', 'emergency', 'other', 'official_holiday', 'security') then
    raise exception 'سببٌ غير معروف' using errcode = '22023';
  end if;
  if p_reason = 'other' and v_note is null then
    raise exception 'اكتب السببَ في الملاحظة' using errcode = '22023';
  end if;
  if char_length(v_note) > 300 then
    raise exception 'الملاحظةُ أطولُ من 300 حرف' using errcode = '22023';
  end if;

  -- إعادةُ رفعٍ بعد ردٍّ ضائع: البلاغُ قائمٌ بالسبب والملاحظة أنفسهما (معلّقاً أو معتمَداً) ← يُردّ كما هو بلا كتابةٍ ولا إشعار.
  -- قبل فحص النافذة وفحص «اعتُمد البلاغ»، فلا يُرفض ما قُبل أصلاً لأنّ الشهرَ اعتُمد أو اليومَ صار إجازةً بعده.
  select o.id, o.status into v_id, v_status
    from public.attendance_off_days o
   where o.halaqa_id = p_halaqa and o.day = p_day
     and o.reason = p_reason and o.note is not distinct from v_note
     and o.status in ('pending', 'approved')
   for update;
  if found then
    return jsonb_build_object('id', v_id, 'status', v_status);
  end if;

  v_err := private.off_day_window_ok(p_halaqa, p_day);
  if v_err is not null then
    raise exception '%', v_err using errcode = 'P0001';
  end if;

  -- (والسباقُ مع اعتمادٍ متزامن يمسكه شرطُ on conflict أدناه)
  if exists (select 1 from public.attendance_off_days o
              where o.halaqa_id = p_halaqa and o.day = p_day and o.status = 'approved') then
    raise exception 'اعتُمد البلاغُ عن هذا اليوم' using errcode = 'P0001';
  end if;

  -- يومٌ واحد = حضورٌ أو بلاغ: حضورُ اليوم يُمحى، وغياباتُه تتبعه تتابعاً.
  delete from public.attendance_days a where a.halaqa_id = p_halaqa and a.day = p_day;

  insert into public.attendance_off_days as o (halaqa_id, day, reason, note, status, reported_by, reported_at)
  values (p_halaqa, p_day, p_reason, v_note, 'pending', v_uid, least(coalesce(p_reported_at, now()), now()))
  on conflict (halaqa_id, day) do update
     set reason = excluded.reason,
         note = excluded.note,
         status = 'pending',
         reported_by = excluded.reported_by,
         reported_at = excluded.reported_at,
         reviewed_by = null,
         reviewed_at = null,
         review_note = null
   where o.status <> 'approved'
  returning o.id into v_id;

  if v_id is null then
    raise exception 'اعتُمد البلاغُ عن هذا اليوم' using errcode = 'P0001';
  end if;

  v_label := case p_reason
               when 'teacher_sick' then 'مرض المعلم'
               when 'emergency' then 'عذر طارئ'
               when 'official_holiday' then 'عطلة رسمية'
               when 'security' then 'ظرف أمني'
               else 'سبب آخر' end;

  -- المشرفُ الميدانيّ للحلقة، ثمّ المديرُ الفنيّ (البنين) أو المديرةُ الإدارية (البنات) — النشطون وحدهم.
  for v_rcpt in
    select v_supervisor where v_supervisor is not null
    union
    select p.id from public.profiles p
     where p.status = 'active'
       and ((p.role = 'technical_manager' and v_gender = 'male')
         or (p.role = 'women_admin' and v_gender = 'female'))
  loop
    perform private.notify(
      v_rcpt, 'off_day_reported',
      'لم تنعقد حلقة ' || v_name || ' يوم ' || to_char(p_day, 'DD/MM'),
      v_label || coalesce(' — ' || v_note, ''),
      '/attendance?h=' || p_halaqa::text || '&d=' || to_char(p_day, 'YYYY-MM-DD'),
      'attendance_off_days', v_id);
  end loop;

  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$function$;
revoke all on function public.report_off_day(uuid, date, text, text, timestamptz) from public, anon;
grant execute on function public.report_off_day(uuid, date, text, text, timestamptz) to authenticated;

-- فحصٌ ذاتيّ: السببُ الجديد في القيد والدالّة، والمنحُ كما كان
do $$
begin
  if position('emergency' in (select pg_get_constraintdef(oid) from pg_constraint
                               where conname = 'attendance_off_days_reason_check'
                                 and conrelid = 'public.attendance_off_days'::regclass)) = 0
     or position('emergency' in pg_get_functiondef('public.report_off_day(uuid,date,text,text,timestamptz)'::regprocedure)) = 0 then
    raise exception 'emergency غائبٌ عن القيد أو عن report_off_day';
  end if;
  if not has_function_privilege('authenticated', 'public.report_off_day(uuid,date,text,text,timestamptz)', 'EXECUTE')
     or has_function_privilege('anon', 'public.report_off_day(uuid,date,text,text,timestamptz)', 'EXECUTE') then
    raise exception 'report_off_day: المنحُ لـauthenticated وحده';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.report_off_day(uuid,date,text,text,timestamptz)'::regprocedure
                 and prosecdef and proconfig @> array['search_path=""']) then
    raise exception 'report_off_day فقدت security definer أو search_path';
  end if;
end;
$$;
