import { useSettings } from "@/hooks/use-settings";

export default function About() {
  const { textSize } = useSettings();

  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display font-bold text-5xl mb-8 text-primary">About Open Way</h1>
        
        <div className={`space-y-8 text-muted-foreground text-${textSize}`}>
          <p className="text-xl text-foreground font-medium">
            Open Way is a community-driven platform dedicated to mapping the accessibility of public spaces.
          </p>
          
          <p>
            For millions of people, stepping out the door involves a complex calculation: "Will I be able to get in? Is there a ramp? Are the restrooms accessible?" Often, the information online is missing or inaccurate.
          </p>
          
          <p>
            We believe that spontaneity shouldn't be a privilege. By crowdsourcing real-world accessibility data, we empower everyone to navigate their city with confidence and dignity.
          </p>

          <h2 className="font-display font-bold text-3xl text-foreground mt-12 mb-4">Our Values</h2>
          
          <ul className="space-y-4 list-disc pl-6">
            <li><strong>Inclusion First:</strong> We design for the margins because that improves the experience for everyone.</li>
            <li><strong>Honesty:</strong> We prioritize verified, user-generated feedback over marketing claims.</li>
            <li><strong>Action:</strong> We don't just map barriers; we advocate to remove them.</li>
          </ul>

          <div className="bg-secondary p-8 rounded-2xl mt-12">
            <h3 className="font-bold text-xl text-foreground mb-2">Get Involved</h3>
            <p>
              Whether you add a review, sign our petition, or simply tell a friend, you are helping build a more open world. Thank you for moving your way with us.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
