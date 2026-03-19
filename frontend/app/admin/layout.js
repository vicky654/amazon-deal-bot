import AuthGuard from '../../components/AuthGuard';

export const metadata = {
  title: 'Admin — DealBot',
};

export default function AdminLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
