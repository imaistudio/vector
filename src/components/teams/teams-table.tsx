"use client";

import Link from "next/link";
import { Users, Clock } from "lucide-react";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Team {
  id: string;
  name: string;
  description?: string | null;
  key: string;
  createdAt?: Date | string;
}

interface TeamsTableProps {
  orgSlug: string;
  teams: Team[];
}

export function TeamsTable({ orgSlug, teams }: TeamsTableProps) {
  if (teams.length === 0) {
    return (
      <div className="rounded-lg border">
        <div className="p-8 text-center">
          <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-semibold">No teams yet</h3>
          <p className="text-muted-foreground">
            Teams help you organize members and manage project access within
            your organization.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Team</TableHead>
            <TableHead className="w-[15%]">Key</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[15%]">Created</TableHead>
            <TableHead className="w-[10%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((team) => (
            <TableRow key={team.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Users className="text-muted-foreground size-4" />
                  <Link
                    href={`/${orgSlug}/teams/${team.key}`}
                    className="hover:text-primary font-medium"
                  >
                    {team.name}
                  </Link>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-mono text-xs">
                  {team.key}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground truncate">
                {team.description || "—"}
              </TableCell>
              <TableCell>
                {team.createdAt && (
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Clock className="text-muted-foreground size-3" />
                    <span className="text-muted-foreground text-sm">
                      {new Date(team.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${orgSlug}/teams/${team.key}`}>View</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
