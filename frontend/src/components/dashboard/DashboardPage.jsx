import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileText,
  Layers3,
  Sparkles
} from 'lucide-react';
import { taskMap } from '../../constants/tasks.js';
import StatCard from './StatCard.jsx';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Just now' : date.toLocaleString();
}

export function DashboardPage({ mentor, onNavigate, onOpenHistory }) {
  const connected = mentor.status === 'Connected';
  const recentItems = mentor.history.slice(0, 4);

  function startActivity(task) {
    mentor.setTask(task);
    onNavigate('studio');
  }

  return (
    <div className="dashboard-page page-stack">
      <section className="dashboard-welcome card">
        <div className="dashboard-welcome__copy">
          <p className="eyebrow">Welcome back</p>
          <h2>Let’s make today’s study session count.</h2>
          <p>Bring your notes, your ideas, and a little curiosity. CloudMentor will help you turn them into useful study material.</p>
          <div className="dashboard-welcome__actions">
            <button type="button" className="primary-button" onClick={() => onNavigate('studio')}>
              <Sparkles size={18} /> Open study studio
            </button>
            <button type="button" className="secondary-button" onClick={mentor.checkHealth}>
              <CheckCircle2 size={18} /> Check backend
            </button>
          </div>
        </div>
        <div className="dashboard-welcome__focus">
          <span>Next activity</span>
          <strong>{mentor.selectedTask.label}</strong>
          <p>{mentor.selectedTask.description}</p>
          <button type="button" onClick={() => onNavigate('studio')}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <section className="stat-grid" aria-label="Study overview">
        <StatCard
          label="Workspace notes"
          value={`${mentor.wordCount.toLocaleString()} words`}
          hint="Ready to use"
          icon={FileText}
          tone="blue"
          onClick={() => onNavigate('studio')}
        />
        <StatCard
          label="Learning assets"
          value={mentor.history.filter((item) => taskMap[item.type]).length}
          hint="Saved in history"
          icon={Layers3}
          tone="violet"
          onClick={() => onNavigate('history')}
        />
        <StatCard
          label="AI mode"
          value={mentor.aiMode}
          hint={mentor.storageMode === 'Unknown' ? 'Check backend' : `${mentor.storageMode} storage`}
          icon={BrainCircuit}
          tone="orange"
        />
        <StatCard
          label="Connection"
          value={connected ? 'Online' : 'Offline'}
          hint={connected ? 'Ready to learn' : 'Start the local backend'}
          icon={CheckCircle2}
          tone={connected ? 'green' : 'red'}
          onClick={mentor.checkHealth}
        />
      </section>

      <section className="dashboard-content-grid">
        <article className="activity-picker card">
          <div className="section-heading section-heading--inline">
            <div>
              <p className="eyebrow">Quick start</p>
              <h2>Choose an activity</h2>
            </div>
            <BookOpen size={22} />
          </div>
          <div className="activity-list">
            {Object.entries(taskMap).map(([key, item]) => {
              const Icon = item.icon;
              return (
                <button type="button" key={key} className="activity-row" onClick={() => startActivity(key)}>
                  <span className="activity-row__icon"><Icon size={18} /></span>
                  <span>
                    <strong>{item.shortLabel}</strong>
                    <small>{item.description}</small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              );
            })}
          </div>
        </article>

        <article className="recent-activity card">
          <div className="section-heading section-heading--inline">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h2>Pick up where you left off</h2>
            </div>
            <Clock3 size={22} />
          </div>
          {mentor.historyLoading ? (
            <p className="muted">Loading your learning history…</p>
          ) : recentItems.length ? (
            <div className="recent-list">
              {recentItems.map((item) => (
                <button type="button" key={item.id} onClick={() => onOpenHistory(item)}>
                  <span className="recent-list__type">{taskMap[item.type]?.shortLabel || item.type}</span>
                  <strong>{item.title}</strong>
                  <small>{formatDate(item.createdAt)}</small>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <div className="blank-card">
              <BrainCircuit size={30} />
              <p>Your generated explanations, quizzes, and plans will appear here.</p>
            </div>
          )}
          <button type="button" className="text-button" onClick={() => onNavigate('history')}>View all history <ArrowRight size={16} /></button>
        </article>
      </section>
    </div>
  );
}
