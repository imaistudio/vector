"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Settings, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserMenuProps {
  user: {
    name?: string | null;
    email: string;
    image?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();

  const onLogout = async () => {
    // Ignore errors – UI will refresh regardless
    await authClient.signOut?.();
    router.refresh();
    router.push("/auth/login");
  };

  const initial = (user.name ?? user.email.charAt(0)).charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="text-muted-foreground hover:bg-foreground/10 flex w-full items-center gap-2 rounded-md p-1.5 transition-colors"
          aria-label="User menu"
        >
          <Avatar className="size-6">
            {user.image ? (
              <AvatarImage src={user.image} alt={user.name ?? "User avatar"} />
            ) : (
              <AvatarFallback className="text-xs">{initial}</AvatarFallback>
            )}
          </Avatar>
          <span className="truncate text-left text-sm font-medium">
            {user.name ?? user.email}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuItem asChild>
          <Link
            href="/settings/profile"
            className="flex items-center gap-2 px-2 py-1.5"
          >
            <Settings className="size-4" />{" "}
            <span className="text-sm">Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/settings/invites"
            className="flex items-center gap-2 px-2 py-1.5"
          >
            <Mail className="size-4" /> <span className="text-sm">Invites</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onLogout();
          }}
          variant="destructive"
          className="flex items-center gap-2 px-2 py-1.5"
        >
          <LogOut className="size-4" /> <span className="text-sm">Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
