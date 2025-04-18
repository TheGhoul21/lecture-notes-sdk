import { OpenAIService, formatLectureNotes, extractKeyPoints, generateMarkdown } from 'lecture-notes-sdk';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';

dotenv.config();

async function main() {
    const openAI = new OpenAIService({
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'gpt-4',
        temperature: 0.4,
        maxTokens: 8192,
        maxAttempts: 3,
        responseValidation: {
            checkLaTeXBalance: true,
            checkCodeBlocks: true,
            checkJsonBalance: true
        }
    });

    try {
        // Process an audio file
        console.log('Processing audio file...');
        const audioTranscript = await openAI.processAudioFile({
            audioPath: './sample-lecture.wav',
            chunkDuration: 1800 // 30 minutes chunks
        });

        // Generate notes from the audio transcript
        console.log('Generating notes from audio transcript...');
        const notes = await openAI.generateFromAudio(audioTranscript);

        // Format the notes
        const formattedNotes = formatLectureNotes(notes);
        
        // Extract key points
        const keyPoints = extractKeyPoints(formattedNotes);
        console.log('\nKey Points:');
        keyPoints.forEach((point, index) => {
            console.log(`${index + 1}. ${point}`);
        });

        // Convert to markdown
        const markdown = generateMarkdown(formattedNotes);

        // Save the results
        await fs.writeFile('processed-notes.tex', formattedNotes);
        await fs.writeFile('processed-notes.md', markdown);
        await fs.writeFile('key-points.txt', keyPoints.join('\n'));

        console.log('\nFiles have been saved:');
        console.log('- processed-notes.tex (LaTeX format)');
        console.log('- processed-notes.md (Markdown format)');
        console.log('- key-points.txt (Extracted key points)');

    } catch (error) {
        console.error('Error processing audio:', error);
    }
}

main();