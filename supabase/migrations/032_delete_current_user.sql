-- Kullanıcının kendi hesabını ve Sözcüko'ya bağlı verilerini kalıcı olarak siler.
-- auth.users silme işlemi güvenlik nedeniyle yalnızca authenticated kullanıcıya
-- açık olan security definer fonksiyonu üzerinden yapılır.
create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  player_suffix text;
begin
  if current_user_id is null then
    raise exception 'Oturum açmış kullanıcı bulunamadı';
  end if;

  player_suffix := '%-user-' || current_user_id::text;

  delete from public.duel_matchmaking_queue
  where player_id like player_suffix;

  delete from public.duel_rooms
  where player_one_id like player_suffix
     or player_two_id like player_suffix;

  delete from public.league_players
  where player_id like player_suffix;

  delete from auth.users
  where id = current_user_id;
end;
$$;

revoke all on function public.delete_current_user() from public;
grant execute on function public.delete_current_user() to authenticated;
