import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';
import { LectureNotes, LectureFormat } from '../types/lecture.types';
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

export class OpenAIService {
    private client: OpenAI;
    private readonly MAX_TOKENS = 4000;
    private readonly TRUNCATION_INDICATORS = [
        '...',
        '[continued]',
        '[truncated]',
        'To be continued',
        'Continued in next part'
    ];

    constructor(apiKey: string) {
        this.client = new OpenAI({ apiKey });
    }

    private isResponseComplete(content: string): boolean {
        // Check for common truncation indicators
        if (this.TRUNCATION_INDICATORS.some(indicator => content.trim().endsWith(indicator))) {
            return false;
        }

        // Check for incomplete LaTeX environments
        const beginCount = (content.match(/\\begin\{/g) || []).length;
        const endCount = (content.match(/\\end\{/g) || []).length;
        if (beginCount !== endCount) {
            return false;
        }

        // Check for incomplete code blocks
        const codeBlockStarts = (content.match(/```/g) || []).length;
        if (codeBlockStarts % 2 !== 0) {
            return false;
        }

        return true;
    }

    private async continueGeneration(previousContent: string, systemPrompt: string): Promise<string> {
        const completion = await this.client.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: `Continue from: ${previousContent}`
                }
            ],
            max_tokens: this.MAX_TOKENS
        });

        const continuedContent = completion.choices[0]?.message?.content;
        if (!continuedContent) {
            throw new Error('Failed to continue generation');
        }

        return previousContent + '\n' + continuedContent;
    }

    private async generateWithCompletion(messages: ChatCompletionMessageParam[], errorMessage: string): Promise<string> {
        let content = '';
        let attempts = 0;
        const MAX_ATTEMPTS = 3;

        while (attempts < MAX_ATTEMPTS) {
            const completion = await this.client.chat.completions.create({
                model: "gpt-4",
                messages: messages as any[], // Type assertion needed due to OpenAI types
                max_tokens: this.MAX_TOKENS
            });

            const newContent = completion.choices[0]?.message?.content;
            if (!newContent) {
                throw new Error(errorMessage);
            }

            content = content ? content + '\n' + newContent : newContent;

            if (this.isResponseComplete(content)) {
                break;
            }

            messages = [
                messages[0], // Keep the system message
                {
                    role: "user" as const,
                    content: `Continue from: ${content}`
                }
            ];

            attempts++;
        }

        if (!this.isResponseComplete(content)) {
            throw new Error('Failed to generate complete response after maximum attempts');
        }

        return content;
    }

    async generateLectureNotes(topic: string, context?: string): Promise<LectureNotes> {
        const messages: ChatCompletionMessageParam[] = [
            {
                role: "system" as const,
                content: "You are a professional lecturer and educator. Generate clear, well-structured lecture notes."
            },
            {
                role: "user" as const,
                content: `Generate lecture notes about: ${topic}${context ? `\nContext: ${context}` : ''}`
            }
        ];

        const content = await this.generateWithCompletion(messages, 'Failed to generate lecture notes');

        return {
            topic,
            content,
            timestamp: new Date(),
            metadata: {
                model: "gpt-4",
                promptTokens: 0,
                completionTokens: 0
            }
        };
    }

    async generateFromTranscript(transcript: string, format: LectureFormat = 'latex'): Promise<string> {
        const systemPrompt = format === 'latex' 
            ? SYSTEM_PROMPT_WITH_TRANSCRIPTIONS 
            : SYSTEM_PROMPT_WITH_TRANSCRIPTIONS_MARKDOWN;

        const messages: ChatCompletionMessageParam[] = [
            {
                role: "system" as const,
                content: systemPrompt
            },
            {
                role: "user" as const,
                content: transcript
            }
        ];

        return this.generateWithCompletion(messages, 'Failed to generate lecture notes from transcript');
    }

    async generateFromAudio(audioTranscript: string): Promise<string> {
        const messages: ChatCompletionMessageParam[] = [
            {
                role: "system" as const,
                content: SYSTEM_PROMPT_WITH_AUDIO
            },
            {
                role: "user" as const,
                content: audioTranscript
            }
        ];

        return this.generateWithCompletion(messages, 'Failed to generate lecture notes from audio');
    }

    async refineSection(section: string, transcript: string, format: LectureFormat = 'latex'): Promise<string> {
        const prompt = format === 'latex' ? SECTION_REFINEMENT_PROMPT : SECTION_REFINEMENT_PROMPT_MARKDOWN;
        const formattedPrompt = formatPrompt(prompt, {
            original_transcript: transcript,
            original_document: section
        });

        const messages: ChatCompletionMessageParam[] = [
            {
                role: "system" as const,
                content: formattedPrompt
            }
        ];

        return this.generateWithCompletion(messages, 'Failed to refine section');
    }

    async generateScaffold(transcript: string, format: LectureFormat = 'latex'): Promise<string> {
        const systemPrompt = format === 'latex' 
            ? DEFINE_SCAFFOLD_WITH_TRANSCRIPT 
            : DEFINE_SCAFFOLD_WITH_TRANSCRIPT_MARKDOWN;

        const messages: ChatCompletionMessageParam[] = [
            {
                role: "system" as const,
                content: systemPrompt
            },
            {
                role: "user" as const,
                content: transcript
            }
        ];

        return this.generateWithCompletion(messages, 'Failed to generate document scaffold');
    }

    async augmentFromPDF(pdfContent: string, format: LectureFormat = 'latex'): Promise<string> {
        const systemPrompt = format === 'latex' 
            ? AUGMENT_PDF_LESSON_LATEX_SYNTAX 
            : AUGMENT_PDF_LESSON_MARKDOWN_SYNTAX;

        const messages: ChatCompletionMessageParam[] = [
            {
                role: "system" as const,
                content: systemPrompt
            },
            {
                role: "user" as const,
                content: pdfContent
            }
        ];

        return this.generateWithCompletion(messages, 'Failed to augment PDF content');
    }
}