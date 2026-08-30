import {
  FileText,
  FileUp,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react';
import { formatBytes } from '../../utils/learning.js';

export function QuizEditor({ mentor }) {
  const SelectedIcon = mentor.selectedTask.icon;
  const selectedTotalBytes = mentor.selectedQuizFiles.reduce((total, file) => total + file.size, 0);
  const uploadLabel = mentor.selectedQuizFiles.length === 1
    ? 'Upload & load file'
    : `Upload & load ${mentor.selectedQuizFiles.length} files`;

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
            <p>Quiz questions use these files only. Add up to five text-based files or searchable PDFs.</p>
          </div>
        </div>

        <label className="file-picker" htmlFor="quiz-study-file">
          <FileUp size={19} />
          <span>{mentor.selectedQuizFiles.length ? `${mentor.selectedQuizFiles.length} file${mentor.selectedQuizFiles.length === 1 ? '' : 's'} chosen` : 'Choose study files for this quiz'}</span>
          <input
            id="quiz-study-file"
            type="file"
            multiple
            accept=".txt,.md,.markdown,.csv,.json,.yaml,.yml,.log,.pdf,application/pdf"
            onChange={mentor.handleQuizFilesChange}
          />
        </label>

        {mentor.selectedQuizFiles.length > 0 && (
          <ul className="quiz-file-list quiz-file-list--queued" aria-label="Files ready to upload">
            {mentor.selectedQuizFiles.map((file) => {
              const signature = `${file.name}:${file.size}:${file.lastModified}`;
              return (
                <li key={signature}>
                  <FileText size={15} aria-hidden="true" />
                  <span title={file.name}>{file.name}</span>
                  <small>{formatBytes(file.size)}</small>
                  <button
                    type="button"
                    onClick={() => mentor.removeSelectedQuizFile(signature)}
                    aria-label={`Remove ${file.name} from the upload list`}
                    title="Remove file"
                  >
                    <X size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="upload-actions">
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={mentor.handleUploadQuizFiles}
            disabled={mentor.quizUploading || mentor.selectedQuizFiles.length === 0}
          >
            {mentor.quizUploading ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
            {mentor.quizUploading ? 'Uploading…' : uploadLabel}
          </button>
          {mentor.selectedQuizFiles.length > 0 && <span className="file-size">{formatBytes(selectedTotalBytes)}</span>}
        </div>

        <p className={`upload-note ${mentor.quizMaterials.length ? 'is-ready' : ''}`}>{mentor.quizUploadInfo}</p>

        {mentor.quizMaterials.length > 0 && (
          <div className="quiz-materials-ready">
            <p className="material-ready">{mentor.quizMaterials.length} study file{mentor.quizMaterials.length === 1 ? '' : 's'} ready for this quiz</p>
            <ul className="quiz-file-list" aria-label="Study files included in this quiz">
              {mentor.quizMaterials.map((material) => (
                <li key={material.key}>
                  <FileText size={15} aria-hidden="true" />
                  <span title={material.originalName}>{material.originalName}</span>
                  <small>{formatBytes(material.sizeBytes)}</small>
                  <button
                    type="button"
                    onClick={() => mentor.removeQuizMaterial(material.key)}
                    aria-label={`Remove ${material.originalName} from this quiz`}
                    title="Remove from quiz"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
        {mentor.loading ? 'Creating your quiz…' : 'Create quiz'}
      </button>
    </section>
  );
}
