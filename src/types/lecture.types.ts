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
}

export interface TranscriptionOptions {
    transcript: string;
    format?: LectureFormat;
    apiKey: string;
}

export interface AudioTranscriptionOptions {
    audioTranscript: string;
    apiKey: string;
}

export interface SectionRefinementOptions {
    section: string;
    transcript: string;
    format?: LectureFormat;
    apiKey: string;
}

export interface PDFAugmentationOptions {
    pdfContent: string;
    format?: LectureFormat;
    apiKey: string;
}