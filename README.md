# Apple Newsroom → Discord

Postet neue Artikel aus dem Apple Newsroom per Discord Components V2 (ohne Embeds/Link-Previews) in einen Channel.
Senden per Bot (`DISCORD_BOT_TOKEN` + `DISCORD_CHANNEL_ID`) oder Webhook (`DISCORD_WEBHOOK_URL`).

## Setup

```bash
npm install
cp .env.example .env   # Werte eintragen
npm run once           # ein Durchlauf (Cron / GitHub Actions)
npm run dev            # Loop mit Watch
npm run build && npm start
```

Beim ersten Start werden alle vorhandenen Artikel als gesehen markiert und nur die neuesten `INITIAL_POST_COUNT` (Standard 1) gepostet. Gesehene IDs stehen in `STATE_FILE` (max. 500).

## Konfiguration

| Variable | Beschreibung |
| --- | --- |
| `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID` | Bot-Modus (hat Vorrang). Bot braucht „Kanal ansehen“ + „Nachrichten senden“ |
| `DISCORD_WEBHOOK_URL` | Webhook-Modus |
| `FEED_URL` | Standard: englischer Feed, deutsch: `https://www.apple.com/de/newsroom/rss-feed.rss` |
| `STATE_FILE` | Standard `data/seen.json` |
| `POLL_INTERVAL` | Sekunden, Standard 600 |
| `INITIAL_POST_COUNT` | Standard 1 |
| `AVATAR_URL` | Optional, nur Webhook-Modus |
| `BUTTON_LABEL` | Standard: „Read article“, beim deutschen Feed „Artikel lesen“ |

## Docker

```bash
docker build -t apple-newsroom .
docker run -d --env-file .env -v newsroom-data:/app/data apple-newsroom
```
