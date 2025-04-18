import { OpenAIService, LectureFormat } from 'lecture-notes-sdk';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

async function main() {
    const openAI = new OpenAIService(process.env.OPENAI_API_KEY || '');
    
    try {
        // Read a sample transcript
        const transcript = readFileSync('./sample-transcript.txt', 'utf-8');

        // Generate notes in LaTeX format
        console.log('Generating LaTeX notes from transcript...');
        const latexNotes = await openAI.generateFromTranscript(transcript, 'latex');
        console.log('\nLaTeX Output:\n', latexNotes);

        // Generate notes in Markdown format
        console.log('\nGenerating Markdown notes from transcript...');
        const markdownNotes = await openAI.generateFromTranscript(transcript, 'markdown');
        console.log('\nMarkdown Output:\n', markdownNotes);

        // You can also refine specific sections
        const section = '\\section{Introduction}\nBasic introduction to the topic...';
        const refinedSection = await openAI.refineSection(section, transcript, 'latex');
        console.log('\nRefined Section:\n', refinedSection);
    } catch (error) {
        console.error('Error processing transcript:', error);
    }
}

main();