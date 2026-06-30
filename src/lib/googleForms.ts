import { Question, QuizSettings } from '../types';

export interface FormCreationProgress {
  step: 'idle' | 'creating' | 'configuring' | 'adding_questions' | 'finalizing' | 'success' | 'error';
  currentQuestionIndex?: number;
  totalQuestions?: number;
  errorMsg?: string;
  formId?: string;
  responderUri?: string;
  editUri?: string;
}

export async function createGoogleFormQuiz(
  accessToken: string,
  settings: QuizSettings,
  questions: Question[],
  onProgress: (progress: FormCreationProgress) => void
) {
  try {
    // Step 1: Create the form document
    onProgress({ step: 'creating' });
    
    const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        info: {
          title: settings.title,
          documentTitle: settings.title
        }
      })
    });

    if (!createRes.ok) {
      const errData = await createRes.json();
      throw new Error(errData?.error?.message || 'Не вдалося створити порожню Google форму.');
    }

    const formData = await createRes.json();
    const formId = formData.formId;
    const responderUri = formData.responderUri; // Live link
    const editUri = `https://docs.google.com/forms/d/${formId}/edit`;

    onProgress({ step: 'configuring' });

    // Step 2: Build the batchUpdate requests
    const requests: any[] = [
      // Make it a quiz
      {
        updateSettings: {
          settings: {
            quizSettings: {
              isQuiz: true
            }
          },
          updateMask: 'quizSettings.isQuiz'
        }
      }
    ];

    // Update form description if provided
    if (settings.description) {
      requests.push({
        updateFormInfo: {
          info: {
            description: settings.description
          },
          updateMask: 'description'
        }
      });
    }

    // Add each question
    questions.forEach((q, idx) => {
      requests.push({
        createItem: {
          item: {
            title: q.title,
            description: `Тема: ${q.topic} | ${q.subtopic}`,
            questionItem: {
              question: {
                required: true,
                grading: {
                  pointValue: q.points || settings.pointsPerQuestion || 1,
                  correctAnswers: {
                    answers: [
                      { value: q.correctAnswer }
                    ]
                  },
                  // Add answer explanation as general feedback
                  generalFeedback: {
                    text: q.explanation
                  }
                },
                choiceQuestion: {
                  type: 'RADIO',
                  options: q.options.map(opt => ({ value: opt })),
                  shuffle: true
                }
              }
            }
          },
          location: {
            index: idx
          }
        }
      });
    });

    // Step 3: Run the batchUpdate
    onProgress({ step: 'adding_questions', totalQuestions: questions.length, currentQuestionIndex: 0 });

    const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });

    if (!updateRes.ok) {
      const errData = await updateRes.json();
      throw new Error(errData?.error?.message || 'Не вдалося додати запитання до форми.');
    }

    onProgress({ step: 'finalizing' });
    
    // Simulate a brief finalization pause for smoother UI transition
    await new Promise(resolve => setTimeout(resolve, 800));

    onProgress({
      step: 'success',
      formId,
      responderUri,
      editUri
    });

  } catch (error: any) {
    console.error('Помилка створення форми:', error);
    onProgress({
      step: 'error',
      errorMsg: error.message || 'Сталася невідома помилка під час створення форми.'
    });
  }
}
