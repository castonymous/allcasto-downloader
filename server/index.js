const express = require('express');
const cors = require('cors');
const { normalizeResponse } = require('./utils/normalizer');

const services = {
  tiktok: require('./services/tiktokService'),
  youtube: require('./services/youtubeService'),
  snapchat: require('./services/snapchatService'),
  twitter: require('./services/twitterService'),
  spotify: require('./services/spotifyService'),
  instagram: require('./services/instagramService'),
  facebook: require('./services/facebookService'),
  soundcloud: require('./services/soundcloudService'),
  linkedin: require('./services/linkedinService'),
  pinterest: require('./services/pinterestService'),
  tumblr: require('./services/tumblrService'),
  douyin: require('./services/douyinService'),
  kuaishou: require('./services/kuaishouService'),
  capcut: require('./services/capcutService'),
  dailymotion: require('./services/dailymotionService'),
  bluesky: require('./services/blueskyService'),
};

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '32kb' }));

function validateHttpUrl(value) {
  if (!value || typeof value !== 'string') throw new Error('URL wajib diisi.');
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('Format URL tidak valid.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Hanya URL HTTP/HTTPS yang didukung.');
  return value.trim();
}

function resolveServiceFunction(serviceModule) {
  if (typeof serviceModule === 'function') return serviceModule;
  if (!serviceModule || typeof serviceModule !== 'object') return null;
  const key = Object.keys(serviceModule).find((name) => typeof serviceModule[name] === 'function');
  return key ? serviceModule[key] : null;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    engine: 'Allcasto',
    version: '7.0.0',
    platforms: Object.keys(services),
  });
});

app.post('/api/:platform', async (req, res) => {
  const platform = String(req.params.platform || '').toLowerCase();
  const serviceModule = services[platform];

  if (!serviceModule) {
    return res.status(404).json({
      error: `Service '${platform}' belum tersedia di server.`,
      code: 'PLATFORM_NOT_FOUND',
    });
  }

  let url;
  try {
    url = validateHttpUrl(req.body?.url);
  } catch (error) {
    return res.status(400).json({ error: error.message, code: 'INVALID_URL' });
  }

  const serviceFunction = resolveServiceFunction(serviceModule);
  if (!serviceFunction) {
    return res.status(500).json({ error: `Service '${platform}' tidak memiliki handler.`, code: 'INVALID_SERVICE' });
  }

  const startedAt = Date.now();
  console.log(`[Allcasto] ${platform} -> ${url}`);

  try {
    const raw = await serviceFunction(url);
    const normalized = raw?.medias && raw?.platform ? raw : normalizeResponse(platform, raw);
    const strictPlatforms = new Set(['youtube', 'tiktok', 'facebook', 'instagram']);

    if (!normalized?.medias?.length && strictPlatforms.has(platform)) {
      const upstreamMessage = raw?.error || raw?.message || null;
      throw new Error(upstreamMessage || 'Provider tidak mengembalikan media yang bisa diunduh.');
    }

    // Keep unknown legacy fields for older platform services while exposing
    // the stable normalized fields whenever we can identify media links.
    const legacyFields =
      raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

    if (!normalized?.medias?.length) {
      if (raw?.success === false || raw?.status === false) {
        throw new Error(raw?.error || raw?.message || 'Provider mengembalikan status gagal.');
      }

      return res.json({
        ...legacyFields,
        platform,
        success: true,
        elapsedMs: Date.now() - startedAt,
        date: new Date().toISOString(),
      });
    }

    return res.json({
      ...legacyFields,
      ...normalized,
      success: true,
      elapsedMs: Date.now() - startedAt,
      date: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[Allcasto:${platform}] ${error.message}`);
    return res.status(502).json({
      error: 'Gagal mengekstrak media dari link tersebut.',
      details: error.message,
      code: 'EXTRACTION_FAILED',
      platform,
    });
  }
});

app.get('/', (_req, res) => {
  res.send('ALLCASTO ENGINE READY');
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`>> Allcasto API: http://localhost:${PORT}`);
  });
}

module.exports = app;
