-- رقمُ الواتس أب للعاملين، وهويةُ العامل تسعةُ أرقامٍ لا تزيد (طلب المستخدم 2026-10-22)
alter table public.profiles add column if not exists whatsapp text
  constraint profiles_whatsapp_format check (whatsapp ~ '^\+?[0-9]{7,15}$');
alter table public.profiles add constraint profiles_national_id_9_digits
  check (national_id ~ '^[0-9]{9}$');
comment on column public.profiles.whatsapp is 'رقم الواتس أب — أرقامٌ بلا مسافات، و+ اختيارية في أوّله';
