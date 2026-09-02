import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeMarkdown } from "@/components/safe-markdown";

describe("SafeMarkdown", () => {
  it("renders structured interview answers", () => {
    render(<SafeMarkdown>{`# Answer\n\n1. **Controller** handles requests.\n2. *Service* contains logic.\n\nUse \`@RestController\`.\n\n\`\`\`java\nreturn service.find();\n\`\`\``}</SafeMarkdown>);
    expect(screen.getByRole("heading", { name: "Answer" })).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("Controller").tagName).toBe("STRONG");
    expect(screen.getByText("Service").tagName).toBe("EM");
    expect(screen.getByText("@RestController").tagName).toBe("CODE");
    expect(screen.getByText("return service.find();").tagName).toBe("CODE");
  });

  it("keeps HTTPS links safe for a new tab", () => {
    render(<SafeMarkdown>{"[Spring](https://spring.io)"}</SafeMarkdown>);
    const link = screen.getByRole("link", { name: "Spring" });
    expect(link).toHaveAttribute("href", "https://spring.io");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("removes unsafe link protocols and raw HTML", () => {
    render(<SafeMarkdown>{"[Unsafe](javascript:alert(1)) <script>alert('xss')</script>"}</SafeMarkdown>);
    expect(screen.queryByRole("link", { name: "Unsafe" })).not.toBeInTheDocument();
    expect(document.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByText("alert('xss')")).toBeInTheDocument();
  });
});
