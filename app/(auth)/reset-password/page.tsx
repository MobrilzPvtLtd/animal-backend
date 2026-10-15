"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft, CheckCircle2, Lock, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ClipLoader } from "react-spinners";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recoveryToken = useRef<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    // Check URL hash for error parameters from Supabase
    if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const token = hashParams.get("recovery_token");
      if (token) {
        recoveryToken.current = token;
        // Keep the bearer token out of the address bar after reading it.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        return;
      }
      const errorDescription = hashParams.get("error_description");
      const errorCode = hashParams.get("error_code");

      if (errorCode === "otp_expired" || errorDescription) {
        setErrorMsg(
          errorDescription
            ? errorDescription
            : "The password reset link is invalid or has expired."
        );
        return;
      }
    }

    // Check if session is present (Supabase sets session automatically from recovery link)
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session && !recoveryToken.current) {
        setErrorMsg("Your reset link has expired or is invalid. Please request a new link.");
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setErrorMsg(null);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;

    if (!password || password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    submitting.current = true;
    setIsLoading(true);

    try {
      if (recoveryToken.current) {
        const { data, error: verificationError } = await supabase.auth.verifyOtp({
          token_hash: recoveryToken.current,
          type: "recovery",
        });
        if (verificationError || !data.session) {
          setErrorMsg("Your reset link is invalid or has expired. Please request a new link.");
          setIsLoading(false);
          return;
        }
        recoveryToken.current = null;
      }

      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setIsLoading(false);
        toast({
          title: "Error",
          description: error.message || "Failed to update password.",
          variant: "destructive",
        });
        return;
      }

      // Sign out user so they are forced to log in with their new password
      await supabase.auth.signOut();

      setIsLoading(false);
      setIsSuccess(true);
      toast({
        title: "Success",
        description: "Your password has been reset successfully. Please log in with your new password.",
      });

      setTimeout(() => {
        router.replace("/login");
      }, 1500);
    } catch (err: any) {
      setIsLoading(false);
      toast({
        title: "Error",
        description: err?.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      submitting.current = false;
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

          {errorMsg ? (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-2">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Reset Link Expired or Invalid
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {errorMsg}
              </p>
              <div className="pt-4">
                <Link href="/forgot-password">
                  <Button className="w-full">
                    Request New Reset Link
                  </Button>
                </Link>
              </div>
            </div>
          ) : isSuccess ? (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-2">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Password Reset Successful!
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Your password has been updated. Redirecting you to login page...
              </p>
              <div className="pt-4">
                <Link href="/login">
                  <Button className="w-full">
                    Proceed to Log In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center relative">
                <Link href="/" className="inline-block mb-6">
                  <h1 className="text-3xl font-bold">Animal Click</h1>
                </Link>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Set New Password
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Please enter your new password below.
                </p>
              </div>

              <form className="space-y-6" onSubmit={handlePasswordUpdate}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="password"
                        placeholder="Enter new password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="confirmPassword"
                        placeholder="Confirm new password"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  disabled={isLoading}
                  className="w-full"
                  type="submit"
                >
                  {!isLoading && <>Update Password</>}
                  {isLoading && <ClipLoader size={20} color="#ffffff" />}
                </Button>
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
