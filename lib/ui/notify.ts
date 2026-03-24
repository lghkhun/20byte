import { toast } from "sonner";

type NotifyOptions = {
  description?: string;
  id?: string | number;
  duration?: number;
};

const GLOBAL_LOADING_TOAST_ID = "app-global-loading";

export function notifySuccess(message: string, options?: NotifyOptions) {
  toast.success(message, {
    description: options?.description,
    id: options?.id,
    duration: options?.duration
  });
}

export function notifyError(message: string, options?: NotifyOptions) {
  toast.error(message, {
    description: options?.description,
    id: options?.id,
    duration: options?.duration
  });
}

export function notifyInfo(message: string, options?: NotifyOptions) {
  toast.info(message, {
    description: options?.description,
    id: options?.id,
    duration: options?.duration
  });
}

export function notifyWarning(message: string, options?: NotifyOptions) {
  toast.warning(message, {
    description: options?.description,
    id: options?.id,
    duration: options?.duration
  });
}

export function notifyLoading(message: string, options?: NotifyOptions): string | number {
  const id = options?.id ?? GLOBAL_LOADING_TOAST_ID;
  return toast.loading(message, {
    description: options?.description,
    id,
    duration: options?.duration
  });
}

export function dismissNotify(id?: string | number) {
  if (id === undefined) {
    toast.dismiss();
    return;
  }
  toast.dismiss(id);
}
