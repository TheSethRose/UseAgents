import { describe, expect, it } from "vitest";
import { resolveLocalSourcePath } from "../src/commands/install.js";

describe("resolveLocalSourcePath", () => {
  it("resolves the hello-world alias to the repo example path", async () => {
    await expect(resolveLocalSourcePath("hello-world")).resolves.toMatch(/examples[\/\\]hello-world$/);
  });
});