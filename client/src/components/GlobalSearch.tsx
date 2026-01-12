import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, MapPin, BookOpen, Calendar, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchResult {
  id: number;
  type: "place" | "resource" | "event" | "blog";
  title: string;
  description?: string;
  url: string;
}

interface SearchResponse {
  places: Array<{ id: number; name: string; description: string | null; category: string }>;
  resources: Array<{ id: number; title: string; description: string | null; category: string }>;
  events: Array<{ id: number; title: string; description: string | null; date: string }>;
  blogPosts: Array<{ id: number; title: string; excerpt: string | null; slug: string }>;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const searchContent = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Search failed");
      
      const data: SearchResponse = await response.json();
      
      const formattedResults: SearchResult[] = [
        ...data.places.map((p) => ({
          id: p.id,
          type: "place" as const,
          title: p.name,
          description: p.category,
          url: `/places/${p.id}`,
        })),
        ...data.resources.map((r) => ({
          id: r.id,
          type: "resource" as const,
          title: r.title,
          description: r.category,
          url: "/resources",
        })),
        ...data.events.map((e) => ({
          id: e.id,
          type: "event" as const,
          title: e.title,
          description: new Date(e.date).toLocaleDateString(),
          url: "/events",
        })),
        ...data.blogPosts.map((b) => ({
          id: b.id,
          type: "blog" as const,
          title: b.title,
          description: b.excerpt?.slice(0, 60) || undefined,
          url: `/blog`,
        })),
      ];
      
      setResults(formattedResults);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    searchContent(debouncedQuery);
  }, [debouncedQuery, searchContent]);

  const handleSelect = (url: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setLocation(url);
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "place":
        return <MapPin className="w-4 h-4" />;
      case "resource":
        return <BookOpen className="w-4 h-4" />;
      case "event":
        return <Calendar className="w-4 h-4" />;
      case "blog":
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "place":
        return "Places";
      case "resource":
        return "Resources";
      case "event":
        return "Events";
      case "blog":
        return "Blog Posts";
    }
  };

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <>
      <Button
        variant="outline"
        className="relative w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-full"
        onClick={() => setOpen(true)}
        data-testid="button-global-search"
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search places, events, resources...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search places, events, resources, blog posts..."
          value={query}
          onValueChange={setQuery}
          data-testid="input-global-search"
        />
        <CommandList data-testid="search-results-list">
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {!isLoading && query.trim() && results.length === 0 && (
            <CommandEmpty data-testid="search-empty">
              No results found for "{query}"
            </CommandEmpty>
          )}
          
          {!isLoading && !query.trim() && (
            <div className="py-6 text-center text-sm text-muted-foreground" data-testid="search-placeholder">
              Start typing to search...
            </div>
          )}
          
          {!isLoading && Object.entries(groupedResults).map(([type, items]) => (
            <CommandGroup 
              key={type} 
              heading={getTypeLabel(type as SearchResult["type"])}
              data-testid={`search-group-${type}`}
            >
              {items.map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  value={`${result.title}-${result.id}`}
                  onSelect={() => handleSelect(result.url)}
                  className="cursor-pointer"
                  data-testid={`search-result-${result.type}-${result.id}`}
                >
                  {getIcon(result.type)}
                  <div className="ml-2 flex flex-col">
                    <span className="font-medium">{result.title}</span>
                    {result.description && (
                      <span className="text-xs text-muted-foreground">{result.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
