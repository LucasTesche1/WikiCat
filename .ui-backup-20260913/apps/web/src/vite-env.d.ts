/// <reference types="vite/client" />

declare module 'turndown' {
  interface Options {
    headingStyle?: 'setext' | 'atx';
    hr?: string;
    bulletListMarker?: '-' | '+' | '*';
    codeBlockStyle?: 'indented' | 'fenced';
    fence?: '```' | '~~~';
    emDelimiter?: '_' | '*';
    strongDelimiter?: '__' | '**';
    linkStyle?: 'inlined' | 'referenced';
    linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut';
  }
  class TurndownService {
    constructor(options?: Options);
    use(plugins: unknown): this;
    turndown(html: string): string;
    addRule(name: string, rule: { filter: unknown; replacement: unknown }): this;
  }
  export default TurndownService;
}

declare module 'turndown-plugin-gfm' {
  export const gfm: unknown;
}

declare module 'remark-slug' {
  const plugin: unknown;
  export default plugin;
}

declare module '@tiptap/core' {
  export const Node: any;
  export const mergeAttributes: (...attrs: Record<string, unknown>[]) => Record<string, unknown>;
}
