import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionLabel } from "@/components/SectionLabel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  User,
  ArrowRight,
  Star,
  Filter,
  BookOpen,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import type { BlogPost } from "@shared/schema";

const CATEGORIES = ["All", "News", "Advocacy", "Community", "Resources", "Guides", "Stories"];

const SORT_OPTIONS = [
  { label: "Newest First", value: "newest" },
  { label: "Oldest First", value: "oldest" },
];

export default function Blog() {
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  const { data: posts, isLoading, error } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
  });

  const featuredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter((p) => p.isFeatured && p.isPublished);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (!posts) return [];

    let filtered = posts.filter((p) => !p.isFeatured && p.isPublished);

    if (categoryFilter !== "All") {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.publishedAt || b.createdAt || 0).getTime();
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [posts, categoryFilter, sortBy]);

  const estimateReadTime = (content: string) => {
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min read`;
  };

  const renderPostCard = (post: BlogPost, featured = false) => (
    <Card
      key={post.id}
      className={`hover:border-primary hover:shadow-lg transition-all cursor-pointer group ${
        featured ? "bg-gradient-to-br from-primary/5 to-accent/5 border-primary/30" : ""
      }`}
      onClick={() => setSelectedPost(post)}
      data-testid={`card-post-${post.id}`}
    >
      {post.imageUrl && (
        <div className="relative h-48 overflow-hidden rounded-t-xl">
          <img
            src={post.imageUrl}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            data-testid={`img-post-${post.id}`}
          />
          {featured && (
            <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">
              <Star className="w-3 h-3 mr-1 fill-current" />
              Featured
            </Badge>
          )}
        </div>
      )}
      <CardHeader className={post.imageUrl ? "pt-4" : ""}>
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {post.category && (
              <Badge variant="secondary" data-testid={`badge-post-category-${post.id}`}>
                {post.category}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {estimateReadTime(post.content)}
            </span>
          </div>
          <CardTitle className="text-xl group-hover:text-primary transition-colors" data-testid={`text-post-title-${post.id}`}>
            {post.title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {post.excerpt && (
          <p className="text-muted-foreground line-clamp-3" data-testid={`text-post-excerpt-${post.id}`}>
            {post.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {post.author && (
              <span className="flex items-center gap-1" data-testid={`text-post-author-${post.id}`}>
                <User className="w-4 h-4" />
                {post.author}
              </span>
            )}
            <span className="flex items-center gap-1" data-testid={`text-post-date-${post.id}`}>
              <Calendar className="w-4 h-4" />
              {format(new Date(post.publishedAt || post.createdAt || new Date()), "MMM d, yyyy")}
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
        <div className="max-w-7xl mx-auto text-center">
          <SectionLabel>Blog</SectionLabel>
          <h1 className="font-display font-bold text-4xl mt-2 mb-4">News & Stories</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Stay informed with the latest accessibility news, community stories, and advocacy updates
          </p>
        </div>
      </section>

      <section className="py-4 px-4 bg-secondary/50 border-b border-border">
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]" data-testid="select-sort">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`option-sort-${opt.value}`}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-secondary rounded-t-xl" />
                  <CardHeader>
                    <div className="h-5 w-20 bg-secondary rounded mb-2" />
                    <div className="h-6 w-3/4 bg-secondary rounded" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-secondary rounded" />
                      <div className="h-4 w-2/3 bg-secondary rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-20 bg-destructive/10 rounded-2xl border border-destructive/20">
              <p className="text-destructive font-bold text-xl">Failed to load posts</p>
              <p className="text-destructive/80">Please try again later.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {featuredPosts.length > 0 && categoryFilter === "All" && (
                <div data-testid="section-featured-posts">
                  <h2 className="font-display font-bold text-2xl mb-6 flex items-center gap-2">
                    <Star className="w-6 h-6 text-primary fill-primary/20" />
                    Featured Stories
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {featuredPosts.map((post) => renderPostCard(post, true))}
                  </div>
                </div>
              )}

              {filteredPosts.length === 0 ? (
                <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
                  <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-muted-foreground mb-2">No posts found</h3>
                  <p className="text-muted-foreground">
                    {categoryFilter !== "All"
                      ? "Try selecting a different category"
                      : "Check back soon for new stories"}
                  </p>
                </div>
              ) : (
                <div data-testid="section-all-posts">
                  <h2 className="font-display font-bold text-2xl mb-6 flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-primary" />
                    Latest Posts
                    <Badge variant="outline" className="ml-2">
                      {filteredPosts.length}
                    </Badge>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPosts.map((post) => renderPostCard(post))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-4 bg-secondary/50 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl mb-4">Share Your Story</h2>
          <p className="text-muted-foreground mb-6">
            Have a story about accessibility in Philadelphia? We'd love to hear from you.
          </p>
          <Button size="lg" data-testid="button-submit-story">
            Submit a Story
          </Button>
        </div>
      </section>

      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-post-detail">
          {selectedPost && (
            <>
              <DialogHeader>
                {selectedPost.imageUrl && (
                  <div className="relative h-64 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-lg">
                    <img
                      src={selectedPost.imageUrl}
                      alt={selectedPost.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {selectedPost.category && (
                    <Badge variant="secondary">{selectedPost.category}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {estimateReadTime(selectedPost.content)}
                  </span>
                </div>
                <DialogTitle className="text-2xl" data-testid="text-dialog-title">
                  {selectedPost.title}
                </DialogTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                  {selectedPost.author && (
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {selectedPost.author}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(selectedPost.publishedAt || selectedPost.createdAt || new Date()), "MMMM d, yyyy")}
                  </span>
                </div>
              </DialogHeader>
              <div className="prose prose-sm dark:prose-invert max-w-none mt-6" data-testid="text-dialog-content">
                {selectedPost.content.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
