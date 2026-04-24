const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('.json') && url.includes('c88156')) {
      console.log('JSON URL:', url);
    }
  });

  await page.goto('https://www.smiledentalcaretrichy.com/', { waitUntil: 'networkidle0' });
  await browser.close();
})();
