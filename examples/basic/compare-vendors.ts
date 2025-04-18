import { OpenAIService, GeminiService } from 'lecture-notes-sdk';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function main() {
    // Initialize both services
    const openAI = new OpenAIService(process.env.OPENAI_API_KEY || '');
    const gemini = new GeminiService(process.env.GEMINI_API_KEY || '');

    const topic = 'Introduction to Machine Learning';
    
    try {
        // Generate notes using both services
        console.log('Generating notes with OpenAI...');
        const openAINotes = await openAI.generateLectureNotes(topic);

        console.log('\nGenerating notes with Gemini...');
        const geminiNotes = await gemini.generateLectureNotes(topic);

        // Compare outputs
        console.log('\nOpenAI Output:');
        console.log(`Timestamp: ${openAINotes.timestamp}`);
        console.log(`Model: ${openAINotes.metadata.model}`);
        console.log('Content:\n', openAINotes.content);

        console.log('\nGemini Output:');
        console.log(`Timestamp: ${geminiNotes.timestamp}`);
        console.log(`Model: ${geminiNotes.metadata.model}`);
        console.log('Content:\n', geminiNotes.content);

        // Try transcript processing with both services
        const transcript = 'Today we will discuss machine learning algorithms...';
        
        console.log('\nProcessing transcript with OpenAI...');
        const openAITranscriptNotes = await openAI.generateFromTranscript(transcript, 'markdown');
        
        console.log('\nProcessing transcript with Gemini...');
        const geminiTranscriptNotes = await gemini.generateFromTranscript(transcript, 'markdown');

        console.log('\nOpenAI Transcript Notes:');
        console.log(openAITranscriptNotes);

        console.log('\nGemini Transcript Notes:');
        console.log(geminiTranscriptNotes);

    } catch (error) {
        console.error('Error:', error);
    }
}

main();