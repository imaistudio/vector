import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { getPresignedReadUrl } from "@/lib/s3";

interface Params {
  key: string[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { key: keyArr } = await params;
    const key = keyArr.join("/");

    // Authenticate user
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // Extract org ID from key pattern: org-logos/<orgId>/...
    const keyParts = key.split("/");
    if (keyParts.length < 2 || keyParts[0] !== "org-logos") {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const orgId = keyParts[1];

    // Verify user belongs to this organization
    const membership = await OrganizationService.verifyUserOrganizationAccess(
      session.user.id,
      orgId,
    );

    if (!membership) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Generate presigned URL and redirect
    const signedUrl = await getPresignedReadUrl(key, 3600); // 1 hour
    return NextResponse.redirect(signedUrl, 302);
  } catch (err) {
    console.error("File proxy error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
