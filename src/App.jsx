import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Edit2, Eye, Plus, Trash2, Move, Download, Upload, 
  Search, Key, BookOpen, FlaskConical, ScrollText, 
  Monitor, Lock, CheckCircle, ChevronRight, MousePointer2,
  Spline, Sparkles, Type, AlignLeft, Image as ImageIcon,
  Puzzle, FileImage, Save, FolderOpen, AlertCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'escape-room-editor';

const App = () => {
  const colorThemes = {
    green: { bg: "bg-green-50", border: "border-green-500", text: "text-green-700", icon: "bg-green-500", shadow: "shadow-green-200", hex: "#22c55e" },
    blue: { bg: "bg-blue-50", border: "border-blue-500", text: "text-blue-700", icon: "bg-blue-500", shadow: "shadow-blue-200", hex: "#3b82f6" },
    orange: { bg: "bg-orange-50", border: "border-orange-500", text: "text-orange-700", icon: "bg-orange-500", shadow: "shadow-orange-200", hex: "#f97316" },
    purple: { bg: "bg-purple-50", border: "border-purple-500", text: "text-purple-700", icon: "bg-purple-500", shadow: "shadow-purple-200", hex: "#a855f7" },
    white: { bg: "bg-white", border: "border-slate-300", text: "text-slate-700", icon: "bg-slate-400", shadow: "shadow-slate-100", hex: "#94a3b8" }
  };

  const [bubbles, setBubbles] = useState([
    { id: 1, x: 22, y: 20, tx: 10, ty: 45, cx: 15, cy: 30, text: "LA BIBLIOTECA DEL SABER", theme: "green", step: "1", icon: "BookOpen", type: "title" },
    { id: 2, x: 38, y: 15, tx: 28, ty: 25, cx: 33, cy: 20, text: "Encuentra la llave oculta en el lomo del libro de Historia.", theme: "green", step: "", icon: "Search", type: "content" },
    { id: 3, x: 50, y: 75, tx: 42, ty: 85, cx: 46, cy: 80, image: null, theme: "blue", type: "photo" },
  ]);
  
  const [editMode, setEditMode] = useState(true);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [dragType, setDragType] = useState(null); 
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [user, setUser] = useState(null);
  const containerRef = useRef(null);

  // --- LÓGICA DE FIREBASE ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Inyectar html2canvas para la descarga de imagen
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      const s = document.querySelector(`script[src="${script.src}"]`);
      if (s) document.body.removeChild(s);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    updateSize();
    return () => observer.disconnect();
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (f) => setBackgroundImage(f.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleBubbleImageUpload = (e, id) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (f) => updateBubble(id, { image: f.target.result });
      reader.readAsDataURL(file);
    }
  };

  const addBubble = (type = 'title') => {
    const newBubble = {
      id: Date.now(),
      x: 50, y: 50, tx: 55, ty: 65, cx: 52, cy: 58,
      text: type === 'title' ? "NUEVO TÍTULO" : "Descripción detallada...", 
      theme: "white", step: type === 'title' ? "!" : "", icon: "ChevronRight",
      type: type,
      image: null
    };
    setBubbles([...bubbles, newBubble]);
    setSelectedId(newBubble.id);
  };

  const deleteBubble = (id) => {
    setBubbles(bubbles.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateBubble = (id, updates) => {
    setBubbles(bubbles.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const handleMouseDown = (id, type) => {
    if (!editMode) return;
    setSelectedId(id);
    setDragType(type);
  };

  const handleMouseMove = (e) => {
    if (!dragType || !selectedId || !editMode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pxX = e.clientX - rect.left;
    const pxY = e.clientY - rect.top;
    const x = (pxX / rect.width) * 100;
    const y = (pxY / rect.height) * 100;
    const cx = Math.max(0, Math.min(100, x));
    const cy = Math.max(0, Math.min(100, y));

    if (dragType === 'bubble') updateBubble(selectedId, { x: cx, y: cy });
    else if (dragType === 'target') updateBubble(selectedId, { tx: cx, ty: cy });
    else if (dragType === 'control') updateBubble(selectedId, { cx: cx, cy: cy });
  };

  const handleMouseUp = () => setDragType(null);

  // --- GUARDADO Y CARGA (JSON) ---
  const saveProject = () => {
    const projectData = {
      bubbles,
      backgroundImage, // Nota: base64 puede ser pesado
      version: "1.0"
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "escape_room_proyecto.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const loadProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const project = JSON.parse(event.target.result);
        if (project.bubbles) setBubbles(project.bubbles);
        if (project.backgroundImage) setBackgroundImage(project.backgroundImage);
      } catch (err) {
        console.error("Error cargando archivo:", err);
      }
    };
    reader.readAsText(file);
  };

  const handleExportAsImage = async () => {
    if (!containerRef.current || !window.html2canvas) return;
    setIsExporting(true);
    const wasEditMode = editMode;
    setEditMode(false);
    setSelectedId(null);
    setTimeout(async () => {
      try {
        const canvas = await window.html2canvas(containerRef.current, { useCORS: true, scale: 2, backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.download = 'mapa-final.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      } finally {
        setEditMode(wasEditMode);
        setIsExporting(false);
      }
    }, 300);
  };

  const renderArrows = useMemo(() => {
    if (dimensions.width === 0) return null;
    return bubbles.map(b => {
      const theme = colorThemes[b.theme];
      const startX = (b.x / 100) * dimensions.width;
      const startY = (b.y / 100) * dimensions.height;
      const targetX = (b.tx / 100) * dimensions.width;
      const targetY = (b.ty / 100) * dimensions.height;
      const ctrlX = (b.cx / 100) * dimensions.width;
      const ctrlY = (b.cy / 100) * dimensions.height;
      const angle = Math.atan2(ctrlY - startY, ctrlX - startX);
      let radiusX = 100, radiusY = 40;
      if (b.type === 'photo') { radiusX = 50; radiusY = 50; }
      else if (b.type === 'content') { radiusX = 100; radiusY = 35; }
      const edgeX = startX + Math.cos(angle) * radiusX;
      const edgeY = startY + Math.sin(angle) * radiusY;
      const path = `M ${edgeX} ${edgeY} Q ${ctrlX} ${ctrlY} ${targetX} ${targetY}`;
      const endAngle = Math.atan2(targetY - ctrlY, targetX - ctrlX);
      const arrowSize = 12;
      const p1X = targetX - arrowSize * Math.cos(endAngle - Math.PI / 6);
      const p1Y = targetY - arrowSize * Math.sin(endAngle - Math.PI / 6);
      const p2X = targetX - arrowSize * Math.cos(endAngle + Math.PI / 6);
      const p2Y = targetY - arrowSize * Math.sin(endAngle + Math.PI / 6);
      return (
        <g key={`arrow-group-${b.id}`}>
          <path d={path} stroke={theme.hex} strokeWidth={b.type === 'title' ? "4" : "2"} fill="none" strokeLinecap="round" />
          <path d={`M ${p1X} ${p1Y} L ${targetX} ${targetY} L ${p2X} ${p2Y} Z`} fill={theme.hex} />
        </g>
      );
    });
  }, [bubbles, dimensions, colorThemes]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800 select-none" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* HEADER */}
      <header className="bg-white border-b-4 border-indigo-100 p-4 sticky top-0 z-50 shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-xl rotate-[-6deg] z-10 relative">
                <Puzzle size={28} />
              </div>
              <div className="absolute -top-1 -right-2 bg-yellow-400 p-1.5 rounded-lg text-yellow-900 shadow-md rotate-[12deg] z-20 border-2 border-white">
                <Key size={16} />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-indigo-950 tracking-tight uppercase italic leading-none">Escape Maker</h1>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em] mt-1 italic">Project Manager</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border-2 border-slate-200">
            <button onClick={() => setEditMode(true)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all ${editMode ? 'bg-indigo-600 shadow-lg text-white scale-105' : 'text-slate-500 hover:bg-slate-200'}`}>
              <Edit2 size={18} /> <span className="text-sm font-black uppercase">Editar</span>
            </button>
            <button onClick={() => {setEditMode(false); setSelectedId(null);}} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all ${!editMode ? 'bg-emerald-600 shadow-lg text-white scale-105' : 'text-slate-500 hover:bg-slate-200'}`}>
              <Eye size={18} /> <span className="text-sm font-black uppercase">Vista</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={saveProject} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-700 text-white rounded-xl hover:bg-indigo-600 shadow-md transition-all text-xs font-black uppercase">
              <Save size={16} /> Guardar
            </button>
            <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 cursor-pointer shadow-md transition-all text-xs font-black uppercase">
              <FolderOpen size={16} /> Abrir
              <input type="file" className="hidden" onChange={loadProject} accept=".json" />
            </label>
          </div>
        </div>
      </header>

      {/* CONTROLES DE EDICIÓN */}
      {editMode && (
        <div className="bg-indigo-50 border-b-2 border-indigo-100 p-3 flex justify-center gap-4 sticky top-[84px] z-40">
           <label className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 cursor-pointer transition-all text-xs font-bold uppercase">
              <Upload size={14} /> Subir Mapa Fondo
              <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
            </label>
            <button onClick={() => addBubble('title')} className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-yellow-950 rounded-lg hover:bg-yellow-300 shadow-sm text-xs font-black uppercase">
              <Plus size={14} /> + Título
            </button>
            <button onClick={() => addBubble('content')} className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 shadow-sm text-xs font-black uppercase">
              <AlignLeft size={14} /> + Texto
            </button>
            <button onClick={() => addBubble('photo')} className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-900 rounded-lg hover:bg-indigo-200 shadow-sm text-xs font-black uppercase">
              <ImageIcon size={14} /> + Foto
            </button>
        </div>
      )}

      {/* ÁREA DEL MAPA */}
      <main className="flex-1 p-8 flex justify-center items-start overflow-auto bg-[#f8fafc] print:p-0">
        <div className="relative inline-block print:m-0">
          <div ref={containerRef} className={`relative rounded-[2rem] overflow-hidden shadow-2xl border-[10px] ${editMode ? 'border-indigo-100' : 'border-white'} transition-all print:border-0 print:rounded-none print:shadow-none`} style={{ minWidth: '980px', minHeight: '600px', backgroundColor: '#fff' }}>
            {backgroundImage ? (
              <img src={backgroundImage} alt="Fondo" className="block max-w-full h-auto pointer-events-none" draggable="false" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 bg-slate-50 gap-4">
                <Upload size={64} className="opacity-20" />
                <p className="font-black uppercase tracking-widest text-slate-300">Carga la imagen del Escape Room</p>
              </div>
            )}

            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">{renderArrows}</svg>

            {bubbles.map((bubble) => {
              const theme = colorThemes[bubble.theme];
              const isSelected = selectedId === bubble.id;
              const isTitle = bubble.type === 'title';
              const isPhoto = bubble.type === 'photo';

              return (
                <React.Fragment key={bubble.id}>
                  {editMode && (
                    <>
                      <div style={{ left: `${bubble.cx}%`, top: `${bubble.cy}%`, transform: 'translate(-50%, -50%)' }}
                        className={`absolute w-6 h-6 border-2 border-white shadow-xl cursor-grab z-30 flex items-center justify-center rotate-45 ${theme.icon} hover:scale-125 transition-transform`}
                        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(bubble.id, 'control'); }}>
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                      </div>
                      <div style={{ left: `${bubble.tx}%`, top: `${bubble.ty}%`, transform: 'translate(-50%, -50%)' }}
                        className={`absolute w-8 h-8 rounded-full border-4 border-white shadow-2xl cursor-crosshair z-30 flex items-center justify-center ${theme.icon} hover:scale-110 transition-transform`}
                        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(bubble.id, 'target'); }}>
                        <Search size={12} className="text-white" />
                      </div>
                    </>
                  )}

                  <div style={{ left: `${bubble.x}%`, top: `${bubble.y}%`, transform: 'translate(-50%, -50%)', zIndex: isSelected ? 50 : 20 }}
                    className={`absolute group ${editMode ? 'cursor-move' : ''}`}
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(bubble.id, 'bubble'); }}>
                    
                    <div className={`relative flex items-center justify-center transition-all ${
                      isPhoto 
                        ? 'w-24 h-24 rounded-full border-[4px]' 
                        : isTitle 
                          ? 'px-6 py-4 border-[4px] rounded-lg' 
                          : 'px-4 py-3 border-[2px] rounded-md'
                      } ${theme.bg} ${theme.border} ${theme.shadow} ${isSelected ? 'ring-4 ring-offset-2 ring-indigo-400 scale-105' : 'scale-100'}`}>
                      
                      {isPhoto ? (
                        <div className="w-full h-full rounded-full overflow-hidden relative group/photo">
                          {bubble.image ? (
                            <img src={bubble.image} className="w-full h-full object-cover" alt="Contenido" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 bg-white/50">
                              <ImageIcon size={24} />
                            </div>
                          )}
                          {editMode && (
                            <label className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center cursor-pointer">
                              <Upload size={20} className="text-white" />
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleBubbleImageUpload(e, bubble.id)} />
                            </label>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {isTitle && bubble.step && (
                            <div className={`absolute -top-4 -left-4 w-10 h-10 rounded-lg border-[3px] border-white text-white flex items-center justify-center text-base font-black shadow-xl ${theme.icon} z-10 rotate-[-5deg]`}>
                              {bubble.step}
                            </div>
                          )}
                          {editMode ? (
                            <textarea value={bubble.text} onChange={(e) => updateBubble(bubble.id, { text: e.target.value })}
                              className={`bg-transparent border-none outline-none w-full text-center resize-none placeholder:text-slate-300 leading-tight ${isTitle ? 'text-sm font-black uppercase ' + theme.text : 'text-[11px] font-bold text-black'}`}
                              rows={isTitle ? 2 : 3} onClick={(e) => e.stopPropagation()} />
                          ) : (
                            <p className={`text-center leading-tight whitespace-pre-wrap ${isTitle ? 'text-sm font-black uppercase ' + theme.text : 'text-[11px] font-bold text-black'}`}>
                              {bubble.text}
                            </p>
                          )}
                        </div>
                      )}

                      {editMode && isSelected && (
                        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white p-2 rounded-2xl shadow-2xl border-2 border-indigo-50 animate-in zoom-in duration-200">
                          {Object.keys(colorThemes).map(t => (
                            <button key={t} onClick={(e) => { e.stopPropagation(); updateBubble(bubble.id, { theme: t }); }}
                              className={`w-7 h-7 rounded-lg border-2 ${colorThemes[t].bg} ${colorThemes[t].border} hover:scale-125 transition-transform shadow-sm`} />
                          ))}
                          <div className="w-px h-6 bg-slate-200 mx-1" />
                          <button onClick={(e) => { e.stopPropagation(); deleteBubble(bubble.id); }} 
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors shadow-sm"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white p-6 px-10 flex justify-between items-center border-t-4 border-indigo-500 print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_15px_#10b981]"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Project Safe Active</span>
        </div>
        
        <button 
          onClick={handleExportAsImage} 
          disabled={isExporting}
          className={`group flex items-center gap-4 bg-indigo-600 hover:bg-indigo-500 px-12 py-4 rounded-2xl transition-all shadow-2xl font-black uppercase tracking-widest text-sm border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isExporting ? <Sparkles className="animate-spin" size={20} /> : <FileImage size={20} />}
          {isExporting ? 'Procesando...' : 'Exportar Mapa Final'}
        </button>
      </footer>
    </div>
  );
};

export default App;
