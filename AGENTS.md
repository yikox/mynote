# Agent Guidelines for zynode

## Build & Test Commands

### Build
```bash
# Build the project
npm run build

# Watch mode for development
npm run dev
```

### Linting & Formatting
```bash
# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code
npm run format
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a single test file
npm test -- path/to/test.spec.ts

# Run a specific test by name
npm test -- -t "test name"

# Run tests with coverage
npm test -- --coverage
```

## Code Style Guidelines

### Imports
- Use absolute imports from project root when available
- Group imports: external libs → internal modules → types
- Keep imports sorted alphabetically within groups

### Formatting
- Use Prettier for consistent formatting
- Indentation: 2 spaces
- Semicolons: required
- Quotes: single quotes for strings, double for JSX
- Trailing commas: always for multi-line structures

### Types
- Prefer explicit type annotations for function parameters and return types
- Use `interface` for object shapes, `type` for unions/generics
- Avoid `any` - use `unknown` or specific types instead
- Leverage type inference for internal variables

### Naming Conventions
- **Files**: kebab-case for components and utilities
  - `user-profile.tsx`, `api-helpers.ts`
- **Components**: PascalCase
  - `UserProfile`, `DataTable`
- **Functions/Variables**: camelCase
  - `getUserData`, `apiUrl`
- **Constants**: UPPER_SNAKE_CASE
  - `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT`
- **Types/Interfaces**: PascalCase
  - `UserProps`, `ApiResponse`
- **Private members**: underscore prefix
  - `_internalMethod`, `_cache`

### Error Handling
- Always handle async errors with try/catch or .catch()
- Provide meaningful error messages with context
- Log errors appropriately (console for dev, proper logging for prod)
- Use custom error types for domain-specific errors
- Never silently swallow errors unless explicitly documented

### Comments
- Document public APIs with JSDoc comments
- Add inline comments for complex logic only
- Keep comments up-to-date with code changes
- Prefer self-documenting code over comments

### General Practices
- Keep functions small and focused (≤ 20 lines when possible)
- Prefer composition over inheritance
- Write meaningful commit messages
- Follow existing patterns in the codebase
- Add tests for new features and bug fixes
- Keep dependencies minimal and up-to-date

## Project Structure
```
zynode/
├── src/
│   ├── components/    # Reusable UI components
│   ├── lib/           # Utility functions
│   ├── types/         # TypeScript type definitions
│   └── index.ts       # Main entry point
├── tests/             # Test files
└── docs/              # Additional documentation
```

## Development Workflow
1. Create feature branch from main
2. Make changes following style guidelines
3. Run lint and tests before committing
4. Write tests for new functionality
5. Ensure all tests pass before submitting PR
