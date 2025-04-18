import { GoogleGenerativeAI, GenerateContentResult } from '@google/generative-ai';
import { LectureNotes, LectureFormat, ServiceConfig } from '../types/lecture.types';
import {
    SYSTEM_PROMPT_WITH_TRANSCRIPTIONS,
    SYSTEM_PROMPT_WITH_TRANSCRIPTIONS_MARKDOWN,
    SYSTEM_PROMPT_WITH_AUDIO,
    SECTION_REFINEMENT_PROMPT,
    SECTION_REFINEMENT_PROMPT_MARKDOWN,
    DEFINE_SCAFFOLD_WITH_TRANSCRIPT,
    DEFINE_SCAFFOLD_WITH_TRANSCRIPT_MARKDOWN,
    AUGMENT_PDF_LESSON_LATEX_SYNTAX,
    AUGMENT_PDF_LESSON_MARKDOWN_SYNTAX,
    formatPrompt
} from '../prompts';
import { handleError } from '../utils/error.utils';
import * as validate from '../utils/validation.utils';
import { withRetry, throttler } from '../utils/retry.utils';
import { AIService } from './ai.service';

export class GeminiService extends AIService {
    private client: GoogleGenerativeAI;
    private model: any; // Proper type will be added when implementing

    constructor(config: string | ServiceConfig) {
        super(config);
        try {
            validate.validateConfig(config);
            
            this.client = new GoogleGenerativeAI(this.config.apiKey);
            // Initialize with default model or configured model
            this.model = this.client.getGenerativeModel({ 
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

    private async generateWithModel(
        prompt: string,
        systemPrompt?: string,
        temperature?: number
    ): Promise<string> {
        try {
            let content = '';
            let attempts = 0;

            const chat = this.model.startChat({
                history: systemPrompt ? [{
                    role: "user",
                    parts: [{ text: systemPrompt }]
                }] : []
            });

            while (attempts < this.config.maxAttempts) {
                const result = await throttler.add(() => 
                    withRetry(() => 
                        chat.sendMessage(content ? `Continue from: ${content}\n${prompt}` : prompt, {
                            temperature: temperature ?? this.config.temperature
                        })
                    )
                ) as GenerateContentResult;

                const newContent = result.response.text();
                content = content ? content + '\n' + newContent : newContent;

                if (this.isResponseComplete(content)) {
                    break;
                }

                attempts++;
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
            
            const systemPrompt = "You are a professional lecturer and educator. Generate clear, well-structured lecture notes.";
            const prompt = `Generate lecture notes about: ${topic}${context ? `\nContext: ${context}` : ''}`;

            const content = await this.generateWithModel(prompt, systemPrompt);

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

            const systemPrompt = format === 'latex' 
                ? SYSTEM_PROMPT_WITH_TRANSCRIPTIONS 
                : SYSTEM_PROMPT_WITH_TRANSCRIPTIONS_MARKDOWN;

            return this.generateWithModel(transcript, systemPrompt);
        } catch (error) {
            throw handleError(error);
        }
    }

    async generateFromAudio(audioTranscript: string): Promise<string> {
        try {
            validate.validateAudioTranscript(audioTranscript);
            return this.generateWithModel(audioTranscript, SYSTEM_PROMPT_WITH_AUDIO);
        } catch (error) {
            throw handleError(error);
        }
    }

    async refineSection(section: string, transcript: string, format: LectureFormat = 'latex'): Promise<string> {
        try {
            validate.validateSection(section, transcript);
            validate.validateFormat(format);

            const prompt = format === 'latex' ? SECTION_REFINEMENT_PROMPT : SECTION_REFINEMENT_PROMPT_MARKDOWN;
            const formattedPrompt = formatPrompt(prompt, {
                original_transcript: transcript,
                original_document: section
            });

            return this.generateWithModel(section, formattedPrompt);
        } catch (error) {
            throw handleError(error);
        }
    }

    async generateScaffold(transcript: string, format: LectureFormat = 'latex'): Promise<string> {
        try {
            validate.validateTranscript(transcript);
            validate.validateFormat(format);

            const systemPrompt = format === 'latex' 
                ? DEFINE_SCAFFOLD_WITH_TRANSCRIPT 
                : DEFINE_SCAFFOLD_WITH_TRANSCRIPT_MARKDOWN;

            return this.generateWithModel(transcript, systemPrompt);
        } catch (error) {
            throw handleError(error);
        }
    }

    async augmentFromPDF(pdfContent: string, format: LectureFormat = 'latex'): Promise<string> {
        try {
            validate.validatePDFContent(pdfContent);
            validate.validateFormat(format);

            const systemPrompt = format === 'latex' 
                ? AUGMENT_PDF_LESSON_LATEX_SYNTAX 
                : AUGMENT_PDF_LESSON_MARKDOWN_SYNTAX;

            return this.generateWithModel(pdfContent, systemPrompt);
        } catch (error) {
            throw handleError(error);
        }
    }

    async processAudioFile(options: AudioTranscriptionOptions): Promise<string> {
        try {
            validate.validateAudioPath(options.audioPath);
            
            // Note: Direct audio file processing with Gemini is not yet supported
            // For now, we need to use a separate speech-to-text service
            throw new Error('Audio file processing not yet supported with Gemini');
        } catch (error) {
            throw handleError(error);
        }
    }

    async processYouTubeURL(url: string, format: LectureFormat = 'latex'): Promise<LectureNotes> {
        throw new Error('YouTube processing not yet supported with Gemini');
    }
}

interface AudioTranscriptionOptions {
    audioPath: string;
    chunkDuration?: number;
}