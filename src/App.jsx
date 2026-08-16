import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Music, Instagram, Youtube, Ghost, Twitter, Terminal, 
  Facebook, Linkedin, Cloud, Video, Mic2, Image, Radio, 
  Layers, Hash, Scissors, Clipboard, CheckCircle, Loader2, FileVideo, 
  FileAudio, Clock, Trash2, Activity, ImageIcon, 
  AlertTriangle, X, Zap, Users, BarChart3
} from 'lucide-react';
import axios from 'axios';

// --- DATABASE PLATFORM ---
const platforms = [
  { id: 'tiktok', name: 'TikTok', icon: <Music />, color: '#ff0050' },
  { id: 'instagram', name: 'Instagram', icon: <Instagram />, color: '#E1306C' },
  { id: 'youtube', name: 'YouTube', icon: <Youtube />, color: '#FF0000' },
  { id: 'snapchat', name: 'Snapchat', icon: <Ghost />, color: '#FFFC00' },
  { id: 'twitter', name: 'Twitter/X', icon: <Twitter />, color: '#1DA1F2' },
  { id: 'facebook', name: 'Facebook', icon: <Facebook />, color: '#1877F2' },
  { id: 'spotify', name: 'Spotify', icon: <Radio />, color: '#1DB954' },
  { id: 'soundcloud', name: 'SoundCloud', icon: <Mic2 />, color: '#FF5500' },
  { id: 'linkedin', name: 'LinkedIn', icon: <Linkedin />, color: '#0077B5' },
  { id: 'pinterest', name: 'Pinterest', icon: <Image />, color: '#BD081C' },
  { id: 'tumblr', name: 'Tumblr', icon: <Layers />, color: '#36465D' },
  { id: 'douyin', name: 'Douyin', icon: <Music />, color: '#ffffff' }, 
  { id: 'kuaishou', name: 'Kuaishou', icon: <Video />, color: '#FF7F24' },
  { id: 'capcut', name: 'CapCut', icon: <Scissors />, color: '#ffffff' },
  { id: 'dailymotion', name: 'Dailymotion', icon: <Video />, color: '#0066DC' },
  { id: 'bluesky', name: 'Bluesky', icon: <Cloud />, color: '#0085FF' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.03 } }
};

const itemVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

const loadingLogs = [
  "Handshake initialized...",
  "Requesting content data...",
  "Resolving media provider...",
  "Parsing media stream...",
  "Finalizing extraction..."
];

const INITIAL_VISITORS = 14205;
const INITIAL_LINKS = 45902;

