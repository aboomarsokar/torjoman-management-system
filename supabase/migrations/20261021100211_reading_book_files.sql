-- ============================================================
-- كتبُ البرامج المصاحبة ملفّاتِ PDF يُنزّلها الطالب والعاملون (طلب المستخدم 2026-10-21).
-- · ملفٌّ لكلّ كتاب (`reading_books.pdf_path`)، والمقرّرُ يحدّد الصفحات.
-- · مستودعٌ خاصّ `reading-books` (50 م.ب، PDF وحده)، والتنزيلُ برابطٍ موقَّتٍ قصير.
-- · الطالبُ ينزّل كتبَ مقرّره المستحقّ وما اجتازه فقط، لا القادمةَ؛ والعاملون كلَّ الكتب؛ ويرفع المديران.
-- ============================================================

alter table public.reading_books add column pdf_path text
  check (pdf_path is null or pdf_path ~ '^books/[0-9]+\.pdf$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reading-books', 'reading-books', false, 52428800, array['application/pdf']);

-- هل يُنزّل صاحبُ الجلسة هذا الملفّ؟ العاملُ (أيُّ دورٍ نشطٍ غيرُ الطالب): نعم؛ والطالبُ: إن كان الكتابُ في مقرّرٍ
-- اجتازه أو في مستحقّه (أوّلِ ما لم يجتزه) — فإن أتمّها كلَّها فكلُّها.
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
    else exists (
      select 1
      from public.reading_books b
      join public.reading_unit_parts p on p.book_id = b.id
      join public.reading_units u on u.id = p.unit_id
      where b.pdf_path = p_name
        and (u.id in (select unit_id from passed) or (select so from due) is null or u.sort_order <= (select so from due))
    )
  end;
$$;
revoke all on function private.can_download_reading_book(text) from public, anon;
grant execute on function private.can_download_reading_book(text) to authenticated;

create policy reading_books_files_read on storage.objects for select to authenticated
  using (bucket_id = 'reading-books' and (select private.can_download_reading_book(name)));
create policy reading_books_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'reading-books' and public.current_user_role() in ('admin_manager', 'technical_manager')
              and name ~ '^books/[0-9]+\.pdf$');
create policy reading_books_files_update on storage.objects for update to authenticated
  using (bucket_id = 'reading-books' and public.current_user_role() in ('admin_manager', 'technical_manager'))
  with check (bucket_id = 'reading-books' and public.current_user_role() in ('admin_manager', 'technical_manager')
              and name ~ '^books/[0-9]+\.pdf$');
create policy reading_books_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'reading-books' and public.current_user_role() in ('admin_manager', 'technical_manager'));
