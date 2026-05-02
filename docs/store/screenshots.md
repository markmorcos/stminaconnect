# Store Screenshots — Capture Guide

Three screens × two platforms × three locales = **18 base screenshots**. Apply the framing script to produce 18 framed assets ready to upload.

## Required scenes

For each platform / locale, capture these three screens:

1. **Quick Add — mid-fill.** Open Quick Add, fill name + phone, leave the keyboard up. Filename: `01-quick-add.png`.
2. **Check-in roster — mid-toggle.** Open the Check-in roster for an event with at least 8 members visible; toggle 3 of them. Filename: `02-check-in.png`.
3. **Servant Dashboard — with content.** Open the Servant Dashboard with assignments visible and at least one absence alert. Filename: `03-dashboard.png`.

## Capture environment

- **Build**: dev-client build (`eas build --profile development`) connected to a Supabase instance loaded with the realistic seed (5 servants + 20 persons + recent attendance + recent alerts).
- **Theme**: light theme. Set system theme to light before capture.
- **Devices**:
  - iOS: iPhone 14 Pro Max (Simulator). 1290 × 2796 px portrait — Apple's required marketing size.
  - Android: Pixel 6 (Emulator). 1080 × 2400 px portrait — sufficient for Play.
- **Locale**: change device language **and** restart the app each time. iOS: Settings → General → Language & Region. Android: Settings → System → Languages.
- **Time of day, status bar, network**: hide notch indicators / set fake time / clean status bar via the simulator's "Override Status Bar" demo mode where possible.

## Folder layout

```
assets/store/screenshots/
  ios/
    en/  ar/  de/
  android/
    en/  ar/  de/
```

Drop the raw PNGs into the matching folder. Filenames must start with `01-`, `02-`, `03-` so they sort the same way as the store rendering.

## Framing

Run the framer to produce the upload-ready assets:

```bash
bash scripts/screenshot-frame.sh
```

It composites each screenshot onto the brand-color (`#8B1E2D`) backdrop with rounded corners and a soft shadow, and writes results to `assets/store/screenshots-framed/{ios,android}/{en,ar,de}/`. ImageMagick is required (`brew install imagemagick`).

To frame just one platform/locale during iteration:

```bash
bash scripts/screenshot-frame.sh ios en
```

## Future enhancement

For full device-frame mockups (iPhone bezel, Pixel chin, etc.), drop the official Apple/Google device frame PNGs into `assets/store/device-frames/` and extend `frame_one()` in `scripts/screenshot-frame.sh` to composite the screenshot inside the frame before applying the backdrop. Out of scope for v1 launch.
