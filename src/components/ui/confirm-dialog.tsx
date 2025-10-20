"use client"

import * as React from "react"
import {
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
  Heading,
  Button as AriaButton,
  type DialogProps,
} from "react-aria-components"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: "default" | "destructive"
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  variant = "default",
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable
      className={cn(
        "fixed inset-0 z-50 bg-black/80",
        "data-[entering]:animate-in data-[entering]:fade-in-0",
        "data-[exiting]:animate-out data-[exiting]:fade-out-0"
      )}
    >
      <Modal
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200",
          "sm:rounded-lg",
          "data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95 data-[entering]:slide-in-from-left-1/2 data-[entering]:slide-in-from-top-[48%]",
          "data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-95 data-[exiting]:slide-out-to-left-1/2 data-[exiting]:slide-out-to-top-[48%]"
        )}
      >
        <Dialog className="outline-none">
          {({ close }) => (
            <>
              <div className="flex flex-col space-y-2 text-center sm:text-left">
                <Heading
                  slot="title"
                  className="text-lg font-semibold leading-none tracking-tight"
                >
                  {title}
                </Heading>
                <p className="text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                <Button
                  variant="outline"
                  onPress={handleCancel}
                  className="mt-2 sm:mt-0"
                >
                  {cancelLabel}
                </Button>
                <Button
                  variant={variant === "destructive" ? "destructive" : "default"}
                  onPress={handleConfirm}
                >
                  {confirmLabel}
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

// Hook to use confirm dialog programmatically
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [config, setConfig] = React.useState<Omit<ConfirmDialogProps, 'open' | 'onOpenChange'> | null>(null)
  const resolveRef = React.useRef<((value: boolean) => void) | null>(null)

  const confirm = React.useCallback((options: Omit<ConfirmDialogProps, 'open' | 'onOpenChange' | 'onConfirm' | 'onCancel'>) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setConfig({
        ...options,
        onConfirm: () => {
          resolve(true)
          setIsOpen(false)
        },
        onCancel: () => {
          resolve(false)
          setIsOpen(false)
        },
      })
      setIsOpen(true)
    })
  }, [])

  const dialog = config ? (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && resolveRef.current) {
          resolveRef.current(false)
        }
        setIsOpen(open)
      }}
      {...config}
    />
  ) : null

  return { confirm, dialog }
}
