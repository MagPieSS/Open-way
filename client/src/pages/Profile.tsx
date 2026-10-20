import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { SectionLabel } from "@/components/SectionLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  User, Mail, Calendar, Shield, Edit2, Save, X, LogIn,
  Bookmark, Settings
} from "lucide-react";
import { format } from "date-fns";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function Profile() {
  usePageMeta({ title: "Your Profile" });
  const { user, isLoading: authLoading, signOutEverywhere, isSigningOutEverywhere } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  

  const updateDisplayNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const res = await apiRequest("PATCH", "/api/profile/display-name", { displayName: newName });
      if (!res.ok) {
        try {
          const err = await res.json();
          throw new Error(err.message || "Failed to update display name");
        } catch {
          throw new Error("Failed to update display name. Please try again.");
        }
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setIsEditingName(false);
      toast({
        title: "Display name updated",
        description: "Your display name has been changed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update display name.",
      });
    },
  });

  const handleSignOutEverywhere = async () => {
    try {
      await signOutEverywhere();
      toast({ title: "Signed out elsewhere", description: "You're signed out on every other device. This one stays signed in." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Couldn't sign out other devices. Please try again." });
    }
  };

  const handleEditName = () => {
    setDisplayName(user?.displayName || "");
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (!displayName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Display name cannot be empty.",
      });
      return;
    }
    updateDisplayNameMutation.mutate(displayName.trim());
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
          <div className="max-w-7xl mx-auto">
            <SectionLabel>Profile</SectionLabel>
            <h1 className="font-display font-bold text-4xl mt-2 mb-2">Your Profile</h1>
            <p className="text-muted-foreground text-lg">Manage your account settings</p>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display font-bold text-2xl mb-4">Sign in to view your profile</h2>
            <p className="text-muted-foreground mb-6">
              Sign in with your Google account to manage your profile and settings.
            </p>
            <div className="flex justify-center">
              <Button asChild data-testid="button-login-prompt">
                <Link href="/login?returnTo=/profile">Sign in with Google</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <SectionLabel>Account</SectionLabel>
          <h1 className="font-display font-bold text-4xl mt-2 mb-2">Your Profile</h1>
          <p className="text-muted-foreground text-lg">Manage your account settings and preferences</p>
        </div>
      </section>

      <section className="py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Account Information
              </CardTitle>
              <CardDescription>Your basic account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <p className="text-foreground font-medium" data-testid="text-user-email">{user.email}</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  Display Name
                </Label>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter display name"
                      className="max-w-xs"
                      data-testid="input-display-name"
                    />
                    <Button
                      size="icon"
                      onClick={handleSaveName}
                      disabled={updateDisplayNameMutation.isPending}
                      aria-label="Save display name"
                      data-testid="button-save-name"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setIsEditingName(false)}
                      aria-label="Cancel editing display name"
                      data-testid="button-cancel-edit-name"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-foreground font-medium" data-testid="text-display-name">
                      {user.displayName || "Not set"}
                    </p>
                    <Button size="sm" variant="outline" onClick={handleEditName} data-testid="button-edit-name">
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Member Since
                </Label>
                <p className="text-foreground font-medium" data-testid="text-member-since">
                  {user.createdAt ? format(new Date(user.createdAt), "MMMM d, yyyy") : "Unknown"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" aria-hidden="true" />
                Sign-in and security
              </CardTitle>
              <CardDescription>
                You sign in with your Google account ({user.email}). Your password and two-step verification are
                managed by Google, not Open Way.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Signed in on a shared or lost device? Sign out everywhere else; this device stays signed in.
              </p>
              <Button
                variant="outline"
                onClick={handleSignOutEverywhere}
                disabled={isSigningOutEverywhere}
                data-testid="button-sign-out-everywhere"
              >
                Sign out of other devices
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bookmark className="w-5 h-5" />
                Quick Links
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Link href="/saved">
                  <Button variant="outline" data-testid="button-view-saved">
                    <Bookmark className="w-4 h-4 mr-2" />
                    View Saved Places
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline" data-testid="button-go-settings">
                    <Settings className="w-4 h-4 mr-2" />
                    Accessibility Settings
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
