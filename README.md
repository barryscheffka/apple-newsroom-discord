# Apple Newsroom → Discord

Posts new [Apple Newsroom](https://www.apple.com/newsroom/) articles to a Discord channel using
[Components V2](https://discord.com/developers/docs/components/overview) – no classic embeds, no link previews.

Each message is a container with the article's `og:image`, the title, a short summary and a
"Read article" link button. Messages are sent either by a **bot** (`DISCORD_BOT_TOKEN` +
`DISCORD_CHANNEL_ID`) or through a **webhook** (`DISCORD_WEBHOOK_URL`).

> Unofficial project, not affiliated with or endorsed by Apple or Discord.

## Requirements

- Node.js >= 20.6
- A Discord bot with *View Channel* and *Send Messages* in the target channel, or a channel webhook

## Quick start

```bash
npm install
cp .env.example .env   # fill in your values
npm run once           # single run (cron / GitHub Actions)
npm run dev            # loop mode with file watching
npm run build && npm start
```

On the very first run (no state file yet), all existing articles are marked as seen and only the
newest `INITIAL_POST_COUNT` (default 1) are posted, so your channel doesn't get flooded. Seen article
IDs are kept in `STATE_FILE` (at most 500).

## Configuration

| Variable | Description |
| --- | --- |
| `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID` | Bot mode (takes precedence over the webhook) |
| `DISCORD_WEBHOOK_URL` | Webhook mode |
| `FEED_URL` | Default: English feed. German: `https://www.apple.com/de/newsroom/rss-feed.rss` |
| `STATE_FILE` | Default `data/seen.json` |
| `POLL_INTERVAL` | Seconds between checks in loop mode, default 600 |
| `INITIAL_POST_COUNT` | Articles to post on the first run, default 1 |
| `AVATAR_URL` | Optional avatar for the webhook sender (webhook mode only) |
| `BUTTON_LABEL` | Default "Read article" ("Artikel lesen" for the German feed) |

## Hosting

### GitHub Actions (free, no server)

`.github/workflows/post.yml` runs `--once` every 10 minutes. The seen-articles state is stored in
`seen.json` on a separate `state` branch, so `main` stays clean.

1. Fork or push this repository to your own GitHub account.
2. Add repository secrets `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID` (or `DISCORD_WEBHOOK_URL`).
3. Optionally add repository variables `FEED_URL` and `BUTTON_LABEL`.
4. Run the workflow once manually (*Actions → Post Apple Newsroom → Run workflow*). The first run
   only marks existing articles as seen and posts nothing.

Scheduled runs can start a few minutes late – that's normal on GitHub.

### Docker

```bash
docker build -t apple-newsroom .
docker run -d --restart unless-stopped --env-file .env -v newsroom-data:/app/data apple-newsroom
```

The container runs in loop mode and keeps its state in the `/app/data` volume.

## How it works

1. Reads the Atom feed (`rss-parser`) and normalizes entries (id, title, link, summary, date).
2. Skips articles that are already in the state file.
3. Fetches `og:image` from each new article page, since the feed has no reliable image URLs.
4. Posts the message (rate limits are handled via `retry_after`, up to 5 attempts, 1 s pause between posts).
5. Saves each article as seen only after it was posted successfully, so failures are retried on the next run.
