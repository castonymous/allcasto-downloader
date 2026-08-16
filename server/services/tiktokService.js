const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('qs');
const { normalizeResponse } = require('../utils/normalizer');

function validateTikTokUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('URL TikTok tidak valid.');
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  if (!(host === 'tiktok.com' || host.endsWith('.tiktok.com'))) {
    throw new Error('Link bukan URL TikTok yang didukung.');
  }
  return input;
}

function cleanCssUrl(value) {
  if (!value) return null;
  const match = String(value).match(/url\(["']?(.*?)["']?\)/i);
  return match ? match[1] : value;
}

function classify(text = '', url = '') {
  const hint = `${text} ${url}`.toLowerCase();
  if (/mp3|audio|music|sound/.test(hint)) return 'audio';
  if (/photo|image|slide|\.jpe?g|\.png|\.webp/.test(hint)) return 'image';
  return 'video';
}

async function fetchFromSsstik(videoUrl) {
  const body = qs.stringify({
    id: videoUrl,
    locale: 'en',
    tt: 'dHl6Ylg4',
  });

  const res = await axios.post('https://ssstik.io/abc?url=dl', body, {
    headers: {
      accept: '*/*',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      referer: 'https://ssstik.io/en-1',
      'hx-request': 'true',
      'hx-target': 'target',
      'hx-trigger': '_gcaptcha_pt',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  const title = $('#avatar_and_text h2').text().trim() || $('#avatarAndTextUsual h2').text().trim() || null;
  const thumbnail =
    $('.result_author').attr('src') || cleanCssUrl($('#mainpicture').css('background-image')) || null;
  const medias = [];

  $('a.download_link:not(.slide)').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const url = $(el).attr('href');
    if (!url || url === '#') return;
    medias.push({ type: classify(text, url), quality: text || null, url });
  });

  $('a.download_link.slide').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const url = $(el).attr('href');
    if (!url || url === '#') return;
    medias.push({ type: 'image', quality: text || 'Photo', url });
  });

  const normalized = normalizeResponse('tiktok', { title, thumbnail, medias }, { provider: 'ssstik' });
  if (!normalized.medias.length) throw new Error('SSSTik tidak menemukan link media.');
  return normalized;
}

async function fetchFromTikDownloader(videoUrl) {
  const res = await axios.post(
    'https://tikdownloader.io/api/ajaxSearch',
    new URLSearchParams({ q: videoUrl, lang: 'en' }),
    {
      headers: {
        accept: '*/*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        referer: 'https://tikdownloader.io/en',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      },
      timeout: 15000,
    }
  );

  if (!res.data?.data) throw new Error('TikDownloader mengembalikan respons kosong.');

  const $ = cheerio.load(res.data.data);
  const title = $('.thumbnail h3').text().trim() || null;
  const thumbnail = $('.thumbnail img').attr('src') || null;
  const medias = [];

  $('.dl-action a').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const url = $(el).attr('href');
    if (!url || url === '#') return;
    medias.push({ type: classify(text, url), quality: text || null, url });
  });

  $('.photo-list .download-box li a').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const url = $(el).attr('href');
    if (!url || url === '#') return;
    medias.push({ type: 'image', quality: text || 'Photo', url });
  });

  const normalized = normalizeResponse(
    'tiktok',
    { title, thumbnail, medias },
    { provider: 'tikdownloader-fallback' }
  );
  if (!normalized.medias.length) throw new Error('TikDownloader tidak menemukan link media.');
  return normalized;
}

async function fetchTikTokData(videoUrl) {
  validateTikTokUrl(videoUrl);

  const failures = [];
  for (const provider of [fetchFromSsstik, fetchFromTikDownloader]) {
    try {
      const result = await provider(videoUrl);
      if (failures.length) result.warnings = failures;
      return result;
    } catch (error) {
      failures.push(error.message);
      console.warn(`[TikTok] ${provider.name} gagal: ${error.message}`);
    }
  }

  throw new Error(`Semua provider TikTok gagal. ${failures.join(' | ')}`);
}

module.exports = { fetchTikTokData };
