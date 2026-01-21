'use client';

import { useDownloads, type Download } from '@/lib/downloads-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Download as DownloadIcon, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Zap,
  Clock,
  HardDrive,
  Gauge,
  Film,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(mbps: number): string {
  if (mbps >= 1000) {
    return `${(mbps / 1000).toFixed(1)} GB/s`;
  }
  return `${mbps.toFixed(1)} MB/s`;
}

function formatETA(downloadedBytes: number, totalBytes: number, speedMBps: number): string {
  if (speedMBps <= 0 || totalBytes === 0) return '--';
  const remainingBytes = totalBytes - downloadedBytes;
  const remainingSeconds = remainingBytes / (speedMBps * 1024 * 1024);
  
  if (remainingSeconds < 60) return `${Math.round(remainingSeconds)}s`;
  if (remainingSeconds < 3600) return `${Math.round(remainingSeconds / 60)}m`;
  return `${(remainingSeconds / 3600).toFixed(1)}h`;
}

function DownloadCard({ download, onRemove }: { download: Download; onRemove: () => void }) {
  const isActive = download.status === 'pending' || download.status === 'downloading';
  const isCompleted = download.status === 'completed';
  const isError = download.status === 'error';

  return (
    <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`p-3 rounded-lg ${
          isActive ? 'bg-blue-500/20 text-blue-400' :
          isCompleted ? 'bg-green-500/20 text-green-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {isActive ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isCompleted ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <XCircle className="h-6 w-6" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{download.customName || download.fileName}</h3>
            {download.isUltraFast && (
              <span className="flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                <Zap className="h-3 w-3" />
                Ultra-Fast
              </span>
            )}
          </div>

          {/* Progress bar for active downloads */}
          {isActive && (
            <div className="mt-3 space-y-2">
              <Progress value={download.progress} className="h-2" />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3.5 w-3.5" />
                    {formatBytes(download.downloadedSize)} / {formatBytes(download.totalSize)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5" />
                    {formatSpeed(download.speed)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    ETA: {formatETA(download.downloadedSize, download.totalSize, download.speed)}
                  </span>
                </div>
                <span className="font-medium text-foreground">{download.progress}%</span>
              </div>
            </div>
          )}

          {/* Completed info */}
          {isCompleted && (
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" />
                {formatBytes(download.totalSize)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDistanceToNow(download.startTime, { addSuffix: true })}
              </span>
            </div>
          )}

          {/* Error info */}
          {isError && (
            <p className="mt-2 text-sm text-red-400">{download.error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isCompleted && (
            <Link href={`/watch/${encodeURIComponent(download.fileName)}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Film className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {!isActive && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-red-400"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function StatsCard({ label, value, icon: Icon, className }: { 
  label: string; 
  value: string | number; 
  icon: any;
  className?: string;
}) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

export default function DownloadsPage() {
  const { downloads, activeDownloads, completedDownloads, failedDownloads, clearCompleted, remove } = useDownloads();

  const totalSpeed = activeDownloads.reduce((sum, d) => sum + d.speed, 0);
  const totalDownloaded = completedDownloads.reduce((sum, d) => sum + d.totalSize, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <DownloadIcon className="h-8 w-8 text-primary" />
              Downloads
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your video imports and downloads
            </p>
          </div>
          {(completedDownloads.length > 0 || failedDownloads.length > 0) && (
            <Button variant="outline" onClick={clearCompleted}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear History
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatsCard 
            label="Active Downloads" 
            value={activeDownloads.length} 
            icon={Loader2}
          />
          <StatsCard 
            label="Current Speed" 
            value={formatSpeed(totalSpeed)} 
            icon={Gauge}
          />
          <StatsCard 
            label="Completed" 
            value={completedDownloads.length} 
            icon={CheckCircle2}
          />
          <StatsCard 
            label="Total Downloaded" 
            value={formatBytes(totalDownloaded)} 
            icon={HardDrive}
          />
        </div>

        {/* Active Downloads */}
        {activeDownloads.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              Active Downloads ({activeDownloads.length})
            </h2>
            <div className="space-y-3">
              {activeDownloads.map(download => (
                <DownloadCard 
                  key={download.id} 
                  download={download} 
                  onRemove={() => remove(download.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Completed Downloads */}
        {completedDownloads.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              Completed ({completedDownloads.length})
            </h2>
            <div className="space-y-3">
              {completedDownloads.map(download => (
                <DownloadCard 
                  key={download.id} 
                  download={download} 
                  onRemove={() => remove(download.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Failed Downloads */}
        {failedDownloads.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-400" />
              Failed ({failedDownloads.length})
            </h2>
            <div className="space-y-3">
              {failedDownloads.map(download => (
                <DownloadCard 
                  key={download.id} 
                  download={download} 
                  onRemove={() => remove(download.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {downloads.length === 0 && (
          <div className="text-center py-16">
            <DownloadIcon className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Downloads Yet</h3>
            <p className="text-muted-foreground mb-6">
              Import videos from URLs to see them here
            </p>
            <Link href="/">
              <Button>
                <Film className="h-4 w-4 mr-2" />
                Go to Library
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
