import { createRoot } from "react-dom/client";
import { setSupabaseClient } from "@k-studio-pro/engine/data";
import { supabase } from "@/integrations/supabase/client";
import App from "./App.tsx";

// Swiper CSS — must load before our own styles so .swiper-wrapper gets
// flex layout and .swiper-slide gets flex-shrink:0. The engine imports
// these in sections.tsx but Vite doesn't always pull side-effect CSS from
// node_modules into the bundle, so we re-import them at the app entry.
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/effect-fade";
import "swiper/css/effect-cube";
import "swiper/css/effect-coverflow";
import "swiper/css/effect-flip";

import "./index.css";

// Wire this project's Supabase client into the engine BEFORE rendering so
// engine data-layer calls (siteStore, imageStore, etc.) hit the right project.
setSupabaseClient(supabase);

createRoot(document.getElementById("root")!).render(<App />);
