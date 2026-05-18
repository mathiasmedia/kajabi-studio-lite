---
name: Thin client smoke test
description: 2-minute health check after bun update @k-studio-pro/engine or new thin-client setup; diagnostic command + visual checks + common failure recovery
type: reference
---
Full checklist: `thin-client-templates/SMOKE_TEST.md`.

**One-shot diagnostic (paste into thin client):**
```bash
echo "=== engine version ===" && cat node_modules/@k-studio-pro/engine/package.json | grep '"version"'
echo "=== swiper installed ===" && ls node_modules/swiper/package.json 2>&1
echo "=== shadows (must be empty) ===" && ls src/blocks src/engines src/lib/siteDesign src/types 2>&1
echo "=== Tailwind scans engine ===" && grep -n "@k-studio-pro/engine" tailwind.config.ts
echo "=== Auth single-subpath ===" && grep -nE "AuthProvider|RequireAuth" src/App.tsx
echo "=== Swiper CSS ===" && grep -n "swiper/css" src/main.tsx
echo "=== setSupabaseClient ===" && grep -n "setSupabaseClient" src/main.tsx
echo "=== bundled base themes ===" && ls node_modules/@k-studio-pro/engine/base-themes/ 2>&1
```

Expected: engine ≥0.3.3, swiper present, all 4 shadow paths missing, tailwind matches engine glob, AuthProvider+RequireAuth on same import line from `@k-studio-pro/engine/shell`, swiper/css before ./index.css, setSupabaseClient called, 4 zips in engine base-themes/.

**Common failures → recovery:**
- `useAuth must be used within an AuthProvider` → both imports must come from `@k-studio-pro/engine/shell`; `rm -rf node_modules/.vite`; restart dev server
- Slider 1-up → check Swiper CSS imports in main.tsx; `rm -rf node_modules/.vite`
- Dashboard unstyled → tailwind config missing engine content glob; resync from `thin-client-templates/tailwind.config.ts`
- "Supabase client not set" → `setSupabaseClient(supabase)` not called before `<App />`
- Engine update didn't take effect → `rm -rf node_modules/.vite` + hard refresh
