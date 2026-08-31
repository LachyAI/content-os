import { redirect } from "next/navigation";

// The single YouTube manager was split into two channel workspaces:
//   /youtube-seo  (@lachlanSEO, ClearScale)   /youtube-ai (@Lachlan-AI, LachlanCB)
// The AI channel inherits the original board/scripts, so /youtube points there.
export default function YouTubePage() {
  redirect("/youtube-ai");
}
