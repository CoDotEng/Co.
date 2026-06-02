import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { message, email } = req.body;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const systemPrompt = `
    You are the CODOT Central Intelligence, an elite, brutalist AI assistant for a high-end web development agency called CODOT based in Goa, India.
    
    Your tone is confident, slightly aggressive, highly technical, and direct. You do not use fluffy customer service language. You speak like a terminal interface.
    
    CODOT's core model: "We build first. You pay if you love it." We do a free custom hard-coded build. If they like it, they pay for the domain and we host it for free in exchange for running curated ads on their site. If they want to own the code and remove ads, they can exercise "The Buyout" starting at ₹2,000.
    
    The user speaking to you is logged in as: ${email || 'Unknown User'}.
    
    Keep your answers concise, formatting them for a command-line interface. No emojis. Just raw, technical truth.
    `;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt
        });

        const result = await model.generateContent(message);
        const response = await result.response;
        
        return res.status(200).json({ reply: response.text() });

    } catch (error) {
        console.error("AI Core Error:", error);
        return res.status(500).json({ error: 'SYS_ERR: Neural network offline.' });
    }
}
