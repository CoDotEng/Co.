import puppeteer from 'puppeteer';

(async () => {
  console.log("🚦 Booting up the ghost browser...");
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }); 
  
  const page = await browser.newPage();

  try {
    console.log("📍 Navigating to login.html...");
    await page.goto('http://localhost:3000/login.html'); 

    // THE FIX: Force the bot to wait for the Firebase loading ring to disappear 
    // and the email input to actually become visible on the screen.
    console.log("⏳ Waiting for the vault UI to render...");
    await page.waitForSelector('#loginEmail', { visible: true, timeout: 10000 });

    console.log("⌨️ Entering credentials...");
    await page.type('#loginEmail', 'test@codot.com'); 
    await page.type('#loginPassword', 'supersecretpassword'); 

    console.log("🚀 Hitting submit...");
    
    // Notice we wrap the click and the wait in a Promise.all 
    // so it knows exactly when the page transition is done.
    await Promise.all([
      page.click('#authBtn'), 
      page.waitForNavigation({ waitUntil: 'networkidle2' }) 
    ]);

    const currentUrl = page.url();
    if (currentUrl.includes('dashboard.html')) {
      console.log("✅ SUCCESS: Successfully breached the mainframe and hit the dashboard!");
      process.exit(0);
    } else {
      console.log("❌ FAILED: Still stuck at the gate.");
      process.exit(1);
    }
  } catch (error) {
    console.error("⚠️ The bot crashed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
