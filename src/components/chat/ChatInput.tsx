import React, { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ value, onChange, onSend, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
  <div className="wm-inputbar sticky bottom-0 px-3 sm:px-4 py-3 sm:py-4 safe-bottom">
      <div className="wm-inputwrap flex items-center gap-2 px-3 py-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about resume fixes, roles, or skill gaps…"
          disabled={disabled}
          className="wm-input flex-1 bg-transparent border-0 shadow-none focus-visible:ring-0 text-sm"
          aria-label="Message input"
        />
        <Button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="wm-send w-11 h-11 p-0 text-white active:scale-[.98]"
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
  );
};

export default ChatInput;
