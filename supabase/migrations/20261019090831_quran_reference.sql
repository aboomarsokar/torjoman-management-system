-- مراجعُ المصحف (الجزء ٢ من الدفعة الثانية، 2026-10-19). منقولةٌ من الصحابة:
-- السور من base_slice_schema، وفهرسُ الصفحات من quran_mushaf_index (Tanzil.net، مصحف المدينة 604 صفحات).
-- وتقسيمةُ أجزاء البرنامج من صورة المستخدم: على حدود السور، مرقّمةٌ بترتيب الحفظ من الناس (30) إلى البقرة والفاتحة (1).

create table public.surahs (
  number smallint primary key check (number between 1 and 114),
  name text not null unique,
  ayah_count smallint not null check (ayah_count > 0)
);

create table public.quran_pages (
  page smallint primary key check (page between 1 and 604),
  surah smallint not null references public.surahs (number),
  ayah smallint not null check (ayah > 0),
  unique (surah, ayah)
);
comment on table public.quran_pages is 'أوّلُ آيةٍ في كلّ صفحة من مصحف المدينة (604). الصفحةُ لموضعٍ = آخرُ صفحةٍ بدايتُها ≤ الموضع.';

create table public.program_juz (
  number smallint primary key check (number between 1 and 30),
  start_surah smallint not null references public.surahs (number),
  start_ayah smallint not null check (start_ayah > 0),
  end_surah smallint not null references public.surahs (number),
  end_ayah smallint not null check (end_ayah > 0)
);
comment on table public.program_juz is 'أجزاءُ البرنامج: على حدود السور، مرقّمةٌ بترتيب الحفظ (30 = الناس…النبأ، 1 = البقرة 253 ← الفاتحة).';

insert into public.surahs (number, name, ayah_count) values
  (1, 'الفاتحة', 7), (2, 'البقرة', 286), (3, 'آل عمران', 200), (4, 'النساء', 176),
  (5, 'المائدة', 120), (6, 'الأنعام', 165), (7, 'الأعراف', 206), (8, 'الأنفال', 75),
  (9, 'التوبة', 129), (10, 'يونس', 109), (11, 'هود', 123), (12, 'يوسف', 111),
  (13, 'الرعد', 43), (14, 'إبراهيم', 52), (15, 'الحجر', 99), (16, 'النحل', 128),
  (17, 'الإسراء', 111), (18, 'الكهف', 110), (19, 'مريم', 98), (20, 'طه', 135),
  (21, 'الأنبياء', 112), (22, 'الحج', 78), (23, 'المؤمنون', 118), (24, 'النور', 64),
  (25, 'الفرقان', 77), (26, 'الشعراء', 227), (27, 'النمل', 93), (28, 'القصص', 88),
  (29, 'العنكبوت', 69), (30, 'الروم', 60), (31, 'لقمان', 34), (32, 'السجدة', 30),
  (33, 'الأحزاب', 73), (34, 'سبأ', 54), (35, 'فاطر', 45), (36, 'يس', 83),
  (37, 'الصافات', 182), (38, 'ص', 88), (39, 'الزمر', 75), (40, 'غافر', 85),
  (41, 'فصلت', 54), (42, 'الشورى', 53), (43, 'الزخرف', 89), (44, 'الدخان', 59),
  (45, 'الجاثية', 37), (46, 'الأحقاف', 35), (47, 'محمد', 38), (48, 'الفتح', 29),
  (49, 'الحجرات', 18), (50, 'ق', 45), (51, 'الذاريات', 60), (52, 'الطور', 49),
  (53, 'النجم', 62), (54, 'القمر', 55), (55, 'الرحمن', 78), (56, 'الواقعة', 96),
  (57, 'الحديد', 29), (58, 'المجادلة', 22), (59, 'الحشر', 24), (60, 'الممتحنة', 13),
  (61, 'الصف', 14), (62, 'الجمعة', 11), (63, 'المنافقون', 11), (64, 'التغابن', 18),
  (65, 'الطلاق', 12), (66, 'التحريم', 12), (67, 'الملك', 30), (68, 'القلم', 52),
  (69, 'الحاقة', 52), (70, 'المعارج', 44), (71, 'نوح', 28), (72, 'الجن', 28),
  (73, 'المزمل', 20), (74, 'المدثر', 56), (75, 'القيامة', 40), (76, 'الإنسان', 31),
  (77, 'المرسلات', 50), (78, 'النبأ', 40), (79, 'النازعات', 46), (80, 'عبس', 42),
  (81, 'التكوير', 29), (82, 'الانفطار', 19), (83, 'المطففين', 36), (84, 'الانشقاق', 25),
  (85, 'البروج', 22), (86, 'الطارق', 17), (87, 'الأعلى', 19), (88, 'الغاشية', 26),
  (89, 'الفجر', 30), (90, 'البلد', 20), (91, 'الشمس', 15), (92, 'الليل', 21),
  (93, 'الضحى', 11), (94, 'الشرح', 8), (95, 'التين', 8), (96, 'العلق', 19),
  (97, 'القدر', 5), (98, 'البينة', 8), (99, 'الزلزلة', 8), (100, 'العاديات', 11),
  (101, 'القارعة', 11), (102, 'التكاثر', 8), (103, 'العصر', 3), (104, 'الهمزة', 9),
  (105, 'الفيل', 5), (106, 'قريش', 4), (107, 'الماعون', 7), (108, 'الكوثر', 3),
  (109, 'الكافرون', 6), (110, 'النصر', 3), (111, 'المسد', 5), (112, 'الإخلاص', 4),
  (113, 'الفلق', 5), (114, 'الناس', 6);

