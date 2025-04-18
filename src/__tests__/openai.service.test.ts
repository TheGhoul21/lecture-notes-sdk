// Define mock responses before any imports
const mockBaseResponse = {
    choices: [{ 
        message: { content: 'Test content' },
        finish_reason: 'stop'
    }],
    usage: { prompt_tokens: 100, completion_tokens: 200 }
};

const mockTruncatedResponse = {
    choices: [{ 
        message: { content: 'Truncated content...' },
        finish_reason: 'length'
    }],
    usage: { prompt_tokens: 100, completion_tokens: 200 }
};

const mockContinuationResponse = {
    choices: [{ 
        message: { content: 'Completed content' },
        finish_reason: 'stop'
    }],
    usage: { prompt_tokens: 50, completion_tokens: 100 }
};

const mockIncompleteLatexResponse = {
    choices: [{ 
        message: { content: '\\begin{theorem} Incomplete theorem' },
        finish_reason: 'length'
    }],
    usage: { prompt_tokens: 100, completion_tokens: 200 }
};

const mockLatexCompletionResponse = {
    choices: [{ 
        message: { content: '\\end{theorem}' },
        finish_reason: 'stop'
    }],
    usage: { prompt_tokens: 50, completion_tokens: 100 }
};

const mockComplexResponse = {
    choices: [{ 
        message: { content: '\\begin{theorem}\nSome content\n\\end{theorem}\n```javascript\nconsole.log("test");\n```' },
        finish_reason: 'stop'
    }]
};

const mockIncompleteResponse = {
    choices: [{ 
        message: { content: '\\begin{theorem}\nSome content\n```javascript\nconsole.log("test");' },
        finish_reason: 'length'
    }]
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
    let serviceWithConfig: OpenAIService;

    beforeEach(() => {
        mockCreate.mockClear();
        mockCreate.mockResolvedValue(mockBaseResponse);
        service = new OpenAIService('test-api-key');
        serviceWithConfig = new OpenAIService({
            apiKey: 'test-api-key',
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            maxTokens: 4000,
            maxAttempts: 2,
            responseValidation: {
                checkLaTeXBalance: true,
                checkCodeBlocks: true,
                customIndicators: ['...', '[more]']
            }
        });
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

        it('should handle response with stop finish_reason', async () => {
            const response = {
                choices: [{ 
                    message: { content: 'Complete response.' },
                    finish_reason: 'stop'
                }]
            };
            mockCreate.mockResolvedValueOnce(response);
            const notes = await service.generateLectureNotes('Test Topic');
            expect(notes.content).toBe('Complete response.');
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });

        it('should continue generation on length finish_reason', async () => {
            mockCreate
                .mockResolvedValueOnce({
                    choices: [{ 
                        message: { content: 'Part 1' },
                        finish_reason: 'length'
                    }]
                })
                .mockResolvedValueOnce({
                    choices: [{ 
                        message: { content: 'Part 2' },
                        finish_reason: 'stop'
                    }]
                });

            const notes = await service.generateLectureNotes('Test Topic');
            expect(notes.content).toBe('Part 1\nPart 2');
            expect(mockCreate).toHaveBeenCalledTimes(2);
        });

        it('should handle missing finish_reason by falling back to content validation', async () => {
            // Response without finish_reason (e.g. from a different API implementation)
            const response = {
                choices: [{ 
                    message: { content: 'Complete response with proper ending.' }
                }]
            };
            mockCreate.mockResolvedValueOnce(response);
            const notes = await service.generateLectureNotes('Test Topic');
            expect(notes.content).toBe('Complete response with proper ending.');
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });
    });

    describe('configuration', () => {
        it('should use custom model configuration', async () => {
            mockCreate.mockResolvedValueOnce(mockBaseResponse);
            await serviceWithConfig.generateLectureNotes('Test Topic');
            
            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                model: 'gpt-3.5-turbo',
                temperature: 0.7,
                max_tokens: 4000
            }));
        });

        it('should respect custom truncation indicators', async () => {
            mockCreate
                .mockResolvedValueOnce({ choices: [{ message: { content: 'Content[more]' } }] })
                .mockResolvedValueOnce(mockBaseResponse);

            await serviceWithConfig.generateLectureNotes('Test Topic');
            expect(mockCreate).toHaveBeenCalledTimes(2);
        });
    });

    describe('response validation', () => {
        it('should handle complete responses correctly', async () => {
            mockCreate.mockResolvedValueOnce(mockComplexResponse);
            const notes = await service.generateLectureNotes('Test Topic');
            expect(mockCreate).toHaveBeenCalledTimes(1);
            expect(notes.content).toContain('\\begin{theorem}');
            expect(notes.content).toContain('```javascript');
        });

        it('should detect and fix incomplete LaTeX and code blocks', async () => {
            mockCreate
                .mockResolvedValueOnce(mockIncompleteResponse)
                .mockResolvedValueOnce({ choices: [{ message: { content: '\\end{theorem}\n```' } }] });

            const notes = await service.generateLectureNotes('Test Topic');
            expect(mockCreate).toHaveBeenCalledTimes(2);
            expect(notes.content).toContain('\\begin{theorem}');
            expect(notes.content).toContain('\\end{theorem}');
            expect(notes.content).toContain('```javascript');
            expect(notes.content).toContain('```');
        });

        it('should respect maxAttempts configuration', async () => {
            mockCreate.mockResolvedValue(mockIncompleteResponse);

            await expect(serviceWithConfig.generateLectureNotes('Test Topic'))
                .rejects
                .toThrow('Failed to generate complete response after maximum attempts');
            expect(mockCreate).toHaveBeenCalledTimes(2); // Custom maxAttempts is 2
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