import { OpenAI } from 'openai';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { ChatCompletionMessageParam, ChatCompletionContentPart, ChatCompletionContentPartText } from 'openai/resources/chat';
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
import { createReadStream } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promises as fs } from 'fs';

export class OpenAIService {
    private client: OpenAI;
    private readonly config: Required<Omit<ModelConfig, 'baseUrl'>> & Pick<ModelConfig, 'baseUrl'>;

    constructor(config: string | ServiceConfig) {
        const defaultConfig: Required<Omit<ModelConfig, 'baseUrl'>> & Pick<ModelConfig, 'baseUrl'> = {
            model: "gpt-4",
            temperature: 0.4,
            maxTokens: 8192,
            baseUrl: undefined,
            maxAttempts: 3,
            responseValidation: {
                checkLaTeXBalance: true,
                checkCodeBlocks: true,
                checkJsonBalance: true,
                customIndicators: [
                    '...',
                    '[continued]',
                    '[truncated]',
                    'To be continued',
                    'Continued in next part'
                ]
            }
        };

        if (typeof config === 'string') {
            this.client = new OpenAI({ apiKey: config });
            this.config = defaultConfig;
        } else {
            this.client = new OpenAI({ 
                apiKey: config.apiKey,
                baseURL: config.baseUrl
            });
            this.config = {
                ...defaultConfig,
                ...config,
                responseValidation: {
                    ...defaultConfig.responseValidation,
                    ...config.responseValidation
                }
            };
        }
    }

    private isResponseComplete(content: string): boolean {
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

        // Check for incomplete JSON
        if (validation.checkJsonBalance) {
            const openBraces = (content.match(/[\[{]/g) || []).length;
            const closeBraces = (content.match(/[\]}]/g) || []).length;
            if (openBraces !== closeBraces) {
                return false;
            }
        }

        return true;
    }

