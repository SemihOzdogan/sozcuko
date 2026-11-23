# Sözçüko Level Design Planı

Bu belge, Klasik mod seviyelerinin içerik ve zorluk üretim standardıdır. Gerçek seviye verisi Supabase’den geldiği için bu kurallar veri editöründeki seviyeler için uygulanmalıdır.

## Teach / test / twist

- **Teach:** Yeni kural veya kelime fikri tek başına gösterilir. İlk denemede hedeflenen kazanma oranı `%90+`.
- **Test:** Aynı fikir 2–4 seviye sonra normal zorlukta tekrar kullanılır.
- **Twist:** Fikir, daha önce öğrenilmiş bir fikirle birleştirilir; ilk tanıtım seviyesinde birden fazla yeni kural kullanılmaz.

## 20 seviyelik ritim

| Pozisyon | Rol | Hedef per-attempt kazanma |
| --- | --- | ---: |
| 1 | Relief / öğretici | %90–100 |
| 2–4 | Normal | %70–90 |
| 5 | Hard spike | %45–65 |
| 6 | Relief | %80–95 |
| 7–9 | Normal / test | %60–85 |
| 10 | Hard | %35–55 |
| 11–14 | Normal / twist | %55–80 |
| 15 | Relief | %75–90 |
| 16–19 | Rising normal | %45–70 |
| 20 | Hard veya bölüm sonu | %30–50 |

İki düşük kazanma oranlı seviye arka arkaya gelmemeli. Yeni mekanik, oyuncunun aynı oturumunda hemen kullanılacağı bir seviyede öğretilmeli.

## Her seviye için zorunlu metadata

```text
level, band, role, goal, featuredIdea, teachTestTwist,
boardSize, wordCount, bonusWordCount, targetWinRate,
targetSolveTimeSeconds, hintAllowed, status
```

## Ölçüm ve kabul kriterleri

- `level_started` ile seviye girişleri ölçülür.
- `word_submitted` sonucu ve kelime uzunluğu kaydedilir.
- `hint_used` oranı normal seviyelerde `%25` üstüne çıkarsa seviye incelenir.
- `level_completed` ile çözüm ve bonus kelime sayısı kaydedilir.
- İlk 48 saat ve 7 gün sonunda kazanma oranı hedefin 10 puan dışındaysa önce hamle/kelime bütçesi, sonra layout değiştirilir.
- İpucu kullanılmadan çözülemeyen seviye yayınlanmaz.

## İçerik üretim sırası

1. Fikri ve hedef kazanma oranını belirle.
2. Board yerleşimini oluştur.
3. Kelime setini ve bonus kelimeleri ekle.
4. Mobil ekranda okunabilirlik kontrolü yap.
5. En az 1.000 seed ile solver/simülasyon çalıştır.
6. İnsan cohort verisiyle kalibre et.
7. Teach/test/twist ritmine yerleştir.

