/**
 * Pulls in @testing-library/react-native's global `jest.Matchers` type
 * augmentation (toBeDisabled, toHaveProp, toBeOnTheScreen, etc.) for the
 * TypeScript compiler.
 *
 * Runtime registration already happens via jest.setup.rn.js's
 * `import '@testing-library/react-native/extend-expect'` — but that file
 * is plain JS, outside tsconfig.json's `include`, so `tsc` never sees the
 * global augmentation on its own. This file's only purpose is to be
 * reachable by the TypeScript program so the augmentation applies.
 */
import '@testing-library/react-native/extend-expect';
