import { useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useSettings } from "@/hooks/use-settings";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, User, Quote,
  BarChart3, Reply, ChevronDown, ChevronUp, Send
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

function CommentItem({ 
  comment, 
  textSize 
}: { 
  comment: CommunityPost; 
  textSize: string;
}) {
  return (
    <div className="flex gap-3 py-3" data-testid={`comment-${comment.id}`}>
      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
        <User className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-xs text-foreground" data-testid={`text-comment-author-${comment.id}`}>
            {comment.authorName || "Community Member"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(comment.createdAt || new Date()), "MMM d, yyyy")}
          </span>
        </div>
        <p className={`text-muted-foreground text-sm leading-relaxed`} data-testid={`text-comment-content-${comment.id}`}>
          {comment.content}
        </p>
      </div>
    </div>
  );
}

function PostCard({ 
  post, 
  replies, 
  textSize, 
  user,
  onReply
}: { 
  post: CommunityPost; 
  replies: CommunityPost[];
  textSize: string;
  user: any;
  onReply: (parentId: number, content: string) => Promise<void>;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onReply(post.id, replyContent);
      setReplyContent("");
      setReplyOpen(false);
      setShowReplies(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (replies.length > 0) setShowReplies(!showReplies);
                setReplyOpen(!replyOpen);
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
              data-testid={`button-reply-${post.id}`}
            >
              <Reply className="w-3.5 h-3.5" />
              Reply
            </button>
            {replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 text-xs text-primary font-medium transition-colors hover:text-primary/80"
                data-testid={`button-toggle-comments-${post.id}`}
              >
                {showReplies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {replies.length} {replies.length === 1 ? "comment" : "comments"}
              </button>
            )}
          </div>
          <ReportButton
            contentType="community_post"
            contentId={post.id}
          />
        </div>

        {showReplies && replies.length > 0 && (
          <div className="mt-4 pl-4 border-l-2 border-primary/10 space-y-0 divide-y divide-border" data-testid={`comments-list-${post.id}`}>
            {replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} textSize={textSize} />
            ))}
          </div>
        )}

        {replyOpen && (
          <div className="mt-4 pt-4 border-t border-border" data-testid={`reply-form-${post.id}`}>
            {user ? (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1">
                  <Textarea
                    placeholder="Write a comment..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="min-h-[60px] text-sm mb-2"
                    data-testid={`input-reply-${post.id}`}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setReplyOpen(false); setReplyContent(""); }}
                      data-testid={`button-cancel-reply-${post.id}`}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmitReply}
                      disabled={isSubmitting || !replyContent.trim()}
                      data-testid={`button-submit-reply-${post.id}`}
                    >
                      {isSubmitting ? "Posting..." : <><Send className="w-3.5 h-3.5 mr-1.5" /> Comment</>}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                Please <a href="/login" className="text-primary underline">sign in</a> to comment.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
    mutationFn: async (newPost: { content: string; parentId?: number }) => {
      return apiRequest("POST", "/api/community/posts", newPost);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to post. Please log in." });
    },
  });

  const handleReply = async (parentId: number, content: string) => {
    try {
      await postMutation.mutateAsync({ content, parentId });
      toast({ title: "Comment posted!" });
    } catch {
      toast({ variant: "destructive", title: "Failed to post comment. Please try again." });
    }
  };

  const topLevelPosts = useMemo(() => {
    if (!communityPosts) return [];
    return communityPosts.filter(p => !p.parentId);
  }, [communityPosts]);

  const repliesByParent = useMemo(() => {
    if (!communityPosts) return new Map<number, CommunityPost[]>();
    const map = new Map<number, CommunityPost[]>();
    for (const post of communityPosts) {
      if (post.parentId) {
        const existing = map.get(post.parentId) || [];
        existing.push(post);
        map.set(post.parentId, existing);
      }
    }
    Array.from(map.entries()).forEach(([_key, replies]) => {
      replies.sort((a: CommunityPost, b: CommunityPost) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    });
    return map;
  }, [communityPosts]);

  const sortedPosts = useMemo(() => {
    const sorted = [...topLevelPosts];
    if (sortBy === "newest") {
      sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else {
      sorted.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    }
    return sorted;
  }, [topLevelPosts, sortBy]);

  const topLevelCount = topLevelPosts.length;
  const totalComments = (communityPosts?.length || 0) - topLevelCount;

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
              onClick={() => {
                postMutation.mutate({ content: postContent }, {
                  onSuccess: () => {
                    setPostContent("");
                    toast({ title: "Post created successfully!" });
                  }
                });
              }}
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
              {topLevelCount} {topLevelCount === 1 ? "Post" : "Posts"}
              {totalComments > 0 && (
                <span className="text-muted-foreground font-normal ml-1">
                  ({totalComments} {totalComments === 1 ? "comment" : "comments"})
                </span>
              )}
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
              <PostCard
                key={post.id}
                post={post}
                replies={repliesByParent.get(post.id) || []}
                textSize={textSize}
                user={user}
                onReply={handleReply}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
