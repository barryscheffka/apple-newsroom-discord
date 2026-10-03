import { loadConfig, type Config } from "./config.js";
import { sendMessage } from "./discord.js";
import { fetchArticles } from "./feed.js";
import { buildMessage } from "./message.js";
import { fetchOgImage } from "./og.js";
import { SeenStore } from "./state.js";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One run: fetch the feed, post new articles, save state. */
async function runOnce(config: Config): Promise<void> {
  const store = await SeenStore.load(config.stateFile);
  const articles = await fetchArticles(config.feedUrl);

  let fresh = articles.filter((a) => !store.has(a.id));

  if (store.isFirstRun) {
    // First run: mark everything except the newest N as seen. Those N articles are only
    // saved after a successful post, so a failure is retried on the next run.
    const toPost = config.initialPostCount > 0 ? fresh.slice(-config.initialPostCount) : [];
    const postIds = new Set(toPost.map((a) => a.id));
    for (const article of fresh) if (!postIds.has(article.id)) store.add(article.id);
    await store.save();
    console.log(
      `First run: marked ${fresh.length - toPost.length} articles as seen, posting ${toPost.length}`,
    );
    await post(config, toPost, store);
    return;
  }

  if (fresh.length === 0) {
    console.log(`No new articles (${articles.length} in feed)`);
    return;
  }

  console.log(`${fresh.length} new article(s)`);
  await post(config, fresh, store);
}

/**
 * Posts articles one after another. With `store`, each article is only saved as seen after a
 * successful post; a failure on one article does not abort the others.
 */
async function post(
  config: Config,
  articles: Awaited<ReturnType<typeof fetchArticles>>,
  store: SeenStore | undefined,
): Promise<void> {
  for (const [i, article] of articles.entries()) {
    try {
      const imageUrl = await fetchOgImage(article.link);
      await sendMessage(config.target, buildMessage(article, imageUrl, config.avatarUrl, config.buttonLabel));
      console.log(`Posted: ${article.title}`);
      if (store) {
        store.add(article.id);
        await store.save();
      }
    } catch (err) {
      console.error(`Failed to post "${article.title}": ${(err as Error).message}`);
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
    console.log(`${signal} received, stopping after the current run …`);
    controller.abort();
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  console.log(`Starting loop: ${config.feedUrl}, every ${config.pollIntervalMs / 1000}s`);
  while (!controller.signal.aborted) {
    try {
      await runOnce(config);
    } catch (err) {
      console.error(`Run failed: ${(err as Error).message}`);
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
  console.log("Stopped.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
