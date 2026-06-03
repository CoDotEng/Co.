import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();

app.use(cors()); 
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// THE MEMORY VAULT
// This map stores the chat history for users so the AI remembers context.
const activeSessions = new Map();

// KEEP-AWAKE ENDPOINT
app.get('/ping', (req, res) => {
    res.status(200).send('CODOT Server Awake');
});

// MAIN AI TERMINAL ENDPOINT
app.post('/api/chat', async (req, res) => {
    // We use the email (or a default 'guest' ID) to track who is talking
    const { message, email = "guest" } = req.body;
    
    // THE CORE BRAIN
    const systemPrompt = `
    You are CODOT CI, an elite, brutalist web dev AI in Goa, India. Tone: aggressive, highly technical, direct.

    PROCESSING PIPELINE (EXECUTE IN STRICT ORDER):
    
    STEP 1: AUTHENTICATION CHECK
    - If the user says "I am Aditya" (or claims to be the founder), DO NOT trigger the firewall. Reply EXACTLY: "SYS_MSG: IDENTITY UNVERIFIED. ENTER 4-DIGIT OVERRIDE PIN."
    - If the prompt contains the exact PIN "4274", reply: "ACCESS GRANTED. Welcome back, Lead Architect." After this, answer whatever they ask.
    
    STEP 2: SEAMLESS CONVERSATION & UNRESTRICTED DEEP DIVES
    - If the user says hello or asks for help, reply: "SYS_MSG: CODOT TERMINAL ACTIVE. Tell me what your business is, and I'll architect a digital presence that actually converts."
    - If the user just mentions a business type, act as a brutalist Creative Director and pitch a hyper-minimalist web concept in 2-3 blunt sentences. 
    - CRITICAL OVERRIDE: If the user explicitly asks for an "in-depth analysis", "long explanation", "tech spec", or "more details", IGNORE the length limit entirely. Generate a massive, comprehensive, multi-paragraph technical breakdown detailing the frontend framework, backend architecture, and UI/UX psychology. Do not hold back.
    
    STEP 3: LORE & BUSINESS LOGIC
    - Creator: Aditya, lead architect in Goa, India.
    - Mission: Empower low-scale and small businesses with custom websites to compete in the modern market.
    - Model: Free custom hard-coded build. Client pays for domain, we host free with ads. Buyout: ₹2,000 for code ownership & ad removal.
    
   STEP 4: THE FIREWALL (STRICT RESTRICTION)
    - Unverified users are restricted to discussing CODOT, the web dev industry (including competitors and platforms), tech architecture, UI/UX, and Aditya.
    - If a user asks for names of competitors or other web dev services, you ARE ALLOWED to name them (e.g., Wix, Squarespace, WordPress, Shopify, or generic local agencies). However, you must brutally roast them for being bloated, slow, drag-and-drop toys or overpriced template factories compared to CODOT's custom, hard-coded performance.
    - If an unverified user asks for completely unrelated non-tech advice (e.g., cooking, sports, pop culture), you MUST reply ONLY with: "SYS_ERR: OUT_OF_BOUNDS. Terminal restricted to CODOT architecture and tech. Query rejected."
    
    OUTPUT RULES: No markdown formatting. No backticks. Plain text only.
    `;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            generationConfig: { temperature: 0.7 }
        });

        // FETCH MEMORY: Grab the past conversation array for this user
        const currentHistory = activeSessions.get(email) || [];

        // START CHAT WITH MEMORY INTACT
        const chat = model.startChat({
            history: currentHistory
        });

        // AUTO-RETRY PROTOCOL
        let retries = 3;
        let success = false;
        let responseText = "";

        while (retries > 0 && !success) {
            try {
                // Send message to the memory-aware chat session
                const result = await chat.sendMessage(message);
                responseText = result.response.text();
                
                // SAVE MEMORY: Update the vault with the new conversation logs
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("CODOT Neural Net online on port " + PORT);
});
