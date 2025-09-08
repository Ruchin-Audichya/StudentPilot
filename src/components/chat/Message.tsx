import React from "react";
import MarkdownMessage from "../MarkdownMessage";

interface MessageProps {
  text: string;
  isUser: boolean;
}

const Message: React.FC<MessageProps> = ({ text, isUser }) => (
  <div
    className={[
      "wm-bubble max-w-[92%] px-4 py-3 leading-relaxed",
      isUser ? "user ml-auto" : "bot",
    ].join(" ")}
  >
    <MarkdownMessage text={text} />
  </div>
);

export default Message;
