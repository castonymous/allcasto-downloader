const axios = require('axios');
const metaDownloader = require('metadownloader');
const { normalizeResponse } = require('../utils/normalizer');

function validateFacebookUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('URL Facebook tidak valid.');
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const allowed = host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch';
  if (!allowed) throw new Error('Link bukan URL Facebook yang didukung.');
}

async function fetchFromMetaDownloader(url) {
  const result = await metaDownloader(url);
  const items = Array.isArray(result?.data) ? result.data : [];
  const thumbnail = items.find((item) => item?.thumbnail)?.thumbnail || null;

  const normalized = normalizeResponse(
    'facebook',
    {
      title: result?.title || 'Facebook Video',
      thumbnail,
      medias: items.map((item) => ({
        type: 'video',
        quality: item.quality || item.resolution || item.label || null,
        extension: item.extension || item.ext || 'mp4',
        url: item.url || item.download_url,
      })),
    },
    { provider: 'metadownloader' }
  );

  if (!result?.status || !normalized.medias.length) {
    throw new Error('metadownloader tidak menemukan media publik.');
  }
  return normalized;
}

async function fetchFromGimita(url) {
  const apiUrl = `https://api.gimita.id/api/downloader/facebook?url=${encodeURIComponent(url)}`;
  const response = await axios.get(apiUrl, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    },
    timeout: 15000,
  });

  const result = response.data;
  if (!result?.success || !result?.data) throw new Error('Gimita tidak menemukan media publik.');

  const data = result.data;
  const medias = [];
  if (Array.isArray(data.all_qualities)) {
    for (const item of data.all_qualities) {
      if (!item?.url) continue;
      medias.push({ type: 'video', quality: item.resolution || item.quality || null, extension: 'mp4', url: item.url });
    }
  }
  if (!medias.length && data.best_url) {
    medias.push({ type: 'video', quality: data.best_quality || 'Best', extension: 'mp4', url: data.best_url });
  }

  const normalized = normalizeResponse(
    'facebook',
    {
      title: data.title || 'Facebook Video',
      author: data.author || null,
      thumbnail: data.thumbnail || data.cover || null,
      medias,
    },
    { provider: 'gimita-fallback' }
  );

  if (!normalized.medias.length) throw new Error('Gimita tidak menemukan link download.');
  return normalized;
}

async function fetchFacebook(url) {
  validateFacebookUrl(url);

  const failures = [];
  for (const provider of [fetchFromMetaDownloader, fetchFromGimita]) {
    try {
      const result = await provider(url);
      if (failures.length) result.warnings = failures;
      return result;
    } catch (error) {
      failures.push(error.message);
      console.warn(`[Facebook] ${provider.name} gagal: ${error.message}`);
    }
  }

  throw new Error(`Semua provider Facebook gagal. ${failures.join(' | ')}`);
}

module.exports = { fetchFacebook };
