-- Yeni başlangıç: hesaplar ve görünen adlar korunur, yalnızca lig ilerlemesi sıfırlanır.
update public.league_players
set points = 0,
    wins = 0,
    losses = 0,
    updated_at = now();
