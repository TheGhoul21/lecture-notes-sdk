import { LectureNotes, LectureFormat, ServiceConfig } from '../types/lecture.types';

export abstract class AIService {
    protected config: Required<Omit<ServiceConfig, 'baseUrl'>> & Pick<ServiceConfig, 'baseUrl'>;
    
    constructor(config: string | ServiceConfig) {
        const defaultConfig: Required<Omit<ServiceConfig, 'baseUrl'>> & Pick<ServiceConfig, 'baseUrl'> = {
            model: "default",
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
            },
            apiKey: typeof config === 'string' ? config : config.apiKey
        };

        this.config = typeof config === 'string' 
            ? defaultConfig 
            : { ...defaultConfig, ...config };
    }

    abstract generateLectureNotes(topic: string, context?: string): Promise<LectureNotes>;
    abstract generateFromTranscript(transcript: string, format?: LectureFormat): Promise<string>;
    abstract generateFromAudio(audioTranscript: string): Promise<string>;
    abstract refineSection(section: string, transcript: string, format?: LectureFormat): Promise<string>;
    abstract generateScaffold(transcript: string, format?: LectureFormat): Promise<string>;
    abstract augmentFromPDF(pdfContent: string, format?: LectureFormat): Promise<string>;
    abstract processAudioFile(options: AudioTranscriptionOptions): Promise<string>;
    abstract processYouTubeURL(url: string, format?: LectureFormat): Promise<LectureNotes>;

    protected abstract isResponseComplete(content: string): boolean;
}

interface AudioTranscriptionOptions {
    audioPath: string;
    chunkDuration?: number;
}