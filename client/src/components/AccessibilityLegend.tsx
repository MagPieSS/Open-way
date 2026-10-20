import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";

interface AccessibilityLegendProps {
  className?: string;
}

// Same icons as the place cards and map, so the label never depends on colour alone.
const LEGEND_ITEMS = [
  { label: "Accessible", icon: CheckCircle, className: "text-fact-yes" },
  { label: "Partially accessible", icon: AlertTriangle, className: "text-fact-limited" },
  { label: "Not accessible", icon: XCircle, className: "text-fact-no" },
];

export function AccessibilityLegend({ className = "" }: AccessibilityLegendProps) {
  const { textSize } = useSettings();

  return (
    <div className={`flex flex-wrap items-center gap-4 ${className}`} data-testid="accessibility-legend">
      <span className={`text-${textSize} font-medium`}>Overall labels, as reported:</span>
      <ul className="flex flex-wrap items-center gap-4">
        {LEGEND_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.label}
              className="flex items-center gap-2"
              data-testid={`legend-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${item.className}`} aria-hidden="true" />
              <span className={`text-${textSize} text-muted-foreground`}>{item.label}</span>
            </li>
          );
        })}
      </ul>
      <span className={`text-${textSize} text-muted-foreground`}>
        Each place's page lists features one by one.
      </span>
    </div>
  );
}
