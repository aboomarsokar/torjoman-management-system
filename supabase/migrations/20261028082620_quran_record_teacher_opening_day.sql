-- إغلاقُ إدخال الإنجاز القرآنيّ على المعلّم قبل يوم فتح الشهر (قرار المستخدم 2026-10-28): لا يحفظ المعلّمُ سجلَّ طالبٍ
-- لشهرٍ قبل آخر يومٍ منه — والخميسِ قبله إن كان آخرُه جمعة (`private.report_opening_day`، اليومُ نفسه الذي يُفتح فيه
-- الإرسال). ومن ذلك اليوم يبقى مفتوحاً بلا موعد إغلاق حتى يُرسله. الإدارةُ والمشرفُ كما هم.
-- في حارس السجلّ نفسِه فيمرّ عليه كلُّ طريقٍ يكتب منه المعلّم: الكتابةُ المباشرة، و`save_quran_record` (صندوقُ الجهاز
-- بلا إنترنت)، وأيُّ مسارٍ يُضاف لاحقاً. والحذفُ والتتابعيُّ وتغيّرُ recorded_by وحده لا يمسّها (لا إدخالَ فيها).
-- الرسالةُ بالعربية ورمزُها P0001: صندوقُ الجهاز يعدّه رفضاً نهائياً فيعرضه للمعلّم بنصّه.

create or replace function private.guard_quran_record()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_status public.report_status;
  v_halaqa uuid;
  v_year integer;
  v_month integer;
  v_opens date;
  v_fs smallint;
  v_ts smallint;
  v_student_halaqa uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    -- الحذفُ التتابعيّ (حذفُ طالبٍ/تقريرٍ/حلقة) يجري في عمق ٢ فما فوق فيُتجاوَز؛ المباشرُ يبقى محظوراً.
    if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
    -- التحديثُ التتابعيّ لـrecorded_by (on delete set null) لا يغيّر بياناتٍ فيمرّ ولو كان الشهرُ معتمَداً.
    if tg_op = 'UPDATE' and pg_trigger_depth() > 1
       and (new.report_id, new.student_id, new.from_surah, new.from_ayah, new.to_surah, new.to_ayah,
            new.pages_memorized, new.pages_reviewed, new.notes)
           is not distinct from
           (old.report_id, old.student_id, old.from_surah, old.from_ayah, old.to_surah, old.to_ayah,
            old.pages_memorized, old.pages_reviewed, old.notes) then
      return new;   -- تفريغٌ تتابعيّ لـrecorded_by
    end if;
    select r.status into v_status from public.monthly_reports r where r.id = old.report_id;
    if v_status = 'approved' then
      raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    if (new.report_id, new.student_id, new.from_surah, new.from_ayah, new.to_surah, new.to_ayah,
        new.pages_memorized, new.pages_reviewed, new.notes)
       is not distinct from
       (old.report_id, old.student_id, old.from_surah, old.from_ayah, old.to_surah, old.to_ayah,
        old.pages_memorized, old.pages_reviewed, old.notes) then
      return new;   -- تغيّر recorded_by وحده
    end if;
  end if;

  select r.status, r.halaqa_id, r.report_year, r.report_month into v_status, v_halaqa, v_year, v_month
    from public.monthly_reports r where r.id = new.report_id;
  if v_status = 'approved' then
    raise exception 'الشهر معتمَد — يُعيده المعتمِد أوّلاً';
  end if;

  -- المعلّمُ قبل يوم فتح الشهر: لا إدخال (قرار المستخدم 2026-10-28)
  v_opens := private.report_opening_day(v_year, v_month);
  if private.attendance_today() < v_opens
     and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'teacher') then
    raise exception 'يُفتح إدخالُ إنجاز الشهر % في %.', lpad(v_month::text, 2, '0'), to_char(v_opens, 'DD-MM-YYYY')
      using errcode = 'P0001';
  end if;

  if new.from_surah is not null then
    select s.ayah_count into v_fs from public.surahs s where s.number = new.from_surah;
    select s.ayah_count into v_ts from public.surahs s where s.number = new.to_surah;
    if new.from_ayah < 1 or new.from_ayah > v_fs then
      raise exception 'آيةُ البداية خارج عدد آيات السورة (1-%)', v_fs;
    end if;
    if new.to_ayah < 1 or new.to_ayah > v_ts then
      raise exception 'آيةُ النهاية خارج عدد آيات السورة (1-%)', v_ts;
    end if;
    -- ترتيبُ الحفظ: السورة تنازلياً والآيةُ داخلها تصاعدياً.
    if not (new.from_surah > new.to_surah
            or (new.from_surah = new.to_surah and new.from_ayah <= new.to_ayah)) then
      raise exception 'بدايةُ المسار يجب أن تسبق نهايتَه بترتيب الحفظ (من الناس إلى الفاتحة)';
    end if;
  end if;

  if tg_op = 'INSERT' or new.student_id is distinct from old.student_id
     or new.report_id is distinct from old.report_id then
    select s.halaqa_id into v_student_halaqa from public.students s where s.id = new.student_id;
    if v_student_halaqa is distinct from v_halaqa then
      raise exception 'الطالب ليس في حلقة هذا التقرير';
    end if;
  end if;
  return new;
end;
$function$;
