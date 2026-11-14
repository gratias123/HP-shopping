import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SiteLayout } from './components/SiteLayout';
import { Spinner } from './components/ui';
import { useAuth } from './lib/auth';
import { AccountPage } from './pages/Account';
import { AccountOrderPage } from './pages/AccountOrder';
import { CartPage } from './pages/Cart';
import { CategoryPage } from './pages/Category';
import { CheckoutPage } from './pages/Checkout';
import { ConfirmationPage } from './pages/Confirmation';
import { ContactPage } from './pages/Contact';
import { FaqPage } from './pages/Faq';
import { FavoritesPage } from './pages/Favorites';
import { HomePage } from './pages/Home';
import { LegalNoticePage } from './pages/LegalNotice';
import { LoginPage } from './pages/Login';
import { NotFoundPage } from './pages/NotFound';
import { NotificationsPage } from './pages/Notifications';
import { PrivacyPage } from './pages/Privacy';
import { ProductPage } from './pages/Product';
import { RegisterPage } from './pages/Register';
import { ShippingPage } from './pages/Shipping';
import { ShopPage } from './pages/Shop';
import { TermsPage } from './pages/Terms';
import { TrackPage } from './pages/Track';
import { AdminAuditPage } from './pages/admin/Audit';
import { AdminCategoriesPage } from './pages/admin/Categories';
import { AdminDashboardPage } from './pages/admin/Dashboard';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminOrderPage } from './pages/admin/Order';
import { AdminOrdersPage } from './pages/admin/Orders';
import { AdminProductFormPage } from './pages/admin/ProductForm';
import { AdminProductsPage } from './pages/admin/Products';
import { AdminPromosPage } from './pages/admin/Promos';
import { AdminReadinessPage } from './pages/admin/Readiness';
import { AdminSettingsPage } from './pages/admin/Settings';
import { AdminShippingPage } from './pages/admin/Shipping';
import { AdminMessagesPage } from './pages/admin/Messages';
import { AdminUsersPage } from './pages/admin/Users';

function FullPageSpinner() {
  return (
    <div className="page-loading page-loading--screen">
      <Spinner label="Chargement" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/connexion?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) {
    return <Navigate to={`/connexion?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!user.isAdmin) {
    return (
      <div className="page-shell narrow">
        <div className="empty-state">
          <h1>Accès refusé</h1>
          <p>Ce compte n’a pas les autorisations nécessaires pour accéder à l’administration.</p>
          <a href="/" className="btn btn--primary">
            Retour à la boutique
          </a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="boutique" element={<ShopPage />} />
        <Route path="categories/:slug" element={<CategoryPage />} />
        <Route path="produit/:slug" element={<ProductPage />} />
        <Route path="panier" element={<CartPage />} />
        <Route path="commander" element={<CheckoutPage />} />
        <Route path="commande/:reference" element={<ConfirmationPage />} />
        <Route path="suivi" element={<TrackPage />} />
        <Route path="favoris" element={<FavoritesPage />} />
        <Route path="connexion" element={<LoginPage />} />
        <Route path="inscription" element={<RegisterPage />} />
        <Route
          path="compte"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route
          path="compte/commandes/:id"
          element={
            <RequireAuth>
              <AccountOrderPage />
            </RequireAuth>
          }
        />
        <Route
          path="notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />
        <Route path="contact" element={<ContactPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="livraison" element={<ShippingPage />} />
        <Route path="cgv" element={<TermsPage />} />
        <Route path="confidentialite" element={<PrivacyPage />} />
        <Route path="mentions-legales" element={<LegalNoticePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        path="admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="produits" element={<AdminProductsPage />} />
        <Route path="produits/nouveau" element={<AdminProductFormPage />} />
        <Route path="produits/:id" element={<AdminProductFormPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="commandes" element={<AdminOrdersPage />} />
        <Route path="commandes/:id" element={<AdminOrderPage />} />
        <Route path="promotions" element={<AdminPromosPage />} />
        <Route path="livraison" element={<AdminShippingPage />} />
        <Route path="messages" element={<AdminMessagesPage />} />
        <Route path="parametres" element={<AdminSettingsPage />} />
        <Route path="production" element={<AdminReadinessPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
        <Route path="utilisateurs" element={<AdminUsersPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
