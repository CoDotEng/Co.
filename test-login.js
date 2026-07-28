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

    // THE FIX IS RIGHT HERE: Using the exact IDs from your HTML
    console.log("⌨️ Entering credentials...");
    await page.type('#loginEmail', 'test@codot.com'); 
    await page.type('#loginPassword', 'supersecretpassword'); 

    console.log("🚀 Hitting submit...");
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
