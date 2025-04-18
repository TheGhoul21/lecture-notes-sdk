// Define mock responses before any imports
const mockBaseResponse = {
    choices: [{ message: { content: 'Test content' } }],
    usage: { prompt_tokens: 100, completion_tokens: 200 }
};

const mockTruncatedResponse = {
    choices: [{ message: { content: 'Truncated content...' } }],
    usage: { prompt_tokens: 100, completion_tokens: 200 }
};

const mockContinuationResponse = {
    choices: [{ message: { content: 'Completed content' } }],
    usage: { prompt_tokens: 50, completion_tokens: 100 }
};

const mockIncompleteLatexResponse = {
    choices: [{ message: { content: '\\begin{theorem} Incomplete theorem' } }],
    usage: { prompt_tokens: 100, completion_tokens: 200 }
};

const mockLatexCompletionResponse = {
    choices: [{ message: { content: '\\end{theorem}' } }],
    usage: { prompt_tokens: 50, completion_tokens: 100 }
};

// Mock OpenAI class
const mockCreate = jest.fn();
const mockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
        completions: {
            create: mockCreate
        }
    }
}));

// Set up OpenAI mock before imports
jest.mock('openai', () => ({
    OpenAI: mockOpenAI
}));

import { OpenAIService } from '../services/openai.service';
import { LectureFormat } from '../types/lecture.types';

describe('OpenAIService', () => {
    let service: OpenAIService;

    beforeEach(() => {
        mockCreate.mockClear();
        mockCreate.mockResolvedValue(mockBaseResponse);
        service = new OpenAIService('test-api-key');
    });

    describe('generateLectureNotes', () => {
        it('should generate lecture notes', async () => {
            mockCreate.mockResolvedValueOnce(mockBaseResponse);
            const notes = await service.generateLectureNotes('Test Topic');
            expect(notes.topic).toBe('Test Topic');
            expect(notes.content).toBe('Test content');
            expect(notes.metadata.model).toBe('gpt-4');
        });
    });

    describe('generateFromTranscript', () => {
        it('should generate notes from transcript in LaTeX format', async () => {
            mockCreate.mockResolvedValueOnce(mockBaseResponse);
            const content = await service.generateFromTranscript('Test transcript');
            expect(content).toBe('Test content');
        });

        it('should generate notes from transcript in Markdown format', async () => {
            mockCreate.mockResolvedValueOnce(mockBaseResponse);
            const content = await service.generateFromTranscript('Test transcript', 'markdown' as LectureFormat);
            expect(content).toBe('Test content');
        });
    });

    describe('completion handling', () => {
        it('should handle truncated responses', async () => {
            mockCreate
                .mockResolvedValueOnce(mockTruncatedResponse)
                .mockResolvedValueOnce(mockContinuationResponse);

            const notes = await service.generateLectureNotes('Test Topic');
            expect(notes.content).toBe('Truncated content...\nCompleted content');
            expect(mockCreate).toHaveBeenCalledTimes(2);
        });

        it('should detect and complete incomplete LaTeX environments', async () => {
            mockCreate
                .mockResolvedValueOnce(mockIncompleteLatexResponse)
                .mockResolvedValueOnce(mockLatexCompletionResponse);

            const content = await service.generateFromTranscript('Test content', 'latex');
            expect(content).toBe('\\begin{theorem} Incomplete theorem\n\\end{theorem}');
            expect(mockCreate).toHaveBeenCalledTimes(2);
        });

        it('should throw error after max attempts', async () => {
            mockCreate.mockResolvedValue(mockTruncatedResponse);

            await expect(service.generateLectureNotes('Test Topic'))
                .rejects
                .toThrow('Failed to generate complete response after maximum attempts');
            expect(mockCreate).toHaveBeenCalledTimes(3); // MAX_ATTEMPTS
        });
    });

    describe('error handling', () => {
        it('should throw error when OpenAI fails to generate content', async () => {
            mockCreate.mockResolvedValue({ choices: [] });

            await expect(service.generateLectureNotes('Test Topic'))
                .rejects
                .toThrow('Failed to generate lecture notes');
        });
    });
});