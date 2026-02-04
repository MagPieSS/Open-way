import { useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useReviews } from "@/hooks/use-reviews";
import { usePlaces } from "@/hooks/use-places";
import { useSettings } from "@/hooks/use-settings";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
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
import { useAuth } from "@/hooks/use-auth";

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
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: reviews, isLoading: isReviewsLoading } = useReviews();
  const { data: communityPosts, isLoading: isPostsLoading } = useQuery<any[]>({
    queryKey: ["/api/community/posts"],
  });
  const { data: places } = usePlaces();
  const { textSize } = useSettings();

  const [postContent, setPostContent] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [votedReviews, setVotedReviews] = useState<Set<number>>(new Set());

  const isLoading = isReviewsLoading || isPostsLoading;

  const postMutation = useMutation({
    mutationFn: async (newPost: { content: string }) => {
      return apiRequest("POST", "/api/community/posts", newPost);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      setPostContent("");
      toast({ title: "Post created successfully!" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to post. Please log in." });
    },
  });

  const getPlaceName = (placeId: number) => {
    return places?.find(p => p.id === placeId)?.name || "Community Discussion";
  };

  const getPlaceCategory = (placeId: number) => {
    return places?.find(p => p.id === placeId)?.category || "General";
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
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
  });

  const allPosts = useMemo(() => {
    const combined = [...(reviews || []), ...(communityPosts || [])];
    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
    return unique;
  }, [reviews, communityPosts]);

  const filteredAndSortedReviews = useMemo(() => {
    if (!allPosts) return [];
    let filtered = [...allPosts];

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
  }, [allPosts, categoryFilter, ratingFilter, sortBy, places]);

  const reviewerLeaderboard = useMemo(() => {
    if (!allPosts) return [];
    const counts: Record<string, { name: string; role: string | null; count: number }> = {};
    allPosts.forEach((r: any) => {
      const name = r.authorName || "Anonymous";
      if (!counts[name]) {
        counts[name] = { name, role: r.authorRole || null, count: 0 };
      }
      counts[name].count++;
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allPosts]);

  const featuredReviewer = useMemo(() => {
    if (!allPosts) return null;
    const featured = allPosts.find((r) => r.isFeatured && r.authorName);
    if (!featured) return null;
    const reviewsByAuthor = allPosts.filter((r) => r.authorName === featured.authorName);
    return {
      name: featured.authorName!,
      role: featured.authorRole || "Community Contributor",
      reviewCount: reviewsByAuthor.length,
    };
  }, [allPosts]);

  const stats = useMemo(() => {
    if (!allPosts || allPosts.length === 0) return null;
    const total = allPosts.length;
    const ratingsWithValue = allPosts.filter((r) => r.rating);
    const avgRating = ratingsWithValue.length > 0
      ? ratingsWithValue.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratingsWithValue.length
      : 0;

    const categoryBreakdown: Record<string, number> = {};
    allPosts.forEach((r) => {
      const cat = getPlaceCategory(r.placeId) || "Other";
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    return { total, avgRating, categoryBreakdown };
  }, [allPosts, places]);

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
          <SectionLabel>Community</SectionLabel>
          <h1 className="font-display font-bold text-4xl mt-2 mb-4">Community Voices</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Share your experiences and discuss accessibility improvements across the city.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card className="mb-8 border-primary/20">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Start a Conversation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="What's on your mind? Share an accessibility update or ask a question..."
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className="mb-4 min-h-[100px]"
            />
            <Button 
              onClick={() => postMutation.mutate({ content: postContent })}
              disabled={postMutation.isPending || !postContent.trim()}
              className="w-full sm:w-auto"
            >
              {postMutation.isPending ? "Posting..." : "Post to Community"}
            </Button>
          </CardContent>
        </Card>

        {stats && (
          <section className="pb-8 grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="section-stats">
            <Card className="text-center" data-testid="stat-total-reviews">
              <CardContent className="pt-6">
                <BarChart3 className="w-6 h-6 mx-auto text-primary mb-2" />
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Posts</div>
              </CardContent>
            </Card>
            <Card className="text-center" data-testid="stat-avg-rating">
              <CardContent className="pt-6">
                <Star className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-500 mb-2" />
                <div className="text-2xl font-bold text-foreground">{stats.avgRating.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Avg Rating</div>
              </CardContent>
            </Card>
            <Card className="text-center" data-testid="stat-top-category">
              <CardContent className="pt-6">
                <TrendingUp className="w-6 h-6 mx-auto text-accent mb-2" />
                <div className="text-lg font-bold text-foreground truncate px-2">
                  {Object.entries(stats.categoryBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Hot Category</div>
              </CardContent>
            </Card>
            <Card className="text-center" data-testid="stat-categories">
              <CardContent className="pt-6">
                <Filter className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                <div className="text-2xl font-bold text-foreground">
                  {Object.keys(stats.categoryBreakdown).length}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Active Topics</div>
              </CardContent>
            </Card>
          </section>
        )}

        <div className="grid lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1 space-y-6">
            <Card className="sticky top-20">
              <CardHeader className="pb-4 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter Posts
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Category</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Rating</label>
                  <Select value={ratingFilter} onValueChange={setRatingFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Rating" />
                    </SelectTrigger>
                    <SelectContent>
                      {RATING_FILTERS.map((rf) => (
                        <SelectItem key={rf.value} value={rf.value}>
                          {rf.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((so) => (
                        <SelectItem key={so.value} value={so.value}>
                          {so.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {featuredReviewer && (
              <Card className="bg-primary/5 border-primary/20 overflow-hidden">
                <div className="h-2 bg-primary" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Contributor Spotlight
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">{featuredReviewer.name}</div>
                      <div className="text-xs text-muted-foreground">{featuredReviewer.role}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter">
                    {featuredReviewer.reviewCount} contributions
                  </Badge>
                </CardContent>
              </Card>
            )}
          </aside>

          <main className="lg:col-span-3 space-y-6">
            {isLoading ? (
              <div className="grid md:grid-cols-1 gap-6">
                {[...Array(5)].map((_, i) => (
                  <ReviewCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredAndSortedReviews.length === 0 ? (
              <div className="text-center py-20 bg-secondary/30 rounded-2xl border-2 border-dashed border-border">
                <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-muted-foreground mb-2">No discussions found</h3>
                <p className="text-muted-foreground mb-6">Be the first to start a conversation in this category!</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {filteredAndSortedReviews.map((review) => {
                  const isVoted = votedReviews.has(review.id) || hasVoted(review.id);
                  const isCommunityPost = review.placeId === 1;
                  return (
                    <Card
                      key={review.id}
                      className="hover-elevate transition-all border-l-4 border-l-primary/50"
                      data-testid={`card-review-${review.id}`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                              <User className="w-5 h-5 text-accent" />
                            </div>
                            <div>
                              <h3 className="font-bold text-sm">
                                {review.authorName || "Community Member"}
                                {isCommunityPost && <Badge variant="secondary" className="ml-2 text-[10px]">Community Post</Badge>}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(review.createdAt || new Date()), "MMMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          {!isCommunityPost && renderStars(review.rating)}
                        </div>

                        <div className="relative mb-6">
                          <Quote className="w-6 h-6 text-primary/5 absolute -top-1 -left-2" />
                          <p className={`relative z-10 text-muted-foreground leading-relaxed text-${textSize}`}>
                            {review.content}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
                          {!isCommunityPost ? (
                            <Link href={`/places/${review.placeId}`}>
                              <Button variant="outline" size="sm" className="h-8 gap-2 group">
                                <MapPin className="w-3 h-3 text-primary" />
                                <span className="text-xs font-bold">{getPlaceName(review.placeId)}</span>
                                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                              </Button>
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MessageSquare className="w-3 h-3" />
                              General Discussion
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <Button
                              variant={isVoted ? "secondary" : "ghost"}
                              size="sm"
                              className="h-8 px-3"
                              disabled={isVoted || helpfulMutation.isPending}
                              onClick={() => helpfulMutation.mutate(review.id)}
                            >
                              <ThumbsUp className={`w-3 h-3 mr-2 ${isVoted ? "fill-current" : ""}`} />
                              <span className="text-xs">{isVoted ? "Helpful" : "Helpful?"}</span>
                            </Button>
                            <Badge variant="secondary" className="text-[10px] h-5">
                              {review.helpfulCount ?? 0}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
