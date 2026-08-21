import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

const macros = {
  "\\E": "\\mathbb{E}",
  "\\R": "\\mathbb{R}",
  "\\C": "\\mathbb{C}",
  "\\D": "\\mathcal{D}",
  "\\cA": "\\mathcal{A}",
  "\\cC": "\\mathcal{C}",
  "\\SYT": "\\operatorname{SYT}",
  "\\Rem": "\\operatorname{Rem}",
  "\\End": "\\operatorname{End}",
  "\\spanop": "\\operatorname{span}",
  "\\row": "\\operatorname{row}",
  "\\col": "\\operatorname{col}",
  "\\dist": "\\operatorname{dist}",
  "\\norm": "\\lVert #1\\rVert",
  "\\ip": "\\langle #1,#2\\rangle",
};

function normalizeMathDelimiters(markdown: string): string {
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math: string) => `\n$$${math}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math: string) => `$${math}$`);
}
export interface MathMarkdownProps {
  children: string;
  className?: string;
  onStatementReference?: (statementId: string) => void;
}

export function MathMarkdown({
  children,
  className,
  onStatementReference,
}: MathMarkdownProps) {
  const Anchor = ({ href, children: label, ...props }: ComponentPropsWithoutRef<"a">) => {
    const statementId = href?.startsWith("#statement:")
      ? href.slice("#statement:".length)
      : undefined;
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (!statementId || !onStatementReference) return;
      event.preventDefault();
      onStatementReference(statementId);
    };

    return (
      <a
        {...props}
        href={href}
        className={statementId ? "statement-reference" : props.className}
        onClick={handleClick}
      >
        {label}
      </a>
    );
  };

  return (
    <div className={className ? `math-markdown ${className}` : "math-markdown"}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { macros, strict: false, throwOnError: false }]]}
        components={{ a: Anchor }}
      >
        {normalizeMathDelimiters(children)}
      </ReactMarkdown>
    </div>
  );
}
