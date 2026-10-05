import ContactForm from '../../features/contact/contact-form';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';

export default function ContactRoute() {
  const { header } = useAppLayoutRouteContext();
  return <main className="min-h-screen bg-canvas">{header}<ContactForm /></main>;
}
