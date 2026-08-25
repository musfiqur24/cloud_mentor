import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { sampleNotes, taskMap } from '../constants/tasks.js';
import {
  getQuizQuestions,
  guessContentType,
  normalizeDays,
  parseStructuredResult
} from '../utils/learning.js';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function useCloudMentor() {
  const [task, setTask] = useState('summarize');
  const [notes, setNotes] = useState(sampleNotes);
  const [level, setLevel] = useState('beginner');
  const [days, setDays] = useState(7);
  const [examDate, setExamDate] = useState('');
  const [result, setResult] = useState('');
  const [resultData, setResultData] = useState(null);
  const [resultTitle, setResultTitle] = useState('Your learning output will appear here');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('Checking');
  const [storageMode, setStorageMode] = useState('Unknown');
  const [aiMode, setAiMode] = useState('Unknown');
  const [error, setError] = useState('');
  const [progressTopic, setProgressTopic] = useState('DevOps Fundamentals');
  const [progressScore, setProgressScore] = useState(80);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState('No file uploaded yet.');
  const [quizAnswers, setQuizAnswers] = useState({});
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  const selectedTask = taskMap[task];

  const wordCount = useMemo(() => (
    notes.trim() ? notes.trim().split(/\s+/).length : 0
  ), [notes]);

  const quizScore = useMemo(() => {
    const questions = getQuizQuestions(resultData);
    const answered = questions.filter((_, index) => quizAnswers[index] !== undefined).length;
    const correct = questions.filter((question, index) => quizAnswers[index] === question.answerIndex).length;
    return { answered, correct, total: questions.length };
  }, [quizAnswers, resultData]);

  useEffect(() => {
    void checkHealth();
    void loadHistory();
  }, []);

  useEffect(() => {
    setQuizAnswers({});
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    setHintVisible(false);
  }, [resultData, result]);

  async function checkHealth() {
    try {
      const data = await api.health();
      setStatus(data.ok ? 'Connected' : 'Unknown');
      setStorageMode(data.storageMode || 'Unknown');
      setAiMode(data.aiMode || 'Unknown');
      setError('');
    } catch (err) {
      setStatus('Offline');
      setStorageMode('Unknown');
      setAiMode('Unknown');
      setError(err.message);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await api.history();
      setHistory(data.items || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleGenerate() {
    if (!notes.trim()) {
      setError('Add some notes or a topic before generating.');
      return;
    }

    setError('');
    setLoading(true);
    setResult('');
    setResultData(null);
    setResultTitle('Generating your learning asset…');

    const payload = {
      notes,
      level,
      days: normalizeDays(days),
      examDate
    };

    try {
      const runner = {
        summarize: api.summarize,
        quiz: api.quiz,
        flashcards: api.flashcards,
        studyPlan: api.studyPlan
      }[task];
      const data = await runner(payload);
      setResult(data.result || 'No result returned.');
      setResultData(data.resultData || parseStructuredResult(data.result));
      setResultTitle(data.title || selectedTask.label);
      await loadHistory();
    } catch (err) {
      setError(err.message);
      setResultTitle('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setUploadInfo(file ? `${file.name} selected. Ready to upload.` : 'No file uploaded yet.');
  }

  async function handleUploadFile() {
    if (!selectedFile) {
      setError('Choose a file first.');
      return;
    }

    if (selectedFile.size > MAX_FILE_BYTES) {
      setError('File is too large for this classroom demo. Keep uploads under 2 MB.');
      return;
    }

    setError('');
    setUploading(true);
    setUploadInfo('Preparing secure upload URL…');

    try {
      const upload = await api.createUploadUrl({
        fileName: selectedFile.name,
        contentType: selectedFile.type || guessContentType(selectedFile.name),
        size: selectedFile.size
      });

      setUploadInfo(upload.mode === 's3' ? 'Uploading file directly to S3…' : 'Uploading file to local storage…');
      const localUploadResult = await api.uploadFile(upload, selectedFile);
      const processed = upload.mode === 'local'
        ? localUploadResult
        : await api.processFile({
            key: upload.key,
            originalName: selectedFile.name,
            contentType: selectedFile.type || guessContentType(selectedFile.name)
          });

      if (processed.textSupported && processed.extractedText) {
        setNotes((current) => {
          const separator = current.trim() ? `\n\n--- Uploaded file: ${selectedFile.name} ---\n` : '';
          return `${current.trim()}${separator}${processed.extractedText}`.trim();
        });
        setUploadInfo(`Uploaded ${selectedFile.name} to ${processed.storageMode}. Loaded ${processed.extractedText.length.toLocaleString()} characters into your notes.`);
      } else {
        setUploadInfo(processed.message || `Uploaded ${selectedFile.name}, but text could not be extracted automatically.`);
      }

      await loadHistory();
    } catch (err) {
      setError(err.message);
      setUploadInfo('Upload failed. Check the backend logs and CORS settings.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveProgress() {
    setError('');
    try {
      await api.saveProgress({
        topic: progressTopic,
        score: Number(progressScore),
        note: 'Saved from CloudMentor frontend.'
      });
      await loadHistory();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function openHistoryItem(item) {
    if (taskMap[item.type]) setTask(item.type);
    setResultTitle(item.title);
    setResult(item.result);
    setResultData(item.resultData || parseStructuredResult(item.result));
  }

  function chooseQuizAnswer(questionIndex, optionIndex) {
    setQuizAnswers((current) => ({ ...current, [questionIndex]: optionIndex }));
  }

  function resetQuiz() {
    setQuizAnswers({});
  }

  function nextFlashcard(cards) {
    setFlashcardIndex((current) => (current + 1) % cards.length);
    setFlashcardFlipped(false);
    setHintVisible(false);
  }

  function previousFlashcard(cards) {
    setFlashcardIndex((current) => (current - 1 + cards.length) % cards.length);
    setFlashcardFlipped(false);
    setHintVisible(false);
  }

  return {
    aiMode,
    clearError: () => setError(''),
    checkHealth,
    copied,
    days,
    error,
    examDate,
    flashcardFlipped,
    flashcardIndex,
    handleCopy,
    handleFileChange,
    handleGenerate,
    handleSaveProgress,
    handleUploadFile,
    hintVisible,
    history,
    historyLoading,
    level,
    loading,
    loadHistory,
    notes,
    openHistoryItem,
    previousFlashcard,
    nextFlashcard,
    progressScore,
    progressTopic,
    quizAnswers,
    quizScore,
    resetQuiz,
    result,
    resultData,
    resultTitle,
    selectedFile,
    selectedTask,
    setDays,
    setExamDate,
    setFlashcardFlipped,
    setHintVisible,
    setLevel,
    setNotes,
    setProgressScore,
    setProgressTopic,
    setTask,
    status,
    storageMode,
    task,
    uploadInfo,
    uploading,
    wordCount,
    chooseQuizAnswer
  };
}
