import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Send } from 'lucide-react';
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
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    await sendMessageToAI(inputText);
  };

  return (
    <Card className="w-full max-w-md shadow-2xl rounded-xl animate-fadein">
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-xl">
          <span className="font-bold text-lg flex items-center gap-2"><MessageCircle /> Career Chatbot</span>
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
};