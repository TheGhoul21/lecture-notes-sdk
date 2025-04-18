export function formatLectureNotes(content: string): string {
    return content.trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
}

export function extractKeyPoints(content: string): string[] {
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./))
        .map(point => point.replace(/^[•\-]\s*/, '').replace(/^\d+\.\s*/, '').trim());
}

export function generateMarkdown(content: string): string {
    const lines = content.split('\n')
        .map(line => line.trim());
    
    let markdown = '';
    let inList = false;

    for (const line of lines) {
        if (!line) {
            continue;
        }

        if (line.startsWith('•') || line.startsWith('-')) {
            if (!inList) {
                markdown += '\n';
                inList = true;
            }
            markdown += `* ${line.replace(/^[•\-]\s*/, '')}\n`;
        } else {
            if (inList) {
                markdown += '\n';
                inList = false;
            }
            markdown += `${line}\n`;
        }
    }

    return markdown.trim();
}