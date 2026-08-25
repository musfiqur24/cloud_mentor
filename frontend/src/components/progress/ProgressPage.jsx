import { Award, CheckCircle2, Loader2, Target, TrendingUp } from 'lucide-react';

function getProgressItems(history) {
  return history.filter((item) => item.type === 'progress');
}

export function ProgressPage({ mentor }) {
  const savedProgress = getProgressItems(mentor.history);
  const latestProgress = savedProgress[0];

  return (
    <div className="progress-page page-stack">
      <section className="page-intro">
        <div>
          <p className="eyebrow">Progress tracker</p>
          <h1>Save the wins that matter.</h1>
          <p>Record a score after a quiz or review session, then build a simple learning trail over time.</p>
        </div>
      </section>

      <section className="progress-layout">
        <article className="progress-form card">
          <div className="section-heading section-heading--inline">
            <div>
              <p className="eyebrow">New check-in</p>
              <h2>Save your progress</h2>
            </div>
            <Target size={23} />
          </div>

          <label className="field-label" htmlFor="progress-topic">What did you study?</label>
          <input
            id="progress-topic"
            value={mentor.progressTopic}
            onChange={(event) => mentor.setProgressTopic(event.target.value)}
            placeholder="For example: AWS Lambda basics"
          />

          <div className="score-control">
            <div><span>Confidence score</span><strong>{mentor.progressScore}%</strong></div>
            <input
              id="progress-score"
              type="range"
              min="0"
              max="100"
              value={mentor.progressScore}
              onChange={(event) => mentor.setProgressScore(event.target.value)}
            />
            <div className="score-control__labels"><span>Just starting</span><span>Confident</span></div>
          </div>

          <button type="button" className="primary-button wide-button" onClick={mentor.handleSaveProgress}>
            <CheckCircle2 size={18} /> Save progress
          </button>
        </article>

        <article className="progress-summary card">
          <div className="section-heading section-heading--inline">
            <div>
              <p className="eyebrow">Your progress</p>
              <h2>Learning snapshot</h2>
            </div>
            <TrendingUp size={23} />
          </div>
          <div className="progress-summary__stats">
            <div><span>Saved check-ins</span><strong>{savedProgress.length}</strong></div>
            <div><span>Latest topic</span><strong>{latestProgress?.title?.replace('Progress: ', '') || 'Not saved yet'}</strong></div>
          </div>
          <div className="progress-tip">
            <Award size={20} />
            <p>A quick score after each activity makes it easier to see which topics need another review.</p>
          </div>
          {mentor.historyLoading && <p className="muted"><Loader2 className="spin inline-spinner" size={16} /> Updating your history…</p>}
        </article>
      </section>
    </div>
  );
}
