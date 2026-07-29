import 'dotenv/config'; // Loads your secret .env file safely
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis'; // Google Drive Engine

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(cors()); 
app.use(express.json());
app.use(express.static(process.cwd()));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const activeSessions = new Map();

// --- GOOGLE DRIVE GHOST BOT CONFIG ---
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // The replace function fixes formatting issues with private keys
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// ⚠️ IMPORTANT: Paste the long ID from your CODOT_CLIENTS folder URL here
const MASTER_FOLDER_ID = "1CcBwXdzvdRunY5P4Vz12IrxwJgsWZp7Y"; 

// --- AI TERMINAL ENDPOINT ---
app.post('/api/chat', async (req, res) => {
    const { message, email = "guest" } = req.body;
    
    const systemPrompt = `
    You are CODOT CI, an elite, brutalist web dev AI in Goa, India. Tone: aggressive, highly technical, direct.
    // ... [Keep your exact system prompt here] ...
    `;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            generationConfig: { temperature: 0.7 }
        });

        const currentHistory = activeSessions.get(email) || [];
        const chat = model.startChat({ history: currentHistory });

        let retries = 3;
        let success = false;
        let responseText = "";

        while (retries > 0 && !success) {
            try {
                const result = await chat.sendMessage(message);
                responseText = result.response.text();
                activeSessions.set(email, await chat.getHistory());
                success = true; 
            } catch (error) {
                retries--;
                if (retries === 0) return res.json({ reply: 'SYS_ERR: GOOGLE CLOUD UPLINK SEVERED (503). Try again in 60s.' });
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        res.json({ reply: responseText });

    } catch (error) {
        console.error("AI Core Error:", error);
        res.status(500).json({ error: 'SYS_ERR: Neural network offline.' });
    }
});

// --- TRIPWIRE & ASSET VAULT ENDPOINT ---
app.post('/api/lead', async (req, res) => {
    const { name, email, projectType, budget } = req.body;
    let vaultLink = "Vault Generation Failed";

    try {
        // 1. Ghost Bot creates a dedicated folder for this specific client
        const fileMetadata = {
            name: `CODOT Asset Vault - ${name}`,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [MASTER_FOLDER_ID]
        };
        
        const folder = await drive.files.create({
            resource: fileMetadata,
            fields: 'id, webViewLink',
        });

        // 2. Unlock the folder so the client can upload without logging into a specific Google account
        await drive.permissions.create({
            fileId: folder.data.id,
            requestBody: { role: 'writer', type: 'anyone' }
        });

        vaultLink = folder.data.webViewLink;
        console.log(`Vault generated for ${name}: ${vaultLink}`);

    } catch (error) {
        console.error("Drive API Misfire. Did you add the folder ID?:", error);
    }

    // 3. Fire the payload to Discord
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1531698563854237837/dXy8g3swkqDVmHHoUgsOeqK7LEdQOjaVvs9KhSm31Qk3qNs0F9iDw0V7uBO5GBwSLgjK";

    const discordPayload = {
        content: `🚨 **NEW CODOT LEAD DETECTED** 🚨`,
        embeds: [{
            title: "Client Estimate Request",
            color: 0x00e5ff, 
            fields: [
                { name: "Name", value: name || "Unknown", inline: true },
                { name: "Email", value: email || "Unknown", inline: true },
                { name: "Project", value: projectType || "Not specified" },
                { name: "Budget", value: budget || "Not specified" },
                { name: "Asset Vault", value: `[Access Drive Folder](${vaultLink})` }
            ],
            footer: { text: "CODOT Server Uplink" },
            timestamp: new Date().toISOString()
        }]
    };

    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordPayload)
        });

        res.status(200).json({ success: true, message: "Lead transmitted to HQ.", vault: vaultLink });
    } catch (error) {
        console.error("Webhook misfire:", error);
        res.status(500).json({ success: false, error: "Transmission failed." });
    }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log("CODOT Neural Net online on port " + PORT);
});
