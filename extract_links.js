const https = require('https');
const cheerio = require('cheerio');

https.get('https://www.smiledentalcaretrichy.com/blank-10', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const $ = cheerio.load(data);
    $('a').each((i, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().includes('privacy')) {
        console.log(text, '=>', $(el).attr('href'));
      }
    });
  });
});
