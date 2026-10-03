import Parser from "rss-parser";

export interface Article {
  id: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: Date;
}

const parser = new Parser({
  timeout: 15_000,
  headers: { "User-Agent": "apple-newsroom-discord/1.0 (+https://www.apple.com/newsroom/)" },
});

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function stripHtml(input: string): string {
  return input
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        return String.fromCodePoint(parseInt(entity.slice(2), 16));
      }
      if (entity.startsWith("#")) return String.fromCodePoint(parseInt(entity.slice(1), 10));
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** Reads the feed and returns articles sorted oldest to newest. */
export async function fetchArticles(feedUrl: string): Promise<Article[]> {
  const feed = await parser.parseURL(feedUrl);
  const articles: Article[] = [];

  for (const item of feed.items) {
    const link = item.link?.trim();
    const title = stripHtml(item.title ?? "");
    if (!link || !title) continue;

    const date = new Date(item.isoDate ?? item.pubDate ?? Date.now());
    articles.push({
      id: item.id ?? item.guid ?? link,
      title,
      link,
      // Apple's Atom feed provides <content>, not <summary>
      summary: stripHtml(item.summary ?? item.contentSnippet ?? item.content ?? ""),
      publishedAt: Number.isNaN(date.getTime()) ? new Date() : date,
    });
  }

  return articles.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
}
