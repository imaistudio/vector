'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { extractAuthErrorMessage } from '@/lib/auth-error-handler';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useBranding } from '@/hooks/use-branding';
import {
  DEFAULT_BRANDING,
  getContrastingTextColor,
  resolveBrandColor,
} from '@/lib/branding';
import { AuthBrandHeader } from '../_components/auth-brand-panel';

const signInSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

type SignInFormType = z.infer<typeof signInSchema>;

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';
  const branding = useBranding();
  const accentColor = resolveBrandColor(
    branding.accentColor,
    DEFAULT_BRANDING.accentColor,
  );
  const accentTextColor = getContrastingTextColor(accentColor);

  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignInFormType>({
    resolver: zodResolver(signInSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const handleSubmit = async (values: SignInFormType) => {
    setIsLoading(true);

    try {
      const isEmail = values.identifier.includes('@');
      const result = isEmail
        ? await authClient.signIn.email({
            email: values.identifier,
            password: values.password,
          })
        : await authClient.signIn.username({
            username: values.identifier,
            password: values.password,
          });

      if (result.error) {
        throw result.error;
      }

      window.location.href = `/auth/signing-in?redirectTo=${encodeURIComponent(redirectTo)}`;
    } catch (error) {
      const message = extractAuthErrorMessage(error);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex min-h-dvh flex-col items-center justify-center px-6 py-12'>
      <div className='w-full max-w-sm'>
        <AuthBrandHeader />

        <div className='mb-8 text-center'>
          <h1 className='font-title text-2xl font-semibold tracking-tight'>
            Welcome back
          </h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            Sign in to your account
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='identifier'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='text-xs font-medium'>
                    Email or Username
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='text'
                      placeholder='you@example.com'
                      autoComplete='email'
                      disabled={isLoading}
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-center justify-between'>
                    <FormLabel className='text-xs font-medium'>
                      Password
                    </FormLabel>
                    <Link
                      href='/auth/forgot-password'
                      className='text-muted-foreground hover:text-foreground text-xs transition-colors'
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      type='password'
                      placeholder='Enter your password'
                      autoComplete='current-password'
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type='submit'
              className='!mt-6 w-full transition-opacity hover:opacity-90'
              disabled={isLoading}
              style={{
                backgroundColor: accentColor,
                color: accentTextColor,
              }}
            >
              {isLoading ? (
                <span className='flex items-center gap-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </Button>

            <p className='text-muted-foreground text-center text-sm'>
              Don&apos;t have an account?{' '}
              <Link
                href='/auth/signup'
                className='text-foreground font-medium hover:underline'
              >
                Sign up
              </Link>
            </p>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className='flex min-h-dvh flex-col items-center justify-center px-6'>
          <div className='w-full max-w-sm space-y-8'>
            <div className='flex flex-col items-center gap-4'>
              <Skeleton className='size-14 rounded-2xl' />
              <Skeleton className='h-5 w-16' />
            </div>
            <div className='space-y-2 text-center'>
              <Skeleton className='mx-auto h-8 w-40' />
              <Skeleton className='mx-auto h-4 w-36' />
            </div>
            <div className='space-y-4'>
              <div className='space-y-2'>
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-10 w-full rounded-md' />
              </div>
              <div className='space-y-2'>
                <Skeleton className='h-4 w-16' />
                <Skeleton className='h-10 w-full rounded-md' />
              </div>
              <Skeleton className='h-10 w-full rounded-md' />
            </div>
            <Skeleton className='mx-auto h-4 w-48' />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
