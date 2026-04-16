import { Router } from 'express';
import { scrapeSchemes } from '../scraper/index.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await scrapeSchemes();
    res.json({
      success: true,
      message: 'Scraping operational. Schemes fetched successfully.',
      count: data?.length || 0,
      data
    });
  } catch (error) {
    console.error('API /api/scraper error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to dynamically scrape welfare schemes.',
      details: error.message
    });
  }
});

export default router;
