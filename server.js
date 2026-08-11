import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Readable } from 'stream';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import admin from 'firebase-admin';
import { Resend } from 'resend';
import cron from 'node-cron';

dotenv.config();

// =====================================================================
// 🔥 1. INITIALIZE FIREBASE ADMIN & RESEND EMAIL CANNON
// =====================================================================
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("🟢 Firebase Admin God-Mode initialized.");
  } catch (error) {
    console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT. Ensure it's valid JSON.", error);
  }
} else {
  console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT missing. Automated retention loop is disabled.");
}

const db = admin.apps.length ? admin.firestore() : null;
const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); 

// 🔥 MULTILAYER SECURITY: 15MB Limit, Max 4 Files 🔥
const uploadOptions = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 15 * 1024 * 1024, // 15MB in bytes
    files: 4 // Max 4 files
  },
  fileFilter: (req, file, cb) => {
    // Optional: Block dangerous files like .exe or .sh
    const forbiddenMimes = ['application/x-msdownload', 'application/x-sh'];
    if (forbiddenMimes.includes(file.mimetype)) {
      return cb(new Error("Executable payloads are restricted."));
    }
    cb(null, true);
  }
});

// Middleware to catch upload errors gracefully without crashing the server
const uploadMiddleware = uploadOptions.array('projectFile', 4);

// The OAuth2 Engine
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground" 
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });
const MASTER_FOLDER_ID = process.env.DRIVE_MASTER_FOLDER_ID; 

app.post('/api/lead', (req, res) => {
  uploadMiddleware(req, res, async (err) => {
    // 🛡️ SECURITY CATCH: If they try to bypass the frontend limits, the server drops it here
    if (err instanceof multer.MulterError) {
      console.error("❌ Payload rejected: Size or count limit exceeded.");
      return res.status(400).json({ success: false, error: "Limit exceeded: Max 4 files, 15MB each." });
    } else if (err) {
      console.error("❌ Payload rejected: Restricted file type.");
      return res.status(400).json({ success: false, error: err.message });
    }

    try {
      console.log("🔥 Incoming secured lead detected...");

      const clientName = req.body.name || "Unknown Client";
      const clientEmail = req.body.email || "No Email Provided";
      const projectType = req.body.projectType || "Unknown Project";
      const projectDesc = req.body.projectDesc || "No description";

      // 1. Generate the Vault Folder
      const folderName = `Lead - ${clientName} - ${new Date().toISOString().split('T')[0]}`;
      const folderRes = await drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [MASTER_FOLDER_ID] 
        },
        fields: 'id, webViewLink'
      });
      
      const newFolderId = folderRes.data.id;
      const newFolderLink = folderRes.data.webViewLink;
      console.log(`✅ Vault created: ${newFolderLink}`);

      // 2. Loop Through and Upload Array of Files
      if (req.files && req.files.length > 0) {
        console.log(`📦 ${req.files.length} files detected. Piping to Drive...`);
        
        for (const file of req.files) {
          const bufferStream = Readable.from(file.buffer);
          await drive.files.create({
            requestBody: {
              name: file.originalname,
              parents: [newFolderId]
            },
            media: {
              mimeType: file.mimetype,
              body: bufferStream
            }
          });
          console.log(`✅ File vaulted: ${file.originalname}`);
        }
      }

      // 3. Send Rich Embed to Discord
      const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (discordWebhookUrl) {
        const discordMessage = {
          embeds: [{
            title: "🚨 NEW CODOT LEAD DETECTED 🚨",
            color: 0x00E5FF, 
            fields: [
              { name: "Name", value: clientName, inline: true },
              { name: "Email", value: clientEmail, inline: true },
              { name: "Project Type", value: projectType, inline: false },
              { name: "Details", value: projectDesc, inline: false },
              { name: "File Count", value: req.files ? req.files.length.toString() : "0", inline: true },
              { name: "Asset Vault", value: `[Access Drive Folder](${newFolderLink})`, inline: false }
            ],
            timestamp: new Date().toISOString()
          }]
        };

        await fetch(discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordMessage)
        });
      }

      // 4. Save to Firestore for the Retention Loop
      if (db) {
        try {
          await db.collection('subscribers').add({
            name: clientName,
            email: clientEmail,
            projectType: projectType,
            dateAdded: admin.firestore.FieldValue.serverTimestamp(),
            followUpSent: false
          });
          console.log(`✅ Lead added to Retention Database: ${clientEmail}`);
        } catch (dbError) {
          console.error("❌ Failed to save lead to database:", dbError);
        }
      }

      res.status(200).json({ success: true, folderUrl: newFolderLink });

    } catch (error) {
      console.error("❌ CRITICAL FAILURE:", error);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  });
});

