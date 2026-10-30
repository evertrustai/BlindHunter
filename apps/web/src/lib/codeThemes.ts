/**
 * Code-appearance themes (syntax highlighting palettes), like Claude Code's.
 * Each theme is just a set of CSS custom properties that the `.hljs-*` token
 * classes read (see the mapping in app.css). Switching a theme = setting these
 * vars on an element (`:root` for the live viewer, or a card for a preview).
 */
export interface CodeTheme {
  id: string
  name: string
  vars: Record<string, string>
}

// Palette order: bg, fg, comment, keyword, string, number, type, func, attr, tag, meta
const KEYS = [
  'ct-bg',
  'ct-fg',
  'ct-comment',
  'ct-keyword',
  'ct-string',
  'ct-number',
  'ct-type',
  'ct-func',
  'ct-attr',
  'ct-tag',
  'ct-meta',
] as const

function mk(id: string, name: string, c: string[]): CodeTheme {
  const vars: Record<string, string> = {}
  KEYS.forEach((k, i) => (vars[k] = c[i]))
  return { id, name, vars }
}

export const LIGHT_THEMES: CodeTheme[] = [
  mk('claude-light', 'Claude Light', ['#f7f6f1', '#37352f', '#a39f94', '#b24a2e', '#5c7a3f', '#9a6a2e', '#2e6a7a', '#8a5a1e', '#6a6256', '#b24a2e', '#a39f94']),
  mk('github-light', 'GitHub Light', ['#ffffff', '#24292e', '#6a737d', '#d73a49', '#032f62', '#005cc5', '#6f42c1', '#6f42c1', '#005cc5', '#22863a', '#6a737d']),
  mk('pierre-light', 'Pierre Light', ['#fcfcfc', '#3a3a3a', '#a0a0a0', '#8250df', '#0a7d4f', '#b5520a', '#0a6ebd', '#b5520a', '#0a6ebd', '#8250df', '#a0a0a0']),
  mk('vscode-light', 'VS Code Light', ['#ffffff', '#000000', '#008000', '#0000ff', '#a31515', '#098658', '#267f99', '#795e26', '#e50000', '#800000', '#808080']),
  mk('one-light', 'One Light', ['#fafafa', '#383a42', '#a0a1a7', '#a626a4', '#50a14f', '#986801', '#c18401', '#4078f2', '#986801', '#e45649', '#a0a1a7']),
  mk('catppuccin-latte', 'Catppuccin Latte', ['#eff1f5', '#4c4f69', '#8c8fa1', '#8839ef', '#40a02b', '#fe640b', '#df8e1d', '#1e66f5', '#ea76cb', '#d20f39', '#dc8a78']),
  mk('solarized-light', 'Solarized Light', ['#fdf6e3', '#657b83', '#93a1a1', '#859900', '#2aa198', '#d33682', '#b58900', '#268bd2', '#268bd2', '#268bd2', '#93a1a1']),
  mk('vitesse-light', 'Vitesse Light', ['#ffffff', '#393a34', '#a0ada0', '#ab5959', '#b56959', '#2f798a', '#2e808f', '#59873a', '#b07d48', '#1e754f', '#a0ada0']),
  mk('min-light', 'Min Light', ['#ffffff', '#212121', '#aaaaaa', '#1976d2', '#22863a', '#1976d2', '#6f42c1', '#6f42c1', '#22863a', '#1976d2', '#aaaaaa']),
  mk('rose-pine-dawn', 'Rosé Pine Dawn', ['#faf4ed', '#575279', '#9893a5', '#286983', '#ea9d34', '#d7827e', '#56949f', '#d7827e', '#907aa9', '#b4637a', '#9893a5']),
  mk('slack-ochin', 'Slack Ochin', ['#fbfbfb', '#383838', '#adadad', '#0b6e99', '#297a3a', '#b5330a', '#a5370a', '#7b43bb', '#297a3a', '#0b6e99', '#adadad']),
]

