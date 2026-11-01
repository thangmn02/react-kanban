import App from '../App';
import { AuthProvider } from '../providers/AuthProvider';
import AstryxThemeProvider from '../providers/AstryxThemeProvider';
import NewVersionPill from '../features/updates/NewVersionPill';
import OfflineBanner from '../components/error/OfflineBanner';
import { I18nProvider } from '../i18n';

export default function MainApp(){return <I18nProvider><AstryxThemeProvider><AuthProvider><App/></AuthProvider></AstryxThemeProvider><OfflineBanner/><NewVersionPill/></I18nProvider>;}
