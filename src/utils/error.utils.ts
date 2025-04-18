export class SDKError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SDKError';
    }
}

export class OpenAIError extends SDKError {
    constructor(message: string, public readonly originalError?: Error) {
        super(message);
        this.name = 'OpenAIError';
    }
}

export class ValidationError extends SDKError {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class RateLimitError extends SDKError {
    constructor(message: string) {
        super(message);
        this.name = 'RateLimitError';
    }
}

export class NetworkError extends SDKError {
    constructor(message: string, public readonly originalError?: Error) {
        super(message);
        this.name = 'NetworkError';
    }
}

export class FileProcessingError extends SDKError {
    constructor(message: string, public readonly originalError?: Error) {
        super(message);
        this.name = 'FileProcessingError';
    }
}

export function isSDKError(error: unknown): error is SDKError {
    return error instanceof SDKError;
}

export function handleError(error: unknown): never {
    if (error instanceof OpenAIError) {
        throw error;
    }
    if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
            throw new RateLimitError('Rate limit exceeded. Please try again later.');
        }
        if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
            throw new NetworkError('Network error occurred', error);
        }
        throw new SDKError(error.message);
    }
    throw new SDKError('An unknown error occurred');
}