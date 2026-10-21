-- الأمور المؤجّلة في محضر الاجتماع: ما طُرح ولم يُحسم فيُرحَّل إلى اجتماعٍ لاحق (طلب المستخدم 2026-10-21).
-- إضافةٌ خالصة: عمودٌ نصّيّ اختياريّ كأخواته (agenda/decisions/tasks)، وسياساتُ الجدول القائمة تشمله.
alter table public.meeting_minutes add column if not exists deferred_items text;
comment on column public.meeting_minutes.deferred_items is 'الأمور المؤجّلة — بندٌ في كلّ سطر (اختياري)';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meeting_minutes'
      and column_name = 'deferred_items' and data_type = 'text' and is_nullable = 'YES'
  ) then
    raise exception 'meeting_minutes.deferred_items لم يُنشأ كما يُراد';
  end if;
end $$;
