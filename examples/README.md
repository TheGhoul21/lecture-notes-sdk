# Lecture Notes SDK Examples

This directory contains example code demonstrating how to use the Lecture Notes SDK. The examples are organized into basic and advanced use cases.

## Prerequisites

Before running the examples:

1. Install the dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with your OpenAI API key:
```
OPENAI_API_KEY=your-api-key-here
```

## Basic Examples

### 1. Generate Notes (`basic/generate-notes.ts`)
Shows how to generate lecture notes from a topic using the OpenAI service.

```bash
npx ts-node examples/basic/generate-notes.ts
```

### 2. Process Transcript (`basic/process-transcript.ts`)
Demonstrates processing a lecture transcript and generating notes in both LaTeX and Markdown formats.

```bash
npx ts-node examples/basic/process-transcript.ts
```

## Advanced Examples

### 1. Audio Processing (`advanced/process-audio.ts`)
Shows advanced features including:
- Processing audio files
- Generating notes from audio transcripts
- Using text utilities (formatting, key point extraction)
- Converting between formats

```bash
npx ts-node examples/advanced/process-audio.ts
```

### 2. Mixed Content Processing (`advanced/process-mixed-content.ts`)
Demonstrates complex scenarios including:
- Processing PDF lecture content
- Handling YouTube lectures
- Combining multiple sources
- Generating document scaffolds
- Section refinement

```bash
npx ts-node examples/advanced/process-mixed-content.ts
```

## Sample Files

- `basic/sample-transcript.txt`: A sample lecture transcript about neural networks that you can use to test the transcript processing functionality.

## Note About Media Files

To run the advanced examples, you'll need to provide your own:
- Audio files (`.wav`, `.mp3`, `.m4a`, or `.ogg` format)
- PDF files (lecture slides or notes)
- YouTube video URLs

## Error Handling

All examples include proper error handling and will display meaningful error messages if something goes wrong. Common issues might include:
- Missing API key
- Invalid file paths
- Rate limiting
- Network errors

## Additional Resources

For more detailed information about using the SDK, please refer to:
- The main [README.md](../README.md) in the project root
- The [API documentation](../README.md#api-reference)
- The [type definitions](../src/types/lecture.types.ts)