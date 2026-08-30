export function buildPrompt(action, payload) {
  const notes = sanitizeText(payload.notes || '');
  const subject = sanitizeText(payload.subject || '');
  const topic = sanitizeText(payload.topic || '');
  const problem = sanitizeText(payload.problem || '');
  const materialText = sanitizeText(payload.materialText || '');
  const level = sanitizeText(payload.level || 'beginner');
  const examDate = sanitizeText(payload.examDate || 'not provided');
  const days = clampDays(payload.days || 7);
  const questionCount = clampQuestionCount(payload.questionCount || 5);

  const sharedRules = `
You are CloudMentor, a friendly teaching assistant for students.
Keep the response clear, practical, and age-appropriate.
Avoid unsafe, explicit, or harmful instructions.
Prefer examples that are simple and classroom-friendly.
Student level: ${level}.
`.trim();

  const prompts = {
    explain: `${sharedRules}

Task: Give a detailed, student-friendly explanation that directly solves the student's problem.
Subject: ${subject}
Topic: ${topic}
Student's problem or question:
${problem}

Return ONLY valid JSON. Do not wrap it in Markdown or code fences.
The JSON shape must be exactly:
{
  "type": "explanation",
  "title": "short, helpful title",
  "directAnswer": "a clear answer to the student's problem",
  "sections": [
    {
      "heading": "section heading",
      "content": "a detailed but readable explanation"
    }
  ],
  "workedExample": {
    "title": "short example title",
    "steps": ["step 1", "step 2"]
  },
  "commonMistakes": ["mistake 1", "mistake 2"],
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"]
}
Rules:
- Answer the stated problem first, then teach the topic in enough detail to make the answer understandable.
- Include 3 to 5 meaningful sections, such as core concepts, how it works, why it matters, or how to solve it.
- Give a worked example that fits the subject and topic.
- Explain important terms in plain language inside the relevant section.
- Include practical common mistakes and 3 to 5 concise key takeaways.
- Do not invent facts, sources, or personal details.`,

    quiz: `${sharedRules}

Task: Create an interactive multiple-choice quiz about "${topic}" using ONLY the uploaded study material below as its factual source.
Return ONLY valid JSON. Do not wrap it in Markdown or code fences.
The JSON shape must be exactly:
{
  "type": "quiz",
  "title": "short quiz title",
  "questions": [
    {
      "question": "question text",
      "options": ["A option", "B option", "C option", "D option"],
      "answerIndex": 0,
      "explanation": "one short explanation grounded in the material"
    }
  ],
  "shortAnswerQuestions": ["short answer question 1", "short answer question 2"]
}
Rules:
- Create exactly ${questionCount} multiple-choice questions.
- Each question must have exactly 4 plausible options.
- answerIndex must be a number from 0 to 3.
- Difficulty: ${level}.
- Spread questions across the provided material and test understanding, not memorization only.
- Do not ask anything that requires knowledge absent from the uploaded material.
- Keep explanations short and clearly grounded in the material.

Uploaded study material:
${materialText}`,

    flashcards: `${sharedRules}

Task: Create flashcards from the notes.
Return ONLY valid JSON. Do not wrap it in Markdown or code fences.
The JSON shape must be exactly:
{
  "type": "flashcards",
  "title": "short flashcard deck title",
  "cards": [
    {
      "front": "question or prompt shown first",
      "back": "answer shown after flip",
      "hint": "small hint for active recall"
    }
  ]
}
Rules:
- Create 8 to 10 cards.
- Front should be short and question-like.
- Back should be clear and practical.
- Hint should help recall without giving the full answer.

Notes:
${notes}`,

    studyPlan: `${sharedRules}

Task: Create a meaningful study plan.
Exam date: ${examDate}
Number of days requested: ${days}
Return ONLY valid JSON. Do not wrap it in Markdown or code fences.
The JSON shape must be exactly:
{
  "type": "studyPlan",
  "title": "short plan title",
  "totalDays": ${days},
  "strategy": "one sentence explaining the plan",
  "days": [
    {
      "day": 1,
      "title": "daily title",
      "focus": "main learning focus",
      "activities": ["activity 1", "activity 2", "activity 3"],
      "practice": "daily practical task",
      "outcome": "what the student should achieve"
    }
  ],
  "finalChecklist": ["checklist item 1", "checklist item 2"]
}
Rules:
- The days array must contain exactly ${days} items, no more and no less.
- Day numbers must start at 1 and end at ${days}.
- Each day must include learning, practice, and revision.
- For short plans, compress intelligently. For longer plans, gradually increase practice and revision.
- Make it realistic for students.

Topics or notes:
${notes}`
  };

  return prompts[action] || '';
}

export function titleFor(action, payload) {
  const source = action === 'explain'
    ? payload.topic || payload.problem || payload.subject
    : action === 'quiz'
      ? payload.topic
      : payload.topic || payload.notes || action;
  const compact = sanitizeText(source).replace(/\s+/g, ' ').slice(0, 70);
  const label = {
    explain: 'Explanation',
    quiz: 'Interactive Quiz',
    flashcards: 'Flashcards',
    studyPlan: `${clampDays(payload.days || 7)}-Day Study Plan`,
    progress: 'Progress'
  }[action] || 'AI Response';
  return compact ? `${label}: ${compact}` : label;
}

function sanitizeText(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .trim();
}

function clampDays(value) {
  const days = Number(value || 7);
  if (!Number.isFinite(days)) return 7;
  return Math.min(Math.max(Math.round(days), 1), 30);
}

function clampQuestionCount(value) {
  const count = Number(value || 5);
  if (!Number.isFinite(count)) return 5;
  return Math.min(Math.max(Math.round(count), 1), 15);
}
