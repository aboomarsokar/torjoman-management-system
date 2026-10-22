-- قراراتُ المستخدم 2026-10-22:
-- (1) البرامجُ المصاحبة: المقرّراتُ وكتبُها وأجزاؤها وبنكُ أسئلتها وملفّاتُها يكتبها المدير الإداري وحده؛ والفنيُّ يطّلع.
-- (2) تقسيمةُ الأجزاء (`program_juz`) يعدّلها المدير الإداري: بدايةُ كلّ جزءٍ ونهايتُه (والآيةُ لا تتجاوز آياتِ سورتها).

drop policy reading_units_write on public.reading_units;
create policy reading_units_write on public.reading_units for all to authenticated
  using ((select public.is_admin_manager())) with check ((select public.is_admin_manager()));

drop policy reading_unit_parts_write on public.reading_unit_parts;
create policy reading_unit_parts_write on public.reading_unit_parts for all to authenticated
  using ((select public.is_admin_manager())) with check ((select public.is_admin_manager()));

drop policy reading_books_write on public.reading_books;
create policy reading_books_write on public.reading_books for all to authenticated
  using ((select public.is_admin_manager())) with check ((select public.is_admin_manager()));

-- بنكُ الأسئلة: يقرؤه المديران، ويكتبه الإداري
drop policy reading_questions_manage on public.reading_questions;
create policy reading_questions_select on public.reading_questions for select to authenticated
  using (public.current_user_role() in ('admin_manager', 'technical_manager'));
create policy reading_questions_manage on public.reading_questions for all to authenticated
  using ((select public.is_admin_manager())) with check ((select public.is_admin_manager()));

drop policy reading_books_files_insert on storage.objects;
create policy reading_books_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'reading-books' and (select public.is_admin_manager())
              and name ~ '^(units/[0-9]+\.pdf|covers/[0-9]+\.(jpg|png|webp))$');
drop policy reading_books_files_update on storage.objects;
create policy reading_books_files_update on storage.objects for update to authenticated
  using (bucket_id = 'reading-books' and (select public.is_admin_manager()))
  with check (bucket_id = 'reading-books' and (select public.is_admin_manager())
              and name ~ '^(units/[0-9]+\.pdf|covers/[0-9]+\.(jpg|png|webp))$');
drop policy reading_books_files_delete on storage.objects;
create policy reading_books_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'reading-books' and (select public.is_admin_manager()));

-- ── تقسيمةُ الأجزاء ──
grant update (start_surah, start_ayah, end_surah, end_ayah) on public.program_juz to authenticated;
create policy program_juz_update on public.program_juz for update to authenticated
  using ((select public.is_admin_manager())) with check ((select public.is_admin_manager()));

create or replace function private.guard_program_juz_ayahs()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if new.start_ayah > (select s.ayah_count from public.surahs s where s.number = new.start_surah) then
    raise exception 'آيةُ البداية أكبرُ من عدد آيات سورتها.' using errcode = '23514';
  end if;
  if new.end_ayah > (select s.ayah_count from public.surahs s where s.number = new.end_surah) then
    raise exception 'آيةُ النهاية أكبرُ من عدد آيات سورتها.' using errcode = '23514';
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_program_juz_ayahs() from public, anon, authenticated;
create trigger program_juz_guard_ayahs before update on public.program_juz
  for each row execute function private.guard_program_juz_ayahs();
