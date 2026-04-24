import { describe, expect, it, vi, afterEach } from "vitest";
import {
  assertRegistryVersionInstallable,
  getRegistryArtifactUrl,
  getRegistryPackageUrl,
  isRegistryPackageName,
} from "../src/registry.js";

describe("registry package helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds canonical URLs for unscoped and scoped packages", () => {
    vi.stubEnv("USEAGENTS_REGISTRY", "https://registry.example/v1");

    expect(getRegistryPackageUrl("hello-world")).toBe("https://registry.example/v1/agents/hello-world");
    expect(getRegistryPackageUrl("@seth/hello-world")).toBe("https://registry.example/v1/packages/%40seth/hello-world");
    expect(getRegistryArtifactUrl("@seth/hello-world", "1.0.0", "tarball")).toBe(
      "https://registry.example/v1/packages/%40seth/hello-world/1.0.0/tarball"
    );
  });

  it("recognizes scoped registry names without treating arbitrary paths as packages", () => {
    expect(isRegistryPackageName("@seth/hello-world")).toBe(true);
    expect(isRegistryPackageName("hello-world")).toBe(true);
    expect(isRegistryPackageName("./hello-world")).toBe(false);
    expect(isRegistryPackageName("github:owner/repo")).toBe(false);
  });

  it("blocks quarantined and yanked registry installs", () => {
    const agent = {
      name: "@seth/hello-world",
      type: "direct-agent" as const,
      description: "test",
      author: "seth",
      latest: "1.0.0",
      status: "active" as const,
      versions: {},
    };

    expect(() => assertRegistryVersionInstallable(agent, {
      manifestUrl: "",
      tarballUrl: "",
      publishedAt: "",
      status: "yanked",
    }, "1.0.0")).toThrow(/not installable/);
  });
});
