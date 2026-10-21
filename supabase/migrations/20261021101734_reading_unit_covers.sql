-- غلافُ كلّ مقرّر (طلب المستخدم 2026-10-21: «صورة في خلفية زرّ تنزيل المقرّر») — الصفحةُ الأولى من ملفّه،
-- `covers/<id>.(jpg|png|webp)` في المستودع نفسه. الأغلفةُ يراها كلُّ مسجَّل (ولو لمقرّرٍ قادم)؛ والقيدُ على
-- ملفّات PDF وحدها كما كان. يرفعها المديران. والمستودعُ يقبل الصورَ بجانب PDF.

alter table public.reading_units add column cover_path text
  check (cover_path is null or cover_path ~ '^covers/[0-9]+\.(jpg|png|webp)$');

update storage.buckets set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
where id = 'reading-books';

create or replace function private.can_download_reading_book(p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  with me as (
    select public.current_user_role() as role, public.my_student_id() as sid
  ),
  passed as (
    select distinct a.unit_id from public.reading_attempts a, me where a.student_id = me.sid and a.passed
  ),
  due as (
    select min(u.sort_order) as so from public.reading_units u where u.id not in (select unit_id from passed)
  )
  select case
    when (select role from me) is null then false
    when (select role from me) <> 'student' then true
    when p_name like 'covers/%' then true
    else exists (
      select 1 from public.reading_units u
      where u.pdf_path = p_name
        and (u.id in (select unit_id from passed) or (select so from due) is null or u.sort_order <= (select so from due))
    )
  end;
$$;

drop policy reading_books_files_insert on storage.objects;
drop policy reading_books_files_update on storage.objects;
create policy reading_books_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'reading-books' and public.current_user_role() in ('admin_manager', 'technical_manager')
              and name ~ '^(units/[0-9]+\.pdf|covers/[0-9]+\.(jpg|png|webp))$');
create policy reading_books_files_update on storage.objects for update to authenticated
  using (bucket_id = 'reading-books' and public.current_user_role() in ('admin_manager', 'technical_manager'))
  with check (bucket_id = 'reading-books' and public.current_user_role() in ('admin_manager', 'technical_manager')
              and name ~ '^(units/[0-9]+\.pdf|covers/[0-9]+\.(jpg|png|webp))$');
