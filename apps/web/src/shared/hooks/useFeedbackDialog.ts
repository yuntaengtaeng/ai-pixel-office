import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AlertDialogOptions,
  AlertDialogProps,
  ConfirmDialogOptions,
  ConfirmDialogProps,
} from "../ui/FeedbackDialogs.tsx";

export function useConfirmDialog(): {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  dialogProps: ConfirmDialogProps;
} {
  const [options, setOptions] = useState<ConfirmDialogOptions>();
  const resolver = useRef<((confirmed: boolean) => void) | undefined>(undefined);
  const settle = useCallback((confirmed: boolean) => {
    const resolve = resolver.current;
    resolver.current = undefined;
    setOptions(undefined);
    resolve?.(confirmed);
  }, []);
  const confirm = useCallback((nextOptions: ConfirmDialogOptions) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOptions(nextOptions);
    });
  }, []);
  useEffect(() => () => resolver.current?.(false), []);

  return {
    confirm,
    dialogProps: {
      open: Boolean(options),
      title: options?.title,
      description: options?.description ?? "",
      confirmLabel: options?.confirmLabel,
      cancelLabel: options?.cancelLabel,
      tone: options?.tone,
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
    },
  };
}

export function useAlertDialog(): {
  alert: (options: AlertDialogOptions) => Promise<void>;
  dialogProps: AlertDialogProps;
} {
  const [options, setOptions] = useState<AlertDialogOptions>();
  const resolver = useRef<(() => void) | undefined>(undefined);
  const close = useCallback(() => {
    const resolve = resolver.current;
    resolver.current = undefined;
    setOptions(undefined);
    resolve?.();
  }, []);
  const alert = useCallback((nextOptions: AlertDialogOptions) => {
    resolver.current?.();
    return new Promise<void>((resolve) => {
      resolver.current = resolve;
      setOptions(nextOptions);
    });
  }, []);
  useEffect(() => () => resolver.current?.(), []);

  return {
    alert,
    dialogProps: {
      open: Boolean(options),
      title: options?.title,
      description: options?.description ?? "",
      closeLabel: options?.closeLabel,
      tone: options?.tone,
      onClose: close,
    },
  };
}
