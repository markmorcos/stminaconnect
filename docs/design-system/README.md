# Design system — visual baselines

Two screenshots live alongside this file once captured manually:

- `baseline-light.png` — `/dev/showcase` route with theme override `'light'`.
- `baseline-dark.png` — same route with theme override `'dark'`.

## How to (re)capture

1. `npx expo start` and open the app in Expo Go (iOS Simulator or device).
2. From the home screen, **long-press the title** ("St. Mina Connect") to
   open the showcase. The long-press hook is gated on `__DEV__` /
   `EXPO_PUBLIC_SHOW_DEV_TOOLS=true`, so it is hidden in production
   builds.
3. Use the **Theme** chip row at the top to toggle `light` / `dark`.
4. Take a full-screen screenshot at each mode.
5. Save into this folder using the names above and commit the binaries.

These are intended for human-eye review: when a future change touches
tokens or core components, diff the new screenshot against the
committed baseline before merging.
