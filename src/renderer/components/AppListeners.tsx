import { useAppEvents } from '../lib/useAppEvents';
import { useWindowTitle } from '../lib/useWindowTitle';

export default function AppListeners() {
  useAppEvents();
  useWindowTitle();
  return null;
}
