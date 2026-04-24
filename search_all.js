const https = require('https');

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

let pending = urls.length;
urls.forEach(url => {
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      const regex = /.{0,50}privacy.{0,50}/gi;
      let matches = [];
      let m;
      while ((m = regex.exec(data)) !== null) {
        matches.push(m[0]);
      }
      // Filter out common menu links or code refs
      const unique = [...new Set(matches.map(m => m.replace(/\s+/g, ' ')))].filter(m => !m.includes('"label":"Privacy Policy"'));
      
      // Look for things like "This privacy policy" or "We collect" or "data"
      if (data.toLowerCase().includes('information we collect') || data.toLowerCase().includes('how we use your')) {
         console.log('--- FOUND LIKELY CONTENT IN:', url, '---');
      }
      
      pending--;
      if (pending === 0) console.log('Done');
    });
  }).on('error', (err) => {
    console.error(err);
    pending--;
  });
});
