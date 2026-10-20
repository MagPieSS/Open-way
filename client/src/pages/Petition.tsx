import { useState, useEffect, useCallback } from "react";
import { usePetitions, usePetition, usePetitionCount, useSignPetition, usePetitionSignatures, usePetitionUpdates, usePetitionStatus, useCreatePetition } from "@/hooks/use-petition";
import { useAuth } from "@/hooks/use-auth";
import { Link, useRoute } from "wouter";
import { useSettings } from "@/hooks/use-settings";
import { PenTool, Heart, Target, Users, TrendingUp, Share2, Trophy, Star, Clock, Copy, Check, Calendar, User, MapPin, Megaphone, ArrowRight, Sparkles, Quote, BarChart3, ArrowLeft, Plus, Eye, XCircle } from "lucide-react";
import { SiX, SiFacebook } from "react-icons/si";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { AnimatedCounter, ProgressRing } from "@/components/AnimatedCounter";
import { SectionLabel } from "@/components/SectionLabel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import type { Petition as PetitionType } from "@shared/schema";
import { usePageMeta } from "@/hooks/use-page-meta";

function getMilestones(goal: number): number[] {
  const milestones: number[] = [];
  const steps = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  for (const s of steps) {
    if (s <= goal) milestones.push(s);
  }
  if (!milestones.includes(goal)) milestones.push(goal);
  return milestones;
}

function getNextMilestone(current: number, milestones: number[]): number {
  for (const milestone of milestones) {
    if (current < milestone) return milestone;
  }
  return milestones[milestones.length - 1];
}

function getAchievedMilestones(current: number, milestones: number[]): number[] {
  return milestones.filter(m => current >= m);
}

function ConfettiEffect({ active }: { active: boolean }) {
  const { reducedMotion } = useSettings();
  if (!active || reducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 rounded-sm"
          initial={{
            x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
            y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
            opacity: 1,
            scale: 1,
            rotate: 0,
          }}
          animate={{
            x: (typeof window !== 'undefined' ? window.innerWidth / 2 : 500) + (Math.random() - 0.5) * 800,
            y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 100,
            opacity: 0,
            scale: Math.random() * 0.5 + 0.5,
            rotate: Math.random() * 720 - 360,
          }}
          transition={{
            duration: 2.5 + Math.random() * 1.5,
            ease: "easeOut",
          }}
          style={{
            backgroundColor: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'][Math.floor(Math.random() * 5)],
          }}
        />
      ))}
    </div>
  );
}

