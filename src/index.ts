import { loadConfig, type Config } from "./config.js";
import { sendMessage } from "./discord.js";
import { fetchArticles } from "./feed.js";
import { buildMessage } from "./message.js";
import { fetchOgImage } from "./og.js";
import { SeenStore } from "./state.js";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Ein Durchlauf: Feed holen, neue Artikel posten, State speichern. */
async function runOnce(config: Config): Promise<void> {
  const store = await SeenStore.load(config.stateFile);
  const articles = await fetchArticles(config.feedUrl);

  let fresh = articles.filter((a) => !store.has(a.id));

  if (store.isFirstRun) {
    // Erster Start: alles außer den neuesten N als gesehen markieren. Die N Artikel werden
    // erst nach erfolgreichem Post gespeichert, ein Fehlschlag wird beim nächsten Lauf wiederholt.
    const toPost = config.initialPostCount > 0 ? fresh.slice(-config.initialPostCount) : [];
    const postIds = new Set(toPost.map((a) => a.id));
    for (const article of fresh) if (!postIds.has(article.id)) store.add(article.id);
    await store.save();
    console.log(
      `Erster Start: ${fresh.length - toPost.length} Artikel als gesehen markiert, ${toPost.length} werden gepostet`,
    );
    await post(config, toPost, store);
    return;
  }

  if (fresh.length === 0) {
    console.log(`Keine neuen Artikel (${articles.length} im Feed)`);
    return;
  }

  console.log(`${fresh.length} neue(r) Artikel`);
  await post(config, fresh, store);
}

/**
 * Postet Artikel nacheinander. Mit `store` wird jeder Artikel erst nach erfolgreichem Post
 * als gesehen gespeichert; ein Fehler bei einem Artikel bricht die anderen nicht ab.
 */
async function post(
  config: Config,
  articles: Awaited<ReturnType<typeof fetchArticles>>,
  store: SeenStore | undefined,
): Promise<void> {
  for (const [i, article] of articles.entries()) {
    try {
      const imageUrl = await fetchOgImage(article.link);
      await sendMessage(config.target, buildMessage(article, imageUrl, config.avatarUrl));
      console.log(`Gepostet: ${article.title}`);
      if (store) {
        store.add(article.id);
        await store.save();
      }
    } catch (err) {
      console.error(`Fehler bei "${article.title}": ${(err as Error).message}`);
    }
    if (i < articles.length - 1) await sleep(1000);
  }
}

async function main(): Promise<void> {
  const config = loadConfig();

  if (process.argv.includes("--once")) {
    await runOnce(config);
    return;
  }

  const controller = new AbortController();
  const stop = (signal: string) => {
    console.log(`${signal} empfangen, beende nach aktuellem Durchlauf …`);
    controller.abort();
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  console.log(`Starte Loop: ${config.feedUrl}, alle ${config.pollIntervalMs / 1000}s`);
  while (!controller.signal.aborted) {
    try {
      await runOnce(config);
    } catch (err) {
      console.error(`Durchlauf fehlgeschlagen: ${(err as Error).message}`);
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, config.pollIntervalMs);
      controller.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
  console.log("Beendet.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
