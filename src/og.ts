const OG_IMAGE_PATTERNS = [
  /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?::secure_url)?["']/i,
];

/** Holt das og:image von der Artikelseite. Gibt bei jedem Fehler undefined zurück. */
export async function fetchOgImage(articleUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; apple-newsroom-discord/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return undefined;

    // og:image steht im <head>, der Rest der Seite wird nicht gebraucht
    const html = (await res.text()).slice(0, 200_000);
    for (const pattern of OG_IMAGE_PATTERNS) {
      const raw = pattern.exec(html)?.[1];
      if (!raw) continue;
      const url = new URL(raw.replace(/&amp;/g, "&"), articleUrl);
      if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    }
  } catch (err) {
    console.warn(`og:image für ${articleUrl} nicht ladbar: ${(err as Error).message}`);
  }
  return undefined;
}
