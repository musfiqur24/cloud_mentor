import { CalendarDays, FileText, GraduationCap, Layers3 } from 'lucide-react';

export const taskMap = {
  summarize: {
    label: 'Summarize notes',
    shortLabel: 'Summary',
    icon: FileText,
    description: 'Turn long notes into concise key points, terms, and revision prompts.'
  },
  quiz: {
    label: 'Generate a quiz',
    shortLabel: 'Quiz',
    icon: GraduationCap,
    description: 'Create an interactive multiple-choice quiz with instant feedback.'
  },
  flashcards: {
    label: 'Create flashcards',
    shortLabel: 'Flashcards',
    icon: Layers3,
    description: 'Convert your material into cards for active recall.'
  },
  studyPlan: {
    label: 'Build a study plan',
    shortLabel: 'Study plan',
    icon: CalendarDays,
    description: 'Create a practical day-by-day plan around your exam date.'
  }
};

export const sampleNotes = `DevOps combines software development and IT operations to deliver applications faster and more reliably. CI/CD automates build, test, and deployment. Docker packages applications into containers. Kubernetes helps run and scale containers across multiple servers. Monitoring and logging help engineers detect incidents quickly.`;

