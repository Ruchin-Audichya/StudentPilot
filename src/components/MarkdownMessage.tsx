import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "@/styles/markdown.css";

interface MarkdownMessageProps {
  text: string;
}

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ text }) => (
  <div className="markdown-message">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
        code: ({ node, className, children, ...props }) => (
          <code className={className} {...props}>{children}</code>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
);

export default MarkdownMessage;
