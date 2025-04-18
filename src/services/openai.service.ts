import { OpenAI } from 'openai';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { ChatCompletionMessageParam } from 'openai/resources/chat';
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
import { createReadStream } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { handleError, OpenAIError, FileProcessingError } from '../utils/error.utils';
import * as validate from '../utils/validation.utils';
import { withRetry, throttler } from '../utils/retry.utils';
import { AIService } from './ai.service';

export class OpenAIService extends AIService {
    private client: OpenAI;

    constructor(config: string | ServiceConfig) {
        super(config);
        try {
            validate.validateConfig(config);
            
            if (typeof config === 'string') {
                this.client = new OpenAI({ apiKey: config });
            } else {
                this.client = new OpenAI({ 
                    apiKey: config.apiKey,
                    baseURL: config.baseUrl
                });
            }
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

    private async generateWithCompletion(
        messages: ChatCompletionMessageParam[], 
        errorMessage: string, 
        temperature?: number
    ): Promise<string> {
        try {
            let content = '';
            let attempts = 0;

            while (attempts < this.config.maxAttempts) {
                const completion = await throttler.add(() => 
                    withRetry(() => 
                        this.client.chat.completions.create({
                            model: this.config.model,
                            messages,
                            max_tokens: this.config.maxTokens,
                            temperature: temperature ?? this.config.temperature
                        })
                    )
                );

                const choice = completion.choices[0];
                const newContent = choice?.message?.content;
                if (!newContent) {
                    throw new OpenAIError(errorMessage);
                }

                content = content ? content + '\n' + newContent : newContent;

                // Check finish_reason first (works with both OpenAI and Google APIs)
                if (choice.finish_reason === 'stop' && this.isResponseComplete(content)) {
                    break;
                } else if (choice.finish_reason === 'length') {
                    // Response was truncated due to token limit, continue generating
                    messages = [
                        messages[0],
                        {
                            role: "user",
                            content: `Continue from: ${content}`
                        }
                    ];
                    attempts++;
                    continue;
                }

                // If finish_reason is not available or is unexpected, fall back to our custom validation
                if (this.isResponseComplete(content)) {
                    break;
                }

                messages = [
                    messages[0],
                    {
                        role: "user",
                        content: `Continue from: ${content}`
                    }
                ];

                attempts++;
            }

            if (!this.isResponseComplete(content)) {
                throw new OpenAIError('Failed to generate complete response after maximum attempts');
            }

            return content;
        } catch (error) {
            throw handleError(error);
        }
    }

    async generateLectureNotes(topic: string, context?: string): Promise<LectureNotes> {
        try {
            validate.validateTopic(topic);
            
            const messages: ChatCompletionMessageParam[] = [
                {
                    role: "system",
                    content: "You are a professional lecturer and educator. Generate clear, well-structured lecture notes."
                },
                {
                    role: "user",
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

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: transcript
                }
            ];

            return this.generateWithCompletion(messages, 'Failed to generate lecture notes from transcript');
        } catch (error) {
            throw handleError(error);
        }
    }

    async generateFromAudio(audioTranscript: string): Promise<string> {
        try {
            validate.validateAudioTranscript(audioTranscript);

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: "system",
                    content: SYSTEM_PROMPT_WITH_AUDIO
                },
                {
                    role: "user",
                    content: audioTranscript
                }
            ];

            return this.generateWithCompletion(messages, 'Failed to generate lecture notes from audio');
        } catch (error) {
            throw handleError(error);
        }
    }

    async uploadFile(filePath: string, mimeType: string): Promise<FileData> {
        try {
            validate.validateFilePath(filePath);
            
            const fileStream = createReadStream(filePath);
            const file = await withRetry(() => 
                this.client.files.create({
                    file: fileStream,
                    purpose: 'assistants'
                })
            );

            return {
                fileId: file.id,
                mimeType,
                name: path.basename(filePath)
            };
        } catch (error) {
            throw new FileProcessingError(
                `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`, 
                error instanceof Error ? error : undefined
            );
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

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: "system",
                    content: formattedPrompt
                }
            ];

            return this.generateWithCompletion(messages, 'Failed to refine section');
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

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: transcript
                }
            ];

            return this.generateWithCompletion(messages, 'Failed to generate document scaffold');
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

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: pdfContent
                }
            ];

            return this.generateWithCompletion(messages, 'Failed to augment PDF content');
        } catch (error) {
            throw handleError(error);
        }
    }

    async processYouTubeURL(url: string, format: LectureFormat = 'latex'): Promise<LectureNotes> {
        try {
            validate.validateYouTubeURL(url);

            const videoId = this.extractYoutubeVideoId(url);
            if (!videoId) {
                throw new Error('Could not extract video ID from URL');
            }

            const tempDir = await fs.mkdtemp('youtube-');
            const videoPath = path.join(tempDir, `${videoId}.mp4`);
            const audioPath = path.join(tempDir, `${videoId}.wav`);

            try {
                await this.downloadYoutubeVideo(url, videoPath);
                
                await new Promise((resolve, reject) => {
                    exec(
                        `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "${audioPath}"`,
                        (error) => {
                            if (error) reject(error);
                            else resolve(null);
                        }
                    );
                });

                const transcription = await this.processAudioFile({ audioPath });
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
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        } catch (error) {
            throw handleError(error);
        }
    }

    private extractYoutubeVideoId(url: string): string | null {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    private async downloadYoutubeVideo(url: string, outputPath: string): Promise<void> {
        throw new Error('YouTube download implementation required');
    }

    async processAudioFile(options: AudioTranscriptionOptions): Promise<string> {
        try {
            validate.validateAudioPath(options.audioPath);

            const chunkDir = await this.splitAudioIntoChunks(options.audioPath, options.chunkDuration);
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
                    0
                );
                transcriptions.push(transcription);

                await fs.unlink(chunkPath);
            }

            await fs.rmdir(chunkDir);
            return transcriptions.join(' ');
        } catch (error) {
            throw handleError(error);
        }
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

interface FileData {
    fileId: string;
    mimeType: string;
    name: string;
}

interface AudioTranscriptionOptions {
    audioPath: string;
    chunkDuration?: number;
}

interface MessageContent {
    text?: string;
    files?: FileData[];
}