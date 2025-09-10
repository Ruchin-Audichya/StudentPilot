import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Send,
  Sparkles,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { streamChat } from "@/services/chatStream";
import MarkdownMessage from "./MarkdownMessage";
import StructuredAnswer from "./chat/StructuredAnswer";
import FAQPills from "./chat/FAQPills";
// Removed unused Message component import to avoid name collision
import ChatInput from "./chat/ChatInput";
import { FREE_MODELS } from "@/constants/models";
import ResumeBadge from "./chat/ResumeBadge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
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
  resumeUploaded: boolean;
}

export default function ChatWidget({
  profile,
  resumeUploaded,
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: crypto.randomUUID(),
      text:
        `Hey ${profile?.name?.split(" ")[0] || "there"}! I’m your AI Career Copilot 🚀\n\n` +
        `Upload your resume to get tailored:\n` +
        `✅ Top resume fixes\n` +
        `✅ Best-fit internships\n` +
        `✅ Mock interview practice\n` +
        `✅ Upcoming events radar\n\n` +
        `Ask me anything about jobs, skills, or applications!`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const abortController = useRef<AbortController | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState<string>(
    FREE_MODELS.find(m => m.id === "deepseek/deepseek-chat-v3-0324:free")?.id || FREE_MODELS[0].id
  );

  const faqs = useMemo(
    () => [
      "Rate my resume & top 3 fixes",
      "What roles fit my skills right now?",
      "Skills to add for a paid internship",
    ],
    []
  );

  useEffect(() => {
    // Show welcome message only once per browser
    if (!localStorage.getItem("wm.welcomeShown.v1")) {
      setMessages([
        {
          id: crypto.randomUUID(),
          text:
            `Hey ${profile?.name?.split(" ")[0] || "there"}! I’m your AI Career Copilot 🚀\n\n` +
            `Upload your resume to get tailored:\n` +
            `✅ Top resume fixes\n` +
            `✅ Best-fit internships\n` +
            `✅ Mock interview practice\n` +
            `✅ Upcoming events radar\n\n` +
            `Ask me anything about jobs, skills, or applications!`,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
      localStorage.setItem("wm.welcomeShown.v1", "1");
    }
  }, [profile?.name]);

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
      const stream = streamChat({
        message: text,
        model: selectedModel.trim(),
        signal: abortController.current.signal,
      });
      for await (const token of stream) {
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
            ? {
                ...m,
                text: "❌ I’m having trouble right now—please try again in a moment.",
              }
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
      className="wm-chat w-full max-h-[78vh] md:max-h-[86vh] md:text-[15px] leading-relaxed rounded-[24px] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Ambient backdrop for blur (behind all glass) */}
      <div className="wm-ambient" aria-hidden />

      {/* HEADER — premium glass */}
      <div
        className="wm-header glass px-4 md:px-5 py-4 text-white rounded-t-[24px]"
        style={{ zIndex: 1 }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 border border-white/25">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight">Internship Copilot</div>
              <div className="text-[11px] opacity-95">
                AI Assistant for {nameFirst}
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="rounded-full px-3 py-1 bg-white/10 border border-white/20 text-white/80 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              style={{ minWidth: 160 }}
            >
              {FREE_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-black text-white">
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {messages.length <= 1 && (
          <div className="mt-3 flex items-center gap-3 text-[12px] text-white/95 flex-wrap">
            <span className="inline-flex items-center gap-1"><FileText className="w-4 h-4" /> Resume</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Skills</span>
            <span className="inline-flex items-center gap-1"><Sparkles className="w-4 h-4" /> Interview</span>
            <span className="inline-flex items-center gap-1"><MessageCircle className="w-4 h-4" /> Events</span>
          </div>
        )}
      </div>

      {/* FAQ pills (matte) */}
      <div
        className="wm-faqs px-3 sm:px-4 py-2 sm:py-3"
        style={{ zIndex: 1 }}
      >
        <FAQPills items={faqs} onPick={handleQuickAsk} />
      </div>

      {/* FEED — glass bubbles */}
      <ScrollArea className="flex-1 px-3 sm:px-4 py-3 sm:py-4">
        <div
          ref={scrollerRef}
          className="wm-feed chat-scrollbar space-y-3 [overscroll-behavior:contain]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className={`flex items-start gap-2 ${m.isUser ? 'justify-end' : 'justify-start'}`}>
              {!m.isUser && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/15 border border-white/25 flex items-center justify-center mt-1">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}
              <div className={
                m.isUser
                  ? "wm-bubble user bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[14px] md:text-[15px] px-4 py-3 rounded-2xl shadow-lg max-w-[85%]"
                  : "wm-bubble bot text-[15px] md:text-[16px] leading-relaxed px-4 py-3 rounded-2xl shadow-md max-w-[85%]"
              }>
                {m.isUser ? (
                  <MarkdownMessage text={m.text} />
                ) : (
                  <StructuredAnswer text={m.text} />
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/15 border border-white/25 flex items-center justify-center mt-1">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="wm-bubble bot max-w-[70%] px-4 py-3 text-[14px] md:text-[15px]">
              <div className="flex items-center gap-1 opacity-70">
                <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:.1s]" />
                <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:.2s]" />
              </div>
            </div>
          </div>
        )}
        </div>
      </ScrollArea>

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
