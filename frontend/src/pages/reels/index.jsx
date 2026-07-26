import React from "react";
import DashboardLayout from "@/layout/DashboardLayout";
import { REELS_ENABLED } from "@/config/featureFlags";
import { Play, Heart, MessageCircle, Share2, Bookmark } from "lucide-react";

const RAIL_ICONS = [Heart, MessageCircle, Share2, Bookmark];

export default function Reels() {
  return (
          <DashboardLayout>
        <div className="w-full flex flex-col items-center gap-6 px-[14px] pt-[18px] pb-[60px] sm:px-5 sm:pt-6">
          <div className="w-full max-w-md flex items-center justify-between">
            <h1
              className="inline-block text-[28px] sm:text-[34px] font-medium"
              style={{
                fontFamily: "var(--mt-font-display)",
                letterSpacing: "-0.03em",
                background: "var(--mt-grad)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              Reels
            </h1>
          </div>

          {/* 9:16 stage */}
          <div
            className="relative w-full overflow-hidden shadow-[var(--mt-shadow-lg)]"
            style={{
              maxWidth: 400,
              aspectRatio: "9 / 16",
              borderRadius: 26,
              backgroundImage:
                "var(--mt-grad-soft), url(/brand/orb-violet.png)",
              backgroundSize: "cover, cover",
              backgroundPosition: "center, center",
              backgroundBlendMode: "normal, soft-light",
            }}
          >
            {/* top scrim */}
            <div
              className="absolute inset-x-0 top-0 h-20"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(11,10,9,.35), transparent)",
              }}
            />

            {/* right icon rail — inert, nothing to react to yet */}
            <div className="absolute right-3 bottom-24 flex flex-col gap-3">
              {RAIL_ICONS.map((Icon, i) => (
                <div
                  key={i}
                  className="size-11 rounded-full flex items-center justify-center text-white/80"
                  style={{
                    background: "rgba(255,255,255,.14)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <Icon size={18} strokeWidth={1.8} />
                </div>
              ))}
            </div>

            {/* center content: play glass circle + honest empty-state copy */}
            {/* px-14 (not px-8): the right icon rail sits 12px from the edge with
                44px circles (occupies the last 56px) — anything narrower here
                lets long copy run under the rail on narrow stages. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-14 text-center">
              <div
                className="size-16 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,.14)", backdropFilter: "blur(10px)" }}
              >
                <Play className="text-white" size={26} fill="currentColor" strokeWidth={0} />
              </div>

              <span
                aria-hidden
                className="size-10"
                style={{
                  background: "var(--mt-grad)",
                  WebkitMaskImage: "url(/brand/mitrata-mark.png)",
                  maskImage: "url(/brand/mitrata-mark.png)",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                  opacity: 0.9,
                }}
              />

              <div>
                <p className="text-white text-base font-semibold">
                  Reels are coming soon
                </p>
                <p className="text-white/70 text-sm mt-1">
                  Video posts aren&apos;t available yet — check back later.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
  );
}

// Not just a nav-link hide — a direct /reels visit in prod (link, bookmark,
// typed URL) should bounce too, not render a "coming soon" page nobody
// intended to ship.
export async function getServerSideProps() {
  if (!REELS_ENABLED) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }
  return { props: {} };
}
