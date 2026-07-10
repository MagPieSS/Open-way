import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import type { Review } from "@shared/schema";

export function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);
  const { reducedMotion } = useSettings();

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: ["/api/reviews", "featured"],
    queryFn: async () => {
      const res = await fetch("/api/reviews?featured=true");
      if (!res.ok) throw new Error("Failed to load testimonials");
      return res.json();
    },
  });

  const testimonials = (reviews ?? []).filter((r) => r.content);

  useEffect(() => {
    if (reducedMotion || testimonials.length < 2) return;

    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [reducedMotion, testimonials.length]);

  if (isLoading || testimonials.length === 0) {
    return null;
  }

  const safeCurrent = current % testimonials.length;
  const next = () => setCurrent((prev) => (prev + 1) % testimonials.length);
  const prev = () => setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);

  const testimonial = testimonials[safeCurrent];

  return (
    <div className="relative max-w-3xl mx-auto" data-testid="testimonial-carousel">
      <div className="bg-card rounded-2xl p-8 md:p-12 shadow-lg border border-border relative overflow-hidden">
        <Quote className="absolute top-6 left-6 w-12 h-12 text-primary/10" aria-hidden="true" />

        <div className="relative z-10 text-center">
          <p className="text-xl md:text-2xl text-foreground italic mb-6 leading-relaxed">
            "{testimonial.content}"
          </p>
          <div>
            <p className="font-bold text-lg text-foreground">{testimonial.authorName || "Open Way user"}</p>
            {testimonial.authorRole && (
              <p className="text-muted-foreground">{testimonial.authorRole}</p>
            )}
          </div>
        </div>
      </div>

      {testimonials.length > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={prev}
            className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Previous testimonial"
            data-testid="button-testimonial-prev"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex gap-2">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  idx === safeCurrent ? "bg-primary" : "bg-secondary hover:bg-primary/50"
                }`}
                aria-label={`Go to testimonial ${idx + 1}`}
                data-testid={`button-testimonial-dot-${idx}`}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Next testimonial"
            data-testid="button-testimonial-next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
