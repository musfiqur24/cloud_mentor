import { useState } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import AppSidebar from './components/layout/AppSidebar.jsx';
import TopBar from './components/layout/TopBar.jsx';
import { DashboardPage } from './components/dashboard/DashboardPage.jsx';
import { HistoryPage } from './components/history/HistoryPage.jsx';
import { ProgressPage } from './components/progress/ProgressPage.jsx';
import { StudyStudioPage } from './components/studio/StudyStudioPage.jsx';
import { useCloudMentor } from './hooks/useCloudMentor.js';

const pageMeta = {
  dashboard: {
    title: 'Dashboard',
    description: 'Your study work, in one calm place.'
  },
  studio: {
    title: 'Study Studio',
    description: 'Create a focused learning asset from your material.'
  },
  history: {
    title: 'History',
    description: 'Revisit the study work you have already created.'
  },
  progress: {
    title: 'Progress',
    description: 'Track your confidence and keep moving forward.'
  }
};

function App() {
  const mentor = useCloudMentor();
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const currentPage = pageMeta[activeView] || pageMeta.dashboard;
  const connected = mentor.status === 'Connected';
  const connectionStatus = {
    label: connected ? 'Backend online' : mentor.status === 'Checking' ? 'Checking backend' : 'Backend offline',
    detail: connected ? `${mentor.aiMode} AI · ${mentor.storageMode} storage` : 'Start SAM Local to connect',
    tone: connected ? 'success' : 'warning'
  };

  function openHistoryItem(item) {
    mentor.openHistoryItem(item);
    setActiveView(item.type === 'progress' ? 'progress' : 'studio');
  }

  function renderActiveView() {
    if (activeView === 'studio') return <StudyStudioPage mentor={mentor} />;
    if (activeView === 'history') return <HistoryPage mentor={mentor} onOpenHistory={openHistoryItem} />;
    if (activeView === 'progress') return <ProgressPage mentor={mentor} />;

    return <DashboardPage mentor={mentor} onNavigate={setActiveView} onOpenHistory={openHistoryItem} />;
  }

  return (
    <div className={`dashboard-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <AppSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        status={connectionStatus}
      />

      <main className="dashboard-main">
        <TopBar
          eyebrow="CloudMentor workspace"
          title={currentPage.title}
          description={currentPage.description}
          status={connectionStatus}
          actions={(
            <button type="button" className="secondary-button topbar-action" onClick={mentor.checkHealth}>
              <RefreshCw size={16} /> Refresh
            </button>
          )}
        />

        {mentor.error && (
          <section className="app-alert" role="alert" aria-live="polite">
            <AlertCircle size={19} />
            <div>
              <strong>Connection issue</strong>
              <p>{mentor.error}</p>
            </div>
            <button type="button" onClick={mentor.clearError} aria-label="Dismiss issue"><X size={18} /></button>
          </section>
        )}

        <div className="page-content">
          {renderActiveView()}
        </div>
      </main>
    </div>
  );
}

export default App;
