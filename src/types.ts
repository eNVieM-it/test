export interface Question {
  id: string;
  title: string;
  topic: string;
  subtopic: string;
  options: string[];
  correctAnswer: string;
  points: number;
  explanation: string;
}

export interface QuizSettings {
  title: string;
  description: string;
  pointsPerQuestion: number;
}
