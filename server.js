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
const MASTER_FOLDER_ID = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDOGDvew2hY67lH\n9x5/4PO2FgkxmsA0BoNsYKXUhbrrg0ZPGZj5O5pgTYCIoGi37vdWoE9rCfarfHY5\nkOKzu0qNp2lbGtS1NwrY7aWxYIqnBrelV0RqlaHafajrFg55yUQv4I2ob5fa3Opy\n0pjt9wEdtmTNWlU0IHqMtVSWPSqCLpIIorVHc11kZWbmw5KjiCal1Pq/n4nxEzI5\ndgRtJdl3m7JFU54riU8LlNPPH+3WAYYn6BR1OxAki++rl7RTdKMLy4rNBMGxRKm4\naxAj5ml9dOhl/eB+H5lWUFgCaovg2g4MoGpx2XO7aaoir9BRYOE7BUA3RRtwm8rN\nkjdEg8Y9AgMBAAECggEACVFZK5okFpkZuGI408lE23+ljMOVWwTMXlMETFZ7e/hk\nbmEW5HXIZgA7BnJSKba5IgZ/cLRznY8z/ShKx5t5JGxkPAU7hrHlYKdl7V4TBrgs\nB2KpqjP3rFwwDejiYKkz1wJNBUd+UxvX0bcpyOB5AXHkntAtt/yb7c6o813ylQ4X\nLWBIKTERz9CZVYVSJdOPP8c/kaOgFrU8Z7kced1VxwhvT5vom8T2S9RrDJFg8IHu\na9fRXaJAfIIGgKcWMoFr24lP41JbplaVT1jI4k2kbTnxmLe1Jt8p09xQ+O3qTdE2\nsEk5BlScToyMtXVTgAanqGwtsVaGSTIHUOHk/SNuNQKBgQDuX+wWPjEnFw/kgeTH\n1p3lnfuOP16ZqCoZVBdHW5SW8+zVNOHei8nKQcRnb+CHUfTB/2UohTP6uCLSsULq\nlOPjFKjnZpGzJkqs1Ztf4dWiPOu77P1ZEZ7PR0Fokv/sn6tbRtP3ul039KUjGznZ\nmjGWIHPhaxmmQF425UqOKNKSvwKBgQDdVUx6GliAs5hIaPX5yeqX1RcVKVHPVoiU\nczFGiAlin3w0PKle4pJTjxZqu0/b2vp0sNQIPMhvIFXYZ6lMlmxCFfcOeuechcW/\nNAShkAnNqC66tux+6BzaCmFf0alp+DeNwDC6/B4XCwkE/4JShvXzqVAhEGf4MYJk\nvcDjrw1yAwKBgGknK1AMk0Y5KCuXGUMGa5TVAhkX3zVNN3UA4Vv7DCsi40CSGWlA\npP1x0aAHfDZ1ctD5Rrh/OhTJkaL7yxcMIxMTFAcv+enbZGmluOqtBr6QvTSjMIdP\n/IxXVIU7A2ZwcPjM38iSD3kVlJtN8VEKcgFVw4iW5DOwhV8V+rOHUoylAoGAFEe9\nky6Yz2olWPUtHK8wrKrcy5aWpW3jY97ONA1A9uVwJwUr68LM75Ub07nIDngZHNob\nA4o2P2ByHTsaWycpUkDa+1utnzzuqp9kkT02eL6hUYBzWQmBo0TyOSpn4Ira5EUo\n8ekqBKiBMhELau5s2N+5tN3g+O/oZ7yvUO14SOsCgYEAwZSU/SAuFOFj1IpCZXxN\niE62Ec/6bw+BRiUfFj6tkCqZ/gp2UQRFIV4LH0+UHB6Tt5tkb3Q6M8KlOF22IsnR\nJpDKSQ6R6WCuTbhna8MdgWHPDv7G7w2JZsmlKcdKziD64wh969kotCSeLff7KKTo\nsTlnli3Z9oTXYGQE65lxlxg=\n-----END PRIVATE KEY-----\n
"; 

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
