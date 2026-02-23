import { usePlace, usePlaces } from "@/hooks/use-places";
import { useAuth } from "@/hooks/use-auth";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Loader2, ArrowLeft, MapPin, Calendar, CheckCircle, AlertTriangle, XCircle, 
  User, ThumbsUp, Share2, Copy, Navigation, Lightbulb, MessageSquare, Star,
  Eye, Ear, Move, Sparkles, X, Bookmark, BookmarkCheck, Upload, Plus
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
import { ReportButton } from "@/components/ReportButton";
import { useUpload } from "@/hooks/use-upload";

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
  const { data: reviews, isLoading: isLoadingReviews } = useQuery<any[]>({
    queryKey: ["/api/places", id, "place-reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/places/${id}/place-reviews`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    },
    enabled: !!id,
  });
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
  const [uploading, setUploading] = useState(false);
  const { uploadFile: uploadToStorage, isUploading: isStorageUploading } = useUpload();

  const uploadMutation = useMutation({
    mutationFn: async ({ objectPath, placeId, caption }: { objectPath: string; placeId: number; caption?: string }) => {
      const csrfRes = await fetch("/api/csrf-token");
      const { token } = await csrfRes.json();
      
      const res = await fetch("/api/place-media/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({ placeId, objectPath, caption }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Upload failed");
      }
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
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Max size is 5MB" });
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-foreground font-bold text-xl">Photos</h3>
              {user && (
                <div className="relative">
                  <input 
                    type="file" 
                    id="photo-upload" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    asChild
                    disabled={uploading}
                  >
                    <label htmlFor="photo-upload" className="cursor-pointer gap-2">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Upload Photo
                    </label>
                  </Button>
                </div>
              )}
            </div>
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
                    <div 
                      className={`absolute inset-x-0 bottom-0 bg-black/70 text-white text-sm p-2 transition-opacity flex items-center justify-between gap-2 ${
                        hoveredImage === item.id ? "opacity-100" : "opacity-0"
                      }`}
                      style={{ visibility: hoveredImage === item.id ? "visible" : "hidden" }}
                    >
                      <span className="truncate">{item.caption || ""}</span>
                      <ReportButton contentType="photo" contentId={item.id} />
                    </div>
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
                          {user && (user.displayName === tip.author || user.email === tip.author || user.isAdmin) && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
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
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm("Delete this tip?")) {
                                    deleteTipMutation.mutate(tip.id);
                                  }
                                }}
                                data-testid={`button-delete-tip-${tip.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-foreground">{tip.content}</p>
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
              <h3 className="text-foreground font-bold text-xl flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Reviews {reviews && reviews.length > 0 && `(${reviews.length})`}
              </h3>
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
                              <div className="flex items-center gap-1" data-testid={`rating-${review.id}`}>
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
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
                            alt="Review"
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
                                data-testid={`button-edit-review-${review.id}`}
                              >
                                <Pencil className="w-3 h-3" />
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
                                data-testid={`button-delete-review-${review.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
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
              <h3 className="text-foreground font-bold text-xl">Location</h3>
              {getDirectionsUrl() && (
                <a 
                  href={getDirectionsUrl()!} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-get-directions">
                    <Navigation className="w-4 h-4" /> Get Directions
                  </Button>
                </a>
              )}
            </div>
            <div className="h-[300px] rounded-2xl overflow-hidden border border-border">
              <AccessibilityMap 
                places={[place]} 
                center={[place.latitude ? Number(place.latitude) : 39.9526, place.longitude ? Number(place.longitude) : -75.1652]} 
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
              <h3 className="text-foreground font-bold text-xl mb-4">Other {place.category} nearby</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {relatedPlaces.map((p) => (
                  <Link key={p.id} href={`/places/${p.id}`}>
                    <div className="group cursor-pointer" data-testid={`related-place-card-${p.id}`}>
                      <div className="aspect-video rounded-xl overflow-hidden bg-muted mb-2 relative">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-secondary">
                            <MapPin className="w-8 h-8 text-muted-foreground/20" />
                          </div>
                        )}
                        <div className={`absolute top-2 right-2 w-3 h-3 rounded-full shadow-sm ${getStatusColor(p.accessibilityStatus).split(' ')[1]}`} />
                      </div>
                      <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{p.name}</h4>
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