insert into public.quran_pages (page, surah, ayah)
select row_number() over (order by ord)::smallint,
       split_part(pair, ',', 1)::smallint,
       split_part(pair, ',', 2)::smallint
from unnest(string_to_array('1,1;2,1;2,6;2,17;2,25;2,30;2,38;2,49;2,58;2,62;2,70;2,77;2,84;2,89;2,94;2,102;2,106;2,113;2,120;2,127;2,135;2,142;2,146;2,154;2,164;2,170;2,177;2,182;2,187;2,191;2,197;2,203;2,211;2,216;2,220;2,225;2,231;2,234;2,238;2,246;2,249;2,253;2,257;2,260;2,265;2,270;2,275;2,282;2,283;3,1;3,10;3,16;3,23;3,30;3,38;3,46;3,53;3,62;3,71;3,78;3,84;3,92;3,101;3,109;3,116;3,122;3,133;3,141;3,149;3,154;3,158;3,166;3,174;3,181;3,187;3,195;4,1;4,7;4,12;4,15;4,20;4,24;4,27;4,34;4,38;4,45;4,52;4,60;4,66;4,75;4,80;4,87;4,92;4,95;4,102;4,106;4,114;4,122;4,128;4,135;4,141;4,148;4,155;4,163;4,171;4,176;5,3;5,6;5,10;5,14;5,18;5,24;5,32;5,37;5,42;5,46;5,51;5,58;5,65;5,71;5,77;5,83;5,90;5,96;5,104;5,109;5,114;6,1;6,9;6,19;6,28;6,36;6,45;6,53;6,60;6,69;6,74;6,82;6,91;6,95;6,102;6,111;6,119;6,125;6,132;6,138;6,143;6,147;6,152;6,158;7,1;7,12;7,23;7,31;7,38;7,44;7,52;7,58;7,68;7,74;7,82;7,88;7,96;7,105;7,121;7,131;7,138;7,144;7,150;7,156;7,160;7,164;7,171;7,179;7,188;7,196;8,1;8,9;8,17;8,26;8,34;8,41;8,46;8,53;8,62;8,70;9,1;9,7;9,14;9,21;9,27;9,32;9,37;9,41;9,48;9,55;9,62;9,69;9,73;9,80;9,87;9,94;9,100;9,107;9,112;9,118;9,123;10,1;10,7;10,15;10,21;10,26;10,34;10,43;10,54;10,62;10,71;10,79;10,89;10,98;10,107;11,6;11,13;11,20;11,29;11,38;11,46;11,54;11,63;11,72;11,82;11,89;11,98;11,109;11,118;12,5;12,15;12,23;12,31;12,38;12,44;12,53;12,64;12,70;12,79;12,87;12,96;12,104;13,1;13,6;13,14;13,19;13,29;13,35;13,43;14,6;14,11;14,19;14,25;14,34;14,43;15,1;15,16;15,32;15,52;15,71;15,91;16,7;16,15;16,27;16,35;16,43;16,55;16,65;16,73;16,80;16,88;16,94;16,103;16,111;16,119;17,1;17,8;17,18;17,28;17,39;17,50;17,59;17,67;17,76;17,87;17,97;17,105;18,5;18,16;18,21;18,28;18,35;18,46;18,54;18,62;18,75;18,84;18,98;19,1;19,12;19,26;19,39;19,52;19,65;19,77;19,96;20,13;20,38;20,52;20,65;20,77;20,88;20,99;20,114;20,126;21,1;21,11;21,25;21,36;21,45;21,58;21,73;21,82;21,91;21,102;22,1;22,6;22,16;22,24;22,31;22,39;22,47;22,56;22,65;22,73;23,1;23,18;23,28;23,43;23,60;23,75;23,90;23,105;24,1;24,11;24,21;24,28;24,32;24,37;24,44;24,54;24,59;24,62;25,3;25,12;25,21;25,33;25,44;25,56;25,68;26,1;26,20;26,40;26,61;26,84;26,112;26,137;26,160;26,184;26,207;27,1;27,14;27,23;27,36;27,45;27,56;27,64;27,77;27,89;28,6;28,14;28,22;28,29;28,36;28,44;28,51;28,60;28,71;28,78;28,85;29,7;29,15;29,24;29,31;29,39;29,46;29,53;29,64;30,6;30,16;30,25;30,33;30,42;30,51;31,1;31,12;31,20;31,29;32,1;32,12;32,21;33,1;33,7;33,16;33,23;33,31;33,36;33,44;33,51;33,55;33,63;34,1;34,8;34,15;34,23;34,32;34,40;34,49;35,4;35,12;35,19;35,31;35,39;35,45;36,13;36,28;36,41;36,55;36,71;37,1;37,25;37,52;37,77;37,103;37,127;37,154;38,1;38,17;38,27;38,43;38,62;38,84;39,6;39,11;39,22;39,32;39,41;39,48;39,57;39,68;39,75;40,8;40,17;40,26;40,34;40,41;40,50;40,59;40,67;40,78;41,1;41,12;41,21;41,30;41,39;41,47;42,1;42,11;42,16;42,23;42,32;42,45;42,52;43,11;43,23;43,34;43,48;43,61;43,74;44,1;44,19;44,40;45,1;45,14;45,23;45,33;46,6;46,15;46,21;46,29;47,1;47,12;47,20;47,30;48,1;48,10;48,16;48,24;48,29;49,5;49,12;50,1;50,16;50,36;51,7;51,31;51,52;52,15;52,32;53,1;53,27;53,45;54,7;54,28;54,50;55,17;55,41;55,68;56,17;56,51;56,77;57,4;57,12;57,19;57,25;58,1;58,7;58,12;58,22;59,4;59,10;59,17;60,1;60,6;60,12;61,6;62,1;62,9;63,5;64,1;64,10;65,1;65,6;66,1;66,8;67,1;67,13;67,27;68,16;68,43;69,9;69,35;70,11;70,40;71,11;72,1;72,14;73,1;73,20;74,18;74,48;75,20;76,6;76,26;77,20;78,1;78,31;79,16;80,1;81,1;82,1;83,7;83,35;85,1;86,1;87,16;89,1;89,24;91,1;92,15;95,1;97,1;98,8;100,10;103,1;106,1;109,1;112,1', ';')) with ordinality as t(pair, ord);

