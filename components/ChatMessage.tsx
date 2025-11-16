import React from 'react';
import { Message } from '../types';
import { BotIcon, GoogleIcon, MapPinIcon, SparkleIcon, UserIcon } from './Icons';

interface ChatMessageProps {
  message: Message;
  isLastMessage: boolean;
  onQuickAction: (action: 'Simplify' | 'Expand' | 'Summarize', content: string) => void;
}

const QuickActionButton: React.FC<{onClick: () => void; children: React.ReactNode}> = ({onClick, children}) => (
    <button
        onClick={onClick}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
    >
        {children}
    </button>
);

const MessageContent: React.FC<{ message: Message; isLastMessage: boolean; onQuickAction: ChatMessageProps['onQuickAction'] }> = ({ message, isLastMessage, onQuickAction }) => {
    const { content } = message;

    switch (content.type) {
        case 'text':
            const showQuickActions = message.role === 'model' && isLastMessage && !content.isTyping && content.text;
            return (
                <div className="flex flex-col gap-2 items-start">
                    <p className="whitespace-pre-wrap">{content.text}{content.isTyping && <span className="inline-block w-2 h-4 bg-white ml-1 animate-pulse"></span>}</p>
                    {showQuickActions && (
                        <div className="flex items-center gap-2 pt-2">
                           <QuickActionButton onClick={() => onQuickAction('Simplify', content.text)}><SparkleIcon className="w-3.5 h-3.5" /> Simplify</QuickActionButton>
                           <QuickActionButton onClick={() => onQuickAction('Expand', content.text)}><SparkleIcon className="w-3.5 h-3.5" /> Expand</QuickActionButton>
                           <QuickActionButton onClick={() => onQuickAction('Summarize', content.text)}><SparkleIcon className="w-3.5 h-3.5" /> Summarize</QuickActionButton>
                        </div>
                    )}
                </div>
            );
        case 'image':
            return (
                <div className="p-0">
                    <img src={content.url} alt={content.prompt || 'Generated Image'} className="rounded-lg max-w-sm" />
                    {content.prompt && <p className="text-xs text-gray-400 pt-2 italic">Prompt: "{content.prompt}"</p>}
                </div>
            );
        case 'video':
            return (
                <div className="p-0">
                    <video src={content.url} controls className="rounded-lg max-w-sm" />
                    {content.prompt && <p className="text-xs text-gray-400 pt-2 italic">Prompt: "{content.prompt}"</p>}
                </div>
            );
        case 'loading':
            return (
                <div className="flex items-center gap-3">
                     <div className="w-5 h-5 border-2 border-t-transparent border-indigo-400 rounded-full animate-spin"></div>
                     <span>{content.text}</span>
                </div>
            );
        case 'error':
            return <p className="text-red-400">Error: {content.text}</p>;
        case 'grounding': // This is a placeholder; full implementation requires parsing `response.candidates`
            return <p className="whitespace-pre-wrap">{content.text}</p>;
        default:
            return <p>Unsupported message type</p>;
    }
};


const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLastMessage, onQuickAction }) => {
  const isModel = message.role === 'model';
  return (
    <div className={`flex items-start gap-4 ${isModel ? '' : 'flex-row-reverse'}`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isModel ? 'bg-indigo-500' : 'bg-purple-500'}`}>
        {isModel ? <BotIcon /> : <UserIcon />}
      </div>
      <div className={`flex flex-col gap-2 w-full ${isModel ? 'items-start' : 'items-end'}`}>
        <div className={`max-w-xl p-4 rounded-2xl shadow-md prose prose-invert prose-sm ${isModel ? 'bg-gray-800 rounded-tl-none' : 'bg-blue-900/50 rounded-tr-none'}`}>
            <MessageContent message={message} isLastMessage={isLastMessage} onQuickAction={onQuickAction} />
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
