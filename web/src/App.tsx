import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Nav } from './components/ui/Nav.tsx';
import { trySilentRefresh, useAuth } from './hooks/useAuth.ts';
import Browse from './pages/Browse.tsx';
import Home from './pages/Home.tsx';
import Login from './pages/Login.tsx';
import Search from './pages/Search.tsx';
import Title from './pages/Title.tsx';
import Upload from './pages/Upload.tsx';
import Watch from './pages/Watch.tsx';

function AppShell() {
  const { user, initialized } = useAuth();

  // Attempt to restore session from the httpOnly refresh cookie.
  // This runs once at app start regardless of which page the user lands on.
  useEffect(() => {
    void trySilentRefresh();
  }, []);

  // While auth status is unknown: pass null so Nav hides the right column.
  // Once initialized: pass the initial (string) if logged in, or undefined to show "Sign in".
  const userInitial: string | null | undefined = !initialized
    ? null
    : (user?.displayName?.charAt(0).toUpperCase() ?? undefined);

  return (
    <>
      <Nav userInitial={userInitial} />
      <Routes>
        <Route path="/"               element={<Home />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/title/:slug"    element={<Title />} />
        <Route path="/admin/upload"   element={<Upload />} />
        <Route path="/watch/:assetId" element={<Watch />} />
        <Route path="/browse"         element={<Browse />} />
        <Route path="/search"         element={<Search />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
