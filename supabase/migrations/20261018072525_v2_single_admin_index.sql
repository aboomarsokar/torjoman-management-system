drop trigger if exists profiles_single_admin_manager on public.profiles;
drop function if exists public.guard_single_admin_manager();

create unique index profiles_one_active_admin_manager on public.profiles (role)
  where role = 'admin_manager' and status = 'active';
