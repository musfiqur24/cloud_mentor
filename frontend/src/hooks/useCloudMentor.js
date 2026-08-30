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
const MAX_QUIZ_FILES = 5;
const MAX_QUIZ_MATERIAL_CHARS = 12_000;

function fileSignature(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function combineQuizMaterialText(materials) {
  const usable = materials.filter((material) => material?.text?.trim());
  if (usable.length === 0) return '';

  // Reserve a fair share of the prompt for each uploaded source so one long
  // PDF cannot hide every other file from the quiz generator.
  const perFileBudget = Math.max(800, Math.floor(MAX_QUIZ_MATERIAL_CHARS / usable.length) - 90);
  return usable
    .map((material) => `[Study file: ${material.originalName}]\n${material.text.trim().slice(0, perFileBudget)}`)
    .join('\n\n')
    .slice(0, MAX_QUIZ_MATERIAL_CHARS);
}

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
  const [quizMaterials, setQuizMaterials] = useState([]);
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
  const [selectedQuizFiles, setSelectedQuizFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [quizUploading, setQuizUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState('No file uploaded yet.');
  const [quizUploadInfo, setQuizUploadInfo] = useState('Choose one or more study files, then upload them for this quiz.');
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
  const quizMaterialText = useMemo(() => combineQuizMaterialText(quizMaterials), [quizMaterials]);
  const quizReady = Boolean(quizTopic.trim() && quizMaterials.length > 0 && quizMaterialText);

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
        setError('Enter a topic and upload at least one supported study file or searchable PDF before creating a quiz.');
        return;
      }
      runner = api.quiz;
      payload = {
        topic: quizTopic.trim(),
        level,
        questionCount: Number(quizCount),
        // materialKey is kept for older API deployments. New deployments use
        // materialKeys to verify every uploaded file belongs to this user.
        materialKey: quizMaterials[0].key,
        materialKeys: quizMaterials.map((material) => material.key),
        materialNames: quizMaterials.map((material) => material.originalName),
        materialText: quizMaterialText
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
        setNotes((current) => {
          const separator = current.trim() ? `\n\n--- Uploaded file: ${selectedFile.name} ---\n` : '';
          return `${current.trim()}${separator}${processed.extractedText}`.trim();
        });
        setUploadInfo(`Uploaded ${selectedFile.name}. Loaded ${processed.extractedText.length.toLocaleString()} characters into your notes.`);
      } else {
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

  function handleQuizFilesChange(event) {
    const incoming = Array.from(event.target.files || []);
    event.target.value = '';
    if (incoming.length === 0) return;

    const oversized = incoming.filter((file) => file.size > MAX_FILE_BYTES);
    const validFiles = incoming.filter((file) => file.size <= MAX_FILE_BYTES);
    const knownFiles = new Set([
      ...selectedQuizFiles.map(fileSignature),
      ...quizMaterials.map((material) => material.signature).filter(Boolean)
    ]);
    const uniqueFiles = validFiles.filter((file) => !knownFiles.has(fileSignature(file)));
    const availableSlots = Math.max(MAX_QUIZ_FILES - quizMaterials.length - selectedQuizFiles.length, 0);
    const addedFiles = uniqueFiles.slice(0, availableSlots);

    if (addedFiles.length > 0) {
      setSelectedQuizFiles((current) => [...current, ...addedFiles]);
    }

    const notes = [];
    if (addedFiles.length > 0) notes.push(`${addedFiles.length} file${addedFiles.length === 1 ? '' : 's'} ready to upload`);
    if (oversized.length > 0) notes.push(`${oversized.length} file${oversized.length === 1 ? '' : 's'} skipped (over 2 MB)`);
    if (uniqueFiles.length > availableSlots) notes.push(`maximum ${MAX_QUIZ_FILES} files per quiz`);
    if (addedFiles.length === 0 && notes.length === 0) notes.push('Those files are already part of this quiz');
    setQuizUploadInfo(`${notes.join(' · ')}.`);
  }

  function removeSelectedQuizFile(signature) {
    setSelectedQuizFiles((current) => current.filter((file) => fileSignature(file) !== signature));
    setQuizUploadInfo('File removed from the upload list.');
  }

  function removeQuizMaterial(key) {
    setQuizMaterials((current) => current.filter((material) => material.key !== key));
    setQuizUploadInfo('File removed from this quiz.');
  }

  async function handleUploadQuizFiles() {
    if (selectedQuizFiles.length === 0) {
      setError('Choose at least one study file first.');
      return;
    }

    setError('');
    setQuizUploading(true);
    const uploadedMaterials = [];
    const retryFiles = [];
    const notices = [];

    try {
      for (const [index, file] of selectedQuizFiles.entries()) {
        setQuizUploadInfo(`Uploading ${file.name} (${index + 1} of ${selectedQuizFiles.length})…`);
        const contentType = file.type || guessContentType(file.name);

        try {
          const upload = await api.createUploadUrl({
            fileName: file.name,
            contentType,
            size: file.size
          });
          const localUploadResult = await api.uploadFile(upload, file);
          const processed = upload.mode === 'local'
            ? localUploadResult
            : await api.processFile({
                key: upload.key,
                originalName: file.name,
                contentType
              });

          if (processed.textSupported && processed.extractedText) {
            uploadedMaterials.push({
              key: processed.key || upload.key,
              originalName: processed.originalName || file.name,
              text: processed.extractedText,
              sizeBytes: processed.sizeBytes || file.size,
              signature: fileSignature(file)
            });
          } else {
            notices.push(`${file.name}: ${processed.message || 'no readable text found'}`);
          }
        } catch (uploadError) {
          retryFiles.push(file);
          notices.push(`${file.name}: ${uploadError?.message || 'upload failed'}`);
        }
      }

      if (uploadedMaterials.length > 0) {
        setQuizMaterials((current) => [...current, ...uploadedMaterials].slice(0, MAX_QUIZ_FILES));
      }
      setSelectedQuizFiles(retryFiles);

      if (uploadedMaterials.length > 0) {
        const materialTotal = quizMaterials.length + uploadedMaterials.length;
        const successText = `${uploadedMaterials.length} file${uploadedMaterials.length === 1 ? '' : 's'} added to this quiz (${materialTotal} total)`;
        setQuizUploadInfo(notices.length ? `${successText}. ${notices.join(' · ')}` : `${successText}.`);
      } else {
        setQuizUploadInfo(notices.join(' · ') || 'No files could be loaded.');
      }

      if (uploadedMaterials.length > 0) await loadHistory();
    } finally {
      setQuizUploading(false);
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
    handleQuizFilesChange,
    handleSaveProgress,
    handleUploadFile,
    handleUploadQuizFiles,
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
    quizMaterialText,
    quizMaterials,
    quizPage,
    quizReady,
    quizScore,
    quizTopic,
    quizView,
    resetStudioOutput,
    resetQuiz,
    reviewQuiz,
    removeQuizMaterial,
    removeSelectedQuizFile,
    result,
    resultData,
    resultTitle,
    selectedFile,
    selectedQuizFiles,
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
    quizUploadInfo,
    quizUploading,
    wordCount,
    chooseQuizAnswer
  };
}
