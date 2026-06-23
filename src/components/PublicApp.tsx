"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { Post } from "@/lib/types";
import { Dashboard } from "./Dashboard";
import { LandingScreen } from "./LandingScreen";

interface PublicAppProps {
  initialPosts: Post[];
  isAdmin: boolean;
  userEmail?: string;
  isAuthenticated: boolean;
  signOutSlot?: ReactNode;
  adminLoginSlot: ReactNode;
}

export function PublicApp({
  initialPosts,
  isAdmin,
  userEmail,
  isAuthenticated,
  signOutSlot,
  adminLoginSlot,
}: PublicAppProps) {
  const [view, setView] = useState<"landing" | "demo">(
    isAuthenticated ? "demo" : "landing",
  );

  if (view === "landing") {
    return (
      <LandingScreen
        onGuestAccess={() => setView("demo")}
        adminLoginSlot={adminLoginSlot}
      />
    );
  }

  return (
    <Dashboard
      initialPosts={initialPosts}
      isAdmin={isAdmin}
      isGuest={!isAuthenticated}
      userEmail={userEmail}
      signOutSlot={signOutSlot}
    />
  );
}
