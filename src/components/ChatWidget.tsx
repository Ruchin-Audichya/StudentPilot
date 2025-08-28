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

  const faqs = useMemo(
    () => [
      "Rate my resume & top 3 fixes",
      "What roles fit my skills right now?",
      "Skills to add for a paid internship",
    ],
    []
  );

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
        overflow-hidden
        shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)]
        backdrop-blur-xl
        max-h-[78vh] md:max-h-[82vh]
        flex flex-col
        bg-black/20
      "
    >
      {/* Header with stacked gradients */}
      <div className="relative">
        {/* Base vivid linear gradient */}
        <div
          className="
            relative z-10
            px-4 md:px-5 py-4
            text-white
            bg-[linear-gradient(95deg,#635BFF_0%,#8B5CF6_45%,#EC4899_100%)]
            rounded-t-3xl
            border-b border-white/15
          "
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-sm">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <div className="font-extrabold tracking-tight">Resume Chat</div>
                <div className="text-[11px] opacity-95">
                  AI Assistant for {profile?.name?.split(" ")[0] || "you"}
                </div>
              </div>
            </div>

            <span
              className="
                hidden sm:inline-flex items-center text-[10px] px-2 py-1 rounded-full
                bg-white/15 border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,.5)]
              "
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Resume-aware
            </span>
          </div>

          {/* Tip shown when only seed exists */}
          {messages.length <= 1 && (
            <div className="mt-3 flex items-center gap-2 text-[12px] text-white/95">
              <FileText className="w-4 h-4" />
              Upload your resume on the left to unlock tailored answers.
            </div>
          )}
        </div>

        {/* Radial spotlight (top-left) */}
        <span
          aria-hidden
          className="
            pointer-events-none absolute inset-0
            bg-[radial-gradient(1200px_500px_at_-5%_-20%,rgba(255,255,255,0.35),transparent_60%)]
            rounded-t-3xl
          "
        />
        {/* Grain / noise film */}
        <span
          aria-hidden
          className="
            pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-soft-light rounded-t-3xl
            bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%2240%22 height=%2240%22 filter=%22url(%23n)%22 opacity=%220.4%22/></svg>')]
          "
        />
        {/* Inner highlight */}
        <span
          aria-hidden
          className="
            pointer-events-none absolute inset-0 rounded-t-3xl
            shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]
          "
        />
        {/* Outer ring to separate from dark bg */}
        <span
          aria-hidden
          className="
            pointer-events-none absolute -inset-[1px] rounded-t-[28px]
            bg-[linear-gradient(180deg,rgba(255,255,255,0.5),rgba(255,255,255,0))]
            opacity-40
          "
        />
      </div>

      {/* FAQ Pills */}
      <div className="px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex flex-wrap gap-2">
          {faqs.map((q) => (
            <button
              key={q}
              onClick={() => handleQuickAsk(q)}
              className="
                text-xs sm:text-[13px]
                px-3 py-1.5 rounded-full
                bg-black/20 hover:bg-black/30
                border border-white/10
                shadow-[inset_0_1px_0_rgba(255,255,255,.25)]
                backdrop-blur
                transition active:scale-[.98]
                text-white/95
              "
            >
              <Sparkles className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" />
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="
          flex-1
          px-3 sm:px-4 py-3 sm:py-4
          overflow-y-auto
          bg-gradient-to-b from-white/5 to-transparent
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
                ? "ml-auto bg-gradient-to-br from-indigo-500/25 to-purple-500/25 border-indigo-400/30 text-indigo-950 dark:text-indigo-50"
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
      <div className="sticky bottom-0 p-3 sm:p-4 bg-white/70 dark:bg-white/10 backdrop-blur-2xl border-t border-white/10">
        <div className="flex items-center gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about resume fixes, roles, or skill gaps…"
            disabled={isLoading}
            className="
              bg-white/85 dark:bg-white/10 focus:bg-white dark:focus:bg-white/15
              rounded-2xl border-white/20 text-sm
            "
            aria-label="Message input"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !inputText.trim()}
            className="
              rounded-2xl px-4
              text-white
              shadow-md hover:shadow-lg active:scale-[.98]
              bg-[linear-gradient(95deg,#6D6AFF_0%,#8B5CF6_50%,#EC4899_100%)]
            "
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-2 text-[11px] text-white/60">
          Pro tip: Paste a job JD and I’ll tailor your resume to it.
        </div>
      </div>
    </div>
  );
};

export { ChatWidget };
export default ChatWidget;
