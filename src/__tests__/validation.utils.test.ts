import * as validate from '../utils/validation.utils';
import { ValidationError } from '../utils/error.utils';
import { ServiceConfig } from '../types/lecture.types';

describe('Validation Utils', () => {
    describe('validateConfig', () => {
        it('should validate string API key', () => {
            expect(() => validate.validateConfig('valid-key')).not.toThrow();
            expect(() => validate.validateConfig('')).toThrow(ValidationError);
            expect(() => validate.validateConfig('  ')).toThrow(ValidationError);
        });

        it('should validate ServiceConfig object', () => {
            const validConfig: ServiceConfig = {
                apiKey: 'valid-key',
                maxTokens: 1000,
                temperature: 0.5,
                maxAttempts: 3
            };
            expect(() => validate.validateConfig(validConfig)).not.toThrow();

            expect(() => validate.validateConfig({ ...validConfig, apiKey: '' }))
                .toThrow(ValidationError);
            expect(() => validate.validateConfig({ ...validConfig, maxTokens: 0 }))
                .toThrow(ValidationError);
            expect(() => validate.validateConfig({ ...validConfig, maxTokens: 33000 }))
                .toThrow(ValidationError);
            expect(() => validate.validateConfig({ ...validConfig, temperature: -0.1 }))
                .toThrow(ValidationError);
            expect(() => validate.validateConfig({ ...validConfig, temperature: 2.1 }))
                .toThrow(ValidationError);
            expect(() => validate.validateConfig({ ...validConfig, maxAttempts: 0 }))
                .toThrow(ValidationError);
        });
    });

    describe('validateFormat', () => {
        it('should validate lecture format', () => {
            expect(() => validate.validateFormat('latex')).not.toThrow();
            expect(() => validate.validateFormat('markdown')).not.toThrow();
            expect(() => validate.validateFormat(undefined)).not.toThrow();
            expect(() => validate.validateFormat('invalid' as any)).toThrow(ValidationError);
        });
    });

    describe('validateFilePath', () => {
        it('should validate file paths', () => {
            expect(() => validate.validateFilePath('/path/to/file.txt')).not.toThrow();
            expect(() => validate.validateFilePath('')).toThrow(ValidationError);
            expect(() => validate.validateFilePath('  ')).toThrow(ValidationError);
        });
    });

    describe('validateTopic', () => {
        it('should validate topics', () => {
            expect(() => validate.validateTopic('Valid Topic')).not.toThrow();
            expect(() => validate.validateTopic('')).toThrow(ValidationError);
            expect(() => validate.validateTopic('  ')).toThrow(ValidationError);
        });
    });

    describe('validateTranscript', () => {
        it('should validate transcripts', () => {
            expect(() => validate.validateTranscript('Valid transcript')).not.toThrow();
            expect(() => validate.validateTranscript('')).toThrow(ValidationError);
            expect(() => validate.validateTranscript('  ')).toThrow(ValidationError);
        });
    });

    describe('validateSection', () => {
        it('should validate sections with transcripts', () => {
            expect(() => validate.validateSection('Valid section', 'Valid transcript')).not.toThrow();
            expect(() => validate.validateSection('', 'Valid transcript')).toThrow(ValidationError);
            expect(() => validate.validateSection('Valid section', '')).toThrow(ValidationError);
        });
    });

    describe('validateAudioPath', () => {
        it('should validate audio file paths', () => {
            expect(() => validate.validateAudioPath('/path/to/file.mp3')).not.toThrow();
            expect(() => validate.validateAudioPath('/path/to/file.wav')).not.toThrow();
            expect(() => validate.validateAudioPath('/path/to/file.m4a')).not.toThrow();
            expect(() => validate.validateAudioPath('/path/to/file.ogg')).not.toThrow();
            expect(() => validate.validateAudioPath('')).toThrow(ValidationError);
            expect(() => validate.validateAudioPath('/path/to/file.txt')).toThrow(ValidationError);
        });
    });
});