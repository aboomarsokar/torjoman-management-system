-- ============================================================================
-- دور المختبِر (ROADMAP #32) — التصميم: docs/superpowers/specs/2026-10-15-examiner-role-design.md
-- المختبِر وحده يرصد نتائج الاختبار لحلقاته المُسنَدة؛ المشرف يبقى قارئاً.
-- ============================================================================

-- 1) إسناد المختبِر لكل حلقة (+ من أسنده ومتى — مبدأ «كل تعيين يُسجَّل»)
alter table public.halaqat
  add column examiner_id          uuid references public.profiles(id) on delete set null,
  add column examiner_assigned_by uuid references public.profiles(id) on delete set null,
  add column examiner_assigned_at timestamptz;

create index idx_halaqat_examiner             on public.halaqat (examiner_id);
create index idx_halaqat_examiner_assigned_by on public.halaqat (examiner_assigned_by);

-- المُسنَد لا بدّ أن يكون مختبِراً، ويُختَم الإسناد بصاحبه ووقته عند كل تغيير
create or replace function public.stamp_halaqa_examiner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.examiner_id is not null)
     or (tg_op = 'UPDATE' and new.examiner_id is distinct from old.examiner_id) then
    if new.examiner_id is not null and not exists (
      select 1 from public.profiles where id = new.examiner_id and role = 'examiner'
    ) then
      raise exception 'المُسنَد ليس مختبِراً' using errcode = '23514';
    end if;
    new.examiner_assigned_by := auth.uid();
    new.examiner_assigned_at := case when new.examiner_id is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger halaqat_stamp_examiner
  before insert or update of examiner_id on public.halaqat
  for each row execute function public.stamp_halaqa_examiner();

-- 2) هل المستخدم الحالي مختبِرُ هذه الحلقة؟ — منفصلة عن can_access_halaqa عمداً
--    كي لا يرث المختبِر الزيارات والتقارير الشهرية وبقيّة نطاق الحلقة.
create or replace function public.is_halaqa_examiner(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.halaqat h where h.id = hid and h.examiner_id = auth.uid());
$$;

revoke all on function public.is_halaqa_examiner(uuid) from public;
grant execute on function public.is_halaqa_examiner(uuid) to authenticated;

-- 3) القراءة: المختبِر يرى حلقاته وطلابها وقوائمها ونتائجها
drop policy halaqat_select on public.halaqat;
create policy halaqat_select on public.halaqat for select to authenticated
  using (public.can_access_halaqa(id) or public.is_halaqa_examiner(id));

drop policy students_select on public.students;
create policy students_select on public.students for select to authenticated
  using ((select public.is_manager()) or public.can_access_halaqa(halaqa_id) or public.is_halaqa_examiner(halaqa_id));

drop policy lists_select on public.exam_lists;
create policy lists_select on public.exam_lists for select to authenticated
  using ((select public.is_manager()) or public.can_access_halaqa(halaqa_id) or public.is_halaqa_examiner(halaqa_id));

drop policy items_select on public.exam_list_items;
create policy items_select on public.exam_list_items for select to authenticated
  using (exists (select 1 from public.exam_lists l
                 where l.id = exam_list_id
                   and ((select public.is_manager()) or public.can_access_halaqa(l.halaqa_id) or public.is_halaqa_examiner(l.halaqa_id))));

drop policy results_select on public.exam_results;
create policy results_select on public.exam_results for select to authenticated
  using (exists (select 1 from public.students s
                 where s.id = student_id
                   and ((select public.is_manager()) or public.can_access_halaqa(s.halaqa_id) or public.is_halaqa_examiner(s.halaqa_id))));

-- 4) الرصد: المدير، أو المختبِر المُسنَد باسمه — المشرف يخرج منه
drop policy results_insert on public.exam_results;
create policy results_insert on public.exam_results for insert to authenticated
  with check (
    (select public.is_manager())
    or ((select public.current_user_role()) = 'examiner'
        and examiner_id = (select auth.uid())
        and exists (select 1 from public.students s where s.id = student_id and public.is_halaqa_examiner(s.halaqa_id)))
  );

drop policy results_update on public.exam_results;
create policy results_update on public.exam_results for update to authenticated
  using ((select public.is_manager()) or ((select public.current_user_role()) = 'examiner' and examiner_id = (select auth.uid())))
  with check ((select public.is_manager()) or ((select public.current_user_role()) = 'examiner' and examiner_id = (select auth.uid())));

drop policy results_delete on public.exam_results;
create policy results_delete on public.exam_results for delete to authenticated
  using ((select public.is_manager()));

-- 5) الاجتياز يرفع «الأجزاء المثبتة» إلى نهاية نطاق المحطة (لا يُنقِصها) —
--    كان يُحدَّث من المتصفّح في GradeModal، فصار هنا كي لا يحتاج الراصدُ صلاحيةَ تعديل الطلاب.
create or replace function public.bump_parts_on_pass()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_parts_to int;
begin
  if new.passed and new.exam_list_item_id is not null then
    select p.parts_to into v_parts_to
    from public.exam_list_items i join public.exam_plan p on p.id = i.exam_plan_id
    where i.id = new.exam_list_item_id;
    if v_parts_to is not null then
      update public.students
         set quran_parts = v_parts_to
       where id = new.student_id and coalesce(quran_parts, 0) < v_parts_to;
    end if;
  end if;
  return new;
end;
$$;

create trigger exam_results_bump_parts
  after insert on public.exam_results
  for each row execute function public.bump_parts_on_pass();
