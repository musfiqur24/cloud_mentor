export function getQuizQuestions(resultData) {
  return Array.isArray(resultData?.questions)
    ? resultData.questions
        .map((question) => ({
          ...question,
          options: Array.isArray(question.options) ? question.options : [],
          answerIndex: Number(question.answerIndex)
        }))
        .filter((question) => question.question && question.options.length >= 2 && Number.isInteger(question.answerIndex))
    : [];
}

export function getFlashcards(resultData) {
  return Array.isArray(resultData?.cards)
    ? resultData.cards.filter((card) => card.front && card.back)
    : [];
}

export function getStudyDays(resultData) {
  return Array.isArray(resultData?.days)
    ? resultData.days.filter((day) => day.day && day.title)
    : [];
}

export function parseStructuredResult(result) {
  if (!result || typeof result !== 'string') return null;
  const trimmed = result.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function normalizeDays(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 7;
  return Math.min(Math.max(Math.round(number), 1), 30);
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function guessContentType(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const map = {
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    yaml: 'application/x-yaml',
    yml: 'application/x-yaml',
    log: 'text/plain',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  return map[extension] || 'application/octet-stream';
}

