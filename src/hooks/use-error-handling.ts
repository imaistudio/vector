import { useState, useCallback } from "react";
import { analyzeError, type ErrorInfo } from "@/lib/error-handling";
import { useMutation } from "convex/react";

/**
 * Hook for handling Convex mutations with consistent error handling
 */
export function useConvexMutation<T extends any>(
  mutation: T,
  options?: {
    context?: string;
    onSuccess?: (result: any) => void;
    onError?: (error: ErrorInfo) => void;
  },
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const convexMutation = useMutation(mutation);

  const execute = useCallback(
    async (...args: any[]): Promise<any | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await convexMutation(...args);

        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (err) {
        const errorInfo = analyzeError(err);
        setError(errorInfo);

        if (options?.onError) {
          options.onError(errorInfo);
        }

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [convexMutation, options],
  );

  return {
    execute,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}

/**
 * Hook for handling form submissions with error handling
 */
export function useFormSubmission<T extends (...args: any[]) => Promise<any>>(
  mutation: T,
  options?: {
    context?: string;
    onSuccess?: (result: Awaited<ReturnType<T>>) => void;
    onError?: (error: ErrorInfo) => void;
    successMessage?: string;
  },
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);

  const submit = useCallback(
    async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const result = await mutation(...args);

        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (err) {
        const errorInfo = analyzeError(err);
        setError(errorInfo);

        if (options?.onError) {
          options.onError(errorInfo);
        }

        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [mutation, options],
  );

  return {
    submit,
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
}

/**
 * Hook for handling async operations with retry logic
 */
export function useAsyncOperation<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  options?: {
    context?: string;
    maxRetries?: number;
    retryDelay?: number;
    onSuccess?: (result: Awaited<ReturnType<T>>) => void;
    onError?: (error: ErrorInfo) => void;
  },
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const execute = useCallback(
    async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | null> => {
      setIsLoading(true);
      setError(null);

      const maxRetries = options?.maxRetries ?? 3;
      const retryDelay = options?.retryDelay ?? 1000;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await operation(...args);

          if (options?.onSuccess) {
            options.onSuccess(result);
          }

          setRetryCount(0);
          return result;
        } catch (err) {
          const errorInfo = analyzeError(err);

          if (attempt === maxRetries) {
            setError(errorInfo);
            setRetryCount(0);

            if (options?.onError) {
              options.onError(errorInfo);
            }

            return null;
          }

          // Only retry if the error is retryable
          if (!errorInfo.retryable) {
            setError(errorInfo);
            setRetryCount(0);

            if (options?.onError) {
              options.onError(errorInfo);
            }

            return null;
          }

          setRetryCount(attempt + 1);

          // Wait before retrying
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * (attempt + 1)),
          );
        }
      }

      setIsLoading(false);
      return null;
    },
    [operation, options],
  );

  return {
    execute,
    isLoading,
    error,
    retryCount,
    clearError: () => setError(null),
  };
}
