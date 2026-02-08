# Testing Setup for RAS-29

## Current Status

Unit tests have been written for the following components:
- `/src/lib/error-handling.test.ts` - Error message transformation tests
- `/src/components/search/ResultItem.test.tsx` - Result item component tests
- `/src/components/ui/error-alert.test.tsx` - Error alert component tests

## Test Framework Setup Required

The project currently does not have a test framework configured. To run these tests, you'll need to:

### 1. Install Testing Dependencies

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### 2. Add Vitest Configuration

Create `vite.config.ts` with test configuration:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
```

### 3. Create Test Setup File

Create `/src/test/setup.ts`:

```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
```

### 4. Update package.json

Add test script to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### 5. Run Tests

```bash
npm test
```

## Test Coverage

Current test coverage includes:
- Error handling utilities (all status codes, network errors, timeouts)
- Result item components (rendering, click handlers, selected state, ARIA attributes)
- Error alert component (rendering, ARIA attributes)

## Future Testing

Additional tests should be added for:
- `ResultsDropdown` component (keyboard navigation, error display, result selection)
- `AddressSearchPage` component (full integration tests with keyboard navigation)
- `SearchInput` component (debouncing, ARIA attributes)
