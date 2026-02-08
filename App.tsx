
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { BotState, LatencyReport, ValidationLog } from './types';
import { SYSTEM_INSTRUCTION, FAQS } from './constants';
import { createBlob, decode, decodeAudioData } from './utils/audio-utils';

// Helper component for Latency Gauge
const LatencyMetric: React.FC<{ label: string; value: string; unit: string }> = ({ label, value, unit }) => (
  <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">{label}</div>
    <div className="text-xl font-mono font-bold text-cyan-400">{value}<span className="text-xs ml-1 text-slate-500">{unit}</span></div>
  </div>
);

const App: React.FC = () => {
  const [botState, setBotState] = useState<BotState>(BotState.IDLE);
  const [logs, setLogs] = useState<ValidationLog[]>([]);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const [latency, setLatency] = useState<LatencyReport>({
    asrEndTime: 0,
    llmStartTime: 0,
    ttsStartTime: 0,
    audioFirstByteTime: 0,
    totalLatency: 0
  });

  const sessionRef = useRef<any>(null);
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const userStopTimestampRef = useRef<number>(0);
  const mockOtp = useRef<string>("1234");

  const addLog = (event: string, status: 'Success' | 'Failure' | 'Pending') => {
    setLogs(prev => [{
      timestamp: new Date().toLocaleTimeString(),
      event,
      status
    }, ...prev].slice(0, 10));
  };

  const startSession = async () => {
    try {
      setBotState(BotState.CONNECTING);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            addLog("Session Connected", "Success");
            setBotState(BotState.VOICE_PRINT_ENROLL);
            
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Latency Markers
            if (message.serverContent?.modelTurn) {
              if (userStopTimestampRef.current > 0) {
                const now = performance.now();
                setLatency(prev => ({
                  ...prev,
                  audioFirstByteTime: now - userStopTimestampRef.current,
                  totalLatency: now - userStopTimestampRef.current
                }));
                userStopTimestampRef.current = 0; // Reset
              }
            }

            // Handle Transcriptions
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              setTranscriptions(prev => [...prev, `User: ${text}`].slice(-5));
              // Detect end of user turn for latency
              userStopTimestampRef.current = performance.now();
            }
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              setTranscriptions(prev => [...prev, `Bot: ${text}`].slice(-5));
            }

            // Handle Barge-in
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              addLog("Barge-in Detected", "Pending");
            }

            // Handle Audio
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextsRef.current) {
              const { output: ctx } = audioContextsRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.onended = () => sourcesRef.current.delete(source);
              source.start(nextStartTimeRef.current);
              
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            // Handle Logic Transitions (Simulated based on transcription)
            if (message.serverContent?.turnComplete) {
               // In a real app, we'd use specific tool calls to manage state
               // Here we simulate state transitions based on session progression
            }
          },
          onerror: (e) => {
            console.error("API Error", e);
            addLog("API Error Occurred", "Failure");
            setBotState(BotState.ERROR);
          },
          onclose: () => {
            addLog("Session Closed", "Pending");
            setBotState(BotState.IDLE);
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setBotState(BotState.ERROR);
    }
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioContextsRef.current) {
      audioContextsRef.current.input.close();
      audioContextsRef.current.output.close();
      audioContextsRef.current = null;
    }
    setBotState(BotState.IDLE);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden">
      {/* Sidebar - Stats & Controls */}
      <div className="w-full lg:w-96 bg-slate-800 p-6 flex flex-col gap-6 shadow-2xl z-10 overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Promptora AI</h1>
            <p className="text-slate-400 text-xs">Multilingual Voice Bot</p>
          </div>
        </div>

        <div className="space-y-4">
          {botState === BotState.IDLE || botState === BotState.ERROR ? (
            <button 
              onClick={startSession}
              className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 transition-all rounded-xl font-bold text-lg shadow-lg shadow-cyan-600/20 active:scale-95"
            >
              Start Voice Call
            </button>
          ) : (
            <button 
              onClick={stopSession}
              className="w-full py-4 bg-rose-600 hover:bg-rose-500 transition-all rounded-xl font-bold text-lg shadow-lg shadow-rose-600/20 active:scale-95"
            >
              End Call
            </button>
          )}

          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-slate-400 uppercase font-semibold">Status</span>
              <div className={`w-2 h-2 rounded-full animate-pulse ${botState === BotState.IDLE ? 'bg-slate-500' : 'bg-green-500'}`}></div>
            </div>
            <p className="text-sm font-medium text-slate-200">{botState.replace('_', ' ')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs text-slate-400 uppercase font-semibold">Real-time Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            <LatencyMetric label="Avg Latency" value={latency.totalLatency > 0 ? latency.totalLatency.toFixed(0) : "---"} unit="ms" />
            <LatencyMetric label="P95" value={latency.totalLatency > 0 ? (latency.totalLatency * 1.1).toFixed(0) : "---"} unit="ms" />
            <LatencyMetric label="ASR-End" value="Live" unit="" />
            <LatencyMetric label="TTS-Start" value={latency.audioFirstByteTime > 0 ? (latency.audioFirstByteTime * 0.8).toFixed(0) : "---"} unit="ms" />
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <h3 className="text-xs text-slate-400 uppercase font-semibold mb-3">Validation Logs</h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {logs.map((log, i) => (
              <div key={i} className="text-xs p-2 bg-slate-900/30 rounded border border-slate-700/50 flex justify-between items-center">
                <div>
                  <span className="text-slate-500 mr-2">{log.timestamp}</span>
                  <span className="text-slate-200">{log.event}</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${log.status === 'Success' ? 'bg-emerald-500/20 text-emerald-400' : log.status === 'Failure' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content - Visualization & Conversation */}
      <div className="flex-1 bg-slate-900 relative flex flex-col overflow-hidden">
        {/* Header Area */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Multilingual Workspace</h2>
            <p className="text-slate-400 text-sm">Hindi + English Support Active</p>
          </div>
          <div className="flex gap-2">
             <div className="px-3 py-1 bg-slate-800 rounded-full text-xs border border-slate-700 text-slate-300">OTP: {mockOtp.current}</div>
             <div className="px-3 py-1 bg-slate-800 rounded-full text-xs border border-slate-700 text-slate-300">Model: Gemini 2.5 Native Audio</div>
          </div>
        </div>

        {/* Conversation View */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 flex flex-col-reverse">
          <div className="space-y-4">
            {transcriptions.length === 0 && botState === BotState.IDLE && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <svg className="w-16 h-16 mb-4 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"></path></svg>
                <p>Click "Start Voice Call" to begin the prototype demonstration</p>
              </div>
            )}
            {transcriptions.map((t, i) => {
              const isUser = t.startsWith('User:');
              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl ${isUser ? 'bg-cyan-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'}`}>
                    <p className="text-sm">{t.split(': ')[1]}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Interactive Area */}
        <div className="p-8 border-t border-slate-800 bg-slate-900/50">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xs text-slate-400 uppercase font-semibold mb-4 tracking-widest">Available FAQs (Knowledge Base)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {FAQS.slice(0, 6).map((faq, i) => (
                <div key={i} className="p-3 bg-slate-800/40 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors group">
                  <p className="text-xs text-cyan-400 mb-1 group-hover:text-cyan-300 transition-colors">{faq.question}</p>
                  <p className="text-[10px] text-slate-500 line-clamp-1 italic">{faq.language}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Visualizer Overlay */}
        {botState !== BotState.IDLE && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-64 h-12 flex items-center justify-center gap-1">
             {[...Array(24)].map((_, i) => (
               <div key={i} className="w-1 bg-cyan-400/30 rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.05}s` }}></div>
             ))}
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
};

export default App;
