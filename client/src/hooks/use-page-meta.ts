import { useEffect } from "react";

interface PageMetaOptions {
  title: string;
  description?: string;
}

const DEFAULT_TITLE = "Open Way — Find Accessible Places";
const SITE_SUFFIX = " | Open Way";

function setMetaTag(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Sets document.title and meta description/OG tags for the current page, restoring the
// site defaults on unmount so navigating away doesn't leave a stale title/description behind.
export function usePageMeta({ title, description }: PageMetaOptions) {
  useEffect(() => {
    const fullTitle = title === DEFAULT_TITLE ? title : `${title}${SITE_SUFFIX}`;
    document.title = fullTitle;
    setMetaTag("property", "og:title", fullTitle);

    if (description) {
      setMetaTag("name", "description", description);
      setMetaTag("property", "og:description", description);
    }

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description]);
}
