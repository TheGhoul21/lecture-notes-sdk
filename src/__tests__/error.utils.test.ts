import { SDKError, OpenAIError, ValidationError, RateLimitError, NetworkError, FileProcessingError, handleError } from '../utils/error.utils';

describe('Error Utils', () => {
    describe('handleError', () => {
        it('should pass through OpenAIError', () => {
            const error = new OpenAIError('test error');
            expect(() => handleError(error)).toThrow(OpenAIError);
            expect(() => handleError(error)).toThrow('test error');
        });

        it('should convert rate limit errors', () => {
            const error = new Error('rate limit exceeded');
            expect(() => handleError(error)).toThrow(RateLimitError);
            expect(() => handleError(error)).toThrow('Rate limit exceeded. Please try again later.');
        });

        it('should convert network errors', () => {
            const error = new Error('network error');
            expect(() => handleError(error)).toThrow(NetworkError);
            expect(() => handleError(error)).toThrow('Network error occurred');
        });

        it('should wrap unknown errors in SDKError', () => {
            const error = new Error('unknown error');
            expect(() => handleError(error)).toThrow(SDKError);
            expect(() => handleError(error)).toThrow('unknown error');
        });

        it('should handle non-Error objects', () => {
            expect(() => handleError('string error')).toThrow(SDKError);
            expect(() => handleError('string error')).toThrow('An unknown error occurred');
        });
    });
});