import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AppMode, ChatMode, Message } from './types';
import * as geminiService from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { ChatIcon, ImageIcon, VideoIcon, VoiceIcon } from './components/Icons';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [appMode, setAppMode] = useState<AppMode>('chat');
  const [chatMode, setChatMode] = useState<ChatMode>('flash');
  const [currentChatStream, setCurrentChatStream] = useState<ReadableStream<any> | null>(null);

  const [isVeoKeyNeeded, setIsVeoKeyNeeded] = useState(false);
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Welcome message effect
  useEffect(() => {
    setMessages([{
      id: uuidv4(),
      role: 'model',
      content: { type: 'text', text: 'Welcome to the Gemini AI Studio! Select a mode from the sidebar to begin.' },
      timestamp: new Date(),
    }]);
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleModeChange = (mode: AppMode) => {
    setAppMode(mode);
    setMessages([]);
     if (isVoiceSessionActive) {
      geminiService.closeLiveSession();
      setIsVoiceSessionActive(false);
    }
  };

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage = { ...message, id: uuidv4(), timestamp: new Date() } as Message;
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  };

  const updateMessageContent = (id: string, newContent: Message['content']) => {
    setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, content: newContent } : msg));
  };
  
  const streamTextResponse = async (stream: AsyncGenerator<any>, messageId: string) => {
     let fullResponse = '';
     let firstChunk = true;
     for await (const chunk of stream) {
        fullResponse += chunk.text;
        if(firstChunk){
            updateMessageContent(messageId, { type: 'text', text: fullResponse, isTyping: true });
            firstChunk = false;
        } else {
            setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, content: { ...msg.content, type: 'text', text: fullResponse, isTyping: true } } : msg));
        }
     }
     setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, content: { ...msg.content, type: 'text', text: fullResponse, isTyping: false } } : msg));
  };

  const sendMessage = async (prompt: string, files: File[], imageOptions?: {aspectRatio: string}) => {
    if (!prompt && files.length === 0) return;
    setIsLoading(true);

    addMessage({ role: 'user', content: { type: 'text', text: prompt || `Analyzing ${files.length} file(s)...` } });
    const modelMessageId = addMessage({ role: 'model', content: { type: 'loading', text: 'Thinking...' } });

    try {
      let response;
      switch (appMode) {
        case 'chat':
            if (files.length > 0) {
                response = await geminiService.analyzeContent(prompt, files);
                updateMessageContent(modelMessageId, { type: 'text', text: response.text });
            } else {
                 const stream = await geminiService.generateTextStream(prompt, chatMode);
                 await streamTextResponse(stream, modelMessageId);
            }
          break;
        case 'image':
            updateMessageContent(modelMessageId, { type: 'loading', text: 'Generating image...' });
            if (files.length > 0) {
                 response = await geminiService.editImage(prompt, files[0]);
            } else {
                 response = await geminiService.generateImage(prompt, imageOptions?.aspectRatio ?? '1:1');
            }
            const imageUrl = `data:image/png;base64,${response.base64Image}`;
            updateMessageContent(modelMessageId, { type: 'image', url: imageUrl, prompt });
          break;
        case 'video':
          updateMessageContent(modelMessageId, { type: 'loading', text: 'Preparing video generation... This may take a few minutes.' });
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if(!hasKey) {
              setIsVeoKeyNeeded(true);
              updateMessageContent(modelMessageId, {type: 'error', text: 'API Key required for Veo. Please select a key.'});
              setIsLoading(false);
              return;
          }
          const operation = await geminiService.generateVideo(prompt, files.length > 0 ? files[0] : undefined);
          const videoUrl = await geminiService.pollVideoOperation(operation, (status) => {
              updateMessageContent(modelMessageId, { type: 'loading', text: status });
          });
          updateMessageContent(modelMessageId, { type: 'video', url: videoUrl, prompt });
          break;
      }
    } catch (error) {
        console.error("Error processing request:", error);
        let errorMessage = 'An error occurred. Please try again.';
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
               errorMessage = "Veo API Key invalid. Please re-select your key.";
               setIsVeoKeyNeeded(true);
            } else {
               errorMessage = error.message;
            }
        }
        updateMessageContent(modelMessageId, { type: 'error', text: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };
  
   const handleQuickAction = async (action: 'Simplify' | 'Expand' | 'Summarize', content: string) => {
        const prompt = `${action} the following text:\n\n${content}`;
        addMessage({ role: 'user', content: { type: 'text', text: prompt } });
        const modelMessageId = addMessage({ role: 'model', content: { type: 'loading', text: 'Thinking...' } });
        const stream = await geminiService.generateTextStream(prompt, 'pro');
        await streamTextResponse(stream, modelMessageId);
   };

   const handleVoiceToggle = async () => {
        if(isVoiceSessionActive) {
            geminiService.closeLiveSession();
            setIsVoiceSessionActive(false);
            return;
        }

       setIsLoading(true);
       addMessage({ role: 'model', content: {type: 'text', text: "Starting voice session..."}});
       try {
           await geminiService.connectLive({
               onOpen: () => {
                   setIsVoiceSessionActive(true);
                   setIsLoading(false);
                   addMessage({ role: 'model', content: {type: 'text', text: "Voice session started. I'm listening."}});
               },
               onMessage: (message) => {
                   // For simplicity, we are not displaying transcriptions here
                   // but they can be handled via message.serverContent
               },
               onClose: () => {
                   setIsVoiceSessionActive(false);
                   addMessage({ role: 'model', content: {type: 'text', text: "Voice session closed."}});
               },
               onError: (error) => {
                   console.error("Voice Error:", error);
                   setIsVoiceSessionActive(false);
                   addMessage({ role: 'model', content: {type: 'error', text: "Voice session error."}});
               }
           });
       } catch (error) {
            console.error(error)
            addMessage({ role: 'model', content: {type: 'error', text: "Failed to start voice session."}});
            setIsLoading(false);
       }
   };

  const VeoApiKeyModal = () => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-8 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Veo API Key Required</h2>
            <p className="text-gray-400 mb-6">Video generation with Veo requires a dedicated API key with billing enabled.</p>
            <p className="text-gray-400 mb-6 text-sm">Learn more about <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">billing for Gemini API</a>.</p>
            <button
                onClick={async () => {
                    await window.aistudio.openSelectKey();
                    setIsVeoKeyNeeded(false);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
                Select API Key
            </button>
        </div>
    </div>
  );


  const ModeSelector: React.FC = () => (
    <nav className="flex flex-col gap-2 p-4 bg-gray-900 border-r border-gray-800">
      {(['chat', 'image', 'video', 'voice'] as AppMode[]).map(mode => {
        const Icon = { chat: ChatIcon, image: ImageIcon, video: VideoIcon, voice: VoiceIcon }[mode];
        return (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors ${appMode === mode ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700/50'}`}
            aria-label={`Switch to ${mode} mode`}
            aria-current={appMode === mode}
          >
            <Icon className="w-6 h-6" />
            <span className="capitalize">{mode}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans">
      {isVeoKeyNeeded && <VeoApiKeyModal />}
      <ModeSelector />
      <div className="flex flex-col flex-1">
        <header className="bg-gray-800/50 backdrop-blur-sm p-4 border-b border-gray-700 shadow-lg flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-center bg-gradient-to-r from-purple-400 to-indigo-500 text-transparent bg-clip-text capitalize">
                {appMode} Mode
            </h1>
            {appMode === 'chat' && (
                 <div className="flex items-center gap-2 p-1 bg-gray-700/50 rounded-lg">
                    {(['flash-lite', 'flash', 'pro', 'search', 'maps'] as ChatMode[]).map(mode => (
                        <button key={mode} onClick={() => setChatMode(mode)} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${chatMode === mode ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>
                            {mode.replace('-', ' ')}
                        </button>
                    ))}
                </div>
            )}
        </header>
        
        <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-container">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isLastMessage={messages[messages.length - 1].id === msg.id}
              onQuickAction={handleQuickAction}
            />
          ))}
        </main>
        
        <footer className="p-4 md:p-6 bg-gray-900 border-t border-gray-700">
          <div className="max-w-4xl mx-auto">
            {appMode === 'voice' ? (
                 <button onClick={handleVoiceToggle} disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                     {isVoiceSessionActive ? 'Stop Conversation' : 'Start Conversation'}
                 </button>
            ) : (
              <ChatInput onSendMessage={sendMessage} isLoading={isLoading} mode={appMode} />
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
