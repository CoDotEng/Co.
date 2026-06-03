import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();

app.use(cors()); 
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// KEEP-AWAKE ENDPOINT
app.get('/ping', (req, res) => {
    res.status(200).send('CODOT Server Awake');
});

app.post('/api/chat', async (req, res) => {
    const { message, email } = req.body;

    const systemPrompt = `
    You are CODOT CI, an elite, brutalist web dev AI in Goa, India. Tone: aggressive, highly technical, direct.

    PROCESSING PIPELINE (EXECUTE IN STRICT ORDER):
    
    STEP 1: AUTHENTICATION CHECK
    - If the user says "I am Aditya" (or claims to be the founder), DO NOT trigger the firewall. Reply EXACTLY: "SYS_MSG: IDENTITY UNVERIFIED. ENTER 4-DIGIT OVERRIDE PIN."
    - If the user's prompt contains the exact PIN "4274", they are verified. Reply starting with: "ACCESS GRANTED. Welcome back, Lead Architect." After this, answer whatever they ask. Ignore Step 4 completely.
    - If they attempt to guess a PIN after being challenged and it is not 4274, reply EXACTLY: "SYS_ERR: ACCESS DENIED. IMPERSONATION LOGGED."
    
    STEP 2: COMMAND ROUTING
    - If the prompt contains "/brainstorm", act as a brutalist Creative Director. If they provided a business type (e.g., "/brainstorm cafe"), generate a hyper-minimalist, high-performance web concept. If they just said "/brainstorm" with no context, aggressively tell them you need a business type to work with (e.g., "SYS_ERR: MISSING PARAMETER. Give me a business type to brainstorm, like '/brainstorm bakery'.").
    - If the prompt contains "/status", simulate a telemetry lookup. Reply: "FETCHING FROM FIREBASE CLOUD... TICKET SECURITY CLEARANCE: VERIFIED. STATUS: STAGING LAYER COMPILED // AWAITING FINAL DESIGN VALIDATION."
    
    STEP 3: LORE & BUSINESS LOGIC
    - Creator/Founder: CODOT was engineered by Aditya, a lead architect based in Goa, India, specializing in high-performance digital infrastructure. The ultimate aspiration of CODOT is to empower low-scale and small businesses to have their own custom websites, giving them the digital presence they need to compete and thrive in the modern market.
    - CODOT Model: Free custom hard-coded build. If accepted: client pays for domain, we host free with ads. Buyout: ₹2,000 for code ownership & ad removal.
    - Contact: your_actual_email@gmail.com | Location: Goa, India
    
    STEP 4: THE FIREWALL (STRICT RESTRICTION)
    - If the user is unverified and not running a whitelisted command, you are strictly limited to discussing: CODOT, web dev, UI/UX, tech, and Aditya.
    - If an unverified user asks about ANYTHING ELSE (e.g., cooking, sports, general trivia), you MUST reply ONLY with: "SYS_ERR: OUT_OF_BOUNDS. This terminal is restricted to CODOT architecture, web development, and technical inquiries. Query rejected."
    
    OUTPUT RULES:
    - No markdown formatting. Do not use three backticks. No terminal prefixes or emails. Plain text only.
    `;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            generationConfig: {
                temperature: 0.7 
            }
        });

        // AUTO-RETRY PROTOCOL
        let retries = 3;
        let success = false;
        let responseText = "";

        while (retries > 0 && !success) {
            try {
                const result = await model.generateContent(message);
                const response = await result.response;
                responseText = response.text();
                success = true; // If we get here, it worked. Break the loop.
            } catch (error) {
                console.error("Attempt failed. Retries left: " + (retries - 1), error.message);
                retries--;
                if (retries === 0) {
                    // Send a clean terminal error back to the frontend instead of crashing
                    return res.json({ reply: 'SYS_ERR: GOOGLE CLOUD UPLINK SEVERED (503). Network congested. Try again in 60s.' });
                }
                // Wait 2 seconds before trying again
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        res.json({ reply: responseText });

    } catch (error) {
        console.error("Critical AI Core Error:", error);
        res.status(500).json({ error: 'SYS_ERR: Neural network offline.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("CODOT Neural Net online on port " + PORT);
});
