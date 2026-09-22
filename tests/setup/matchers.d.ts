import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import type { expect } from "bun:test";

declare module "bun:test" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augments Bun's matchers
  interface Matchers<T>
    extends TestingLibraryMatchers<ReturnType<typeof expect.stringContaining>, T> {}
}