export const DARK_THEMES: CodeTheme[] = [
  mk('claude-dark', 'Claude Dark', ['#1f1e1c', '#e5e2d9', '#8a8578', '#d97757', '#a1b56c', '#e0a458', '#7fb3c9', '#e0a458', '#c8a97e', '#d97757', '#8a8578']),
  mk('github-dark', 'GitHub Dark', ['#0d1117', '#c9d1d9', '#8b949e', '#ff7b72', '#a5d6ff', '#79c0ff', '#ffa657', '#d2a8ff', '#79c0ff', '#7ee787', '#8b949e']),
  mk('github-dark-dimmed', 'GitHub Dark Dimmed', ['#22272e', '#adbac7', '#768390', '#f47067', '#96d0ff', '#6cb6ff', '#f69d50', '#dcbdfb', '#6cb6ff', '#8ddb8c', '#768390']),
  mk('pierre-dark', 'Pierre Dark', ['#161616', '#cdcdcd', '#6b6b6b', '#b392f0', '#7ec98f', '#e0a05a', '#5fb3c9', '#e0a05a', '#5fb3c9', '#b392f0', '#6b6b6b']),
  mk('vscode-dark', 'VS Code Dark', ['#1e1e1e', '#d4d4d4', '#6a9955', '#569cd6', '#ce9178', '#b5cea8', '#4ec9b0', '#dcdcaa', '#9cdcfe', '#569cd6', '#808080']),
  mk('one-dark-pro', 'One Dark Pro', ['#282c34', '#abb2bf', '#5c6370', '#c678dd', '#98c379', '#d19a66', '#e5c07b', '#61afef', '#d19a66', '#e06c75', '#5c6370']),
  mk('dracula', 'Dracula', ['#282a36', '#f8f8f2', '#6272a4', '#ff79c6', '#f1fa8c', '#bd93f9', '#8be9fd', '#50fa7b', '#50fa7b', '#ff79c6', '#6272a4']),
  mk('dracula-soft', 'Dracula Soft', ['#282a36', '#e6e6e0', '#6c7393', '#d08fc0', '#e2e68a', '#b89ad8', '#92d8e0', '#68c488', '#68c488', '#d08fc0', '#6c7393']),
  mk('catppuccin-mocha', 'Catppuccin Mocha', ['#1e1e2e', '#cdd6f4', '#6c7086', '#cba6f7', '#a6e3a1', '#fab387', '#f9e2af', '#89b4fa', '#f38ba8', '#f38ba8', '#f5e0dc']),
  mk('nord', 'Nord', ['#2e3440', '#d8dee9', '#616e88', '#81a1c1', '#a3be8c', '#b48ead', '#8fbcbb', '#88c0d0', '#8fbcbb', '#81a1c1', '#616e88']),
  mk('solarized-dark', 'Solarized Dark', ['#002b36', '#839496', '#586e75', '#859900', '#2aa198', '#d33682', '#b58900', '#268bd2', '#268bd2', '#268bd2', '#586e75']),
  mk('vitesse-dark', 'Vitesse Dark', ['#121212', '#dbd7ca', '#758575', '#cb7676', '#c98a7d', '#4d9375', '#5da994', '#80a665', '#bd976a', '#4d9375', '#758575']),
  mk('min-dark', 'Min Dark', ['#1f1f1f', '#b9b9b9', '#6a6a6a', '#6cb6ff', '#8ddb8c', '#6cb6ff', '#dcbdfb', '#dcbdfb', '#8ddb8c', '#6cb6ff', '#6a6a6a']),
  mk('monokai', 'Monokai', ['#272822', '#f8f8f2', '#75715e', '#f92672', '#e6db74', '#ae81ff', '#66d9ef', '#a6e22e', '#a6e22e', '#f92672', '#75715e']),
  mk('tokyo-night', 'Tokyo Night', ['#1a1b26', '#a9b1d6', '#565f89', '#bb9af7', '#9ece6a', '#ff9e64', '#2ac3de', '#7aa2f7', '#73daca', '#f7768e', '#565f89']),
  mk('night-owl', 'Night Owl', ['#011627', '#d6deeb', '#637777', '#c792ea', '#ecc48d', '#f78c6c', '#ffcb8b', '#82aaff', '#addb67', '#7fdbca', '#637777']),
  mk('rose-pine', 'Rosé Pine', ['#191724', '#e0def4', '#6e6a86', '#31748f', '#f6c177', '#eb6f92', '#9ccfd8', '#ebbcba', '#c4a7e7', '#eb6f92', '#6e6a86']),
  mk('ayu-dark', 'Ayu Dark', ['#0b0e14', '#bfbdb6', '#565b66', '#ff8f40', '#aad94c', '#d2a6ff', '#59c2ff', '#ffb454', '#ffb454', '#39bae6', '#565b66']),
  mk('slack-dark', 'Slack Dark', ['#1a1d21', '#d1d2d3', '#6b6d70', '#a688fa', '#6ec07c', '#e8912d', '#e8912d', '#6aa0f7', '#6ec07c', '#a688fa', '#6b6d70']),
]

export const DEFAULT_LIGHT = 'github-light'
export const DEFAULT_DARK = 'github-dark'

const BY_ID = new Map([...LIGHT_THEMES, ...DARK_THEMES].map((t) => [t.id, t]))
export function getCodeTheme(id: string | null | undefined): CodeTheme {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_DARK)!
}

/** CSS inline-style object for a theme's vars (for a preview card). */
export function themeStyle(t: CodeTheme): Record<string, string> {
  const s: Record<string, string> = {}
  for (const [k, v] of Object.entries(t.vars)) s[`--${k}`] = v
  return s
}
