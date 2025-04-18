import { OpenAIService } from 'lecture-notes-sdk';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

dotenv.config();

async function main() {
    const openAI = new OpenAIService({
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'gpt-4',
        temperature: 0.4,
        maxTokens: 8192
    });

    try {
        // Process a PDF lecture
        console.log('Processing PDF content...');
        const pdfContent = readFileSync('./lecture-slides.pdf', 'utf-8');
        
        // Generate LaTeX notes from PDF
        console.log('Generating LaTeX notes from PDF...');
        const latexNotes = await openAI.augmentFromPDF(pdfContent, 'latex');
        console.log('\nLaTeX notes generated successfully.');

        // Process a YouTube lecture
        console.log('\nProcessing YouTube lecture...');
        const youtubeNotes = await openAI.processYouTubeURL(
            'https://www.youtube.com/watch?v=example',
            'markdown'
        );

        // Generate a document scaffold from the combined content
        console.log('\nGenerating document scaffold...');
        const combinedTranscript = `
            PDF Content:
            ${pdfContent}

            YouTube Lecture:
            ${youtubeNotes.content}
        `;
        
        const scaffold = await openAI.generateScaffold(combinedTranscript, 'latex');
        
        // Refine specific sections using both sources
        console.log('\nRefining sections...');
        const introSection = await openAI.refineSection(
            '\\section{Introduction}',
            combinedTranscript,
            'latex'
        );

        // Save the generated content
        console.log('\nSaving generated content...');
        await Promise.all([
            writeFile('pdf-notes.tex', latexNotes),
            writeFile('youtube-notes.md', youtubeNotes.content),
            writeFile('combined-scaffold.tex', scaffold),
            writeFile('refined-intro.tex', introSection)
        ]);

        console.log('\nAll files have been saved:');
        console.log('- pdf-notes.tex (LaTeX notes from PDF)');
        console.log('- youtube-notes.md (Markdown notes from YouTube)');
        console.log('- combined-scaffold.tex (Combined document structure)');
        console.log('- refined-intro.tex (Refined introduction section)');

    } catch (error) {
        console.error('Error processing content:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
    }
}

async function writeFile(filename: string, content: string): Promise<void> {
    const outputPath = path.join(process.cwd(), 'output', filename);
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, content);
}

main();