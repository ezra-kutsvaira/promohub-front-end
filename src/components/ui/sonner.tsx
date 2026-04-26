import * as React from "react";

import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

type MessageVariant = "error" | "success" | "warning" | "info";

type ToastOptions = {
  description?: React.ReactNode;
  duration?: number;
};

type UpdateMessageOptions = ToastOptions & {
  title?: React.ReactNode;
  variant?: MessageVariant;
};

type AppMessage = {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  variant: MessageVariant;
};

type ToastHandle = {
  id: string;
  dismiss: () => void;
  update: (options: UpdateMessageOptions) => void;
};

type MessageListener = (messages: AppMessage[]) => void;

const MAX_VISIBLE_MESSAGES = 4;
const DEFAULT_DURATIONS: Record<MessageVariant, number> = {
  error: 8000,
  success: 4500,
  warning: 7000,
  info: 6000,
};

const listeners = new Set<MessageListener>();
const removalTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

let messageCount = 0;
let memoryState: AppMessage[] = [];

const emit = () => {
  listeners.forEach((listener) => listener(memoryState));
};

const nextMessageId = () => {
  messageCount = (messageCount + 1) % Number.MAX_SAFE_INTEGER;
  return `app-message-${messageCount}`;
};

const clearRemovalTimeout = (messageId: string) => {
  const existingTimeout = removalTimeouts.get(messageId);
  if (!existingTimeout) {
    return;
  }

  clearTimeout(existingTimeout);
  removalTimeouts.delete(messageId);
};

const dismiss = (messageId?: string) => {
  if (messageId) {
    clearRemovalTimeout(messageId);
    memoryState = memoryState.filter((message) => message.id !== messageId);
    emit();
    return;
  }

  Array.from(removalTimeouts.keys()).forEach(clearRemovalTimeout);
  memoryState = [];
  emit();
};

const scheduleRemoval = (messageId: string, duration: number) => {
  clearRemovalTimeout(messageId);
  if (duration <= 0) {
    return;
  }

  const timeout = setTimeout(() => {
    dismiss(messageId);
  }, duration);

  removalTimeouts.set(messageId, timeout);
};

const updateMessage = (messageId: string, options: UpdateMessageOptions) => {
  let nextDuration: number | undefined;

  memoryState = memoryState.map((message) => {
    if (message.id !== messageId) {
      return message;
    }

    if (typeof options.duration === "number") {
      nextDuration = options.duration;
    }

    return {
      ...message,
      title: options.title ?? message.title,
      description: options.description ?? message.description,
      variant: options.variant ?? message.variant,
    };
  });

  emit();

  if (typeof nextDuration === "number") {
    scheduleRemoval(messageId, nextDuration);
  }
};

const createToast = (
  variant: MessageVariant,
  title: React.ReactNode,
  options: ToastOptions = {},
): ToastHandle => {
  const id = nextMessageId();
  const duration = options.duration ?? DEFAULT_DURATIONS[variant];

  memoryState = [
    {
      id,
      title,
      description: options.description,
      variant,
    },
    ...memoryState,
  ].slice(0, MAX_VISIBLE_MESSAGES);

  const visibleIds = new Set(memoryState.map((message) => message.id));
  Array.from(removalTimeouts.keys())
    .filter((messageId) => !visibleIds.has(messageId))
    .forEach(clearRemovalTimeout);

  emit();
  scheduleRemoval(id, duration);

  return {
    id,
    dismiss: () => dismiss(id),
    update: (nextOptions: UpdateMessageOptions) => updateMessage(id, nextOptions),
  };
};

const subscribe = (listener: MessageListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const useAppMessages = () =>
  React.useSyncExternalStore(subscribe, () => memoryState, () => memoryState);

const messageStyles: Record<
  MessageVariant,
  {
    icon: typeof AlertCircle;
    iconClassName: string;
    panelClassName: string;
  }
> = {
  error: {
    icon: AlertCircle,
    iconClassName: "text-destructive",
    panelClassName: "border-destructive/40 bg-background/95",
  },
  success: {
    icon: CheckCircle2,
    iconClassName: "text-emerald-600 dark:text-emerald-400",
    panelClassName: "border-emerald-500/35 bg-background/95",
  },
  warning: {
    icon: TriangleAlert,
    iconClassName: "text-amber-600 dark:text-amber-400",
    panelClassName: "border-amber-500/35 bg-background/95",
  },
  info: {
    icon: Info,
    iconClassName: "text-primary",
    panelClassName: "border-primary/25 bg-background/95",
  },
};

type ToasterProps = React.HTMLAttributes<HTMLDivElement>;

const Toaster = ({ className, ...props }: ToasterProps) => {
  const messages = useAppMessages();

  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("pointer-events-none fixed inset-x-0 top-4 z-[120] flex flex-col items-center gap-3 px-4", className)}
      {...props}
    >
      {messages.map((message) => {
        const style = messageStyles[message.variant];
        const Icon = style.icon;

        return (
          <div
            key={message.id}
            role={message.variant === "error" ? "alert" : "status"}
            aria-live={message.variant === "error" ? "assertive" : "polite"}
            className={cn(
              "pointer-events-auto w-full max-w-2xl rounded-xl border shadow-2xl backdrop-blur",
              "animate-in fade-in-0 slide-in-from-top-2 duration-200",
              style.panelClassName,
            )}
          >
            <div className="flex items-start gap-3 p-4">
              <Icon className={cn("mt-0.5 h-5 w-5 flex-shrink-0", style.iconClassName)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{message.title}</p>
                {message.description ? (
                  <div className="mt-1 text-sm text-muted-foreground">{message.description}</div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => dismiss(message.id)}
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const toast = {
  success: (title: React.ReactNode, options?: ToastOptions) => createToast("success", title, options),
  error: (title: React.ReactNode, options?: ToastOptions) => createToast("error", title, options),
  warning: (title: React.ReactNode, options?: ToastOptions) => createToast("warning", title, options),
  info: (title: React.ReactNode, options?: ToastOptions) => createToast("info", title, options),
  dismiss,
};

export { Toaster, toast };
