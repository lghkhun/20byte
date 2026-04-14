import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const files = {
  "bni": "BNI_logo_(2024).svg",
  "bri": "Logo_BRI.svg",
  "mandiri": "Bank_Mandiri_logo_2016.svg",
  "cimb": "CIMB_Niaga_logo.svg",
  "maybank": "Logo_of_Maybank.svg",
  "permata": "PermataBank_logo.svg",
  "qris": "Logo_QRIS.svg",
  "atm_bersama": "ATM_Bersama_logo.svg",
  "bca": "Bank_Central_Asia.svg",
  "bsi": "Bank_Syariah_Indonesia.svg",
  "danamon": "Danamon.svg",
  "jago": "Bank_Jago_logo.svg",
  "seabank": "SeaBank_logo.svg",
  "bjb": "Logo_Bank_BJB.svg",
  "sampoerna": "Bank_Sahabat_Sampoerna_logo.svg",
  "dki": "Bank_DKI_logo.svg",
  "aladin": "Bank_Aladin_Syariah_logo.svg",
  "btn": "Bank_Tabungan_Negara_logo.svg",
  "mega": "Bank_Mega_logo.svg",
  "blu": "Logo_blu_oleh_BCA_Digital.svg"
};

async function run() {
  const dir = path.join(process.cwd(), 'public/logos');
  fs.mkdirSync(dir, { recursive: true });

  for (const [name, title] of Object.entries(files)) {
    try {
      console.log(`Resolving URL for ${name}...`);
      const apiReq = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=File:${title}&prop=imageinfo&iiprop=url&format=json`);
      const data = await apiReq.json();
      const pages = data.query?.pages;
      if (!pages) continue;
      
      const page = Object.values(pages)[0];
      if (!page || !page.imageinfo || page.imageinfo.length === 0) {
        console.log(`Could not find wikipedia file for ${name}`);
        continue;
      }
      
      const rawUrl = page.imageinfo[0].url;
      console.log(`Downloading ${name} from ${rawUrl}`);
      
      // using curl with user agent
      try {
        execSync(`curl -A "Mozilla/5.0" -sL -o "${path.join(dir, name + '.svg')}" "${rawUrl}"`);
        console.log(`Saved ${name}.svg`);
      } catch (e) {
        console.log(`Failed to download ${name}`);
      }
    } catch(e) {
      console.error(`Error on ${name}: ${e.message}`);
    }
  }
}

run();
