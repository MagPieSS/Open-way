import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";

const testimonials = [
  {
    id: 1,
    quote: "Open Way helped me discover that the Art Museum has a great accessible entrance. I visited for the first time in years!",
    author: "Maria G.",
    role: "Wheelchair user",
  },
  {
    id: 2,
    quote: "Finally, a platform where my voice matters. The reviews here are honest and from people who actually understand accessibility barriers.",
    author: "James T.",
    role: "Visual impairment advocate",
  },
  {
    id: 3,
    quote: "I signed the petition and shared it with everyone I know. We deserve accessible spaces, and Open Way is making it happen.",
    author: "Aisha K.",
    role: "Disability rights activist",
  },
  {
    id: 4,
    quote: "The SEPTA accessibility info saved me so much stress. Knowing which stations have elevators before I travel is a game-changer.",
    author: "David L.",
    role: "Daily commuter",
  },
];

export function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);
  const { reducedMotion } = useSettings();

  useEffect(() => {
    if (reducedMotion) return;
    
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    
    return () => clearInterval(timer);
  }, [reducedMotion]);

  const next = () => setCurrent((prev) => (prev + 1) % testimonials.length);
  const prev = () => setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);

  const testimonial = testimonials[current];

  return (
    <div className="relative max-w-3xl mx-auto" data-testid="testimonial-carousel">
      <div className="bg-card rounded-2xl p-8 md:p-12 shadow-lg border border-border relative overflow-hidden">
        <Quote className="absolute top-6 left-6 w-12 h-12 text-primary/10" />
        
        <div className="relative z-10 text-center">
          <p className="text-xl md:text-2xl text-foreground italic mb-6 leading-relaxed">
            "{testimonial.quote}"
          </p>
          <div>
            <p className="font-bold text-lg text-foreground">{testimonial.author}</p>
            <p className="text-muted-foreground">{testimonial.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
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
                idx === current ? "bg-primary" : "bg-secondary hover:bg-primary/50"
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
    </div>
  );
}
