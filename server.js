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

      res.status(200).json({ success: true, folderUrl: newFolderLink });

    } catch (error) {
      console.error("❌ CRITICAL FAILURE:", error);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  });
});

app.listen(port, () => {
  console.log(`🟢 CODOT Neural Net online on port ${port}`);
});
