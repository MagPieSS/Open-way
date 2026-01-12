import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReviews } from "@/hooks/use-reviews";
import { usePlaces } from "@/hooks/use-places";
import { useSettings } from "@/hooks/use-settings";
import { 
  MessageSquare, MapPin, User, Quote, ArrowRight, 
  ThumbsUp, Star, Filter, Trophy, Award, Medal,
  TrendingUp, BarChart3, Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { ReviewCardSkeleton } from "@/components/Skeleton";
import { SectionLabel } from "@/components/SectionLabel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = ["All", "Transit", "Museums", "Libraries", "Parks", "Restaurants", "Healthcare", "Government", "Education"];
const RATING_FILTERS = [
  { label: "All Ratings", value: "all" },
  { label: "5 Stars", value: "5" },
  { label: "4+ Stars", value: "4" },
  { label: "3+ Stars", value: "3" },
];
const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Most Helpful", value: "helpful" },
];

function getStorageKey(reviewId: number) {
  return `helpful_voted_${reviewId}`;
}

function hasVoted(reviewId: number): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(getStorageKey(reviewId)) === "true";
}

function markVoted(reviewId: number) {
  if (typeof window !== "undefined") {
    localStorage.setItem(getStorageKey(reviewId), "true");
  }
}

export default function Community() {
  const queryClient = useQueryClient();
  const { data: reviews, isLoading } = useReviews();
  const { data: places } = usePlaces();
  const { textSize } = useSettings();

  const [categoryFilter, setCategoryFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [votedReviews, setVotedReviews] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    const voted = new Set<number>();
    return voted;
  });

  const getPlaceName = (placeId: number) => {
    return places?.find(p => p.id === placeId)?.name || "Unknown Place";
  };

  const getPlaceCategory = (placeId: number) => {
    return places?.find(p => p.id === placeId)?.category || "";
  };

  const helpfulMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      const res = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark helpful");
      return res.json();
    },
    onSuccess: (_, reviewId) => {
      markVoted(reviewId);
      setVotedReviews((prev) => new Set(prev).add(reviewId));
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
    },
  });

  const filteredAndSortedReviews = useMemo(() => {
    if (!reviews) return [];
    let filtered = [...reviews];

    if (categoryFilter !== "All") {
      filtered = filtered.filter((r) => getPlaceCategory(r.placeId) === categoryFilter);
    }

    if (ratingFilter !== "all") {
      const minRating = parseInt(ratingFilter);
      filtered = filtered.filter((r) => (r.rating ?? 0) >= minRating);
    }

    if (sortBy === "newest") {
      filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (sortBy === "helpful") {
      filtered.sort((a, b) => (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0));
    }

    return filtered;
  }, [reviews, categoryFilter, ratingFilter, sortBy, places]);

  const reviewerLeaderboard = useMemo(() => {
    if (!reviews) return [];
    const counts: Record<string, { name: string; role: string | null; count: number }> = {};
    reviews.forEach((r) => {
      const name = r.authorName || "Anonymous";
      if (!counts[name]) {
        counts[name] = { name, role: r.authorRole, count: 0 };
      }
      counts[name].count++;
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [reviews]);

  const featuredReviewer = useMemo(() => {
    if (!reviews) return null;
    const featured = reviews.find((r) => r.isFeatured && r.authorName);
    if (!featured) return null;
    const reviewsByAuthor = reviews.filter((r) => r.authorName === featured.authorName);
    return {
      name: featured.authorName!,
      role: featured.authorRole || "Community Contributor",
      reviewCount: reviewsByAuthor.length,
    };
  }, [reviews]);

  const stats = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    const total = reviews.length;
    const ratingsWithValue = reviews.filter((r) => r.rating);
    const avgRating = ratingsWithValue.length > 0
      ? ratingsWithValue.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratingsWithValue.length
      : 0;

    const categoryBreakdown: Record<string, number> = {};
    reviews.forEach((r) => {
      const cat = getPlaceCategory(r.placeId) || "Other";
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    return { total, avgRating, categoryBreakdown };
  }, [reviews, places]);

  const getBadgeInfo = (rank: number) => {
    if (rank === 0) return { icon: Trophy, color: "text-yellow-500", label: "Gold" };
    if (rank === 1) return { icon: Award, color: "text-gray-400", label: "Silver" };
    if (rank === 2) return { icon: Medal, color: "text-amber-600", label: "Bronze" };
    return { icon: Star, color: "text-muted-foreground", label: "" };
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-accent/10 to-primary/10 py-12 px-4 border-b border-border">
        <div className="max-w-7xl mx-auto text-center">
          <SectionLabel>Reviews</SectionLabel>
          <h1 className="font-display font-bold text-4xl mt-2 mb-4">Community Voices</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Read real experiences from people navigating the city. Your shared stories help everyone move more freely.
          </p>
        </div>
      </section>

      {stats && (
        <section className="py-8 px-4 border-b border-border bg-secondary/30" data-testid="section-stats">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Card className="text-center" data-testid="stat-total-reviews">
                <CardContent className="pt-6">
                  <BarChart3 className="w-8 h-8 mx-auto text-primary mb-2" />
                  <div className="text-3xl font-bold text-foreground">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Reviews</div>
                </CardContent>
              </Card>
              <Card className="text-center" data-testid="stat-avg-rating">
                <CardContent className="pt-6">
                  <Star className="w-8 h-8 mx-auto text-yellow-500 fill-yellow-500 mb-2" />
                  <div className="text-3xl font-bold text-foreground">{stats.avgRating.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Average Rating</div>
                </CardContent>
              </Card>
              <Card className="text-center" data-testid="stat-top-category">
                <CardContent className="pt-6">
                  <TrendingUp className="w-8 h-8 mx-auto text-accent mb-2" />
                  <div className="text-xl font-bold text-foreground">
                    {Object.entries(stats.categoryBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}
                  </div>
                  <div className="text-sm text-muted-foreground">Top Category</div>
                </CardContent>
              </Card>
              <Card className="text-center" data-testid="stat-categories">
                <CardContent className="pt-6">
                  <Filter className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <div className="text-3xl font-bold text-foreground">
                    {Object.keys(stats.categoryBreakdown).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Categories</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      <section className="py-8 px-4 border-b border-border" data-testid="section-filters">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} data-testid={`option-category-${cat.toLowerCase()}`}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-rating-filter">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                {RATING_FILTERS.map((rf) => (
                  <SelectItem key={rf.value} value={rf.value} data-testid={`option-rating-${rf.value}`}>
                    {rf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px]" data-testid="select-sort">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((so) => (
                  <SelectItem key={so.value} value={so.value} data-testid={`option-sort-${so.value}`}>
                    {so.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-6">
              {featuredReviewer && (
                <Card className="bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 border-primary/30" data-testid="card-featured-reviewer">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="w-5 h-5 text-primary" />
                      Featured Reviewer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-bold text-foreground" data-testid="text-featured-name">
                          {featuredReviewer.name}
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid="text-featured-role">
                          {featuredReviewer.role}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {featuredReviewer.reviewCount} reviews contributed
                    </Badge>
                  </CardContent>
                </Card>
              )}

              <Card data-testid="card-leaderboard">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Top Reviewers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reviewerLeaderboard.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No reviewers yet</p>
                  ) : (
                    <div className="space-y-3">
                      {reviewerLeaderboard.map((reviewer, index) => {
                        const badgeInfo = getBadgeInfo(index);
                        const BadgeIcon = badgeInfo.icon;
                        return (
                          <div
                            key={reviewer.name}
                            className="flex items-center gap-3"
                            data-testid={`leaderboard-row-${index}`}
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary">
                              <BadgeIcon className={`w-4 h-4 ${badgeInfo.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{reviewer.name}</div>
                              {reviewer.role && (
                                <div className="text-xs text-muted-foreground truncate">{reviewer.role}</div>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {reviewer.count}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-3">
              {isLoading ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <ReviewCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredAndSortedReviews.length === 0 ? (
                <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-muted-foreground mb-2">No reviews found</h3>
                  <p className="text-muted-foreground mb-6">
                    {categoryFilter !== "All" || ratingFilter !== "all"
                      ? "Try adjusting your filters"
                      : "Be the first to share your experience!"}
                  </p>
                  <Link href="/submit">
                    <Button data-testid="button-empty-write-review">Write a Review</Button>
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground mb-6">
                    <span className="font-semibold text-foreground">{filteredAndSortedReviews.length}</span> reviews
                    {categoryFilter !== "All" && ` in ${categoryFilter}`}
                  </p>
                  <div className="grid md:grid-cols-2 gap-6">
                    {filteredAndSortedReviews.map((review) => {
                      const isVoted = votedReviews.has(review.id) || hasVoted(review.id);
                      return (
                        <Card
                          key={review.id}
                          className="flex flex-col hover:border-primary hover:shadow-lg transition-all"
                          data-testid={`card-review-${review.id}`}
                        >
                          <CardContent className="flex-1 flex flex-col p-6">
                            <div className="flex items-center justify-between gap-3 mb-4 border-b border-border pb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                                  <User className="w-5 h-5 text-accent" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-sm">
                                    {review.authorName || "Community Member"}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(review.createdAt || new Date()), "MMMM d, yyyy")}
                                  </p>
                                </div>
                              </div>
                              {renderStars(review.rating)}
                            </div>

                            <div className="flex-grow relative mb-4">
                              <Quote className="w-8 h-8 text-primary/10 absolute -top-2 -left-2" />
                              <p className={`relative z-10 italic text-muted-foreground text-${textSize}`}>
                                "{review.content}"
                              </p>
                            </div>

                            <Link href={`/places/${review.placeId}`}>
                              <div className="bg-secondary p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-secondary/80 transition-colors mb-4 group">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                                  <span className="font-bold text-sm truncate">{getPlaceName(review.placeId)}</span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                              </div>
                            </Link>

                            <div className="flex items-center justify-between pt-2 border-t border-border">
                              <Button
                                variant={isVoted ? "secondary" : "ghost"}
                                size="sm"
                                disabled={isVoted || helpfulMutation.isPending}
                                onClick={() => helpfulMutation.mutate(review.id)}
                                data-testid={`button-helpful-${review.id}`}
                              >
                                <ThumbsUp className={`w-4 h-4 mr-1 ${isVoted ? "fill-current" : ""}`} />
                                {isVoted ? "Helpful" : "Was this helpful?"}
                              </Button>
                              <Badge variant="outline" className="text-xs" data-testid={`text-helpful-count-${review.id}`}>
                                {review.helpfulCount ?? 0} found helpful
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-secondary/50 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl mb-4">Share Your Experience</h2>
          <p className="text-muted-foreground mb-6">
            Your reviews help others navigate the city with confidence.
          </p>
          <Link href="/submit">
            <Button size="lg" data-testid="button-write-review">
              Write a Review
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
