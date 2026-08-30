import { CalendarDays, GraduationCap, Layers3, MessageCircleQuestionMark } from 'lucide-react';

export const taskMap = {
  explain: {
    label: 'Explain a problem',
    shortLabel: 'Explanation',
    icon: MessageCircleQuestionMark,
    description: 'Get a detailed, clear explanation for one subject, topic, and problem.'
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
