const fs = require('node:fs');
const path = require('node:path');

const normalize = value =>
  String(value ?? '')
    .trim()
    .toLocaleUpperCase('tr-TR');
const target = path.join(__dirname, '..', 'data', 'words.json');
const sources = [
  'https://sozluk.gov.tr/autocomplete.json',
  'https://raw.githubusercontent.com/msoneri/sozluk/main/public/autocomplete.json',
];

const fetchWords = async () => {
  const errors = [];
  for (const source of sources) {
    try {
      const response = await fetch(source, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const body = await response.text();
      if (body.trimStart().startsWith('<'))
        throw new Error('JSON yerine HTML döndü');
      const payload = JSON.parse(body);
      return Array.isArray(payload) ? payload : payload.words;
    } catch (error) {
      errors.push(`${source}: ${error.message}`);
    }
  }
  throw new Error(`Kelime listesi alınamadı. ${errors.join(' | ')}`);
};

fetchWords()
  .then(items => {
    const current = JSON.parse(fs.readFileSync(target, 'utf8'));
    const approved = new Map(
      current
        .filter(item => item.approved === true)
        .map(item => [item.word, item]),
    );
    const words = Array.from(
      new Set(
        items
          .map(item => normalize(typeof item === 'string' ? item : item.madde))
          .filter(word => /^[A-ZÇĞİÖŞÜÂÎÛ]{3,12}$/u.test(word)),
      ),
    ).map(
      word =>
        approved.get(word) ?? {
          word,
          source: 'tdk-autocomplete',
          approved: true,
        },
    );
    approved.forEach((item, word) => {
      if (!words.some(candidate => candidate.word === word)) words.push(item);
    });
    fs.writeFileSync(target, `${JSON.stringify(words, null, 2)}\n`);
    console.log(
      `${words.length} kelime alındı. Oyun öncesi approved alanlarını yönetici onayıyla true yapın.`,
    );
  })
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
