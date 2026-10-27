-- الإنجازُ القرآنيّ بلا إنترنت (البند 14، 2026-10-27): سجلُّ طالبٍ لشهرٍ بنداءٍ واحد — يُنشئ رأسَ الشهر مسوّدةً إن لم يكن،
-- ثمّ يكتب السجلّ أو يحدّثه، في معاملةٍ واحدة — كي لا يُرفع من صندوق الجهاز رأسٌ بلا سجلّ. **بصلاحية المستدعي** (invoker):
-- سياساتُ RLS (المعلّمُ لحلقته والمسوّدةُ وحدها) وحارسُ السجلّ (الشهرُ المعتمَد، حدودُ الآيات، ترتيبُ الحفظ، حلقةُ الطالب)
-- وحارسُ «رُصد في حلقةٍ أخرى» تعمل كما هي. و`recorded_at` وقتُ الرصد على الجهاز لا وقتُ الرفع.

alter table public.quran_records add column if not exists recorded_at timestamptz;
comment on column public.quran_records.recorded_at is
  'وقتُ رصد السجلّ على جهاز المعلّم (بلا إنترنت قد يسبق الرفعَ بساعاتٍ أو أيام)؛ null = رُصد متّصلاً (updated_at).';

create or replace function public.save_quran_record(
  p_halaqa uuid, p_year integer, p_month integer, p_student uuid,
  p_from_surah smallint, p_from_ayah smallint, p_to_surah smallint, p_to_ayah smallint,
  p_pages_memorized smallint, p_pages_reviewed smallint, p_notes text, p_recorded_at timestamptz default null
) returns uuid
 language plpgsql
 security invoker
 set search_path to ''
as $function$
declare
  v_report uuid;
  v_status public.report_status;
  v_record uuid;
begin
  perform private.assert_session_writable();

  insert into public.monthly_reports (halaqa_id, report_year, report_month)
  values (p_halaqa, p_year, p_month)
  on conflict (halaqa_id, report_month, report_year) do nothing;

  select r.id, r.status into v_report, v_status
    from public.monthly_reports r
   where r.halaqa_id = p_halaqa and r.report_year = p_year and r.report_month = p_month;
  if v_report is null then
    raise exception 'لا رصدَ لهذا الشهر في حلقتك' using errcode = '42501';
  end if;
  -- رسالةٌ صريحةٌ بدل «row-level security» حين يكون الشهرُ قد أُرسل في أثناء الانقطاع
  if v_status <> 'draft' and not public.can_approve_report_in_halaqa(p_halaqa) then
    raise exception 'أُرسل رصدُ هذا الشهر للاعتماد — لا يُعدَّل إلا أن يُعاد إليك' using errcode = 'P0001';
  end if;

  insert into public.quran_records (
    report_id, student_id, from_surah, from_ayah, to_surah, to_ayah, pages_memorized, pages_reviewed, notes, recorded_at
  ) values (
    v_report, p_student, p_from_surah, p_from_ayah, p_to_surah, p_to_ayah, coalesce(p_pages_memorized, 0), p_pages_reviewed,
    nullif(btrim(coalesce(p_notes, '')), ''), least(coalesce(p_recorded_at, now()), now())
  )
  on conflict (report_id, student_id) do update set
    from_surah = excluded.from_surah, from_ayah = excluded.from_ayah, to_surah = excluded.to_surah, to_ayah = excluded.to_ayah,
    pages_memorized = excluded.pages_memorized, pages_reviewed = excluded.pages_reviewed, notes = excluded.notes,
    recorded_at = excluded.recorded_at
  returning id into v_record;

  return v_record;
end;
$function$;

revoke all on function public.save_quran_record(uuid, integer, integer, uuid, smallint, smallint, smallint, smallint, smallint, smallint, text, timestamptz) from public, anon;
grant execute on function public.save_quran_record(uuid, integer, integer, uuid, smallint, smallint, smallint, smallint, smallint, smallint, text, timestamptz) to authenticated;
