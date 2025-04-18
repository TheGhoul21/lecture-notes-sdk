import { formatLectureNotes, extractKeyPoints, generateMarkdown } from '../utils/text.utils';

describe('Text Utils', () => {
    describe('formatLectureNotes', () => {
        it('should clean and format lecture notes text', () => {
            const input = `
                Title
                
                Point 1
                   Point 2   
                
                Point 3
            `;
            
            const expected = 'Title\nPoint 1\nPoint 2\nPoint 3';
            expect(formatLectureNotes(input)).toBe(expected);
        });
    });

    describe('extractKeyPoints', () => {
        it('should extract bullet points', () => {
            const input = `
                Introduction
                • First point
                • Second point
                - Third point
                1. Fourth point
                Conclusion
            `;
            
            expect(extractKeyPoints(input)).toEqual([
                'First point',
                'Second point',
                'Third point',
                'Fourth point'
            ]);
        });
    });

    describe('generateMarkdown', () => {
        it('should convert notes to markdown format', () => {
            const input = `Title
                • First point
                - Second point
                Regular text
                • Third point`;
            
            const expected = 'Title\n\n* First point\n* Second point\n\nRegular text\n\n* Third point';
            expect(generateMarkdown(input)).toBe(expected);
        });
    });
});