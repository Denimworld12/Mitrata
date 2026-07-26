import React from "react";
import DashboardLayout from "@/layout/DashboardLayout";
import { useToast } from "@/Components/Toast";
import { GROUPS_ENABLED } from "@/config/featureFlags";
import EmptyState from "@/Components/ui/EmptyState";
import Button from "@/Components/ui/Button";
import { UsersRound, Plus } from "lucide-react";

export default function Groups() {
  const toast = useToast();

  return (
          <DashboardLayout>
        {/* Padding matches My Network's .container exactly (18/14 mobile,
            24/20 desktop, 60 bottom) so the two pages don't visibly jump in
            spacing when navigating between them. */}
        <div className="w-full max-w-3xl mx-auto px-[14px] pt-[18px] pb-[60px] sm:px-5 sm:pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
            <div>
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
                Groups
              </h1>
              <p className="text-sm text-[var(--mt-ink2)] mt-1">
                Bring your circles together in one shared space.
              </p>
            </div>
            <Button
              onClick={() => toast.info("Groups are coming soon")}
            >
              <Plus size={16} /> Start a group
            </Button>
          </div>

          <EmptyState
            icon={UsersRound}
            title="Groups aren't available yet"
            description="We're building shared spaces for your circles — check back soon."
          />
        </div>
      </DashboardLayout>
  );
}

// A direct /groups visit in prod (link, bookmark, typed URL) should bounce
// too, not just a hidden nav link.
export async function getServerSideProps() {
  if (!GROUPS_ENABLED) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }
  return { props: {} };
}
