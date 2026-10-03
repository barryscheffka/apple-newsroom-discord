import type { DiscordTarget } from "./config.js";

// Lean types for Discord Components V2 – only the parts relevant for webhooks and bot messages.

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

/** Link button (style 5) – the only button type allowed for webhooks not owned by an app. */
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

/** With IS_COMPONENTS_V2 set, neither `content` nor `embeds` may be present. */
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
 * Sends the message via webhook or as a bot into a channel.
 * Webhook: needs wait + with_components. Bot: no username/avatar_url (uses the bot identity).
 */
export async function sendMessage(target: DiscordTarget, payload: WebhookPayload): Promise<void> {
  let url: URL;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: WebhookPayload = payload;

  if (target.kind === "webhook") {
    url = new URL(target.url);
    url.searchParams.set("wait", "true");
    // Without with_components, Discord ignores the components field for webhooks not owned by an app.
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
      console.warn(`Rate limited, waiting ${retryAfter}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
      await sleep(Math.ceil(retryAfter * 1000) + 100);
      continue;
    }

    const text = await res.text().catch(() => "");
    throw new Error(`Discord responded with ${res.status}: ${text.slice(0, 500)}`);
  }

  throw new Error(`Discord request failed after ${MAX_ATTEMPTS} attempts`);
}
