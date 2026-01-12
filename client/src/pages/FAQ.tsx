import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionLabel } from "@/components/SectionLabel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  HelpCircle,
  Info,
  Scale,
  Compass,
  Users,
  Shield,
  Settings,
} from "lucide-react";
import type { FaqEntry } from "@shared/schema";

const CATEGORY_ICONS: Record<string, typeof HelpCircle> = {
  "About Open Way": Info,
  "Accessibility Rights": Scale,
  "Using the Platform": Compass,
  "Community": Users,
  "Privacy & Security": Shield,
  "Technical Support": Settings,
};

const CATEGORIES = [
  "All",
  "About Open Way",
  "Accessibility Rights",
  "Using the Platform",
  "Community",
  "Privacy & Security",
  "Technical Support",
];

export default function FAQ() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const { data: faqEntries, isLoading, error } = useQuery<FaqEntry[]>({
    queryKey: ["/api/faq"],
  });

  const filteredAndGroupedFaqs = useMemo(() => {
    if (!faqEntries) return {};

    let filtered = faqEntries;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (faq) =>
          faq.question.toLowerCase().includes(term) ||
          faq.answer.toLowerCase().includes(term) ||
          (faq.category && faq.category.toLowerCase().includes(term))
      );
    }

    if (selectedCategory !== "All") {
      filtered = filtered.filter((faq) => faq.category === selectedCategory);
    }

    const grouped: Record<string, FaqEntry[]> = {};
    filtered.forEach((faq) => {
      const cat = faq.category || "General";
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(faq);
    });

    Object.keys(grouped).forEach((cat) => {
      grouped[cat].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    });

    return grouped;
  }, [faqEntries, searchTerm, selectedCategory]);

  const getCategoryIcon = (category: string) => {
    const Icon = CATEGORY_ICONS[category] || HelpCircle;
    return <Icon className="w-5 h-5" />;
  };

  const totalQuestions = useMemo(() => {
    return Object.values(filteredAndGroupedFaqs).reduce(
      (acc, faqs) => acc + faqs.length,
      0
    );
  }, [filteredAndGroupedFaqs]);

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <SectionLabel>Support</SectionLabel>
              <h1 className="font-display font-bold text-4xl mt-2 mb-2" data-testid="heading-faq">
                Frequently Asked Questions
              </h1>
              <p className="text-muted-foreground text-lg">
                Find answers to common questions about Open Way
              </p>
            </div>

            <div className="relative w-full md:w-96">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Search questions..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-faq"
                aria-label="Search frequently asked questions"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-4 px-4 bg-secondary/50 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-2">
              Filter by topic:
            </span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-card hover:bg-accent text-foreground"
                }`}
                data-testid={`button-filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                aria-pressed={selectedCategory === cat}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="animate-pulse p-6">
                  <div className="h-5 w-3/4 bg-secondary rounded mb-2" />
                  <div className="h-4 w-1/2 bg-secondary rounded" />
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-20 bg-destructive/10 rounded-2xl border border-destructive/20">
              <p className="text-destructive font-bold text-xl" data-testid="text-error">
                Failed to load FAQ
              </p>
              <p className="text-destructive/80">Please try again later.</p>
            </div>
          ) : totalQuestions === 0 ? (
            <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-muted-foreground mb-2" data-testid="text-no-results">
                No questions found
              </h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter
              </p>
            </div>
          ) : (
            <div className="space-y-8" data-testid="faq-list">
              {Object.entries(filteredAndGroupedFaqs).map(([category, faqs]) => (
                <div key={category} data-testid={`section-category-${category.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {getCategoryIcon(category)}
                    </div>
                    <h2 className="font-display font-bold text-xl">
                      {category}
                    </h2>
                    <Badge variant="outline">{faqs.length}</Badge>
                  </div>

                  <Card className="overflow-hidden">
                    <Accordion type="multiple" className="w-full">
                      {faqs.map((faq) => (
                        <AccordionItem
                          key={faq.id}
                          value={`faq-${faq.id}`}
                          data-testid={`accordion-item-${faq.id}`}
                        >
                          <AccordionTrigger
                            className="px-6 text-left hover:no-underline hover:bg-accent/50"
                            data-testid={`accordion-trigger-${faq.id}`}
                          >
                            <span className="pr-4" data-testid={`text-question-${faq.id}`}>
                              {faq.question}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="px-6">
                            <div
                              className="text-muted-foreground prose prose-sm max-w-none"
                              data-testid={`text-answer-${faq.id}`}
                            >
                              {faq.answer}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-4 bg-secondary/50 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <HelpCircle className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="font-display font-bold text-2xl mb-4">
            Still Have Questions?
          </h2>
          <p className="text-muted-foreground mb-6">
            Can't find what you're looking for? Our team is here to help.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-3 font-medium hover-elevate transition-colors"
            data-testid="link-contact-us"
          >
            Contact Us
          </a>
        </div>
      </section>
    </div>
  );
}