insert into public.program_juz (number, start_surah, start_ayah, end_surah, end_ayah) values
  (30,114,1,78,40),(29,77,1,67,30),(28,66,1,58,22),(27,57,1,51,60),(26,50,1,46,35),
  (25,45,1,42,53),(24,41,1,39,75),(23,38,1,36,83),(22,35,1,33,73),(21,32,1,29,69),
  (20,28,1,27,93),(19,26,1,25,77),(18,24,1,23,118),(17,22,1,21,112),(16,20,1,19,98),
  (15,18,1,17,111),(14,16,1,15,99),(13,14,1,12,111),(12,11,1,11,123),(11,10,1,10,109),
  (10,9,1,9,129),(9,8,1,8,75),(8,7,1,7,206),(7,6,1,6,165),(6,5,1,5,120),
  (5,4,1,4,176),(4,3,1,3,200),(3,2,1,2,141),(2,2,142,2,252),(1,2,253,1,7);

create or replace function public.quran_page_of(p_surah smallint, p_ayah smallint)
returns smallint language sql stable security definer set search_path = '' as $$
  select p.page from public.quran_pages p
   where (p.surah, p.ayah) <= (p_surah, p_ayah)
   order by p.page desc limit 1;
$$;

alter table public.surahs enable row level security;
alter table public.quran_pages enable row level security;
alter table public.program_juz enable row level security;
revoke all on public.surahs, public.quran_pages, public.program_juz from public, anon, authenticated;
grant select on public.surahs, public.quran_pages, public.program_juz to authenticated;
create policy surahs_read on public.surahs for select to authenticated using (true);
create policy quran_pages_read on public.quran_pages for select to authenticated using (true);
create policy program_juz_read on public.program_juz for select to authenticated using (true);
revoke all on function public.quran_page_of(smallint, smallint) from public, anon;
grant execute on function public.quran_page_of(smallint, smallint) to authenticated;

-- الفحصُ الذاتيّ: يرفع استثناءً عند أيّ خلل فتُلغى الهجرة كلّها.
do $$
declare
  v_bad int;
