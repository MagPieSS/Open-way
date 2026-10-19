import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReviewSchema, ACCESSIBILITY_STATUS, PLACE_CATEGORIES } from "@shared/schema";
import { FEATURES, FEATURE_GROUPS, KEY_FEATURES } from "@shared/accessibility";
import { FeatureQuestion, type Answer } from "@/components/accessibility/ShareReportDialog";
import { useCreatePlace } from "@/hooks/use-places";
import { useCreateReview } from "@/hooks/use-reviews";
import { usePlaces } from "@/hooks/use-places";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import { useLocation } from "wouter";
import { Loader2, MapPin, MessageSquare, Check, Upload, X, ImageIcon, LogIn, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import * as z from "zod";
import { Link, useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { usePageMeta } from "@/hooks/use-page-meta";

const ACCESSIBILITY_SOURCE_OPTIONS = [
  "Personal visit",
  "Venue website",
  "Phone call with venue",
  "Community report",
  "Public agency data",
];

// What the form asks for; the server applies its own stricter checks (placeContributionSchema).
const placeFormSchema = z.object({
  name: z.string().trim().min(1, "Enter the place's name").max(200, "Name is too long"),
  category: z.string().min(1, "Choose a category"),
  address: z.string().trim().max(500, "Address is too long").optional(),
  accessibilityStatus: z.string().min(1, "Choose the overall accessibility"),
  accessibilitySource: z.string(),
  description: z.string().trim().min(1, "Add a short description").max(2000, "Description is too long"),
  imageUrl: z.string().optional(),
});
type PlaceFormValues = z.infer<typeof placeFormSchema>;

const STATUS_HELP: Record<string, string> = {
  [ACCESSIBILITY_STATUS.ACCESSIBLE]: "You could get in and use the main areas without barriers.",
  [ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE]: "Some things work, others don't (say which below).",
  [ACCESSIBILITY_STATUS.NOT_ACCESSIBLE]: "There are barriers to getting in or using the place.",
};

export default function Submit() {
  usePageMeta({ title: "Contribute" });
  const search = useSearch();
  const queryParams = new URLSearchParams(search);
  const preselectedPlaceId = queryParams.get("placeId");
  const contributionSearch = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  const initialMode = queryParams.get("type") === "tip" ? "tip" : preselectedPlaceId ? "review" : "place";
  const [mode, setMode] = useState<'place' | 'review' | 'tip'>(initialMode);
  const { user, isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    const contributionType = mode === "tip" ? "share an accessibility tip" : mode === "review" ? "write a review" : "add a place";
    return (
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto text-center">
          <Card className="p-8 space-y-6">
            <LogIn className="w-12 h-12 mx-auto text-muted-foreground" />
            <h1 className="font-display font-bold text-2xl">Sign in to {contributionType}</h1>
            <p className="text-muted-foreground">
              Your contribution helps people plan with better access information.
            </p>
              <Link href={"/login?returnTo=" + encodeURIComponent("/submit" + contributionSearch)}>
              <Button className="w-full" data-testid="button-login-redirect">
                <LogIn className="w-4 h-4 mr-2" /> Sign In
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-display font-bold text-4xl mb-4">Contribute to Open Way</h1>
          <p className="text-muted-foreground text-lg">Help us build a more accessible world.</p>
        </div>

        <div className="bg-secondary p-1.5 rounded-md flex gap-1 mb-8">
          <Button
            variant={mode === 'place' ? 'default' : 'ghost'}
            onClick={() => setMode('place')}
            className="flex-1"
            data-testid="button-mode-place"
          >
            <MapPin className="w-5 h-5" /> Add New Place
          </Button>
          <Button
            variant={mode === 'review' ? 'default' : 'ghost'}
            onClick={() => setMode('review')}
            className="flex-1"
            data-testid="button-mode-review"
          >
            <MessageSquare className="w-5 h-5" /> Write Review
          </Button>
          <Button
            variant={mode === 'tip' ? 'default' : 'ghost'}
            onClick={() => setMode('tip')}
            className="flex-1"
            data-testid="button-mode-tip"
          >
            <MessageSquare className="w-5 h-5" /> Share a Tip
          </Button>
        </div>

        <Card className="p-6 md:p-8">
          {mode === 'place' ? <PlaceForm /> : mode === 'review' ? <ReviewForm preselectedPlaceId={preselectedPlaceId} /> : <TipForm preselectedPlaceId={preselectedPlaceId} />}
        </Card>
      </div>
    </div>
  );
}

function PlaceForm() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createPlace = useCreatePlace();
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [featureAnswers, setFeatureAnswers] = useState<Record<string, Answer>>({});
  const [featureNotes, setFeatureNotes] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (response) => {
      setUploadedImageUrl(response.objectPath);
      toast({
        title: "Image Uploaded",
        description: "Your image has been uploaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<PlaceFormValues>({
    resolver: zodResolver(placeFormSchema),
    defaultValues: {
      name: "",
      category: "",
      // No default: picking "Accessible" for people inflated claims about places.
      accessibilityStatus: "",
      description: "",
      imageUrl: "",
      address: "",
      accessibilitySource: ACCESSIBILITY_SOURCE_OPTIONS[0],
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    await uploadFile(file);
  };

  const clearImage = () => {
    setUploadedImageUrl(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = (data: PlaceFormValues) => {
    const accessibilityFeatures = Object.entries(featureAnswers)
      .filter(([, status]) => status !== "")
      .map(([featureType, status]) => ({
        featureType,
        status: status as Exclude<Answer, "">,
        description: featureNotes[featureType]?.trim() || undefined,
      }));

    const submitData = {
      ...data,
      imageUrl: uploadedImageUrl || data.imageUrl || undefined,
      accessibilityFeatures,
    };

    createPlace.mutate(submitData, {
      onSuccess: () => {
        toast({
          title: "Place Added!",
          description: "Thank you for contributing to the map.",
        });
        setLocation("/places");
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const errors = form.formState.errors;
  const featureQuestion = (key: string) => (
    <FeatureQuestion
      key={key}
      featureKey={key}
      answer={featureAnswers[key] ?? ""}
      note={featureNotes[key] ?? ""}
      onAnswer={(value) => setFeatureAnswers((prev) => ({ ...prev, [key]: value }))}
      onNote={(value) => setFeatureNotes((prev) => ({ ...prev, [key]: value }))}
    />
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label htmlFor="place-name" className="block font-bold mb-2">Place name</label>
        <input
          id="place-name"
          {...form.register("name")}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "place-name-error" : undefined}
          className="w-full p-4 rounded-md border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="e.g. City Library"
          data-testid="input-place-name"
        />
        {errors.name && <p id="place-name-error" className="text-destructive text-sm mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="place-category" className="block font-bold mb-2">Category</label>
        <select
          id="place-category"
          {...form.register("category")}
          aria-invalid={!!errors.category}
          aria-describedby={errors.category ? "place-category-error" : undefined}
          className="w-full p-4 rounded-md border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
          data-testid="select-place-category"
        >
          <option value="">Select a category...</option>
          {PLACE_CATEGORIES.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
        {errors.category && <p id="place-category-error" className="text-destructive text-sm mt-1">{errors.category.message}</p>}
      </div>

      <div>
        <label htmlFor="place-address" className="block font-bold mb-2">Address</label>
        <input
          id="place-address"
          {...form.register("address")}
          autoComplete="street-address"
          className="w-full p-4 rounded-md border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="e.g. 123 Main Street, Philadelphia, PA 19103"
          data-testid="input-place-address"
        />
      </div>

      <fieldset aria-describedby={errors.accessibilityStatus ? "place-status-error" : undefined}>
        <legend className="block font-bold mb-2">Overall accessibility, from what you know</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.values(ACCESSIBILITY_STATUS).map((status) => (
            <label key={status} className={`
              cursor-pointer rounded-md p-4 border-2 transition-all flex flex-col gap-1
              has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary
              ${form.watch("accessibilityStatus") === status
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border'}
            `}>
              <span className="flex items-center gap-2 font-bold">
                <input
                  type="radio"
                  value={status}
                  {...form.register("accessibilityStatus")}
                  className="w-4 h-4 accent-[hsl(var(--primary))]"
                  data-testid={`radio-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
                />
                {status}
              </span>
              <span className="text-sm text-muted-foreground">{STATUS_HELP[status]}</span>
            </label>
          ))}
        </div>
        {errors.accessibilityStatus && <p id="place-status-error" className="text-destructive text-sm mt-1">{errors.accessibilityStatus.message}</p>}
      </fieldset>

      <div>
        <label htmlFor="place-source" className="block font-bold mb-2">Where your information comes from</label>
        <select
          id="place-source"
          {...form.register("accessibilitySource")}
          className="w-full p-4 rounded-md border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
          data-testid="select-accessibility-source"
        >
          {ACCESSIBILITY_SOURCE_OPTIONS.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="block font-bold">Accessibility details</legend>
        <p className="text-sm text-muted-foreground mb-2">
          Answer what you know. Anything left as "Not sure" shows as not known yet.
        </p>
        <div className="rounded-md border-2 border-border bg-background px-4">
          {KEY_FEATURES.map(featureQuestion)}
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer font-medium text-primary py-2">More features</summary>
          {FEATURE_GROUPS.map((group) => {
            const keys = FEATURES.filter((f) => f.group === group.key && !(KEY_FEATURES as readonly string[]).includes(f.key)).map((f) => f.key);
            if (keys.length === 0) return null;
            return (
              <div key={group.key} className="mt-3">
                <h3 className="font-semibold">{group.label}</h3>
                <div className="rounded-md border-2 border-border bg-background px-4">{keys.map(featureQuestion)}</div>
              </div>
            );
          })}
        </details>
      </fieldset>

      <div>
        <label htmlFor="place-description" className="block font-bold mb-2">Description</label>
        <textarea
          id="place-description"
          {...form.register("description")}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "place-description-error" : undefined}
          rows={4}
          className="w-full p-4 rounded-md border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="Describe the accessibility features (ramps, elevators, restrooms...)"
          data-testid="input-place-description"
        />
        {errors.description && <p id="place-description-error" className="text-destructive text-sm mt-1">{errors.description.message}</p>}
      </div>

      <div>
        <label className="block font-bold mb-2">Photo (Optional)</label>
        <div className="space-y-3">
          {imagePreview ? (
            <div className="relative rounded-md overflow-hidden border border-border">
              <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={clearImage}
                className="absolute top-2 right-2"
                aria-label="Remove photo"
                data-testid="button-clear-image"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </Button>
              {isUploading && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                    <p className="text-sm font-medium">{progress}%</p>
                  </div>
                </div>
              )}
              {uploadedImageUrl && !isUploading && (
                <div className="absolute bottom-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" /> Uploaded
                </div>
              )}
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onKeyDown={(e) => { if (!isUploading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInputRef.current?.click(); } }}
              aria-disabled={isUploading}
              className={`w-full border-2 border-dashed border-border rounded-md p-8 flex flex-col items-center gap-3 text-muted-foreground cursor-pointer ${isUploading ? 'opacity-50' : 'hover-elevate'}`}
              data-testid="button-upload-image"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm font-medium">Uploading... {progress}%</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-sm font-medium">Click to upload a photo</span>
                  <span className="text-xs">JPG, PNG or WebP up to 10MB</span>
                </>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-place-image-file"
          />
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={createPlace.isPending || isUploading}
        className="w-full"
        data-testid="button-submit-place"
      >
        {createPlace.isPending ? (
          <>
            <Loader2 className="animate-spin mr-2" /> Adding Place...
          </>
        ) : (
          <>
            <Check className="w-5 h-5 mr-2" /> Submit Place
          </>
        )}
      </Button>
    </form>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-1" data-testid="star-rating-picker">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          data-testid={`star-rating-${star}`}
        >
          <Star
            className={`w-8 h-8 transition-colors ${
              star <= (hovered || value)
                ? "text-yellow-500 fill-yellow-500"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm text-muted-foreground" data-testid="text-rating-label">
          {value === 1 ? "Poor" : value === 2 ? "Fair" : value === 3 ? "Good" : value === 4 ? "Very Good" : "Excellent"}
        </span>
      )}
    </div>
  );
}

function ReviewForm({ preselectedPlaceId }: { preselectedPlaceId: string | null }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createReview = useCreateReview();
  const { data: places } = usePlaces();

  const reviewSchema = insertReviewSchema.extend({
    placeId: z.coerce.number(),
    rating: z.number().min(1, "Please select a star rating").max(5),
  });

  const form = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      placeId: preselectedPlaceId ? Number(preselectedPlaceId) : undefined,
      content: "",
      rating: 0,
      imageUrl: "",
    },
  });

  const rating = form.watch("rating") || 0;

  const onSubmit = (data: z.infer<typeof reviewSchema>) => {
    createReview.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Review Posted!",
          description: "Your voice helps the community.",
        });
        setLocation(data.placeId ? `/places/${data.placeId}` : "/reviews");
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block font-bold mb-2">Select Place</label>
        <select
          {...form.register("placeId")}
          className="w-full p-4 rounded-md border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
          data-testid="select-review-place"
        >
          <option value="">Choose a place to review...</option>
          {places?.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </select>
        {form.formState.errors.placeId && <p className="text-destructive text-sm mt-1">{form.formState.errors.placeId.message}</p>}
      </div>

      <div>
        <label className="block font-bold mb-2">Your Rating</label>
        <StarRating value={rating} onChange={(val) => form.setValue("rating", val, { shouldValidate: true })} />
        {form.formState.errors.rating && <p className="text-destructive text-sm mt-1">{form.formState.errors.rating.message}</p>}
      </div>

      <div>
        <label className="block font-bold mb-2">Your Review</label>
        <textarea
          {...form.register("content")}
          rows={6}
          className="w-full p-4 rounded-md border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="Share your experience. Was it truly accessible? What worked, what didn't?"
          data-testid="input-review-content"
        />
        {form.formState.errors.content && <p className="text-destructive text-sm mt-1">{form.formState.errors.content.message}</p>}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={createReview.isPending}
        className="w-full"
        data-testid="button-submit-review"
      >
        {createReview.isPending ? (
          <>
            <Loader2 className="animate-spin mr-2" /> Posting Review...
          </>
        ) : (
          <>
            <MessageSquare className="w-5 h-5 mr-2" /> Post Review
          </>
        )}
      </Button>
    </form>
  );
}

function TipForm({ preselectedPlaceId }: { preselectedPlaceId: string | null }) {
  const { data: places } = usePlaces();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [placeId, setPlaceId] = useState(preselectedPlaceId ?? "");
  const [content, setContent] = useState("");
  const [validationError, setValidationError] = useState("");

  const createTipMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/place-tips", { placeId: Number(placeId), content: content.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/places", Number(placeId), "tips"] });
      toast({ title: "Tip shared", description: "Your access tip has been added to the place." });
      setLocation(`/places/${placeId}`);
    },
    onError: (error: Error) => {
      toast({ title: "Could not share tip", description: error.message, variant: "destructive" });
    },
  });

  const submitTip = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!placeId) {
      setValidationError("Choose a place for this tip.");
      return;
    }
    if (content.trim().length < 10 || content.trim().length > 500) {
      setValidationError("Tip must be between 10 and 500 characters.");
      return;
    }
    setValidationError("");
    createTipMutation.mutate();
  };

  return (
    <form onSubmit={submitTip} className="space-y-6" data-testid="form-place-tip">
      <div>
        <label htmlFor="tip-place" className="mb-2 block font-bold">Place</label>
        <select
          id="tip-place"
          value={placeId}
          onChange={(event) => setPlaceId(event.target.value)}
          className="w-full rounded-md border-2 border-border bg-background p-4"
          required
          data-testid="select-tip-place"
        >
          <option value="">Choose a place...</option>
          {places?.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="tip-content" className="mb-2 block font-bold">What should visitors know?</label>
        <textarea
          id="tip-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={5}
          maxLength={500}
          className="w-full rounded-md border-2 border-border bg-background p-4"
          placeholder="Share a practical access detail from your experience. Include conditions or limitations when relevant."
          required
          data-testid="input-tip-content"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{content.length}/500</p>
        {validationError && <p className="mt-1 text-sm text-destructive" role="alert">{validationError}</p>}
      </div>
      <Button type="submit" disabled={createTipMutation.isPending || !placeId || content.trim().length < 10} data-testid="button-submit-tip">
        {createTipMutation.isPending ? "Sharing..." : "Share Tip"}
      </Button>
    </form>
  );
}
