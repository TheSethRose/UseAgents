import { describe, expect, it } from "vitest";
import { resolveLocalSourcePath } from "../src/commands/install.js";

describe("resolveLocalSourcePath", () => {
  it("resolves the openclaw alias to the repo example path", async () => {
    await expect(resolveLocalSourcePath("openclaw")).resolves.toMatch(/examples[\/\\]openclaw$/);
  });
});