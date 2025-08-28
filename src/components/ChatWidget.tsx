import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, Sparkles, ShieldCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { streamChat } from "@/services/chatStream";
import MarkdownMessage from "./MarkdownMessage";
import FAQPills from "./chat/FAQPills";
import Message from "./chat/Message";
import ChatInput from "./chat/ChatInput";
import ResumeBadge from "./chat/ResumeBadge";
import ProfileChips from "./chat/ProfileChips";
import { FREE_MODELS } from "@/constants/models";

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
  const abortController = useRef<AbortController | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState(FREE_MODELS[0].id);

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
    abortController.current = new AbortController();
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, text: "", isUser: false, timestamp: new Date() },
    ]);
    try {
      const userAndHistory = [
        ...messages.map((m) => ({
          role: m.isUser ? "user" as "user" : "assistant" as "assistant",
          content: m.text
        })),
        { role: "user" as "user", content: text },
      ];
      const stream = streamChat({
        model: selectedModel,
        messages: userAndHistory,
        signal: abortController.current.signal,
      });
      for await (const token of await stream) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: m.text + token } : m
          )
        );
      }
    } catch (err) {
      console.error("AI error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: "❌ I’m having trouble right now—please try again in a moment." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      abortController.current = null;
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
  // Cancel streaming on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && abortController.current) {
        abortController.current.abort();
        setIsLoading(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleQuickAsk = async (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, isUser: true, timestamp: new Date() },
    ]);
    await sendToAI(text);
  };

  const nameFirst = (profile?.name || "you").split(" ")[0];

  return (
    <div
      className="
        wm-chat
        w-full max-h-[78vh] md:max-h-[82vh]
        rounded-[24px] border border-white/10 shadow-2xl
        overflow-hidden flex flex-col
      "
    >
      {/* Ambient backdrop for blur (behind all glass) */}
      <div className="wm-ambient" aria-hidden />

      {/* HEADER — premium glass */}
      <div className="wm-header glass px-4 md:px-5 py-4 text-white rounded-t-[24px]" style={{ zIndex: 1 }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 border border-white/25">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight">Resume Chat</div>
              <div className="text-[11px] opacity-95">AI Assistant for {nameFirst}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 md:gap-3 md:flex-row md:items-center">
            <ResumeBadge uploaded={true} />
            <ProfileChips skills={profile.skills} year={profile.year} />
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="rounded-full px-3 py-1 bg-white/10 border border-white/20 text-white/80 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              style={{ minWidth: 160 }}
            >
              {FREE_MODELS.map(m => (
                <option key={m.id} value={m.id} className="bg-black text-white">
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {messages.length <= 1 && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-white/95">
            <FileText className="w-4 h-4" />
            Upload your resume on the left to unlock tailored answers.
          </div>
        )}
      </div>

      {/* FAQ pills (matte) */}
      <div className="wm-faqs px-3 sm:px-4 py-2 sm:py-3" style={{ zIndex: 1 }}>
        <FAQPills items={faqs} onPick={handleQuickAsk} />
      </div>

      {/* FEED — glass bubbles */}
      <div
        ref={scrollerRef}
        className="wm-feed chat-scrollbar flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3"
      >
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Message text={m.text} isUser={m.isUser} />
          </motion.div>
        ))}
        {isLoading && (
          <div className="wm-bubble bot max-w-[70%] px-4 py-3">
            <div className="flex items-center gap-1 opacity-70">
              <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:.1s]" />
              <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:.2s]" />
            </div>
          </div>
        )}
      </div>

      {/* INPUT — glass pill + circular gradient send (text always visible) */}
      <ChatInput
        value={inputText}
        onChange={setInputText}
        onSend={handleSend}
        disabled={isLoading}
      />
    </div>
  );
}
