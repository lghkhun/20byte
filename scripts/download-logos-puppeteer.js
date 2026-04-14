const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const logos = {
  "bca": "https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg",
  "bsi": "https://upload.wikimedia.org/wikipedia/commons/a/a0/Bank_Syariah_Indonesia.svg",
  "danamon": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Danamon.svg",
  "jago": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Bank_Jago_logo.svg",
  "seabank": "https://upload.wikimedia.org/wikipedia/commons/a/a5/SeaBank_logo.svg",
  "bjb": "https://upload.wikimedia.org/wikipedia/commons/e/ec/Logo_Bank_BJB.svg",
  "sampoerna": "https://upload.wikimedia.org/wikipedia/commons/1/12/Bank_Sahabat_Sampoerna_logo.svg",
  "dki": "https://upload.wikimedia.org/wikipedia/commons/a/a5/Bank_DKI_logo.svg",
  "btn": "https://upload.wikimedia.org/wikipedia/commons/1/18/Bank_Tabungan_Negara_logo.svg",
  "mega": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Bank_Mega_logo.svg",
  "blu": "https://upload.wikimedia.org/wikipedia/commons/0/05/Logo_blu_oleh_BCA_Digital.svg",
  "bni": "https://upload.wikimedia.org/wikipedia/id/5/55/BNI_logo.svg",
  "bri": "https://upload.wikimedia.org/wikipedia/commons/9/97/Logo_BRI.svg",
  "cimb": "https://upload.wikimedia.org/wikipedia/commons/e/e4/CIMB_Niaga_logo.svg",
  "maybank": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_of_Maybank.svg",
  "permata": "https://upload.wikimedia.org/wikipedia/commons/a/af/PermataBank_logo.svg",
  "qris": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg",
  "atm_bersama": "https://upload.wikimedia.org/wikipedia/commons/8/87/ATM_Bersama_logo.svg"
};

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const dir = path.join(process.cwd(), 'public/logos');
  fs.mkdirSync(dir, { recursive: true });

  for (const [name, url] of Object.entries(logos)) {
    try {
      console.log(`Fetching ${name}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      // If it's a raw SVG, the page content might be just the SVG DOM or wrapped in a viewer.
      // We can grab the exact text using fetch inside the page contextualizing the same origin/cookies
      const svgText = await page.evaluate(async (svgUrl) => {
         const resp = await fetch(svgUrl);
         return await resp.text();
      }, url);

      if (svgText && svgText.includes('<svg')) {
         fs.writeFileSync(path.join(dir, `${name}.svg`), svgText);
         console.log(`Saved ${name}.svg (${svgText.length} bytes)`);
      } else {
         console.log(`Invalid SVG fetched for ${name}`);
      }
    } catch (e) {
      console.log(`Error ${name}: ${e.message}`);
    }
  }

  await browser.close();
})();
