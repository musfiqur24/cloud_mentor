import {
  BarChart3,
  BookOpen,
  History,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

const defaultItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'studio', label: 'Study Studio', icon: BookOpen },
  { id: 'history', label: 'History', icon: History },
  { id: 'progress', label: 'Progress', icon: BarChart3 }
];

function AppSidebar({
  activeView = 'dashboard',
  onViewChange,
  items = defaultItems,
  brand = 'CloudMentor',
  collapsed = false,
  onCollapsedChange,
  status,
  className = ''
}) {
  const resolvedStatus = typeof status === 'string' ? { label: status } : status;
  const sidebarClassName = [
    'app-sidebar',
    collapsed ? 'app-sidebar--collapsed' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <aside className={sidebarClassName} aria-label="CloudMentor navigation">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__brand-logo" aria-hidden="true">
          <img src="/assets/cloud_mentor.png" alt="" />
        </div>
        {!collapsed && (
          <div className="app-sidebar__brand-copy">
            <strong>{brand}</strong>
          </div>
        )}
        {onCollapsedChange && (
          <button
            type="button"
            className="app-sidebar__collapse-button"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
      </div>

      <nav className="app-sidebar__nav" aria-label="Main navigation">
        {items.map((item) => {
          const Icon = item.icon || BookOpen;
          const isActive = item.id === activeView;

          return (
            <button
              key={item.id}
              type="button"
              className={`app-sidebar__nav-item ${isActive ? 'is-active' : ''}`}
              onClick={() => onViewChange?.(item.id)}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} aria-hidden="true" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {resolvedStatus && (
        <div className="app-sidebar__status">
          <span
            className={`app-sidebar__status-dot ${resolvedStatus.tone ? `is-${resolvedStatus.tone}` : ''}`}
            aria-hidden="true"
          />
          {!collapsed && (
            <div>
              {resolvedStatus.label && <strong>{resolvedStatus.label}</strong>}
              {resolvedStatus.detail && <span>{resolvedStatus.detail}</span>}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

export { defaultItems as sidebarItems };
export default AppSidebar;
