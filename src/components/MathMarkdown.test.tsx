import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MathMarkdown } from "./MathMarkdown";

describe("MathMarkdown", () => {
  it("renders mathematics and routes structured statement references", () => {
    const onReference = vi.fn();
    const { container } = render(
      <MathMarkdown onStatementReference={onReference}>
        {"Use [Definition 2.1](#statement:S02_D01) and $O(\\epsilon^{-2})$ queries."}
      </MathMarkdown>,
    );

    expect(container.querySelector(".katex")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Definition 2.1" }));
    expect(onReference).toHaveBeenCalledWith("S02_D01");
  });
});
