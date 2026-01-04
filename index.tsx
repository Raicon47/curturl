import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
interface ShortenedURL {
  id: string;
  original: string;
  short: string;
  createdAt: number;
  clicks: number;
  alias?: string;
}

// --- Utils ---
const generateId = (length: number = 6) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

// --- App Component ---
const App: React.FC = () => {
  const [url, setUrl] = useState('');
  const [history, setHistory] = useState<ShortenedURL[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('curturl_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    // Handle redirection if hash is present
    const handleRedirect = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        const stored = localStorage.getItem('curturl_history');
        if (stored) {
          const items: ShortenedURL[] = JSON.parse(stored);
          const match = items.find(item => item.id === hash);
          if (match) {
            // Update click count before redirecting
            const updatedHistory = items.map(item => 
              item.id === hash ? { ...item, clicks: item.clicks + 1 } : item
            );
            localStorage.setItem('curturl_history', JSON.stringify(updatedHistory));
            window.location.href = match.original;
          }
        }
      }
    };

    handleRedirect();
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('curturl_history', JSON.stringify(history));
  }, [history]);

  const handleShorten = async (e?: React.FormEvent, customAlias?: string) => {
    if (e) e.preventDefault();
    setError(null);

    if (!isValidUrl(url)) {
      setError("Please enter a valid URL (including http/https)");
      return;
    }

    const id = customAlias || generateId();
    
    // Check if alias already exists
    if (history.find(h => h.id === id)) {
      setError("That alias is already taken.");
      return;
    }

    const newEntry: ShortenedURL = {
      id,
      original: url,
      short: `${window.location.origin}${window.location.pathname}#${id}`,
      createdAt: Date.now(),
      clicks: 0,
      alias: customAlias
    };

    setHistory([newEntry, ...history]);
    setUrl('');
    setAiSuggestions([]);
    setCopySuccess(null);
  };

  const getAiSuggestions = async () => {
    if (!isValidUrl(url)) {
      setError("Enter a valid URL first to get suggestions.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on this URL: ${url}, suggest 4 short, catchy, and descriptive text aliases (lowercase, no spaces, max 12 characters each) that would make a good short link. Return only a JSON array of strings.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      
      const suggestions = JSON.parse(response.text);
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error("AI Error:", err);
      setError("Failed to get AI suggestions. Try manual shortening.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const deleteLink = (id: string) => {
    setHistory(history.filter(h => h.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 relative z-10">
      {/* Background blobs */}
      <div className="fixed top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob pointer-events-none"></div>
      <div className="fixed top-0 -right-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 pointer-events-none"></div>
      <div className="fixed -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 pointer-events-none"></div>

      <header className="text-center mb-16">
        <h1 className="text-6xl font-extrabold tracking-tight mb-4">
          curt<span className="gradient-text">url</span>
        </h1>
        <p className="text-slate-400 text-lg">Shorten, share, and track with AI-powered aliases.</p>
      </header>

      <main>
        {/* Input Section */}
        <section className="glass rounded-3xl p-8 shadow-2xl mb-12 border-t border-white/5">
          <form onSubmit={(e) => handleShorten(e)} className="flex flex-col gap-4">
            <div className="relative group">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste your long URL here..."
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-2xl px-6 py-5 text-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-600"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
              >
                Shorten
              </button>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={getAiSuggestions}
                disabled={loading || !url}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Thinking...
                  </span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Get Smart AI Aliases
                  </>
                )}
              </button>
            </div>

            {aiSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 animate-in fade-in slide-in-from-top-4 duration-300">
                {aiSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleShorten(undefined, suggestion)}
                    className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full px-4 py-1.5 text-xs font-semibold transition-all hover:scale-105"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <p className="text-rose-400 text-sm mt-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </p>
            )}
          </form>
        </section>

        {/* History Section */}
        <section>
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-2xl font-bold">Your Links</h2>
            <span className="text-slate-500 text-sm">{history.length} links shortened</span>
          </div>

          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="glass rounded-3xl p-12 text-center border-dashed border-2 border-slate-700 bg-transparent">
                <p className="text-slate-500">No links shortened yet. Start by pasting a URL above.</p>
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="glass rounded-2xl p-6 transition-all hover:border-slate-600 group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <a 
                          href={item.short} 
                          className="text-xl font-semibold text-white hover:text-indigo-400 transition-colors truncate"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          curturl.ai/<span className="text-indigo-400">{item.id}</span>
                        </a>
                        <span className="text-[10px] uppercase tracking-wider font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                          {item.clicks} clicks
                        </span>
                      </div>
                      <p className="text-slate-500 text-sm truncate max-w-md">{item.original}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => copyToClipboard(item.short, item.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          copySuccess === item.id 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {copySuccess === item.id ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Copied
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => deleteLink(item.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="mt-24 text-center text-slate-600 text-sm">
        <p>© {new Date().getFullYear()} curturl. Modern link management.</p>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
