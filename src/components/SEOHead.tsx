import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  keywords?: string;
  structuredData?: Record<string, unknown>;
}

const SITE_URL = "https://artswarit.com";
const DEFAULT_OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/aU0tk73fGVN5bEhpY8O7NX51Qoe2/social-images/social-1767002779695-WhatsApp Image 2025-05-01 at 12.09.23 AM.jpeg";

/**
 * Sets document head metadata for SEO.
 * Since this is a Vite SPA (not SSR), we update the DOM imperatively.
 * For SSR/pre-rendering, this will work as a compatible fallback.
 */
export default function SEOHead({
  title,
  description,
  canonicalPath,
  ogImage,
  ogType = "website",
  noindex = false,
  keywords,
  structuredData,
}: SEOHeadProps) {
  useEffect(() => {
    // Title
    const fullTitle = title.includes("Artswarit") ? title : `${title} | Artswarit`;
    document.title = fullTitle;

    // Helper to set or create a meta tag
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    // Standard meta
    setMeta("name", "description", description);
    if (keywords) setMeta("name", "keywords", keywords);

    // Robots
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    // Open Graph
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", ogType);
    setMeta("property", "og:image", ogImage || DEFAULT_OG_IMAGE);
    if (canonicalPath) {
      setMeta("property", "og:url", `${SITE_URL}${canonicalPath}`);
    }

    // Twitter Card
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", ogImage || DEFAULT_OG_IMAGE);

    // Canonical link
    if (canonicalPath) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", `${SITE_URL}${canonicalPath}`);
    }

    // Structured Data (JSON-LD)
    if (structuredData) {
      // Remove previous dynamic structured data
      const existing = document.getElementById("seo-structured-data");
      if (existing) existing.remove();

      const script = document.createElement("script");
      script.id = "seo-structured-data";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    // Cleanup on unmount
    return () => {
      const sd = document.getElementById("seo-structured-data");
      if (sd) sd.remove();
    };
  }, [title, description, canonicalPath, ogImage, ogType, noindex, keywords, structuredData]);

  return null; // This component renders nothing — it only manipulates <head>
}
