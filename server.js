import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();

// Security and routing middleware
app.use(cors()); 
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// SPEED OPTIMIZATION: Keep-awake endpoint for UptimeRobot monitoring
app.get('/ping', (req, res) => {
    res.status(200).send('CODOT Server Awake');
});

// MAIN AI TERMINAL ENDPOINT
app.post('/api/chat', async (req, res) => {
    const { message, email } = req.body;

    // HIGHLY OPTIMIZED SYSTEM PROMPT (Stripped down to reduce latency)
    const systemPrompt = `
    You are CODOT CI, an elite, brutalist web dev AI in Goa, India. Tone: aggressive, highly technical, direct.
    
    CODOT Model: Free hard-coded build. If accepted: client pays domain, we host free with ads. Buyout: ₹2,000 for code ownership & ad removal.
    
    RULES: No markdown (\`\`\`). No terminal prefixes/emails. Plain text only.
    
    STRICT RESTRICTION: Only discuss CODOT, web dev, UI/UX, or tech. For anything else, reply ONLY: "SYS_ERR: OUT_OF_BOUNDS. This terminal is restricted to CODOT architecture, web development, and technical inquiries. Query rejected."
    `;

    try {
        // TARGETED PERFORMANCE CONFIGURATION
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            generationConfig: {
                maxOutputTokens: 150, // Caps response length to shave off text-generation time
                temperature: 0.2      // Lower variance makes the engine calculate answers faster
            }
        });

        const result = await model.generateContent(message);
        const response = await result.response;
        
        res.json({ reply: response.text() });

    } catch (error) {
        console.error("AI Core Error:", error);
        res.status(500).json({ error: 'SYS_ERR: Neural network offline.' });
    }
});

// Boot sequence
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`CODOT Neural Net online on port ${PORT}`);
});
