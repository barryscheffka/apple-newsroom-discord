import { type Article } from "./feed.js";
import {
  ComponentType,
  IS_COMPONENTS_V2,
  type Container,
  type WebhookPayload,
} from "./discord.js";

const ACCENT_COLOR = 0x0071e3;
const MAX_SUMMARY = 300;

/** Kürzt an einer Wortgrenze und hängt "…" an. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s.,;:!?–—-]+$/, "") + "…";
}

export function buildMessage(
  article: Article,
  imageUrl: string | undefined,
  avatarUrl: string | undefined,
): WebhookPayload {
  const components: Container["components"] = [];

  if (imageUrl) {
    components.push({
      type: ComponentType.MediaGallery,
      items: [{ media: { url: imageUrl }, description: article.title }],
    });
  }

  const summary = truncate(article.summary, MAX_SUMMARY);
  components.push(
    {
      type: ComponentType.TextDisplay,
      content: summary ? `## ${article.title}\n${summary}` : `## ${article.title}`,
    },
    { type: ComponentType.Separator, divider: true, spacing: 1 },
    {
      type: ComponentType.TextDisplay,
      content: `-# Apple Newsroom · <t:${Math.floor(article.publishedAt.getTime() / 1000)}:D>`,
    },
    {
      type: ComponentType.ActionRow,
      components: [
        { type: ComponentType.Button, style: 5, label: "Artikel lesen", url: article.link },
      ],
    },
  );

  return {
    username: "Apple Newsroom",
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    flags: IS_COMPONENTS_V2,
    components: [{ type: ComponentType.Container, accent_color: ACCENT_COLOR, components }],
    allowed_mentions: { parse: [] },
  };
}
