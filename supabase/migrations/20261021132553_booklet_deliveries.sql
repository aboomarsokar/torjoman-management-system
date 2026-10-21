-- أرشيفُ تسليم الملازم للحلقات (طلب المستخدم 2026-10-21): الملازمُ مقرّراتُ المشروع المطبوعة، خمسَ عشرةَ
-- ملزمةً بجزأين — (29+30) رقمُها 1، ثم (27+28) رقمُها 2 … حتى (1+2) رقمُها 15 — والقائمةُ ثابتةٌ في الواجهة
-- (`app/constants/booklets.ts`). كلُّ صفٍّ تسليمٌ واحد: الحلقةُ والملزمةُ وعددُ النسخ والتاريخ، والتسليمُ يتكرّر.
-- يكتبه المديرُ الإداريّ وحده ويقرؤه معه مشرفُ المشروع.

create table public.booklet_deliveries (
  id            uuid primary key default gen_random_uuid(),
  halaqa_id     uuid not null references public.halaqat(id) on delete cascade,
  booklet       smallint not null check (booklet between 1 and 15),
  copies        integer not null check (copies between 1 and 1000),
  delivered_on  date not null default ((now() at time zone 'Asia/Gaza')::date),
  note          text check (note is null or char_length(note) <= 300),
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);

create index booklet_deliveries_halaqa_idx on public.booklet_deliveries (halaqa_id, booklet);

alter table public.booklet_deliveries enable row level security;

create policy booklet_deliveries_select on public.booklet_deliveries for select to authenticated
  using (public.current_user_role() in ('admin_manager', 'project_supervisor'));
create policy booklet_deliveries_write on public.booklet_deliveries for all to authenticated
  using ((select public.is_admin_manager()))
  with check ((select public.is_admin_manager()));

-- حارسُ النيابة (قراءةٌ فقط)
select private.guard_table_for_impersonation('public.booklet_deliveries');
