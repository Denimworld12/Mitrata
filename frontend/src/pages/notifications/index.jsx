import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import DashboardLayout from "@/layout/DashboardLayout";
import { useNotification } from "@/Components/NotificationProvider";
import { useToast } from "@/Components/Toast";
import { acceptConnectionRequest } from "@/config/redux/action/authAction";
import EmptyState from "@/Components/ui/EmptyState";
import Button from "@/Components/ui/Button";
import {
  CheckCheck,
  UserPlus,
  BadgeCheck,
  MessageCircle,
  Heart,
  MessageSquare,
  Bell,
} from "lucide-react";

// type-badge per notif.type/title (request vs accepted is only
// distinguishable via the title text NotificationProvider sets).
function typeBadge(n) {
  if (n.type === "connection") {
    if (n.title === "Connection Accepted" || n.title?.startsWith("Connection Accepted")) {
      return { Icon: BadgeCheck, bg: "rgba(31,138,76,.14)", fg: "#1f8a4c" };
    }
    return { Icon: UserPlus, bg: "rgba(31,138,76,.14)", fg: "#1f8a4c" };
  }
  if (n.type === "message") {
    return { Icon: MessageCircle, bg: "rgba(4,71,255,.14)", fg: "#0447ff" };
  }
  if (n.type === "like") {
    return { Icon: Heart, bg: "rgba(255,71,4,.14)", fg: "#ff4704" };
  }
  if (n.type === "comment") {
    return { Icon: MessageSquare, bg: "rgba(4,71,255,.14)", fg: "#0447ff" };
  }
  return { Icon: Bell, bg: "rgba(255,71,4,.14)", fg: "#ff4704" };
}

function formatTime(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function Row({ n, onClick }) {
  const dispatch = useDispatch();
  const toast = useToast();
  const [handled, setHandled] = useState(null); // null | 'accepted' | 'ignored'
  const { Icon, bg, fg } = typeBadge(n);
  const isConnectionRequest = n.type === "connection" && n.title?.includes("Request");
  const requestId = n.metadata?.requestId;

  const respond = async (action) => {
    try {
      await dispatch(acceptConnectionRequest({ connectionId: requestId, action })).unwrap();
      setHandled(action === "accept" ? "accepted" : "ignored");
    } catch (error) {
      toast.error(error?.message || "Couldn't update that request");
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--mt-sunken)] transition-colors"
      onClick={onClick}
    >
      <div className="relative shrink-0">
        <img
          src={n.avatar || "/default-avatar.svg"}
          alt=""
          className="size-11 rounded-full object-cover border border-[var(--mt-border)]"
        />
        <div
          className="absolute -bottom-1 -right-1 size-5 rounded-full flex items-center justify-center border-2 border-[var(--mt-surface)]"
          style={{ background: bg, color: fg }}
        >
          <Icon size={11} strokeWidth={2.2} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] text-[var(--mt-ink)] truncate">
          <span className="font-semibold">{n.title}</span>
          {n.message ? <span className="text-[var(--mt-ink2)]"> — {n.message}</span> : null}
        </p>
        <span className="text-[11.5px] text-[var(--mt-ink3)]">{formatTime(n.time)}</span>

        {isConnectionRequest && requestId && !handled && (
          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            <Button className="!px-3 !py-1 !text-xs" onClick={() => respond("accept")}>
              Accept
            </Button>
            <Button variant="secondary" className="!px-3 !py-1 !text-xs" onClick={() => respond("reject")}>
              Ignore
            </Button>
          </div>
        )}
        {isConnectionRequest && requestId && handled && (
          <p className="text-[12px] text-[var(--mt-ink3)] mt-1">
            {handled === "accepted" ? "Request accepted" : "Request ignored"}
          </p>
        )}
        {/* Rows from before metadata.requestId existed (or already handled
            elsewhere) fall back to the old "go look at My Network" flow. */}
        {isConnectionRequest && !requestId && (
          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            <Button
              className="!px-3 !py-1 !text-xs"
              onClick={() => onClick()}
            >
              View request
            </Button>
          </div>
        )}
      </div>

      {!n.read && (
        <span
          className="size-2 rounded-full shrink-0"
          style={{ background: "var(--mt-grad)" }}
        />
      )}
    </div>
  );
}

export default function Notifications() {
  const router = useRouter();
  const { recentNotifs, clearUnread } = useNotification();

  const { today, earlier } = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = [];
    const earlier = [];
    for (const n of recentNotifs) {
      (new Date(n.time) >= startOfToday ? today : earlier).push(n);
    }
    return { today, earlier };
  }, [recentNotifs]);

  const goTo = (n) => {
    if (n.type === "connection") {
      router.push("/my_network");
    } else if (n.type === "message") {
      router.push("/messaging/sidebar_panel");
    } else if ((n.type === "like" || n.type === "comment") && n.metadata?.postId) {
      router.push(`/post/${n.metadata.postId}`);
    }
  };

  return (
          <DashboardLayout>
        <div className="max-w-2xl mx-auto py-8 px-4">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <h1
              className="text-2xl font-semibold"
              style={{
                fontFamily: "var(--mt-font-display)",
                backgroundImage: "var(--mt-grad)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Notifications
            </h1>
            <Button variant="secondary" onClick={clearUnread}>
              <CheckCheck size={16} /> Mark all read
            </Button>
          </div>

          <div className="rounded-[22px] border border-[var(--mt-border)] bg-[var(--mt-surface)] shadow-[var(--mt-shadow)] overflow-hidden">
            {recentNotifs.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No notifications yet"
                description="Activity from your connections and messages will show up here."
              />
            ) : (
              <>
                {today.length > 0 && (
                  <div>
                    <p className="text-[10.5px] font-semibold tracking-wide uppercase text-[var(--mt-ink3)]" style={{ padding: "20px 20px 4px" }}>
                      Today
                    </p>
                    <div className="divide-y divide-[var(--mt-border)]">
                      {today.map((n) => (
                        <Row key={n.id} n={n} onClick={() => goTo(n)} />
                      ))}
                    </div>
                  </div>
                )}
                {earlier.length > 0 && (
                  <div>
                    <p className="text-[10.5px] font-semibold tracking-wide uppercase text-[var(--mt-ink3)]" style={{ padding: "20px 20px 4px" }}>
                      Earlier
                    </p>
                    <div className="divide-y divide-[var(--mt-border)]">
                      {earlier.map((n) => (
                        <Row key={n.id} n={n} onClick={() => goTo(n)} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DashboardLayout>
  );
}
