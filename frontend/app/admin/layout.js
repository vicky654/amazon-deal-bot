import AdminShell from '../../components/AdminShell';

export const metadata = {
  title: 'Admin — DealBot',
};

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
