import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { Btn } from "./Btn";

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button. Defaults to true. */
  destructive?: boolean;
}

type ConfirmFn = (
  message: string,
  options?: ConfirmOptions,
) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Promise-based replacement for window.confirm(), built on the shadcn
 * AlertDialog. Usage: `const confirm = useConfirm();`
 * `if (!(await confirm("Delete job J-001?"))) return;`
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    ({ message: string } & ConfirmOptions) | null
  >(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((message, options) => {
    // Settle any dialog that is somehow still open so its caller never hangs.
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ message, ...options });
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  };

  const destructive = state?.destructive ?? true;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={state !== null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <AlertDialogContent
          className="rounded-none sm:rounded-none max-w-md p-6 gap-4"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-pop)",
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: 20,
                color: "var(--ink)",
              }}
            >
              {state?.title ??
                (destructive ? "Are you sure?" : "Please confirm")}
            </AlertDialogTitle>
            <AlertDialogDescription
              style={{ color: "var(--muted)", fontSize: 14 }}
            >
              {state?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel asChild>
              <Btn variant="outline" className="justify-center">
                {state?.cancelLabel ?? "Cancel"}
              </Btn>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Btn
                variant={destructive ? "destructive" : "primary"}
                className="justify-center"
                onClick={() => settle(true)}
              >
                {state?.confirmLabel ?? (destructive ? "Delete" : "Confirm")}
              </Btn>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
