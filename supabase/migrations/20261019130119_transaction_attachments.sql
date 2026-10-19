-- مستنداتُ الحركات المالية (ROADMAP #17، قرارات 2026-10-19): الفاتورةُ أو الإيصال يُرفق بالحركة في سجلّ الحركات
-- القائم — سجلٌّ واحد ورصيدٌ واحد بلا كشفٍ موازٍ. يرفع ويحذف المدير الإداري، ويطّلع مشرفُ المشروع (كبقية الملف المالي).
-- المستودعُ خاصّ (finance-docs) — لا `media` لأنه عامّ. المسارُ بشكلٍ ثابت: transactions/<الحركة>/<uuid>.<امتداد>
-- يُفحص بتعبيرٍ نمطيّ كامل في سياسة الرفع وفي قيد الجدول (فلا يُرفع ملفٌّ في جذر المستودع ولا تحت حركةٍ أخرى).

create table public.transaction_attachments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.financial_transactions(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 200),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint transaction_attachments_path_shape
    check (storage_path ~ ('^transactions/' || transaction_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'))
);

create index transaction_attachments_transaction_idx on public.transaction_attachments (transaction_id);

alter table public.transaction_attachments enable row level security;

create policy txdocs_select on public.transaction_attachments for select to authenticated
  using (is_admin_manager() or is_project_supervisor());
create policy txdocs_insert on public.transaction_attachments for insert to authenticated
  with check (is_admin_manager());
create policy txdocs_delete on public.transaction_attachments for delete to authenticated
  using (is_admin_manager());

revoke all on public.transaction_attachments from anon;
grant select, insert, delete on public.transaction_attachments to authenticated;

-- المستودع: 10 م.ب، صورٌ وPDF فقط
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('finance-docs', 'finance-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy finance_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'finance-docs' and (is_admin_manager() or is_project_supervisor()));
create policy finance_docs_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'finance-docs'
    and is_admin_manager()
    and name ~ '^transactions/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
  );
create policy finance_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'finance-docs' and is_admin_manager());
