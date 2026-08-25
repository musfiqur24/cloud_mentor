import { ArrowRight, FileClock, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { taskMap } from '../../constants/tasks.js';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Unknown date' : date.toLocaleString();
}

function preview(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 140) || 'Saved learning activity';
}

export function HistoryPage({ mentor, onOpenHistory }) {
  return (
    <div className="history-page page-stack">
      <section className="page-intro">
        <div>
          <p className="eyebrow">Learning history</p>
          <h1>Your saved study work.</h1>
          <p>Reopen any generated asset and continue learning exactly where you left off.</p>
        </div>
        <button type="button" className="secondary-button" onClick={mentor.loadHistory} disabled={mentor.historyLoading}>
          {mentor.historyLoading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
          Refresh
        </button>
      </section>

      <section className="history-board card">
        {mentor.historyLoading ? (
          <div className="empty-state compact-empty"><Loader2 className="spin" size={30} /><p>Loading history…</p></div>
        ) : mentor.history.length ? (
          <div className="history-board__list">
            {mentor.history.map((item) => {
              const itemType = taskMap[item.type]?.shortLabel || item.type || 'Activity';
              return (
                <button type="button" className="history-entry" key={item.id} onClick={() => onOpenHistory(item)}>
                  <span className="history-entry__icon"><FileClock size={20} /></span>
                  <span className="history-entry__content">
                    <span className="history-entry__meta"><span>{itemType}</span><time>{formatDate(item.createdAt)}</time></span>
                    <strong>{item.title}</strong>
                    <small>{preview(item.result)}</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <Sparkles size={34} />
            <h2>No saved work yet</h2>
            <p>Generate a summary, quiz, flashcards, or a study plan to build your history.</p>
          </div>
        )}
      </section>
    </div>
  );
}
