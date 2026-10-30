-- شروطُ الالتحاق في طلب المرشّح (طلب المستخدم 2026-10-30): مكانُ انعقاد الحلقة، والعنوانُ التفصيليّ، وسنواتُ الخبرة،
-- وأسئلةُ الشروط (جمعُ 15 طالباً، والتفرّغُ ساعتين يومياً)، وإقرارُ الشروط وعدم ازدواجية الحلقة. مكانُ السكن في `residence`
-- (غزة · الوسطى · النصيرات · الزوايدة · دير البلح · خانيونس · أخرى: …). من لا تنطبق عليه الشروط يُسجَّل ويُعلَّم في الواجهة.

alter table public.candidates
  add column halaqa_area      text check (halaqa_area is null or char_length(halaqa_area) <= 80),
  add column address_detail   text check (address_detail is null or char_length(address_detail) <= 200),
  add column experience_years smallint check (experience_years is null or experience_years between 0 and 60),
  add column can_gather       boolean,
  add column daily_commitment boolean,
  add column terms_accepted_at timestamptz;

drop function if exists public.register_candidate(text, text, text, public.gender_type, date, text, text, smallint, text, text, text, text);

create or replace function public.register_candidate(
  p_full_name text, p_national_id text, p_phone text, p_gender public.gender_type,
  p_residence text, p_halaqa_area text, p_nearest_mosque text, p_address_detail text,
  p_quran_parts smallint, p_tajweed_level text, p_experience_years smallint,
  p_can_gather boolean, p_daily_commitment boolean, p_terms_accepted boolean,
  p_birth_date date default null, p_education text default null, p_experience text default null, p_about text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.assert_session_writable();
  if (select count(*) from public.candidates where created_at > now() - interval '1 minute') >= 40 then
    raise exception 'ضغطٌ على التسجيل الآن — حاول بعد دقيقة.' using errcode = 'P0001';
  end if;
  if not coalesce(p_terms_accepted, false) then
    raise exception 'أقرّ بالشروط أوّلاً.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_residence, '')) = '' or btrim(coalesce(p_halaqa_area, '')) = ''
     or btrim(coalesce(p_nearest_mosque, '')) = '' or btrim(coalesce(p_address_detail, '')) = ''
     or p_quran_parts is null or btrim(coalesce(p_tajweed_level, '')) = '' or p_experience_years is null
     or p_can_gather is null or p_daily_commitment is null then
    raise exception 'أكمل الحقول المطلوبة.' using errcode = '22023';
  end if;
  if exists (select 1 from public.candidates where national_id = btrim(p_national_id)) then
    raise exception 'سبق التسجيلُ برقم الهوية هذا — استعلم عن حالة طلبك.' using errcode = '23505';
  end if;
  insert into public.candidates (full_name, national_id, phone, gender, residence, halaqa_area, nearest_mosque, address_detail,
                                 quran_parts, tajweed_level, experience_years, can_gather, daily_commitment, terms_accepted_at,
                                 birth_date, education, experience, about)
  values (btrim(p_full_name), btrim(p_national_id), btrim(p_phone), p_gender, btrim(p_residence), btrim(p_halaqa_area),
          btrim(p_nearest_mosque), btrim(p_address_detail), p_quran_parts, btrim(p_tajweed_level), p_experience_years,
          p_can_gather, p_daily_commitment, now(), p_birth_date,
          nullif(btrim(coalesce(p_education, '')), ''), nullif(btrim(coalesce(p_experience, '')), ''), nullif(btrim(coalesce(p_about, '')), ''));
end;
$$;
revoke all on function public.register_candidate(text, text, text, public.gender_type, text, text, text, text, smallint, text, smallint, boolean, boolean, boolean, date, text, text, text) from public;
grant execute on function public.register_candidate(text, text, text, public.gender_type, text, text, text, text, smallint, text, smallint, boolean, boolean, boolean, date, text, text, text) to anon, authenticated;

do $$
begin
  if not has_function_privilege('anon', 'public.register_candidate(text, text, text, public.gender_type, text, text, text, text, smallint, text, smallint, boolean, boolean, boolean, date, text, text, text)', 'execute') then
    raise exception 'التسجيلُ العامّ غيرُ متاحٍ للزائر';
  end if;
end $$;
