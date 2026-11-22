import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Combobox } from "./Combobox.tsx";
import { zones } from "./stories/data.ts";

it("debug reset", async () => {
  const log: string[] = [];
  const screen = await render(
    <form>
      <Combobox label="Bidding zone" options={zones} name="zone" required defaultValue="NL" />
      <button type="reset">Reset</button>
    </form>,
  );
  const input = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
  const form = input.form!;
  const snap = (label: string) =>
    log.push(
      `${label}: value=${input.value} attr=${input.getAttribute("value")} t=${performance.now().toFixed(0)}`,
    );
  form.addEventListener("reset", () => {
    snap("reset event");
    queueMicrotask(() => snap("microtask after reset"));
    setTimeout(() => snap("timeout 0 after reset"), 0);
    requestAnimationFrame(() => snap("rAF after reset"));
    setTimeout(() => snap("timeout 100 after reset"), 100);
  });
  input.addEventListener("input", () => snap("input event"));
  input.addEventListener("blur", () => snap("blur"));
  await userEvent.keyboard("{Tab}{ArrowDown}{ArrowUp}{Enter}");
  snap("after selecting");
  await screen.getByRole("button", { name: "Reset" }).click();
  snap("after click");
  await new Promise((r) => setTimeout(r, 300));
  snap("after 300 ms");
  snap(`active=${document.activeElement?.tagName}`);
  console.log(`RESET-DEBUG\n${log.join("\n")}`);
  expect(true).toBe(true);
});
