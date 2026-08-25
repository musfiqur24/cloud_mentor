import { TaskTabs } from './TaskTabs.jsx';
import { NotesEditor } from './NotesEditor.jsx';
import { OutputPanel } from './OutputPanel.jsx';

export function StudyStudioPage({ mentor }) {
  return (
    <div className="studio-page page-stack">
      <section className="page-intro compact-intro">
        <div>
          <p className="eyebrow">Study studio</p>
          <h1>Bring one topic into focus.</h1>
          <p>Choose one activity, add your material, and give yourself a calm place to think it through.</p>
        </div>
      </section>

      <TaskTabs task={mentor.task} onTaskChange={mentor.setTask} />

      <div className="studio-grid">
        <NotesEditor mentor={mentor} />
        <OutputPanel mentor={mentor} />
      </div>
    </div>
  );
}
