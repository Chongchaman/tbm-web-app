import AppShell from './AppShell';
import AuthGate from './components/AuthGate';

export default function App() {
  return <AuthGate><AppShell /></AuthGate>;
}
