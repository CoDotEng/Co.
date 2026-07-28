import puppeteer from 'puppeteer';

(async () => {
  console.log("🚦 Booting up the ghost browser...");
  
  // We added the args array here to bypass the Linux sandbox limits
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }); 
  
  const page = await browser.newPage();

  try {
    console.log("📍 Navigating to login.html...");
    await page.goto('http://localhost:3000/login.html'); 

    console.log("⌨️ Entering credentials...");
    await page.type('#username', 'test_user'); 
    await page.type('#password', 'supersecretpassword'); 

    console.log("🚀 Hitting submit...");
    await Promise.all([
      page.click('#submit-btn'), 
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
