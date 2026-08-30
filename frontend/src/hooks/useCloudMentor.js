import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { taskMap } from '../constants/tasks.js';
import {
  getQuizQuestions,
  guessContentType,
  normalizeDays,
  parseStructuredResult
} from '../utils/learning.js';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function defaultOutputTitle(task) {
  const titles = {
    explain: 'Your detailed explanation will appear here',
    quiz: 'Your interactive quiz will appear here',
    flashcards: 'Your flashcards will appear here',
    studyPlan: 'Your study plan will appear here'
  };
  return titles[task] || 'Your learning output will appear here';
}

function getFirstUnansweredQuestion(questions, answers) {
  return questions.findIndex((_, index) => !Object.prototype.hasOwnProperty.call(answers, index));
}

export function useCloudMentor() {
  const [task, setTask] = useState('explain');
  const [notes, setNotes] = useState('');
  const [subject, setSubject] = useState('');
  const [explanationTopic, setExplanationTopic] = useState('');
  const [problem, setProblem] = useState('');
  const [quizTopic, setQuizTopic] = useState('');
  const [quizCount, setQuizCount] = useState(5);
  const [quizMaterial, setQuizMaterial] = useState(null);
  const [level, setLevel] = useState('beginner');
  const [days, setDays] = useState(7);
  const [examDate, setExamDate] = useState('');
  const [result, setResult] = useState('');
  const [resultData, setResultData] = useState(null);
  const [resultTitle, setResultTitle] = useState(defaultOutputTitle('explain'));
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('Checking');
  const [storageMode, setStorageMode] = useState('Unknown');
  const [aiMode, setAiMode] = useState('Unknown');
  const [error, setError] = useState('');
  const [progressTopic, setProgressTopic] = useState('');
  const [progressScore, setProgressScore] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState('No file uploaded yet.');
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizPage, setQuizPage] = useState(0);
  const [quizView, setQuizView] = useState('questions');
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  const selectedTask = taskMap[task] || taskMap.explain;

  const wordCount = useMemo(() => (
    notes.trim() ? notes.trim().split(/\s+/).length : 0
  ), [notes]);

  const explanationReady = Boolean(subject.trim() && explanationTopic.trim() && problem.trim());
  const quizReady = Boolean(quizTopic.trim() && quizMaterial?.key && quizMaterial?.text?.trim());

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
    setQuizPage(0);
    setQuizView('questions');
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
    let runner;
    let payload;

    if (task === 'explain') {
      if (!explanationReady) {
        setError('Add a subject name, topic, and problem before creating an explanation.');
        return;
      }
      runner = api.explain;
      payload = {
        subject: subject.trim(),
        topic: explanationTopic.trim(),
        problem: problem.trim()
      };
    } else if (task === 'quiz') {
      if (!quizReady) {
        setError('Enter a topic and upload a supported study file or searchable PDF before creating a quiz.');
        return;
      }
      runner = api.quiz;
      payload = {
        topic: quizTopic.trim(),
        level,
        questionCount: Number(quizCount),
        materialKey: quizMaterial.key,
        materialName: quizMaterial.originalName,
        materialText: quizMaterial.text
      };
    } else {
      if (!notes.trim()) {
        setError('Add some notes or a topic before generating.');
        return;
      }
      runner = task === 'flashcards' ? api.flashcards : api.studyPlan;
      payload = {
        notes,
        level,
        days: normalizeDays(days),
        examDate
      };
    }

    setError('');
    setLoading(true);
    setResult('');
    setResultData(null);
    setResultTitle('Creating your learning asset...');

    try {
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
    if (task === 'quiz') {
      setQuizMaterial(null);
    }
    setUploadInfo(file ? `${file.name} selected. Upload it to use it.` : 'No file uploaded yet.');
  }

  async function handleUploadFile() {
    if (!selectedFile) {
      setError('Choose a file first.');
      return;
    }

    if (selectedFile.size > MAX_FILE_BYTES) {
      setError('File is too large. Keep uploads under 2 MB.');
      return;
    }

    setError('');
    setUploading(true);
    setUploadInfo('Preparing secure upload URL...');

    try {
      const contentType = selectedFile.type || guessContentType(selectedFile.name);
      const upload = await api.createUploadUrl({
        fileName: selectedFile.name,
        contentType,
        size: selectedFile.size
      });

      setUploadInfo(upload.mode === 's3' ? 'Uploading file directly to S3...' : 'Uploading file to local storage...');
      const localUploadResult = await api.uploadFile(upload, selectedFile);
      const processed = upload.mode === 'local'
        ? localUploadResult
        : await api.processFile({
            key: upload.key,
            originalName: selectedFile.name,
            contentType
          });

      if (processed.textSupported && processed.extractedText) {
        if (task === 'quiz') {
          setQuizMaterial({
            key: processed.key || upload.key,
            originalName: processed.originalName || selectedFile.name,
            text: processed.extractedText
          });
          setUploadInfo(`Uploaded ${selectedFile.name}. Its ${processed.extractedText.length.toLocaleString()} characters are ready for this quiz.`);
        } else {
          setNotes((current) => {
            const separator = current.trim() ? `\n\n--- Uploaded file: ${selectedFile.name} ---\n` : '';
            return `${current.trim()}${separator}${processed.extractedText}`.trim();
          });
          setUploadInfo(`Uploaded ${selectedFile.name}. Loaded ${processed.extractedText.length.toLocaleString()} characters into your notes.`);
        }
      } else {
        if (task === 'quiz') setQuizMaterial(null);
        setUploadInfo(processed.message || `Uploaded ${selectedFile.name}, but text could not be extracted automatically.`);
      }

      await loadHistory();
    } catch (err) {
      setError(err.message);
      setUploadInfo(`Upload failed: ${err.message || 'The backend did not return a usable response.'}`);
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
    if (!result || (task === 'quiz' && quizView !== 'results')) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function changeTask(nextTask) {
    if (!taskMap[nextTask] || nextTask === task) return;
    setTask(nextTask);
    setResult('');
    setResultData(null);
    setResultTitle(defaultOutputTitle(nextTask));
    setError('');
    setQuizAnswers({});
    setQuizPage(0);
    setQuizView('questions');
  }

  function openHistoryItem(item) {
    const historyTask = item.type === 'summarize' ? 'explain' : item.type;
    if (taskMap[historyTask]) changeTask(historyTask);
    setResultTitle(item.title || defaultOutputTitle(historyTask));
    setResult(item.result || '');
    setResultData(item.resultData || parseStructuredResult(item.result));
  }

  function resetStudioOutput() {
    setResult('');
    setResultData(null);
    setResultTitle(defaultOutputTitle(task));
    setCopied(false);
    setQuizAnswers({});
    setQuizPage(0);
    setQuizView('questions');
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    setHintVisible(false);
    setError('');
  }

  function chooseQuizAnswer(questionIndex, optionIndex) {
    const questions = getQuizQuestions(resultData);
    const question = questions[questionIndex];
    if (!question || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) return;

    setQuizAnswers((current) => {
      if (Object.prototype.hasOwnProperty.call(current, questionIndex)) return current;
      return { ...current, [questionIndex]: optionIndex };
    });
  }

  function resetQuiz() {
    setQuizAnswers({});
    setQuizPage(0);
    setQuizView('questions');
  }

  function goToQuizPage(page, total) {
    const pageNumber = Number(page);
    const questions = getQuizQuestions(resultData);
    const totalPages = Math.min(Number(total), questions.length || Number(total));
    if (!Number.isInteger(pageNumber) || !Number.isInteger(totalPages) || totalPages < 1) return;

    const firstUnanswered = getFirstUnansweredQuestion(questions, quizAnswers);
    const furthestAvailablePage = firstUnanswered === -1 ? totalPages - 1 : firstUnanswered;
    setQuizPage(Math.min(Math.max(pageNumber, 0), furthestAvailablePage, totalPages - 1));
  }

  function previousQuizPage(total) {
    goToQuizPage(quizPage - 1, total);
  }

  function advanceQuiz(total) {
    const questions = getQuizQuestions(resultData);
    const totalQuestions = Math.min(Number(total), questions.length || Number(total));
    if (!Number.isInteger(totalQuestions) || totalQuestions < 1) return;

    const currentQuestion = Math.min(Math.max(quizPage, 0), totalQuestions - 1);
    if (!Object.prototype.hasOwnProperty.call(quizAnswers, currentQuestion)) return;

    if (currentQuestion < totalQuestions - 1) {
      goToQuizPage(currentQuestion + 1, totalQuestions);
      return;
    }

    const firstUnanswered = getFirstUnansweredQuestion(questions, quizAnswers);
    if (firstUnanswered === -1) {
      setQuizView('results');
      return;
    }

    goToQuizPage(firstUnanswered, totalQuestions);
  }

  function reviewQuiz() {
    setQuizView('questions');
    setQuizPage(0);
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
    explanationReady,
    explanationTopic,
    flashcardFlipped,
    flashcardIndex,
    advanceQuiz,
    goToQuizPage,
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
    previousQuizPage,
    previousFlashcard,
    nextFlashcard,
    problem,
    progressScore,
    progressTopic,
    quizAnswers,
    quizCount,
    quizMaterial,
    quizPage,
    quizReady,
    quizScore,
    quizTopic,
    quizView,
    resetStudioOutput,
    resetQuiz,
    reviewQuiz,
    result,
    resultData,
    resultTitle,
    selectedFile,
    selectedTask,
    setDays,
    setExamDate,
    setExplanationTopic,
    setFlashcardFlipped,
    setHintVisible,
    setLevel,
    setNotes,
    setProblem,
    setProgressScore,
    setProgressTopic,
    setQuizCount,
    setQuizTopic,
    setSubject,
    setTask: changeTask,
    status,
    storageMode,
    subject,
    task,
    uploadInfo,
    uploading,
    wordCount,
    chooseQuizAnswer
  };
}
