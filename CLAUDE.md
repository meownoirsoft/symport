# Claude Code — Project Rules

## Code editing

**Never use smart/curly quotes in source files.** Always use straight ASCII double quotes (`"`) and single quotes (`'`). Curly quotes (U+201C `"`, U+201D `"`, U+2018 `'`, U+2019 `'`) break TypeScript and JavaScript parsers (including Turbopack/SWC) and are invisible to the eye. If a file is found to contain them, replace all occurrences with their ASCII equivalents before continuing.
