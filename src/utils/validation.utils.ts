import { ValidationError } from './error.utils';
import { LectureFormat, ServiceConfig } from '../types/lecture.types';

export function validateConfig(config: string | ServiceConfig): void {
    if (typeof config === 'string') {
        if (!config || config.trim().length === 0) {
            throw new ValidationError('API key is required');
        }
        return;
    }

    if (!config.apiKey || config.apiKey.trim().length === 0) {
        throw new ValidationError('API key is required');
    }

    if (config.maxTokens !== undefined && (config.maxTokens < 1 || config.maxTokens > 32768)) {
        throw new ValidationError('maxTokens must be between 1 and 32768');
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
        throw new ValidationError('temperature must be between 0 and 2');
    }

    if (config.maxAttempts !== undefined && config.maxAttempts < 1) {
        throw new ValidationError('maxAttempts must be greater than 0');
    }
}

export function validateFormat(format?: LectureFormat): void {
    if (format && !['latex', 'markdown'].includes(format)) {
        throw new ValidationError('format must be either "latex" or "markdown"');
    }
}

export function validateFilePath(filePath: string): void {
    if (!filePath || filePath.trim().length === 0) {
        throw new ValidationError('filePath is required');
    }
}

export function validateTopic(topic: string): void {
    if (!topic || topic.trim().length === 0) {
        throw new ValidationError('topic is required');
    }
}

export function validateTranscript(transcript: string): void {
    if (!transcript || transcript.trim().length === 0) {
        throw new ValidationError('transcript is required');
    }
}

export function validateSection(section: string, transcript: string): void {
    validateTranscript(transcript);
    if (!section || section.trim().length === 0) {
        throw new ValidationError('section is required');
    }
}

export function validateContent(content: string): void {
    if (!content || content.trim().length === 0) {
        throw new ValidationError('content is required');
    }
}

export function validateAudioPath(audioPath: string): void {
    if (!audioPath || audioPath.trim().length === 0) {
        throw new ValidationError('audioPath is required');
    }
    if (!audioPath.match(/\.(mp3|wav|m4a|ogg)$/i)) {
        throw new ValidationError('audioPath must be an audio file (mp3, wav, m4a, ogg)');
    }
}

export function validateAudioTranscript(transcript: string): void {
    validateContent(transcript);
}

export function validatePDFContent(content: string): void {
    validateContent(content);
}

export function validateYouTubeURL(url: string): void {
    if (!url || url.trim().length === 0) {
        throw new ValidationError('YouTube URL is required');
    }
    if (!/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url)) {
        throw new ValidationError('Invalid YouTube URL format');
    }
}