    private async generateWithCompletion(messages: ChatCompletionMessageParam[], errorMessage: string, temperature?: number): Promise<string> {
        let content = '';
        let attempts = 0;

        while (attempts < this.config.maxAttempts) {
            const completion = await this.client.chat.completions.create({
                model: this.config.model,
                messages: messages as any[],
                max_tokens: this.config.maxTokens,
                temperature: temperature ?? this.config.temperature
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
                messages[0],
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
                model: this.config.model,
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

    async refineSectionWithFiles(options: SectionRefinementOptions): Promise<string> {
        const { section, transcript, format = 'latex', additionalFiles = [] } = options;
        const prompt = format === 'latex' ? SECTION_REFINEMENT_PROMPT : SECTION_REFINEMENT_PROMPT_MARKDOWN;
        const formattedPrompt = formatPrompt(prompt, {
            original_transcript: transcript,
            original_document: section
        });

        const messages: ChatCompletionMessageParam[] = [
            {
                role: "system",
                content: formattedPrompt
            },
            {
                role: "user",
                content: {
                    type: 'text',
                    text: section,
                    files: additionalFiles.map(file => ({
                        type: 'file_data',
                        file_data: {
                            file_id: file.fileId,
                            mime_type: file.mimeType
                        }
                    }))
                }
            }
        ];

        return this.generateWithCompletion(
            messages,
            'Failed to refine section with additional files',
            this.config.temperature
        );
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

    async processYouTubeURL(url: string, format: LectureFormat = 'latex'): Promise<LectureNotes> {
        if (!this.isYoutubeUrl(url)) {
            throw new Error('Invalid YouTube URL');
        }

        // Download video and extract audio
        const videoId = this.extractYoutubeVideoId(url);
        if (!videoId) {
            throw new Error('Could not extract video ID from URL');
        }

        const tempDir = await fs.mkdtemp('youtube-');
        const videoPath = path.join(tempDir, `${videoId}.mp4`);
        const audioPath = path.join(tempDir, `${videoId}.wav`);

        try {
            // Download video (implementation depends on your preferred method)
            await this.downloadYoutubeVideo(url, videoPath);
            
            // Extract audio using ffmpeg
            await new Promise((resolve, reject) => {
                exec(
                    `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "${audioPath}"`,
                    (error) => {
                        if (error) reject(error);
                        else resolve(null);
                    }
                );
            });

            // Process the audio file
            const transcription = await this.processAudioFile({ audioPath });
            
            // Generate lecture notes from transcription
            const content = await this.generateFromTranscript(transcription, format);

            return {
                topic: `YouTube lecture: ${videoId}`,
                content,
                timestamp: new Date(),
                metadata: {
                    model: this.config.model,
                    promptTokens: 0,
                    completionTokens: 0
                }
            };
        } finally {
            // Clean up temporary files
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    }

    private isYoutubeUrl(url: string): boolean {
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url);
    }

    private extractYoutubeVideoId(url: string): string | null {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    private async downloadYoutubeVideo(url: string, outputPath: string): Promise<void> {
        // This would be implemented using your preferred YouTube download method
        // Could use youtube-dl, ytdl-core, or similar libraries
        throw new Error('YouTube download implementation required');
    }

    async startChat(systemPrompt: string, temperature: number = this.config.temperature): Promise<ChatSession> {
        return new ChatSession(
            this.client,
            systemPrompt,
            {
                ...this.config,
                baseUrl: this.config.baseUrl || ""
            },
            this.formatMessageContent.bind(this)
        );
    }

    async uploadFile(filePath: string, mimeType: string): Promise<FileData> {
        const file = await this.client.files.create({
            file: await createReadStream(filePath),
            purpose: 'assistants'
        });

        return {
            fileId: file.id,
            mimeType,
            name: path.basename(filePath)
        };
    }

    private async splitAudioIntoChunks(audioPath: string, chunkDuration: number = 3600): Promise<string> {
        const outputDir = path.join(path.dirname(audioPath), 'chunks');
        await fs.mkdir(outputDir, { recursive: true });

        return new Promise((resolve, reject) => {
            exec(
                `ffmpeg -i "${audioPath}" -f segment -segment_time ${chunkDuration} -c copy "${outputDir}/chunk_%03d.wav"`,
                (error, stdout, stderr) => {
                    if (error) {
                        reject(`Error splitting audio: ${stderr}`);
                    } else {
                        resolve(outputDir);
                    }
                }
            );
        });
    }

    async processAudioFile(options: AudioTranscriptionOptions): Promise<string> {
        const { audioPath, chunkDuration = 3600 } = options;
        const chunkDir = await this.splitAudioIntoChunks(audioPath, chunkDuration);
        const chunkFiles = await fs.readdir(chunkDir);
        const transcriptions: string[] = [];

        for (const chunkFile of chunkFiles) {
            const chunkPath = path.join(chunkDir, chunkFile);
            const fileData = await this.uploadFile(chunkPath, 'audio/wav');
            
            const content = this.formatMessageContent({
                text: "Please transcribe this audio file:",
                files: [fileData]
            });

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: "system",
                    content: "You are an expert lecture transcriber. Transform this audio into clear, complete sentences."
                },
                {
                    role: "user",
                    content
                }
            ];

            const transcription = await this.generateWithCompletion(
                messages,
                'Failed to transcribe audio chunk',
                0  // Use temperature 0 for transcription
            );
            transcriptions.push(transcription);

            await fs.unlink(chunkPath);
        }

        await fs.rmdir(chunkDir);
        return transcriptions.join(' ');
    }

    async processPDFWithContext(options: PDFProcessingOptions): Promise<string> {
        const { pdfPath, format = 'latex', additionalContext } = options;
        const fileData = await this.uploadFile(pdfPath, 'application/pdf');

        const contextString = additionalContext ? 
            `Course: ${additionalContext.courseTitle || 'N/A'}
            Topic: ${additionalContext.topic || 'N/A'}
            Level: ${additionalContext.level || 'N/A'}
            Textbook: ${additionalContext.textbook || 'N/A'}` : '';

        const content = this.formatMessageContent({
            text: "Process this PDF document:",
            files: [fileData]
        });

        const messages: ChatCompletionMessageParam[] = [
            {
                role: "system",
                content: format === 'latex' 
                    ? AUGMENT_PDF_LESSON_LATEX_SYNTAX 
                    : AUGMENT_PDF_LESSON_MARKDOWN_SYNTAX
            },
            {
                role: "user",
                content
            }
        ];

        if (contextString) {
            messages.push({
                role: "user",
                content: `Additional Context:\n${contextString}`
            });
        }

        return this.generateWithCompletion(
            messages,
            'Failed to process PDF content',
            this.config.temperature
        );
    }

    private formatMessageContent(content: string | MessageContent): string {
        if (typeof content === 'string') {
            return content;
        }

        let messageContent = '';
        if (content.text) {
            messageContent += content.text;
        }
        
        if (content.files) {
            const fileDescriptions = content.files.map(file => 
                `[File: ${file.name} (${file.mimeType})]`
            ).join('\n');
            messageContent += '\n' + fileDescriptions;
        }
        
        return messageContent;
    }
}

class ChatSession {
    private history: ChatCompletionMessageParam[] = [];

    constructor(
        private client: OpenAI,
        private systemPrompt: string,
        private config: Required<Omit<ModelConfig, 'baseUrl'>> & Pick<ModelConfig, 'baseUrl'>,
        private formatMessageContent: (content: string | MessageContent) => string
    ) {
        this.history.push({
            role: 'system',
            content: systemPrompt
        });
    }

    async sendMessage(content: string | MessageContent): Promise<string> {
        const messageContent = this.formatMessageContent(content);

        this.history.push({
            role: 'user',
            content: messageContent
        });

        const completion = await this.client.chat.completions.create({
            model: this.config.model,
            messages: this.history,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
        });

        const response = completion.choices[0]?.message?.content;
        if (!response) {
            throw new Error('Failed to get response from chat completion');
        }

        this.history.push({
            role: 'assistant',
            content: response
        });

        return response;
    }

    getHistory(): readonly ChatCompletionMessageParam[] {
        return [...this.history];
    }
}

interface FileData {
    fileId: string;
    mimeType: string;
    name: string;
}

interface MessageContent {
    text?: string;
    files?: FileData[];
}

interface AudioTranscriptionOptions {
    audioPath: string;
    chunkDuration?: number;
}

interface PDFProcessingOptions {
    pdfPath: string;
    format?: LectureFormat;
    additionalContext?: {
        courseTitle?: string;
        topic?: string;
        level?: string;
        textbook?: string;
    };
}

interface SectionRefinementOptions {
    section: string;
    transcript: string;
    format?: LectureFormat;
    additionalFiles?: FileData[];
}

interface ModelConfig {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
    maxAttempts?: number;
    responseValidation?: {
        checkLaTeXBalance?: boolean;
        checkCodeBlocks?: boolean;
        checkJsonBalance?: boolean;
        customIndicators?: string[];
    };
}

interface ServiceConfig extends ModelConfig {
    apiKey: string;
}

type ContentType = string | ChatCompletionContentPart[];