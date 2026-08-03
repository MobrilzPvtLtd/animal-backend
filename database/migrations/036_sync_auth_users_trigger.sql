-- Create trigger to automatically sync auth.users to public.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (auth_user_id, email, name, user_name, user_type, is_verified)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'user_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'roleName', 'Guest'),
    true
  )
  on conflict (email) do update set auth_user_id = EXCLUDED.auth_user_id;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger definition on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
