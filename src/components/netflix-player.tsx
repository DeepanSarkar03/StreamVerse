'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  RotateCcw,
  RotateCw,
  Flag,
  Subtitles,
  Settings,
  Check,
  X,
  Loader2,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { usePlaybackProgress } from '@/hooks/use-playback-progress';

interface NetflixPlayerProps {
  src: string;
  title: string;
  videoId: string;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const QUALITY_OPTIONS = [
  { label: '4K', value: 2160, badge: 'Ultra HD' },
  { label: '1440p', value: 1440, badge: 'QHD' },
  { label: '1080p', value: 1080, badge: 'Full HD' },
  { label: '720p', value: 720, badge: 'HD' },
  { label: '480p', value: 480, badge: null },
  { label: '360p', value: 360, badge: null },
  { label: '240p', value: 240, badge: null },
  { label: '144p', value: 144, badge: null },
];

// Video enhancement presets
const ENHANCEMENT_PRESETS = [
  { 
    label: 'Off', 
    value: 'off',
    filter: 'none',
    description: 'No enhancement'
  },
  { 
    label: 'Sharpen', 
    value: 'sharpen',
    filter: 'contrast(1.05) saturate(1.1)',
    description: 'Slightly sharper image'
  },
  { 
    label: 'Vivid', 
    value: 'vivid',
    filter: 'contrast(1.1) saturate(1.25) brightness(1.02)',
    description: 'More vibrant colors'
  },
  { 
    label: 'Cinema', 
    value: 'cinema',
    filter: 'contrast(1.15) saturate(0.9) sepia(0.05) brightness(0.98)',
    description: 'Cinematic color grading'
  },
  { 
    label: 'AI Enhance', 
    value: 'ai-enhance',
    filter: 'contrast(1.08) saturate(1.15) brightness(1.01)',
    description: 'Optimized for upscaled content',
    useUpscaleRendering: true
  },
];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getQualityLabel(height: number): string {
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  if (height >= 240) return '240p';
  return '144p';
}

// Helper to get thumbnail
function getThumbnail(videoId: string): string {
  const seed = videoId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'default';
  return `https://picsum.photos/seed/${seed}/400/225`;
}

export function NetflixPlayer({ src, title, videoId }: NetflixPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const progressSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const watchTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  const { progress: savedProgress, isLoaded: progressLoaded, saveProgress, clearProgress } = usePlaybackProgress(videoId);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showCaptionsMenu, setShowCaptionsMenu] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionsAvailable, setCaptionsAvailable] = useState(false);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [captionsCues, setCaptionsCues] = useState<{start: number; end: number; text: string}[]>([]);
  const [currentCaption, setCurrentCaption] = useState('');
  const [videoResolution, setVideoResolution] = useState<{width: number; height: number} | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [settingsTab, setSettingsTab] = useState<'speed' | 'quality' | 'enhance'>('speed');
  const [enhancementPreset, setEnhancementPreset] = useState<string>('off');
  const [useUpscaleRendering, setUseUpscaleRendering] = useState(false);

  // Track watch time for analytics
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && videoRef.current) {
        const currentVideoTime = videoRef.current.currentTime;
        const timeDiff = currentVideoTime - lastTimeRef.current;
        // Only count if playing forward normally (not seeking)
        if (timeDiff > 0 && timeDiff < 2) {
          watchTimeRef.current += timeDiff;
        }
        lastTimeRef.current = currentVideoTime;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Save watch history on unmount
  useEffect(() => {
    return () => {
      if (duration > 0 && watchTimeRef.current > 10) {
        // This is handled by storage directly since useApp might not be available in cleanup
        const completed = (currentTime / duration) > 0.9;
        const historyEntry = {
          videoId,
          title,
          thumbnail: getThumbnail(videoId),
          duration,
          watchedDuration: watchTimeRef.current,
          completed,
        };
        // Store directly in localStorage
        try {
          const stored = localStorage.getItem('streamverse_watch_history');
          const history = stored ? JSON.parse(stored) : [];
          const existingIndex = history.findIndex((h: any) => h.videoId === videoId);
          const entry = { ...historyEntry, watchedAt: Date.now() };
          if (existingIndex >= 0) {
            history[existingIndex] = entry;
          } else {
            history.unshift(entry);
          }
          localStorage.setItem('streamverse_watch_history', JSON.stringify(history.slice(0, 100)));

          // Update analytics
          const analyticsStored = localStorage.getItem('streamverse_analytics');
          const analytics = analyticsStored ? JSON.parse(analyticsStored) : {
            totalWatchTime: 0,
            videosWatched: 0,
            videosCompleted: 0,
            dailyStats: {},
            genreStats: {},
          };
          const today = new Date().toISOString().split('T')[0];
          analytics.totalWatchTime += watchTimeRef.current;
          if (!analytics.dailyStats[today]) {
            analytics.dailyStats[today] = { watchTime: 0, videos: 0 };
          }
          analytics.dailyStats[today].watchTime += watchTimeRef.current;
          if (completed) {
            analytics.videosCompleted += 1;
            analytics.dailyStats[today].videos += 1;
          }
          localStorage.setItem('streamverse_analytics', JSON.stringify(analytics));
        } catch (e) {
          console.error('Failed to save watch history:', e);
        }
      }
    };
  }, [videoId, title, duration, currentTime]);

  // Load captions on mount
  useEffect(() => {
    async function checkCaptions() {
      try {
        const response = await fetch(`/api/captions/${encodeURIComponent(videoId)}`);
        if (response.ok) {
          const vttText = await response.text();
          parseCaptions(vttText);
          setCaptionsAvailable(true);
        }
      } catch (error) {
        console.log('No captions available');
      }
    }
    checkCaptions();
  }, [videoId]);

  // Load saved playback progress when video is ready
  useEffect(() => {
    if (!progressLoaded || !videoRef.current || !savedProgress) return;
    
    // Resume from saved position
    videoRef.current.currentTime = savedProgress.timestamp;
    setCurrentTime(savedProgress.timestamp);
  }, [progressLoaded, savedProgress]);

  // Parse VTT captions
  const parseCaptions = (vttText: string) => {
    const lines = vttText.split('\n');
    const cues: {start: number; end: number; text: string}[] = [];
    let i = 0;
    
    // Skip WEBVTT header
    while (i < lines.length && !lines[i].includes('-->')) {
      i++;
    }
    
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.includes('-->')) {
        const [startStr, endStr] = line.split('-->').map(s => s.trim());
        const start = parseTimestamp(startStr);
        const end = parseTimestamp(endStr);
        
        i++;
        let text = '';
        while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
          if (text) text += ' ';
          text += lines[i].trim();
          i++;
        }
        
        if (text) {
          cues.push({ start, end, text });
        }
      } else {
        i++;
      }
    }
    
    setCaptionsCues(cues);
  };

  const parseTimestamp = (ts: string): number => {
    const parts = ts.split(':');
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s.replace(',', '.'));
    } else if (parts.length === 2) {
      const [m, s] = parts;
      return parseFloat(m) * 60 + parseFloat(s.replace(',', '.'));
    }
    return 0;
  };

  // Update current caption based on time
  useEffect(() => {
    if (!captionsEnabled || captionsCues.length === 0) {
      setCurrentCaption('');
      return;
    }
    
    const cue = captionsCues.find(c => currentTime >= c.start && currentTime <= c.end);
    setCurrentCaption(cue?.text || '');
  }, [currentTime, captionsEnabled, captionsCues]);

  // Generate captions with AI
  const generateCaptions = async () => {
    setIsGeneratingCaptions(true);
    try {
      const response = await fetch(`/api/captions/${encodeURIComponent(videoId)}/generate`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Reload captions
        const captionResponse = await fetch(`/api/captions/${encodeURIComponent(videoId)}`);
        if (captionResponse.ok) {
          const vttText = await captionResponse.text();
          parseCaptions(vttText);
          setCaptionsAvailable(true);
          setCaptionsEnabled(true);
        }
      } else {
        alert(result.error || 'Failed to generate captions');
      }
    } catch (error) {
      console.error('Error generating captions:', error);
      alert('Failed to generate captions. Please try again.');
    } finally {
      setIsGeneratingCaptions(false);
      setShowCaptionsMenu(false);
    }
  };

  // Show/hide controls on mouse movement
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    // Always start a new timeout to hide controls after 3 seconds
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsMenu && !showCaptionsMenu) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, showSettingsMenu, showCaptionsMenu]);

  // Start auto-hide timer when video starts playing
  useEffect(() => {
    if (isPlaying && !showSettingsMenu && !showCaptionsMenu) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showSettingsMenu, showCaptionsMenu]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.settings-menu') && !target.closest('.settings-button')) {
        setShowSettingsMenu(false);
      }
      if (!target.closest('.captions-menu') && !target.closest('.captions-button')) {
        setShowCaptionsMenu(false);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowleft':
          e.preventDefault();
          skip(-10);
          break;
        case 'arrowright':
          e.preventDefault();
          skip(10);
          break;
        case 'arrowup':
          e.preventDefault();
          changeVolume(Math.min(1, volume + 0.1));
          break;
        case 'arrowdown':
          e.preventDefault();
          changeVolume(Math.max(0, volume - 0.1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, isPlaying]);

  // Update fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime += seconds;
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const changeVolume = (newVolume: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const handleSeek = (value: number[]) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVideoClick = () => {
    togglePlay();
  };

  const changePlaybackSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSettingsMenu(false);
  };

  const toggleCaptions = () => {
    setCaptionsEnabled(!captionsEnabled);
    setShowCaptionsMenu(false);
  };

  // Get current enhancement filter
  const currentEnhancement = ENHANCEMENT_PRESETS.find(p => p.value === enhancementPreset);
  const videoFilter = currentEnhancement?.filter || 'none';

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      className="relative h-screen w-screen bg-black group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className={cn(
          "h-full w-full cursor-pointer",
          useUpscaleRendering && "upscale-render"
        )}
        style={{ 
          filter: videoFilter,
        }}
        src={src}
        preload="auto"
        playsInline
        onClick={handleVideoClick}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          const newTime = videoRef.current?.currentTime || 0;
          setCurrentTime(newTime);
          
          // Save progress every 5 seconds
          if (progressSaveTimeoutRef.current) {
            clearTimeout(progressSaveTimeoutRef.current);
          }
          progressSaveTimeoutRef.current = setTimeout(() => {
            saveProgress(newTime, duration);
          }, 5000);
        }}
        onLoadedMetadata={() => {
          setDuration(videoRef.current?.duration || 0);
          setIsBuffering(false);
          // Get video resolution
          if (videoRef.current) {
            setVideoResolution({
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight
            });
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        autoPlay
        playsInline
      />

      {/* Buffering Indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Top Controls Gradient */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Bottom Controls Gradient */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Top Bar */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 flex items-center justify-between p-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <Link href="/" className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft className="h-7 w-7 text-white" />
        </Link>
        <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <Flag className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Center Play Button (shown when paused) */}
      {!isPlaying && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button 
            onClick={togglePlay}
            className="p-6 bg-white/20 rounded-full backdrop-blur-sm hover:bg-white/30 transition-colors pointer-events-auto"
          >
            <Play className="h-16 w-16 text-white fill-white" />
          </button>
        </div>
      )}

      {/* Bottom Controls */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 px-4 pb-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Progress Bar */}
        <div className="mb-4 group/progress">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:opacity-0 group-hover/progress:[&_[role=slider]]:opacity-100 [&_[role=slider]]:transition-opacity [&_[role=slider]]:bg-red-600 [&_[role=slider]]:border-0 [&>span:first-child]:h-1 group-hover/progress:[&>span:first-child]:h-1.5 [&>span:first-child]:transition-all [&>span:first-child>span]:bg-red-600"
          />
        </div>

        {/* Control Buttons Row */}
        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button 
              onClick={togglePlay}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              {isPlaying ? (
                <Pause className="h-8 w-8 text-white fill-white" />
              ) : (
                <Play className="h-8 w-8 text-white fill-white" />
              )}
            </button>

            {/* Rewind 10s */}
            <button 
              onClick={() => skip(-10)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors relative"
            >
              <RotateCcw className="h-7 w-7 text-white" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5">10</span>
            </button>

            {/* Forward 10s */}
            <button 
              onClick={() => skip(10)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors relative"
            >
              <RotateCw className="h-7 w-7 text-white" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5">10</span>
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group/volume">
              <button 
                onClick={toggleMute}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-7 w-7 text-white" />
                ) : (
                  <Volume2 className="h-7 w-7 text-white" />
                )}
              </button>
              <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-200">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={(v) => changeVolume(v[0])}
                  className="cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white"
                />
              </div>
            </div>

            {/* Time Display */}
            <span className="text-white text-sm ml-2 font-medium tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Center - Title */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4">
            <h1 className="text-white text-lg font-semibold tracking-wide">
              {title}
            </h1>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1">
            {/* Subtitles */}
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCaptionsMenu(!showCaptionsMenu);
                  setShowSettingsMenu(false);
                }}
                className={cn(
                  "captions-button p-2 hover:bg-white/10 rounded-full transition-colors",
                  captionsEnabled && "text-red-500"
                )}
              >
                <Subtitles className={cn("h-7 w-7", captionsEnabled ? "text-red-500" : "text-white")} />
              </button>
              
              {/* Captions Menu */}
              {showCaptionsMenu && (
                <div className="captions-menu absolute bottom-full right-0 mb-2 bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-zinc-700 overflow-hidden min-w-[250px] shadow-xl">
                  <div className="px-4 py-3 border-b border-zinc-700">
                    <h3 className="text-white font-semibold text-sm">Subtitles</h3>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setCaptionsEnabled(false); setShowCaptionsMenu(false); }}
                      className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors"
                    >
                      <span className="text-white text-sm">Off</span>
                      {!captionsEnabled && <Check className="h-4 w-4 text-red-500" />}
                    </button>
                    {captionsAvailable && (
                      <button
                        onClick={() => { setCaptionsEnabled(true); setShowCaptionsMenu(false); }}
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors"
                      >
                        <span className="text-white text-sm">English [CC]</span>
                        {captionsEnabled && <Check className="h-4 w-4 text-red-500" />}
                      </button>
                    )}
                  </div>
                  <div className="px-4 py-3 border-t border-zinc-700 bg-zinc-800/50">
                    {captionsAvailable ? (
                      <p className="text-green-400 text-xs flex items-center gap-1">
                        <Check className="h-3 w-3" /> Captions available
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-zinc-400 text-xs">No captions available for this video.</p>
                        <button
                          onClick={generateCaptions}
                          disabled={isGeneratingCaptions}
                          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 text-white text-sm py-2 px-3 rounded transition-colors"
                        >
                          {isGeneratingCaptions ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate with AI
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettingsMenu(!showSettingsMenu);
                  setShowCaptionsMenu(false);
                }}
                className="settings-button p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Settings className="h-7 w-7 text-white" />
              </button>
              
              {/* Settings Menu */}
              {showSettingsMenu && (
                <div className="settings-menu absolute bottom-full right-0 mb-2 bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-zinc-700 overflow-hidden min-w-[300px] shadow-xl">
                  {/* Tabs */}
                  <div className="flex border-b border-zinc-700">
                    <button
                      onClick={() => setSettingsTab('speed')}
                      className={cn(
                        "flex-1 px-3 py-3 text-xs font-medium transition-colors",
                        settingsTab === 'speed' 
                          ? "text-white border-b-2 border-red-500" 
                          : "text-zinc-400 hover:text-white"
                      )}
                    >
                      Speed
                    </button>
                    <button
                      onClick={() => setSettingsTab('quality')}
                      className={cn(
                        "flex-1 px-3 py-3 text-xs font-medium transition-colors",
                        settingsTab === 'quality' 
                          ? "text-white border-b-2 border-red-500" 
                          : "text-zinc-400 hover:text-white"
                      )}
                    >
                      Quality
                    </button>
                    <button
                      onClick={() => setSettingsTab('enhance')}
                      className={cn(
                        "flex-1 px-3 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1",
                        settingsTab === 'enhance' 
                          ? "text-white border-b-2 border-red-500" 
                          : "text-zinc-400 hover:text-white"
                      )}
                    >
                      <Sparkles className="h-3 w-3" />
                      Enhance
                    </button>
                  </div>
                  
                  {/* Speed Tab */}
                  {settingsTab === 'speed' && (
                    <div className="py-1 max-h-64 overflow-y-auto">
                      {PLAYBACK_SPEEDS.map((speed) => (
                        <button
                          key={speed}
                          onClick={() => changePlaybackSpeed(speed)}
                          className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors"
                        >
                          <span className="text-white text-sm">
                            {speed === 1 ? 'Normal' : `${speed}x`}
                          </span>
                          {playbackSpeed === speed && <Check className="h-4 w-4 text-red-500" />}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Quality Tab */}
                  {settingsTab === 'quality' && (
                    <div className="py-1 max-h-80 overflow-y-auto">
                      {/* Current video info */}
                      {videoResolution && (
                        <div className="px-4 py-2 border-b border-zinc-700 bg-zinc-800/50">
                          <p className="text-zinc-400 text-xs">
                            Source: {videoResolution.width}×{videoResolution.height} ({getQualityLabel(videoResolution.height)})
                          </p>
                        </div>
                      )}
                      
                      {/* Auto option */}
                      <button
                        onClick={() => { setSelectedQuality('auto'); setShowSettingsMenu(false); }}
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm">Auto</span>
                          {videoResolution && (
                            <span className="text-zinc-400 text-xs bg-zinc-700 px-1.5 py-0.5 rounded">
                              {getQualityLabel(videoResolution.height)}
                            </span>
                          )}
                        </div>
                        {selectedQuality === 'auto' && <Check className="h-4 w-4 text-red-500" />}
                      </button>
                      
                      {/* Quality options */}
                      {QUALITY_OPTIONS.map((q) => {
                        const isUpscaled = videoResolution && videoResolution.height < q.value;
                        const isNative = videoResolution && 
                          Math.abs(videoResolution.height - q.value) < 100;
                        
                        return (
                          <button
                            key={q.value}
                            onClick={() => {
                              setSelectedQuality(q.label);
                              // Auto-enable AI Enhance when selecting upscaled quality
                              if (isUpscaled && enhancementPreset === 'off') {
                                setEnhancementPreset('ai-enhance');
                                setUseUpscaleRendering(true);
                              }
                              setShowSettingsMenu(false);
                            }}
                            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm">
                                {q.label}
                              </span>
                              {q.badge && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
                                  {q.badge}
                                </span>
                              )}
                              {isUpscaled && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-400">
                                  Upscaled
                                </span>
                              )}
                              {isNative && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-600/30 text-green-400">
                                  Native
                                </span>
                              )}
                            </div>
                            {selectedQuality === q.label && <Check className="h-4 w-4 text-red-500" />}
                          </button>
                        );
                      })}
                      
                      <div className="px-4 py-2 border-t border-zinc-700 bg-zinc-800/50">
                        <p className="text-zinc-500 text-xs">
                          <span className="text-amber-400">Upscaled</span> = stretched beyond source resolution (no quality gain).
                          <span className="text-green-400 ml-1">Native</span> = original video quality.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Enhance Tab */}
                  {settingsTab === 'enhance' && (
                    <div className="py-1 max-h-80 overflow-y-auto">
                      <div className="px-4 py-2 border-b border-zinc-700 bg-zinc-800/50">
                        <p className="text-zinc-400 text-xs">
                          Real-time video enhancement filters
                        </p>
                      </div>
                      
                      {ENHANCEMENT_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => {
                            setEnhancementPreset(preset.value);
                            setUseUpscaleRendering(preset.useUpscaleRendering || false);
                          }}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors"
                        >
                          <div className="flex flex-col items-start gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm">{preset.label}</span>
                              {preset.value === 'ai-enhance' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600/30 text-purple-400 flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" /> AI
                                </span>
                              )}
                            </div>
                            <span className="text-zinc-500 text-xs">{preset.description}</span>
                          </div>
                          {enhancementPreset === preset.value && <Check className="h-4 w-4 text-red-500" />}
                        </button>
                      ))}
                      
                      <div className="px-4 py-3 border-t border-zinc-700 bg-zinc-800/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-xs">High-Quality Rendering</span>
                          <button
                            onClick={() => setUseUpscaleRendering(!useUpscaleRendering)}
                            className={cn(
                              "w-10 h-5 rounded-full transition-colors relative",
                              useUpscaleRendering ? "bg-red-600" : "bg-zinc-600"
                            )}
                          >
                            <span 
                              className={cn(
                                "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                                useUpscaleRendering ? "left-5" : "left-0.5"
                              )}
                            />
                          </button>
                        </div>
                        <p className="text-zinc-500 text-xs">
                          Uses browser's best upscaling algorithm for smoother edges when viewing above native resolution.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button 
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              {isFullscreen ? (
                <Minimize className="h-7 w-7 text-white" />
              ) : (
                <Maximize className="h-7 w-7 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Captions Display */}
      {captionsEnabled && currentCaption && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-none z-20">
          <div className="bg-black/80 px-6 py-3 rounded text-white text-xl text-center max-w-3xl shadow-lg">
            <p>{currentCaption}</p>
          </div>
        </div>
      )}
    </div>
  );
}
