import { useEffect, useState, useRef } from 'react';
import { 
  auth, db 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Layout, 
  Plus, 
  FileText, 
  MessageSquare, 
  Settings, 
  LogOut, 
  User, 
  ChevronRight, 
  Download, 
  Eye, 
  Trash2, 
  Star, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Menu,
  X,
  CreditCard,
  Sparkles,
  Zap,
  Crown,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Resume, PersonalInfo, Education, Experience } from './types';
import { evaluateResume, generateInterviewQuestions, getFeedbackOnAnswer } from './services/gemini';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false,
  loading = false,
  ...props
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'; 
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  [key: string]: any;
}) => {
  const base = "px-4 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-black text-white hover:bg-zinc-800 shadow-sm",
    secondary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
    outline: "border border-zinc-200 text-zinc-700 hover:bg-zinc-50",
    ghost: "text-zinc-600 hover:bg-zinc-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : children}
    </button>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const Input = ({ label, value, onChange, placeholder, type = "text", required = false, error }: any) => (
  <div className="space-y-1.5">
    {label && <label className="text-sm font-medium text-zinc-700">{label} {required && <span className="text-red-500">*</span>}</label>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={`w-full px-4 py-2.5 bg-zinc-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all ${error ? 'border-red-500' : 'border-zinc-200'}`}
    />
    {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}
  </div>
);

const TextArea = ({ label, value, onChange, placeholder, rows = 4 }: any) => (
  <div className="space-y-1.5">
    {label && <label className="text-sm font-medium text-zinc-700">{label}</label>}
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all resize-none"
    />
  </div>
);

// --- Main App ---

type View = 'onboarding' | 'login' | 'dashboard' | 'editor' | 'preview' | 'simulator' | 'plans' | 'settings' | 'admin';

export default function App() {
  const [view, setView] = useState<View>('onboarding');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [currentResume, setCurrentResume] = useState<Partial<Resume> | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return localStorage.getItem('isAdminLoggedIn') === 'true';
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  useEffect(() => {
    localStorage.setItem('isAdminLoggedIn', isAdminLoggedIn.toString());
  }, [isAdminLoggedIn]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { setPersistence, browserLocalPersistence, getRedirectResult } = await import('firebase/auth');
        await setPersistence(auth, browserLocalPersistence);
        
        // Handle redirect result
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("Login successful via redirect result.");
        }
      } catch (error) {
        console.error("Error setting persistence or handling redirect:", error);
      }

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log("Auth state changed:", firebaseUser?.uid);
        try {
          if (firebaseUser) {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              console.log("User doc found:", userDoc.data());
              const userData = userDoc.data() as UserProfile;
              if (firebaseUser.email === 'viralizaapp33@gmail.com') {
                userData.plan = 'premium';
              }
              setUser(userData);
            } else {
              console.log("Creating new user doc...");
              const newUser: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                plan: firebaseUser.email === 'viralizaapp33@gmail.com' ? 'premium' : 'free',
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
              setUser(newUser);
            }
            setView('dashboard');
          } else {
            console.log("No user found, showing onboarding.");
            setUser(null);
            setView('onboarding');
          }
        } catch (error) {
          console.error("Error in onAuthStateChanged:", error);
          // If Firestore fails, we might still want to show the dashboard if we have the user
          if (firebaseUser) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              plan: 'free',
              createdAt: new Date().toISOString()
            } as UserProfile);
            setView('dashboard');
          } else {
            setView('onboarding');
          }
        } finally {
          setLoading(false);
        }
      });

      return unsubscribe;
    };

    const unsubscribePromise = initAuth();
    return () => {
      unsubscribePromise.then(unsubscribe => unsubscribe());
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'resumes'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resume));
      setResumes(list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    });
    return () => unsubscribe();
  }, [user]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.email !== 'viralizaapp33@gmail.com') {
      alert("Acesso restrito à conta viralizaapp33@gmail.com. Por favor, faça login com Google primeiro.");
      return;
    }
    if (adminPassword === 'miza235') {
      setIsAdminLoggedIn(true);
      setShowAdminLogin(false);
      setView('admin');
    } else {
      alert("Senha administrativa incorreta.");
    }
  };

  const handleLogin = async () => {
    console.log("Starting login process...");
    try {
      const provider = new GoogleAuthProvider();
      // Use popup by default, but handle potential issues
      await signInWithPopup(auth, provider);
      console.log("Login successful via popup.");
    } catch (error: any) {
      console.error("Login failed:", error.code, error.message);
      
      if (error.code === 'auth/popup-closed-by-user') {
        console.log("Login cancelado pelo usuário.");
        return;
      }

      if (error.code === 'auth/popup-blocked') {
        alert("O navegador bloqueou a janela de login. Por favor, permita popups para este site ou tente novamente.");
        return;
      }

      // Fallback to redirect if popup fails or is not supported
      try {
        console.log("Attempting login via redirect...");
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
      } catch (redirectError) {
        console.error("Redirect login failed:", redirectError);
        alert("Falha no login. Por favor, tente novamente.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAdminLoggedIn(false);
      localStorage.removeItem('isAdminLoggedIn');
      setUser(null);
      setIsMobileMenuOpen(false);
      setView('onboarding');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const createNewResume = () => {
    setCurrentResume({
      title: 'Novo Currículo',
      personalInfo: { fullName: '', email: '', phone: '', address: '' },
      education: [],
      experience: [],
      skills: [],
      certifications: [],
      summary: '',
      templateId: 'simple'
    });
    setView('editor');
  };

  const saveResume = async () => {
    if (!user || !currentResume) return;
    
    const data = {
      ...currentResume,
      userId: user.uid,
      updatedAt: new Date().toISOString()
    };

    if (currentResume.id) {
      await updateDoc(doc(db, 'resumes', currentResume.id), data);
    } else {
      const docRef = await addDoc(collection(db, 'resumes'), {
        ...data,
        createdAt: new Date().toISOString()
      });
      setCurrentResume({ ...data, id: docRef.id });
    }
    setView('dashboard');
  };

  const deleteResume = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este currículo?')) {
      await deleteDoc(doc(db, 'resumes', id));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-zinc-50 text-zinc-900 font-sans ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Navigation */}
      {user && view !== 'onboarding' && (
        <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-100 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold">P</div>
              <span className="font-bold text-lg tracking-tight">ProCurrículo</span>
            </div>
            
            <div className="hidden md:flex items-center gap-6">
              <button onClick={() => setView('dashboard')} className={`text-sm font-medium ${view === 'dashboard' ? 'text-black' : 'text-zinc-500 hover:text-black'}`}>Dashboard</button>
              <button onClick={() => setView('plans')} className={`text-sm font-medium ${view === 'plans' ? 'text-black' : 'text-zinc-500 hover:text-black'}`}>Planos</button>
              <button onClick={() => setView('settings')} className={`text-sm font-medium ${view === 'settings' ? 'text-black' : 'text-zinc-500 hover:text-black'}`}>Configurações</button>
              <button onClick={handleLogout} className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors flex items-center gap-1.5">
                <LogOut size={16} /> Sair
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold text-zinc-900">{user.displayName}</span>
                <span className={`text-[10px] uppercase tracking-wider font-bold ${user.plan === 'free' ? 'text-zinc-400' : 'text-emerald-600'}`}>
                  {user.plan === 'free' ? 'Plano Gratuito' : `${user.plan} Member`}
                  {user.plan !== 'free' && <Sparkles size={10} className="inline ml-1" />}
                </span>
              </div>
              <img src={user.photoURL || ''} alt="" className={`w-8 h-8 rounded-full border ${user.plan !== 'free' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-zinc-100'}`} />
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 hover:bg-zinc-100 rounded-lg">
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-30 bg-white pt-20 px-6 md:hidden"
          >
            <div className="flex flex-col gap-6 text-xl font-medium">
              <button onClick={() => { setView('dashboard'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3"><FileText /> Dashboard</button>
              <button onClick={() => { setView('plans'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3"><Star /> Planos</button>
              <button onClick={() => { setView('settings'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3"><Settings /> Configurações</button>
              <div className="h-px bg-zinc-100" />
              <button onClick={handleLogout} className="flex items-center gap-3 text-red-600"><LogOut /> Sair</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === 'onboarding' && (
            <motion.div 
              key="onboarding"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto text-center py-12 space-y-8"
            >
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[0.9]">
                  Currículos que <span className="text-emerald-600 italic serif">abrem portas.</span>
                </h1>
                <p className="text-xl text-zinc-500 max-w-2xl mx-auto">
                  Crie currículos profissionais de forma simples e eficaz. Nossa IA ajuda você a destacar suas melhores habilidades e aumentar suas chances.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center gap-4 max-w-md mx-auto w-full">
                <button
                  onClick={handleLogin}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 text-lg font-medium bg-white border border-zinc-200 rounded-xl shadow-sm hover:shadow-md hover:bg-zinc-50 transition-all text-zinc-700"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Entrar com Google
                </button>
                <p className="text-sm text-zinc-400">Acesse ou crie sua conta usando o Google</p>
                <div className="w-full flex items-center gap-3 pt-2">
                  <div className="flex-1 h-px bg-zinc-200"></div>
                  <span className="text-xs text-zinc-400">ou</span>
                  <div className="flex-1 h-px bg-zinc-200"></div>
                </div>
                <Button onClick={() => setView('plans')} variant="outline" className="w-full px-8 py-4 text-lg">
                  Ver Planos
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
                {[
                  { icon: <Sparkles className="text-emerald-600" />, title: "IA Inteligente", desc: "Sugestões de frases e palavras-chave para sua área." },
                  { icon: <CheckCircle2 className="text-blue-600" />, title: "Avaliação Automática", desc: "Saiba o quão competitivo está seu currículo." },
                  { icon: <MessageSquare className="text-purple-600" />, title: "Simulador de Entrevista", desc: "Treine suas respostas com feedback em tempo real." }
                ].map((feature, i) => (
                  <Card key={i} className="p-6 text-left space-y-3">
                    <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center">{feature.icon}</div>
                    <h3 className="font-bold">{feature.title}</h3>
                    <p className="text-sm text-zinc-500">{feature.desc}</p>
                  </Card>
                ))}
              </div>

              <div className="pt-12">
                <button 
                  onClick={() => setShowAdminLogin(true)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors underline underline-offset-4"
                >
                  Acesso Administrativo
                </button>
              </div>

              <p className="text-xs text-zinc-400 max-w-lg mx-auto">
                * Não garantimos contratação, mas aumentamos suas oportunidades com currículos bem feitos e adaptados às vagas.
              </p>
            </motion.div>
          )}

          {showAdminLogin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">Acesso Restrito</h3>
                  <button onClick={() => setShowAdminLogin(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Senha Administrativa</label>
                    <input 
                      type="password" 
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full py-4 text-lg">Entrar no Painel</Button>
                </form>
              </motion.div>
            </div>
          )}

          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {user?.subscriptionStatus === 'pending' && (
                <Card className="bg-amber-50 border-amber-200 p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                    <AlertCircle size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-900">Pagamento em Análise</p>
                    <p className="text-xs text-amber-700">Seu pagamento para o plano {user.pendingPlan} está sendo verificado. Isso pode levar até 24h.</p>
                  </div>
                  <Button onClick={() => setView('plans')} variant="outline" className="text-xs py-1.5">Ver Detalhes</Button>
                </Card>
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Meus Currículos</h2>
                  <p className="text-zinc-500">Gerencie e crie novos currículos profissionais.</p>
                </div>
                <Button onClick={createNewResume} className="px-6 py-3 shadow-lg shadow-black/10">
                  <Plus size={20} /> Novo Currículo
                </Button>
              </div>

              {resumes.length === 0 ? (
                <div className="py-20 text-center space-y-4 bg-white rounded-3xl border border-dashed border-zinc-200">
                  <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto text-zinc-300">
                    <FileText size={32} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg">Nenhum currículo ainda</h3>
                    <p className="text-zinc-500">Comece criando seu primeiro currículo profissional.</p>
                  </div>
                  <Button onClick={createNewResume} variant="outline">Criar Agora</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {resumes.map(resume => (
                    <Card key={resume.id} className="group hover:border-black transition-all">
                      <div className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-bold text-lg leading-tight">{resume.title}</h3>
                            <p className="text-xs text-zinc-400">Atualizado em {new Date(resume.updatedAt).toLocaleDateString()}</p>
                          </div>
                          <div className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded uppercase">
                            {resume.score ? `${resume.score}% Score` : 'Pendente'}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pt-4 border-t border-zinc-50">
                          <Button 
                            onClick={() => { setCurrentResume(resume); setView('editor'); }} 
                            variant="primary" 
                            className="flex-1 text-xs py-2.5"
                          >
                            Editar
                          </Button>
                          <div className="flex items-center gap-1">
                            <Button 
                              onClick={() => { setCurrentResume(resume); setView('preview'); }} 
                              variant="ghost" 
                              className="p-2.5 text-zinc-400 hover:text-black hover:bg-zinc-100"
                              title="Visualizar"
                            >
                              <Eye size={18} />
                            </Button>
                            <Button 
                              onClick={() => { setCurrentResume(resume); setView('simulator'); }} 
                              variant="ghost" 
                              className="p-2.5 text-zinc-400 hover:text-black hover:bg-zinc-100"
                              title="Simular Entrevista"
                            >
                              <MessageSquare size={18} />
                            </Button>
                            <Button 
                              onClick={() => deleteResume(resume.id)} 
                              variant="ghost" 
                              className="p-2.5 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'editor' && currentResume && (
            <ResumeEditor 
              resume={currentResume} 
              setResume={setCurrentResume} 
              onSave={saveResume} 
              onBack={() => setView('dashboard')} 
              user={user}
            />
          )}

          {view === 'preview' && currentResume && (
            <ResumePreview 
              resume={currentResume as Resume} 
              onBack={() => setView('dashboard')} 
              onEdit={() => setView('editor')}
            />
          )}

          {view === 'simulator' && currentResume && (
            <InterviewSimulator 
              resume={currentResume as Resume} 
              onBack={() => setView('dashboard')} 
            />
          )}

          {view === 'plans' && (
            <PlansView onBack={() => setView('dashboard')} currentPlan={user?.plan || 'free'} />
          )}

          {view === 'settings' && (
            <SettingsView 
              user={user!} 
              onBack={() => setView('dashboard')} 
              onLogout={handleLogout}
              theme={theme}
              setTheme={setTheme}
              onViewChange={setView}
              isAdminLoggedIn={isAdminLoggedIn}
            />
          )}
          {view === 'admin' && (
            <AdminView 
              onBack={() => setView(user ? 'dashboard' : 'onboarding')} 
              onLogoutAdmin={() => {
                setIsAdminLoggedIn(false);
                setView('onboarding');
              }}
              onLogout={handleLogout}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Sub-Views ---

function ResumeEditor({ resume, setResume, onSave, onBack, user }: any) {
  const [step, setStep] = useState(1);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const isPaid = user?.plan && user.plan !== 'free';

  const updatePersonalInfo = (field: string, value: string) => {
    setResume({ ...resume, personalInfo: { ...resume.personalInfo, [field]: value } });
  };

  const updateAdvancedOptions = (field: string, value: any) => {
    setResume({ ...resume, advancedOptions: { ...(resume.advancedOptions || {}), [field]: value } });
  };

  const addEducation = () => {
    const newEdu = { institution: '', degree: '', startDate: '', endDate: '', description: '' };
    setResume({ ...resume, education: [...(resume.education || []), newEdu] });
  };

  const addExperience = () => {
    const newExp = { company: '', position: '', startDate: '', endDate: '', description: '' };
    setResume({ ...resume, experience: [...(resume.experience || []), newExp] });
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      const result = await evaluateResume(resume as Resume);
      setResume({ ...resume, score: result.score, feedback: result.feedback });
      alert(`Avaliação concluída! Score: ${result.score}%\n\n${result.feedback}`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSave = () => {
    const email = resume.personalInfo.email;
    const isEmailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    
    if (!isEmailValid) {
      alert('Por favor, insira um e-mail válido antes de salvar.');
      return;
    }
    
    onSave();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="max-w-3xl mx-auto space-y-8"
    >
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-black transition-colors">
          <ArrowLeft size={20} /> Voltar
        </button>
        <div className="flex items-center gap-2">
          <Button onClick={handleEvaluate} variant="outline" loading={isEvaluating}>
            <Sparkles size={18} /> Avaliar com IA
          </Button>
          <Button onClick={handleSave} variant="primary">Salvar Currículo</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
        {['Dados', 'Formação', 'Experiência', 'Habilidades', 'Resumo', 'Avançado'].map((s, i) => (
          <button 
            key={i}
            onClick={() => setStep(i + 1)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${step === i + 1 ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <Card className="p-8 space-y-6">
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Dados Pessoais</h3>
              {!isPaid && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full uppercase">
                  <Star size={10} /> Foto disponível no PRO
                </div>
              )}
            </div>
            
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {isPaid && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Foto de Perfil</label>
                  <div className="w-32 h-32 bg-zinc-100 rounded-2xl border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden relative group">
                    {resume.personalInfo.photo ? (
                      <>
                        <img src={resume.personalInfo.photo} alt="" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => updatePersonalInfo('photo', '')}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        >
                          <Trash2 size={20} />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <Plus size={24} className="mx-auto text-zinc-400" />
                        <input 
                          type="file" 
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => updatePersonalInfo('photo', reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex-1 w-full space-y-4">
                <Input label="Título do Currículo" value={resume.title} onChange={(v: string) => setResume({ ...resume, title: v })} placeholder="Ex: Desenvolvedor Frontend" required />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nome Completo" value={resume.personalInfo.fullName} onChange={(v: string) => updatePersonalInfo('fullName', v)} required />
                  <Input 
                    type="email"
                    label="E-mail" 
                    value={resume.personalInfo.email} 
                    onChange={(v: string) => updatePersonalInfo('email', v)} 
                    required 
                    error={resume.personalInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.personalInfo.email) ? 'E-mail inválido' : null}
                  />
                  <Input label="Telefone" value={resume.personalInfo.phone} onChange={(v: string) => updatePersonalInfo('phone', v)} required />
                  <Input label="Endereço" value={resume.personalInfo.address} onChange={(v: string) => updatePersonalInfo('address', v)} required />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-100">
              <Input label="LinkedIn" value={resume.personalInfo.linkedin} onChange={(v: string) => updatePersonalInfo('linkedin', v)} placeholder="linkedin.com/in/..." />
              <Input label="GitHub" value={resume.personalInfo.github} onChange={(v: string) => updatePersonalInfo('github', v)} placeholder="github.com/..." />
              <Input label="Website/Portfólio" value={resume.personalInfo.website} onChange={(v: string) => updatePersonalInfo('website', v)} placeholder="meusite.com" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Formação Acadêmica</h3>
              <Button onClick={addEducation} variant="outline" className="py-1.5 text-xs"><Plus size={14} /> Adicionar</Button>
            </div>
            {resume.education?.map((edu: Education, i: number) => (
              <div key={i} className="p-4 bg-zinc-50 rounded-2xl space-y-4 relative">
                <button 
                  onClick={() => {
                    const newList = [...resume.education];
                    newList.splice(i, 1);
                    setResume({ ...resume, education: newList });
                  }}
                  className="absolute top-4 right-4 text-zinc-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Instituição" value={edu.institution} onChange={(v: string) => {
                    const newList = [...resume.education];
                    newList[i].institution = v;
                    setResume({ ...resume, education: newList });
                  }} />
                  <Input label="Curso/Grau" value={edu.degree} onChange={(v: string) => {
                    const newList = [...resume.education];
                    newList[i].degree = v;
                    setResume({ ...resume, education: newList });
                  }} />
                  <Input label="Início" type="date" value={edu.startDate} onChange={(v: string) => {
                    const newList = [...resume.education];
                    newList[i].startDate = v;
                    setResume({ ...resume, education: newList });
                  }} />
                  <Input label="Fim" type="date" value={edu.endDate} onChange={(v: string) => {
                    const newList = [...resume.education];
                    newList[i].endDate = v;
                    setResume({ ...resume, education: newList });
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Experiência Profissional</h3>
              <Button onClick={addExperience} variant="outline" className="py-1.5 text-xs"><Plus size={14} /> Adicionar</Button>
            </div>
            {resume.experience?.map((exp: Experience, i: number) => (
              <div key={i} className="p-4 bg-zinc-50 rounded-2xl space-y-4 relative">
                <button 
                  onClick={() => {
                    const newList = [...resume.experience];
                    newList.splice(i, 1);
                    setResume({ ...resume, experience: newList });
                  }}
                  className="absolute top-4 right-4 text-zinc-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Empresa" value={exp.company} onChange={(v: string) => {
                    const newList = [...resume.experience];
                    newList[i].company = v;
                    setResume({ ...resume, experience: newList });
                  }} />
                  <Input label="Cargo" value={exp.position} onChange={(v: string) => {
                    const newList = [...resume.experience];
                    newList[i].position = v;
                    setResume({ ...resume, experience: newList });
                  }} />
                  <Input label="Início" type="date" value={exp.startDate} onChange={(v: string) => {
                    const newList = [...resume.experience];
                    newList[i].startDate = v;
                    setResume({ ...resume, experience: newList });
                  }} />
                  <Input label="Fim" type="date" value={exp.endDate} onChange={(v: string) => {
                    const newList = [...resume.experience];
                    newList[i].endDate = v;
                    setResume({ ...resume, experience: newList });
                  }} />
                </div>
                <TextArea label="Descrição das Atividades" value={exp.description} onChange={(v: string) => {
                  const newList = [...resume.experience];
                  newList[i].description = v;
                  setResume({ ...resume, experience: newList });
                }} />
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Habilidades e Certificações</h3>
            <TextArea 
              label="Habilidades (uma por linha)" 
              value={resume.skills?.join('\n')} 
              onChange={(v: string) => setResume({ ...resume, skills: v.split('\n').filter(s => s.trim()) })} 
              placeholder="Ex: React.js&#10;TypeScript&#10;Gestão de Projetos"
            />
            <TextArea 
              label="Certificações (uma por linha)" 
              value={resume.certifications?.join('\n')} 
              onChange={(v: string) => setResume({ ...resume, certifications: v.split('\n').filter(s => s.trim()) })} 
              placeholder="Ex: AWS Certified Cloud Practitioner&#10;Google Analytics"
            />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Resumo Profissional</h3>
            <p className="text-sm text-zinc-500">Escreva um breve parágrafo destacando seus principais objetivos e conquistas.</p>
            <TextArea 
              value={resume.summary} 
              onChange={(v: string) => setResume({ ...resume, summary: v })} 
              placeholder="Ex: Profissional com 5 anos de experiência em..."
              rows={8}
            />
          </div>
        )}
        {step === 6 && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Opções Avançadas</h3>
              {!isPaid && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full uppercase">
                  <Star size={10} /> Disponível no PRO
                </div>
              )}
            </div>

            <div className={`space-y-8 ${!isPaid ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-sm font-bold text-zinc-700">Cor Principal</label>
                  <div className="flex flex-wrap gap-3">
                    {['#000000', '#059669', '#2563eb', '#7c3aed', '#db2777', '#ea580c'].map(color => (
                      <button 
                        key={color}
                        onClick={() => updateAdvancedOptions('primaryColor', color)}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${resume.advancedOptions?.primaryColor === color ? 'border-zinc-900 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-zinc-700">Fonte</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: 'Serif Clássica', value: 'serif' },
                      { name: 'Sans Moderna', value: 'sans-serif' },
                      { name: 'Mono Tech', value: 'monospace' }
                    ].map(font => (
                      <button 
                        key={font.value}
                        onClick={() => updateAdvancedOptions('fontFamily', font.value)}
                        className={`px-4 py-2 rounded-xl border-2 text-xs font-medium transition-all ${resume.advancedOptions?.fontFamily === font.value ? 'border-black bg-zinc-50' : 'border-zinc-100 hover:border-zinc-200'}`}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold">Exibir Ícones</p>
                  <p className="text-xs text-zinc-500">Mostra ícones ao lado dos dados de contato.</p>
                </div>
                <button 
                  onClick={() => updateAdvancedOptions('showIcons', !resume.advancedOptions?.showIcons)}
                  className={`w-12 h-6 rounded-full transition-all relative ${resume.advancedOptions?.showIcons ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${resume.advancedOptions?.showIcons ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {!isPaid && (
              <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 text-center space-y-4">
                <p className="text-sm text-zinc-600">Faça o upgrade para o plano <strong>Profissional</strong> para personalizar cores, fontes e adicionar sua foto.</p>
                <Button onClick={() => alert("Redirecionando para planos...")} variant="outline" className="mx-auto">Ver Planos</Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between pt-4">
        <Button 
          onClick={() => setStep(Math.max(1, step - 1))} 
          variant="outline"
          disabled={step === 1}
        >
          Anterior
        </Button>
        <div className="flex items-center gap-2">
          {step < 6 ? (
            <Button onClick={() => setStep(step + 1)}>Próximo</Button>
          ) : (
            <Button onClick={onSave} variant="secondary">Finalizar e Salvar</Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ResumePreview({ resume, onBack, onEdit }: any) {
  const resumeRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async () => {
    if (!resumeRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(resumeRef.current, { 
        quality: 1, 
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${resume.personalInfo.fullName.replace(/\s+/g, '_')}_Curriculo.pdf`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-black transition-colors">
          <ArrowLeft size={20} /> Voltar
        </button>
        <div className="flex items-center gap-2">
          <Button onClick={onEdit} variant="outline">Editar</Button>
          <Button onClick={exportPDF} loading={isExporting}>
            <Download size={18} /> Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <div 
            ref={resumeRef} 
            className="bg-white shadow-xl p-12 min-h-[1122px] text-zinc-900"
            style={{ 
              fontFamily: resume.advancedOptions?.fontFamily || 'serif',
            }}
          >
            <div className="flex gap-8 items-start border-b-2 pb-8 mb-8" style={{ borderColor: resume.advancedOptions?.primaryColor || '#18181b' }}>
              {resume.personalInfo.photo && (
                <div className="w-32 h-32 rounded-2xl overflow-hidden shrink-0 border-2 border-zinc-100">
                  <img src={resume.personalInfo.photo} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <h1 className="text-4xl font-bold uppercase tracking-tight" style={{ color: resume.advancedOptions?.primaryColor || '#18181b' }}>
                  {resume.personalInfo.fullName}
                </h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
                  <span className="flex items-center gap-1">
                    {resume.advancedOptions?.showIcons && <User size={12} />}
                    {resume.personalInfo.email}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {resume.advancedOptions?.showIcons && <MessageSquare size={12} />}
                    {resume.personalInfo.phone}
                  </span>
                  <span>•</span>
                  <span>{resume.personalInfo.address}</span>
                </div>
                <div className="flex flex-wrap gap-4 pt-2">
                  {resume.personalInfo.linkedin && (
                    <a href={`https://${resume.personalInfo.linkedin}`} target="_blank" rel="noreferrer" className="text-xs text-zinc-400 hover:underline">LinkedIn</a>
                  )}
                  {resume.personalInfo.github && (
                    <a href={`https://${resume.personalInfo.github}`} target="_blank" rel="noreferrer" className="text-xs text-zinc-400 hover:underline">GitHub</a>
                  )}
                  {resume.personalInfo.website && (
                    <a href={`https://${resume.personalInfo.website}`} target="_blank" rel="noreferrer" className="text-xs text-zinc-400 hover:underline">Website</a>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {resume.summary && (
                <section>
                  <h2 className="text-lg font-bold uppercase border-b border-zinc-200 mb-3" style={{ color: resume.advancedOptions?.primaryColor || '#18181b' }}>Resumo</h2>
                  <p className="text-sm leading-relaxed">{resume.summary}</p>
                </section>
              )}

              {resume.experience?.length > 0 && (
                <section>
                  <h2 className="text-lg font-bold uppercase border-b border-zinc-200 mb-4" style={{ color: resume.advancedOptions?.primaryColor || '#18181b' }}>Experiência Profissional</h2>
                  <div className="space-y-6">
                    {resume.experience.map((exp: any, i: number) => (
                      <div key={i}>
                        <div className="flex justify-between items-baseline">
                          <h3 className="font-bold">{exp.position}</h3>
                          <span className="text-xs italic">{exp.startDate} — {exp.endDate || 'Presente'}</span>
                        </div>
                        <p className="text-sm font-medium text-zinc-700">{exp.company}</p>
                        <p className="text-sm mt-2 leading-relaxed whitespace-pre-line">{exp.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {resume.education?.length > 0 && (
                <section>
                  <h2 className="text-lg font-bold uppercase border-b border-zinc-200 mb-4" style={{ color: resume.advancedOptions?.primaryColor || '#18181b' }}>Formação Acadêmica</h2>
                  <div className="space-y-4">
                    {resume.education.map((edu: any, i: number) => (
                      <div key={i}>
                        <div className="flex justify-between items-baseline">
                          <h3 className="font-bold">{edu.degree}</h3>
                          <span className="text-xs italic">{edu.startDate} — {edu.endDate}</span>
                        </div>
                        <p className="text-sm">{edu.institution}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="grid grid-cols-2 gap-8">
                {resume.skills?.length > 0 && (
                  <section>
                    <h2 className="text-lg font-bold uppercase border-b border-zinc-200 mb-3" style={{ color: resume.advancedOptions?.primaryColor || '#18181b' }}>Habilidades</h2>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {resume.skills.map((skill: string, i: number) => (
                        <li key={i}>{skill}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {resume.certifications?.length > 0 && (
                  <section>
                    <h2 className="text-lg font-bold uppercase border-b border-zinc-200 mb-3" style={{ color: resume.advancedOptions?.primaryColor || '#18181b' }}>Certificações</h2>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {resume.certifications.map((cert: string, i: number) => (
                        <li key={i}>{cert}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-emerald-50 border-emerald-100">
            <h3 className="font-bold text-emerald-900 flex items-center gap-2">
              <Sparkles size={18} /> Score IA
            </h3>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-emerald-700">{resume.score || 0}</span>
              <span className="text-emerald-600/60 font-medium">/ 100</span>
            </div>
            <p className="text-xs text-emerald-700/80 mt-2">
              {resume.feedback || "Avalie seu currículo para ver o feedback da nossa inteligência artificial."}
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-4">Dicas de Melhoria</h3>
            <ul className="space-y-3">
              {[
                "Use verbos de ação para descrever suas conquistas.",
                "Quantifique seus resultados (ex: aumentei vendas em 20%).",
                "Mantenha o currículo em no máximo 2 páginas."
              ].map((tip, i) => (
                <li key={i} className="flex gap-3 text-sm text-zinc-600">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InterviewSimulator({ resume, onBack }: any) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const q = await generateInterviewQuestions(resume);
        setQuestions(q);
      } catch (error) {
        console.error(error);
      } finally {
        setIsGenerating(false);
      }
    };
    load();
  }, [resume]);

  const handleSendAnswer = async () => {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const fb = await getFeedbackOnAnswer(questions[currentIdx].question, answer);
      setFeedback(fb);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = () => {
    setCurrentIdx(currentIdx + 1);
    setAnswer('');
    setFeedback('');
  };

  if (isGenerating) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-zinc-500 font-medium">Gerando perguntas personalizadas com base no seu currículo...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-black transition-colors">
          <ArrowLeft size={20} /> Voltar
        </button>
        <span className="text-sm font-bold text-zinc-400">Pergunta {currentIdx + 1} de {questions.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={currentIdx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          <Card className="p-8 space-y-4 bg-black text-white">
            <h3 className="text-2xl font-bold leading-tight">{questions[currentIdx]?.question}</h3>
            <p className="text-zinc-400 text-sm italic">Dica: {questions[currentIdx]?.hint}</p>
          </Card>

          <div className="space-y-4">
            <TextArea 
              placeholder="Digite sua resposta aqui..." 
              value={answer} 
              onChange={setAnswer} 
              rows={6}
              disabled={!!feedback}
            />
            {!feedback ? (
              <Button onClick={handleSendAnswer} className="w-full py-4" loading={loading} disabled={!answer.trim()}>
                Enviar Resposta
              </Button>
            ) : (
              <div className="space-y-6">
                <Card className="p-6 bg-emerald-50 border-emerald-100">
                  <h4 className="font-bold text-emerald-900 mb-2">Feedback da IA:</h4>
                  <div className="text-emerald-800 text-sm leading-relaxed whitespace-pre-line">
                    {feedback}
                  </div>
                </Card>
                {currentIdx < questions.length - 1 ? (
                  <Button onClick={nextQuestion} className="w-full py-4">Próxima Pergunta</Button>
                ) : (
                  <Button onClick={onBack} variant="outline" className="w-full py-4">Finalizar Simulação</Button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function PaymentModal({ plan, onConfirm, onClose }: any) {
  const [method, setMethod] = useState<'pix' | 'card'>('pix');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [copied, setCopied] = useState(false);
  const pixKey = "80097004952";

  const copyKey = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePayment = async () => {
    setStatus('processing');
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (method === 'card') {
      setStatus('success');
      setTimeout(() => {
        onConfirm();
      }, 3000);
    } else {
      // For PIX, we show a success message but it's pending approval
      setStatus('success');
      // We don't call onConfirm() immediately for PIX success view to stay visible
      // The user will close it manually or it will close after a while
      setTimeout(() => {
        onConfirm();
      }, 5000);
    }
  };

  if (status === 'success') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white w-full max-w-sm rounded-[32px] p-12 text-center space-y-6 shadow-2xl"
        >
          <div className={`w-20 h-20 ${method === 'pix' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'} rounded-full flex items-center justify-center mx-auto`}>
            {method === 'pix' ? <Clock size={48} /> : <CheckCircle2 size={48} />}
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">
              {method === 'pix' ? 'Solicitação Enviada!' : 'Pagamento Aprovado!'}
            </h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              {method === 'pix' 
                ? `Recebemos sua confirmação do plano ${plan.name}. Agora, nossa equipe (Mizael) irá validar seu pagamento. O acesso será liberado em instantes.`
                : `Seu acesso ao plano ${plan.name} foi liberado com sucesso. Aproveite todas as funcionalidades!`}
            </p>
          </div>
          <Button onClick={onConfirm} variant="outline" className="w-full py-3">Entendi</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row"
      >
        {/* Order Summary - Left Side (Desktop) */}
        <div className="bg-zinc-50 p-8 md:w-5/12 border-r border-zinc-100">
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Seu Pedido</p>
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-zinc-500 text-xs">{plan.period}</p>
            </div>

            <div className="space-y-3 pt-6 border-t border-zinc-200">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Subtotal</span>
                <span className="font-medium">{plan.price}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Taxas</span>
                <span className="font-medium">R$ 0,00</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-3 border-t border-zinc-200">
                <span>Total</span>
                <span className="text-emerald-600">{plan.price}</span>
              </div>
            </div>

            <div className="pt-6">
              <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-medium">
                <CheckCircle2 size={12} className="text-emerald-500" />
                Pagamento 100% Seguro
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods - Right Side */}
        <div className="p-8 md:w-7/12 space-y-6 relative">
          {status === 'processing' && (
            <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
              <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-bold">Processando...</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Pagamento</h3>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <X size={20} className="text-zinc-400" />
            </button>
          </div>

          {/* Method Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => setMethod('pix')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${method === 'pix' ? 'border-black bg-zinc-50' : 'border-zinc-100 hover:border-zinc-200'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method === 'pix' ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                <Sparkles size={20} />
              </div>
              <span className="text-xs font-bold">PIX</span>
            </button>
            <button 
              onClick={() => setMethod('card')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${method === 'card' ? 'border-black bg-zinc-50' : 'border-zinc-100 hover:border-zinc-200'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method === 'card' ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                <CreditCard size={20} />
              </div>
              <span className="text-xs font-bold">Cartão</span>
            </button>
          </div>

          {method === 'pix' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-4">
                <div className="flex justify-center">
                  <div className="w-32 h-32 bg-white p-2 rounded-xl border border-zinc-200 shadow-sm">
                    {/* Placeholder for QR Code */}
                    <div className="w-full h-full bg-zinc-100 rounded flex items-center justify-center text-zinc-300">
                      <Download size={32} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 text-center">Chave PIX (Telefone)</p>
                  <div className="flex items-center gap-2 bg-white border border-zinc-200 p-2.5 rounded-xl">
                    <span className="flex-1 font-mono text-sm text-center truncate">{pixKey}</span>
                    <button onClick={copyKey} className="p-2 hover:bg-zinc-50 rounded-lg transition-colors shrink-0">
                      {copied ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Download size={16} className="text-zinc-400" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl flex gap-3">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  Após o pagamento, clique no botão abaixo. Nossa equipe validará seu acesso em até 24h úteis.
                </p>
              </div>
              <Button onClick={handlePayment} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-sm font-bold">
                Confirmar Pagamento
              </Button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">Número do Cartão</label>
                  <div className="relative">
                    <input type="text" placeholder="0000 0000 0000 0000" className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                      <div className="w-6 h-4 bg-zinc-200 rounded-sm" />
                      <div className="w-6 h-4 bg-zinc-200 rounded-sm" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">Validade</label>
                    <input type="text" placeholder="MM/AA" className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">CVV</label>
                    <input type="text" placeholder="123" className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                  </div>
                </div>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-[10px] text-zinc-500 text-center">
                  O pagamento via cartão será processado instantaneamente.
                </p>
              </div>
              <Button onClick={handlePayment} className="w-full py-4 bg-black text-sm font-bold">
                Pagar Agora
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function PlansView({ onBack, currentPlan }: any) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const user = auth.currentUser;

  const handleConfirmPayment = async () => {
    if (!user || !selectedPlan) return;
    
    // 1. Update user status
    await updateDoc(doc(db, 'users', user.uid), {
      subscriptionStatus: 'pending',
      pendingPlan: selectedPlan.id
    });
    
    // 2. Create Payment Request in Firestore
    await addDoc(collection(db, 'paymentRequests'), {
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName || 'Usuário',
      planId: selectedPlan.id,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    // 3. Notify Admin (Simulated Email)
    try {
      await fetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          userName: user.displayName || 'Usuário',
          planId: selectedPlan.id
        })
      });
    } catch (e) {
      console.error("Erro ao notificar admin:", e);
    }
    
    alert("Solicitação enviada! Mizael foi notificado e liberará seu acesso em breve.");
    setSelectedPlan(null);
    onBack();
  };

  const plans = [
    {
      id: 'free',
      name: 'Básico',
      price: 'R$ 0',
      period: 'sempre',
      description: 'Ideal para quem está começando agora.',
      icon: <Zap className="text-zinc-400" size={24} />,
      features: ['1 modelo simples', 'Exportação em PDF', 'Avaliação básica'],
      button: 'Plano Atual',
      variant: 'outline'
    },
    {
      id: 'pro',
      name: 'Profissional',
      price: 'R$ 9,90',
      period: 'por currículo',
      description: 'O melhor custo-benefício para sua carreira.',
      icon: <Crown className="text-amber-500" size={24} />,
      features: ['Modelos avançados', 'Sugestões inteligentes', 'Exportação PDF e Word', 'Prioridade no suporte', 'Foto no currículo'],
      button: 'Comprar Agora',
      variant: 'primary',
      popular: true
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 'R$ 19,90',
      period: 'por mês',
      description: 'Acesso total para candidatos de alto nível.',
      icon: <ShieldCheck className="text-emerald-500" size={24} />,
      features: ['Currículos ilimitados', 'Avaliação detalhada IA', 'Simulador de entrevista', 'Sem anúncios', 'Suporte VIP'],
      button: 'Assinar Agora',
      variant: 'secondary'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8">
      {selectedPlan && (
        <PaymentModal 
          plan={selectedPlan} 
          onConfirm={handleConfirmPayment} 
          onClose={() => setSelectedPlan(null)} 
        />
      )}
      
      <div className="text-center space-y-4">
        <motion.h2 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-bold tracking-tight"
        >
          Escolha o plano ideal para você
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-zinc-500 max-w-xl mx-auto text-lg"
        >
          Invista na sua carreira com ferramentas que destacam seu perfil profissional.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {plans.map((plan, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex"
          >
            <Card 
              className={`relative p-8 flex flex-col w-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 group ${
                plan.popular 
                  ? 'border-emerald-500 ring-4 ring-emerald-500/10 scale-105 z-10 bg-white' 
                  : 'hover:border-zinc-300'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg">
                  Mais Popular
                </div>
              )}
              
              <div className="mb-8 flex items-center justify-between">
                <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  {plan.icon}
                </div>
                {plan.popular && <Sparkles className="text-emerald-500 animate-pulse" size={20} />}
              </div>

              <div className="space-y-2 mb-8">
                <h3 className="font-bold text-2xl">{plan.name}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{plan.description}</p>
                <div className="flex items-baseline gap-1 pt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-zinc-400 text-sm">/{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-4 mb-10 flex-1">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm text-zinc-600">
                    <div className="w-5 h-5 bg-emerald-50 rounded-full flex items-center justify-center shrink-0">
                      <CheckCircle2 size={12} className="text-emerald-600" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              <Button 
                variant={plan.variant as any} 
                className={`w-full py-4 text-sm font-bold transition-all ${
                  plan.popular ? 'shadow-lg shadow-emerald-500/20' : ''
                }`}
                disabled={currentPlan === plan.id}
                onClick={() => plan.id !== 'free' && setSelectedPlan(plan)}
              >
                {currentPlan === plan.id ? 'Plano Atual' : plan.button}
              </Button>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="text-center pt-8">
        <button 
          onClick={onBack} 
          className="text-zinc-400 hover:text-black font-medium flex items-center gap-2 mx-auto transition-colors"
        >
          <ArrowLeft size={18} /> Voltar para o Dashboard
        </button>
      </div>
    </div>
  );
}

function AdminView({ onBack, onLogoutAdmin, onLogout }: { onBack: () => void, onLogoutAdmin: () => void, onLogout: () => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'paymentRequests'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Erro ao carregar solicitações:", err);
      setError("Acesso negado. Certifique-se de estar logado com sua conta Google administrativa.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (request: any) => {
    try {
      // 1. Update user plan
      await updateDoc(doc(db, 'users', request.userId), {
        plan: request.planId,
        subscriptionStatus: 'active',
        pendingPlan: null
      });

      // 2. Mark request as approved
      await updateDoc(doc(db, 'paymentRequests', request.id), {
        status: 'approved'
      });

      alert(`Acesso liberado para ${request.userEmail}!`);
    } catch (e) {
      console.error("Erro ao aprovar:", e);
      alert("Erro ao aprovar pagamento.");
    }
  };

  const handleReject = async (request: any) => {
    try {
      await updateDoc(doc(db, 'users', request.userId), {
        subscriptionStatus: 'active', // Back to active (or whatever it was)
        pendingPlan: null
      });

      await updateDoc(doc(db, 'paymentRequests', request.id), {
        status: 'rejected'
      });
    } catch (e) {
      console.error("Erro ao rejeitar:", e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Painel do Mizael</h2>
          <p className="text-zinc-500">Gerencie solicitações de acesso e pagamentos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onLogout} variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50">Sair da Conta</Button>
          <Button onClick={onLogoutAdmin} variant="ghost" className="text-zinc-500">Sair do Painel</Button>
          <Button onClick={onBack} variant="outline">Voltar</Button>
        </div>
      </div>

      {error && (
        <Card className="p-6 bg-red-50 border-red-100 text-red-700 space-y-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
          {!auth.currentUser && (
            <Button onClick={async () => {
              const provider = new GoogleAuthProvider();
              await signInWithPopup(auth, provider);
            }} variant="primary" className="w-full">
              Fazer Login com Google (Admin)
            </Button>
          )}
        </Card>
      )}

      {loading ? (
        <div className="py-20 text-center">Carregando solicitações...</div>
      ) : requests.length === 0 ? (
        <div className="py-20 text-center bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
          <p className="text-zinc-500">Nenhuma solicitação pendente no momento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{req.userName}</span>
                    <span className="text-xs px-2 py-0.5 bg-zinc-100 rounded-full text-zinc-500">{req.userEmail}</span>
                  </div>
                  <p className="text-sm text-zinc-500">Solicitou o plano <strong className="text-black uppercase">{req.planId}</strong></p>
                  <p className="text-[10px] text-zinc-400">Em {new Date(req.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => handleReject(req)} variant="ghost" className="text-red-600 hover:bg-red-50">Rejeitar</Button>
                  <Button onClick={() => handleApprove(req)} variant="secondary">Liberar Acesso</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsView({ user, onBack, onLogout, theme, setTheme, onViewChange, isAdminLoggedIn }: any) {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
        <button onClick={onBack} className="text-zinc-500 hover:text-black transition-colors"><X size={24} /></button>
      </div>

      <div className="space-y-6">
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Perfil</h3>
          <Card className="p-6 flex items-center gap-4">
            <img src={user.photoURL || ''} alt="" className="w-16 h-16 rounded-full border-2 border-zinc-100" />
            <div className="flex-1">
              <h4 className="font-bold text-lg">{user.displayName}</h4>
              <p className="text-zinc-500 text-sm">{user.email}</p>
            </div>
            <div className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-bold uppercase">{user.plan}</div>
          </Card>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Preferências</h3>
          <Card className="divide-y divide-zinc-100">
            <div className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-medium">Tema Escuro</p>
                <p className="text-xs text-zinc-500">Alternar entre modo claro e escuro.</p>
              </div>
              <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={`w-12 h-6 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-black' : 'bg-zinc-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${theme === 'dark' ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-medium">Idioma</p>
                <p className="text-xs text-zinc-500">Português (Brasil)</p>
              </div>
              <ChevronRight size={20} className="text-zinc-400" />
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Assinatura</h3>
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                  <CreditCard size={20} />
                </div>
                <div className="space-y-0.5">
                  <p className="font-medium">Gerenciar Plano</p>
                  <p className="text-xs text-zinc-500">Seu plano atual é o {user.plan}.</p>
                </div>
              </div>
              <Button onClick={() => onViewChange('plans')} variant="outline" className="text-xs py-1.5">Alterar</Button>
            </div>
            
            {user.subscriptionStatus === 'pending' && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900">Pagamento Pendente</p>
                  <p className="text-[10px] text-amber-700 leading-relaxed">
                    Você solicitou a ativação do plano <strong>{user.pendingPlan}</strong> via PIX. 
                    Nossa equipe está validando o comprovante.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </section>

        {(isAdminLoggedIn || (user && user.email === 'viralizaapp33@gmail.com')) && (
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Administração</h3>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-medium">Painel Administrativo</p>
                    <p className="text-xs text-zinc-500">Aprovar pagamentos e gerenciar usuários.</p>
                  </div>
                </div>
                <Button onClick={() => onViewChange('admin')} variant="primary" className="text-xs py-1.5">Acessar</Button>
              </div>
            </Card>
          </section>
        )}

        <div className="pt-8">
          <Button onClick={onLogout} variant="danger" className="w-full py-3">
            Sair da Conta
          </Button>
        </div>
      </div>
    </div>
  );
}
