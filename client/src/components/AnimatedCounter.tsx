import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/use-settings";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
}

export function AnimatedCounter({ value, duration = 1500 }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const { reducedMotion } = useSettings();

  useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value);
      return;
    }

    let rafId: number;
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(Math.round(startValue + diff * easeOut));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reducedMotion]);

  return (
    <span className="tabular-nums">
      {/* Visible counter animates every frame; a screen reader shouldn't hear every tick, so
          it only gets the final settled value via this visually-hidden live region. */}
      <span aria-hidden="true">{displayValue.toLocaleString()}</span>
      <span className="sr-only" aria-live="polite">
        {displayValue === value ? value.toLocaleString() : ""}
      </span>
    </span>
  );
}

interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
}

export function ProgressRing({ progress, size = 120, strokeWidth = 8 }: ProgressRingProps) {
  const { reducedMotion } = useSettings();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-secondary"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={`text-primary ${reducedMotion ? '' : 'transition-all duration-1000 ease-out'}`}
      />
    </svg>
  );
}
