# @dograh/embed-types

Shared TypeScript types for `window.DograhWidget` and the `@dograh/embed-react` SDK.

Use this package when you want typed embed APIs without pulling in React.

```bash
npm install @dograh/embed-types
```

```typescript
import type { DograhWidgetAPI, ToolInvokeRequestPayload } from "@dograh/embed-types";

declare global {
  interface Window {
    DograhWidget: DograhWidgetAPI;
  }
}
```
