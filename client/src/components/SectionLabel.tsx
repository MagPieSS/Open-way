interface SectionLabelProps {
  children: string;
  className?: string;
}

export function SectionLabel({ children, className = "" }: SectionLabelProps) {
  return (
    <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider bg-primary/10 text-primary ${className}`}>
      {children}
    </span>
  );
}
