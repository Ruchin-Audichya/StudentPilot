import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "@/styles/markdown.css";

export default function MarkdownMessage({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: (props) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
        strong: (props) => <strong style={{ fontWeight: 600 }} {...props} />,
        h2: (props) => (
          <h2 style={{ marginTop: "0.5rem", fontWeight: 700 }} {...props} />
        ),
        h3: (props) => (
          <h3 style={{ marginTop: "0.5rem", fontWeight: 700 }} {...props} />
        ),
        li: (props) => <li style={{ margin: "0.12rem 0" }} {...props} />,
        code: (props) => (
          <code
            style={{
              background: "rgba(255,255,255,0.08)",
              padding: ".08rem .28rem",
              borderRadius: "4px",
              fontSize: ".86em",
            }}
            {...props}
          />
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
