import { Menu } from 'lucide-react';

function TopBar({
  title = 'Dashboard',
  status,
  onMenuToggle,
  actions,
  className = ''
}) {
  const resolvedStatus = typeof status === 'string' ? { label: status } : status;
  const topBarClassName = ['top-bar', className].filter(Boolean).join(' ');

  return (
    <header className={topBarClassName}>
      <div className="top-bar__heading">
        {onMenuToggle && (
          <button
            type="button"
            className="top-bar__menu-button"
            onClick={onMenuToggle}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
        )}
        <div>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="top-bar__actions">
        {resolvedStatus && (
          <div className={`top-bar__status ${resolvedStatus.tone ? `is-${resolvedStatus.tone}` : ''}`}>
            <span className="top-bar__status-dot" aria-hidden="true" />
            <span>{resolvedStatus.label}</span>
          </div>
        )}
        {actions}
      </div>
    </header>
  );
}

export default TopBar;
