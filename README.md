# Lecture Notes SDK

A TypeScript SDK for generating and managing lecture notes using AI, with support for multiple AI vendors and both LaTeX and Markdown formats.

## Installation

```bash
npm install lecture-notes-sdk
```

## Features

- Generate lecture notes from topics, transcripts, or audio
- Support for multiple AI vendors (OpenAI, Google Gemini)
- Support for both LaTeX and Markdown output formats
- Advanced text processing and formatting utilities
- Section refinement and document scaffolding
- PDF content augmentation
- Comprehensive test coverage
- Full TypeScript support

## Usage

### Choosing an AI Provider

The SDK supports multiple AI providers. You can choose between OpenAI and Google Gemini:

```typescript
import { OpenAIService, GeminiService } from 'lecture-notes-sdk';

// Using OpenAI
const openAI = new OpenAIService('your-openai-api-key');

// Using Google Gemini
const gemini = new GeminiService('your-gemini-api-key');

// You can also pass configuration options
const serviceWithConfig = new OpenAIService({
    apiKey: 'your-api-key',
    model: 'gpt-4',  // or 'gemini-pro' for Gemini
    temperature: 0.4,
    maxTokens: 8192
});
```

### Basic Lecture Notes Generation

```typescript
// Using OpenAI
const openAINotes = await openAI.generateLectureNotes('Introduction to TypeScript');

// Using Gemini
const geminiNotes = await gemini.generateLectureNotes('Introduction to TypeScript');
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
// Note: Currently only supported with OpenAI
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

### Base AIService Class

The abstract base class that all AI service implementations extend.

### OpenAIService and GeminiService

Concrete implementations of AIService for specific vendors:

```typescript
const service = new OpenAIService(apiKeyOrConfig);
const gemini = new GeminiService(apiKeyOrConfig);
```

Where `apiKeyOrConfig` can be either a string API key or a configuration object:

```typescript
interface ServiceConfig {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
    maxAttempts?: number;
    responseValidation?: {
        checkLaTeXBalance?: boolean;
        checkCodeBlocks?: boolean;
        checkJsonBalance?: boolean;
        customIndicators?: string[];
    };
}
```

#### Methods

All services implement these methods:

- `generateLectureNotes(topic: string, context?: string): Promise<LectureNotes>`
- `generateFromTranscript(transcript: string, format?: LectureFormat): Promise<string>`
- `generateFromAudio(audioTranscript: string): Promise<string>`
- `refineSection(section: string, transcript: string, format?: LectureFormat): Promise<string>`
- `generateScaffold(transcript: string, format?: LectureFormat): Promise<string>`
- `augmentFromPDF(pdfContent: string, format?: LectureFormat): Promise<string>`

Note: Some features like audio processing and YouTube video processing are currently only supported by OpenAIService.

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