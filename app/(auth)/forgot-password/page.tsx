"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { ClipLoader } from "react-spinners";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResetLink(null);

    try {
      const response = await fetch("/api/v1/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await response.json();

      if (!response.ok || json.error) {
        setIsLoading(false);
        toast({
          title: "Error",
          description: json.error || "Failed to send reset link",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(false);
      setIsSubmitted(true);
      if (json.reset_link) {
        setResetLink(json.reset_link);
      }
      toast({
        title: "Success",
        description: json.reset_link
          ? "Password reset link generated successfully!"
          : "Password reset link sent to your email.",
      });
    } catch (err: any) {
      setIsLoading(false);
      toast({
        title: "Error",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="flex-1 hidden lg:block">
        <div className="h-full w-full relative flex justify-center">
          <img
            src="/images/Logo1024.png"
            alt="Animal Click"
            className="h-full w-1/2 object-scale-down"
          />
          <div className="absolute inset-0 " />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <Link
            href="/login"
            className="text-muted-foreground hover:text-primary flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Log In</span>
          </Link>

          {isSubmitted ? (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-2">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Check Your Email
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                We have sent a password reset link to <strong className="text-foreground">{email}</strong>. Please check your inbox and follow the instructions.
              </p>
              {resetLink ? (
                <div className="pt-2 space-y-3">
                  <a href={resetLink} className="block">
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                      Click Here to Reset Password
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    onClick={() => { setIsSubmitted(false); setResetLink(null); }}
                    className="w-full"
                  >
                    Try Another Email
                  </Button>
                </div>
              ) : (
                <div className="pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsSubmitted(false)}
                    className="w-full"
                  >
                    Resend Link
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="text-center relative">
                <Link href="/" className="inline-block mb-6">
                  <h1 className="text-3xl font-bold">Animal Click</h1>
                </Link>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Forgot Password?
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter your email address and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleResetRequest}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email address</Label>
                    <div className="relative mt-1">
                      <Input
                        id="email"
                        placeholder="Enter your email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  disabled={isLoading}
                  className="w-full"
                  type="submit"
                >
                  {!isLoading && <>Send Reset Link</>}
                  {isLoading && <ClipLoader size={20} color="#ffffff" />}
                </Button>

                <div className="text-center text-sm">
                  <p className="text-muted-foreground">
                    Remembered your password?{" "}
                    <Link href="/login" className="text-primary hover:underline font-medium">
                      Log In
                    </Link>
                  </p>
                </div>
              </form>
            </>
          )}

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Need help?{" "}
              <Link href="/support" className="hover:underline">
                Contact Support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
