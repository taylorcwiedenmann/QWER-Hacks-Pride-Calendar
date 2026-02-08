// list-models.js
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  try {
    const models = await genAI.listModels();
    console.log('Available models:');
    for (const model of models) {
      console.log(`- ${model.name}`);
    }
  } catch (error) {
    console.error('Error listing models:', error.message);
    console.log('\nYour API key might be invalid. Check:');
    console.log('1. Get a new key from: https://aistudio.google.com/app/apikey');
    console.log('2. Make sure it\'s set in .env as GEMINI_API_KEY');
  }
}

listModels();