'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileNavTrigger } from '../layout';
import { CreateDocumentDialog } from '@/components/documents/create-document-dialog';
import { ScopedPermissionGate } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { formatDateHuman } from '@/lib/date';
import Link from 'next/link';
import {
  FileText,
  Trash2,
  Plus,
  ArrowLeft,
  Pencil,
  MoreHorizontal,
} from 'lucide-react';
import { PageSkeleton } from '@/components/ui/table-skeleton';
import { useConfirm } from '@/hooks/use-confirm';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';
import {
  PerspectiveBook,
  BookTitle,
  BookDescription,
} from '@/components/perspective-book';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ---------------------------------------------------------------------------
// Folder colors
// ---------------------------------------------------------------------------
const FOLDER_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6b7280', // gray
];

// ---------------------------------------------------------------------------
// Create Folder Dialog
// ---------------------------------------------------------------------------
function CreateFolderDialog({
  orgSlug,
  onClose,
}: {
  orgSlug: string;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const createFolderMutation = useMutation(
    api.documents.folderMutations.createFolder,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await createFolderMutation({
        orgSlug,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
        },
      });
      toast.success('Folder created');
      onClose();
    } catch {
      toast.error('Failed to create folder');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ResponsiveDialog open onOpenChange={open => !open && onClose()}>
      <ResponsiveDialogContent className='sm:max-w-md'>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>New folder</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Input
              placeholder='Folder name'
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            <Input
              placeholder='Description (optional)'
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className='flex flex-wrap gap-2'>
            {FOLDER_COLORS.map(c => (
              <button
                key={c}
                type='button'
                className='size-6 rounded-full border-2 transition-transform hover:scale-110'
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? 'white' : 'transparent',
                  boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='ghost' size='sm' onClick={onClose}>
              Cancel
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={!name.trim() || isLoading}
            >
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ---------------------------------------------------------------------------
// Rename Folder Dialog
// ---------------------------------------------------------------------------
function RenameFolderDialog({
  folder,
  onClose,
}: {
  folder: { _id: string; name: string; description?: string; color?: string };
  onClose: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description || '');
  const [color, setColor] = useState(folder.color || FOLDER_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const updateMutation = useMutation(
    api.documents.folderMutations.updateFolder,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await updateMutation({
        folderId: folder._id as Id<'documentFolders'>,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          color,
        },
      });
      toast.success('Folder updated');
      onClose();
    } catch {
      toast.error('Failed to update folder');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ResponsiveDialog open onOpenChange={open => !open && onClose()}>
      <ResponsiveDialogContent className='sm:max-w-md'>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Edit folder</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Input
              placeholder='Folder name'
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            <Input
              placeholder='Description (optional)'
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className='flex flex-wrap gap-2'>
            {FOLDER_COLORS.map(c => (
              <button
                key={c}
                type='button'
                className='size-6 rounded-full border-2 transition-transform hover:scale-110'
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? 'white' : 'transparent',
                  boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='ghost' size='sm' onClick={onClose}>
              Cancel
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={!name.trim() || isLoading}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ---------------------------------------------------------------------------
// Documents Page Content
// ---------------------------------------------------------------------------

interface DocumentsPageProps {
  params: Promise<{ orgSlug: string }>;
}

function DocumentsPageContent({ orgSlug }: { orgSlug: string }) {
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{
    _id: string;
    name: string;
    description?: string;
    color?: string;
  } | null>(null);

  const folders = useQuery(api.documents.folderQueries.listFolders, {
    orgSlug,
  });
  const documents = useQuery(api.documents.queries.list, {
    orgSlug,
    ...(activeFolderId
      ? { folderId: activeFolderId as Id<'documentFolders'> }
      : {}),
  });
  const removeMutation = useMutation(api.documents.mutations.remove);
  const removeFolderMutation = useMutation(
    api.documents.folderMutations.removeFolder,
  );
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm();

  if (documents === undefined || folders === undefined) {
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

  const activeFolder = activeFolderId
    ? folders.find(f => f._id === activeFolderId)
    : null;

  const handleDeleteDoc = async (documentId: string) => {
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

  const handleDeleteFolder = async (folderId: string) => {
    const confirmed = await confirmDelete({
      title: 'Delete folder',
      description:
        'Documents inside will be moved out, not deleted. This cannot be undone.',
    });
    if (!confirmed) return;
    try {
      await removeFolderMutation({
        folderId: folderId as Id<'documentFolders'>,
      });
      if (activeFolderId === folderId) setActiveFolderId(null);
      toast.success('Folder deleted');
    } catch {
      toast.error('Failed to delete folder');
    }
  };

  // Filter unfiled documents when viewing all (no active folder)
  const displayDocs = activeFolderId
    ? documents
    : documents.filter(d => !d.folderId);

  return (
    <div className='bg-background h-full overflow-y-auto'>
      <ConfirmDeleteDialog />
      {showCreateFolder && (
        <CreateFolderDialog
          orgSlug={orgSlug}
          onClose={() => setShowCreateFolder(false)}
        />
      )}
      {editingFolder && (
        <RenameFolderDialog
          folder={editingFolder}
          onClose={() => setEditingFolder(null)}
        />
      )}

      {/* Header */}
      <div className='border-b'>
        <div className='flex items-center justify-between p-1'>
          <div className='flex items-center gap-1'>
            <MobileNavTrigger />
            {activeFolder ? (
              <>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 gap-1 px-2 text-xs'
                  onClick={() => setActiveFolderId(null)}
                >
                  <ArrowLeft className='size-3' />
                  Back
                </Button>
                <span
                  className='inline-block size-2 rounded-full'
                  style={{ backgroundColor: activeFolder.color || '#6b7280' }}
                />
                <span className='text-sm font-medium'>{activeFolder.name}</span>
                <span className='text-muted-foreground text-xs'>
                  {documents.length}
                </span>
              </>
            ) : (
              <Button
                variant='secondary'
                size='sm'
                className='bg-secondary h-6 gap-2 rounded-xs px-3 text-xs font-normal'
              >
                <span>All documents</span>
              </Button>
            )}
          </div>
          <div className='flex items-center gap-1'>
            {!activeFolder && (
              <ScopedPermissionGate
                scope={{ orgSlug }}
                permission={PERMISSIONS.DOCUMENT_CREATE}
              >
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setShowCreateFolder(true)}
                  className='h-6 gap-1 text-xs'
                >
                  <Plus className='size-3' />
                  Folder
                </Button>
              </ScopedPermissionGate>
            )}
            <ScopedPermissionGate
              scope={{ orgSlug }}
              permission={PERMISSIONS.DOCUMENT_CREATE}
            >
              <CreateDocumentDialog
                orgSlug={orgSlug}
                onDocumentCreated={() => {}}
                className='h-6'
                defaultStates={
                  activeFolderId ? { folderId: activeFolderId } : undefined
                }
              />
            </ScopedPermissionGate>
          </div>
        </div>
      </div>

      {/* Folders grid (only when not inside a folder) */}
      {!activeFolder && folders.length > 0 && (
        <div className='border-b px-3 py-4 sm:px-4'>
          <div className='flex flex-wrap gap-4'>
            {folders.map(folder => (
              <div key={folder._id} className='group relative'>
                <button
                  onClick={() => setActiveFolderId(folder._id)}
                  className='text-left'
                >
                  <PerspectiveBook size='sm' className={`text-white`}>
                    <div
                      className='absolute inset-0 rounded-[inherit]'
                      style={{ backgroundColor: folder.color || '#6366f1' }}
                    />
                    <div className='relative z-10'>
                      <BookTitle className='text-sm'>{folder.name}</BookTitle>
                      {folder.description && (
                        <BookDescription>{folder.description}</BookDescription>
                      )}
                      <p className='mt-1 text-[10px] opacity-60'>
                        {folder.documentCount}{' '}
                        {folder.documentCount === 1 ? 'doc' : 'docs'}
                      </p>
                    </div>
                  </PerspectiveBook>
                </button>
                {/* Folder actions */}
                <div className='absolute top-1 right-1 z-20 opacity-0 transition-opacity group-hover:opacity-100'>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-5 w-5 rounded-full bg-black/30 p-0 text-white hover:bg-black/50 hover:text-white'
                      >
                        <MoreHorizontal className='size-3' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuItem
                        onClick={() =>
                          setEditingFolder({
                            _id: folder._id,
                            name: folder.name,
                            description: folder.description,
                            color: folder.color,
                          })
                        }
                      >
                        <Pencil className='size-4' />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant='destructive'
                        onClick={() => handleDeleteFolder(folder._id)}
                      >
                        <Trash2 className='size-4' />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents list */}
      {displayDocs.length === 0 && !activeFolder && folders.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-16 text-center'>
          <FileText className='text-muted-foreground mb-4 size-12' />
          <h3 className='text-lg font-medium'>No documents yet</h3>
          <p className='text-muted-foreground mt-1 text-sm'>
            Create your first document to get started.
          </p>
        </div>
      ) : displayDocs.length === 0 ? (
        <div className='text-muted-foreground px-3 py-8 text-center text-sm'>
          {activeFolder
            ? 'No documents in this folder.'
            : 'No unfiled documents.'}
        </div>
      ) : (
        <div className='divide-y'>
          {displayDocs.map(doc => (
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
                onClick={() => handleDeleteDoc(doc._id)}
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
