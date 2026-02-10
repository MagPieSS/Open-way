import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { SectionLabel } from "@/components/SectionLabel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Shield, Trash2, ImageIcon, MapPin, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { PlaceMedia } from "@shared/schema";

interface PlaceMediaWithName extends PlaceMedia {
  placeName: string;
}

export default function AdminModeration() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: media, isLoading } = useQuery<PlaceMediaWithName[]>({
    queryKey: ["/api/admin/media"],
    enabled: !!user?.isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/media/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/media"] });
      toast({ title: "Photo removed", description: "The photo has been deleted successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !user?.isAdmin) {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <SectionLabel>Admin</SectionLabel>
          <h1 className="font-display font-bold text-4xl mt-2 mb-2 flex items-center gap-3 flex-wrap">
            <Shield className="w-8 h-8 text-primary" />
            Photo Moderation
          </h1>
          <p className="text-muted-foreground text-lg">
            Review and manage user-uploaded photos across all places
          </p>
        </div>
      </section>

      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-secondary rounded-t-md" />
                  <CardContent className="pt-4 space-y-2">
                    <div className="h-4 w-2/3 bg-secondary rounded" />
                    <div className="h-3 w-1/2 bg-secondary rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !media || media.length === 0 ? (
            <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
              <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-muted-foreground mb-2" data-testid="text-no-media">No uploaded photos</h3>
              <p className="text-muted-foreground">There are no user-uploaded photos to review yet.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <Badge variant="outline" data-testid="badge-media-count">
                  {media.length} {media.length === 1 ? "photo" : "photos"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {media.map((item) => (
                  <Card key={item.id} data-testid={`card-media-${item.id}`}>
                    <div className="relative h-48 overflow-hidden rounded-t-md bg-muted">
                      <img
                        src={item.url}
                        alt={item.caption || "User uploaded photo"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "";
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate" data-testid={`text-media-place-${item.id}`}>{item.placeName}</span>
                      </div>

                      {item.caption && (
                        <p className="text-sm text-foreground line-clamp-2" data-testid={`text-media-caption-${item.id}`}>
                          {item.caption}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {item.uploadedBy && (
                            <p data-testid={`text-media-uploader-${item.id}`}>By: {item.uploadedBy}</p>
                          )}
                          {item.createdAt && (
                            <p>{format(new Date(item.createdAt), "MMM d, yyyy")}</p>
                          )}
                        </div>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-media-${item.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Remove
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
