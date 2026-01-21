'use client';

import { useState, useRef, useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useFirebaseAuth } from '@/components/firebase-auth-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { uploadVideo } from '@/app/actions';
import { downloadsStore } from '@/lib/downloads-store';
import { Loader2, UploadCloud, FileVideo, X, Link, Download, Zap, Check, LogIn } from 'lucide-react';

function UploadSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Uploading...
        </>
      ) : (
        <>
          <UploadCloud className="mr-2 h-4 w-4" />
          Upload File
        </>
      )}
    </Button>
  );
}

export function UploadDialog() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [activeTab, setActiveTab] = useState('file');
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const urlFormRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, loading, signInWithGoogle } = useFirebaseAuth();
  
  // Check if user is signed in with Google (has Firebase auth)
  const isGoogleAuthenticated = !!user;
  
  const [uploadState, uploadFormAction] = useActionState(uploadVideo, null);

  useEffect(() => {
    if (!uploadState) return;

    if (uploadState.error) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: uploadState.error,
      });
    } else if (uploadState.success) {
      toast({
        title: 'Upload Successful',
        description: uploadState.success,
      });
      setOpen(false);
    }
  }, [uploadState, toast]);

  // Check if URL requires browser authentication (cookies)
  const requiresBrowserAuth = (url: string): boolean => {
    const authDomains = [
      'googleusercontent.com',
      'googlevideo.com', 
      'youtube.com',
      'drive.google.com',
      'docs.google.com',
      'video-downloads.googleusercontent.com',
    ];
    const urlLower = url.toLowerCase();
    return authDomains.some(domain => urlLower.includes(domain));
  };

  // Turbo download using VM proxy with Google access token
  const handleTurboProxyDownload = async (
    url: string,
    customName: string,
    downloadId: string | null,
    accessToken: string
  ): Promise<boolean> => {
    try {
      setImportStatus('🚀 Turbo Mode: Sending to datacenter proxy...');
      
      // Generate filename
      let fileName = customName || url.split('/').pop()?.split('?')[0] || 'download';
      if (!fileName.includes('.')) {
        fileName += '.mp4';
      }
      fileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      // Start the download job on proxy
      const startRes = await fetch('/api/turbo-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, fileName, accessToken }),
      });
      
      if (!startRes.ok) {
        const error = await startRes.text();
        throw new Error(error);
      }
      
      const { jobId } = await startRes.json();
      
      // Poll for progress
      const startTime = Date.now();
      while (true) {
        await new Promise(r => setTimeout(r, 500));
        
        const statusRes = await fetch(`/api/turbo-download?jobId=${jobId}`);
        if (!statusRes.ok) throw new Error('Failed to get status');
        
        const job = await statusRes.json();
        
        setImportProgress(Math.round(job.progress));
        
        if (job.speed > 0) {
          setImportStatus(`🚀 ${job.speed.toFixed(1)} MB/s - ${formatBytes(job.downloadedSize)} / ${formatBytes(job.totalSize)}`);
        }
        
        if (downloadId && downloadsStore) {
          downloadsStore.update(downloadId, {
            progress: job.progress,
            speed: job.speed,
            downloadedSize: job.downloadedSize,
            totalSize: job.totalSize,
          });
        }
        
        if (job.status === 'completed') {
          const elapsed = (Date.now() - startTime) / 1000;
          const avgSpeed = job.downloadedSize > 0 ? (job.downloadedSize / (1024 * 1024)) / elapsed : 0;
          
          if (downloadId && downloadsStore) {
            downloadsStore.update(downloadId, {
              status: 'completed',
              progress: 100,
              fileName: job.fileName,
            });
          }
          
          toast({
            title: '🚀 Turbo Import Complete!',
            description: `Imported "${job.fileName}" at ${avgSpeed.toFixed(1)} MB/s average`,
          });
          return true;
        }
        
        if (job.status === 'error') {
          throw new Error(job.error || 'Download failed');
        }
      }
    } catch (error: any) {
      console.error('Turbo proxy download failed:', error);
      setImportStatus(`Turbo failed: ${error.message}`);
      return false;
    }
  };
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // High-speed browser streaming - only works for CORS-enabled URLs
  const handleBrowserStreamDownload = async (
    url: string,
    customName: string,
    downloadId: string | null
  ): Promise<boolean> => {
    const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
    const MAX_PARALLEL = 6;
    
    try {
      setImportStatus('⚡ Checking direct access...');
      
      // Try to fetch - this will fail for CORS-blocked URLs like Google
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      let response: Response;
      try {
        response = await fetch(url, { 
          credentials: 'include',
          signal: controller.signal,
        });
        clearTimeout(timeout);
      } catch (e: any) {
        clearTimeout(timeout);
        // CORS blocked or network error - fall back silently
        console.log('Browser fetch blocked (CORS), using server streaming');
        return false;
      }
      
      if (!response.ok) {
        return false;
      }
      
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      const contentType = response.headers.get('content-type') || 'video/mp4';
      
      let fileName = customName || url.split('/').pop() || 'imported-video.mp4';
      if (customName && !customName.includes('.')) {
        fileName = customName + '.mp4';
      }
      
      // Initialize upload session
      const initRes = await fetch('/api/stream-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'init',
          fileName,
          contentType,
          totalSize: contentLength,
        }),
      });
      
      if (!initRes.ok) throw new Error('Failed to init upload');
      const { uploadId, fileName: sanitizedName } = await initRes.json();
      
      setImportStatus('⚡ Turbo Mode: Streaming at max speed...');
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      let uploadedSize = 0;
      let blockIndex = 0;
      let buffer = new Uint8Array(0);
      const startTime = Date.now();
      const pendingUploads: Promise<void>[] = [];
      
      const uploadChunk = async (chunk: Uint8Array, idx: number) => {
        const blockId = btoa(String(idx).padStart(6, '0'));
        
        // Convert to base64
        let binary = '';
        for (let i = 0; i < chunk.length; i++) {
          binary += String.fromCharCode(chunk[i]);
        }
        const base64 = btoa(binary);
        
        const res = await fetch('/api/stream-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'chunk',
            uploadId,
            blockId,
            chunk: base64,
          }),
        });
        
        if (!res.ok) throw new Error('Chunk upload failed');
        
        uploadedSize += chunk.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? (uploadedSize / (1024 * 1024)) / elapsed : 0;
        const progress = contentLength > 0 ? Math.round((uploadedSize / contentLength) * 100) : 50;
        
        setImportProgress(progress);
        setImportStatus(
          `⚡ Turbo: ${(uploadedSize / (1024 * 1024)).toFixed(1)}MB / ${(contentLength / (1024 * 1024)).toFixed(1)}MB (${speed.toFixed(1)} MB/s)`
        );
        
        if (downloadId && downloadsStore) {
          downloadsStore.update(downloadId, {
            status: 'downloading',
            progress,
            speed,
            downloadedSize: uploadedSize,
            totalSize: contentLength,
            isUltraFast: true,
          });
        }
      };
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;
        }
        
        while (buffer.length >= CHUNK_SIZE || (done && buffer.length > 0)) {
          const chunkSize = Math.min(buffer.length, CHUNK_SIZE);
          const chunk = buffer.slice(0, chunkSize);
          buffer = buffer.slice(chunkSize);
          
          const currentIdx = blockIndex++;
          
          // Limit parallel uploads
          if (pendingUploads.length >= MAX_PARALLEL) {
            await Promise.race(pendingUploads);
          }
          
          const uploadPromise = uploadChunk(chunk, currentIdx).finally(() => {
            const idx = pendingUploads.indexOf(uploadPromise);
            if (idx > -1) pendingUploads.splice(idx, 1);
          });
          pendingUploads.push(uploadPromise);
          
          if (done && buffer.length === 0) break;
        }
        
        if (done) break;
      }
      
      // Wait for all uploads
      await Promise.all(pendingUploads);
      
      // Complete
      setImportStatus('⚡ Finalizing...');
      const completeRes = await fetch('/api/stream-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', uploadId }),
      });
      
      if (!completeRes.ok) throw new Error('Failed to complete');
      const { fileName: finalName, avgSpeed } = await completeRes.json();
      
      if (downloadId && downloadsStore) {
        downloadsStore.update(downloadId, {
          status: 'completed',
          progress: 100,
          fileName: finalName,
        });
      }
      
      toast({
        title: '⚡ Turbo Import Complete!',
        description: `Imported "${finalName}" at ${avgSpeed} MB/s average`,
      });
      
      return true;
    } catch (error: any) {
      console.log('Browser stream failed, falling back:', error.message);
      return false;
    }
  };

  const handleImportFromUrl = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = formData.get('url') as string;
    const customName = formData.get('customName') as string;

    if (!url) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a URL' });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Starting import...');

    // Add to downloads store
    const downloadId = downloadsStore?.add({
      fileName: customName || 'Importing...',
      customName: customName || undefined,
      url,
      status: 'pending',
      progress: 0,
      speed: 0,
      downloadedSize: 0,
      totalSize: 0,
    });

    try {
      // Check if this is a Google URL that needs authentication
      const isAuthUrl = requiresBrowserAuth(url);
      
      // For authenticated URLs, use Firebase user ID token
      if (isAuthUrl) {
        if (isGoogleAuthenticated && user) {
          // Get Firebase ID token for turbo download
          const idToken = await user.getIdToken();
          // Automatically use ID token for turbo download
          setImportStatus('🚀 Turbo Mode: Using Google account...');
          const success = await handleTurboProxyDownload(url, customName, downloadId, idToken);
          
          if (success) {
            setOpen(false);
            setIsImporting(false);
            setImportProgress(0);
            setImportStatus('');
            window.location.reload();
            return;
          }
          // Token might have issues
          setImportStatus('⚠️ Turbo download failed. Trying fallback...');
        } else {
          // Not signed in - prompt for Google sign-in
          setIsImporting(false);
          setImportStatus('');
          toast({
            title: 'Sign in Required',
            description: 'Sign in with Google to enable fast downloads for Google Drive/YouTube URLs.',
          });
          return;
        }
      }
      
      // For non-authenticated URLs, try browser-side streaming first
      setImportStatus('⚡ Checking direct access...');
      const success = await handleBrowserStreamDownload(url, customName, downloadId);
      
      if (success) {
        setOpen(false);
        setIsImporting(false);
        setImportProgress(0);
        setImportStatus('');
        window.location.reload();
        return;
      }
      
      // Fall back to server-side if browser streaming failed
      setImportStatus('Using server streaming...');
      if (downloadId && downloadsStore) {
        downloadsStore.update(downloadId, { isUltraFast: false });
      }
      
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, customName }),
      });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to read response');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.progress !== undefined) {
                setImportProgress(data.progress);
              }
              if (data.status) {
                setImportStatus(data.status);
                
                // Parse status for download store updates
                const isUltraFast = data.status.includes('🚀') || data.status.includes('Ultra');
                
                // Try to parse size info from status
                const sizeMatch = data.status.match(/(\d+\.?\d*)\s*MB\s*\/\s*(\d+\.?\d*)\s*MB/);
                const speedMatch = data.status.match(/\((\d+\.?\d*)\s*MB\/s\)/);
                
                if (downloadId && downloadsStore) {
                  const updates: any = {
                    status: 'downloading' as const,
                    progress: data.progress || 0,
                    isUltraFast,
                  };
                  
                  if (sizeMatch) {
                    updates.downloadedSize = parseFloat(sizeMatch[1]) * 1024 * 1024;
                    updates.totalSize = parseFloat(sizeMatch[2]) * 1024 * 1024;
                  }
                  
                  if (speedMatch) {
                    updates.speed = parseFloat(speedMatch[1]);
                  } else if (updates.downloadedSize) {
                    // Calculate speed from elapsed time
                    const elapsed = (Date.now() - startTime) / 1000;
                    if (elapsed > 0) {
                      updates.speed = (updates.downloadedSize / (1024 * 1024)) / elapsed;
                    }
                  }
                  
                  if (data.fileName) {
                    updates.fileName = data.fileName;
                  }
                  
                  downloadsStore.update(downloadId, updates);
                }
              }
              if (data.error) {
                if (downloadId && downloadsStore) {
                  downloadsStore.update(downloadId, {
                    status: 'error',
                    error: data.error,
                  });
                }
                toast({
                  variant: 'destructive',
                  title: 'Import Failed',
                  description: data.error,
                });
                setIsImporting(false);
                setImportProgress(0);
                setImportStatus('');
                return;
              }
              if (data.success) {
                if (downloadId && downloadsStore) {
                  downloadsStore.update(downloadId, {
                    status: 'completed',
                    progress: 100,
                    fileName: data.fileName,
                  });
                }
                toast({
                  title: 'Import Successful',
                  description: `Successfully imported "${data.fileName}"`,
                });
                setOpen(false);
                setIsImporting(false);
                setImportProgress(0);
                setImportStatus('');
                // Refresh the page to show new video
                window.location.reload();
                return;
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }
    } catch (error) {
      if (downloadId && downloadsStore) {
        downloadsStore.update(downloadId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'An error occurred',
        });
      }
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }

    setIsImporting(false);
    setImportProgress(0);
    setImportStatus('');
  };


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFileName(selectedFile.name);
    } else {
        setFileName('');
    }
  };

  const clearFile = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setFileName('');
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (isImporting) return; // Prevent closing while importing
    setOpen(isOpen);
    if (!isOpen) {
      clearFile();
      formRef.current?.reset();
      urlFormRef.current?.reset();
      setImportProgress(0);
      setImportStatus('');
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button>
          <UploadCloud className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add a Video</DialogTitle>
          <DialogDescription>
            Upload a local file or import from a URL to add to your library.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="flex items-center gap-2">
              <UploadCloud className="h-4 w-4" />
              Local File
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              From URL
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="file" className="mt-4">
            <form ref={formRef} action={uploadFormAction}>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Video File</Label>
                  <Label htmlFor="file" className="relative block cursor-pointer">
                    <Input
                      id="file"
                      name="file"
                      type="file"
                      required
                      accept="video/*"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />

                    {fileName ? (
                      <div className="flex items-center justify-between p-2 h-10 rounded-md border bg-muted/50">
                        <div className="flex items-center gap-2 truncate">
                          <FileVideo className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm font-normal">{fileName}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 z-10"
                          onClick={clearFile}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm text-muted-foreground">
                        Click to select a file
                      </div>
                    )}
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uploadCustomName">Custom Name (optional)</Label>
                  <Input
                    id="uploadCustomName"
                    name="customName"
                    type="text"
                    placeholder="My Video"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use the original filename
                  </p>
                </div>
                <input type="hidden" name="destination" value="azure" />
                <UploadSubmitButton />
              </div>
            </form>
          </TabsContent>
          
          <TabsContent value="url" className="mt-4">
            <form ref={urlFormRef} onSubmit={handleImportFromUrl}>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Video URL</Label>
                  <Input
                    id="url"
                    name="url"
                    type="url"
                    placeholder="https://drive.google.com/file/d/..."
                    required
                    disabled={isImporting}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Any downloadable URL - Google Drive, OneDrive, Dropbox, direct links, etc.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customName">Custom Name (optional)</Label>
                  <Input
                    id="customName"
                    name="customName"
                    type="text"
                    placeholder="My Video"
                    disabled={isImporting}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use the filename from the URL
                  </p>
                </div>
                
                {/* Google Sign-in for Turbo Mode */}
                {isGoogleAuthenticated ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400">
                        🚀 Turbo Mode enabled - Signed in as {user?.email}
                      </span>
                    </div>
                  </div>
                ) : loading ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Checking authentication...</span>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                    <div className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-yellow-500 mt-0.5" />
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">Enable Turbo Mode (40-60+ MB/s)</p>
                        <p>Sign in with Google to enable datacenter-speed downloads for Google Drive and YouTube URLs.</p>
                      </div>
                    </div>
                    <Button onClick={() => signInWithGoogle()} className="w-full" disabled={isImporting}>
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign in with Google
                    </Button>
                  </div>
                )}
                
                {isImporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{importStatus}</span>
                      <span className="font-medium">{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                  </div>
                )}
                
                <Button type="submit" disabled={isImporting} className="w-full">
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Import from URL
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
