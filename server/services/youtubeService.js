const axios = require('axios');
const { normalizeResponse } = require('../utils/normalizer');

function validateYouTubeUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('URL YouTube tidak valid.');
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const allowed = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'];
  if (!allowed.includes(host)) throw new Error('Link bukan URL YouTube yang didukung.');
  return input;
}

function fromVidssave(video, sourceUrl) {
  const medias = (video.resources || [])
    .map((resource) => ({
      type: resource.type,
      quality: resource.quality || null,
      extension: resource.format || null,
      url: resource.download_url,
      sizeMB: resource.size ? +(resource.size / 1024 / 1024).toFixed(2) : null,
    }))
    .filter((item) => item.url);

  return normalizeResponse(
    'youtube',
    {
      title: video.title,
      thumbnail: video.thumbnail,
      duration: video.duration,
      medias,
    },
    { provider: 'vidssave' }
  );
}

async function fetchFromVidssave(url) {
  const body = new URLSearchParams({
    auth: '20250901majwlqo',
    domain: 'api-ak.vidssave.com',
    origin: 'cache',
    link: url,
  });

  const { data } = await axios.post(
    'https://api.vidssave.com/api/contentsite_api/media/parse',
    body.toString(),
    {
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        accept: 'application/json, text/plain, */*',
        origin: 'https://vidssave.com',
        referer: 'https://vidssave.com/',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
      },
      timeout: 15000,
    }
  );

  if (!data || data.status !== 1 || !data.data) {
    throw new Error('Vidssave mengembalikan respons kosong/tidak valid.');
  }

  const normalized = fromVidssave(data.data, url);
  if (!normalized.medias.length) throw new Error('Vidssave tidak menemukan media yang bisa diunduh.');
  return normalized;
}

async function fetchFromVidfly(url) {
  const res = await axios.get('https://api.vidfly.ai/api/media/youtube/download', {
    params: { url },
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
      'x-app-name': 'vidfly-web',
      'x-app-version': '1.0.0',
      referer: 'https://vidfly.ai/',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    },
    timeout: 15000,
  });

  const data = res.data?.data;
  if (!data || !Array.isArray(data.items)) throw new Error('Vidfly mengembalikan respons kosong/tidak valid.');

  const normalized = normalizeResponse(
    'youtube',
    {
      title: data.title,
      thumbnail: data.cover,
      duration: data.duration,
      medias: data.items.map((item) => ({
        type: item.type,
        quality: item.label || item.quality || null,
        extension: item.ext || item.extension || null,
        url: item.url,
      })),
    },
    { provider: 'vidfly-fallback' }
  );

  if (!normalized.medias.length) throw new Error('Vidfly tidak menemukan media yang bisa diunduh.');
  return normalized;
}

async function fetchYouTubeData(url) {
  validateYouTubeUrl(url);

  const failures = [];
  const providers = [fetchFromVidssave, fetchFromVidfly];

  for (const provider of providers) {
    try {
      const result = await provider(url);
      if (failures.length) result.warnings = failures;
      return result;
    } catch (error) {
      failures.push(error.message);
      console.warn(`[YouTube] ${provider.name} gagal: ${error.message}`);
    }
  }

  throw new Error(`Semua provider YouTube gagal. ${failures.join(' | ')}`);
}

module.exports = { fetchYouTubeData };
