import React, { useState, useEffect, useRef } from 'react';
import { Play, Tv, ArrowLeft, RotateCw, Shield, AlertTriangle, PlayCircle, BarChart2 } from 'lucide-react';
import Hls from 'hls.js';

interface Team {
  name: string;
  logo: string;
  score: number;
}

interface Stream {
  name: string;
  url: string;
  type: 'hls' | 'iframe';
}

interface Match {
  id: string;
  tournament: string;
  status: 'live' | 'upcoming' | 'finished';
  minute: string;
  channel: string;
  commentator: string;
  link?: string;
  teams: {
    home: Team;
    away: Team;
  };
  streams: Stream[];
  stats: {
    possession: { home: number; away: number };
    shots: { home: number; away: number };
    fouls: { home: number; away: number };
    corners: { home: number; away: number };
  };
}



const getTeamLogo = (teamName: string): string => {
  const name = (teamName || "").toLowerCase().trim();
  if (name.includes('هلال') || name.includes('hilal')) return "https://upload.wikimedia.org/wikipedia/en/thumb/0/00/Al_Hilal_SFC_logo.svg/1200px-Al_Hilal_SFC_logo.svg.png";
  if (name.includes('نصر') || name.includes('nassr')) return "https://upload.wikimedia.org/wikipedia/en/thumb/c/c7/Al-Nassr_FC_Logo.svg/1200px-Al-Nassr_FC_Logo.svg.png";
  if (name.includes('برشلونة') || name.includes('برشلونه') || name.includes('barcelona') || name.includes('barca')) return "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crested%29.svg/1200px-FC_Barcelona_%28crested%29.svg.png";
  if (name.includes('مدريد') || name.includes('madrid') || name.includes('real')) return "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/1200px-Real_Madrid_CF.svg.png";
  if (name.includes('سيتي') || name.includes('city') || name.includes('سيتى')) return "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/1200px-Manchester_City_FC_badge.svg.png";
  if (name.includes('ليفربول') || name.includes('liverpool')) return "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/1200px-Liverpool_FC.svg.png";
  if (name.includes('أهلي') || name.includes('الأهلي') || name.includes('ahly') || name.includes('الاهلي')) {
    if (name.includes('سعودي') || name.includes('جدة')) return "https://upload.wikimedia.org/wikipedia/en/thumb/1/18/Al-Ahli_Saudi_FC_logo.svg/1200px-Al-Ahli_Saudi_FC_logo.svg.png";
    return "https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Al_Ahly_SC_logo.svg/1200px-Al_Ahly_SC_logo.svg.png";
  }
  if (name.includes('زمالك') || name.includes('zamalek')) return "https://upload.wikimedia.org/wikipedia/en/thumb/0/04/ZamalekSC-Logo.svg/1200px-ZamalekSC-Logo.svg.png";
  if (name.includes('بايرن') || name.includes('bayern')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/1200px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png";
  if (name.includes('باريس') || name.includes('psg') || name.includes('saint')) return "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/1200px-Paris_Saint-Germain_F.C..svg.png";
  if (name.includes('ارسنال') || name.includes('أرسنال') || name.includes('arsenal')) return "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/1200px-Arsenal_FC.svg.png";
  if (name.includes('تشيلسي') || name.includes('chelsea')) return "https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/1200px-Chelsea_FC.svg.png";
  if (name.includes('يونايتد') || name.includes('united')) return "https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/1200px-Manchester_United_FC_crest.svg.png";
  if (name.includes('سوريا') || name.includes('syria')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Syrian_Arab_Republic_logo.svg/1200px-Syrian_Arab_Republic_logo.svg.png";
  if (name.includes('العراق') || name.includes('iraq')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Coat_of_arms_of_Iraq.svg/1200px-Coat_of_arms_of_Iraq.svg.png";
  if (name.includes('مصر') || name.includes('egypt')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Coat_of_arms_of_Egypt_%28Eagle_of_Saladin%29_Golden.svg/1200px-Coat_of_arms_of_Egypt_%28Eagle_of_Saladin%29_Golden.svg.png";

  return "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&h=150&fit=crop&q=80";
};

export default function App() {
  const [currentView, setCurrentView] = useState<'welcome' | 'matches' | 'player'>('welcome');
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [activeStreamIndex, setActiveStreamIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchingStreams, setFetchingStreams] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Fetch match details
  const fetchMatches = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const res = await fetch('/api/matches');
      if (!res.ok) throw new Error('تعذر جلب جدول المباريات');
      const json = await res.json();
      setMatches(json.data || []);
      setErrorMsg(null);

      // If we are currently watching a match, let's update its statistics/scores in real-time
      if (selectedMatch) {
        const refreshedMatch = json.data?.find((m: Match) => m.id === selectedMatch.id);
        if (refreshedMatch) {
          setSelectedMatch(refreshedMatch);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('تعذر تحميل معلومات المباريات، تأكد من تشغيل الخادم الخلفي بشكل صحيح.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches(true);

    // Auto update coordinates and matches state every 15 seconds
    const interval = setInterval(() => {
      fetchMatches(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedMatch]);

  // Sync active HLS stream or embed video render when player views
  useEffect(() => {
    if (currentView !== 'player' || !selectedMatch) return;

    const stream = selectedMatch.streams?.[activeStreamIndex];
    if (!stream || stream.type !== 'hls') {
      // Clean up previous HLS instance if we moved to iframe server
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Destory existing hls instance before initializing new one
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = stream.url;

    if (Hls.isSupported()) {
      const hlsInstance = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(video);
      hlsRef.current = hlsInstance;

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((e) => console.log("Autoplay blocked:", e));
      });

      hlsInstance.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hlsInstance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hlsInstance.recoverMediaError();
              break;
            default:
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari support
      video.src = streamUrl;
      video.play().catch((e) => console.log("Autoplay blocked:", e));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentView, selectedMatch, activeStreamIndex]);

  // Filter matches
  const filteredMatches = matches.filter((item) => {
    const matchesSearch =
      item.teams.home.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.teams.away.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tournament.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === 'all') return matchesSearch;
    return item.status === activeTab && matchesSearch;
  });

  const handleMatchClick = async (match: Match) => {
    setSelectedMatch(match);
    setActiveStreamIndex(0);
    setCurrentView('player');

    if (match.link) {
      setFetchingStreams(true);
      try {
        const res = await fetch(`/api/match-player?path=${encodeURIComponent(match.link)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.urls && json.urls.length > 0) {
            // Map raw discovered URLs into stream definitions
            const discoveredStreams: Stream[] = json.urls.map((rawUrl: string, idx: number) => {
              const isHls = rawUrl.toLowerCase().includes('.m3u8') || rawUrl.toLowerCase().includes('.mpd');
              let serviceName = "سيرفر خارجي";
              try {
                const hostname = new URL(rawUrl).hostname.replace('www.', '');
                if (hostname.includes('syria')) serviceName = "سيرفر البث السريع الرئيسي";
                else if (hostname.includes('alkass')) serviceName = "سيرفر الكأس الرياضية";
                else if (hostname.includes('bein')) serviceName = "سيرفر بي إن سبورتس";
                else serviceName = `سيرفر بديل (${hostname})`;
              } catch (_) {}

              return {
                name: `${serviceName} رقم ${idx + 1}`,
                url: rawUrl,
                type: isHls ? 'hls' : 'iframe'
              };
            });

            // Combine with default hardcoded fallback streams to guarantee maximum coverage
            const combined = [...discoveredStreams, ...match.streams];
            const uniqueStreams: Stream[] = [];
            const seenUrls = new Set<string>();

            for (const s of combined) {
              if (!seenUrls.has(s.url)) {
                seenUrls.add(s.url);
                uniqueStreams.push(s);
              }
            }

            setSelectedMatch(prev => prev ? { ...prev, streams: uniqueStreams } : null);
            setMatches(prevMatches => prevMatches.map(m => m.id === match.id ? { ...m, streams: uniqueStreams } : m));
          }
        }
      } catch (err) {
        console.warn("Failed to dynamically compile matches:", err);
      } finally {
        setFetchingStreams(false);
      }
    }
  };



  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-rose-500 selection:text-white" dir="rtl">
      
      {/* 1. Splash / Welcome View */}
      {currentView === 'welcome' && (
        <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
          
          {/* Visual ambience background */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-rose-600/15 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-[200px] h-[200px] bg-red-600/10 rounded-full blur-[90px] pointer-events-none" />

          {/* Logo Brand Container */}
          <div className="z-10 text-center max-w-lg space-y-8">
            <div className="inline-flex items-center justify-center p-5 bg-gradient-to-br from-rose-500 to-red-600 rounded-3xl shadow-2xl shadow-rose-500/20 ring-4 ring-rose-500/35 animate-bounce">
              <Tv className="w-16 h-16 text-white" />
            </div>

            <div className="space-y-3">
              <h1 className="text-5xl md:text-6xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-rose-100 to-rose-400">
                rahim tv
              </h1>
              <p className="text-lg md:text-xl text-slate-400 font-medium tracking-wide">
                البث المباشر وأحدث مباريات اليوم لحظة بلحظة
              </p>
            </div>

            {/* Simple status list for live proofing */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm py-4">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs text-slate-400">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                سيرفرات بث نشطة
              </span>
              <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs text-slate-400">
                قنوات عربية مجانية
              </span>
              <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs text-slate-400">
                جودة عالية FHD
              </span>
            </div>

            {/* Action button */}
            <div className="pt-4">
              <button
                onClick={() => setCurrentView('matches')}
                className="w-full sm:w-64 py-4 px-8 text-lg font-bold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-full transition-all duration-300 shadow-xl shadow-rose-500/15 hover:shadow-rose-600/20 active:scale-95 flex items-center justify-center gap-3 ring-2 ring-rose-400/20 cursor-pointer"
              >
                <PlayCircle className="w-6 h-6" />
                شاهد الآن
              </button>
            </div>
          </div>

          {/* Footer inside landing */}
          <div className="absolute bottom-8 text-center text-xs text-slate-600">
            تطبيق rahim tv © {new Date().getFullYear()} – البث الرياضي الترفيهي المباشر
          </div>
        </div>
      )}

      {/* 2. Today's Matches View */}
      {currentView === 'matches' && (
        <div className="min-h-screen pb-16">
          
          {/* Sticky Header */}
          <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-900 py-4 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl shadow-lg shadow-rose-500/10">
                  <Tv className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-white hover:cursor-pointer" onClick={() => setCurrentView('welcome')}>
                    rahim tv
                  </h1>
                  <span className="text-[10px] text-rose-500 block font-bold leading-tight">جدول مباريات اليوم</span>
                </div>
              </div>

              {/* Back to welcome */}
              <button 
                onClick={() => setCurrentView('welcome')} 
                className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/60 border border-slate-800 rounded-lg"
              >
                الصفحة الرئيسية
              </button>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-4 pt-8 space-y-6">

            {/* Main Title & Search Layout */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                  مباريات اليوم التفاعلية
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  اختر أي مباراة لتنتقل معها فورًا إلى صفحة البث المباشر
                </p>
              </div>

              {/* Free Text Search */}
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="ابحث عن فريق، قناة، بطولة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full py-2.5 pl-4 pr-10 text-sm bg-slate-900/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500 transition-all text-right"
                />
                <span className="absolute left-3 top-3 text-[10px] text-slate-500">تصفية تلقائية</span>
              </div>
            </div>

            {/* Direct Filters Tab List */}
            <div className="flex items-center gap-2 border-b border-slate-900 pb-3 overflow-x-auto whitespace-nowrap">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === 'all'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/10'
                    : 'bg-slate-900/40 text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                }`}
              >
                جميع المباريات ({matches.length})
              </button>
              <button
                onClick={() => setActiveTab('live')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                  activeTab === 'live'
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/10'
                    : 'bg-slate-900/40 text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                جارية الآن ({matches.filter(m => m.status === 'live').length})
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === 'upcoming'
                    ? 'bg-yellow-600 text-white shadow-md shadow-yellow-600/10'
                    : 'bg-slate-900/40 text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                }`}
              >
                تبدأ قريباً ({matches.filter(m => m.status === 'upcoming').length})
              </button>
              <button
                onClick={() => setActiveTab('finished')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === 'finished'
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-slate-900/40 text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                }`}
              >
                انتهت ({matches.filter(m => m.status === 'finished').length})
              </button>

              <button
                onClick={() => fetchMatches(true)}
                className="mr-auto p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-500 rounded-xl transition-colors shrink-0"
                title="تحديث جدول المباريات"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>



            {/* Error Message if Fetch Failed */}
            {errorMsg && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-center gap-3 text-sm text-yellow-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            {/* Grid Matches List */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-12">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4 animate-pulse">
                    <div className="h-4 bg-slate-800 rounded w-1/3" />
                    <div className="flex items-center justify-between py-2">
                      <div className="h-10 bg-slate-800 rounded-full w-10" />
                      <div className="h-6 bg-slate-800 rounded w-1/4" />
                      <div className="h-10 bg-slate-800 rounded-full w-10" />
                    </div>
                    <div className="h-3 bg-slate-800 rounded w-1/2 mx-auto" />
                  </div>
                ))}
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-slate-900/60 p-8">
                <Tv className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-300">لا توجد مباريات مطابقة حاليًا</h3>
                <p className="text-sm text-slate-500 mt-2">يرجى المحاولة مجددًا، أو اضبط عوامل التصفية</p>
                <button 
                  onClick={() => { setSearchTerm(''); setActiveTab('all'); }} 
                  className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs hover:bg-slate-800"
                >
                  إعادة تعيين البحث
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredMatches.map((match) => (
                  <div
                    key={match.id}
                    onClick={() => handleMatchClick(match)}
                    className="group bg-slate-900/40 hover:bg-slate-900/95 border border-slate-900 hover:border-rose-500/40 rounded-2xl p-5 transition-all duration-300 shadow-sm cursor-pointer hover:shadow-lg relative overflow-hidden"
                  >
                    {/* Corner accent glow on hover */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* League / Status Row */}
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/60 pb-3 mb-4">
                      <span className="font-bold text-slate-300 limit-lines">{match.tournament}</span>
                      
                      {match.status === 'live' ? (
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400 font-bold rounded-lg leading-none animate-pulse">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          مباشر ({match.minute})
                        </span>
                      ) : match.status === 'finished' ? (
                        <span className="px-2 py-1 bg-slate-800/80 text-slate-400 font-bold rounded-lg leading-none">
                          انتهت
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold rounded-lg leading-none">
                          {match.minute || 'تبدأ قريبًا'}
                        </span>
                      )}
                    </div>

                    {/* Teams Confrontation Panel */}
                    <div className="grid grid-cols-7 items-center justify-center my-4">
                      {/* Home Team */}
                      <div className="col-span-3 flex flex-col items-center text-center gap-2">
                        <div className="w-14 h-14 bg-slate-950 border border-slate-850 rounded-full flex items-center justify-center font-black text-rose-500 shadow-inner group-hover:scale-105 transition-transform overflow-hidden p-2.5">
                          <img 
                            src={match.teams.home.logo || getTeamLogo(match.teams.home.name)} 
                            alt={match.teams.home.name} 
                            className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                            onError={(e) => {
                              e.currentTarget.src = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&h=150&fit=crop&q=80";
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-200 group-hover:text-rose-400 transition-colors whitespace-nowrap overflow-hidden text-ellipsis w-full">
                          {match.teams.home.name}
                        </span>
                      </div>

                      {/* VS / Score Panel */}
                      <div className="col-span-1 flex flex-col items-center justify-center">
                        {match.status === 'upcoming' ? (
                          <div className="text-xs font-black text-slate-500 tracking-wider bg-slate-900 border border-slate-800/80 px-2 py-1 rounded">VS</div>
                        ) : (
                          <div className="flex items-center gap-1.5 justify-center py-1.5 px-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
                            <span className="text-sm font-black text-rose-500">{match.teams.home.score}</span>
                            <span className="text-slate-600 font-bold">-</span>
                            <span className="text-sm font-black text-rose-500">{match.teams.away.score}</span>
                          </div>
                        )}
                      </div>

                      {/* Away Team */}
                      <div className="col-span-3 flex flex-col items-center text-center gap-2">
                        <div className="w-14 h-14 bg-slate-950 border border-slate-850 rounded-full flex items-center justify-center font-black text-rose-500 shadow-inner group-hover:scale-105 transition-transform overflow-hidden p-2.5">
                          <img 
                            src={match.teams.away.logo || getTeamLogo(match.teams.away.name)} 
                            alt={match.teams.away.name} 
                            className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                            onError={(e) => {
                              e.currentTarget.src = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&h=150&fit=crop&q=80";
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-200 group-hover:text-rose-400 transition-colors whitespace-nowrap overflow-hidden text-ellipsis w-full">
                          {match.teams.away.name}
                        </span>
                      </div>
                    </div>

                    {/* Media Channel & Commentator Information */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/40">
                      <span className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded">
                        🎙️ {match.commentator || 'عير محدد'}
                      </span>
                      <span className="flex items-center gap-1 text-rose-400 font-extrabold bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10">
                        📺 {match.channel}
                      </span>
                    </div>

                    {/* Quick Play Trigger badge overlay on hover */}
                    <div className="mt-4 pt-1 flex items-center justify-center gap-1.5 text-xs text-rose-500 opacity-0 group-hover:opacity-100 transition-all transition-duration-300">
                      <Play className="w-3.5 h-3.5" />
                      <span>انقر لمشاهدة البث المباشر المباشر</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      {/* 3. Live Stream View / Immersive Player Page */}
      {currentView === 'player' && selectedMatch && (
        <div className="relative min-h-screen pb-20">
          
          {/* Header Controls */}
          <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-900 py-4 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              
              {/* Back button */}
              <button
                onClick={() => {
                  // Destory video resource and go back
                  if (hlsRef.current) {
                    hlsRef.current.destroy();
                    hlsRef.current = null;
                  }
                  setCurrentView('matches');
                }}
                className="flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white transition-colors py-2 px-3 bg-slate-900 border border-slate-850 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4 text-rose-500 ml-1" />
                رجوع لجدول المباريات
              </button>

              <div className="text-left">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded-full uppercase border border-rose-500/20">
                  {selectedMatch.status === 'live' ? 'بث مباشر' : 'عرض البث'}
                </span>
              </div>
            </div>
          </header>

          <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">

            {/* Immersive Match Identity Header */}
            <div className="bg-gradient-to-l from-slate-900 to-slate-950 border border-slate-900 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs text-rose-400 font-bold block">{selectedMatch.tournament}</span>
                <h2 className="text-xl md:text-2xl font-black text-slate-100 flex items-center gap-3">
                  {selectedMatch.teams.home.name} {selectedMatch.status !== 'upcoming' && <span className="text-rose-500">{selectedMatch.teams.home.score}</span>}
                  <span className="text-slate-500 text-sm font-medium">ضد</span>
                  {selectedMatch.teams.away.name} {selectedMatch.status !== 'upcoming' && <span className="text-rose-500">{selectedMatch.teams.away.score}</span>}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1.5">
                  <span>🎙️ المعلق: <b className="text-slate-200">{selectedMatch.commentator}</b></span>
                  <span>•</span>
                  <span>📺 القناة الناقلة: <b className="text-rose-400">{selectedMatch.channel}</b></span>
                  {selectedMatch.status === 'live' && (
                    <>
                      <span>•</span>
                      <span className="text-green-400 font-bold animate-pulse">⏱️ دقيقة اللقاء: {selectedMatch.minute}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex md:flex-col items-center justify-between md:text-left shrink-0 gap-2 border-t md:border-t-0 border-slate-900 pt-3 md:pt-0">
                <span className="text-xs text-slate-500 md:block hidden">حالة اللقاء الحالية</span>
                {selectedMatch.status === 'live' ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    البث المباشر جارٍ
                  </span>
                ) : selectedMatch.status === 'finished' ? (
                  <span className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-full">
                    المباراة انتهت
                  </span>
                ) : (
                  <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-text-amber-400 text-xs font-bold rounded-full">
                    لم تبدأ بعد ({selectedMatch.minute})
                  </span>
                )}
              </div>
            </div>

            {/* Immersive Videoplayer Section */}
            <div className="space-y-3">
              <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border-2 border-slate-900 shadow-2xl">
                
                {/* Scraping Progress Indicator Overlay */}
                {fetchingStreams && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-20">
                    <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <h3 className="text-sm font-bold text-white">جاري الاتصال والبحث عن سيرفرات البث الفوري للمباراة...</h3>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                      نقوم الآن بفحص ومعاينة الروابط للحصول على أفضل نقاوة وسيرفرات لملعب اللقاء مباشرة.
                    </p>
                  </div>
                )}

                {/* 1. HLS Stream Hls.js native component renderer */}
                {selectedMatch.streams?.[activeStreamIndex]?.type === 'hls' ? (
                  <video
                    ref={videoRef}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                    poster="https://www.syrlive.com/wp-content/uploads/2026/02/syrialive_logo-150x150.png"
                    style={{ backgroundColor: '#020617' }}
                  />
                ) : selectedMatch.streams?.[activeStreamIndex] ? (
                  /* 2. Public Iframe embedded container */
                  <iframe
                    src={selectedMatch.streams[activeStreamIndex].url}
                    className="w-full h-full"
                    allowFullScreen
                    referrerPolicy="no-referrer"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    title={selectedMatch.streams[activeStreamIndex].name}
                  />
                ) : (
                  /* No streams found layout fallback */
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950">
                    <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
                    <h3 className="text-lg font-bold text-slate-100">رابط البث غير نشط مؤقتًا</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      يرجى التغيير إلى سيرفر آخر المتاحة بالأسفل لتجربتها، أو انتظر لحظة جاري تحديث سيرفرات الملعب
                    </p>
                  </div>
                )}
              </div>

              {/* Standalone Player Bypass Card */}
              <div className="bg-gradient-to-l from-rose-950/10 to-red-950/15 border border-rose-900/40 p-5 rounded-2xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="flex items-center gap-1 text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                      روابط بث واستماع بديلة وسريعة
                    </span>
                    <h4 className="text-sm font-bold text-slate-200">
                      هل تواجه مشكلة شاشة سوداء أو تقطيع في تحميل المشغّل؟
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      بعض المتصفحات تمنع البث المباشر داخل المواقع الفرعية (Iframe Sandbox). يمكنك دائماً فتح رابط السيرفر المحدد فوراً في نافذة مستقلة للتشغيل بأعلى جودة وضمان استقرار كامل!
                    </p>
                  </div>
                  
                  <a
                    href={selectedMatch.streams[activeStreamIndex]?.url || selectedMatch.link || "https://www.syrlive.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full md:w-auto px-5 py-3 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-xl text-xs font-bold transition-all duration-300 shadow-lg shadow-rose-500/10 flex items-center justify-center gap-2 cursor-pointer shrink-0 border border-rose-400/20"
                  >
                    <Play className="w-3.5 h-3.5" />
                    فتح البث في نافذة مستقلة ↗️
                  </a>
                </div>
              </div>

              {/* Streaming Servers Tabs Selection Controller */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-805 pb-2">
                  <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    🌐 حدد سيرفر البث الترددي (القنوات العربية بريميوم):
                  </h3>
                  <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-900">
                    تبديل فوري
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedMatch.streams && selectedMatch.streams.length > 0 ? (
                    selectedMatch.streams.map((srv, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveStreamIndex(index)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
                          activeStreamIndex === index
                            ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-xl shadow-rose-600/15 ring-2 ring-rose-400/20'
                            : 'bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-850'
                        }`}
                      >
                        {srv.name} &nbsp;
                        <span className="text-[9px] opacity-75">
                          ({srv.type === 'hls' ? 'M3U8 HLS' : 'عبر الويب'})
                        </span>
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">لا تتوفر خوادم إضافية لهذه المواجهة</span>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  * نصيحة: إذا كنت تشاهد في وضع الجوال ولم يعمل البث الرئيسي تلقائيًا، فجرّب <b>سيرفر البث الثاني (الكأس HD 2)</b> أو <b>البث المباشر المفتوح (اليوتيوب)</b> فهو متوافق مع كافة المتصفحات دون استثناء ومجاني بالكامل!
                </p>
              </div>
            </div>

            {/* Simplified Safe Broadcast notice without complex statistics */}
            <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-900 pb-3">
                <Shield className="w-4 h-4 text-rose-500" />
                معلومات تشغيل البث المباشر والملخص الرياضي
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                مرحباً بك في رافد البث التلفزيوني الترفيهي <b>rahim tv</b>. نحن نسعى لاشتقاق قنوات ومباريات البث المجاني من كبرى الفضائيات العربية والمفتوحة، ونعتمد على قنوات رياضية متخصصة لتمكنك من متابعة ناديك المفضل ومباريات اليوم بأعلى جودة وبدون انقطاع وبدون تفاصيل معقدة ولا حاجة للتسجيل.
              </p>
              <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-900">
                <span>الحالة الفنية لغرفة البث: مستقر وآمن على كافة الأجهزة الذكية والأندرويد والشاشات</span>
                <span>rahim tv الرياضية الرسمية</span>
              </div>
            </div>

          </main>
        </div>
      )}

    </div>
  );
}
