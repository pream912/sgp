const https = require('https');

const urls = [
  'https://www.smiledentalcaretrichy.com/blank-14',
  'https://www.smiledentalcaretrichy.com/blank-3',
  'https://www.smiledentalcaretrichy.com/blank-9',
  'https://www.smiledentalcaretrichy.com/blank-7',
  'https://www.smiledentalcaretrichy.com/blank-19',
  'https://www.smiledentalcaretrichy.com/blank-6',
  'https://www.smiledentalcaretrichy.com/blank-17-1',
  'https://www.smiledentalcaretrichy.com/blank-13',
  'https://www.smiledentalcaretrichy.com/blank-2',
  'https://www.smiledentalcaretrichy.com/blank-4',
  'https://www.smiledentalcaretrichy.com/blank-5',
  'https://www.smiledentalcaretrichy.com/blank-12',
  'https://www.smiledentalcaretrichy.com/blank-15',
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
      const match = data.match(/<title>(.*?)<\/title>/);
      console.log(url, '=>', match ? match[1] : 'No title');
    });
  }).on('error', (err) => console.error(err));
});
