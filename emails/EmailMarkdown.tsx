import { Heading, Link, Section, Text } from "@react-email/components";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function EmailMarkdown({ content }: { content: string }) {
    return (
        <Section>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <Heading as="h1" className="my-3 text-[28px] font-bold leading-[32px]">
                            {children}
                        </Heading>
                    ),
                    h2: ({ children }) => (
                        <Heading as="h2" className="my-3 text-[22px] font-bold leading-[28px]">
                            {children}
                        </Heading>
                    ),
                    h3: ({ children }) => (
                        <Heading as="h3" className="my-3 text-[18px] font-bold leading-[24px]">
                            {children}
                        </Heading>
                    ),
                    p: ({ children }) => <Text className="my-3 text-[16px] leading-[24px] text-black">{children}</Text>,
                    ul: ({ children }) => <ul style={{ margin: "12px 0", paddingLeft: "24px" }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ margin: "12px 0", paddingLeft: "24px" }}>{children}</ol>,
                    li: ({ children }) => <li style={{ marginBottom: "6px", fontSize: "16px", lineHeight: "24px" }}>{children}</li>,
                    blockquote: ({ children }) => (
                        <blockquote style={{ margin: "12px 0", paddingLeft: "16px", borderLeft: "3px solid #d1d5db", color: "#4b5563", fontStyle: "italic" }}>{children}</blockquote>
                    ),
                    a: ({ children, href }) => (
                        <Link href={href} className="text-blue-600 underline">
                            {children}
                        </Link>
                    ),
                    code: ({ children, className }) => {
                        const isInline = !className;

                        if (isInline) {
                            return <code style={{ backgroundColor: "#f3f4f6", borderRadius: "4px", padding: "2px 4px" }}>{children}</code>;
                        }

                        return (
                            <code
                                style={{
                                    display: "block",
                                    overflowX: "auto",
                                    backgroundColor: "#f3f4f6",
                                    borderRadius: "6px",
                                    padding: "12px",
                                    fontSize: "12px",
                                    lineHeight: "20px",
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => <Section style={{ margin: "12px 0" }}>{children}</Section>,
                    hr: () => <hr style={{ margin: "16px 0", borderColor: "#e5e7eb" }} />,
                }}
            >
                {content}
            </ReactMarkdown>
        </Section>
    );
}
