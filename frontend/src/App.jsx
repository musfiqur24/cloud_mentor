import { useState } from 'react';
import { AlertCircle, LogOut, RefreshCw, X } from 'lucide-react';
import AuthPage from './components/auth/AuthPage.jsx';
import AppSidebar from './components/layout/AppSidebar.jsx';
import TopBar from './components/layout/TopBar.jsx';
import { DashboardPage } from './components/dashboard/DashboardPage.jsx';
import { HistoryPage } from './components/history/HistoryPage.jsx';
import { ProgressPage } from './components/progress/ProgressPage.jsx';
import { StudyStudioPage } from './components/studio/StudyStudioPage.jsx';
import { useAuth } from './hooks/useAuth.js';
import { useCloudMentor } from './hooks/useCloudMentor.js';

const pageMeta = {
  dashboard: { title: 'Dashboard' },
  studio: { title: 'Study Studio' },
  history: { title: 'History' },
  progress: { title: 'Progress' }
};

function Workspace({ auth }) {
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

  function handleHeaderRefresh() {
    if (activeView === 'studio') mentor.resetStudioOutput();
    void mentor.checkHealth();
  }

  async function handleSignOut() {
    try {
      await auth.signOut();
    } catch {
      // The local session is intentionally cleared even if the API is offline.
    }
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
        <div className={`app-header ${activeView === 'studio' ? 'app-header--compact' : ''}`}>
          <TopBar
            className={activeView === 'studio' ? 'top-bar--compact' : ''}
            title={currentPage.title}
            status={connectionStatus}
            actions={(
              <>
                <button type="button" className="secondary-button topbar-action" onClick={handleHeaderRefresh}>
                  <RefreshCw size={16} /> Refresh
                </button>
                <button type="button" className="secondary-button topbar-action topbar-signout" onClick={handleSignOut} title={`Sign out ${auth.user.name}`}>
                  <LogOut size={16} /> Sign out
                </button>
              </>
            )}
          />
        </div>

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

function AuthLoading() {
  return (
    <main className="auth-loading" aria-live="polite">
      <img src="/assets/cloud_mentor.png" alt="CloudMentor" />
      <span>Restoring your workspace…</span>
    </main>
  );
}

function App() {
  const auth = useAuth();

  if (auth.loading) return <AuthLoading />;
  if (!auth.user) return <AuthPage auth={auth} />;

  // A new key cleanly remounts all learning state when a different account
  // signs in on the same browser.
  return <Workspace key={auth.user.id} auth={auth} />;
}

export default App;
