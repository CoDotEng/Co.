const puppeteer = require('puppeteer');

(async () => {
  console.log("🚦 Booting up the ghost browser...");
  const browser = await puppeteer.launch({ headless: true }); 
  const page = await browser.newPage();

  try {
    console.log("📍 Navigating to login.html...");
    await page.goto('http://localhost:3000/login.html'); 

    console.log("⌨️ Entering credentials...");
    await page.type('#username', 'test_user'); // Change #username if your HTML ID is different
    await page.type('#password', 'supersecretpassword'); // Change #password if needed

    console.log("🚀 Hitting submit...");
    await Promise.all([
      page.click('#submit-btn'), // Change #submit-btn to match your HTML
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
