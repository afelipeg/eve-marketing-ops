"use client"

import { useState, type ComponentProps } from "react"
import { useRouter } from "next/navigation"
import {
  Frame,
  FrameDescription,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { EyeOffIcon, EyeIcon, ArrowRightIcon, LockKeyholeIcon } from "lucide-react"

type FormSubmitHandler = NonNullable<ComponentProps<"form">["onSubmit"]>
type FormSubmitEvent = Parameters<FormSubmitHandler>[0]

export function SignupForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      if (!response.ok) {
        setError(response.status === 401 ? "Email or password is incorrect." : "Owner access is unavailable.")
        return
      }
      router.replace("/chat")
      router.refresh()
    } catch {
      setError("Could not reach the authentication service.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Frame className="w-full">
      {/* Content */}
      <FramePanel className="space-y-7 p-6 sm:space-y-8">
        <div className="space-y-2">
          <FrameTitle className="text-xl tracking-tight">
            Owner access
          </FrameTitle>
          <FrameDescription>
            Sign in to the private Marketing Ops prototype.
          </FrameDescription>
        </div>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <FieldGroup className="gap-5">
            <Field className="gap-2">
              <FieldLabel htmlFor="auth-5-email">Work email</FieldLabel>
              <Input
                id="auth-5-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </Field>

            <Field className="gap-2">
              <FieldLabel htmlFor="auth-5-password">Password</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="auth-5-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Your owner password"
                  minLength={8}
                  required
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? (
                      <EyeOffIcon aria-hidden="true" className="size-4" />
                    ) : (
                      <EyeIcon aria-hidden="true" className="size-4" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </FieldGroup>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          <Button disabled={submitting} type="submit" className="mt-1.5 w-full">
            {submitting ? "Signing in…" : "Enter workspace"}
            {submitting ? (
              <LockKeyholeIcon aria-hidden="true" data-icon="inline-end" />
            ) : (
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            )}
          </Button>

          <p className="text-muted-foreground text-center text-xs leading-5 text-pretty">
            Restricted to the prototype owner. Sessions expire after eight hours.
          </p>
        </form>
      </FramePanel>
    </Frame>
  )
}
