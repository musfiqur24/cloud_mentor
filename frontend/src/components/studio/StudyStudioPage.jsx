import { TaskTabs } from './TaskTabs.jsx';
import { ExplanationEditor } from './ExplanationEditor.jsx';
import { NotesEditor } from './NotesEditor.jsx';
import { OutputPanel } from './OutputPanel.jsx';
import { QuizEditor } from './QuizEditor.jsx';

export function StudyStudioPage({ mentor }) {
  const InputPanel = mentor.task === 'explain'
    ? ExplanationEditor
    : mentor.task === 'quiz'
      ? QuizEditor
      : NotesEditor;

  return (
    <div className="studio-page page-stack">
      <TaskTabs task={mentor.task} onTaskChange={mentor.setTask} />

      <div className="studio-grid">
        <InputPanel mentor={mentor} />
        <OutputPanel mentor={mentor} />
      </div>
    </div>
  );
}
