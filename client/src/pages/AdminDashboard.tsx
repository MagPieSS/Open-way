import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { SectionLabel } from "@/components/SectionLabel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Shield, Trash2, ImageIcon, Loader2, Users, MapPin, Star, Camera, Flag, FileSignature,
  Edit, Ban, CheckCircle, XCircle, MessageSquare, Eye
} from "lucide-react";
import { format } from "date-fns";
import type { Place, Review, CommunityPost, PlaceMedia, Report, Signature } from "@shared/schema";

interface AdminStats {
  totalUsers: number;
  totalPlaces: number;
  totalReviews: number;
  totalMedia: number;
  totalReports: number;
  totalPetitions: number;
}

interface PlaceMediaWithName extends PlaceMedia {
  placeName: string;
}

interface ReviewWithPlace extends Review {
  placeName?: string;
}

interface CommunityPostWithAuthor extends CommunityPost {
  authorName: string | null;
}

interface ReportWithDetails extends Report {
  reporterEmail?: string;
}

interface UserRecord {
  id: number;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  banReason: string | null;
  isActive: boolean;
  createdAt: string | null;
  reviewCount?: number;
  postCount?: number;
}

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [editPlace, setEditPlace] = useState<Place | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", accessibilityStatus: "", address: "" });
  const [banUser, setBanUser] = useState<UserRecord | null>(null);
  const [banReason, setBanReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number; name: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user?.isAdmin) {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user?.isAdmin,
  });

  const { data: media, isLoading: mediaLoading } = useQuery<PlaceMediaWithName[]>({
    queryKey: ["/api/admin/media"],
    enabled: !!user?.isAdmin,
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<ReviewWithPlace[]>({
    queryKey: ["/api/admin/reviews"],
    enabled: !!user?.isAdmin,
  });

  const { data: communityPosts, isLoading: postsLoading } = useQuery<CommunityPostWithAuthor[]>({
    queryKey: ["/api/admin/community-posts"],
    enabled: !!user?.isAdmin,
  });

  const { data: placesData, isLoading: placesLoading } = useQuery<Place[]>({
    queryKey: ["/api/places"],
    enabled: !!user?.isAdmin,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<UserRecord[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin,
  });

  const { data: signaturesData, isLoading: signaturesLoading } = useQuery<Signature[]>({
    queryKey: ["/api/signatures"],
    enabled: !!user?.isAdmin,
  });

  const { data: reportsData, isLoading: reportsLoading } = useQuery<ReportWithDetails[]>({
    queryKey: ["/api/admin/reports"],
    enabled: !!user?.isAdmin,
  });

  const deleteMediaMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/media/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Photo removed", description: "The photo has been deleted successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/reviews/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Review removed", description: "The review has been deleted successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/community-posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community-posts"] });
      toast({ title: "Post removed", description: "The community post has been deleted successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const editPlaceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof editForm }) => {
      await apiRequest("PUT", `/api/admin/places/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/places"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setEditPlace(null);
      toast({ title: "Place updated", description: "The place has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePlaceMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/places/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/places"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteConfirm(null);
      toast({ title: "Place deleted", description: "The place has been deleted successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${id}/ban`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setBanUser(null);
      setBanReason("");
      toast({ title: "User banned", description: "The user has been banned successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/admin/users/${id}/unban`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User unbanned", description: "The user has been unbanned successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteSignatureMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/signatures/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signatures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Signature removed", description: "The signature has been deleted successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resolveReportMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/admin/reports/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Report updated", description: "The report status has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Report deleted", description: "The report has been deleted successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

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

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, testId: "stat-total-users" },
    { label: "Total Places", value: stats?.totalPlaces ?? 0, icon: MapPin, testId: "stat-total-places" },
    { label: "Total Reviews", value: stats?.totalReviews ?? 0, icon: Star, testId: "stat-total-reviews" },
    { label: "Total Photos", value: stats?.totalMedia ?? 0, icon: Camera, testId: "stat-total-photos" },
    { label: "Pending Reports", value: stats?.totalReports ?? 0, icon: Flag, testId: "stat-pending-reports" },
    { label: "Total Petitions", value: stats?.totalPetitions ?? 0, icon: FileSignature, testId: "stat-total-petitions" },
  ];

  function openEditDialog(place: Place) {
    setEditForm({
      name: place.name,
      description: place.description,
      accessibilityStatus: place.accessibilityStatus,
      address: place.address || "",
    });
    setEditPlace(place);
  }

  function getReportStatusBadge(status: string | null) {
    switch (status) {
      case "resolved":
        return <Badge variant="outline" data-testid="badge-status-resolved">Resolved</Badge>;
      case "dismissed":
        return <Badge variant="secondary" data-testid="badge-status-dismissed">Dismissed</Badge>;
      default:
        return <Badge variant="default" data-testid="badge-status-pending">Pending</Badge>;
    }
  }

  function getUserStatusBadge(userRecord: UserRecord) {
    if (userRecord.isAdmin) return <Badge variant="default" data-testid={`badge-user-admin-${userRecord.id}`}>Admin</Badge>;
    if (userRecord.isBanned) return <Badge variant="destructive" data-testid={`badge-user-banned-${userRecord.id}`}>Banned</Badge>;
    return <Badge variant="outline" data-testid={`badge-user-active-${userRecord.id}`}>Active</Badge>;
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-8 px-4 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <SectionLabel>Admin</SectionLabel>
          <h1 className="font-display font-bold text-3xl mt-2 mb-1 flex items-center gap-3 flex-wrap" data-testid="text-admin-title">
            <Shield className="w-7 h-7 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage content, users, and site settings
          </p>
        </div>
      </section>

      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="overview" data-testid="admin-tabs">
            <TabsList className="mb-6 flex-wrap" data-testid="admin-tabs-list">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="content" data-testid="tab-content">Content</TabsTrigger>
              <TabsTrigger value="places" data-testid="tab-places">Places</TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
              <TabsTrigger value="petitions" data-testid="tab-petitions">Petitions</TabsTrigger>
              <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" data-testid="tab-content-overview">
              {statsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {statCards.map((stat) => (
                    <Card key={stat.testId} data-testid={stat.testId}>
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                        <stat.icon className="w-5 h-5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold" data-testid={`${stat.testId}-value`}>{stat.value}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="content" data-testid="tab-content-content">
              <div className="space-y-10">
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 flex-wrap">
                    <Camera className="w-5 h-5" /> Photos
                    {media && <Badge variant="outline" data-testid="badge-photo-count">{media.length}</Badge>}
                  </h2>
                  {mediaLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !media || media.length === 0 ? (
                    <div className="text-center py-12 bg-secondary/50 rounded-md border-2 border-dashed border-border">
                      <ImageIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground" data-testid="text-no-photos">No uploaded photos</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {media.map((item) => (
                        <Card key={item.id} data-testid={`card-media-${item.id}`}>
                          <div className="relative h-48 overflow-hidden rounded-t-md bg-muted">
                            <img
                              src={item.url}
                              alt={item.caption || "User uploaded photo"}
                              className="w-full h-full object-cover"
                              onError={(e) => {
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
                              <p className="text-sm line-clamp-2" data-testid={`text-media-caption-${item.id}`}>{item.caption}</p>
                            )}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="text-xs text-muted-foreground">
                                {item.uploadedBy && <p data-testid={`text-media-uploader-${item.id}`}>By: {item.uploadedBy}</p>}
                                {item.createdAt && <p>{format(new Date(item.createdAt), "MMM d, yyyy")}</p>}
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteMediaMutation.mutate(item.id)}
                                disabled={deleteMediaMutation.isPending}
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
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 flex-wrap">
                    <Star className="w-5 h-5" /> Reviews
                    {reviewsData && <Badge variant="outline" data-testid="badge-review-count">{reviewsData.length}</Badge>}
                  </h2>
                  {reviewsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !reviewsData || reviewsData.length === 0 ? (
                    <div className="text-center py-12 bg-secondary/50 rounded-md border-2 border-dashed border-border">
                      <Star className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground" data-testid="text-no-reviews">No reviews</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reviewsData.map((review) => (
                        <Card key={review.id} data-testid={`card-review-${review.id}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium" data-testid={`text-review-author-${review.id}`}>
                                    {review.authorName || "Anonymous"}
                                  </span>
                                  {review.rating && (
                                    <Badge variant="outline" data-testid={`badge-review-rating-${review.id}`}>
                                      {review.rating}/5
                                    </Badge>
                                  )}
                                  {(review as ReviewWithPlace).placeName && (
                                    <span className="text-sm text-muted-foreground" data-testid={`text-review-place-${review.id}`}>
                                      at {(review as ReviewWithPlace).placeName}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm line-clamp-2" data-testid={`text-review-content-${review.id}`}>{review.content}</p>
                                {review.createdAt && (
                                  <p className="text-xs text-muted-foreground">{format(new Date(review.createdAt), "MMM d, yyyy")}</p>
                                )}
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteReviewMutation.mutate(review.id)}
                                disabled={deleteReviewMutation.isPending}
                                data-testid={`button-delete-review-${review.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                Remove
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 flex-wrap">
                    <MessageSquare className="w-5 h-5" /> Community Posts
                    {communityPosts && <Badge variant="outline" data-testid="badge-post-count">{communityPosts.length}</Badge>}
                  </h2>
                  {postsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !communityPosts || communityPosts.length === 0 ? (
                    <div className="text-center py-12 bg-secondary/50 rounded-md border-2 border-dashed border-border">
                      <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground" data-testid="text-no-posts">No community posts</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {communityPosts.map((post) => (
                        <Card key={post.id} data-testid={`card-post-${post.id}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex-1 min-w-0 space-y-1">
                                <span className="font-medium" data-testid={`text-post-author-${post.id}`}>
                                  {post.authorName || "Anonymous"}
                                </span>
                                <p className="text-sm line-clamp-3" data-testid={`text-post-content-${post.id}`}>{post.content}</p>
                                {post.createdAt && (
                                  <p className="text-xs text-muted-foreground">{format(new Date(post.createdAt), "MMM d, yyyy")}</p>
                                )}
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deletePostMutation.mutate(post.id)}
                                disabled={deletePostMutation.isPending}
                                data-testid={`button-delete-post-${post.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                Remove
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="places" data-testid="tab-content-places">
              {placesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : !placesData || placesData.length === 0 ? (
                <div className="text-center py-12 bg-secondary/50 rounded-md border-2 border-dashed border-border">
                  <MapPin className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground" data-testid="text-no-places">No places found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-places">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Accessibility</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {placesData.map((place) => (
                        <TableRow key={place.id} data-testid={`row-place-${place.id}`}>
                          <TableCell className="font-medium" data-testid={`text-place-name-${place.id}`}>{place.name}</TableCell>
                          <TableCell data-testid={`text-place-category-${place.id}`}>{place.category}</TableCell>
                          <TableCell>
                            <Badge
                              variant={place.accessibilityStatus === "Accessible" ? "outline" : place.accessibilityStatus === "Not Accessible" ? "destructive" : "secondary"}
                              data-testid={`badge-place-status-${place.id}`}
                            >
                              {place.accessibilityStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(place)}
                                data-testid={`button-edit-place-${place.id}`}
                              >
                                <Edit className="w-3.5 h-3.5 mr-1.5" />
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteConfirm({ type: "place", id: place.id, name: place.name })}
                                data-testid={`button-delete-place-${place.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="users" data-testid="tab-content-users">
              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : !usersData || usersData.length === 0 ? (
                <div className="text-center py-12 bg-secondary/50 rounded-md border-2 border-dashed border-border">
                  <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground" data-testid="text-no-users">No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-users">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersData.map((userRecord) => (
                        <TableRow key={userRecord.id} data-testid={`row-user-${userRecord.id}`}>
                          <TableCell className="font-medium" data-testid={`text-user-name-${userRecord.id}`}>
                            {userRecord.displayName || "—"}
                          </TableCell>
                          <TableCell data-testid={`text-user-email-${userRecord.id}`}>{userRecord.email}</TableCell>
                          <TableCell>{getUserStatusBadge(userRecord)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {userRecord.createdAt ? format(new Date(userRecord.createdAt), "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell>
                            {!userRecord.isAdmin && (
                              <div className="flex items-center gap-2 flex-wrap">
                                {userRecord.isBanned ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => unbanUserMutation.mutate(userRecord.id)}
                                    disabled={unbanUserMutation.isPending}
                                    data-testid={`button-unban-user-${userRecord.id}`}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                    Unban
                                  </Button>
                                ) : (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setBanUser(userRecord)}
                                    data-testid={`button-ban-user-${userRecord.id}`}
                                  >
                                    <Ban className="w-3.5 h-3.5 mr-1.5" />
                                    Ban
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="petitions" data-testid="tab-content-petitions">
              {signaturesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : !signaturesData || (Array.isArray(signaturesData) && signaturesData.length === 0) ? (
                <div className="text-center py-12 bg-secondary/50 rounded-md border-2 border-dashed border-border">
                  <FileSignature className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground" data-testid="text-no-signatures">No signatures found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(Array.isArray(signaturesData) ? signaturesData : []).map((sig) => (
                    <Card key={sig.id} data-testid={`card-signature-${sig.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium" data-testid={`text-sig-name-${sig.id}`}>
                                {sig.displayName || "Anonymous"}
                              </span>
                              {sig.city && (
                                <span className="text-sm text-muted-foreground" data-testid={`text-sig-city-${sig.id}`}>
                                  from {sig.city}
                                </span>
                              )}
                            </div>
                            {sig.message && (
                              <p className="text-sm line-clamp-2" data-testid={`text-sig-message-${sig.id}`}>{sig.message}</p>
                            )}
                            {sig.signedAt && (
                              <p className="text-xs text-muted-foreground">{format(new Date(sig.signedAt), "MMM d, yyyy")}</p>
                            )}
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteSignatureMutation.mutate(sig.id)}
                            disabled={deleteSignatureMutation.isPending}
                            data-testid={`button-delete-signature-${sig.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Remove
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reports" data-testid="tab-content-reports">
              {reportsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : !reportsData || reportsData.length === 0 ? (
                <div className="text-center py-12 bg-secondary/50 rounded-md border-2 border-dashed border-border">
                  <Flag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground" data-testid="text-no-reports">No reports found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reportsData.map((report) => (
                    <Card key={report.id} data-testid={`card-report-${report.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" data-testid={`badge-report-type-${report.id}`}>
                                {report.contentType}
                              </Badge>
                              {getReportStatusBadge(report.status)}
                            </div>
                            <p className="text-sm" data-testid={`text-report-reason-${report.id}`}>{report.reason}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              {(report as ReportWithDetails).reporterEmail && (
                                <span data-testid={`text-report-reporter-${report.id}`}>
                                  Reporter: {(report as ReportWithDetails).reporterEmail}
                                </span>
                              )}
                              {report.createdAt && (
                                <span>{format(new Date(report.createdAt), "MMM d, yyyy")}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {report.status === "pending" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => resolveReportMutation.mutate({ id: report.id, status: "resolved" })}
                                  disabled={resolveReportMutation.isPending}
                                  data-testid={`button-resolve-report-${report.id}`}
                                >
                                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                  Resolve
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => resolveReportMutation.mutate({ id: report.id, status: "dismissed" })}
                                  disabled={resolveReportMutation.isPending}
                                  data-testid={`button-dismiss-report-${report.id}`}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                                  Dismiss
                                </Button>
                              </>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteReportMutation.mutate(report.id)}
                              disabled={deleteReportMutation.isPending}
                              data-testid={`button-delete-report-${report.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <Dialog open={!!editPlace} onOpenChange={(open) => !open && setEditPlace(null)}>
        <DialogContent data-testid="dialog-edit-place">
          <DialogHeader>
            <DialogTitle>Edit Place</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                data-testid="input-edit-place-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                data-testid="input-edit-place-description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Accessibility Status</label>
              <Select
                value={editForm.accessibilityStatus}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, accessibilityStatus: value }))}
              >
                <SelectTrigger data-testid="select-edit-place-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Accessible">Accessible</SelectItem>
                  <SelectItem value="Partially Accessible">Partially Accessible</SelectItem>
                  <SelectItem value="Not Accessible">Not Accessible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address</label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                data-testid="input-edit-place-address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlace(null)} data-testid="button-cancel-edit-place">
              Cancel
            </Button>
            <Button
              onClick={() => editPlace && editPlaceMutation.mutate({ id: editPlace.id, data: editForm })}
              disabled={editPlaceMutation.isPending}
              data-testid="button-save-edit-place"
            >
              {editPlaceMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent data-testid="dialog-delete-confirm">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deletePlaceMutation.mutate(deleteConfirm.id)}
              disabled={deletePlaceMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deletePlaceMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!banUser} onOpenChange={(open) => { if (!open) { setBanUser(null); setBanReason(""); } }}>
        <DialogContent data-testid="dialog-ban-user">
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Ban <strong>{banUser?.displayName || banUser?.email}</strong> from the platform.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter reason for banning this user..."
                data-testid="input-ban-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBanUser(null); setBanReason(""); }} data-testid="button-cancel-ban">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => banUser && banUserMutation.mutate({ id: banUser.id, reason: banReason })}
              disabled={banUserMutation.isPending || !banReason.trim()}
              data-testid="button-confirm-ban"
            >
              {banUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
