import { GeminiOpenAIService } from 'lecture-notes-sdk';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function main() {
    // Initialize the Gemini service with OpenAI compatibility
    const gemini = new GeminiOpenAIService({
        apiKey: process.env.GEMINI_API_KEY || '',
        model: 'gemini-pro',
        temperature: 0.4,
        maxTokens: 8192
    });

    try {
        // You can use Gemini with OpenAI-like message structure
        const completion = await gemini.createChatCompletion({
            model: 'gemini-pro',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful expert in computer science.'
                },
                {
                    role: 'user',
                    content: 'Explain what is a binary search tree.'
                }
            ],
            temperature: 0.4
        });

        console.log('Direct OpenAI-compatible response:');
        console.log(completion.choices[0].message.content);

        // Or use the high-level SDK methods
        console.log('\nGenerating lecture notes using high-level SDK methods...');
        const notes = await gemini.generateLectureNotes('Binary Search Trees');

        console.log('\nGenerated Notes:');
        console.log(`Topic: ${notes.topic}`);
        console.log(`Timestamp: ${notes.timestamp}`);
        console.log(`Content:\n${notes.content}`);
        console.log('Metadata:', notes.metadata);

    } catch (error) {
        console.error('Error:', error);
    }
}

main();