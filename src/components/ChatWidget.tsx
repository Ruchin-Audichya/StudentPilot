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

export default function ChatWidget({ profile }: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: crypto.randomUUID(),
      text:
        `Hey ${profile?.name?.split(" ")[0] || "there"}! I’m your AI resume & internship assistant.\n\n` +
        `Upload your resume (left) and ask me anything—I'll tailor answers to your profile, suggest roles, and help polish your resume.`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Exactly 3 resume-centric FAQs
  const faqs = useMemo(
    () => [
      "Rate my resume & top 3 fixes",
      "What roles fit my skills right now?",
      "Skills to add for a paid internship",
    ],
    []
  );

  useEffect(() => {
    const el = scrollerRef.current;
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
      console.error("AI error:", err);
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
        wm-chat
        w-full max-h-[78vh] md:max-h-[82vh]
        rounded-[24px] border border-card-border shadow-xl
        overflow-hidden flex flex-col bg-neutral-950
      "
    >
      {/* HEADER (gradient + rounded top) */}
      <div
        className="
          wm-header
          px-4 md:px-5 py-4 text-white rounded-t-[24px]
          bg-[linear-gradient(105deg,#6D6AFF_0%,#8B5CF6_48%,#EC4899_100%)]
          border-b border-white/10
        "
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 border border-white/25">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight">Resume Chat</div>
              <div className="text-[11px] opacity-95">
                AI Assistant for {profile?.name?.split(" ")[0] || "you"}
              </div>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center text-[10px] px-2 py-1 rounded-full bg-white/15 border border-white/25">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Resume-aware
          </span>
        </div>

        {messages.length <= 1 && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-white/95">
            <FileText className="w-4 h-4" />
            Upload your resume on the left to unlock tailored answers.
          </div>
        )}
      </div>

      {/* FAQ PILLS (rounded) */}
      <div className="wm-faqs px-3 sm:px-4 py-2 sm:py-3 bg-neutral-900">
        <div className="flex flex-wrap gap-2">
          {faqs.map((q) => (
            <button
              key={q}
              onClick={() => handleQuickAsk(q)}
              className="
                wm-pill
                text-xs sm:text-[13px] px-3 py-1.5
                rounded-full bg-neutral-800 hover:bg-neutral-700
                border border-white/10 text-white/95 transition active:scale-[.98]
                shadow-[inset_0_1px_0_rgba(255,255,255,.08)]
              "
            >
              <Sparkles className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" />
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* FEED (rounded bubbles) */}
      <div
        ref={scrollerRef}
        className="
          wm-feed chat-scrollbar flex-1 overflow-y-auto
          px-3 sm:px-4 py-3 sm:py-4 space-y-3 bg-neutral-950
        "
      >
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={[
              "wm-bubble max-w-[92%] px-4 py-3 leading-relaxed rounded-2xl border",
              m.isUser
                ? "user ml-auto bg-indigo-600 text-white border-indigo-400/30 shadow"
                : "bot bg-neutral-100 text-neutral-900 border-neutral-200 shadow",
            ].join(" ")}
          >
            <span className="whitespace-pre-line">{m.text}</span>
          </motion.div>
        ))}

        {isLoading && (
          <div className="wm-bubble bot max-w-[70%] px-4 py-3 rounded-2xl bg-neutral-100 border border-neutral-200 text-neutral-900">
            <div className="flex items-center gap-1 opacity-70">
              <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:.1s]" />
              <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:.2s]" />
            </div>
          </div>
        )}
      </div>

      {/* INPUT GROUP (rounded pill + round send) */}
      <div className="wm-inputbar sticky bottom-0 px-3 sm:px-4 py-3 sm:py-4 bg-neutral-900 border-t border-white/10">
        <div
          className="
            flex items-center gap-2
            rounded-full bg-black/20 border border-white/10
            px-3 py-2
          "
        >
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about resume fixes, roles, or skill gaps…"
            disabled={isLoading}
            className="
              wm-input
              flex-1 bg-transparent border-0 shadow-none focus-visible:ring-0
              text-sm text-white placeholder:text-white/50
            "
            aria-label="Message input"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !inputText.trim()}
            className="
              wm-send
              rounded-full w-11 h-11 p-0
              text-white
              bg-[linear-gradient(95deg,#6D6AFF_0%,#8B5CF6_50%,#EC4899_100%)]
              shadow-md hover:shadow-lg active:scale-[.98]
            "
            aria-label="Send message"
            title="Send"
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
}
