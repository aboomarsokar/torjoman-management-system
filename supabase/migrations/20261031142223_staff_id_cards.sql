-- صورُ هويات الكادر (طلب المستخدم 2026-10-31): كلُّ عاملٍ (لا الطلاب) يرفع صورةً واحدةً لهويته من حسابه ويستبدلها،
-- ويتابعها المديرُ الإداريّ (الكلّ) والمديرةُ الإدارية (عاملاتُ قسم البنات) ويفتحانها وينزّلانها. بياناتٌ شخصيةٌ حسّاسة:
-- مستودعٌ خاصّ `id-cards` لا يقرؤه إلا صاحبُه ومن ذُكر، والتنزيلُ برابطٍ موقَّتٍ قصير، ولا يراها مشرفُ المشروع.

create table public.staff_id_cards (
  profile_id  uuid primary key references public.profiles(id) on delete cascade,
  file_path   text not null unique check (file_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'),
  mime_type   text not null,
  size_bytes  integer not null check (size_bytes between 1 and 5242880),
  uploaded_at timestamptz not null default now()
);

alter table public.staff_id_cards enable row level security;

-- من يرى هويةَ هذا العامل: هو، والمديرُ الإداريّ، والمديرةُ الإداريةُ لعاملات قسم البنات
create or replace function private.can_view_id_card(p_profile uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_profile = auth.uid()
      or public.is_admin_manager()
      or (public.current_user_role() = 'women_admin'
          and exists (select 1 from public.profiles p where p.id = p_profile and p.gender = 'female' and p.role <> 'student'))
$$;
revoke all on function private.can_view_id_card(uuid) from public, anon;
grant execute on function private.can_view_id_card(uuid) to authenticated;

-- يرفع لنفسه عاملٌ نشط (لا طالب)
create or replace function private.can_upload_id_card(p_profile uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_profile = auth.uid() and coalesce(public.current_user_role() <> 'student', false)
$$;
revoke all on function private.can_upload_id_card(uuid) from public, anon;
grant execute on function private.can_upload_id_card(uuid) to authenticated;

create policy staff_id_cards_select on public.staff_id_cards for select to authenticated
  using ((select private.can_view_id_card(profile_id)));
create policy staff_id_cards_insert on public.staff_id_cards for insert to authenticated
  with check ((select private.can_upload_id_card(profile_id)) and file_path like profile_id::text || '/%');
create policy staff_id_cards_update on public.staff_id_cards for update to authenticated
  using ((select private.can_upload_id_card(profile_id)))
  with check ((select private.can_upload_id_card(profile_id)) and file_path like profile_id::text || '/%');
create policy staff_id_cards_delete on public.staff_id_cards for delete to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin_manager()));

grant select, insert, update, delete on public.staff_id_cards to authenticated;
select private.guard_table_for_impersonation('public.staff_id_cards');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('id-cards', 'id-cards', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

-- المجلّدُ الأوّل في اسم الملفّ هو معرّفُ صاحب الهوية
create policy id_cards_files_read on storage.objects for select to authenticated
  using (bucket_id = 'id-cards' and (select private.can_view_id_card(((storage.foldername(name))[1])::uuid)));
create policy id_cards_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'id-cards'
              and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
              and (select private.can_upload_id_card(((storage.foldername(name))[1])::uuid)));
create policy id_cards_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'id-cards'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin_manager())));
