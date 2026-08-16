function cleanString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function inferExtension(url, item = {}) {
  const explicit = cleanString(item.extension || item.ext || item.format);
  if (explicit && explicit.length <= 8) return explicit.replace(/^\./, '').toLowerCase();

  const rawUrl = cleanString(url);
  if (!rawUrl) return null;
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
    return match ? match[1] : null;
  } catch {
    const match = rawUrl.toLowerCase().match(/\.([a-z0-9]{2,5})(?:\?|#|$)/i);
    return match ? match[1] : null;
  }
}

function inferType(item = {}, url = '') {
  const hint = [
    item.type,
    item.kind,
    item.mime,
    item.mimeType,
    item.extension,
    item.ext,
    item.format,
    item.label,
    item.text,
    item.quality,
    url,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\b(mp3|m4a|aac|wav|ogg|opus|audio|music)\b/.test(hint)) return 'audio';
  if (/\b(jpe?g|png|webp|gif|image|photo|picture|slide)\b/.test(hint)) return 'image';
  return 'video';
}

function normalizeMedia(item, forcedType = null) {
  if (!item) return null;
  if (typeof item === 'string') item = { url: item };
  if (typeof item !== 'object') return null;

  const url = cleanString(
    item.url ||
      item.download_url ||
      item.downloadUrl ||
      item.download ||
      item.link ||
      item.href ||
      item.src ||
      item.video_url ||
      item.videoUrl ||
      item.audio_url ||
      item.audioUrl
  );

  if (!url || !/^https?:\/\//i.test(url)) return null;

  const extension = inferExtension(url, item);
  const type = forcedType || inferType(item, url);
  const quality = cleanString(item.quality || item.resolution || item.label || item.text);
  const sizeMB = Number.isFinite(Number(item.sizeMB)) ? Number(item.sizeMB) : null;

  return {
    type,
    quality,
    extension,
    url,
    sizeMB,
  };
}

function pushList(target, list, forcedType = null) {
  if (!Array.isArray(list)) return;
  for (const item of list) {
    const media = normalizeMedia(item, forcedType);
    if (media) target.push(media);
  }
}

function dedupeMedia(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function extractNestedPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;

  // Common wrappers used by several third-party downloader APIs.
  if (data.success === true && data.data && typeof data.data === 'object') return data.data;
  if (data.status === true && data.data && typeof data.data === 'object') return data.data;

  return data;
}

function normalizeResponse(platform, raw, meta = {}) {
  const original = raw;
  const data = extractNestedPayload(raw);
  const medias = [];

  if (Array.isArray(data)) {
    pushList(medias, data);
  } else if (data && typeof data === 'object') {
    pushList(medias, data.medias);
    pushList(medias, data.formats);
    pushList(medias, data.downloads);
    pushList(medias, data.videoLinks);
    pushList(medias, data.downloadLinks);
    pushList(medias, data.resources);
    pushList(medias, data.videos, 'video');
    pushList(medias, data.audios, 'audio');

    // Some APIs wrap another useful payload one level deeper.
    if (data.data && typeof data.data === 'object' && data.data !== data) {
      const nested = normalizeResponse(platform, data.data, meta);
      if (Array.isArray(nested.medias)) medias.push(...nested.medias);
    }

    const directCandidates = [
      ['video', data.videoUrl],
      ['video', data.video_url],
      ['video', data.downloadLink],
      ['video', data.download_url],
      ['video', data.download],
      ['video', data.video],
      ['audio', data.audioUrl],
      ['audio', data.audio_url],
    ];

    for (const [type, url] of directCandidates) {
      const media = normalizeMedia({ url }, type);
      if (media) medias.push(media);
    }
  }

  const normalizedMedias = dedupeMedia(medias);
  const base = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const originalBase = original && typeof original === 'object' && !Array.isArray(original) ? original : {};

  const profile = base.profile && typeof base.profile === 'object' ? base.profile : {};
  const title = cleanString(
    meta.title || base.title || base.caption || base.name || originalBase.title || `${platform} media`
  );
  const author = cleanString(
    meta.author || base.author || base.username || base.uploader || profile.name || originalBase.author
  );
  const thumbnail = cleanString(
    meta.thumbnail ||
      base.thumbnail ||
      base.cover ||
      base.poster ||
      base.image ||
      originalBase.thumbnail ||
      normalizedMedias.find((item) => item.type === 'image')?.url
  );

  return {
    success: normalizedMedias.length > 0,
    platform,
    title,
    author,
    thumbnail,
    duration: base.duration || originalBase.duration || null,
    medias: normalizedMedias,
    provider: meta.provider || base.provider || originalBase.provider || null,
    warnings: meta.warnings || base.warnings || originalBase.warnings || [],
  };
}

module.exports = {
  normalizeMedia,
  normalizeResponse,
};
