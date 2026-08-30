import { BrainCircuit, CheckCircle2, Copy, Loader2 } from 'lucide-react';
import { ResultRenderer } from '../results/ResultRenderer.jsx';

export function OutputPanel({ mentor }) {
  const canCopyResult = Boolean(mentor.result) && (mentor.task !== 'quiz' || mentor.quizView === 'results');
  const outputCopy = mentor.task === 'explain'
    ? {
        loadingTitle: 'Building a detailed explanation',
        loadingText: 'CloudMentor is working through your subject, topic, and problem.',
        emptyTitle: 'Your explanation will live here',
        emptyText: 'Add a subject name, topic, and problem to receive a clear, detailed explanation.'
      }
    : mentor.task === 'quiz'
      ? {
          loadingTitle: 'Building your quiz',
          loadingText: 'CloudMentor is creating questions only from your uploaded study material.',
          emptyTitle: 'Your quiz will live here',
          emptyText: 'Enter a topic, upload one or more study files or searchable PDFs, and choose how many questions to create.'
        }
      : {
          loadingTitle: 'Creating your learning asset',
          loadingText: 'CloudMentor is preparing a useful, focused answer from your notes.',
          emptyTitle: 'Your output will live here',
          emptyText: 'Choose an activity, add your study material, and create your first learning asset.'
        };

  return (
    <section className="studio-output card">
      <div className="output-header">
        <div>
          <p className="eyebrow">Learning output</p>
          <h2>{mentor.resultTitle}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={mentor.handleCopy}
          disabled={!canCopyResult}
          aria-label={canCopyResult ? 'Copy result' : 'Finish the quiz to copy its results'}
        >
          {mentor.copied ? <CheckCircle2 size={19} /> : <Copy size={19} />}
        </button>
      </div>

      <div className="result-surface">
        {mentor.loading ? (
          <div className="empty-state">
            <Loader2 className="spin" size={30} />
            <h3>{outputCopy.loadingTitle}</h3>
            <p>{outputCopy.loadingText}</p>
          </div>
        ) : mentor.result ? (
          <ResultRenderer
            task={mentor.task}
            result={mentor.result}
            resultData={mentor.resultData}
            quizAnswers={mentor.quizAnswers}
            quizScore={mentor.quizScore}
            quizView={mentor.quizView}
            onChooseAnswer={mentor.chooseQuizAnswer}
            onAdvanceQuiz={mentor.advanceQuiz}
            onReviewQuiz={mentor.reviewQuiz}
            onResetQuiz={mentor.resetQuiz}
            quizPage={mentor.quizPage}
            onQuizPageChange={mentor.goToQuizPage}
            onPreviousQuizPage={mentor.previousQuizPage}
            flashcardIndex={mentor.flashcardIndex}
            flashcardFlipped={mentor.flashcardFlipped}
            hintVisible={mentor.hintVisible}
            setFlashcardFlipped={mentor.setFlashcardFlipped}
            setHintVisible={mentor.setHintVisible}
            nextFlashcard={mentor.nextFlashcard}
            previousFlashcard={mentor.previousFlashcard}
          />
        ) : (
          <div className="empty-state">
            <BrainCircuit size={42} />
            <h3>{outputCopy.emptyTitle}</h3>
            <p>{outputCopy.emptyText}</p>
          </div>
        )}
      </div>
    </section>
  );
}
