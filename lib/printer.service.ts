import { existsSync } from "node:fs";

import puppeteer from "puppeteer";

import type { MeetProgramDocumentData } from "@/lib/meet-program-pdf";
import { MEET_PROGRAM_STORAGE_KEY } from "@/lib/meet-program-pdf";
import type { RegistrationSheetDocumentData } from "@/lib/registration-sheet-pdf";
import { REGISTRATION_SHEET_STORAGE_KEY } from "@/lib/registration-sheet-pdf";

function resolveBrowserExecutablePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    puppeteer.executablePath(),
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
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: resolveBrowserExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.goto(`${baseUrl}${previewPath}`, {
      waitUntil: "networkidle0",
    });

    await page.evaluate(
      ({ storageKey, payload }) => {
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      },
      {
        storageKey,
        payload: document,
      },
    );

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
