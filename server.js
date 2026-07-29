import express from 'express';
import cors from 'cors';
import multer from 'multer';
import stream from 'stream';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Standard Middlewares
app.use(cors());
app.use(express.json()); // Keep this for any normal JSON requests

// 1. Google Drive Engine Setup
// It pulls your locked-down credentials directly from Render's Environment Variables
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    // The .replace handles how Render processes the raw private key string
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), 
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });
const MASTER_FOLDER_ID = process.env.DRIVE_MASTER_FOLDER_ID; // Add this to Render Env Vars

// 2. Multer Setup: The File Interceptor
// Holds the incoming file in the server's RAM temporarily before streaming it out
const upload = multer({ storage: multer.memoryStorage() });

// 3. The Lead Capture & File Vault Endpoint
// Looking for a file attached with the exact name 'projectFile' from your frontend FormData
app.post('/api/lead', upload.single('projectFile'), async (req, res) => {
  try {
    console.log("🔥 Incoming lead detected...");

    // Parse the text data from the frontend form 
    const clientEmail = req.body.email || "No Email Provided";
    const projectType = req.body.projectType || "Unknown Project";
    const projectDesc = req.body.projectDesc || "No description";

    // Step 1: Spawn a dedicated folder for this specific client in Drive
    const folderName = `Lead - ${clientEmail} - ${new Date().toISOString().split('T')[0]}`;
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [MASTER_FOLDER_ID] 
    };

    const folderRes = await drive.files.create({
      resource: folderMetadata,
      fields: 'id, webViewLink'
    });
    
    const newFolderId = folderRes.data.id;
    const newFolderLink = folderRes.data.webViewLink;
    console.log(`✅ Vault created: ${newFolderLink}`);

    // Step 2: If the client attached a file, stream it straight into their new folder
    if (req.file) {
      console.log(`📦 File detected: ${req.file.originalname}. Piping to Drive...`);
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);

      await drive.files.create({
        requestBody: {
          name: req.file.originalname,
          parents: [newFolderId] // Drops it specifically in their new folder
        },
        media: {
          mimeType: req.file.mimetype,
          body: bufferStream
        }
      });
      console.log("✅ File successfully vaulted.");
    }

    // Step 3: Ping Discord so you get the notification instantly
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhookUrl) {
      const discordMessage = {
        content: `🚀 **New Client Lead!**\n**Email:** ${clientEmail}\n**Type:** ${projectType}\n**Details:** ${projectDesc}\n📂 **Vault Link:** ${newFolderLink}`
      };

      await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordMessage)
      });
    }

    // Step 4: Tell the frontend website everything went perfectly
    res.status(200).json({ 
        success: true, 
        message: "Lead captured, folder generated, and files secured.",
        folderUrl: newFolderLink
    });

  } catch (error) {
    console.error("❌ CRITICAL FAILURE:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Fire up the engine
app.listen(port, () => {
  console.log(`🟢 CODOT Neural Net online on port ${port}`);
});
