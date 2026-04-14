const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const bankPages = {
  "bni": "https://id.wikipedia.org/wiki/Bank_Negara_Indonesia",
  "bri": "https://id.wikipedia.org/wiki/Bank_Rakyat_Indonesia",
  "mandiri": "https://id.wikipedia.org/wiki/Bank_Mandiri",
  "cimb": "https://id.wikipedia.org/wiki/CIMB_Niaga",
  "maybank": "https://id.wikipedia.org/wiki/Maybank",
  "permata": "https://id.wikipedia.org/wiki/PermataBank",
  "jago": "https://id.wikipedia.org/wiki/Bank_Jago",
  "seabank": "https://id.wikipedia.org/wiki/SeaBank",
  "bjb": "https://id.wikipedia.org/wiki/Bank_BJB",
  "sampoerna": "https://en.wikipedia.org/wiki/Sampoerna", // might not have bank logo
  "dki": "https://id.wikipedia.org/wiki/Bank_DKI",
  "btn": "https://id.wikipedia.org/wiki/Bank_Tabungan_Negara",
  "mega": "https://id.wikipedia.org/wiki/Bank_Mega"
};

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const dir = path.join(process.cwd(), 'public/logos');
  fs.mkdirSync(dir, { recursive: true });

  for (const [name, pageUrl] of Object.entries(bankPages)) {
    try {
      console.log(`Fetching page for ${name}: ${pageUrl}`);
      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (e) {
        console.log(`Timeout on ${name}`);
      }

      // Find the infobox logo link
      const logoUrl = await page.evaluate(() => {
        const img = document.querySelector('table.infobox img[src*=".svg"]');
        if (img) return img.src.replace(/\/thumb\/(.*?\.svg)\/.*/, '/$1').replace('/wikipedia/', '/wikipedia/commons/').replace('/id/commons/', '/commons/');
        return null; // fallback
      });

      if (logoUrl) {
         console.log(`Found logo URL for ${name}: ${logoUrl}`);
         // go to the raw SVG url
         await page.goto(logoUrl.replace('wikipedia/commons/commons', 'wikipedia/commons/'), {waitUntil: 'domcontentloaded'});
         const svgText = await page.evaluate(async (url) => {
            const resp = await fetch(url);
            return await resp.text();
         }, logoUrl);

         if (svgText && svgText.includes('<svg')) {
             fs.writeFileSync(path.join(dir, `${name}.svg`), svgText);
             console.log(`Saved ${name}.svg`);
         } else {
             console.log(`Failed to validate SVG for ${name}`);
         }
      } else {
         console.log(`No SVG logo found in infobox for ${name}`);
      }
    } catch (e) {
      console.log(`Error ${name}: ${e.message}`);
    }
  }

  await browser.close();
})();
