export type WebMcpResult = {
  content: Array<{ type: "text"; text: string }>;
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (
    input: Record<string, unknown>,
    context?: { signal?: AbortSignal },
  ) => Promise<WebMcpResult>;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool(
        tool: WebMcpTool,
        options?: { signal?: AbortSignal },
      ): Promise<void>;
    };
  }
}
