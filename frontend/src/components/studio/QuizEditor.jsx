import { FileUp, Loader2, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import { formatBytes } from '../../utils/learning.js';

export function QuizEditor({ mentor }) {
  const SelectedIcon = mentor.selectedTask.icon;

  return (
    <section className="studio-input card">
      <div className="section-heading">
        <div className="section-icon"><SelectedIcon size={21} /></div>
        <div className="section-heading__copy">
          <h2>Generate a quiz</h2>
          <p>Choose a topic, then upload the study material that the quiz must use.</p>
        </div>
      </div>

      <label className="field-label" htmlFor="quiz-topic">Topic name</label>
      <input
        id="quiz-topic"
        value={mentor.quizTopic}
        onChange={(event) => mentor.setQuizTopic(event.target.value)}
        placeholder="For example: Docker containers"
      />

      <div className="upload-card upload-card--required">
        <div className="upload-heading">
          <span className="upload-icon"><UploadCloud size={20} /></span>
          <div>
            <strong>Upload study material <span className="required-mark">Required</span></strong>
            <p>Quiz questions use only this file. Upload a text-based file or searchable PDF to continue.</p>
          </div>
        </div>

        <label className="file-picker" htmlFor="quiz-study-file">
          <FileUp size={19} />
          <span>{mentor.selectedFile ? mentor.selectedFile.name : 'Choose a study file for this quiz'}</span>
          <input
            id="quiz-study-file"
            type="file"
            accept=".txt,.md,.markdown,.csv,.json,.yaml,.yml,.log,.pdf,application/pdf"
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
            {mentor.uploading ? 'Uploading...' : 'Upload & load'}
          </button>
          {mentor.selectedFile && <span className="file-size">{formatBytes(mentor.selectedFile.size)}</span>}
        </div>
        <p className={`upload-note ${mentor.quizMaterial ? 'is-ready' : ''}`}>{mentor.uploadInfo}</p>
        {mentor.quizMaterial && <p className="material-ready">Material ready: {mentor.quizMaterial.originalName}</p>}
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
          Number of questions
          <select value={mentor.quizCount} onChange={(event) => mentor.setQuizCount(event.target.value)}>
            <option value="5">5 questions</option>
            <option value="10">10 questions</option>
            <option value="15">15 questions</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        className="primary-button wide-button"
        onClick={mentor.handleGenerate}
        disabled={mentor.loading || !mentor.quizReady}
      >
        {mentor.loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
        {mentor.loading ? 'Creating your quiz...' : 'Create quiz'}
      </button>
    </section>
  );
}