function MilestoneBadge({ milestone, achieved }: { milestone: number; achieved: boolean }) {
  const { reducedMotion } = useSettings();
  return (
    <motion.div
      initial={reducedMotion ? {} : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
        achieved
          ? 'bg-primary/10 border-primary text-primary'
          : 'bg-secondary/50 border-border text-muted-foreground'
      }`}
      data-testid={`badge-milestone-${milestone}`}
    >
      <Trophy className={`w-5 h-5 ${achieved ? 'fill-primary/30' : ''}`} />
      <span className="text-sm font-bold">{milestone.toLocaleString()}</span>
      {achieved && <Check className="w-3 h-3" />}
    </motion.div>
  );
}

function ShareProgressCard({ signatures, goal, progressPercent }: { signatures: number; goal: number; progressPercent: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `I signed the petition for accessible Philadelphia! ${signatures.toLocaleString()} of ${goal.toLocaleString()} signatures reached. Join us!`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it with friends and family." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", description: "Please copy the URL manually.", variant: "destructive" });
    }
  }, [shareUrl, toast]);

  const shareToTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank');
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20" data-testid="card-share-progress">
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-lg">Share Progress</h3>
      </div>
      
      <div className="bg-card rounded-xl p-4 mb-4 text-center border">
        <div className="text-3xl font-bold text-primary mb-1" data-testid="text-share-count">
          {signatures.toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground mb-2">
          of {goal.toLocaleString()} signatures
        </div>
        <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 text-sm font-medium text-primary">{Math.round(progressPercent)}% complete</div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={shareToTwitter}
          data-testid="button-share-twitter"
        >
          <SiX className="w-4 h-4" />
          X/Twitter
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={shareToFacebook}
          data-testid="button-share-facebook"
        >
          <SiFacebook className="w-4 h-4" />
          Facebook
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopyLink}
          aria-label={copied ? "Link copied" : "Copy link to this petition"}
          data-testid="button-copy-link"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
    </Card>
  );
}

function RecentSignersList({ petitionId }: { petitionId: number }) {
  const { data: signatures, isLoading } = usePetitionSignatures(petitionId);
  const { reducedMotion } = useSettings();
  
  const publicSignatures = signatures?.filter(s => s.shareConsent) || [];

  if (isLoading) {
    return (
      <Card className="p-6" data-testid="loading-recent-signers">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg">Recent Supporters</h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6" data-testid="card-recent-signers">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-lg">Recent Supporters</h3>
        {publicSignatures.length > 0 && (
          <Badge variant="secondary" className="ml-auto">{publicSignatures.length}</Badge>
        )}
      </div>
      
      {publicSignatures.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-6">
          Be the first to sign and share publicly!
        </p>
      ) : (
        <ScrollArea className="h-[300px] pr-4">
          <AnimatePresence mode="popLayout">
            {publicSignatures.slice(0, 20).map((sig, index) => (
              <motion.div
                key={sig.id}
                initial={reducedMotion ? {} : { opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 py-3 border-b border-border last:border-0"
                data-testid={`signer-item-${sig.id}`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate" data-testid={`text-signer-name-${sig.id}`}>
                      {sig.displayName || 'Anonymous Supporter'}
                    </span>
                    {sig.city && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {sig.city}
                      </span>
                    )}
                  </div>
                  {sig.message && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`text-signer-message-${sig.id}`}>
                      "{sig.message}"
                    </p>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {sig.signedAt ? formatDistanceToNow(new Date(sig.signedAt), { addSuffix: true }) : 'Recently'}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </ScrollArea>
      )}
    </Card>
  );
}

function OrganizerUpdates({ petitionId }: { petitionId: number }) {
  const { data: updates, isLoading } = usePetitionUpdates(petitionId);

  if (isLoading) {
    return (
      <Card className="p-6" data-testid="loading-updates">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg">Campaign Updates</h3>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border-l-2 border-primary/30 pl-4">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!updates || updates.length === 0) {
    return null;
  }

  return (
    <Card className="p-6" data-testid="card-organizer-updates">
      <div className="flex items-center gap-2 mb-6">
        <Megaphone className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-lg">Campaign Updates</h3>
      </div>
      
      <div className="space-y-6">
        {updates.map((update) => (
          <div 
            key={update.id} 
            className="border-l-2 border-primary pl-4 relative"
            data-testid={`update-item-${update.id}`}
          >
            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
              <Star className="w-2 h-2 text-white" />
            </div>
            <h4 className="font-bold text-foreground" data-testid={`text-update-title-${update.id}`}>
              {update.title}
            </h4>
            <p className="text-muted-foreground text-sm mt-1" data-testid={`text-update-content-${update.id}`}>
              {update.content}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              {update.author && <span>By {update.author}</span>}
              {update.author && update.createdAt && <span>•</span>}
              {update.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SignPetitionForm({ petitionId, onSuccess }: { petitionId: number; onSuccess: () => void }) {
  const signPetition = useSignPetition(petitionId);
  const { textSize, reducedMotion } = useSettings();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const { data: statusData, isLoading: statusLoading } = usePetitionStatus(petitionId);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    displayName: '',
    city: '',
    message: '',
    shareConsent: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    signPetition.mutate(formData, {
      onSuccess: () => {
        setShowSuccess(true);
        toast({
          title: "Thank you for signing!",
          description: "Your voice matters. Together we can make Philadelphia accessible for everyone.",
        });
        onSuccess();
        setTimeout(() => {
          setShowSuccess(false);
          setFormData({ displayName: '', city: '', message: '', shareConsent: false });
        }, 3000);
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to sign petition. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  if (!authLoading && !user) {
    return (
      <div className="text-center py-6" data-testid="sign-login-prompt">
        <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-bold text-lg mb-2">Sign In to Add Your Signature</h3>
        <p className="text-muted-foreground mb-4">
          Sign in with your Google account to add your voice to this petition.
        </p>
        <Button asChild className="w-full" data-testid="button-login-to-sign">
          <Link href={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>Sign in with Google</Link>
        </Button>
      </div>
    );
  }

  if (!statusLoading && statusData?.hasSigned) {
    return (
      <div className="text-center py-6" data-testid="already-signed">
        <div className="w-16 h-16 rounded-full bg-green-500 mx-auto mb-4 flex items-center justify-center">
          <Check className="w-8 h-8 text-white" />
        </div>
        <h3 className="font-bold text-xl mb-2">You've Already Signed!</h3>
        <p className="text-muted-foreground">
          Thank you for supporting accessible Philadelphia. Share the petition to help us reach our goal!
        </p>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <motion.div
        initial={reducedMotion ? {} : { scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8"
        data-testid="sign-success"
      >
        <motion.div
          initial={reducedMotion ? {} : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-green-500 mx-auto mb-4 flex items-center justify-center"
        >
          <Check className="w-10 h-10 text-white" />
        </motion.div>
        <h3 className="font-bold text-2xl mb-2">Signed!</h3>
        <p className="text-muted-foreground">Your signature has been added to the petition.</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-sign-petition">
      <div>
        <Label htmlFor="displayName" className={`text-${textSize}`}>Display Name (optional)</Label>
        <Input
          id="displayName"
          placeholder="How you'd like to appear"
          value={formData.displayName}
          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
          className="mt-1"
          data-testid="input-display-name"
        />
      </div>
      
      <div>
        <Label htmlFor="city" className={`text-${textSize}`}>City (optional)</Label>
        <Input
          id="city"
          placeholder="e.g., Philadelphia"
          value={formData.city}
          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          className="mt-1"
          data-testid="input-city"
        />
      </div>
      
      <div>
        <Label htmlFor="message" className={`text-${textSize}`}>Your Message (optional)</Label>
        <Textarea
          id="message"
          placeholder="Why accessibility matters to you..."
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className="mt-1 resize-none"
          rows={3}
          data-testid="input-message"
        />
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="shareConsent"
          checked={formData.shareConsent}
          onCheckedChange={(checked) => setFormData({ ...formData, shareConsent: checked === true })}
          data-testid="checkbox-share-consent"
        />
        <Label htmlFor="shareConsent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
          Display my name and message publicly on this page (optional)
        </Label>
      </div>

      <Button
        type="submit"
        disabled={signPetition.isPending}
        className="w-full py-6 text-lg font-bold gap-2"
        data-testid="button-submit-signature"
      >
        {signPetition.isPending ? (
          "Signing..."
        ) : (
          <>
            <Heart className="w-5 h-5" />
            Add My Signature
          </>
        )}
      </Button>
    </form>
  );
}

function CreatePetitionDialog() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const createPetition = useCreatePetition();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goalSignatures: 1000,
    creatorName: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({ title: "Missing fields", description: "Title and description are required.", variant: "destructive" });
      return;
    }

    createPetition.mutate(
      {
        title: formData.title,
        description: formData.description,
        goalSignatures: formData.goalSignatures || 1000,
        creatorName: formData.creatorName || undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "Petition submitted!", description: "Your petition is pending admin review. It will go live once approved." });
          setOpen(false);
          setFormData({ title: '', description: '', goalSignatures: 1000, creatorName: '' });
        },
        onError: (error: any) => {
          toast({ title: "Error", description: error.message || "Failed to create petition.", variant: "destructive" });
        },
      }
    );
  };

  if (!authLoading && !user) {
    return (
      <Button asChild className="gap-2" data-testid="button-start-petition-login">
        <Link href="/login">
          <Plus className="w-4 h-4" />
          Sign In to Start a Petition
        </Link>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-start-petition">
          <Plus className="w-4 h-4" />
          Start a Petition
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-create-petition">
        <DialogHeader>
          <DialogTitle>Start a New Petition</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="petition-title">Title *</Label>
            <Input
              id="petition-title"
              placeholder="Give your petition a clear title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
              required
              data-testid="input-petition-title"
            />
          </div>
          <div>
            <Label htmlFor="petition-description">Description *</Label>
            <Textarea
              id="petition-description"
              placeholder="Describe what you're petitioning for and why it matters..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 resize-none"
              rows={4}
              required
              data-testid="input-petition-description"
            />
          </div>
          <div>
            <Label htmlFor="petition-goal">Signature Goal</Label>
            <Input
              id="petition-goal"
              type="number"
              min={10}
              placeholder="1000"
              value={formData.goalSignatures}
              onChange={(e) => setFormData({ ...formData, goalSignatures: parseInt(e.target.value) || 1000 })}
              className="mt-1"
              data-testid="input-petition-goal"
            />
          </div>
          <div>
            <Label htmlFor="petition-creator">Your Name (optional)</Label>
            <Input
              id="petition-creator"
              placeholder="How you'd like to be identified"
              value={formData.creatorName}
              onChange={(e) => setFormData({ ...formData, creatorName: e.target.value })}
              className="mt-1"
              data-testid="input-petition-creator"
            />
          </div>
          <Button
            type="submit"
            className="w-full gap-2"
            disabled={createPetition.isPending}
            data-testid="button-submit-petition"
          >
            {createPetition.isPending ? "Creating..." : "Create Petition"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PetitionCard({ petition }: { petition: PetitionType }) {
  const { data: countData } = usePetitionCount(petition.id);
  const { reducedMotion } = useSettings();
  const signatures = countData?.total || 0;
  const goal = petition.goalSignatures || 1000;
  const progressPercent = Math.min((signatures / goal) * 100, 100);

  return (
    <motion.div
      initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link href={`/petitions/${petition.id}`}>
        <Card
          className="p-6 hover-elevate cursor-pointer h-full flex flex-col"
          data-testid={`card-petition-${petition.id}`}
        >
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <h3 className="font-bold text-lg text-foreground line-clamp-2 flex-1" data-testid={`text-petition-title-${petition.id}`}>
              {petition.title}
            </h3>
            {petition.status === 'active' && (
              <Badge variant="secondary">Active</Badge>
            )}
            {petition.status === 'pending' && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400">Pending Review</Badge>
            )}
            {petition.status === 'rejected' && (
              <Badge variant="destructive">Rejected</Badge>
            )}
          </div>

          <p className="text-muted-foreground text-sm line-clamp-3 mb-4 flex-1" data-testid={`text-petition-desc-${petition.id}`}>
            {petition.description}
          </p>

          {petition.creatorName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <User className="w-3 h-3" />
              <span>Started by {petition.creatorName}</span>
            </div>
          )}

          <div className="mt-auto">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="text-sm font-medium text-foreground" data-testid={`text-petition-signatures-${petition.id}`}>
                {signatures.toLocaleString()} signatures
              </span>
              <span className="text-xs text-muted-foreground">
                Goal: {goal.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {Math.round(progressPercent)}% of goal
              </span>
              {/* Visual affordance only — the whole card is already the link, so this isn't a
                  second nested interactive element */}
              <span
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-input text-sm font-medium"
                aria-hidden="true"
                data-testid={`button-view-petition-${petition.id}`}
              >
                <Eye className="w-3 h-3" />
                View
              </span>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

export default function PetitionListPage() {
  usePageMeta({ title: "Petitions" });
  const { data: petitions, isLoading } = usePetitions();
  const { textSize, reducedMotion } = useSettings();

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-br from-primary to-primary/80 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={reducedMotion ? {} : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-block"
          >
            <div className="bg-white/20 p-5 rounded-full inline-flex items-center justify-center">
              <Megaphone className="w-12 h-12" />
            </div>
          </motion.div>

          <h1 className="font-display font-bold text-4xl md:text-6xl mb-4">
            Petitions
          </h1>
          <p className={`text-white/90 max-w-2xl mx-auto mb-8 text-${textSize === 'xl' ? 'xl' : 'lg'}`}>
            Start a community campaign for accessibility improvements in Philadelphia. Open petitions will appear here for neighbors to review and sign.
          </p>

          <CreatePetitionDialog />
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div>
              <SectionLabel>{petitions?.length ? "Active Petitions" : "Petition Campaigns"}</SectionLabel>
              <h2 className="font-display font-bold text-3xl mt-2">{petitions?.length ? "Browse & Sign" : "Start a Campaign"}</h2>
            </div>
            {petitions && petitions.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                {petitions.length} petition{petitions.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <Skeleton className="h-2 w-full rounded-full mb-2" />
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </Card>
              ))}
            </div>
          ) : petitions && petitions.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="petitions-grid">
              {petitions.map((petition) => (
                <PetitionCard key={petition.id} petition={petition} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <PenTool className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-bold text-xl mb-2 text-foreground">No Active Petitions</h3>
              <p className="text-muted-foreground mb-6">
                There are no open campaigns to sign right now. Start one to bring an accessibility issue to the community.
              </p>
              <CreatePetitionDialog />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function PetitionDetail() {
  usePageMeta({ title: "Petition" });
  const [, params] = useRoute("/petitions/:id");
  const petitionId = params?.id ? Number(params.id) : 0;
  const { data: petition, isLoading: petitionLoading } = usePetition(petitionId);
  const { data: countData, isLoading } = usePetitionCount(petitionId);
  const { textSize, reducedMotion } = useSettings();
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastMilestone, setLastMilestone] = useState(0);

  const goal = petition?.goalSignatures || 1000;
  const milestones = getMilestones(goal);
  const signatures = countData?.total || 0;
  const progressPercent = Math.min((signatures / goal) * 100, 100);
  const nextMilestone = getNextMilestone(signatures, milestones);
  const achievedMilestones = getAchievedMilestones(signatures, milestones);
  const progressToNext = nextMilestone > 0 ? ((signatures / nextMilestone) * 100) : 100;

  useEffect(() => {
    const currentMilestone = achievedMilestones[achievedMilestones.length - 1] || 0;
    if (currentMilestone > lastMilestone && lastMilestone > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
    setLastMilestone(currentMilestone);
  }, [achievedMilestones, lastMilestone]);

  const handleSignSuccess = () => {
    if (!reducedMotion) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  };

  if (petitionLoading) {
    return (
      <div className="min-h-screen bg-background">
        <section className="bg-gradient-to-br from-primary to-primary/80 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Skeleton className="h-12 w-64 mx-auto mb-4 bg-white/20" />
            <Skeleton className="h-6 w-96 mx-auto bg-white/20" />
          </div>
        </section>
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </section>
      </div>
    );
  }

  if (!petition) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <PenTool className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="font-bold text-2xl mb-2">Petition Not Found</h2>
          <p className="text-muted-foreground mb-6">This petition may have been removed or doesn't exist.</p>
          <Button asChild className="gap-2" data-testid="button-back-to-petitions">
            <Link href="/petitions">
              <ArrowLeft className="w-4 h-4" />
              Back to All Petitions
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ConfettiEffect active={showConfetti} />

      {petition.status === "pending" && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3 text-yellow-800 dark:text-yellow-200">
            <Clock className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">This petition is pending admin review. It will be publicly visible once approved.</p>
          </div>
        </div>
      )}

      {petition.status === "rejected" && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3 text-red-800 dark:text-red-200">
            <XCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">This petition has been rejected by an admin and is not publicly visible.</p>
          </div>
        </div>
      )}
      
      <section className="bg-gradient-to-br from-primary to-primary/80 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={reducedMotion ? {} : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-block"
          >
            <div className="bg-white/20 p-5 rounded-full inline-flex items-center justify-center">
              <PenTool className="w-12 h-12" />
            </div>
          </motion.div>

          <h1 className="font-display font-bold text-4xl md:text-6xl mb-4" data-testid="text-petition-detail-title">
            {petition.title}
          </h1>
          <p className={`text-white/90 max-w-2xl mx-auto text-${textSize === 'xl' ? 'xl' : 'lg'}`} data-testid="text-petition-detail-description">
            {petition.description}
          </p>
          {petition.creatorName && (
            <p className="text-white/70 mt-4 text-sm">
              Started by {petition.creatorName}
            </p>
          )}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-4">
        <Button asChild variant="ghost" className="gap-2" data-testid="link-back-to-petitions">
          <Link href="/petitions">
            <ArrowLeft className="w-4 h-4" />
            Back to All Petitions
          </Link>
        </Button>
      </div>

      <section className="pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="p-8 shadow-xl border-2 border-primary/10" data-testid="card-main-progress">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <ProgressRing progress={progressPercent} size={180} strokeWidth={12} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {isLoading ? (
                          <Skeleton className="w-16 h-8" data-testid="loading-signature-count" />
                        ) : (
                          <>
                            <span className="text-4xl font-bold text-primary font-mono" data-testid="text-signature-count">
                              <AnimatedCounter value={signatures} />
                            </span>
                            <span className="text-sm text-muted-foreground">signatures</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-muted-foreground" data-testid="text-goal-progress">
                        <span className="font-bold text-foreground">{Math.round(progressPercent)}%</span> of {goal.toLocaleString()} goal
                      </p>
                    </div>
                  </div>

                  <div>
                    <h2 className="font-display font-bold text-2xl mb-4">Join the Movement</h2>
                    <SignPetitionForm petitionId={petitionId} onSuccess={handleSignSuccess} />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <Trophy className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">Milestones</h3>
                    {nextMilestone > signatures && (
                      <span className="text-sm text-muted-foreground ml-auto" data-testid="text-next-milestone">
                        {(nextMilestone - signatures).toLocaleString()} to reach {nextMilestone.toLocaleString()}
                      </span>
                    )}
                  </div>
                  
                  <div className="w-full h-2 bg-secondary rounded-full mb-4 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressToNext}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2" data-testid="milestones-container">
                    {milestones.slice(0, 6).map((milestone) => (
                      <MilestoneBadge
                        key={milestone}
                        milestone={milestone}
                        achieved={signatures >= milestone}
                      />
                    ))}
                  </div>
                </div>
              </Card>

              <ShareProgressCard
                signatures={signatures}
                goal={goal}
                progressPercent={progressPercent}
              />

              <OrganizerUpdates petitionId={petitionId} />
            </div>

            <div className="space-y-6">
              <RecentSignersList petitionId={petitionId} />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-secondary/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel>Why It Matters</SectionLabel>
            <h2 className="font-display font-bold text-3xl mt-4 mb-4">Your Voice Has Power</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every signature brings us closer to a more accessible Philadelphia. Here's why your support makes a difference.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="p-6 text-center hover-elevate">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold mb-2">Clear Standards</h3>
              <p className="text-muted-foreground text-sm">Push for consistent accessibility ratings across all venues in the city</p>
            </Card>
            <Card className="p-6 text-center hover-elevate">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-bold mb-2">Community Power</h3>
              <p className="text-muted-foreground text-sm">Unite voices to create lasting change in our city's infrastructure</p>
            </Card>
            <Card className="p-6 text-center hover-elevate">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-7 h-7 text-green-500" />
              </div>
              <h3 className="font-bold mb-2">Real Impact</h3>
              <p className="text-muted-foreground text-sm">Signatures drive policy discussions and action at City Hall</p>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold mb-2">The Numbers Speak</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>
                        More than 1 in 4 U.S. adults have some type of disability (
                        <a
                          href="https://www.cdc.gov/disability-and-health/articles-documents/disability-impacts-all-of-us-infographic.html"
                          className="underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          CDC<span className="sr-only"> (opens in a new tab)</span>
                        </a>
                        )
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                      Accessibility benefits everyone, not just people with disabilities
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-accent/5 to-transparent">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Quote className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <blockquote className="italic text-muted-foreground mb-3">
                    "Accessibility is not a feature. It's a social trend and a human right."
                  </blockquote>
                  <cite className="text-sm font-medium">— Disability Rights Advocate</cite>
                </div>
              </div>
            </Card>
          </div>

          <div className="text-center">
            <Card className="inline-block p-8 bg-gradient-to-r from-primary to-accent text-white">
              <h3 className="font-bold text-xl mb-2">Ready to Make a Difference?</h3>
              <p className="text-white/80 mb-4">Sign the petition now and be part of the change.</p>
              <Button
                variant="secondary"
                size="lg"
                className="gap-2"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                data-testid="button-cta-sign"
              >
                Sign the Petition
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Card>
          </div>
        </div>
      </section>

      <div className="h-2 bg-gradient-to-r from-primary via-accent to-primary" />
    </div>
  );
}
