import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  FolderTree, 
  MessageSquare, 
  Monitor, 
  Mic, 
  MicOff, 
  Send, 
  Terminal as TerminalIcon, 
  Play, 
  Settings,
  Cpu,
  Layers,
  ChevronRight,
  History,
  PlusCircle,
  Clock,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE = '/api';

const App = () => {
  const [code, setCode] = useState('// Antigravity Agent Ready\n\nfunction startProject() {\n  console.log("Building your vision...");\n}');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I am ready to help you develop your next app. What are we building today?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [agentTasks, setAgentTasks] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchFiles();
    fetchConversations();
  }, []);

  useEffect(() => {
    if (currentFile) {
      fetchFileContent(currentFile);
    }
  }, [currentFile]);

  const fetchFiles = async () => {
    try {
      const res = await axios.get(`${API_BASE}/files`);
      setFiles(res.data);
      if (!currentFile && res.data.length > 0) {
        setCurrentFile(res.data[0]);
      }
    } catch (err) {
      console.error('Error fetching files:', err);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API_BASE}/conversations`);
      setConversations(res.data);
      if (res.data.length > 0 && !activeConvId) {
        loadConversation(res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  const loadConversation = async (id) => {
    setIsLoadingHistory(true);
    try {
      const res = await axios.get(`${API_BASE}/conversations/${id}`);
      setActiveConvId(id);
      setMessages(res.data.messages.map(m => ({
        role: m.role,
        text: m.content,
        persona: m.persona,
        timestamp: m.created_at
      })));
      setAgentTasks(res.data.tasks);
      await axios.post(`${API_BASE}/conversations/active`, { id });
    } catch (err) {
      console.error('Error loading conversation:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const startNewConversation = async () => {
    try {
      // In a real app, the backend handles creation via /api/chat if no ID exists,
      // but we'll force a refresh or just clear state.
      // For this MVP, we'll just reload the page or clear local state and let the backend create a new one on the next message.
      window.location.reload(); 
    } catch (err) {
      console.error('Error starting new conversation:', err);
    }
  };

  const fetchFileContent = async (path) => {
    try {
      const res = await axios.post(`${API_BASE}/read`, { filePath: path });
      setCode(res.data.content);
    } catch (err) {
      console.error('Error reading file:', err);
    }
  };

  const handleSave = async () => {
    if (!currentFile) return;
    try {
      await axios.post(`${API_BASE}/write`, { filePath: currentFile, content: code });
      console.log('File saved successfully');
    } catch (err) {
      console.error('Error saving file:', err);
    }
  };

  const runTerminal = async (command) => {
    try {
      const res = await axios.post(`${API_BASE}/terminal`, { command });
      setTerminalOutput(prev => prev + `\n$ ${command}\n` + (res.data.stdout || res.data.stderr || 'Done'));
    } catch (err) {
      console.error('Terminal error:', err);
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const [activeAgents, setActiveAgents] = useState([]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg = inputText;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputText('');
    
    // Add temporary thinking message
    setMessages(prev => [...prev, { role: 'assistant', text: '...', thinking: true }]);

    try {
      const res = await axios.post(`${API_BASE}/chat`, { message: userMsg });
      
      // Remove thinking message and add real response
      setMessages(prev => {
        const filtered = prev.filter(m => !m.thinking);
        return [...filtered, { role: 'assistant', text: res.data.response }];
      });

      speak(res.data.response);

      // Refresh files and current file in case agent edited something
      fetchFiles();
      if (currentFile) fetchFileContent(currentFile);
      
    } catch (err) {
      console.error('Chat error:', err);
      // In a real environment we'd listen to SSE for granular updates 
      // but for this MVP we'll just show the final response.
    }
  };

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1;
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="dashboard-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="glass" style={{ width: '32px', height: '32px', background: 'hsl(var(--accent-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', boxShadow: '0 0 15px hsla(var(--accent-primary), 0.4)' }}>
            <Cpu size={20} color="white" />
          </div>
          <h1 style={{ 
            fontSize: '1.3rem', 
            fontWeight: 800, 
            letterSpacing: '-0.03em', 
            fontFamily: 'Outfit, sans-serif',
            background: 'linear-gradient(to right, #fff, hsl(var(--accent-secondary)))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>ANTIGRAVITY</h1>
          <div style={{ fontSize: '0.7rem', opacity: 0.4, padding: '2px 6px', border: '1px solid hsla(var(--text-main), 0.1)', borderRadius: '4px', marginLeft: '8px' }}>v1.0.0-ALPHA</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
          <button className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <TerminalIcon size={16} /> Terminal
          </button>
          <button className="btn" style={{ boxShadow: '0 4px 15px hsla(var(--accent-primary), 0.3)', padding: '8px 20px' }}>
            Deploy
          </button>
        </div>
      </header>

      <aside className={`sidebar history-sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
        <div style={{ padding: '20px 15px', borderBottom: '1px solid hsla(var(--text-main), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="hsl(var(--accent-primary))" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>HISTORY</span>
          </div>
          <PlusCircle 
            size={18} 
            className="clickable" 
            style={{ opacity: 0.6 }} 
            onClick={startNewConversation}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {conversations.map(conv => (
            <motion.div
              whileHover={{ x: 4, background: 'hsla(var(--text-main), 0.05)' }}
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={activeConvId === conv.id ? 'active-history-item' : 'history-item'}
              style={{ 
                padding: '10px 12px', 
                borderRadius: '8px', 
                fontSize: '0.8rem', 
                cursor: 'pointer', 
                marginBottom: '4px',
                border: activeConvId === conv.id ? '1px solid hsla(var(--accent-primary), 0.3)' : '1px solid transparent',
                background: activeConvId === conv.id ? 'hsla(var(--accent-primary), 0.05)' : 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <MessageSquare size={12} opacity={activeConvId === conv.id ? 1 : 0.4} />
                <span style={{ 
                  fontWeight: activeConvId === conv.id ? 700 : 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  opacity: activeConvId === conv.id ? 1 : 0.7
                }}>
                  {conv.title || 'Untitled Session'}
                </span>
              </div>
              <div style={{ fontSize: '0.65rem', opacity: 0.4, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={10} /> {new Date(conv.created_at).toLocaleDateString()}
              </div>
            </motion.div>
          ))}
        </div>

        <div style={{ padding: '15px', borderTop: '1px solid hsla(var(--text-main), 0.1)' }}>
          <div className="glass" style={{ padding: '12px', fontSize: '0.75rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--accent-secondary))', marginBottom: '6px' }}>
                <Monitor size={14} />
                <strong>WORKSPACE</strong>
             </div>
             <div style={{ opacity: 0.6, fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {files.length} Files Tracked
             </div>
          </div>
        </div>
      </aside>

      <aside className="sidebar file-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 12px', opacity: 0.9 }}>
          <FolderTree size={18} color="hsl(var(--accent-primary))" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>FILES</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {files.map(file => (
            <motion.div 
              whileHover={{ x: 4 }}
              key={file}
              onClick={() => setCurrentFile(file)}
              className={currentFile === file ? 'glass' : ''}
              style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentFile === file ? 'hsl(var(--accent-primary))' : 'transparent', boxShadow: currentFile === file ? '0 0 10px hsl(var(--accent-primary))' : 'none' }} />
              <span style={{ opacity: currentFile === file ? 1 : 0.6, fontWeight: currentFile === file ? 600 : 400 }}>{file}</span>
            </motion.div>
          ))}
        </div>
        <div style={{ padding: '12px' }}>
            <div className="glass" style={{ padding: '16px', fontSize: '0.8rem', border: '1px solid hsla(var(--accent-primary), 0.2)' }}>
               <div style={{ display: 'flex', gap: '8px', color: 'hsl(var(--accent-primary))', marginBottom: '8px', alignItems: 'center' }}>
                 <div className="pulse-dot" style={{ width: '8px', height: '8px', background: 'hsl(var(--accent-primary))', borderRadius: '50%', boxShadow: '0 0 12px hsl(var(--accent-primary))' }} />
                 <strong style={{ letterSpacing: '0.02em' }}>AGENT STATUS</strong>
               </div>
               <div style={{ opacity: 0.8, fontSize: '0.75rem' }}>
                 {isLoadingHistory ? 'Reloading Memory...' : 'System Online'} <br/>
                 Tasks: <strong>{agentTasks.filter(t => t.status === 'completed').length} / {agentTasks.length}</strong>
               </div>
            </div>
        </div>
      </aside>

      <main className="main-content">
        <section className="editor-pane">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 10px' }}>
             <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{currentFile}</span>
             <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
               <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={handleSave}>Save</button>
               <Play size={14} style={{ cursor: 'pointer', opacity: 0.6 }} />
               <Settings size={14} style={{ cursor: 'pointer', opacity: 0.6 }} />
             </div>
          </div>
          <div className="monaco-wrapper">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value)}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                roundedSelection: true,
                padding: { top: 20 },
                backgroundColor: 'transparent'
              }}
            />
          </div>
        </section>

        <section className="agent-pane">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px' }}>
            <MessageSquare size={18} color="hsl(var(--accent-primary))" />
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>AI AGENT</h2>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <AnimatePresence>
              {messages.map((m, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  key={i} 
                  style={{ 
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '14px 18px',
                    borderRadius: m.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                    fontSize: '0.9rem',
                    lineHeight: '1.5',
                    background: m.role === 'user' ? 'hsla(var(--accent-primary), 0.15)' : 'hsla(var(--bg-card), 0.8)',
                    border: '1px solid ' + (m.role === 'user' ? 'hsla(var(--accent-primary), 0.3)' : 'hsla(var(--border-glass), 0.6)'),
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    color: m.role === 'user' ? 'white' : 'hsl(var(--text-main))'
                  }}
                >
                  {m.thinking ? (
                    <span style={{ display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 600, color: 'hsl(var(--accent-primary))' }}>
                      <span className="thinking-spin"></span> Thinking...
                    </span>
                  ) : m.text}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>

          <div className="glass" style={{ padding: '10px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <button 
              className={`voice-btn ${isListening ? 'active' : ''}`}
              onClick={toggleVoice}
            >
              {isListening ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Ask the agent..."
              style={{ 
                flex: 1, 
                background: 'transparent', 
                border: 'none', 
                color: 'white', 
                outline: 'none', 
                resize: 'none',
                fontSize: '0.9rem',
                minHeight: '24px',
                maxHeight: '100px',
                padding: '5px'
              }}
            />
            <button className="btn" style={{ padding: '8px' }} onClick={handleSend}>
              <Send size={18} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
