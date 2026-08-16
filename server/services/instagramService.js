const axios = require('axios');
const metaDownloader = require('metadownloader');
const { normalizeResponse } = require('../utils/normalizer');

function validateInstagramUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('URL Instagram tidak valid.');
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  if (!(host === 'instagram.com' || host.endsWith('.instagram.com'))) {
    throw new Error('Link bukan URL Instagram yang didukung.');
  }
}

function inferInstagramType(item = {}) {
  const hint = `${item.type || ''} ${item.ext || ''} ${item.extension || ''} ${item.url || ''}`.toLowerCase();
  if (/mp4|video/.test(hint)) return 'video';
  return 'image';
}

async function fetchFromMetaDownloader(url) {
  const result = await metaDownloader(url);
  const items = Array.isArray(result?.data) ? result.data : [];
  const thumbnail = items.find((item) => item?.thumbnail)?.thumbnail || null;

  const normalized = normalizeResponse(
    'instagram',
    {
      title: result?.title || 'Instagram Content',
      thumbnail,
      medias: items.map((item) => ({
        type: inferInstagramType(item),
        quality: item.quality || item.resolution || item.label || null,
        extension: item.extension || item.ext || null,
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
  const apiUrl = `https://api.gimita.id/api/downloader/instagram?url=${encodeURIComponent(url)}`;
  const response = await axios.get(apiUrl, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    },
    timeout: 15000,
  });

  const result = response.data;
  if (!result?.success || !Array.isArray(result.data) || !result.data.length) {
    throw new Error('Gimita tidak menemukan media publik.');
  }

  const medias = result.data
    .map((item) => ({
      type: inferInstagramType(item),
      quality: item.quality || item.resolution || null,
      extension: item.ext || item.extension || null,
      url: item.url,
    }))
    .filter((item) => item.url);

  const normalized = normalizeResponse(
    'instagram',
    {
      title: result.title || 'Instagram Content',
      author: result.author || null,
      thumbnail: result.thumbnail || null,
      medias,
    },
    { provider: 'gimita-fallback' }
  );

  if (!normalized.medias.length) throw new Error('Gimita tidak menemukan link download.');
  return normalized;
}

async function fetchInstagram(url) {
  validateInstagramUrl(url);

  const failures = [];
  for (const provider of [fetchFromMetaDownloader, fetchFromGimita]) {
    try {
      const result = await provider(url);
      if (failures.length) result.warnings = failures;
      return result;
    } catch (error) {
      failures.push(error.message);
      console.warn(`[Instagram] ${provider.name} gagal: ${error.message}`);
    }
  }

  throw new Error(`Semua provider Instagram gagal. ${failures.join(' | ')}`);
}

module.exports = { fetchInstagram };
