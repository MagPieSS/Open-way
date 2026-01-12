import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionLabel } from "@/components/SectionLabel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Phone,
  Mail,
  Globe,
  MapPin,
  Star,
  Users,
  Car,
  Scale,
  Heart,
  Building2,
  GraduationCap,
  Accessibility,
  FileText,
} from "lucide-react";
import type { Resource } from "@shared/schema";

const CATEGORY_ICONS: Record<string, typeof Users> = {
  "ADA Services": Accessibility,
  "Transportation": Car,
  "Legal": Scale,
  "Healthcare": Heart,
  "Government": Building2,
  "Education": GraduationCap,
  "Community": Users,
  "Documentation": FileText,
};

const CATEGORIES = [
  "All",
  "ADA Services",
  "Transportation",
  "Legal",
  "Healthcare",
  "Government",
  "Education",
  "Community",
];

export default function Resources() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const { data: resources, isLoading, error } = useQuery<Resource[]>({
    queryKey: ["/api/resources"],
  });

  const featuredResources = useMemo(() => {
    if (!resources) return [];
    return resources.filter((r) => r.isFeatured);
  }, [resources]);

  const groupedResources = useMemo(() => {
    if (!resources) return {};

    let filtered = resources.filter((r) => !r.isFeatured);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term) ||
          r.category.toLowerCase().includes(term)
      );
    }

    if (categoryFilter !== "All") {
      filtered = filtered.filter((r) => r.category === categoryFilter);
    }

    const grouped: Record<string, Resource[]> = {};
    filtered.forEach((resource) => {
      const cat = resource.category;
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(resource);
    });

    Object.keys(grouped).forEach((cat) => {
      grouped[cat].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    });

    return grouped;
  }, [resources, searchTerm, categoryFilter]);

  const getCategoryIcon = (category: string) => {
    const Icon = CATEGORY_ICONS[category] || Users;
    return <Icon className="w-5 h-5" />;
  };

  const renderResourceCard = (resource: Resource, featured = false) => (
    <Card
      key={resource.id}
      className={`hover:border-primary hover:shadow-lg transition-all ${
        featured ? "bg-gradient-to-br from-primary/5 to-accent/5 border-primary/30" : ""
      }`}
      data-testid={`card-resource-${resource.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${featured ? "bg-primary/20" : "bg-secondary"} flex items-center justify-center shrink-0`}>
              {getCategoryIcon(resource.category)}
            </div>
            <div>
              <CardTitle className="text-lg" data-testid={`text-resource-title-${resource.id}`}>
                {resource.title}
              </CardTitle>
              <Badge variant="secondary" className="mt-1" data-testid={`badge-resource-category-${resource.id}`}>
                {resource.category}
              </Badge>
            </div>
          </div>
          {featured && (
            <Badge className="bg-primary text-primary-foreground shrink-0">
              <Star className="w-3 h-3 mr-1 fill-current" />
              Featured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground" data-testid={`text-resource-description-${resource.id}`}>
          {resource.description}
        </p>

        <div className="space-y-2">
          {resource.phone && (
            <a
              href={`tel:${resource.phone}`}
              className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
              data-testid={`link-resource-phone-${resource.id}`}
            >
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{resource.phone}</span>
            </a>
          )}
          {resource.email && (
            <a
              href={`mailto:${resource.email}`}
              className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
              data-testid={`link-resource-email-${resource.id}`}
            >
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{resource.email}</span>
            </a>
          )}
          {resource.url && (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
              data-testid={`link-resource-website-${resource.id}`}
            >
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate">Visit Website</span>
            </a>
          )}
          {resource.address && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
              <span data-testid={`text-resource-address-${resource.id}`}>{resource.address}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <SectionLabel>Resources</SectionLabel>
              <h1 className="font-display font-bold text-4xl mt-2 mb-2">Resource Directory</h1>
              <p className="text-muted-foreground text-lg">
                Find accessibility services, organizations, and support in Philadelphia
              </p>
            </div>

            <div className="relative w-full md:w-96">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Search resources..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-resources"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-4 px-4 bg-secondary/50 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">Filter by category:</span>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} data-testid={`option-category-${cat.toLowerCase().replace(/\s+/g, '-')}`}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary" />
                      <div className="space-y-2">
                        <div className="h-5 w-32 bg-secondary rounded" />
                        <div className="h-4 w-20 bg-secondary rounded" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-secondary rounded" />
                      <div className="h-4 w-3/4 bg-secondary rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-20 bg-destructive/10 rounded-2xl border border-destructive/20">
              <p className="text-destructive font-bold text-xl">Failed to load resources</p>
              <p className="text-destructive/80">Please try again later.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {featuredResources.length > 0 && categoryFilter === "All" && !searchTerm && (
                <div data-testid="section-featured-resources">
                  <h2 className="font-display font-bold text-2xl mb-6 flex items-center gap-2">
                    <Star className="w-6 h-6 text-primary fill-primary/20" />
                    Featured Resources
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {featuredResources.map((resource) => renderResourceCard(resource, true))}
                  </div>
                </div>
              )}

              {Object.keys(groupedResources).length === 0 ? (
                <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
                  <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-muted-foreground mb-2">No resources found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or filter</p>
                </div>
              ) : (
                Object.entries(groupedResources).map(([category, categoryResources]) => (
                  <div key={category} data-testid={`section-category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                    <h2 className="font-display font-bold text-2xl mb-6 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {getCategoryIcon(category)}
                      </div>
                      {category}
                      <Badge variant="outline" className="ml-2">
                        {categoryResources.length}
                      </Badge>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categoryResources.map((resource) => renderResourceCard(resource))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-4 bg-secondary/50 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl mb-4">Know a Resource?</h2>
          <p className="text-muted-foreground mb-6">
            Help others by suggesting accessibility resources in your community.
          </p>
          <Button size="lg" data-testid="button-suggest-resource">
            Suggest a Resource
          </Button>
        </div>
      </section>
    </div>
  );
}
