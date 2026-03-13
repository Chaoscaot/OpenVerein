import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
    return (
        <div className={cn("text-sm leading-6 text-foreground", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => <h1 className="mb-3 text-2xl font-semibold last:mb-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="mb-3 text-xl font-semibold last:mb-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="mb-2 text-lg font-semibold last:mb-0">{children}</h3>,
                    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                    blockquote: ({ children }) => <blockquote className="mb-3 border-l-2 border-border pl-4 italic text-muted-foreground last:mb-0">{children}</blockquote>,
                    a: ({ children, href }) => (
                        <a href={href} className="font-medium text-primary underline underline-offset-4">
                            {children}
                        </a>
                    ),
                    code: ({ children, className }) => {
                        const isInline = !className;

                        if (isInline) {
                            return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>;
                        }

                        return <code className={cn("block overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs", className)}>{children}</code>;
                    },
                    pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded-md bg-muted p-3 last:mb-0">{children}</pre>,
                    hr: () => <hr className="my-4 border-border" />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
