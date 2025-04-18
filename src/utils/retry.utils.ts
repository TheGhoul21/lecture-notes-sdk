import { RateLimitError, NetworkError } from './error.utils';

interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
};

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let delay = opts.initialDelay;
    let attempt = 0;

    while (true) {
        try {
            return await fn();
        } catch (error) {
            attempt++;
            
            if (attempt >= opts.maxRetries) {
                throw error;
            }

            if (error instanceof RateLimitError || error instanceof NetworkError) {
                await sleep(delay);
                delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
                continue;
            }

            throw error;
        }
    }
}

class RequestThrottler {
    private queue: Array<() => Promise<void>> = [];
    private processing = false;
    private lastRequestTime = 0;
    private readonly minDelay: number;

    constructor(requestsPerSecond: number) {
        this.minDelay = 1000 / requestsPerSecond;
    }

    async add<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await this.executeWithThrottle(fn);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });

            if (!this.processing) {
                this.processQueue();
            }
        });
    }

    private async executeWithThrottle<T>(fn: () => Promise<T>): Promise<T> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minDelay) {
            await sleep(this.minDelay - timeSinceLastRequest);
        }

        this.lastRequestTime = Date.now();
        return fn();
    }

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const task = this.queue.shift();
            if (task) {
                await task();
            }
        }

        this.processing = false;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Export a singleton instance with a reasonable default rate limit
export const throttler = new RequestThrottler(10); // 10 requests per second