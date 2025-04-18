export type LectureFormat = 'latex' | 'markdown';

export interface LectureNotes {
    topic: string;
    content: string;
    timestamp: Date;
    metadata: {
        model: string;
        promptTokens: number;
        completionTokens: number;
    };
}

export interface LectureNotesOptions {
    topic: string;
    context?: string;
    apiKey: string;
    format?: LectureFormat;
    temperature?: number;
}

export interface TranscriptionOptions {
    transcript: string;
    format?: LectureFormat;
    apiKey: string;
    temperature?: number;
}

export interface AudioTranscriptionOptions {
    audioPath: string;
    apiKey: string;
    chunkDuration?: number; // Duration in seconds for splitting audio
}

export interface PDFProcessingOptions {
    pdfPath: string;
    format?: LectureFormat;
    apiKey: string;
    additionalContext?: {
        courseTitle?: string;
        topic?: string;
        level?: string;
        textbook?: string;
    };
}

export interface SectionRefinementOptions {
    section: string;
    transcript: string;
    format?: LectureFormat;
    apiKey: string;
    additionalFiles?: FileData[];
}

export interface FileData {
    fileId: string;
    mimeType: string;
    name: string;
}

export interface MessageContent {
    text?: string;
    files?: FileData[];
}

export interface ModelConfig {
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

export interface ServiceConfig extends ModelConfig {
    apiKey: string;
}