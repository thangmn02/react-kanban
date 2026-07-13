import OnboardingPage from '../../components/onboarding/OnboardingPage';
import AppToastContainer from '../../components/organisms/toast/AppToastContainer';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';

export default function OnboardingRoute() {
  const { onboarding } = useAppLayoutRouteContext();
  return <><OnboardingPage {...onboarding} /><AppToastContainer /></>;
}
