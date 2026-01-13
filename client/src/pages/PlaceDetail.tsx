import { usePlace, usePlaces } from "@/hooks/use-places";
import { useReviews } from "@/hooks/use-reviews";
import { useAuth } from "@/hooks/use-auth";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Loader2, ArrowLeft, MapPin, Calendar, CheckCircle, AlertTriangle, XCircle, 
  User, ThumbsUp, Share2, Copy, Navigation, Lightbulb,
  Eye, Ear, Move, Sparkles, X, Bookmark, BookmarkCheck
} from "lucide-react";
import { SiX, SiFacebook } from "react-icons/si";
import { useSettings } from "@/hooks/use-settings";
import { ACCESSIBILITY_STATUS, type AccessibilityFeature, type PlaceMedia, type PlaceTip } from "@shared/schema";
import { format } from "date-fns";
import { AccessibilityMap } from "@/components/AccessibilityMap";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Pencil, Trash2 } from "lucide-react";

const FEATURE_GROUPS: Record<string, { label: string; icon: typeof Move; features: string[] }> = {
  mobility: {
    label: "Mobility",
    icon: Move,
    features: ["ramp", "elevator", "accessible_restroom", "wheelchair_rental", "accessible_parking", "tactile_paving"],
  },
  visual: {
    label: "Visual",
    icon: Eye,
    features: ["braille_signage", "large_print", "audio_guide"],
  },
  hearing: {
    label: "Hearing",
    icon: Ear,
    features: ["hearing_loop", "sign_language"],
  },
  sensory: {
    label: "Sensory",
    icon: Sparkles,
    features: ["quiet_hours", "sensory_room", "service_animal_friendly"],
  },
};

const FEATURE_LABELS: Record<string, string> = {
  ramp: "Wheelchair Ramp",
  elevator: "Elevator Access",
  accessible_restroom: "Accessible Restroom",
  braille_signage: "Braille Signage",
  audio_guide: "Audio Guide",
  wheelchair_rental: "Wheelchair Rental",
  service_animal_friendly: "Service Animal Friendly",
  accessible_parking: "Accessible Parking",
  tactile_paving: "Tactile Paving",
  hearing_loop: "Hearing Loop",
  sign_language: "Sign Language Services",
  large_print: "Large Print Materials",
  quiet_hours: "Quiet Hours",
  sensory_room: "Sensory Room",
};

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

