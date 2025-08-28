import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, Sparkles, ShieldCheck, FileText } from "lucide-react";
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
    college?: string;
    branch?: string;
    year?: string;
    skills: string[];
    interests: string[];
  };
}

const ChatWidget = ({ profile }: ChatWidgetProps) => {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: crypto.randomUUID(),
      text: `Hey ${profile?.name?.split(" ")[0] || "there"}! I’m your AI resume & internship assistant.\n\nUpload your resume (left) and ask me anything—I'll tailor answers to your profile, suggest roles, and help polish your resume.`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // EXACTLY 3 resume-centric FAQs
  const faqs = useMemo(
    () => [
      "Rate my resume & top 3 fixes",
      "What roles fit my skills right now?",
      "Skills to add for a paid internship",
    ],
    []
  );

  // Auto scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const sendToAI = async (text: string) => {
    setIsLoading(true);
    try {
      const history: ChatHistoryItem[] = messages.map((m) => ({ text: m.text, isUser: m.isUser }));
      const chatProfile: ChatProfile = {
        name: profile.name,
        college: profile.college || "",
        branch: profile.branch || "",
        year: profile.year || "",
        skills: profile.skills || [],
        interests: profile.interests || [],
      };
      const reply = await chatWithAssistant(text, chatProfile, history);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text: reply, isUser: false, timestamp: new Date() },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text: "❌ I’m having trouble right now—please try again in a moment.",
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
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, isUser: true, timestamp: new Date() },
    ]);
    setInputText("");
    await sendToAI(text);
  };

  const handleQuickAsk = async (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, isUser: true, timestamp: new Date() },
    ]);
    await sendToAI(text);
  };

  return (
    <div
      className="
        w-full
        rounded-3xl
        border border-card-border
        bg-white/5 dark:bg-white/5
        backdrop-blur-xl
        shadow-xl
        overflow-hidden
        max-h-[78vh] md:max-h-[82vh]
        flex flex-col
      "
    >
      {/* Header */}
      <div className="relative p-4 md:p-5 bg-gradient-to-r from-indigo-500/70 via-purple-500/60 to-pink-500/60 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 border border-white/20 backdrop-blur">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight">Resume Chat</div>
              <div className="text-[11px] opacity-90">
                AI Assistant for {profile?.name?.split(" ")[0] || "you"}
              </div>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center text-[10px] px-2 py-1 rounded-full bg-white/15 border border-white/20">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Resume-aware
          </span>
        </div>

        {/* Empty-state tip line under header (subtle, only when seed only) */}
        {messages.length <= 1 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-white/90">
            <FileText className="w-4 h-4" />
            Upload your resume on the left to unlock tailored answers.
          </div>
        )}
      </div>

      {/* FAQ Pills */}
      <div className="px-3 sm:px-4 py-2 sm:py-3 bg-transparent">
        <div className="flex flex-wrap gap-2">
          {faqs.map((q) => (
            <button
              key={q}
              onClick={() => handleQuickAsk(q)}
              className="
                text-xs sm:text-[13px]
                px-3 py-1.5
                rounded-full
                bg-white/8 hover:bg-white/15
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
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="
          flex-1
          px-3 sm:px-4 py-3 sm:py-4
          overflow-y-auto
          bg-gradient-to-b from-white/15 to-transparent
          space-y-2
        "
      >
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={[
              "max-w-[86%] rounded-2xl px-3.5 py-2.5 leading-relaxed",
              "backdrop-blur-md border shadow-sm whitespace-pre-line",
              m.isUser
                ? "ml-auto bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-400/30 text-indigo-950 dark:text-indigo-50"
                : "bg-white/35 border-white/50 text-slate-900 dark:text-slate-100",
            ].join(" ")}
          >
            {m.text}
          </motion.div>
        ))}

        {isLoading && (
          <div className="max-w-[70%] rounded-2xl px-3.5 py-2.5 bg-white/35 border border-white/50 backdrop-blur-md shadow-sm text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:.1s]" />
              <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:.2s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input (sticky) */}
      <div className="sticky bottom-0 p-3 sm:p-4 bg-white/65 dark:bg-white/10 backdrop-blur-xl border-t border-card-border">
        <div className="flex items-center gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about resume fixes, roles, or skill gaps…"
            disabled={isLoading}
            className="bg-white/80 dark:bg-white/10 focus:bg-white dark:focus:bg-white/15 rounded-2xl border-card-border"
            aria-label="Message input"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !inputText.trim()}
            className="rounded-2xl px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md hover:shadow-lg active:scale-[.98]"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          Pro tip: Paste a job JD and I’ll tailor your resume to it.
        </div>
      </div>
    </div>
  );
};

export { ChatWidget };
export default ChatWidget;
