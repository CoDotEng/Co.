import puppeteer from 'puppeteer';

(async () => {
  console.log("🚦 Booting up the ghost browser...");
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }); 
  
  const page = await browser.newPage();
  
  // Keep X-Ray vision on just in case
  page.on('console', msg => console.log(`💻 BROWSER LOG: ${msg.text()}`));

  try {
    console.log("📍 Navigating to login.html...");
    await page.goto('http://localhost:3000/login.html', { waitUntil: 'networkidle0' }); 

    console.log("⏳ Waiting for the vault UI to render...");
    await page.waitForSelector('#loginEmail', { visible: true, timeout: 15000 });

    console.log("⌨️ Entering fake credentials...");
    await page.type('#loginEmail', 'test@codot.com'); 
    await page.type('#loginPassword', 'supersecretpassword'); 

    console.log("🚀 Hitting submit and waiting for the rejection...");
    await page.click('#authBtn'); 
    
    // Instead of waiting for a new page, we wait for your red error box to pop up
    await page.waitForSelector('#alertBox', { visible: true, timeout: 10000 });

    // Read the text inside the error box
    const alertText = await page.$eval('#alertBox', el => el.innerText);
    
    if (alertText.includes('Invalid credentials')) {
      console.log(`✅ SUCCESS: The UI works and Firebase successfully blocked us with: "${alertText}"`);
      process.exit(0);
    } else {
      console.log(`❌ FAILED: We got an unexpected error message: "${alertText}"`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error("⚠️ The bot crashed:", error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
