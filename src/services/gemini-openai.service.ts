import { GoogleGenerativeAI, GenerateContentResult } from '@google/generative-ai';
import { LectureNotes, LectureFormat, ServiceConfig } from '../types/lecture.types';
import { handleError } from '../utils/error.utils';
import * as validate from '../utils/validation.utils';
import { withRetry, throttler } from '../utils/retry.utils';
import { AIService } from './ai.service';

export class GeminiOpenAIService extends AIService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(config: string | ServiceConfig) {
        super(config);
        try {
            validate.validateConfig(config);
            
            this.genAI = new GoogleGenerativeAI(this.config.apiKey);
            this.model = this.genAI.getGenerativeModel({ 
                model: this.config.model || "gemini-pro"
            });
        } catch (error) {
            throw handleError(error);
        }
    }

    protected isResponseComplete(content: string): boolean {
        const validation = this.config.responseValidation;
        
        // Check for truncation indicators
        if (validation.customIndicators?.some(indicator => 
            content.trim().endsWith(indicator))) {
            return false;
        }

        // Check for incomplete LaTeX environments
        if (validation.checkLaTeXBalance) {
            const beginCount = (content.match(/\\begin\{/g) || []).length;
            const endCount = (content.match(/\\end\{/g) || []).length;
            if (beginCount !== endCount) {
                return false;
            }
        }

        // Check for incomplete code blocks
        if (validation.checkCodeBlocks) {
            const codeBlockStarts = (content.match(/```/g) || []).length;
            if (codeBlockStarts % 2 !== 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * OpenAI API compatibility layer
     */
    async createChatCompletion(params: {
        model: string;
        messages: Array<{
            role: string;
            content: string;
        }>;
        temperature?: number;
        max_tokens?: number;
    }) {
        try {
            const chat = this.model.startChat();
            const history = params.messages.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : msg.role,
                parts: [{ text: msg.content }]
            }));

            // Add all messages except the last one to chat history
            for (let i = 0; i < history.length - 1; i++) {
                await chat.sendMessage(history[i].parts[0].text);
            }

            // Send the last message and get response
            const result = await chat.sendMessage(
                history[history.length - 1].parts[0].text, 
                { 
                    temperature: params.temperature ?? this.config.temperature,
                    maxOutputTokens: params.max_tokens ?? this.config.maxTokens,
                }
            ) as GenerateContentResult;

            // Convert to OpenAI format
            return {
                choices: [{
                    message: {
                        role: 'assistant',
                        content: result.response.text()
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 0, // Not provided by Gemini
                    completion_tokens: 0,
                    total_tokens: 0
                }
            };
        } catch (error) {
            throw handleError(error);
        }
    }

    private async generateWithModel(
        messages: Array<{ role: string; content: string }>,
        errorMessage: string,
        temperature?: number
    ): Promise<string> {
        try {
            let content = '';
            let attempts = 0;

            while (attempts < this.config.maxAttempts) {
                // Use OpenAI compatibility layer
                const completion = await throttler.add(() => 
                    withRetry(() => 
                        this.createChatCompletion({
                            model: this.config.model,
                            messages: content ? [
                                messages[0],
                                { role: 'user', content: `Continue from: ${content}` }
                            ] : messages,
                            temperature: temperature ?? this.config.temperature,
                            max_tokens: this.config.maxTokens
                        })
                    )
                );

                const choice = completion.choices[0];
                const newContent = choice?.message?.content;
                if (!newContent) {
                    throw new Error(errorMessage);
                }

                content = content ? content + '\n' + newContent : newContent;

                if (choice.finish_reason === 'stop' && this.isResponseComplete(content)) {
                    break;
                }

                if (!this.isResponseComplete(content)) {
                    attempts++;
                    continue;
                }

                break;
            }

            if (!this.isResponseComplete(content)) {
                throw new Error('Failed to generate complete response after maximum attempts');
            }

            return content;
        } catch (error) {
            throw handleError(error);
        }
    }

    async generateLectureNotes(topic: string, context?: string): Promise<LectureNotes> {
        try {
            validate.validateTopic(topic);
            
            const messages = [
                {
                    role: "system",
                    content: "You are a professional lecturer and educator. Generate clear, well-structured lecture notes."
                },
                {
                    role: "user",
                    content: `Generate lecture notes about: ${topic}${context ? `\nContext: ${context}` : ''}`
                }
            ];

            const content = await this.generateWithModel(messages, 'Failed to generate lecture notes');

            return {
                topic,
                content,
                timestamp: new Date(),
                metadata: {
                    model: this.config.model,
                    promptTokens: 0,
                    completionTokens: 0
                }
            };
        } catch (error) {
            throw handleError(error);
        }
    }

    async generateFromTranscript(transcript: string, format: LectureFormat = 'latex'): Promise<string> {
        try {
            validate.validateTranscript(transcript);
            validate.validateFormat(format);

            const messages = [
                {
                    role: "system",
                    content: "Convert this transcript into " + (format === 'latex' ? 'LaTeX' : 'Markdown') + " format."
                },
                {
                    role: "user",
                    content: transcript
                }
            ];

            return this.generateWithModel(messages, 'Failed to generate from transcript');
        } catch (error) {
            throw handleError(error);
        }
    }

    async generateFromAudio(audioTranscript: string): Promise<string> {
        try {
            validate.validateAudioTranscript(audioTranscript);

            const messages = [
                {
                    role: "system",
                    content: "Transform this audio transcript into clear, complete lecture notes."
                },
                {
                    role: "user",
                    content: audioTranscript
                }
            ];

            return this.generateWithModel(messages, 'Failed to generate from audio');
        } catch (error) {
            throw handleError(error);
        }
    }

    async refineSection(section: string, transcript: string, format: LectureFormat = 'latex'): Promise<string> {
        try {
            validate.validateSection(section, transcript);
            validate.validateFormat(format);

            const messages = [
                {
                    role: "system",
                    content: "Refine and improve this section using the provided transcript."
                },
                {
                    role: "user",
                    content: `Section: ${section}\n\nTranscript: ${transcript}`
                }
            ];

            return this.generateWithModel(messages, 'Failed to refine section');
        } catch (error) {
            throw handleError(error);
        }
    }

    async generateScaffold(transcript: string, format: LectureFormat = 'latex'): Promise<string> {
        try {
            validate.validateTranscript(transcript);
            validate.validateFormat(format);

            const messages = [
                {
                    role: "system",
                    content: "Generate a document scaffold in " + (format === 'latex' ? 'LaTeX' : 'Markdown') + " format based on this transcript."
                },
                {
                    role: "user",
                    content: transcript
                }
            ];

            return this.generateWithModel(messages, 'Failed to generate scaffold');
        } catch (error) {
            throw handleError(error);
        }
    }

    async augmentFromPDF(pdfContent: string, format: LectureFormat = 'latex'): Promise<string> {
        try {
            validate.validatePDFContent(pdfContent);
            validate.validateFormat(format);

            const messages = [
                {
                    role: "system",
                    content: "Transform this PDF content into a complete " + (format === 'latex' ? 'LaTeX' : 'Markdown') + " document."
                },
                {
                    role: "user",
                    content: pdfContent
                }
            ];

            return this.generateWithModel(messages, 'Failed to augment PDF');
        } catch (error) {
            throw handleError(error);
        }
    }

    async processAudioFile(options: AudioTranscriptionOptions): Promise<string> {
        throw new Error('Audio file processing not yet supported with Gemini');
    }

    async processYouTubeURL(url: string, format: LectureFormat = 'latex'): Promise<LectureNotes> {
        throw new Error('YouTube processing not yet supported with Gemini');
    }
}

interface AudioTranscriptionOptions {
    audioPath: string;
    chunkDuration?: number;
}