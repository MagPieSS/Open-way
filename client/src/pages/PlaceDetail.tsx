import { usePlace, usePlaces } from "@/hooks/use-places";
import { useAuth } from "@/hooks/use-auth";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, ArrowLeft, MapPin, Calendar, CheckCircle, AlertTriangle, XCircle, HelpCircle,
  User, Share2, Copy, Navigation, Lightbulb, MessageSquare, Star,
  Bookmark, BookmarkCheck, Upload
} from "lucide-react";
import { SiX, SiFacebook } from "react-icons/si";
import { useSettings } from "@/hooks/use-settings";
import { usePageMeta } from "@/hooks/use-page-meta";
import { ACCESSIBILITY_STATUS, type PlaceMedia, type PlaceTip } from "@shared/schema";
import { format } from "date-fns";
import { AccessibilityMap } from "@/components/AccessibilityMap";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

import { Pencil, Trash2 } from "lucide-react";
import { ReportButton } from "@/components/ReportButton";
import { PlaceImage } from "@/components/PlaceImage";
import { useUpload } from "@/hooks/use-upload";
import { getVerificationBadgeLabel } from "@/lib/accessibility-filtering";
import { PlaceAccessibility } from "@/components/accessibility/PlaceAccessibility";

// Matches the server's upload limit (server/uploads.ts).
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function useMedia(placeId: number) {
  return useQuery<PlaceMedia[]>({
    queryKey: ["/api/places", placeId, "media"],
    queryFn: async () => {
      const res = await fetch(`/api/places/${placeId}/media`);
      if (!res.ok) throw new Error("Failed to fetch media");
      return res.json();
    },
    enabled: !!placeId,
  });
}

function useTips(placeId: number) {
  return useQuery<PlaceTip[]>({
    queryKey: ["/api/places", placeId, "tips"],
    queryFn: async () => {
      const res = await fetch(`/api/places/${placeId}/tips`);
      if (!res.ok) throw new Error("Failed to fetch tips");
      return res.json();
    },
    enabled: !!placeId,
  });
}

