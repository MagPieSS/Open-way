export function PlaceCardSkeleton() {
  return (
    <div className="bg-card rounded-xl overflow-hidden shadow-md border border-border animate-pulse">
      <div className="h-48 bg-secondary" />
      <div className="p-5">
        <div className="h-4 w-20 bg-secondary rounded mb-3" />
        <div className="h-6 w-3/4 bg-secondary rounded mb-2" />
        <div className="h-4 w-full bg-secondary rounded mb-2" />
        <div className="h-4 w-5/6 bg-secondary rounded mb-4" />
        <div className="h-12 w-full bg-secondary rounded-lg" />
      </div>
    </div>
  );
}

export function ReviewCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl p-8 shadow-lg border border-border animate-pulse">
      <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
        <div className="w-10 h-10 rounded-full bg-secondary" />
        <div>
          <div className="h-4 w-24 bg-secondary rounded mb-1" />
          <div className="h-3 w-16 bg-secondary rounded" />
        </div>
      </div>
      <div className="h-4 w-full bg-secondary rounded mb-2" />
      <div className="h-4 w-5/6 bg-secondary rounded mb-2" />
      <div className="h-4 w-4/5 bg-secondary rounded mb-6" />
      <div className="h-12 w-full bg-secondary rounded-xl" />
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="flex items-center justify-center gap-3 animate-pulse">
      <div className="w-16 h-8 bg-white/20 rounded" />
    </div>
  );
}
