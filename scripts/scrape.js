const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

async function loadEnvFile(envFilePath = ".env") {
  try {
    const raw = await fs.readFile(envFilePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equalIndex = trimmed.indexOf("=");
      if (equalIndex <= 0) continue;
      const key = trimmed.slice(0, equalIndex).trim();
      const value = trimmed.slice(equalIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    console.log(`[info] loaded env file: ${envFilePath}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function getEnv(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

function parseBoolean(value, fallback = false) {
  if (!value) return fallback;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(taskName, retries, task) {
  let lastError;
  for (let i = 1; i <= retries; i += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      console.warn(`[warn] ${taskName} failed (attempt ${i}/${retries}): ${error.message}`);
      if (i < retries) {
        await sleep(1000 * i);
      }
    }
  }
  throw lastError;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escapeCell = (value) => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function extractData(page, itemSelector, itemTextSelector) {
  return page.$$eval(
    itemSelector,
    (items, textSelector) =>
      items.map((item, index) => {
        const source = textSelector ? item.querySelector(textSelector) || item : item;
        const link = item.querySelector("a");
        return {
          index: index + 1,
          text: source.textContent?.trim() || "",
          html: item.innerHTML.trim(),
          href: link?.href || "",
        };
      }),
    itemTextSelector || null,
  );
}

async function paginateAndCollect(page, config) {
  const allRows = [];

  for (let currentPage = 1; currentPage <= config.maxPages; currentPage += 1) {
    await page.waitForSelector(config.itemSelector, { timeout: config.timeoutMs });
    const pageRows = await extractData(page, config.itemSelector, config.itemTextSelector);
    allRows.push(...pageRows.map((row) => ({ ...row, page: currentPage })));
    console.log(`[info] page ${currentPage}: captured ${pageRows.length} rows`);

    if (config.infiniteScroll) {
      let previousHeight = await page.evaluate(() => document.body.scrollHeight);
      for (let i = 0; i < config.maxScrolls; i += 1) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(config.scrollDelayMs);
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
        if (currentHeight <= previousHeight) break;
        previousHeight = currentHeight;
      }
    }

    if (!config.nextSelector || currentPage >= config.maxPages) break;

    const next = page.locator(config.nextSelector).first();
    if ((await next.count()) === 0) break;
    if (!(await next.isVisible()) || !(await next.isEnabled())) break;

    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: config.timeoutMs }),
      next.click(),
    ]);
    await sleep(config.delayMs);
  }

  return allRows;
}

async function main() {
  await loadEnvFile(getEnv("ENV_FILE", ".env"));

  const config = {
    loginUrl: getEnv("LOGIN_URL"),
    targetUrl: getEnv("TARGET_URL"),
    username: getEnv("SITE_USERNAME"),
    password: getEnv("SITE_PASSWORD"),
    usernameSelector: getEnv("USERNAME_SELECTOR", 'input[name="username"]'),
    passwordSelector: getEnv("PASSWORD_SELECTOR", 'input[name="password"]'),
    submitSelector: getEnv("LOGIN_SUBMIT_SELECTOR", 'button[type="submit"]'),
    loginSuccessSelector: getEnv("LOGIN_SUCCESS_SELECTOR"),
    loginSuccessUrlContains: getEnv("LOGIN_SUCCESS_URL_CONTAINS"),
    itemSelector: getEnv("DATA_ITEM_SELECTOR"),
    itemTextSelector: getEnv("ITEM_TEXT_SELECTOR"),
    nextSelector: getEnv("PAGINATION_NEXT_SELECTOR"),
    maxPages: parseNumber(getEnv("MAX_PAGES"), 1),
    delayMs: parseNumber(getEnv("REQUEST_DELAY_MS"), 1000),
    infiniteScroll: parseBoolean(getEnv("INFINITE_SCROLL"), false),
    maxScrolls: parseNumber(getEnv("MAX_SCROLLS"), 5),
    scrollDelayMs: parseNumber(getEnv("SCROLL_DELAY_MS"), 1200),
    retries: parseNumber(getEnv("RETRY_COUNT"), 3),
    timeoutMs: parseNumber(getEnv("TIMEOUT_MS"), 15000),
    outputFormat: getEnv("OUTPUT_FORMAT", "json").toLowerCase(),
    outputBasename: getEnv("OUTPUT_BASENAME", "output/scrape-data"),
    headless: !parseBoolean(getEnv("SHOW_BROWSER"), false),
  };

  if (!["json", "csv", "both"].includes(config.outputFormat)) {
    throw new Error("OUTPUT_FORMAT must be one of: json, csv, both");
  }

  const required = [
    ["LOGIN_URL", config.loginUrl],
    ["TARGET_URL", config.targetUrl],
    ["SITE_USERNAME", config.username],
    ["SITE_PASSWORD", config.password],
    ["DATA_ITEM_SELECTOR", config.itemSelector],
  ].filter(([, value]) => !value);

  if (required.length) {
    throw new Error(`Missing required env vars: ${required.map(([name]) => name).join(", ")}`);
  }

  const browser = await chromium.launch({ headless: config.headless });
  const page = await browser.newPage();

  try {
    console.log("[info] opening login page");
    await withRetry("open login page", config.retries, () =>
      page.goto(config.loginUrl, { waitUntil: "networkidle", timeout: config.timeoutMs }),
    );

    await page.fill(config.usernameSelector, config.username);
    await page.fill(config.passwordSelector, config.password);

    console.log("[info] submitting login form");
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: config.timeoutMs }),
      page.click(config.submitSelector),
    ]);

    if (config.loginSuccessSelector) {
      await page.waitForSelector(config.loginSuccessSelector, { timeout: config.timeoutMs });
    }
    if (config.loginSuccessUrlContains && !page.url().includes(config.loginSuccessUrlContains)) {
      throw new Error("Login succeeded check failed: URL does not match expected pattern");
    }

    console.log("[info] opening target page");
    await withRetry("open target page", config.retries, () =>
      page.goto(config.targetUrl, { waitUntil: "networkidle", timeout: config.timeoutMs }),
    );
    await sleep(config.delayMs);

    const rows = await paginateAndCollect(page, config);
    console.log(`[info] total rows: ${rows.length}`);

    if (["json", "both"].includes(config.outputFormat)) {
      const jsonPath = `${config.outputBasename}.json`;
      await ensureParentDir(jsonPath);
      await fs.writeFile(jsonPath, JSON.stringify(rows, null, 2), "utf8");
      console.log(`[info] wrote ${jsonPath}`);
    }

    if (["csv", "both"].includes(config.outputFormat)) {
      const csvPath = `${config.outputBasename}.csv`;
      await ensureParentDir(csvPath);
      await fs.writeFile(csvPath, toCsv(rows), "utf8");
      console.log(`[info] wrote ${csvPath}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`[error] ${error.message}`);
  process.exitCode = 1;
});
