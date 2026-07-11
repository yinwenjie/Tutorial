"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
interface SiteIconProps {
  site: {
    mark: string;
    url: string;
  };
}

export function SiteIcon({ site }: SiteIconProps) {
  const [fallbackState, setFallbackState] = useState({ url: site.url, step: 0 });
  const urls = useMemo(() => getIconUrls(site.url), [site.url]);
  const fallbackStep = fallbackState.url === site.url ? fallbackState.step : 0;

  if (fallbackStep >= urls.length) {
    return (
      <span className="site-icon" aria-hidden="true">
        <span className="mark">{site.mark}</span>
      </span>
    );
  }

  return (
    <span className="site-icon" aria-hidden="true">
      <img
        className="favicon"
        src={urls[fallbackStep]}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFallbackState({ url: site.url, step: fallbackStep + 1 })}
      />
    </span>
  );
}

function getIconUrls(siteUrl: string): string[] {
  try {
    const url = new URL(siteUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return [];
    }

    return [
      `https://icons.duckduckgo.com/ip3/${url.hostname}.ico`,
      `${url.origin}/favicon.ico`
    ];
  } catch {
    return [];
  }
}
