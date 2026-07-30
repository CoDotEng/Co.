import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Readable } from 'stream';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); 

// 🔥 THE NEW OAUTH2 ENGINE 🔥
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground" 
);

// Lock in the master refresh token
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

// Boot up the Drive API using the VIP token
const drive = google.drive({ version: 'v3', auth: oauth2Client });
const MASTER_FOLDER_ID = process.env.DRIVE_MASTER_FOLDER_ID; 

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/lead', upload.single('projectFile'), async (req, res) => {
  try {
    console.log("🔥 Incoming lead detected...");

    // 1. Extract data
    const clientName = req.body.name || "Unknown Client";
    const clientEmail = req.body.email || "No Email Provided";
    const projectType = req.body.projectType || "Unknown Project";
    const projectDesc = req.body.projectDesc || "No description";

    // 2. Generate the Vault Folder
    const folderName = `Lead - ${clientName} - ${new Date().toISOString().split('T')[0]}`;
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

    // 3. Upload the File
    if (req.file) {
      console.log(`📦 File detected: ${req.file.originalname}. Piping to Drive...`);
      
      const bufferStream = Readable.from(req.file.buffer);

      await drive.files.create({
        requestBody: {
          name: req.file.originalname,
          parents: [newFolderId]
        },
        media: {
          mimeType: req.file.mimetype,
          body: bufferStream
        }
      });
      console.log("✅ File successfully vaulted.");
    }

    // 4. Send Rich Embed to Discord
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
      console.log("✅ Discord Pinged.");
    }

    res.status(200).json({ success: true, folderUrl: newFolderLink });

  } catch (error) {
    console.error("❌ CRITICAL FAILURE:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`🟢 CODOT Neural Net online on port ${port}`);
});
