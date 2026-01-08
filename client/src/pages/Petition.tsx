import { usePetitionCount, useSignPetition } from "@/hooks/use-petition";
import { useSettings } from "@/hooks/use-settings";
import { PenTool, Users, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function Petition() {
  const { data: countData, isLoading } = usePetitionCount();
  const signPetition = useSignPetition();
  const { textSize } = useSettings();
  const { toast } = useToast();

  const handleSign = () => {
    signPetition.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Signed!",
          description: "Thank you for supporting accessibility.",
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-grow flex items-center justify-center py-20 px-4">
        <div className="max-w-4xl w-full text-center">
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-block"
          >
            <div className="bg-accent/20 p-6 rounded-full inline-flex items-center justify-center">
              <PenTool className="w-16 h-16 text-accent-foreground" />
            </div>
          </motion.div>

          <h1 className="font-display font-bold text-5xl md:text-7xl mb-8 text-foreground">
            Sign the Petition
          </h1>

          <p className={`max-w-2xl mx-auto text-muted-foreground mb-12 text-${textSize === 'xl' ? '2xl' : 'xl'}`}>
            We demand standardized accessibility ratings for all public venues in the city. Access is not a luxury—it's a right. Join us in making our city open to everyone.
          </p>

          <div className="bg-card max-w-lg mx-auto p-8 rounded-3xl border-2 border-primary shadow-2xl mb-12">
            <h2 className="text-2xl font-bold mb-2">Signatures so far</h2>
            {isLoading ? (
              <div className="h-16 flex items-center justify-center">
                <div className="w-32 h-8 bg-secondary animate-pulse rounded" />
              </div>
            ) : (
              <div className="text-6xl font-bold text-primary font-mono tracking-tight">
                {countData?.total.toLocaleString()}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-2">people have joined the movement</p>
          </div>

          <button
            onClick={handleSign}
            disabled={signPetition.isPending}
            className={`
              px-12 py-6 rounded-full font-bold text-xl md:text-2xl
              bg-primary text-primary-foreground shadow-xl shadow-primary/30
              hover:scale-105 hover:shadow-2xl active:scale-95
              transition-all duration-300
              flex items-center justify-center gap-3 mx-auto
            `}
          >
            {signPetition.isPending ? "Signing..." : (
              <>
                <Heart className={`w-8 h-8 ${signPetition.isSuccess ? 'fill-white' : ''}`} /> 
                {signPetition.isSuccess ? "Signed!" : "Add Your Signature"}
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Footer stripe */}
      <div className="h-4 bg-gradient-to-r from-primary via-accent to-primary" />
    </div>
  );
}
