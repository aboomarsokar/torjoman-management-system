-- مكتبةُ المشروع (طلب المستخدم 2026-10-31): الملازمُ الخمسَ عشرة (ملفٌّ لكلّ ملزمة، يُستبدل بالأحدث) والمستنداتُ
-- والمقرّراتُ العامة بتصنيفها وجمهورها (الجميع · الكادر وحده). يقرؤها كلُّ حسابٍ نشط (والطالبُ ما جمهورُه «الجميع»)،
-- ويرفعها ويعدّلها ويحذفها المديرُ الإداريّ وحده. الملفّاتُ في مستودعٍ خاصّ `library`، والتنزيلُ برابطٍ موقَّت.

create table public.library_items (
  id          uuid primary key default gen_random_uuid(),
  booklet     smallint unique check (booklet between 1 and 15),
  title       text not null check (char_length(btrim(title)) between 1 and 150),
  description text check (description is null or char_length(description) <= 500),
  category    text not null default 'عام' check (char_length(btrim(category)) between 1 and 60),
  audience    text not null default 'all' check (audience in ('all', 'staff')),
  file_path   text not null unique check (file_path ~ '^(booklets|docs)/[0-9a-f-]{36}\.(pdf|jpg|png|webp|docx|xlsx|pptx)$'),
  file_name   text not null check (char_length(file_name) between 1 and 200),
  mime_type   text not null,
  size_bytes  integer not null check (size_bytes between 1 and 52428800),
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- الملزمةُ للجميع دائماً
  constraint library_booklet_audience check (booklet is null or audience = 'all')
);

create index library_items_category_idx on public.library_items (category, created_at desc);

alter table public.library_items enable row level security;

create policy library_items_select on public.library_items for select to authenticated
  using ((select public.current_user_role()) is not null
         and (audience = 'all' or (select public.current_user_role()) <> 'student'));
create policy library_items_insert on public.library_items for insert to authenticated
  with check ((select public.is_admin_manager()));
create policy library_items_update on public.library_items for update to authenticated
  using ((select public.is_admin_manager())) with check ((select public.is_admin_manager()));
create policy library_items_delete on public.library_items for delete to authenticated
  using ((select public.is_admin_manager()));

grant select, insert, update, delete on public.library_items to authenticated;
select private.guard_table_for_impersonation('public.library_items');

create or replace function private.library_touch()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.library_touch() from public, anon, authenticated;
create trigger library_items_touch before update on public.library_items
  for each row execute function private.library_touch();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library', 'library', false, 52428800, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

-- يُنزَّل الملفُّ لمن يرى صفَّه في المكتبة؛ والمديرُ الإداريّ يرى ما رفعه قبل أن يُسجَّل صفُّه
create or replace function private.can_read_library_file(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin_manager()
      or exists (select 1 from public.library_items i
                  where i.file_path = p_name
                    and public.current_user_role() is not null
                    and (i.audience = 'all' or public.current_user_role() <> 'student'))
$$;
revoke all on function private.can_read_library_file(text) from public, anon;
grant execute on function private.can_read_library_file(text) to authenticated;

create policy library_files_read on storage.objects for select to authenticated
  using (bucket_id = 'library' and (select private.can_read_library_file(name)));
create policy library_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'library' and (select public.is_admin_manager())
              and name ~ '^(booklets|docs)/[0-9a-f-]{36}\.(pdf|jpg|png|webp|docx|xlsx|pptx)$');
create policy library_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'library' and (select public.is_admin_manager()));
