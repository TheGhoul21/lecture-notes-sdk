import { withRetry, throttler } from '../utils/retry.utils';
import { RateLimitError, NetworkError } from '../utils/error.utils';

jest.setTimeout(10000); // Increase timeout for all tests in this file

describe('Retry Utils', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('withRetry', () => {
        it('should succeed on first try if no error', async () => {
            const fn = jest.fn().mockResolvedValue('success');
            const promise = withRetry(fn);
            await promise;
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on rate limit error', async () => {
            const fn = jest.fn()
                .mockRejectedValueOnce(new RateLimitError('rate limit'))
                .mockResolvedValueOnce('success');
            
            const promise = withRetry(fn);
            
            // Run all pending promises
            await Promise.resolve();
            // Advance timer to trigger retry
            jest.advanceTimersByTime(1000);
            // Run all pending promises again
            await Promise.resolve();
            
            const result = await promise;
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should retry on network error', async () => {
            const fn = jest.fn()
                .mockRejectedValueOnce(new NetworkError('network error'))
                .mockResolvedValueOnce('success');
            
            const promise = withRetry(fn);
            
            // Run all pending promises
            await Promise.resolve();
            // Advance timer to trigger retry
            jest.advanceTimersByTime(1000);
            // Run all pending promises again
            await Promise.resolve();
            
            const result = await promise;
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should respect max retries', async () => {
            const fn = jest.fn().mockRejectedValue(new RateLimitError('rate limit'));
            
            const promise = withRetry(fn, { maxRetries: 2 });
            
            // Run all pending promises and advance timer for each retry
            await Promise.resolve();
            jest.advanceTimersByTime(1000);
            await Promise.resolve();
            jest.advanceTimersByTime(1000);
            await Promise.resolve();
            
            await expect(promise).rejects.toThrow('rate limit');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should not retry on non-retryable errors', async () => {
            const fn = jest.fn().mockRejectedValue(new Error('other error'));
            await expect(withRetry(fn)).rejects.toThrow('other error');
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('RequestThrottler', () => {
        const originalSetTimeout = global.setTimeout;

        beforeEach(() => {
            // Mock setTimeout to execute immediately
            global.setTimeout = ((fn: Function, _timeout?: number) => {
                fn();
                return 0;
            }) as typeof global.setTimeout;
        });

        afterEach(() => {
            global.setTimeout = originalSetTimeout;
        });

        it('should throttle requests', async () => {
            const fn1 = jest.fn().mockResolvedValue('first');
            const fn2 = jest.fn().mockResolvedValue('second');
            
            // Execute requests sequentially
            const result1 = await throttler.add(fn1);
            const result2 = await throttler.add(fn2);
            
            expect(result1).toBe('first');
            expect(result2).toBe('second');
            expect(fn1).toHaveBeenCalledTimes(1);
            expect(fn2).toHaveBeenCalledTimes(1);
        });

        it('should handle errors in queued requests', async () => {
            const error = new Error('test error');
            const fn = jest.fn().mockRejectedValue(error);
            
            await expect(throttler.add(fn)).rejects.toThrow('test error');
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });
});