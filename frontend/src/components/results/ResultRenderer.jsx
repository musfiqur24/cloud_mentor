import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Lightbulb,
  ListChecks,
  RotateCcw,
  Trophy,
  XCircle
} from 'lucide-react';
import { getFlashcards, getQuizQuestions, getStudyDays } from '../../utils/learning.js';

function ExplanationResult({ data }) {
  const workedSteps = data.workedExample?.steps || [];

  return (
    <article className="explanation-output">
      <header className="explanation-output__header">
        <span className="explanation-output__icon"><Lightbulb size={20} /></span>
        <div>
          <p className="eyebrow">Detailed explanation</p>
          <h3>{data.title}</h3>
          <p>{[data.subject, data.topic].filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      <section className="explanation-answer">
        <span>Direct answer</span>
        <p>{data.directAnswer}</p>
      </section>

      <div className="explanation-sections">
        {data.sections.map((section, index) => (
          <section className="explanation-section" key={`${section.heading}-${index}`}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h4>{section.heading}</h4>
              <p>{section.content}</p>
            </div>
          </section>
        ))}
      </div>

      {workedSteps.length > 0 && (
        <section className="explanation-example">
          <div>
            <Lightbulb size={18} />
            <h4>{data.workedExample.title || 'Worked example'}</h4>
          </div>
          <ol>{workedSteps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol>
        </section>
      )}

      {data.commonMistakes?.length > 0 && (
        <section className="explanation-list explanation-list--mistakes">
          <div><CircleAlert size={18} /><h4>Common mistakes</h4></div>
          <ul>{data.commonMistakes.map((mistake, index) => <li key={`${mistake}-${index}`}>{mistake}</li>)}</ul>
        </section>
      )}

      {data.keyTakeaways?.length > 0 && (
        <section className="explanation-list explanation-list--takeaways">
          <div><ListChecks size={18} /><h4>Key takeaways</h4></div>
          <ul>{data.keyTakeaways.map((takeaway, index) => <li key={`${takeaway}-${index}`}>{takeaway}</li>)}</ul>
        </section>
      )}
    </article>
  );
}

function optionLabel(index) {
  return String.fromCharCode(65 + index);
}

function scoreMessage(correct, total) {
  const percentage = total ? Math.round((correct / total) * 100) : 0;
  if (percentage === 100) return 'Perfect score. You have a strong command of this material.';
  if (percentage >= 80) return 'Great work. Review the missed ideas once more to lock them in.';
  if (percentage >= 60) return 'A solid start. The review below shows exactly what to revisit.';
  return 'Keep practising. Use the audit below to focus your next study session.';
}

function QuizResults({ questions, quizAnswers, quizScore, onReviewQuiz, onResetQuiz, shortAnswerQuestions }) {
  const percentage = quizScore.total ? Math.round((quizScore.correct / quizScore.total) * 100) : 0;

  return (
    <div className="interactive-output quiz-results">
      <div className="quiz-header">
        <div>
          <span className="eyebrow">Quiz complete</span>
          <h3>Your results are ready</h3>
        </div>
        <div className="score-badge"><Trophy size={17} /> {quizScore.correct}/{quizScore.total}</div>
      </div>

      <section className="quiz-result-summary" aria-label="Quiz result summary">
        <div className="quiz-result-summary__score">
          <span>{percentage}%</span>
          <small>Score</small>
        </div>
        <div>
          <p className="eyebrow">{quizScore.correct} correct out of {quizScore.total}</p>
          <h3>{percentage >= 80 ? 'Well done!' : 'Keep building your confidence'}</h3>
          <p>{scoreMessage(quizScore.correct, quizScore.total)}</p>
        </div>
      </section>

      <section className="quiz-audit" aria-labelledby="quiz-audit-heading">
        <div>
          <p className="eyebrow">Full answer audit</p>
          <h3 id="quiz-audit-heading">Review every answer</h3>
          <p>See your choice, the correct answer, and why it is correct.</p>
        </div>

        <ol className="quiz-audit-list">
          {questions.map((question, index) => {
            const selected = quizAnswers[index];
            const isCorrect = selected === question.answerIndex;
            const selectedOption = Number.isInteger(selected) ? question.options[selected] : 'No answer selected';
            const correctOption = question.options[question.answerIndex] || 'Correct answer unavailable';

            return (
              <li className={`quiz-audit-item ${isCorrect ? 'correct' : 'wrong'}`} key={`${question.question}-${index}`}>
                <div className="quiz-audit-item__header">
                  <span>Q{index + 1}</span>
                  <h4>{question.question}</h4>
                  <span className={`quiz-audit-item__status ${isCorrect ? 'correct' : 'wrong'}`}>
                    {isCorrect ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
                <div className="quiz-audit-item__answers">
                  <p><span>Your answer</span><strong>{Number.isInteger(selected) ? `${optionLabel(selected)}. ${selectedOption}` : selectedOption}</strong></p>
                  <p><span>Correct answer</span><strong>{optionLabel(question.answerIndex)}. {correctOption}</strong></p>
                </div>
                {question.explanation && <p className="quiz-audit-item__explanation"><strong>Why:</strong> {question.explanation}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      {shortAnswerQuestions?.length > 0 && (
        <div className="short-answer-box">
          <strong>Extra short-answer practice</strong>
          <ol>{shortAnswerQuestions.map((shortQuestion, index) => <li key={`${shortQuestion}-${index}`}>{shortQuestion}</li>)}</ol>
        </div>
      )}

      <div className="quiz-navigation">
        <button type="button" className="secondary-button compact-button" onClick={onReviewQuiz}>
          <ChevronLeft size={16} /> Review questions
        </button>
        <button type="button" className="primary-button compact-button" onClick={onResetQuiz}>
          <RotateCcw size={16} /> Try again
        </button>
      </div>
    </div>
  );
}

export function ResultRenderer({
  task,
  result,
  resultData,
  quizAnswers,
  quizScore,
  quizView,
  onChooseAnswer,
  onAdvanceQuiz,
  onReviewQuiz,
  onResetQuiz,
  quizPage,
  onQuizPageChange,
  onPreviousQuizPage,
  flashcardIndex,
  flashcardFlipped,
  hintVisible,
  setFlashcardFlipped,
  setHintVisible,
  nextFlashcard,
  previousFlashcard
}) {
  if (task === 'explain' && resultData?.type === 'explanation') {
    return <ExplanationResult data={resultData} />;
  }

  if (task === 'quiz' && getQuizQuestions(resultData).length) {
    const questions = getQuizQuestions(resultData);

    if (quizView === 'results') {
      return (
        <QuizResults
          questions={questions}
          quizAnswers={quizAnswers}
          quizScore={quizScore}
          onReviewQuiz={onReviewQuiz}
          onResetQuiz={onResetQuiz}
          shortAnswerQuestions={resultData?.shortAnswerQuestions}
        />
      );
    }

    const currentPage = Math.min(Math.max(Number(quizPage) || 0, 0), questions.length - 1);
    const question = questions[currentPage];
    const selected = quizAnswers[currentPage];
    const hasAnswered = Object.prototype.hasOwnProperty.call(quizAnswers, currentPage);
    const isLastQuestion = currentPage === questions.length - 1;
    const canFinishQuiz = isLastQuestion && hasAnswered && quizScore.answered === questions.length;
    const furthestAvailablePage = quizScore.answered === questions.length ? questions.length - 1 : quizScore.answered;

    return (
      <div className="interactive-output quiz-attempt">
        <div className="quiz-header">
          <div>
            <span className="eyebrow">Interactive quiz</span>
            <h3>Question {currentPage + 1} of {questions.length}</h3>
          </div>
          <div className="score-badge"><ListChecks size={17} /> {quizScore.answered}/{quizScore.total} answered</div>
        </div>

        <div className="quiz-progress" aria-label={`${quizScore.answered} of ${quizScore.total} questions answered`}>
          <span style={{ width: `${quizScore.total ? (quizScore.answered / quizScore.total) * 100 : 0}%` }} />
        </div>

        <div className="quiz-list">
          <article className="quiz-card" key={`${question.question}-${currentPage}`}>
            <div className="quiz-question-row">
              <span>Q{currentPage + 1}</span>
              <strong>{question.question}</strong>
            </div>
            <div className="answer-grid">
              {question.options.map((option, optionIndex) => {
                const isSelected = selected === optionIndex;
                return (
                  <button
                    type="button"
                    className={`answer-option ${isSelected ? 'selected' : ''} ${hasAnswered ? 'locked' : ''}`}
                    key={`${option}-${optionIndex}`}
                    onClick={() => onChooseAnswer(currentPage, optionIndex)}
                    disabled={hasAnswered}
                    aria-pressed={isSelected}
                  >
                    <span>{optionLabel(optionIndex)}</span>
                    <em>{option}</em>
                  </button>
                );
              })}
            </div>
          </article>
        </div>

        <div className="quiz-navigation">
          <p aria-live="polite">
            {hasAnswered
              ? canFinishQuiz
                ? 'All questions are answered. Your final result is ready.'
                : 'Answer locked. Continue when you are ready.'
              : 'Choose one answer to unlock the next question.'}
          </p>
          <button
            type="button"
            className="primary-button compact-button"
            onClick={() => onAdvanceQuiz(questions.length)}
            disabled={!hasAnswered}
          >
            {canFinishQuiz ? 'See results' : 'Next question'} <ChevronRight size={16} />
          </button>
        </div>

        <nav className="quiz-pagination" aria-label="Quiz question pagination">
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => onPreviousQuizPage(questions.length)}
            disabled={currentPage === 0}
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <div className="quiz-pagination__pages">
            {questions.map((_, index) => {
              const isAnswered = Object.prototype.hasOwnProperty.call(quizAnswers, index);
              const isLocked = index > furthestAvailablePage;

              return (
                <button
                  type="button"
                  key={index}
                  className={`${index === currentPage ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${isLocked ? 'locked' : ''}`.trim()}
                  aria-label={`Question ${index + 1}${isAnswered ? ', answered' : ''}${isLocked ? ', locked' : ''}`}
                  aria-current={index === currentPage ? 'page' : undefined}
                  onClick={() => onQuizPageChange(index, questions.length)}
                  disabled={isLocked}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => onAdvanceQuiz(questions.length)}
            disabled={!hasAnswered}
          >
            {canFinishQuiz ? 'Results' : 'Next'} <ChevronRight size={16} />
          </button>
        </nav>

        <button type="button" className="secondary-button compact-button" onClick={onResetQuiz}>
          <RotateCcw size={16} /> Start over
        </button>
      </div>
    );
  }

  if (task === 'flashcards' && getFlashcards(resultData).length) {
    const cards = getFlashcards(resultData);
    const current = cards[Math.min(flashcardIndex, cards.length - 1)];
    return (
      <div className="interactive-output flashcard-output">
        <div className="quiz-header">
          <div>
            <span className="eyebrow">Flashcards</span>
            <h3>Flip the card, test recall, then move next</h3>
          </div>
          <div className="score-badge">{flashcardIndex + 1}/{cards.length}</div>
        </div>

        <button type="button" className={`flashcard ${flashcardFlipped ? 'flipped' : ''}`} onClick={() => setFlashcardFlipped(!flashcardFlipped)}>
          <span className="flashcard-label">{flashcardFlipped ? 'Back' : 'Front'}</span>
          <strong>{flashcardFlipped ? current.back : current.front}</strong>
          <small>{flashcardFlipped ? 'Click to see the question again' : 'Think first, then click to reveal the answer'}</small>
        </button>

        {current.hint && (
          <div className="hint-box">
            <button type="button" className="secondary-button compact-button" onClick={() => setHintVisible(!hintVisible)}>
              <Eye size={16} /> {hintVisible ? 'Hide hint' : 'Show hint'}
            </button>
            {hintVisible && <p>{current.hint}</p>}
          </div>
        )}

        <div className="flashcard-controls">
          <button type="button" className="secondary-button compact-button" onClick={() => previousFlashcard(cards)}><ChevronLeft size={16} /> Previous</button>
          <button type="button" className="primary-button compact-button" onClick={() => setFlashcardFlipped(!flashcardFlipped)}>Flip card</button>
          <button type="button" className="secondary-button compact-button" onClick={() => nextFlashcard(cards)}>Next <ChevronRight size={16} /></button>
        </div>
      </div>
    );
  }

  if (task === 'studyPlan' && getStudyDays(resultData).length) {
    const planDays = getStudyDays(resultData);
    return (
      <div className="interactive-output">
        <div className="quiz-header">
          <div>
            <span className="eyebrow">Study plan</span>
            <h3>{planDays.length} exact study days</h3>
          </div>
          <div className="score-badge"><CalendarDays size={17} /> {planDays.length} days</div>
        </div>

        {resultData?.strategy && <p className="plan-strategy">{resultData.strategy}</p>}
        <div className="study-plan-list">
          {planDays.map((day) => (
            <article className="study-day-card" key={day.day}>
              <div className="day-number">Day {day.day}</div>
              <div>
                <h3>{day.title}</h3>
                <p><strong>Focus:</strong> {day.focus}</p>
                {Array.isArray(day.activities) && day.activities.length > 0 && (
                  <ul>{day.activities.map((activity, index) => <li key={`${activity}-${index}`}>{activity}</li>)}</ul>
                )}
                {day.practice && <p><strong>Practice:</strong> {day.practice}</p>}
                {day.outcome && <p><strong>Outcome:</strong> {day.outcome}</p>}
              </div>
            </article>
          ))}
        </div>

        {Array.isArray(resultData?.finalChecklist) && resultData.finalChecklist.length > 0 && (
          <div className="short-answer-box">
            <strong>Final checklist</strong>
            <ol>{resultData.finalChecklist.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol>
          </div>
        )}
      </div>
    );
  }

  if (task === 'explain') {
    return (
      <div className="explanation-fallback">
        <p className="eyebrow">Detailed explanation</p>
        <pre>{result}</pre>
      </div>
    );
  }

  return <pre>{result}</pre>;
}
