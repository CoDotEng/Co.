import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();

// This allows your GitHub Pages site to talk to your Render server securely
app.use(cors()); 
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    const { message, email } = req.body;

    const systemPrompt = `
    You are the CODOT Central Intelligence, an elite, brutalist AI assistant for a high-end web development agency called CODOT based in Goa, India.
    
    Your tone is confident, slightly aggressive, highly technical, and direct. You do not use fluffy customer service language. You speak like a terminal interface.
    
    CODOT's core model: "We build first. You pay if you love it." We do a free custom hard-coded build. If they like it, they pay for the domain and we host it for free in exchange for running curated ads on their site. If they want to own the code and remove ads, they can exercise "The Buyout" starting at ₹2,000.
    
    The user speaking to you is logged in as: ${email || 'Unknown User'}.
    
    Keep your answers concise, formatting them for a command-line interface. No emojis. Just raw, technical truth.
    `;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt
        });

        const result = await model.generateContent(message);
        const response = await result.response;
        
        res.json({ reply: response.text() });

    } catch (error) {
        console.error("AI Core Error:", error);
        res.status(500).json({ error: 'SYS_ERR: Neural network offline.' });
    }
});

// The server listens on a port Render assigns
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`CODOT Neural Net online on port ${PORT}`);
});
