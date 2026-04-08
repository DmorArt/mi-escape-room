import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Edit2, Eye, Plus, Trash2, Download, Upload, 
  Search, Key, BookOpen, ChevronRight, 
  Sparkles, AlignLeft, Image as ImageIcon,
  Puzzle, FileImage, Save, FolderOpen, X, ChevronDown,
  LayoutGrid, GripVertical, Maximize2, Trash
} from 'lucide-react';
import { isFirebaseConfigured, initAuth, onAuthChange } from './services/firebase';
import html2canvas from 'html2canvas';

const STORAGE_KEY = 'escape-maker-projects';
const appId = "escape-room-editor";

const App = () => {
  const colorThemes = {
    green: { bg: "bg-green-50", border: "border-green-500", text: "text-green-700", icon: "bg-green-500", shadow: "shadow-green-200", hex: "#22c55e", label: "Verde" },
    blue: { bg: "bg-blue-50", border: "border-blue-500", text: "text-blue-700", icon: "bg-blue-500", shadow: "shadow-blue-200", hex: "#3b82f6", label: "Azul" },
    orange: { bg: "bg-orange-50", border: "border-orange-500", text: "text-orange-700", icon: "bg-orange-500", shadow: "shadow-orange-200", hex: "#f97316", label: "Naranja" },
    purple: { bg: "bg-purple-50", border: "border-purple-500", text: "text-purple-700", icon: "bg-purple-500", shadow: "shadow-purple-200", hex: "#a855f7", label: "Violeta" },
    white: { bg: "bg-white", border: "border-slate-300", text: "text-slate-700", icon: "bg-slate-400", shadow: "shadow-slate-100", hex: "#94a3b8", label: "Blanco" }
  };

  const [bubbles, setBubbles] = useState([
    { id: 1, x: 22, y: 20, tx: 10, ty: 45, cx: 15, cy: 30, text: "LA BIBLIOTECA DEL SABER", theme: "green", step: "1", type: "title", image: null },
    { id: 2, x: 38, y: 15, tx: 28, ty: 25, cx: 33, cy: 20, text: "Encuentra la llave oculta en el lomo del libro de Historia.", theme: "green", step: "", type: "content", image: null },
    { id: 3, x: 50, y: 75, tx: 42, ty: 85, cx: 46, cy: 80, text: "", theme: "blue", type: "photo", image: null },
  ]);

  const [editMode, setEditMode] = useState(true);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [dragType, setDragType] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [user, setUser] = useState(null);
  const [showProjects, setShowProjects] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(700);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);
  const [savedProjects, setSavedProjects] = useState([]);
  const containerRef = useRef(null);
  const bubbleRefs = useRef({});

  // --- FIREBASE ---
  useEffect(() => {
    const initAuthAsync = async () => { await initAuth(null); };
    initAuthAsync();
    const unsubscribe = onAuthChange(setUser);
    return () => unsubscribe();
  }, []);

  // --- LOAD SAVED PROJECTS LIST ---
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setSavedProjects(JSON.parse(stored)); } catch (e) { /* ignore */ }
    }
  }, []);

  // --- DIMENSIONS ---
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    updateSize();
    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight]);

  // --- FILE HANDLERS ---
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

  // --- BUBBLE OPS ---
  const addBubble = (type = 'title') => {
    const newBubble = {
      id: Date.now(),
      x: 50, y: 50, tx: 55, ty: 65, cx: 52, cy: 58,
      text: type === 'title' ? "NUEVO TÍTULO" : "Descripción detallada...",
      theme: "white", step: type === 'title' ? "!" : "", type,
      image: null
    };
    setBubbles(prev => [...prev, newBubble]);
    setSelectedId(newBubble.id);
  };

  const deleteBubble = (id) => {
    setBubbles(prev => prev.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateBubble = (id, updates) => {
    setBubbles(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const handleMouseDown = (id, type) => {
    if (!editMode) return;
    setSelectedId(id);
    setDragType(type);
  };

  const handleMouseMove = (e) => {
    if (!dragType || !selectedId || !editMode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const cx = Math.max(0, Math.min(100, x));
    const cy = Math.max(0, Math.min(100, y));
    if (dragType === 'bubble') updateBubble(selectedId, { x: cx, y: cy });
    else if (dragType === 'target') updateBubble(selectedId, { tx: cx, ty: cy });
    else if (dragType === 'control') updateBubble(selectedId, { cx: cx, cy: cy });
  };

  const handleMouseUp = () => setDragType(null);

  // --- SAVE / LOAD ---
  const getCurrentProjectData = useCallback(() => ({
    id: 'current',
    name: 'Proyecto actual',
    bubbles,
    backgroundImage,
    canvasWidth,
    canvasHeight,
    version: "1.0",
    updatedAt: new Date().toISOString(),
  }), [bubbles, backgroundImage, canvasWidth, canvasHeight]);

  const saveProject = async () => {
    setIsSaving(true);
    const projectData = getCurrentProjectData();
    projectData.name = `Proyecto ${new Date().toLocaleDateString('es')}`;
    projectData.id = Date.now().toString();

    // Save to localStorage list
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    existing.unshift(projectData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 20)));
    setSavedProjects(existing.slice(0, 20));

    // Also download JSON backup
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `escape_room_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setSaveMessage('✅ Proyecto guardado');
    setTimeout(() => setSaveMessage(null), 3000);
    setIsSaving(false);
  };

  const loadProject = (project) => {
    if (project.bubbles) setBubbles(project.bubbles);
    if (project.backgroundImage !== undefined) setBackgroundImage(project.backgroundImage);
    if (project.canvasWidth) setCanvasWidth(project.canvasWidth);
    if (project.canvasHeight) setCanvasHeight(project.canvasHeight);
    setShowProjects(false);
    setSelectedId(null);
  };

  const loadProjectFromFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const project = JSON.parse(event.target.result);
        loadProject(project);
      } catch (err) {
        alert('Error al cargar el archivo');
      }
    };
    reader.readAsText(file);
  };

  const deleteSavedProject = (id) => {
    const updated = savedProjects.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSavedProjects(updated);
  };

  // --- EXPORT ---
  const handleExportAsImage = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    const wasEditMode = editMode;
    setEditMode(false);
    setSelectedId(null);
    setShowCanvasSettings(false);
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(containerRef.current, { useCORS: true, scale: 2, backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.download = 'mapa-final.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error("Error exportando:", err);
      } finally {
        setEditMode(wasEditMode);
        setIsExporting(false);
      }
    }, 300);
  };

  // --- FIX #1: Arrows start from bubble edge using DOM measurements ---
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

      // Calculate radius based on actual bubble size
      let radiusX = 60, radiusY = 25;
      if (b.type === 'photo') { radiusX = 48; radiusY = 48; }
      else if (b.type === 'title') { radiusX = 70; radiusY = 25; }

      const angle = Math.atan2(ctrlY - startY, ctrlX - startX);
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
  }, [bubbles, dimensions]);

  // --- FIX #9: Color selector — ahora en la barra lateral derecha ---
  const selectedBubble = selectedId ? bubbles.find(b => b.id === selectedId) : null;

  return (
    <div className="h-screen w-screen flex flex-col font-sans text-slate-800 select-none overflow-hidden" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* ====== HEADER — FIX #3: todo junto, FIX #5 y #6: más grande ====== */}
      <header className="bg-white border-b-4 border-indigo-100 px-6 py-3 z-50 shadow-lg print:hidden shrink-0">
        <div className="flex items-center justify-between gap-6">
          {/* Logo — FIX #5: más grande */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="relative">
              <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-xl rotate-[-6deg] z-10 relative">
                <Puzzle size={36} />
              </div>
              <div className="absolute -top-1 -right-2 bg-yellow-400 p-2 rounded-lg text-yellow-900 shadow-md rotate-[12deg] z-20 border-2 border-white">
                <Key size={20} />
              </div>
            </div>
            {/* Título — FIX #6: más grande */}
            <div>
              <h1 className="text-3xl font-black text-indigo-950 tracking-tight uppercase italic leading-none">Escape Maker</h1>
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-[0.3em] mt-0.5 italic">Project Manager</p>
            </div>
          </div>

          {/* Edit/Vista — FIX #2: botones más grandes */}
          <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-2xl border-2 border-slate-200">
            <button onClick={() => setEditMode(true)} className={`flex items-center gap-2 px-8 py-3 rounded-xl transition-all cursor-pointer ${editMode ? 'bg-indigo-600 shadow-lg text-white scale-105' : 'text-slate-500 hover:bg-slate-200'}`}>
              <Edit2 size={20} /> <span className="text-base font-black uppercase">Editar</span>
            </button>
            <button onClick={() => { setEditMode(false); setSelectedId(null); }} className={`flex items-center gap-2 px-8 py-3 rounded-xl transition-all cursor-pointer ${!editMode ? 'bg-emerald-600 shadow-lg text-white scale-105' : 'text-slate-500 hover:bg-slate-200'}`}>
              <Eye size={20} /> <span className="text-base font-black uppercase">Vista</span>
            </button>
          </div>

          {/* Actions — FIX #2 y #7: botones más grandes, guardar funcional */}
          <div className="flex items-center gap-3 shrink-0">
            {/* FIX #8: Botón Mis Proyectos */}
            <button onClick={() => setShowProjects(!showProjects)} className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-700 border-2 border-slate-200 rounded-xl hover:bg-slate-200 shadow-sm transition-all text-sm font-black uppercase cursor-pointer">
              <LayoutGrid size={18} /> Proyectos
            </button>

            <button onClick={saveProject} disabled={isSaving} className="flex items-center gap-2 px-5 py-3 bg-indigo-700 text-white rounded-xl hover:bg-indigo-600 shadow-md transition-all text-sm font-black uppercase cursor-pointer disabled:opacity-50">
              <Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar'}
            </button>

            <label className="flex items-center gap-2 px-5 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 cursor-pointer shadow-md transition-all text-sm font-black uppercase">
              <FolderOpen size={18} /> Abrir
              <input type="file" className="hidden" onChange={loadProjectFromFile} accept=".json" />
            </label>

            {/* FIX #10: Botón tamaño canvas */}
            <button onClick={() => setShowCanvasSettings(!showCanvasSettings)} className="flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 border-2 border-slate-200 rounded-xl hover:bg-slate-200 shadow-sm transition-all cursor-pointer" title="Ajustar tamaño del espacio de trabajo">
              <Maximize2 size={18} />
              <span className="text-sm font-black">{canvasWidth}×{canvasHeight}</span>
            </button>
          </div>
        </div>

        {/* FIX #3: Toolbar integrada al header */}
        {editMode && (
          <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t-2 border-indigo-50">
            <label className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 border-2 border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-100 cursor-pointer transition-all text-sm font-bold uppercase shadow-sm">
              <Upload size={16} /> Subir Mapa Fondo
              <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
            </label>
            <button onClick={() => addBubble('title')} className="flex items-center gap-2 px-5 py-2.5 bg-yellow-400 text-yellow-950 rounded-xl hover:bg-yellow-300 shadow-sm text-sm font-black uppercase cursor-pointer">
              <Plus size={16} /> + Título
            </button>
            <button onClick={() => addBubble('content')} className="flex items-center gap-2 px-5 py-2.5 bg-slate-200 text-slate-900 rounded-xl hover:bg-slate-300 shadow-sm text-sm font-black uppercase cursor-pointer">
              <AlignLeft size={16} /> + Texto
            </button>
            <button onClick={() => addBubble('photo')} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-100 text-indigo-900 rounded-xl hover:bg-indigo-200 shadow-sm text-sm font-black uppercase cursor-pointer">
              <ImageIcon size={16} /> + Foto
            </button>

            {saveMessage && (
              <span className="text-sm font-bold text-emerald-600 ml-4 animate-pulse">{saveMessage}</span>
            )}
          </div>
        )}
      </header>

      {/* ====== MAIN AREA ====== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <main className="flex-1 p-6 flex justify-center items-start overflow-auto bg-[#f0f1f5] print:p-0 relative">
          {/* FIX #10: Canvas con tamaño ajustable */}
          <div className="relative inline-block print:m-0">
            <div
              ref={containerRef}
              className={`relative rounded-2xl overflow-hidden shadow-2xl border-4 ${editMode ? 'border-indigo-200' : 'border-white'} transition-all print:border-0 print:rounded-none print:shadow-none`}
              style={{
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
                minWidth: '400px',
                minHeight: '300px',
                backgroundColor: '#fff',
              }}
            >
              {backgroundImage ? (
                <img src={backgroundImage} alt="Fondo" className="w-full h-full object-cover pointer-events-none" draggable="false" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 bg-slate-50 gap-4">
                  <Upload size={64} className="opacity-20" />
                  <p className="font-black uppercase tracking-widest text-slate-300 text-sm">Carga la imagen del Escape Room</p>
                  <p className="text-xs text-slate-200">Tamaño actual: {canvasWidth} × {canvasHeight}px</p>
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
                          className={`absolute w-5 h-5 border-2 border-white shadow-lg cursor-grab z-30 flex items-center justify-center rotate-45 ${theme.icon} hover:scale-125 transition-transform`}
                          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(bubble.id, 'control'); }}>
                          <div className="w-1 h-1 bg-white rounded-full"></div>
                        </div>
                        <div style={{ left: `${bubble.tx}%`, top: `${bubble.ty}%`, transform: 'translate(-50%, -50%)' }}
                          className={`absolute w-7 h-7 rounded-full border-3 border-white shadow-xl cursor-crosshair z-30 flex items-center justify-center ${theme.icon} hover:scale-110 transition-transform`}
                          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(bubble.id, 'target'); }}>
                          <Search size={11} className="text-white" />
                        </div>
                      </>
                    )}

                    <div style={{ left: `${bubble.x}%`, top: `${bubble.y}%`, transform: 'translate(-50%, -50%)', zIndex: isSelected ? 50 : 20 }}
                      className={`absolute group ${editMode ? 'cursor-move' : ''}`}
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(bubble.id, 'bubble'); }}>

                      <div className={`relative flex items-center justify-center transition-all ${
                        isPhoto
                          ? 'w-28 h-28 rounded-full border-[4px]'
                          : isTitle
                            ? 'px-7 py-4 border-[4px] rounded-xl'
                            : 'px-5 py-3 border-[3px] rounded-lg'
                      } ${theme.bg} ${theme.border} ${theme.shadow} ${isSelected ? 'ring-4 ring-offset-2 ring-indigo-400' : ''}`}>

                        {isPhoto ? (
                          <div className="w-full h-full rounded-full overflow-hidden relative group/photo">
                            {bubble.image ? (
                              <img src={bubble.image} className="w-full h-full object-cover" alt="Contenido" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300 bg-white/50">
                                <ImageIcon size={28} />
                              </div>
                            )}
                            {editMode && (
                              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                <Upload size={22} className="text-white" />
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleBubbleImageUpload(e, bubble.id)} />
                              </label>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {isTitle && bubble.step && (
                              <div className={`absolute -top-4 -left-4 w-11 h-11 rounded-lg border-[3px] border-white text-white flex items-center justify-center text-lg font-black shadow-xl ${theme.icon} z-10 rotate-[-5deg]`}>
                                {bubble.step}
                              </div>
                            )}
                            {editMode ? (
                              <textarea value={bubble.text} onChange={(e) => updateBubble(bubble.id, { text: e.target.value })}
                                className={`bg-transparent border-none outline-none w-full text-center resize-none placeholder:text-slate-300 leading-tight ${isTitle ? 'text-base font-black uppercase ' + theme.text : 'text-sm font-bold text-black'}`}
                                rows={isTitle ? 2 : 3} onClick={(e) => e.stopPropagation()} style={{ minWidth: isTitle ? '200px' : '160px' }} />
                            ) : (
                              <p className={`text-center leading-tight whitespace-pre-wrap ${isTitle ? 'text-base font-black uppercase ' + theme.text : 'text-sm font-bold text-black'}`} style={{ minWidth: isTitle ? '200px' : '160px' }}>
                                {bubble.text}
                              </p>
                            )}
                          </div>
                        )}

                        {/* FIX #9: El selector de colores ahora es solo un punto indicador, el panel completo va al sidebar derecho */}
                        {editMode && isSelected && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full border-2 border-white shadow-md cursor-pointer z-20"
                            style={{ backgroundColor: theme.hex }}
                            title="Color seleccionado"
                          />
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* FIX #10: Canvas size settings */}
          {editMode && showCanvasSettings && (
            <div className="absolute top-4 right-4 bg-white rounded-2xl shadow-2xl border-2 border-indigo-100 p-5 z-40 w-64">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase text-indigo-900">Tamaño del espacio</h3>
                <button onClick={() => setShowCanvasSettings(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Ancho (px)</label>
                  <input type="range" min="400" max="2400" step="50" value={canvasWidth}
                    onChange={(e) => setCanvasWidth(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer" />
                  <div className="text-right text-xs font-bold text-indigo-600">{canvasWidth}px</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Alto (px)</label>
                  <input type="range" min="300" max="1600" step="50" value={canvasHeight}
                    onChange={(e) => setCanvasHeight(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer" />
                  <div className="text-right text-xs font-bold text-indigo-600">{canvasHeight}px</div>
                </div>
                <div className="flex gap-2 pt-2">
                  {[{ w: 980, h: 600, l: 'HD' }, { w: 1200, h: 700, l: 'Estándar' }, { w: 1920, h: 1080, l: 'Full HD' }].map(preset => (
                    <button key={preset.l} onClick={() => { setCanvasWidth(preset.w); setCanvasHeight(preset.h); }}
                      className="flex-1 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-100 cursor-pointer border border-indigo-200">
                      {preset.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ====== FIX #9: SIDEBAR DERECHO — Color selector + propiedades ====== */}
        {editMode && selectedBubble && (
          <div className="w-56 bg-white border-l-2 border-indigo-100 flex flex-col shrink-0 shadow-lg z-30 overflow-y-auto">
            <div className="p-4 border-b border-indigo-50">
              <h3 className="text-xs font-black uppercase text-indigo-900 mb-3">🎨 Colores de borde</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(colorThemes).map(([key, t]) => (
                  <button key={key} onClick={() => updateBubble(selectedBubble.id, { theme: key })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all cursor-pointer text-xs font-bold ${
                      selectedBubble.theme === key ? `${t.border} ${t.bg} ring-2 ring-offset-1 ring-indigo-300 scale-105` : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                    }`}>
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: t.hex }} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-b border-indigo-50">
              <h3 className="text-xs font-black uppercase text-indigo-900 mb-2">Acciones</h3>
              <div className="flex gap-2">
                <button onClick={() => deleteBubble(selectedBubble.id)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer text-xs font-black uppercase border border-rose-200">
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            </div>

            <div className="p-4 flex-1">
              <h3 className="text-xs font-black uppercase text-indigo-900 mb-2">Info</h3>
              <div className="text-[11px] text-slate-500 space-y-1">
                <p>Tipo: <span className="font-bold text-slate-700">{selectedBubble.type === 'title' ? 'Título' : selectedBubble.type === 'photo' ? 'Foto' : 'Texto'}</span></p>
                <p>Posición: <span className="font-bold text-slate-700">{Math.round(selectedBubble.x)}%, {Math.round(selectedBubble.y)}%</span></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ====== FIX #8: PANEL DE PROYECTOS GUARDADOS ====== */}
      {showProjects && (
        <div className="absolute inset-0 z-40 flex" onClick={() => setShowProjects(false)}>
          <div className="flex-1 bg-black/20" />
          <div className="w-96 bg-white shadow-2xl border-l-4 border-indigo-500 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-indigo-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-black text-indigo-950 uppercase flex items-center gap-2">
                <LayoutGrid size={20} /> Mis Proyectos
              </h2>
              <button onClick={() => setShowProjects(false)} className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer"><X size={20} /></button>
            </div>
            <div className="p-4">
              {savedProjects.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FolderOpen size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-bold">No hay proyectos guardados</p>
                  <p className="text-xs mt-1">Usá el botón "Guardar" para guardar tu trabajo</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedProjects.map(proj => (
                    <div key={proj.id} className="bg-slate-50 rounded-xl border-2 border-slate-100 p-3 hover:border-indigo-200 transition-colors group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{proj.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {proj.bubbles?.length || 0} elementos · {new Date(proj.updatedAt).toLocaleString('es')}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {proj.canvasWidth || 1200}×{proj.canvasHeight || 700}px
                          </p>
                        </div>
                        <button onClick={() => loadProject(proj)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm">
                          Cargar
                        </button>
                      </div>
                      <div className="flex justify-end mt-2">
                        <button onClick={() => { if (confirm('¿Eliminar este proyecto?')) deleteSavedProject(proj.id); }}
                          className="text-[10px] text-rose-400 hover:text-rose-600 font-bold uppercase cursor-pointer flex items-center gap-1">
                          <Trash2 size={10} /> Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== FOOTER ====== */}
      <footer className="bg-slate-900 text-white p-4 px-8 flex justify-between items-center border-t-4 border-indigo-500 print:hidden shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_15px_#10b981]"></div>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Project Safe Active</span>
          {!isFirebaseConfigured && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 italic ml-2">
              · Modo Local
            </span>
          )}
        </div>

        <button
          onClick={handleExportAsImage}
          disabled={isExporting}
          className={`group flex items-center gap-4 bg-indigo-600 hover:bg-indigo-500 px-10 py-3.5 rounded-2xl transition-all shadow-2xl font-black uppercase tracking-widest text-sm border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 cursor-pointer ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isExporting ? <Sparkles className="animate-spin" size={20} /> : <FileImage size={20} />}
          {isExporting ? 'Procesando...' : 'Exportar Mapa Final'}
        </button>
      </footer>
    </div>
  );
};

export default App;
