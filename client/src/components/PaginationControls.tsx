import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  page: number;
  pageCount: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  testIdPrefix?: string;
}

export function PaginationControls({ page, pageCount, totalCount, onPageChange, testIdPrefix = "pagination" }: PaginationControlsProps) {
  if (pageCount <= 1) return null;

  return (
    <nav
      className="flex items-center justify-between gap-4 pt-4 mt-2 border-t border-border flex-wrap"
      aria-label="Pagination"
      data-testid={`${testIdPrefix}-controls`}
    >
      <p className="text-sm text-muted-foreground">
        Page {page} of {pageCount} ({totalCount} total)
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          data-testid={`${testIdPrefix}-prev`}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          data-testid={`${testIdPrefix}-next`}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </nav>
  );
}
