import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AppBootstrap from "@/components/AppBootstrap";

describe("application startup", () => {
  it("renders the application after it loads", async () => {
    const App = () => <div>Directory loaded</div>;
    render(<AppBootstrap loadApp={() => Promise.resolve({ default: App })} />);

    expect(await screen.findByText("Directory loaded")).toBeInTheDocument();
  });

  it("shows recovery controls when the application import fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<AppBootstrap loadApp={() => Promise.reject(new Error("startup failed"))} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
