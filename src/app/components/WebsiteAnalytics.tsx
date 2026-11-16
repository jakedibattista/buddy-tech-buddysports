"use client";
// Installs website analytics and captures the initial referral source before internal navigation.

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { captureReferral } from "../lib/conversionAnalytics";

export default function WebsiteAnalytics() {
  useEffect(() => {
    captureReferral();
  }, []);

  return <Analytics />;
}
