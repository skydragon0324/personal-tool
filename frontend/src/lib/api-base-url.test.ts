import { apiBaseUrl } from "./api-client";

describe("API base URL", () => {
  const page = { protocol: "https:", hostname: "tasks.example.com" };

  it("uses NEXT_PUBLIC_API_URL when it is set", () => {
    expect(apiBaseUrl("https://api.example.com/", page)).toBe("https://api.example.com");
    expect(apiBaseUrl("  http://10.0.0.5:8000  ", page)).toBe("http://10.0.0.5:8000");
  });

  it("falls back to port 8000 on the page's own host", () => {
    expect(apiBaseUrl(undefined, page)).toBe("https://tasks.example.com:8000");
    expect(apiBaseUrl("", page)).toBe("https://tasks.example.com:8000");
    expect(apiBaseUrl(undefined, undefined)).toBe("http://localhost:8000");
  });
});
