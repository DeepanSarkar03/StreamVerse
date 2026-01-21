'use client';

// Global downloads state management
export interface Download {
  id: string;
  fileName: string;
  customName?: string;
  url: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number;
  speed: number; // MB/s
  downloadedSize: number; // bytes
  totalSize: number; // bytes
  startTime: number;
  error?: string;
  isUltraFast?: boolean;
}

type DownloadListener = (downloads: Download[]) => void;

class DownloadsStore {
  private downloads: Map<string, Download> = new Map();
  private listeners: Set<DownloadListener> = new Set();

  constructor() {
    // Load from localStorage on init
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('streamverse_downloads');
        if (stored) {
          const parsed = JSON.parse(stored) as Download[];
          // Only load completed/error downloads, not in-progress ones
          parsed.forEach(d => {
            if (d.status === 'completed' || d.status === 'error') {
              this.downloads.set(d.id, d);
            }
          });
        }
      } catch {}
    }
  }

  private notify() {
    const downloads = this.getAll();
    this.listeners.forEach(listener => listener(downloads));
    this.persist();
  }

  private persist() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('streamverse_downloads', JSON.stringify(this.getAll()));
      } catch {}
    }
  }

  subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getAll(): Download[] {
    return Array.from(this.downloads.values()).sort((a, b) => b.startTime - a.startTime);
  }

  get(id: string): Download | undefined {
    return this.downloads.get(id);
  }

  add(download: Omit<Download, 'id' | 'startTime'>): string {
    const id = `download_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newDownload: Download = {
      ...download,
      id,
      startTime: Date.now(),
    };
    this.downloads.set(id, newDownload);
    this.notify();
    return id;
  }

  update(id: string, updates: Partial<Download>) {
    const existing = this.downloads.get(id);
    if (existing) {
      this.downloads.set(id, { ...existing, ...updates });
      this.notify();
    }
  }

  remove(id: string) {
    this.downloads.delete(id);
    this.notify();
  }

  clearCompleted() {
    for (const [id, download] of this.downloads) {
      if (download.status === 'completed' || download.status === 'error') {
        this.downloads.delete(id);
      }
    }
    this.notify();
  }

  getActiveCount(): number {
    return Array.from(this.downloads.values()).filter(
      d => d.status === 'pending' || d.status === 'downloading'
    ).length;
  }
}

// Singleton instance
export const downloadsStore = typeof window !== 'undefined' 
  ? new DownloadsStore() 
  : null as unknown as DownloadsStore;

// React hook
import { useState, useEffect } from 'react';

export function useDownloads() {
  const [downloads, setDownloads] = useState<Download[]>([]);

  useEffect(() => {
    if (!downloadsStore) return;
    
    // Initial load
    setDownloads(downloadsStore.getAll());
    
    // Subscribe to updates
    const unsubscribe = downloadsStore.subscribe(setDownloads);
    return unsubscribe;
  }, []);

  return {
    downloads,
    activeDownloads: downloads.filter(d => d.status === 'pending' || d.status === 'downloading'),
    completedDownloads: downloads.filter(d => d.status === 'completed'),
    failedDownloads: downloads.filter(d => d.status === 'error'),
    clearCompleted: () => downloadsStore?.clearCompleted(),
    remove: (id: string) => downloadsStore?.remove(id),
  };
}
