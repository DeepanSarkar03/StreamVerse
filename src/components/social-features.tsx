'use client';

import { useState } from 'react';
import { Star, MessageSquare, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/hooks/use-app-context';
import { cn } from '@/lib/utils';

interface RatingStarsProps {
  videoId: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function RatingStars({ videoId, size = 'md', showLabel = true }: RatingStarsProps) {
  const { getRating, setRating } = useApp();
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const currentRating = getRating(videoId) || 0;
  const displayRating = hoverRating ?? currentRating;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(videoId, star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                sizeClasses[size],
                'transition-colors',
                star <= displayRating
                  ? 'fill-yellow-500 text-yellow-500'
                  : 'fill-transparent text-muted-foreground hover:text-yellow-400'
              )}
            />
          </button>
        ))}
      </div>
      {showLabel && currentRating > 0 && (
        <span className="text-sm text-muted-foreground">
          {currentRating}/5
        </span>
      )}
    </div>
  );
}

interface ReviewSectionProps {
  videoId: string;
}

export function ReviewSection({ videoId }: ReviewSectionProps) {
  const { getReviewsForVideo, addReview, deleteReview } = useApp();
  const [newReview, setNewReview] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const reviews = getReviewsForVideo(videoId);

  const handleSubmit = () => {
    if (newReview.trim()) {
      addReview(videoId, newReview.trim());
      setNewReview('');
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
      >
        <MessageSquare className="h-4 w-4" />
        Reviews ({reviews.length})
      </button>

      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2">
          {/* Add Review */}
          <div className="space-y-2">
            <Textarea
              placeholder="Write a review..."
              value={newReview}
              onChange={(e) => setNewReview(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newReview.trim()}
            >
              Post Review
            </Button>
          </div>

          {/* Reviews List */}
          {reviews.length > 0 && (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-3 rounded-lg bg-muted/50 space-y-2"
                >
                  <p className="text-sm">{review.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => deleteReview(review.id)}
                      className="text-destructive hover:text-destructive/80 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ShareButtonProps {
  videoId: string;
  title: string;
}

export function ShareButton({ videoId, title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/watch/${encodeURIComponent(videoId)}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Watch ${title} on StreamVerse`,
          text: `Check out ${title} on StreamVerse!`,
          url,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShare}
      className="gap-2"
    >
      <Share2 className="h-4 w-4" />
      {copied ? 'Copied!' : 'Share'}
    </Button>
  );
}