begin
  if (select count(*) from public.surahs) <> 114 then raise exception 'surahs: العدد ليس 114'; end if;
  if (select sum(ayah_count) from public.surahs) <> 6236 then raise exception 'surahs: مجموع الآيات ليس 6236'; end if;
  if (select count(*) from public.quran_pages) <> 604 then raise exception 'quran_pages: العدد ليس 604'; end if;
  if (select count(*) from public.program_juz) <> 30 then raise exception 'program_juz: العدد ليس 30'; end if;

  if public.quran_page_of(1::smallint, 1::smallint) <> 1 then raise exception 'quran_page_of(1,1) <> 1'; end if;
  if public.quran_page_of(2::smallint, 1::smallint) <> 2 then raise exception 'quran_page_of(2,1) <> 2'; end if;
  if public.quran_page_of(114::smallint, 6::smallint) <> 604 then raise exception 'quran_page_of(114,6) <> 604'; end if;

  -- الصفحاتُ تصاعديةٌ صارمة بـ(surah, ayah)
  select count(*) into v_bad from (
    select (surah, ayah) <= lag((surah, ayah)) over (order by page) as not_asc
      from public.quran_pages
  ) t where not_asc;
  if v_bad > 0 then raise exception 'quran_pages: % صفحة لا تصعد بالترتيب', v_bad; end if;

  -- لا بدايةَ صفحةٍ تتجاوز عددَ آيات سورتها
  select count(*) into v_bad from public.quran_pages p
    join public.surahs s on s.number = p.surah where p.ayah > s.ayah_count;
  if v_bad > 0 then raise exception 'quran_pages: % بدايةُ صفحةٍ تتجاوز آيات سورتها', v_bad; end if;

  -- اتّصالُ أجزاء البرنامج بترتيب الحفظ
  if not exists (select 1 from public.program_juz where number = 30 and start_surah = 114 and start_ayah = 1) then
    raise exception 'program_juz: الجزء 30 لا يبدأ بـ(114,1)';
  end if;
  if not exists (select 1 from public.program_juz where number = 1 and end_surah = 1 and end_ayah = 7) then
    raise exception 'program_juz: الجزء 1 لا ينتهي بـ(1,7)';
  end if;

  select count(*) into v_bad from public.program_juz j
    join public.surahs se on se.number = j.end_surah
    join public.program_juz nx on nx.number = j.number - 1
   where j.number between 2 and 30
     and (nx.start_surah::int <> (case when j.end_ayah < se.ayah_count then j.end_surah else j.end_surah - 1 end)
          or nx.start_ayah::int <> (case when j.end_ayah < se.ayah_count then j.end_ayah + 1 else 1 end));
  if v_bad > 0 then raise exception 'program_juz: % جزءٌ لا يتّصل بما بعده', v_bad; end if;

  select count(*) into v_bad from public.program_juz j
    join public.surahs se on se.number = j.end_surah
    join public.surahs ss on ss.number = j.start_surah
   where j.end_ayah > se.ayah_count or j.start_ayah > ss.ayah_count;
  if v_bad > 0 then raise exception 'program_juz: % جزءٌ تتجاوز حدودُه آيات السورة', v_bad; end if;

  -- في كلّ جزءٍ البدايةُ تسبق النهايةَ (أو تساويها) بترتيب الحفظ: السورة تنازلياً والآية تصاعدياً
  select count(*) into v_bad from public.program_juz j
   where not (j.start_surah > j.end_surah or (j.start_surah = j.end_surah and j.start_ayah <= j.end_ayah));
  if v_bad > 0 then raise exception 'program_juz: % جزءٌ بدايتُه بعد نهايته', v_bad; end if;

  -- المنوح: authenticated يقرأ ولا يكتب، وanon لا يقرأ
  if not (has_table_privilege('authenticated', 'public.surahs', 'select')
      and has_table_privilege('authenticated', 'public.quran_pages', 'select')
      and has_table_privilege('authenticated', 'public.program_juz', 'select')) then
    raise exception 'authenticated لا يقرأ أحد الجداول';
  end if;
  if has_table_privilege('authenticated', 'public.surahs', 'insert,update,delete')
     or has_table_privilege('authenticated', 'public.quran_pages', 'insert,update,delete')
     or has_table_privilege('authenticated', 'public.program_juz', 'insert,update,delete') then
    raise exception 'authenticated يملك كتابةً على جداول المصحف';
  end if;
  if has_table_privilege('anon', 'public.surahs', 'select')
     or has_table_privilege('anon', 'public.quran_pages', 'select')
     or has_table_privilege('anon', 'public.program_juz', 'select') then
    raise exception 'anon يقرأ جداول المصحف';
  end if;
  if has_function_privilege('anon', 'public.quran_page_of(smallint,smallint)', 'execute') then
    raise exception 'anon ينفّذ quran_page_of';
  end if;
  if not has_function_privilege('authenticated', 'public.quran_page_of(smallint,smallint)', 'execute') then
    raise exception 'authenticated لا ينفّذ quran_page_of';
  end if;
end $$;
