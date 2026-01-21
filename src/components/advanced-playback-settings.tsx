'use client';

import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useApp } from '@/hooks/use-app-context';
import { Separator } from '@/components/ui/separator';

export function AdvancedPlaybackSettings() {
  const { playbackSettings, updatePlaybackSettings, isLoaded } = useApp();
  const [isOpen, setIsOpen] = useState(false);

  if (!isLoaded) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Settings className="h-4 w-4" />
          <span className="sr-only">Playback Settings</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Playback Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Volume */}
          <div className="space-y-3">
            <Label>Default Volume: {Math.round(playbackSettings.defaultVolume * 100)}%</Label>
            <Slider
              value={[playbackSettings.defaultVolume * 100]}
              onValueChange={([value]) => updatePlaybackSettings({ defaultVolume: value / 100 })}
              max={100}
              step={5}
            />
          </div>

          <Separator />

          {/* Playback Speed */}
          <div className="space-y-3">
            <Label>Default Playback Speed</Label>
            <Select
              value={String(playbackSettings.defaultPlaybackSpeed)}
              onValueChange={(value) => updatePlaybackSettings({ defaultPlaybackSpeed: parseFloat(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="0.75">0.75x</SelectItem>
                <SelectItem value="1">1x (Normal)</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Quality */}
          <div className="space-y-3">
            <Label>Default Quality</Label>
            <Select
              value={playbackSettings.defaultQuality}
              onValueChange={(value) => updatePlaybackSettings({ defaultQuality: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="2160">4K</SelectItem>
                <SelectItem value="1080">1080p</SelectItem>
                <SelectItem value="720">720p</SelectItem>
                <SelectItem value="480">480p</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Enhancement */}
          <div className="space-y-3">
            <Label>Default Enhancement</Label>
            <Select
              value={playbackSettings.defaultEnhancement}
              onValueChange={(value) => updatePlaybackSettings({ defaultEnhancement: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="sharpen">Sharpen</SelectItem>
                <SelectItem value="vivid">Vivid</SelectItem>
                <SelectItem value="cinema">Cinema</SelectItem>
                <SelectItem value="ai-enhance">AI Enhance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Autoplay */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Autoplay</Label>
              <p className="text-xs text-muted-foreground">
                Start playing videos automatically
              </p>
            </div>
            <Switch
              checked={playbackSettings.autoplay}
              onCheckedChange={(checked) => updatePlaybackSettings({ autoplay: checked })}
            />
          </div>

          <Separator />

          {/* Captions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Captions</Label>
                <p className="text-xs text-muted-foreground">
                  Display captions by default
                </p>
              </div>
              <Switch
                checked={playbackSettings.showCaptions}
                onCheckedChange={(checked) => updatePlaybackSettings({ showCaptions: checked })}
              />
            </div>

            {playbackSettings.showCaptions && (
              <>
                <div className="space-y-3">
                  <Label>Caption Size</Label>
                  <Select
                    value={playbackSettings.captionSize}
                    onValueChange={(value: 'small' | 'medium' | 'large') => 
                      updatePlaybackSettings({ captionSize: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Caption Background</Label>
                  <Switch
                    checked={playbackSettings.captionBackground}
                    onCheckedChange={(checked) => updatePlaybackSettings({ captionBackground: checked })}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
