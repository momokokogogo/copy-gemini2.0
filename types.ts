export type TextContent = {
  type: 'text';
  text: string;
  isTyping?: boolean;
};

export type ImageContent = {
  type: 'image';
  url: string; // data URL
  prompt?: string;
};

export type VideoContent = {
  type: 'video';
  url: string; // object URL from blob
  prompt?: string;
};

export type GroundingContent = {
  type: 'grounding';
  text: string;
  chunks: any[];
};

export type LoadingContent = {
  type: 'loading';
  text: string;
};

export type ErrorContent = {
  type: 'error';
  text: string;
};

export type Content = TextContent | ImageContent | VideoContent | GroundingContent | LoadingContent | ErrorContent;

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: Content;
  timestamp: Date;
}

export type ChatMode = 'flash-lite' | 'flash' | 'pro' | 'search' | 'maps';
export type AppMode = 'chat' | 'image' | 'video' | 'voice';

// Type for the global window.aistudio object
// Fix: Use a named interface 'AIStudio' to resolve declaration conflicts.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio: AIStudio;
  }
}
