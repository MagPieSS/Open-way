import { useSettings } from "@/hooks/use-settings";

interface AccessibilityLegendProps {
  className?: string;
}

export function AccessibilityLegend({ className = "" }: AccessibilityLegendProps) {
  const { textSize } = useSettings();

  const legendItems = [
    { status: "Accessible", bgClass: "bg-accessible", description: "Fully accessible" },
    { status: "Partially Accessible", bgClass: "bg-partial", description: "Some accessibility features" },
    { status: "Not Accessible", bgClass: "bg-not-accessible", description: "Limited or no accessibility" },
  ];

  return (
    <div 
      className={`flex flex-wrap items-center gap-4 ${className}`}
      data-testid="accessibility-legend"
    >
      {legendItems.map((item) => (
        <div 
          key={item.status} 
          className="flex items-center gap-2"
          data-testid={`legend-item-${item.status.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <span className={`w-4 h-4 rounded-full ${item.bgClass} flex-shrink-0`} />
          <span className={`text-${textSize} text-muted-foreground`}>
            {item.status}
          </span>
        </div>
      ))}
    </div>
  );
}
