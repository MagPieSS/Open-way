import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPlaceSchema, insertReviewSchema, ACCESSIBILITY_STATUS } from "@shared/schema";
import { useCreatePlace } from "@/hooks/use-places";
import { useCreateReview } from "@/hooks/use-reviews";
import { usePlaces } from "@/hooks/use-places";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, MapPin, MessageSquare, Check } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import * as z from "zod";

export default function Submit() {
  const [mode, setMode] = useState<'place' | 'review'>('place');
  const [location, setLocation] = useLocation(); // To handle redirect
  const queryParams = new URLSearchParams(window.location.search);
  const preselectedPlaceId = queryParams.get("placeId");
  
  // If we came with a placeId, default to review mode
  useState(() => {
    if (preselectedPlaceId) setMode('review');
  });

  const { textSize } = useSettings();

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-display font-bold text-4xl mb-4">Contribute to Open Way</h1>
          <p className="text-muted-foreground text-lg">Help us build a more accessible world.</p>
        </div>

        {/* Toggle Switch */}
        <div className="bg-secondary p-1.5 rounded-2xl flex mb-8">
          <button
            onClick={() => setMode('place')}
            className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
              mode === 'place' 
                ? 'bg-background text-foreground shadow-md' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MapPin className="w-5 h-5" /> Add New Place
          </button>
          <button
            onClick={() => setMode('review')}
            className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
              mode === 'review' 
                ? 'bg-background text-foreground shadow-md' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-5 h-5" /> Write Review
          </button>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-xl">
          {mode === 'place' ? <PlaceForm textSize={textSize} /> : <ReviewForm textSize={textSize} preselectedPlaceId={preselectedPlaceId} />}
        </div>
      </div>
    </div>
  );
}

function PlaceForm({ textSize }: { textSize: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createPlace = useCreatePlace();

  const form = useForm<z.infer<typeof insertPlaceSchema>>({
    resolver: zodResolver(insertPlaceSchema),
    defaultValues: {
      name: "",
      category: "",
      accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
      description: "",
      imageUrl: "",
    },
  });

  const onSubmit = (data: z.infer<typeof insertPlaceSchema>) => {
    createPlace.mutate(data, {
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
          className="w-full p-4 rounded-xl border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="e.g. City Library"
        />
        {form.formState.errors.name && <p className="text-red-500 text-sm mt-1">{form.formState.errors.name.message}</p>}
      </div>

      <div>
        <label className="block font-bold mb-2">Category</label>
        <select
          {...form.register("category")}
          className="w-full p-4 rounded-xl border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
        >
          <option value="">Select a category...</option>
          <option value="Restaurant">Restaurant</option>
          <option value="Park">Park</option>
          <option value="Museum">Museum</option>
          <option value="Transportation">Transportation</option>
          <option value="Library">Library</option>
          <option value="Store">Store</option>
          <option value="Other">Other</option>
        </select>
        {form.formState.errors.category && <p className="text-red-500 text-sm mt-1">{form.formState.errors.category.message}</p>}
      </div>

      <div>
        <label className="block font-bold mb-2">Accessibility Status</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.values(ACCESSIBILITY_STATUS).map((status) => (
            <label key={status} className={`
              cursor-pointer rounded-xl p-4 border-2 transition-all flex flex-col items-center text-center gap-2
              ${form.watch("accessibilityStatus") === status 
                ? 'border-primary bg-primary/5 shadow-md' 
                : 'border-border hover:border-primary/50'}
            `}>
              <input
                type="radio"
                value={status}
                {...form.register("accessibilityStatus")}
                className="sr-only"
              />
              <span className={`font-bold ${
                status === ACCESSIBILITY_STATUS.ACCESSIBLE ? 'text-green-600' :
                status === ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE ? 'text-yellow-600' : 'text-red-600'
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
          className="w-full p-4 rounded-xl border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="Describe the accessibility features (ramps, elevators, restrooms...)"
        />
        {form.formState.errors.description && <p className="text-red-500 text-sm mt-1">{form.formState.errors.description.message}</p>}
      </div>

      <div>
        <label className="block font-bold mb-2">Image URL (Optional)</label>
        <input
          {...form.register("imageUrl")}
          className="w-full p-4 rounded-xl border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="https://images.unsplash.com/..."
        />
      </div>

      <button
        type="submit"
        disabled={createPlace.isPending}
        className={`
          w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg
          bg-gradient-to-r from-primary to-primary/80 hover:to-primary
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200 transform active:scale-[0.99]
          flex items-center justify-center gap-2
        `}
      >
        {createPlace.isPending ? (
          <>
            <Loader2 className="animate-spin" /> Adding Place...
          </>
        ) : (
          <>
            <Check className="w-5 h-5" /> Submit Place
          </>
        )}
      </button>
    </form>
  );
}

function ReviewForm({ textSize, preselectedPlaceId }: { textSize: string, preselectedPlaceId: string | null }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createReview = useCreateReview();
  const { data: places } = usePlaces();

  const form = useForm<z.infer<typeof insertReviewSchema>>({
    resolver: zodResolver(insertReviewSchema.extend({ placeId: z.coerce.number() })), // Ensure placeId is number
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
          className="w-full p-4 rounded-xl border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
        >
          <option value="">Choose a place to review...</option>
          {places?.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </select>
        {form.formState.errors.placeId && <p className="text-red-500 text-sm mt-1">{form.formState.errors.placeId.message}</p>}
      </div>

      <div>
        <label className="block font-bold mb-2">Your Review</label>
        <textarea
          {...form.register("content")}
          rows={6}
          className="w-full p-4 rounded-xl border-2 border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          placeholder="Share your experience. Was it truly accessible? What worked, what didn't?"
        />
        {form.formState.errors.content && <p className="text-red-500 text-sm mt-1">{form.formState.errors.content.message}</p>}
      </div>

      <button
        type="submit"
        disabled={createReview.isPending}
        className={`
          w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg
          bg-gradient-to-r from-accent to-accent/80 hover:to-accent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200 transform active:scale-[0.99]
          flex items-center justify-center gap-2
        `}
      >
        {createReview.isPending ? (
          <>
            <Loader2 className="animate-spin" /> Posting Review...
          </>
        ) : (
          <>
            <MessageSquare className="w-5 h-5" /> Post Review
          </>
        )}
      </button>
    </form>
  );
}
