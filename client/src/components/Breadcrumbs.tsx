import { Link, useLocation, useRoute } from "wouter";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useQuery } from "@tanstack/react-query";

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

const routeLabels: Record<string, string> = {
  "/": "Home",
  "/places": "Places",
  "/reviews": "Community",
  "/submit": "Submit",
  "/petition": "Petition",
  "/about": "About",
  "/settings": "Settings",
  "/resources": "Resources",
  "/events": "Events",
  "/blog": "Blog",
  "/faq": "FAQ",
  "/contact": "Contact",
};

export function Breadcrumbs() {
  const [location] = useLocation();
  const [matchPlaceDetail, paramsPlace] = useRoute("/places/:id");
  
  const placeId = matchPlaceDetail ? Number(paramsPlace?.id) : undefined;
  
  const { data: place } = useQuery<{ id: number; name: string }>({
    queryKey: ['/api/places', placeId],
    enabled: !!placeId,
  });

  const getBreadcrumbs = (): BreadcrumbSegment[] => {
    if (location === "/") {
      return [];
    }

    const segments: BreadcrumbSegment[] = [{ label: "Home", href: "/" }];
    const pathParts = location.split("/").filter(Boolean);

    if (pathParts.length === 0) return [];

    if (pathParts[0] === "places") {
      segments.push({ label: "Places", href: "/places" });
      
      if (pathParts[1] && place) {
        segments.push({ label: place.name });
      } else if (pathParts[1]) {
        segments.push({ label: "Loading..." });
      }
    } else {
      const label = routeLabels[`/${pathParts[0]}`] || pathParts[0];
      segments.push({ label });
    }

    return segments;
  };

  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div className="bg-secondary/30 border-b border-border" data-testid="breadcrumbs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((segment, index) => {
              const isLast = index === breadcrumbs.length - 1;
              
              return (
                <BreadcrumbItem key={`${segment.label}-${index}`}>
                  {index > 0 && <BreadcrumbSeparator />}
                  {isLast ? (
                    <BreadcrumbPage data-testid={`breadcrumb-current-${segment.label.toLowerCase().replace(/\s+/g, '-')}`}>
                      {index === 0 && <Home className="w-4 h-4 mr-1 inline" />}
                      {segment.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link 
                        href={segment.href || "#"} 
                        data-testid={`breadcrumb-link-${segment.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {index === 0 && <Home className="w-4 h-4 mr-1 inline" />}
                        {segment.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}
