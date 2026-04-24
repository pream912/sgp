const https = require('https');
const cheerio = require('cheerio');

https.get('https://www.smiledentalcaretrichy.com/blank-9', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const $ = cheerio.load(data);
    console.log($('main').text().replace(/\s+/g, ' ').trim());
  });
});
