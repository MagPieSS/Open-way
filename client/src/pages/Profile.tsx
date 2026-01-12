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
  User, Mail, Calendar, Shield, Edit2, Save, X, Lock, LogIn,
  Bookmark, Settings, ShieldCheck, ShieldOff
} from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/profile/change-password", data);
      if (!res.ok) {
        try {
          const err = await res.json();
          throw new Error(err.message || "Failed to change password");
        } catch {
          throw new Error("Failed to change password. Please try again.");
        }
      }
      return res.json();
    },
    onSuccess: () => {
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to change password.",
      });
    },
  });

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

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all password fields.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "New passwords do not match.",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Password must be at least 8 characters.",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
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
              Create an account or log in to manage your profile and settings.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/login">
                <Button data-testid="button-login-prompt">Log In</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" data-testid="button-register-prompt">Create Account</Button>
              </Link>
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
                      data-testid="button-save-name"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setIsEditingName(false)}
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
                <Shield className="w-5 h-5" />
                Security
              </CardTitle>
              <CardDescription>Manage your password and two-factor authentication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                {isChangingPassword ? (
                  <div className="space-y-3 max-w-sm">
                    <Input
                      type="password"
                      placeholder="Current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      data-testid="input-current-password"
                    />
                    <Input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      data-testid="input-new-password"
                    />
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      data-testid="input-confirm-password"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleChangePassword}
                        disabled={changePasswordMutation.isPending}
                        data-testid="button-save-password"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Password
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsChangingPassword(false);
                          setCurrentPassword("");
                          setNewPassword("");
                          setConfirmPassword("");
                        }}
                        data-testid="button-cancel-password"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setIsChangingPassword(true)} data-testid="button-change-password">
                    <Lock className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  {user.twoFactorEnabled ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                  Two-Factor Authentication
                </Label>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${user.twoFactorEnabled ? 'bg-accessible text-accessible-foreground' : 'bg-muted text-muted-foreground'}`} data-testid="text-2fa-status">
                    {user.twoFactorEnabled ? "Enabled" : "Disabled"}
                  </span>
                  <Link href="/settings">
                    <Button variant="outline" size="sm" data-testid="button-manage-2fa">
                      <Settings className="w-4 h-4 mr-2" />
                      Manage in Settings
                    </Button>
                  </Link>
                </div>
              </div>
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
