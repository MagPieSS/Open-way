import { usePetitionCount, useSignPetition } from "@/hooks/use-petition";
import { useSettings } from "@/hooks/use-settings";
import { PenTool, Heart, Target, Users, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { AnimatedCounter, ProgressRing } from "@/components/AnimatedCounter";
import { SectionLabel } from "@/components/SectionLabel";

const PETITION_GOAL = 10000;

export default function Petition() {
  const { data: countData, isLoading } = usePetitionCount();
  const signPetition = useSignPetition();
  const { textSize, reducedMotion } = useSettings();
  const { toast } = useToast();

  const signatures = countData?.total || 0;
  const progressPercent = Math.min((signatures / PETITION_GOAL) * 100, 100);

  const handleSign = () => {
    signPetition.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Thank you!",
          description: "Your signature has been added to the petition.",
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
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

          <h1 className="font-display font-bold text-4xl md:text-6xl mb-4">
            Sign the Petition
          </h1>
          <p className={`text-white/90 max-w-2xl mx-auto text-${textSize === 'xl' ? 'xl' : 'lg'}`}>
            We demand standardized accessibility ratings for all public venues in Philadelphia. Access is not a luxury—it's a right.
          </p>
        </div>
      </section>

      {/* Counter Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-3xl p-8 md:p-12 shadow-xl border border-border">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Progress Ring */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <ProgressRing progress={progressPercent} size={180} strokeWidth={12} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {isLoading ? (
                      <div className="w-16 h-8 bg-secondary animate-pulse rounded" />
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
                  <p className="text-muted-foreground">
                    <span className="font-bold text-foreground">{Math.round(progressPercent)}%</span> of {PETITION_GOAL.toLocaleString()} goal
                  </p>
                </div>
              </div>

              {/* Sign CTA */}
              <div className="text-center md:text-left">
                <h2 className="font-display font-bold text-2xl md:text-3xl mb-4">
                  Join the Movement
                </h2>
                <p className={`text-muted-foreground mb-6 text-${textSize}`}>
                  Every signature brings us closer to mandatory accessibility standards for all public spaces in our city.
                </p>
                <button
                  onClick={handleSign}
                  disabled={signPetition.isPending}
                  className="w-full md:w-auto px-10 py-5 rounded-full font-bold text-xl bg-primary text-primary-foreground shadow-xl shadow-primary/30 hover:scale-105 hover:shadow-2xl active:scale-95 transition-all duration-300 flex items-center justify-center gap-3"
                  data-testid="button-sign-petition"
                >
                  {signPetition.isPending ? "Signing..." : (
                    <>
                      <Heart className={`w-6 h-6 ${signPetition.isSuccess ? 'fill-white' : ''}`} /> 
                      {signPetition.isSuccess ? "Signed!" : "Add Your Signature"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Sign Section */}
      <section className="py-16 px-4 bg-secondary/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel>Why It Matters</SectionLabel>
            <h2 className="font-display font-bold text-3xl mt-4">Your Voice Has Power</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-card p-6 rounded-xl border border-border text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold mb-2">Clear Standards</h3>
              <p className="text-muted-foreground text-sm">Push for consistent accessibility ratings across all venues</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-bold mb-2">Community Power</h3>
              <p className="text-muted-foreground text-sm">Unite voices to create lasting change in our city</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border text-center">
              <div className="w-12 h-12 rounded-full bg-accessible/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-accessible" />
              </div>
              <h3 className="font-bold mb-2">Real Impact</h3>
              <p className="text-muted-foreground text-sm">Signatures drive policy discussions at City Hall</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer gradient */}
      <div className="h-2 bg-gradient-to-r from-primary via-accent to-primary" />
    </div>
  );
}
