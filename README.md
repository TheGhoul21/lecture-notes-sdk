# Lecture Notes SDK

A TypeScript SDK for generating and managing lecture notes using AI, with support for both LaTeX and Markdown formats.

## Installation

```bash
npm install lecture-notes-sdk
```

## Features

- Generate lecture notes from topics, transcripts, or audio
- Support for both LaTeX and Markdown output formats
- Advanced text processing and formatting utilities
- Section refinement and document scaffolding
- PDF content augmentation
- Comprehensive test coverage
- Full TypeScript support

## Usage

### Basic Lecture Notes Generation

```typescript
import { OpenAIService } from 'lecture-notes-sdk';

const openAI = new OpenAIService('your-api-key');

// Generate basic lecture notes
const notes = await openAI.generateLectureNotes('Introduction to TypeScript');
```

### Working with Transcripts

```typescript
// Generate notes from a transcript (LaTeX format)
const latexNotes = await openAI.generateFromTranscript(transcript);

// Generate notes from a transcript (Markdown format)
const markdownNotes = await openAI.generateFromTranscript(transcript, 'markdown');
```

### Audio Transcription Processing

```typescript
// Generate notes from an audio transcript
const notes = await openAI.generateFromAudio(audioTranscript);
```

### Section Refinement

```typescript
// Refine a specific section with additional context
const refinedSection = await openAI.refineSection(section, transcript);

// Refine in Markdown format
const refinedMarkdown = await openAI.refineSection(section, transcript, 'markdown');
```

### Document Scaffolding

```typescript
// Generate document structure from transcript
const scaffold = await openAI.generateScaffold(transcript);

// Generate Markdown scaffold
const mdScaffold = await openAI.generateScaffold(transcript, 'markdown');
```

### PDF Content Augmentation

```typescript
// Augment PDF content with AI-generated insights
const augmentedContent = await openAI.augmentFromPDF(pdfContent);

// Augment to Markdown format
const augmentedMarkdown = await openAI.augmentFromPDF(pdfContent, 'markdown');
```

### Text Utilities

```typescript
import { formatLectureNotes, extractKeyPoints, generateMarkdown } from 'lecture-notes-sdk';

// Clean up text formatting
const formatted = formatLectureNotes(content);

// Extract key bullet points
const keyPoints = extractKeyPoints(content);

// Convert to markdown
const markdown = generateMarkdown(content);
```

## API Reference

### OpenAIService

The main class for interacting with the AI capabilities.

```typescript
const service = new OpenAIService(apiKey: string);
```

#### Methods

- `generateLectureNotes(topic: string, context?: string): Promise<LectureNotes>`
- `generateFromTranscript(transcript: string, format?: LectureFormat): Promise<string>`
- `generateFromAudio(audioTranscript: string): Promise<string>`
- `refineSection(section: string, transcript: string, format?: LectureFormat): Promise<string>`
- `generateScaffold(transcript: string, format?: LectureFormat): Promise<string>`
- `augmentFromPDF(pdfContent: string, format?: LectureFormat): Promise<string>`

### Utility Functions

- `formatLectureNotes(content: string): string` - Cleans and formats lecture notes text
- `extractKeyPoints(content: string): string[]` - Extracts bullet points and numbered lists
- `generateMarkdown(content: string): string` - Converts notes to markdown format

## Types

### LectureFormat
```typescript
type LectureFormat = 'latex' | 'markdown';
```

### LectureNotes
```typescript
interface LectureNotes {
    topic: string;
    content: string;
    timestamp: Date;
    metadata: {
        model: string;
        promptTokens: number;
        completionTokens: number;
    };
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC