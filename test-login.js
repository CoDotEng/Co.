import puppeteer from 'puppeteer';

(async () => {
  console.log("🚦 Booting up the ghost browser...");
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }); 
  
  const page = await browser.newPage();

  // 👁️ X-RAY VISION: Forward all browser console logs to the GitHub terminal
  page.on('console', msg => console.log(`💻 BROWSER LOG: ${msg.text()}`));
  page.on('pageerror', error => console.log(`💥 BROWSER ERROR: ${error.message}`));
  page.on('requestfailed', req => console.log(`❌ NETWORK FAIL: ${req.url()}`));

  try {
    console.log("📍 Navigating to login.html...");
    // networkidle0 means wait until there are NO active network requests
    await page.goto('http://localhost:3000/login.html', { waitUntil: 'networkidle0' }); 

    console.log("⏳ Waiting for the vault UI to render...");
    // Upped the timeout to 15 seconds just in case the GitHub server is slow
    await page.waitForSelector('#loginEmail', { visible: true, timeout: 15000 });

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
    console.error("⚠️ The bot crashed:", error.message);
    
    console.log("\n🔍 --- DUMPING WHAT THE BOT ACTUALLY SAW ---");
    const html = await page.content();
    console.log(html.substring(0, 1500)); // Print the first 1500 characters of the HTML
    console.log("-------------------------------------------\n");
    
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
