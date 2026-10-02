import type { DiscordTarget } from "./config.js";

// Schlanke Typen für Discord Components V2 – nur die Teile, die für Webhooks relevant sind.

export const IS_COMPONENTS_V2 = 1 << 15;

export enum ComponentType {
  ActionRow = 1,
  Button = 2,
  Section = 9,
  TextDisplay = 10,
  Thumbnail = 11,
  MediaGallery = 12,
  Separator = 14,
  Container = 17,
}

/** Link-Button (style 5) – einziger Button-Typ, den Webhooks ohne App nutzen dürfen. */
export interface LinkButton {
  type: ComponentType.Button;
  style: 5;
  label: string;
  url: string;
}

export interface ActionRow {
  type: ComponentType.ActionRow;
  components: LinkButton[];
}

export interface TextDisplay {
  type: ComponentType.TextDisplay;
  content: string;
}

export interface MediaGallery {
  type: ComponentType.MediaGallery;
  items: { media: { url: string }; description?: string }[];
}

export interface Separator {
  type: ComponentType.Separator;
  divider?: boolean;
  spacing?: 1 | 2;
}

export interface Container {
  type: ComponentType.Container;
  accent_color?: number;
  components: (ActionRow | TextDisplay | MediaGallery | Separator)[];
}

export type TopLevelComponent = Container | ActionRow | TextDisplay | MediaGallery | Separator;

/** Mit IS_COMPONENTS_V2 dürfen weder `content` noch `embeds` gesetzt sein. */
export interface WebhookPayload {
  username?: string;
  avatar_url?: string;
  flags: number;
  components: TopLevelComponent[];
  allowed_mentions?: { parse: [] };
}

const MAX_ATTEMPTS = 5;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Sendet die Nachricht per Webhook oder als Bot in einen Channel.
 * Webhook: wait + with_components nötig. Bot: username/avatar_url gibt es nicht (Bot-Identität).
 */
export async function sendMessage(target: DiscordTarget, payload: WebhookPayload): Promise<void> {
  let url: URL;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: WebhookPayload = payload;

  if (target.kind === "webhook") {
    url = new URL(target.url);
    url.searchParams.set("wait", "true");
    // Ohne with_components ignoriert Discord das components-Feld bei App-fremden Webhooks.
    url.searchParams.set("with_components", "true");
  } else {
    url = new URL(`https://discord.com/api/v10/channels/${target.channelId}/messages`);
    headers.Authorization = `Bot ${target.token}`;
    const { username: _u, avatar_url: _a, ...rest } = payload;
    body = rest;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) return;

    if (res.status === 429 && attempt < MAX_ATTEMPTS) {
      const rateLimit = (await res.json().catch(() => ({}))) as { retry_after?: number };
      const headerValue = Number(res.headers.get("retry-after"));
      const retryAfter = rateLimit.retry_after ?? (Number.isFinite(headerValue) ? headerValue : 1);
      console.warn(`Rate-Limit, warte ${retryAfter}s (Versuch ${attempt}/${MAX_ATTEMPTS})`);
      await sleep(Math.ceil(retryAfter * 1000) + 100);
      continue;
    }

    const text = await res.text().catch(() => "");
    throw new Error(`Discord antwortete ${res.status}: ${text.slice(0, 500)}`);
  }

  throw new Error(`Discord nach ${MAX_ATTEMPTS} Versuchen nicht erfolgreich`);
}
