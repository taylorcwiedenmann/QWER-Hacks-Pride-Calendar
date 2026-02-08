const { GoogleGenerativeAI } = require('@google/generative-ai');

async function filterPrideEvents(events, geminiApiKey) {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `
Filter these events to find LGBTQ+ and Pride-related events.

Events:
${JSON.stringify(events, null, 2)}

Return ONLY a JSON array of Pride-related events with this EXACT format:
{
  "name": "event title",
  "date": "date string", 
  "start_time": "time string",
  "end_time": "",
  "location": "venue",
  "description": "url"
}

CRITICAL: Use "name" not "title", keep "date" and "start_time" separate, not combined.
If none found, return []
`;

  try {
    const result = await model.generateContent(prompt);
    let response = await result.response.text();
    
    response = response
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    
    const prideEvents = JSON.parse(response);
    return Array.isArray(prideEvents) ? prideEvents : [];
    
  } catch (error) {
    console.error('Gemini error:', error.message);
    return [];
  }
}

module.exports = { filterPrideEvents };