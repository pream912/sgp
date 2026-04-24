const https = require('https');
const cheerio = require('cheerio');

const urls = [
  'https://www.smiledentalcaretrichy.com/blank-14',
  'https://www.smiledentalcaretrichy.com/blank-3',
  'https://www.smiledentalcaretrichy.com/blank-9',
  'https://www.smiledentalcaretrichy.com/blank-7',
  'https://www.smiledentalcaretrichy.com/contact-us',
  'https://www.smiledentalcaretrichy.com/blank-19',
  'https://www.smiledentalcaretrichy.com/blank-6',
  'https://www.smiledentalcaretrichy.com/blank-17-1',
  'https://www.smiledentalcaretrichy.com/blank-13',
  'https://www.smiledentalcaretrichy.com/about-us',
  'https://www.smiledentalcaretrichy.com/blank-2',
  'https://www.smiledentalcaretrichy.com/blank-4',
  'https://www.smiledentalcaretrichy.com/blank-5',
  'https://www.smiledentalcaretrichy.com/why-rtc',
  'https://www.smiledentalcaretrichy.com/blank-12',
  'https://www.smiledentalcaretrichy.com/',
  'https://www.smiledentalcaretrichy.com/blank-15',
  'https://www.smiledentalcaretrichy.com/blog',
  'https://www.smiledentalcaretrichy.com/blank-18',
  'https://www.smiledentalcaretrichy.com/blank-11',
  'https://www.smiledentalcaretrichy.com/blank',
  'https://www.smiledentalcaretrichy.com/blank-8',
  'https://www.smiledentalcaretrichy.com/blank-10',
  'https://www.smiledentalcaretrichy.com/blank-16'
];

urls.forEach(url => {
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      const $ = cheerio.load(data);
      let title = $('title').text().trim();
      let h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
      let h2 = $('h2').first().text().replace(/\s+/g, ' ').trim();
      console.log(`${url}\n  T: ${title}\n  H1: ${h1}\n  H2: ${h2}\n`);
    });
  }).on('error', (err) => console.error(err));
});
