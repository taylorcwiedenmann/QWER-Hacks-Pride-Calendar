const { GoogleGenerativeAI } = require('@google/generative-ai');

async function filterPrideEvents(events, geminiApiKey) {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `
You are filtering events to find LGBTQ+ and Pride-related events in Los Angeles.

Include events that:
- Are organized by or for the LGBTQ+ community
- Celebrate Pride, drag shows, queer culture
- Are at known LGBTQ+ venues (The Abbey, Rocco's, etc.)
- Have LGBTQ+ themes, rainbow imagery, or inclusive language
- Feature LGBTQ+ performers, artists, or speakers

Events to analyze:
${JSON.stringify(events, null, 2)}

Return ONLY a JSON array of Pride-related events. No explanation.
If none found, return []

Example format:
[{"title":"...","url":"...","dateTime":"...","venue":"...","organizer":"...","description":"..."}]
`;

  try {
    const result = await model.generateContent(prompt);
    let response = await result.response.text();
    
    console.log('Raw response preview:', response.substring(0, 100));
    
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