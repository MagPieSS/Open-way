import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { SectionLabel } from "@/components/SectionLabel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Eye,
  MapPinned,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  Users,
  Waypoints,
  HeartHandshake,
} from "lucide-react";

const goodPatterns = [
  {
    title: "Quick, task-first search",
    description:
      "Wheelmap and accessibleGO make it obvious that the user is trying to answer a practical question: 'Can I actually get there and use this place?' Open Way already has robust search and filters, so the next layer is making it easier to search by specific access needs.",
    icon: Search,
  },
  {
    title: "Need-specific filters",
    description:
      "The strongest accessibility platforms are explicit about what people need to know: wheelchair access, step-free entry, restrooms, hearing support, parking, and sensory comfort. This is where Open Way can become more useful than a generic directory.",
    icon: Target,
  },
  {
    title: "Trust and confidence cues",
    description:
      "Large travel and local discovery products use clear trust signals: reviews, recency, badges, and confidence language. People want to know if the information is recent, from a real person, and whether it is verified or community-sourced.",
    icon: ShieldAlert,
  },
  {
    title: "Strong discovery loops",
    description:
      "AllTrails and major discovery sites do a great job moving users from search to exploration to saving and sharing. Open Way already has place cards, saved places, and community pages; more shareable local collections will strengthen conversion.",
    icon: Compass,
  },
];

const badPatterns = [
  {
    title: "Too much visual clutter",
    description:
      "Some larger directory sites overwhelm users with too many modules, partner promos, and marketing blocks. That weakens the clarity of the actual task: finding a place and understanding whether it works for your needs.",
    icon: Eye,
  },
  {
    title: "Generic, non-accessibility-specific UX",
    description:
      "Many local listing products focus on stars and photos but not on actual access barriers. They miss the distinction between 'popular' and 'usable for my needs'—a key problem the Open Way product can own more clearly.",
    icon: Star,
  },
  {
    title: "Poor context around uncertainty",
    description:
      "Some sites bury caveats or present confidence too confidently. The right model for Open Way is transparent provenance: community-sourced, recent review, status may vary, and clearly stated uncertainty.",
    icon: HeartHandshake,
  },
];

const additions = [
  {
    title: "Need-based chips",
    detail: "Add chips like 'Step-free entry', 'Accessible restroom', 'Quiet seating', 'Parking nearby', 'ASL support' to make searching more practical.",
  },
  {
    title: "Verified vs community-sourced badges",
    detail: "Display a clear label on every place: 'verified by venue' vs 'community-reported' vs 'needs follow-up'.",
  },
  {
    title: "City guide collections",
    detail: "Curate local destination collections such as 'Best accessible Philly coffee spots', 'Transit-friendly libraries', or 'sensory-friendly parks'.",
  },
  {
    title: "Question-and-answer layer",
    detail: "Add a practical FAQ or community Q&A section under each place with questions like 'Is the entrance wide enough?', 'How easy is parking?', 'Is it usually quiet?'.",
  },
  {
    title: "Save + share context bundles",
    detail: "Allow a user to save a route plan or a place list with notes, making the experience feel more useful than a plain directory.",
  },
  {
    title: "Accessibility confidence score",
    detail: "Present an understandable summary such as 'High confidence — recent reviews support this', without over-claiming certainty.",
  },
];

const priorities = [
  "Need-based filters and chips",
  "Verified / community attribution labels",
  "City collections and destination guides",
  "Place-level Q&A and trip planning context",
  "Save/share and personal planning tools",
];

export default function Benchmarks() {
  usePageMeta({
    title: "Open Way Benchmark Research",
    description:
      "What similar accessibility and discovery sites do well, what they do poorly, and the best additions for Open Way.",
  });

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <SectionLabel>Research & Strategy</SectionLabel>
          <h1 className="font-display font-bold text-4xl mt-2 mb-4">What the best directory products teach us</h1>
          <p className="text-muted-foreground text-lg max-w-3xl">
            We reviewed comparable discovery and accessibility products, including Wheelmap, accessibleGO, and large map-driven review platforms. The strongest patterns are clarity, need-based search, and trust, while the weakest patterns are clutter and generic search that ignores the user’s actual access needs.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPinned className="w-5 h-5 text-primary" />
                Sites reviewed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">3+</p>
              <p className="text-muted-foreground mt-2">Accessibility and discovery products benchmarked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-primary" />
                Best pattern
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">Clarity</p>
              <p className="text-muted-foreground mt-2">The best products answer a real-world need immediately</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Waypoints className="w-5 h-5 text-primary" />
                Biggest gap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">Specificity</p>
              <p className="text-muted-foreground mt-2">Most generic discovery tools miss the barrier-specific context users actually need</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <h2 className="font-display text-3xl font-bold">What similar sites do well</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {goodPatterns.map(({ title, description, icon: Icon }) => (
              <Card key={title} className="h-full border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Icon className="w-5 h-5 text-primary" />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <h2 className="font-display text-3xl font-bold">What they do badly</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {badPatterns.map(({ title, description, icon: Icon }) => (
              <Card key={title} className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Icon className="w-5 h-5 text-amber-500" />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="font-display text-3xl font-bold">What we should add to Open Way</h2>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {additions.map(({ title, detail }) => (
              <Card key={title} className="h-full border-border">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <Badge variant="secondary">Add-on</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-display text-3xl font-bold">Priority plan</h2>
          </div>
          <ol className="space-y-3 text-muted-foreground">
            {priorities.map((item, index) => (
              <li key={item} className="flex gap-3 items-start">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shrink-0">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Button asChild>
            <Link href="/places">
              Explore places <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/resources">Browse resources</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
