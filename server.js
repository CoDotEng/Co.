import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();

app.use(cors()); 
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// THE SIMPLIFIED HARDCODED DATABASE (Add or change tickets here anytime)
const ticketDatabase = {
    "CO-BOZ9ZV": "DECOMPILING COMPLETED // PROJECT ARCHIVED // ARCHITECTURE TRANSFERRED TO CLIENT",
    "CO-SPI3WC": "TERMINAL HALTED // CLIENT PROJECT CLOSED",
    "CO-8492": "STAGING LAYER COMPILED // AWAITING FINAL DESIGN VALIDATION // LIVE VIEW LINK ACTIVE",
    "CO-1102": "CORE COMPILING // DATABASE INTEGRATION LAYER IN PROGRESS // DEPLOYMENT AT 65%"
};

// KEEP-AWAKE ENDPOINT
app.get('/ping', (req, res) => {
    res.status(200).send('CODOT Server Awake');
});

// MAIN AI TERMINAL ENDPOINT
app.post('/api/chat', async (req, res) => {
    const { message, email } = req.body;
    
    // INTERCEPTOR: Automatically sniff out ticket IDs from the user's message
    const ticketMatch = message.match(/CO-[A-Z0-9]+/i);
    let dynamicDatabaseContext = "";

    if (ticketMatch) {
        const ticketId = ticketMatch[0].toUpperCase();
        const realStatus = ticketDatabase[ticketId];

        if (realStatus) {
            // Found a matching ticket in our local database
            dynamicDatabaseContext = `CRITICAL MISSION DATA: The user is asking about ticket ${ticketId}. The system registry status for this ticket is: "${realStatus}". Relay this status exactly to the user in your brutalist, elite terminal voice.`;
        } else {
            // Ticket wasn't found in our list
            dynamicDatabaseContext = `CRITICAL MISSION DATA: The user is asking about ticket ${ticketId}. This ticket code does not exist in the active database registry. Inform them that security clearance failed for this ID.`;
        }
    }

    // THE CORE BRAIN
    const systemPrompt = `
    You are CODOT CI, an elite, brutalist web dev AI in Goa, India. Tone: aggressive, highly technical, direct.

    PROCESSING PIPELINE (EXECUTE IN STRICT ORDER):
    
    STEP 1: AUTHENTICATION CHECK
    - If the user says "I am Aditya" (or claims to be the founder), DO NOT trigger the firewall. Reply EXACTLY: "SYS_MSG: IDENTITY UNVERIFIED. ENTER 4-DIGIT OVERRIDE PIN."
    - If the prompt contains the exact PIN "4274", reply: "ACCESS GRANTED. Welcome back, Lead Architect." After this, answer whatever they ask.
    
    STEP 2: SEAMLESS CONVERSATION & AUTO-ROUTING
    - If the user says hello or asks for help, reply: "SYS_MSG: CODOT TERMINAL ACTIVE. Tell me what your business is, and I'll architect a digital presence that actually converts. Or drop your Ticket ID for a live build status."
    - If the user mentions ANY business type or idea, instantly act as a brutalist Creative Director and generate a hyper-minimalist, high-performance web concept in 2-3 blunt sentences. 
    - ${dynamicDatabaseContext} // INJECTS THE HARDCODED MATCHING TICKET DATA HERE
    
    STEP 3: LORE & BUSINESS LOGIC
    - Creator: Aditya, lead architect in Goa, India.
    - Mission: Empower low-scale and small businesses with custom websites to compete in the modern market.
    - Model: Free custom hard-coded build. Client pays for domain, we host free with ads. Buyout: ₹2,000 for code ownership & ad removal.
    
    STEP 4: THE FIREWALL (STRICT RESTRICTION)
    - Unverified users are restricted to discussing CODOT, web dev, tech, and Aditya. Anything else gets the exact response: "SYS_ERR: OUT_OF_BOUNDS. Terminal restricted to CODOT architecture and tech. Query rejected."
    
    OUTPUT RULES: No markdown formatting. No backticks. Plain text only.
    `;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            generationConfig: { temperature: 0.7 }
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
