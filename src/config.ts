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
  buttonLabel: string;
}

function intEnv(name: string, fallback: number, min: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min} (got: "${raw}")`);
  }
  return value;
}

function loadTarget(): DiscordTarget {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const channelId = process.env.DISCORD_CHANNEL_ID?.trim();

  if (token || channelId) {
    if (!token || !channelId) {
      throw new Error("Bot mode requires both DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID");
    }
    if (!/^\d{15,25}$/.test(channelId)) throw new Error("DISCORD_CHANNEL_ID must be a numeric ID");
    return { kind: "bot", token, channelId };
  }

  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) {
    throw new Error("Set either DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID or DISCORD_WEBHOOK_URL");
  }
  try {
    if (new URL(url).protocol !== "https:") throw new Error("not https");
  } catch {
    throw new Error("DISCORD_WEBHOOK_URL is not a valid https URL");
  }
  return { kind: "webhook", url };
}

export function loadConfig(): Config {
  const feedUrl = process.env.FEED_URL?.trim() || "https://www.apple.com/newsroom/rss-feed.rss";
  const isGerman = /\/de\//.test(feedUrl);
  return {
    target: loadTarget(),
    feedUrl,
    buttonLabel: process.env.BUTTON_LABEL?.trim() || (isGerman ? "Artikel lesen" : "Read article"),
    stateFile: process.env.STATE_FILE?.trim() || "data/seen.json",
    pollIntervalMs: intEnv("POLL_INTERVAL", 600, 10) * 1000,
    initialPostCount: intEnv("INITIAL_POST_COUNT", 1, 0),
    avatarUrl: process.env.AVATAR_URL?.trim() || undefined,
  };
}
