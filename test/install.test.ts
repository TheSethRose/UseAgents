import { describe, it } from "vitest";
import { resolveLocalSourcePath } from "../src/commands/install.js";

describe("resolveLocalSourcePath", () => {
  it("passes", async () => {
    await resolveLocalSourcePath("nonexistent");
  });
});
