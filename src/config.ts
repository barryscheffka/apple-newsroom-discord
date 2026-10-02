export type DiscordTarget =
  | { kind: "webhook"; url: string }
  | { kind: "bot"; token: string; channelId: string };

export interface Config {
  target: DiscordTarget;
  feedUrl: string;
  stateFile: string;
  pollIntervalMs: number;
  initialPostCount: number;
  avatarUrl?: string;
}

function intEnv(name: string, fallback: number, min: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} muss eine ganze Zahl >= ${min} sein (erhalten: "${raw}")`);
  }
  return value;
}

function loadTarget(): DiscordTarget {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const channelId = process.env.DISCORD_CHANNEL_ID?.trim();

  if (token || channelId) {
    if (!token || !channelId) {
      throw new Error("Für den Bot-Modus müssen DISCORD_BOT_TOKEN und DISCORD_CHANNEL_ID gesetzt sein");
    }
    if (!/^\d{15,25}$/.test(channelId)) throw new Error("DISCORD_CHANNEL_ID muss eine numerische ID sein");
    return { kind: "bot", token, channelId };
  }

  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) {
    throw new Error("Weder DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID noch DISCORD_WEBHOOK_URL gesetzt");
  }
  try {
    if (new URL(url).protocol !== "https:") throw new Error("kein https");
  } catch {
    throw new Error("DISCORD_WEBHOOK_URL ist keine gültige https-URL");
  }
  return { kind: "webhook", url };
}

export function loadConfig(): Config {
  return {
    target: loadTarget(),
    feedUrl: process.env.FEED_URL?.trim() || "https://www.apple.com/newsroom/rss-feed.rss",
    stateFile: process.env.STATE_FILE?.trim() || "data/seen.json",
    pollIntervalMs: intEnv("POLL_INTERVAL", 600, 10) * 1000,
    initialPostCount: intEnv("INITIAL_POST_COUNT", 1, 0),
    avatarUrl: process.env.AVATAR_URL?.trim() || undefined,
  };
}
