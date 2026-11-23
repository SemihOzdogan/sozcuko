-- Test sırasında oluşan anonim cihaz kayıtlarını temizle.
-- Hesapla ilişkilendirilmiş player_id değerleri "-user-" içerir ve korunur.
delete from public.league_players
where player_id not like '%-user-%';
