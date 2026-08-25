import { BrainCircuit, CheckCircle2, Copy, Loader2 } from 'lucide-react';
import { ResultRenderer } from '../results/ResultRenderer.jsx';

export function OutputPanel({ mentor }) {
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
          disabled={!mentor.result}
          aria-label="Copy result"
        >
          {mentor.copied ? <CheckCircle2 size={19} /> : <Copy size={19} />}
        </button>
      </div>

      <div className="result-surface">
        {mentor.loading ? (
          <div className="empty-state">
            <Loader2 className="spin" size={30} />
            <h3>Creating your learning asset</h3>
            <p>CloudMentor is preparing a useful, focused answer from your notes.</p>
          </div>
        ) : mentor.result ? (
          <ResultRenderer
            task={mentor.task}
            result={mentor.result}
            resultData={mentor.resultData}
            quizAnswers={mentor.quizAnswers}
            quizScore={mentor.quizScore}
            onChooseAnswer={mentor.chooseQuizAnswer}
            onResetQuiz={mentor.resetQuiz}
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
            <h3>Your output will live here</h3>
            <p>Choose an activity, add your study material, and create your first learning asset.</p>
          </div>
        )}
      </div>
    </section>
  );
}

