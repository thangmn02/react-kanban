import App from '../App';
import { AuthProvider } from '../providers/AuthProvider';
import AstryxThemeProvider from '../providers/AstryxThemeProvider';
import OfflineBanner from '../components/error/OfflineBanner';
import { I18nProvider } from '../i18n';

export default function MainApp(){return <I18nProvider><AstryxThemeProvider><AuthProvider><App/></AuthProvider></AstryxThemeProvider><OfflineBanner/></I18nProvider>;}
