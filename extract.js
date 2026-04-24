const https = require('https');
const cheerio = require('cheerio');

const urls = [
  'https://www.smiledentalcaretrichy.com/blank-9',
  'https://www.smiledentalcaretrichy.com/blank-10',
  'https://www.smiledentalcaretrichy.com/blank-19'
];

urls.forEach(url => {
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      const $ = cheerio.load(data);
      console.log('--- ' + url + ' ---');
      console.log($('main').text().replace(/\s+/g, ' ').trim().substring(0, 500) + '...');
    });
  }).on('error', (err) => console.error(err));
});
