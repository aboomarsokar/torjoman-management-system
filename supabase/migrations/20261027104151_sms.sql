-- رسائلُ SMS من المنصّة عبر MTC (طلب المستخدم 2026-10-27): المديرُ الإداريّ يرسل للكادر ولجهاتٍ من خارجه
-- (مرشّحون للمقابلات وغيرُهم). الإرسالُ من مسار الخادم وحده (`/api/sms/send`) — بياناتُ حساب المزوّد في متغيّرات
-- البيئة لا في القاعدة ولا في المتصفّح. هنا: دفترُ جهات الاتصال الخارجية، وسجلُّ ما أُرسل.

create table public.sms_contacts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  phone       text not null check (phone ~ '^05\d{8}$'),
  tag         text check (tag is null or char_length(tag) <= 40),
  note        text check (note is null or char_length(note) <= 200),
  created_by  uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index sms_contacts_phone_tag on public.sms_contacts (phone, coalesce(tag, ''));

alter table public.sms_contacts enable row level security;
create policy sms_contacts_select on public.sms_contacts for select to authenticated
  using ((select public.current_user_role()) in ('admin_manager', 'project_supervisor'));
create policy sms_contacts_write on public.sms_contacts for all to authenticated
  using ((select public.is_admin_manager()))
  with check ((select public.is_admin_manager()));
grant select, insert, update, delete on public.sms_contacts to authenticated;
select private.guard_table_for_impersonation('public.sms_contacts');

-- سطرٌ لكلّ دفعة إرسال إلى المزوّد: النصُّ والمستلمون ونتيجةُ المزوّد. يكتبه الخادمُ بعميل الخدمة وحده.
create table public.sms_log (
  id          uuid primary key default gen_random_uuid(),
  body        text not null check (char_length(body) between 1 and 1000),
  recipients  jsonb not null check (jsonb_typeof(recipients) = 'array'),
  recipients_count integer not null check (recipients_count > 0),
  segments    smallint not null check (segments between 1 and 15),
  ok          boolean not null,
  code        text not null check (char_length(code) <= 20),
  result      text check (result is null or char_length(result) <= 300),
  sent_by     uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index sms_log_created_idx on public.sms_log (created_at desc);

alter table public.sms_log enable row level security;
create policy sms_log_select on public.sms_log for select to authenticated
  using ((select public.current_user_role()) in ('admin_manager', 'project_supervisor'));
-- لا سياسةَ كتابةٍ للعميل: السجلُّ يُكتب من مسار الخادم وحده
grant select on public.sms_log to authenticated;
select private.guard_table_for_impersonation('public.sms_log');
