import { existsSync } from "node:fs";

import chromium from "@sparticuz/chromium-min";
import puppeteerCore from "puppeteer-core";

import type { MeetProgramDocumentData } from "@/lib/meet-program-pdf";
import { MEET_PROGRAM_STORAGE_KEY } from "@/lib/meet-program-pdf";
import type { RegistrationSheetDocumentData } from "@/lib/registration-sheet-pdf";
import { REGISTRATION_SHEET_STORAGE_KEY } from "@/lib/registration-sheet-pdf";

function resolveBrowserExecutablePath(bundledExecutablePath?: string) {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    bundledExecutablePath,
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter((candidate): candidate is string => Boolean(candidate));

  const executablePath = candidates.find((candidate) => existsSync(candidate));

  if (!executablePath) {
    throw new Error(
      "No Chromium/Chrome executable found. Set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH, or install Chrome.",
    );
  }

  return executablePath;
}

let cachedExecutablePath: string | null = null;
let executablePathPromise: Promise<string> | null = null;

async function getVercelChromiumExecutablePath(baseUrl: string) {
  if (cachedExecutablePath) {
    return cachedExecutablePath;
  }

  if (!executablePathPromise) {
    const chromiumPackUrl = process.env.CHROMIUM_PACK_URL || `${baseUrl}/chromium-pack.tar`;
    executablePathPromise = chromium.executablePath(chromiumPackUrl).then((executablePath) => {
      cachedExecutablePath = executablePath;
      return executablePath;
    });
  }

  return executablePathPromise;
}

async function launchBrowser(baseUrl: string) {
  if (process.env.VERCEL) {
    const executablePath = await getVercelChromiumExecutablePath(baseUrl);
    return puppeteerCore.launch({
      headless: true,
      executablePath,
      args: chromium.args,
    });
  }

  const puppeteer = (await import("puppeteer")).default;

  return puppeteer.launch({
    headless: true,
    executablePath: resolveBrowserExecutablePath(puppeteer.executablePath()),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export async function generateMeetProgramPdf(document: MeetProgramDocumentData, baseUrl: string) {
  return generatePreviewPdf({
    document,
    baseUrl,
    previewPath: "/preview/meet-program",
    storageKey: MEET_PROGRAM_STORAGE_KEY,
  });
}

export async function generateRegistrationSheetPdf(
  document: RegistrationSheetDocumentData,
  baseUrl: string,
) {
  return generatePreviewPdf({
    document,
    baseUrl,
    previewPath: "/preview/registration-sheet",
    storageKey: REGISTRATION_SHEET_STORAGE_KEY,
  });
}

async function generatePreviewPdf({
  document,
  baseUrl,
  previewPath,
  storageKey,
}: {
  document: unknown;
  baseUrl: string;
  previewPath: string;
  storageKey: string;
}) {
  const browser = await launchBrowser(baseUrl);

  try {
    const page = await browser.newPage();
    const browserPage = page as unknown as {
      evaluate: (
        fn: (args: { storageKey: string; payload: unknown }) => void,
        args: { storageKey: string; payload: unknown },
      ) => Promise<void>;
    };

    await page.goto(`${baseUrl}${previewPath}`, {
      waitUntil: "networkidle0",
    });

    await browserPage.evaluate((args: { storageKey: string; payload: unknown }) => {
      window.localStorage.setItem(args.storageKey, JSON.stringify(args.payload));
    }, {
      storageKey,
      payload: document,
    });

    await page.reload({
      waitUntil: "networkidle0",
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: {
        top: "15mm",
        right: "15mm",
        bottom: "15mm",
        left: "15mm",
      },
    });
  } finally {
    await browser.close();
  }
}
