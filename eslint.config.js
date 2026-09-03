// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      // Generated. Regenerate, never edit.
      'packages/taxonomy/src/generated.ts',
      'packages/types/src/api.generated.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,

  // -----------------------------------------------------------------------
  // Rules that apply everywhere.
  // -----------------------------------------------------------------------
  {
    rules: {
      // `any` defeats every validation boundary Mira has (AI-2, AI-7).
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // docs/08-engineering/coding-standards.md — Error handling
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  // -----------------------------------------------------------------------
  // Type-aware linting — TypeScript sources only.
  // -----------------------------------------------------------------------
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: {
          // Config files live outside every tsconfig `include`.
          allowDefaultProject: ['*.config.ts', '*/*.config.ts', '*/*/*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // docs/08-engineering/coding-standards.md — Async
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // -----------------------------------------------------------------------
  // Never swallow an error (docs/08-engineering/coding-standards.md).
  // -----------------------------------------------------------------------
  {
    files: ['apps/**/*.ts', 'packages/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CatchClause > BlockStatement:not(:has(*))',
          message:
            'Never swallow an error. Handle it, or let it propagate to a boundary that does.',
        },
      ],
    },
  },

  // -----------------------------------------------------------------------
  // Design system enforcement (docs/02-design/design-system.md §10).
  //
  // Components read tokens. Feature code contains NO literal colour values.
  // This is what keeps a dark-mode swap a one-file change, and it is the exit
  // criterion for task 0.7.
  // -----------------------------------------------------------------------
  {
    files: ['apps/mobile/**/*.{ts,tsx}', 'packages/ui/src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message:
            'No literal hex colours in feature code. Import a token from @mira/ui (docs/02-design/design-system.md §10).',
        },
        {
          selector: 'Literal[value=/^rgba?\\(/]',
          message:
            'No literal rgb/rgba colours in feature code. Import a token from @mira/ui (docs/02-design/design-system.md §10).',
        },
      ],
    },
  },

  // Tokens and contrast maths are the one place literal colours belong.
  {
    files: ['packages/ui/src/tokens.ts', 'packages/ui/src/contrast.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // -----------------------------------------------------------------------
  // Plain JS: config files and scripts. No type information available.
  // -----------------------------------------------------------------------
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },

  // Compile-time type tests deliberately declare unused, erroring bindings.
  {
    files: ['**/type-tests.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },

  // Tests may reach for narrower types when asserting rejection paths.
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-syntax': 'off',
      'no-console': 'off',
    },
  },
);
