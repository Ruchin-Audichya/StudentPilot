import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, Sparkles, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chatWithAssistant, type ChatHistoryItem, type ChatProfile } from "@/services/chatApi";

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

const typingDots = (
  <div className="flex items-center gap-1 text-muted-foreground">
    <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
    <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:.1s]" />
    <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:.2s]" />
  </div>
);

export const ChatWidget = ({ profile }: ChatWidgetProps) => {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "seed-1",
      text: `Hey ${profile.name || "there"}! I’m your AI resume & internship assistant.\n\nUpload your resume on the left and ask me anything—I'll tailor answers to your profile, suggest roles, and help polish your resume.`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep only 3 clean, resume-centric FAQs as requested
  const faq: string[] = useMemo(
    () => [
      "Rate my resume & top 3 fixes",
      "What roles fit my skills right now?",
      "Skills to add for a paid internship",
    ],
    []
  );

  // Auto-scroll to bottom on new message
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessageToAI = async (message: string) => {
    setIsLoading(true);
    try {
      const history: ChatHistoryItem[] = messages.map((m) => ({ text: m.text, isUser: m.isUser }));
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
        id: crypto.randomUUID(),
        text: reply,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("AI API Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text: "❌ I’m having trouble connecting right now. Please try again in a moment.",
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      text,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    await sendMessageToAI(text);
  };

  const nameFirst = useMemo(() => (profile.name || "Friend").split(" ")[0], [profile.name]);

  return (
    <div
      className="
        w-full
        rounded-3xl
        glass-card
        border border-card-border
        shadow-xl
        overflow-hidden
        backdrop-blur-md
        lg:max-w-[28rem]
      "
    >
      {/* Header */}
      <div className="relative p-4 md:p-5 bg-gradient-to-r from-indigo-500/70 via-purple-500/60 to-pink-500/60 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-white/15 border border-white/20 backdrop-blur">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight">Resume Chat</div>
              <div className="text-xs opacity-90">AI Assistant for {nameFirst}</div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] px-2 py-1 rounded-full bg-white/15 border border-white/20">
              <ShieldCheck className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" />
              Resume-aware
            </span>
          </div>
        </div>
      </div>

      {/* FAQ row */}
      <div className="px-3 sm:px-4 pt-3 flex flex-wrap gap-2">
        {faq.map((q, i) => (
          <button
            key={i}
            onClick={() => {
              setInputText(q);
              setTimeout(() => handleSend(), 0);
            }}
            className="
              text-xs sm:text-[13px]
              px-3 py-1.5
              rounded-full
              bg-white/5 hover:bg-white/10
              border border-card-border
              shadow-sm
              transition
              active:scale-[.98]
            "
          >
            <Sparkles className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" />
            {q}
          </button>
        ))}
      </div>

      {/* Message feed */}
      <div
        ref={scrollerRef}
        className="
          px-3 sm:px-4 py-3 sm:py-4
          h-[22rem] sm:h-[26rem]
          overflow-y-auto
          space-y-2
          bg-gradient-to-b from-white/20 to-white/5
        "
      >
        {messages.length === 1 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <FileText className="w-4 h-4" />
              Tip: Upload your resume on the left to unlock tailored answers.
            </div>
          </div>
        )}

        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={[
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed",
              "backdrop-blur-md border shadow-sm",
              m.isUser
                ? "ml-auto bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-400/30 text-indigo-950 dark:text-indigo-50"
                : "bg-white/35 border-white/50 text-slate-900 dark:text-slate-100",
            ].join(" ")}
          >
            <span className="whitespace-pre-line">{m.text}</span>
          </motion.div>
        ))}

        {isLoading && (
          <div className="max-w-[70%] rounded-2xl px-3.5 py-2.5 bg-white/35 border border-white/50 backdrop-blur-md shadow-sm text-slate-900 dark:text-slate-100">
            {typingDots}
          </div>
        )}
      </div>

      {/* Input bar (mobile-first, sticky) */}
      <div className="sticky bottom-0 p-3 sm:p-4 bg-white/60 backdrop-blur-xl border-t border-card-border">
        <div className="flex items-center gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about resume fixes, roles, or skill gaps…"
            disabled={isLoading}
            className="
              bg-white/70 focus:bg-white
              border-card-border
              rounded-2xl
            "
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !inputText.trim()}
            className="rounded-2xl px-4 gradient-primary text-white shadow-md hover:shadow-lg active:scale-[.98]"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          Pro tip: Paste a JOB JD and I’ll tailor your resume to it.
        </div>
      </div>
    </div>
  );
};
