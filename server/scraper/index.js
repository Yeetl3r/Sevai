import { chromium } from 'playwright';

export async function scrapeSchemes() {
  // Launch Playwright in headless mode
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the official Tamil Nadu schemes portal directory
    // Example endpoint for generic data extraction
    await page.goto('https://www.tn.gov.in/scheme', { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    });
    
    // Evaluate in browser context to map all scheme cards
    const schemes = await page.evaluate(() => {
      const results = [];
      // Example DOM querying: targeting typical Drupal blocks often used by tn.gov.in
      document.querySelectorAll('.view-content .views-row').forEach((node, index) => {
        const titleEl = node.querySelector('.views-field-title a');
        const descEl = node.querySelector('.views-field-body .field-content');
        const linkEl = node.querySelector('a');

        if (titleEl) {
          results.push({
            id: `scraped_tn_${index}`,
            title: titleEl.innerText.trim(),
            description: descEl ? descEl.innerText.trim() : 'Detailed info available on portal.',
            link: linkEl ? linkEl.href : 'https://www.tn.gov.in/scheme',
            source: 'TN_Portal_Scraper'
          });
        }
      });
      return results;
    });

    return schemes;
  } catch (error) {
    console.error('[Scraper] Playwright extraction failed:', error);
    throw new Error(`Failed to scrape dynamic schemes: ${error.message}`);
  } finally {
    await browser.close();
  }
}
