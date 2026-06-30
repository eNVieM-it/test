import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, CheckCircle2, AlertCircle, LogOut, FileEdit, Plus, Trash2, Settings, 
  Check, Eye, Share2, ExternalLink, ChevronDown, ChevronUp, BookOpen, 
  HelpCircle, RefreshCw, Sliders, Info, ClipboardCopy, ArrowRight, UserCheck
} from 'lucide-react';
import { DEFAULT_QUESTIONS } from './data/defaultQuestions';
import { Question, QuizSettings } from './types';
import { googleSignIn, initAuth, logout } from './lib/firebase';
import { createGoogleFormQuiz, FormCreationProgress } from './lib/googleForms';

const ALL_TOPICS = [
  '2. Звичайні дроби та дії з ними',
  '3. Відношення і пропорції',
  '4. Раціональні числа та дії з ними',
  '5. Вирази та рівняння',
  '6. Координати та графіки',
  '7. Геометричні фігури та тіла'
];

export default function App() {
  // Auth State
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Quiz Setup State
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(
    new Set(DEFAULT_QUESTIONS.map(q => q.id))
  );
  
  const [settings, setSettings] = useState<QuizSettings>({
    title: 'Підсумкова контрольна робота з математики за 6 клас',
    description: 'Тест за весь навчальний рік за підручником О.С. Істера. Містить 12 тестових завдань з автоматичною перевіркою.',
    pointsPerQuestion: 1
  });

  // Sidebar filters and generation state
  const [activeTopics, setActiveTopics] = useState<Set<string>>(new Set(ALL_TOPICS));
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // UI Interactive States
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Question | null>(null);
  const [expandedExplanationId, setExpandedExplanationId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modal / Confirm States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [progress, setProgress] = useState<FormCreationProgress>({ step: 'idle' });
  const [showProgressModal, setShowProgressModal] = useState(false);

  // Initialize Firebase Auth
  useEffect(() => {
    initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
        setToken(null);
      }
    );
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Помилка входу:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
  };

  // Toggle single question inclusion
  const toggleQuestionSelection = (id: string) => {
    const updated = new Set(selectedQuestionIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedQuestionIds(updated);
  };

  // Toggle all visible questions
  const toggleSelectAllVisible = (visibleQuestions: Question[]) => {
    const updated = new Set(selectedQuestionIds);
    const visibleIds = visibleQuestions.map(q => q.id);
    const allVisibleSelected = visibleIds.every(id => updated.has(id));

    if (allVisibleSelected) {
      // Deselect all visible
      visibleIds.forEach(id => updated.delete(id));
    } else {
      // Select all visible
      visibleIds.forEach(id => updated.add(id));
    }
    setSelectedQuestionIds(updated);
  };

  // Inline Question Editing
  const startEditing = (q: Question) => {
    setEditingQuestionId(q.id);
    setEditForm({ ...q, options: [...q.options] });
  };

  const saveQuestionEdit = () => {
    if (!editForm) return;
    setQuestions(questions.map(q => q.id === editForm.id ? editForm : q));
    setEditingQuestionId(null);
    setEditForm(null);
  };

  const handleOptionChange = (idx: number, val: string) => {
    if (!editForm) return;
    const updatedOptions = [...editForm.options];
    const prevOptionValue = updatedOptions[idx];
    updatedOptions[idx] = val;

    let updatedCorrectAnswer = editForm.correctAnswer;
    if (editForm.correctAnswer === prevOptionValue) {
      updatedCorrectAnswer = val;
    }

    setEditForm({
      ...editForm,
      options: updatedOptions,
      correctAnswer: updatedCorrectAnswer
    });
  };

  // Delete Question
  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    const updated = new Set(selectedQuestionIds);
    updated.delete(id);
    setSelectedQuestionIds(updated);
  };

  // Add a new blank question
  const addNewQuestion = () => {
    const newId = `q_custom_${Date.now()}`;
    const newQ: Question = {
      id: newId,
      topic: ALL_TOPICS[0],
      subtopic: 'Нова підтема',
      title: 'Введіть текст вашого запитання тут...',
      options: ['Варіант А', 'Варіант Б', 'Варіант В', 'Варіант Г'],
      correctAnswer: 'Варіант А',
      points: 1,
      explanation: 'Введіть пояснення розв’язання сюди...'
    };
    setQuestions([newQ, ...questions]);
    const updated = new Set(selectedQuestionIds);
    updated.add(newId);
    setSelectedQuestionIds(updated);
    startEditing(newQ);
  };

  // AI Generation Call to Server Endpoint
  const handleAIGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topics: Array.from(activeTopics),
          customPrompt,
          count: 12
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не вдалося згенерувати питання за допомогою ШІ.');
      }

      setQuestions(data.questions);
      setSelectedQuestionIds(new Set(data.questions.map((q: Question) => q.id)));
      setCustomPrompt('');
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || 'Сталася помилка з’єднання із сервером генерації.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Deploy to Google Forms
  const handleDeployForm = async () => {
    if (!token) {
      handleLogin();
      return;
    }

    setShowConfirmModal(false);
    setShowProgressModal(true);
    
    const activeExportQuestions = questions.filter(q => selectedQuestionIds.has(q.id));
    
    await createGoogleFormQuiz(
      token,
      settings,
      activeExportQuestions,
      (currentProgress) => {
        setProgress(currentProgress);
      }
    );
  };

  // Filter questions based on selected topics in the sidebar filter
  const filteredQuestions = questions.filter(q => activeTopics.has(q.topic));
  const selectedExportCount = questions.filter(q => selectedQuestionIds.has(q.id)).length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Top Header */}
      <header className="bg-indigo-700 text-white py-5 px-6 sticky top-0 z-10 shadow-lg shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/10 rounded-xl text-white shadow-sm">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-mono text-indigo-200 font-bold tracking-widest uppercase">За підручником О.С. Істера (Річний курс)</span>
              <h1 className="font-display text-xl font-bold tracking-tight text-white mt-0.5">Істер-Конструктор Тестів</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* User Session Handler */}
            {user ? (
              <div className="flex items-center gap-3 bg-white/10 p-1.5 pr-4 rounded-full border border-white/20">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-white shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm">
                    {user.displayName?.[0] || 'U'}
                  </div>
                )}
                <div className="text-left hidden md:block">
                  <p className="text-xs font-semibold text-white line-clamp-1">{user.displayName}</p>
                  <p className="text-[10px] font-mono text-indigo-200">{user.email}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  title="Вийти з акаунту"
                  className="p-1.5 hover:bg-white/10 rounded-full text-indigo-200 hover:text-red-300 transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="inline-flex items-center gap-2 bg-white hover:bg-indigo-50 text-indigo-700 font-bold text-sm py-2.5 px-5 rounded-lg shadow-xs transition-all disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.6c-.28 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.08 3.58-5.14 3.58-8.62z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.86-3c-1.08.72-2.45 1.16-4.1 1.16-3.14 0-5.8-2.11-6.75-4.96H1.21v3.15C3.18 21.88 7.31 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.25 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.56H1.21C.44 8.11 0 9.85 0 11.7s.44 3.59 1.21 5.14l3.15-2.45c-.24-.71-.38-1.48-.38-2.29z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.96 1.19 15.24 0 12 0 7.31 0 3.18 2.12 1.21 5.14l4.04 3.15c.95-2.84 3.61-4.95 6.75-4.95z"/>
                  </svg>
                )}
                <span>Увійти через Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Control Panel (Columns 1-4) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Section 1: Form Meta Information */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Settings className="w-5 h-5 text-indigo-600" />
              <h2 className="font-display font-bold text-slate-800">Налаштування тесту</h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Назва тесту</label>
              <input
                type="text"
                value={settings.title}
                onChange={e => setSettings({ ...settings, title: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden transition-all"
                placeholder="Введіть назву форми..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Опис тесту</label>
              <textarea
                value={settings.description}
                onChange={e => setSettings({ ...settings, description: e.target.value })}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden transition-all resize-none"
                placeholder="Короткий опис або інструкція..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Балів за питання</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={settings.pointsPerQuestion}
                    onChange={e => setSettings({ ...settings, pointsPerQuestion: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-sm text-slate-800 font-mono focus:bg-white focus:border-indigo-500 outline-hidden"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">PTS</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Всього питань</label>
                <div className="w-full bg-slate-100 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold font-mono flex items-center justify-between">
                  <span>Обрано:</span>
                  <span className="text-indigo-600 font-bold">{selectedExportCount} / {questions.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Interactive Topics Filters */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <h2 className="font-display font-bold text-slate-800">Теми підручника</h2>
              </div>
              <button 
                onClick={() => {
                  if (activeTopics.size === ALL_TOPICS.length) {
                    setActiveTopics(new Set());
                  } else {
                    setActiveTopics(new Set(ALL_TOPICS));
                  }
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
              >
                {activeTopics.size === ALL_TOPICS.length ? 'Зняти всі' : 'Обрати всі'}
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {ALL_TOPICS.map((topic) => {
                const isChecked = activeTopics.has(topic);
                const count = questions.filter(q => q.topic === topic).length;
                return (
                  <label 
                    key={topic} 
                    className={`flex items-start gap-3 p-2.5 rounded-xl border text-left cursor-pointer transition-all select-none ${
                      isChecked 
                        ? 'border-indigo-200 bg-indigo-50/50 text-indigo-950 font-medium shadow-xs' 
                        : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const updated = new Set(activeTopics);
                        if (updated.has(topic)) {
                          updated.delete(topic);
                        } else {
                          updated.add(topic);
                        }
                        setActiveTopics(updated);
                      }}
                      className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold leading-tight">{topic}</p>
                      <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">{count} питань доступно</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 3: Gemini AI Generation Integration */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-950 to-indigo-950 text-white rounded-3xl p-6 shadow-xl space-y-4 relative overflow-hidden">
            {/* Ambient decorative gradient bubbles */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500 rounded-full blur-3xl opacity-20 -ml-10 -mb-10 pointer-events-none"></div>

            <div className="flex items-center gap-2 pb-2 border-b border-indigo-900/40 relative">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
              <h2 className="font-display font-bold text-white">ШІ-Генерація з Gemini</h2>
            </div>

            <p className="text-xs text-indigo-200 leading-relaxed">
              Хочете повністю змінити питання чи створити новий варіант тесту? Оберіть потрібні теми вище та натисніть кнопку для миттєвої генерації нових завдань.
            </p>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">Особливі побажання до тесту</label>
              <input
                type="text"
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="напр. більше текстових задач, висока складність..."
                className="w-full bg-white/10 border border-indigo-800/60 rounded-xl px-4 py-2.5 text-xs text-white placeholder-indigo-300/60 focus:bg-white/15 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden transition-all"
              />
            </div>

            {generationError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{generationError}</span>
              </div>
            )}

            <button
              onClick={handleAIGenerate}
              disabled={isGenerating || activeTopics.size === 0}
              className="w-full cursor-pointer bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-950/40 hover:shadow-indigo-950/60 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
                  <span>Генерування за замовленням...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>Згенерувати новий тест</span>
                </>
              )}
            </button>
          </div>

          {/* Section 4: Trigger Export Form Actions */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center gap-2 pb-1">
              <Info className="w-4.5 h-4.5 text-indigo-600" />
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Експорт у Google Форми</h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              Створення відбудеться безпосередньо у вашому особистому сховищі Google Диск з урахуванням усіх налаштувань та обраних завдань.
            </p>

            {needsAuth ? (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    Для експорту тесту в Google Форми необхідно авторизувати додаток через ваш Google Акаунт.
                  </div>
                </div>
                
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full cursor-pointer inline-flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3.5 px-6 rounded-xl shadow-md shadow-indigo-100 hover:shadow-lg hover:shadow-indigo-200 transition-all"
                >
                  <UserCheck className="w-5 h-5" />
                  <span>Авторизуватись для експорту</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={selectedExportCount === 0}
                className="w-full cursor-pointer inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Створити Google Форму</span>
              </button>
            )}
          </div>

        </div>

        {/* Right Preview Panel (Columns 5-12) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section Header */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
              <h2 className="font-display font-bold text-slate-800 text-base">
                Попередній перегляд питань ({filteredQuestions.length})
              </h2>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => toggleSelectAllVisible(filteredQuestions)}
                className="flex-1 sm:flex-initial text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Вибрати/Зняти всі
              </button>
              <button
                onClick={addNewQuestion}
                className="flex-1 sm:flex-initial text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Додати питання</span>
              </button>
            </div>
          </div>

          {/* List of Questions */}
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredQuestions.map((q, qIndex) => {
                const isSelected = selectedQuestionIds.has(q.id);
                const isEditing = editingQuestionId === q.id;
                const isExplanationExpanded = expandedExplanationId === q.id;

                return (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`bg-white rounded-3xl border transition-all ${
                      isSelected 
                        ? 'border-indigo-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-indigo-100/30' 
                        : 'border-slate-200/60 opacity-70'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="p-4 sm:p-5 flex items-start gap-4 border-b border-slate-100">
                      {/* Checkbox Selector */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleQuestionSelection(q.id)}
                        className="mt-1.5 rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5 cursor-pointer"
                      />

                      {/* Title & Badges */}
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">
                            Питання #{qIndex + 1}
                          </span>
                          <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[11px] font-bold uppercase tracking-tight">
                            {q.topic}
                          </span>
                          <span className="text-[10px] bg-slate-50 text-slate-500 px-2.5 py-0.5 rounded-full font-medium">
                            {q.subtopic}
                          </span>
                        </div>

                        {/* Editable or Static Question Title */}
                        {isEditing ? (
                          <div className="pt-2">
                            <label className="block text-[10px] text-slate-400 font-semibold uppercase mb-1">Формулювання питання</label>
                            <input
                              type="text"
                              value={editForm?.title}
                              onChange={e => setEditForm({ ...editForm!, title: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-hidden focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        ) : (
                          <h3 className="text-slate-800 font-bold text-lg pt-1.5 leading-relaxed">
                            {q.title}
                          </h3>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isEditing ? (
                          <button
                            onClick={saveQuestionEdit}
                            className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors cursor-pointer"
                            title="Зберегти"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => startEditing(q)}
                            className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            title="Редагувати"
                          >
                            <FileEdit className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteQuestion(q.id)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Видалити"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Options Details */}
                    <div className="p-4 sm:p-5 bg-slate-50/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {q.options.map((option, idx) => {
                        const isCorrect = option === q.correctAnswer;
                        return (
                          <div key={idx} className="relative">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct-${q.id}`}
                                  checked={editForm?.correctAnswer === option}
                                  onChange={() => setEditForm({ ...editForm!, correctAnswer: option })}
                                  className="text-indigo-600 focus:ring-indigo-500"
                                />
                                <input
                                  type="text"
                                  value={editForm?.options[idx]}
                                  onChange={e => handleOptionChange(idx, e.target.value)}
                                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 outline-hidden"
                                />
                              </div>
                            ) : (
                              <div className={`group flex items-center p-4 border rounded-2xl transition-all justify-between ${
                                isCorrect 
                                  ? 'border-2 border-indigo-600 bg-indigo-50/50 shadow-sm text-indigo-900 font-bold' 
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium shadow-xs'
                              }`}>
                                <div className="flex items-center gap-3">
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    isCorrect ? 'border-indigo-600 bg-indigo-600 text-white font-bold' : 'border-slate-300 text-slate-400'
                                  }`}>
                                    {isCorrect ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <span className="text-[10px] font-bold">{String.fromCharCode(65 + idx)}</span>
                                    )}
                                  </div>
                                  <span className="text-sm">{option}</span>
                                </div>
                                {isCorrect && (
                                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Правильно
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Step by Step Explanation Panel */}
                    <div className="border-t border-slate-100">
                      <button
                        onClick={() => setExpandedExplanationId(isExplanationExpanded ? null : q.id)}
                        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 text-xs text-slate-500 hover:text-indigo-900 hover:bg-slate-50/30 transition-all cursor-pointer font-semibold"
                      >
                        <span className="flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4 text-indigo-500" />
                          Крок за кроком розв’язання
                        </span>
                        {isExplanationExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      <AnimatePresence initial={false}>
                        {isExplanationExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden bg-slate-50/20"
                          >
                            <div className="px-4 sm:px-5 pb-4 pt-1 text-xs text-slate-600 border-t border-slate-100/50 leading-relaxed font-sans">
                              {isEditing ? (
                                <div className="mt-2">
                                  <label className="block text-[10px] text-slate-400 font-semibold uppercase mb-1">Пояснення розв’язання</label>
                                  <textarea
                                    value={editForm?.explanation}
                                    onChange={e => setEditForm({ ...editForm!, explanation: e.target.value })}
                                    rows={2}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 outline-hidden resize-none"
                                  />
                                </div>
                              ) : (
                                <div className="bg-slate-100/60 p-3.5 rounded-xl border border-slate-200/50">
                                  {q.explanation}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredQuestions.length === 0 && (
              <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">Немає завдань за обраними темами.</p>
                <p className="text-xs text-slate-400 mt-1">Оберіть інші теми у бічній панелі або згенеруйте новий тест.</p>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 px-8 flex flex-col sm:flex-row items-center justify-between shrink-0 text-[11px] font-medium text-slate-400 mt-12">
        <div className="flex gap-6 uppercase tracking-wider mb-2 sm:mb-0">
          <span>Тест: 6 клас</span>
          <span>Варіант: II</span>
          <span>Складність: Середня</span>
        </div>
        <div>
          <span>© 2026 Істер-Конструктор Тестів. Створено з використанням Google Forms API та Gemini AI.</span>
        </div>
      </footer>

      {/* CONFIRM EXPORT MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 border border-slate-200/60 shadow-2xl space-y-5">
            <h3 className="font-display font-bold text-xl text-slate-900">Підтвердження експорту</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Ви збираєтесь створити нову Google Форму у вашому хмарному сховищі Google Drive з назвою:
              <strong className="block text-slate-850 font-bold mt-1">"{settings.title}"</strong>
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Кількість завдань:</span>
                <span className="font-semibold text-slate-850 font-mono">{selectedExportCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Балів за завдання:</span>
                <span className="font-semibold text-slate-850 font-mono">{settings.pointsPerQuestion}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-1.5 mt-1.5 font-semibold">
                <span className="text-slate-600">Всього балів:</span>
                <span className="text-indigo-600 font-mono">{selectedExportCount * settings.pointsPerQuestion}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 cursor-pointer border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 rounded-xl text-xs font-bold"
              >
                Скасувати
              </button>
              <button
                onClick={handleDeployForm}
                className="flex-1 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-100"
              >
                Підтвердити створення
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEPLOY PROGRESS AND SUCCESS MODAL */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 border border-slate-200/60 shadow-2xl relative overflow-hidden">
            
            <AnimatePresence mode="wait">
              
              {/* STAGE: LOADING & CREATING */}
              {(progress.step === 'creating' || progress.step === 'configuring' || progress.step === 'adding_questions' || progress.step === 'finalizing') && (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-6 text-center py-6"
                >
                  <div className="relative w-16 h-16 mx-auto">
                    {/* Pulsing circular background */}
                    <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                    <div className="relative w-16 h-16 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                      <RefreshCw className="w-8 h-8 animate-spin" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-display font-bold text-lg text-slate-900">Створення Google Форми</h3>
                    
                    {progress.step === 'creating' && (
                      <p className="text-xs text-slate-500">Створюємо порожню структуру форми у вашому акаунті...</p>
                    )}
                    {progress.step === 'configuring' && (
                      <p className="text-xs text-slate-500">Налаштовуємо режим тестування та параметри оцінювання...</p>
                    )}
                    {progress.step === 'adding_questions' && (
                      <p className="text-xs text-slate-500">Додаємо та форматуємо обрані завдання...</p>
                    )}
                    {progress.step === 'finalizing' && (
                      <p className="text-xs text-slate-500">Зберігаємо форму та генеруємо посилання доступу...</p>
                    )}
                  </div>

                  {/* Pseudo progress bar */}
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{
                        width: 
                          progress.step === 'creating' ? '25%' :
                          progress.step === 'configuring' ? '50%' :
                          progress.step === 'adding_questions' ? '75%' : '90%'
                      }}
                    ></div>
                  </div>
                </motion.div>
              )}

              {/* STAGE: ERROR */}
              {progress.step === 'error' && (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-6 text-center py-4"
                >
                  <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-display font-bold text-lg text-slate-900 text-red-600">Не вдалося створити тест</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Сталася помилка при зверненні до Google Workspace API:
                    </p>
                    <p className="text-xs font-mono bg-slate-50 p-3 rounded-xl text-red-700 text-left border border-red-100 max-h-32 overflow-y-auto">
                      {progress.errorMsg}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowProgressModal(false)}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Повернутись до редактора
                  </button>
                </motion.div>
              )}

              {/* STAGE: SUCCESS */}
              {progress.step === 'success' && (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto shadow-sm">
                      <CheckCircle2 className="w-9 h-9" />
                    </div>
                    <h3 className="font-display font-bold text-xl text-slate-950">Тест успішно створено!</h3>
                    <p className="text-xs text-slate-500">
                      Ваш тест з математики за 6 клас за підручником Істер завантажений у ваші Google Форми.
                    </p>
                  </div>

                  {/* Form Links Section */}
                  <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Редагування тесту (Власник)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={progress.editUri}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 font-mono outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => copyToClipboard(progress.editUri || '')}
                          className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="Копіювати посилання"
                        >
                          <ClipboardCopy className="w-4 h-4" />
                        </button>
                        <a
                          href={progress.editUri}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition-colors"
                          title="Відкрити форму"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/60 pt-3">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Перегляд для учнів (Посилання для проходження)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={progress.responderUri}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 font-mono outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => copyToClipboard(progress.responderUri || '')}
                          className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="Копіювати посилання"
                        >
                          <ClipboardCopy className="w-4 h-4" />
                        </button>
                        <a
                          href={progress.responderUri}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition-colors"
                          title="Відкрити перегляд"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {copiedLink && (
                    <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-xs text-center font-semibold">
                      Посилання успішно скопійовано!
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowProgressModal(false)}
                      className="flex-1 cursor-pointer border border-slate-300 hover:bg-slate-50 text-slate-700 py-3 rounded-xl text-xs font-bold"
                    >
                      Закрити вікно
                    </button>
                    <a
                      href={progress.editUri}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-xs font-bold shadow-md shadow-indigo-100 text-center flex items-center justify-center gap-1.5"
                    >
                      <span>Відкрити в Google</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

          </div>
        </div>
      )}

    </div>
  );
}
