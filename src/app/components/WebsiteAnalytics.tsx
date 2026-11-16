"use client";
// Installs website analytics and captures the initial ChatGPT referral before internal navigation.

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { captureChatGPTReferral } from "../lib/conversionAnalytics";

export default function WebsiteAnalytics() {
  useEffect(() => {
    captureChatGPTReferral(true);
  }, []);

  return <Analytics />;
}
