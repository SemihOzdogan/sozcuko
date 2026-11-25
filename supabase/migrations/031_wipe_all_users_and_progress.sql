-- DİKKAT: Bu migration geri döndürülemez.
-- Tüm kullanıcı hesaplarını ve kullanıcıya ait tüm oyun verilerini temizler.
-- words ve classic_puzzles içerik tabloları korunur.

begin;

-- Önce kullanıcı ilerlemesi ve oyuncu etkinliklerini temizle.
delete from public.duel_matchmaking_queue;
delete from public.duel_events;
delete from public.duel_rooms;
delete from public.league_players;

-- Supabase Auth hesaplarını ve ilişkili kimlik/oturum kayıtlarını temizle.
-- auth.users üzerindeki cascade ilişkileri Auth tarafından yönetilir.
delete from auth.users;

commit;
