import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Video, 
  Music, 
  Type, 
  CheckCircle, 
  ChevronRight, 
  ChevronLeft, 
  Clock,
  Save,
  FileText,
  Trash2,
  Plus,
  Smartphone, 
  Youtube, 
  Share2, 
  Mail,
  Mic2,
  Palette,
  Sparkles,
  Play,
  Moon,
  Sun,
  Search,
  LayoutGrid,
  CreditCard,
  BookOpen,
  Receipt,
  ArrowLeft,
  Camera,
  ShieldAlert,
  ChevronDown,
  Scissors,
  Crop,
  Layers,
  Maximize2,
  Volume2,
  Pause,
  Download,
  Settings,
  Cloud,
  ExternalLink,
  Cpu,
  Database,
  Zap,
  LogIn,
  LogOut,
  User,
  RefreshCw,
  Grid,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, 
  auth, 
  signInWithGoogle, 
  signOutUser 
} from '../lib/firebase';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';

const AutoReelApp = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAIScripting, setIsAIScripting] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Initializing Foundry...');
  const [result, setResult] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [activeNav, setActiveNav] = useState('create');
  const [drafts, setDrafts] = useState<{id: string, name: string, data: any, date: string}[]>([]);
  const [lastAutosave, setLastAutosave] = useState<Date | null>(null);
  const [showAutosaveIndicator, setShowAutosaveIndicator] = useState(false);
  const [hasAutosave, setHasAutosave] = useState(false);
  
  // Storage Integration State
  const [cloudLinks, setCloudLinks] = useState<{id: string, label: string, url: string}[]>([]);
  const [newCloudLink, setNewCloudLink] = useState({ label: '', url: '' });
  
  const [cloudProjects, setCloudProjects] = useState<any[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  
  // Editing States
  const [editMode, setEditMode] = useState<'trim' | 'crop' | 'text' | 'layers' | 'audio' | 'config' | 'templates' | null>(null);
  
  // Advanced Video Editing State
  const [clips, setClips] = useState([
    { id: 'c1', name: 'Scene 1: Intro', duration: 5, color: 'bg-blue-500' },
    { id: 'c2', name: 'Scene 2: Core Message', duration: 12, color: 'bg-purple-500' },
    { id: 'c3', name: 'Scene 3: Outro & Hooks', duration: 8, color: 'bg-[#FF1E6C]' }
  ]);
  const totalDuration = clips.reduce((acc, c) => acc + c.duration, 0);
  const [timelineScrub, setTimelineScrub] = useState(0);

  const moveClip = (index: number, dir: number) => {
    const newClips = [...clips];
    if (index + dir >= 0 && index + dir < newClips.length) {
      const temp = newClips[index];
      newClips[index] = newClips[index + dir];
      newClips[index + dir] = temp;
      setClips(newClips);
    }
  };
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [builderTab, setBuilderTab] = useState<'text' | 'bg' | 'layers'>('text');
  const [customTemplates, setCustomTemplates] = useState<{id: string, name: string, config: any}[]>([]);
  const [newTemplateData, setNewTemplateData] = useState({
    name: 'Untitled Template',
    layout: 'standard',
    textStyle: {
      color: '#FFFFFF',
      fontSize: 24,
      fontFamily: 'Inter',
      style: 'Default',
      animation: 'slide-up',
      animationDuration: 0.5,
      animationDelay: 0.1,
      easing: 'ease-out',
      intensity: 'medium',
      direction: 'up',
      letterSpacing: '0px',
    },
    background: {
      type: 'mesh' as 'mesh' | 'color' | 'gradient' | 'video',
      primaryColor: '#FF1E6C',
      secondaryColor: '#1a2131',
      gradientStops: ['#FF1E6C', '#1a2131'],
      meshComplexity: 3,
      videoUrl: '',
      opacity: 80,
      blur: 20,
    },
    layers: [
      { id: 'bg', name: 'Background', visible: true, zIndex: 0, locked: true },
      { id: 'overlays', name: 'Graphics', visible: true, zIndex: 1, locked: false },
      { id: 'text', name: 'Typography', visible: true, zIndex: 2, locked: false }
    ],
    transition: 'fade'
  });
  
  const freeTemplates = [
    { id: 'cinematic', name: 'Cinematic', icon: <Camera size={16} />, desc: 'Dramatic lighting & cinematic bars' },
    { id: 'minimal', name: 'Minimal', icon: <LayoutGrid size={16} />, desc: 'Clean typography & subtle fades' },
    { id: 'gaming', name: 'Gaming Pro', icon: <Zap size={16} />, desc: 'High energy & neon accents' },
    { id: 'vlog', name: 'Daily Vlog', icon: <Smartphone size={16} />, desc: 'Warm tones & handwritten text' }
  ];

  useEffect(() => {
    const savedCustom = localStorage.getItem('autoreels_custom_templates');
    if (savedCustom) setCustomTemplates(JSON.parse(savedCustom));
  }, []);

  const saveCustomTemplate = async () => {
    if (user) {
        try {
            await addDoc(collection(db, 'userTemplates'), {
                name: newTemplateData.name,
                config: newTemplateData,
                userId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            setIsTemplateEditorOpen(false);
            alert('Template saved to cloud library!');
        } catch (error) {
            console.error(error);
            alert('Failed to save template to cloud.');
        }
    } else {
        const template = {
            id: Date.now().toString(),
            name: newTemplateData.name,
            config: { ...newTemplateData }
        };
        const updated = [...customTemplates, template];
        setCustomTemplates(updated);
        localStorage.setItem('autoreels_custom_templates', JSON.stringify(updated));
        setIsTemplateEditorOpen(false);
        alert('Template saved locally!');
    }
  };

  const deleteCustomTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user) {
        deleteDoc(doc(db, 'userTemplates', id));
    } else {
        const updated = customTemplates.filter(t => t.id !== id);
        setCustomTemplates(updated);
        localStorage.setItem('autoreels_custom_templates', JSON.stringify(updated));
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Sync Projects with Cloud
  useEffect(() => {
    if (!user) {
        setCloudProjects([]);
        return;
    }
    const q = query(
        collection(db, 'projects'),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const projects = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        setCloudProjects(projects);
    });
    return () => unsubscribe();
  }, [user]);

  // Sync Templates with Cloud
  useEffect(() => {
    if (!user) return;
    const q = query(
        collection(db, 'userTemplates'),
        where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const templates = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        setCustomTemplates(templates);
    });
    return () => unsubscribe();
  }, [user]);
  
  const [trimRange, setTrimRange] = useState([0, 30]);
  const [cropRatio, setCropRatio] = useState('16:9');
  const [overlayText, setOverlayText] = useState('');
  const [overlayConfig, setOverlayConfig] = useState({
     color: '#FFFFFF',
     fontSize: 24,
     fontFamily: 'Inter',
     style: 'Default' as 'Default' | 'Bold' | 'Outline' | 'Badge'
  });
  const [isApplyingEdits, setIsApplyingEdits] = useState(false);
  
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [musicSearch, setMusicSearch] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const aiArtStyles = [
    { id: 'AUTOREELS', name: 'AUTOREELS', desc: 'Default high-speed reel production style', icon: <Sparkles size={16} /> },
    { id: 'COMIC_BOOK', name: 'COMIC BOOK', desc: 'Bold panels, halftone inks & dramatic captions', icon: <BookOpen size={16} /> },
    { id: 'DISNEY_TOON', name: 'DISNEY TOON', desc: 'Playful animation with warm colors and soft edges', icon: <Camera size={16} /> },
    { id: 'STEAMPUNK', name: 'STEAMPUNK', desc: 'Retro-futuristic brass machinery and Victorian detail', icon: <Layers size={16} /> },
    { id: 'SURREALISM', name: 'SURREALISM', desc: 'Dreamlike visuals with unexpected composition', icon: <Sparkles size={16} /> },
    { id: 'VINTAGE_CARTOON', name: 'VINTAGE CARTOON', desc: 'Old-school hand-drawn nostalgic animation', icon: <Palette size={16} /> },
    { id: 'NEON_VAPORWAVE', name: 'NEON VAPORWAVE', desc: 'Bold neon pastels, retro-futuristic vibes', icon: <Cpu size={16} /> },
    { id: 'PENCIL_SKETCH', name: 'PENCIL SKETCH', desc: 'Monochrome lines, shading and textured strokes', icon: <Pencil size={16} /> },
    { id: 'RETRO_80S_90S', name: 'RETRO 80s/90s', desc: 'Vintage synthwave, VHS glow and arcade nostalgia', icon: <Grid size={16} /> },
    { id: 'GRUNGE', name: 'GRUNGE', desc: 'Raw texture, contrast and gritty atmosphere', icon: <ShieldAlert size={16} /> },
    { id: 'ILLUSTRATIVE_REALISM', name: 'ILLUSTRATIVE REALISM', desc: 'Highly detailed realistic illustration style', icon: <Layers size={16} /> },
    { id: 'IMPRESSIONISM', name: 'IMPRESSIONISM', desc: 'Painterly brush strokes and expressive colors', icon: <Palette size={16} /> },
    { id: 'FANTASY_ANIME', name: 'FANTASY ANIME', desc: 'Lush anime scenery with dramatic fantasy creatures', icon: <Sparkles size={16} /> },
    { id: 'FANTASY_REALISM', name: 'FANTASY REALISM', desc: 'Epic fantasy scenes with lifelike detail', icon: <Camera size={16} /> },
    { id: 'FLAT_ART', name: 'FLAT ART', desc: 'Minimal shapes, bright colors and graphic clarity', icon: <Grid size={16} /> },
    { id: 'PIXAR', name: 'PIXAR', desc: 'Modern 3D-inspired polished character animation', icon: <Layers size={16} /> },
    { id: 'ART_DECO', name: 'ART DECO', desc: 'Stylized geometry and luxe gold color palettes', icon: <Sparkles size={16} /> },
    { id: 'BLACK_WHITE_NOIR', name: 'BLACK & WHITE NOIR', desc: 'High-contrast cinematic monochrome drama', icon: <Camera size={16} /> },
    { id: 'CYBERPUNK', name: 'CYBERPUNK', desc: 'Glitchy neon cityscapes and urban tech futures', icon: <Cpu size={16} /> },
    { id: 'CHARCOAL', name: 'CHARCOAL', desc: 'Deep black charcoal lines and smoky shading', icon: <ShieldAlert size={16} /> },
    { id: 'GTA_V', name: 'GTA V', desc: 'Urban game art style with bold outlines and cinematic color', icon: <Video size={16} /> },
    { id: 'ANIME', name: 'ANIME', desc: 'Classic anime visuals with crisp color and motion', icon: <Palette size={16} /> }
  ];

  const getArtStylePrompt = (styleId: string) => {
    const normalized = styleId.replace(/_/g, ' ');
    return `in ${normalized} style, high quality`;
  };

  const [formData, setFormData] = useState({
    platform: 'tiktok',
    aspectRatio: '9:16',
    artStyle: 'AUTOREELS',
    voice: 'marin',
    script: '',
    music: 'energetic',
    contentMode: 'theme' as 'theme' | 'prompt',
    theme: '',
    visualSource: 'stock' as 'ai' | 'stock',
    stockSearch: '',
    artType: 'image' as 'image' | 'video',
    voiceEngine: 'autoreels' as 'autoreels' | 'elevenlabs',
    voiceMode: 'tts' as 'tts' | 'upload',
    uploadedVoiceUrl: '' as string,
    artEngine: 'autoreels' as 'autoreels' | 'gemini',
    destination: 'TikTok',
    language: 'English',
    duration: 30,
    subtitlesEnabled: true,
    subtitlePosition: 'Center',
    subtitleFont: 'Arial',
    subtitleColor: '#FFFFFF',
    subtitleSize: 50,
    subtitleBold: true,
    subtitleShadow: true,
    subtitleShadowColor: '#000000',
    musicEnabled: true,
    selectedMusicCategory: 'W I L D',
    selectedTrackIndex: 1,
    selectedTrackName: 'Alpha Prime',
  });

  const musicLibrary = [
    { category: 'Moods', subcategories: [
      { name: 'Upbeat', tracks: [
        { name: 'Alpha Prime', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', mood: 'upbeat' },
        { name: 'Neon Jungle', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', mood: 'upbeat' },
        { name: 'Power Surge', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', mood: 'upbeat' }
      ]},
      { name: 'Calm', tracks: [
        { name: 'Ocean Breeze', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', mood: 'calm' },
        { name: 'Midnight City', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', mood: 'calm' },
        { name: 'Serenity', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', mood: 'calm' }
      ]}
    ]}
  ];

  const filteredMusic = musicLibrary.map(group => ({
    ...group,
    subcategories: group.subcategories.map(cat => ({
      ...cat,
      tracks: cat.tracks.filter(t => 
        t.name.toLowerCase().includes(musicSearch.toLowerCase()) || 
        cat.name.toLowerCase().includes(musicSearch.toLowerCase())
      )
    })).filter(cat => cat.tracks.length > 0)
  })).filter(group => group.subcategories.length > 0);

  useEffect(() => {
    const savedDrafts = localStorage.getItem('autoreels_drafts');
    if (savedDrafts) setDrafts(JSON.parse(savedDrafts));
    const savedAutosave = localStorage.getItem('autoreels_autosave');
    if (savedAutosave) setHasAutosave(true);
  }, []);

  const saveDraft = async () => {
    const name = formData.theme || formData.stockSearch || `Untitled Project ${drafts.length + 1}`;
    if (user) {
        try {
            await addDoc(collection(db, 'projects'), {
                name,
                formData,
                userId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            alert('Project saved to cloud successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to save project to cloud.');
        }
    } else {
        const newDraft = {
            id: Date.now().toString(),
            name,
            data: formData,
            date: new Date().toLocaleDateString()
        };
        const updatedDrafts = [newDraft, ...drafts];
        setDrafts(updatedDrafts);
        localStorage.setItem('autoreels_drafts', JSON.stringify(updatedDrafts));
        alert('Draft saved locally. Log in to sync across devices!');
    }
  };

  const loadDraft = (draft: any) => {
    setFormData(draft.data);
    setActiveStep(1);
    setActiveNav('create');
  };

  const applyEdits = () => {
    setIsApplyingEdits(true);
    setTimeout(() => {
      setIsApplyingEdits(false);
      setEditMode(null);
      alert('Edits applied successfully!');
    }, 2000);
  };

  const generateAIScript = async () => {
    if (!formData.theme) return alert("Please enter a theme first!");
    setIsAIScripting(true);
    setStatusMessage('Composing script with deterministic Gemini instructions...');
    try {
      const response = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: formData.theme,
          destination: formData.destination,
          duration: formData.duration,
          artStyle: formData.artStyle
        })
      });
      const data = await response.json();
      setFormData(prev => ({
        ...prev,
        script: data?.script || "Default scripting template active."
      }));
      setStatusMessage('Script ready. Ready for production.');
    } catch (error) {
      console.error(error);
      setFormData(prev => ({ ...prev, script: "Default scripting template active." }));
      setStatusMessage('Script generation failed, using fallback template.');
    } finally {
      setIsAIScripting(false);
    }
  };

  const handleGenerate = async () => {
    if (!formData.theme) return alert('Enter a theme first.');
    if (!formData.script) await generateAIScript();
    setIsGenerating(true);
    setGenerationProgress(0);
    setStatusMessage('Building the deterministic media pipeline...');

    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 98) return 98;
        return prev + 2;
      });
    }, 250);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: formData.theme,
          destination: formData.destination,
          duration: formData.duration,
          artStyle: formData.artStyle,
          script: formData.script,
          subtitleConfig: {
            position: formData.subtitlePosition,
            font: formData.subtitleFont,
            color: formData.subtitleColor,
            size: formData.subtitleSize,
            bold: formData.subtitleBold,
            shadow: formData.subtitleShadow,
            shadowColor: formData.subtitleShadowColor
          },
          musicKeyword: formData.selectedTrackName
        })
      });
      const data = await response.json();
      clearInterval(progressInterval);
      setGenerationProgress(100);
      setStatusMessage(data?.message || 'Production complete.');
      setResult({ success: true, url: data?.videoUrl ?? '', pipeline: data?.pipeline });
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Production failed:', error);
      setStatusMessage('Production failed. Check server logs.');
      setResult({ success: false, url: '', error: error?.message || 'Production error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewTrack = (e: React.MouseEvent, trackUrl: string) => {
    e.stopPropagation();
    if (playingTrack === trackUrl) {
      setPlayingTrack(null);
    } else {
      setPlayingTrack(trackUrl);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#1a2131]' : 'bg-slate-50'} text-slate-200 font-sans pb-32 overflow-x-hidden`}>
      {playingTrack && (
        <audio 
          ref={audioRef} 
          src={playingTrack} 
          autoPlay 
          onEnded={() => setPlayingTrack(null)} 
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-6 max-w-7xl mx-auto border-b border-white/5 sticky top-0 bg-[#1a2131]/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF1E6C] flex items-center justify-center shadow-lg shadow-[#FF1E6C]/20">
            <Video className="text-white" size={24} />
          </div>
          <span className="text-xl font-black text-white tracking-tighter">MediaForge</span>
        </div>
        <div className="flex items-center gap-4">
           {user ? (
              <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                 <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-[#FF1E6C]" />
                 <div className="hidden sm:block">
                    <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Active Member</div>
                    <div className="text-xs font-bold text-white max-w-[100px] truncate">{user.displayName}</div>
                 </div>
                 <button onClick={signOutUser} className="p-2 text-slate-400 hover:text-red-400 transition-colors"><LogOut size={18} /></button>
              </div>
           ) : (
              <button onClick={signInWithGoogle} className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-900 rounded-xl font-bold text-xs uppercase shadow-lg shadow-white/10">
                 <LogIn size={16} /> <span className="hidden sm:inline">Sign In</span>
              </button>
           )}
           <button onClick={saveDraft} className="p-2.5 bg-green-500/10 text-green-500 rounded-xl border border-green-500/20"><Save size={20} /></button>
           <button onClick={() => setDarkMode(!darkMode)} className="p-2 hover:bg-white/5 rounded-full text-slate-400">
             {darkMode ? <Sun size={20} /> : <Moon size={20} />}
           </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 lg:grid lg:grid-cols-12 lg:gap-12 pt-10">
        <div className="lg:col-span-8 space-y-12">
          {/* Progress Swiper */}
          <div className="flex justify-between items-center px-4 relative">
             <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-800 mx-10 -z-0" />
             {[1, 2, 3, 4].map(s => (
                <div key={s} className="flex flex-col items-center gap-2 relative z-10">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${activeStep === s ? 'bg-[#FF1E6C] text-white ring-4 ring-[#1a2131]' : activeStep > s ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                      {s}
                   </div>
                </div>
             ))}
          </div>

          <div className="min-h-[600px]">
             {activeNav === 'drafts' && (
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  <div className="flex justify-between items-end">
                     <div>
                        <h2 className="text-3xl font-black text-white">Project Library</h2>
                        <p className="text-slate-500 text-sm mt-2">Manage your local drafts and cloud synced projects.</p>
                     </div>
                     <button onClick={saveDraft} className="px-6 py-3 bg-[#FF1E6C] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <Plus size={16} /> New Draft
                     </button>
                  </div>

                  {user ? (
                    <div className="space-y-8">
                       <div className="flex items-center gap-3 text-[#FF1E6C]">
                          <Cloud size={20} />
                          <h3 className="font-bold uppercase tracking-widest text-[10px]">Cloud Sync Active</h3>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {cloudProjects.map((p) => (
                             <div key={p.id} className="bg-slate-900 border border-white/5 rounded-3xl p-6 group hover:border-[#FF1E6C]/30 transition-all cursor-pointer" onClick={() => loadDraft({ data: p.formData })}>
                                <div className="flex justify-between items-start mb-6">
                                   <div className="w-12 h-12 bg-[#FF1E6C]/10 rounded-2xl flex items-center justify-center text-[#FF1E6C]">
                                      <Database size={24} />
                                   </div>
                                   <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteDoc(doc(db, 'projects', p.id));
                                        }}
                                        className="p-2 bg-red-500/10 text-red-500 rounded-lg"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                   </div>
                                </div>
                                <h4 className="font-bold text-white mb-1">{p.name}</h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
                                   <Clock size={12} />
                                   {p.updatedAt?.toDate().toLocaleDateString()}
                                </div>
                             </div>
                          ))}
                          {cloudProjects.length === 0 && (
                             <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                                <Cloud className="mx-auto text-slate-700 mb-4" size={48} />
                                <p className="text-slate-500 font-bold">No cloud projects found.</p>
                             </div>
                          )}
                       </div>
                    </div>
                  ) : (
                    <div className="bg-[#FF1E6C]/5 border border-[#FF1E6C]/20 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8">
                       <div className="w-20 h-20 bg-[#FF1E6C] rounded-full flex items-center justify-center text-white shrink-0 shadow-2xl shadow-[#FF1E6C]/20">
                          <LogIn size={40} />
                       </div>
                       <div className="space-y-4 text-center md:text-left">
                          <h3 className="text-xl font-bold text-white">Enable Cloud Sync</h3>
                          <p className="text-slate-400 text-sm max-w-md">Log in with Google to save your projects to the secure cloud and access them from any device.</p>
                          <button onClick={signInWithGoogle} className="px-8 py-3 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest">Sign In to Cloud</button>
                       </div>
                    </div>
                  )}

                  <div className="space-y-6 pt-12 border-t border-white/5">
                     <h3 className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Local Drafts</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {drafts.map((d) => (
                           <div key={d.id} className="bg-slate-950 border border-white/5 rounded-3xl p-6 group hover:border-slate-700 transition-all cursor-pointer" onClick={() => loadDraft(d)}>
                              <div className="flex justify-between items-start mb-4">
                                 <FileText className="text-slate-500" size={24} />
                                 <button 
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       const updated = drafts.filter(x => x.id !== d.id);
                                       setDrafts(updated);
                                       localStorage.setItem('autoreels_drafts', JSON.stringify(updated));
                                    }}
                                    className="p-2 bg-white/5 text-slate-500 rounded-lg opacity-0 group-hover:opacity-100"
                                 >
                                    <Trash2 size={16} />
                                 </button>
                              </div>
                              <h4 className="font-bold text-white text-sm truncate">{d.name}</h4>
                              <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">{d.date}</p>
                           </div>
                        ))}
                     </div>
                  </div>
               </motion.div>
             )}

             {activeNav === 'assets' && (
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-12">
                  <div className="flex justify-between items-center">
                     <div>
                        <h2 className="text-4xl font-black text-white">Cloud Assets</h2>
                        <p className="text-slate-500 font-medium mt-2">Centralized library for Drive, Dropbox & External assets.</p>
                     </div>
                     <div className="flex gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-[#FF1E6C]"><Search size={24} /></div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-green-500"><Plus size={24} /></div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     {[
                        { title: 'Google Drive', icon: <Database className="text-blue-500" /> , count: 12, size: '2.4 GB' },
                        { title: 'Dropbox', icon: <ExternalLink className="text-indigo-500" /> , count: 5, size: '840 MB' },
                        { title: 'S3 Foundry', icon: <Cpu className="text-purple-500" /> , count: 42, size: '15.2 GB' }
                     ].map(storage => (
                        <div key={storage.title} className="bg-slate-900/50 border border-white/5 p-8 rounded-[3rem] space-y-6 hover:bg-[#FF1E6C]/5 transition-all group">
                           <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center border border-white/5 group-hover:border-[#FF1E6C]/20 transition-all">
                              {storage.icon}
                           </div>
                           <div className="space-y-1">
                              <h3 className="text-xl font-bold text-white">{storage.title}</h3>
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{storage.count} Assets • {storage.size}</p>
                           </div>
                           <button className="w-full py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:bg-[#FF1E6C] group-hover:text-white transition-all">Explore</button>
                        </div>
                     ))}
                  </div>

                  <div className="bg-slate-950 border border-white/5 rounded-[3rem] p-10 space-y-8">
                     <h3 className="text-xl font-bold text-white flex items-center gap-3"><ExternalLink className="text-[#FF1E6C]" /> Link Cloud Assets</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Asset Label</label>
                           <input 
                              type="text" 
                              placeholder="e.g. Hero Video Background" 
                              className="w-full bg-[#1e293b] border border-slate-700/50 p-5 rounded-2xl text-white focus:outline-none focus:border-[#FF1E6C]"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Source URL (Drive/Dropbox/S3)</label>
                           <input 
                              type="text" 
                              placeholder="https://..." 
                              className="w-full bg-[#1e293b] border border-slate-700/50 p-5 rounded-2xl text-white focus:outline-none focus:border-[#FF1E6C]"
                           />
                        </div>
                     </div>
                     <button className="px-10 py-5 bg-[#FF1E6C] text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-[#FF1E6C]/30 flex items-center gap-3">
                        <RefreshCw size={20} /> Register Asset
                     </button>
                  </div>
               </motion.div>
             )}
             {activeNav === 'create' && activeStep === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                   <h2 className="text-2xl font-bold text-white">Target Platform</h2>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {['tiktok', 'youtube', 'meta', 'mail'].map(p => (
                         <button key={p} onClick={() => setFormData({...formData, platform: p})} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-4 transition-all ${formData.platform === p ? 'border-[#FF1E6C] bg-[#FF1E6C]/5 shadow-xl shadow-[#FF1E6C]/10' : 'border-slate-800 bg-[#1e293b]'}`}>
                            <Smartphone className={formData.platform === p ? 'text-white' : 'text-slate-500'} size={24} />
                            <span className="font-bold text-xs uppercase text-white">{p}</span>
                         </button>
                      ))}
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                         <h3 className="text-xl font-bold text-white">Aspect Ratio</h3>
                         <div className="flex p-1.5 bg-[#0f172a] rounded-[1.5rem] border border-white/5">
                            {['9:16', '16:9', '1:1'].map(r => (
                               <button key={r} onClick={() => setFormData({...formData, aspectRatio: r})} className={`flex-1 py-4 rounded-[1.2rem] text-sm font-bold transition-all ${formData.aspectRatio === r ? 'bg-[#FF1E6C] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{r}</button>
                            ))}
                         </div>
                      </div>
                      <div className="space-y-4">
                         <h3 className="text-xl font-bold text-white">Video Duration</h3>
                         <div className="flex p-1.5 bg-[#0f172a] rounded-[1.5rem] border border-white/5">
                            {[15, 30, 60, 90].map(d => (
                               <button key={d} onClick={() => setFormData({...formData, duration: d})} className={`flex-1 py-4 rounded-[1.2rem] text-sm font-bold transition-all ${formData.duration === d ? 'bg-[#FF1E6C] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{d}s</button>
                            ))}
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                     <h3 className="text-xl font-bold text-white">Visual Art Style</h3>
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {aiArtStyles.map((style) => (
                           <button 
                              key={style.id} 
                              onClick={() => setFormData({...formData, artStyle: style.id})}
                              className={`p-4 rounded-2xl border flex flex-col items-start gap-2 text-left transition-all ${formData.artStyle === style.id ? 'bg-[#FF1E6C] border-[#FF1E6C] text-white shadow-lg' : 'bg-slate-900 border-white/5 hover:border-slate-700'}`}
                           >
                              <div className={`p-2 rounded-lg ${formData.artStyle === style.id ? 'bg-white/20' : 'bg-slate-800 text-slate-400'}`}>
                                 {style.icon}
                              </div>
                              <div>
                                 <div className="text-[10px] font-bold uppercase tracking-wider">{style.name}</div>
                                 <div className={`text-[8px] leading-tight mt-1 ${formData.artStyle === style.id ? 'text-white/70' : 'text-slate-500'}`}>{style.desc}</div>
                              </div>
                           </button>
                        ))}
                     </div>
                   </div>
                </motion.div>
             )}

             {activeNav === 'create' && activeStep === 2 && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <h2 className="text-2xl font-bold text-white">Script & Theme</h2>
                  <div className="space-y-4">
                     <div className="flex gap-4">
                        <select 
                          className="flex-1 bg-[#1e293b] border border-slate-700/50 rounded-2xl p-5 text-white focus:outline-none"
                          value={formData.theme}
                          onChange={(e) => setFormData({...formData, theme: e.target.value})}
                        >
                          <option value="" disabled>Choose a viral theme...</option>
                          <option value="Motivational Quotes">Motivational Quotes</option>
                          <option value="True Crime Stories">True Crime Stories</option>
                          <option value="Life Hacks">Life Hacks</option>
                        </select>
                        <button onClick={generateAIScript} className="px-6 bg-[#FF1E6C] text-white rounded-2xl font-bold flex items-center justify-center gap-2">
                           <Sparkles size={20} /> AI Script
                        </button>
                     </div>
                     <textarea 
                        className="w-full h-64 bg-[#1e293b] border border-slate-700/30 rounded-3xl p-6 text-white text-sm focus:outline-none"
                        value={formData.script}
                        placeholder="Write or generate your script here..."
                        onChange={(e) => setFormData({...formData, script: e.target.value})}
                     />
                  </div>
               </motion.div>
             )}

             {activeNav === 'create' && activeStep === 3 && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <h2 className="text-2xl font-bold text-white">Customization</h2>
                  
                  {/* Music Interaction Table */}
                  <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-8 space-y-6">
                     <h3 className="text-lg font-bold text-white flex items-center gap-2"><Music size={20} className="text-[#FF1E6C]" /> Music Foundry</h3>
                     <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                        {musicLibrary[0].subcategories[0].tracks.map((track, i) => (
                           <div key={i} className={`p-4 rounded-xl flex items-center justify-between border cursor-pointer transition-all ${formData.selectedTrackName === track.name ? 'bg-[#FF1E6C] border-[#FF1E6C] text-white' : 'bg-slate-800 border-white/5 text-slate-400'}`} onClick={() => setFormData({...formData, selectedTrackName: track.name})}>
                              <div className="flex items-center gap-4">
                                 <Play size={16} className={playingTrack === track.url ? 'text-white' : ''} />
                                 <span className="font-bold text-sm tracking-tight">{track.name}</span>
                              </div>
                              <button onClick={(e) => handlePreviewTrack(e, track.url)} className={`p-2 rounded-lg ${playingTrack === track.url ? 'bg-white text-[#FF1E6C]' : 'bg-slate-700'}`}>
                                 {playingTrack === track.url ? <Pause size={14} /> : <Play size={14} />}
                              </button>
                           </div>
                        ))}
                     </div>
                  </div>
               </motion.div>
             )}

             {activeNav === 'create' && activeStep === 4 && !result && (
               <div className="space-y-12 text-center py-20">
                  <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                     <CheckCircle className="text-green-500" size={48} />
                  </div>
                  <h2 className="text-3xl font-black text-white">Ready for Production</h2>
                  <p className="text-slate-400 max-w-md mx-auto">All assets synced. Click Forge to start the AI production engine.</p>
                  
                  {isGenerating && (
                    <div className="w-full max-w-sm mx-auto space-y-4">
                       <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <motion.div animate={{ width: `${generationProgress}%` }} className="h-full bg-[#FF1E6C]" />
                       </div>
                       <p className="text-[10px] font-black text-[#FF1E6C] uppercase tracking-widest">{statusMessage}</p>
                    </div>
                  )}
               </div>
             )}

             {result && (
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  <div className="bg-slate-900 rounded-[2.5rem] border border-white/5 p-8 space-y-8 overflow-hidden">
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500"><Maximize2 size={24} /></div>
                           <h3 className="font-bold text-white text-lg">Production Studio</h3>
                        </div>
                        <div className="flex gap-2">
                           <button className="p-3 bg-white/5 rounded-xl text-slate-400"><Share2 size={20} /></button>
                           <button className="px-6 py-3 bg-[#FF1E6C] text-white rounded-xl font-bold text-xs uppercase">Download HD</button>
                        </div>
                     </div>

                     {/* Video Preview */}
                     <div 
                        className="relative bg-black rounded-[2rem] overflow-hidden flex items-center justify-center shadow-2xl mx-auto transition-all duration-300"
                        style={{ aspectRatio: cropRatio.replace(':', '/'), maxHeight: '500px', width: cropRatio === '9:16' ? 'auto' : '100%' }}
                     >
                        <Play size={48} className="text-white/40 cursor-pointer hover:scale-110 transition-transform" />
                        {result?.url && (
                           <a href={result.url} target="_blank" rel="noreferrer" className="absolute inset-x-0 bottom-6 mx-auto w-fit px-6 py-3 bg-[#FF1E6C] text-white rounded-full font-bold text-sm shadow-xl shadow-[#FF1E6C]/30">Watch generated reel</a>
                        )}
                        
                        {overlayText && (
                           <motion.div 
                              drag
                              className={`absolute px-4 py-2 backdrop-blur-md rounded-lg border border-white/20 font-bold cursor-move z-20 shadow-2xl
                                 ${overlayConfig.style === 'Outline' ? 'text-transparent' : 'text-white'}
                                 ${overlayConfig.style === 'Badge' ? 'bg-[#FF1E6C]' : 'bg-black/40'}
                              `}
                              style={{ 
                                 color: overlayConfig.style === 'Outline' ? 'transparent' : overlayConfig.color,
                                 fontSize: `${overlayConfig.fontSize}px`,
                                 WebkitTextStroke: overlayConfig.style === 'Outline' ? `1px ${overlayConfig.color}` : 'none'
                              }}
                           >
                              {overlayText}
                           </motion.div>
                        )}
                        
                        <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-2">
                           <div className="flex items-center justify-between text-xs font-mono text-white/60 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
                              <span>{Math.floor(timelineScrub)}s</span>
                              <span>{totalDuration}s</span>
                           </div>
                           <input 
                              type="range" 
                              min="0" 
                              max={totalDuration} 
                              step="0.1"
                              value={timelineScrub} 
                              onChange={(e) => setTimelineScrub(parseFloat(e.target.value))} 
                              className="w-full accent-[#FF1E6C] cursor-ew-resize h-1 bg-white/20 appearance-none rounded-full"
                           />
                           <style>
                              {`
                              input[type=range]::-webkit-slider-thumb {
                                appearance: none;
                                width: 12px;
                                height: 12px;
                                background: #FF1E6C;
                                border-radius: 50%;
                                cursor: ew-resize;
                              }
                              `}
                           </style>
                        </div>
                     </div>

                     {/* Editing Toolbar */}
                     <div className="flex gap-2 p-1.5 bg-slate-950/50 rounded-2xl border border-white/5 overflow-x-auto">
                        {['templates', 'trim', 'crop', 'text', 'audio', 'config'].map((tool) => (
                           <button 
                              key={tool} 
                              onClick={() => setEditMode(editMode === tool ? null : tool as any)}
                              className={`px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all ${editMode === tool ? 'bg-[#FF1E6C] text-white shadow-lg shadow-[#FF1E6C]/20' : 'bg-transparent text-slate-500 hover:text-white'}`}
                           >
                              {tool === 'templates' && <Sparkles size={18} />}
                              {tool === 'trim' && <Scissors size={18} />}
                              {tool === 'crop' && <Crop size={18} />}
                              {tool === 'text' && <Type size={18} />}
                              {tool === 'audio' && <Music size={18} />}
                              {tool === 'config' && <Settings size={18} />}
                              {tool === 'templates' ? 'Templates' : tool}
                           </button>
                        ))}
                     </div>

                     <AnimatePresence mode="wait">
                        {editMode === 'templates' && (
                           <motion.div key="templates" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 pt-4">
                              {!isTemplateEditorOpen ? (
                                <>
                                  <div className="flex justify-between items-center mb-2">
                                     <div className="text-[10px] font-black uppercase text-[#FF1E6C] tracking-[0.2em] flex items-center gap-2">
                                        <Sparkles size={12} /> Free Styles
                                     </div>
                                     <button 
                                       onClick={() => setIsTemplateEditorOpen(true)}
                                       className="flex items-center gap-1.5 text-[10px] font-black uppercase text-green-500 hover:text-green-400 transition-colors"
                                     >
                                        <Plus size={14} /> Create Template
                                     </button>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3 mb-6">
                                     {freeTemplates.map((t) => (
                                        <button 
                                           key={t.id} 
                                           onClick={() => setSelectedTemplate(t.id)}
                                           className={`p-4 rounded-2xl border flex flex-col items-start gap-2 text-left transition-all ${selectedTemplate === t.id ? 'bg-[#FF1E6C] border-[#FF1E6C] text-white shadow-lg' : 'bg-slate-900 border-white/5'}`}
                                        >
                                           <div className={`p-2 rounded-lg ${selectedTemplate === t.id ? 'bg-white/20' : 'bg-slate-800 text-slate-400'}`}>
                                              {t.icon}
                                           </div>
                                           <div>
                                              <div className="text-xs font-bold">{t.name}</div>
                                              <div className={`text-[10px] ${selectedTemplate === t.id ? 'text-white/70' : 'text-slate-500'}`}>{t.desc}</div>
                                           </div>
                                        </button>
                                     ))}
                                  </div>

                                  {customTemplates.length > 0 && (
                                    <>
                                      <div className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-4">My Custom Library</div>
                                      <div className="grid grid-cols-2 gap-3">
                                         {customTemplates.map((t) => (
                                            <div 
                                              key={t.id} 
                                              className="group relative"
                                            >
                                               <button 
                                                  onClick={() => setSelectedTemplate(t.id)}
                                                  className={`w-full p-4 rounded-2xl border flex flex-col items-start gap-2 text-left transition-all ${selectedTemplate === t.id ? 'bg-[#FF1E6C] border-[#FF1E6C] text-white shadow-lg' : 'bg-slate-900 border-white/5 hover:border-slate-700'}`}
                                               >
                                                  <div className="text-xs font-bold">{t.name}</div>
                                                  <div className={`text-[10px] ${selectedTemplate === t.id ? 'text-white/70' : 'text-slate-500'}`}>Custom Layout</div>
                                               </button>
                                               <button 
                                                 onClick={(e) => deleteCustomTemplate(t.id, e)}
                                                 className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                               >
                                                  <Trash2 size={12} />
                                               </button>
                                            </div>
                                         ))}
                                      </div>
                                    </>
                                  )}
                                </>
                              ) : (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-slate-950/80 p-6 rounded-3xl border border-white/5 space-y-6">
                                   <div className="flex justify-between items-center">
                                      <h4 className="font-bold text-white text-sm">Forge Template Builder</h4>
                                      <button onClick={() => setIsTemplateEditorOpen(false)} className="text-slate-500 hover:text-white transition-colors"><ArrowLeft size={18} /></button>
                                   </div>

                                   {/* Tabs Area */}
                                   <div className="flex p-1 bg-slate-900 rounded-xl mb-4">
                                      {(['text', 'bg', 'layers'] as const).map((t) => (
                                         <button 
                                            key={t}
                                            onClick={() => setBuilderTab(t)}
                                            className={`flex-1 py-3 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${builderTab === t ? 'bg-[#FF1E6C] text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                         >
                                            {t}
                                         </button>
                                      ))}
                                   </div>

                                   <div className="space-y-6 pt-2">
                                      {builderTab === 'text' && (
                                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                            <div className="space-y-2">
                                               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Typography Template Name</label>
                                         <input 
                                           type="text" 
                                           value={newTemplateData.name} 
                                           onChange={(e) => setNewTemplateData({...newTemplateData, name: e.target.value})}
                                           className="w-full bg-slate-900 border border-white/5 p-4 rounded-xl text-xs text-white focus:outline-none focus:border-[#FF1E6C]"
                                         />
                                      </div>

                                      <div className="space-y-2">
                                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 text-[8px]">Structural Essence</label>
                                         <div className="grid grid-cols-3 gap-2">
                                            {['standard', 'split', 'framed'].map(l => (
                                               <button 
                                                 key={l}
                                                 onClick={() => setNewTemplateData({...newTemplateData, layout: l})}
                                                 className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${newTemplateData.layout === l ? 'bg-[#FF1E6C]/10 border-[#FF1E6C] text-[#FF1E6C]' : 'bg-slate-900 border-white/5 text-slate-500'}`}
                                               >
                                                  {l === 'standard' && <Maximize2 size={14} className="mx-auto mb-1" />}
                                                  {l === 'split' && <Layers size={14} className="mx-auto mb-1" />}
                                                  {l === 'framed' && <Crop size={14} className="mx-auto mb-1" />}
                                                  {l}
                                               </button>
                                            ))}
                                         </div>
                                      </div>

                                      <div className="space-y-2">
                                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 text-[8px]">Visual Presets</label>
                                         <div className="flex gap-2">
                                            {['Default', 'Bold', 'Outline', 'Badge'].map(s => (
                                               <button 
                                                 key={s}
                                                 onClick={() => setNewTemplateData({...newTemplateData, textStyle: {...newTemplateData.textStyle, style: s as any}})}
                                                 className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${newTemplateData.textStyle.style === s ? 'bg-[#FF1E6C] border-[#FF1E6C] text-white' : 'bg-slate-900 border-white/5 text-slate-500'}`}
                                               >
                                                  {s}
                                               </button>
                                            ))}
                                         </div>
                                      </div>

                                      <div className="space-y-2">
                                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 text-[8px]">Global Phase Transition</label>
                                         <div className="grid grid-cols-2 gap-2">
                                            {['fade', 'slide', 'zoom', 'glitch'].map(tr => (
                                               <button 
                                                 key={tr}
                                                 onClick={() => setNewTemplateData({...newTemplateData, transition: tr})}
                                                 className={`py-2.5 rounded-lg text-[10px] font-bold border transition-all ${newTemplateData.transition === tr ? 'bg-white text-slate-900 border-white' : 'bg-slate-900 border-white/5 text-slate-500'}`}
                                               >
                                                  {tr}
                                               </button>
                                            ))}
                                         </div>
                                      </div>
                                   </motion.div>
                                )}

                                {builderTab === 'bg' && (
                                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-4">
                                      <div className="space-y-2">
                                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 text-[8px]">Nebula Presets</label>
                                         <div className="grid grid-cols-4 gap-2">
                                            {['mesh', 'color', 'gradient', 'video'].map(t => (
                                               <button key={t} onClick={() => setNewTemplateData({...newTemplateData, background: {...newTemplateData.background, type: t as any}})} className={`py-3 rounded-lg text-[10px] font-bold border ${newTemplateData.background.type === t ? 'bg-[#FF1E6C] text-white' : 'bg-slate-900 text-slate-500'}`}>{t}</button>
                                            ))}
                                         </div>
                                      </div>
                                   </motion.div>
                                )}

                                {builderTab === 'layers' && (
                                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-4">
                                      <div className="space-y-3">
                                         {newTemplateData.layers.map((layer) => (
                                            <div key={layer.id} className="p-4 bg-slate-900 border border-white/5 rounded-xl flex justify-between items-center text-xs text-white">
                                               {layer.name}
                                            </div>
                                         ))}
                                      </div>
                                   </motion.div>
                                )}
                             </div>

                                   <button 
                                     onClick={saveCustomTemplate}
                                     className="w-full py-4 bg-[#FF1E6C] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
                                   >
                                      <Save size={16} /> Save & Export Template
                                   </button>
                                </motion.div>
                              )}
                           </motion.div>
                        )}
                        {editMode === 'trim' && (
                           <motion.div key="trim" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-6 pt-4">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 tracking-widest tracking-[0.2em]">
                                 <span>Advanced Timeline</span> 
                                 <span>{totalDuration}s Total</span>
                              </div>
                              
                              <div className="flex gap-1 h-16 bg-slate-900 rounded-xl overflow-hidden p-1 border border-white/5">
                                 {clips.map((clip, index) => (
                                    <div 
                                       key={clip.id} 
                                       className={`${clip.color} h-full rounded-lg relative group flex items-center justify-center text-[10px] font-bold overflow-hidden border border-black/20 transition-all`}
                                       style={{ flex: clip.duration }}
                                    >
                                       <span className="truncate px-2 opacity-80">{clip.name}</span>
                                       
                                       <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                                          <button onClick={() => moveClip(index, -1)} className="p-1.5 hover:bg-white/20 rounded text-white" disabled={index === 0}><ChevronLeft size={16}/></button>
                                          <button onClick={() => moveClip(index, 1)} className="p-1.5 hover:bg-white/20 rounded text-white" disabled={index === clips.length - 1}><ChevronRight size={16}/></button>
                                       </div>
                                    </div>
                                 ))}
                              </div>

                              <div className="space-y-3">
                                 {clips.map((clip, index) => (
                                    <div key={clip.id} className="flex items-center gap-3 bg-[#1e293b] p-3 rounded-xl border border-slate-700/50">
                                       <div className={`w-3 h-3 rounded-full ${clip.color}`} />
                                       <input 
                                          type="text" 
                                          value={clip.name} 
                                          onChange={(e) => {
                                             const newClips = [...clips];
                                             newClips[index].name = e.target.value;
                                             setClips(newClips);
                                          }}
                                          className="bg-transparent flex-1 text-xs font-bold text-white focus:outline-none"
                                       />
                                       <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                                          <Clock size={12} className="text-slate-500" />
                                          <input 
                                             type="number" 
                                             value={clip.duration}
                                             onChange={(e) => {
                                                const newClips = [...clips];
                                                newClips[index].duration = parseInt(e.target.value) || 0;
                                                setClips(newClips);
                                             }}
                                             className="w-10 bg-transparent text-xs text-white text-right focus:outline-none select-all"
                                          />
                                          <span className="text-[10px] text-slate-500">s</span>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </motion.div>
                        )}
                        {editMode === 'crop' && (
                           <motion.div key="crop" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-3 gap-3 pt-4">
                              {['9:16', '16:9', '1:1'].map(r => (
                                 <button key={r} onClick={() => setCropRatio(r)} className={`p-4 rounded-xl border font-bold text-xs ${cropRatio === r ? 'bg-[#FF1E6C] text-white shadow-lg' : 'bg-slate-900 border-white/5 text-slate-500 transition-all'}`}>{r}</button>
                              ))}
                           </motion.div>
                        )}
                        {editMode === 'text' && (
                           <motion.div key="text" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-6 pt-4">
                              <input 
                                 type="text" value={overlayText} onChange={(e) => setOverlayText(e.target.value)}
                                 className="w-full p-4 bg-slate-950 border border-white/5 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-[#FF1E6C]"
                                 placeholder="Add text overlay..."
                              />
                              <div className="flex gap-2">
                                 {['#FFFFFF', '#FF1E6C', '#00FF00', '#00BAFF'].map(c => (
                                    <button key={c} onClick={() => setOverlayConfig({...overlayConfig, color: c})} className={`w-8 h-8 rounded-full border-2 ${overlayConfig.color === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                                 ))}
                              </div>
                           </motion.div>
                        )}
                     </AnimatePresence>

                     {editMode && (
                        <div className="flex gap-4 pt-6 border-t border-white/5">
                           <button onClick={() => setEditMode(null)} className="flex-1 py-4 bg-slate-800 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest">Discard</button>
                           <button onClick={applyEdits} className="flex-1 py-4 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl">Update Forge</button>
                        </div>
                     )}
                  </div>
               </motion.div>
             )}
          </div>
        </div>

        {/* Sidebar Guide */}
        <aside className="lg:col-span-4 h-fit sticky top-24 space-y-6">
           <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
              <div className="flex items-center gap-3 text-[#FF1E6C]">
                 <BookOpen size={24} />
                 <h2 className="text-xl font-bold text-white">လမ်းညွှန်ချက်များ</h2>
              </div>
              <ul className="space-y-6">
                 {[
                    { id: '၁', title: 'ပလက်ဖောင်းရွေးချယ်ပါ', desc: 'TikTok (သို့) YouTube Shorts အတွက် အရင်ရွေးပါ။' },
                    { id: '၂', title: 'Script ရေးသားပါ', desc: 'ကိုယ်တိုင်ရေးပါ (သို့) AI ကို ဖန်တီးခိုင်းပါ။' },
                    { id: '၃', title: 'စိတ်ကြိုက်ပြင်ဆင်ပါ', desc: 'Voice, Music နှင့် စာတန်းထိုးများကို ပြင်ပါ။' }
                 ].map(i => (
                    <li key={i.id} className="flex gap-4">
                       <span className="w-6 h-6 rounded-lg bg-[#FF1E6C]/10 text-[#FF1E6C] flex items-center justify-center font-black text-[10px] mt-1 shrink-0">{i.id}</span>
                       <div className="space-y-1">
                          <h4 className="font-bold text-sm text-white">{i.title}</h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed">{i.desc}</p>
                       </div>
                    </li>
                 ))}
              </ul>
           </div>
        </aside>
      </main>

      {/* Global Navigation */}
      <div className="fixed bottom-24 left-0 right-0 p-4 sm:p-8 flex justify-center pointer-events-none z-50">
         <div className="w-full max-w-2xl flex gap-4 pointer-events-auto">
            {activeStep > 1 && (
               <button onClick={() => setActiveStep(prev => prev - 1)} className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-bold flex items-center gap-2 border border-slate-700 shadow-xl"><ChevronLeft size={20} /> <span className="hidden sm:inline">Back</span></button>
            )}
            <button 
               onClick={() => activeStep < 4 ? setActiveStep(prev => prev + 1) : handleGenerate()} 
               className={`flex-1 py-4 bg-[#FF1E6C] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-2xl transition-all shadow-[#FF1E6C]/30 ${isGenerating ? 'opacity-50' : 'hover:scale-[1.01]'}`}
            >
               {activeStep === 4 ? result ? 'Finished' : 'Forge Media' : 'Next Step'} <ChevronRight size={20} />
            </button>
         </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-2xl border-t border-white/5 py-4 px-8 flex justify-between items-center z-40 max-w-7xl mx-auto rounded-t-[3rem]">
         {[
            { id: 'series', label: 'Series', icon: <LayoutGrid size={22} /> },
            { id: 'drafts', label: 'Drafts', icon: <FileText size={22} /> },
            { id: 'create', label: 'Create', icon: <div className="p-3 bg-[#FF1E6C] rounded-2xl -mt-10 border-4 border-[#1a2131] shadow-2xl"><Sparkles size={24} className="text-white" /></div> },
            { id: 'pricing', label: 'Pricing', icon: <CreditCard size={22} /> },
            { id: 'assets', label: 'Cloud', icon: <Cloud size={22} /> },
         ].map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)} className={`flex flex-col items-center gap-1 transition-all ${activeNav === item.id ? 'text-[#FF1E6C]' : 'text-slate-500'}`}>
               {item.icon}
               <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
         ))}
      </nav>
    </div>
  );
};

export default AutoReelApp;