export default function PlaceDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { data: place, isLoading: isLoadingPlace } = usePlace(id);
  usePageMeta({
    title: place ? place.name : "Place Details",
    description: place?.description,
  });
  const { data: reviews, isLoading: isLoadingReviews, error: reviewsError } = useQuery<any[]>({
    queryKey: ["/api/places", id, "place-reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/places/${id}/place-reviews`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    },
    enabled: !!id,
  });
  const { data: media, isLoading: isLoadingMedia, error: mediaError } = useMedia(id);
const { data: tips, isLoading: isLoadingTips, error: tipsError } = useTips(id);
  const { data: allPlaces } = usePlaces();
  const { textSize } = useSettings();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const photoInputRef = useRef<HTMLInputElement>(null);
const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editingTipId, setEditingTipId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editRating, setEditRating] = useState<number | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const { uploadFile: uploadToStorage, isUploading: isStorageUploading } = useUpload();

  const uploadMutation = useMutation({
    mutationFn: async ({ objectPath, placeId, caption }: { objectPath: string; placeId: number; caption?: string }) => {
      const res = await apiRequest("POST", "/api/place-media/upload", { placeId, objectPath, caption });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/places", id, "media"] });
      setUploading(false);
      toast({ title: "Photo uploaded successfully!" });
    },
    onError: (err: Error) => {
      setUploading(false);
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so choosing the same file again still triggers a change.
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_PHOTO_BYTES) {
      toast({ variant: "destructive", title: "File too large", description: "Max size is 10MB" });
      return;
    }

    setUploading(true);
    const result = await uploadToStorage(file);
    if (result?.objectPath) {
      uploadMutation.mutate({ objectPath: result.objectPath, placeId: Number(id) });
    } else {
      setUploading(false);
      toast({ variant: "destructive", title: "Upload failed", description: "Could not upload image to storage" });
    }
  };

  const { data: savedStatus, isLoading: isLoadingSaved } = useQuery<{ isSaved: boolean }>({
    queryKey: ["/api/saved-places", id, "check"],
    queryFn: async () => {
      const res = await fetch(`/api/saved-places/${id}/check`);
      if (!res.ok) throw new Error("Failed to check saved status");
      return res.json();
    },
    enabled: !!user && !!id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/saved-places/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-places", id, "check"] });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-places"] });
      toast({
        title: "Place saved!",
        description: "This place has been added to your saved list.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save place. Please try again.",
      });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/saved-places/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-places", id, "check"] });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-places"] });
      toast({
        title: "Place removed",
        description: "This place has been removed from your saved list.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove place. Please try again.",
      });
    },
  });

  // Review mutations
  const updateReviewMutation = useMutation({
    mutationFn: async ({ reviewId, content, rating }: { reviewId: number; content: string; rating?: number }) => {
      await apiRequest("PATCH", `/api/reviews/${reviewId}`, { content, rating });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/places", id, "place-reviews"] });
      setEditingReviewId(null);
      setEditContent("");
      setEditRating(undefined);
      toast({ title: "Review updated" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to update review." });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      await apiRequest("DELETE", `/api/reviews/${reviewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/places", id, "place-reviews"] });
      toast({ title: "Review deleted" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete review." });
    },
  });

  // Tip mutations
  const updateTipMutation = useMutation({
    mutationFn: async ({ tipId, content }: { tipId: number; content: string }) => {
      await apiRequest("PATCH", `/api/tips/${tipId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/places", id, "tips"] });
      setEditingTipId(null);
      setEditContent("");
      toast({ title: "Tip updated" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to update tip." });
    },
  });

  const deleteTipMutation = useMutation({
    mutationFn: async (tipId: number) => {
      await apiRequest("DELETE", `/api/tips/${tipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/places", id, "tips"] });
      toast({ title: "Tip deleted" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete tip." });
    },
  });

  const handleSaveToggle = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please log in to save places.",
      });
      return;
    }
    if (savedStatus?.isSaved) {
      unsaveMutation.mutate();
    } else {
      saveMutation.mutate();
    }
  };

  const mapCenter = useMemo<[number, number]>(
    () => [place?.latitude ? Number(place.latitude) : 39.9526, place?.longitude ? Number(place.longitude) : -75.1652],
    [place?.latitude, place?.longitude],
  );

  const relatedPlaces = allPlaces
    ?.filter((p) => p.category === place?.category && p.id !== id)
    .slice(0, 4) || [];

  const handleShare = async (platform?: string) => {
    const url = window.location.href;
    const title = place?.name || "Check out this place";
    const text = `${title} - Accessibility Information`;

    if (!platform && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or share failed, continue with fallback
      }
    }

    switch (platform) {
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
          "_blank"
        );
        break;
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          "_blank"
        );
        break;
      case "copy":
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copied!",
          description: "The link has been copied to your clipboard.",
        });
        break;
      default:
        if (navigator.share) {
          try {
            await navigator.share({ title, text, url });
          } catch {
            await navigator.clipboard.writeText(url);
            toast({
              title: "Link copied!",
              description: "The link has been copied to your clipboard.",
            });
          }
        }
    }
  };

  const getDirectionsUrl = () => {
    if (place?.address) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.address)}`;
    }
    if (place?.latitude && place?.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
    }
    return null;
  };

  if (isLoadingPlace) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-place">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!place) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4" data-testid="place-not-found">
        <h1 className="text-2xl font-bold mb-4">Place not found</h1>
        <Link href="/places">
          <button className="text-primary font-bold hover:underline" data-testid="button-back-to-places">
            Back to Places
          </button>
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case ACCESSIBILITY_STATUS.ACCESSIBLE: return "text-green-800 bg-green-100";
      case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE: return "text-yellow-900 bg-yellow-100";
      case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE: return "text-red-800 bg-red-100";
      default: return "text-gray-800 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case ACCESSIBILITY_STATUS.ACCESSIBLE: return CheckCircle;
      case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE: return AlertTriangle;
      case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE: return XCircle;
      default: return HelpCircle;
    }
  };

  const StatusIcon = getStatusIcon(place.accessibilityStatus);

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="place-detail-page">
      {/* Hero Image */}
      <div className="relative h-[300px] md:h-[400px] w-full bg-muted">
        <PlaceImage src={place.imageUrl} category={place.category} alt={place.name} className="w-full h-full object-cover" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        
        <Link
          href="/places"
          className="absolute top-6 left-4 md:left-8 px-4 py-2 bg-background/80 backdrop-blur rounded-lg font-bold shadow-sm hover:bg-background transition-colors flex items-center gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" /> Back to places
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-20 relative z-10">
        <div className="bg-card rounded-3xl p-6 md:p-10 shadow-xl border border-border">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
            <div>
              <span className="inline-block px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-sm font-bold uppercase tracking-wider mb-3">
                {place.category}
              </span>
              <h1 className="font-display font-bold text-4xl md:text-5xl mb-2" data-testid="text-place-name">
                {place.name}
              </h1>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full w-fit font-bold ${getStatusColor(place.accessibilityStatus)}`} data-testid="badge-accessibility-status">
                <StatusIcon className="w-5 h-5" aria-hidden="true" />
                Overall, as reported: {place.accessibilityStatus}
              </div>
              <p className="mt-2 text-sm text-muted-foreground max-w-prose">
                One overall label can't fit every need. Check the features below.
              </p>
              {(place.accessibilitySource || place.lastCheckedAt || place.verificationStatus) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="place-data-provenance">
                  {place.verificationStatus && (
                    <span className="rounded-md bg-secondary px-2 py-1 font-medium">
                      {getVerificationBadgeLabel(place.verificationStatus)}
                    </span>
                  )}
                  {place.accessibilitySource && (
                    <span className="rounded-md bg-secondary px-2 py-1 [overflow-wrap:anywhere]">
                      Source: {place.accessibilitySource}
                    </span>
                  )}
                  {place.lastCheckedAt && (
                    <span className="rounded-md bg-secondary px-2 py-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Checked {format(new Date(place.lastCheckedAt), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap" data-testid="action-buttons">
              <Button 
                variant={savedStatus?.isSaved ? "default" : "outline"}
                onClick={handleSaveToggle}
                disabled={saveMutation.isPending || unsaveMutation.isPending || isLoadingSaved}
                className="gap-2"
                data-testid="button-save-place"
              >
                {savedStatus?.isSaved ? (
                  <>
                    <BookmarkCheck className="w-4 h-4" /> Saved
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" /> Save
                  </>
                )}
              </Button>
              <Button 
                size="icon" 
                variant="outline" 
                onClick={() => handleShare("twitter")}
                aria-label="Share on X"
                data-testid="button-share-twitter"
              >
                <SiX className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button 
                size="icon" 
                variant="outline" 
                onClick={() => handleShare("facebook")}
                aria-label="Share on Facebook"
                data-testid="button-share-facebook"
              >
                <SiFacebook className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button 
                size="icon" 
                variant="outline" 
                onClick={() => handleShare("copy")}
                aria-label="Copy link to this place"
                data-testid="button-copy-link"
              >
                <Copy className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleShare()}
                className="gap-2"
                data-testid="button-share"
              >
                <Share2 className="w-4 h-4" /> Share
              </Button>

            </div>
          </div>

          {/* Accessibility comes first: it is what people come to the page to find out. */}
          <PlaceAccessibility placeId={place.id} placeName={place.name} />

          {/* Photo Gallery */}
          <div className="mb-10" data-testid="photo-gallery-section">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-foreground font-bold text-xl">Photos</h2>
              {user && (
                <div>
                  {/* A real button opens the file picker so it works from the keyboard. */}
                  <input
                    ref={photoInputRef}
                    type="file"
                    id="photo-upload"
                    className="sr-only"
                    tabIndex={-1}
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Upload className="w-4 h-4" aria-hidden="true" />}
                    Upload Photo
                  </Button>
                </div>
              )}
            </div>
            {user && (
              <p className="text-sm text-muted-foreground mb-4">
                Photos of entrances, doors, restrooms and paths help most. Please avoid photographing people.
                Location and camera details are removed from uploads.
              </p>
            )}
            {isLoadingMedia ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : media && media.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4" data-testid="photo-gallery">
                {media.map((item, index) => (
                  <figure
                    key={item.id}
                    className="flex-shrink-0 w-48"
                    data-testid={`gallery-image-${item.id}`}
                  >
                    <img
                      src={item.url}
                      alt={item.caption || `Photo ${index + 1} of ${place.name}`}
                      className="w-48 h-32 rounded-xl object-cover"
                    />
                    {/* Caption and report are always shown; they were hover-only before, out of reach by keyboard. */}
                    <figcaption className="mt-1 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-muted-foreground">{item.caption || ""}</span>
                      <ReportButton contentType="photo" contentId={item.id} />
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="bg-secondary/30 rounded-xl p-6 text-center text-muted-foreground" data-testid="no-photos-message">
                No photos available for this location yet.
              </div>
            )}
          </div>

          {/* About */}
          <div className={`prose max-w-none text-muted-foreground mb-10 text-${textSize}`}>
            <h2 className="text-foreground font-bold text-xl mb-2">About this place</h2>
            {/* Long URLs (photo credits, sources) must wrap or they push the page sideways on phones. */}
            <p className="[overflow-wrap:anywhere]" data-testid="text-place-description">{place.description}</p>
          </div>

          {/* Tips Section */}
          <div className="mb-10" data-testid="tips-section">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <h2 className="text-foreground font-bold text-xl flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" aria-hidden="true" />
                Community Tips
              </h2>
              <Link href={`/submit?placeId=${place.id}&type=tip`}>
                <Button variant="outline" size="sm" data-testid="button-add-tip">
                  Add a Tip
                </Button>
              </Link>
            </div>
            {isLoadingTips ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : tips && tips.length > 0 ? (
              <div className="space-y-4" data-testid="tips-list">
                {tips.map((tip) => (
                  <div 
                    key={tip.id} 
                    className="bg-secondary/30 p-4 rounded-xl border border-border/50"
                    data-testid={`tip-card-${tip.id}`}
                  >
                    {editingTipId === tip.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          aria-label="Edit your tip"
                          className="w-full p-3 rounded-lg border border-border bg-background text-foreground resize-none"
                          rows={2}
                          data-testid={`textarea-edit-tip-${tip.id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateTipMutation.mutate({ tipId: tip.id, content: editContent })}
                            disabled={updateTipMutation.isPending}
                            data-testid={`button-save-tip-${tip.id}`}
                          >
                            {updateTipMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingTipId(null)}
                            data-testid={`button-cancel-tip-${tip.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-bold">{tip.author || "Anonymous"}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(tip.createdAt || new Date()), "MMM d, yyyy")}
                            </span>
                          </div>
                          {/* The server only lets the tip's own author edit or delete it. */}
                          {user && tip.userId === user.id && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingTipId(tip.id);
                                  setEditContent(tip.content);
                                }}
                                aria-label="Edit your tip"
                                data-testid={`button-edit-tip-${tip.id}`}
                              >
                                <Pencil className="w-3 h-3" aria-hidden="true" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm("Delete this tip?")) {
                                    deleteTipMutation.mutate(tip.id);
                                  }
                                }}
                                aria-label="Delete your tip"
                                data-testid={`button-delete-tip-${tip.id}`}
                              >
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-foreground">{tip.content}</p>
                        <div className="mt-2">
                          <ReportButton contentType="tip" contentId={tip.id} />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-secondary/30 rounded-xl p-6 text-center text-muted-foreground" data-testid="no-tips-message">
                No tips shared for this location yet. Be the first to share one!
              </div>
            )}
          </div>

          {/* Reviews Section */}
          <div className="mb-10" data-testid="reviews-section">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <h2 className="text-foreground font-bold text-xl flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" aria-hidden="true" />
                Reviews {reviews && reviews.length > 0 && `(${reviews.length})`}
              </h2>
              <Link href={`/submit?placeId=${place.id}&type=review`}>
                <Button variant="outline" size="sm" data-testid="button-add-review">
                  Write a Review
                </Button>
              </Link>
            </div>
            {isLoadingReviews ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : reviews && reviews.length > 0 ? (
              <div className="space-y-4" data-testid="reviews-list">
                {reviews.map((review: any) => (
                  <div
                    key={review.id}
                    className="bg-secondary/30 p-4 rounded-xl border border-border/50"
                    data-testid={`review-card-${review.id}`}
                  >
                    {editingReviewId === review.id ? (
                      <div className="space-y-3">
                        <textarea
                          aria-label="Edit your review"
                          className="w-full rounded-lg border border-border bg-background p-3 text-foreground min-h-[80px]"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          data-testid={`input-edit-review-${review.id}`}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => updateReviewMutation.mutate({ reviewId: review.id, content: editContent, rating: editRating })}
                            disabled={updateReviewMutation.isPending}
                            data-testid={`button-save-review-${review.id}`}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingReviewId(null); setEditContent(""); setEditRating(undefined); }}
                            data-testid={`button-cancel-edit-review-${review.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <span className="font-semibold text-foreground text-sm" data-testid={`text-review-author-${review.id}`}>
                                {review.authorName || "Anonymous"}
                              </span>
                              {review.authorRole && (
                                <span className="text-xs text-muted-foreground ml-2">{review.authorRole}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {review.rating && (
                              <div
                                className="flex items-center gap-1"
                                role="img"
                                aria-label={`Rated ${review.rating} out of 5`}
                                data-testid={`rating-${review.id}`}
                              >
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    aria-hidden="true"
                                    className={`w-4 h-4 ${i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                                  />
                                ))}
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(review.createdAt), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                        <p className="text-foreground" data-testid={`text-review-content-${review.id}`}>{review.content}</p>
                        {review.imageUrl && review.imageUrl.trim() !== "" && (
                          <img
                            src={review.imageUrl}
                            alt={`Photo from a review of ${place.name}`}
className="mt-3 rounded-lg max-h-48 object-cover"
                            data-testid={`img-review-${review.id}`}
                          />
                        )}
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          <ReportButton contentType="review" contentId={review.id} />
                          {user && review.userId === user.id && (
                            <div className="flex items-center gap-1 ml-auto">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingReviewId(review.id);
                                  setEditContent(review.content);
                                  setEditRating(review.rating ?? undefined);
                                }}
                                aria-label="Edit your review"
                                data-testid={`button-edit-review-${review.id}`}
                              >
                                <Pencil className="w-3 h-3" aria-hidden="true" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm("Delete this review?")) {
                                    deleteReviewMutation.mutate(review.id);
                                  }
                                }}
                                aria-label="Delete your review"
                                data-testid={`button-delete-review-${review.id}`}
                              >
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-secondary/30 rounded-xl p-6 text-center text-muted-foreground" data-testid="no-reviews-message">
                No reviews yet for this location. Be the first to share your experience!
              </div>
            )}
          </div>

          {/* Location Map */}
          <div className="mb-10" data-testid="location-map-section">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <h2 className="text-foreground font-bold text-xl">Location</h2>
              {getDirectionsUrl() && (
                <Button variant="outline" size="sm" className="gap-2" asChild data-testid="button-get-directions">
                  <a href={getDirectionsUrl()!} target="_blank" rel="noopener noreferrer">
                    <Navigation className="w-4 h-4" aria-hidden="true" /> Get Directions
                    <span className="sr-only"> (opens Google Maps in a new tab)</span>
                  </a>
                </Button>
              )}
            </div>
            <div className="h-[300px] rounded-2xl overflow-hidden border border-border">
              <AccessibilityMap 
                places={[place]} 
                center={mapCenter}
                zoom={15}
              />
            </div>
            {place.address && (
              <p className="mt-4 text-muted-foreground flex items-start gap-2" data-testid="text-place-address">
                <MapPin className="w-5 h-5 shrink-0 text-primary" />
                {place.address}
              </p>
            )}
          </div>

          {/* Related Places */}
          {relatedPlaces.length > 0 && (
            <div data-testid="related-places-section">
              <h2 className="text-foreground font-bold text-xl mb-4">More places in {place.category}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {relatedPlaces.map((p) => (
                  <Link key={p.id} href={`/places/${p.id}`}>
                    <div className="group cursor-pointer" data-testid={`related-place-card-${p.id}`}>
                      <div className="aspect-video rounded-xl overflow-hidden bg-muted mb-2 relative">
                        <PlaceImage src={p.imageUrl} category={p.category} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
</div>
                      <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{p.name}</h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
