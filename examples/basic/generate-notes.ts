import { OpenAIService } from 'lecture-notes-sdk';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function main() {
    // Initialize the OpenAI service with your API key
    const openAI = new OpenAIService(process.env.OPENAI_API_KEY || '');

    try {
        // Generate basic lecture notes
        console.log('Generating lecture notes...');
        const notes = await openAI.generateLectureNotes(
            'Introduction to Neural Networks',
            'Focus on basic architecture and backpropagation'
        );

        console.log('Generated Notes:');
        console.log(`Topic: ${notes.topic}`);
        console.log(`Timestamp: ${notes.timestamp}`);
        console.log(`Content:\n${notes.content}`);
        console.log('Metadata:', notes.metadata);
    } catch (error) {
        console.error('Error generating notes:', error);
    }
}

main();