import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper function to lazy initialize Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('Ключ GEMINI_API_KEY не знайдено в налаштуваннях.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// API endpoint for generating questions
app.post('/api/generate-questions', async (req, res) => {
  try {
    const { topics, customPrompt, count = 12 } = req.body;
    
    // Check key before proceeding
    const ai = getGeminiClient();

    const selectedTopicsText = topics && topics.length > 0 
      ? `Вибери питання з наступних тем:\n${topics.join('\n')}`
      : 'Охопи рівномірно всі теми математики за 6 клас за підручником Істер.';

    const systemInstruction = `Ти — висококваліфікований вчитель математики, який складає підсумковий тест за 6 клас за підручником Істер.
Створи тест на ${count} питань. Кожне питання має бути унікальним, з 4 варіантами відповідей (один з яких правильний).
Формат запису має бути виключно українською мовою.
Усі математичні позначення записуй у звичайному текстовому вигляді (наприклад, "2/3", "x : 6 = 5 : 3", "|-4.5|").
Кожне питання має містити докладне крок-за-кроком пояснення розв'язання (explanation) українською мовою.

${selectedTopicsText}

Додаткові побажання: ${customPrompt || 'немає'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Згенеруй завдання для тесту відповідно до інструкцій.',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { 
                type: Type.STRING,
                description: "Унікальний ідентифікатор питання, наприклад 'q_gen_1'"
              },
              title: { 
                type: Type.STRING,
                description: "Текст запитання у ввічливій та чіткій формі"
              },
              topic: { 
                type: Type.STRING,
                description: "Назва головної теми із запиту користувача"
              },
              subtopic: { 
                type: Type.STRING,
                description: "Конкретна підтема"
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Рівно 4 варіанти відповіді"
              },
              correctAnswer: { 
                type: Type.STRING,
                description: "Точний правильний варіант відповіді (має збігатися з одним із варіантів в масиві options)"
              },
              points: { 
                type: Type.INTEGER,
                description: "Кількість балів за питання (зазвичай 1)"
              },
              explanation: { 
                type: Type.STRING,
                description: "Докладне математичне роз’яснення, чому саме ця відповідь є правильною та як її отримати"
              }
            },
            required: ['id', 'title', 'topic', 'subtopic', 'options', 'correctAnswer', 'points', 'explanation']
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Порожня відповідь від моделі.');
    }

    const questions = JSON.parse(text);
    res.json({ success: true, questions });
  } catch (error: any) {
    console.error('Помилка генерації питань:', error);
    res.status(500).json({ success: false, error: error.message || 'Внутрішня помилка сервера' });
  }
});

// Serve Vite in dev mode, static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
