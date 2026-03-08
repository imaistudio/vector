'use client';

import React from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { MobileNavTrigger } from '../layout';
import { CreateDocumentDialog } from '@/components/documents/create-document-dialog';
import { ScopedPermissionGate } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { formatDateHuman } from '@/lib/date';
import Link from 'next/link';
import { FileText, Trash2 } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/table-skeleton';
import { useConfirm } from '@/hooks/use-confirm';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';

interface DocumentsPageProps {
  params: Promise<{ orgSlug: string }>;
}

function DocumentsPageContent({ orgSlug }: { orgSlug: string }) {
  const documents = useQuery(api.documents.queries.list, { orgSlug });
  const removeMutation = useMutation(api.documents.mutations.remove);
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm();

  if (documents === undefined) {
    return (
      <PageSkeleton
        showTabs={true}
        tabCount={1}
        showCreateButton={true}
        tableRows={8}
        tableColumns={3}
      />
    );
  }

  const handleDelete = async (documentId: string) => {
    const confirmed = await confirmDelete({
      title: 'Delete document',
      description:
        'Are you sure you want to delete this document? This action cannot be undone.',
    });
    if (!confirmed) return;
    try {
      await removeMutation({ documentId: documentId as Id<'documents'> });
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  };

  return (
    <div className='bg-background h-full'>
      <ConfirmDeleteDialog />
      {/* Header */}
      <div className='border-b'>
        <div className='flex items-center justify-between p-1'>
          <div className='flex items-center gap-1'>
            <MobileNavTrigger />
            <Button
              variant='secondary'
              size='sm'
              className='bg-secondary h-6 gap-2 rounded-xs px-3 text-xs font-normal'
            >
              <span>All documents</span>
              <span className='text-muted-foreground text-xs'>
                {documents.length}
              </span>
            </Button>
          </div>
          <ScopedPermissionGate
            scope={{ orgSlug }}
            permission={PERMISSIONS.DOCUMENT_CREATE}
          >
            <CreateDocumentDialog
              orgSlug={orgSlug}
              onDocumentCreated={() => {}}
              className='h-6'
            />
          </ScopedPermissionGate>
        </div>
      </div>

      {/* Documents list */}
      {documents.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-16 text-center'>
          <FileText className='text-muted-foreground mb-4 size-12' />
          <h3 className='text-lg font-medium'>No documents yet</h3>
          <p className='text-muted-foreground mt-1 text-sm'>
            Create your first document to get started.
          </p>
        </div>
      ) : (
        <div className='divide-y'>
          {documents.map(doc => (
            <div
              key={doc._id}
              className='hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors'
            >
              <FileText className='text-muted-foreground size-4 flex-shrink-0' />
              <Link
                href={`/${orgSlug}/documents/${doc._id}`}
                className='min-w-0 flex-1'
              >
                <div className='truncate text-sm font-medium'>{doc.title}</div>
                <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                  {doc.team && <span>{doc.team.name}</span>}
                  {doc.project && (
                    <>
                      {doc.team && <span>·</span>}
                      <span>{doc.project.name}</span>
                    </>
                  )}
                  {doc.author && (
                    <>
                      <span>·</span>
                      <span>{doc.author.name || doc.author.email}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>
                    {formatDateHuman(
                      new Date(doc.lastEditedAt || doc._creationTime),
                    )}
                  </span>
                </div>
              </Link>
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground hover:text-destructive h-7 w-7 flex-shrink-0 p-0'
                onClick={() => handleDelete(doc._id)}
              >
                <Trash2 className='size-3' />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage({ params }: DocumentsPageProps) {
  const [orgSlug, setOrgSlug] = React.useState<string | null>(null);

  React.useEffect(() => {
    void params.then(({ orgSlug }) => setOrgSlug(orgSlug));
  }, [params]);

  if (!orgSlug) {
    return (
      <PageSkeleton
        showTabs={true}
        tabCount={1}
        showCreateButton={true}
        tableRows={8}
        tableColumns={3}
      />
    );
  }

  return <DocumentsPageContent orgSlug={orgSlug} />;
}
