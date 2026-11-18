-- البرامجُ المصاحبة: المقرّرُ الثاني عشر لقاءٌ علميّ فقط (طلب المستخدم 2026-11-18) — بلا كتبٍ ولا محاضرات ولا اختبار.
-- `has_test = false`: يظهر في الخطّة وخارطة الشهر للمتابعة، ولا يدخل رحلةَ الطالب ولا «المتأخّر/المنجز»؛
-- ومن اجتاز المقرّراتِ ذواتِ الاختبار أنهى البرنامج. والبندُ الجديد `meeting` في خارطة الأسبوع (عنوانٌ إلزاميّ كالمرئيّ).
alter table public.reading_units add column has_test boolean not null default true;

alter table public.reading_unit_items drop constraint reading_unit_items_kind_check;
alter table public.reading_unit_items add constraint reading_unit_items_kind_check
  check (kind in ('pages', 'lecture', 'clip', 'meeting'));

with u as (
  insert into public.reading_units (sort_order, title, opens_on, has_test)
  values (12, 'المقرّر الثاني عشر', date '2027-09-01', false)
  returning id
)
insert into public.reading_unit_items (unit_id, week, sort_order, kind, title)
select u.id, 1, 1, 'meeting', 'لقاء علمي' from u;
