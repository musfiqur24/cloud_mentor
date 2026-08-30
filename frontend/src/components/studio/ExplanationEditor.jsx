import { Loader2, Sparkles } from 'lucide-react';

export function ExplanationEditor({ mentor }) {
  const SelectedIcon = mentor.selectedTask.icon;
  const problemWordCount = mentor.problem.trim() ? mentor.problem.trim().split(/\s+/).length : 0;

  return (
    <section className="studio-input card">
      <div className="section-heading">
        <div className="section-icon"><SelectedIcon size={21} /></div>
        <div className="section-heading__copy">
          <h2>Explain a problem</h2>
          <p>Tell CloudMentor what you are studying and where you are stuck.</p>
        </div>
      </div>

      <label className="field-label" htmlFor="explanation-subject">Subject name</label>
      <input
        id="explanation-subject"
        value={mentor.subject}
        onChange={(event) => mentor.setSubject(event.target.value)}
        placeholder="For example: Physics"
      />

      <label className="field-label" htmlFor="explanation-topic">Topic</label>
      <input
        id="explanation-topic"
        value={mentor.explanationTopic}
        onChange={(event) => mentor.setExplanationTopic(event.target.value)}
        placeholder="For example: Newton's second law"
      />

      <label className="field-label" htmlFor="explanation-problem">Problem</label>
      <textarea
        id="explanation-problem"
        value={mentor.problem}
        onChange={(event) => mentor.setProblem(event.target.value)}
        placeholder="Describe the part you do not understand, or paste the exact question here..."
      />
      <div className="field-meta">
        <span>{problemWordCount.toLocaleString()} words</span>
        <span>{mentor.explanationReady ? 'Ready for AI' : 'Complete all three fields'}</span>
      </div>

      <button
        type="button"
        className="primary-button wide-button"
        onClick={mentor.handleGenerate}
        disabled={mentor.loading || !mentor.explanationReady}
      >
        {mentor.loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
        {mentor.loading ? 'Creating your explanation...' : 'Create detailed explanation'}
      </button>
    </section>
  );
}
