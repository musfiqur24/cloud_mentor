import { taskMap } from '../../constants/tasks.js';

export function TaskTabs({ task, onTaskChange }) {
  return (
    <div className="task-tabs" role="tablist" aria-label="Learning activity">
      {Object.entries(taskMap).map(([key, item]) => {
        const Icon = item.icon;
        return (
          <button
            type="button"
            role="tab"
            aria-selected={task === key}
            className={`task-tab ${task === key ? 'active' : ''}`}
            key={key}
            onClick={() => onTaskChange(key)}
          >
            <Icon size={17} />
            <span>{item.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