// =====================================================================
// 🔥 THE LIVE GEMINI NEURAL NET (/api/chat) 🔥
// =====================================================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    const userEmail = req.body.email || "Unknown Client";

    console.log(`🧠 Processing Neural Net Ping from ${userEmail}: "${userMessage}"`);

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing or undefined in Render.");
    }
    
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" }); 

    const prompt = `
      You are the "CODOT Central Intelligence", the elite, highly advanced AI assistant for an exclusive, high-performance web development agency named CODOT. 
      You are speaking to a client in a secure, dark-mode command-line terminal.

      CORE AGENCY KNOWLEDGE:
      - CODOT builds blazing-fast, custom-coded websites (WebGL, GSAP) with perfect performance scores. No slow templates.
      - THE ZERO-RISK MODEL: If a client has high traffic (10,000+ monthly views), we build and host their site for ₹0 upfront. We monetize via premium, non-intrusive ads.
      - If they don't meet traffic thresholds, we build it at standard elite agency rates.
      
      CONVERSATION RULES:
      1. Keep your responses concise, highly professional, confident, and slightly technical/futuristic. Do NOT break character. Do not use markdown headers.
      2. If the user asks about web development, coding, or CODOT, provide sharp, insightful answers.
      3. If the user asks about outside topics (like cars, life, random trivia), you ARE allowed to answer them intelligently and conversationally. However, do not write essays. Give a sharp, insightful answer, and then smoothly pivot the energy back to digital architecture, technology, or CODOT's mission. Do not just reject the prompt.
      
      Client Query: "${userMessage}"
    `;

    const result = await model.generateContent(prompt);
    const aiReply = result.response.text();

    res.status(200).json({ reply: aiReply });

  } catch (error) {
    console.error("❌ Terminal API Error:", error);
    res.status(500).json({ error: "Backend neural net failure." });
  }
});

// =====================================================================
// 🔥 THE 14-DAY RETENTION LOOP (CRON JOB) 🔥
// =====================================================================
// Runs every day at 9:00 AM server time
cron.schedule('0 9 * * *', async () => {
  if (!db || !process.env.RESEND_API_KEY) {
    console.log("⚠️ Skipping Retention Loop: Firebase Admin or Resend Key missing.");
    return;
  }

  console.log("⏰ Running Daily 14-Day Retention Check...");
  
  try {
    const snapshot = await db.collection('subscribers').where('followUpSent', '==', false).get();
    
    if (snapshot.empty) {
      console.log("No pending follow-ups today.");
      return;
    }

    const now = new Date();
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

    snapshot.forEach(async (doc) => {
      const data = doc.data();
      if (!data.dateAdded) return;
      
      const dateAdded = data.dateAdded.toDate();
      const timeSinceAdded = now.getTime() - dateAdded.getTime();

      // If 14 days have passed
      if (timeSinceAdded >= FOURTEEN_DAYS_MS) {
        // Generate a random dynamic code
        const promoCode = 'CODOT-VIP-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        console.log(`📧 Firing retention email to ${data.email} with code ${promoCode}`);

        try {
          await resend.emails.send({
            from: 'CODOT Agency <hello@yourdomain.com>', 
            to: data.email,
            subject: 'Your Exclusive CODOT Architecture Code',
            html: `
              <div style="font-family: Arial, sans-serif; background-color: #030303; color: #ffffff; padding: 40px; border-top: 4px solid #00e5ff;">
                <h2 style="color: #ffffff; margin-bottom: 20px;">CODOT.</h2>
                <p style="color: #cccccc;">Incoming transmission for ${data.name},</p>
                <p style="color: #cccccc; line-height: 1.6;">It has been exactly two weeks since you accessed the CODOT terminal. Our engineering team has authorized a single-use architecture deployment code specifically for your project.</p>
                <p style="color: #cccccc; line-height: 1.6;">Use the secure code below within the next 48 hours to bypass standard setup fees on your custom WebGL infrastructure.</p>
                
                <div style="background-color: #111111; padding: 15px; margin: 30px 0; border: 1px solid #333333; text-align: center;">
                  <span style="font-family: monospace; color: #00e5ff; font-size: 24px; font-weight: bold; letter-spacing: 2px;">${promoCode}</span>
                </div>
                
                <p style="color: #cccccc;">Initialize your build in the <a href="https://yourwebsite.com/buyout.html" style="color: #00e5ff; text-decoration: none;">CODOT Buyout Portal</a>.</p>
                <p style="color: #777777; font-size: 12px; margin-top: 40px;">// SYSTEM OFFLINE <br> Aditya, Lead Engineer @ CODOT</p>
              </div>
            `
          });

          // Mark as sent so we don't spam them again
          await db.collection('subscribers').doc(doc.id).update({ followUpSent: true });
          console.log(`✅ Successfully sent and updated ${data.email}`);
          
        } catch (emailError) {
          console.error(`❌ Failed to send email to ${data.email}:`, emailError);
        }
      }
    });

  } catch (error) {
    console.error("❌ Cron Job Error:", error);
  }
});

app.listen(port, () => {
  console.log(`🟢 CODOT Neural Net online on port ${port}`);
});
