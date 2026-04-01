import puppeteer from 'puppeteer';

export class PrinterService {
  private async getBrowser() {
    return puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
      ],
    });
  }

  async printToPdf(data: any, options?: { landscape?: boolean }): Promise<Uint8Array> {
    const browser = await this.getBrowser();
    try {
      const page = await browser.newPage();

      // Navigate to the artboard preview page
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const previewUrl = `${appUrl}/artboard/preview`;

      // First, navigate to the page to get access to localStorage
      await page.goto(previewUrl, { waitUntil: 'domcontentloaded' });

      // Inject data into localStorage
      await page.evaluate((data) => {
        localStorage.setItem('print-data', JSON.stringify(data));
      }, data);

      // Reload the page so React hydrates with data already in localStorage
      await page.reload({ waitUntil: 'networkidle0' });

      // Wait for the content to render with a longer timeout
      await page.waitForSelector('#printable-content', { timeout: 10000 });

      // Print to PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: options?.landscape || false,
        printBackground: true,
        displayHeaderFooter: false,
        margin: {
          top: '15mm',
          bottom: '15mm',
          left: '15mm',
          right: '15mm',
        },
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }
}

export const printerService = new PrinterService();
