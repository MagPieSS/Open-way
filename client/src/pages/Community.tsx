import { useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useSettings } from "@/hooks/use-settings";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, User, Quote,
  Filter, BarChart3
} from "lucide-react";
import { format } from "date-fns";
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
import { ReportButton } from "@/components/ReportButton";
import type { CommunityPost } from "@shared/schema";

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
];

export default function Community() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { textSize } = useSettings();

  const { data: communityPosts, isLoading } = useQuery<CommunityPost[]>({
    queryKey: ["/api/community/posts"],
  });

  const [postContent, setPostContent] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const postMutation = useMutation({
    mutationFn: async (newPost: { content: string }) => {
      return apiRequest("POST", "/api/community/posts", newPost);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      setPostContent("");
      toast({ title: "Post created successfully!" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to post. Please log in." });
    },
  });

  const sortedPosts = useMemo(() => {
    if (!communityPosts) return [];
    const sorted = [...communityPosts];
    if (sortBy === "newest") {
      sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else {
      sorted.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    }
    return sorted;
  }, [communityPosts, sortBy]);

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

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card className="mb-8 border-primary/20" data-testid="card-new-post">
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
              data-testid="input-post-content"
            />
            <Button 
              onClick={() => postMutation.mutate({ content: postContent })}
              disabled={postMutation.isPending || !postContent.trim()}
              className="w-full sm:w-auto"
              data-testid="button-submit-post"
            >
              {postMutation.isPending ? "Posting..." : "Post to Community"}
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground" data-testid="text-post-count">
              {communityPosts?.length || 0} {(communityPosts?.length || 0) === 1 ? "Post" : "Posts"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]" data-testid="select-sort">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                {SORT_OPTIONS.map((so) => (
                  <SelectItem key={so.value} value={so.value}>
                    {so.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="space-y-2">
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-2 w-16 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="h-3 w-3/4 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedPosts.length === 0 ? (
          <div className="text-center py-20 bg-secondary/30 rounded-2xl border-2 border-dashed border-border">
            <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-muted-foreground mb-2" data-testid="text-empty-state">No discussions yet</h3>
            <p className="text-muted-foreground mb-6">Be the first to start a conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedPosts.map((post) => (
              <Card
                key={post.id}
                className="hover-elevate transition-all"
                data-testid={`card-community-post-${post.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm" data-testid={`text-author-${post.id}`}>
                          {post.authorName || "Community Member"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(post.createdAt || new Date()), "MMMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Discussion</Badge>
                  </div>

                  <div className="relative mb-4">
                    <Quote className="w-6 h-6 text-primary/5 absolute -top-1 -left-2" />
                    <p className={`relative z-10 text-muted-foreground leading-relaxed text-${textSize}`}>
                      {post.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MessageSquare className="w-3 h-3" />
                      General Discussion
                    </div>
                    <ReportButton
                      contentType="community_post"
                      contentId={post.id}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
