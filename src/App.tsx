import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import AppLayout from "./components/AppLayout";
import Generate from "./pages/app/Generate";
import Gallery from "./pages/app/Gallery";
import Plan from "./pages/app/Plan";
import Admin from "./pages/app/Admin";
import PurchaseSuccess from "./pages/app/PurchaseSuccess";
import TestCheckout from "./pages/app/TestCheckout";
import NotFound from "./pages/NotFound";
import { CookieConsent } from "./components/CookieConsent";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    try {
      const w = window as any;
      if (!w.fbq) {
        (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
          if (f.fbq) return; n = f.fbq = function () { n.callMethod ?
            n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
          if (!f._fbq) f._fbq = n; n.push = n; (n as any).loaded = true; (n as any).version = '2.0';
          (n as any).queue = []; t = b.createElement(e); (t as any).async = true;
          (t as any).src = v; s = b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t, s);
        })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      }
      w.fbq('init', '2216647755491538');
      w.fbq('track', 'PageView');
      console.log('Meta Pixel: initialized in App');
    } catch (e) {
      console.warn('Meta Pixel: init error', e);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <CookieConsent />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />
            
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="/app/generate" replace />} />
              <Route path="generate" element={<Generate />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="plan" element={<Plan />} />
              <Route path="test-checkout" element={<TestCheckout />} />
              <Route path="admin" element={<Admin />} />
              <Route path="purchase-success" element={<PurchaseSuccess />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
