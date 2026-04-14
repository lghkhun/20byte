import fs from 'fs';
import path from 'path';

const logos = {
  "bni": "https://upload.wikimedia.org/wikipedia/id/5/55/BNI_logo.svg",
  "bri": "https://upload.wikimedia.org/wikipedia/commons/9/97/Logo_BRI.svg",
  "mandiri": "https://upload.wikimedia.org/wikipedia/commons/a/ad/Bank_Mandiri_logo_2016.svg",
  "cimb": "https://upload.wikimedia.org/wikipedia/commons/e/e4/CIMB_Niaga_logo.svg",
  "maybank": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_of_Maybank.svg",
  "permata": "https://upload.wikimedia.org/wikipedia/commons/a/af/PermataBank_logo.svg",
  "qris": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg",
  "atm_bersama": "https://upload.wikimedia.org/wikipedia/commons/8/87/ATM_Bersama_logo.svg",
  "bca": "https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg",
  "bsi": "https://upload.wikimedia.org/wikipedia/commons/a/a0/Bank_Syariah_Indonesia.svg",
  "danamon": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Danamon.svg",
  "jago": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Bank_Jago_logo.svg",
  "seabank": "https://upload.wikimedia.org/wikipedia/commons/a/a5/SeaBank_logo.svg",
  "bjb": "https://upload.wikimedia.org/wikipedia/commons/e/ec/Logo_Bank_BJB.svg",
  "sampoerna": "https://upload.wikimedia.org/wikipedia/commons/1/12/Bank_Sahabat_Sampoerna_logo.svg",
  "dki": "https://upload.wikimedia.org/wikipedia/commons/a/a5/Bank_DKI_logo.svg",
  "aladin": "https://upload.wikimedia.org/wikipedia/commons/7/71/Bank_Aladin_Syariah_logo.svg",
  "btn": "https://upload.wikimedia.org/wikipedia/commons/1/18/Bank_Tabungan_Negara_logo.svg",
  "mega": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Bank_Mega_logo.svg",
  "blu": "https://upload.wikimedia.org/wikipedia/commons/0/05/Logo_blu_oleh_BCA_Digital.svg"
};

async function download() {
  const dir = path.join(process.cwd(), 'public/logos');
  fs.mkdirSync(dir, { recursive: true });

  for (const [name, url] of Object.entries(logos)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        let text = await res.text();
        if (text.includes('<svg') && !text.includes('File not found')) {
          fs.writeFileSync(path.join(dir, `${name}.svg`), text);
          console.log(`Downloaded ${name}.svg`);
        } else {
          console.log(`Failed to download ${name}.svg - Invalid content`);
        }
      } else {
        console.log(`Failed to load ${name} - Status: ${res.status}`);
      }
    } catch (e) {
      console.log(`Error on ${name}:`, e.message);
    }
  }
}

download();
