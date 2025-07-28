"use client";

import { ProfileForm } from "@/components/profile-form";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@/lib/convex";
import { api } from "@/lib/convex";

export default function ProfilePage() {
  const userQuery = useQuery(api.users.currentUser);
  const user = userQuery.data;

  useEffect(() => {
    if (userQuery.isError) {
      // Handle error case
      console.error("Error loading user:", userQuery.error);
      return;
    }

    if (!userQuery.isPending && user === null) {
      redirect("/auth/login");
    }
  }, [user, userQuery.isPending, userQuery.isError, userQuery.error]);

  if (userQuery.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-lg font-medium">Loading...</div>
      </div>
    );
  }

  if (userQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-destructive text-lg font-medium">
          Error loading profile: {userQuery.error?.message}
        </div>
      </div>
    );
  }

  if (user === null) {
    return null; // Redirect will handle this
  }

  return (
    <div className="flex-1 lg:max-w-2xl">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Profile</h3>
          <p className="text-muted-foreground text-sm">
            This is how others will see you on the site.
          </p>
        </div>
        <ProfileForm />
      </div>
    </div>
  );
}
