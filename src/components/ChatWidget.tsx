import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { chatWithAssistant, type ChatHistoryItem, type ChatProfile } from '@/services/chatApi';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatWidgetProps {
  profile: {
    name: string;
    college: string;
    branch: string;
    year: string;
    skills: string[];
    interests: string[];
  };
}

export const ChatWidget = ({ profile }: ChatWidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `👋 Hi ${profile.name}! I'm your AI career assistant. I can help you with career advice, skill development, and internship guidance. What would you like to know?`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const faqSuggestions = [
    'Rate my resume',
    'Skill gap for backend',
    'Who am I?',
    '3-step plan for paid internship this month',
    'How to improve my resume?',
    'What are my strengths and weaknesses?',
    'Suggest internships for me',
  ];

  const sendMessageToAI = async (message: string) => {
    setIsLoading(true);
    try {
      const history: ChatHistoryItem[] = messages.map(m => ({ text: m.text, isUser: m.isUser }));
      const chatProfile: ChatProfile = {
        name: profile.name,
        college: profile.college,
        branch: profile.branch,
        year: profile.year,
        skills: profile.skills,
        interests: profile.interests,
      };
      const reply = await chatWithAssistant(message, chatProfile, history);
      const aiMessage: Message = {
        id: Date.now().toString(),
        text: reply,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI API Error:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: "❌ Sorry, I'm having trouble connecting right now. Please try again later.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    return (
      <Card className="fixed bottom-4 right-4 w-full max-w-md z-50 shadow-2xl rounded-xl animate-fadein">
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-xl">
            <span className="font-bold text-lg flex items-center gap-2"><MessageCircle /> Career Chatbot</span>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}><X /></Button>
          </div>
          <div className="px-4 py-2 h-80 overflow-y-auto flex flex-col gap-2 bg-white">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`rounded-lg px-3 py-2 whitespace-pre-line ${msg.isUser ? 'bg-blue-100 text-blue-900 self-end' : 'bg-gray-50 text-gray-900 self-start'} shadow-sm`}
              >
                {msg.text}
              </motion.div>
            ))}
          </div>
          <div className="px-4 py-2 border-t bg-gray-50 flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 mb-2">
              {faqSuggestions.map((faq, idx) => (
                <Button key={idx} variant="outline" size="sm" onClick={() => { setInputText(faq); handleSendMessage(); }}>
                  {faq}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <Input
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about internships, skills, resume..."
                disabled={isLoading}
              />
              <Button onClick={handleSendMessage} disabled={isLoading || !inputText.trim()}><Send /></Button>
            </div>
          </div>
        </div>
      </Card>
    );
      </Button>

      {/* Chat Widget */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-96 h-[500px] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border shadow-2xl z-40 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-secondary/10">
            <h3 className="font-semibold text-foreground">Career AI Assistant</h3>
            <p className="text-sm text-muted-foreground">Ask me about internships, skills, or career advice</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.isUser
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground p-3 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex space-x-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about internships, skills, or career advice..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
};