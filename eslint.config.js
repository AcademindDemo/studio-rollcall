import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"

const testModifiers = "/^(skip|only|todo|skipIf|runIf|fails)$/"

export default defineConfig(
  { ignores: ["node_modules/**"] },
  // `// eslint-disable` comments are ignored: fix the code or change this file in review.
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" } },
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: {
      projectService: { allowDefaultProject: ["eslint.config.js"] },
      tsconfigRootDir: import.meta.dirname
    } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": ["error", {
        "ts-ignore": true,
        "ts-nocheck": true,
        "ts-expect-error": true,
        "ts-check": false
      }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "no-console": "error",
      "no-debugger": "error",
      "no-restricted-syntax": ["error",
        { selector: "ThrowStatement", message: "Fail with a Schema.TaggedError (`return yield* new MyError(...)`) so the error is in the type." },
        { selector: "TryStatement", message: "Use Effect.try / Effect.tryPromise and typed errors instead of try/catch." },
        { selector: "TSEnumDeclaration", message: "Use Schema.Literals instead of enums." },
        { selector: `MemberExpression[property.name=${testModifiers}]`, message: "No skipped, focused or todo tests. Fix or delete the test." }
      ],
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["zod", "io-ts", "yup"], message: "Use effect/Schema for all input validation." }]
      }],
      // Effect.gen generators may legitimately not yield, and Effect APIs return objects with methods.
      "require-yield": "off",
      "@typescript-eslint/unbound-method": "off"
    }
  },
  {
    files: ["src/api/**", "src/domain/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/server/**", "@effect/platform-node", "node:*"], message: "src/api and src/domain are shared with clients: no server or Node imports." },
          { group: ["zod", "io-ts", "yup"], message: "Use effect/Schema for all input validation." }
        ]
      }]
    }
  }
)
