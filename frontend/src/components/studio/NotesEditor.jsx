import { FileUp, Loader2, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import { formatBytes } from '../../utils/learning.js';

export function NotesEditor({ mentor }) {
  const SelectedIcon = mentor.selectedTask.icon;

  return (
    <section className="studio-input card">
      <div className="section-heading">
        <div className="section-icon"><SelectedIcon size={21} /></div>
        <div>
          <p className="eyebrow">Study input</p>
          <h2>{mentor.selectedTask.label}</h2>
          <p>{mentor.selectedTask.description}</p>
        </div>
      </div>

      <label className="field-label" htmlFor="notes">Notes or topic</label>
      <textarea
        id="notes"
        value={mentor.notes}
        onChange={(event) => mentor.setNotes(event.target.value)}
        placeholder="Paste class notes, a concept, or a lesson topic here…"
      />
      <div className="field-meta">
        <span>{mentor.wordCount.toLocaleString()} words</span>
        <span>Ready for AI</span>
      </div>

      <div className="upload-card">
        <div className="upload-heading">
          <span className="upload-icon"><UploadCloud size={20} /></span>
          <div>
            <strong>Upload study material</strong>
            <p>Text files can be loaded into your notes automatically.</p>
          </div>
        </div>

        <label className="file-picker" htmlFor="study-file">
          <FileUp size={19} />
          <span>{mentor.selectedFile ? mentor.selectedFile.name : 'Choose a file to add to this workspace'}</span>
          <input
            id="study-file"
            type="file"
            accept=".txt,.md,.markdown,.csv,.json,.yaml,.yml,.log,.pdf,.doc,.docx"
            onChange={mentor.handleFileChange}
          />
        </label>

        <div className="upload-actions">
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={mentor.handleUploadFile}
            disabled={mentor.uploading || !mentor.selectedFile}
          >
            {mentor.uploading ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
            {mentor.uploading ? 'Uploading…' : 'Upload & load'}
          </button>
          {mentor.selectedFile && <span className="file-size">{formatBytes(mentor.selectedFile.size)}</span>}
        </div>
        <p className="upload-note">{mentor.uploadInfo}</p>
      </div>

      <div className="settings-grid">
        <label>
          Level
          <select value={mentor.level} onChange={(event) => mentor.setLevel(event.target.value)}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label>
          Study days
          <input
            type="number"
            min="1"
            max="30"
            value={mentor.days}
            onChange={(event) => mentor.setDays(event.target.value)}
          />
        </label>
      </div>

      <label className="field-label" htmlFor="exam-date">Exam date <span>Optional</span></label>
      <input
        id="exam-date"
        type="date"
        value={mentor.examDate}
        onChange={(event) => mentor.setExamDate(event.target.value)}
      />

      <button
        type="button"
        className="primary-button wide-button"
        onClick={mentor.handleGenerate}
        disabled={mentor.loading || !mentor.notes.trim()}
      >
        {mentor.loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
        {mentor.loading ? 'Creating your learning asset…' : `Create ${mentor.selectedTask.shortLabel}`}
      </button>
    </section>
  );
}