function useFeatures(placeId: number) {
  return useQuery<AccessibilityFeature[]>({
    queryKey: ["/api/places", placeId, "features"],
    queryFn: async () => {
      const res = await fetch(`/api/places/${placeId}/features`);
      if (!res.ok) throw new Error("Failed to fetch features");
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
  const { data: reviews, isLoading: isLoadingReviews } = useReviews(id);
  const { data: media, isLoading: isLoadingMedia } = useMedia(id);
  const { data: features, isLoading: isLoadingFeatures } = useFeatures(id);
  const { data: tips, isLoading: isLoadingTips } = useTips(id);
  const { data: allPlaces } = usePlaces();
  const { textSize } = useSettings();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hoveredImage, setHoveredImage] = useState<number | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editingTipId, setEditingTipId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editRating, setEditRating] = useState<number | undefined>(undefined);

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
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", id] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", id] });
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
      case ACCESSIBILITY_STATUS.ACCESSIBLE: return "text-green-700 bg-green-100";
      case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE: return "text-yellow-800 bg-yellow-100";
      case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE: return "text-red-700 bg-red-100";
      default: return "text-gray-700 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case ACCESSIBILITY_STATUS.ACCESSIBLE: return CheckCircle;
      case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE: return AlertTriangle;
      case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE: return XCircle;
      default: return AlertTriangle;
    }
  };

  const StatusIcon = getStatusIcon(place.accessibilityStatus);

  const groupedFeatures = Object.entries(FEATURE_GROUPS).map(([key, group]) => {
    const groupFeatures = features?.filter((f) => group.features.includes(f.featureType)) || [];
    return { key, ...group, features: groupFeatures };
  }).filter((g) => g.features.length > 0);

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="place-detail-page">
      {/* Hero Image */}
      <div className="relative h-[300px] md:h-[400px] w-full bg-muted">
        {place.imageUrl ? (
          <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover" data-testid="img-place-hero" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <MapPin className="w-20 h-20 text-muted-foreground/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        
        <Link href="/places">
          <button 
            className="absolute top-6 left-4 md:left-8 px-4 py-2 bg-background/80 backdrop-blur rounded-lg font-bold shadow-sm hover:bg-background transition-colors flex items-center gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
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
                <StatusIcon className="w-5 h-5" />
                {place.accessibilityStatus}
              </div>
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
                data-testid="button-share-twitter"
              >
                <SiX className="w-4 h-4" />
              </Button>
              <Button 
                size="icon" 
                variant="outline" 
                onClick={() => handleShare("facebook")}
                data-testid="button-share-facebook"
              >
                <SiFacebook className="w-4 h-4" />
              </Button>
              <Button 
                size="icon" 
                variant="outline" 
                onClick={() => handleShare("copy")}
                data-testid="button-copy-link"
              >
                <Copy className="w-4 h-4" />
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

          {/* Photo Gallery */}
          <div className="mb-10" data-testid="photo-gallery-section">
            <h3 className="text-foreground font-bold text-xl mb-4">Photos</h3>
            {isLoadingMedia ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : media && media.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4" data-testid="photo-gallery">
                {media.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="relative flex-shrink-0 w-48 h-32 rounded-xl overflow-hidden cursor-pointer"
                    onMouseEnter={() => setHoveredImage(item.id)}
                    onMouseLeave={() => setHoveredImage(null)}
                    data-testid={`gallery-image-${item.id}`}
                  >
                    <img 
                      src={item.url} 
                      alt={item.caption || `Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {item.caption && (
                      <div 
                        className={`absolute inset-x-0 bottom-0 bg-black/70 text-white text-sm p-2 transition-opacity ${
                          hoveredImage === item.id ? "opacity-100" : "opacity-0"
                        }`}
                        style={{ visibility: hoveredImage === item.id ? "visible" : "hidden" }}
                      >
                        {item.caption}
                      </div>
                    )}
                  </div>
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
            <h3 className="text-foreground font-bold text-xl mb-2">About this place</h3>
            <p data-testid="text-place-description">{place.description}</p>
          </div>

          {/* Accessibility Checklist */}
          <div className="mb-10" data-testid="accessibility-checklist-section">
            <h3 className="text-foreground font-bold text-xl mb-4">Accessibility Features</h3>
            {isLoadingFeatures ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : groupedFeatures.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {groupedFeatures.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <div key={group.key} className="bg-secondary/30 rounded-xl p-4" data-testid={`feature-group-${group.key}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <GroupIcon className="w-5 h-5 text-primary" />
                        <h4 className="font-bold text-foreground">{group.label}</h4>
                      </div>
                      <ul className="space-y-2">
                        {group.features.map((feature) => (
                          <li 
                            key={feature.id} 
                            className="flex items-start gap-2"
                            data-testid={`feature-item-${feature.id}`}
                          >
                            {feature.available ? (
                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className={`font-medium ${feature.available ? "text-foreground" : "text-muted-foreground line-through"}`}>
                                {FEATURE_LABELS[feature.featureType] || feature.featureType}
                              </span>
                              {feature.description && (
                                <p className="text-sm text-muted-foreground">{feature.description}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-secondary/30 rounded-xl p-6 text-center text-muted-foreground" data-testid="no-features-message">
                No accessibility features have been documented for this location yet.
              </div>
            )}
          </div>

          {/* Tips Section */}
          <div className="mb-10" data-testid="tips-section">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <h3 className="text-foreground font-bold text-xl flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" />
                Community Tips
              </h3>
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
                            variant="outline"
                            onClick={() => { setEditingTipId(null); setEditContent(""); }}
                            data-testid={`button-cancel-edit-tip-${tip.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-foreground/80 mb-3 text-${textSize}`}>{tip.content}</p>
                    )}
                    <div className="flex items-center justify-between gap-4 flex-wrap text-sm text-muted-foreground">
                      <span>{tip.author || "Anonymous"}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="w-4 h-4" />
                          <span data-testid={`tip-helpful-count-${tip.id}`}>{tip.helpfulCount || 0} found helpful</span>
                        </div>
                        {user && tip.userId === user.id && editingTipId !== tip.id && (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => {
                                setEditingTipId(tip.id);
                                setEditContent(tip.content);
                              }}
                              data-testid={`button-edit-tip-${tip.id}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => deleteTipMutation.mutate(tip.id)}
                              data-testid={`button-delete-tip-${tip.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-secondary/30 rounded-xl p-6 text-center text-muted-foreground" data-testid="no-tips-message">
                No tips yet. Be the first to share a helpful tip!
              </div>
            )}
          </div>

          {/* Location Map */}
          {(place.latitude && place.longitude) && (
            <div className="mb-10" data-testid="location-section">
              <h3 className="text-foreground font-bold text-xl mb-4">Location</h3>
              <div className="h-[300px] rounded-xl overflow-hidden mb-4">
                <AccessibilityMap places={[place]} />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {place.address && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span data-testid="text-place-address">{place.address}</span>
                  </div>
                )}
                {getDirectionsUrl() && (
                  <a 
                    href={getDirectionsUrl()!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="gap-2" data-testid="button-get-directions">
                      <Navigation className="w-4 h-4" />
                      Get Directions
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Reviews Section */}
          <div className="border-t border-border pt-10">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
              <h2 className="font-display font-bold text-2xl">Community Reviews</h2>
              <Link href={`/submit?placeId=${place.id}`}>
                <button 
                  className="px-6 py-2 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                  data-testid="button-write-review"
                >
                  Write a Review
                </button>
              </Link>
            </div>

            {isLoadingReviews ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : reviews?.length === 0 ? (
              <div className="text-center py-10 bg-secondary/30 rounded-xl" data-testid="no-reviews-message">
                <p className="text-muted-foreground font-medium">No reviews yet. Be the first!</p>
              </div>
            ) : (
              <div className="space-y-6" data-testid="reviews-list">
                {reviews?.map((review) => (
                  <div key={review.id} className="bg-secondary/30 p-6 rounded-2xl border border-border/50" data-testid={`review-card-${review.id}`}>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start gap-4 flex-wrap mb-2">
                          <span className="font-bold text-foreground">{review.authorName || "Community Member"}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(review.createdAt || new Date()), "MMM d, yyyy")}
                            </span>
                            {user && review.userId === user.id && (
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setEditingReviewId(review.id);
                                    setEditContent(review.content);
                                    setEditRating(review.rating ?? undefined);
                                  }}
                                  data-testid={`button-edit-review-${review.id}`}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => deleteReviewMutation.mutate(review.id)}
                                  data-testid={`button-delete-review-${review.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        {editingReviewId === review.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full p-3 rounded-lg border border-border bg-background text-foreground resize-none"
                              rows={3}
                              data-testid={`textarea-edit-review-${review.id}`}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateReviewMutation.mutate({ reviewId: review.id, content: editContent, rating: editRating })}
                                disabled={updateReviewMutation.isPending}
                                data-testid={`button-save-review-${review.id}`}
                              >
                                {updateReviewMutation.isPending ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditingReviewId(null); setEditContent(""); }}
                                data-testid={`button-cancel-edit-review-${review.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-foreground/80 text-${textSize}`}>{review.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Related Places */}
        {relatedPlaces.length > 0 && (
          <div className="mt-12" data-testid="related-places-section">
            <h2 className="font-display font-bold text-2xl mb-6">More in {place.category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedPlaces.map((relatedPlace) => (
                <Link key={relatedPlace.id} href={`/places/${relatedPlace.id}`}>
                  <div 
                    className="bg-card rounded-xl overflow-hidden border border-border hover-elevate cursor-pointer"
                    data-testid={`related-place-card-${relatedPlace.id}`}
                  >
                    <div className="h-32 bg-muted relative">
                      {relatedPlace.imageUrl ? (
                        <img 
                          src={relatedPlace.imageUrl} 
                          alt={relatedPlace.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-secondary">
                          <MapPin className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center ${
                        relatedPlace.accessibilityStatus === ACCESSIBILITY_STATUS.ACCESSIBLE
                          ? "bg-green-500"
                          : relatedPlace.accessibilityStatus === ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}>
                        {relatedPlace.accessibilityStatus === ACCESSIBILITY_STATUS.ACCESSIBLE ? (
                          <CheckCircle className="w-4 h-4 text-white" />
                        ) : relatedPlace.accessibilityStatus === ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE ? (
                          <AlertTriangle className="w-4 h-4 text-black" />
                        ) : (
                          <XCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-foreground truncate">{relatedPlace.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{relatedPlace.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
