import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPlaceSchema, insertReviewSchema, ACCESSIBILITY_STATUS, type Category } from "@shared/schema";
import { useCreatePlace } from "@/hooks/use-places";
import { useCreateReview } from "@/hooks/use-reviews";
import { usePlaces } from "@/hooks/use-places";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, MessageSquare, Check, Upload, X, ImageIcon, LogIn } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import * as z from "zod";
import { Link } from "wouter";

export default function Submit() {
  const queryParams = new URLSearchParams(window.location.search);
  const preselectedPlaceId = queryParams.get("placeId");
  const [mode, setMode] = useState<'place' | 'review'>(preselectedPlaceId ? 'review' : 'place');
  const { user, isLoading: isAuthLoading } = useAuth();

  const { textSize } = useSettings();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto text-center">
          <Card className="p-8 space-y-6">
            <LogIn className="w-12 h-12 mx-auto text-muted-foreground" />
            <h1 className="font-display font-bold text-2xl">Sign in to Contribute</h1>
            <p className="text-muted-foreground">
              You need to be logged in to add places or write reviews. Join us in making the world more accessible.
            </p>
            <Link href="/login">
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
        </div>

        <Card className="p-6 md:p-8">
          {mode === 'place' ? <PlaceForm textSize={textSize} /> : <ReviewForm textSize={textSize} preselectedPlaceId={preselectedPlaceId} />}
        </Card>
      </div>
    </div>
  );
}

function PlaceForm({ textSize }: { textSize: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createPlace = useCreatePlace();
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories, isLoading: isCategoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

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

  const form = useForm<z.infer<typeof insertPlaceSchema>>({
    resolver: zodResolver(insertPlaceSchema),
    defaultValues: {
      name: "",
      category: "",
      accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
      description: "",
      imageUrl: "",
      address: "",
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

  const onSubmit = (data: z.infer<typeof insertPlaceSchema>) => {
    const submitData = {
      ...data,
      imageUrl: uploadedImageUrl || data.imageUrl || undefined,
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block font-bold mb-2">Place Name</label>
        <input
          {...form.register("name")}
          className="w-full p-4 rounded-md border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="e.g. City Library"
          data-testid="input-place-name"
        />
        {form.formState.errors.name && <p className="text-destructive text-sm mt-1">{form.formState.errors.name.message}</p>}
      </div>

      <div>
        <label className="block font-bold mb-2">Category</label>
        {isCategoriesLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground p-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading categories...
          </div>
        ) : (
          <select
            {...form.register("category")}
            className="w-full p-4 rounded-md border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
            data-testid="select-place-category"
          >
            <option value="">Select a category...</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        )}
        {form.formState.errors.category && <p className="text-destructive text-sm mt-1">{form.formState.errors.category.message}</p>}
      </div>

      <div>
        <label className="block font-bold mb-2">Address</label>
        <input
          {...form.register("address")}
          className="w-full p-4 rounded-md border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="e.g. 123 Main Street, Philadelphia, PA 19103"
          data-testid="input-place-address"
        />
      </div>

      <div>
        <label className="block font-bold mb-2">Accessibility Status</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.values(ACCESSIBILITY_STATUS).map((status) => (
            <label key={status} className={`
              cursor-pointer rounded-md p-4 border-2 transition-all flex flex-col items-center text-center gap-2
              ${form.watch("accessibilityStatus") === status 
                ? 'border-primary bg-primary/5 shadow-md' 
                : 'border-border'}
            `}>
              <input
                type="radio"
                value={status}
                {...form.register("accessibilityStatus")}
                className="sr-only"
                data-testid={`radio-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
              />
              <span className={`font-bold ${
                status === ACCESSIBILITY_STATUS.ACCESSIBLE ? 'text-green-600 dark:text-green-400' :
                status === ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
              }`}>{status}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block font-bold mb-2">Description</label>
        <textarea
          {...form.register("description")}
          rows={4}
          className="w-full p-4 rounded-md border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="Describe the accessibility features (ramps, elevators, restrooms...)"
          data-testid="input-place-description"
        />
        {form.formState.errors.description && <p className="text-destructive text-sm mt-1">{form.formState.errors.description.message}</p>}
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
                data-testid="button-clear-image"
              >
                <X className="w-4 h-4" />
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

function ReviewForm({ textSize, preselectedPlaceId }: { textSize: string, preselectedPlaceId: string | null }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createReview = useCreateReview();
  const { data: places } = usePlaces();

  const form = useForm<z.infer<typeof insertReviewSchema>>({
    resolver: zodResolver(insertReviewSchema.extend({ placeId: z.coerce.number() })),
    defaultValues: {
      placeId: preselectedPlaceId ? Number(preselectedPlaceId) : undefined,
      content: "",
      imageUrl: "",
    },
  });

  const onSubmit = (data: z.infer<typeof insertReviewSchema>) => {
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
