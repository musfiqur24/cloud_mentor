import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  Trophy,
  XCircle
} from 'lucide-react';
import { getFlashcards, getQuizQuestions, getStudyDays } from '../../utils/learning.js';

export function ResultRenderer({
  task,
  result,
  resultData,
  quizAnswers,
  quizScore,
  onChooseAnswer,
  onResetQuiz,
  flashcardIndex,
  flashcardFlipped,
  hintVisible,
  setFlashcardFlipped,
  setHintVisible,
  nextFlashcard,
  previousFlashcard
}) {
  if (task === 'quiz' && getQuizQuestions(resultData).length) {
    const questions = getQuizQuestions(resultData);
    return (
      <div className="interactive-output">
        <div className="quiz-header">
          <div>
            <span className="eyebrow">Interactive quiz</span>
            <h3>Answer each question and get instant feedback</h3>
          </div>
          <div className="score-badge"><Trophy size={17} /> {quizScore.correct}/{quizScore.total}</div>
        </div>

        <div className="quiz-progress" aria-label="Quiz progress">
          <span style={{ width: `${quizScore.total ? (quizScore.answered / quizScore.total) * 100 : 0}%` }} />
        </div>

        <div className="quiz-list">
          {questions.map((question, questionIndex) => {
            const selected = quizAnswers[questionIndex];
            const hasAnswered = selected !== undefined;
            const isCorrect = selected === question.answerIndex;
            return (
              <article className="quiz-card" key={`${question.question}-${questionIndex}`}>
                <div className="quiz-question-row">
                  <span>Q{questionIndex + 1}</span>
                  <strong>{question.question}</strong>
                </div>
                <div className="answer-grid">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = selected === optionIndex;
                    const isAnswer = question.answerIndex === optionIndex;
                    const answerClass = hasAnswered && isAnswer
                      ? 'correct'
                      : hasAnswered && isSelected && !isAnswer
                        ? 'wrong'
                        : '';
                    return (
                      <button
                        type="button"
                        className={`answer-option ${answerClass} ${isSelected ? 'selected' : ''}`}
                        key={`${option}-${optionIndex}`}
                        onClick={() => onChooseAnswer(questionIndex, optionIndex)}
                      >
                        <span>{String.fromCharCode(65 + optionIndex)}</span>
                        <em>{option}</em>
                        {hasAnswered && isAnswer && <CheckCircle2 size={17} />}
                        {hasAnswered && isSelected && !isAnswer && <XCircle size={17} />}
                      </button>
                    );
                  })}
                </div>
                {hasAnswered && (
                  <p className={`answer-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
                    {isCorrect ? 'Correct.' : 'Not quite.'} {question.explanation}
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {Array.isArray(resultData?.shortAnswerQuestions) && resultData.shortAnswerQuestions.length > 0 && (
          <div className="short-answer-box">
            <strong>Short-answer practice</strong>
            <ol>{resultData.shortAnswerQuestions.map((question, index) => <li key={`${question}-${index}`}>{question}</li>)}</ol>
          </div>
        )}

        <button type="button" className="secondary-button compact-button" onClick={onResetQuiz}>
          <RotateCcw size={16} /> Reset quiz
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

  return <pre>{result}</pre>;
}