export default function App() {
  const [selected, setSelected] = useState(null);
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [logIndex, setLogIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [notification, setNotification] = useState(null);
  const [stats, setStats] = useState({ visitors: INITIAL_VISITORS, links: INITIAL_LINKS });

  const activeColor = selected ? platforms.find(p => p.id === selected).color : '#00f2ff';
  const activeName = selected ? platforms.find(p => p.id === selected).name : 'Universal';

  // --- REWRITE API ENDPOINT ---
  // Gunakan relative path agar otomatis ikut domain Vercel (Backend Serverless)
  const endpoint = selected ? `/api/${selected}` : '';

  useEffect(() => {
    let interval;
    if (isLoading) {
      setLogIndex(0);
      interval = setInterval(() => {
        setLogIndex((prev) => (prev < loadingLogs.length - 1 ? prev + 1 : prev));
      }, 800);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        visitors: prev.visitors + Math.floor(Math.random() * 3)
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const showNotify = (message, type = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000); // 5 Detik biar sempat baca
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch (err) {
      showNotify("Clipboard access denied", "error");
    }
  };

  const addToHistory = (data) => {
    setHistory(prev => [data, ...prev].slice(0, 3));
  };

  const clearHistory = () => setHistory([]);

  // --- NORMALIZED MEDIA PARSER ---
  const getMediaItems = () => {
    if (!result) return [];

    if (Array.isArray(result)) return result.filter(item => item?.url);

    const combined = [
      ...(Array.isArray(result.medias) ? result.medias : []),
      ...(Array.isArray(result.formats) ? result.formats : []),
      ...(Array.isArray(result.downloads) ? result.downloads : []),
      ...(Array.isArray(result.videoLinks) ? result.videoLinks : []),
      ...(Array.isArray(result.downloadLinks) ? result.downloadLinks : []),
      ...(Array.isArray(result.videos) ? result.videos.map(item => ({ ...item, type: item.type || 'video' })) : []),
      ...(Array.isArray(result.audios) ? result.audios.map(item => ({ ...item, type: item.type || 'audio' })) : []),
    ];

    const seen = new Set();
    return combined.filter(item => {
      if (!item?.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  };

  const mediaType = (item) => {
    const hint = String(
      item?.type || item?.extension || item?.ext || item?.format || item?.label || item?.text || item?.url || ''
    ).toLowerCase();
    if (/mp3|m4a|aac|wav|ogg|opus|audio|music/.test(hint)) return 'audio';
    if (/jpg|jpeg|png|webp|gif|image|photo|slide/.test(hint)) return 'image';
    return 'video';
  };

  const mediaScore = (item) => {
    const quality = String(item?.quality || item?.label || item?.text || '');
    const resolution = quality.match(/(\d{3,4})p/i);
    if (resolution) return Number(resolution[1]);
    if (/4k|2160/i.test(quality)) return 2160;
    if (/2k|1440/i.test(quality)) return 1440;
    if (/hd|best|high/i.test(quality)) return 900;
    return 0;
  };

  const getDownloadLink = (type) => {
    const items = getMediaItems();
    if (!items.length) {
      if (type === 'video') return result?.videoUrl || result?.downloadLink || result?.download || result?.video || null;
      if (type === 'audio') return result?.audioUrl || result?.audio_url || null;
      return null;
    }

    let candidates = items.filter(item => mediaType(item) === type);

    // Photo posts on Instagram/Pinterest still use the primary download button.
    if (type === 'video' && !candidates.length && ['instagram', 'pinterest'].includes(selected)) {
      candidates = items.filter(item => mediaType(item) === 'image');
    }

    candidates.sort((a, b) => mediaScore(b) - mediaScore(a));
    return candidates[0]?.url || null;
  };

  const getButtonConfig = () => {
    const videoLink = getDownloadLink('video');
    const isImage = videoLink && (String(videoLink).includes('.jpg') || String(videoLink).includes('.webp') || String(videoLink).includes('.png'));

    switch (selected) {
        case 'pinterest': return { label: 'DOWNLOAD IMAGE', icon: <ImageIcon size={14} />, noData: 'NO IMAGE' };
        case 'spotify': return { label: 'DOWNLOAD TRACK', icon: <Music size={14} />, noData: 'NO TRACK' };
        case 'soundcloud': return { label: 'DOWNLOAD TRACK', icon: <Music size={14} />, noData: 'NO TRACK' };
        case 'instagram': 
            return { 
                label: isImage ? 'DOWNLOAD IMAGE' : 'DOWNLOAD REEL', 
                icon: isImage ? <ImageIcon size={14} /> : <Instagram size={14} />, 
                noData: 'NO POST' 
            };
        default: return { label: 'DOWNLOAD VIDEO', icon: <FileVideo size={14} />, noData: 'NO VIDEO' };
    }
  };

  const btnConfig = getButtonConfig();
  const isAudioPlatform = ['spotify', 'soundcloud'].includes(selected);
  const primaryLink = isAudioPlatform ? getDownloadLink('audio') : getDownloadLink('video');
  const showAudioButton = !isAudioPlatform && !['instagram', 'pinterest'].includes(selected);

  const handleExtract = async () => {
    if (!url) return showNotify("Please insert URL first!", "error");
    if (!selected) return showNotify("Please select a platform first!", "error");

    setIsLoading(true);
    setResult(null);

    try {
      const response = await axios.post(endpoint, { url: url });
      setResult(response.data);
      addToHistory(response.data);
      setStats(prev => ({ ...prev, links: prev.links + 1 }));
    } catch (error) {
      console.error("Extraction Error:", error);
      
      // --- SMART ERROR PARSING (V.6.1) ---
      let msg = "Gagal menghubungi Server.";
      
      if (error.response && error.response.data) {
          const data = error.response.data;
          // Cek berbagai kemungkinan format error backend
          msg = data.message || data.error || data.details || JSON.stringify(data);
          
          // Jika msg masih berupa object (misal: {status: 'error', ...}), paksa jadi string
          if (typeof msg === 'object') {
              msg = JSON.stringify(msg);
          }
      } else if (error.message) {
          msg = error.message;
      }
      
      showNotify(`ERROR: ${msg.substring(0, 100)}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 flex flex-col items-center justify-center overflow-x-hidden relative bg-[#050505]">
      
      {/* NOTIFIKASI */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.9 }}
            className="fixed top-6 left-0 right-0 mx-auto w-[90%] max-w-md z-50 pointer-events-none"
          >
            <div className="bg-black/90 backdrop-blur-xl border border-l-4 rounded-r-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] p-4 flex items-start gap-4 pointer-events-auto"
                 style={{ borderColor: notification.type === 'error' ? '#ef4444' : '#00f2ff' }}>
              <div className={`p-2 rounded-full bg-opacity-20 ${notification.type === 'error' ? 'bg-red-500 text-red-500' : 'bg-cyan-500 text-cyan-500'}`}>
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h4 className={`text-xs font-bold tracking-widest uppercase mb-1 ${notification.type === 'error' ? 'text-red-500' : 'text-cyan-400'}`}>
                  {notification.type === 'error' ? 'SYSTEM ALERT' : 'NOTIFICATION'}
                </h4>
                <p className="text-gray-300 text-xs leading-relaxed break-words">{notification.message}</p>
              </div>
              <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="mb-10 text-center flex flex-col items-center w-full max-w-2xl mx-auto">
        <div className="flex justify-center items-center gap-2 mb-6 px-3 py-1 rounded-full bg-white/5 border border-white/5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            System Operational
          </span>
        </div>
        
        <motion.h1 
          className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight mb-2 leading-tight bg-clip-text text-transparent bg-[length:200%_auto]"
          animate={{
            backgroundImage: [
              "linear-gradient(to right, #ffffff, #a5f3fc, #ffffff)",
              "linear-gradient(to right, #a5f3fc, #ffffff, #a5f3fc)",
              "linear-gradient(to right, #ffffff, #a5f3fc, #ffffff)"
            ]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          style={{ backgroundImage: "linear-gradient(to right, #ffffff, #a5f3fc, #ffffff)" }}
        >
          ALLCASTO.DOWNLOADER
        </motion.h1>
        
        <div className="flex items-center gap-3 mb-8">
           <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-cyan-500/50"></div>
           <h2 className="text-[10px] sm:text-xs font-medium tracking-[0.5em] text-cyan-400/80 uppercase whitespace-nowrap">
              NO WATERMARK ENGINE
           </h2>
           <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-cyan-500/50"></div>
        </div>
      </header>

      {/* PLATFORM GRID */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-4xl grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-10"
      >
        {platforms.map((p) => (
          <motion.button
            key={p.id}
            variants={itemVariants}
            onClick={() => { setSelected(p.id); setResult(null); }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`relative flex flex-row items-center justify-start gap-3 px-3 sm:px-4 py-3 sm:py-4 rounded-xl border border-white/5 bg-[#0a0a0c] hover:bg-[#121214] transition-all duration-300 group overflow-hidden ${
              selected === p.id ? 'ring-1 ring-offset-1 ring-offset-black' : ''
            }`}
            style={{ borderColor: selected === p.id ? p.color : 'rgba(255,255,255,0.05)' }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500" style={{ background: `linear-gradient(to right, ${p.color}, transparent)` }} />
            <div className="transition-transform duration-300 group-hover:scale-110 shrink-0" style={{ color: p.color }}>
              {React.cloneElement(p.icon, { size: 18 })}
            </div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-gray-400 uppercase group-hover:text-white transition-colors truncate">
              {p.name}
            </span>
            {selected === p.id && (
              <motion.div layoutId="active-dot" className="absolute right-3 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}` }} />
            )}
          </motion.button>
        ))}
      </motion.div>

      {/* INPUT AREA */}
      <motion.div layout className="w-full max-w-3xl mb-8 relative z-20">
        <div className="bg-[#0a0a0c] border border-white/10 p-1 rounded-2xl shadow-2xl transition-colors duration-500" style={{ borderColor: activeColor }}>
          <div className="bg-[#121214] rounded-xl p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: activeColor }} />
                TARGET: <span style={{ color: activeColor }} className="font-bold uppercase">{activeName}</span>
              </span>
              {isLoading ? <span className="text-cyber animate-pulse">{">"} {loadingLogs[logIndex]}</span> : <span>READY</span>}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 group">
                <input 
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={`Paste ${activeName} Link here...`}
                  className="w-full h-12 bg-black/40 border border-white/5 rounded-lg px-4 pr-10 text-white outline-none focus:border-white/20 transition-all placeholder:text-gray-600 text-xs"
                />
                <button onClick={handlePaste} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                  <Clipboard size={16} />
                </button>
              </div>
              <button 
                onClick={handleExtract}
                disabled={isLoading}
                className="h-12 px-8 rounded-lg font-bold text-black text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 hover:brightness-110 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,0,0,0.3)]"
                style={{ backgroundColor: activeColor }}
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="fill-black" />}
                <span>{isLoading ? 'PROCESSING...' : 'EXTRACT'}</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* RESULT CARD */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-3xl mb-8"
          >
            <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl overflow-hidden">
              <div className="bg-white/5 px-6 py-3 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2 text-green-400 text-xs font-bold tracking-wider">
                  <CheckCircle size={14} />
                  SUCCESSFULLY EXTRACTED
                </div>
                <div className="text-[10px] text-gray-500">{result.date || 'Just now'}</div>
              </div>
              <div className="p-6 flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 aspect-video bg-black rounded-xl border border-white/5 relative overflow-hidden group shadow-lg">
                  {result.thumbnail ? (
                    <img src={result.thumbnail} alt="Preview" className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-700"><FileVideo size={34} /></div>
                  )}
                  <div className="absolute bottom-2 left-2 text-[10px] text-white bg-black/60 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">{result.size || 'HD Quality'}</div>
                </div>
                <div className="flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="text-white font-bold text-lg mb-1 line-clamp-2 leading-snug">{result.title || `${activeName} Media`}</h3>
                    <p className="text-gray-400 text-xs flex items-center gap-1"><Activity size={10}/> By {result.author || activeName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {primaryLink ? (
                      <a 
                        href={primaryLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${isAudioPlatform || !showAudioButton ? 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400 col-span-2' : 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400'}`}
                      >
                         {btnConfig.icon} {btnConfig.label}
                      </a>
                    ) : (
                      <button disabled className={`flex items-center justify-center gap-2 bg-white/5 text-gray-500 py-3 rounded-xl text-xs font-bold cursor-not-allowed border border-white/5 ${isAudioPlatform || !showAudioButton ? 'col-span-2' : ''}`}>
                        {btnConfig.icon} {btnConfig.noData}
                      </button>
                    )}

                    {showAudioButton && (
                      getDownloadLink('audio') ? (
                        <a 
                          href={getDownloadLink('audio')} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-400 py-3 rounded-xl text-xs font-bold transition-all"
                        >
                           <FileAudio size={14} /> DOWNLOAD MP3
                        </a>
                      ) : (
                        <button disabled className="flex items-center justify-center gap-2 bg-white/5 text-gray-500 py-3 rounded-xl text-xs font-bold cursor-not-allowed border border-white/5">
                          <FileAudio size={14} /> NO AUDIO
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HISTORY */}
      {history.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="w-full max-w-3xl mt-4"
        >
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold tracking-widest uppercase">
              <Clock size={12} /> Recent History
            </div>
            <button onClick={clearHistory} className="text-[10px] text-red-500/70 hover:text-red-500 flex items-center gap-1 transition-colors">
              <Trash2 size={10} /> CLEAR ALL
            </button>
          </div>
          <div className="space-y-2">
            {history.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="bg-[#0a0a0c] border border-white/5 rounded-lg p-3 flex items-center justify-between hover:border-white/10 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-md text-gray-400 group-hover:text-white transition-colors">
                    <Activity size={14} />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-gray-300 group-hover:text-white text-xs font-bold truncate max-w-[200px] transition-colors">{item.title || 'Extracted media'}</h4>
                    <p className="text-[10px] text-gray-600">{item.author || item.platform || 'Unknown'}</p>
                  </div>
                </div>
                <button className="text-gray-500 hover:text-cyan-400 text-[10px] border border-transparent hover:border-cyan-400/30 px-3 py-1.5 rounded transition-all bg-white/5">
                  OPEN
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* REALTIME STATS */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl mt-12 grid grid-cols-2 gap-4"
      >
        <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl p-5 flex items-center justify-between group hover:border-cyan-500/20 transition-colors">
           <div>
              <div className="flex items-center gap-2 mb-1">
                 <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                 <p className="text-[10px] font-bold tracking-widest text-cyan-500/70 uppercase">Live Users</p>
              </div>
              <h3 className="text-2xl text-white font-bold">{stats.visitors.toLocaleString()}</h3>
           </div>
           <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 group-hover:scale-110 transition-transform">
              <Users size={20} />
           </div>
        </div>

        <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl p-5 flex items-center justify-between group hover:border-green-500/20 transition-colors">
           <div>
              <div className="flex items-center gap-2 mb-1">
                 <div className="w-2 h-2 rounded-full bg-green-500"></div>
                 <p className="text-[10px] font-bold tracking-widest text-green-500/70 uppercase">Processed</p>
              </div>
              <h3 className="text-2xl text-white font-bold">{stats.links.toLocaleString()}</h3>
           </div>
           <div className="p-3 bg-green-500/10 rounded-xl text-green-400 group-hover:scale-110 transition-transform">
              <BarChart3 size={20} />
           </div>
        </div>
      </motion.div>

      <footer className="mt-16 text-center opacity-30 hover:opacity-100 transition-opacity pb-8">
        <p className="text-[10px] text-white tracking-[0.2em] mb-2">
          © 2026 Allcasto Downloader. All rights reserved.
        </p>
        <div className="flex items-center justify-center gap-2 text-[9px] text-white">
          <span>Allcasto Media Tools</span>
        </div>
      </footer>
    </div>
  );
}
