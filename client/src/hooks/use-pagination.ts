import { useMemo, useState, useEffect } from "react";

export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  // Reset to the first page whenever the underlying list changes size (e.g. a filter changed)
  // so you don't land on a now-empty page.
  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const currentPage = Math.min(page, pageCount);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  return {
    page: currentPage,
    pageCount,
    pageItems,
    setPage,
    totalCount: items.length,
  };
}
